export function createBotPreviewTracker(options: {
  hasConsent: () => boolean;
  consentVersion: () => number;
  record: (name: string, properties: Record<string, string | number>) => unknown;
  schedule?: (callback: () => void, delay: number) => unknown;
  cancel?: (timer: unknown) => void;
}, initialDesign: unknown): { observe(design: unknown, section: string): void; dispose(): void };
