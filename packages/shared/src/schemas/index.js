import { z } from 'zod';
export const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    name: z.string().min(1).max(100).optional(),
});
export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
export const RefreshTokenSchema = z.object({
    refreshToken: z.string().min(1),
});
export const UploadVideoSchema = z.object({
    projectName: z.string().min(1).max(200).optional(),
    platform: z.enum(['TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS']).optional(),
});
export const AnalyzeVideoSchema = z.object({
    videoId: z.string().uuid(),
    options: z
        .object({
        targetDurationMs: z.number().int().min(10000).max(600000).optional(),
        maxClips: z.number().int().min(1).max(20).optional(),
        removeFillers: z.boolean().optional(),
        removeSilences: z.boolean().optional(),
        captionStyle: z.enum(['TIKTOK', 'HORMOZI', 'GADZHI', 'MRBEAST']).optional(),
        platform: z.enum(['TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS']).optional(),
    })
        .optional(),
});
export const GenerateEditSchema = z.object({
    analysisId: z.string().uuid(),
    platform: z.enum(['TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS']).default('TIKTOK'),
    captionStyle: z.enum(['TIKTOK', 'HORMOZI', 'GADZHI', 'MRBEAST']).default('TIKTOK'),
    removeFillers: z.boolean().default(true),
    removeSilences: z.boolean().default(true),
    maxClips: z.number().int().min(1).max(20).default(5),
    targetDurationMs: z.number().int().min(10000).max(600000).optional(),
});
export const GenerateCaptionsSchema = z.object({
    clipId: z.string().uuid(),
    style: z.enum(['TIKTOK', 'HORMOZI', 'GADZHI', 'MRBEAST']).default('TIKTOK'),
    wordsPerCaption: z.number().int().min(1).max(8).default(4),
    language: z.string().default('en'),
});
export const UpdateCaptionSchema = z.object({
    text: z.string().min(1).max(500).optional(),
    startMs: z.number().int().min(0).optional(),
    endMs: z.number().int().min(0).optional(),
    positionX: z.number().min(0).max(1).optional(),
    positionY: z.number().min(0).max(1).optional(),
    fontSize: z.number().int().min(8).max(200).optional(),
    colorHex: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
    strokeColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
    strokeWidth: z.number().int().min(0).max(20).optional(),
});
export const ExportSchema = z.object({
    clipId: z.string().uuid(),
    platform: z.enum(['TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS']).default('TIKTOK'),
    quality: z.enum(['high', 'medium', 'low']).default('high'),
    burnCaptions: z.boolean().default(true),
    format: z.enum(['mp4', 'mov', 'webm']).default('mp4'),
});
export const UpdateProjectSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    platform: z.enum(['TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS']).optional(),
});
export const PaginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const ApplyEditSchema = z.object({
    editPlanId: z.string().uuid(),
    sequenceId: z.string().optional(),
});
//# sourceMappingURL=index.js.map