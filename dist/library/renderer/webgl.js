import { getAccessoryAttachmentFrame } from '../core/accessory-attachments.js';
import { AccessoryPluginFitter, accessoryPluginMaterialColor } from '../core/plugin-mount.js';
import { assertAccessoryPluginEquipmentBudget } from '../core/accessory-plugins.js';
import { AccessoryTransition } from '../core/accessory-transition.js';
import { createZoom } from '../core/zoom.js';
import { travelMatrix } from '../core/travel.js';
import { resolveDesign } from '../core/resolved-design.js';
import { bodyOrientationMatrix, createBodyOrientation } from '../core/body-orientation.js';
import { activityFrame } from '../core/motion.js';
import { EyeBlinkGate, composeEyePose } from '../core/expressions.js';
import { clamp, multiply, orthographic, spring, transform } from '../core/math.js';
import { deformBodyPoint, sampleAccessorySurface, BODY_SIZE } from '../core/surface.js';
import { BODY_DEPTH_RANGE, accessoryMountProfile, resolveShapeProfile } from '../core/shape-profiles.js';
import { torus } from './geometry.js';
import { projectEyes } from './eye-projection.js';
import { glassesGeometry } from './glasses-geometry.js';
import { beretGeometry, beretBandColor } from './beret-geometry.js';
import { catalogAccessoryGeometry, accessoryDetailColor } from './catalog-accessory-geometry.js';
import { bodyGeometry } from './body-geometry.js';
import { shapeContour } from '../core/contours.js';
import { createBackend } from './render-backend.js';
/** Shared geometry and animation, presented through WebGL2 or Canvas2D. */
export class AvatarRenderer {
    canvas;
    backend;
    pluginMeshes = new Map();
    get gl() { return this.backend.gl; }
    get graphics() { return this.backend.kind; }
    meshes;
    beretContour;
    beretKey = '';
    beretBandIndexCount = 0;
    glassesContour;
    glassesKey = '';
    catalogMeshes = new Map();
    bodyDirections;
    bodyContour;
    bodyDeformation = '';
    lag = new Map();
    accessoryPose = new Map();
    authoredAccessoryPose = new Set();
    accessoryPoseTakeover = new Map();
    disposed = false;
    drawCount = 0;
    blinkGate = new EyeBlinkGate();
    equipment = new AccessoryTransition();
    displayAspect;
    inputSignature = '';
    resolvedInput;
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.backend = createBackend(canvas, options);
        const uploaded = [];
        try {
            const upload = (data) => { const mesh = this.upload(data); uploaded.push(mesh); return mesh; };
            this.meshes = { body: upload({ vertices: new Float32Array(0), indices: new Uint16Array(0) }), beret: upload({ vertices: new Float32Array(0), indices: new Uint16Array(0) }), glasses: upload({ vertices: new Float32Array(0), indices: new Uint16Array(0) }), halo: upload(torus(0.055)) };
            this.bodyDirections = new Float32Array(0);
        }
        catch (error) {
            for (const mesh of uploaded)
                this.backend.deleteMesh(mesh);
            this.backend.dispose();
            throw this.backend.initializationError(error);
        }
    }
    upload(data) { return this.backend.upload(data); }
    resize(width, height, dpr = 1) {
        const ratio = clamp(dpr, 1, 2);
        const cssWidth = Math.max(1, width), cssHeight = Math.max(1, height);
        // Cap both axes with one scale. Independent caps stretch large wide/tall hosts.
        const scale = Math.min(ratio, this.backend.maxDimension / Math.max(cssWidth, cssHeight));
        const w = Math.max(1, Math.round(cssWidth * scale)), h = Math.max(1, Math.round(cssHeight * scale));
        // Use the displayed aspect, so backing-pixel rounding cannot deform the body.
        this.displayAspect = cssWidth / cssHeight;
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
    }
    draw(mesh, model, hex, count = mesh.count, indexOffset = 0) {
        this.backend.draw(mesh, model, hex, count, indexOffset);
        this.drawCount++;
    }
    render(input, state) {
        if (this.disposed || this.backend.lost)
            return;
        if (state.pluginAccessories?.length)
            assertAccessoryPluginEquipmentBudget(state.pluginAccessories);
        // Direct renderer consumers may edit the same design object between frames.
        const signature = JSON.stringify(input);
        if (signature !== this.inputSignature) {
            this.resolvedInput = resolveDesign(input);
            this.inputSignature = signature;
        }
        const design = this.resolvedInput;
        const instant = state.reduced || state.instant || state.equipmentImmediate;
        const equipment = this.equipment.sample(state.pluginAccessories?.length ? design.accessories.filter(item => !state.pluginAccessories.some(plugin => plugin.slot === item.slot)) : design.accessories, state.delta, instant);
        const { pose } = state, activity = state.activityFrame ?? activityFrame(state.activity, state.time, state.reduced);
        const roll = pose.rotation[2] + (state.partAnimation?.bodyRotation ? 0 : activity.roll);
        if (Object.hasOwn(state, 'camera') || Object.hasOwn(state, 'view'))
            throw new TypeError('camera/view are removed; use bodyOrientation and zoom.');
        const bodyOrientation = createBodyOrientation(state.bodyOrientation), zoom = createZoom(state.zoom);
        // View orientation is independent of the body's animated local pose. Matrix
        // composition preserves combined yaw/pitch/roll, unlike adding Euler angles.
        const model = transform([0, activity.bob, 0], [pose.rotation[0], pose.rotation[1], roll]);
        const root = travelMatrix(multiply(bodyOrientationMatrix(bodyOrientation), model), state.reduced ? undefined : state.travel);
        const aspect = this.displayAspect ?? this.canvas.width / this.canvas.height;
        const contour = state.contour ?? shapeContour({ kind: 'material', name: design.body.shape });
        const profile = state.profile ?? resolveShapeProfile(design.body.shape);
        if (contour !== this.bodyContour) {
            const data = bodyGeometry(contour), body = this.meshes.body;
            // Reuse the same GPU resources; transition snapshots can have different topology.
            body.data = { vertices: data.vertices.slice(), indices: data.indices };
            body.count = data.indices.length;
            this.bodyDirections = data.vertices;
            // Upload the final positions once; the old path uploaded canonical positions
            // then immediately replaced them and also uploaded an unused direction attribute.
            for (let i = 0; i < this.bodyDirections.length; i += 6) {
                const d = [this.bodyDirections[i], this.bodyDirections[i + 1], this.bodyDirections[i + 2]];
                body.data.vertices.set(deformBodyPoint(design.body, d, 1, profile), i);
            }
            this.backend.update(body, body.data, true, false);
            this.bodyContour = contour;
            this.bodyDeformation = String(profile.depth);
        }
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
        const body = this.meshes.body;
        const deformation = String(profile.depth);
        if (this.bodyDeformation !== deformation) {
            for (let i = 0; i < this.bodyDirections.length; i += 6) {
                const d = [this.bodyDirections[i], this.bodyDirections[i + 1], this.bodyDirections[i + 2]];
                body.data.vertices.set(deformBodyPoint(design.body, d, 1, profile), i);
            }
            this.backend.update(body, body.data, false, true);
            this.bodyDeformation = deformation;
        }
        // Squash is exactly the same diagonal scale used by bodyPoint. Applying it
        // in the draw matrix avoids regenerating thousands of contour normals/frame.
        const stretch = 1 / Math.sqrt(activity.squash);
        const bodyRoot = multiply(root, transform([0, 0, 0], [0, 0, 0], [stretch, activity.squash, stretch]));
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
        const localDraw = (mesh, parent, color, position, size, rotation = [0, 0, 0]) => this.draw(mesh, multiply(parent, transform(position, rotation, size)), color);
        const poseKey = (a) => `${a.slot}:${a.id}:${a.preset}`;
        const authoredEquipment = new Set(design.accessories.map(poseKey));
        const visibleEquipment = new Set(equipment.filter(a => a.opacity > 0).map(a => poseKey(a.accessory)));
        for (const key of this.accessoryPose.keys())
            if (!visibleEquipment.has(key)) {
                this.accessoryPose.delete(key);
                this.accessoryPoseTakeover.delete(key);
            }
        const activeIds = new Set(equipment.map(({ accessory }) => accessory.id));
        for (const id of this.lag.keys())
            if (!activeIds.has(id))
                this.lag.delete(id);
        const activeSlots = new Set(equipment.map(({ accessory }) => accessory.slot));
        for (const [slot, cached] of this.catalogMeshes)
            if (!activeSlots.has(slot)) {
                this.deleteMesh(cached.mesh);
                this.catalogMeshes.delete(slot);
            }
        for (const { accessory, opacity } of equipment) {
            if (state.pluginAccessories?.some(item => item.slot === accessory.slot))
                continue;
            if (opacity <= 0)
                continue;
            // Premultiplied output matches the transparent canvas. Retain depth writes
            // so a mesh's back faces/details cannot accumulate through its front.
            const part = state.partAnimation && Object.hasOwn(state.partAnimation.accessories, accessory.id) ? state.partAnimation.accessories[accessory.id] : undefined;
            if (part?.opacity === 0)
                continue;
            this.backend.opacity(opacity * (part?.opacity ?? 1));
            const mountFrame = part && (part.position || part.scale) ? getAccessoryAttachmentFrame(design.body, accessory.slot, { squash: activity.squash, contour, profile }) : undefined;
            const deltaMatrix = mountFrame ? attachmentDelta(mountFrame.matrix, part.position, part.scale) : undefined;
            const accessoryRoot = deltaMatrix ? multiply(root, deltaMatrix) : root;
            const oldLag = this.lag.get(accessory.id) ?? [roll, 0];
            const lag = state.reduced ? [roll, 0] : spring(oldLag[0], oldLag[1], roll, state.delta, 11);
            this.lag.set(accessory.id, lag);
            const key = poseKey(accessory);
            // The authored timeline drops removed tracks immediately. Preserve only
            // the outgoing mesh's last displayed offset while it remains visible.
            const retained = this.accessoryPose.get(key);
            let extra = retained ?? [0, 0, 0];
            if (authoredEquipment.has(key)) {
                const target = Object.hasOwn(pose.accessories, accessory.id) ? pose.accessories[accessory.id] : [0, 0, 0];
                let takeover = this.accessoryPoseTakeover.get(key);
                const returning = !!retained && !this.authoredAccessoryPose.has(key);
                if (returning && !instant) {
                    takeover = { from: [...retained], elapsed: 0 };
                    this.accessoryPoseTakeover.set(key, takeover);
                }
                if (takeover && !instant) {
                    if (!returning)
                        takeover.elapsed += framingDelta;
                    const t = Math.min(1, takeover.elapsed / .15), blend = t * t * (3 - 2 * t);
                    extra = target.map((value, i) => takeover.from[i] + (value - takeover.from[i]) * blend);
                    if (t === 1)
                        this.accessoryPoseTakeover.delete(key);
                }
                else {
                    extra = target;
                    this.accessoryPoseTakeover.delete(key);
                }
            }
            else
                this.accessoryPoseTakeover.delete(key);
            this.accessoryPose.set(key, [...extra]);
            const rotation = accessory.rotation.map((v, i) => v + (part?.rotation ?? extra)[i]);
            if (!part?.rotation && accessory.anchor.region === 'crown') {
                if (accessory.preset !== 'beret')
                    rotation[1] -= (lag[0] - roll) * accessory.follow;
            }
            else if (!part?.rotation)
                rotation[2] += (lag[0] - roll) * accessory.follow;
            if (accessory.preset === 'glasses' || accessory.preset === 'sunglasses') {
                // Equipment follows the fitted neutral eye layout and face motion. Gaze
                // stays inside the lenses; bodyOrientation/weights never rebuild the frame mesh.
                const frameEyes = projectEyes(design, root, pose.face, [0, 0], activity.squash, contour, profile);
                const key = JSON.stringify([accessory.preset, frameEyes.left.localCenter, frameEyes.right.localCenter, frameEyes.size, activity.squash, profile.depth, accessoryMountProfile(accessory, profile), accessory.anchor, accessory.scale, rotation]);
                const mesh = this.meshes.glasses;
                if (this.glassesContour !== contour || this.glassesKey !== key) {
                    const data = glassesGeometry(design, accessory, frameEyes, activity.squash, contour, profile, rotation);
                    this.backend.update(mesh, data, mesh.data.indices.length !== data.indices.length, mesh.data.vertices.length === data.vertices.length);
                    mesh.data = data;
                    mesh.count = data.indices.length;
                    this.glassesContour = contour;
                    this.glassesKey = key;
                }
                const data = mesh.data;
                this.draw(mesh, accessoryRoot, accessory.color, data.frameIndexCount);
                if (data.fillIndexCount)
                    this.draw(mesh, accessoryRoot, accessoryDetailColor(accessoryDetailColor(accessory.color)), data.fillIndexCount, data.frameIndexCount);
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
                    }
                    else {
                        const mesh = cached.mesh;
                        this.backend.update(mesh, data, mesh.data.indices.length !== data.indices.length, mesh.data.vertices.length === data.vertices.length);
                        mesh.data = data;
                        mesh.count = data.indices.length;
                        Object.assign(cached, { contour, key, mainIndexCount: data.mainIndexCount, detailIndexCount: data.detailIndexCount });
                    }
                }
                this.draw(cached.mesh, accessoryRoot, accessory.color, cached.mainIndexCount);
                if (cached.detailIndexCount)
                    this.draw(cached.mesh, accessoryRoot, accessoryDetailColor(accessory.color), cached.detailIndexCount, cached.mainIndexCount);
                continue;
            }
            const frame = sampleAccessorySurface(design.body, accessory, activity.squash, contour, profile);
            const mounted = multiply(multiply(accessoryRoot, frame.matrix), transform([0, 0, 0], rotation));
            const parent = multiply(mounted, transform([0, 0, 0], [0, 0, 0], Array(3).fill(accessory.scale * accessoryMountProfile(accessory, profile).scale)));
            if (accessory.preset === 'beret' || accessory.preset === 'crown') {
                // Beret fitting is neutral and wornBeret applies squash as an exact
                // final diagonal transform. Keep that transform on the draw matrix,
                // avoiding a fresh vertex array and GPU upload on every breath.
                const fittedSquash = accessory.preset === 'beret' ? 1 : activity.squash;
                const fittedRoot = accessory.preset === 'beret' ? (deltaMatrix ? multiply(accessoryRoot, transform([0, 0, 0], [0, 0, 0], [stretch, activity.squash, stretch])) : bodyRoot) : accessoryRoot;
                const key = JSON.stringify([accessory.preset, fittedSquash, profile.depth, profile.beretFitTilt, profile.beretFitCenter, profile.beretFitRoom, profile.beretDrapeStrength, profile.beretFitTransition, profile.beretDrapeLimit, profile.beretFitSize, profile.beretFitOpening, profile.beretWrapStrength, profile.beretApertureX, profile.beretApertureZ, accessoryMountProfile(accessory, profile), accessory.scale, rotation]);
                const mesh = this.meshes.beret;
                if (this.beretContour !== contour || this.beretKey !== key) {
                    const data = beretGeometry(design.body, accessory, fittedSquash, contour, profile, rotation);
                    this.backend.update(mesh, data, mesh.data.indices !== data.indices, mesh.data.vertices.length === data.vertices.length);
                    mesh.data = data;
                    mesh.count = data.indices.length;
                    this.beretBandIndexCount = data.bandIndexCount;
                    this.beretContour = contour;
                    this.beretKey = key;
                }
                this.draw(mesh, fittedRoot, beretBandColor(accessory.color), this.beretBandIndexCount);
                this.draw(mesh, fittedRoot, accessory.color, mesh.count - this.beretBandIndexCount, this.beretBandIndexCount);
            }
            else if (accessory.preset === 'halo') {
                localDraw(this.meshes.halo, parent, accessory.color, [0, 0, 0], [0.34, 0.34, 0.34]);
            }
        }
        // Static author meshes upload once. Derived topology is stable; only a changed
        // body-local fitting key updates its vertex buffer, never camera/gaze/blink.
        if (state.pluginAccessories?.length || this.pluginMeshes.size) {
            const active = new Set(state.pluginAccessories?.map(item => item.slot));
            for (const [slot, cached] of this.pluginMeshes)
                if (!active.has(slot)) {
                    this.deleteMesh(cached.mesh);
                    this.pluginMeshes.delete(slot);
                }
            let neutralEyes;
            if (state.pluginAccessories?.some(item => item.asset.attachment?.mode === 'eye-plane')) {
                const projected = projectEyes(design, root, pose.face, [0, 0], activity.squash, contour, profile);
                neutralEyes = { left: [projected.left.localCenter[0], projected.left.localCenter[1]], right: [projected.right.localCenter[0], projected.right.localCenter[1]], size: [...projected.size] };
            }
            this.backend.opacity(1);
            for (const item of state.pluginAccessories ?? []) {
                const previousCache = this.pluginMeshes.get(item.slot), changed = !previousCache || previousCache.asset !== item.asset;
                const part = state.partAnimation && Object.hasOwn(state.partAnimation.accessories, item.id) ? state.partAnimation.accessories[item.id] : undefined;
                if (part?.opacity === 0) {
                    if (changed && previousCache) {
                        this.deleteMesh(previousCache.mesh);
                        this.pluginMeshes.delete(item.slot);
                    }
                    continue;
                }
                const fitter = changed ? item.asset.attachment ? new AccessoryPluginFitter(item.asset) : undefined : previousCache.fitter;
                const extra = [...(part?.rotation ?? (Object.hasOwn(pose.accessories, item.id) ? pose.accessories[item.id] : undefined) ?? [0, 0, 0])];
                this.backend.opacity(part?.opacity ?? 1);
                let mounted, fit, lag;
                if (fitter) {
                    const previous = !changed && previousCache.lag || [roll, 0];
                    lag = state.reduced ? [roll, 0] : spring(previous[0], previous[1], roll, state.delta, 11);
                    const attachment = item.asset.attachment;
                    if (!part?.rotation)
                        extra[attachment.followAxis === 'x' ? 0 : attachment.followAxis === 'y' ? 1 : 2] += (lag[0] - roll) * (attachment.follow ?? 0) * (attachment.followSign ?? 1);
                    fit = fitter.sample(design.body, { contour, depth: profile.depth, squash: activity.squash, shapeWeights: state.shapeWeights, rotation: extra, ...(attachment.mode === 'eye-plane' ? { eyes: neutralEyes } : {}) });
                    // Explicit translation/scale use the public slot frame AFTER seating,
                    // retaining catalog semantics and intentionally detachable animation.
                    const frame = part && (part.position || part.scale) ? getAccessoryAttachmentFrame(design.body, item.slot, { squash: activity.squash, contour, profile }) : undefined;
                    const parent = frame ? multiply(root, attachmentDelta(frame.matrix, part?.position, part?.scale)) : root;
                    mounted = multiply(parent, fit.matrix);
                }
                else {
                    const frame = getAccessoryAttachmentFrame(design.body, item.slot, { squash: activity.squash, contour, profile });
                    mounted = multiply(multiply(root, frame.matrix), transform(part?.position, extra, part?.scale));
                }
                const data = fit?.geometry ?? item.asset.geometry;
                let cached = previousCache;
                if (changed) {
                    const mesh = this.upload(data);
                    if (previousCache)
                        this.deleteMesh(previousCache.mesh);
                    cached = { asset: item.asset, mesh, fitter, lag, fit };
                    this.pluginMeshes.set(item.slot, cached);
                }
                else {
                    if (fit?.geometry && fit !== cached.fit) {
                        const mesh = cached.mesh;
                        this.backend.update(mesh, data, mesh.data.indices !== data.indices, mesh.data.vertices.length === data.vertices.length);
                        mesh.data = data;
                        mesh.count = data.indices.length;
                    }
                    cached.fit = fit;
                    cached.lag = lag;
                }
                if (data.parts)
                    for (const range of data.parts)
                        this.draw(cached.mesh, mounted, accessoryPluginMaterialColor(item.color, range.material), range.indexCount, range.indexStart);
                else
                    this.draw(cached.mesh, mounted, item.color);
            }
        }
        this.authoredAccessoryPose = authoredEquipment;
        this.backend.end();
    }
    get animating() { return this.equipment.active || this.accessoryPoseTakeover.size > 0; }
    get stats() { return { drawCalls: this.drawCount, buffers: [...Object.values(this.meshes), ...Array.from(this.catalogMeshes.values(), item => item.mesh), ...Array.from(this.pluginMeshes.values(), item => item.mesh)].reduce(count => count + (this.graphics === 'webgl2' ? 2 : 0), 0) }; }
    /** Call immediately after render; the drawing buffer need not be preserved between frames. */
    readPixels() { return this.backend.readPixels(); }
    deleteMesh(mesh) { this.backend.deleteMesh(mesh); }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        for (const mesh of Object.values(this.meshes))
            this.deleteMesh(mesh);
        for (const cached of this.catalogMeshes.values())
            this.deleteMesh(cached.mesh);
        this.catalogMeshes.clear();
        for (const cached of this.pluginMeshes.values())
            this.deleteMesh(cached.mesh);
        this.pluginMeshes.clear();
        this.backend.dispose();
        this.lag.clear();
        this.accessoryPose.clear();
        this.accessoryPoseTakeover.clear();
        this.authoredAccessoryPose.clear();
    }
}
/** Conjugate attachment-local translation/scale into body space without moving its origin twice. */
function attachmentDelta(frame, position, size) {
    const inverse = new Float32Array([frame[0], frame[4], frame[8], 0, frame[1], frame[5], frame[9], 0, frame[2], frame[6], frame[10], 0, 0, 0, 0, 1]);
    for (let row = 0; row < 3; row++)
        inverse[12 + row] = -(inverse[row] * frame[12] + inverse[4 + row] * frame[13] + inverse[8 + row] * frame[14]);
    return multiply(multiply(frame, transform(position, [0, 0, 0], size)), inverse);
}
