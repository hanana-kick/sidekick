/** Resolve the configured, visible avatar in the authored API demo, never the parent shell. */
export async function apiDemoFrame(page) {
  await page.frameLocator('#site-preview-frame').locator('#bot[data-configured]').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#site-preview-frame')?.contentDocument?.querySelector('#bot[data-configured]')?.ready);
  const iframe = await page.locator('#site-preview-frame').elementHandle();
  const frame = await iframe.contentFrame();
  if (!frame) throw new Error('The configured API demo iframe has no content frame');
  return frame;
}
