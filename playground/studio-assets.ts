/** Resolve the artifact root independently of the current HTML entry's depth. */
export function studioBaseURL(base: string, moduleURL: string): string {
  // Vite's production modules live in assets/. A document-relative './' would
  // incorrectly put previews and the home link under playground/ on that entry.
  return base === './' || base === '' ? new URL('../', moduleURL).href : base;
}
