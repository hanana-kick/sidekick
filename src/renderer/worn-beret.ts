import type { MaterialShapeName, Vec2, Vec3 } from '../core/design.js';
import { contourSignedDistance, type ShapeContour } from '../core/contours.js';
import { VOLUME_CURVATURE } from '../core/body-volume.js';
import { transform } from '../core/math.js';
import { bodyGeometry } from './body-geometry.js';
import { BodyTriangleBVH } from './cloth-clearance.js';
import type { Geometry } from './geometry.js';
import type { BeretGeometry } from './beret-geometry.js';
const SEGMENTS = 64;
interface Ring {
    rx: number;
    ry: number;
    x: number;
    y: number;
    z: number;
    slope: number;
}
/**
 * One continuous shell, from the interior dome around a rolled opening, up the
 * narrow band and underfold, across a soft sloping crown, into its cabillou.
 * An inner dome gives a pointed head somewhere to go: fitting must not turn a
 * beret into a broad solid puck perched on a single semantic anchor.
 */
let garmentTopology: { indices: Uint16Array; bandIndexCount: number } | undefined;
function makeGarment(room = 0): {
    geometry: Geometry;
    bandIndexCount: number;
} {
    const ring = (rx: number, ry: number, x: number, z: number, slope = 0, y = 0.012): Ring => ({ rx, ry, x, y, z, slope });
    const rings: Ring[] = [
        ring(0, 0, -0.065, 0.210),
        ring(0.085, 0.068, -0.058, 0.200),
        ring(0.160, 0.126, -0.038, 0.175),
        ring(0.250, 0.200, -0.014, 0.130),
        ring(0.292, 0.234, 0, 0.065),
        ring(0.300, 0.240, 0, 0.005),
        ring(0.300, 0.240, 0, -0.025),
        ring(0.304, 0.244, 0, -0.035),
        ring(0.314, 0.252, 0, -0.037),
        ring(0.323, 0.260, 0, -0.030),
        ring(0.325, 0.262, 0, -0.018),
        ring(0.325, 0.262, 0, 0.006),
        ring(0.330, 0.268, 0.004, 0.016),
        ring(0.340, 0.275, 0.018, 0.018, -0.004),
        ring(0.355, 0.280, 0.036, 0.024, -0.010),
        ring(0.380, 0.290, 0.047, 0.038, -0.016),
        ring(0.391, 0.298, 0.049, 0.059, -0.022),
        ring(0.387, 0.296, 0.040, 0.084, -0.030),
        ring(0.368, 0.280, 0.022, 0.112, -0.038),
        ring(0.331, 0.254, -0.003, 0.145, -0.041),
        ring(0.278, 0.215, -0.029, 0.175, -0.033),
        ring(0.214, 0.166, -0.050, 0.196, -0.022),
        ring(0.142, 0.112, -0.064, 0.210, -0.011),
        ring(0.077, 0.061, -0.070, 0.216, -0.004),
        ring(0.028, 0.025, -0.072, 0.217),
        ring(0.017, 0.017, -0.072, 0.221),
        ring(0.015, 0.015, -0.073, 0.231),
        ring(0.014, 0.014, -0.077, 0.249, 0, 0.014),
        ring(0.012, 0.012, -0.081, 0.263, 0, 0.016),
        ring(0.008, 0.008, -0.083, 0.269, 0, 0.017),
        ring(0, 0, -0.083, 0.272, 0, 0.017),
    ];
    const spacious = [[0,0,-.065,.255],[.11,.085,-.058,.245],[.21,.16,-.038,.225],[.29,.225,-.014,.175],[.325,.260,0,.095],[.340,.275,0,.005],[.340,.275,0,-.025],[.344,.279,0,-.035],[.347,.282,0,-.037],[.350,.285,0,-.030],[.351,.286,0,-.018],[.352,.287,0,.006],[.353,.288,.004,.016],[.369,.298,.018,.018],[.377,.291,.036,.024],[.390,.298,.047,.038]];
    for (let j=0;j<spacious.length;j++) { const r=rings[j]!, q=spacious[j]!; r.rx+=(q[0]!-r.rx)*room; r.ry+=(q[1]!-r.ry)*room; r.x+=(q[2]!-r.x)*room; r.z+=(q[3]!-r.z)*room; }
    const points: Vec3[] = [], indices: number[] = [], starts: number[] = [];
    for (const [j, r] of rings.entries()) {
        starts.push(points.length);
        const count = r.rx === 0 ? 1 : SEGMENTS;
        for (let i = 0; i < count; i++) {
            const angle = i / SEGMENTS * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
            // Broad, gentle felt irregularity. The band and stem retain clean structure.
            const cloth = j >= 13 && j <= 23 ? Math.sin((j - 13) / 10 * Math.PI) : 0;
            const fullness = 1 + cloth * (0.018 * Math.cos(2 * angle + 0.5) + 0.010 * Math.sin(3 * angle - 0.6));
            const loft = Math.max(0, Math.min(1, (j - 12) / 9));
            const roundness = .055 * loft * loft * (3 - 2 * loft);
            points.push([r.x + r.rx * c * fullness, r.y + r.ry * s * fullness, r.z + roundness + r.slope * c + cloth * 0.0035 * Math.sin(2 * angle - 0.4)]);
        }
    }
    const refinements = new Map<number,number[]>();
    for(const band of [4]){const rows=[starts[band]!];for(const t of [.25,.5,.75]){rows.push(points.length);for(let j=0;j<SEGMENTS;j++){const a=points[starts[band]!+j]!,b=points[starts[band+1]!+j]!;points.push(a.map((v,k)=>v+(b[k]!-v)*t) as Vec3);}}rows.push(starts[band+1]!);refinements.set(band,rows);}
    if (!garmentTopology) {
    let bandIndexCount = 0;
    for (let j = 0; j < rings.length - 1; j++) {
        const start = starts[j]!, next = starts[j + 1]!;
        for (let i = 0; i < SEGMENTS; i++) {
            const k = (i + 1) % SEGMENTS;
            // The profile proceeds from the inward-facing dome to the opening and
            // then upward on the exterior, so the same winding works throughout.
            if (refinements.has(j)) {
                const rows=refinements.get(j)!;
                for(let row=0;row<rows.length-1;row++){const a=rows[row]!,b=rows[row+1]!;indices.push(a+i,a+k,b+i,a+k,b+k,b+i);}
            } else if (j === 0)
                indices.push(start, next + k, next + i);
            else if (j === rings.length - 2)
                indices.push(start + i, start + k, next);
            else
                indices.push(start + i, start + k, next + i, start + k, next + k, next + i);
        }
        if (j === 11)
            bandIndexCount = indices.length;
    }
    garmentTopology = { indices: new Uint16Array(indices), bandIndexCount };
    }
    const vertices = new Float32Array(points.length * 6);
    points.forEach((point, i) => vertices.set(point, i * 6));
    // Only positions are consumed; final fitted normals are recomputed below.
    return { geometry: { vertices, indices: garmentTopology.indices }, bandIndexCount: garmentTopology.bandIndexCount };
}
function accumulateNormals(vertices: Float32Array, indices: readonly number[]): void {
    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i]! * 6, b = indices[i + 1]! * 6, c = indices[i + 2]! * 6;
        const ux = vertices[b]! - vertices[a]!, uy = vertices[b + 1]! - vertices[a + 1]!, uz = vertices[b + 2]! - vertices[a + 2]!;
        const vx = vertices[c]! - vertices[a]!, vy = vertices[c + 1]! - vertices[a + 1]!, vz = vertices[c + 2]! - vertices[a + 2]!;
        const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
        for (const p of [a, b, c])
            for (let k = 0; k < 3; k++)
                vertices[p + 3 + k]! += n[k]!;
    }
    for (let i = 0; i < vertices.length; i += 6) {
        const length = Math.hypot(vertices[i + 3]!, vertices[i + 4]!, vertices[i + 5]!);
        for (let k = 3; k < 6; k++)
            vertices[i + k]! /= length || 1;
    }
}
const makeGarmentZero = makeGarment();
let makeGarmentOne: ReturnType<typeof makeGarment> | undefined;
const SIZE = .72;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Conservative clearance envelope inside the physical lining. A strictly tapered
// clearance through the straight band avoids a grazing vertex switching between
// the two ends of an exactly cylindrical contact surface during tiny rotations.
const innerBase = [
    [0, 0, -.065, .210], [.085, .068, -.058, .200], [.160, .126, -.038, .175],
    [.250, .200, -.014, .130], [.292, .234, 0, .065], [.296, .236, 0, .005],
    [.300, .240, 0, -.025], [.304, .244, 0, -.035], [.314, .252, 0, -.037],
].map(([rx, rz, x, y]) => [rx! * SIZE, rz! * SIZE, x! * SIZE, (y! + .037) * SIZE]);
const innerSpacious = [[0,0,-.065,.255],[.11,.085,-.058,.245],[.21,.16,-.038,.225],[.29,.225,-.014,.175],[.325,.260,0,.095],[.336,.271,0,.005],[.340,.275,0,-.025],[.344,.279,0,-.035],[.347,.282,0,-.037]].map(([rx,rz,x,h])=>[rx!*SIZE,rz!*SIZE,x!*SIZE,(h!+.037)*SIZE]);
function cavity(y: number, inner: number[][]): number[] | undefined {
    if (y > inner[0]![3]!)
        return;
    for (let i = 0; i < inner.length - 1; i++) {
        const a = inner[i]!, b = inner[i + 1]!;
        if (y >= b[3]!) {
            const t = (y - b[3]!) / (a[3]! - b[3]!);
            return [b[0]! + (a[0]! - b[0]!) * t, b[1]! + (a[1]! - b[1]!) * t, b[2]! + (a[2]! - b[2]!) * t];
        }
    }
    return inner.at(-1)!.slice(0, 3);
}


