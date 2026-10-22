// Scroll events, not an idle RAF, drive this bounded gesture classifier. A short
// quiet period is a starting point; tiny inertial tails can settle while moving.
export function createScrollIntent({now,setTimer,clearTimer,onFast,onSettle,quietMs=180}){
 let timer=0,blocked=false,fast=false,disposed=false,started=0,stableSince=0,generation=0,settled=false;
 let sources=new WeakMap();
 const cancel=()=>{generation++;if(timer)clearTimer(timer);timer=0;};
 function settle(){cancel();if(disposed||!blocked)return;blocked=false;fast=false;stableSince=0;settled=true;onSettle();}
 function reset(){cancel();blocked=false;fast=false;stableSince=0;started=0;settled=false;sources=new WeakMap();}
 function schedule(){cancel();const token=generation;timer=setTimer(()=>{if(token===generation)settle();},quietMs);}
 function geometry(){if(disposed)return;const time=now();if(!blocked){blocked=true;started=time;}settled=false;stableSince=time;schedule();}
 function prime(source,x,y){sources.set(source,{x,y,time:now(),samples:[]});}
 function sample(source,x,y,height=600){
  if(disposed)return;
  const time=now(),previous=sources.get(source);const distance=previous?Math.hypot(x-previous.x,y-previous.y):0;
  const elapsed=previous?Math.max(1,time-previous.time):quietMs;
  const samples=previous?.samples||[];samples.push({time,distance,from:time-elapsed});
  while(samples.length>64||(samples.length&&samples[0].time<time-120))samples.shift();
  const travel=samples.reduce((sum,s)=>sum+s.distance,0),span=samples.length?Math.max(1,time-Math.max(samples[0].from,samples[0].time-32)):elapsed;
  sources.set(source,{x,y,time,samples});
  const meaningful=distance>2||distance/elapsed>.12;
  if(settled&&previous&&!meaningful)return;
  settled=false;
  if(!blocked){blocked=true;started=time;stableSince=time;}
  const rapid=distance>=Math.max(72,height*.18)||(travel>=36&&travel/span>=.65);
  if(rapid&&!fast){fast=true;onFast();}
  // Continuous low-speed inertia does not postpone the final viewport forever.
  // Any meaningful movement restarts this stability window.
  if(meaningful)stableSince=time;
  if(time-started>=quietMs&&time-stableSince>=quietMs){settle();return;}
  schedule();
 }
 return {sample,prime,geometry,blocked:()=>blocked,fast:()=>fast,reset,dispose(){disposed=true;reset();}};
}
