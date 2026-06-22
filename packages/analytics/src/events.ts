export type EventName = 'user.registered' | 'user.logged_in' | 'user.upgraded' | 'video.uploaded' | 'video.transcribed' | 'video.analyzed' | 'edit.generated' | 'edit.applied_to_timeline' | 'caption.generated' | 'export.started' | 'export.completed' | 'export.failed' | 'api.request' | 'api.error' | 'queue.job_enqueued' | 'queue.job_completed' | 'queue.job_failed' | 'clip.viral_score_calculated' | 'hook.detected' | 'broll.suggested';

export interface BaseEvent { name: EventName; timestamp: Date; sessionId?: string; userId?: string; projectId?: string; }

export interface VideoUploadedEvent extends BaseEvent { name: 'video.uploaded'; properties: { fileSizeBytes: number; durationMs?: number; format: string; platform: string }; }
export interface VideoAnalyzedEvent extends BaseEvent { name: 'video.analyzed'; properties: { durationMs: number; segmentCount: number; hookCount: number; topViralScore: number; processingTimeMs: number }; }
export interface EditGeneratedEvent extends BaseEvent { name: 'edit.generated'; properties: { clipCount: number; totalDurationMs: number; captionStyle: string; platform: string; removedFillers: boolean; removedSilences: boolean }; }
export interface ExportCompletedEvent extends BaseEvent { name: 'export.completed'; properties: { platform: string; quality: string; fileSizeBytes: number; durationMs: number; burnedCaptions: boolean; processingTimeMs: number }; }
export interface ApiRequestEvent extends BaseEvent { name: 'api.request'; properties: { method: string; path: string; statusCode: number; durationMs: number; userAgent?: string }; }
export interface ApiErrorEvent extends BaseEvent { name: 'api.error'; properties: { method: string; path: string; statusCode: number; errorCode: string; message: string }; }
export interface QueueJobEvent extends BaseEvent { name: 'queue.job_enqueued' | 'queue.job_completed' | 'queue.job_failed'; properties: { queueName: string; jobId: string; attempts?: number; processingTimeMs?: number; failedReason?: string }; }
export interface ClipViralScoreEvent extends BaseEvent { name: 'clip.viral_score_calculated'; properties: { clipId: string; viralScore: number; hookScore: number; retentionScore: number; durationMs: number }; }

export type AnyEvent = VideoUploadedEvent | VideoAnalyzedEvent | EditGeneratedEvent | ExportCompletedEvent | ApiRequestEvent | ApiErrorEvent | QueueJobEvent | ClipViralScoreEvent;
