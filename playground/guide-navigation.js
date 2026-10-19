import { scenarios } from './scenario-catalog.js';
import { lessons } from './guide-lessons.js';
const scenarioIds = new Set(scenarios.map(item => item.id));
export const guideIds = [...lessons.map(item => item.id), ...scenarioIds];
const knownIds = new Set(guideIds);
const sides = ['left', 'right', 'above', 'below'];
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
/** Deliberately bounded UI state, never source code, arbitrary methods or executable URLs. */
export function validateGuideContext(value) {
 if (!value || typeof value !== 'object' || !knownIds.has(value.id)) return null;
 const result = { id: value.id, level: [1,2,3,4].includes(value.level) ? value.level : 1 };
 for(const key of ['inputValid','emailValid','emotionCustomized'])if(typeof value[key]==='boolean')result[key]=value[key];
 if(Array.isArray(value.searchMatches)&&value.searchMatches.length<=3&&value.searchMatches.every(n=>[0,1,2].includes(n)))result.searchMatches=[...new Set(value.searchMatches)];
 if (sides.includes(value.side)) result.side = value.side;
 for (const [key,min,max] of [['gap',0,48],['dwell',200,5000],['intensity',0,1],['duration',0,60000],['event',-1,20],['scroll',0,100000]]) if (finite(value[key],min,max)&&(key!=='event'||Number.isInteger(value[key]))) result[key]=value[key];
 // The fixed scenario's own controls are restored, not arbitrary DOM selectors or user form data.
 if (Array.isArray(value.events) && value.events.length<=32 && value.events.every(item => typeof item==='string' && /^(app-(complete|save|retry|progress|next|previous|search|confirm|validate)|next-action|selected-[123])$/.test(item))) result.events=[...value.events];
 return result;
}
export function readGuideContext(url) {
 try { const raw = new URL(url, 'https://sidekick.invalid/').searchParams.get('context'); return raw && raw.length<=3000 ? validateGuideContext(JSON.parse(raw)) : null; } catch { return null; }
}
export function readGuideSource(url){try{const raw=new URL(url,'https://sidekick.invalid/').searchParams.get('source');return raw&&raw.length<=3000?validateGuideContext(JSON.parse(raw)):null;}catch{return null;}}
export function guideHref(context, lang='ko', playground=false, source=null) {
 const safe=validateGuideContext(context);if(!safe)throw new RangeError('Unknown guide section');
 const query=new URLSearchParams({lang,context:JSON.stringify(safe)});
 const origin=validateGuideContext(source??(playground?safe:null));if(origin)query.set('source',JSON.stringify(origin));
 return `./${playground?'api-playground':'guide'}.html?${query}#${safe.id}`;
}
export const isScenario = id => scenarioIds.has(id);
/** Explicit technical destinations. Labels name what actually opens. */
export const lessonDestinations = {
 'state-emotion':{id:'emotion-inspection',level:2}, 'state-position':{id:'selection',level:2}, 'state-behavior':{id:'loading',level:1},
 'state-facing':{id:'selection',level:4}, 'state-appearance':{id:'emotion-composition',level:4}, 'state-execution':{id:'emotion-composition',level:4},
 'html-start': {id:'loading',level:1}, 'react-start':{id:'loading',level:1},
 appearance:{page:'studio'}, placement:{preset:'placement'},
 'element-anchor':{preset:'element-anchor'}, 'manual-motion':{preset:'manual-motion'},
 lifecycle:{id:'review',level:3}, performance:{preset:'performance'},
};
export function technicalHref(id,lang='ko',source={id,level:1}) {
 const target=lessonDestinations[id];if(!target)throw new RangeError('Unknown lesson');
 if(target.id)return guideHref(target,lang,false,source);
 const query=new URLSearchParams({lang,from:id,source:JSON.stringify(validateGuideContext(source))});
 if(target.preset)query.set('lesson',target.preset);
 return `./${target.page==='studio'?'index':'api-playground'}.html?${query}`;
}
export const navigationText = {
 ko:{invalid:'문서 링크의 예제 또는 설정이 유효하지 않습니다. 목차에서 문서를 선택하세요.',try:'이 예제의 코드와 설정 열기',back:'원래 문서로 돌아가기',source:'문서',exercise:'예제 실행 및 코드',direct:'개별 API 편집기 열기',run:'선택한 예제 실행',related:'관련 문서',studio:'Studio에서 외형 편집',placement:'화면 좌표 이동 API 설정',anchor:'엘리먼트 앵커 API 설정',manual:'이동·시선·표정 조합 실행',performance:'렌더링 유휴 제어 및 진단'},
 en:{invalid:'The example or settings in this link are invalid. Select a section from the contents.',try:'Open this example’s code and settings',back:'Return to source section',source:'Source',exercise:'Example execution and code',direct:'Open individual API editor',run:'Run selected example',related:'Related section',studio:'Edit appearance in Studio',placement:'Viewport movement API settings',anchor:'Element anchor API settings',manual:'Run movement, gaze and expression sequence',performance:'Rendering idle controls and diagnostics'},
 'zh-CN':{invalid:'链接中的示例或设置无效。请从目录选择章节。',try:'打开此示例的代码与设置',back:'返回原文档章节',source:'文档',exercise:'示例执行与代码',direct:'打开独立 API 编辑器',run:'运行所选示例',related:'相关章节',studio:'在 Studio 中编辑外观',placement:'视口移动 API 设置',anchor:'元素锚定 API 设置',manual:'运行移动、视线和表情序列',performance:'渲染空闲控制与诊断'},
 ja:{invalid:'リンクの例または設定が無効です。目次から節を選択してください。',try:'この例のコードと設定を開く',back:'元の文書の節に戻る',source:'文書',exercise:'実行例とコード',direct:'個別 API エディターを開く',run:'選択した例を実行',related:'関連する節',studio:'Studio で外観を編集',placement:'画面座標移動 API の設定',anchor:'要素アンカー API の設定',manual:'移動・視線・表情の順次実行',performance:'レンダリングの休止制御と診断'},
};
