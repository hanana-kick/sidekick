import { actionSource, executeAction } from './playground-actions.js';
// These actions are both the runnable lesson and its copyable source. No eval.
const emotion=(name,intensity=0.7)=>({method:'setEmotion',args:[name,{intensity}]});
const reaction=(name,duration=1200)=>({method:'reactTo',args:[name,{intensity:0.9,duration}]});
const behavior=value=>({property:'behavior',value});
const steps=(...steps)=>({steps});
const target='#emotion-target';
const waiting=()=>behavior({type:'wait',target,side:'left',gap:6});
export const emotionFlows=[
 {id:'emotion-request',title:'요청 실패와 재시도',sentence:'기다림, 실패, 재시도, 성공을 앱 결과에 연결합니다.',hint:'실제 네트워크 요청 없이 결과 버튼으로 응답을 모의합니다.',initial:steps(waiting(),emotion('neutral')),buttons:[
 ['요청 시작',steps(waiting(),emotion('curious'))],['요청 실패',steps(behavior({type:'guide',target,side:'left',gap:6}),emotion('concerned'))],['재시도',steps(waiting(),emotion('curious'))],['요청 성공',steps(behavior({type:'celebrate',duration:1600}),emotion('happy'))]]},
 {id:'emotion-notification',title:'새 알림에 잠깐 놀라기',sentence:'작업을 계속하면서 새 알림에 잠깐 반응합니다.',hint:'놀람이 끝나면 기존 감정으로 돌아옵니다. 대기 작업은 유지됩니다.',initial:steps(waiting(),emotion('curious')),buttons:[['알림 도착',reaction('surprised')],['반응 취소',{method:'cancelReaction',args:[]}]]},
 {id:'emotion-inspection',title:'호기심으로 검토하고 문제 알리기',sentence:'항목을 검토하는 동안 감정으로 결과를 표현합니다.',hint:'문제 발견 버튼은 검토를 취소하지 않고 우려하는 감정만 바꿉니다.',initial:steps(behavior({type:'review',targets:'#demo-app .emotion-item',dwell:2200,side:'left',gap:6}),emotion('curious')),buttons:[['문제 발견',emotion('concerned')],['문제 해결',emotion('happy')],['감정 초기화',emotion('neutral')]]},
 {id:'emotion-completion',title:'완료를 기쁘게 축하하기',sentence:'작업 완료와 기쁨의 강도를 따로 조절합니다.',hint:'약한 기쁨과 큰 기쁨을 비교하고 일시적인 축하 반응을 겹쳐 보세요.',initial:steps(waiting(),emotion('neutral')),buttons:[['작은 성취',steps(behavior({type:'celebrate',duration:2000}),emotion('happy',0.3))],['큰 성취',steps(behavior({type:'celebrate',duration:2000}),emotion('excited',1))],['짧은 환호',reaction('excited',900)]]},
 {id:'emotion-interruption',title:'빠른 감정 교체와 중단',sentence:'전환 도중 새 반응이 와도 현재 모습에서 이어집니다.',hint:'버튼을 빠르게 번갈아 누르세요. 이전 반응의 복귀가 최신 감정을 덮지 않아야 합니다.',initial:steps(waiting(),emotion('happy',0.5)),buttons:[['놀라기',reaction('surprised',1800)],['걱정하기',reaction('concerned',1800)],['기쁨으로 교체',emotion('happy')],['반응 취소',{method:'cancelReaction',args:[]}],['생각하기로 전환',{method:'setActivity',args:['thinking']}],['말하기로 전환',{method:'setActivity',args:['speaking']}]]},
 {id:'emotion-composition',title:'이동·감정·양쪽 눈 조합',sentence:'움직이는 동안 감정과 각 눈의 표정을 함께 바꿉니다.',hint:'눈을 직접 지정하면 해당 눈의 감정 표현만 대체합니다. 반응 완료·취소 후에도 수동 눈 제어가 유지되며, 새 setEmotion() 또는 reactTo() 호출은 양쪽 눈을 다시 제어합니다.',initial:steps(waiting(),emotion('neutral')),buttons:[['이동하며 기뻐하기',steps(behavior({type:'guide',target:'#emotion-destination',side:'left',gap:6}),reaction('happy',1600))],['왼쪽 눈 감기',{method:'setExpression',args:['left','blink',{duration:600}]}],['오른쪽 눈 웃기',{method:'setExpression',args:['right','smile',{duration:600}]}],['감정 초기화',emotion('neutral')]]},
];
export const emotionFlowById=id=>emotionFlows.find(flow=>flow.id===id);
export const emotionScenarioGroup={id:'emotions',title:'감정과 앱 흐름',groups:[
 {id:'outcomes',title:'결과와 반응',cases:emotionFlows.slice(0,4).map(flow=>({...flow,kind:'wait',app:flow.id}))},
 {id:'composition',title:'중단과 조합',cases:emotionFlows.slice(4).map(flow=>({...flow,kind:'wait',app:flow.id}))},
]};
export function emotionMarkup(flow,t){
 const label=key=>`<span data-guide-i18n="${key}">${t(key)}</span>`;
 const items=['emotion-inspection','emotion-composition'].includes(flow.id)?`<div class="target-item emotion-item">${label('첫 번째 항목')}</div><div id="emotion-destination" class="target-item emotion-item">${label('두 번째 항목')}</div>`:'';
 return `<div class="emotion-scene"><div class="app-card emotion-card"><h3 id="emotion-target">${label(flow.title)}</h3>${items}</div><div class="app-actions emotion-actions">${flow.buttons.map(([title],i)=>`<button type="button" data-emotion-step="${i}">${label(title)}</button>`).join('')}</div><p id="emotion-feedback" role="status">${label('버튼으로 앱 이벤트를 발생시키세요.')}</p></div>`;
}
export function emotionCode(flow,action=flow.initial,level=1){
 const source=actionSource(action,'bot');
 if(level===3)return `const bot = document.querySelector('#demo-bot');\n// Use the same callbacks for your application's real outcomes.\n${flow.buttons.map(([label,step],i)=>`document.querySelector('[data-emotion-step="${i}"]').addEventListener('click', async () => {\n${actionSource(step,'bot').split('\n').map(line=>'  '+line).join('\n')}\n});`).join('\n')}`;
 return `const bot = document.querySelector('#demo-bot');\n${source}\n${level===4?"\n// Direct eye commands control the affected eyes while body emotion continues.\n// Reaction completion/cancellation preserves later manual eye edits.\n// A new setEmotion() or reactTo() controls both eyes again.\n// Release the emotional overlay:\n// bot.setEmotion('neutral');":''}`;
}
export function runEmotionAction(bot,action){return executeAction(bot,action);}

export function customizeEmotionAction(action, intensity, duration){
 const copy=structuredClone(action);
 const visit=step=>{if(step.steps)step.steps.forEach(visit);if(['setEmotion','reactTo'].includes(step.method)){step.args[1]={...step.args[1],intensity,...(step.method==='reactTo'?{duration}:{})};}};visit(copy);return copy;
}
