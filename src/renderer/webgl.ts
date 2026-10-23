import { createBodySkinBinding, validateBodyRig } from '../core/body-rig.js';
import type { BodyRig } from '../core/body-rig.js';
import { computeBoneMatrices, createSkinDeformer, validateBonePose } from '../core/rigging.js';
import type { BonePose, BoneMatrices, SkinDeformer } from '../core/rigging.js';
import type { PartAnimationSample } from '../core/part-animation.js';
import { getAccessoryAttachmentFrame } from '../core/accessory-attachments.js';
import { AccessoryPluginFitter, accessoryPluginMaterialColor } from '../core/plugin-mount.js';
import type { AccessoryPluginFit } from '../core/plugin-mount.js';
import { assertAccessoryPluginEquipmentBudget } from '../core/accessory-plugins.js';
import type { AccessoryPluginEyeMeasurements } from '../core/plugin-deformation.js';
import type { ShapeWeights } from '../core/shape-motion.js';
import type { PluginAccessoryInstance } from '../element/plugin-equipment.js';
import { AccessoryTransition } from '../core/accessory-transition.js';
import type { ResolvedAccessoryDesign } from '../core/resolved-design.js';
import { createZoom } from '../core/zoom.js';
import { travelMatrix } from '../core/travel.js';
import type { TravelPresentation } from '../core/travel.js';
import type { AccessorySlot, Activity, AvatarDesign, RenderStyle, Vec3 } from '../core/design.js';
import { resolveDesign } from '../core/resolved-design.js';
import type { ActivityFrame, Pose } from '../core/motion.js';
import type { BodyOrientation } from '../core/body-orientation.js';
import { bodyOrientationMatrix, createBodyOrientation } from '../core/body-orientation.js';
import { activityFrame } from '../core/motion.js';
import { EyeBlinkGate, composeEyePose } from '../core/expressions.js';
import { clamp, multiply, orthographic, spring, transform } from '../core/math.js';
import type { Mat4 } from '../core/math.js';
import { deformBodyPoint, sampleAccessorySurface, BODY_SIZE } from '../core/surface.js';
import { BODY_DEPTH_RANGE, accessoryMountProfile, resolveShapeProfile } from '../core/shape-profiles.js';
import type { ShapeProfile } from '../core/shape-profiles.js';
import { torus } from './geometry.js';
import { projectEyes } from './eye-projection.js';
import { glassesGeometry } from './glasses-geometry.js';
import type { GlassesGeometry } from './glasses-geometry.js';
import { beretGeometry, beretBandColor } from './beret-geometry.js';
import type { BeretGeometry } from './beret-geometry.js';
import { catalogAccessoryGeometry, accessoryDetailColor } from './catalog-accessory-geometry.js';
import { bodyGeometry } from './body-geometry.js';
import { shapeContour } from '../core/contours.js';
import type { ShapeContour } from '../core/contours.js';
import type { Geometry } from './geometry.js';
import { createBackend } from './render-backend.js';
import type { RenderBackend, Mesh, RendererOptions } from './render-backend.js';
export interface RenderState {
  partAnimation?: PartAnimationSample;
  /** Immutable rig snapshot. Direct renderer clients must replace the object to change it. */
  rig?: BodyRig;
  bonePose?: BonePose;
  accessoryBonePoses?: Record<string, BonePose>;
  pluginAccessories?: readonly PluginAccessoryInstance[];
  pose: Pose; activity: Activity; time: number; delta: number; reduced: boolean; style: RenderStyle;
  /** Optional runtime activity crossfade; direct renderer clients keep the standard loop. */
  activityFrame?: ActivityFrame;
  /** Snap presentation while paused; authored state remains immediate either way. */
  instant?: boolean;
  /** Existing whole-canvas transitions already hide the equipment swap. */
  equipmentImmediate?: boolean;
  travel?: TravelPresentation;
  bodyOrientation?: Partial<BodyOrientation>;
  zoom?: number;
  /** Active explicit eye tracks postpone a newly starting idle blink per eye. */
  eyeMotion?: Record<'left' | 'right', boolean>;
  contour?: ShapeContour;
  profile?: ShapeProfile;
  shapeWeights?: ShapeWeights;
}
/** Shared geometry and animation, presented through WebGL2 or Canvas2D. */
export class AvatarRenderer {
  private backend: RenderBackend;
  private pluginMeshes = new Map<string, { asset: PluginAccessoryInstance['asset']; mesh: Mesh; fitter?: AccessoryPluginFitter; lag?: [number, number]; fit?: AccessoryPluginFit; skin?: SkinDeformer; skinPose?: string }>();
  get gl(): WebGL2RenderingContext | undefined { return this.backend.gl; }
  get graphics(): 'webgl2' | 'canvas2d' { return this.backend.kind; }
  private meshes: Record<'body' | 'beret' | 'glasses' | 'halo', Mesh>;
  private beretContour?: ShapeContour;
  private beretKey = '';
  private beretBandIndexCount = 0;
  private glassesContour?: ShapeContour;
  private glassesKey = '';
  private catalogMeshes = new Map<AccessorySlot, { mesh: Mesh; contour: ShapeContour; key: string; mainIndexCount: number; detailIndexCount: number }>();
  private bodyDirections: Float32Array;
  private bodyContour?: ShapeContour;
  private bodyDeformation = '';
  private bodyNeutral = new Float32Array(0);
  private bodyRig?: BodyRig;
  private bodyRigSource?: BodyRig;
  private bodyRigSignature = '';
  private bodySkin?: SkinDeformer;
  private bodySkinPose = '';
  private bodyBones?: BoneMatrices;
  private lag = new Map<string, [number, number]>();
  private accessoryPose = new Map<string, Vec3>();
  private authoredAccessoryPose = new Set<string>();
  private accessoryPoseTakeover = new Map<string, { from: Vec3; elapsed: number }>();
  private disposed = false;
  private drawCount = 0;
  private blinkGate = new EyeBlinkGate();
  private equipment = new AccessoryTransition<ResolvedAccessoryDesign>();
  private displayAspect?: number;
  private inputSignature = '';
  private resolvedInput?: ReturnType<typeof resolveDesign>;
  constructor(readonly canvas: HTMLCanvasElement | OffscreenCanvas, options: RendererOptions = {}) {
    this.backend = createBackend(canvas, options);
    const uploaded: Mesh[] = [];
    try {
      const upload = (data: Geometry): Mesh => { const mesh = this.upload(data); uploaded.push(mesh); return mesh; };
      this.meshes = { body: upload({ vertices: new Float32Array(0), indices: new Uint16Array(0) }), beret: upload({ vertices: new Float32Array(0), indices: new Uint16Array(0) }), glasses: upload({ vertices: new Float32Array(0), indices: new Uint16Array(0) }), halo: upload(torus(0.055)) };
      this.bodyDirections = new Float32Array(0);
    } catch (error) {
      for (const mesh of uploaded) this.backend.deleteMesh(mesh);
      this.backend.dispose();
      throw this.backend.initializationError(error);
    }
  }
  private upload(data: Geometry): Mesh { return this.backend.upload(data); }
  resize(width: number, height: number, dpr = 1): void {
    const ratio = clamp(dpr, 1, 2);
    const cssWidth = Math.max(1, width), cssHeight = Math.max(1, height);
    // Cap both axes with one scale. Independent caps stretch large wide/tall hosts.
    const scale = Math.min(ratio, this.backend.maxDimension / Math.max(cssWidth, cssHeight));
    const w = Math.max(1, Math.round(cssWidth * scale)), h = Math.max(1, Math.round(cssHeight * scale));
    // Use the displayed aspect, so backing-pixel rounding cannot deform the body.
    this.displayAspect = cssWidth / cssHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }
  private draw(mesh: Mesh, model: Mat4, hex: string, count = mesh.count, indexOffset = 0): void {
    this.backend.draw(mesh, model, hex, count, indexOffset); this.drawCount++;
  }
  render(input: AvatarDesign, state: RenderState): void {
    if (this.disposed || this.backend.lost) return;
    if (state.pluginAccessories?.length) {
      assertAccessoryPluginEquipmentBudget(state.pluginAccessories);
      for (const item of state.pluginAccessories) {
        const geometry = item.asset.geometry;
        if (geometry.skin && (item.asset.attachment || geometry.deformation || geometry.surfaceConnectors)) throw new TypeError('Skinned plugin geometry cannot use fitted attachment, deformation, or surface connectors.');
      }
    }
    // Direct renderer consumers may edit the same design object between frames.
    const signature = JSON.stringify(input);
    if (signature !== this.inputSignature) { this.resolvedInput = resolveDesign(input); this.inputSignature = signature; }
    const design = this.resolvedInput!;
    const instant = state.reduced || state.instant || state.equipmentImmediate;
    const equipment = this.equipment.sample(state.pluginAccessories?.length ? design.accessories.filter(item => !state.pluginAccessories!.some(plugin => plugin.slot === item.slot)) : design.accessories, state.delta, instant);
    const { pose } = state, activity = state.activityFrame ?? activityFrame(state.activity, state.time, state.reduced);
    const roll = pose.rotation[2] + (state.partAnimation?.bodyRotation ? 0 : activity.roll);
    if (Object.hasOwn(state, 'camera') || Object.hasOwn(state, 'view')) throw new TypeError('camera/view are removed; use bodyOrientation and zoom.');
    const bodyOrientation = createBodyOrientation(state.bodyOrientation), zoom = createZoom(state.zoom);
    // View orientation is independent of the body's animated local pose. Matrix
    // composition preserves combined yaw/pitch/roll, unlike adding Euler angles.
    const model = transform([0, activity.bob, 0], [pose.rotation[0], pose.rotation[1], roll]);
    const root = travelMatrix(multiply(bodyOrientationMatrix(bodyOrientation), model), state.reduced ? undefined : state.travel);
    const aspect = this.displayAspect ?? this.canvas.width / this.canvas.height;
    const contour = state.contour ?? shapeContour({ kind: 'material', name: design.body.shape });
    const profile = state.profile ?? resolveShapeProfile(design.body.shape);
    const body = this.meshes.body;
    let rigChanged = false;
    if (state.rig !== this.bodyRigSource) {
      const validatedRig = state.rig ? validateBodyRig(state.rig) : undefined;
      const rigSignature = validatedRig ? JSON.stringify(validatedRig) : '';
      rigChanged = rigSignature !== this.bodyRigSignature;
      if (rigChanged) {
        this.bodyRig = validatedRig;
        this.bodyRigSignature = rigSignature; this.bodySkin = undefined; this.bodyBones = undefined;
      }
      this.bodyRigSource = state.rig;
    }
    const topologyChanged = contour !== this.bodyContour;
    const neutralChanged = topologyChanged || this.bodyDeformation !== String(profile.depth);
    const previousVertexLength = body.data.vertices.length;
    if (topologyChanged) {
      const data = bodyGeometry(contour);
      this.bodyDirections = data.vertices; body.data = { vertices: data.vertices, indices: data.indices };
      body.count = data.indices.length; this.bodyContour = contour;
    }
    if (neutralChanged) {
      this.bodyNeutral = this.bodyDirections.slice();
      for (let i = 0; i < this.bodyDirections.length; i += 6) {
        const d: Vec3 = [this.bodyDirections[i]!, this.bodyDirections[i + 1]!, this.bodyDirections[i + 2]!];
        this.bodyNeutral.set(deformBodyPoint(design.body, d, 1, profile), i);
      }
      this.bodyDeformation = String(profile.depth); this.bodySkin = undefined;
    }
    let bodyChanged = neutralChanged || rigChanged;
    if (this.bodyRig) {
      const pose = mergeBonePose(state.bonePose, state.partAnimation?.bones, this.bodyRig.skeleton), poseKey = JSON.stringify(pose);
      if (!this.bodySkin) this.bodySkin = createSkinDeformer(this.bodyNeutral, createBodySkinBinding(this.bodyNeutral, this.bodyRig));
      if (bodyChanged || poseKey !== this.bodySkinPose) {
        body.data = { vertices: this.bodySkin.deform(pose), indices: body.data.indices, faceVertices: this.bodyNeutral };
        if (!this.bodyBones || poseKey !== this.bodySkinPose) this.bodyBones = computeBoneMatrices(this.bodyRig.skeleton, pose);
        this.bodySkinPose = poseKey; bodyChanged = true;
      }
    } else if (bodyChanged) {
      body.data = { vertices: this.bodyNeutral, indices: body.data.indices };
      this.bodySkinPose = '';
    }
    // Pose-only frames update one vertex buffer. Rest coordinates, topology and
    // the generated binding are retained across idle, view and activity frames.
    if (bodyChanged) this.backend.update(body, body.data, topologyChanged, previousVertexLength === body.data.vertices.length);
    // A fixed, body-referenced frame keeps CSS/world scale independent of
    // equipment, including outgoing meshes during a fade. This is the original
    // unequipped frame with padding for the supported catalog and activity poses.
    // Equipment must not silently act as zoom; callers control magnification.
    const radius = Math.hypot(BODY_SIZE[0] * 0.5 / Math.sqrt(0.88), BODY_SIZE[1] * 0.56, BODY_DEPTH_RANGE[1] * 0.5 / Math.sqrt(0.88));
    const span = Math.max(Math.max(...BODY_SIZE) * 1.25 + 0.9, radius * 2 + 0.34) / zoom;
    const framingDelta = Number.isFinite(state.delta) ? Math.max(0, Math.min(state.delta, 0.25)) : 0;
    const height = span * Math.max(1, 1 / aspect), width = height * aspect;
    this.backend.begin(orthographic(width, height));
    this.drawCount = 0;
    // Squash is exactly the same diagonal scale used by bodyPoint. Applying it
    // in the draw matrix avoids regenerating thousands of contour normals/frame.
    const stretch = 1 / Math.sqrt(activity.squash);
    const squashMatrix = transform([0, 0, 0], [0, 0, 0], [stretch, activity.squash, stretch]);
    const bodyRoot = multiply(root, squashMatrix);
    const boneMountedRoot = (slot: AccessorySlot): Mat4 => {
      const name = this.bodyRig?.attachments?.[slot];
      if (!name || !this.bodyBones) return root;
      const index = this.bodyRig!.skeleton.bones.findIndex(bone => bone.id === name);
      const delta = this.bodyBones.deformation[index]!;
      if (delta.every((value, index) => value === (index % 5 === 0 ? 1 : 0))) return root;
      // Existing seated geometry is already squashed. Conjugation keeps bone
      // deltas in the same neutral coordinate system as body skinning.
      const unsquash = transform([0, 0, 0], [0, 0, 0], [1 / stretch, 1 / activity.squash, 1 / stretch]);
      return multiply(multiply(bodyRoot, delta), unsquash);
    };
    // Eye ink is evaluated in the body pass: it has zero depth and cannot alter alpha coverage.
    const eyes = projectEyes(design, root, pose.face, [pose.gaze[0] + activity.gaze[0], pose.gaze[1] + activity.gaze[1]], activity.squash, contour, profile);
    this.backend.opacity(1);
    const ink = parseInt(design.eyes.color.slice(1), 16);
    const blink = this.blinkGate.sample(activity.blink, state.eyeMotion, state.time);
    const leftPose = state.partAnimation?.eyes?.left ?? composeEyePose(pose.eyes.left, pose.openness, blink.left);
    const rightPose = state.partAnimation?.eyes?.right ?? composeEyePose(pose.eyes.right, pose.openness, blink.right);
    const leftTargets = design.eyes.left.targets, rightTargets = design.eyes.right.targets;
    this.backend.eyes({
      color: [((ink >> 16) & 255) / 255, ((ink >> 8) & 255) / 255, (ink & 255) / 255],
      centers: [eyes.left.localCenter[0], eyes.left.localCenter[1], eyes.right.localCenter[0], eyes.right.localCenter[1]], size: eyes.size,
      faceScale: [stretch, activity.squash],
      states: [leftPose.openness, leftPose.smile, rightPose.openness, rightPose.smile],
      leftTargets: [leftTargets.smile.radius, 0, leftTargets.smile.thickness, leftTargets.blink.thickness],
      rightTargets: [rightTargets.smile.radius, 0, rightTargets.smile.thickness, rightTargets.blink.thickness],
    });
    this.draw(body, bodyRoot, design.body.color);
    this.backend.eyes();
    const localDraw = (mesh: Mesh, parent: Mat4, color: string, position: Vec3, size: Vec3, rotation: Vec3 = [0, 0, 0]): void => this.draw(mesh, multiply(parent, transform(position, rotation, size)), color);
    const poseKey = (a: ResolvedAccessoryDesign): string => `${a.slot}:${a.id}:${a.preset}`;
    const authoredEquipment = new Set(design.accessories.map(poseKey));
    const visibleEquipment = new Set(equipment.filter(a => a.opacity > 0).map(a => poseKey(a.accessory)));
    for (const key of this.accessoryPose.keys()) if (!visibleEquipment.has(key)) {
      this.accessoryPose.delete(key); this.accessoryPoseTakeover.delete(key);
    }
    const activeIds = new Set(equipment.map(({ accessory }) => accessory.id));
    for (const id of this.lag.keys()) if (!activeIds.has(id)) this.lag.delete(id);
    const activeSlots = new Set(equipment.map(({ accessory }) => accessory.slot));
    for (const [slot, cached] of this.catalogMeshes) if (!activeSlots.has(slot)) { this.deleteMesh(cached.mesh); this.catalogMeshes.delete(slot); }
    for (const { accessory, opacity } of equipment) {
      if (state.pluginAccessories?.some(item => item.slot === accessory.slot)) continue;
      if (opacity <= 0) continue;
      // Premultiplied output matches the transparent canvas. Retain depth writes
      // so a mesh's back faces/details cannot accumulate through its front.
      const part = state.partAnimation && Object.hasOwn(state.partAnimation.accessories, accessory.id) ? state.partAnimation.accessories[accessory.id] : undefined;
      if (part?.opacity === 0) continue;
      this.backend.opacity(opacity * (part?.opacity ?? 1));
      const mountFrame = part && (part.position || part.scale) ? getAccessoryAttachmentFrame(design.body, accessory.slot, { squash: activity.squash, contour, profile }) : undefined;
      const deltaMatrix = mountFrame ? attachmentDelta(mountFrame.matrix, part!.position, part!.scale) : undefined;
      const mountedRoot = boneMountedRoot(accessory.slot);
      const accessoryRoot = deltaMatrix ? multiply(mountedRoot, deltaMatrix) : mountedRoot;
      const oldLag = this.lag.get(accessory.id) ?? [roll, 0];
      const lag = state.reduced ? [roll, 0] as [number, number] : spring(oldLag[0], oldLag[1], roll, state.delta, 11);
      this.lag.set(accessory.id, lag);
      const key = poseKey(accessory);
      // The authored timeline drops removed tracks immediately. Preserve only
      // the outgoing mesh's last displayed offset while it remains visible.
      const retained = this.accessoryPose.get(key);
      let extra: Vec3 = retained ?? [0, 0, 0];
      if (authoredEquipment.has(key)) {
        const target: Vec3 = Object.hasOwn(pose.accessories, accessory.id) ? pose.accessories[accessory.id]! : [0, 0, 0];
        let takeover = this.accessoryPoseTakeover.get(key);
        const returning = !!retained && !this.authoredAccessoryPose.has(key);
        if (returning && !instant) {
          takeover = { from: [...retained], elapsed: 0 };
          this.accessoryPoseTakeover.set(key, takeover);
        }
        if (takeover && !instant) {
          if (!returning) takeover.elapsed += framingDelta;
          const t = Math.min(1, takeover.elapsed / .15), blend = t * t * (3 - 2 * t);
          extra = target.map((value, i) => takeover!.from[i]! + (value - takeover!.from[i]!) * blend) as Vec3;
          if (t === 1) this.accessoryPoseTakeover.delete(key);
        } else { extra = target; this.accessoryPoseTakeover.delete(key); }
      } else this.accessoryPoseTakeover.delete(key);
      this.accessoryPose.set(key, [...extra]);
      const rotation = accessory.rotation.map((v, i) => v + (part?.rotation ?? extra)[i]!) as Vec3;
      if (!part?.rotation && accessory.anchor.region === 'crown') { if (accessory.preset !== 'beret') rotation[1] -= (lag[0] - roll) * accessory.follow; }
      else if (!part?.rotation) rotation[2] += (lag[0] - roll) * accessory.follow;
      if (accessory.preset === 'glasses' || accessory.preset === 'sunglasses') {
        // Equipment follows the fitted neutral eye layout and face motion. Gaze
        // stays inside the lenses; bodyOrientation/weights never rebuild the frame mesh.
        const frameEyes = projectEyes(design, root, pose.face, [0, 0], activity.squash, contour, profile);
        const key = JSON.stringify([accessory.preset, frameEyes.left.localCenter, frameEyes.right.localCenter, frameEyes.size, activity.squash, profile.depth, accessoryMountProfile(accessory, profile), accessory.anchor, accessory.scale, rotation]);
        const mesh = this.meshes.glasses;
        if (this.glassesContour !== contour || this.glassesKey !== key) {
          const data = glassesGeometry(design, accessory, frameEyes, activity.squash, contour, profile, rotation);
          this.backend.update(mesh, data, mesh.data.indices.length !== data.indices.length, mesh.data.vertices.length === data.vertices.length);
          mesh.data = data; mesh.count = data.indices.length;
          this.glassesContour = contour; this.glassesKey = key;
        }
        const data = mesh.data as GlassesGeometry;
        this.draw(mesh, accessoryRoot, accessory.color, data.frameIndexCount);
        if (data.fillIndexCount) this.draw(mesh, accessoryRoot, accessoryDetailColor(accessoryDetailColor(accessory.color)), data.fillIndexCount, data.frameIndexCount);
        continue;
      }
      if (accessory.preset === 'moustache' || accessory.preset === 'goatee' || accessory.preset === 'bowTie' || accessory.preset === 'scarf' || accessory.preset === 'necklace' || accessory.preset === 'earring' || accessory.preset === 'starEarring') {
        const key = JSON.stringify([accessory.preset, accessory.slot, activity.squash, profile.depth, accessoryMountProfile(accessory, profile), accessory.scale, rotation]);
        let cached = this.catalogMeshes.get(accessory.slot);
        if (!cached || cached.contour !== contour || cached.key !== key) {
          const data = catalogAccessoryGeometry(design.body, accessory, activity.squash, contour, profile, rotation);
          if (!cached) {
            cached = { mesh: this.upload(data), contour, key, mainIndexCount: data.mainIndexCount, detailIndexCount: data.detailIndexCount };
            this.catalogMeshes.set(accessory.slot, cached);
          } else {
            const mesh = cached.mesh;
            this.backend.update(mesh, data, mesh.data.indices.length !== data.indices.length, mesh.data.vertices.length === data.vertices.length);
            mesh.data = data; mesh.count = data.indices.length;
            Object.assign(cached, { contour, key, mainIndexCount: data.mainIndexCount, detailIndexCount: data.detailIndexCount });
          }
        }
        this.draw(cached.mesh, accessoryRoot, accessory.color, cached.mainIndexCount);
        if (cached.detailIndexCount) this.draw(cached.mesh, accessoryRoot, accessoryDetailColor(accessory.color), cached.detailIndexCount, cached.mainIndexCount);
        continue;
      }
      const frame = sampleAccessorySurface(design.body, accessory, activity.squash, contour, profile);
      const mounted = multiply(multiply(accessoryRoot, frame.matrix), transform([0, 0, 0], rotation));
      const parent = multiply(mounted, transform([0, 0, 0], [0, 0, 0], Array(3).fill(accessory.scale * accessoryMountProfile(accessory, profile).scale) as Vec3));
      if (accessory.preset === 'beret' || accessory.preset === 'crown') {
        // Beret fitting is neutral and wornBeret applies squash as an exact
        // final diagonal transform. Keep that transform on the draw matrix,
        // avoiding a fresh vertex array and GPU upload on every breath.
        const fittedSquash = accessory.preset === 'beret' ? 1 : activity.squash;
        const fittedRoot = accessory.preset === 'beret' ? multiply(accessoryRoot, squashMatrix) : accessoryRoot;
        const key = JSON.stringify([accessory.preset, fittedSquash, profile.depth, profile.beretFitTilt, profile.beretFitCenter, profile.beretFitRoom, profile.beretDrapeStrength, profile.beretFitTransition, profile.beretDrapeLimit, profile.beretFitSize, profile.beretFitOpening, profile.beretWrapStrength, profile.beretApertureX, profile.beretApertureZ, accessoryMountProfile(accessory, profile), accessory.scale, rotation]);
        const mesh = this.meshes.beret;
        if (this.beretContour !== contour || this.beretKey !== key) {
          const data: BeretGeometry = beretGeometry(design.body, accessory, fittedSquash, contour, profile, rotation);
          this.backend.update(mesh, data, mesh.data.indices !== data.indices, mesh.data.vertices.length === data.vertices.length);
          mesh.data = data; mesh.count = data.indices.length; this.beretBandIndexCount = data.bandIndexCount;
          this.beretContour = contour; this.beretKey = key;
        }
        this.draw(mesh, fittedRoot, beretBandColor(accessory.color), this.beretBandIndexCount);
        this.draw(mesh, fittedRoot, accessory.color, mesh.count - this.beretBandIndexCount, this.beretBandIndexCount);
      } else if (accessory.preset === 'halo') {
        localDraw(this.meshes.halo, parent, accessory.color, [0, 0, 0], [0.34, 0.34, 0.34]);
      }
    }
    // Static author meshes upload once. Derived topology is stable; only a changed
    // body-local fitting key updates its vertex buffer, never camera/gaze/blink.
    if (state.pluginAccessories?.length || this.pluginMeshes.size) {
      const active = new Set(state.pluginAccessories?.map(item => item.slot));
      for (const [slot, cached] of this.pluginMeshes) if (!active.has(slot as AccessorySlot)) {
        this.deleteMesh(cached.mesh); this.pluginMeshes.delete(slot);
      }
      let neutralEyes: AccessoryPluginEyeMeasurements | undefined;
      if (state.pluginAccessories?.some(item => item.asset.attachment?.mode === 'eye-plane')) {
        const projected = projectEyes(design, root, pose.face, [0, 0], activity.squash, contour, profile);
        neutralEyes = { left: [projected.left.localCenter[0], projected.left.localCenter[1]], right: [projected.right.localCenter[0], projected.right.localCenter[1]], size: [...projected.size] };
      }
      this.backend.opacity(1);
      for (const item of state.pluginAccessories ?? []) {
        const previousCache = this.pluginMeshes.get(item.slot), changed = !previousCache || previousCache.asset !== item.asset;
        const part = state.partAnimation && Object.hasOwn(state.partAnimation.accessories, item.id) ? state.partAnimation.accessories[item.id] : undefined;
        if (part?.opacity === 0) {
          if (changed && previousCache) { this.deleteMesh(previousCache.mesh); this.pluginMeshes.delete(item.slot); }
          continue;
        }
        const fitter = changed ? item.asset.attachment ? new AccessoryPluginFitter(item.asset) : undefined : previousCache.fitter;
        const extra: Vec3 = [...(part?.rotation ?? (Object.hasOwn(pose.accessories, item.id) ? pose.accessories[item.id] : undefined) ?? [0, 0, 0])];
        this.backend.opacity(part?.opacity ?? 1);
        let mounted: Mat4, fit: AccessoryPluginFit | undefined, lag: [number, number] | undefined;
        const mountedRoot = boneMountedRoot(item.slot);
        if (fitter) {
          const previous = !changed && previousCache.lag || [roll, 0];
          lag = state.reduced ? [roll, 0] : spring(previous[0]!, previous[1]!, roll, state.delta, 11);
          const attachment = item.asset.attachment!;
          if (!part?.rotation) extra[attachment.followAxis === 'x' ? 0 : attachment.followAxis === 'y' ? 1 : 2] += (lag[0] - roll) * (attachment.follow ?? 0) * (attachment.followSign ?? 1);
          fit = fitter.sample(design.body, { contour, depth: profile.depth, squash: activity.squash, shapeWeights: state.shapeWeights, rotation: extra, ...(attachment.mode === 'eye-plane' ? { eyes: neutralEyes } : {}) });
          // Explicit translation/scale use the public slot frame AFTER seating,
          // retaining catalog semantics and intentionally detachable animation.
          const frame = part && (part.position || part.scale) ? getAccessoryAttachmentFrame(design.body, item.slot, { squash: activity.squash, contour, profile }) : undefined;
          const parent = frame ? multiply(mountedRoot, attachmentDelta(frame.matrix, part?.position, part?.scale)) : mountedRoot;
          mounted = multiply(parent, fit.matrix);
        } else {
          const frame = getAccessoryAttachmentFrame(design.body, item.slot, { squash: activity.squash, contour, profile });
          mounted = multiply(multiply(mountedRoot, frame.matrix), transform(part?.position, extra, part?.scale));
        }
        let data = fit?.geometry ?? item.asset.geometry;
        const skin = changed ? item.asset.geometry.skin ? createSkinDeformer(item.asset.geometry.vertices, item.asset.geometry.skin) : undefined : previousCache.skin;
        const skinPose = skin ? mergeBonePose(state.accessoryBonePoses?.[item.id], state.partAnimation?.accessoryBones?.[item.id], item.asset.geometry.skin!.skeleton) : undefined;
        const skinKey = skinPose ? JSON.stringify(skinPose) : undefined;
        const skinChanged = !!skin && (changed || skinKey !== previousCache?.skinPose);
        if (skinChanged) data = { ...data, vertices: skin!.deform(skinPose) };
        else if (skin) data = previousCache!.mesh.data as typeof data;
        let cached = previousCache;
        if (changed) {
          const mesh = this.upload(data);
          if (previousCache) this.deleteMesh(previousCache.mesh);
          cached = { asset: item.asset, mesh, fitter, lag, fit, skin, skinPose: skinKey }; this.pluginMeshes.set(item.slot, cached);
        } else {
          if ((fit?.geometry && fit !== cached!.fit) || skinChanged) {
            const mesh = cached!.mesh;
            this.backend.update(mesh, data, mesh.data.indices !== data.indices, mesh.data.vertices.length === data.vertices.length);
            mesh.data = data; mesh.count = data.indices.length;
          }
          cached!.fit = fit; cached!.lag = lag; cached!.skinPose = skinKey;
        }
        if (data.parts) for (const range of data.parts) this.draw(cached!.mesh, mounted, accessoryPluginMaterialColor(item.color, range.material), range.indexCount, range.indexStart);
        else this.draw(cached!.mesh, mounted, item.color);
      }
    }
    this.authoredAccessoryPose = authoredEquipment;
    this.backend.end();
  }
  get animating(): boolean { return this.equipment.active || this.accessoryPoseTakeover.size > 0; }
  get stats(): { drawCalls: number; buffers: number } { return { drawCalls: this.drawCount, buffers: [...Object.values(this.meshes), ...Array.from(this.catalogMeshes.values(), item => item.mesh), ...Array.from(this.pluginMeshes.values(), item => item.mesh)].reduce((count, mesh) => count + (this.graphics === 'webgl2' ? 2 + (mesh.data.faceVertices ? 1 : 0) : 0), 0) }; }
  /** Call immediately after render; the drawing buffer need not be preserved between frames. */
  readPixels(): Uint8Array { return this.backend.readPixels(); }
  private deleteMesh(mesh: Mesh): void { this.backend.deleteMesh(mesh); }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const mesh of Object.values(this.meshes)) this.deleteMesh(mesh);
    for (const cached of this.catalogMeshes.values()) this.deleteMesh(cached.mesh);
    this.catalogMeshes.clear();
    for (const cached of this.pluginMeshes.values()) this.deleteMesh(cached.mesh);
    this.pluginMeshes.clear();
    this.backend.dispose(); this.lag.clear(); this.accessoryPose.clear(); this.accessoryPoseTakeover.clear(); this.authoredAccessoryPose.clear();
  }
}

