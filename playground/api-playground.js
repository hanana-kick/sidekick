import { createAccessory } from '../src/index.ts';
const bot = document.getElementById('bot'), status = document.getElementById('status');
let alternate = false;
const report = (kind, result) => { status.textContent = JSON.stringify({ kind, result, position: bot.position, backend: bot.diagnostics.backend, box: { width: bot.offsetWidth, height: bot.offsetHeight } }, null, 2); };
const run = (kind, operation) => Promise.resolve().then(operation).then(result => report(kind, result)).catch(error => report('error', error.message));
for (const name of ['ready', 'move-end', 'play-end', 'transition-end']) bot.addEventListener(`sidekick-${name}`, event => report(name, event.detail));
document.getElementById('move').onclick = () => run('move', () => bot.moveBy({ x: 160, y: 0 }, { duration: 900 }));
document.getElementById('cancel').onclick = () => bot.cancelMove();
document.getElementById('play').onclick = () => run('play', () => bot.play('celebrating', { duration: 1000 }));
document.getElementById('stop').onclick = () => bot.stop();
document.getElementById('transition').onclick = () => run('transition', () => {
  alternate = !alternate;
  return bot.transitionTo({ shape: alternate ? 'heart' : 'ghostish', expression: alternate ? 'smile' : 'neutral', accessories: [createAccessory(alternate ? 'halo' : 'beret'), createAccessory('glasses')] }, { duration: 700 });
});
document.getElementById('cancel-transition').onclick = () => bot.cancelTransition();
document.getElementById('interactive').onchange = event => { bot.interaction = event.target.checked ? 'box' : 'none'; };
document.getElementById('reduce').onchange = event => { bot.paused = event.target.checked; };
document.addEventListener('click', event => { if (event.target === document.body || event.target === document.documentElement) void run('moveTo', () => bot.moveTo({ x: event.clientX - bot.offsetWidth / 2, y: event.clientY - bot.offsetHeight / 2 }, { duration: 600 })); });
if (bot.ready) report('ready', {});
