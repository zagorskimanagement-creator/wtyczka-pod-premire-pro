import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../../api/client.js';

export interface Project {
  id: string;
  name: string;
  status: string;
  platform: string;
  createdAt: string;
  videos: Array<{
    id: string;
    status: string;
    durationSeconds: number | null;
    storageUrl?: string;
  }>;
  clips?: Clip[];
  editPlan?: EditPlan | null;
}

export interface Clip {
  id: string;
  title: string | null;
  description: string | null;
  hashtags: string[];
  platform: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  viralScore: number | null;
  hookScore: number | null;
  retentionScore: number | null;
  captionStyle: string;
}

export interface EditPlan {
  cutsJson: unknown;
  zoomsJson: unknown;
  captionsJson: unknown;
  transitionsJson: unknown;
  effectsJson: unknown;
  titleSuggestion: string | null;
  descriptionSuggestion: string | null;
  hashtagsJson: unknown;
}

export interface Export {
  id: string;
  status: string;
  platform: string;
  resolution: string;
  downloadUrl: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AppState {
  token: string | null;
  user: { id: string; email: string; name: string | null; role: string } | null;
  isInitialized: boolean;
  activeProjectId: string | null;
  activeClipId: string | null;
  projects: Project[];
  currentProject: Project | null;
  activeExports: Export[];
  processingStatus: Record<string, { status: string; progress: number; message: string }>;
  anthropicApiKey: string | null;

  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setAnthropicApiKey: (key: string | null) => void;
  setActiveProject: (projectId: string | null) => void;
  setActiveClip: (clipId: string | null) => void;
  loadProjects: () => Promise<void>;
  loadProject: (projectId: string) => Promise<Project>;
  uploadVideo: (file: File, projectName: string, platform: string) => Promise<string>;
  triggerAnalysis: (projectId: string, options: AnalysisOptions) => Promise<void>;
  applyEditPlan: (projectId: string, clipIndex?: number) => Promise<ApplyEditResult>;
  updateProcessingStatus: (projectId: string, status: string, progress: number, message: string) => void;
}

export interface AnalysisOptions {
  targetDuration: '15' | '30' | '45' | '60';
  platform: 'TIKTOK' | 'INSTAGRAM_REELS' | 'YOUTUBE_SHORTS';
  captionStyle: 'TIKTOK' | 'HORMOZI' | 'GADZHI' | 'MRBEAST';
  removeFillers: boolean;
  removeSilence: boolean;
  removeRepetitions: boolean;
}

export interface ApplyEditResult {
  editPlan: {
    cuts: unknown[];
    zooms: unknown[];
    captions: unknown[];
    transitions: unknown[];
    effects: unknown[];
  };
  clip: {
    startMs: number;
    endMs: number;
    title: string | null;
    captions: unknown[];
  };
  video: {
    storagePath: string;
    storageUrl?: string;
    durationSeconds: number | null;
  };
  titleSuggestion: string | null;
  descriptionSuggestion: string | null;
  hashtags: unknown;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
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
            const response = await apiClient.get<{ user: AppState['user'] }>('/auth/me');
            set({ user: response.user, isInitialized: true });
          } catch {
            set({ token: null, user: null, isInitialized: true });
          }
        } else {
          set({ isInitialized: true });
        }
      },

      login: async (email, password) => {
        const response = await apiClient.post<{ token: string; user: AppState['user'] }>('/auth/login', {
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
          } else {
            void get().loadProject(projectId).catch(() => {});
          }
        }
      },

      setActiveClip: (clipId) => {
        set({ activeClipId: clipId });
      },

      loadProjects: async () => {
        const response = await apiClient.get<{ projects: Project[] }>('/projects');
        set({ projects: response.projects });
      },

      loadProject: async (projectId) => {
        const local = get().projects.find((p) => p.id === projectId);
        if (local) {
          set({ currentProject: local });
          return local;
        }
        const response = await apiClient.get<{ project: Project }>(`/project/${projectId}`);
        set({ currentProject: response.project });
        return response.project;
      },

      uploadVideo: async (file, projectName, platform) => {
        const projectId = `local-${Date.now()}`;
        const filePath = (file as File & { path?: string }).path;

        try {
          if (filePath) {
            const { TimelineManager } = await import('../../premiere/timeline.js');
            await new TimelineManager().importVideoToProject(filePath);
          }
        } catch {
          // Premiere import failure is non-fatal — project still gets created locally
        }

        const project: Project = {
          id: projectId,
          name: projectName,
          status: 'DRAFT',
          platform,
          createdAt: new Date().toISOString(),
          videos: [{
            id: `video-${Date.now()}`,
            status: 'READY',
            durationSeconds: null,
            storageUrl: filePath ?? undefined,
          }],
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

        const durationMs = (currentProject?.videos[0]?.durationSeconds ?? 60) * 1000;
        const targetMs = parseInt(options.targetDuration) * 1000;
        const startGuess = Math.round(durationMs * 0.1);

        const prompt = `You are a professional video editor specializing in viral short-form content.
Generate an edit plan for this video clip.

Video:
- Name: ${currentProject?.name ?? 'Unknown'}
- Total duration: ${Math.round(durationMs / 1000)}s
- Target platform: ${options.platform.replace('_', ' ')}
- Target clip duration: ${options.targetDuration}s
- Caption style: ${options.captionStyle}
- Remove filler words: ${options.removeFillers}
- Remove silences: ${options.removeSilence}

Pick the single most engaging ${options.targetDuration}s window from the video.
Return ONLY valid JSON (no markdown fences, no explanation):
{
  "title": "viral title here",
  "description": "one line description",
  "viralScore": 82,
  "hookScore": 75,
  "startMs": ${startGuess},
  "endMs": ${startGuess + targetMs},
  "cuts": [
    {"startMs": 0, "endMs": ${startGuess}, "type": "remove"},
    {"startMs": ${startGuess}, "endMs": ${startGuess + targetMs}, "type": "keep"}
  ],
  "zooms": [
    {"startMs": ${Math.round(targetMs * 0.1)}, "endMs": ${Math.round(targetMs * 0.3)}, "scale": 1.15, "posX": 0.5, "posY": 0.5, "easing": "ease-in-out"}
  ],
  "captions": [
    {"text": "Opening hook", "startMs": 0, "endMs": 2500, "positionY": 0.85, "fontSize": 72, "colorHex": "#FFFFFF", "strokeColor": "#000000", "strokeWidth": 3, "animationType": "pop"},
    {"text": "Continue here", "startMs": 2500, "endMs": 5000, "positionY": 0.85, "fontSize": 64, "colorHex": "#FFFFFF", "strokeColor": "#000000", "strokeWidth": 3, "animationType": "fade"}
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

          const data = await res.json() as { choices: Array<{ message: { content: string } }> };
          const raw = data.choices[0]?.message.content ?? '{}';
          const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
          const plan = JSON.parse(jsonStr) as {
            title?: string; description?: string; viralScore?: number; hookScore?: number;
            startMs?: number; endMs?: number; cuts?: unknown[]; zooms?: unknown[];
            captions?: unknown[]; hashtags?: string[];
          };

          const clip: Clip = {
            id: `clip-${Date.now()}`,
            title: plan.title ?? `${currentProject?.name ?? 'Clip'} — Best Moment`,
            description: plan.description ?? null,
            hashtags: plan.hashtags ?? [],
            platform: options.platform,
            startMs: plan.startMs ?? 0,
            endMs: plan.endMs ?? targetMs,
            durationMs: (plan.endMs ?? targetMs) - (plan.startMs ?? 0),
            viralScore: plan.viralScore ?? null,
            hookScore: plan.hookScore ?? null,
            retentionScore: null,
            captionStyle: options.captionStyle,
          };

          const editPlan: EditPlan = {
            cutsJson: plan.cuts ?? [],
            zoomsJson: plan.zooms ?? [],
            captionsJson: plan.captions ?? [],
            transitionsJson: [],
            effectsJson: [],
            titleSuggestion: plan.title ?? null,
            descriptionSuggestion: plan.description ?? null,
            hashtagsJson: plan.hashtags ?? [],
          };

          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === projectId ? { ...p, status: 'ANALYZED', clips: [clip], editPlan } : p,
            ),
            currentProject: state.currentProject?.id === projectId
              ? { ...state.currentProject, status: 'ANALYZED', clips: [clip], editPlan }
              : state.currentProject,
          }));

          get().updateProcessingStatus(projectId, 'completed', 100, 'Analysis complete!');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Analysis failed';
          get().updateProcessingStatus(projectId, 'failed', 0, msg);
        }
      },

      applyEditPlan: async (_projectId, clipIndex) => {
        const project = get().currentProject;
        if (!project?.editPlan) throw new Error('No edit plan available');

        const clip = project.clips?.[clipIndex ?? 0];
        const video = project.videos[0];

        return {
          editPlan: {
            cuts: (project.editPlan.cutsJson as unknown[]) ?? [],
            zooms: (project.editPlan.zoomsJson as unknown[]) ?? [],
            captions: (project.editPlan.captionsJson as unknown[]) ?? [],
            transitions: (project.editPlan.transitionsJson as unknown[]) ?? [],
            effects: (project.editPlan.effectsJson as unknown[]) ?? [],
          },
          clip: {
            startMs: clip?.startMs ?? 0,
            endMs: clip?.endMs ?? 0,
            title: clip?.title ?? null,
            captions: (project.editPlan.captionsJson as unknown[]) ?? [],
          },
          video: {
            storagePath: video?.storageUrl ?? '',
            storageUrl: video?.storageUrl,
            durationSeconds: video?.durationSeconds,
          },
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
    }),
    {
      name: 'shortforge-store',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        anthropicApiKey: state.anthropicApiKey,
        projects: state.projects,
      }),
    },
  ),
);
