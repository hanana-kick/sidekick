export type DocumentationFramework = 'element' | 'react';
export const FRAMEWORK_STORAGE_KEY: string;
export function normalizeFramework(value: unknown): DocumentationFramework | null;
export function getFramework(): DocumentationFramework;
export function setFramework(value: DocumentationFramework): void;
export function subscribeFramework(listener: () => void): () => void;
export function frameworkHref(path: string, value?: DocumentationFramework): string;