interface ExteriorEdge {a:Vec3;b:Vec3;low:number;high:number}
const exteriorGeometry = new WeakMap<Geometry, Map<number, ExteriorEdge[]>>();
const exteriorTopology = new WeakMap<Uint16Array, [number,number][]>();
const surfaceSamples = new WeakMap<ShapeContour, (readonly [number,number,number,number])[]>();
function stableSurfaceSamples(contour: ShapeContour) {
    let samples=surfaceSamples.get(contour);
    if(samples)return samples;
    samples=[];
    // A fixed lattice and a vanishing boundary weight make the decorative
    // support field independent of adaptive render-mesh triangulation.
    for(let row=-20;row<=20;row++)for(let col=-20;col<=20;col++){
        const x=col*.05,y=row*.05,d=contourSignedDistance(contour,x,y);
        if(d<=0)continue;
        const t=clamp(d/.025,0,1),weight=t*t*(3-2*t);
        const height=Math.sqrt(d/(d+VOLUME_CURVATURE*(x*x+y*y)));
        samples.push([x,y,height,weight],[x,y,-height,weight]);
    }
    surfaceSamples.set(contour,samples);
    return samples;
}
const fittedCache = new WeakMap<ShapeContour, Map<string, BeretGeometry>>();
/** One positive radial coordinate map is shared by lining, rim and crown.
 * No ring can be independently displaced through its neighbours. */
