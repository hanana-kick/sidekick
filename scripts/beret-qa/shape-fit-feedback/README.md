# Beret fitting revision

Baseline: v0.2.6 / e88b850f88e6c0f3cc6dae37686fbc972b337337.

The fitting profiles now author compact shell size, aperture and free lower-cuff flexibility independently. Body vertices may occupy the open cavity; actual cloth/body triangle crossings remain prohibited. The crown is not globally inflated or raised to hide contact issues. Neutral lower-cuff samples are cached by contour/profile and relaxed continuously during turns so grazing support-ray changes do not snap the mesh.

The diamond, 12-sided-cookie and 8-leaf-clover fits retain their baseline profiles. Scarf geometry is unchanged. The latest three placements use independent opening width/depth factors while retaining compact authored crown sizes. Pentagon sits over its top apex; Flower's left lip seats on the highest petal's left flank and its right lip meets the next petal; PixelTriangle uses a rigid tilted opening plane across the upper stair. These three disable both lower-cuff wrapping and legacy drape. The positive aperture map preserves height, acts fully below normalized height .065, and smoothly returns to the unchanged upper crown by .230. Its factors are part of interpolation, equality, interruption snapshots and mesh-cache keys. All other 32 shapes retain neutral aperture factors of one.

## Verification

Geometry and animation evidence must identify the exact source hashes. Historical checks from earlier profile variants do not certify later changes. The full geometric audit uses actual production triangles, checking intersections, topology, normals and local correction. Native rendered evidence uses the production vertex and fragment shaders. Front-image contact is reviewed separately from numerical surface safety.

Runtime tests cover every catalog shape across 181 joint-axis turn frames, plus dense regressions for previously observed Circle and Burst jumps. Size-normalized felt-deformation limits remain in place; authored aperture/hem allowances are explicit in tests.

The owner-selected static social PNG is independent of the renderer and preserved byte-for-byte. Its SHA256 is d9188df94ec2fbd4617e5ad477425ce1ebe5381337d39f7815258ae91c993704.

See the final validation report and performance directory for completed results and limitations.
