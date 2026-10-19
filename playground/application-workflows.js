/** The same installer runs the preview and is embedded in the selected source. */
export const workflowIds = ['loading','upload','success','failure','review','validation'];
export const workflowRows = [
 ['데이터 준비 완료','Data ready','数据已就绪','データ準備完了'],
 ['전송 중','Uploading','正在上传','アップロード中'],
 ['업로드 완료','Upload complete','上传完成','アップロード完了'],
 ['저장됨','Saved','已保存','保存済み'],
 ['연결 중','Connecting','正在连接','接続中'],
 ['응답 확인됨','Response received','已收到响应','応答を受信'],
 ['검토 대기','Pending review','等待检查','確認待ち'],
 ['검토 중','Reviewing','正在检查','確認中'],
 ['검토 완료','Reviewed','检查完成','確認済み'],
 ['입력 수정 필요','Correction required','需要修改输入','入力の修正が必要'],
 ['입력 확인 완료','Input validated','输入验证通过','入力確認完了'],
];
export function installApplicationWorkflow(app, bot, kind, options = {}) {
 const text = key => options.translate?.(key) ?? options.labels?.[key] ?? key;
 const get = id => app.querySelector('#' + id);
 const controller = new app.ownerDocument.defaultView.AbortController();
 const signal = controller.signal;
 // Local demonstration workload. Replace these delays with real application results.
 const timers = new Set();
 let running = false;
 const later = (callback, delay) => {
  const timer = setTimeout(() => { timers.delete(timer); if (!signal.aborted && running) callback(); }, delay);
  timers.add(timer);
 };
 const stop = () => { running = false; for (const timer of timers) clearTimeout(timer); timers.clear(); };
 signal.addEventListener('abort', stop, { once:true });
 const actions = new Map();
 const declare = options.declare ?? (value => { bot.behavior = value; });
 const emotion = options.emotion ?? (value => bot.setEmotion(value));
 const feedback = (id, message, state) => {
  const element = get(id); if (!element) return;
  element.textContent = text(message); element.dataset.workflowMessage = message;
  element.dataset.outcome = state; element.setAttribute('role','status');
 };
 const dispatch = id => { if (signal.aborted) return; actions.get(id)?.(); options.onEvent?.(id); };
 const listen = (id, callback) => {
  actions.set(id, callback);
  get(id)?.addEventListener('click', () => dispatch(id), { signal });
 };
 const disable = id => { if (get(id)) get(id).disabled = true; };
 const complete = () => { stop(); declare({type:'celebrate',duration:1600}); emotion('happy'); };
 let progress = 0;
 if (kind === 'loading') listen('app-complete', () => {
  feedback('loading-indicator','데이터 준비 완료','success');
  disable('app-complete'); complete();
 });
 if (kind === 'upload') listen('app-progress', () => {
  progress = Math.min(100,progress+25);
  const message = progress === 100 ? '업로드 완료' : '전송 중';
  feedback('progress-label',message,progress===100?'success':'pending');
  get('progress-label').dataset.progress = String(progress);
  get('progress-label').textContent = `${progress}% · ${text(message)}`;
  const track = get('upload-progress');track.setAttribute('role','progressbar');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(progress));
  track.querySelector('i').style.width = `${progress}%`;
  if (progress === 100) {disable('app-progress');complete();}
  else emotion('curious');
 });
 if (kind === 'success') listen('app-save', () => {
  feedback('save-result','저장됨','success');get('app-save').disabled=true;complete();
 });
 if (kind === 'failure') {
  listen('app-retry', () => {
   feedback('request-result','연결 중','pending');get('app-retry').disabled=true;
   declare({type:'wait',target:'#request-result',side:'left',gap:6});emotion('curious');
   if (running) later(() => dispatch('app-complete'), 1400);
  });
  listen('app-complete', () => {
   feedback('request-result','응답 확인됨','success');disable('app-complete');complete();
  });
 }
 if (kind === 'validation') {
  get('profile-email').type='email';get('profile-email').required=true;
  listen('app-validate', () => {
   const input=get('profile-email'),valid=input.checkValidity();input.setAttribute('aria-invalid',String(!valid));
   feedback('validation-result',valid?'입력 확인 완료':'입력 수정 필요',valid?'success':'error');
   if(valid)complete();else{declare({type:'guide',target:'#email-field',side:'left',gap:6});emotion('concerned');input.focus({preventScroll:true});}
  });
 }
 if (kind === 'review') {
  const rows=[...app.querySelectorAll('.target-item')];
  rows.forEach(row=>{const badge=row.querySelector('.workflow-review-status')??app.ownerDocument.createElement('small');badge.className='workflow-review-status';badge.textContent=text('검토 대기');badge.dataset.workflowMessage='검토 대기';row.append(badge);});
  bot.addEventListener('sidekick-behavior-change', () => {
   const state=bot.behaviorState;if(state.type!=='review')return;
   rows.forEach((row,index)=>{const completed=index<state.completedItems;const current=index===state.itemIndex&&state.status!=='completed';const label=completed?'검토 완료':current?'검토 중':'검토 대기';row.dataset.outcome=completed?'success':current?'pending':'';const badge=row.querySelector('.workflow-review-status');badge.textContent=text(label);badge.dataset.workflowMessage=label;});
   const result=get('review-result');result.textContent=`${state.completedItems}/${rows.length}`;result.setAttribute('role','status');
   if(state.status==='completed')emotion('happy');
  },{signal});
 }
 const start = () => {
  stop(); if (signal.aborted) return; running = true;
  if (kind === 'loading' && get('loading-indicator').dataset.outcome !== 'success') later(() => dispatch('app-complete'), 1800);
  if (kind === 'upload' && progress < 100) {
   const tick = () => { dispatch('app-progress'); if (progress < 100) later(tick, 700); };
   later(tick, 700);
  }
  if (kind === 'failure' && get('request-result').dataset.outcome === 'pending') later(() => dispatch('app-complete'), 1400);
 };
 const dispose = () => controller.abort();
 dispose.start = start; dispose.stop = stop; dispose.restore = dispatch;
 if (options.autoStart !== false) start();
 return dispose;
}
export function workflowSource(kind, labels, events = []) {
 return `${installApplicationWorkflow.toString()}\nconst workflowPlacement = { side:bot.behavior?.side, gap:bot.behavior?.gap };\nconst disposeWorkflow = installApplicationWorkflow(bot.parentElement, bot, ${JSON.stringify(kind)}, { labels: ${JSON.stringify(labels)}, autoStart:false });\nfor (const event of ${JSON.stringify(events)}) disposeWorkflow.restore(event);\nif (workflowPlacement.side && ('target' in bot.behavior || 'targets' in bot.behavior)) bot.behavior = { ...bot.behavior, ...workflowPlacement };\ndisposeWorkflow.start();\n// Call disposeWorkflow() when removing this example.`;
}
