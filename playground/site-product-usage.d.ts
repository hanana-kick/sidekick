/** Returns a single-use success callback; ignored without consent at both ends. */
export function prepareBotUsage(win: Window, name: string, design: unknown, context: Record<string, string>, runtime?: unknown): () => boolean;
