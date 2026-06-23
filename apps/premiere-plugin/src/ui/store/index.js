import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../../api/client.js';
export const useStore = create()(persist((set, get) => ({
    token: null,
    user: null,
    isInitialized: false,
    activeProjectId: null,
    activeClipId: null,
    projects: [],
    currentProject: null,
    activeExports: [],
    processingStatus: {},
    anthropicApiKey: null,
    initialize: async () => {
        const { token } = get();
        if (token) {
            try {
                apiClient.setToken(token);
                const response = await apiClient.get('/auth/me');
                set({ user: response.user, isInitialized: true });
            }
            catch {
                set({ token: null, user: null, isInitialized: true });
            }
        }
        else {
            set({ isInitialized: true });
        }
    },
    login: async (email, password) => {
        const response = await apiClient.post('/auth/login', {
            email,
            password,
        });
        apiClient.setToken(response.token);
        set({ token: response.token, user: response.user });
    },
    logout: () => {
        apiClient.setToken(null);
        set({ token: null, user: null, activeProjectId: null, currentProject: null });
    },
    setAnthropicApiKey: (key) => {
        set({ anthropicApiKey: key });
    },
    setActiveProject: (projectId) => {
        set({ activeProjectId: projectId });
        if (projectId) {
            const local = get().projects.find((p) => p.id === projectId);
            if (local) {
                set({ currentProject: local });
            }
            else {
                void get().loadProject(projectId).catch(() => { });
            }
        }
    },
    setActiveClip: (clipId) => {
        set({ activeClipId: clipId });
    },
    loadProjects: async () => {
        const response = await apiClient.get('/projects');
        set({ projects: response.projects });
    },
    loadProject: async (projectId) => {
        const local = get().projects.find((p) => p.id === projectId);
        if (local) {
            set({ currentProject: local });
            return local;
        }
        const response = await apiClient.get(`/project/${projectId}`);
        set({ currentProject: response.project });
        return response.project;
    },
    uploadVideo: async (file, projectName, platform) => {
        return get().uploadVideos([file], projectName, platform);
    },
    uploadVideos: async (files, projectName, platform) => {
        const projectId = `local-${Date.now()}`;
        const tm = new (await import('../../premiere/timeline.js')).TimelineManager();
        const videos = await Promise.all(files.map(async (file, i) => {
            const filePath = file.path;
            const clipName = file.name.replace(/\.[^.]+$/, '');
            try {
                if (filePath)
                    await tm.importVideoToProject(filePath);
            }
            catch { /* non-fatal */ }
            return {
                id: `video-${Date.now()}-${i}`,
                name: clipName,
                status: 'READY',
                durationSeconds: null,
                storageUrl: filePath ?? undefined,
            };
        }));
        const project = {
            id: projectId,
            name: projectName,
            status: 'DRAFT',
            platform,
            createdAt: new Date().toISOString(),
            videos,
            clips: [],
            editPlan: null,
        };
        set((state) => ({ projects: [project, ...state.projects] }));
        return projectId;
    },
    triggerAnalysis: async (projectId, options) => {
        const { anthropicApiKey, currentProject } = get();
        if (!anthropicApiKey) {
            get().updateProcessingStatus(projectId, 'failed', 0, 'No API key — add your Anthropic API key in Settings.');
            return;
        }
        get().updateProcessingStatus(projectId, 'analyzing', 10, 'Connecting to Claude AI...');
        const videoList = currentProject?.videos ?? [];
        const targetMs = parseInt(options.targetDuration) * 1000;
        const isMulti = videoList.length > 1;
        const videoDescriptions = videoList.map((v, i) => `  Video ${i} (clipIndex ${i}): "${v.name}" — ${Math.round((v.durationSeconds ?? 60))}s`).join('\n');
        const firstDurMs = (videoList[0]?.durationSeconds ?? 60) * 1000;
        const startGuess = Math.round(firstDurMs * 0.1);
        const exampleSegs = isMulti
            ? videoList.map((v, i) => {
                const dur = (v.durationSeconds ?? 60) * 1000;
                const s = Math.round(dur * 0.1);
                const share = Math.round(targetMs / videoList.length);
                return `    {"clipIndex": ${i}, "startMs": ${s}, "endMs": ${Math.min(s + share, dur)}}`;
            }).join(',\n')
            : [
                `    {"clipIndex": 0, "startMs": ${startGuess}, "endMs": ${startGuess + Math.round(targetMs * 0.18)}}`,
                `    {"clipIndex": 0, "startMs": ${startGuess + Math.round(targetMs * 0.19)}, "endMs": ${startGuess + Math.round(targetMs * 0.37)}}`,
                `    {"clipIndex": 0, "startMs": ${startGuess + Math.round(targetMs * 0.38)}, "endMs": ${startGuess + Math.round(targetMs * 0.57)}}`,
                `    {"clipIndex": 0, "startMs": ${startGuess + Math.round(targetMs * 0.58)}, "endMs": ${startGuess + Math.round(targetMs * 0.76)}}`,
                `    {"clipIndex": 0, "startMs": ${startGuess + Math.round(targetMs * 0.77)}, "endMs": ${startGuess + targetMs}}`,
            ].join(',\n');
        const prompt = `You are a professional viral video editor. Generate a complete edit plan for a short-form video${isMulti ? ' MERGED from multiple source videos' : ''}.

Source video${isMulti ? 's' : ''}:
${videoDescriptions}

Target platform: ${options.platform.replace(/_/g, ' ')}
Target final duration: ${options.targetDuration}s
Caption style: ${options.captionStyle}
Remove filler words: ${options.removeFillers}
Remove silences: ${options.removeSilence}

Instructions:
1. ${isMulti ? `Merge ALL ${videoList.length} videos into one ${options.targetDuration}s clip — take the best moments from each` : `Pick the best ${options.targetDuration}s starting around ${Math.round(firstDurMs / 1000 * 0.1)}s`}
2. Split into 5-8 keep segments with 0.3-1s gaps (simulating silence/pause removal)
3. Every segment MUST include "clipIndex" (0-based index of the source video)
4. Total of all keepSegments durations must equal exactly ${options.targetDuration}s
5. Captions: one short punchy line every 2-4 seconds (RELATIVE to final clip start at 0)
6. Zooms: 1-2 subtle zoom-ins for emphasis (also relative)

Return ONLY valid JSON (no markdown):
{
  "title": "VIRAL TITLE IN CAPS",
  "description": "one hook sentence",
  "viralScore": 85,
  "hookScore": 78,
  "keepSegments": [
${exampleSegs}
  ],
  "zooms": [
    {"startMs": ${Math.round(targetMs * 0.05)}, "endMs": ${Math.round(targetMs * 0.20)}, "scale": 1.15, "posX": 0.5, "posY": 0.5, "easing": "ease-in-out"},
    {"startMs": ${Math.round(targetMs * 0.55)}, "endMs": ${Math.round(targetMs * 0.70)}, "scale": 1.12, "posX": 0.5, "posY": 0.5, "easing": "ease-in-out"}
  ],
  "captions": [
    {"text": "HOOK LINE HERE", "startMs": 0, "endMs": 2500, "positionY": 0.85, "fontSize": 72, "colorHex": "#FFFFFF", "strokeColor": "#000000", "strokeWidth": 3},
    {"text": "Second line", "startMs": 2500, "endMs": 5500, "positionY": 0.85, "fontSize": 64, "colorHex": "#FFFFFF", "strokeColor": "#000000", "strokeWidth": 3},
    {"text": "Third line", "startMs": 5500, "endMs": 9000, "positionY": 0.85, "fontSize": 64, "colorHex": "#FFFFFF", "strokeColor": "#000000", "strokeWidth": 3}
  ],
  "hashtags": ["#viral", "#fyp", "#trending"]
}`;
        try {
            get().updateProcessingStatus(projectId, 'analyzing', 30, 'Asking Claude AI...');
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${anthropicApiKey}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    max_tokens: 2048,
                    messages: [{ role: 'user', content: prompt }],
                }),
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Groq API ${res.status}: ${errText}`);
            }
            get().updateProcessingStatus(projectId, 'analyzing', 75, 'Processing results...');
            const data = await res.json();
            const raw = data.choices[0]?.message.content ?? '{}';
            const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
            const plan = JSON.parse(jsonStr);
            const segs = plan.keepSegments ?? [{ startMs: startGuess, endMs: startGuess + targetMs }];
            const clipStartMs = segs[0]?.startMs ?? startGuess;
            const clipEndMs = segs[segs.length - 1]?.endMs ?? startGuess + targetMs;
            const clip = {
                id: `clip-${Date.now()}`,
                title: plan.title ?? `${currentProject?.name ?? 'Clip'} — Best Moment`,
                description: plan.description ?? null,
                hashtags: plan.hashtags ?? [],
                platform: options.platform,
                startMs: clipStartMs,
                endMs: clipEndMs,
                durationMs: targetMs,
                viralScore: plan.viralScore ?? null,
                hookScore: plan.hookScore ?? null,
                retentionScore: null,
                captionStyle: options.captionStyle,
            };
            const editPlan = {
                cutsJson: segs,
                zoomsJson: plan.zooms ?? [],
                captionsJson: plan.captions ?? [],
                transitionsJson: [],
                effectsJson: [],
                titleSuggestion: plan.title ?? null,
                descriptionSuggestion: plan.description ?? null,
                hashtagsJson: plan.hashtags ?? [],
                format: options.format,
                transitionType: options.transitionType,
            };
            set((state) => ({
                projects: state.projects.map((p) => p.id === projectId ? { ...p, status: 'ANALYZED', clips: [clip], editPlan } : p),
                currentProject: state.currentProject?.id === projectId
                    ? { ...state.currentProject, status: 'ANALYZED', clips: [clip], editPlan }
                    : state.currentProject,
            }));
            get().updateProcessingStatus(projectId, 'completed', 100, 'Analysis complete!');
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Analysis failed';
            get().updateProcessingStatus(projectId, 'failed', 0, msg);
        }
    },
    applyEditPlan: async (_projectId, clipIndex) => {
        const project = get().currentProject;
        if (!project?.editPlan)
            throw new Error('No edit plan available');
        const clip = project.clips?.[clipIndex ?? 0];
        const video = project.videos[0];
        return {
            editPlan: {
                keepSegments: project.editPlan.cutsJson ?? [],
                zooms: project.editPlan.zoomsJson ?? [],
                captions: project.editPlan.captionsJson ?? [],
                transitions: project.editPlan.transitionsJson ?? [],
                effects: project.editPlan.effectsJson ?? [],
                format: project.editPlan.format ?? '16:9',
                transitionType: project.editPlan.transitionType ?? 'cut',
            },
            clip: {
                startMs: clip?.startMs ?? 0,
                endMs: clip?.endMs ?? 0,
                title: clip?.title ?? null,
                captions: project.editPlan.captionsJson ?? [],
            },
            video: {
                storagePath: video?.storageUrl ?? '',
                storageUrl: video?.storageUrl,
                durationSeconds: video?.durationSeconds,
            },
            videos: (project.videos ?? []).map((v) => ({
                name: v.name,
                storagePath: v.storageUrl ?? '',
                durationSeconds: v.durationSeconds,
            })),
            titleSuggestion: project.editPlan.titleSuggestion,
            descriptionSuggestion: project.editPlan.descriptionSuggestion,
            hashtags: project.editPlan.hashtagsJson,
        };
    },
    updateProcessingStatus: (projectId, status, progress, message) => {
        set((state) => ({
            processingStatus: {
                ...state.processingStatus,
                [projectId]: { status, progress, message },
            },
        }));
    },
}), {
    name: 'shortforge-store',
    partialize: (state) => ({
        token: state.token,
        user: state.user,
        anthropicApiKey: state.anthropicApiKey,
        projects: state.projects,
    }),
}));
