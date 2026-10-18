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
    idle(): boolean;
    nextRead: number;
}
export declare function observeElementAnchor(document: Document, read: Binding['read'], idle?: Binding['idle']): () => void;
export {};
