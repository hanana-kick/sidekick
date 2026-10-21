/** Plain-text dialogue; deliberately separate from rendering and audio. */
export interface SpeechOptions {
    /** Milliseconds, 0–60000. Zero persists until dismissed. Default 5000. */
    duration?: number;
    placement?: 'auto' | 'top' | 'bottom';
    dismissible?: boolean;
    /** Localized accessible name for the optional close button. */
    dismissLabel?: string;
}
export declare function validateSpeech(text: string, options?: SpeechOptions): Required<SpeechOptions>;
interface Point {
    x: number;
    y: number;
}
/** No animation loop, GPU work, or idle observers. Movement uses cached geometry. */
export declare class SpeechController {
    private host;
    private position;
    private available;
    private root?;
    private bubble?;
    private message?;
    private timer?;
    private observer?;
    private frame?;
    private rect?;
    private origin?;
    private dimensions;
    private options?;
    constructor(host: HTMLElement, position: () => Point, available: () => boolean);
    say(text: string, input?: SpeechOptions): void;
    clear: () => void;
    private visibility;
    private scheduleMeasure;
    private anchorRect;
    measure: () => void;
    /** Called by the existing DOM movement clock. No layout read here. */
    move(): void;
}
export {};
