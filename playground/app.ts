import { createAccessory, createDesign, parseDesign, patchDesign, serializeDesign } from '../src/index.js';
import type { AccessoryDesign, AccessoryPreset, Activity, AvatarDesign, BodyShape, DesignPatch, EyePreset, SidekickAvatar } from '../src/index.js';
function element<T extends HTMLElement = HTMLElement>(id: string): T { const el = document.getElementById(id); if (!el) throw new Error(`Missing #${id}`); return el as T; }
const avatars: SidekickAvatar[] = [element<SidekickAvatar>('flat'), element<SidekickAvatar>('solid')];
const input = (id: string): HTMLInputElement => element<HTMLInputElement>(id);
const storageKey = 'sidekick.design.v1';
const names: Record<AccessoryPreset, string> = { beret: '베레모', halo: '헤일로', glasses: '안경' };
const sunny = (): AvatarDesign => createDesign({ accessories: [createAccessory('beret', 'hat')] });
let design = sunny(), selectedAccessory = 'hat', movedFace = false;
function status(message: string, error = false): void { element('status').textContent = message; element('status').classList.toggle('error', error); }
try { const saved = localStorage.getItem(storageKey); if (saved) design = parseDesign(saved); } catch { status('저장된 디자인을 읽지 못해 기본 디자인을 사용합니다.', true); }
function setRange(id: string, value: number, suffix = ''): void {
  input(id).value = String(value);
  const output = document.querySelector<HTMLOutputElement>(`output[for="${id}"]`);
  if (output) output.value = suffix ? `${Math.round(value)}${suffix}` : value.toFixed(2);
}
function syncAccessory(): void {
  const select = element<HTMLSelectElement>('accessory-target');
  select.replaceChildren(...design.accessories.map(a => { const option = document.createElement('option'); option.value = a.id; option.textContent = `${names[a.preset]} · ${a.id}`; return option; }));
  const current = design.accessories.find(a => a.id === selectedAccessory) ?? design.accessories[0];
  element('accessory-settings').hidden = !current;
  if (!current) return;
  selectedAccessory = current.id; select.value = current.id;
  input('accessory-color').value = current.color;
  setRange('accessory-x', current.anchor.uv[0]); setRange('accessory-offset', current.anchor.offset);
  setRange('accessory-rotation', current.rotation[current.anchor.region === 'crown' ? 1 : 2]); setRange('accessory-follow', current.follow);
}
function syncControls(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.shape === design.body.shape)));
  document.querySelectorAll<HTMLButtonElement>('[data-eyes]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.eyes === design.eyes.preset)));
  input('body-color').value = design.body.color; element('body-color-value').textContent = design.body.color;
  input('eye-color').value = design.eyes.color;
  for (const [i, id] of ['body-width', 'body-height', 'body-depth'].entries()) setRange(id, design.body.size[i]!);
  for (const id of ['roundness', 'taper', 'bulge', 'bend'] as const) setRange(id, design.body[id]);
  input('roundness').disabled = design.body.shape !== 'rounded-box';
  setRange('eye-spacing', design.eyes.spacing); setRange('eye-scale', design.eyes.scale);
  setRange('face-x', design.eyes.anchor.uv[0]); setRange('face-y', design.eyes.anchor.uv[1]);
  document.querySelectorAll<HTMLInputElement>('[data-accessory]').forEach(checkbox => { checkbox.checked = design.accessories.some(a => a.preset === checkbox.dataset.accessory); });
  element<HTMLTextAreaElement>('design-json').value = serializeDesign(design);
  syncAccessory();
}
function apply(next: AvatarDesign, message = '디자인이 이 브라우저에 저장되었습니다.'): void {
  design = parseDesign(next);
  avatars.forEach(avatar => { avatar.design = design; });
  syncControls(); element('json-error').textContent = '';
  try { localStorage.setItem(storageKey, serializeDesign(design)); status(message); } catch { status('브라우저 저장소를 사용할 수 없습니다. JSON으로 내보내세요.'); }
}
function patch(value: DesignPatch): void { apply(patchDesign(design, value)); }
function range(id: string, update: (value: number) => void): void { input(id).addEventListener('input', () => update(Number(input(id).value))); }
function accessory(update: (value: AccessoryDesign) => void): void {
  const next = parseDesign(design), current = next.accessories.find(a => a.id === selectedAccessory);
  if (current) { update(current); apply(next); }
}
function selectTab(name: string): void {
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(tab => {
    const active = tab.dataset.tab === name; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    element(`${tab.dataset.tab}-panel`).hidden = !active;
  });
}
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tab]'));
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab.dataset.tab!));
  tab.addEventListener('keydown', event => {
    let next = i;
    if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); selectTab(tabs[next]!.dataset.tab!); tabs[next]!.focus();
  });
});
document.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach(button => button.addEventListener('click', () => patch({ body: { shape: button.dataset.shape as BodyShape } })));
document.querySelectorAll<HTMLButtonElement>('[data-eyes]').forEach(button => button.addEventListener('click', () => patch({ eyes: { preset: button.dataset.eyes as EyePreset } })));
input('body-color').addEventListener('input', () => patch({ body: { color: input('body-color').value } }));
input('eye-color').addEventListener('input', () => patch({ eyes: { color: input('eye-color').value } }));
for (const [i, id] of ['body-width', 'body-height', 'body-depth'].entries()) range(id, value => { const size = [...design.body.size] as [number, number, number]; size[i] = value; patch({ body: { size } }); });
for (const id of ['roundness', 'taper', 'bulge', 'bend'] as const) range(id, value => patch({ body: { [id]: value } }));
range('eye-spacing', spacing => patch({ eyes: { spacing } })); range('eye-scale', scale => patch({ eyes: { scale } }));
range('face-x', x => patch({ eyes: { anchor: { uv: [x, design.eyes.anchor.uv[1]] } } }));
range('face-y', y => patch({ eyes: { anchor: { uv: [design.eyes.anchor.uv[0], y] } } }));
range('openness', openness => { setRange('openness', openness); avatars.forEach(avatar => { void avatar.motion.to({ eyes: { openness } }, { duration: 0 }); }); });
document.querySelectorAll<HTMLInputElement>('[data-accessory]').forEach(checkbox => checkbox.addEventListener('change', () => {
  const preset = checkbox.dataset.accessory as AccessoryPreset;
  const accessories = design.accessories.filter(a => a.preset !== preset);
  if (checkbox.checked) { const item = createAccessory(preset, preset === 'beret' ? 'hat' : preset); accessories.push(item); selectedAccessory = item.id; }
  patch({ accessories });
}));
element<HTMLSelectElement>('accessory-target').addEventListener('change', event => { selectedAccessory = (event.target as HTMLSelectElement).value; syncAccessory(); });
input('accessory-color').addEventListener('input', () => accessory(a => { a.color = input('accessory-color').value; }));
range('accessory-x', value => accessory(a => { a.anchor.uv[0] = value; }));
range('accessory-offset', value => accessory(a => { a.anchor.offset = value; }));
range('accessory-rotation', value => accessory(a => { a.rotation[a.anchor.region === 'crown' ? 1 : 2] = value; }));
range('accessory-follow', value => accessory(a => { a.follow = value; }));
document.querySelectorAll<HTMLButtonElement>('[data-background]').forEach(button => button.addEventListener('click', () => {
  document.querySelector<HTMLElement>('.previews')!.dataset.background = button.dataset.background;
  document.querySelectorAll<HTMLButtonElement>('[data-background]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
}));
document.querySelectorAll<HTMLButtonElement>('[data-activity]').forEach(button => button.addEventListener('click', () => {
  avatars.forEach(avatar => avatar.setActivity(button.dataset.activity as Activity));
  document.querySelectorAll<HTMLButtonElement>('[data-activity]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
}));
element('pause').addEventListener('click', () => {
  const paused = !avatars[0]!.paused; avatars.forEach(avatar => { avatar.paused = paused; });
  element('pause').setAttribute('aria-pressed', String(paused)); element('pause').textContent = paused ? '재생' : '일시 정지';
});
range('view-yaw', yaw => { setRange('view-yaw', yaw, '°'); avatars.forEach(avatar => avatar.setView(yaw * Math.PI / 180)); });
for (const [id, x] of [['look-left', -0.9], ['look-center', 0], ['look-right', 0.9]] as const) element(id).addEventListener('click', () => avatars.forEach(avatar => avatar.lookAt({ space: 'view', x, y: 0 })));
element('face-motion').addEventListener('click', () => { movedFace = !movedFace; avatars.forEach(avatar => { void avatar.motion.to({ face: { uv: movedFace ? [0.23, 0.13] : [0, 0] } }, { duration: 650 }); }); });
document.querySelectorAll<HTMLButtonElement>('[data-recipe]').forEach(button => button.addEventListener('click', () => {
  const name = button.dataset.recipe;
  apply(name === 'pebble' ? createDesign({ body: { shape: 'orb', color: '#b5bacf', size: [1.24, 1.1, 1] }, eyes: { preset: 'arc' } }) : name === 'orbit' ? createDesign({ body: { shape: 'droplet', color: '#8bba9c', size: [1.2, 1.3, 1.1] }, eyes: { preset: 'round' }, accessories: [createAccessory('halo')] }) : sunny());
}));
element('reset').addEventListener('click', () => {
  avatars.forEach(avatar => { avatar.paused = false; avatar.motion.cancel(); void avatar.motion.to({ body: { rotation: [0, 0, 0] }, face: { uv: [0, 0] }, eyes: { openness: 1 } }, { duration: 0 }); avatar.lookAt({ space: 'view', x: 0, y: 0 }); avatar.setView(0); avatar.seek(0); avatar.setActivity('idle'); });
  movedFace = false; setRange('view-yaw', 0, '°'); setRange('openness', 1);
  element('pause').textContent = '일시 정지'; element('pause').setAttribute('aria-pressed', 'false');
  document.querySelectorAll<HTMLButtonElement>('[data-activity]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.activity === 'idle')));
  apply(sunny(), '기본 디자인으로 초기화했습니다.');
});
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
element('export-json').addEventListener('click', () => { download(new Blob([serializeDesign(design)], { type: 'application/json' }), 'sidekick.design.json'); status('디자인 JSON을 내보냈습니다.'); });
element('export-png').addEventListener('click', async () => { try { download(await avatars[1]!.snapshot(), 'sidekick.png'); status('투명 PNG를 내보냈습니다.'); } catch (error) { status(String(error), true); } });
element('import-json').addEventListener('click', () => { try { apply(parseDesign(element<HTMLTextAreaElement>('design-json').value), 'JSON 디자인을 적용했습니다.'); } catch (error) { element('json-error').textContent = error instanceof Error ? error.message : String(error); } });
element('copy-json').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(element<HTMLTextAreaElement>('design-json').value); status('JSON을 복사했습니다.'); }
  catch { element<HTMLTextAreaElement>('design-json').select(); status('복사 권한이 없습니다. 선택된 JSON을 직접 복사하세요.', true); }
});
for (const avatar of avatars) avatar.addEventListener('sidekick-error', event => status((event as CustomEvent<{ message: string }>).detail.message, true));
element('api-example').textContent = `<sidekick-avatar id="bot" render-style="3d"></sidekick-avatar>\n\nimport { createDesign } from '@hanana-kick/sidekick';\nconst bot = document.querySelector('sidekick-avatar');\nawait bot.setDesign(design);\nbot.setActivity('thinking');\nbot.lookAt({ space: 'view', x: 0.6, y: 0.2 });\nawait bot.motion.to({ face: { uv: [0.2, 0.1] } }, { duration: 500 });`;
apply(design, '로컬 디자인 · 모든 변경은 즉시 반영됩니다.');
