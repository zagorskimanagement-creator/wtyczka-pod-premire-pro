export interface BRollSuggestion {
    atMs: number;
    durationMs: number;
    concept: string;
    searchQuery: string;
    keywords: string[];
    category: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}
export interface JobStatus {
    id: string;
    state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
    progress: number;
    data: unknown;
    result?: unknown;
    failedReason?: string;
    attemptsMade: number;
}
export interface ApiResponse<T = void> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}
export type Platform = 'TIKTOK' | 'INSTAGRAM_REELS' | 'YOUTUBE_SHORTS';
export type CaptionStyleName = 'TIKTOK' | 'HORMOZI' | 'GADZHI' | 'MRBEAST';
export type AspectRatio = '9:16' | '1:1' | '16:9';
export type VideoQuality = 'high' | 'medium' | 'low';
export type ExportFormat = 'mp4' | 'mov' | 'webm';
export interface ProcessingProgress {
    stage: string;
    percentage: number;
    message: string;
    estimatedRemainingMs?: number;
}
//# sourceMappingURL=index.d.ts.map