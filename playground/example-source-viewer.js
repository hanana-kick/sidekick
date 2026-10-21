import { validSourceEvent } from './example-source-map.js';
const labels = {
 en: ['Example source', 'Actual repository files. HTML is authored in the site JavaScript; highlights follow real demo events.', 'Follow interactions', 'Copy file', 'Loading source…', 'Source could not load.', 'Retry', 'Copied', 'Copy unavailable. Select the source to copy.', 'Waiting for an interaction', 'Source files', 'Source code', 'Highlighted interaction'],
 ko: ['예제 소스 보기', '실제 저장소 파일입니다. HTML은 사이트 JavaScript 안에 작성되어 있으며 실제 데모 동작에 맞춰 강조됩니다.', '인터랙션 따라가기', '파일 복사', '소스를 불러오는 중…', '소스를 불러오지 못했습니다.', '다시 시도', '복사했어요', '복사할 수 없습니다. 소스를 선택해 복사하세요.', '인터랙션을 기다리는 중', '소스 파일', '소스코드', '강조된 인터랙션'],
 ja: ['サンプルのソース', '実際のリポジトリファイルです。HTMLはサイトのJavaScript内に記述され、実際のデモ操作に合わせて強調されます。', '操作を追従', 'ファイルをコピー', 'ソースを読み込み中…', 'ソースを読み込めませんでした。', '再試行', 'コピーしました', 'コピーできません。ソースを選択してコピーしてください。', '操作を待っています', 'ソースファイル', 'ソースコード', '強調された操作'],
 'zh-CN': ['查看示例源码', '实际仓库文件。HTML 编写在网站 JavaScript 中，高亮跟随真实演示事件。', '跟随交互', '复制文件', '正在加载源码…', '无法加载源码。', '重试', '已复制', '无法复制，请选择源码进行复制。', '等待交互', '源码文件', '源代码', '高亮交互'],
};
// Rects share viewport coordinates even when offset parents differ. Preserve the
// pane's own scroll origin; never move the surrounding page or iframe.
export function sourceScrollTop(pane, row, inset = 50) {
 return Math.max(0, pane.scrollTop + row.getBoundingClientRect().top - pane.getBoundingClientRect().top - pane.clientTop - inset);
}
export function mountExampleSource(doc, { locale, loader = () => import('./example-source-bundle.js') }) {
 const win = doc.defaultView, surface = doc.getElementById('preview-surface');
 const split = doc.createElement('div'); split.className = 'example-source-split'; surface.before(split); split.append(surface);
 const details = doc.createElement('details'); details.className = 'example-source';
 // This is fixed authored markup; source text is always assigned through textContent.
 details.innerHTML = '<summary></summary><div class="example-source-body"><p class="help source-description"></p><div class="source-controls"><label><input type="checkbox"> <span></span></label><button type="button" class="source-copy"></button></div><p class="source-status help" role="status"></p><button type="button" class="source-retry" hidden></button><div class="source-tabs" role="tablist"></div><p class="source-path help"></p><pre class="source-lines" role="tabpanel" tabindex="0"></pre></div>';
 split.append(details);
 const $ = selector => details.querySelector(selector), summary = $('summary'), status = $('.source-status'), tabs = $('.source-tabs'), lines = $('.source-lines'), follow = $('input'), retry = $('.source-retry'), copy = $('.source-copy');
 follow.checked = true;
 let context = null, revision = 0, files = null, module = null, selected = 0, eventId = null, phase = 'idle', renderedFile = null;
 const t = index => (labels[locale()] || labels.en)[index];
 function refreshLabels() {
  summary.textContent = t(0); $('.source-description').textContent = t(1); $('.source-controls span').textContent = t(2); copy.textContent = t(3); retry.textContent = t(6); tabs.setAttribute('aria-label',t(10)); lines.setAttribute('aria-label',t(11));
  status.textContent = phase === 'loading' ? t(4) : phase === 'error' ? t(5) : eventId ? `${t(12)}: ${eventId}` : t(9);
 }
 function highlight(scroll = false) {
  const ranges = eventId && files ? module.eventRanges(context.site, eventId, files[selected]) : [];
  for (const node of lines.children) node.classList.toggle('is-highlighted',ranges.some(r => Number(node.dataset.line) >= r.start && Number(node.dataset.line) <= r.end));
  // Only the code pane moves, never focus, the parent page, or the example iframe.
  const first = ranges[0] ? lines.querySelector(`[data-line="${ranges[0].start}"]`) : null;
  if (scroll && first) lines.scrollTop = sourceScrollTop(lines, first);
 }
 function render(scroll = false) {
  if(files && renderedFile === files[selected]) { highlight(scroll); return; }
  renderedFile = files?.[selected] ?? null;
  tabs.replaceChildren(); lines.replaceChildren();
  if (!files) { copy.disabled = true; $('.source-path').textContent = ''; return; }
  copy.disabled = false;
  files.forEach((file,index) => {
   const button = doc.createElement('button'); button.type='button'; button.role='tab'; button.id=`example-source-tab-${index}`; button.setAttribute('aria-controls','example-source-lines'); button.setAttribute('aria-selected',String(index===selected)); button.tabIndex=index===selected?0:-1; button.textContent=file.path.split('/').at(-1);
   button.addEventListener('click',()=>{selected=index;follow.checked=false;render();tabs.children[index].focus();});
   button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?files.length-1:(index+(event.key==='ArrowRight'?1:files.length-1))%files.length;tabs.children[next].click();}); tabs.append(button);
  });
  lines.id='example-source-lines'; lines.setAttribute('aria-labelledby',`example-source-tab-${selected}`); $('.source-path').textContent=files[selected].path;
  files[selected].text.split('\n').forEach((text,index)=>{const row=doc.createElement('span');row.className='source-line';row.dataset.line=String(index+1);const number=doc.createElement('span');number.className='source-line-number';number.setAttribute('aria-hidden','true');number.textContent=String(index+1);const code=doc.createElement('code');code.textContent=text||' ';row.append(number,code);lines.append(row);});
  highlight(scroll);
 }
 async function load() {
  if (!context || phase === 'loading' || files) return;
  const token = revision, site = context.site; phase='loading';retry.hidden=true;refreshLabels();
  try { const loaded=await loader();if(token!==revision)return;const result=await loaded.loadExampleSource(site);if(token!==revision)return;module=loaded;files=result;phase='ready';selected=eventId?Math.max(0,files.findIndex(file=>module.eventRanges(context.site,eventId,file).length)):0;if(details.open){render(follow.checked);refreshLabels();} }
  catch { if(token!==revision)return;phase='error';retry.hidden=false;refreshLabels(); }
 }
 details.addEventListener('toggle',()=>{split.classList.toggle('source-open',details.open);if(details.open){if(files){if(follow.checked&&eventId)selected=Math.max(0,files.findIndex(file=>module.eventRanges(context.site,eventId,file).length));render(follow.checked);refreshLabels();}else void load();}});
 retry.addEventListener('click',()=>void load());
 follow.addEventListener('change',()=>{if(follow.checked&&files&&eventId){selected=Math.max(0,files.findIndex(file=>module.eventRanges(context.site,eventId,file).length));render(true);}});
 // A deliberate reading gesture opts out until the user explicitly enables follow again.
 for (const event of ['wheel','touchstart','pointerdown','keydown']) lines.addEventListener(event,()=>{follow.checked=false;},{passive:true});
 copy.addEventListener('click',async()=>{if(!files)return;const token=revision;try{await win.navigator.clipboard.writeText(files[selected].text);if(token===revision)status.textContent=t(7);}catch{if(token===revision)status.textContent=t(8);}});
 const receive = event => {
  if (!context || !validSourceEvent(event,context)) return;
  eventId=event.data.id;if(!details.open)return;refreshLabels();
  if(files){if(follow.checked){selected=Math.max(0,files.findIndex(file=>module.eventRanges(context.site,eventId,file).length));render(details.open);}else highlight();}
 };
 win.addEventListener('message',receive);
 refreshLabels();render();
 return {
  setContext(next){revision++;context=next;files=null;eventId=null;selected=0;phase='idle';retry.hidden=true;render();refreshLabels();if(details.open)void load();},
  refreshLabels,
  dispose(){revision++;context=null;win.removeEventListener('message',receive);},
 };
}
