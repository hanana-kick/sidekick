/** One application-owned async workflow, shared by the live guide and copied source. */
export const lifecycleLabels = {
  ko: ['집', '앱 작업', '대기 작업 시작', '추적 작업 시작', '성공 응답', '오류 응답', '작업 취소', '숨기기 / 표시', '집 이동', '집 제거 / 다시 마운트', '집에서 대기 중', '처리 중', '완료', '실패', '취소됨'],
  en: ['Home', 'Application work', 'Start waiting task', 'Start following task', 'Resolve success', 'Reject with error', 'Cancel task', 'Hide / show', 'Move home', 'Unmount / mount home', 'Waiting at home', 'Pending', 'Succeeded', 'Failed', 'Cancelled'],
  'zh-CN': ['归位点', '应用任务', '开始等待任务', '开始跟随任务', '报告成功', '报告失败', '取消任务', '隐藏 / 显示', '移动归位点', '卸载 / 挂载归位点', '在归位点等待', '处理中', '已成功', '已失败', '已取消'],
  ja: ['ホーム', 'アプリの作業', '待機タスクを開始', '追従タスクを開始', '成功を通知', '失敗を通知', 'タスクを取消', '非表示 / 表示', 'ホームを移動', 'ホームを解除 / マウント', 'ホームで待機中', '処理中', '成功', '失敗', '取消済み'],
};
export const lifecycleDefaults = {
  presence: { visible: true },
  home: { positioning: { target: '#reference-home', placement: 'center-right', gap: 8 }, rest: { behavior: { type: 'idle' }, emotion: 'neutral', trackingMode: 'off' } },
};
export function lifecycleMarkup(locale = 'en') {
  const labels = lifecycleLabels[locale] ?? lifecycleLabels.en;
  return `<div class="lifecycle-space"><div id="reference-home">${labels[0]}</div><div id="reference-target">${labels[1]}</div></div><div class="lifecycle-controls">${['wait', 'follow', 'success', 'error', 'cancel', 'visible', 'move-home', 'mount-home'].map((action, index) => `<button type="button" data-lifecycle-action="${action}">${labels[index + 2]}</button>`).join('')}</div><p id="lifecycle-app-status" role="status">${labels[10]}</p><output id="lifecycle-state" aria-live="polite"></output>`;
}
export function refreshLifecycleLabels(root, locale) {
  const labels = lifecycleLabels[locale] ?? lifecycleLabels.en;
  root.lifecycleLabels = labels;
  const home = root.querySelector('#reference-home'), target = root.querySelector('#reference-target');
  if (home) home.textContent = labels[0];
  if (target) target.textContent = labels[1];
  [...root.querySelectorAll('[data-lifecycle-action]')].forEach((button, index) => { button.textContent = labels[index + 2]; });
  const status = root.querySelector('#lifecycle-app-status');
  if (status) status.textContent = labels[Number(status.dataset.labelIndex ?? 10)];
}
export const lifecycleCSS = `#reference-root{min-height:440px}#reference-bot{width:72px;height:72px;margin:0}.lifecycle-space{position:relative;height:220px}#reference-home{position:absolute;left:12px;bottom:12px;padding:12px;border:1px solid #d9b64d;border-radius:8px;background:#fffbeb;transition:left .8s ease,bottom .8s ease}#reference-home[data-moved]{left:45%;bottom:80px}#reference-target{position:absolute;right:12px;top:16px;margin:0;width:auto;max-width:42%;padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.lifecycle-controls{display:flex;flex-wrap:wrap;gap:6px}.lifecycle-controls button{padding:8px 10px;min-height:36px;border:1px solid #cbd5e1;border-radius:8px;color:#334155;background:#fff;font:inherit;cursor:pointer}.lifecycle-controls button:disabled{opacity:.45;cursor:default}.lifecycle-controls button:focus-visible{outline:3px solid #ca8a04;outline-offset:2px}#lifecycle-state{display:block;white-space:pre-wrap;font:11px ui-monospace,monospace;overflow-wrap:anywhere}#lifecycle-app-status{font-size:13px}@media(prefers-reduced-motion:reduce){#reference-home{transition:none}}`;

