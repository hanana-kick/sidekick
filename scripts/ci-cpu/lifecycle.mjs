/** Cleanup failures are evidence, never a reason to skip later cleanup/save. */
export async function cleanupSafely(actions,errors){for(const [step,action]of actions){try{await action();}catch(error){errors.push({step,message:error.message});}}}
/** A spawn error is an invalid attempted case, not an uncaught coordinator abort. */
export function childOutcome(spawnChild,args,options){return new Promise(resolve=>{let child;try{child=spawnChild(...args,options);}catch(error){resolve({code:null,signal:null,spawnError:error.message});return;}child.once('error',error=>resolve({code:null,signal:null,spawnError:error.message}));child.once('exit',(code,signal)=>resolve({code,signal}));});}