function fit(contour: ShapeContour, depth: number, rotation: Vec3, tilt: number, center?: Vec2, room = 0, drapeStrength = 1, fitTransition = 0, drapeLimit = 1): BeretGeometry {
    let cache = fittedCache.get(contour);
    if (!cache) {
        cache = new Map();
        fittedCache.set(contour, cache);
    }
    const key = [room, drapeStrength, fitTransition, drapeLimit, depth, tilt, ...rotation, ...center ?? []].join(':');
    const hit = cache.get(key);
    if (hit)
        return hit;
    const garment = room === 0 ? makeGarmentZero : room === 1 ? (makeGarmentOne ??= makeGarment(1)) : makeGarment(room);
    const co = Math.cos(tilt), si = Math.sin(tilt), m = transform([0, 0, 0], rotation);
    const basis = [0, 4, 8].map(i => [co * m[i]! - si * m[i + 2]!, si * m[i]! + co * m[i + 2]!, -m[i + 1]!] as Vec3);
    const body = bodyGeometry(contour), points: Vec3[] = [];
    let top = -Infinity, neutralTop = -Infinity;
    for (let i = 0; i < body.vertices.length; i += 6) {
        const p: Vec3 = [body.vertices[i]! * .59, body.vertices[i + 1]! * .59, body.vertices[i + 2]! * depth];
        const q = basis.map(v => dot(v, p)) as Vec3;
        points.push(q);
        top = Math.max(top, q[2]);
        neutralTop = Math.max(neutralTop, -si * p[0] + co * p[1]);
    }
    // A smooth support neighbourhood avoids discrete argmax jumps during turns.
    let sx = 0, sz = 0, total = 0;
    for (const p of points) {
        const w = Math.max(0, 1 - (top - p[2]) / .018) ** 3;
        sx += p[0] * w;
        sz += p[1] * w;
        total += w;
    }
    sx = center?.[0] ?? sx / total;
    sz = center?.[1] ?? sz / total;
    if (center && rotation.some(value => value !== 0)) {
        // The curated point belongs to the body, not to the rotating garment.
        // Reproject it into the current wearing frame so a turn cannot sweep
        // the opening away from its support and force a sudden upward reseat.
        const support: Vec3 = [co * center[0] - si * neutralTop, si * center[0] + co * neutralTop, -center[1]];
        sx = dot(basis[0]!, support);
        sz = dot(basis[1]!, support);
    }
    const px = sx + .065 * SIZE, pz = sz - .012 * SIZE;
    const edges: {a: Vec3; b: Vec3; low: number; high: number}[] = [];
    const seen = new Set<number>(), n = points.length;
    if (fitTransition < 1) for (let i = 0; i < body.indices.length; i += 3)
        for (let j = 0; j < 3; j++) {
            const a = body.indices[i + j]!, b = body.indices[i + (j + 1) % 3]!, k = Math.min(a, b) * n + Math.max(a, b);
            if (seen.has(k))
                continue;
            seen.add(k);
            const low = Math.min(points[a]![2], points[b]![2]), high = Math.max(points[a]![2], points[b]![2]);
            if (high > top - .145)
                edges.push({a: points[a]!, b: points[b]!, low, high});
        }
    const bodyHeightBins = new Map<number, typeof edges>();
    for (const edge of edges) {
        for (let bin=Math.floor(Math.max(edge.low-1e-9,top-.145-1e-9)/.004);bin<=Math.floor(Math.min(edge.high+1e-9,top+1e-9)/.004);bin++) {
            let list=bodyHeightBins.get(bin);
            if (!list) {list=[];bodyHeightBins.set(bin,list);}
            list.push(edge);
        }
    }
    const fieldPoints=(fitTransition===1 && drapeStrength===0 ? [] : stableSurfaceSamples(contour)).map(([x,y,z,weight])=>{
        const p:Vec3=[x*.59,y*.59,z*depth];
        return {point:basis.map(v=>dot(v,p)) as Vec3,weight};
    });
    const stableClosestPoint = (p:Vec3,minHeight:number):Vec3 => {
        let minimum=Infinity;
        const distances=fieldPoints.map(({point,weight})=>{
            const low=Math.max(0,minHeight-point[2]);
            const d=(point[0]-p[0])**2+(point[1]-p[1])**2+(point[2]-p[2])**2+low*low*4;
            if(weight>0)minimum=Math.min(minimum,d);
            return d;
        });
        const result:Vec3=[0,0,0];let sum=0;
        for(let i=0;i<fieldPoints.length;i++){
            const {point,weight}=fieldPoints[i]!;
            // A broad support neighbourhood avoids near-boundary lattice samples
            // handing off their weight within a single animation frame.
            const w=weight*Math.exp(-(distances[i]!-minimum)/(.04*.04));
            sum+=w;for(let k=0;k<3;k++)result[k]!+=point[k]!*w;
        }
        return sum>0?result.map(v=>v/sum) as Vec3:p;
    };
    const fieldAt = (insertion: number) => {
        if(fitTransition===1)return Array<number>(SEGMENTS).fill(1.10);
        const py = top - insertion, field = Array<number>(SEGMENTS).fill(.95);
        // Smooth support weights vanish at the vertical window boundaries.
        // Hard horizontal slices let a grazing lobe suddenly widen a whole
        // sector; this continuous field only controls bounded cloth fullness.
        // Collision clearance remains governed by the independent inner envelope.
        for (const {point,weight} of fieldPoints) {
            const height = point[2] - py, v = (height - .015) / .045;
            const verticalWeight = Math.max(0, 1 - v * v) ** 2 * weight;
            if (verticalWeight === 0) continue;
            const x = point[0] - px, z = point[1] - pz;
            const angle = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2), bin = angle / (Math.PI * 2) * SEGMENTS;
            const c = Math.cos(angle), s = Math.sin(angle), r = 1 / Math.sqrt((c / (.300 * SIZE)) ** 2 + (s / (.240 * SIZE)) ** 2);
            const required = clamp((Math.hypot(x, z) + .005) / r, .95, 1.10);
            for (let k = -4; k <= 4; k++) {
                const j = (Math.floor(bin) + k + SEGMENTS) % SEGMENTS;
                const d = Math.min(Math.abs(j - bin), SEGMENTS - Math.abs(j - bin)) / 4;
                const w = Math.max(0, 1 - d * d) ** 2;
                field[j] = Math.max(field[j]!, .95 + (required - .95) * w * verticalWeight);
            }
        }
        for (let pass = 0; pass < 6; pass++) {
            const copy = [...field];
            for (let i = 0; i < SEGMENTS; i++)
                field[i] = (copy[(i + 63) % 64]! + copy[i]! * 2 + copy[(i + 1) % 64]!) / 4;
        }
        // During contour morphing, adaptive body triangulation is not a stable
        // sampling lattice. Blend toward a bounded conservative cloth field.
        for (let i=0;i<field.length;i++) field[i]! += (1.10-field[i]!) * fitTransition;
        return field;
    };
    const scaleAt = (field: number[], x: number, z: number, y: number) => {
        const a = ((Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * SEGMENTS, i = Math.floor(a), t = a - i;
        const amount = field[i]! * (1 - t) + field[(i + 1) % SEGMENTS]! * t;
        const h = clamp((y - .03) / .12, 0, 1), weight = 1 - h * h * (3 - 2 * h);
        return 1 + (amount - 1) * weight;
    };
    const inner = innerBase.map((r,j)=>r.map((v,k)=>v+(innerSpacious[j]![k]!-v)*room));
    // Exact horizontal exterior bounds of the authored hollow shell. A body
    // point beside the hat is exterior space, not failed cavity occupancy.
    let outerHeightBins = exteriorGeometry.get(garment.geometry);
    if (!outerHeightBins && fitTransition < 1) {
    const outerEdges: ExteriorEdge[]=[];
    if(room) {
        const indices = garment.geometry.indices;
        let pairs = exteriorTopology.get(indices);
        if (!pairs) {
            pairs = [];
            const seenOuter = new Set<string>();
            for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){
                const a=indices[i+k]!,b=indices[i+(k+1)%3]!;
                if(a<449||b<449||a>1857||b>1857)continue;
                const key=a<b?a+':'+b:b+':'+a;if(seenOuter.has(key))continue;seenOuter.add(key);
                pairs.push([a,b]);
            }
            exteriorTopology.set(indices,pairs);
        }
        for (const [a,b] of pairs) {
            const point=(id:number):Vec3=>[garment.geometry.vertices[id*6]!*SIZE,garment.geometry.vertices[id*6+1]!*SIZE,(garment.geometry.vertices[id*6+2]!+.037)*SIZE];
            const pa=point(a),pb=point(b);outerEdges.push({a:pa,b:pb,low:Math.min(pa[2],pb[2]),high:Math.max(pa[2],pb[2])});
        }
    }
    outerHeightBins = new Map<number, ExteriorEdge[]>();
    for (const edge of outerEdges) {
        for (let bin=Math.floor((edge.low-1e-9)/.004);bin<=Math.floor((edge.high+1e-9)/.004);bin++) {
            let list=outerHeightBins.get(bin);
            if (!list) {list=[];outerHeightBins.set(bin,list);}
            list.push(edge);
        }
    }
    exteriorGeometry.set(garment.geometry,outerHeightBins);
    }
    const outerBins = outerHeightBins ?? new Map<number, ExteriorEdge[]>();
    const exteriorCache=new Map<number,number[]>();
    const exteriorBounds=(y:number)=>{
        const found=exteriorCache.get(y);if(found)return found;
        const bounds=[Infinity,-Infinity,Infinity,-Infinity];
        for(const {a,b,low,high} of outerBins.get(Math.floor(y/.004)) ?? []){
            if(y<low-1e-9||y>high+1e-9)continue;
            const t=high-low<1e-10?0:clamp((y-a[2])/(b[2]-a[2]),0,1);
            const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
            bounds[0]=Math.min(bounds[0]!,x);bounds[1]=Math.max(bounds[1]!,x);bounds[2]=Math.min(bounds[2]!,z);bounds[3]=Math.max(bounds[3]!,z);
        }
        exteriorCache.set(y,bounds);return bounds;
    };
    const fits = (insertion: number) => {
        const py = top - insertion, minimumField = .95, actualField = room ? fieldAt(insertion) : undefined;
        let lastY = NaN, s = 0, rx = 0, rz = 0, cx = 0, valid = false;
        const contains = (x: number, z: number, y: number) => {
            if (y !== lastY) {
                lastY = y;
                const cavityRoom = cavity(y, inner);
                valid = !!cavityRoom;
                if (cavityRoom) {
                    // Use an inward lining margin for the section estimate.
                    // The roomy cavity follows the same bounded radial cloth
                    // field; the final triangle guard verifies actual clearance.
                    s = minimumField;
                    // The opening is an entrance, so its safety inset must not
                    // reject a tip that already lies inside the real rolled lip.
                    // Recover the full lining margin within .004 model units.
                    const entrance = clamp(y / .004, 0, 1);
                    const entranceMargin = .0005 + .0025 * entrance * entrance * (3 - 2 * entrance);
                    const clearance = .003 + (entranceMargin - .003) * (1 - clamp(drapeStrength, 0, 1));
                    rx = cavityRoom[0]! - clearance; rz = cavityRoom[1]! - clearance; cx = cavityRoom[2]!;
                    valid = rx > 0 && rz > 0;
                }
            }
            if(room===0)return valid && ((x/minimumField-cx)/rx)**2+((z/minimumField-.012*SIZE)/rz)**2<=1;
            if (actualField) s = minimumField+(scaleAt(actualField, x, z, y)-minimumField)*room;
            const rawX=x/s,rawZ=z/s,bounds=exteriorBounds(y);
            const exteriorViolation=bounds[0]===Infinity?-1:Math.min(rawX-bounds[0]!,bounds[1]!-rawX,rawZ-bounds[2]!,bounds[3]!-rawZ)/.25;
            if (!valid) return 1+(Math.min(1,exteriorViolation)-1)*room <= 0;
            const insideViolation=((rawX-cx)/rx)**2+((rawZ-.012*SIZE)/rz)**2-1;
            const admissibleViolation=Math.min(insideViolation,exteriorViolation);
            return insideViolation+(admissibleViolation-insideViolation)*room <= 0;
        };
        for (const p of points) {
            const y = p[2] - py;
            if (y >= 0 && !contains(p[0] - px, p[1] - pz, y))
                return false;
        }
        // Vertices alone miss triangles passing through the opening between mesh
        // rows. Include exact body-edge sections throughout the complete inner wall.
        const levels = new Set<number>([0, ...[...innerBase, ...inner].map(r => r[3]!).filter(y => y >= 0 && y <= insertion)]);
        for (let y = 0; y <= insertion; y += .004)
            levels.add(y);
        for (const p of points) {
            const y = p[2] - py;
            if (y >= 0 && y <= insertion)
                levels.add(y);
        }
        for (const y of levels) {
            const level = py + y;
            for (const {a, b, low, high} of bodyHeightBins.get(Math.floor(level/.004)) ?? []) {
                if (level < low || level >= high || high - low < 1e-10)
                    continue;
                const t = (level - a[2]) / (b[2] - a[2]);
                if (!contains(a[0] + (b[0] - a[0]) * t - px, a[1] + (b[1] - a[1]) * t - pz, y))
                    return false;
            }
        }
        return true;
    };
    const bodySurface = new BodyTriangleBVH(points,body.indices);
    let settledInsertion = 0;
    if (fitTransition < 1) {
        let lo = 0, hi = .145, coarseLo = 0;
        for (let i = 0; i < (room > 0 ? 16 : 10); i++) {
            const mid = (lo + hi) / 2;
            if (fits(mid)) lo = mid; else hi = mid;
            if (i === 9) coarseLo = lo;
        }
        settledInsertion = coarseLo + (lo - coarseLo) * room;
    }
    if(fitTransition<1 && !fits(0))settledInsertion=0;
    let reachableInsertion=settledInsertion;
    if(fitTransition>0){
        const initialField=fieldAt(0), guidePoints:Vec3[]=[];
        for(let i=0;i<garment.geometry.vertices.length;i+=6){
            const x=garment.geometry.vertices[i]!*SIZE,z=garment.geometry.vertices[i+1]!*SIZE;
            const y=(garment.geometry.vertices[i+2]!+.037)*SIZE;
            const scale=scaleAt(initialField,x,z,y);
            guidePoints.push([x*scale+px,z*scale+pz,y+top]);
        }
        // A continuous rigid sweep finds the first physical fabric contact,
        // allowing the body through the empty aperture without skipping into
        // a disconnected later pocket. Partial transition deformation is still
        // checked by the final exact surface guard below.
        const contact=bodySurface.firstMeshHit(guidePoints,garment.geometry.indices,[0,0,-1],.145);
        reachableInsertion=contact===undefined?.145:Math.max(0,contact-.0005);
    }
    const insertion=settledInsertion+(reachableInsertion-settledInsertion)*fitTransition;
    const field=fieldAt(insertion),py=top-insertion;
    const motionRelaxation = Math.exp(-rotation.reduce((sum,value)=>sum+value*value,0)/(.06*.06));
    const lipDeltas: Vec3[] = [];
    if (room && drapeStrength!==0) for(let j=0;j<SEGMENTS;j++) {
        const i=(1+5*SEGMENTS+j)*6, y=(garment.geometry.vertices[i+2]!+.037)*SIZE;
        let x=garment.geometry.vertices[i]!*SIZE,z=garment.geometry.vertices[i+1]!*SIZE;
        const scale=scaleAt(field,x,z,y);x=x*scale+px;z=z*scale+pz;
        const p:Vec3=[x,z,y+py], nearest=stableClosestPoint(p,py-.15);
        const best=(p[0]-nearest[0])**2+(p[1]-nearest[1])**2+(p[2]-nearest[2])**2;
        const distance=Math.sqrt(best), factor=Math.max(0,1-.012/Math.max(distance,1e-9));
        let delta=p.map((v,k)=>(nearest[k]!-v)*factor) as Vec3;
        const radialDifference=(nearest[0]-px)**2+(nearest[1]-pz)**2-(p[0]-px)**2-(p[1]-pz)**2;
        const smooth=(value:number,low:number,high:number)=>{const t=clamp((value-low)/(high-low),0,1);return t*t*(3-2*t);};
        const gravityWeight=1-(1-smooth(distance,.12,.14))*(1-smooth(radialDifference,0,.004));
        if(gravityWeight>0) {
            const radius=Math.hypot(p[0]-px,p[1]-pz)||1, freeTip=Math.max(0,(p[0]-px)/radius);
            const gravity=basis.map(v=>-v[1]*(.055+.025*freeTip)) as Vec3;
            const curl=.055+.045*freeTip;
            gravity[0]-=(p[0]-px)/radius*curl;gravity[1]-=(p[1]-pz)/radius*curl;
            delta=delta.map((v,k)=>v+(gravity[k]!-v)*gravityWeight) as Vec3;
        }
        // The opening may bend around support, but cannot collapse into a point.
        delta[0]=clamp(delta[0],-.10,.10);delta[1]=clamp(delta[1],-.10,.10);delta[2]=clamp(delta[2],-.10,.012);
        lipDeltas.push(delta);
    }
    if(room && drapeStrength!==0)for(let pass=0;pass<6;pass++){const copy=lipDeltas.map(v=>[...v]);for(let j=0;j<SEGMENTS;j++)for(let k=0;k<3;k++)lipDeltas[j]![k]=(copy[(j+63)%64]![k]!+2*copy[j]![k]!+copy[(j+1)%64]![k]!)/4;}
    const vertices = new Float32Array(garment.geometry.vertices.length);
    const basePoints: Vec3[] = [], drapedPoints: Vec3[] = [];
    for (let i = 0; i < vertices.length; i += 6) {
        let x = garment.geometry.vertices[i]! * SIZE, z = garment.geometry.vertices[i + 1]! * SIZE;
        const y = (garment.geometry.vertices[i + 2]! + .037) * SIZE;
        const s = scaleAt(field, x, z, y);
        x = x * s + px;
        z = z * s + pz;
        const q: Vec3 = [x, z, y + py];
        basePoints.push([...q]);
        if(room && drapeStrength===0){
            // Preserve the original subtract/add round trip even at zero weight.
            q[0]=px+(x-px);q[1]=pz+(z-pz);q[2]+=0;
        } else if(room){
            const dx=x-px,dz=z-pz,a=((Math.atan2(dz,dx)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*64,j=Math.floor(a),f=a-j;
            const d=lipDeltas[j]!.map((v,k)=>v*(1-f)+lipDeltas[(j+1)%64]![k]!*f) as Vec3;
            const t=clamp((y-.035)/.13,0,1),w=(1-t*t*(3-2*t))*room*drapeStrength*motionRelaxation;
            const r=Math.hypot(dx,dz), radial=r>1e-6?(d[0]*dx+d[1]*dz)/r:0, scale=1+Math.max(clamp(radial/.25,-.40,.05),.04*Math.sin(a/64*Math.PI*2)**2-.40*Math.cos(a/64*Math.PI*2)**4)*w;
            q[0]=px+dx*scale;q[1]=pz+dz*scale;q[2]+=d[2]*w;
        }
        drapedPoints.push(q);
    }
    const drapeAmount = clamp(drapeLimit, 0, 1);
    const fittedPoints = basePoints.map((p,j) => p.map((v,k)=>v+(drapedPoints[j]![k]!-v)*drapeAmount) as Vec3);
    // Analytic section fitting and authored drape can miss a narrow
    // triangle crossing at the rolled lip. Verify the final fabric surface,
    // then apply only the first small outward clearance correction it needs.
    // This is a local geometric correction, never a time-lagged floating pose.
    let contactCorrection = 0, contactResolved = !bodySurface.intersectsMesh(fittedPoints, garment.geometry.indices);
    if (!contactResolved) {
        for (let step = 1; step <= 48; step++) {
            contactCorrection = step * .00025;
            for (let j = 0; j < fittedPoints.length; j++)
                fittedPoints[j]![2] = basePoints[j]![2] + (drapedPoints[j]![2] - basePoints[j]![2]) * drapeAmount + contactCorrection;
            contactResolved = !bodySurface.intersectsMesh(fittedPoints, garment.geometry.indices);
            if (contactResolved) break;
        }
    }
    for (let j=0;j<fittedPoints.length;j++) {
        const q=fittedPoints[j]!;
        for(let k=0;k<3;k++) vertices[j*6+k]=basis[0]![k]!*q[0]+basis[1]![k]!*q[1]+basis[2]![k]!*q[2];
    }
    accumulateNormals(vertices, Array.from(garment.geometry.indices));
    const result = { vertices, indices: garment.geometry.indices, bandIndexCount: garment.bandIndexCount, crownIndexCount: garment.geometry.indices.length - garment.bandIndexCount, seating: -insertion + contactCorrection, contactCorrection, contactResolved };
    if (cache.size >= 8)
        cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return result;
}
export function wornBeret(contour: ShapeContour, scales: Vec3, shape: MaterialShapeName, rotation: Vec3 = [0, 0, 0], tilt = (shape === 'cookie6Sided' ? -40 : shape === 'heart' ? -18 : shape === 'triangle' || shape === 'pixelTriangle' ? -14 : shape === 'boom' ? -32 : shape === 'square' || shape === 'bun' ? -42 : -30) * Math.PI / 180, center?: Vec2, room = 0, drapeStrength = 1, fitTransition = 0, drapeLimit = 1): BeretGeometry {
    const squash = scales[1] / .59, stretch = 1 / Math.sqrt(squash), base = fit(contour, scales[2] / stretch, rotation, tilt, center, room, drapeStrength, fitTransition, drapeLimit);
    const vertices = new Float32Array(base.vertices);
    for (let i = 0; i < vertices.length; i += 6) {
        vertices[i]! *= stretch;
        vertices[i + 1]! *= squash;
        vertices[i + 2]! *= stretch;
        vertices[i + 3]! /= stretch;
        vertices[i + 4]! /= squash;
        vertices[i + 5]! /= stretch;
        const n = Math.hypot(vertices[i + 3]!, vertices[i + 4]!, vertices[i + 5]!) || 1;
        for (let k = 3; k < 6; k++)
            vertices[i + k]! /= n;
    }
    return { ...base, vertices };
}
