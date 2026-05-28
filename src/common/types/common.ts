/**
 * Resolve the value type of an object's keys.
 * 
 * Utility type that extracts the union of all value types from an object type.
 * Equivalent to `T[keyof T]`.
 */
export type ValueOf<T> = T[keyof T]
