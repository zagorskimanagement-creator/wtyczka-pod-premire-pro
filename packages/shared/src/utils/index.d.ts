export declare function msToTimestamp(ms: number): string;
export declare function timestampToMs(timestamp: string): number;
export declare function formatDuration(seconds: number): string;
export declare function clamp(value: number, min: number, max: number): number;
export declare function slugify(text: string): string;
export declare function chunk<T>(array: T[], size: number): T[][];
export declare function sleep(ms: number): Promise<void>;
export declare function retryWithBackoff<T>(fn: () => Promise<T>, maxAttempts?: number, baseDelayMs?: number): Promise<T>;
export declare function truncateText(text: string, maxLength: number, ellipsis?: string): string;
export declare function generateId(): string;
//# sourceMappingURL=index.d.ts.map