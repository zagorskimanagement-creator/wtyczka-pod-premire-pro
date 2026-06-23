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
        const response = await apiClient.get(`/project/${projectId}`);
        set({ currentProject: response.project });
        return response.project;
    },
    uploadVideo: async (file, projectName, platform) => {
        const projectId = `local-${Date.now()}`;
        const filePath = file.path;
        try {
            if (filePath) {
                const { TimelineManager } = await import('../../premiere/timeline.js');
                await new TimelineManager().importVideoToProject(filePath);
            }
        }
        catch {
            // Premiere import failure is non-fatal — project still gets created locally
        }
        const project = {
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
        get().updateProcessingStatus(projectId, 'analyzing', 0, 'Starting analysis...');
        await apiClient.post('/analyze', {
            projectId,
            targetDuration: options.targetDuration,
            targetPlatform: options.platform,
            captionStyle: options.captionStyle,
            removeFillers: options.removeFillers,
            removeSilence: options.removeSilence,
            removeRepetitions: options.removeRepetitions,
            detectHooks: true,
            detectEmotions: true,
            generateTitle: true,
            generateDescription: true,
            generateHashtags: true,
        });
        const pollStatus = async () => {
            try {
                const status = await apiClient.get(`/upload/${projectId}/status`);
                if (status.projectStatus === 'ANALYZED' || status.projectStatus === 'COMPLETED') {
                    get().updateProcessingStatus(projectId, 'completed', 100, 'Analysis complete!');
                    await get().loadProject(projectId);
                    return;
                }
                if (status.projectStatus === 'FAILED') {
                    get().updateProcessingStatus(projectId, 'failed', 0, 'Analysis failed');
                    return;
                }
                get().updateProcessingStatus(projectId, 'analyzing', 50, 'AI analyzing content...');
                setTimeout(() => { void pollStatus(); }, 5000);
            }
            catch {
                get().updateProcessingStatus(projectId, 'failed', 0, 'Connection error');
            }
        };
        setTimeout(() => { void pollStatus(); }, 3000);
    },
    applyEditPlan: async (projectId, clipIndex) => {
        const project = get().currentProject;
        if (!project?.editPlan)
            throw new Error('No edit plan available');
        const response = await apiClient.post('/apply-edit', {
            projectId,
            editPlanId: project.id,
            clipIndex,
        });
        return response;
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
    partialize: (state) => ({ token: state.token, user: state.user }),
}));
