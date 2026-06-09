/**
 * Morphe JSON value types — the data vocabulary of the Lemma 5 state layer.
 *
 * Everything tier-1 (store values, recorded events, the future ContextDigest)
 * is JSON-serializable BY CONSTRUCTION: these types admit no functions, no
 * DOM handles, no class instances — so nothing live can ride the wire, and
 * `digestOf(store)` stays a snapshot rather than a serializer (ADR-0003).
 *
 * Kept in their own leaf module so both the store and the event vocabulary
 * can depend on them without depending on each other.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = readonly JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;
export type JsonRecord = Readonly<Record<string, JsonValue>>;
