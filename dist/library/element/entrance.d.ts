import type { AvatarPosition } from './movement.js';
import type { PresenceEdge } from './presence.js';
export type Entrance = {
    source: 'viewport';
    edge: PresenceEdge;
    at?: number;
    inset?: number;
} | {
    source: 'element';
    target: Element | string;
    direction: PresenceEdge;
    at?: number;
    gap?: number;
};
export declare function validateEntrance(value: unknown): Entrance;
export declare function sameEntrance(a: Entrance | null, b: Entrance | null): boolean;
export interface EntranceBox {
    left: number;
    top: number;
    width: number;
    height: number;
}
export declare function entrancePositions(config: Entrance, width: number, height: number, viewportWidth: number, viewportHeight: number, target?: EntranceBox): {
    start?: AvatarPosition;
    end: AvatarPosition;
};
/** Even-odd cutout of the target viewport border rectangle in canvas-local CSS pixels. */
export declare function entranceClip(avatar: EntranceBox, target: EntranceBox): string;
