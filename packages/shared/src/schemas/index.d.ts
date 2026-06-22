import { z } from 'zod';
export declare const RegisterSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    name?: string | undefined;
}, {
    email: string;
    password: string;
    name?: string | undefined;
}>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const RefreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export declare const UploadVideoSchema: z.ZodObject<{
    projectName: z.ZodOptional<z.ZodString>;
    platform: z.ZodOptional<z.ZodEnum<["TIKTOK", "INSTAGRAM_REELS", "YOUTUBE_SHORTS"]>>;
}, "strip", z.ZodTypeAny, {
    projectName?: string | undefined;
    platform?: "TIKTOK" | "INSTAGRAM_REELS" | "YOUTUBE_SHORTS" | undefined;
}, {
    projectName?: string | undefined;
    platform?: "TIKTOK" | "INSTAGRAM_REELS" | "YOUTUBE_SHORTS" | undefined;
}>;
export declare const AnalyzeVideoSchema: z.ZodObject<{
    videoId: z.ZodString;
    options: z.ZodOptional<z.ZodObject<{
        targetDurationMs: z.ZodOptional<z.ZodNumber>;
        maxClips: z.ZodOptional<z.ZodNumber>;
        removeFillers: z.ZodOptional<z.ZodBoolean>;
        removeSilences: z.ZodOptional<z.ZodBoolean>;
        captionStyle: z.ZodOptional<z.ZodEnum<["TIKTOK", "HORMOZI", "GADZHI", "MRBEAST"]>>;
        platform: z.ZodOptional<z.ZodEnum<["TIKTOK", "INSTAGRAM_REELS", "YOUTUBE_SHORTS"]>>;
    }, "strip", z.ZodTypeAny, {
        platform?: "TIKTOK" | "INSTAGRAM_REELS" | "YOUTUBE_SHORTS" | undefined;
        targetDurationMs?: number | undefined;
        maxClips?: number | undefined;
        removeFillers?: boolean | undefined;
        removeSilences?: boolean | undefined;
        captionStyle?: "TIKTOK" | "HORMOZI" | "GADZHI" | "MRBEAST" | undefined;
    }, {
        platform?: "TIKTOK" | "INSTAGRAM_REELS" | "YOUTUBE_SHORTS" | undefined;
        targetDurationMs?: number | undefined;
        maxClips?: number | undefined;
        removeFillers?: boolean | undefined;
        removeSilences?: boolean | undefined;
        captionStyle?: "TIKTOK" | "HORMOZI" | "GADZHI" | "MRBEAST" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    videoId: string;
    options?: {
        platform?: "TIKTOK" | "INSTAGRAM_REELS" | "YOUTUBE_SHORTS" | undefined;
        targetDurationMs?: number | undefined;
        maxClips?: number | undefined;
        removeFillers?: boolean | undefined;
        removeSilences?: boolean | undefined;
        captionStyle?: "TIKTOK" | "HORMOZI" | "GADZHI" | "MRBEAST" | undefined;
    } | undefined;
}, {
    videoId: string;
    options?: {
        platform?: "TIKTOK" | "INSTAGRAM_REELS" | "YOUTUBE_SHORTS" | undefined;
        targetDurationMs?: number | undefined;
        maxClips?: number | undefined;
        removeFillers?: boolean | undefined;
        removeSilences?: boolean | undefined;
        captionStyle?: "TIKTOK" | "HORMOZI" | "GADZHI" | "MRBEAST" | undefined;
    } | undefined;
}>;
export declare const GenerateEditSchema: z.ZodObject<{
    analysisId: z.ZodString;
    platform: z.ZodDefault<z.ZodEnum<["TIKTOK", "INSTAGRAM_REELS", "YOUTUBE_SHORTS"]>>;
    captionStyle: z.ZodDefault<z.ZodEnum<["TIKTOK", "HORMOZI", "GADZHI", "MRBEAST"]>>;
    removeFillers: z.ZodDefault<z.ZodBoolean>;
    removeSilences: z.ZodDefault<z.ZodBoolean>;
    maxClips: z.ZodDefault<z.ZodNumber>;
    targetDurationMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    platform: "TIKTOK" | "INSTAGRAM_REELS" | "YOUTUBE_SHORTS";
    maxClips: number;
    removeFillers: boolean;
    removeSilences: boolean;
    captionStyle: "TIKTOK" | "HORMOZI" | "GADZHI" | "MRBEAST";
    analysisId: string;
    targetDurationMs?: number | undefined;
}, {
    analysisId: string;
    platform?: "TIKTOK" | "INSTAGRAM_REELS" | "YOUTUBE_SHORTS" | undefined;
    targetDurationMs?: number | undefined;
    maxClips?: number | undefined;
    removeFillers?: boolean | undefined;
    removeSilences?: boolean | undefined;
    captionStyle?: "TIKTOK" | "HORMOZI" | "GADZHI" | "MRBEAST" | undefined;
}>;
export declare const GenerateCaptionsSchema: z.ZodObject<{
    clipId: z.ZodString;
    style: z.ZodDefault<z.ZodEnum<["TIKTOK", "HORMOZI", "GADZHI", "MRBEAST"]>>;
    wordsPerCaption: z.ZodDefault<z.ZodNumber>;
    language: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    clipId: string;
    style: "TIKTOK" | "HORMOZI" | "GADZHI" | "MRBEAST";
    wordsPerCaption: number;
    language: string;
}, {
    clipId: string;
    style?: "TIKTOK" | "HORMOZI" | "GADZHI" | "MRBEAST" | undefined;
    wordsPerCaption?: number | undefined;
    language?: string | undefined;
}>;
export declare const UpdateCaptionSchema: z.ZodObject<{
    text: z.ZodOptional<z.ZodString>;
    startMs: z.ZodOptional<z.ZodNumber>;
    endMs: z.ZodOptional<z.ZodNumber>;
    positionX: z.ZodOptional<z.ZodNumber>;
    positionY: z.ZodOptional<z.ZodNumber>;
    fontSize: z.ZodOptional<z.ZodNumber>;
    colorHex: z.ZodOptional<z.ZodString>;
    strokeColor: z.ZodOptional<z.ZodString>;
    strokeWidth: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    startMs?: number | undefined;
    endMs?: number | undefined;
    text?: string | undefined;
    positionX?: number | undefined;
    positionY?: number | undefined;
    fontSize?: number | undefined;
    colorHex?: string | undefined;
    strokeColor?: string | undefined;
    strokeWidth?: number | undefined;
}, {
    startMs?: number | undefined;
    endMs?: number | undefined;
    text?: string | undefined;
    positionX?: number | undefined;
    positionY?: number | undefined;
    fontSize?: number | undefined;
    colorHex?: string | undefined;
    strokeColor?: string | undefined;
    strokeWidth?: number | undefined;
}>;
export declare const ExportSchema: z.ZodObject<{
    clipId: z.ZodString;
    platform: z.ZodDefault<z.ZodEnum<["TIKTOK", "INSTAGRAM_REELS", "YOUTUBE_SHORTS"]>>;
    quality: z.ZodDefault<z.ZodEnum<["high", "medium", "low"]>>;
    burnCaptions: z.ZodDefault<z.ZodBoolean>;
    format: z.ZodDefault<z.ZodEnum<["mp4", "mov", "webm"]>>;
}, "strip", z.ZodTypeAny, {
    platform: "TIKTOK" | "INSTAGRAM_REELS" | "YOUTUBE_SHORTS";
    clipId: string;
    quality: "medium" | "high" | "low";
    burnCaptions: boolean;
    format: "mp4" | "mov" | "webm";
}, {
    clipId: string;
    platform?: "TIKTOK" | "INSTAGRAM_REELS" | "YOUTUBE_SHORTS" | undefined;
    quality?: "medium" | "high" | "low" | undefined;
    burnCaptions?: boolean | undefined;
    format?: "mp4" | "mov" | "webm" | undefined;
}>;
export declare const UpdateProjectSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    platform: z.ZodOptional<z.ZodEnum<["TIKTOK", "INSTAGRAM_REELS", "YOUTUBE_SHORTS"]>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    platform?: "TIKTOK" | "INSTAGRAM_REELS" | "YOUTUBE_SHORTS" | undefined;
}, {
    name?: string | undefined;
    platform?: "TIKTOK" | "INSTAGRAM_REELS" | "YOUTUBE_SHORTS" | undefined;
}>;
export declare const PaginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: number | undefined;
    limit?: number | undefined;
}>;
export declare const ApplyEditSchema: z.ZodObject<{
    editPlanId: z.ZodString;
    sequenceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    editPlanId: string;
    sequenceId?: string | undefined;
}, {
    editPlanId: string;
    sequenceId?: string | undefined;
}>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UploadVideoInput = z.infer<typeof UploadVideoSchema>;
export type AnalyzeVideoInput = z.infer<typeof AnalyzeVideoSchema>;
export type GenerateEditInput = z.infer<typeof GenerateEditSchema>;
export type GenerateCaptionsInput = z.infer<typeof GenerateCaptionsSchema>;
export type UpdateCaptionInput = z.infer<typeof UpdateCaptionSchema>;
export type ExportInput = z.infer<typeof ExportSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type ApplyEditInput = z.infer<typeof ApplyEditSchema>;
//# sourceMappingURL=index.d.ts.map