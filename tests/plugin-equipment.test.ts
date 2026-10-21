import test from 'node:test';
import assert from 'node:assert/strict';
import { PluginEquipmentController } from '../src/element/plugin-equipment.ts';
import type { AccessoryPluginRegistry, PluginAccessoryAsset } from '../src/core/accessory-plugins.ts';
const asset = (pluginId = 'test/hat'): PluginAccessoryAsset => ({ pluginId, slots: ['head'], geometry: { vertices: new Float32Array([0,0,0,0,0,1, .1,0,0,0,0,1, 0,.1,0,0,0,1]), indices: new Uint16Array([0,1,2]) } });
function deferred<T>() { let resolve!: (value:T) => void, reject!: (reason:unknown) => void; const promise = new Promise<T>((yes,no) => { resolve=yes;reject=no; }); return { promise,resolve,reject }; }
const registry = (load: (id:string)=>Promise<PluginAccessoryAsset>) => ({load}) as AccessoryPluginRegistry;
const drain = async () => { for(let i=0;i<8;i++) await Promise.resolve(); };
test('newest slot request wins, independent slots remain independent', async () => {
  const slow=deferred<PluginAccessoryAsset>(), updates:unknown[]=[];
  const c=new PluginEquipmentController(items=>updates.push(items));
  const r=registry(id=>id==='slow'?slow.promise:Promise.resolve(asset(id)));
  const first=c.equip(r,'slow',{slot:'head'});
  const second=c.equip(r,'fast',{slot:'head',color:'#AABBCC'});
  assert.deepEqual(await first,{finished:false}); assert.deepEqual(await second,{finished:true});
  slow.resolve(asset('slow')); await drain();
  assert.equal(c.references()[0]?.pluginId,'fast'); assert.equal(c.references()[0]?.color,'#aabbcc'); assert.equal(updates.length,1);
});
test('removal immediately settles pending load and prevents revival', async () => {
  const d=deferred<PluginAccessoryAsset>(), c=new PluginEquipmentController(()=>{});
  const pending=c.equip(registry(()=>d.promise),'hat',{slot:'head'});
  c.remove('head'); assert.deepEqual(await pending,{finished:false});
  d.resolve(asset()); await drain(); assert.deepEqual(c.references(),[]);
});
test('disconnect retains committed equipment but cancels pending work without shared-load cancellation', async () => {
  const d=deferred<PluginAccessoryAsset>(), r=registry(id=>id==='slow'?d.promise:Promise.resolve(asset(id)));
  const a=new PluginEquipmentController(()=>{}), b=new PluginEquipmentController(()=>{});
  await a.equip(r,'old',{slot:'head'});
  const pending=a.equip(r,'slow',{slot:'head'}), other=b.equip(r,'slow',{slot:'head'});
  a.disconnect(); assert.deepEqual(await pending,{finished:false});
  d.resolve(asset('slow')); assert.deepEqual(await other,{finished:true});
  assert.equal(a.references()[0]?.pluginId,'old'); assert.equal(b.references()[0]?.pluginId,'slow');
});
test('rejection preserves existing item and cancelled rejection is consumed', async () => {
  const c=new PluginEquipmentController(()=>{});
  await c.equip(registry(async()=>asset('old')),'old',{slot:'head'});
  await assert.rejects(c.equip(registry(async()=>{throw new Error('load failed');}),'new',{slot:'head'}),/load failed/);
  assert.equal(c.references()[0]?.pluginId,'old');
  const d=deferred<PluginAccessoryAsset>(), pending=c.equip(registry(()=>d.promise),'new',{slot:'head'});
  await drain(); c.disconnect(); d.reject(new Error('late')); assert.deepEqual(await pending,{finished:false}); await drain();
});
test('unsupported slots fail atomically; metadata and renderer snapshots do not expose controller ownership', async () => {
  const source=asset(), c=new PluginEquipmentController(()=>{}), r=registry(async()=>source);
  await c.equip(r,'hat',{slot:'head'});
  await assert.rejects(c.equip(r,'hat',{slot:'neck'}),/cannot use slot/);
  source.geometry.vertices[0]=99;
  const refs=c.references(); refs[0]!.color='#000000';
  const items=c.instances(); items[0]!.asset.geometry.vertices[0]=88;
  assert.equal(c.instances()[0]!.asset.geometry.vertices[0],0); assert.equal(c.references()[0]!.color,'#ffcc37');
});
test('invalid input does not cancel already pending valid request', async()=>{
  const d=deferred<PluginAccessoryAsset>(), c=new PluginEquipmentController(()=>{}), r=registry(()=>d.promise);
  const pending=c.equip(r,'hat',{slot:'head'});
  assert.throws(()=>c.equip(r,'hat',{slot:'head',color:'red'}),/RRGGBB/);
  assert.throws(()=>c.remove('invalid' as never),/slot/);
  d.resolve(asset()); assert.deepEqual(await pending,{finished:true});
});
test('callback failure rolls back equipment and permits a later retry', async()=>{
  let fail=false; const c=new PluginEquipmentController(()=>{if(fail)throw new Error('transport failed');});
  const r=registry(async id=>asset(id)); await c.equip(r,'old',{slot:'head'}); fail=true;
  await assert.rejects(c.equip(r,'new',{slot:'head'}),/transport failed/);
  assert.equal(c.references()[0]!.pluginId,'old'); fail=false; await c.equip(r,'new',{slot:'head'});
  assert.equal(c.references()[0]!.pluginId,'new');
});
test('cancellation before queued loader starts avoids unnecessary lazy execution', async()=>{
  let calls=0; const c=new PluginEquipmentController(()=>{});
  const pending=c.equip(registry(async()=>{calls++;return asset();}),'hat',{slot:'head'});
  c.remove('head'); await pending; await drain(); assert.equal(calls,0);
});
test('different slots load independently and duplicate instance ids are rejected', async()=>{
  const c=new PluginEquipmentController(()=>{}), r=registry(async id=>({...asset(id),slots:['head','neck']}));
  await Promise.all([c.equip(r,'hat',{slot:'head',id:'hat'}),c.equip(r,'scarf',{slot:'neck',id:'scarf'})]);
  assert.equal(c.references().length,2);
  await assert.rejects(c.equip(r,'other',{slot:'neck',id:'hat'}),/unique/);
  assert.equal(c.references().find(x=>x.slot==='neck')?.id,'scarf');
});
test('avatar routes owned payloads and retains equipment in reconnect state; disconnect cancels late equip', async()=>{
  const { JSDOM } = await import('jsdom');
  const dom=new JSDOM('<!doctype html><body></body>',{pretendToBeVisual:true,url:'https://plugin.test/'});
  const originals=new Map<string,PropertyDescriptor|undefined>();
  for(const [key,value] of Object.entries({HTMLElement:dom.window.HTMLElement,CustomEvent:dom.window.CustomEvent,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window)})) {
    originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key)); Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  }
  try {
    const {SidekickAvatar}=await import('../src/element/avatar.ts');
    dom.window.customElements.define('plugin-test-avatar',SidekickAvatar);
    const bot=dom.window.document.createElement('plugin-test-avatar') as unknown as SidekickAvatar;
    const internal=bot as unknown as {runtimeState:()=>{pluginAccessories:ReturnType<PluginEquipmentController['instances']>};bridge:unknown};
    const sent:unknown[]=[]; internal.bridge={send:(command:unknown)=>sent.push(command),revision:0,dispose:()=>{}};
    await bot.equipPluginAccessory(registry(async()=>asset()),'test/hat',{slot:'head'});
    assert.equal(sent.length,1); assert.equal(bot.pluginAccessories[0]?.pluginId,'test/hat');
    const initial=internal.runtimeState(); assert.equal(initial.pluginAccessories[0]?.asset.pluginId,'test/hat');
    initial.pluginAccessories[0]!.asset.geometry.vertices[0]=72;
    assert.equal(internal.runtimeState().pluginAccessories[0]!.asset.geometry.vertices[0],0);
    const pendingAsset=deferred<PluginAccessoryAsset>();
    const pending=bot.equipPluginAccessory(registry(()=>pendingAsset.promise),'later',{slot:'head'});
    await drain(); bot.disconnectedCallback(); assert.deepEqual(await pending,{finished:false});
    pendingAsset.resolve(asset('later')); await drain();
    assert.equal(bot.pluginAccessories[0]?.pluginId,'test/hat');
    bot.removePluginAccessory('head'); assert.deepEqual(bot.pluginAccessories,[]);
  } finally {
    dom.window.close(); for(const[key,value]of originals) {if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}
  }
});
