import { isAccessoryInstanceId } from '../core/accessory-id.js';
import { ACCESSORY_SLOTS } from '../core/design.js';
import type { AccessorySlot } from '../core/design.js';
import type { AccessoryPluginRegistry, PluginAccessoryAsset } from '../core/accessory-plugins.js';
import { assertAccessoryPluginEquipmentBudget } from '../core/accessory-plugins.js';

export interface PluginAccessoryOptions { slot: AccessorySlot; id?: string; color?: string }
/** Owned, cloneable renderer payload. Never contains loader or mesh factory functions. */
export interface PluginAccessoryInstance { id: string; slot: AccessorySlot; color: string; asset: PluginAccessoryAsset }
export interface PluginAccessoryReference { id: string; slot: AccessorySlot; color: string; pluginId: string }
export interface PluginEquipResult { finished: boolean }
interface Pending { resolve: (result: PluginEquipResult) => void; reject: (error: unknown) => void }
function slot(value: unknown): AccessorySlot {
  if (!ACCESSORY_SLOTS.includes(value as AccessorySlot)) throw new TypeError('Unknown accessory slot.');
  return value as AccessorySlot;
}
function options(pluginId: string, input: PluginAccessoryOptions): Required<PluginAccessoryOptions> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Accessory options are required.');
  const selected = slot(input.slot), id = input.id ?? `${pluginId}:${selected}`, color = input.color ?? '#ffcc37';
  if (!isAccessoryInstanceId(id)) throw new TypeError('Accessory id must contain 1–128 characters.');
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new TypeError('Accessory color must be #RRGGBB.');
  return { slot: selected, id, color: color.toLowerCase() };
}
/**
 * Per-avatar equipment ownership. Canceling an equip never cancels shared registry work.
 * A custom item masks the built-in item in its slot; removing it reveals that item again.
 */
export class PluginEquipmentController {
  private readonly equipped = new Map<AccessorySlot, PluginAccessoryInstance>();
  private readonly pending = new Map<AccessorySlot, Pending>();
  constructor(private readonly changed: (instances: PluginAccessoryInstance[]) => void) {}
  references(): PluginAccessoryReference[] {
    return [...this.equipped.values()].map(({ id, slot, color, asset }) => ({ id, slot, color, pluginId: asset.pluginId }));
  }
  instances(): PluginAccessoryInstance[] { return structuredClone([...this.equipped.values()]); }
  equip(registry: AccessoryPluginRegistry, pluginId: string, input: PluginAccessoryOptions): Promise<PluginEquipResult> {
    const selection = options(pluginId, input);
    if (!registry || typeof registry.load !== 'function') throw new TypeError('An accessory plugin registry is required.');
    this.cancel(selection.slot);
    return new Promise((resolve, reject) => {
      const request: Pending = { resolve, reject };
      this.pending.set(selection.slot, request);
      // Queue before invoking user-owned loading code, including synchronous throw/re-entry.
      void Promise.resolve().then(() => this.pending.get(selection.slot) === request ? registry.load(pluginId) : undefined).then(asset => {
        if (this.pending.get(selection.slot) !== request || !asset) return;
        if (!asset.slots.includes(selection.slot)) throw new RangeError(`Plugin ${pluginId} cannot use slot ${selection.slot}.`);
        if ([...this.equipped.values()].some(item => item.slot !== selection.slot && item.id === selection.id)) throw new RangeError('Accessory instance ids must be unique.');
        const item: PluginAccessoryInstance = { ...selection, asset: structuredClone(asset) };
        assertAccessoryPluginEquipmentBudget([...this.equipped.values()].filter(previous => previous.slot !== selection.slot).concat(item));
        const previous = this.equipped.get(selection.slot);
        this.equipped.set(selection.slot, item);
        try { this.changed(this.instances()); }
        catch (error) { if (previous) this.equipped.set(selection.slot, previous); else this.equipped.delete(selection.slot); throw error; }
        if (this.pending.get(selection.slot) === request) { this.pending.delete(selection.slot); resolve({ finished: true }); }
      }).catch(error => {
        if (this.pending.get(selection.slot) !== request) return;
        this.pending.delete(selection.slot); reject(error);
      });
    });
  }
  remove(value: AccessorySlot): void {
    const selected = slot(value);
    this.cancel(selected);
    const previous = this.equipped.get(selected);
    if (!previous) return;
    this.equipped.delete(selected);
    try { this.changed(this.instances()); }
    catch (error) { this.equipped.set(selected, previous); throw error; }
  }
  /** Disconnect invalidates pending work immediately, retaining completed equipment for reconnect. */
  disconnect(): void { for (const selected of [...this.pending.keys()]) this.cancel(selected); }
  private cancel(selected: AccessorySlot): void {
    const request = this.pending.get(selected);
    if (!request) return;
    this.pending.delete(selected); request.resolve({ finished: false });
  }
}
