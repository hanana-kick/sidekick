import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installApplicationWorkflow,workflowSource,workflowRows} from '../playground/application-workflows.js';
import {guideTranslations} from '../playground/guide-translations.js';
function setup(markup){const dom=new JSDOM(`<div id="app">${markup}<sidekick-avatar></sidekick-avatar></div>`);const document=dom.window.document;globalThis.document=document;globalThis.AbortController=dom.window.AbortController;const app=document.querySelector('#app'),bot=app.querySelector('sidekick-avatar');bot.setEmotion=value=>bot.emotion=value;return{dom,app,bot,get:id=>document.getElementById(id),click:id=>document.getElementById(id).click()};}
test('upload exposes progress and real completion, disposal stops handlers',()=>{const x=setup('<div id="upload-progress"><span id="progress-label"></span><i></i></div><button id="app-progress"></button>');const dispose=installApplicationWorkflow(x.app,x.bot,'upload');for(let i=0;i<4;i++)x.click('app-progress');assert.equal(x.get('upload-progress').getAttribute('aria-valuenow'),'100');assert.equal(x.get('progress-label').dataset.outcome,'success');assert.equal(x.bot.behavior.type,'celebrate');assert.equal(x.bot.emotion,'happy');assert.equal(x.get('app-progress').disabled,true);dispose();x.dom.window.close();});
test('validation changes app state and reaction; valid correction recovers',()=>{const x=setup('<label id="email-field"><input id="profile-email" value="bad"></label><p id="validation-result"></p><button id="app-validate"></button>');installApplicationWorkflow(x.app,x.bot,'validation');x.click('app-validate');assert.equal(x.get('profile-email').getAttribute('aria-invalid'),'true');assert.equal(x.bot.emotion,'concerned');assert.equal(x.bot.behavior.target,'#email-field');x.get('profile-email').value='hello@example.com';x.click('app-validate');assert.equal(x.get('profile-email').getAttribute('aria-invalid'),'false');assert.equal(x.bot.behavior.type,'celebrate');x.dom.window.close();});
test('review marks actual completed items rather than motion alone',()=>{const x=setup('<button class="target-item">One</button><button class="target-item">Two</button><p id="review-result"></p>');installApplicationWorkflow(x.app,x.bot,'review');x.bot.behaviorState={type:'review',completedItems:1,itemIndex:1,status:'acting'};x.bot.dispatchEvent(new x.dom.window.Event('sidekick-behavior-change'));assert.deepEqual([...x.app.querySelectorAll('.target-item')].map(row=>row.dataset.outcome),['success','pending']);assert.equal(x.get('review-result').textContent,'1/2');x.dom.window.close();});
test('copied installer executes the same failure recovery and is removable',()=>{const x=setup('<p id="request-result"></p><button id="app-retry"></button><button id="app-complete" hidden></button>');const dispose=new Function('bot',workflowSource('failure',{})+'\nreturn disposeWorkflow;')(x.bot);x.click('app-retry');assert.equal(x.bot.behavior.type,'wait');assert.equal(x.get('request-result').dataset.outcome,'pending');x.click('app-complete');assert.equal(x.get('request-result').dataset.outcome,'success');assert.equal(x.bot.emotion,'happy');dispose();x.dom.window.close();});
test('all workflow outcome text has four locale entries',()=>{for(const [key]of workflowRows)for(const locale of ['ko','en','zh-CN','ja'])assert.equal(typeof guideTranslations[locale]?.[key],'string',`${locale}: ${key}`);});

for (const [kind, markup, target, delay] of [
 ['loading','<div id="loading-indicator"></div>','loading-indicator',1800],
 ['upload','<div id="upload-progress"><span id="progress-label"></span><i></i></div>','progress-label',2800],
 ['failure','<p id="request-result"></p><button id="app-retry"></button>','request-result',1400],
]) test(`${kind} advances without manual completion, supports cancellation and copied source`, t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const copied of [false,true]){
  const x=setup(markup),events=[];
  const dispose=copied?new Function('bot',workflowSource(kind,{})+'\nreturn disposeWorkflow;')(x.bot):installApplicationWorkflow(x.app,x.bot,kind,{onEvent:id=>events.push(id)});
  if(kind==='failure')x.click('app-retry');
  if(kind==='upload'){t.mock.timers.tick(700);assert.equal(x.get(target).dataset.progress,'25');}
  dispose.stop();t.mock.timers.tick(10000);assert.notEqual(x.get(target).dataset.outcome,'success');
  dispose.start();dispose.start(); // Repeated Run must cancel the older scheduled workload.
  for(let step=0;step<4;step++)t.mock.timers.tick(delay/4+700);
  assert.equal(x.get(target).dataset.outcome,'success');assert.equal(x.bot.emotion,'happy');
  if(!copied&&kind==='upload')assert.equal(events.filter(id=>id==='app-progress').length,4);
  dispose();const snapshot=x.app.innerHTML;t.mock.timers.tick(10000);assert.equal(x.app.innerHTML,snapshot);x.dom.window.close();
 }
});
test('exercise workload remains idle until Start and disposal cancels its timer',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const x=setup('<div id="loading-indicator"></div>');
 const dispose=installApplicationWorkflow(x.app,x.bot,'loading',{autoStart:false});
 t.mock.timers.tick(10000);assert.equal(x.get('loading-indicator').dataset.outcome,undefined);
 dispose.start();t.mock.timers.tick(1000);dispose();t.mock.timers.tick(10000);
 assert.equal(x.get('loading-indicator').dataset.outcome,undefined);x.dom.window.close();
});
