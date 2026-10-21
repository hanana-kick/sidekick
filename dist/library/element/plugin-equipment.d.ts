import type { AccessorySlot } from '../core/design.js';
import type { AccessoryPluginRegistry, PluginAccessoryAsset } from '../core/accessory-plugins.js';
export interface PluginAccessoryOptions {
    slot: AccessorySlot;
    id?: string;
    color?: string;
}
/** Owned, cloneable renderer payload. Never contains loader or mesh factory functions. */
export interface PluginAccessoryInstance {
    id: string;
    slot: AccessorySlot;
    color: string;
    asset: PluginAccessoryAsset;
}
export interface PluginAccessoryReference {
    id: string;
    slot: AccessorySlot;
    color: string;
    pluginId: string;
}
export interface PluginEquipResult {
    finished: boolean;
}
/**
 * Per-avatar equipment ownership. Canceling an equip never cancels shared registry work.
 * A custom item masks the built-in item in its slot; removing it reveals that item again.
 */
export declare class PluginEquipmentController {
    private readonly changed;
    private readonly equipped;
    private readonly pending;
    constructor(changed: (instances: PluginAccessoryInstance[]) => void);
    references(): PluginAccessoryReference[];
    instances(): PluginAccessoryInstance[];
    equip(registry: AccessoryPluginRegistry, pluginId: string, input: PluginAccessoryOptions): Promise<PluginEquipResult>;
    remove(value: AccessorySlot): void;
    /** Disconnect invalidates pending work immediately, retaining completed equipment for reconnect. */
    disconnect(): void;
    private cancel;
}