export function installLifecycleExample(bot, root, labels, setters = {}) {
  const setTask = setters.task ?? (value => { bot.task = value; });
  const setPresence = setters.presence ?? (value => { bot.presence = value; });
  const setHome = setters.home ?? (value => { bot.home = value; });
  const buttons = [...root.querySelectorAll('[data-lifecycle-action]')];
  const output = root.querySelector('#lifecycle-app-status');
  const state = root.querySelector('#lifecycle-state');
  const home = root.querySelector('#reference-home');
  const homeParent = home.parentElement;
  let sequence = typeof bot.task?.id === 'number' ? bot.task.id : 0, mountSequence = 0;
  let pending = null, disposed = false, visible = bot.presence?.visible ?? true;
  const show = index => { output.dataset.labelIndex = String(index); output.textContent = (root.lifecycleLabels ?? labels)[index]; };
  const controls = () => { for (const button of buttons) if (['success', 'error', 'cancel'].includes(button.dataset.lifecycleAction)) button.disabled = !pending; };
  function cancel() {
    const work = pending;
    if (!work) return;
    pending = null;
    // An actual app should also abort its own request here.
    work.resolve('cancelled');
    setTask({ id: work.id, status: 'cancelled' });
    show(14); controls();
  }
  async function start(type) {
    // A newer app task supersedes the old request without reporting a stale result.
    pending?.resolve('cancelled');
    pending = null;
    const id = sequence = Math.max(sequence, typeof bot.task?.id === 'number' ? bot.task.id : 0) + 1;
    // This demo promise settles only when an outcome button reports an app result.
    // Replace it with your real fetch/upload promise, never a visual animation timer.
    const request = new Promise((resolve, reject) => { pending = { id, resolve, reject }; });
    setTask({ id, status: 'pending', behavior: { type, target: '#reference-target', side: 'left', gap: 8 } });
    show(11); controls();
    try {
      const result = await request;
      if (disposed || pending?.id !== id || bot.task?.id !== id || result === 'cancelled') return;
      pending = null;
      setTask({ id, status: 'success' });
      show(12);
    } catch {
      if (disposed || pending?.id !== id || bot.task?.id !== id) return;
      pending = null;
      setTask({ id, status: 'error' });
      show(13);
    }
    controls();
  }
  const report = () => { state.textContent = JSON.stringify(bot.lifecycleState ?? {}, null, 2); };
  const listeners = [];
  for (const button of buttons) {
    const listener = () => {
      const action = button.dataset.lifecycleAction;
      if (action === 'wait' || action === 'follow') void start(action);
      else if (action === 'success') pending?.resolve('success');
      else if (action === 'error') pending?.reject(new Error('Simulated application failure'));
      else if (action === 'cancel') cancel();
      else if (action === 'visible') { visible = !visible; setPresence({ visible }); }
      else if (action === 'move-home') home.toggleAttribute('data-moved');
      else if (action === 'mount-home') {
        if (home.isConnected) home.remove();
        else {
          homeParent.append(home);
          // Retry a previously missing target after the app has mounted it.
          const declaration = bot.home;
          if (!declaration) return;
          home.dataset.lifecycleMount = String(++mountSequence);
          setHome({ ...declaration, positioning: { ...declaration.positioning,
            target: `#reference-home[data-lifecycle-mount="${mountSequence}"]` } });
        }
      }
    };
    button.addEventListener('click', listener);
    listeners.push(() => button.removeEventListener('click', listener));
  }
  bot.addEventListener('sidekick-lifecycle-change', report);
  controls(); report();
  return () => {
    disposed = true;
    pending?.resolve('cancelled'); pending = null;
    listeners.forEach(remove => remove());
    bot.removeEventListener('sidekick-lifecycle-change', report);
  };
}

/** Copyable source uses the same app promise, controls and lifecycle declarations. */
export function lifecycleSource(attributes, css, framework = 'element', locale = 'en') {
  const labels = lifecycleLabels[locale] ?? lifecycleLabels.en;
  const json = value => JSON.stringify(value, null, 2).replaceAll('<', '\\u003c');
  const markup = lifecycleMarkup(locale);
  const install = `const installLifecycleExample = ${installLifecycleExample.toString()};`;
  if (framework === 'react') {
    const jsx = markup.replaceAll('class=', 'className=');
    return `import { useEffect, useRef, useState } from 'react';\nimport { SidekickAvatar } from '@hanana-kick/sidekick/react';\n\nconst avatarProps = ${json(attributes)};\nconst labels = ${json(labels)};\n${install}\n\nexport default function LifecycleExample() {\n  const root = useRef(null);\n  const [bot, setBot] = useState(null);\n  const [task, setTask] = useState(avatarProps.task ?? null);\n  const [presence, setPresence] = useState(avatarProps.presence ?? null);\n  const [home, setHome] = useState(avatarProps.home ?? null);\n  useEffect(() => {\n    if (!bot || !root.current) return;\n    let cleanup;\n    const ready = () => { cleanup ??= installLifecycleExample(bot, root.current, labels, { task: setTask, presence: setPresence, home: setHome }); };\n    if (bot.ready) ready();\n    else bot.addEventListener('sidekick-ready', ready, { once: true });\n    return () => { bot.removeEventListener('sidekick-ready', ready); cleanup?.(); };\n  }, [bot]);\n  return <div id="reference-root" ref={root}>\n    <style>{${JSON.stringify(css)}}<\/style>\n    ${jsx}\n    <SidekickAvatar id="reference-bot" ref={setBot} {...avatarProps}\n      presence={presence} task={task} home={home} />\n  </div>;\n}`;
  }
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  const attrs = Object.entries(attributes).map(([key, value]) => `${key}="${escape(typeof value === 'object' ? JSON.stringify(value) : value)}"`).join('\n    ');
  return `<!doctype html>\n<html lang="${locale}">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<style>${css}</style>\n<div id="reference-root">\n${markup}\n<sidekick-avatar id="reference-bot"\n    ${attrs}></sidekick-avatar>\n</div>\n<script type="module">\nimport 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.16.0/dist/browser/sidekick.js';\nconst labels = ${json(labels)};\n${install}\nconst bot = document.querySelector('#reference-bot');\nlet cleanup;\nconst ready = () => { cleanup ??= installLifecycleExample(bot, document.querySelector('#reference-root'), labels); };\nif (bot.ready) ready();\nelse bot.addEventListener('sidekick-ready', ready, { once: true });\nwindow.addEventListener('pagehide', () => { bot.removeEventListener('sidekick-ready', ready); cleanup?.(); }, { once: true });\n<\/script>\n</html>`;
}
