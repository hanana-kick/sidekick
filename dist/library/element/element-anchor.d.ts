import type { HorizontalAlignment, VerticalAlignment } from './element-target.js';
export interface ElementAnchorState {
    readonly target: Element;
    readonly x: number;
    readonly y: number;
    readonly alignX: HorizontalAlignment;
    readonly alignY: VerticalAlignment;
}
interface Binding {
    read(): (() => void) | undefined;
}
export declare function observeElementAnchor(document: Document, read: Binding['read']): () => void;
export {};
