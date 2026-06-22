export declare const PLATFORM_SPECS: {
    readonly TIKTOK: {
        readonly name: "TikTok";
        readonly width: 1080;
        readonly height: 1920;
        readonly aspectRatio: "9:16";
        readonly maxDurationSeconds: 60;
        readonly maxFileSizeMB: 287;
        readonly formats: readonly ["mp4"];
        readonly fps: 30;
    };
    readonly INSTAGRAM_REELS: {
        readonly name: "Instagram Reels";
        readonly width: 1080;
        readonly height: 1920;
        readonly aspectRatio: "9:16";
        readonly maxDurationSeconds: 60;
        readonly maxFileSizeMB: 250;
        readonly formats: readonly ["mp4"];
        readonly fps: 30;
    };
    readonly YOUTUBE_SHORTS: {
        readonly name: "YouTube Shorts";
        readonly width: 1080;
        readonly height: 1920;
        readonly aspectRatio: "9:16";
        readonly maxDurationSeconds: 60;
        readonly maxFileSizeMB: 256000;
        readonly formats: readonly ["mp4"];
        readonly fps: 60;
    };
};
export declare const FILLER_WORDS: readonly ["um", "uh", "uhh", "umm", "hmm", "ah", "ahh", "like", "you know", "basically", "literally", "actually", "honestly", "right", "okay", "ok", "so", "well", "i mean", "kind of", "sort of", "you see"];
export declare const SILENCE_THRESHOLD_MS = 500;
export declare const VIRAL_SCORE_THRESHOLDS: {
    readonly HIGH: 70;
    readonly MEDIUM: 40;
    readonly LOW: 0;
};
export declare const MAX_CLIP_DURATION_MS = 60000;
export declare const MIN_CLIP_DURATION_MS = 10000;
export declare const SUPPORTED_VIDEO_FORMATS: readonly ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/x-matroska"];
export declare const MAX_VIDEO_SIZE_BYTES: number;
export declare const QUEUE_NAMES: {
    readonly TRANSCRIPTION: "transcription";
    readonly ANALYSIS: "analysis";
    readonly EDIT_GENERATION: "edit-generation";
    readonly EXPORT: "export";
};
//# sourceMappingURL=index.d.ts.map