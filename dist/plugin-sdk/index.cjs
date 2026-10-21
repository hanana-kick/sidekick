/*! Sidekick Plugin SDK 0.18.0 | See LICENSE and third_party/material-shapes.
Sidekick Library and Character License 1.0

Copyright (c) 2026 the respective Sidekick authors and rights holders.

1. Scope and definitions

This license applies only to the Sidekick material distributed with this license
that its respective rights holders are entitled to license (the "Material").
"Library" means the software, source code, compiled bundles, APIs, documentation,
and examples in the Material. "Official Character" means the original expressive
Sidekick character artwork and character designs embodied in this distribution's
built-in character compositions, facial designs, accessories, poses and animations,
including their rendered images and adaptations that retain that expression.
Changing a color, shape option, accessory, name, medium, or file format does not by
itself remove the retained Official Character expression from this definition.

The Official Character does not include the idea of an animated companion, style
alone, generic shapes or familiar symbols, algorithms, public-domain material, or
independently created user or third-party artwork that does not copy protected
Sidekick expression. Using the Library alone does not make an independently
created character an Official Character or transfer ownership of user content.
Third-party material is excluded from this license and remains governed by its
own licenses and notices, even when included in the same file or bundle.

2. Library use and embedding

Permission is granted, free of charge and worldwide, to use, reproduce, modify,
combine, distribute, and provide the Library in source or compiled form, including
in proprietary, paid, subscription-based, advertising-supported, and other
commercial or noncommercial websites, applications, products and services, subject
only to the conditions of this license. There is no embedding fee, revenue limit,
application-category restriction, source-disclosure requirement, or required
on-screen attribution. You may charge for applications, services, integrations,
support and software distributions incorporating the Library.

This permission includes displaying, animating, and customizing the Official
Character as an embedded interface element or companion, and making the copies
and adaptations needed for that use. Normal screenshots, recordings, documentation,
app-store listings, demonstrations and advertising of the embedding product may
show that embedded use. Neither charging for the embedding product nor the mere
presence of the Official Character in it is Character Commercialization.

3. No commercialization of the character itself

No permission is granted to commercialize the Official Character itself, whether
unchanged or adapted ("Character Commercialization"). This includes selling,
licensing, renting, or otherwise monetizing the Official Character or rights to it
as merchandise, physical or digital stickers or emoticons, avatar or skin packs,
digital collectibles (including NFTs), standalone images, animations, models,
character assets, or other character-based goods or content. It also includes
paid character-specific unlocks and offering such items as paid, sponsored,
promotional, or bundled goods, even if called free or included in another price.
Embedding the Library in a character-asset sales or distribution interface does
not authorize the prohibited commercialization of the Official Character.

This restriction does not prohibit the commercial embedding and ordinary product
advertising expressly permitted by section 2, nor the sale or licensing of wholly
independent user-created characters excluded by section 1. Noncommercial personal
use and sharing of the Official Character are permitted under this license.

4. Redistribution and notices

Keep this license and applicable copyright and third-party notices with copies or
substantial portions of the Material that you distribute. Notices may accompany a
product in its license files or legal notices; they need not appear beside the
embedded character. Do not offer the Material under terms that purport to grant
Character Commercialization rights. Recipients receive the permissions in this
license directly from the relevant rights holders. Your own code and independent
content may use different terms. No ownership of the Official Character, or right
to imply endorsement by Sidekick, is granted.

5. Earlier versions and independent rights

This license applies to copies distributed under it. It does not withdraw, replace,
or restrict rights already granted under another license, including any prior MIT
license, or rights independently obtained from other rights holders. Earlier
releases retain their applicable terms. This license does not claim new exclusive
rights over third-party or public-domain material and does not limit uses allowed
by applicable law without permission, including applicable copyright exceptions.

6. Disclaimer

To the extent permitted by applicable law, the Material is provided as is, without
warranties of any kind, express or implied, including merchantability, fitness for
a particular purpose, and noninfringement. To that extent, the authors and rights
holders are not liable for claims, damages, or other liability arising from the
Material or its use, whether in contract, tort, or otherwise.

This is a custom license, not the MIT License or an OSI-approved open-source
license. The English text in this file is authoritative; README summaries are
explanations and do not replace these terms.

Material Shapes contour data and recipe generator
Copyright 2024 The Android Open Source Project
Licensed under the Apache License, Version 2.0. See LICENSE in this directory.

Source: AndroidX Compose MaterialShapes.kt
Snapshot: 9a589fa61f8661e0cbef9123dcc98d3c1f655fc7
File blob: 7e02d245662ff48a5dba19ea0d170356256ed93f
Source SHA-256: 08c29828003344914ee0d6783f213b37caae650175cd004ba321eaf3a7d6e434
https://github.com/androidx/androidx/blob/9a589fa61f8661e0cbef9123dcc98d3c1f655fc7/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/MaterialShapes.kt

Sidekick modifications: translated numeric recipes, repeated/mirrored vertices,
and 2D transforms to Java; generated normalized cubic coordinates using the
unmodified official androidx.graphics:graphics-shapes-android:1.1.0 library;
added TypeScript contour tessellation, direct closed-perimeter morph matching,
and a constant-thickness shallow 3D extrusion. Morph alignment minimizes
point travel and merges both contours' vertex breakpoints; there is no ellipse
waypoint. Interrupted snapshots are bounded by microscopic contour simplification.
The 3D extrusion and morph correspondence are not AndroidX Morph and are not
provided or endorsed by Google. Source values are IEEE Float-derived; Sidekick
runtime uses JavaScript numbers.

Regeneration: node scripts/generate-material-shapes.mjs
The generator verifies SHA-256 for every downloaded official build dependency
and the pinned source snapshot. It adds no application runtime dependencies.
All 35 shape recipes are preserved, including per-vertex corner radii/smoothing,
mirroring, rotations, and aspect-preserving AndroidX normalized() bounds.

*/
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region core/shapes.js
/** All 35 official Material Design expressive shapes, using camelCase API names. */
const MATERIAL_SHAPE_NAMES = Object.freeze([
	"circle",
	"square",
	"slanted",
	"arch",
	"fan",
	"arrow",
	"semiCircle",
	"oval",
	"pill",
	"triangle",
	"diamond",
	"clamShell",
	"pentagon",
	"gem",
	"verySunny",
	"sunny",
	"cookie4Sided",
	"cookie6Sided",
	"cookie7Sided",
	"cookie9Sided",
	"cookie12Sided",
	"ghostish",
	"clover4Leaf",
	"clover8Leaf",
	"burst",
	"softBurst",
	"boom",
	"softBoom",
	"flower",
	"puffy",
	"puffyDiamond",
	"pixelCircle",
	"pixelTriangle",
	"bun",
	"heart"
]);
Object.freeze({
	circle: "Circle",
	square: "Square",
	slanted: "Slanted",
	arch: "Arch",
	fan: "Fan",
	arrow: "Arrow",
	semiCircle: "Semi Circle",
	oval: "Oval",
	pill: "Pill",
	triangle: "Triangle",
	diamond: "Diamond",
	clamShell: "Clam Shell",
	pentagon: "Pentagon",
	gem: "Gem",
	verySunny: "Very Sunny",
	sunny: "Sunny",
	cookie4Sided: "4-sided cookie",
	cookie6Sided: "6-sided cookie",
	cookie7Sided: "7-sided cookie",
	cookie9Sided: "9-sided cookie",
	cookie12Sided: "12-sided cookie",
	ghostish: "Ghostish",
	clover4Leaf: "4-leaf clover",
	clover8Leaf: "8-leaf clover",
	burst: "Burst",
	softBurst: "Soft Burst",
	boom: "Boom",
	softBoom: "Soft Boom",
	flower: "Flower",
	puffy: "Puffy",
	puffyDiamond: "Puffy Diamond",
	pixelCircle: "Pixel Circle",
	pixelTriangle: "Pixel Triangle",
	bun: "Bun",
	heart: "Heart"
});
const presetNames = [
	"orb",
	"rounded-box",
	"droplet"
];
function bounded$3(value, min, max, path) {
	if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new RangeError(`${path}: expected a finite number from ${min} to ${max}.`);
	return value;
}
function object$2(value, path) {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${path}: expected a shape object.`);
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path}: expected a plain shape object.`);
	if (Object.getOwnPropertySymbols(value).length) throw new TypeError(`${path}: symbol keys are unsupported.`);
	return value;
}
function keys$1(value, allowed, path) {
	for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`${path}.${key}: unsupported shape field.`);
}
function materialName(value, path) {
	if (typeof value !== "string" || !MATERIAL_SHAPE_NAMES.includes(value)) throw new TypeError(`${path}: expected a supported Material shape name.`);
	return value;
}
function preset(value, path) {
	if (typeof value !== "string" || !presetNames.includes(value)) throw new TypeError(`${path}: expected orb, rounded-box, or droplet.`);
	return value;
}
/**
* Validate an untrusted shape recipe and return a deeply isolated copy.
* Legacy strings are converted to preset objects. Unknown fields, arbitrary paths,
* non-finite numbers, cycles, and excessive composition are rejected.
*/
function parseShape(input) {
	let count = 0;
	function visit(value, depth, path) {
		if (depth > 4 || ++count > 31) throw new RangeError(`${path}: shape composition is too deep or large.`);
		if (typeof value === "string") return {
			kind: "preset",
			name: preset(value, path)
		};
		const shape = object$2(value, path);
		switch (shape.kind) {
			case "ellipse":
				keys$1(shape, ["kind"], path);
				return { kind: "ellipse" };
			case "material":
				keys$1(shape, ["kind", "name"], path);
				return {
					kind: "material",
					name: materialName(shape.name, `${path}.name`)
				};
			case "preset":
				keys$1(shape, ["kind", "name"], path);
				return {
					kind: "preset",
					name: preset(shape.name, `${path}.name`)
				};
			case "rounded-polygon": {
				keys$1(shape, [
					"kind",
					"sides",
					"rounding",
					"rotation"
				], path);
				const sides = bounded$3(shape.sides, 3, 12, `${path}.sides`);
				if (!Number.isInteger(sides)) throw new RangeError(`${path}.sides: expected an integer.`);
				return {
					kind: "rounded-polygon",
					sides,
					rounding: bounded$3(shape.rounding, 0, 1, `${path}.rounding`),
					rotation: bounded$3(shape.rotation, -Math.PI, Math.PI, `${path}.rotation`)
				};
			}
			case "morph":
				keys$1(shape, [
					"kind",
					"from",
					"to",
					"progress"
				], path);
				if (depth >= 4) throw new RangeError(`${path}: at most 4 nested morph operations are supported.`);
				return {
					kind: "morph",
					from: visit(shape.from, depth + 1, `${path}.from`),
					to: visit(shape.to, depth + 1, `${path}.to`),
					progress: bounded$3(shape.progress, 0, 1, `${path}.progress`)
				};
			default: throw new TypeError(`${path}.kind: expected ellipse, rounded-polygon, material, preset, or morph.`);
		}
	}
	return visit(input, 0, "shape");
}
Object.freeze({
	ellipse() {
		return { kind: "ellipse" };
	},
	material(name) {
		return {
			kind: "material",
			name: materialName(name, "shape.name")
		};
	},
	preset(name) {
		return {
			kind: "preset",
			name: preset(name, "shape.name")
		};
	},
	roundedPolygon(sides, options = {}) {
		keys$1(object$2(options, "shape.options"), ["rounding", "rotation"], "shape.options");
		return parseShape({
			kind: "rounded-polygon",
			sides,
			rounding: options.rounding === void 0 ? .25 : options.rounding,
			rotation: options.rotation === void 0 ? Math.PI / 2 : options.rotation
		});
	},
	morph(from, to, progress) {
		return parseShape({
			kind: "morph",
			from,
			to,
			progress
		});
	}
});
//#endregion
//#region core/material-shapes.js
/** Official normalized Y-down cubics; exposed internally for contour-fidelity tests. */
const MATERIAL_SHAPE_CUBICS = Object.freeze({
	circle: [
		[
			1,
			.5,
			1,
			.5517268,
			.9919087,
			.6034536,
			.97572625,
			.6532584
		],
		[
			.97572625,
			.6532584,
			.9433613,
			.75286746,
			.8802929,
			.8396737,
			.7955603,
			.9012355
		],
		[
			.7955603,
			.9012355,
			.71082765,
			.96279734,
			.6087809,
			.9959544,
			.50404555,
			.9959544
		],
		[
			.50404555,
			.9959544,
			.3993104,
			.9959544,
			.29726353,
			.9627972,
			.21253096,
			.9012355
		],
		[
			.21253096,
			.9012355,
			.12779829,
			.83967364,
			.06472998,
			.7528675,
			.032364976,
			.65325826
		],
		[
			.032364976,
			.65325826,
			0,
			.5536492,
			0,
			.44635072,
			.032365,
			.3467416
		],
		[
			.032365,
			.3467416,
			.06473,
			.24713236,
			.12779829,
			.16032636,
			.21253096,
			.09876451
		],
		[
			.21253096,
			.09876451,
			.29726362,
			.037202634,
			.3993102,
			.0040456844,
			.5040456,
			.004045655
		],
		[
			.5040456,
			.004045655,
			.6087809,
			.004045655,
			.7108278,
			.03720272,
			.7955605,
			.09876463
		],
		[
			.7955605,
			.09876463,
			.8802931,
			.16032647,
			.9433614,
			.24713263,
			.9757263,
			.34674183
		],
		[
			.9757263,
			.34674183,
			.9919088,
			.39654645,
			1,
			.44827324,
			1,
			.5
		]
	],
	square: [
		[
			.912132,
			.912132,
			.85784274,
			.96642137,
			.7828427,
			1,
			.7,
			1
		],
		[
			.7,
			1,
			.56666666,
			1,
			.43333334,
			1,
			.3,
			1
		],
		[
			.3,
			1,
			.1343146,
			1,
			0,
			.8656854,
			0,
			.7
		],
		[
			0,
			.7,
			0,
			.56666666,
			0,
			.43333334,
			0,
			.3
		],
		[
			0,
			.3,
			0,
			.1343146,
			.1343146,
			0,
			.3,
			0
		],
		[
			.3,
			0,
			.43333334,
			0,
			.56666666,
			0,
			.7,
			0
		],
		[
			.7,
			0,
			.8656854,
			0,
			1,
			.1343146,
			1,
			.3
		],
		[
			1,
			.3,
			1,
			.43333334,
			1,
			.56666666,
			1,
			.7
		],
		[
			1,
			.7,
			1,
			.7828427,
			.96642137,
			.8578427,
			.912132,
			.912132
		]
	],
	slanted: [
		[
			.8755312,
			.9140243,
			.8677265,
			.92105526,
			.859326,
			.9274248,
			.85041404,
			.93305683
		],
		[
			.85041404,
			.93305683,
			.80464435,
			.9619815,
			.74102956,
			.96177995,
			.61379975,
			.9613769
		],
		[
			.61379975,
			.9613769,
			.47651702,
			.96094203,
			.3392343,
			.9605071,
			.2019516,
			.9600722
		],
		[
			.2019516,
			.9600722,
			.19244726,
			.96004206,
			.1876951,
			.96002704,
			.1850028,
			.95993966
		],
		[
			.1850028,
			.95993966,
			.08062565,
			.95655257,
			0,
			.86705464,
			.0074887364,
			.7628914
		],
		[
			.0074887364,
			.7628914,
			.0076818247,
			.76020575,
			.008161218,
			.7554774,
			.009120003,
			.7460208
		],
		[
			.009120003,
			.7460208,
			.022795796,
			.61113435,
			.036471594,
			.47624788,
			.050147384,
			.3413614
		],
		[
			.050147384,
			.3413614,
			.062981166,
			.21478,
			.069398046,
			.15148929,
			.10292682,
			.10897672
		],
		[
			.10292682,
			.10897672,
			.11598381,
			.09242122,
			.13176204,
			.07820718,
			.14958593,
			.066943154
		],
		[
			.14958593,
			.066943154,
			.19535553,
			.038018484,
			.25897038,
			.038220014,
			.38620013,
			.038623083
		],
		[
			.38620013,
			.038623083,
			.52348286,
			.039057992,
			.66076565,
			.03949291,
			.79804844,
			.03992782
		],
		[
			.79804844,
			.03992782,
			.8075533,
			.039957937,
			.81230575,
			.039972994,
			.8149972,
			.040060326
		],
		[
			.8149972,
			.040060326,
			.91937435,
			.043447427,
			1,
			.13294539,
			.9925112,
			.23710865
		],
		[
			.9925112,
			.23710865,
			.9923179,
			.23979653,
			.99183863,
			.2445241,
			.99088,
			.2539793
		],
		[
			.99088,
			.2539793,
			.97720414,
			.3888657,
			.96352834,
			.52375215,
			.9498526,
			.65863854
		],
		[
			.9498526,
			.65863854,
			.93701875,
			.78521997,
			.9306019,
			.8485106,
			.89707315,
			.8910232
		],
		[
			.89707315,
			.8910232,
			.89054465,
			.89930093,
			.8833358,
			.9069933,
			.8755312,
			.9140243
		]
	],
	arch: [
		[
			.14644665,
			.1464466,
			.23692884,
			.05596439,
			.36192882,
			-2.1073424e-8,
			.5,
			0
		],
		[
			.5,
			0,
			.7761423,
			0,
			1,
			.22385772,
			.99999994,
			.50000006
		],
		[
			.99999994,
			.50000006,
			.99999994,
			.61952627,
			1,
			.7390524,
			1,
			.8585787
		],
		[
			1,
			.8585787,
			.99999994,
			.93668354,
			.93668354,
			1,
			.8585787,
			1
		],
		[
			.8585787,
			1,
			.61952615,
			.99999994,
			.38047376,
			1,
			.14142135,
			.99999994
		],
		[
			.14142135,
			.99999994,
			.063316494,
			.99999994,
			0,
			.93668336,
			0,
			.8585785
		],
		[
			0,
			.8585785,
			0,
			.7390524,
			4.2146848e-8,
			.61952615,
			0,
			.49999997
		],
		[
			0,
			.49999997,
			2.1073424e-8,
			.3619288,
			.055964436,
			.23692879,
			.14644665,
			.1464466
		]
	],
	fan: [
		[
			.95717525,
			.95531684,
			.938846,
			.97413886,
			.9155047,
			.98808014,
			.8891754,
			.99506223
		],
		[
			.8891754,
			.99506223,
			.87055564,
			1,
			.84303874,
			1,
			.78800505,
			1
		],
		[
			.78800505,
			1,
			.5757516,
			1,
			.3634982,
			1,
			.1512448,
			1
		],
		[
			.1512448,
			1,
			.06796568,
			1,
			.0004546277,
			.93248886,
			.0004546277,
			.8492097
		],
		[
			.0004546277,
			.8492097,
			.0004546277,
			.61604124,
			.0004546277,
			.3828729,
			.0004546277,
			.14970455
		],
		[
			.0004546277,
			.14970455,
			.00045463606,
			.06671953,
			.06876169,
			0,
			.15172377,
			.001951042
		],
		[
			.15172377,
			.001951042,
			.17267422,
			.0024437425,
			.1936247,
			.0029364433,
			.21457517,
			.0034292482
		],
		[
			.21457517,
			.0034292482,
			.641736,
			.013474982,
			.98599225,
			.35669622,
			.9973243,
			.78382474
		],
		[
			.9973243,
			.78382474,
			.99733484,
			.7842235,
			.99734545,
			.7846224,
			.99735606,
			.78502107
		],
		[
			.99735606,
			.78502107,
			.99881566,
			.8400355,
			.9995454,
			.8675427,
			.99510324,
			.88628685
		],
		[
			.99510324,
			.88628685,
			.98882186,
			.912792,
			.9755046,
			.9364948,
			.95717525,
			.95531684
		]
	],
	arrow: [
		[
			.49938738,
			.8368627,
			.47894177,
			.8367552,
			.45848423,
			.838917,
			.43839493,
			.84335023
		],
		[
			.43839493,
			.84335023,
			.38492194,
			.85515004,
			.33144897,
			.86695,
			.27797604,
			.87874985
		],
		[
			.27797604,
			.87874985,
			.12195567,
			.9131789,
			0,
			.7449043,
			.08128172,
			.6073506
		],
		[
			.08128172,
			.6073506,
			.11181903,
			.5556721,
			.14235632,
			.50399363,
			.17289363,
			.45231515
		],
		[
			.17289363,
			.45231515,
			.31810787,
			.20656797,
			.390715,
			.0836944,
			.4988227,
			.08352743
		],
		[
			.4988227,
			.08352743,
			.60693026,
			.08336049,
			.67991644,
			.20600939,
			.82588875,
			.45130718
		],
		[
			.82588875,
			.45130718,
			.8559578,
			.5018366,
			.88602704,
			.552366,
			.9160962,
			.6028954
		],
		[
			.9160962,
			.6028954,
			1,
			.7438909,
			.87382054,
			.9166395,
			.7139839,
			.8796016
		],
		[
			.7139839,
			.8796016,
			.66275865,
			.86773145,
			.61153334,
			.8558613,
			.56030816,
			.84399116
		],
		[
			.56030816,
			.84399116,
			.54026663,
			.839347,
			.51983297,
			.8369702,
			.49938738,
			.8368627
		]
	],
	semiCircle: [
		[
			.96949035,
			.7819903,
			.95063984,
			.80084074,
			.9245982,
			.81249994,
			.8958334,
			.81249994
		],
		[
			.8958334,
			.81249994,
			.6319445,
			.81249994,
			.36805555,
			.81249994,
			.10416668,
			.81249994
		],
		[
			.10416668,
			.81249994,
			.04663702,
			.81249994,
			0,
			.765863,
			0,
			.7083333
		],
		[
			0,
			.7083333,
			3.7252903e-8,
			.70138884,
			0,
			.6944445,
			0,
			.6875
		],
		[
			0,
			.6875,
			0,
			.41135764,
			.22385763,
			.1875,
			.5,
			.1875
		],
		[
			.5,
			.1875,
			.7761424,
			.1875,
			1,
			.41135764,
			1,
			.6875
		],
		[
			1,
			.6875,
			.99999994,
			.6944445,
			1,
			.70138884,
			1,
			.7083333
		],
		[
			1,
			.7083333,
			1,
			.73709816,
			.98834074,
			.76313984,
			.96949035,
			.7819903
		]
	],
	oval: [
		[
			.9084564,
			.091543645,
			.942462,
			.12554933,
			.9661038,
			.16991898,
			.97740257,
			.22267362
		],
		[
			.97740257,
			.22267362,
			1,
			.32818276,
			.97137433,
			.45858875,
			.89782274,
			.5852039
		],
		[
			.89782274,
			.5852039,
			.82427114,
			.7118188,
			.71181875,
			.8242712,
			.58520377,
			.89782274
		],
		[
			.58520377,
			.89782274,
			.45858875,
			.9713742,
			.32818276,
			1,
			.22267361,
			.97740257
		],
		[
			.22267361,
			.97740257,
			.11716447,
			.95480514,
			.04519486,
			.8828355,
			.02259743,
			.77732635
		],
		[
			.02259743,
			.77732635,
			0,
			.6718172,
			.028625693,
			.5414112,
			.10217724,
			.41479623
		],
		[
			.10217724,
			.41479623,
			.17572875,
			.28818125,
			.28818122,
			.17572889,
			.41479647,
			.10217724
		],
		[
			.41479647,
			.10217724,
			.5414115,
			.028625727,
			.67181736,
			3.4430297e-8,
			.77732646,
			.0225975
		],
		[
			.77732646,
			.0225975,
			.83008105,
			.03389623,
			.87445074,
			.057537958,
			.9084564,
			.091543645
		]
	],
	pill: [
		[
			.8731647,
			.12683535,
			.9403969,
			.19406751,
			.98515487,
			.2837738,
			.9954581,
			.38397372
		],
		[
			.9954581,
			.38397372,
			.9969721,
			.39869705,
			.998486,
			.4134204,
			1,
			.4281437
		],
		[
			1,
			.4281437,
			.9993606,
			.54387325,
			.95310354,
			.6546809,
			.8712691,
			.7365152
		],
		[
			.8712691,
			.7365152,
			.8263512,
			.78143317,
			.7814332,
			.82635117,
			.73651534,
			.8712691
		],
		[
			.73651534,
			.8712691,
			.65468085,
			.9531036,
			.5438733,
			.9993605,
			.4281436,
			1
		],
		[
			.4281436,
			1,
			.41342032,
			.998486,
			.39869702,
			.9969721,
			.38397372,
			.9954581
		],
		[
			.38397372,
			.9954581,
			.18357389,
			.9748515,
			.025148578,
			.81642616,
			.004541943,
			.61602634
		],
		[
			.004541943,
			.61602634,
			.0030279716,
			.601303,
			.0015140006,
			.5865796,
			0,
			.57185626
		],
		[
			0,
			.57185626,
			.0006394614,
			.45612672,
			.046896663,
			.34531894,
			.12873106,
			.2634846
		],
		[
			.12873106,
			.2634846,
			.17364901,
			.21856667,
			.21856697,
			.17364874,
			.2634849,
			.12873076
		],
		[
			.2634849,
			.12873076,
			.34531933,
			.046896398,
			.4561269,
			.0006393849,
			.57185644,
			0
		],
		[
			.57185644,
			0,
			.58657974,
			.001513966,
			.60130304,
			.003027932,
			.61602634,
			.0045418795
		],
		[
			.61602634,
			.0045418795,
			.7162262,
			.014845201,
			.8059326,
			.059603203,
			.8731647,
			.12683535
		]
	],
	triangle: [
		[
			.49999997,
			.077812634,
			.54375,
			.07781265,
			.5875,
			.0994633,
			.6125,
			.14276457
		],
		[
			.6125,
			.14276457,
			.725,
			.3376203,
			.83750004,
			.532476,
			.95000005,
			.7273317
		],
		[
			.95000005,
			.7273317,
			1,
			.8139343,
			.9375,
			.9221874,
			.8375,
			.9221874
		],
		[
			.8375,
			.9221874,
			.61249995,
			.9221874,
			.38749996,
			.9221874,
			.16249995,
			.9221874
		],
		[
			.16249995,
			.9221874,
			.06249995,
			.9221874,
			0,
			.81393427,
			.04999998,
			.7273317
		],
		[
			.04999998,
			.7273317,
			.16249998,
			.53247595,
			.27499998,
			.33762023,
			.38749996,
			.1427645
		],
		[
			.38749996,
			.1427645,
			.41249996,
			.09946324,
			.45624998,
			.07781262,
			.49999997,
			.077812634
		]
	],
	diamond: [
		[
			.49999994,
			1,
			.4727132,
			1,
			.44542643,
			.99256146,
			.42130372,
			.97768426
		],
		[
			.42130372,
			.97768426,
			.3980278,
			.9633294,
			.37172875,
			.929255,
			.31913075,
			.86110616
		],
		[
			.31913075,
			.86110616,
			.25199988,
			.7741279,
			.184869,
			.68714964,
			.117738135,
			.60017145
		],
		[
			.117738135,
			.60017145,
			.07388129,
			.54334825,
			.07388129,
			.46409053,
			.11773815,
			.4072673
		],
		[
			.11773815,
			.4072673,
			.184869,
			.32028905,
			.25199988,
			.23331082,
			.31913075,
			.14633258
		],
		[
			.31913075,
			.14633258,
			.37172875,
			.0781838,
			.3980278,
			.04410941,
			.42130375,
			.029754452
		],
		[
			.42130375,
			.029754452,
			.46954924,
			0,
			.5304509,
			7.397207e-9,
			.57869637,
			.029754482
		],
		[
			.57869637,
			.029754482,
			.60197216,
			.04410938,
			.62827116,
			.07818378,
			.6808692,
			.14633258
		],
		[
			.6808692,
			.14633258,
			.74800014,
			.23331083,
			.815131,
			.3202891,
			.8822618,
			.40726733
		],
		[
			.8822618,
			.40726733,
			.92611873,
			.4640906,
			.92611873,
			.5433483,
			.8822618,
			.6001715
		],
		[
			.8822618,
			.6001715,
			.8151309,
			.6871497,
			.74800014,
			.77412796,
			.6808692,
			.86110616
		],
		[
			.6808692,
			.86110616,
			.62827116,
			.92925483,
			.60197216,
			.96332926,
			.5786962,
			.97768426
		],
		[
			.5786962,
			.97768426,
			.5545735,
			.99256146,
			.5272867,
			1,
			.49999994,
			1
		]
	],
	clamShell: [
		[
			.18728554,
			.8156485,
			.16357858,
			.8017548,
			.14350897,
			.7816546,
			.12960371,
			.75682896
		],
		[
			.12960371,
			.75682896,
			.09425148,
			.6937132,
			.05889928,
			.6305975,
			.02354707,
			.5674817
		],
		[
			.02354707,
			.5674817,
			57118308e-12,
			.52554417,
			0,
			.47442397,
			.023396147,
			.432434
		],
		[
			.023396147,
			.432434,
			.058490634,
			.3694486,
			.09358512,
			.30646324,
			.1286796,
			.24347785
		],
		[
			.1286796,
			.24347785,
			.15644029,
			.19365472,
			.20900366,
			.16277023,
			.26603875,
			.16277024
		],
		[
			.26603875,
			.16277024,
			.421762,
			.16277024,
			.57748526,
			.16277026,
			.73320854,
			.16277026
		],
		[
			.73320854,
			.16277026,
			.79011786,
			.16277026,
			.84258574,
			.1935198,
			.87039626,
			.24317108
		],
		[
			.87039626,
			.24317108,
			.9057484,
			.3062868,
			.9411007,
			.36940262,
			.97645295,
			.43251833
		],
		[
			.97645295,
			.43251833,
			.99994284,
			.47445592,
			1,
			.5255761,
			.9766038,
			.56756604
		],
		[
			.9766038,
			.56756604,
			.9415093,
			.63055146,
			.90641487,
			.6935369,
			.8713203,
			.75652224
		],
		[
			.8713203,
			.75652224,
			.8435596,
			.80634534,
			.79099625,
			.8372298,
			.73396116,
			.8372298
		],
		[
			.73396116,
			.8372298,
			.57823795,
			.8372297,
			.42251465,
			.8372297,
			.26679143,
			.8372297
		],
		[
			.26679143,
			.8372297,
			.2383368,
			.8372297,
			.21099249,
			.82954234,
			.18728554,
			.8156485
		]
	],
	pentagon: [
		[
			.4999999,
			.04283998,
			.53375417,
			.04283998,
			.56750846,
			.053037085,
			.5964094,
			.0734313
		],
		[
			.5964094,
			.0734313,
			.7037436,
			.14917278,
			.8110778,
			.22491425,
			.9184119,
			.30065572
		],
		[
			.9184119,
			.30065572,
			.97590053,
			.3412231,
			1,
			.4146785,
			.97771674,
			.48141766
		],
		[
			.97771674,
			.48141766,
			.9372636,
			.60257673,
			.89681053,
			.72373587,
			.85635746,
			.844895
		],
		[
			.85635746,
			.844895,
			.8339704,
			.91194516,
			.7712053,
			.95716006,
			.7005165,
			.95716006
		],
		[
			.7005165,
			.95716006,
			.56683874,
			.95716,
			.43316096,
			.95716,
			.29948324,
			.95716006
		],
		[
			.29948324,
			.95716006,
			.22879441,
			.95716006,
			.16602935,
			.9119451,
			.14364237,
			.8448949
		],
		[
			.14364237,
			.8448949,
			.103189275,
			.72373575,
			.0627362,
			.6025766,
			.022283113,
			.48141748
		],
		[
			.022283113,
			.48141748,
			0,
			.4146784,
			.024099478,
			.34122294,
			.08158801,
			.3006556
		],
		[
			.08158801,
			.3006556,
			.18892215,
			.22491416,
			.2962563,
			.14917272,
			.4035904,
			.0734313
		],
		[
			.4035904,
			.0734313,
			.4324913,
			.053037085,
			.46624562,
			.04283998,
			.4999999,
			.04283998
		]
	],
	gem: [
		[
			.4994853,
			.99998444,
			.4913765,
			.99996895,
			.4832684,
			.9995445,
			.47519168,
			.9987113
		],
		[
			.47519168,
			.9987113,
			.4356124,
			.99462795,
			.3976227,
			.97721606,
			.32164326,
			.94239205
		],
		[
			.32164326,
			.94239205,
			.26002494,
			.9141503,
			.19840662,
			.8859086,
			.13678831,
			.8576669
		],
		[
			.13678831,
			.8576669,
			.052739035,
			.8191443,
			.0041653397,
			.7298057,
			.01752848,
			.6383197
		],
		[
			.01752848,
			.6383197,
			.031362873,
			.5436074,
			.045197275,
			.44889516,
			.059031673,
			.35418293
		],
		[
			.059031673,
			.35418293,
			.06799148,
			.29284286,
			.101520166,
			.23778714,
			.15190747,
			.2016762
		],
		[
			.15190747,
			.2016762,
			.22730288,
			.14764284,
			.30269828,
			.09360947,
			.3780937,
			.03957611
		],
		[
			.3780937,
			.03957611,
			.41404003,
			.013814549,
			.4571729,
			0,
			.50139725,
			84575615e-12
		],
		[
			.50139725,
			84575615e-12,
			.5456216,
			.00016916129,
			.58870137,
			.01414858,
			.6245489,
			.040047407
		],
		[
			.6245489,
			.040047407,
			.6997371,
			.094368696,
			.7749252,
			.14868999,
			.8501134,
			.20301129
		],
		[
			.8501134,
			.20301129,
			.9003623,
			.23931468,
			.93368006,
			.29449806,
			.9424052,
			.35587198
		],
		[
			.9424052,
			.35587198,
			.9558773,
			.45063642,
			.9693495,
			.54540086,
			.9828215,
			.64016527
		],
		[
			.9828215,
			.64016527,
			.9958347,
			.73170173,
			.9469198,
			.82085395,
			.8627239,
			.85905486
		],
		[
			.8627239,
			.85905486,
			.800998,
			.88706076,
			.73927206,
			.91506666,
			.67754626,
			.94307256
		],
		[
			.67754626,
			.94307256,
			.6014343,
			.97760564,
			.5633782,
			.9948722,
			.5237836,
			.9988042
		],
		[
			.5237836,
			.9988042,
			.5157038,
			.9996066,
			.50759417,
			1,
			.4994853,
			.99998444
		]
	],
	verySunny: [
		[
			.5000118,
			.9932915,
			.47254747,
			.9932873,
			.44508523,
			.97987604,
			.4290178,
			.95305926
		],
		[
			.4290178,
			.95305926,
			.41710147,
			.93317074,
			.40518516,
			.9132823,
			.39326876,
			.89339364
		],
		[
			.39326876,
			.89339364,
			.3745289,
			.8621165,
			.3375305,
			.8467848,
			.30216053,
			.8556394
		],
		[
			.30216053,
			.8556394,
			.2796342,
			.8612786,
			.25710788,
			.86691785,
			.23458159,
			.87255716
		],
		[
			.23458159,
			.87255716,
			.17392957,
			.88774085,
			.11898567,
			.8327805,
			.13418755,
			.772133
		],
		[
			.13418755,
			.772133,
			.13982475,
			.7496435,
			.14546195,
			.72715414,
			.15109915,
			.70466465
		],
		[
			.15109915,
			.70466465,
			.15996431,
			.66929734,
			.14464365,
			.6322943,
			.11337218,
			.61354506
		],
		[
			.11337218,
			.61354506,
			.09345609,
			.60160404,
			.073540024,
			.58966315,
			.053623952,
			.5777222
		],
		[
			.053623952,
			.5777222,
			0,
			.5455712,
			11638057e-12,
			.46785715,
			.053645235,
			.4357223
		],
		[
			.053645235,
			.4357223,
			.07353379,
			.42380592,
			.09342234,
			.41188958,
			.11331088,
			.39997324
		],
		[
			.11331088,
			.39997324,
			.14458798,
			.3812334,
			.15991972,
			.34423497,
			.15106517,
			.30886498
		],
		[
			.15106517,
			.30886498,
			.1454259,
			.2863387,
			.13978665,
			.26381236,
			.13414738,
			.24128608
		],
		[
			.13414738,
			.24128608,
			.118963696,
			.18063405,
			.1739241,
			.12569015,
			.23457156,
			.14089203
		],
		[
			.23457156,
			.14089203,
			.25706097,
			.14652923,
			.27955043,
			.15216643,
			.30203986,
			.15780361
		],
		[
			.30203986,
			.15780361,
			.3374072,
			.16666879,
			.3744102,
			.15134814,
			.39315948,
			.12007666
		],
		[
			.39315948,
			.12007666,
			.4051004,
			.10016058,
			.41704142,
			.080244504,
			.42898235,
			.060328428
		],
		[
			.42898235,
			.060328428,
			.46113333,
			.0067044497,
			.5388475,
			.0067161093,
			.57098234,
			.060349725
		],
		[
			.57098234,
			.060349725,
			.5828987,
			.08023827,
			.594815,
			.10012682,
			.6067313,
			.12001535
		],
		[
			.6067313,
			.12001535,
			.6254711,
			.15129244,
			.66246957,
			.1666242,
			.6978396,
			.15776965
		],
		[
			.6978396,
			.15776965,
			.7203659,
			.15213038,
			.74289227,
			.14649116,
			.7654186,
			.14085189
		],
		[
			.7654186,
			.14085189,
			.8260706,
			.1256682,
			.8810145,
			.18062861,
			.86581254,
			.24127607
		],
		[
			.86581254,
			.24127607,
			.8601753,
			.2637655,
			.85453814,
			.28625494,
			.8489009,
			.30874437
		],
		[
			.8489009,
			.30874437,
			.84003574,
			.34411174,
			.85535645,
			.38111478,
			.886628,
			.39986402
		],
		[
			.886628,
			.39986402,
			.90654397,
			.4118049,
			.92646,
			.42374587,
			.9463761,
			.43568683
		],
		[
			.9463761,
			.43568683,
			1,
			.46783778,
			.9999884,
			.5455519,
			.94635475,
			.5776867
		],
		[
			.94635475,
			.5776867,
			.9264662,
			.58960307,
			.90657777,
			.60151947,
			.8866892,
			.61343575
		],
		[
			.8866892,
			.61343575,
			.8554121,
			.63217556,
			.8400804,
			.669174,
			.8489349,
			.70454395
		],
		[
			.8489349,
			.70454395,
			.85457414,
			.72707033,
			.8602134,
			.7495967,
			.86585265,
			.77212316
		],
		[
			.86585265,
			.77212316,
			.8810363,
			.8327752,
			.8260759,
			.88771904,
			.7654284,
			.8725171
		],
		[
			.7654284,
			.8725171,
			.74293894,
			.8668799,
			.7204495,
			.86124265,
			.6979601,
			.8556054
		],
		[
			.6979601,
			.8556054,
			.66259277,
			.84674025,
			.6255897,
			.86206096,
			.6068405,
			.8933325
		],
		[
			.6068405,
			.8933325,
			.59489954,
			.9132485,
			.5829587,
			.93316454,
			.57101774,
			.95308053
		],
		[
			.57101774,
			.95308053,
			.55494225,
			.9798925,
			.527476,
			.99329555,
			.5000118,
			.9932915
		]
	],
	sunny: [
		[
			.9969052,
			.5,
			.9969052,
			.5179457,
			.9907156,
			.5358914,
			.9783364,
			.5504177
		],
		[
			.9783364,
			.5504177,
			.9530324,
			.58011043,
			.9277284,
			.6098032,
			.9024245,
			.6394959
		],
		[
			.9024245,
			.6394959,
			.89181495,
			.6519456,
			.88540316,
			.6674249,
			.88410205,
			.6837303
		],
		[
			.88410205,
			.6837303,
			.8809987,
			.72261876,
			.87789536,
			.76150733,
			.87479204,
			.80039585
		],
		[
			.87479204,
			.80039585,
			.87175566,
			.8384459,
			.8415407,
			.86866087,
			.8034906,
			.8716972
		],
		[
			.8034906,
			.8716972,
			.76460207,
			.87480056,
			.7257136,
			.8779039,
			.68682504,
			.8810072
		],
		[
			.68682504,
			.8810072,
			.67051977,
			.8823084,
			.6550404,
			.8887202,
			.64259064,
			.8993297
		],
		[
			.64259064,
			.8993297,
			.6128979,
			.9246337,
			.58320516,
			.94993764,
			.55351245,
			.9752416
		],
		[
			.55351245,
			.9752416,
			.5244599,
			1,
			.48172957,
			1,
			.452677,
			.9752416
		],
		[
			.452677,
			.9752416,
			.4229843,
			.94993764,
			.39329156,
			.9246337,
			.36359888,
			.8993297
		],
		[
			.36359888,
			.8993297,
			.35114917,
			.8887202,
			.33566982,
			.88230836,
			.31936446,
			.8810072
		],
		[
			.31936446,
			.8810072,
			.28047597,
			.8779039,
			.24158747,
			.87480056,
			.20269896,
			.8716972
		],
		[
			.20269896,
			.8716972,
			.16464886,
			.86866087,
			.13443397,
			.83844596,
			.1313975,
			.8003959
		],
		[
			.1313975,
			.8003959,
			.1282942,
			.76150733,
			.12519082,
			.72261876,
			.122087464,
			.68373024
		],
		[
			.122087464,
			.68373024,
			.120786294,
			.66742486,
			.11437453,
			.65194553,
			.103764996,
			.6394958
		],
		[
			.103764996,
			.6394958,
			.07846107,
			.6098031,
			.05315712,
			.5801104,
			.027853196,
			.55041766
		],
		[
			.027853196,
			.55041766,
			.003094779,
			.52136517,
			.003094779,
			.47863477,
			.027853228,
			.44958225
		],
		[
			.027853228,
			.44958225,
			.05315718,
			.41988954,
			.07846113,
			.39019683,
			.103765056,
			.36050412
		],
		[
			.103765056,
			.36050412,
			.11437462,
			.34805444,
			.12078636,
			.33257508,
			.12208756,
			.31626973
		],
		[
			.12208756,
			.31626973,
			.1251909,
			.27738118,
			.12829423,
			.23849264,
			.13139759,
			.1996041
		],
		[
			.13139759,
			.1996041,
			.13443403,
			.16155401,
			.16464892,
			.13133912,
			.20269899,
			.1283027
		],
		[
			.20269899,
			.1283027,
			.24158753,
			.12519936,
			.2804761,
			.122096024,
			.3193646,
			.118992716
		],
		[
			.3193646,
			.118992716,
			.33567,
			.11769155,
			.35114932,
			.111279756,
			.36359903,
			.10067019
		],
		[
			.36359903,
			.10067019,
			.39329174,
			.075366296,
			.42298436,
			.05006234,
			.45267704,
			.024758449
		],
		[
			.45267704,
			.024758449,
			.4817296,
			0,
			.52445996,
			0,
			.5535125,
			.024758417
		],
		[
			.5535125,
			.024758417,
			.5832052,
			.050062403,
			.612898,
			.075366355,
			.6425907,
			.10067031
		],
		[
			.6425907,
			.10067031,
			.65504044,
			.111279845,
			.67051977,
			.11769164,
			.6868251,
			.11899281
		],
		[
			.6868251,
			.11899281,
			.7257137,
			.12209617,
			.7646022,
			.12519951,
			.8034907,
			.12830281
		],
		[
			.8034907,
			.12830281,
			.8415408,
			.13133925,
			.8717558,
			.16155417,
			.87479216,
			.1996043
		],
		[
			.87479216,
			.1996043,
			.8778954,
			.23849279,
			.88099873,
			.27738124,
			.88410205,
			.3162697
		],
		[
			.88410205,
			.3162697,
			.8854032,
			.33257505,
			.89181495,
			.34805444,
			.9024245,
			.36050415
		],
		[
			.9024245,
			.36050415,
			.9277285,
			.39019686,
			.95303243,
			.41988957,
			.9783364,
			.44958228
		],
		[
			.9783364,
			.44958228,
			.9907156,
			.46410856,
			.9969052,
			.4820543,
			.9969052,
			.5
		]
	],
	cookie4Sided: [
		[
			.8713652,
			.8707754,
			.8104821,
			.9317583,
			.71593565,
			.95913297,
			.62197703,
			.91859186
		],
		[
			.62197703,
			.91859186,
			.60837704,
			.9127237,
			.5947771,
			.90685564,
			.5811772,
			.90098757
		],
		[
			.5811772,
			.90098757,
			.5294812,
			.87868184,
			.47086555,
			.8787299,
			.41920617,
			.90112025
		],
		[
			.41920617,
			.90112025,
			.4057553,
			.9069501,
			.39230454,
			.91278,
			.3788537,
			.91861
		],
		[
			.3788537,
			.91861,
			.19106969,
			1,
			.0004888185,
			.80973125,
			.08157111,
			.62181413
		],
		[
			.08157111,
			.62181413,
			.08743921,
			.60821414,
			.09330731,
			.5946142,
			.09917542,
			.5810142
		],
		[
			.09917542,
			.5810142,
			.12148117,
			.52931815,
			.121433124,
			.4707026,
			.09904271,
			.41904324
		],
		[
			.09904271,
			.41904324,
			.09321282,
			.4055924,
			.08738292,
			.39214164,
			.08155305,
			.3786908
		],
		[
			.08155305,
			.3786908,
			.00016295037,
			.1909068,
			.1904318,
			.00032592032,
			.37834895,
			.08140821
		],
		[
			.37834895,
			.08140821,
			.3919489,
			.08727631,
			.40554887,
			.09314441,
			.41914883,
			.09901253
		],
		[
			.41914883,
			.09901253,
			.47084484,
			.12131827,
			.52946043,
			.121270224,
			.5811198,
			.09887981
		],
		[
			.5811198,
			.09887981,
			.5945706,
			.09304991,
			.6080214,
			.08722002,
			.6214721,
			.08139013
		],
		[
			.6214721,
			.08139013,
			.8092561,
			0,
			.99983704,
			.19026883,
			.91875476,
			.378186
		],
		[
			.91875476,
			.378186,
			.9128867,
			.39178592,
			.9070186,
			.4053859,
			.9011505,
			.41898587
		],
		[
			.9011505,
			.41898587,
			.8788447,
			.47068194,
			.8788927,
			.5292974,
			.9012832,
			.5809568
		],
		[
			.9012832,
			.5809568,
			.90711296,
			.5944076,
			.91294295,
			.6078584,
			.9187728,
			.6213092
		],
		[
			.9187728,
			.6213092,
			.9594679,
			.7152012,
			.93224823,
			.8097924,
			.8713652,
			.8707754
		]
	],
	cookie6Sided: [
		[
			.71652484,
			.8728998,
			.6996478,
			.8826239,
			.68395615,
			.8944055,
			.66982883,
			.90802586
		],
		[
			.66982883,
			.90802586,
			.6693294,
			.90850735,
			.66883,
			.90898895,
			.6683305,
			.90947056
		],
		[
			.6683305,
			.90947056,
			.57443243,
			1,
			.42569405,
			.9998689,
			.33195567,
			.90917414
		],
		[
			.33195567,
			.90917414,
			.3037492,
			.88188356,
			.26927224,
			.86193776,
			.23155367,
			.85108906
		],
		[
			.23155367,
			.85108906,
			.23088692,
			.8508973,
			.23022017,
			.85070556,
			.22955342,
			.85051376
		],
		[
			.22955342,
			.85051376,
			.10420353,
			.8144604,
			.029947806,
			.68558365,
			.061622597,
			.5590564
		],
		[
			.061622597,
			.5590564,
			.07115373,
			.5209836,
			.07118882,
			.48115262,
			.061724786,
			.4430631
		],
		[
			.061724786,
			.4430631,
			.06155749,
			.4423898,
			.0613902,
			.4417165,
			.0612229,
			.4410432
		],
		[
			.0612229,
			.4410432,
			.029771078,
			.31446034,
			.10425376,
			.18571465,
			.22966698,
			.14988223
		],
		[
			.22966698,
			.14988223,
			.26740456,
			.13910002,
			.30191663,
			.119215,
			.33017114,
			.091974124
		],
		[
			.33017114,
			.091974124,
			.3306706,
			.09149257,
			.33117005,
			.091011025,
			.3316695,
			.09052947
		],
		[
			.3316695,
			.09052947,
			.42556754,
			0,
			.57430595,
			.00013102757,
			.6680444,
			.09082588
		],
		[
			.6680444,
			.09082588,
			.69625074,
			.11811641,
			.7307279,
			.13806231,
			.7684463,
			.14891095
		],
		[
			.7684463,
			.14891095,
			.7691131,
			.14910275,
			.7697799,
			.14929454,
			.7704467,
			.14948629
		],
		[
			.7704467,
			.14948629,
			.89579654,
			.18553965,
			.9700522,
			.31441635,
			.9383774,
			.44094348
		],
		[
			.9383774,
			.44094348,
			.92884624,
			.4790163,
			.92881125,
			.5188472,
			.9382752,
			.55693674
		],
		[
			.9382752,
			.55693674,
			.93844247,
			.55761003,
			.9386098,
			.5582833,
			.93877715,
			.5589567
		],
		[
			.93877715,
			.5589567,
			.9702289,
			.68553954,
			.8957463,
			.8142852,
			.7703331,
			.85011774
		],
		[
			.7703331,
			.85011774,
			.75146437,
			.8555088,
			.73340195,
			.86317563,
			.71652484,
			.8728998
		]
	],
	cookie7Sided: [
		[
			.5,
			.021824071,
			.54879564,
			.021824071,
			.5975913,
			.040400095,
			.63487387,
			.077552214
		],
		[
			.63487387,
			.077552214,
			.6653732,
			.107944645,
			.70524335,
			.12714514,
			.7480211,
			.13204098
		],
		[
			.7480211,
			.13204098,
			.8526051,
			.14401054,
			.9278088,
			.238313,
			.9162061,
			.34293833
		],
		[
			.9162061,
			.34293833,
			.91146034,
			.38573295,
			.9213075,
			.4288761,
			.9441512,
			.4653736
		],
		[
			.9441512,
			.4653736,
			1,
			.5546035,
			.9731601,
			.67219675,
			.88412666,
			.72835827
		],
		[
			.88412666,
			.72835827,
			.84770954,
			.75132984,
			.8201184,
			.78592795,
			.8058263,
			.8265438
		],
		[
			.8058263,
			.8265438,
			.77088475,
			.92584205,
			.6622122,
			.97817594,
			.56279194,
			.9435829
		],
		[
			.56279194,
			.9435829,
			.5221263,
			.92943335,
			.4778737,
			.9294334,
			.4372081,
			.9435829
		],
		[
			.4372081,
			.9435829,
			.3377878,
			.97817594,
			.22911529,
			.92584205,
			.19417366,
			.8265437
		],
		[
			.19417366,
			.8265437,
			.17988156,
			.78592783,
			.15229054,
			.75132984,
			.115873344,
			.72835827
		],
		[
			.115873344,
			.72835827,
			.026839884,
			.67219675,
			0,
			.5546036,
			.055848908,
			.46537358
		],
		[
			.055848908,
			.46537358,
			.078692615,
			.42887607,
			.088539734,
			.38573295,
			.08379392,
			.34293815
		],
		[
			.08379392,
			.34293815,
			.07219132,
			.23831289,
			.14739504,
			.14401048,
			.2519789,
			.13204098
		],
		[
			.2519789,
			.13204098,
			.29475668,
			.12714511,
			.33462685,
			.10794468,
			.36512613,
			.07755215
		],
		[
			.36512613,
			.07755215,
			.40240872,
			.040400095,
			.45120436,
			.02182407,
			.5,
			.021824071
		]
	],
	cookie9Sided: [
		[
			.5,
			.014150618,
			.53648806,
			.014150613,
			.5729761,
			.027259544,
			.60187346,
			.053477466
		],
		[
			.60187346,
			.053477466,
			.6312687,
			.0801471,
			.6699502,
			.09422602,
			.70961124,
			.09269085
		],
		[
			.70961124,
			.09269085,
			.78758943,
			.08967239,
			.8551222,
			.14633904,
			.86569047,
			.22365679
		],
		[
			.86569047,
			.22365679,
			.87106556,
			.26298183,
			.8916476,
			.29863095,
			.9230165,
			.3229485
		],
		[
			.9230165,
			.3229485,
			.98469156,
			.37075964,
			1,
			.45757806,
			.9583968,
			.5236
		],
		[
			.9583968,
			.5236,
			.9372367,
			.5571798,
			.93008864,
			.5977185,
			.93848765,
			.6365104
		],
		[
			.93848765,
			.6365104,
			.955001,
			.7127798,
			.91092217,
			.78912663,
			.8366141,
			.8129603
		],
		[
			.8366141,
			.8129603,
			.79881984,
			.8250826,
			.7672864,
			.85154223,
			.74878544,
			.88665736
		],
		[
			.74878544,
			.88665736,
			.71241045,
			.9556977,
			.62956923,
			.9858494,
			.557326,
			.9563428
		],
		[
			.557326,
			.9563428,
			.520582,
			.9413353,
			.47941798,
			.9413353,
			.44267377,
			.9563428
		],
		[
			.44267377,
			.9563428,
			.37043056,
			.9858494,
			.28758946,
			.9556977,
			.2512144,
			.88665724
		],
		[
			.2512144,
			.88665724,
			.2327135,
			.8515422,
			.20117998,
			.8250824,
			.16338576,
			.8129602
		],
		[
			.16338576,
			.8129602,
			.08907778,
			.78912663,
			.044998955,
			.7127798,
			.061512407,
			.63651025
		],
		[
			.061512407,
			.63651025,
			.0699114,
			.59771836,
			.06276337,
			.5571798,
			.041603155,
			.5235998
		],
		[
			.041603155,
			.5235998,
			0,
			.4575778,
			.015308507,
			.37075946,
			.0769836,
			.3229483
		],
		[
			.0769836,
			.3229483,
			.10835253,
			.2986308,
			.12893455,
			.26298165,
			.13430968,
			.22365662
		],
		[
			.13430968,
			.22365662,
			.14487787,
			.14633888,
			.21241052,
			.08967229,
			.29038888,
			.09269078
		],
		[
			.29038888,
			.09269078,
			.33004984,
			.09422605,
			.36873144,
			.0801471,
			.39812663,
			.053477436
		],
		[
			.39812663,
			.053477436,
			.4270239,
			.02725956,
			.46351194,
			.014150621,
			.5,
			.014150618
		]
	],
	cookie12Sided: [
		[
			.49999997,
			.005154038,
			.52561283,
			.005154042,
			.55122566,
			.015461998,
			.5700089,
			.036077958
		],
		[
			.5700089,
			.036077958,
			.5949292,
			.063430086,
			.6334968,
			.07376422,
			.66875464,
			.062536836
		],
		[
			.66875464,
			.062536836,
			.72190386,
			.04561209,
			.7780961,
			.07805472,
			.7900135,
			.13254565
		],
		[
			.7900135,
			.13254565,
			.7979192,
			.16869347,
			.8261526,
			.1969269,
			.86230046,
			.20483258
		],
		[
			.86230046,
			.20483258,
			.91679144,
			.21674994,
			.94923407,
			.27294225,
			.93230927,
			.3260914
		],
		[
			.93230927,
			.3260914,
			.92108184,
			.3613492,
			.931416,
			.3999168,
			.9587682,
			.42483723
		],
		[
			.9587682,
			.42483723,
			1,
			.46240345,
			1,
			.5272887,
			.9587681,
			.5648549
		],
		[
			.9587681,
			.5648549,
			.931416,
			.5897754,
			.9210818,
			.6283429,
			.93230927,
			.66360074
		],
		[
			.93230927,
			.66360074,
			.94923395,
			.7167499,
			.9167914,
			.7729422,
			.8623004,
			.78485954
		],
		[
			.8623004,
			.78485954,
			.82615256,
			.7927652,
			.79791915,
			.8209986,
			.7900135,
			.85714656
		],
		[
			.7900135,
			.85714656,
			.77809614,
			.9116374,
			.721904,
			.94408005,
			.66875464,
			.92715526
		],
		[
			.66875464,
			.92715526,
			.6334968,
			.9159278,
			.5949292,
			.926262,
			.5700088,
			.9536142
		],
		[
			.5700088,
			.9536142,
			.53244257,
			.994846,
			.46755737,
			.994846,
			.42999116,
			.9536142
		],
		[
			.42999116,
			.9536142,
			.40507075,
			.9262621,
			.36650315,
			.91592795,
			.33124524,
			.9271553
		],
		[
			.33124524,
			.9271553,
			.27809605,
			.94408005,
			.22190383,
			.9116374,
			.20998645,
			.8571465
		],
		[
			.20998645,
			.8571465,
			.2020808,
			.8209986,
			.17384736,
			.79276514,
			.13769951,
			.7848595
		],
		[
			.13769951,
			.7848595,
			.08320858,
			.7729422,
			.05076599,
			.7167499,
			.06769073,
			.6636007
		],
		[
			.06769073,
			.6636007,
			.07891815,
			.62834287,
			.06858399,
			.5897753,
			.041231856,
			.5648549
		],
		[
			.041231856,
			.5648549,
			3.1924742e-8,
			.5272887,
			0,
			.46240348,
			.04123189,
			.4248373
		],
		[
			.04123189,
			.4248373,
			.06858402,
			.39991683,
			.07891815,
			.36134925,
			.0676907,
			.32609144
		],
		[
			.0676907,
			.32609144,
			.050765958,
			.27294225,
			.08320855,
			.21675003,
			.13769974,
			.20483252
		],
		[
			.13769974,
			.20483252,
			.17384759,
			.19692685,
			.202081,
			.16869342,
			.20998664,
			.13254553
		],
		[
			.20998664,
			.13254553,
			.221904,
			.07805462,
			.27809623,
			.04561206,
			.33124542,
			.06253674
		],
		[
			.33124542,
			.06253674,
			.3665032,
			.07376416,
			.4050708,
			.063430026,
			.42999122,
			.036077894
		],
		[
			.42999122,
			.036077894,
			.44877428,
			.015461982,
			.47438714,
			.005154034,
			.49999997,
			.005154038
		]
	],
	ghostish: [
		[
			.5,
			0,
			.763236,
			0,
			.976631,
			.213395,
			.976631,
			.47663105
		],
		[
			.976631,
			.47663105,
			.976631,
			.57110304,
			.976631,
			.665575,
			.976631,
			.7600471
		],
		[
			.976631,
			.7600471,
			.976631,
			.9069215,
			.81912905,
			.99999976,
			.6904673,
			.92916036
		],
		[
			.6904673,
			.92916036,
			.6685608,
			.9170989,
			.6466543,
			.90503746,
			.6247478,
			.8929759
		],
		[
			.6247478,
			.8929759,
			.58981365,
			.8737416,
			.55058235,
			.8636553,
			.51070315,
			.8636554
		],
		[
			.51070315,
			.8636554,
			.50356764,
			.8636554,
			.49643224,
			.8636554,
			.48929676,
			.8636554
		],
		[
			.48929676,
			.8636554,
			.44941753,
			.8636554,
			.41018623,
			.8737416,
			.37525213,
			.892976
		],
		[
			.37525213,
			.892976,
			.35334563,
			.9050374,
			.33143914,
			.91709894,
			.30953255,
			.92916036
		],
		[
			.30953255,
			.92916036,
			.18087082,
			1,
			.023368964,
			.90692157,
			.023368983,
			.76004714
		],
		[
			.023368983,
			.76004714,
			.023368997,
			.665575,
			.023369016,
			.5711029,
			.023369035,
			.47663087
		],
		[
			.023369035,
			.47663087,
			.023369083,
			.21339487,
			.23676398,
			2.5438656e-8,
			.5,
			0
		]
	],
	clover4Leaf: [
		[
			.5,
			.09812955,
			.5048268,
			.09441828,
			.5096535,
			.09070702,
			.51448035,
			.08699575
		],
		[
			.51448035,
			.08699575,
			.6276252,
			2.1085691e-8,
			.7877427,
			.010415749,
			.8886635,
			.11133653
		],
		[
			.8886635,
			.11133653,
			.9895842,
			.21225737,
			1,
			.37237483,
			.9130042,
			.4855197
		],
		[
			.9130042,
			.4855197,
			.90929294,
			.49034646,
			.9055817,
			.49517325,
			.9018704,
			.5
		],
		[
			.9018704,
			.5,
			.90558165,
			.5048268,
			.90929294,
			.5096535,
			.91300416,
			.51448035
		],
		[
			.91300416,
			.51448035,
			.9999999,
			.62762517,
			.9895842,
			.7877427,
			.8886635,
			.8886635
		],
		[
			.8886635,
			.8886635,
			.7877427,
			.9895843,
			.6276252,
			1,
			.5144803,
			.9130043
		],
		[
			.5144803,
			.9130043,
			.5096535,
			.90929294,
			.5048268,
			.9055818,
			.5,
			.9018704
		],
		[
			.5,
			.9018704,
			.4951732,
			.9055817,
			.4903464,
			.909293,
			.4855196,
			.9130042
		],
		[
			.4855196,
			.9130042,
			.3723747,
			1,
			.2122573,
			.9895842,
			.1113365,
			.8886635
		],
		[
			.1113365,
			.8886635,
			.010415741,
			.7877427,
			2.1085691e-8,
			.6276252,
			.08699573,
			.5144804
		],
		[
			.08699573,
			.5144804,
			.090707004,
			.50965357,
			.09441828,
			.5048268,
			.09812956,
			.5
		],
		[
			.09812956,
			.5,
			.09441827,
			.49517313,
			.090707,
			.49034634,
			.08699573,
			.48551953
		],
		[
			.08699573,
			.48551953,
			0,
			.37237465,
			.010415727,
			.21225728,
			.111336514,
			.111336485
		],
		[
			.111336514,
			.111336485,
			.2122573,
			.010415706,
			.3723747,
			0,
			.48551953,
			.08699571
		],
		[
			.48551953,
			.08699571,
			.49034634,
			.09070699,
			.4951732,
			.09441827,
			.5,
			.09812955
		]
	],
	clover8Leaf: [
		[
			.49999994,
			.07129116,
			.50726324,
			.067434296,
			.5145265,
			.06357744,
			.5217898,
			.059720606
		],
		[
			.5217898,
			.059720606,
			.6321642,
			.0011109513,
			.76829517,
			.061188515,
			.79938567,
			.18222968
		],
		[
			.79938567,
			.18222968,
			.800638,
			.18710548,
			.80189043,
			.19198129,
			.80314285,
			.19685706
		],
		[
			.80314285,
			.19685706,
			.81100595,
			.19926576,
			.8188691,
			.20167448,
			.8267322,
			.20408317
		],
		[
			.8267322,
			.20408317,
			.946222,
			.24068633,
			.9999999,
			.37942675,
			.9363951,
			.48700005
		],
		[
			.9363951,
			.48700005,
			.93383294,
			.49133334,
			.93127084,
			.49566665,
			.9287087,
			.49999994
		],
		[
			.9287087,
			.49999994,
			.9325655,
			.5072632,
			.9364224,
			.5145265,
			.94027925,
			.5217897
		],
		[
			.94027925,
			.5217897,
			.9988889,
			.6321641,
			.93881136,
			.7682951,
			.81777024,
			.79938567
		],
		[
			.81777024,
			.79938567,
			.8128944,
			.800638,
			.8080186,
			.80189043,
			.80314285,
			.80314285
		],
		[
			.80314285,
			.80314285,
			.80073404,
			.81100595,
			.79832536,
			.8188691,
			.7959168,
			.8267322
		],
		[
			.7959168,
			.8267322,
			.75931364,
			.94622207,
			.6205732,
			1,
			.51299983,
			.93639517
		],
		[
			.51299983,
			.93639517,
			.5086665,
			.93383306,
			.5043332,
			.9312709,
			.49999988,
			.9287088
		],
		[
			.49999988,
			.9287088,
			.4927366,
			.9325656,
			.4854733,
			.9364225,
			.47821003,
			.94027925
		],
		[
			.47821003,
			.94027925,
			.36783567,
			.99888897,
			.23170474,
			.93881136,
			.20061418,
			.81777024
		],
		[
			.20061418,
			.81777024,
			.19936179,
			.8128944,
			.19810939,
			.8080186,
			.19685698,
			.8031428
		],
		[
			.19685698,
			.8031428,
			.18899386,
			.80073404,
			.18113074,
			.79832536,
			.17326762,
			.7959167
		],
		[
			.17326762,
			.7959167,
			.053777914,
			.75931346,
			5.5071197e-8,
			.62057304,
			.06360478,
			.5129997
		],
		[
			.06360478,
			.5129997,
			.06616689,
			.50866646,
			.06872901,
			.5043332,
			.071291134,
			.49999994
		],
		[
			.071291134,
			.49999994,
			.06743426,
			.4927366,
			.06357737,
			.4854733,
			.059720494,
			.47820997
		],
		[
			.059720494,
			.47820997,
			.0011108894,
			.36783567,
			.061188404,
			.23170477,
			.18222949,
			.20061418
		],
		[
			.18222949,
			.20061418,
			.18710536,
			.19936179,
			.19198126,
			.19810936,
			.19685712,
			.19685696
		],
		[
			.19685712,
			.19685696,
			.19926582,
			.18899386,
			.20167452,
			.18113074,
			.2040832,
			.17326765
		],
		[
			.2040832,
			.17326765,
			.24068642,
			.053777844,
			.37942687,
			0,
			.48700023,
			.06360485
		],
		[
			.48700023,
			.06360485,
			.49133345,
			.06616695,
			.4956667,
			.06872906,
			.49999994,
			.07129116
		]
	],
	burst: [
		[
			.50000834,
			.0005145101,
			.5020512,
			.00051178806,
			.50409544,
			.0015313908,
			.5052416,
			.003574511
		],
		[
			.5052416,
			.003574511,
			.53311175,
			.053256284,
			.5609821,
			.102938056,
			.58885235,
			.15261984
		],
		[
			.58885235,
			.15261984,
			.5905026,
			.15556169,
			.5942552,
			.15656185,
			.59715074,
			.15483154
		],
		[
			.59715074,
			.15483154,
			.6459112,
			.12569374,
			.6946717,
			.096555926,
			.7434322,
			.06741811
		],
		[
			.7434322,
			.06741811,
			.7474541,
			.06501477,
			.7525542,
			.067950234,
			.7524962,
			.07263514
		],
		[
			.7524962,
			.07263514,
			.75179166,
			.12959595,
			.7510871,
			.18655676,
			.7503826,
			.24351756
		],
		[
			.7503826,
			.24351756,
			.7503409,
			.24689046,
			.7530906,
			.24963288,
			.7564634,
			.24958217
		],
		[
			.7564634,
			.24958217,
			.81326,
			.24872832,
			.87005675,
			.2478745,
			.92685354,
			.24702063
		],
		[
			.92685354,
			.24702063,
			.9315382,
			.24695021,
			.93448734,
			.2520424,
			.9320947,
			.2560707
		],
		[
			.9320947,
			.2560707,
			.90300405,
			.30504793,
			.8739136,
			.3540252,
			.84482306,
			.40300244
		],
		[
			.84482306,
			.40300244,
			.8431005,
			.40590256,
			.8441106,
			.40965247,
			.84705687,
			.41129497
		],
		[
			.84705687,
			.41129497,
			.8966711,
			.43895385,
			.94628555,
			.46661276,
			.99589986,
			.49427167
		],
		[
			.99589986,
			.49427167,
			.99999213,
			.49655303,
			1,
			.50243753,
			.9959138,
			.5047298
		],
		[
			.9959138,
			.5047298,
			.94623196,
			.53260005,
			.89655024,
			.5604704,
			.8468684,
			.58834064
		],
		[
			.8468684,
			.58834064,
			.84392655,
			.5899909,
			.8429264,
			.59374344,
			.8446567,
			.59663904
		],
		[
			.8446567,
			.59663904,
			.8737945,
			.64539945,
			.9029324,
			.69416,
			.93207014,
			.7429205
		],
		[
			.93207014,
			.7429205,
			.9344735,
			.7469424,
			.931538,
			.7520425,
			.9268531,
			.7519845
		],
		[
			.9268531,
			.7519845,
			.86989224,
			.7512799,
			.8129315,
			.7505754,
			.7559707,
			.74987084
		],
		[
			.7559707,
			.74987084,
			.7525978,
			.7498291,
			.7498554,
			.75257885,
			.74990606,
			.75595164
		],
		[
			.74990606,
			.75595164,
			.75075984,
			.8127483,
			.7516138,
			.86954504,
			.75246763,
			.9263418
		],
		[
			.75246763,
			.9263418,
			.752538,
			.9310265,
			.7474459,
			.9339756,
			.74341756,
			.9315829
		],
		[
			.74341756,
			.9315829,
			.6944403,
			.90249234,
			.64546305,
			.8734019,
			.59648585,
			.8443113
		],
		[
			.59648585,
			.8443113,
			.59358567,
			.8425888,
			.5898359,
			.8435989,
			.58819336,
			.8465451
		],
		[
			.58819336,
			.8465451,
			.5605344,
			.8961594,
			.5328755,
			.9457738,
			.50521654,
			.99538815
		],
		[
			.50521654,
			.99538815,
			.5029352,
			.9994804,
			.4970507,
			.9994883,
			.49475843,
			.99540204
		],
		[
			.49475843,
			.99540204,
			.46688813,
			.94572026,
			.4390179,
			.89603853,
			.41114756,
			.8463567
		],
		[
			.41114756,
			.8463567,
			.40949726,
			.84341484,
			.4057447,
			.8424147,
			.40284914,
			.84414494
		],
		[
			.40284914,
			.84414494,
			.3540887,
			.87328273,
			.30532825,
			.9024205,
			.25656784,
			.93155843
		],
		[
			.25656784,
			.93155843,
			.25254592,
			.9339618,
			.2474459,
			.93102634,
			.24750383,
			.92634135
		],
		[
			.24750383,
			.92634135,
			.24820836,
			.86938053,
			.24891289,
			.8124198,
			.24961738,
			.75545895
		],
		[
			.24961738,
			.75545895,
			.24965912,
			.7520861,
			.24690935,
			.74934363,
			.2435366,
			.74939436
		],
		[
			.2435366,
			.74939436,
			.18673988,
			.75024813,
			.12994315,
			.751102,
			.07314644,
			.7519558
		],
		[
			.07314644,
			.7519558,
			.06846169,
			.7520262,
			.065512665,
			.74693406,
			.06790531,
			.74290574
		],
		[
			.06790531,
			.74290574,
			.09699585,
			.6939285,
			.1260864,
			.64495134,
			.15517694,
			.595974
		],
		[
			.15517694,
			.595974,
			.15689951,
			.5930739,
			.15588939,
			.589324,
			.15294313,
			.5876816
		],
		[
			.15294313,
			.5876816,
			.1033288,
			.5600227,
			.05371449,
			.5323638,
			.0041001793,
			.5047049
		],
		[
			.0041001793,
			.5047049,
			7842781e-12,
			.5024235,
			0,
			.49653903,
			.0040862393,
			.49424672
		],
		[
			.0040862393,
			.49424672,
			.053768016,
			.46637642,
			.103449784,
			.4385062,
			.15313156,
			.4106359
		],
		[
			.15313156,
			.4106359,
			.15607344,
			.40898558,
			.15707357,
			.405233,
			.15534328,
			.40233746
		],
		[
			.15534328,
			.40233746,
			.12620546,
			.353577,
			.09706764,
			.3048165,
			.06792982,
			.2560561
		],
		[
			.06792982,
			.2560561,
			.06552648,
			.25203422,
			.06846193,
			.2469342,
			.073146835,
			.24699214
		],
		[
			.073146835,
			.24699214,
			.13010766,
			.24769665,
			.18706849,
			.24840118,
			.2440293,
			.24910568
		],
		[
			.2440293,
			.24910568,
			.24740216,
			.2491474,
			.25014463,
			.24639764,
			.2500939,
			.2430249
		],
		[
			.2500939,
			.2430249,
			.24924009,
			.18622814,
			.24838628,
			.12943141,
			.24753244,
			.07263466
		],
		[
			.24753244,
			.07263466,
			.24746202,
			.06794991,
			.2525542,
			.06500088,
			.2565825,
			.06739352
		],
		[
			.2565825,
			.06739352,
			.30555975,
			.09648407,
			.35453698,
			.12557462,
			.40351424,
			.15466519
		],
		[
			.40351424,
			.15466519,
			.4064144,
			.15638776,
			.4101643,
			.15537763,
			.41180676,
			.15243137
		],
		[
			.41180676,
			.15243137,
			.4394656,
			.10281706,
			.46712446,
			.05320275,
			.49478334,
			.0035884525
		],
		[
			.49478334,
			.0035884525,
			.49592406,
			.0015422789,
			.4979655,
			.0005172321,
			.50000834,
			.0005145101
		]
	],
	softBurst: [
		[
			.18663658,
			.27241567,
			.19362366,
			.26275796,
			.19729336,
			.25070024,
			.19632591,
			.23806655
		],
		[
			.19632591,
			.23806655,
			.19403367,
			.20813267,
			.19174144,
			.1781988,
			.1894492,
			.14826494
		],
		[
			.1894492,
			.14826494,
			.18650752,
			.10985015,
			.22500725,
			.08175997,
			.26069158,
			.09628506
		],
		[
			.26069158,
			.09628506,
			.28865668,
			.10766809,
			.31662178,
			.11905111,
			.3445869,
			.13043413
		],
		[
			.3445869,
			.13043413,
			.3680583,
			.13998803,
			.3949967,
			.13117528,
			.40828314,
			.10959624
		],
		[
			.40828314,
			.10959624,
			.42402336,
			.084031865,
			.4397636,
			.05846751,
			.45550385,
			.032903142
		],
		[
			.45550385,
			.032903142,
			.47570363,
			9586556e-11,
			.52336156,
			0,
			.5436931,
			.03272575
		],
		[
			.5436931,
			.03272575,
			.5596266,
			.058372304,
			.5755601,
			.08401886,
			.59149355,
			.10966539
		],
		[
			.59149355,
			.10966539,
			.6048667,
			.13119082,
			.63184035,
			.13989513,
			.65527314,
			.13024688
		],
		[
			.65527314,
			.13024688,
			.6830335,
			.11881676,
			.71079403,
			.10738664,
			.7385545,
			.09595652
		],
		[
			.7385545,
			.09595652,
			.77418005,
			.08128801,
			.81279254,
			.10922307,
			.8100054,
			.14764938
		],
		[
			.8100054,
			.14764938,
			.8078212,
			.17776333,
			.80563706,
			.20787731,
			.8034528,
			.23799127
		],
		[
			.8034528,
			.23799127,
			.8016196,
			.26326624,
			.81832546,
			.28616285,
			.842954,
			.2921307
		],
		[
			.842954,
			.2921307,
			.8721311,
			.29920074,
			.9013083,
			.30627078,
			.9304855,
			.31334084
		],
		[
			.9304855,
			.31334084,
			.9679292,
			.32241395,
			.9827475,
			.36770973,
			.9579061,
			.397159
		],
		[
			.9579061,
			.397159,
			.93843853,
			.42023784,
			.91897094,
			.44331673,
			.89950335,
			.4663956
		],
		[
			.89950335,
			.4663956,
			.883164,
			.48576593,
			.88322103,
			.51410913,
			.8996381,
			.5334136
		],
		[
			.8996381,
			.5334136,
			.91908723,
			.55628324,
			.9385364,
			.57915294,
			.9579856,
			.6020226
		],
		[
			.9579856,
			.6020226,
			.98294514,
			.6313717,
			.96830916,
			.67672676,
			.93090236,
			.68595034
		],
		[
			.93090236,
			.68595034,
			.90158725,
			.6931788,
			.87227225,
			.7004072,
			.8429572,
			.70763564
		],
		[
			.8429572,
			.70763564,
			.8183528,
			.7137026,
			.80173916,
			.73666626,
			.80367404,
			.76193357
		],
		[
			.80367404,
			.76193357,
			.8059663,
			.79186743,
			.80825853,
			.82180136,
			.8105508,
			.85173523
		],
		[
			.8105508,
			.85173523,
			.81349254,
			.89015,
			.7749928,
			.91824013,
			.7393085,
			.903715
		],
		[
			.7393085,
			.903715,
			.7113433,
			.8923319,
			.68337816,
			.8809489,
			.655413,
			.8695659
		],
		[
			.655413,
			.8695659,
			.63194156,
			.86001205,
			.6050031,
			.86882484,
			.5917167,
			.8904039
		],
		[
			.5917167,
			.8904039,
			.5759765,
			.9159681,
			.5602363,
			.9415325,
			.544496,
			.9670968
		],
		[
			.544496,
			.9670968,
			.5242962,
			.99990416,
			.47663832,
			1,
			.45630676,
			.9672742
		],
		[
			.45630676,
			.9672742,
			.44037333,
			.9416277,
			.42443994,
			.9159813,
			.4085065,
			.8903348
		],
		[
			.4085065,
			.8903348,
			.39513338,
			.86880934,
			.3681597,
			.860105,
			.34472692,
			.86975324
		],
		[
			.34472692,
			.86975324,
			.31696644,
			.8811833,
			.289206,
			.8926134,
			.26144555,
			.9040437
		],
		[
			.26144555,
			.9040437,
			.22581996,
			.9187122,
			.18720755,
			.8907771,
			.18999465,
			.8523508
		],
		[
			.18999465,
			.8523508,
			.19217883,
			.82223666,
			.19436304,
			.7921227,
			.19654724,
			.7620087
		],
		[
			.19654724,
			.7620087,
			.19838046,
			.7367339,
			.1816746,
			.71383715,
			.157046,
			.70786935
		],
		[
			.157046,
			.70786935,
			.12786885,
			.7007993,
			.098691724,
			.6937292,
			.06951458,
			.6866593
		],
		[
			.06951458,
			.6866593,
			.03207089,
			.6775862,
			.017252645,
			.63229036,
			.042093914,
			.602841
		],
		[
			.042093914,
			.602841,
			.06156149,
			.5797622,
			.08102907,
			.55668336,
			.10049666,
			.5336046
		],
		[
			.10049666,
			.5336046,
			.116836004,
			.51423424,
			.11677899,
			.485891,
			.100361854,
			.4665866
		],
		[
			.100361854,
			.4665866,
			.0809127,
			.4437169,
			.06146356,
			.42084724,
			.04201442,
			.3979776
		],
		[
			.04201442,
			.3979776,
			.0170549,
			.36862844,
			.03169083,
			.32327345,
			.06909768,
			.31404978
		],
		[
			.06909768,
			.31404978,
			.09841272,
			.30682132,
			.12772776,
			.2995929,
			.1570428,
			.29236445
		],
		[
			.1570428,
			.29236445,
			.16934499,
			.28933102,
			.17964949,
			.28207338,
			.18663658,
			.27241567
		]
	],
	boom: [
		[
			.4541391,
			.2874297,
			.45683354,
			.28685427,
			.45920122,
			.2847487,
			.45960853,
			.28146183
		],
		[
			.45960853,
			.28146183,
			.4707847,
			.19127269,
			.4819609,
			.10108354,
			.49313703,
			.010894388
		],
		[
			.49313703,
			.010894388,
			.49414754,
			.0027398954,
			.5059636,
			.0027286115,
			.5069897,
			.010881159
		],
		[
			.5069897,
			.010881159,
			.5183478,
			.1011252,
			.5297059,
			.19136924,
			.541064,
			.28161326
		],
		[
			.541064,
			.28161326,
			.54189116,
			.28818542,
			.5505508,
			.2900174,
			.5539687,
			.28434336
		],
		[
			.5539687,
			.28434336,
			.6008619,
			.20649722,
			.6477551,
			.1286511,
			.69464827,
			.050805
		],
		[
			.69464827,
			.050805,
			.6988881,
			.043766446,
			.70968735,
			.048562206,
			.7073087,
			.05642731
		],
		[
			.7073087,
			.05642731,
			.6809793,
			.1434891,
			.6546499,
			.23055086,
			.6283205,
			.31761262
		],
		[
			.6283205,
			.31761262,
			.62640303,
			.323953,
			.6335688,
			.3291488,
			.6389991,
			.3253555
		],
		[
			.6389991,
			.3253555,
			.7135009,
			.2733127,
			.7880029,
			.2212699,
			.86250484,
			.16922714
		],
		[
			.86250484,
			.16922714,
			.869241,
			.1645216,
			.87715596,
			.1732952,
			.8717839,
			.17951286
		],
		[
			.8717839,
			.17951286,
			.8123195,
			.2483386,
			.7528552,
			.31716433,
			.69339085,
			.38599005
		],
		[
			.69339085,
			.38599005,
			.68906033,
			.39100245,
			.6934933,
			.39866358,
			.699997,
			.3974069
		],
		[
			.699997,
			.3974069,
			.7892256,
			.38016608,
			.87845415,
			.3629253,
			.9676828,
			.3456845
		],
		[
			.9676828,
			.3456845,
			.9757504,
			.34412563,
			.97941256,
			.35535997,
			.9719761,
			.35885513
		],
		[
			.9719761,
			.35885513,
			.88965875,
			.3975442,
			.80734146,
			.43623337,
			.7250241,
			.47492248
		],
		[
			.7250241,
			.47492248,
			.71902925,
			.4777401,
			.7199629,
			.4865419,
			.7264154,
			.48803926
		],
		[
			.7264154,
			.48803926,
			.81494224,
			.5085815,
			.903469,
			.5291238,
			.9919958,
			.54966617
		],
		[
			.9919958,
			.54966617,
			1,
			.55152345,
			.9987762,
			.5632761,
			.990561,
			.5634444
		],
		[
			.990561,
			.5634444,
			.8996241,
			.5653072,
			.80868727,
			.56716996,
			.71775043,
			.56903267
		],
		[
			.71775043,
			.56903267,
			.71112776,
			.5691683,
			.7084006,
			.5775891,
			.7136864,
			.58158135
		],
		[
			.7136864,
			.58158135,
			.7862044,
			.6363548,
			.8587224,
			.6911282,
			.9312404,
			.74590164
		],
		[
			.9312404,
			.74590164,
			.93779707,
			.7508541,
			.9318988,
			.7610927,
			.9243254,
			.75790507
		],
		[
			.9243254,
			.75790507,
			.8404928,
			.7226194,
			.75666016,
			.68733376,
			.6728275,
			.6520482
		],
		[
			.6728275,
			.6520482,
			.66672224,
			.6494785,
			.6608059,
			.6560619,
			.6640108,
			.661859
		],
		[
			.6640108,
			.661859,
			.7079809,
			.7413926,
			.7519511,
			.8209263,
			.79592115,
			.90046
		],
		[
			.79592115,
			.90046,
			.7998968,
			.9076511,
			.7903439,
			.9146057,
			.7847218,
			.9086132
		],
		[
			.7847218,
			.9086132,
			.7224888,
			.8422804,
			.6602559,
			.7759476,
			.59802294,
			.7096148
		],
		[
			.59802294,
			.7096148,
			.5934907,
			.70478404,
			.5854082,
			.7083918,
			.5859781,
			.7149912
		],
		[
			.5859781,
			.7149912,
			.59379745,
			.8055332,
			.6016169,
			.8960752,
			.60943633,
			.9866172
		],
		[
			.60943633,
			.9866172,
			.61014336,
			.9948036,
			.59858775,
			.9972714,
			.5958891,
			.9895103
		],
		[
			.5958891,
			.9895103,
			.5660164,
			.90359974,
			.5361437,
			.81768924,
			.506271,
			.73177874
		],
		[
			.506271,
			.73177874,
			.5040955,
			.7255222,
			.4952443,
			.7255306,
			.49308074,
			.7317913
		],
		[
			.49308074,
			.7317913,
			.46339735,
			.8176859,
			.433714,
			.9035806,
			.40403068,
			.98947513
		],
		[
			.40403068,
			.98947513,
			.40134686,
			.9972413,
			.3897866,
			.99479574,
			.3904779,
			.98660797
		],
		[
			.3904779,
			.98660797,
			.39813083,
			.8959745,
			.40578377,
			.80534106,
			.41343668,
			.7147077
		],
		[
			.41343668,
			.7147077,
			.41399407,
			.7081071,
			.4059046,
			.70451474,
			.4013816,
			.70935416
		],
		[
			.4013816,
			.70935416,
			.339328,
			.7757495,
			.2772744,
			.8421449,
			.21522087,
			.9085402
		],
		[
			.21522087,
			.9085402,
			.20961027,
			.9145434,
			.20004416,
			.9076072,
			.20400599,
			.9004085
		],
		[
			.20400599,
			.9004085,
			.24786124,
			.8207234,
			.2917165,
			.7410384,
			.33557174,
			.6613534
		],
		[
			.33557174,
			.6613534,
			.33876556,
			.6555502,
			.33283666,
			.64897805,
			.32673633,
			.6515595
		],
		[
			.32673633,
			.6515595,
			.24304214,
			.6869752,
			.15934794,
			.72239095,
			.07565376,
			.75780666
		],
		[
			.07565376,
			.75780666,
			.06808649,
			.76100874,
			.062168647,
			.75078124,
			.068715945,
			.7458164
		],
		[
			.068715945,
			.7458164,
			.14119056,
			.690858,
			.21366514,
			.6358996,
			.2861397,
			.58094126
		],
		[
			.2861397,
			.58094126,
			.2914178,
			.5769388,
			.2886746,
			.5685234,
			.2820517,
			.5684004
		],
		[
			.2820517,
			.5684004,
			.1911884,
			.56671274,
			.100325085,
			.5650251,
			.009461787,
			.56333745
		],
		[
			.009461787,
			.56333745,
			.0012463524,
			.5631849,
			0,
			.5514347,
			.008000619,
			.54956204
		],
		[
			.008000619,
			.54956204,
			.096563034,
			.52883303,
			.18512546,
			.5081042,
			.27368787,
			.48737526
		],
		[
			.27368787,
			.48737526,
			.28013754,
			.48586565,
			.28105438,
			.47706205,
			.27505413,
			.4742559
		],
		[
			.27505413,
			.4742559,
			.19273275,
			.4357567,
			.11041142,
			.39725757,
			.02809007,
			.3587584
		],
		[
			.02809007,
			.3587584,
			.020646961,
			.35527748,
			.024287617,
			.3440362,
			.03235822,
			.34557956
		],
		[
			.03235822,
			.34557956,
			.121695235,
			.36266434,
			.21103224,
			.37974912,
			.30036926,
			.39683387
		],
		[
			.30036926,
			.39683387,
			.30687535,
			.3980781,
			.31129366,
			.39040846,
			.3069535,
			.3854044
		],
		[
			.3069535,
			.3854044,
			.24740824,
			.31675056,
			.18786298,
			.24809676,
			.12831773,
			.17944293
		],
		[
			.12831773,
			.17944293,
			.12293388,
			.17323555,
			.13083206,
			.16444688,
			.13757718,
			.16913947
		],
		[
			.13757718,
			.16913947,
			.21224159,
			.22108382,
			.28690597,
			.27302817,
			.3615704,
			.32497248
		],
		[
			.3615704,
			.32497248,
			.36700794,
			.32875544,
			.37416378,
			.32354593,
			.3722342,
			.3172092
		],
		[
			.3722342,
			.3172092,
			.34576094,
			.23027158,
			.31928766,
			.14333394,
			.2928144,
			.0563963
		],
		[
			.2928144,
			.0563963,
			.29042083,
			.048535805,
			.3012108,
			.043719426,
			.30546412,
			.050749805
		],
		[
			.30546412,
			.050749805,
			.35254577,
			.12857206,
			.39962742,
			.20639434,
			.44670907,
			.2842166
		],
		[
			.44670907,
			.2842166,
			.44842345,
			.28705037,
			.45144466,
			.2880051,
			.4541391,
			.2874297
		]
	],
	softBoom: [
		[
			.7339415,
			.45381412,
			.7536878,
			.45064723,
			.7734341,
			.44748044,
			.79318035,
			.4443136
		],
		[
			.79318035,
			.4443136,
			.82449913,
			.43929076,
			.8563485,
			.43848857,
			.88788044,
			.44192842
		],
		[
			.88788044,
			.44192842,
			.8996054,
			.4432075,
			.91133034,
			.4444866,
			.9230553,
			.4457656
		],
		[
			.9230553,
			.4457656,
			.94135004,
			.4477614,
			.9590074,
			.45364285,
			.9748449,
			.46301606
		],
		[
			.9748449,
			.46301606,
			.9766924,
			.46410945,
			.9785399,
			.4652029,
			.9803874,
			.46629632
		],
		[
			.9803874,
			.46629632,
			.9925489,
			.47349393,
			1,
			.48658374,
			.9999798,
			.50071555
		],
		[
			.9999798,
			.50071555,
			.9999595,
			.5148474,
			.99247104,
			.52791584,
			.9802889,
			.5350787
		],
		[
			.9802889,
			.5350787,
			.97843826,
			.5361668,
			.97658765,
			.5372549,
			.97473705,
			.538343
		],
		[
			.97473705,
			.538343,
			.9588728,
			.54767084,
			.9411988,
			.5535017,
			.92289835,
			.5554451
		],
		[
			.92289835,
			.5554451,
			.91116977,
			.5566906,
			.89944124,
			.55793613,
			.88771266,
			.55918163
		],
		[
			.88771266,
			.55918163,
			.856171,
			.5625312,
			.82432413,
			.5616379,
			.79301983,
			.55652547
		],
		[
			.79301983,
			.55652547,
			.7732827,
			.55330205,
			.7535455,
			.5500787,
			.73380834,
			.54685533
		],
		[
			.73380834,
			.54685533,
			.7532634,
			.551486,
			.7727185,
			.5561169,
			.7921736,
			.56074774
		],
		[
			.7921736,
			.56074774,
			.8230306,
			.56809247,
			.8527626,
			.5795396,
			.8805779,
			.5947843
		],
		[
			.8805779,
			.5947843,
			.8909209,
			.60045296,
			.90126383,
			.60612166,
			.91160685,
			.6117903
		],
		[
			.91160685,
			.6117903,
			.9277453,
			.6206354,
			.9418076,
			.6328261,
			.95285267,
			.6475466
		],
		[
			.95285267,
			.6475466,
			.9541411,
			.64926374,
			.95542955,
			.65098095,
			.95671797,
			.6526981
		],
		[
			.95671797,
			.6526981,
			.9651993,
			.6640019,
			.9670739,
			.67894673,
			.9616472,
			.6919951
		],
		[
			.9616472,
			.6919951,
			.95622057,
			.70504344,
			.94430095,
			.7142514,
			.9303051,
			.7162071
		],
		[
			.9303051,
			.7162071,
			.9281789,
			.71650416,
			.9260528,
			.7168013,
			.9239266,
			.7170983
		],
		[
			.9239266,
			.7170983,
			.90570045,
			.7196451,
			.88714015,
			.71826845,
			.86948913,
			.71306074
		],
		[
			.86948913,
			.71306074,
			.8581767,
			.7097231,
			.84686434,
			.70638555,
			.8355519,
			.7030479
		],
		[
			.8355519,
			.7030479,
			.8051294,
			.694072,
			.7760485,
			.68105936,
			.7490836,
			.6643565
		],
		[
			.7490836,
			.6643565,
			.73208237,
			.65382546,
			.71508116,
			.6432944,
			.69808,
			.63276327
		],
		[
			.69808,
			.63276327,
			.714282,
			.64448667,
			.73048407,
			.6562102,
			.7466861,
			.6679335
		],
		[
			.7466861,
			.6679335,
			.77238345,
			.6865276,
			.79547167,
			.7084814,
			.81533575,
			.73321015
		],
		[
			.81533575,
			.73321015,
			.8227221,
			.74240535,
			.8301084,
			.7516006,
			.83749473,
			.7607958
		],
		[
			.83749473,
			.7607958,
			.8490199,
			.7751433,
			.8573468,
			.7917879,
			.8619176,
			.8096145
		],
		[
			.8619176,
			.8096145,
			.8624508,
			.81169397,
			.862984,
			.8137736,
			.8635173,
			.81585306
		],
		[
			.8635173,
			.81585306,
			.8670273,
			.82954204,
			.8630401,
			.84406674,
			.8530331,
			.85404515
		],
		[
			.8530331,
			.85404515,
			.8430261,
			.86402357,
			.8284901,
			.86796916,
			.8148112,
			.86441994
		],
		[
			.8148112,
			.86441994,
			.8127332,
			.86388075,
			.81065524,
			.8633417,
			.80857724,
			.86280245
		],
		[
			.80857724,
			.86280245,
			.79076374,
			.8581805,
			.7741432,
			.849806,
			.7598286,
			.83823985
		],
		[
			.7598286,
			.83823985,
			.7506545,
			.8308271,
			.7414804,
			.82341456,
			.73230636,
			.81600183
		],
		[
			.73230636,
			.81600183,
			.7076352,
			.79606754,
			.68574685,
			.7729157,
			.66722685,
			.7471659
		],
		[
			.66722685,
			.7471659,
			.6555498,
			.7309304,
			.6438728,
			.7146948,
			.6321957,
			.6984592
		],
		[
			.6321957,
			.6984592,
			.6426781,
			.71549046,
			.65316045,
			.7325218,
			.6636428,
			.749553
		],
		[
			.6636428,
			.749553,
			.68026865,
			.77656585,
			.6931978,
			.8056835,
			.70208657,
			.8361318
		],
		[
			.70208657,
			.8361318,
			.70539176,
			.8474537,
			.708697,
			.85877556,
			.7120023,
			.8700975
		],
		[
			.7120023,
			.8700975,
			.7171595,
			.8877635,
			.7184829,
			.9063275,
			.715884,
			.92454636
		],
		[
			.715884,
			.92454636,
			.7155807,
			.9266717,
			.7152776,
			.92879695,
			.71497446,
			.93092227
		],
		[
			.71497446,
			.93092227,
			.7129787,
			.94491243,
			.70373666,
			.9568056,
			.6906729,
			.9621949
		],
		[
			.6906729,
			.9621949,
			.677609,
			.96758425,
			.6626696,
			.96566683,
			.65139014,
			.95715314
		],
		[
			.65139014,
			.95715314,
			.64967656,
			.9558597,
			.6479631,
			.9545664,
			.6462496,
			.95327306
		],
		[
			.6462496,
			.95327306,
			.6315608,
			.942186,
			.6194104,
			.9280887,
			.6106116,
			.9119251
		],
		[
			.6106116,
			.9119251,
			.60497254,
			.90156597,
			.5993335,
			.89120686,
			.59369445,
			.88084775
		],
		[
			.59369445,
			.88084775,
			.5785292,
			.85298854,
			.5671675,
			.8232245,
			.5599111,
			.7923463
		],
		[
			.5599111,
			.7923463,
			.555336,
			.772878,
			.5507609,
			.7534098,
			.5461859,
			.7339415
		],
		[
			.5461859,
			.7339415,
			.5493527,
			.75368786,
			.5525196,
			.7734342,
			.5556865,
			.7931805
		],
		[
			.5556865,
			.7931805,
			.5607091,
			.8244984,
			.5615113,
			.85634923,
			.5580716,
			.88788027
		],
		[
			.5580716,
			.88788027,
			.55679256,
			.8996052,
			.5555134,
			.9113302,
			.5542344,
			.92305523
		],
		[
			.5542344,
			.92305523,
			.5522386,
			.9413501,
			.5463571,
			.9590074,
			.53698385,
			.97484493
		],
		[
			.53698385,
			.97484493,
			.5358904,
			.9766924,
			.5347971,
			.97853994,
			.5337037,
			.9803874
		],
		[
			.5337037,
			.9803874,
			.52650607,
			.9925489,
			.51341623,
			1,
			.49928442,
			.9999798
		],
		[
			.49928442,
			.9999798,
			.4851526,
			.9999595,
			.47208408,
			.99247104,
			.4649213,
			.9802889
		],
		[
			.4649213,
			.9802889,
			.46383315,
			.97843826,
			.46274504,
			.97658765,
			.46165693,
			.97473705
		],
		[
			.46165693,
			.97473705,
			.4523291,
			.9588728,
			.4464983,
			.9411989,
			.44455487,
			.9228984
		],
		[
			.44455487,
			.9228984,
			.44330934,
			.9111699,
			.44206387,
			.8994414,
			.44081837,
			.8877129
		],
		[
			.44081837,
			.8877129,
			.43746883,
			.85617155,
			.43836212,
			.8243236,
			.44347456,
			.79301965
		],
		[
			.44347456,
			.79301965,
			.4466979,
			.7732826,
			.44992128,
			.75354546,
			.45314464,
			.73380834
		],
		[
			.45314464,
			.73380834,
			.44851387,
			.7532634,
			.44388312,
			.7727184,
			.4392523,
			.7921735
		],
		[
			.4392523,
			.7921735,
			.43190762,
			.8230304,
			.42046037,
			.8527627,
			.40521565,
			.880578
		],
		[
			.40521565,
			.880578,
			.39954695,
			.8909209,
			.3938783,
			.90126383,
			.38820967,
			.9116068
		],
		[
			.38820967,
			.9116068,
			.37936473,
			.9277451,
			.36717385,
			.9418077,
			.3524535,
			.9528526
		],
		[
			.3524535,
			.9528526,
			.3507363,
			.954141,
			.34901908,
			.9554295,
			.3473019,
			.9567179
		],
		[
			.3473019,
			.9567179,
			.33599815,
			.96519923,
			.3210532,
			.967074,
			.30800486,
			.9616472
		],
		[
			.30800486,
			.9616472,
			.2949565,
			.9562205,
			.28574854,
			.9443009,
			.2837929,
			.93030506
		],
		[
			.2837929,
			.93030506,
			.28349578,
			.92817885,
			.2831987,
			.9260528,
			.2829016,
			.9239266
		],
		[
			.2829016,
			.9239266,
			.2803548,
			.90570045,
			.2817314,
			.88714015,
			.28693917,
			.86948913
		],
		[
			.28693917,
			.86948913,
			.29027677,
			.8581767,
			.2936144,
			.84686434,
			.29695204,
			.835552
		],
		[
			.29695204,
			.835552,
			.30592796,
			.8051293,
			.31894046,
			.77604866,
			.3356435,
			.7490836
		],
		[
			.3356435,
			.7490836,
			.34617457,
			.73208237,
			.35670564,
			.71508116,
			.36723673,
			.69808
		],
		[
			.36723673,
			.69808,
			.35551333,
			.714282,
			.34378994,
			.730484,
			.33206654,
			.746686
		],
		[
			.33206654,
			.746686,
			.31347248,
			.77238333,
			.29151845,
			.7954718,
			.26678964,
			.81533587
		],
		[
			.26678964,
			.81533587,
			.25759444,
			.82272214,
			.24839923,
			.83010846,
			.23920402,
			.83749473
		],
		[
			.23920402,
			.83749473,
			.2248565,
			.8490198,
			.20821217,
			.85734665,
			.19038565,
			.86191756
		],
		[
			.19038565,
			.86191756,
			.18830608,
			.8624508,
			.18622655,
			.862984,
			.18414699,
			.8635172
		],
		[
			.18414699,
			.8635172,
			.17045799,
			.8670273,
			.15593328,
			.86304003,
			.14595488,
			.853033
		],
		[
			.14595488,
			.853033,
			.13597654,
			.8430261,
			.13203093,
			.8284901,
			.1355801,
			.8148113
		],
		[
			.1355801,
			.8148113,
			.13611925,
			.81273323,
			.1366584,
			.8106553,
			.13719755,
			.8085773
		],
		[
			.13719755,
			.8085773,
			.14181949,
			.7907638,
			.15019402,
			.77414316,
			.16176017,
			.75982857
		],
		[
			.16176017,
			.75982857,
			.16917282,
			.7506545,
			.1765855,
			.7414804,
			.18399814,
			.73230636
		],
		[
			.18399814,
			.73230636,
			.20393234,
			.7076353,
			.22708431,
			.6857467,
			.25283402,
			.66722685
		],
		[
			.25283402,
			.66722685,
			.26906958,
			.6555498,
			.28530517,
			.6438728,
			.30154076,
			.6321957
		],
		[
			.30154076,
			.6321957,
			.28450954,
			.642678,
			.26747835,
			.6531604,
			.25044712,
			.6636427
		],
		[
			.25044712,
			.6636427,
			.22343464,
			.6802683,
			.19431588,
			.69319797,
			.16386795,
			.7020866
		],
		[
			.16386795,
			.7020866,
			.15254606,
			.70539176,
			.14122419,
			.7086971,
			.1299023,
			.7120022
		],
		[
			.1299023,
			.7120022,
			.11223643,
			.7171594,
			.09367255,
			.7184828,
			.07545373,
			.715884
		],
		[
			.07545373,
			.715884,
			.07332841,
			.7155807,
			.07120309,
			.7152776,
			.069077775,
			.71497446
		],
		[
			.069077775,
			.71497446,
			.055087604,
			.7129787,
			.043194428,
			.7037367,
			.03780509,
			.69067293
		],
		[
			.03780509,
			.69067293,
			.03241576,
			.67760915,
			.034333166,
			.6626697,
			.04284684,
			.65139025
		],
		[
			.04284684,
			.65139025,
			.044140186,
			.6496767,
			.045433536,
			.6479633,
			.04672686,
			.6462498
		],
		[
			.04672686,
			.6462498,
			.057813946,
			.6315609,
			.07191122,
			.6194104,
			.08807496,
			.6106116
		],
		[
			.08807496,
			.6106116,
			.09843405,
			.6049726,
			.108793154,
			.5993336,
			.11915222,
			.5936945
		],
		[
			.11915222,
			.5936945,
			.1470107,
			.5785296,
			.17677638,
			.5671673,
			.2076538,
			.5599111
		],
		[
			.2076538,
			.5599111,
			.22712202,
			.555336,
			.24659027,
			.5507609,
			.2660585,
			.5461859
		],
		[
			.2660585,
			.5461859,
			.24631226,
			.5493527,
			.22656603,
			.55251956,
			.2068198,
			.5556865
		],
		[
			.2068198,
			.5556865,
			.17550133,
			.56070924,
			.14365095,
			.5615114,
			.11211934,
			.55807155
		],
		[
			.11211934,
			.55807155,
			.10039443,
			.5567925,
			.08866952,
			.5555134,
			.07694463,
			.5542343
		],
		[
			.07694463,
			.5542343,
			.058649834,
			.5522385,
			.0409926,
			.5463571,
			.025155108,
			.5369839
		],
		[
			.025155108,
			.5369839,
			.023307608,
			.53589046,
			.02146011,
			.53479713,
			.019612623,
			.5337037
		],
		[
			.019612623,
			.5337037,
			.0074510965,
			.52650607,
			0,
			.5134162,
			20223804e-12,
			.49928436
		],
		[
			20223804e-12,
			.49928436,
			40451352e-12,
			.48515257,
			.007528986,
			.4720841,
			.01971104,
			.46492133
		],
		[
			.01971104,
			.46492133,
			.021561641,
			.46383318,
			.023412248,
			.4627451,
			.025262855,
			.461657
		],
		[
			.025262855,
			.461657,
			.041127168,
			.4523291,
			.058801234,
			.44649827,
			.077101745,
			.44455487
		],
		[
			.077101745,
			.44455487,
			.088830374,
			.44330934,
			.10055902,
			.44206387,
			.112287655,
			.4408183
		],
		[
			.112287655,
			.4408183,
			.1438287,
			.43746886,
			.1756762,
			.43836215,
			.20697987,
			.44347456
		],
		[
			.20697987,
			.44347456,
			.22671713,
			.4466979,
			.24645439,
			.44992125,
			.26619166,
			.4531446
		],
		[
			.26619166,
			.4531446,
			.24673645,
			.44851378,
			.22728127,
			.443883,
			.2078261,
			.43925214
		],
		[
			.2078261,
			.43925214,
			.17696987,
			.4319076,
			.14723709,
			.4204602,
			.11942238,
			.4052158
		],
		[
			.11942238,
			.4052158,
			.10907935,
			.3995471,
			.09873633,
			.39387843,
			.08839332,
			.3882097
		],
		[
			.08839332,
			.3882097,
			.072254814,
			.3793647,
			.058192354,
			.3671739,
			.047147345,
			.3524534
		],
		[
			.047147345,
			.3524534,
			.045858927,
			.35073623,
			.044570513,
			.34901908,
			.043282107,
			.3473019
		],
		[
			.043282107,
			.3473019,
			.03480073,
			.33599815,
			.03292608,
			.32105327,
			.038352773,
			.30800492
		],
		[
			.038352773,
			.30800492,
			.043779463,
			.29495656,
			.05569906,
			.28574863,
			.0696949,
			.28379294
		],
		[
			.0696949,
			.28379294,
			.071821034,
			.28349584,
			.07394718,
			.28319877,
			.07607332,
			.28290164
		],
		[
			.07607332,
			.28290164,
			.094299585,
			.28035483,
			.11285973,
			.28173146,
			.13051085,
			.28693923
		],
		[
			.13051085,
			.28693923,
			.14182332,
			.29027686,
			.15313578,
			.2936145,
			.16444825,
			.29695213
		],
		[
			.16444825,
			.29695213,
			.19487005,
			.3059278,
			.22395188,
			.31894082,
			.2509162,
			.33564335
		],
		[
			.2509162,
			.33564335,
			.26791748,
			.34617445,
			.2849188,
			.35670555,
			.30192006,
			.36723664
		],
		[
			.30192006,
			.36723664,
			.28571793,
			.35551316,
			.2695158,
			.34378967,
			.25331366,
			.3320662
		],
		[
			.25331366,
			.3320662,
			.22761713,
			.31347278,
			.20452796,
			.29151806,
			.18466447,
			.2667901
		],
		[
			.18466447,
			.2667901,
			.1772781,
			.25759485,
			.16989173,
			.2483996,
			.16250536,
			.23920433
		],
		[
			.16250536,
			.23920433,
			.15098014,
			.22485664,
			.1426533,
			.20821218,
			.13808234,
			.19038542
		],
		[
			.13808234,
			.19038542,
			.13754913,
			.18830588,
			.13701594,
			.18622638,
			.13648272,
			.18414687
		],
		[
			.13648272,
			.18414687,
			.13297275,
			.17045791,
			.13695998,
			.15593328,
			.14696698,
			.14595489
		],
		[
			.14696698,
			.14595489,
			.15697397,
			.13597652,
			.17150997,
			.1320309,
			.18518883,
			.13558006
		],
		[
			.18518883,
			.13558006,
			.18726683,
			.13611922,
			.18934482,
			.13665839,
			.1914228,
			.13719754
		],
		[
			.1914228,
			.13719754,
			.20923631,
			.1418195,
			.22585683,
			.15019396,
			.2401714,
			.16176012
		],
		[
			.2401714,
			.16176012,
			.2493455,
			.1691728,
			.25851962,
			.17658547,
			.2676937,
			.18399815
		],
		[
			.2676937,
			.18399815,
			.29236495,
			.20393252,
			.3142531,
			.22708406,
			.33277315,
			.25283396
		],
		[
			.33277315,
			.25283396,
			.3444502,
			.26906952,
			.3561273,
			.28530514,
			.36780435,
			.3015407
		],
		[
			.36780435,
			.3015407,
			.35732192,
			.28450933,
			.34683952,
			.26747796,
			.3363571,
			.25044662
		],
		[
			.3363571,
			.25044662,
			.31973183,
			.2234346,
			.30680212,
			.19431582,
			.29791352,
			.16386847
		],
		[
			.29791352,
			.16386847,
			.29460827,
			.15254648,
			.29130304,
			.1412245,
			.28799772,
			.12990254
		],
		[
			.28799772,
			.12990254,
			.28284046,
			.112236544,
			.281517,
			.093672596,
			.28411597,
			.07545364
		],
		[
			.28411597,
			.07545364,
			.28441915,
			.07332837,
			.28472233,
			.071203105,
			.2850255,
			.069077834
		],
		[
			.2850255,
			.069077834,
			.28702122,
			.055087637,
			.2962633,
			.043194428,
			.30932713,
			.037805106
		],
		[
			.30932713,
			.037805106,
			.3223909,
			.032415796,
			.3373303,
			.034333188,
			.34860975,
			.04284681
		],
		[
			.34860975,
			.04284681,
			.3503232,
			.04414013,
			.35203665,
			.045433454,
			.35375017,
			.04672677
		],
		[
			.35375017,
			.04672677,
			.36843908,
			.05781386,
			.3805898,
			.07191136,
			.38938865,
			.088075176
		],
		[
			.38938865,
			.088075176,
			.39502764,
			.0984343,
			.40066668,
			.10879343,
			.40630564,
			.119152576
		],
		[
			.40630564,
			.119152576,
			.42147055,
			.14701119,
			.43283257,
			.1767759,
			.44008887,
			.20765346
		],
		[
			.44008887,
			.20765346,
			.44466397,
			.2271218,
			.44923905,
			.24659017,
			.45381415,
			.2660585
		],
		[
			.45381415,
			.2660585,
			.45064726,
			.24631225,
			.44748047,
			.226566,
			.44431362,
			.20681976
		],
		[
			.44431362,
			.20681976,
			.43929076,
			.17550083,
			.43848857,
			.14365146,
			.44192845,
			.112119354
		],
		[
			.44192845,
			.112119354,
			.4432075,
			.10039438,
			.4444866,
			.08866942,
			.4457657,
			.07694446
		],
		[
			.4457657,
			.07694446,
			.4477615,
			.058649737,
			.45364276,
			.040992692,
			.46301588,
			.025155235
		],
		[
			.46301588,
			.025155235,
			.46410924,
			.023307782,
			.46520266,
			.021460328,
			.466296,
			.019612877
		],
		[
			.466296,
			.019612877,
			.47349364,
			.0074512092,
			.48658368,
			0,
			.5007156,
			20248819e-12
		],
		[
			.5007156,
			20248819e-12,
			.5148476,
			40497638e-12,
			.52791613,
			.0075291377,
			.53507894,
			.019711325
		],
		[
			.53507894,
			.019711325,
			.536167,
			.02156192,
			.53725517,
			.02341252,
			.5383432,
			.025263106
		],
		[
			.5383432,
			.025263106,
			.5476709,
			.04112721,
			.55350167,
			.058801185,
			.55544513,
			.077101395
		],
		[
			.55544513,
			.077101395,
			.55669063,
			.08882987,
			.5579362,
			.10055835,
			.5591817,
			.112286836
		],
		[
			.5591817,
			.112286836,
			.56253123,
			.14382806,
			.56163794,
			.1756769,
			.5565255,
			.20698078
		],
		[
			.5565255,
			.20698078,
			.5533021,
			.22671774,
			.55007875,
			.2464547,
			.54685545,
			.26619166
		],
		[
			.54685545,
			.26619166,
			.55148613,
			.24673665,
			.556117,
			.22728164,
			.56074774,
			.20782664
		],
		[
			.56074774,
			.20782664,
			.56809247,
			.17696956,
			.5795397,
			.14723748,
			.59478444,
			.11942196
		],
		[
			.59478444,
			.11942196,
			.6004531,
			.109079,
			.6061218,
			.098736055,
			.6117904,
			.088393115
		],
		[
			.6117904,
			.088393115,
			.62063545,
			.07225473,
			.6328261,
			.058192447,
			.64754647,
			.04714748
		],
		[
			.64754647,
			.04714748,
			.64926356,
			.04585907,
			.6509808,
			.044570666,
			.65269786,
			.04328225
		],
		[
			.65269786,
			.04328225,
			.6640017,
			.034800798,
			.6789467,
			.0329261,
			.69199514,
			.03835282
		],
		[
			.69199514,
			.03835282,
			.7050436,
			.04377955,
			.7142517,
			.055699304,
			.7162073,
			.06969529
		],
		[
			.7162073,
			.06969529,
			.7165044,
			.07182138,
			.71680146,
			.07394748,
			.71709853,
			.07607357
		],
		[
			.71709853,
			.07607357,
			.71964526,
			.09429974,
			.71826863,
			.112859674,
			.71306086,
			.13051069
		],
		[
			.71306086,
			.13051069,
			.7097232,
			.14182319,
			.7063856,
			.15313567,
			.703048,
			.16444817
		],
		[
			.703048,
			.16444817,
			.69407225,
			.19487014,
			.6810591,
			.22395186,
			.6643566,
			.25091633
		],
		[
			.6643566,
			.25091633,
			.65382546,
			.26791757,
			.64329445,
			.28491884,
			.6327633,
			.30192006
		],
		[
			.6327633,
			.30192006,
			.64448684,
			.2857179,
			.6562104,
			.26951578,
			.6679339,
			.25331366
		],
		[
			.6679339,
			.25331366,
			.68652755,
			.22761692,
			.7084817,
			.20452817,
			.7332099,
			.18466452
		],
		[
			.7332099,
			.18466452,
			.7424052,
			.17727812,
			.7516005,
			.16989173,
			.7607957,
			.16250531
		],
		[
			.7607957,
			.16250531,
			.7751434,
			.15098013,
			.79178774,
			.14265329,
			.8096145,
			.13808234
		],
		[
			.8096145,
			.13808234,
			.8116939,
			.13754913,
			.81377345,
			.13701592,
			.81585294,
			.13648273
		],
		[
			.81585294,
			.13648273,
			.829542,
			.13297272,
			.84406674,
			.13695994,
			.85404515,
			.146967
		],
		[
			.85404515,
			.146967,
			.86402357,
			.15697403,
			.86796916,
			.17151009,
			.86441994,
			.185189
		],
		[
			.86441994,
			.185189,
			.8638808,
			.18726698,
			.8633417,
			.18934496,
			.8628025,
			.19142291
		],
		[
			.8628025,
			.19142291,
			.8581805,
			.20923647,
			.8498062,
			.22585686,
			.83823997,
			.24017146
		],
		[
			.83823997,
			.24017146,
			.83082736,
			.24934548,
			.8234148,
			.25851953,
			.81600213,
			.26769352
		],
		[
			.81600213,
			.26769352,
			.7960675,
			.29236513,
			.77291614,
			.31425312,
			.7471658,
			.33277336
		],
		[
			.7471658,
			.33277336,
			.73093027,
			.34445032,
			.7146948,
			.3561273,
			.6984592,
			.3678043
		],
		[
			.6984592,
			.3678043,
			.7154904,
			.35732192,
			.73252165,
			.34683964,
			.74955285,
			.33635727
		],
		[
			.74955285,
			.33635727,
			.7765656,
			.31973153,
			.80568373,
			.30680215,
			.836132,
			.29791334
		],
		[
			.836132,
			.29791334,
			.8474539,
			.29460815,
			.8587758,
			.29130292,
			.87009776,
			.28799766
		],
		[
			.87009776,
			.28799766,
			.8877636,
			.28284046,
			.90632737,
			.281517,
			.9245461,
			.2841159
		],
		[
			.9245461,
			.2841159,
			.9266714,
			.28441906,
			.92879665,
			.2847222,
			.9309219,
			.2850254
		],
		[
			.9309219,
			.2850254,
			.9449122,
			.28702107,
			.95680547,
			.29626322,
			.96219486,
			.30932716
		],
		[
			.96219486,
			.30932716,
			.96758425,
			.3223911,
			.9656668,
			.33733064,
			.957153,
			.3486102
		],
		[
			.957153,
			.3486102,
			.95585966,
			.35032365,
			.9545663,
			.35203716,
			.953273,
			.35375065
		],
		[
			.953273,
			.35375065,
			.942186,
			.36843926,
			.9280887,
			.38058963,
			.91192526,
			.38938832
		],
		[
			.91192526,
			.38938832,
			.9015662,
			.3950273,
			.89120716,
			.40066636,
			.88084817,
			.40630534
		],
		[
			.88084817,
			.40630534,
			.85298973,
			.42147025,
			.82322323,
			.4328329,
			.7923458,
			.44008908
		],
		[
			.7923458,
			.44008908,
			.77287763,
			.44466406,
			.75340956,
			.4492391,
			.7339415,
			.45381412
		]
	],
	flower: [
		[
			.36974832,
			.18639387,
			.3785385,
			.16002327,
			.3873287,
			.13365272,
			.39611894,
			.10728214
		],
		[
			.39611894,
			.10728214,
			.4089664,
			.06873975,
			.4331206,
			.034958526,
			.46543673,
			.010336585
		],
		[
			.46543673,
			.010336585,
			.47420937,
			.0036526364,
			.48493078,
			27938904e-12,
			.49595958,
			17383149e-12
		],
		[
			.49595958,
			17383149e-12,
			.4983341,
			15110636e-12,
			.50070864,
			12838241e-12,
			.5030832,
			10563046e-12
		],
		[
			.5030832,
			10563046e-12,
			.51411206,
			0,
			.52484035,
			.003604166,
			.5336258,
			.010271285
		],
		[
			.5336258,
			.010271285,
			.565989,
			.034831263,
			.59020793,
			.06856625,
			.60312915,
			.107083954
		],
		[
			.60312915,
			.107083954,
			.61196977,
			.13343766,
			.6208105,
			.15979138,
			.6296512,
			.18614511
		],
		[
			.6296512,
			.18614511,
			.6545136,
			.1737139,
			.67937607,
			.16128269,
			.7042385,
			.14885144
		],
		[
			.7042385,
			.14885144,
			.7405766,
			.13068242,
			.78154325,
			.123875074,
			.8218045,
			.1293158
		],
		[
			.8218045,
			.1293158,
			.8327339,
			.13079275,
			.8428782,
			.13581088,
			.85068417,
			.14360192
		],
		[
			.85068417,
			.14360192,
			.85236484,
			.14527938,
			.85404545,
			.14695683,
			.8557262,
			.1486343
		],
		[
			.8557262,
			.1486343,
			.8635321,
			.15642534,
			.8685697,
			.1665599,
			.87006754,
			.17748646
		],
		[
			.87006754,
			.17748646,
			.8755853,
			.21773736,
			.8688564,
			.25871694,
			.8507569,
			.29508984
		],
		[
			.8507569,
			.29508984,
			.8383733,
			.31997597,
			.8259898,
			.34486213,
			.8136062,
			.3697483
		],
		[
			.8136062,
			.3697483,
			.8399767,
			.3785385,
			.8663473,
			.3873287,
			.8927179,
			.39611894
		],
		[
			.8927179,
			.39611894,
			.93126017,
			.40896636,
			.9650416,
			.43312073,
			.9896635,
			.4654368
		],
		[
			.9896635,
			.4654368,
			.9963474,
			.47420946,
			.99997216,
			.48493093,
			.99998266,
			.49595973
		],
		[
			.99998266,
			.49595973,
			.9999849,
			.49833426,
			.99998724,
			.5007088,
			.9999895,
			.50308335
		],
		[
			.9999895,
			.50308335,
			1,
			.5141121,
			.9963958,
			.52484035,
			.9897288,
			.5336258
		],
		[
			.9897288,
			.5336258,
			.96516883,
			.5659891,
			.9314338,
			.59020805,
			.892916,
			.6031292
		],
		[
			.892916,
			.6031292,
			.86656225,
			.61196977,
			.84020853,
			.6208105,
			.81385493,
			.6296512
		],
		[
			.81385493,
			.6296512,
			.82628614,
			.6545136,
			.83871734,
			.67937607,
			.8511486,
			.70423853
		],
		[
			.8511486,
			.70423853,
			.8693176,
			.7405766,
			.876125,
			.78154325,
			.8706843,
			.8218045
		],
		[
			.8706843,
			.8218045,
			.8692074,
			.8327339,
			.8641892,
			.84287816,
			.8563981,
			.85068417
		],
		[
			.8563981,
			.85068417,
			.8547206,
			.85236484,
			.85304314,
			.85404557,
			.8513657,
			.85572624
		],
		[
			.8513657,
			.85572624,
			.84357464,
			.8635322,
			.83344007,
			.8685697,
			.8225135,
			.87006754
		],
		[
			.8225135,
			.87006754,
			.7822627,
			.8755853,
			.7412831,
			.8688563,
			.7049102,
			.85075694
		],
		[
			.7049102,
			.85075694,
			.680024,
			.83837336,
			.65513796,
			.8259898,
			.63025177,
			.8136062
		],
		[
			.63025177,
			.8136062,
			.6214615,
			.8399767,
			.6126713,
			.8663473,
			.6038812,
			.8927179
		],
		[
			.6038812,
			.8927179,
			.5910337,
			.9312602,
			.5668794,
			.9650416,
			.53456324,
			.9896635
		],
		[
			.53456324,
			.9896635,
			.52579063,
			.9963474,
			.5150691,
			.99997216,
			.50404036,
			.99998266
		],
		[
			.50404036,
			.99998266,
			.5016658,
			.9999849,
			.4992912,
			.99998724,
			.49691668,
			.9999895
		],
		[
			.49691668,
			.9999895,
			.48588794,
			1,
			.47515965,
			.9963958,
			.46637428,
			.98972875
		],
		[
			.46637428,
			.98972875,
			.43401107,
			.96516883,
			.40979218,
			.93143374,
			.39687088,
			.8929161
		],
		[
			.39687088,
			.8929161,
			.38803017,
			.8665623,
			.3791895,
			.8402086,
			.37034884,
			.81385493
		],
		[
			.37034884,
			.81385493,
			.34548637,
			.8262861,
			.32062396,
			.83871734,
			.29576156,
			.85114855
		],
		[
			.29576156,
			.85114855,
			.25942346,
			.8693176,
			.21845685,
			.876125,
			.17819555,
			.8706843
		],
		[
			.17819555,
			.8706843,
			.16726615,
			.8692074,
			.15712193,
			.8641892,
			.14931595,
			.85639817
		],
		[
			.14931595,
			.85639817,
			.14763525,
			.85472065,
			.14595455,
			.8530432,
			.14427383,
			.8513657
		],
		[
			.14427383,
			.8513657,
			.13646787,
			.8435747,
			.13143033,
			.83344007,
			.12993245,
			.8225135
		],
		[
			.12993245,
			.8225135,
			.12441473,
			.78226274,
			.13114364,
			.7412832,
			.14924306,
			.7049104
		],
		[
			.14924306,
			.7049104,
			.16162665,
			.68002415,
			.17401026,
			.65513796,
			.18639386,
			.63025177
		],
		[
			.18639386,
			.63025177,
			.16002324,
			.6214615,
			.13365264,
			.6126713,
			.10728206,
			.6038811
		],
		[
			.10728206,
			.6038811,
			.068739764,
			.59103364,
			.034958445,
			.56687933,
			.010336571,
			.5345632
		],
		[
			.010336571,
			.5345632,
			.0036526388,
			.5257906,
			27935172e-12,
			.5150692,
			17372884e-12,
			.5040404
		],
		[
			17372884e-12,
			.5040404,
			151003715e-13,
			.5016659,
			12827976e-12,
			.49929127,
			10556514e-12,
			.49691674
		],
		[
			10556514e-12,
			.49691674,
			0,
			.48588797,
			.0036041632,
			.47515967,
			.0102712745,
			.46637425
		],
		[
			.0102712745,
			.46637425,
			.034831252,
			.43401098,
			.06856626,
			.40979213,
			.10708399,
			.39687088
		],
		[
			.10708399,
			.39687088,
			.13343768,
			.3880302,
			.15979138,
			.37918955,
			.1861451,
			.3703489
		],
		[
			.1861451,
			.3703489,
			.17371388,
			.34548646,
			.1612827,
			.32062405,
			.14885145,
			.29576162
		],
		[
			.14885145,
			.29576162,
			.13068242,
			.25942352,
			.12387508,
			.21845686,
			.12931578,
			.17819555
		],
		[
			.12931578,
			.17819555,
			.13079274,
			.16726612,
			.13581087,
			.15712188,
			.14360192,
			.14931588
		],
		[
			.14360192,
			.14931588,
			.1452794,
			.1476352,
			.14695683,
			.14595453,
			.1486343,
			.14427386
		],
		[
			.1486343,
			.14427386,
			.15642537,
			.13646789,
			.16656,
			.13143034,
			.17748658,
			.1299325
		],
		[
			.17748658,
			.1299325,
			.21773721,
			.12441481,
			.258717,
			.13114373,
			.29508966,
			.14924309
		],
		[
			.29508966,
			.14924309,
			.31997588,
			.16162667,
			.3448621,
			.17401028,
			.36974832,
			.18639387
		]
	],
	puffy: [
		[
			.5,
			.17030418,
			.5057874,
			.16142936,
			.51157486,
			.15255453,
			.5173623,
			.14367971
		],
		[
			.5173623,
			.14367971,
			.5339834,
			.11819186,
			.5693888,
			.10244157,
			.6075185,
			.10357324
		],
		[
			.6075185,
			.10357324,
			.6452641,
			.104693525,
			.67900246,
			.12136877,
			.69494015,
			.14678164
		],
		[
			.69494015,
			.14678164,
			.69744104,
			.15076935,
			.69994193,
			.15475707,
			.7024428,
			.15874477
		],
		[
			.7024428,
			.15874477,
			.7112147,
			.17273168,
			.71656144,
			.1877654,
			.71823275,
			.20314266
		],
		[
			.71823275,
			.20314266,
			.7190471,
			.21063587,
			.7198615,
			.21812908,
			.72067595,
			.22562231
		],
		[
			.72067595,
			.22562231,
			.7465048,
			.18171695,
			.824503,
			.17182331,
			.8685214,
			.20686898
		],
		[
			.8685214,
			.20686898,
			.8695357,
			.20767654,
			.87055004,
			.20848411,
			.8715644,
			.20929165
		],
		[
			.8715644,
			.20929165,
			.89745915,
			.22990802,
			.9132934,
			.2563698,
			.91653705,
			.28444856
		],
		[
			.91653705,
			.28444856,
			.91678935,
			.2866334,
			.9170418,
			.28881827,
			.91729414,
			.29100308
		],
		[
			.91729414,
			.29100308,
			.92125475,
			.32528818,
			.9074641,
			.35940507,
			.8787276,
			.3864135
		],
		[
			.8787276,
			.3864135,
			.8807654,
			.38636225,
			.8828032,
			.38631102,
			.8848409,
			.38625976
		],
		[
			.8848409,
			.38625976,
			.9175362,
			.3854374,
			.94850904,
			.39713305,
			.96685666,
			.41722983
		],
		[
			.96685666,
			.41722983,
			.9884553,
			.44088754,
			1,
			.46880633,
			1,
			.49738124
		],
		[
			1,
			.49738124,
			1,
			.4991271,
			1,
			.5008729,
			1,
			.5026187
		],
		[
			1,
			.5026187,
			1,
			.5311936,
			.98845536,
			.5591125,
			.96685666,
			.58277017
		],
		[
			.96685666,
			.58277017,
			.94850904,
			.6028669,
			.9175362,
			.6145627,
			.8848409,
			.61374027
		],
		[
			.8848409,
			.61374027,
			.88280314,
			.61368906,
			.8807654,
			.61363775,
			.8787276,
			.6135865
		],
		[
			.8787276,
			.6135865,
			.9074641,
			.6405949,
			.9212547,
			.67471176,
			.9172942,
			.70899683
		],
		[
			.9172942,
			.70899683,
			.91704184,
			.7111817,
			.9167894,
			.7133665,
			.91653705,
			.7155514
		],
		[
			.91653705,
			.7155514,
			.9132934,
			.7436302,
			.8974592,
			.77009183,
			.87156445,
			.79070824
		],
		[
			.87156445,
			.79070824,
			.8705501,
			.7915158,
			.86953574,
			.79232347,
			.8685214,
			.793131
		],
		[
			.8685214,
			.793131,
			.82450306,
			.8281766,
			.7465048,
			.818283,
			.72067595,
			.7743777
		],
		[
			.72067595,
			.7743777,
			.7198615,
			.7818709,
			.7190472,
			.78936416,
			.71823275,
			.79685736
		],
		[
			.71823275,
			.79685736,
			.71656144,
			.8122345,
			.7112147,
			.82726836,
			.7024429,
			.8412552
		],
		[
			.7024429,
			.8412552,
			.69994193,
			.8452428,
			.6974411,
			.8492305,
			.6949402,
			.8532183
		],
		[
			.6949402,
			.8532183,
			.67900246,
			.8786311,
			.645264,
			.89530647,
			.6075184,
			.8964267
		],
		[
			.6075184,
			.8964267,
			.56938875,
			.8975583,
			.5339833,
			.8818081,
			.5173622,
			.8563202
		],
		[
			.5173622,
			.8563202,
			.5115748,
			.8474454,
			.5057873,
			.8385706,
			.5,
			.8296958
		],
		[
			.5,
			.8296958,
			.49421254,
			.8385706,
			.48842508,
			.8474455,
			.4826377,
			.85632026
		],
		[
			.4826377,
			.85632026,
			.46601665,
			.8818081,
			.43061125,
			.89755845,
			.39248157,
			.8964267
		],
		[
			.39248157,
			.8964267,
			.3547359,
			.89530647,
			.32099742,
			.8786311,
			.30505976,
			.85321826
		],
		[
			.30505976,
			.85321826,
			.30255884,
			.8492305,
			.30005795,
			.84524274,
			.29755703,
			.84125507
		],
		[
			.29755703,
			.84125507,
			.28878525,
			.82726836,
			.28343862,
			.8122346,
			.2817673,
			.79685754
		],
		[
			.2817673,
			.79685754,
			.28095287,
			.78936416,
			.28013843,
			.781871,
			.279324,
			.7743777
		],
		[
			.279324,
			.7743777,
			.25349516,
			.818283,
			.17549694,
			.8281766,
			.13147861,
			.793131
		],
		[
			.13147861,
			.793131,
			.13046427,
			.79232347,
			.12944992,
			.7915158,
			.12843557,
			.79070824
		],
		[
			.12843557,
			.79070824,
			.10254084,
			.7700919,
			.08670654,
			.7436301,
			.08346296,
			.7155514
		],
		[
			.08346296,
			.7155514,
			.08321057,
			.7133665,
			.082958184,
			.7111817,
			.082705826,
			.7089969
		],
		[
			.082705826,
			.7089969,
			.07874528,
			.6747118,
			.09253596,
			.64059484,
			.121272385,
			.6135864
		],
		[
			.121272385,
			.6135864,
			.119234614,
			.6136377,
			.11719684,
			.613689,
			.11515907,
			.6137402
		],
		[
			.11515907,
			.6137402,
			.08246378,
			.61456263,
			.051490936,
			.6028669,
			.033143323,
			.5827701
		],
		[
			.033143323,
			.5827701,
			.011544665,
			.5591124,
			0,
			.5311936,
			1.48122865e-8,
			.5026187
		],
		[
			1.48122865e-8,
			.5026187,
			1.48122865e-8,
			.50087285,
			1.48122865e-8,
			.4991271,
			2.9624573e-8,
			.49738124
		],
		[
			2.9624573e-8,
			.49738124,
			2.9624573e-8,
			.46880633,
			.011544737,
			.44088748,
			.033143386,
			.41722977
		],
		[
			.033143386,
			.41722977,
			.051490985,
			.39713305,
			.082463704,
			.38543734,
			.115158916,
			.38625965
		],
		[
			.115158916,
			.38625965,
			.11719677,
			.3863109,
			.11923462,
			.38636214,
			.121272475,
			.3864134
		],
		[
			.121272475,
			.3864134,
			.092536,
			.35940498,
			.07874535,
			.32528806,
			.08270587,
			.29100302
		],
		[
			.08270587,
			.29100302,
			.08295825,
			.2888182,
			.08321063,
			.2866334,
			.08346303,
			.2844486
		],
		[
			.08346303,
			.2844486,
			.08670662,
			.2563698,
			.10254086,
			.22990805,
			.12843566,
			.20929164
		],
		[
			.12843566,
			.20929164,
			.12944995,
			.2084841,
			.13046427,
			.20767653,
			.13147858,
			.20686899
		],
		[
			.13147858,
			.20686899,
			.17549694,
			.17182332,
			.25349522,
			.1817169,
			.27932417,
			.22562224
		],
		[
			.27932417,
			.22562224,
			.2801386,
			.21812902,
			.280953,
			.21063581,
			.28176743,
			.2031426
		],
		[
			.28176743,
			.2031426,
			.28343874,
			.18776543,
			.28878543,
			.1727316,
			.29755726,
			.15874474
		],
		[
			.29755726,
			.15874474,
			.3000582,
			.15475702,
			.30255908,
			.1507693,
			.30506,
			.14678156
		],
		[
			.30506,
			.14678156,
			.32099766,
			.12136875,
			.35473603,
			.104693495,
			.39248157,
			.10357322
		],
		[
			.39248157,
			.10357322,
			.4306112,
			.10244155,
			.46601665,
			.11819186,
			.4826377,
			.1436797
		],
		[
			.4826377,
			.1436797,
			.48842508,
			.15255451,
			.49421254,
			.16142936,
			.5,
			.17030418
		]
	],
	puffyDiamond: [
		[
			.77894926,
			.22105066,
			.8125624,
			.25466374,
			.8300485,
			.3044038,
			.81802547,
			.3568888
		],
		[
			.81802547,
			.3568888,
			.81801695,
			.35692582,
			.81800854,
			.3569629,
			.818,
			.35699996
		],
		[
			.818,
			.35699996,
			.8231876,
			.35628733,
			.8283752,
			.35557476,
			.83356285,
			.35486224
		],
		[
			.83356285,
			.35486224,
			.92157155,
			.3427731,
			1,
			.41116485,
			1,
			.49999997
		],
		[
			1,
			.49999997,
			1,
			.5888351,
			.9215715,
			.65722686,
			.83356285,
			.6451378
		],
		[
			.83356285,
			.6451378,
			.8283752,
			.64442515,
			.82318765,
			.6437126,
			.818,
			.643
		],
		[
			.818,
			.643,
			.8180085,
			.6430371,
			.818017,
			.64307415,
			.8180255,
			.6431112
		],
		[
			.8180255,
			.6431112,
			.84207153,
			.7480812,
			.7480812,
			.84207153,
			.6431112,
			.81802547
		],
		[
			.6431112,
			.81802547,
			.64307415,
			.81801695,
			.6430371,
			.81800854,
			.643,
			.818
		],
		[
			.643,
			.818,
			.6437126,
			.8231876,
			.64442515,
			.8283752,
			.6451377,
			.83356285
		],
		[
			.6451377,
			.83356285,
			.65722686,
			.92157155,
			.5888351,
			1,
			.49999997,
			1
		],
		[
			.49999997,
			1,
			.41116488,
			1,
			.3427731,
			.9215715,
			.3548622,
			.83356285
		],
		[
			.3548622,
			.83356285,
			.3555748,
			.8283752,
			.3562874,
			.82318765,
			.35699996,
			.818
		],
		[
			.35699996,
			.818,
			.35696286,
			.81800854,
			.35692576,
			.818017,
			.35688868,
			.8180255
		],
		[
			.35688868,
			.8180255,
			.25191876,
			.84207153,
			.15792844,
			.7480812,
			.18197438,
			.6431113
		],
		[
			.18197438,
			.6431113,
			.18198289,
			.64307415,
			.1819914,
			.643037,
			.1819999,
			.6429999
		],
		[
			.1819999,
			.6429999,
			.17681234,
			.6437124,
			.1716248,
			.64442503,
			.16643724,
			.6451376
		],
		[
			.16643724,
			.6451376,
			.07842854,
			.65722674,
			0,
			.58883494,
			3.170385e-9,
			.4999998
		],
		[
			3.170385e-9,
			.4999998,
			3.931346e-8,
			.41116473,
			.078428514,
			.342773,
			.16643716,
			.35486206
		],
		[
			.16643716,
			.35486206,
			.17162476,
			.35557464,
			.17681237,
			.35628727,
			.18199997,
			.35699984
		],
		[
			.18199997,
			.35699984,
			.18199147,
			.35696277,
			.18198298,
			.3569257,
			.1819745,
			.35688868
		],
		[
			.1819745,
			.35688868,
			.15792856,
			.25191876,
			.25191888,
			.15792844,
			.3568888,
			.18197441
		],
		[
			.3568888,
			.18197441,
			.35692587,
			.1819829,
			.35696295,
			.1819914,
			.35700002,
			.18199989
		],
		[
			.35700002,
			.18199989,
			.35628745,
			.17681232,
			.35557488,
			.17162476,
			.3548623,
			.16643721
		],
		[
			.3548623,
			.16643721,
			.34277317,
			.0784285,
			.41116497,
			0,
			.5000001,
			0
		],
		[
			.5000001,
			0,
			.58883524,
			0,
			.6572271,
			.078428544,
			.64513785,
			.16643727
		],
		[
			.64513785,
			.16643727,
			.6444253,
			.17162482,
			.6437127,
			.1768124,
			.6430001,
			.18199995
		],
		[
			.6430001,
			.18199995,
			.6430371,
			.18199146,
			.64307415,
			.181983,
			.64311117,
			.18197453
		],
		[
			.64311117,
			.18197453,
			.6955961,
			.16995151,
			.74533623,
			.1874376,
			.77894926,
			.22105066
		]
	],
	pixelCircle: [
		[
			.49999997,
			0,
			.56799996,
			0,
			.636,
			0,
			.704,
			0
		],
		[
			.704,
			0,
			.704,
			.021666666,
			.704,
			.043333333,
			.704,
			.065
		],
		[
			.704,
			.065,
			.7503333,
			.065,
			.7966667,
			.065,
			.84300005,
			.065
		],
		[
			.84300005,
			.065,
			.843,
			.09266666,
			.84300005,
			.12033333,
			.84300005,
			.148
		],
		[
			.84300005,
			.148,
			.8706666,
			.148,
			.8983333,
			.148,
			.926,
			.148
		],
		[
			.926,
			.148,
			.926,
			.19733334,
			.926,
			.24666667,
			.926,
			.296
		],
		[
			.926,
			.296,
			.95066667,
			.296,
			.97533333,
			.296,
			1,
			.296
		],
		[
			1,
			.296,
			1,
			.43199998,
			1,
			.568,
			1,
			.704
		],
		[
			1,
			.704,
			.97533333,
			.704,
			.95066667,
			.704,
			.926,
			.704
		],
		[
			.926,
			.704,
			.926,
			.75333333,
			.926,
			.80266666,
			.926,
			.852
		],
		[
			.926,
			.852,
			.8983333,
			.852,
			.8706667,
			.852,
			.84300005,
			.852
		],
		[
			.84300005,
			.852,
			.843,
			.8796666,
			.84300005,
			.9073333,
			.84300005,
			.935
		],
		[
			.84300005,
			.935,
			.7966667,
			.93499994,
			.7503334,
			.93499994,
			.7040001,
			.93499994
		],
		[
			.7040001,
			.93499994,
			.70400006,
			.9566666,
			.70400006,
			.97833335,
			.704,
			1
		],
		[
			.704,
			1,
			.6359999,
			1,
			.56799996,
			1,
			.49999997,
			1
		],
		[
			.49999997,
			1,
			.43199992,
			.99999994,
			.36399996,
			.99999994,
			.29599994,
			.99999994
		],
		[
			.29599994,
			.99999994,
			.29599994,
			.97833323,
			.2959999,
			.9566666,
			.2959999,
			.93499994
		],
		[
			.2959999,
			.93499994,
			.2496666,
			.93499994,
			.2033333,
			.93499994,
			.157,
			.935
		],
		[
			.157,
			.935,
			.15699998,
			.90733325,
			.15699998,
			.87966657,
			.15699995,
			.85199994
		],
		[
			.15699995,
			.85199994,
			.12933327,
			.8519999,
			.10166663,
			.8519999,
			.07399997,
			.85199994
		],
		[
			.07399997,
			.85199994,
			.073999986,
			.8026666,
			.074000016,
			.75333333,
			.07400003,
			.70400006
		],
		[
			.07400003,
			.70400006,
			.049333353,
			.704,
			.024666676,
			.704,
			0,
			.704
		],
		[
			0,
			.704,
			3.973643e-8,
			.5679999,
			7.947286e-8,
			.43199986,
			1.1920929e-7,
			.2959998
		],
		[
			1.1920929e-7,
			.2959998,
			.024666747,
			.29599985,
			.049333375,
			.2959999,
			.074,
			.29599997
		],
		[
			.074,
			.29599997,
			.07400001,
			.24666664,
			.07400002,
			.19733332,
			.07400003,
			.148
		],
		[
			.07400003,
			.148,
			.10166672,
			.14799997,
			.1293334,
			.14799994,
			.1570001,
			.14799991
		],
		[
			.1570001,
			.14799991,
			.15700008,
			.12033325,
			.15700006,
			.092666596,
			.15700006,
			.06499994
		],
		[
			.15700006,
			.06499994,
			.20333338,
			.06499995,
			.24966669,
			.064999975,
			.296,
			.065
		],
		[
			.296,
			.065,
			.29599997,
			.04333333,
			.29599997,
			.021666665,
			.29599997,
			0
		],
		[
			.29599997,
			0,
			.36399996,
			0,
			.43199998,
			0,
			.49999997,
			0
		]
	],
	pixelTriangle: [
		[
			.11100009,
			.49999988,
			.11200009,
			.33333322,
			.1130001,
			.16666661,
			.11400011,
			0
		],
		[
			.11400011,
			0,
			.17200007,
			1.9868212e-8,
			.23000005,
			3.973642e-8,
			.28800002,
			5.960463e-8
		],
		[
			.28800002,
			5.960463e-8,
			.28800002,
			.029000057,
			.28800005,
			.058000054,
			.28800005,
			.08700005
		],
		[
			.28800005,
			.08700005,
			.33266667,
			.08700005,
			.3773333,
			.08700005,
			.422,
			.08700005
		],
		[
			.422,
			.08700005,
			.42199996,
			.11466671,
			.42200002,
			.14233337,
			.42200002,
			.17000003
		],
		[
			.42200002,
			.17000003,
			.4683333,
			.17000003,
			.5146666,
			.17000003,
			.561,
			.17000003
		],
		[
			.561,
			.17000003,
			.56099993,
			.20166668,
			.561,
			.23333333,
			.561,
			.265
		],
		[
			.561,
			.265,
			.599,
			.265,
			.63699996,
			.265,
			.67499995,
			.265
		],
		[
			.67499995,
			.265,
			.67533326,
			.29133332,
			.6756666,
			.31766662,
			.67599994,
			.34399998
		],
		[
			.67599994,
			.34399998,
			.7139999,
			.34399995,
			.752,
			.34399998,
			.7899999,
			.34399998
		],
		[
			.7899999,
			.34399998,
			.7899999,
			.37566665,
			.78999996,
			.4073333,
			.7899999,
			.43899995
		],
		[
			.7899999,
			.43899995,
			.8229999,
			.43899992,
			.85599995,
			.43899995,
			.8889999,
			.43899995
		],
		[
			.8889999,
			.43899995,
			.8889998,
			.47966662,
			.8889999,
			.52033335,
			.8889999,
			.56100005
		],
		[
			.8889999,
			.56100005,
			.8559998,
			.561,
			.82299984,
			.561,
			.78999984,
			.561
		],
		[
			.78999984,
			.561,
			.78999984,
			.5926666,
			.7899999,
			.6243333,
			.7899999,
			.6559999
		],
		[
			.7899999,
			.6559999,
			.75199986,
			.6559999,
			.7139998,
			.65599996,
			.67599976,
			.656
		],
		[
			.67599976,
			.656,
			.6756664,
			.68233335,
			.675333,
			.7086667,
			.6749997,
			.7350001
		],
		[
			.6749997,
			.7350001,
			.6369998,
			.735,
			.599,
			.73499995,
			.56100005,
			.7349999
		],
		[
			.56100005,
			.7349999,
			.56099993,
			.76666653,
			.56099975,
			.7983333,
			.56099963,
			.8299999
		],
		[
			.56099963,
			.8299999,
			.5146664,
			.8299999,
			.46833318,
			.8299999,
			.42199996,
			.82999986
		],
		[
			.42199996,
			.82999986,
			.422,
			.8576665,
			.42200002,
			.8853331,
			.42200005,
			.9129998
		],
		[
			.42200005,
			.9129998,
			.37733334,
			.91299975,
			.33266667,
			.9129998,
			.288,
			.9129998
		],
		[
			.288,
			.9129998,
			.2880001,
			.9419998,
			.28800026,
			.9709999,
			.28800038,
			1
		],
		[
			.28800038,
			1,
			.2300003,
			.99999976,
			.17200024,
			1,
			.1140002,
			1
		],
		[
			.1140002,
			1,
			.113000154,
			.83333325,
			.11200012,
			.6666665,
			.11100009,
			.49999988
		]
	],
	bun: [
		[
			.79599994,
			.50000006,
			.7996457,
			.5011514,
			.8032915,
			.5023027,
			.8069373,
			.50345397
		],
		[
			.8069373,
			.50345397,
			.8373716,
			.5130648,
			.8657169,
			.5283384,
			.8904817,
			.54847085
		],
		[
			.8904817,
			.54847085,
			.9541673,
			.60024405,
			.98883545,
			.6796542,
			.98350847,
			.7615562
		],
		[
			.98350847,
			.7615562,
			.9834971,
			.76173073,
			.98348576,
			.76190525,
			.98347443,
			.7620798
		],
		[
			.98347443,
			.7620798,
			.9747703,
			.89590603,
			.86368597,
			1,
			.72957695,
			1
		],
		[
			.72957695,
			1,
			.57652557,
			1,
			.42347425,
			1,
			.2704229,
			1
		],
		[
			.2704229,
			1,
			.13631387,
			1,
			.025229609,
			.8959061,
			.016525464,
			.76207983
		],
		[
			.016525464,
			.76207983,
			.016514113,
			.76190525,
			.016502762,
			.76173073,
			.01649143,
			.76155627
		],
		[
			.01649143,
			.76155627,
			.011164457,
			.6796542,
			.045832597,
			.600244,
			.1095182,
			.5484708
		],
		[
			.1095182,
			.5484708,
			.13428295,
			.5283383,
			.16262831,
			.51306474,
			.19306253,
			.50345397
		],
		[
			.19306253,
			.50345397,
			.19670834,
			.50230265,
			.20035414,
			.5011513,
			.20399995,
			.5
		],
		[
			.20399995,
			.5,
			.20035423,
			.4988487,
			.19670855,
			.49769744,
			.19306283,
			.49654618
		],
		[
			.19306283,
			.49654618,
			.16262832,
			.48693532,
			.13428299,
			.47166175,
			.10951801,
			.4515291
		],
		[
			.10951801,
			.4515291,
			.045832522,
			.39975592,
			.011164458,
			.32034585,
			.016491449,
			.23844393
		],
		[
			.016491449,
			.23844393,
			.016502801,
			.23826936,
			.016514156,
			.2380948,
			.016525524,
			.23792024
		],
		[
			.016525524,
			.23792024,
			.025229687,
			.104094,
			.136314,
			0,
			.27042302,
			4.01349e-8
		],
		[
			.27042302,
			4.01349e-8,
			.4234744,
			8.399343e-8,
			.5765258,
			1.2785196e-7,
			.7295772,
			1.8042849e-7
		],
		[
			.7295772,
			1.8042849e-7,
			.86368614,
			2.1184536e-7,
			.9747704,
			.10409427,
			.9834745,
			.23792048
		],
		[
			.9834745,
			.23792048,
			.9834858,
			.23809503,
			.9834972,
			.2382696,
			.9835086,
			.23844416
		],
		[
			.9835086,
			.23844416,
			.9888355,
			.320346,
			.9541674,
			.39975607,
			.8904819,
			.45152918
		],
		[
			.8904819,
			.45152918,
			.86571676,
			.47166198,
			.83737177,
			.48693532,
			.80693704,
			.49654624
		],
		[
			.80693704,
			.49654624,
			.8032913,
			.4976975,
			.79964566,
			.49884877,
			.79599994,
			.50000006
		]
	],
	heart: [
		[
			.5,
			.28592262,
			.50162935,
			.28592262,
			.5032587,
			.28525198,
			.50443137,
			.28391066
		],
		[
			.50443137,
			.28391066,
			.54294467,
			.23985782,
			.5814579,
			.19580503,
			.61997116,
			.1517522
		],
		[
			.61997116,
			.1517522,
			.7046104,
			.054938894,
			.85627925,
			.058467712,
			.93632436,
			.15911266
		],
		[
			.93632436,
			.15911266,
			1,
			.2391755,
			.9984658,
			.35301173,
			.9326556,
			.43132946
		],
		[
			.9326556,
			.43132946,
			.78896713,
			.6023264,
			.6452787,
			.7733233,
			.5015903,
			.9443202
		],
		[
			.5015903,
			.9443202,
			.5011956,
			.9447899,
			.5006135,
			.9450611,
			.5,
			.9450611
		],
		[
			.5,
			.9450611,
			.4993865,
			.9450611,
			.4988044,
			.9447899,
			.49840972,
			.9443202
		],
		[
			.49840972,
			.9443202,
			.35472128,
			.77332324,
			.21103285,
			.6023264,
			.06734445,
			.43132952
		],
		[
			.06734445,
			.43132952,
			.0015341921,
			.35301176,
			0,
			.23917544,
			.063675694,
			.15911256
		],
		[
			.063675694,
			.15911256,
			.14372082,
			.05846764,
			.2953897,
			.054938894,
			.38002893,
			.15175223
		],
		[
			.38002893,
			.15175223,
			.41854212,
			.19580503,
			.45705533,
			.23985782,
			.49556857,
			.28391063
		],
		[
			.49556857,
			.28391063,
			.49674124,
			.28525195,
			.4983706,
			.2859226,
			.5,
			.28592262
		]
	]
});
for (const cubics of Object.values(MATERIAL_SHAPE_CUBICS)) {
	for (const cubic of cubics) Object.freeze(cubic);
	Object.freeze(cubics);
}
const TAU$1 = Math.PI * 2;
const cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const mix2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const distance2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cache$1 = /* @__PURE__ */ new Map();
const GRID = 24;
function flatten(cubic, output, depth = 0) {
	const [a, b, c, d] = cubic;
	const chord = distance2(a, d);
	if ((chord < 1e-12 ? Math.max(distance2(a, b), distance2(a, c)) : Math.max(Math.abs(cross2(a, d, b)), Math.abs(cross2(a, d, c))) / chord) <= 5e-5 || depth === 16) {
		output.push(d);
		return;
	}
	const ab = mix2(a, b, .5), bc = mix2(b, c, .5), cd = mix2(c, d, .5);
	const abc = mix2(ab, bc, .5), bcd = mix2(bc, cd, .5), middle = mix2(abc, bcd, .5);
	flatten([
		a,
		ab,
		abc,
		middle
	], output, depth + 1);
	flatten([
		middle,
		bcd,
		cd,
		d
	], output, depth + 1);
}
function bucket(value) {
	return Math.max(0, Math.min(23, Math.floor((value + 1) * .5 * GRID)));
}
function insideTriangle(p, a, b, c, epsilon = 1e-12) {
	return cross2(a, b, p) >= -epsilon && cross2(b, c, p) >= -epsilon && cross2(c, a, p) >= -epsilon;
}
/** Ear triangulation provides an orientation-preserving disk map for non-star outlines. */
function triangulate(points, source) {
	const remaining = points.map((_, i) => i), result = [];
	let cursor = 0, misses = 0;
	while (remaining.length > 3) {
		const n = remaining.length, ia = remaining[(cursor + n - 1) % n], ib = remaining[cursor % n], ic = remaining[(cursor + 1) % n];
		const a = points[ia], b = points[ib], c = points[ic];
		let ear = cross2(a, b, c) > 1e-12;
		if (ear) {
			for (const ix of remaining) if (ix !== ia && ix !== ib && ix !== ic && insideTriangle(points[ix], a, b, c)) {
				ear = false;
				break;
			}
		}
		if (ear) {
			const sa = source[ia], sb = source[ib], sc = source[ic];
			result.push({
				source: [
					sa,
					sb,
					sc
				],
				target: [
					a,
					b,
					c
				],
				determinant: cross2(sa, sb, sc)
			});
			remaining.splice(cursor % n, 1);
			cursor %= remaining.length;
			misses = 0;
		} else {
			cursor = (cursor + 1) % n;
			if (++misses > n * 2) throw new Error("Material outline triangulation failed.");
		}
	}
	const [ia, ib, ic] = remaining;
	const sa = source[ia], sb = source[ib], sc = source[ic];
	result.push({
		source: [
			sa,
			sb,
			sc
		],
		target: [
			points[ia],
			points[ib],
			points[ic]
		],
		determinant: cross2(sa, sb, sc)
	});
	return result;
}
function contour(name) {
	const existing = cache$1.get(name);
	if (existing) return existing;
	const sampled = [];
	for (const c of MATERIAL_SHAPE_CUBICS[name]) {
		const points = [
			[2 * c[0] - 1, 1 - 2 * c[1]],
			[2 * c[2] - 1, 1 - 2 * c[3]],
			[2 * c[4] - 1, 1 - 2 * c[5]],
			[2 * c[6] - 1, 1 - 2 * c[7]]
		];
		if (!sampled.length) sampled.push(points[0]);
		flatten(points, sampled);
	}
	let points = sampled.filter((p, i) => !i || distance2(p, sampled[i - 1]) > 1e-7);
	if (distance2(points[0], points[points.length - 1]) < 1e-7) points.pop();
	points = points.filter((p, i, ps) => {
		const a = ps[(i + ps.length - 1) % ps.length], b = ps[(i + 1) % ps.length];
		return Math.abs(cross2(a, p, b)) > 1e-10 || (p[0] - a[0]) * (b[0] - p[0]) + (p[1] - a[1]) * (b[1] - p[1]) < 0;
	});
	if (points.reduce((sum, p, i) => {
		const q = points[(i + 1) % points.length];
		return sum + p[0] * q[1] - p[1] * q[0];
	}, 0) < 0) points.reverse();
	let cut = -1, cutPoint = [0, 0];
	for (let i = 0; i < points.length; i++) {
		const p = points[i], q = points[(i + 1) % points.length];
		if (p[1] <= 0 && q[1] > 0 || p[1] > 0 && q[1] <= 0) {
			const x = p[0] + (q[0] - p[0]) * -p[1] / (q[1] - p[1]);
			if (x > cutPoint[0]) {
				cut = i;
				cutPoint = [x, 0];
			}
		}
	}
	if (cut < 0) throw new Error(`Material outline ${name} has no positive-X seam.`);
	points = [
		cutPoint,
		...points.slice(cut + 1),
		...points.slice(0, cut + 1)
	].filter((p, i, ps) => !i || distance2(p, ps[i - 1]) > 1e-7);
	if (distance2(points[0], points[points.length - 1]) < 1e-7) points.pop();
	const starShaped = points.every((p, i) => cross2([0, 0], p, points[(i + 1) % points.length]) >= -1e-10);
	let data;
	if (starShaped) {
		const angles = points.map((p) => (Math.atan2(p[1], p[0]) + TAU$1) % TAU$1);
		angles[0] = 0;
		data = {
			points,
			angles
		};
	} else {
		const distances = [0];
		for (let i = 1; i <= points.length; i++) distances.push(distances[i - 1] + distance2(points[i - 1], points[i % points.length]));
		const total = distances.pop(), angles = distances.map((d) => d / total * TAU$1);
		const source = angles.map((a) => [Math.cos(a), Math.sin(a)]);
		const triangles = triangulate(points, source), buckets = Array.from({ length: 576 }, () => []);
		triangles.forEach((triangle, i) => {
			const xs = triangle.source.map((p) => p[0]), ys = triangle.source.map((p) => p[1]);
			for (let y = bucket(Math.min(...ys)); y <= bucket(Math.max(...ys)); y++) for (let x = bucket(Math.min(...xs)); x <= bucket(Math.max(...xs)); x++) buckets[y * GRID + x].push(i);
		});
		data = {
			points,
			angles,
			source,
			triangles,
			buckets
		};
	}
	cache$1.set(name, data);
	return data;
}
/** Internal QA access: a fresh centered Y-up outline, preserving source aspect ratio. */
function materialOutline(name) {
	return contour(name).points.map((p) => [...p]);
}
//#endregion
//#region core/morph.js
const measurements = /* @__PURE__ */ new WeakMap();
const plans = /* @__PURE__ */ new WeakMap();
const wrap = (n) => (n % 1 + 1) % 1;
function measure(contour) {
	const old = measurements.get(contour);
	if (old) return old;
	const points = contour.points, distances = [0];
	for (let i = 1; i <= points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i % points.length][0] - points[i - 1][0], points[i % points.length][1] - points[i - 1][1]));
	const total = distances.pop(), result = {
		points,
		progress: distances.map((v) => v / total)
	};
	measurements.set(contour, result);
	return result;
}
function pointAt(outline, amount) {
	const p = wrap(amount), count = outline.points.length;
	let lo = 0, hi = count;
	while (lo + 1 < hi) {
		const mid = lo + hi >>> 1;
		if (outline.progress[mid] <= p) lo = mid;
		else hi = mid;
	}
	const start = outline.progress[lo], end = lo + 1 === count ? 1 : outline.progress[lo + 1], t = (p - start) / (end - start);
	const a = outline.points[lo], b = outline.points[(lo + 1) % count];
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
/** Keep repeated interrupted transitions bounded without visible approximation. */
const MAX_MORPH_POINTS = 8192;
const MORPH_SNAPSHOT_TOLERANCE = 1e-6;
function boundedSnapshot(points) {
	if (points.length <= 8192) return contourSnapshot(points);
	let tolerance = MORPH_SNAPSHOT_TOLERANCE, reduced = simplifyContourPoints(points, tolerance);
	while (reduced.length > MAX_MORPH_POINTS) {
		tolerance *= 2;
		reduced = simplifyContourPoints(points, tolerance);
	}
	return contourSnapshot(reduced);
}
const MATCH_SAMPLES = 256;
/** Minimize actual movement, without rotating or scaling either endpoint geometry. */
function bestPhase(from, to) {
	const a = Array.from({ length: MATCH_SAMPLES }, (_, i) => pointAt(from, i / MATCH_SAMPLES));
	const b = Array.from({ length: MATCH_SAMPLES }, (_, i) => pointAt(to, i / MATCH_SAMPLES));
	let minimum = Infinity, phase = 0;
	for (let shift = 0; shift < MATCH_SAMPLES; shift++) {
		let cost = 0;
		for (let i = 0; i < MATCH_SAMPLES; i++) {
			const p = a[i], q = b[(i + shift) % MATCH_SAMPLES];
			cost += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
		}
		if (cost < minimum - 1e-12) {
			minimum = cost;
			phase = shift / MATCH_SAMPLES;
		}
	}
	const cost = (offset) => a.reduce((sum, p, i) => {
		const q = pointAt(to, i / MATCH_SAMPLES + offset);
		return sum + (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
	}, 0);
	let step = 1 / MATCH_SAMPLES / 2;
	for (let i = 0; i < 10; i++, step /= 2) {
		const before = cost(phase - step), after = cost(phase + step);
		if (before < minimum && before <= after) {
			phase -= step;
			minimum = before;
		} else if (after < minimum) {
			phase += step;
			minimum = after;
		}
	}
	return wrap(phase);
}
function checked(progress) {
	if (!Number.isFinite(progress) || progress < 0 || progress > 1) throw new RangeError("Morph progress must be a finite number from 0 to 1.");
}
function asContour(value, roundness) {
	if (typeof value === "string" || value.kind !== "contour") return shapeContour(value, roundness);
	return Object.isFrozen(value) && Object.isFrozen(value.points) && value.points.every(Object.isFrozen) ? value : contourSnapshot(value.points);
}
/**
* Match whole oriented perimeters, then merge BOTH sets of boundary breakpoints.
* Every original corner remains present. Points move directly to their matches;
* there is no intermediate shape, implicit ellipse, rotation, or radius blending.
* A displayed snapshot can be used as the source of any later transition.
*/
function buildMorph(fromShape, toShape, roundness = .5) {
	const from = asContour(fromShape, roundness), to = asContour(toShape, roundness);
	let targets = plans.get(from);
	if (!targets) {
		targets = /* @__PURE__ */ new WeakMap();
		plans.set(from, targets);
	}
	const previous = targets.get(to);
	if (previous) return previous;
	if (from === to) {
		const result = Object.freeze({
			from,
			to,
			sample(progress) {
				checked(progress);
				return from;
			}
		});
		targets.set(to, result);
		return result;
	}
	const a = measure(from), b = measure(to), phase = bestPhase(a, b);
	const knots = [
		...a.progress,
		...b.progress.map((p) => wrap(p - phase)),
		0
	].sort((x, y) => x - y).filter((p, i, ps) => !i || p - ps[i - 1] > 1e-12);
	const source = knots.map((p) => pointAt(a, p)), target = knots.map((p) => pointAt(b, p + phase));
	const result = Object.freeze({
		from,
		to,
		sample(progress) {
			checked(progress);
			if (progress === 0) return from;
			if (progress === 1) return to;
			return boundedSnapshot(source.map((p, i) => {
				const q = target[i];
				return [p[0] + (q[0] - p[0]) * progress, p[1] + (q[1] - p[1]) * progress];
			}));
		}
	});
	targets.set(to, result);
	let reversed = plans.get(to);
	if (!reversed) {
		reversed = /* @__PURE__ */ new WeakMap();
		plans.set(to, reversed);
	}
	reversed.set(from, Object.freeze({
		from: to,
		to: from,
		sample(progress) {
			checked(progress);
			return result.sample(1 - progress);
		}
	}));
	return result;
}
//#endregion
//#region core/contours.js
const TAU = Math.PI * 2;
const EPSILON = 1e-12;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cache = /* @__PURE__ */ new Map();
/** Internal snapshot constructor. Coordinates are copied and deeply frozen. */
function contourSnapshot(points) {
	if (points.length < 3 || points.some((p) => p.length !== 2 || !p.every(Number.isFinite))) throw new TypeError("A contour needs at least three finite points.");
	const copy = points.filter((p, i) => !i || distance(p, points[i - 1]) > EPSILON).map((p) => [p[0], p[1]]);
	if (copy.length > 1 && distance(copy[0], copy[copy.length - 1]) <= EPSILON) copy.pop();
	if (copy.length < 3) throw new RangeError("A contour must enclose an area.");
	const area = copy.reduce((sum, p, i) => {
		const q = copy[(i + 1) % copy.length];
		return sum + p[0] * q[1] - p[1] * q[0];
	}, 0);
	if (Math.abs(area) < EPSILON) throw new RangeError("A contour must enclose an area.");
	if (area < 0) copy.reverse();
	return Object.freeze({
		kind: "contour",
		points: Object.freeze(copy.map((p) => Object.freeze(p)))
	});
}
/** Exact intersection with (1-rounding) * regular polygon + rounding * unit disk. */
function polygonRadius(shape, angle) {
	const half = Math.PI / shape.sides, sector = half * 2;
	const delta = Math.abs(((angle - shape.rotation + half) % sector + sector) % sector - half);
	const radius = shape.rounding, center = 1 - radius;
	if (delta <= Math.atan2(radius * Math.sin(half), center + radius * Math.cos(half))) return center * Math.cos(delta) + Math.sqrt(Math.max(0, radius * radius - (center * Math.sin(delta)) ** 2));
	return (center * Math.cos(half) + radius) / Math.cos(half - delta);
}
function primitiveMap(shape, roundness) {
	if (typeof shape !== "string" && shape.kind === "ellipse") return (x, y) => [x, y];
	if (typeof shape !== "string" && shape.kind === "rounded-polygon") return (x, y) => {
		const r = polygonRadius(shape, Math.atan2(y, x));
		return [x * r, y * r];
	};
	const name = typeof shape === "string" ? shape : shape.name;
	return (x, y) => {
		const r = Math.hypot(x, y);
		if (r < EPSILON) return [0, 0];
		const nx = x / r, ny = y / r, exponent = name === "rounded-box" ? 2 + (1 - roundness) * 6 : 2;
		const extent = (Math.abs(nx) ** exponent + Math.abs(ny) ** exponent) ** (-1 / exponent);
		return [x * extent * (name === "droplet" ? .9 - .32 * ny : 1), y * extent];
	};
}
/** Evaluate a serializable recipe into an immutable outline, including manual morphs. */
function shapeContour(shape, roundness = .5) {
	const key = `${roundness}:${JSON.stringify(shape)}`;
	const previous = cache.get(key);
	if (previous) return previous;
	let result;
	if (typeof shape !== "string" && shape.kind === "morph") result = buildMorph(shape.from, shape.to, roundness).sample(shape.progress);
	else if (typeof shape !== "string" && shape.kind === "material") result = contourSnapshot(materialOutline(shape.name));
	else {
		const map = primitiveMap(shape, roundness), angles = Array.from({ length: 720 }, (_, i) => i / 720 * TAU);
		if (typeof shape !== "string" && shape.kind === "rounded-polygon") for (let i = 0; i < shape.sides; i++) angles.push(((shape.rotation + i * TAU / shape.sides) % TAU + TAU) % TAU);
		angles.sort((a, b) => a - b);
		result = contourSnapshot(angles.map((a) => map(Math.cos(a), Math.sin(a))));
	}
	if (cache.size >= 128) cache.delete(cache.keys().next().value);
	cache.set(key, result);
	return result;
}
/** Bounded visual tessellation error; immutable snapshots retain full source fidelity. */
const CONTOUR_MAPPING_TOLERANCE = 75e-5;
function simplifyContourPoints(points, tolerance = CONTOUR_MAPPING_TOLERANCE) {
	const count = points.length;
	const earlier = (a, b) => points[a][0] < points[b][0] || points[a][0] === points[b][0] && points[a][1] < points[b][1];
	let first = 0, opposite = 0, farthest = -1;
	for (let i = 1; i < count; i++) if (earlier(i, first)) first = i;
	for (let i = 0; i < count; i++) {
		const d = (points[i][0] - points[first][0]) ** 2 + (points[i][1] - points[first][1]) ** 2;
		if (d > farthest || d === farthest && earlier(i, opposite)) {
			farthest = d;
			opposite = i;
		}
	}
	const last = opposite > first ? opposite : opposite + count, selected = /* @__PURE__ */ new Set([first, opposite]);
	function visit(first, last) {
		const a = points[first % count], b = points[last % count], dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
		let best = tolerance ** 2, chosen = -1;
		for (let i = first + 1; i < last; i++) {
			const p = points[i % count], t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
			const error = (p[0] - a[0] - dx * t) ** 2 + (p[1] - a[1] - dy * t) ** 2;
			if (error > best) {
				best = error;
				chosen = i;
			}
		}
		if (chosen >= 0) {
			selected.add(chosen % count);
			visit(first, chosen);
			visit(chosen, last);
		}
	}
	visit(first, last);
	visit(last, first + count);
	return [...selected].sort((a, b) => a - b).map((i) => points[i]);
}
const distanceOutlines = /* @__PURE__ */ new WeakMap();
/** Current planar outline, simplified below 0.1 pixel at a 256px display width. */
function contourDistanceOutline(contour) {
	let points = distanceOutlines.get(contour);
	if (!points) {
		points = Object.freeze(simplifyContourPoints(contour.points).map((p) => Object.freeze([p[0], p[1]])));
		distanceOutlines.set(contour, points);
	}
	return points;
}
const DISTANCE_STRIDE = 10;
const WINDING_BUCKETS = 64;
const distanceIndexes = /* @__PURE__ */ new WeakMap();
const exactDistanceIndexes = /* @__PURE__ */ new WeakMap();
function makeDistanceIndex(contour, exact = false) {
	const points = exact ? contour.points : contourDistanceOutline(contour), edges = new Float64Array(points.length * DISTANCE_STRIDE);
	for (let i = 0; i < points.length; i++) {
		const a = points[i], b = points[(i + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1];
		edges.set([
			a[0],
			a[1],
			dx,
			dy,
			1 / (dx * dx + dy * dy),
			b[1],
			Math.min(a[0], b[0]),
			Math.min(a[1], b[1]),
			Math.max(a[0], b[0]),
			Math.max(a[1], b[1])
		], i * DISTANCE_STRIDE);
	}
	const build = (segments) => {
		const node = {
			minX: Infinity,
			minY: Infinity,
			maxX: -Infinity,
			maxY: -Infinity
		};
		for (const offset of segments) {
			node.minX = Math.min(node.minX, edges[offset + 6]);
			node.minY = Math.min(node.minY, edges[offset + 7]);
			node.maxX = Math.max(node.maxX, edges[offset + 8]);
			node.maxY = Math.max(node.maxY, edges[offset + 9]);
		}
		if (segments.length <= 6) node.segments = segments;
		else {
			const axis = node.maxX - node.minX >= node.maxY - node.minY ? 6 : 7;
			segments.sort((a, b) => edges[a + axis] + edges[a + axis + 2] - edges[b + axis] - edges[b + axis + 2]);
			const middle = segments.length >>> 1;
			node.left = build(segments.slice(0, middle));
			node.right = build(segments.slice(middle));
		}
		return node;
	};
	const root = build(points.map((_, i) => i * DISTANCE_STRIDE)), minY = root.minY, maxY = root.maxY, yScale = WINDING_BUCKETS / (maxY - minY);
	const buckets = Array.from({ length: WINDING_BUCKETS }, () => []);
	for (let offset = 0; offset < edges.length; offset += DISTANCE_STRIDE) {
		if (edges[offset + 3] === 0) continue;
		const first = Math.max(0, Math.min(63, Math.floor((edges[offset + 7] - minY) * yScale)));
		const last = Math.max(0, Math.min(63, Math.floor((edges[offset + 9] - minY) * yScale)));
		for (let b = first; b <= last; b++) buckets[b].push(offset);
	}
	const index = {
		nearest: 0,
		edges,
		root,
		buckets,
		minY,
		maxY,
		yScale
	};
	(exact ? exactDistanceIndexes : distanceIndexes).set(contour, index);
	return index;
}
function boxDistance(node, x, y) {
	const dx = x < node.minX ? node.minX - x : x > node.maxX ? x - node.maxX : 0;
	const dy = y < node.minY ? node.minY - y : y > node.maxY ? y - node.maxY : 0;
	return dx * dx + dy * dy;
}
/** Allocation-free nearest-edge query over the current outline's cached AABB tree. */
function nearestDistance(node, index, x, y, best) {
	const edges = index.edges;
	if (node.segments) {
		for (const i of node.segments) {
			const ax = edges[i], ay = edges[i + 1], dx = edges[i + 2], dy = edges[i + 3];
			const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) * edges[i + 4]));
			const ex = x - ax - t * dx, ey = y - ay - t * dy;
			const distance = ex * ex + ey * ey;
			if (distance < best) {
				best = distance;
				index.nearest = i;
			}
		}
		return best;
	}
	const left = node.left, right = node.right, dl = boxDistance(left, x, y), dr = boxDistance(right, x, y);
	if (dl <= dr) {
		if (dl < best) best = nearestDistance(left, index, x, y, best);
		if (dr < best) best = nearestDistance(right, index, x, y, best);
	} else {
		if (dr < best) best = nearestDistance(right, index, x, y, best);
		if (dl < best) best = nearestDistance(left, index, x, y, best);
	}
	return best;
}
/** Positive inside, negative outside, zero on the current renderer silhouette. */
function signedDistance(index, x, y) {
	const { edges } = index;
	const offset = index.nearest, ax = edges[offset], ay = edges[offset + 1], dx = edges[offset + 2], dy = edges[offset + 3];
	const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) * edges[offset + 4]));
	const ex = x - ax - t * dx, ey = y - ay - t * dy;
	const minimum = nearestDistance(index.root, index, x, y, ex * ex + ey * ey);
	let contained = false;
	if (y >= index.minY && y <= index.maxY) {
		const bucket = Math.max(0, Math.min(63, Math.floor((y - index.minY) * index.yScale)));
		for (const i of index.buckets[bucket]) {
			const ay = edges[i + 1], by = edges[i + 5];
			if (ay > y !== by > y && x < edges[i + 2] * (y - ay) / edges[i + 3] + edges[i]) contained = !contained;
		}
	}
	return Math.sqrt(minimum) * (contained ? 1 : -1);
}
/** Current renderer field, retaining its bounded outline simplification. */
function contourSignedDistance(contour, x, y) {
	return signedDistance(distanceIndexes.get(contour) ?? makeDistanceIndex(contour), x, y);
}
//#endregion
//#region core/expressions.js
const EYE_EXPRESSIONS = Object.freeze([
	"neutral",
	"smile",
	"blink"
]);
const EYE_STATE_RANGES = Object.freeze({ weights: Object.freeze({
	smile: Object.freeze([0, 1]),
	blink: Object.freeze([0, 1])
}) });
const EYE_STATE_DEFAULTS = Object.freeze({ weights: Object.freeze({
	smile: 0,
	blink: 0
}) });
function eyeRecord(value, path, keys) {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${path}: 객체가 필요합니다.`);
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path}: 일반 객체가 필요합니다.`);
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== "string" || !keys.includes(key)) throw new TypeError(`${path}.${String(key)}: 지원하지 않는 항목입니다.`);
		const field = Object.getOwnPropertyDescriptor(value, key);
		if (!field.enumerable || !Object.hasOwn(field, "value")) throw new TypeError(`${path}.${key}: 일반 데이터 항목이 필요합니다.`);
	}
	return value;
}
function eyeNumber(value, range, path) {
	if (typeof value !== "number" || !Number.isFinite(value) || value < range[0] || value > range[1]) throw new RangeError(`${path}: ${range[0]}~${range[1]}의 유한한 숫자가 필요합니다.`);
	return value;
}
function eyeExpression(value, path) {
	if (typeof value !== "string" || !EYE_EXPRESSIONS.includes(value)) throw new TypeError(`${path}: neutral, smile, blink 중 하나여야 합니다.`);
	return value;
}
function eyeExpressionWeights(expression) {
	const preset = eyeExpression(expression, "expression");
	return {
		smile: preset === "smile" ? 1 : 0,
		blink: preset === "blink" ? 1 : 0
	};
}
/** Validate a complete canonical state and return an isolated copy. */
function parseEyeState(input, path = "eye") {
	const weights = eyeRecord(eyeRecord(input, path, ["weights"]).weights, `${path}.weights`, ["smile", "blink"]);
	return { weights: {
		smile: eyeNumber(weights.smile, EYE_STATE_RANGES.weights.smile, `${path}.weights.smile`),
		blink: eyeNumber(weights.blink, EYE_STATE_RANGES.weights.blink, `${path}.weights.blink`)
	} };
}
/** Atomic partial weight patch. Legacy selectors normalize once; mixed input rejects. */
function patchEyeState(state, patch, path = "eye") {
	const current = parseEyeState(state, path);
	const change = eyeRecord(patch, path, [
		"weights",
		"expression",
		"openness"
	]);
	if (Object.hasOwn(change, "expression") || Object.hasOwn(change, "openness")) {
		if (Object.hasOwn(change, "weights")) throw new TypeError(`${path}: expression/openness와 weights를 함께 사용할 수 없습니다.`);
		if (Object.hasOwn(change, "expression")) current.weights = eyeExpressionWeights(eyeExpression(change.expression, `${path}.expression`));
		if (Object.hasOwn(change, "openness")) {
			const openness = eyeNumber(change.openness, EYE_STATE_RANGES.weights.blink, `${path}.openness`);
			current.weights.blink = change.expression === "blink" ? 1 : 1 - openness;
		}
		return current;
	}
	if (Object.hasOwn(change, "weights")) current.weights = {
		...current.weights,
		...eyeRecord(change.weights, `${path}.weights`, ["smile", "blink"])
	};
	return parseEyeState(current, path);
}
function createEyeState(patch = {}) {
	return patchEyeState(EYE_STATE_DEFAULTS, patch);
}
//#endregion
//#region core/crown-profiles.js
const CROWN_SUPPORTS = Object.freeze({
	circle: [
		0,
		1,
		0,
		1.45
	],
	square: [
		-.3,
		1,
		-8,
		1.3
	],
	slanted: [
		-.37,
		.92,
		-10,
		1.18
	],
	arch: [
		-.12,
		1,
		-7,
		1.28
	],
	fan: [
		-.68,
		.98,
		-19.5,
		1.12
	],
	arrow: [
		0,
		.83,
		0,
		1.01,
		90
	],
	semiCircle: [
		-.1,
		.625,
		-8,
		1.25
	],
	oval: [
		.44,
		.97,
		8,
		1.18
	],
	pill: [
		.1,
		1,
		0,
		1.28
	],
	triangle: [
		0,
		.84,
		0,
		.95,
		-90
	],
	diamond: [
		0,
		.98,
		0,
		.95,
		-90
	],
	clamShell: [
		-.4,
		.67,
		-12,
		1.2
	],
	pentagon: [
		-.24,
		.91,
		-18,
		1.18
	],
	gem: [
		-.16,
		1,
		-14,
		1.11
	],
	verySunny: [
		0,
		.96,
		0,
		1
	],
	sunny: [
		0,
		.99,
		1,
		1.12
	],
	cookie4Sided: [
		.386,
		.876,
		5,
		1.1
	],
	cookie6Sided: [
		-.16,
		.95,
		-12,
		1.14
	],
	cookie7Sided: [
		-.08,
		.95,
		-6,
		1.05
	],
	cookie9Sided: [
		.02,
		.97,
		1,
		1.01
	],
	cookie12Sided: [
		-.18,
		.99,
		-9,
		1.12
	],
	ghostish: [
		0,
		1,
		0,
		1.45
	],
	clover4Leaf: [
		.435,
		.944,
		9,
		1.12
	],
	clover8Leaf: [
		.36,
		.926,
		22,
		1
	],
	burst: [
		-.18,
		1,
		-5,
		.98
	],
	softBurst: [
		.12,
		.98,
		-4,
		1.06
	],
	boom: [
		.32,
		.99,
		35,
		.95,
		90
	],
	softBoom: [
		.18,
		1,
		15,
		1.05
	],
	flower: [
		-.08,
		1,
		-13,
		1.04,
		90
	],
	puffy: [
		0,
		.793,
		0,
		1.43,
		90
	],
	puffyDiamond: [
		0,
		1,
		-1,
		1.03,
		-90
	],
	pixelCircle: [
		-.34,
		1,
		-18,
		1.11
	],
	pixelTriangle: [
		-.35,
		.9,
		8,
		1.12
	],
	bun: [
		-.55,
		1,
		-17,
		1.22
	],
	heart: [
		.49,
		.837,
		-6,
		1.28,
		-90
	]
});
for (const support of Object.values(CROWN_SUPPORTS)) Object.freeze(support);
//#endregion
//#region core/shape-profiles.js
/** Maximum world-unit volume depth. XY retains the Material catalog outline. */
const BODY_DEPTH_RANGE = Object.freeze([.08, 1.2]);
const MOUNT_UV_RANGE = Object.freeze([-.65, .65]);
const MOUNT_OFFSET_RANGE = Object.freeze([0, .25]);
/** Per-shape multipliers of the global neutral eye dimensions and spacing. */
const EYE_PROFILE_SCALE_RANGE = Object.freeze([.5, 1.5]);
/** Additive surface-chart V adjustment, independent of expression weights. */
const EYE_PROFILE_OFFSET_Y_RANGE = Object.freeze([-.35, .35]);
function immutable(profile) {
	Object.freeze(profile.eyes);
	Object.freeze(profile.scarfFit);
	Object.freeze(profile.beretFitCenter);
	for (const mount of Object.values(profile.accessories)) {
		Object.freeze(mount.anchor.uv);
		Object.freeze(mount.anchor);
		Object.freeze(mount.rotation);
		Object.freeze(mount);
	}
	Object.freeze(profile.accessories);
	Object.freeze(profile.mounts.head.uv);
	Object.freeze(profile.mounts.face.uv);
	Object.freeze(profile.mounts.head);
	Object.freeze(profile.mounts.face);
	Object.freeze(profile.mounts);
	return Object.freeze(profile);
}
/**
* Lower-face and lower-body junctions are semantic: these bodies have no neck
* or ears. Values are canonical XY, not proportions of a fabricated skeleton.
* Narrow lower lobes receive a smaller tie/collar; low eyes get a lower mouth.
* Tuple: mouth Y, neck Y, size, left/right ear phase, ear size, mouth/neck tilt.
* Earring phase chooses the side shoulder, while its independent upright plane
* keeps both hoops readable from the front instead of copying the radial tilt.
*/
const SCARF_SUPPORT_FITS = {
	circle: [
		0,
		-.7043028677966102,
		-.6903857993674681,
		.7065683087210856
	],
	square: [
		-.65,
		-.9146402343230225,
		-.5608723238291164,
		.44926972606263565
	],
	slanted: [
		.65,
		-.8776301303284545,
		-.37035504573926076,
		.4487135928452314
	],
	arch: [
		.65,
		-.9278094740403311,
		-.4319463690631626,
		.5508609443062376
	],
	fan: [
		-.65,
		-.9037515535527462,
		-.5680077864386106,
		.4635930850040692
	],
	arrow: [
		-.65,
		-.8072930503931397,
		-.4972642182290799,
		.1596685923689511
	],
	semiCircle: [
		.65,
		-.8200923866922157,
		.04600265142827109,
		.626387862511066
	],
	oval: [
		0,
		-.6606667148635399,
		-.9215281747767934,
		.3681018018427239
	],
	pill: [
		0,
		-.6774695444915254,
		-.8081195367069213,
		.5381359550072768
	],
	triangle: [
		-.65,
		-.7892793479151976,
		-.45626727854430976,
		.3570214054414213
	],
	diamond: [
		0,
		-.7243776483050847,
		-.36010181311868933,
		.36010170816838877
	],
	clamShell: [
		0,
		-.5353573754237289,
		-.7274880259914442,
		.7289982321274535
	],
	pentagon: [
		0,
		-.649423403898305,
		-.7262296374824084,
		.7262293689852015
	],
	gem: [
		0,
		-.7195795791525422,
		-.7171965450773221,
		.7222448715315412
	],
	verySunny: [
		.65,
		-.7437119591137938,
		-.6359442413868442,
		.3099706887674314
	],
	sunny: [
		0,
		-.7122632788135592,
		-.6762323972390384,
		.6886114985706523
	],
	cookie4Sided: [
		.65,
		-.8277928733600068,
		-.30444970644089814,
		.46794655374309446
	],
	cookie6Sided: [
		0,
		-.6743059644067796,
		-.6122682536054963,
		.6106680547433238
	],
	cookie7Sided: [
		0,
		-.7048879493583535,
		-.5890649568703806,
		.5890649920600484
	],
	cookie9Sided: [
		0,
		-.6591156130894573,
		-.602682861332208,
		.60268297038875
	],
	cookie12Sided: [
		0,
		-.6626009940677966,
		-.5996312705291823,
		.5996311995555335
	],
	ghostish: [
		.65,
		-.9021933096097198,
		-.22138737397170477,
		.5116246310086562
	],
	clover4Leaf: [
		-.65,
		-.8490915339534914,
		-.5393894335135024,
		.3961241176099506
	],
	clover8Leaf: [
		0,
		-.7052212829056651,
		-.5737213020823895,
		.5719377134167324
	],
	burst: [
		.65,
		-.560371519908502,
		-.5769907138630938,
		.7830872687639728
	],
	softBurst: [
		0,
		-.6259003721186441,
		-.6143318667117458,
		.6151981866889252
	],
	boom: [
		.65,
		-.43,
		-.28796896398198396,
		.253132093188177
	],
	softBoom: [
		.65,
		-.7,
		-.02800255261752488,
		.21636828997603008
	],
	flower: [
		0,
		-.6136574957627119,
		-.7432241344487527,
		.7443211114716622
	],
	puffy: [
		-.65,
		-.84,
		-.4093640809550523,
		-.07184240043707998
	],
	puffyDiamond: [
		0,
		-.6158633474576272,
		-.4757797573073582,
		.47577957253228886
	],
	pixelCircle: [
		-.65,
		-.8770834061912458,
		-.40351306170000234,
		.49867325337264384
	],
	pixelTriangle: [
		0,
		-.55,
		-.7746996983519764,
		.1219997463149052
	],
	bun: [
		-.65,
		-.8695092438017838,
		-.5362067950222944,
		.5086366414343984
	],
	heart: [
		0,
		-.6577334288135593,
		-.19849493208295776,
		.1984949628724318
	]
};
const LOWER_ACCESSORY_FITS = {
	circle: [
		-.3,
		-.69,
		1,
		-.2,
		-.2,
		1,
		.26,
		.76
	],
	square: [
		-.3,
		-.72,
		1,
		-.3,
		-.3,
		1,
		.23,
		.73
	],
	slanted: [
		-.3,
		-.65,
		.95,
		-.5,
		-.2,
		.95,
		.24,
		.7
	],
	arch: [
		-.34,
		-.72,
		1,
		.2,
		.2,
		1,
		.27,
		.73
	],
	fan: [
		-.32,
		-.68,
		.92,
		-.3,
		-.3,
		.9,
		.23,
		.64
	],
	arrow: [
		-.32,
		-.53,
		.78,
		-.3,
		-.3,
		.85,
		.38,
		.89
	],
	semiCircle: [
		-.27,
		-.49,
		.82,
		-.3,
		-.3,
		.86,
		.4,
		1.03
	],
	oval: [
		-.29,
		-.66,
		.85,
		-.4,
		-.3,
		.9,
		.28,
		.82
	],
	pill: [
		-.3,
		-.68,
		.94,
		-.1,
		-.2,
		.94,
		.26,
		.75
	],
	triangle: [
		-.44,
		-.69,
		.82,
		-.4,
		-.4,
		.9,
		.42,
		.85
	],
	diamond: [
		-.33,
		-.69,
		.86,
		-.2,
		-.2,
		.9,
		.26,
		.59
	],
	clamShell: [
		-.27,
		-.53,
		.85,
		-.2,
		-.2,
		.88,
		.37,
		1.02
	],
	pentagon: [
		-.33,
		-.67,
		.94,
		-.1,
		-.1,
		.96,
		.28,
		.76
	],
	gem: [
		-.31,
		-.7,
		.96,
		-.3,
		-.3,
		.96,
		.23,
		.67
	],
	verySunny: [
		-.29,
		-.65,
		.84,
		-.2,
		-.2,
		.88,
		.19,
		.43
	],
	sunny: [
		-.31,
		-.68,
		.92,
		-.2,
		-.2,
		.94,
		.21,
		.53
	],
	cookie4Sided: [
		-.29,
		-.6,
		.86,
		.1,
		.1,
		.92,
		.3,
		.9
	],
	cookie6Sided: [
		-.3,
		-.68,
		.96,
		-.3,
		-.3,
		.96,
		.22,
		.67
	],
	cookie7Sided: [
		-.3,
		-.65,
		.94,
		-.2,
		-.2,
		.94,
		.24,
		.76
	],
	cookie9Sided: [
		-.3,
		-.68,
		.96,
		-.2,
		-.2,
		.94,
		.21,
		.72
	],
	cookie12Sided: [
		-.3,
		-.69,
		.98,
		-.2,
		-.2,
		.96,
		.2,
		.56
	],
	ghostish: [
		-.29,
		-.61,
		.92,
		-.2,
		-.2,
		.96,
		.36,
		1.09
	],
	clover4Leaf: [
		-.3,
		-.62,
		.84,
		.1,
		.1,
		.88,
		.33,
		.92
	],
	clover8Leaf: [
		-.3,
		-.65,
		.92,
		-.3,
		-.3,
		.94,
		.25,
		.79
	],
	burst: [
		-.29,
		-.61,
		.78,
		-.2,
		-.2,
		.84,
		.21,
		.45
	],
	softBurst: [
		-.3,
		-.65,
		.86,
		-.3,
		-.3,
		.9,
		.23,
		.51
	],
	boom: [
		-.24,
		-.42,
		.6,
		-.2,
		-.2,
		.76,
		.46,
		1.21
	],
	softBoom: [
		-.33,
		-.61,
		.68,
		0,
		0,
		.82,
		.7,
		.25
	],
	flower: [
		-.3,
		-.63,
		.84,
		-.2,
		-.2,
		.9,
		.34,
		.52
	],
	puffy: [
		-.26,
		-.56,
		.88,
		-.2,
		-.2,
		.94,
		.5,
		1.23
	],
	puffyDiamond: [
		-.31,
		-.65,
		.82,
		-.2,
		-.2,
		.9,
		.39,
		.5
	],
	pixelCircle: [
		-.3,
		-.71,
		.98,
		-.3,
		-.3,
		.96,
		.19,
		.63
	],
	pixelTriangle: [
		-.31,
		-.53,
		.68,
		-.3,
		-.2,
		.82,
		.55,
		.76
	],
	bun: [
		-.32,
		-.7,
		.82,
		.2,
		.2,
		.9,
		.25,
		.76
	],
	heart: [
		-.36,
		-.65,
		.82,
		-.5,
		-.5,
		.92,
		.47,
		.82
	]
};
/** Rigid bow ties bridge two lower lobes: lift the junction before it reaches a notch. */
const BOW_TIE_FITS = {
	oval: [
		-.52,
		.85,
		.5
	],
	cookie4Sided: [
		-.54,
		.86,
		.7
	],
	ghostish: [
		-.53,
		.92,
		.8
	],
	clover4Leaf: [
		-.52,
		.84,
		.6
	],
	clover8Leaf: [
		-.55,
		.92,
		.5
	],
	boom: [
		-.38,
		.48,
		1
	],
	puffy: [
		-.48,
		.8,
		.8
	]
};
/** Stable local wearing centers from the approved catalog poses. Interpolate the
* selected support, never reselect a distant highest lobe during motion. */
const BERET_SUPPORT_CENTERS = {
	circle: [.004596015671502911, 0],
	square: [-.025, 0],
	slanted: [.035, 0],
	arch: [.002067339314523273, 0],
	fan: [-.1759169844193554, 0],
	arrow: [-.16759627229074692, 0],
	semiCircle: [.09184907839413926, 0],
	oval: [.025, 0],
	pill: [.04162347957437888, 0],
	triangle: [-.05830468228063125, 0],
	diamond: [-.2044561623254606, 4035150652910108e-34],
	clamShell: [.159748112279751, 0],
	pentagon: [-.05, 0],
	gem: [-.13745434594416545, 0],
	verySunny: [-.08495, 0],
	sunny: [-.08714, 0],
	cookie4Sided: [.1170019455796487, 0],
	cookie6Sided: [-.005492934142114092, 0],
	cookie7Sided: [-.048269063932298406, 0],
	cookie9Sided: [-.03, 0],
	cookie12Sided: [-.0038804988258414282, 0],
	ghostish: [-.00826846543776016, 0],
	clover4Leaf: [.10643363465837054, 0],
	clover8Leaf: [-.054168759097783216, -3166000527301816e-34],
	burst: [.0004603794263204446, 0],
	softBurst: [.058, 0],
	boom: [-.0774359305907004, -170229848100482e-33],
	softBoom: [-.0708967251958692, 0],
	flower: [.01, 0],
	puffy: [-.055, 0],
	puffyDiamond: [-.1420218633683929, 0],
	pixelCircle: [-.055, 0],
	pixelTriangle: [-.42, 0],
	bun: [-.035, 0],
	heart: [.002082470543027959, 5073613683801476e-34]
};
/** Authored curl limits preserve the reviewed neutral garments. These values
* were calibrated against the actual shell/body triangle audit at default depth.
* Interpolate them as ordinary profile data: a per-frame ray-hit limiter can
* switch winners abruptly during morphs. Final cloth contact is still checked
* against actual triangles; these values alone are not collision guarantees. */
const BERET_DRAPE_LIMITS = {
	verySunny: .7,
	burst: 0,
	softBurst: 1,
	softBoom: .0735820627175312,
	puffyDiamond: .42053994400183065,
	pixelCircle: .11545256551201084,
	pixelTriangle: .9000745129671436,
	heart: .8313476587534501
};
/** Authored compact shell, aperture, free hem and support angle. Flower keeps a smooth .72 shell with a roomy aperture; placement aligns
* its two petal contacts without forcing an undulating cuff or crown. Accepted legacy fits remain exactly neutral. */
const BERET_FIT_PROFILES = {
	circle: [
		.85,
		1,
		1,
		-20
	],
	square: [
		.82,
		1,
		1,
		-22
	],
	slanted: [
		.82,
		1,
		1,
		-22
	],
	arch: [
		.85,
		1,
		1,
		-20
	],
	fan: [
		.82,
		1,
		1,
		-25
	],
	arrow: [
		.75,
		.35,
		.5,
		-30
	],
	semiCircle: [
		.82,
		1,
		1,
		-25
	],
	oval: [
		.82,
		1,
		1,
		-30
	],
	pill: [
		.82,
		1,
		1,
		-25
	],
	triangle: [
		.72,
		.25,
		1,
		-10
	],
	clamShell: [
		.78,
		.8,
		1,
		-25
	],
	pentagon: [
		.82,
		1,
		0,
		0
	],
	gem: [
		.82,
		1,
		1,
		-25
	],
	verySunny: [
		.72,
		1,
		.65,
		-5
	],
	sunny: [
		.75,
		1,
		.65,
		-5
	],
	cookie4Sided: [
		.82,
		1,
		1,
		-25
	],
	cookie6Sided: [
		.82,
		1,
		1,
		-30
	],
	cookie7Sided: [
		.82,
		1,
		1,
		-25
	],
	cookie9Sided: [
		.82,
		1,
		1,
		-20
	],
	ghostish: [
		.85,
		1,
		1,
		-20
	],
	clover4Leaf: [
		.82,
		1,
		1,
		-25
	],
	burst: [
		.72,
		1,
		1,
		-30
	],
	softBurst: [
		.8,
		1,
		1.5,
		10
	],
	softBoom: [
		.75,
		.4,
		1,
		-30
	],
	puffy: [
		.85,
		1,
		1,
		0
	],
	puffyDiamond: [
		.72,
		.3,
		.6,
		-20
	],
	pixelCircle: [
		.82,
		1,
		1,
		-15
	],
	bun: [
		.78,
		.5,
		.7,
		-24
	],
	heart: [
		.72,
		.08,
		0,
		-38
	],
	flower: [
		.72,
		1,
		0,
		-11
	],
	boom: [
		.72,
		0,
		.7,
		-32
	],
	pixelTriangle: [
		.72,
		1,
		0,
		-23
	]
};
/** A complete fit record is built independently for each accessory and shape. */
function defaults$1(shape, depth, eyes, beretU, beretTilt, beretScale = 1, haloHeight = .22, glassesScale = 1) {
	const [width, height, spacing, offsetY] = eyes;
	const [mouthY, neckY, size, leftEarV, rightEarV, earSize, mouthTilt, neckTilt] = LOWER_ACCESSORY_FITS[shape];
	const tie = BOW_TIE_FITS[shape];
	const fit = BERET_FIT_PROFILES[shape];
	const [crownX, crownY, crownTilt, crownScale, crownYaw = 0] = CROWN_SUPPORTS[shape];
	const front = (y, scale, tilt = 0) => ({
		anchor: {
			region: "face",
			uv: [0, Math.atan(y) / .9],
			offset: 0
		},
		rotation: [
			tilt,
			0,
			0
		],
		scale
	});
	return immutable({
		beretApertureX: shape === "pentagon" ? .73 : shape === "flower" ? .82 : shape === "pixelTriangle" ? .87 : 1,
		beretApertureZ: shape === "flower" ? 1.08 : 1,
		beretFitSize: fit?.[0] ?? .72,
		beretFitOpening: fit?.[1] ?? 0,
		beretWrapStrength: fit?.[2] ?? 0,
		beretDrapeLimit: BERET_DRAPE_LIMITS[shape] ?? 1,
		beretFitTransition: 0,
		beretDrapeStrength: fit && (fit[2] > 0 || [
			"pentagon",
			"flower",
			"pixelTriangle"
		].includes(shape)) ? 0 : shape === "softBoom" ? .12 : shape === "pixelCircle" ? .12 : shape === "puffyDiamond" ? .4 : shape === "verySunny" ? .6 : shape === "softBurst" ? .9 : 1,
		beretFitRoom: fit ? 1 : [
			"heart",
			"flower",
			"pixelTriangle",
			"burst",
			"pixelCircle",
			"puffyDiamond",
			"verySunny",
			"softBurst",
			"softBoom",
			"boom"
		].includes(shape) ? 1 : 0,
		beretFitTilt: (fit?.[3] ?? (shape === "cookie6Sided" ? -40 : shape === "heart" ? -40 : shape === "flower" ? -46 : shape === "pixelTriangle" ? 15 : shape === "triangle" ? -14 : shape === "boom" ? -32 : shape === "square" || shape === "bun" ? -42 : -30)) * Math.PI / 180,
		beretFitCenter: BERET_SUPPORT_CENTERS[shape],
		scarfFit: SCARF_SUPPORT_FITS[shape],
		depth,
		eyes: {
			width,
			height,
			spacing,
			offsetY
		},
		mounts: {
			head: {
				uv: [0, 0],
				offset: 0
			},
			face: {
				uv: [0, 0],
				offset: 0
			}
		},
		accessories: {
			beret: {
				anchor: {
					region: "crown",
					uv: [beretU, 0],
					offset: 0
				},
				rotation: [
					0,
					beretTilt,
					0
				],
				scale: beretScale
			},
			crown: {
				anchor: {
					region: "crown",
					uv: [crownX, crownY],
					offset: 0
				},
				rotation: [
					0,
					crownTilt * Math.PI / 180,
					crownYaw * Math.PI / 180
				],
				scale: crownScale
			},
			halo: {
				anchor: {
					region: "crown",
					uv: [0, 0],
					offset: haloHeight
				},
				rotation: [
					0,
					0,
					0
				],
				scale: 1
			},
			glasses: {
				anchor: {
					region: "face",
					uv: [0, .1],
					offset: 0
				},
				rotation: [
					0,
					0,
					0
				],
				scale: glassesScale
			},
			sunglasses: {
				anchor: {
					region: "face",
					uv: [0, .1],
					offset: 0
				},
				rotation: [
					0,
					0,
					0
				],
				scale: glassesScale
			},
			moustache: front(mouthY, size, mouthTilt),
			goatee: front(mouthY - .015, size * .88, mouthTilt),
			bowTie: tie ? front(...tie) : front(neckY, size, neckTilt),
			scarf: front(shape === "softBoom" ? -.46 : neckY, size),
			necklace: front(tie ? tie[0] + .03 : neckY + .055, size * .92),
			leftStarEarring: {
				anchor: {
					region: "left",
					uv: [0, leftEarV],
					offset: 0
				},
				rotation: [
					0,
					Math.PI / 2,
					0
				],
				scale: earSize
			},
			rightStarEarring: {
				anchor: {
					region: "right",
					uv: [0, rightEarV],
					offset: 0
				},
				rotation: [
					0,
					-Math.PI / 2,
					0
				],
				scale: earSize
			},
			leftEarring: {
				anchor: {
					region: "left",
					uv: [0, leftEarV],
					offset: 0
				},
				rotation: [
					0,
					Math.PI / 2,
					0
				],
				scale: earSize
			},
			rightEarring: {
				anchor: {
					region: "right",
					uv: [0, rightEarV],
					offset: 0
				},
				rotation: [
					0,
					-Math.PI / 2,
					0
				],
				scale: earSize
			}
		}
	});
}
/**
* Curated fit for every catalog outline. Rounded and pointed crowns use their
* actual top; split crowns choose a broad neighboring lobe. Each beret's band
* has its own deliberately chosen plane instead of inheriting its lobe's radial
* angle. In particular the heart uses the right lobe summit and a level band.
* Halo placement is independently centered over the current crown envelope.
* Glasses use neutral eye calibration in one rigid front plane with shared clearance.
* None of these internal choices changes the Material catalog XY contour.
*/
const DEFAULT_SHAPE_PROFILES = Object.freeze({
	circle: defaults$1("circle", 1, [
		1.04,
		1.04,
		1.02,
		0
	], 0, -.06),
	square: defaults$1("square", .9, [
		1,
		1,
		1,
		0
	], 0, 0),
	slanted: defaults$1("slanted", .82, [
		.96,
		1,
		.94,
		0
	], -.1, 0),
	arch: defaults$1("arch", .9, [
		1,
		1.04,
		.96,
		-.04
	], 0, -.04),
	fan: defaults$1("fan", .82, [
		.92,
		.94,
		.9,
		-.04
	], -.38, .06, .9),
	arrow: defaults$1("arrow", .7, [
		.86,
		.88,
		.8,
		-.06
	], 0, 0, .94),
	semiCircle: defaults$1("semiCircle", .86, [
		.92,
		.78,
		1,
		-.02
	], 0, -.04),
	oval: defaults$1("oval", .88, [
		.86,
		.94,
		.82,
		0
	], .3, -.02, .94),
	pill: defaults$1("pill", 1, [
		.96,
		1.02,
		.94,
		0
	], .1, -.04),
	triangle: defaults$1("triangle", .72, [
		.82,
		.86,
		.78,
		-.18
	], 0, 0, .94),
	diamond: defaults$1("diamond", .78, [
		.88,
		.98,
		.82,
		-.04
	], 0, 0, .94),
	clamShell: defaults$1("clamShell", .9, [
		1.04,
		.76,
		1.02,
		-.02
	], 0, 0),
	pentagon: defaults$1("pentagon", .84, [
		.98,
		.98,
		.94,
		-.04
	], 0, 0),
	gem: defaults$1("gem", .84, [
		.98,
		1,
		.96,
		-.02
	], 0, -.04),
	verySunny: defaults$1("verySunny", .58, [
		.84,
		.86,
		.84,
		-.02
	], 0, 0, .94, .24),
	sunny: defaults$1("sunny", .66, [
		.92,
		.94,
		.9,
		-.02
	], 0, 0),
	cookie4Sided: defaults$1("cookie4Sided", .82, [
		.94,
		.98,
		.88,
		0
	], .41, 0, .94),
	cookie6Sided: defaults$1("cookie6Sided", .78, [
		.98,
		.98,
		.96,
		0
	], 0, -.04),
	cookie7Sided: defaults$1("cookie7Sided", .76, [
		.96,
		.98,
		.94,
		0
	], 0, -.04),
	cookie9Sided: defaults$1("cookie9Sided", .7, [
		.98,
		1,
		.96,
		0
	], 0, -.04),
	cookie12Sided: defaults$1("cookie12Sided", .68, [
		1,
		1,
		.98,
		0
	], 0, -.04),
	ghostish: defaults$1("ghostish", .9, [
		1,
		1.04,
		.96,
		.02
	], 0, -.04),
	clover4Leaf: defaults$1("clover4Leaf", .92, [
		.9,
		.92,
		.88,
		-.02
	], .35, 0, .94),
	clover8Leaf: defaults$1("clover8Leaf", .78, [
		.94,
		.96,
		.92,
		0
	], .22, 0, .94),
	burst: defaults$1("burst", .52, [
		.82,
		.84,
		.82,
		-.02
	], 0, 0, .94, .24),
	softBurst: defaults$1("softBurst", .64, [
		.88,
		.9,
		.88,
		-.02
	], 0, 0),
	boom: defaults$1("boom", .52, [
		.72,
		.72,
		.64,
		-.08
	], 0, 0, .92, .24),
	softBoom: defaults$1("softBoom", .72, [
		.78,
		.8,
		.72,
		-.08
	], 0, 0, .92, .24),
	flower: defaults$1("flower", .84, [
		.88,
		.9,
		.86,
		-.02
	], 0, 0, .94),
	puffy: defaults$1("puffy", 1.08, [
		.96,
		.96,
		.92,
		0
	], .22, 0, .94),
	puffyDiamond: defaults$1("puffyDiamond", 1, [
		.9,
		.94,
		.84,
		-.02
	], 0, 0, .94),
	pixelCircle: defaults$1("pixelCircle", .74, [
		1,
		1,
		.98,
		0
	], 0, 0),
	pixelTriangle: defaults$1("pixelTriangle", .68, [
		.82,
		.84,
		.7,
		-.04
	], -.36, 0, .9, .22, .86),
	bun: defaults$1("bun", 1, [
		.88,
		.82,
		.78,
		-.04
	], 0, 0),
	heart: defaults$1("heart", .9, [
		.9,
		.92,
		.88,
		-.1
	], .7, 0, .9)
});
function record(value, path, keys) {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${path}: 객체가 필요합니다.`);
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path}: 일반 객체가 필요합니다.`);
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== "string" || !keys.includes(key)) throw new TypeError(`${path}: 지원하지 않는 항목입니다.`);
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value")) throw new TypeError(`${path}.${key}: 일반 데이터 항목이 필요합니다.`);
	}
	return value;
}
function bounded$2(value, limits, path) {
	if (typeof value !== "number" || !Number.isFinite(value) || value < limits[0] || value > limits[1]) throw new RangeError(`${path}: ${limits[0]}~${limits[1]}의 유한한 숫자가 필요합니다.`);
	return value;
}
function parseMount(value, path) {
	const mount = record(value, path, ["uv", "offset"]);
	if (!Array.isArray(mount.uv) || Object.getPrototypeOf(mount.uv) !== Array.prototype || mount.uv.length !== 2) throw new TypeError(`${path}.uv: 길이가 2인 일반 배열이 필요합니다.`);
	for (const key of Reflect.ownKeys(mount.uv)) {
		if (key === "length") continue;
		if (key !== "0" && key !== "1") throw new TypeError(`${path}.uv: 지원하지 않는 배열 항목입니다.`);
		const descriptor = Object.getOwnPropertyDescriptor(mount.uv, key);
		if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value")) throw new TypeError(`${path}.uv: 일반 데이터 항목이 필요합니다.`);
	}
	if (!Object.hasOwn(mount.uv, 0) || !Object.hasOwn(mount.uv, 1)) throw new TypeError(`${path}.uv: 비어 있는 배열 항목은 지원하지 않습니다.`);
	return {
		uv: [bounded$2(mount.uv[0], MOUNT_UV_RANGE, `${path}.uv[0]`), bounded$2(mount.uv[1], MOUNT_UV_RANGE, `${path}.uv[1]`)],
		offset: bounded$2(mount.offset, MOUNT_OFFSET_RANGE, `${path}.offset`)
	};
}
function parseEyes(value, path) {
	const eyes = record(value, path, [
		"width",
		"height",
		"spacing",
		"offsetY"
	]);
	return {
		width: bounded$2(eyes.width, EYE_PROFILE_SCALE_RANGE, `${path}.width`),
		height: bounded$2(eyes.height, EYE_PROFILE_SCALE_RANGE, `${path}.height`),
		spacing: bounded$2(eyes.spacing, EYE_PROFILE_SCALE_RANGE, `${path}.spacing`),
		offsetY: bounded$2(eyes.offsetY, EYE_PROFILE_OFFSET_Y_RANGE, `${path}.offsetY`)
	};
}
function parseProfile(value, shape, path) {
	const profile = record(value, path, [
		"depth",
		"mounts",
		"eyes"
	]);
	const mounts = record(profile.mounts, `${path}.mounts`, ["head", "face"]);
	const eyes = Object.hasOwn(profile, "eyes") ? parseEyes(profile.eyes, `${path}.eyes`) : { ...DEFAULT_SHAPE_PROFILES[shape].eyes };
	return {
		beretApertureX: DEFAULT_SHAPE_PROFILES[shape].beretApertureX,
		beretApertureZ: DEFAULT_SHAPE_PROFILES[shape].beretApertureZ,
		beretFitSize: DEFAULT_SHAPE_PROFILES[shape].beretFitSize,
		beretFitOpening: DEFAULT_SHAPE_PROFILES[shape].beretFitOpening,
		beretWrapStrength: DEFAULT_SHAPE_PROFILES[shape].beretWrapStrength,
		beretDrapeLimit: DEFAULT_SHAPE_PROFILES[shape].beretDrapeLimit,
		beretFitTransition: 0,
		beretDrapeStrength: DEFAULT_SHAPE_PROFILES[shape].beretDrapeStrength,
		beretFitRoom: DEFAULT_SHAPE_PROFILES[shape].beretFitRoom,
		beretFitCenter: DEFAULT_SHAPE_PROFILES[shape].beretFitCenter,
		beretFitTilt: DEFAULT_SHAPE_PROFILES[shape].beretFitTilt,
		scarfFit: DEFAULT_SHAPE_PROFILES[shape].scarfFit,
		depth: bounded$2(profile.depth, BODY_DEPTH_RANGE, `${path}.depth`),
		eyes,
		accessories: DEFAULT_SHAPE_PROFILES[shape].accessories,
		mounts: {
			head: parseMount(mounts.head, `${path}.mounts.head`),
			face: parseMount(mounts.face, `${path}.mounts.face`)
		}
	};
}
/** Returns an immutable snapshot, never a mutable reference into a saved design. */
function resolveShapeProfile(shape, profiles) {
	if (!MATERIAL_SHAPE_NAMES.includes(shape)) throw new TypeError("shape: 지원하는 Material 도형 이름이 필요합니다.");
	if (profiles === void 0) return DEFAULT_SHAPE_PROFILES[shape];
	const map = record(profiles, "body.profiles", MATERIAL_SHAPE_NAMES);
	return Object.hasOwn(map, shape) ? immutable(parseProfile(map[shape], shape, `body.profiles.${shape}`)) : DEFAULT_SHAPE_PROFILES[shape];
}
/**
* Apply the displayed shape profile once to the global neutral eye baseline.
* The existing renderer still owns scale, expression targets/weights and fitting.
* Neither input is mutated, and the returned anchor is an independent copy.
*/
function resolveShapeEyeGeometry(eyes, profile) {
	return {
		width: eyes.width * profile.eyes.width,
		height: eyes.height * profile.eyes.height,
		spacing: eyes.spacing * profile.eyes.spacing,
		anchor: {
			...eyes.anchor,
			uv: [eyes.anchor.uv[0], Math.max(-.85, Math.min(.85, eyes.anchor.uv[1] + profile.eyes.offsetY))]
		}
	};
}
Object.freeze([
	"beret",
	"halo",
	"crown",
	"glasses",
	"sunglasses",
	"moustache",
	"goatee",
	"bowTie",
	"scarf",
	"necklace",
	"earring",
	"starEarring"
]);
/** Equipment slots are exclusive, regardless of an accessory's surface anchor. */
const ACCESSORY_SLOTS = Object.freeze([
	"head",
	"eyes",
	"mouth",
	"neck",
	"leftEar",
	"rightEar"
]);
Object.freeze({
	beret: "head",
	halo: "head",
	crown: "head",
	glasses: "eyes",
	sunglasses: "eyes",
	moustache: "mouth",
	goatee: "mouth",
	bowTie: "neck",
	scarf: "neck",
	necklace: "neck"
});
Object.freeze({
	beret: Object.freeze(["head"]),
	halo: Object.freeze(["head"]),
	crown: Object.freeze(["head"]),
	glasses: Object.freeze(["eyes"]),
	sunglasses: Object.freeze(["eyes"]),
	moustache: Object.freeze(["mouth"]),
	goatee: Object.freeze(["mouth"]),
	bowTie: Object.freeze(["neck"]),
	scarf: Object.freeze(["neck"]),
	necklace: Object.freeze(["neck"]),
	earring: Object.freeze(["leftEar", "rightEar"]),
	starEarring: Object.freeze(["leftEar", "rightEar"])
});
Object.freeze({
	beret: "Beret",
	halo: "Halo",
	crown: "Crown",
	glasses: "Glasses",
	sunglasses: "Sunglasses",
	moustache: "Moustache",
	goatee: "Goatee",
	bowTie: "Bow tie",
	scarf: "Scarf",
	necklace: "Necklace",
	earring: "Drop earring",
	starEarring: "Star earring"
});
Object.freeze([
	"idle",
	"thinking",
	"listening",
	"speaking",
	"celebrating",
	"still"
]);
createEyeState(), createEyeState();
//#endregion
//#region core/math.js
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const add = (a, b) => [
	a[0] + b[0],
	a[1] + b[1],
	a[2] + b[2]
];
const scale = (a, k) => [
	a[0] * k,
	a[1] * k,
	a[2] * k
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
function normalize(v) {
	const length = Math.hypot(...v);
	return length > 1e-12 ? scale(v, 1 / length) : [
		0,
		0,
		1
	];
}
function identity() {
	return new Float32Array([
		1,
		0,
		0,
		0,
		0,
		1,
		0,
		0,
		0,
		0,
		1,
		0,
		0,
		0,
		0,
		1
	]);
}
function multiply(a, b) {
	const out = /* @__PURE__ */ new Float32Array(16);
	for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
	return out;
}
function transform(position = [
	0,
	0,
	0
], rotation = [
	0,
	0,
	0
], size = [
	1,
	1,
	1
]) {
	const [x, y, z] = rotation;
	const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
	const rx = new Float32Array([
		1,
		0,
		0,
		0,
		0,
		cx,
		sx,
		0,
		0,
		-sx,
		cx,
		0,
		0,
		0,
		0,
		1
	]);
	const ry = new Float32Array([
		cy,
		0,
		-sy,
		0,
		0,
		1,
		0,
		0,
		sy,
		0,
		cy,
		0,
		0,
		0,
		0,
		1
	]);
	const m = multiply(multiply(new Float32Array([
		cz,
		sz,
		0,
		0,
		-sz,
		cz,
		0,
		0,
		0,
		0,
		1,
		0,
		0,
		0,
		0,
		1
	]), ry), rx);
	for (let i = 0; i < 12; i++) m[i] = m[i] * size[Math.floor(i / 4)];
	m[12] = position[0];
	m[13] = position[1];
	m[14] = position[2];
	return m;
}
function frameMatrix(position, tangent, bitangent, normal) {
	return new Float32Array([
		...tangent,
		0,
		...bitangent,
		0,
		...normal,
		0,
		...position,
		1
	]);
}
//#endregion
//#region core/plugin-deformation.js
/** Small, data-only operations. No expression interpreter or catalog selector. */
const ACCESSORY_PLUGIN_DEFORMATION_LIMITS = Object.freeze({
	maxVertices: 2048,
	maxTriangles: 4096,
	maxChannels: 8,
	maxConnectors: 4,
	maxRings: 32,
	maxSides: 32,
	maxCoefficient: 16
});
function object$1(value, label) {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${label} must be a plain object.`);
	return value;
}
function keys(value, allowed, label) {
	if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !allowed.includes(key))) throw new TypeError(`${label} contains unsupported fields.`);
}
function bounded$1(value, min, max, label) {
	if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new RangeError(`${label} must be finite and between ${min} and ${max}.`);
	return value;
}
function integer(value, min, max, label) {
	const result = bounded$1(value, min, max, label);
	if (!Number.isSafeInteger(result)) throw new RangeError(`${label} must be an integer.`);
	return result;
}
function vector$2(value, length, min, max, label) {
	if (!Array.isArray(value) || value.length !== length) throw new TypeError(`${label} requires ${length} coordinates.`);
	return Array.from(value, (item) => bounded$1(item, min, max, label));
}
function array$1(value, length, min, max, label) {
	if (!(value instanceof Float64Array) || !(value.buffer instanceof ArrayBuffer) || value.length !== length) throw new TypeError(`${label} requires a non-shared Float64Array of length ${length}.`);
	const result = new Float64Array(value);
	for (const item of result) bounded$1(item, min, max, label);
	return result;
}
function reduction(value) {
	if (value !== "min" && value !== "max") throw new TypeError("Affine channel combine must be min or max.");
	return value;
}
function material(value) {
	const source = object$1(value, "Connector material");
	keys(source, ["color", "multiplier"], "Connector material");
	const result = {};
	if (source.color !== void 0) {
		if (typeof source.color !== "string" || !/^#[0-9a-f]{6}$/i.test(source.color)) throw new TypeError("Connector material color must be #RRGGBB.");
		result.color = source.color.toLowerCase();
	}
	if (source.multiplier !== void 0) result.multiplier = bounded$1(source.multiplier, 0, 4, "Connector material multiplier");
	return result;
}
/** Exact public landmark contract; malformed arrays must never produce a NaN frame. */
function validateAccessoryPluginEyeMeasurements(value) {
	const source = object$1(value, "Neutral eye measurements");
	keys(source, [
		"left",
		"right",
		"size"
	], "Neutral eye measurements");
	return {
		left: vector$2(source.left, 2, -16, 16, "Left eye landmark"),
		right: vector$2(source.right, 2, -16, 16, "Right eye landmark"),
		size: vector$2(source.size, 2, 1e-6, 16, "Neutral eye size")
	};
}
/** Validate once at the registry/worker boundary and own every coefficient buffer. */
function validateAccessoryPluginDeformation(value, vertexCount) {
	integer(vertexCount, 1, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxVertices, "Affine vertex count");
	const source = object$1(value, "Accessory deformation");
	keys(source, [
		"kind",
		"eyeBlend",
		"basePositions",
		"channels"
	], "Accessory deformation");
	if (source.kind !== "paired-affine") throw new TypeError("Accessory deformation kind must be paired-affine.");
	if (!Array.isArray(source.channels) || source.channels.length < 1 || source.channels.length > ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxChannels) throw new RangeError("Affine channels must contain between 1 and 8 measurements.");
	const channels = Array.from(source.channels, (item) => {
		const channel = object$1(item, "Affine channel");
		keys(channel, [
			"measurement",
			"combine",
			"factors",
			"coefficients"
		], "Affine channel");
		if (channel.measurement !== "eye-size") throw new TypeError("Affine channel measurement must be eye-size.");
		return {
			measurement: "eye-size",
			combine: reduction(channel.combine),
			factors: vector$2(channel.factors, 2, 0, 8, "Affine measurement factors"),
			coefficients: array$1(channel.coefficients, vertexCount * 3, -16, 16, "Affine coefficients")
		};
	});
	return {
		kind: "paired-affine",
		eyeBlend: array$1(source.eyeBlend, vertexCount, 0, 1, "Affine eye blend"),
		basePositions: array$1(source.basePositions, vertexCount * 3, -16, 16, "Affine base positions"),
		channels
	};
}
/** Named coefficients keep authoring readable; names do not enter the runtime recipe. */
function createPairedAffineDeformation(value) {
	const source = object$1(value, "Affine authoring");
	keys(source, ["channels", "vertices"], "Affine authoring");
	const named = object$1(source.channels, "Named affine channels"), names = Object.keys(named);
	keys(named, names, "Named affine channels");
	if (names.length < 1 || names.length > ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxChannels || names.some((name) => !/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name))) throw new TypeError("Provide 1–8 short named affine channels.");
	if (!Array.isArray(source.vertices)) throw new TypeError("Affine authoring vertices must be an array.");
	const count = integer(source.vertices.length, 1, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxVertices, "Affine vertex count");
	const channels = names.map((name) => {
		const channel = object$1(named[name], "Named affine channel");
		keys(channel, ["combine", "factors"], "Named affine channel");
		return {
			measurement: "eye-size",
			combine: reduction(channel.combine),
			factors: vector$2(channel.factors, 2, 0, 8, "Affine measurement factors"),
			coefficients: new Float64Array(count * 3)
		};
	});
	const eyeBlend = new Float64Array(count), basePositions = new Float64Array(count * 3);
	for (let index = 0; index < count; index++) {
		const item = source.vertices[index];
		const vertex = object$1(item, "Affine authored vertex");
		keys(vertex, [
			"eyeBlend",
			"basePosition",
			"coefficients"
		], "Affine authored vertex");
		eyeBlend[index] = bounded$1(vertex.eyeBlend, 0, 1, "Affine eye blend");
		if (vertex.basePosition !== void 0) basePositions.set(vector$2(vertex.basePosition, 3, -16, 16, "Affine base position"), index * 3);
		if (vertex.coefficients === void 0) continue;
		const coefficients = object$1(vertex.coefficients, "Named vertex coefficients");
		keys(coefficients, names, "Named vertex coefficients");
		names.forEach((name, channelIndex) => {
			if (Object.hasOwn(coefficients, name) && coefficients[name] !== void 0) channels[channelIndex].coefficients.set(vector$2(coefficients[name], 3, -16, 16, "Affine coefficient"), index * 3);
		});
	}
	return {
		kind: "paired-affine",
		eyeBlend,
		basePositions,
		channels
	};
}
/** Validate complete composed sizes BEFORE runtime allocates any derived geometry. */
function validateAccessoryPluginSurfaceConnectors(value, baseVertexCount, baseIndexCount) {
	integer(baseVertexCount, 1, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxVertices, "Connector base vertex count");
	integer(baseIndexCount, 3, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxTriangles * 3, "Connector base index count");
	if (baseIndexCount % 3) throw new RangeError("Connector base indices must contain complete triangles.");
	if (!Array.isArray(value) || value.length < 1 || value.length > ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxConnectors) throw new RangeError("Surface connectors must contain between 1 and 4 tubes.");
	let vertices = baseVertexCount, indices = baseIndexCount;
	return Array.from(value, (item) => {
		const source = object$1(item, "Surface connector");
		keys(source, [
			"kind",
			"to",
			"radius",
			"rings",
			"sides",
			"clearance",
			"material"
		], "Surface connector");
		if (source.kind !== "surface-tube") throw new TypeError("Surface connector kind must be surface-tube.");
		const rings = integer(source.rings, 2, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxRings, "Connector rings"), sides = integer(source.sides, 3, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxSides, "Connector sides");
		vertices += rings * sides + 2;
		indices += rings * sides * 6;
		if (vertices > ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxVertices || indices > ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxTriangles * 3) throw new RangeError("Composed accessory geometry exceeds the 2048 vertex / 4096 triangle contact limits.");
		return {
			kind: "surface-tube",
			to: vector$2(source.to, 3, -16, 16, "Connector endpoint"),
			radius: bounded$1(source.radius, 1e-6, 1, "Connector radius"),
			rings,
			sides,
			clearance: bounded$1(source.clearance ?? .002, 0, .25, "Connector clearance"),
			...source.material === void 0 ? {} : { material: material(source.material) }
		};
	});
}
//#endregion
//#region core/accessory-plugins.js
const ACCESSORY_PLUGIN_LIMITS = Object.freeze({
	maxVertices: 16384,
	maxTriangles: 32768,
	maxCoordinate: 16,
	maxParts: 32,
	maxFittedVertices: 2048,
	maxFittedTriangles: 4096,
	maxEquipped: 6,
	maxEquippedFittedVertices: 4096,
	maxEquippedFittedTriangles: 8192
});
function bounded(value, min, max, name) {
	if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new RangeError(`${name} must be finite and between ${min} and ${max}.`);
	return value;
}
function vector$1(value, count, min, max, name) {
	if (!Array.isArray(value) || value.length !== count) throw new TypeError(`${name} requires ${count} coordinates.`);
	return Array.from(value, (item) => bounded(item, min, max, name));
}
/** Validate and own a serializable, asset-authored fitting recipe. */
function validateAccessoryPluginAttachment(value) {
	if (!value || typeof value !== "object") throw new TypeError("Accessory attachment is required.");
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) throw new TypeError("Accessory attachment must be a plain object.");
	const input = value;
	if (![
		"contained-front",
		"crown-envelope",
		"perimeter-front",
		"eye-plane"
	].includes(input.mode)) throw new TypeError("Unsupported accessory attachment mode.");
	const allowed = [
		"mode",
		"mounts",
		"clearance",
		"follow",
		"followAxis",
		"followSign",
		"geometryScale",
		...input.mode === "perimeter-front" ? [
			"region",
			"perimeterInset",
			"containmentClearance"
		] : input.mode === "eye-plane" ? ["referenceUv"] : []
	];
	if (Reflect.ownKeys(input).some((key) => typeof key !== "string" || !allowed.includes(key))) throw new TypeError(`Unsupported fields for ${input.mode} attachment.`);
	if (input.mode === "perimeter-front" && input.region !== "left" && input.region !== "right") throw new TypeError("Perimeter-front attachment requires a left or right region.");
	if (input.region !== void 0 && input.region !== "left" && input.region !== "right") throw new TypeError("Attachment region must be left or right.");
	if (input.followAxis !== void 0 && ![
		"x",
		"y",
		"z"
	].includes(input.followAxis)) throw new TypeError("Attachment followAxis must be x, y or z.");
	if (input.followSign !== void 0 && input.followSign !== -1 && input.followSign !== 1) throw new TypeError("Attachment followSign must be -1 or 1.");
	if (!input.mounts || typeof input.mounts !== "object" || Array.isArray(input.mounts) || Object.keys(input.mounts).length !== MATERIAL_SHAPE_NAMES.length) throw new TypeError("Accessory mounts must contain every material shape.");
	const mounts = {};
	for (const shape of MATERIAL_SHAPE_NAMES) {
		if (!Object.hasOwn(input.mounts, shape)) throw new TypeError(`Accessory mount is missing ${shape}.`);
		const mount = input.mounts[shape];
		if (!mount || typeof mount !== "object" || Array.isArray(mount) || ![Object.prototype, null].includes(Object.getPrototypeOf(mount)) || Reflect.ownKeys(mount).some((key) => typeof key !== "string" || ![
			"uv",
			"offset",
			"rotation",
			"scale"
		].includes(key))) throw new TypeError(`Accessory mount ${shape} is invalid.`);
		mounts[shape] = {
			uv: vector$1(mount.uv, 2, -1, 1, "Mount UV"),
			offset: bounded(mount.offset, 0, .25, "Mount offset"),
			rotation: vector$1(mount.rotation, 3, -Math.PI, Math.PI, "Mount rotation"),
			scale: bounded(mount.scale, .001, 8, "Mount scale")
		};
	}
	const common = {
		mounts,
		clearance: bounded(input.clearance ?? .002, 0, .25, "Attachment clearance"),
		follow: bounded(input.follow ?? 0, 0, 1, "Attachment follow"),
		...input.followAxis === void 0 ? {} : { followAxis: input.followAxis },
		...input.followSign === void 0 ? {} : { followSign: input.followSign },
		...input.geometryScale === void 0 ? {} : { geometryScale: bounded(input.geometryScale, .001, 8, "Geometry scale") }
	};
	if (input.mode === "perimeter-front") return {
		...common,
		mode: input.mode,
		region: input.region,
		...input.perimeterInset === void 0 ? {} : { perimeterInset: bounded(input.perimeterInset, 0, 1, "Perimeter inset") },
		...input.containmentClearance === void 0 ? {} : { containmentClearance: bounded(input.containmentClearance, 0, .25, "Containment clearance") }
	};
	if (input.mode === "eye-plane") return {
		...common,
		mode: input.mode,
		...input.referenceUv === void 0 ? {} : { referenceUv: vector$1(input.referenceUv, 2, -1, 1, "Reference UV") }
	};
	return {
		...common,
		mode: input.mode
	};
}
function parts(value, count) {
	if (!Array.isArray(value) || !value.length || value.length > ACCESSORY_PLUGIN_LIMITS.maxParts) throw new RangeError("Accessory parts must be a nonempty bounded list.");
	let next = 0;
	const output = Array.from(value, (part) => {
		if (!part || typeof part !== "object" || !Number.isSafeInteger(part.indexStart) || part.indexStart !== next || !Number.isSafeInteger(part.indexCount) || part.indexCount < 3 || part.indexCount % 3 || part.indexStart + part.indexCount > count) throw new RangeError("Accessory parts must be ordered, contiguous triangle ranges.");
		next += part.indexCount;
		const result = {
			indexStart: part.indexStart,
			indexCount: part.indexCount
		};
		if (part.material !== void 0) {
			const material = part.material;
			if (!material || typeof material !== "object" || Array.isArray(material)) throw new TypeError("Accessory material must be an object.");
			result.material = {};
			if (material.color !== void 0) {
				if (typeof material.color !== "string" || !/^#[0-9a-f]{6}$/i.test(material.color)) throw new TypeError("Accessory material color must be #RRGGBB.");
				result.material.color = material.color.toLowerCase();
			}
			if (material.multiplier !== void 0) result.material.multiplier = bounded(material.multiplier, 0, 4, "Material multiplier");
		}
		return result;
	});
	if (next !== count) throw new RangeError("Accessory parts must cover the complete index buffer.");
	return output;
}
/** Validate and copy before worker transport or renderer use. Shared buffers are forbidden. */
function validateAccessoryPluginGeometry(value) {
	if (!value || typeof value !== "object") throw new TypeError("Accessory plugin geometry is required.");
	const { vertices, indices } = value;
	if (!(vertices instanceof Float32Array) || !(indices instanceof Uint16Array) || !(vertices.buffer instanceof ArrayBuffer) || !(indices.buffer instanceof ArrayBuffer)) throw new TypeError("Accessory geometry requires non-shared Float32Array vertices and Uint16Array indices.");
	if (vertices.length < 18 || vertices.length % 6 !== 0 || vertices.length / 6 > ACCESSORY_PLUGIN_LIMITS.maxVertices) throw new RangeError("Accessory geometry vertex count exceeds the supported limits.");
	if (indices.length < 3 || indices.length % 3 !== 0 || indices.length / 3 > ACCESSORY_PLUGIN_LIMITS.maxTriangles) throw new RangeError("Accessory geometry triangle count exceeds the supported limits.");
	const ownedVertices = new Float32Array(vertices), ownedIndices = new Uint16Array(indices);
	for (let i = 0; i < ownedVertices.length; i += 6) {
		for (let axis = 0; axis < 3; axis++) {
			const coordinate = ownedVertices[i + axis];
			if (!Number.isFinite(coordinate) || Math.abs(coordinate) > ACCESSORY_PLUGIN_LIMITS.maxCoordinate) throw new RangeError("Accessory vertex positions must be finite and within ±16 model units.");
		}
		const length = Math.hypot(ownedVertices[i + 3], ownedVertices[i + 4], ownedVertices[i + 5]);
		if (!Number.isFinite(length) || Math.abs(length - 1) > .001) throw new RangeError("Accessory vertex normals must be finite unit vectors.");
	}
	const count = ownedVertices.length / 6;
	for (const index of ownedIndices) if (index >= count) throw new RangeError("Accessory triangle index is outside the vertex array.");
	const input = value;
	if (input.normalPrecision !== void 0 && input.normalPrecision !== "float32" && input.normalPrecision !== "float64") throw new TypeError("Normal precision must be float32 or float64.");
	const connectors = input.surfaceConnectors === void 0 ? void 0 : validateAccessoryPluginSurfaceConnectors(input.surfaceConnectors, count, ownedIndices.length);
	const ranges = input.parts === void 0 ? void 0 : parts(input.parts, ownedIndices.length);
	if ((ranges?.length ?? 1) + (connectors?.length ?? 0) > ACCESSORY_PLUGIN_LIMITS.maxParts) throw new RangeError("Composed accessory material ranges exceed the supported limits.");
	return {
		vertices: ownedVertices,
		indices: ownedIndices,
		...ranges ? { parts: ranges } : {},
		...input.deformation === void 0 ? {} : { deformation: validateAccessoryPluginDeformation(input.deformation, count) },
		...connectors ? { surfaceConnectors: connectors } : {},
		...input.normalPrecision === void 0 ? {} : { normalPrecision: input.normalPrecision }
	};
}
//#endregion
//#region core/accessory-id.js
/** Shared safe runtime identity for catalog and namespaced plugin equipment. */
function isAccessoryInstanceId(value) {
	return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._/:-]{0,127}$/.test(value) && ![
		"__proto__",
		"constructor",
		"prototype"
	].includes(value);
}
//#endregion
//#region core/part-animation.js
const PART_ANIMATION_LIMITS = Object.freeze({
	maxTracks: 128,
	maxKeyframes: 4096,
	maxDuration: 86400
});
function object(value, keys, path) {
	if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError(`${path} must be a plain data object.`);
	for (const key of Reflect.ownKeys(value)) {
		const field = Object.getOwnPropertyDescriptor(value, key);
		if (typeof key !== "string" || !keys.includes(key) || !field.enumerable || !Object.hasOwn(field, "value")) throw new TypeError(`${path} contains unsupported or accessor data.`);
	}
	return value;
}
function array(value, maximum, path) {
	if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) throw new TypeError(`${path} must be a bounded dense plain array.`);
	for (let i = 0; i < value.length; i++) {
		const field = Object.getOwnPropertyDescriptor(value, String(i));
		if (!field?.enumerable || !Object.hasOwn(field, "value")) throw new TypeError(`${path} must not contain holes or accessors.`);
	}
	return value;
}
function number(value, low, high, path) {
	if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high) throw new RangeError(`${path} must be finite and within ${low}..${high}.`);
	return value;
}
function vector(value, length, low, high) {
	const input = array(value, length, "keyframe value");
	if (input.length !== length) throw new TypeError(`Keyframe value requires ${length} components.`);
	return input.map((item) => number(item, low, high, "keyframe component"));
}
function id(value) {
	if (!isAccessoryInstanceId(value)) throw new TypeError("Invalid accessory animation id.");
	return value;
}
/** Strict validation and defensive copy. Call once when accepting a clip, not on every frame. */
function validatePartAnimation(value) {
	const input = object(value, [
		"duration",
		"loop",
		"tracks"
	], "clip");
	const duration = number(input.duration, Number.MIN_VALUE, PART_ANIMATION_LIMITS.maxDuration, "duration");
	if (Object.hasOwn(input, "loop") && typeof input.loop !== "boolean") throw new TypeError("loop must be boolean.");
	const inputs = array(input.tracks, PART_ANIMATION_LIMITS.maxTracks, "tracks"), channels = /* @__PURE__ */ new Set();
	let total = 0;
	if (!inputs.length) throw new RangeError("A part animation requires at least one track.");
	const tracks = inputs.map((raw) => {
		const track = object(raw, [
			"target",
			"channel",
			"keyframes",
			"interpolation"
		], "track");
		if (Object.hasOwn(track, "interpolation") && track.interpolation !== "linear" && track.interpolation !== "smooth") throw new TypeError("interpolation must be linear or smooth.");
		let target, length, low, high;
		if (typeof track.target === "string") {
			target = track.target;
			if (target === "body" && track.channel === "rotation") {
				length = 3;
				low = -Math.PI * 2;
				high = Math.PI * 2;
			} else if (target === "face" && track.channel === "uv") {
				length = 2;
				low = -.5;
				high = .5;
			} else if ((target === "leftEye" || target === "rightEye") && track.channel === "weights") {
				length = 2;
				low = 0;
				high = 1;
			} else throw new TypeError("Unsupported part target/channel combination.");
		} else {
			target = { accessory: id(object(track.target, ["accessory"], "target").accessory) };
			if (track.channel === "opacity") {
				length = 0;
				low = 0;
				high = 1;
			} else if (track.channel === "scale") {
				length = 3;
				low = .01;
				high = 16;
			} else if (track.channel === "position") {
				length = 3;
				low = -16;
				high = 16;
			} else if (track.channel === "rotation") {
				length = 3;
				low = -Math.PI * 2;
				high = Math.PI * 2;
			} else throw new TypeError("Unsupported accessory animation channel.");
		}
		const channelKey = `${typeof target === "string" ? target : `accessory:${target.accessory}`}:${String(track.channel)}`;
		if (channels.has(channelKey)) throw new TypeError("Each animation target/channel must be unique.");
		channels.add(channelKey);
		const frames = array(track.keyframes, PART_ANIMATION_LIMITS.maxKeyframes, "keyframes");
		total += frames.length;
		if (!frames.length || total > PART_ANIMATION_LIMITS.maxKeyframes) throw new RangeError("Animation requires 1..4096 total keyframes.");
		let previous = -1;
		const keyframes = frames.map((rawFrame) => {
			const frame = object(rawFrame, ["time", "value"], "keyframe"), time = number(frame.time, 0, duration, "keyframe time");
			if (time <= previous) throw new RangeError("Keyframe times must be strictly increasing.");
			previous = time;
			return {
				time,
				value: length === 0 ? number(frame.value, low, high, "keyframe value") : vector(frame.value, length, low, high)
			};
		});
		return {
			target,
			channel: track.channel,
			keyframes,
			...track.interpolation === void 0 ? {} : { interpolation: track.interpolation }
		};
	});
	return {
		duration,
		...input.loop === void 0 ? {} : { loop: input.loop },
		tracks
	};
}
function sampleTrack(track, time) {
	const frames = track.keyframes;
	const first = frames[0], last = frames[frames.length - 1];
	const copy = (value) => typeof value === "number" ? value : [...value];
	if (time <= first.time) return copy(first.value);
	if (time >= last.time) return copy(last.value);
	let low = 0, high = frames.length - 1;
	while (high - low > 1) {
		const middle = low + high >>> 1;
		if (frames[middle].time <= time) low = middle;
		else high = middle;
	}
	const a = frames[low], b = frames[high];
	if (time === a.time) return copy(a.value);
	let t = (time - a.time) / (b.time - a.time);
	if (track.interpolation === "smooth") t = t * t * (3 - 2 * t);
	if (typeof a.value === "number") return a.value + (b.value - a.value) * t;
	return a.value.map((value, index) => value + (b.value[index] - value) * t);
}
/** Sample a validated clip deterministically; endpoint values hold outside each track's key range. */
function samplePartAnimation(clip, time) {
	if (!Number.isFinite(time)) throw new RangeError("Animation time must be finite.");
	const remainder = time % clip.duration;
	const local = clip.loop ? remainder < 0 ? remainder + clip.duration : remainder : Math.max(0, Math.min(clip.duration, time));
	const result = { accessories: Object.create(null) };
	for (const track of clip.tracks) {
		const value = sampleTrack(track, local);
		if (track.target === "body") result.bodyRotation = value;
		else if (track.target === "face") result.face = value;
		else if (track.target === "leftEye" || track.target === "rightEye") {
			const [smile, blink] = value;
			(result.eyes ??= {})[track.target === "leftEye" ? "left" : "right"] = {
				smile,
				openness: 1 - blink
			};
		} else {
			const target = track.target;
			const sample = result.accessories[target.accessory] ??= {};
			if (track.channel === "opacity") sample.opacity = value;
			else sample[track.channel] = value;
		}
	}
	return result;
}
//#endregion
//#region core/body-volume.js
/** Internal, fixed inflation law. The public profile controls only total depth. */
const VOLUME_CURVATURE = .65;
/**
* A topology-independent, continuously rounded solid over the current XY outline.
* Its equator is the exact renderer boundary; its center reaches unit half-depth.
* Unlike a bevel, height varies everywhere inside the shape. Signed distance
* keeps concave lobes attached without choosing a radial boundary intersection.
*/
function contourVolumeHeight(contour, x, y) {
	const d = contourSignedDistance(contour, x, y);
	if (d <= 1e-12) return 0;
	return Math.sqrt(d / (d + VOLUME_CURVATURE * (x * x + y * y)));
}
/** The implicit field's outward normal, stable even at its vertical equator. */
function contourVolumeNormal(contour, x, y, front = true) {
	const d = Math.max(0, contourSignedDistance(contour, x, y)), h = contourVolumeHeight(contour, x, y);
	const step = 1e-4;
	const dx = (contourSignedDistance(contour, x + step, y) - contourSignedDistance(contour, x - step, y)) / (2 * step);
	const dy = (contourSignedDistance(contour, x, y + step) - contourSignedDistance(contour, x, y - step)) / (2 * step);
	const square = h * h, nx = 2 * VOLUME_CURVATURE * x * square - dx * (1 - square);
	const ny = 2 * VOLUME_CURVATURE * y * square - dy * (1 - square);
	const nz = 2 * h * (d + VOLUME_CURVATURE * (x * x + y * y)) * (front ? 1 : -1);
	const length = Math.hypot(nx, ny, nz);
	return length > 1e-12 ? [
		nx / length,
		ny / length,
		nz / length
	] : [
		0,
		0,
		front ? 1 : -1
	];
}
//#endregion
//#region core/surface.js
/** Fixed catalog XY size plus the nominal square depth; actual Z comes from its profile. */
const BODY_SIZE = Object.freeze([
	1.18,
	1.18,
	.9
]);
/** Current rounded height field, independent of mesh topology and frame history. */
function contourSurfacePoint(contour, x, y, front = true) {
	return [
		x,
		y,
		contourVolumeHeight(contour, x, y) * (front ? 1 : -1)
	];
}
/** Body deformations are shared by the renderer and attachment/point APIs. */
function deformBodyPoint(body, point, squash = 1, profileOverride) {
	const [x, y, z] = point, stretch = 1 / Math.sqrt(squash);
	const profile = profileOverride ?? resolveShapeProfile(body.shape);
	return [
		x * BODY_SIZE[0] * .5 * stretch,
		y * BODY_SIZE[1] * .5 * squash,
		z * profile.depth * .5 * stretch
	];
}
const hits = /* @__PURE__ */ new WeakMap();
/** First positive intersection with the current XY outline. */
function rayBoundary(contour, x, y) {
	let wall = Infinity;
	if (Math.hypot(x, y) <= 1e-12) return wall;
	const points = contourDistanceOutline(contour);
	for (let i = 0; i < points.length; i++) {
		const a = points[i], b = points[(i + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1], determinant = x * dy - y * dx;
		if (Math.abs(determinant) < 1e-14) continue;
		const t = (a[0] * dy - a[1] * dx) / determinant, u = (a[0] * y - a[1] * x) / determinant;
		if (t > 1e-10 && u >= -1e-10 && u <= 1 + 1e-10) wall = Math.min(wall, t);
	}
	return wall;
}
/**
* First positive exit from the inflated field, including non-star-shaped lobes.
* On a ray, being inside is equivalent to d(t) >= c*r(t)^2*z(t)^2/(1-z(t)^2).
* The right side is monotone. Signed distance is 1-Lipschitz, so each interval
* can be certified entirely inside using its midpoint and XY travel radius.
* Visit unresolved intervals left-first: a concave dip cannot be skipped by a
* bisection that happens to select a later exit. The final uncertainty is below
* 1e-10 canonical units and does not depend on a frame's prior result.
*/
function raySurface(contour, direction) {
	const [x, y, z] = direction, key = direction.join(",");
	let cached = hits.get(contour);
	if (!cached) {
		cached = /* @__PURE__ */ new Map();
		hits.set(contour, cached);
	}
	const previous = cached.get(key);
	if (previous) return previous;
	const xySpeed = Math.hypot(x, y), zSquared = z * z;
	let extent = Math.min(Math.abs(z) > 1e-12 ? 1 / Math.abs(z) : Infinity, rayBoundary(contour, x, y));
	if (!Number.isFinite(extent)) throw new Error("Cannot intersect an empty body volume.");
	if (xySpeed > 1e-12 && Math.abs(z) > 1e-12) {
		const requiredDistance = (t) => {
			const square = t * t, denominator = 1 - square * zSquared;
			return denominator <= 0 ? Infinity : VOLUME_CURVATURE * xySpeed * xySpeed * zSquared * square * square / denominator;
		};
		const firstExit = (low, high) => {
			const middle = (low + high) / 2;
			if (contourSignedDistance(contour, x * middle, y * middle) - xySpeed * (high - low) / 2 > requiredDistance(high)) return void 0;
			if (high - low <= 1e-10) return middle;
			return firstExit(low, middle) ?? firstExit(middle, high);
		};
		extent = firstExit(0, extent) ?? extent;
	}
	const point = [
		x * extent,
		y * extent,
		z * extent
	];
	const result = {
		point,
		normal: contourVolumeNormal(contour, point[0], point[1], z >= 0)
	};
	if (cached.size >= 8192) cached.clear();
	cached.set(key, result);
	return result;
}
/** Physical ray intersection, with the same rounded field used by mesh vertices. */
function bodyPoint(body, direction, squash = 1, contourOverride, profileOverride) {
	return deformBodyPoint(body, raySurface(contourOverride ?? shapeContour({
		kind: "material",
		name: body.shape
	}), normalize(direction)).point, squash, profileOverride);
}
function bodyNormal(body, direction, squash = 1, contourOverride, profileOverride) {
	const normal = raySurface(contourOverride ?? shapeContour({
		kind: "material",
		name: body.shape
	}), normalize(direction)).normal;
	return deformBodyNormal(body, normal, squash, profileOverride);
}
/** Inverse-transpose counterpart of deformBodyPoint. */
function deformBodyNormal(body, normal, squash = 1, profileOverride) {
	const stretch = 1 / Math.sqrt(squash);
	const profile = profileOverride ?? resolveShapeProfile(body.shape);
	return normalize([
		normal[0] / (BODY_SIZE[0] * stretch),
		normal[1] / (BODY_SIZE[1] * squash),
		normal[2] / (profile.depth * stretch)
	]);
}
/**
* Direct XY surface query for rigid front-plane ink and calibrated cap mounts.
* Unlike a physical ray this preserves XY spacing as the body inflates. Callers
* choose contained XY coordinates; exterior coordinates land on the z=0 plane.
*/
function sampleSurfaceAtXY(body, x, y, squash = 1, contourOverride, profileOverride, front = true) {
	const contour = contourOverride ?? shapeContour({
		kind: "material",
		name: body.shape
	});
	const position = deformBodyPoint(body, contourSurfacePoint(contour, x, y, front), squash, profileOverride);
	const normal = deformBodyNormal(body, contourVolumeNormal(contour, x, y, front), squash, profileOverride);
	let tangent = normalize(cross([
		0,
		1,
		0
	], normal));
	if (Math.abs(normal[1]) > .99) tangent = normalize(cross([
		1,
		0,
		0
	], normal));
	const bitangent = normalize(cross(normal, tangent));
	return {
		position,
		normal,
		tangent,
		bitangent,
		matrix: frameMatrix(position, tangent, bitangent, normal)
	};
}
function directionAt(anchor) {
	const [u, v] = anchor.uv;
	const x = Math.sin(u * 1.05) * Math.cos(v * .9), y = Math.sin(v * .9), z = Math.cos(u * 1.05) * Math.cos(v * .9);
	if (anchor.region === "crown") return [
		x,
		z,
		-y
	];
	if (anchor.region === "left") return [
		-z,
		y,
		x
	];
	if (anchor.region === "right") return [
		z,
		y,
		-x
	];
	return [
		x,
		y,
		z
	];
}
function sampleSurface(body, anchor, squash = 1, contourOverride, profileOverride) {
	const direction = directionAt(anchor), normal = bodyNormal(body, direction, squash, contourOverride, profileOverride);
	const helper = anchor.region === "crown" ? [
		0,
		0,
		-1
	] : [
		0,
		1,
		0
	];
	let tangent = normalize(cross(helper, normal));
	if (Math.abs(dot(helper, normal)) > .99) tangent = normalize(cross([
		1,
		0,
		0
	], normal));
	const bitangent = normalize(cross(normal, tangent));
	const position = add(bodyPoint(body, direction, squash, contourOverride, profileOverride), scale(normal, anchor.offset));
	return {
		position,
		normal,
		tangent,
		bitangent,
		matrix: frameMatrix(position, tangent, bitangent, normal)
	};
}
const mountCharts = /* @__PURE__ */ new WeakMap();
/**
* Arc-length phase comes from the exact first complex perimeter harmonic:
* integral z(s) exp(-2 pi i s) ds, with normalized counter-clockwise length s.
* Integrating each linear edge analytically makes cyclic reindexing and extra
* collinear vertices immaterial. It never selects a discrete support vertex.
*/
function mountChart(contour) {
	const previous = mountCharts.get(contour);
	if (previous) return previous;
	const points = contour.points, distances = [0];
	let faceRadius = Infinity;
	for (let i = 0; i < points.length; i++) {
		const a = points[i], b = points[(i + 1) % points.length];
		const dx = b[0] - a[0], dy = b[1] - a[1], lengthSquared = dx * dx + dy * dy;
		distances.push(distances[i] + Math.sqrt(lengthSquared));
		const closest = Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / lengthSquared));
		faceRadius = Math.min(faceRadius, Math.hypot(a[0] + closest * dx, a[1] + closest * dy));
	}
	const perimeter = distances[points.length], tau = Math.PI * 2;
	let real = 0, imaginary = 0;
	for (let i = 0; i < points.length; i++) {
		const a = points[i], b = points[(i + 1) % points.length];
		const from = distances[i] / perimeter, to = distances[i + 1] / perimeter;
		const dx = (b[0] - a[0]) / (to - from), dy = (b[1] - a[1]) / (to - from);
		const realDelta = Math.cos(tau * to) - Math.cos(tau * from);
		const imaginaryDelta = Math.sin(tau * from) - Math.sin(tau * to);
		real += dx * realDelta - dy * imaginaryDelta;
		imaginary += dx * imaginaryDelta + dy * realDelta;
	}
	const result = Object.freeze({
		distances: Object.freeze(distances),
		perimeter,
		phase: Math.atan2(imaginary, real),
		magnitude: Math.hypot(real, imaginary) / (tau * tau),
		faceRadius: Math.max(0, faceRadius - .002)
	});
	mountCharts.set(contour, result);
	return result;
}
function perimeterMountPoint(contour, direction) {
	const chart = mountChart(contour);
	const distance = ((Math.atan2(direction[1], direction[0]) - chart.phase) / (2 * Math.PI) % 1 + 1) % 1 * chart.perimeter, points = contour.points;
	let low = 0, high = points.length;
	while (low + 1 < high) {
		const middle = low + high >>> 1;
		if (chart.distances[middle] <= distance) low = middle;
		else high = middle;
	}
	const start = chart.distances[low], end = chart.distances[low + 1];
	const amount = (distance - start) / (end - start), a = points[low], b = points[(low + 1) % points.length];
	const x = a[0] + (b[0] - a[0]) * amount, y = a[1] + (b[1] - a[1]) * amount;
	const z = direction[2] * Math.hypot(x, y) / Math.max(1e-12, Math.hypot(direction[0], direction[1]));
	return [
		x,
		y,
		Math.max(-1, Math.min(1, z))
	];
}
/**
* A finite Lipschitz walk from the known interior center. Every step is bounded
* by signed-distance clearance, so it cannot cross a thin intervening notch.
* Fixed iteration count plus continuous min/max avoids the branch switch of a
* first-ray-hit solver and also avoids choosing a nearest boundary vertex.
*/
function containedFrontPoint(contour, x, y, clearance) {
	const extent = Math.hypot(x, y), dx = x / Math.max(extent, 1e-12), dy = y / Math.max(extent, 1e-12);
	let traveled = 0;
	for (let i = 0; i < 24; i++) traveled += Math.min(extent - traveled, Math.max(0, contourSignedDistance(contour, dx * traveled, dy * traveled) - clearance));
	return contourSurfacePoint(contour, dx * traveled, dy * traveled);
}
/** Generic contained front chart with an independently authored rigid plane. */
function sampleContainedFrontSurface(body, mount, squash = 1, contourOverride, profileOverride) {
	const contour = contourOverride ?? shapeContour({
		kind: "material",
		name: body.shape
	});
	const direction = directionAt({
		region: "face",
		uv: [...mount.uv],
		offset: mount.offset
	});
	const point = containedFrontPoint(contour, direction[0] / direction[2], direction[1] / direction[2], .012);
	const orientation = transform([
		0,
		0,
		0
	], mount.rotation), stretch = 1 / Math.sqrt(squash);
	const normal = normalize([
		orientation[8] / stretch,
		orientation[9] / squash,
		orientation[10] / stretch
	]);
	const deformedTangent = [
		orientation[0] * stretch,
		orientation[1] * squash,
		orientation[2] * stretch
	];
	const bitangent = normalize(cross(normal, deformedTangent)), tangent = normalize(cross(bitangent, normal));
	const position = add(deformBodyPoint(body, point, squash, profileOverride), scale(normal, mount.offset));
	return {
		position,
		normal,
		tangent,
		bitangent,
		matrix: frameMatrix(position, tangent, bitangent, normal)
	};
}
/** Generic calibrated chart; contains no catalog accessory selection or geometry. */
function sampleCalibratedSurface(body, mount, chart, options = {}, squash = 1, contourOverride, profileOverride) {
	const contour = contourOverride ?? shapeContour({
		kind: "material",
		name: body.shape
	});
	const region = chart === "crown-envelope" ? "crown" : chart === "perimeter-front" ? options.region ?? "left" : "face";
	const anchor = {
		region,
		uv: [...mount.uv],
		offset: mount.offset
	}, direction = directionAt(anchor);
	const canonicalNormal = directionAt({
		...anchor,
		uv: [0, 0]
	});
	const baseTangent = normalize(cross(region === "crown" ? [
		0,
		0,
		-1
	] : [
		0,
		1,
		0
	], canonicalNormal));
	const orientation = multiply(frameMatrix([
		0,
		0,
		0
	], baseTangent, normalize(cross(canonicalNormal, baseTangent)), canonicalNormal), transform([
		0,
		0,
		0
	], mount.rotation));
	const stretch = 1 / Math.sqrt(squash), normal = normalize([
		orientation[8] / stretch,
		orientation[9] / squash,
		orientation[10] / stretch
	]);
	const bitangent = normalize(cross(normal, [
		orientation[0] * stretch,
		orientation[1] * squash,
		orientation[2] * stretch
	])), tangent = normalize(cross(bitangent, normal));
	let point;
	if (chart === "crown-envelope") point = [
		mount.uv[0],
		Math.max(...contour.points.map((p) => p[1])) + mount.uv[1],
		0
	];
	else if (chart === "perimeter-front") {
		const perimeter = perimeterMountPoint(contour, direction), inset = options.perimeterInset ?? .96;
		point = containedFrontPoint(contour, perimeter[0] * inset, perimeter[1] * inset, options.containmentClearance ?? .006);
	} else {
		const x = direction[0] / direction[2], y = direction[1] / direction[2], fit = Math.min(1, mountChart(contour).faceRadius / Math.max(Math.hypot(x, y), 1e-12));
		point = contourSurfacePoint(contour, x * fit, y * fit);
	}
	const position = add(deformBodyPoint(body, point, squash, profileOverride), scale(normal, mount.offset));
	return {
		position,
		normal,
		tangent,
		bitangent,
		matrix: frameMatrix(position, tangent, bitangent, normal)
	};
}
//#endregion
//#region core/plugin-attachment.js
/** Blend only asset-owned calibration data, including interrupted morph provenance. */
function resolveAccessoryPluginMount(attachment, shape, weights) {
	if (!weights) {
		const mount = attachment.mounts[shape];
		if (!mount) throw new TypeError(`Accessory mount is missing ${shape}.`);
		return {
			...mount,
			uv: [...mount.uv],
			rotation: [...mount.rotation]
		};
	}
	const result = {
		uv: [0, 0],
		rotation: [
			0,
			0,
			0
		],
		offset: 0,
		scale: 0
	};
	let total = 0;
	for (const name of Object.keys(weights)) {
		const weight = weights[name];
		if (!MATERIAL_SHAPE_NAMES.includes(name) || typeof weight !== "number" || !Number.isFinite(weight) || weight < 0 || weight > 1) throw new RangeError("Shape weights must be finite catalog-shape weights between zero and one.");
		const mount = attachment.mounts[name];
		if (!mount) throw new TypeError(`Accessory mount is missing ${name}.`);
		total += weight;
		for (let i = 0; i < 2; i++) result.uv[i] += mount.uv[i] * weight;
		for (let i = 0; i < 3; i++) result.rotation[i] += mount.rotation[i] * weight;
		result.offset += mount.offset * weight;
		result.scale += mount.scale * weight;
	}
	if (Math.abs(total - 1) > 1e-6) throw new RangeError("Shape weights must sum to one.");
	return result;
}
/** Neutral calibrated frame BEFORE mesh clearance. Matrix is orthonormal; scale is separate.
* Explicit part-animation translation/scale continue to use the public slot frame.
*/
function getAccessoryPluginAttachmentFrame(body, attachment, options = {}) {
	const squash = options.squash ?? 1;
	if (!Number.isFinite(squash) || squash < .25 || squash > 4 || options.depth !== void 0 && (!Number.isFinite(options.depth) || options.depth <= 0 || options.depth > 16)) throw new RangeError("Invalid accessory attachment body pose.");
	const mount = resolveAccessoryPluginMount(attachment, body.shape, options.shapeWeights);
	const profile = options.depth === void 0 ? void 0 : { depth: options.depth }, scale = mount.scale * (attachment.geometryScale ?? 1);
	if (attachment.mode === "contained-front") return {
		...sampleContainedFrontSurface(body, mount, squash, options.contour, profile),
		scale
	};
	if (attachment.mode === "crown-envelope" || attachment.mode === "perimeter-front") return {
		...sampleCalibratedSurface(body, mount, attachment.mode, attachment, squash, options.contour, profile),
		scale
	};
	const eyes = validateAccessoryPluginEyeMeasurements(options.eyes);
	const calibrated = sampleCalibratedSurface(body, mount, "central-front", {}, squash, options.contour, profile);
	const reference = sampleCalibratedSurface(body, {
		uv: attachment.referenceUv ?? [0, .1],
		offset: 0,
		rotation: [
			0,
			0,
			0
		]
	}, "central-front", {}, squash, options.contour, profile);
	const position = [
		(eyes.left[0] + eyes.right[0]) / 2 + calibrated.position[0] - reference.position[0],
		(eyes.left[1] + eyes.right[1]) / 2 + calibrated.position[1] - reference.position[1],
		0
	];
	const orientation = transform([
		0,
		0,
		0
	], mount.rotation), tangent = [
		orientation[0],
		orientation[1],
		orientation[2]
	], bitangent = [
		orientation[4],
		orientation[5],
		orientation[6]
	], normal = [
		orientation[8],
		orientation[9],
		orientation[10]
	];
	return {
		position,
		tangent,
		bitangent,
		normal,
		matrix: frameMatrix(position, tangent, bitangent, normal),
		scale
	};
}
//#endregion
//#region core/resolved-design.js
const targets = () => ({
	smile: {
		radius: .75,
		thickness: .22
	},
	blink: { thickness: .16 }
});
/** New descriptors on every resolution; caller-owned designs never gain hidden geometry. */
function resolveDesign(design) {
	return {
		version: 7,
		body: { ...design.body },
		eyes: {
			shape: "capsule",
			width: .16,
			height: .34,
			anchor: {
				region: "face",
				uv: [0, .1],
				offset: 0
			},
			spacing: .64,
			scale: 1,
			color: design.eyes.color,
			left: {
				weights: { ...design.eyes.left.weights },
				targets: targets()
			},
			right: {
				weights: { ...design.eyes.right.weights },
				targets: targets()
			}
		},
		accessories: design.accessories.map((accessory) => {
			let anchor, follow;
			if (accessory.preset === "earring" || accessory.preset === "starEarring") {
				anchor = {
					region: accessory.slot === "leftEar" ? "left" : "right",
					uv: [0, -.15],
					offset: 0
				};
				follow = .35;
			} else if (accessory.preset === "moustache" || accessory.preset === "goatee") {
				anchor = {
					region: "face",
					uv: [0, -.23],
					offset: 0
				};
				follow = 0;
			} else if (accessory.preset === "bowTie" || accessory.preset === "scarf" || accessory.preset === "necklace") {
				anchor = {
					region: "face",
					uv: [0, -.55],
					offset: 0
				};
				follow = .15;
			} else {
				anchor = {
					region: accessory.preset === "glasses" || accessory.preset === "sunglasses" ? "face" : "crown",
					uv: [0, accessory.preset === "glasses" || accessory.preset === "sunglasses" ? .1 : 0],
					offset: accessory.preset === "halo" ? .22 : accessory.preset === "glasses" || accessory.preset === "sunglasses" ? 0 : .035
				};
				follow = accessory.preset === "glasses" || accessory.preset === "sunglasses" ? 0 : .5;
			}
			return {
				...accessory,
				anchor,
				scale: 1,
				rotation: [
					0,
					0,
					0
				],
				follow
			};
		})
	};
}
//#endregion
//#region core/contour-rectangle.js
const STRIDE = 11;
const edgeCache = /* @__PURE__ */ new WeakMap();
function rectangleEdges(contour) {
	let edges = edgeCache.get(contour);
	if (edges) return edges;
	const points = contourDistanceOutline(contour);
	edges = new Float64Array(points.length * STRIDE);
	for (let i = 0; i < points.length; i++) {
		const a = points[i], b = points[(i + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1];
		const lengthSquared = dx * dx + dy * dy;
		edges.set([
			a[0],
			a[1],
			b[0],
			b[1],
			dx,
			dy,
			lengthSquared ? 1 / lengthSquared : 0,
			Math.min(a[0], b[0]),
			Math.min(a[1], b[1]),
			Math.max(a[0], b[0]),
			Math.max(a[1], b[1])
		], i * STRIDE);
	}
	edgeCache.set(contour, edges);
	return edges;
}
function pointBoxDistanceSquared(x, y, minX, minY, maxX, maxY) {
	const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
	const dy = y < minY ? minY - y : y > maxY ? y - maxY : 0;
	return dx * dx + dy * dy;
}
function pointSegmentDistanceSquared(x, y, ax, ay, dx, dy, inverseLengthSquared) {
	const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) * inverseLengthSquared));
	const ex = x - ax - t * dx, ey = y - ay - t * dy;
	return ex * ex + ey * ey;
}
/** Whether a segment reaches the closed box (or its open interior at zero margin). */
function segmentIntersectsBox(ax, ay, dx, dy, minX, minY, maxX, maxY, open) {
	let low = 0, high = 1;
	if (dx === 0) {
		if (open ? ax <= minX || ax >= maxX : ax < minX || ax > maxX) return false;
	} else {
		const first = (minX - ax) / dx, last = (maxX - ax) / dx;
		low = Math.max(low, Math.min(first, last));
		high = Math.min(high, Math.max(first, last));
	}
	if (dy === 0) {
		if (open ? ay <= minY || ay >= maxY : ay < minY || ay > maxY) return false;
	} else {
		const first = (minY - ay) / dy, last = (maxY - ay) / dy;
		low = Math.max(low, Math.min(first, last));
		high = Math.min(high, Math.max(first, last));
	}
	return open ? low < high : low <= high;
}
function containsDegenerateRectangle(contour, edges, minX, minY, maxX, maxY) {
	const horizontal = minX !== maxX, start = horizontal ? minX : minY, end = horizontal ? maxX : maxY;
	if (start === end) return contourSignedDistance(contour, minX, minY) >= 0;
	const fixed = horizontal ? minY : minX, cuts = [start, end];
	for (let i = 0; i < edges.length; i += STRIDE) {
		const a = edges[i + (horizontal ? 1 : 0)], delta = edges[i + (horizontal ? 5 : 4)];
		const variable = edges[i + (horizontal ? 0 : 1)], variableDelta = edges[i + (horizontal ? 4 : 5)];
		if (delta === 0) {
			if (a === fixed) cuts.push(Math.max(start, Math.min(end, variable)), Math.max(start, Math.min(end, variable + variableDelta)));
		} else {
			const t = (fixed - a) / delta;
			if (t >= 0 && t <= 1) {
				const crossing = variable + t * variableDelta;
				if (crossing > start && crossing < end) cuts.push(crossing);
			}
		}
	}
	cuts.sort((a, b) => a - b);
	for (let i = 1; i < cuts.length; i++) {
		if (cuts[i] === cuts[i - 1]) continue;
		const middle = (cuts[i - 1] + cuts[i]) / 2;
		if (contourSignedDistance(contour, horizontal ? middle : fixed, horizontal ? fixed : middle) < 0) return false;
	}
	return contourSignedDistance(contour, minX, minY) >= 0 && contourSignedDistance(contour, maxX, maxY) >= 0;
}
/**
* Whether a closed, axis-aligned rectangle is inside the current simplified
* contour and at least `margin` from every boundary segment, in Euclidean XY.
* `bottom` and `top` are offsets from `centerY`; all dimensions and the margin
* are in the same normalized coordinates as contourDistanceOutline. Boundary
* contact is allowed at zero margin. Invalid/non-finite bounds return false.
*
* Unlike perimeter sampling, this catches long crossing edges, narrow concave
* notches, and minima between samples. One inside query plus segment/box tests
* is sufficient: a connected rectangle cannot leave the interior without
* crossing its boundary. No extra approximation or fitting tolerance is used.
*/
function containsRectangleWithMargin(contour, centerX, centerY, halfWidth, bottom, top, margin) {
	if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(halfWidth) || !Number.isFinite(bottom) || !Number.isFinite(top) || !Number.isFinite(margin) || halfWidth < 0 || bottom > top || margin < 0) return false;
	const minX = centerX - halfWidth, maxX = centerX + halfWidth, minY = centerY + bottom, maxY = centerY + top;
	if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return false;
	if (!(contourSignedDistance(contour, centerX, minY / 2 + maxY / 2) >= margin)) return false;
	const edges = rectangleEdges(contour);
	if (margin === 0 && (minX === maxX || minY === maxY)) return containsDegenerateRectangle(contour, edges, minX, minY, maxX, maxY);
	const outerMinX = minX - margin, outerMaxX = maxX + margin, outerMinY = minY - margin, outerMaxY = maxY + margin;
	const marginSquared = margin * margin;
	for (let i = 0; i < edges.length; i += STRIDE) {
		const ax = edges[i], ay = edges[i + 1], bx = edges[i + 2], by = edges[i + 3];
		if (edges[i + 7] > outerMaxX || edges[i + 8] > outerMaxY || edges[i + 9] < outerMinX || edges[i + 10] < outerMinY) continue;
		const dx = edges[i + 4], dy = edges[i + 5];
		if (segmentIntersectsBox(ax, ay, dx, dy, minX, minY, maxX, maxY, margin === 0)) return false;
		if (margin === 0) continue;
		if (pointBoxDistanceSquared(ax, ay, minX, minY, maxX, maxY) < marginSquared || pointBoxDistanceSquared(bx, by, minX, minY, maxX, maxY) < marginSquared) return false;
		const inverseLengthSquared = edges[i + 6];
		if (pointSegmentDistanceSquared(minX, minY, ax, ay, dx, dy, inverseLengthSquared) < marginSquared || pointSegmentDistanceSquared(minX, maxY, ax, ay, dx, dy, inverseLengthSquared) < marginSquared || pointSegmentDistanceSquared(maxX, minY, ax, ay, dx, dy, inverseLengthSquared) < marginSquared || pointSegmentDistanceSquared(maxX, maxY, ax, ay, dx, dy, inverseLengthSquared) < marginSquared) return false;
	}
	return true;
}
//#endregion
//#region core/eye-projection.js
const MIN_FRONT_AREA = .015;
const fittingCache = /* @__PURE__ */ new WeakMap();
/** Orthographic camera coordinates; +Z points toward the camera. */
function viewPoint(matrix, point, vector = false) {
	return [
		0,
		1,
		2
	].map((row) => matrix[row] * point[0] + matrix[4 + row] * point[1] + matrix[8 + row] * point[2] + (vector ? 0 : matrix[12 + row]));
}
/**
* Orthographic projection of the stable body front-plane frame. Keep both raw
* columns: normalizing them or making them perpendicular would billboard the
* glyph, erasing yaw/pitch foreshortening and combined-rotation shear.
* `root` includes the animated pose and authored body rotations, but not local body squash.
*/
function eyeBasis(root) {
	const right = viewPoint(root, [
		1,
		0,
		0
	], true), up = viewPoint(root, [
		0,
		1,
		0
	], true);
	return [
		right[0],
		right[1],
		up[0],
		up[1]
	];
}
/** Centers follow the rounded surface; the renderer evaluates glyphs in local XY. */
function projectEyes(design, root, face = [0, 0], gaze = [0, 0], squash = 1, contour, profile) {
	const displayedProfile = profile ?? resolveShapeProfile(design.body.shape);
	const eye = {
		...design.eyes,
		...resolveShapeEyeGeometry(design.eyes, displayedProfile)
	};
	const basis = eyeBasis(root), [rx, ry, ux, uy] = basis;
	const determinant = rx * uy - ry * ux;
	const inverseBasis = determinant > MIN_FRONT_AREA ? [
		uy / determinant,
		-ux / determinant,
		-ry / determinant,
		rx / determinant
	] : [
		0,
		0,
		0,
		0
	];
	const u = clamp(eye.anchor.uv[0], -1.35 + eye.spacing / 2, 1.35 - eye.spacing / 2);
	const v = clamp(eye.anchor.uv[1], -1.35, 1.35);
	const unit = Math.min(BODY_SIZE[0], BODY_SIZE[1]) * .5 * eye.scale;
	const size = [eye.width * unit, eye.height * unit];
	const outline = contour ?? shapeContour({
		kind: "material",
		name: design.body.shape
	});
	const original = [-1, 1].map((side) => {
		const uv = [u + side * eye.spacing / 2, v], alpha = uv[0] * 1.05, beta = uv[1] * .9;
		return {
			uv,
			x: Math.tan(alpha),
			y: Math.tan(beta) / Math.cos(alpha)
		};
	});
	const stretch = 1 / Math.sqrt(squash), width = eye.width * eye.scale, height = eye.height * eye.scale, glyphUnit = Math.min(width, height);
	const envelopes = [eye.left, eye.right].map((state) => {
		const { smile, blink } = state.targets;
		const smileExtent = width * smile.radius + glyphUnit * smile.thickness / 2;
		return {
			halfWidth: Math.max(width / 2, smileExtent),
			bottom: -Math.max(height, glyphUnit * smile.thickness, glyphUnit * blink.thickness) / 2,
			top: Math.max(height / 2, smileExtent, glyphUnit * blink.thickness / 2)
		};
	});
	const shoulder = Math.max(.1, ...envelopes.map((envelope) => envelope.halfWidth * 1.25));
	const fits = (amount) => original.every((center, index) => {
		const envelope = envelopes[index];
		return containsRectangleWithMargin(outline, center.x * amount, center.y * amount, envelope.halfWidth / stretch, envelope.bottom / squash, envelope.top / squash, shoulder);
	});
	let contourFits = fittingCache.get(outline);
	if (!contourFits) {
		contourFits = /* @__PURE__ */ new Map();
		fittingCache.set(outline, contourFits);
	}
	const fittingKey = JSON.stringify([
		u,
		v,
		squash,
		eye.spacing,
		width,
		height,
		eye.left.targets,
		eye.right.targets
	]);
	let fit = contourFits.get(fittingKey);
	if (fit === void 0) {
		fit = 1;
		if (!fits(1) && fits(0)) {
			let low = 0, high = 1;
			for (let i = 1; i <= 40; i++) {
				const amount = i / 40;
				if (!fits(amount)) {
					high = amount;
					break;
				}
				low = amount;
			}
			for (let i = 0; i < 12; i++) {
				const mid = (low + high) / 2;
				if (fits(mid)) low = mid;
				else high = mid;
			}
			const separation = Math.hypot(original[1].x - original[0].x, original[1].y - original[0].y);
			const minimum = Math.min(1, (envelopes[0].halfWidth + envelopes[1].halfWidth + .02) / stretch / Math.max(1e-6, separation));
			fit = Math.max(minimum, low);
		}
		if (contourFits.size >= 32) contourFits.clear();
		contourFits.set(fittingKey, fit);
	}
	const targetU = clamp(u + face[0] + clamp(gaze[0], -1, 1) * .1, -1.35 + eye.spacing / 2, 1.35 - eye.spacing / 2);
	const targetV = clamp(v + face[1] + clamp(gaze[1], -1, 1) * .1, -1.35, 1.35);
	const dx = Math.tan(targetU * 1.05) - Math.tan(u * 1.05);
	const dy = Math.tan(targetV * .9) / Math.cos(targetU * 1.05) - Math.tan(v * .9) / Math.cos(u * 1.05);
	const travelFits = (amount) => original.every((center, index) => {
		const envelope = envelopes[index];
		return containsRectangleWithMargin(outline, center.x * fit + dx * amount, center.y * fit + dy * amount, envelope.halfWidth / stretch, envelope.bottom / squash, envelope.top / squash, .015);
	});
	const travelKey = `travel:${fittingKey}:${dx}:${dy}`;
	let travel = contourFits.get(travelKey);
	if (travel === void 0) {
		travel = 1;
		if (dx !== 0 || dy !== 0) {
			if (!travelFits(0)) travel = 0;
			else {
				let low = 0, high = 1;
				for (let i = 1; i <= 12; i++) {
					const amount = i / 12;
					if (!travelFits(amount)) {
						high = amount;
						break;
					}
					low = amount;
				}
				if (low < 1) for (let i = 0; i < 12; i++) {
					const mid = (low + high) / 2;
					if (travelFits(mid)) low = mid;
					else high = mid;
				}
				travel = low;
			}
		}
		if (contourFits.size >= 64) contourFits.clear();
		contourFits.set(travelKey, travel);
	}
	const one = (side) => {
		const originalEye = original[side < 0 ? 0 : 1];
		const raw = [
			originalEye.x * fit + dx * travel,
			originalEye.y * fit + dy * travel,
			1
		];
		const direction = normalize(raw);
		const frame = sampleSurfaceAtXY(design.body, raw[0], raw[1], squash, outline, displayedProfile);
		return {
			center: viewPoint(root, frame.position),
			localCenter: frame.position,
			direction,
			visible: contourSignedDistance(outline, raw[0], raw[1]) > 0 && viewPoint(root, frame.normal, true)[2] > MIN_FRONT_AREA
		};
	};
	const largestFootprint = Math.max(size[1], ...envelopes.map((envelope) => envelope.halfWidth * unit * 2 / eye.scale));
	return {
		left: one(-1),
		right: one(1),
		size,
		basis,
		inverseBasis,
		depthRange: Math.max(...size, largestFootprint) * 1.8
	};
}
//#endregion
//#region core/plugin-eye-measurements.js
/** Current neutral fitted eye geometry: follows face motion, never gaze or expression weights. */
function getAccessoryPluginEyeMeasurements(design, options = {}) {
	const squash = options.squash ?? 1, face = options.face ?? [0, 0];
	if (!Number.isFinite(squash) || squash < .25 || squash > 4 || face.length !== 2 || !face.every((value) => Number.isFinite(value) && Math.abs(value) <= 16)) throw new RangeError("Invalid neutral eye measurement pose.");
	const projected = projectEyes(resolveDesign(design), identity(), face, [0, 0], squash, options.contour, options.profile);
	return {
		left: [projected.left.localCenter[0], projected.left.localCenter[1]],
		right: [projected.right.localCenter[0], projected.right.localCenter[1]],
		size: [...projected.size]
	};
}
//#endregion
//#region core/accessory-attachments.js
const anchors = {
	head: {
		region: "crown",
		uv: [0, 0],
		offset: 0
	},
	eyes: {
		region: "face",
		uv: [0, .1],
		offset: 0
	},
	leftEye: {
		region: "face",
		uv: [-.3, .1],
		offset: 0
	},
	rightEye: {
		region: "face",
		uv: [.3, .1],
		offset: 0
	},
	mouth: {
		region: "face",
		uv: [0, -.23],
		offset: 0
	},
	neck: {
		region: "face",
		uv: [0, -.55],
		offset: 0
	},
	leftEar: {
		region: "left",
		uv: [0, -.15],
		offset: 0
	},
	rightEar: {
		region: "right",
		uv: [0, -.15],
		offset: 0
	}
};
const ACCESSORY_ATTACHMENT_POINTS = Object.freeze(Object.keys(anchors));
/** Body-local frame; the renderer applies body orientation and movement exactly once afterward. */
function getAccessoryAttachmentFrame(body, point, options = {}) {
	if (!Object.hasOwn(anchors, point)) throw new TypeError(`Unknown accessory attachment point: ${point}`);
	const squash = options.squash ?? 1;
	if (!Number.isFinite(squash) || squash < .25 || squash > 4) throw new RangeError("Attachment squash must be between 0.25 and 4.");
	return {
		...sampleSurface(body, anchors[point], squash, options.contour, options.profile),
		scale: 1
	};
}
/** Resolve multiple points in the same body/morph frame, useful for authored bridges or bands. */
function getAccessoryAttachmentFrames(body, points, options = {}) {
	return points.map((point) => getAccessoryAttachmentFrame(body, point, options));
}
/** Convert an author-local point into body-local coordinates using a supplied attachment frame. */
function attachmentPointToBody(frame, point) {
	if (point.length !== 3 || !point.every(Number.isFinite)) throw new TypeError("Attachment point must have three finite coordinates.");
	return frame.position.map((value, i) => value + frame.scale * (frame.tangent[i] * point[0] + frame.bitangent[i] * point[1] + frame.normal[i] * point[2]));
}
//#endregion
//#region plugin-sdk.js
/**
* Type-check a plugin definition while preserving its inferred ID, slots, custom
* fields and synchronous/asynchronous factory return type. This is an identity
* helper: it returns the same object without validation, copying, freezing,
* registration, or calling createMesh. The runtime registry validates metadata
* when registering/loading the plugin and validates the produced geometry.
*/
function defineAccessoryPlugin(plugin) {
	return plugin;
}
/**
* Validate author-supplied mesh data with the runtime's geometry contract and
* return independently owned vertex/index buffers. The input is not modified.
* Vertices are [x, y, z, nx, ny, nz] in attachment-local model units.
*/
function defineAccessoryGeometry(geometry) {
	return validateAccessoryPluginGeometry(geometry);
}
/**
* Validate a clip with the runtime's animation contract and return an owned data
* snapshot. The input is not modified. Duration and keyframe times are seconds.
*/
function definePartAnimation(clip) {
	return validatePartAnimation(clip);
}
//#endregion
exports.ACCESSORY_ATTACHMENT_POINTS = ACCESSORY_ATTACHMENT_POINTS;
exports.ACCESSORY_PLUGIN_DEFORMATION_LIMITS = ACCESSORY_PLUGIN_DEFORMATION_LIMITS;
exports.ACCESSORY_PLUGIN_LIMITS = ACCESSORY_PLUGIN_LIMITS;
exports.ACCESSORY_SLOTS = ACCESSORY_SLOTS;
exports.PART_ANIMATION_LIMITS = PART_ANIMATION_LIMITS;
exports.attachmentPointToBody = attachmentPointToBody;
exports.createPairedAffineDeformation = createPairedAffineDeformation;
exports.defineAccessoryGeometry = defineAccessoryGeometry;
exports.defineAccessoryPlugin = defineAccessoryPlugin;
exports.definePartAnimation = definePartAnimation;
exports.getAccessoryAttachmentFrame = getAccessoryAttachmentFrame;
exports.getAccessoryAttachmentFrames = getAccessoryAttachmentFrames;
exports.getAccessoryPluginAttachmentFrame = getAccessoryPluginAttachmentFrame;
exports.getAccessoryPluginEyeMeasurements = getAccessoryPluginEyeMeasurements;
exports.resolveAccessoryPluginMount = resolveAccessoryPluginMount;
exports.samplePartAnimation = samplePartAnimation;
exports.validateAccessoryPluginAttachment = validateAccessoryPluginAttachment;
exports.validateAccessoryPluginDeformation = validateAccessoryPluginDeformation;
exports.validateAccessoryPluginEyeMeasurements = validateAccessoryPluginEyeMeasurements;
exports.validateAccessoryPluginGeometry = validateAccessoryPluginGeometry;
exports.validateAccessoryPluginSurfaceConnectors = validateAccessoryPluginSurfaceConnectors;
exports.validatePartAnimation = validatePartAnimation;
