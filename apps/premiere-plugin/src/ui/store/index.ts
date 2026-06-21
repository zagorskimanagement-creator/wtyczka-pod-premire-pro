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

  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setActiveProject: (projectId: string | null) => void;
  setActiveClip: (clipId: string | null) => void;
  loadProjects: () => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
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

      setActiveProject: (projectId) => {
        set({ activeProjectId: projectId });
        if (projectId) {
          void get().loadProject(projectId);
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
        const response = await apiClient.get<{ project: Project }>(`/project/${projectId}`);
        set({ currentProject: response.project });
        return response.project;
      },

      uploadVideo: async (file, projectName, platform) => {
        const formData = new FormData();
        formData.append('video', file);
        formData.append('data', JSON.stringify({ name: projectName, platform }));

        const response = await apiClient.postFormData<{ projectId: string }>('/upload', formData);
        await get().loadProjects();
        return response.projectId;
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
            const status = await apiClient.get<{ projectStatus: string; videos: Array<{ status: string }> }>(
              `/upload/${projectId}/status`,
            );

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
          } catch {
            get().updateProcessingStatus(projectId, 'failed', 0, 'Connection error');
          }
        };

        setTimeout(() => { void pollStatus(); }, 3000);
      },

      applyEditPlan: async (projectId, clipIndex) => {
        const project = get().currentProject;
        if (!project?.editPlan) throw new Error('No edit plan available');

        const response = await apiClient.post<ApplyEditResult>('/apply-edit', {
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
    }),
    {
      name: 'shortforge-store',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
