/** Shared safe runtime identity for catalog and namespaced plugin equipment. */
export function isAccessoryInstanceId(value) {
    return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._/:-]{0,127}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
}