/** Conjugate attachment-local translation/scale into body space without moving its origin twice. */
function attachmentDelta(frame: Mat4, position?: Vec3, size?: Vec3): Mat4 {
  const inverse = new Float32Array([frame[0]!,frame[4]!,frame[8]!,0,frame[1]!,frame[5]!,frame[9]!,0,frame[2]!,frame[6]!,frame[10]!,0,0,0,0,1]);
  for (let row=0; row<3; row++) inverse[12+row] = -(inverse[row]! * frame[12]! + inverse[4+row]! * frame[13]! + inverse[8+row]! * frame[14]!);
  return multiply(multiply(frame, transform(position, [0,0,0], size)), inverse);
}

/** Authored tracks replace only their named channels, not the other manual channels. */
function mergeBonePose(manual: BonePose | undefined, animated: BonePose | undefined, skeleton: BodyRig['skeleton']): BonePose {
  manual = manual ? validateBonePose(manual, skeleton) : undefined;
  animated = animated ? validateBonePose(animated, skeleton) : undefined;
  const names = new Set([...Object.keys(manual ?? {}), ...Object.keys(animated ?? {})]);
  return Object.fromEntries(Array.from(names, name => [name, { ...(manual && Object.hasOwn(manual, name) ? manual[name] : {}), ...(animated && Object.hasOwn(animated, name) ? animated[name] : {}) }]));
}
