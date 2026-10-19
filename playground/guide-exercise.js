import './use-cases.css';
import { readGuideContext, readGuideSource, isScenario, guideHref, navigationText } from './guide-navigation.js';
import { getSiteLocale, subscribeSiteLocale } from './site-i18n.js';
import { mountSiteHeader } from './shared-header.js';
import { scenarioById } from './scenario-catalog.js';
import { guideTranslations } from './guide-translations.js';
/** Reuses the actual example component, without a second header, sidebar or recursive CTA. */
export async function mountGuideExercise() {
 const context=readGuideContext(location.href);
 if(!context||!isScenario(context.id)){
  if(!new URL(location.href).searchParams.has('context'))return false;
  for(const element of [...document.body.children])if(!element.matches('.app-header,script'))element.remove();
  mountSiteHeader(document.getElementById('site-header-brand'),'api');
  const warning=document.createElement('p');warning.id='invalid-guide-context';warning.setAttribute('role','alert');warning.textContent=navigationText[getSiteLocale()].invalid;document.body.append(warning);return true;
 }
 const response=await fetch(new URL('./guide.html',location.href));
 if(!response.ok)throw new Error('Unable to load Guide exercise');
 const source=new DOMParser().parseFromString(await response.text(),'text/html');
 const layout=source.querySelector('.catalog-layout');
 if(!layout)throw new Error('Guide exercise template missing');
 document.documentElement.dataset.guideExercise='true';
 for(const element of [...document.body.children])if(!element.matches('.app-header,script'))element.remove();
 const header=document.createElement('section');header.className='exercise-context';
 const heading=document.createElement('h1');const origin=document.createElement('p');
 const back=document.createElement('a');back.id='guide-source-return';
 const direct=document.createElement('a');direct.id='individual-api-editor';
 header.append(heading,origin,back,document.createTextNode(' · '),direct);
 document.body.append(header,document.importNode(layout,true));
 mountSiteHeader(document.getElementById('site-header-brand'),'api');
 const style=document.createElement('style');style.textContent=`[data-guide-exercise] .catalog-nav,[data-guide-exercise] #scenario-main>footer,[data-guide-exercise] .scenario-heading{display:none!important}[data-guide-exercise] .catalog-layout{display:block;max-width:1180px;margin:auto}[data-guide-exercise] #scenario-main{padding-top:16px}.exercise-context{max-width:1180px;margin:24px auto 0;padding:0 24px}.exercise-context h1{font-size:24px}.exercise-context p{color:#64748b}`;document.head.append(style);
 function translate(){const lang=getSiteLocale(),text=navigationText[lang],item=scenarioById(context.id);heading.textContent=text.exercise;origin.textContent=text.source+': '+(guideTranslations[lang]?.[item.title]??item.title);back.textContent=text.back;back.href=guideHref(readGuideSource(location.href)??context,lang);direct.textContent=text.direct;direct.href='./api-playground.html?lang='+lang;}
 translate();subscribeSiteLocale(translate);
 await import('./use-cases.js');
 return true;
}
