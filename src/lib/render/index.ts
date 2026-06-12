/**
 * Morphe render barrel — the public render surface.
 *
 * Authored/agent trees enter through <Node>. Layout primitives recurse into
 * <Node> with the child context they compute. The registry and props contract
 * are re-exported for tooling and tests.
 */

export { default as Node } from "./Node.svelte";
export type { PrimitiveProps } from "./props.js";
export { PRIMITIVES, type PrimitiveKind, primitiveFor } from "./registry.js";
