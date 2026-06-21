export function msToTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

export function timestampToMs(timestamp: string): number {
  const parts = timestamp.split(':').reverse();
  let ms = 0;
  if (parts[0]) {
    const [secPart, msPart] = parts[0].split('.');
    ms += parseInt(secPart ?? '0', 10) * 1000;
    ms += parseInt((msPart ?? '0').padEnd(3, '0'), 10);
  }
  if (parts[1]) ms += parseInt(parts[1], 10) * 60 * 1000;
  if (parts[2]) ms += parseInt(parts[2], 10) * 3600 * 1000;
  return ms;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  const attempt = async (attemptNumber: number): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (attemptNumber >= maxAttempts) throw error;
      const delay = baseDelayMs * Math.pow(2, attemptNumber - 1);
      await sleep(delay);
      return attempt(attemptNumber + 1);
    }
  };
  return attempt(1);
}

export function truncateText(text: string, maxLength: number, ellipsis = '...'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}
