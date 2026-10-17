import { defineElements } from 'sidekick/elements';
import { avatarFromHash, listBodyShapes, randomAvatar } from 'sidekick/avatar';
import { applyTheme, DEFAULT_TOKENS } from 'sidekick/theme';
import type { SkkAvatar, SkkBot, SkkBubble, BotState } from 'sidekick';
import type { AvatarMode } from 'sidekick/avatar';

defineElements();
applyTheme(document, DEFAULT_TOKENS);

const STATES: BotState[] = ['idle', 'listening', 'thinking', 'speaking', 'success', 'error', 'sleeping'];
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const hero = $('hero') as unknown as SkkAvatar;
const seedInput = $<HTMLInputElement>('seed');
const shapeSelect = $<HTMLSelectElement>('shape');
const modeSelect = $<HTMLSelectElement>('mode');
const out = $('out');
const gallery = $('gallery');
const stage = $('stage');

for (const shape of listBodyShapes()) {
  const option = document.createElement('option');
  option.value = shape.kind;
  option.textContent = shape.kind;
  shapeSelect.appendChild(option);
}

function syncHero(): void {
  hero.setAttribute('seed', seedInput.value);
  hero.setAttribute('mode', modeSelect.value as AvatarMode);
  if (shapeSelect.value) hero.setAttribute('shape', shapeSelect.value);
  else hero.removeAttribute('shape');
  hero.refresh();
  const item = hero.getAvatar();
  if (item) {
    out.textContent = `${item.hash} · ${item.body.shape} · ${item.eyes[0]?.kind} · ${item.accessories.length} acc`;
  }
}

const stateBar = $('states');
for (const state of STATES) {
  const button = document.createElement('button');
  button.textContent = state;
  button.onclick = () => {
    hero.setAttribute('state', state);
    hero.requestUpdate?.();
  };
  stateBar.appendChild(button);
}

seedInput.oninput = syncHero;
shapeSelect.onchange = syncHero;
modeSelect.onchange = syncHero;
$('random').onclick = () => {
  const item = randomAvatar();
  seedInput.value = item.seed || item.hash;
  syncHero();
};
$('copy').onclick = () => {
  const item = hero.getAvatar();
  if (item) void navigator.clipboard?.writeText(JSON.stringify(item));
};

// ---- gallery -----------------------------------------------------------
function buildGallery(): void {
  gallery.replaceChildren();
  // Browser WebGL context budget (see MAX_WEBGL_CONTEXTS): keep the gallery small
  // so hero + bot + gallery all stay in 3D.
  for (let i = 0; i < 6; i += 1) {
    const seed = `bot-${i}-${modeSelect.value}`;
    const item = avatarFromHash(seed);
    const figure = document.createElement('figure');
    figure.className = 'cell';
    figure.style.margin = '0';
    const avatar = document.createElement('skk-avatar') as unknown as SkkAvatar;
    avatar.style.width = '96px';
    avatar.style.height = '96px';
    avatar.setAttribute('seed', seed);
    avatar.setAttribute('mode', modeSelect.value);
    const caption = document.createElement('figcaption');
    caption.textContent = `${item.hash.slice(0, 8)}`;
    figure.append(avatar, caption);
    gallery.appendChild(figure);
  }
}
modeSelect.addEventListener('change', buildGallery);

// ---- bot ---------------------------------------------------------------
const bot = document.createElement('skk-bot') as unknown as SkkBot;
bot.setAttribute('seed', 'sidekick-bot');
bot.setAttribute('size', '88');
bot.setAttribute('position-mode', 'contained');
bot.setAttribute('position', 'bottom-right');
stage.appendChild(bot);

const bubble = document.createElement('skk-bubble') as unknown as SkkBubble;
bubble.slot = 'bubble';
bubble.setAttribute('tail', 'left');
bubble.hidden = true;
bot.appendChild(bubble);

$('position').onchange = (event) => bot.setAttribute('position', (event.target as HTMLSelectElement).value);
$('drag').onchange = (event) => (bot.drag = (event.target as HTMLInputElement).checked);
$('persist').onchange = (event) =>
  bot.setAttribute('persist', (event.target as HTMLInputElement).checked ? 'playground-bot' : '');
$('move').onclick = () => {
  bot.setAttribute('position-mode', 'free');
  bot.moveTo(120, 140);
};
$('reset').onclick = () => {
  bot.setAttribute('position-mode', 'contained');
  bot.resetPosition();
};
$('say').onclick = () => {
  bubble.hidden = false;
  bubble.show('Hello! I render on a canvas.', { variant: 'info', duration: 3000 });
  bot.request('speaking');
  window.setTimeout(() => (bubble.hidden = true), 3200);
};

syncHero();
buildGallery();
