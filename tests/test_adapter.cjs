const test = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const {createLoadData} = require('../src/splunk_adapter.js');
const query = fs.readFileSync(path.join(__dirname, '../src/base.spl'), 'utf8');
class Model extends EventEmitter {
  off(name, callback) { if (name) return super.off(name, callback); this.removeAllListeners(); }
}
function setup(timeoutMs = 200) {
  const instances = [];
  class Manager extends Model {
    constructor(options) { super(); this.options = options; this.results = new Model(); this.results.data = () => this.payload; instances.push(this); }
    data(type, options) { this.resultOptions = options; return this.results; }
    startSearch() { this.started = true; }
    dispose() { this.disposed = true; }
    cancel() { this.cancelled = true; this.emit('search:cancelled'); }
  }
  return {instances, load: createLoadData(Manager, query, {timeoutMs})};
}
test('scope, time bounds, cap, autostart and final results', async () => {
  const {instances, load} = setup(); const p = load(); const m = instances[0];
  assert.equal(m.options.app, 'cdp_roadmap'); assert.equal(m.options.earliest_time, '-24h'); assert.equal(m.options.latest_time, 'now');
  assert.equal(m.options.autostart, false); assert.equal(m.options.preview, false); assert.equal(m.resultOptions.count, 1001);
  m.payload = {fields:['id','status'], rows:[['<script>alert(1)</script>','Planned']]};
  m.results.emit('data'); assert.equal(m.disposed, undefined);
  m.emit('search:done', {content:{resultCount:1}});
  assert.deepEqual(await p, [{id:'<script>alert(1)</script>',status:'Planned'}]); assert.equal(m.disposed, true);
});
test('completion waits for delayed final model, not an empty timer', async () => {
  const {instances, load} = setup(); const p = load(); const m = instances[0];
  m.emit('search:done', {content:{resultCount:1}}); assert.equal(m.disposed, undefined);
  m.payload = {results:[{id:'x'}]}; m.results.emit('data'); assert.deepEqual(await p,[{id:'x'}]);
});
test('zero results are definitive', async () => {
  const {instances,load}=setup(); const p=load(); instances[0].emit('search:done',{content:{resultCount:'0'}}); assert.deepEqual(await p,[]);
});
test('failures settle without exposing backend payloads', async () => {
  for (const event of ['search:error','search:failed','search:cancelled']) {
    const {instances,load}=setup(); const p=load(); instances[0].emit(event,{message:'sensitive backend diagnostic'});
    await assert.rejects(p, e => !e.message.includes('sensitive')); assert.equal(instances[0].disposed,true);
  }
});
test('superseding generation cancels old search, stale callbacks cannot settle the new one', async () => {
  const {instances,load}=setup(); const first=load(); const firstCheck=assert.rejects(first,/cancelled/); const next=load();
  assert.equal(instances[0].cancelled,true); instances[0].emit('search:done',{content:{resultCount:0}});
  instances[1].emit('search:done',{content:{resultCount:0}}); await firstCheck; assert.deepEqual(await next,[]);
});
test('timeout cancels and disposes', async () => {
  const {instances,load}=setup(5); await assert.rejects(load(),/timed out/); assert.equal(instances[0].cancelled,true); assert.equal(instances[0].disposed,true);
});
test('explicit cancellation and wrong scope', async () => {
  const {load}=setup(); const p=load(); load.cancel(); await assert.rejects(p,/cancelled/);
  assert.throws(()=>createLoadData(()=>{}, '| inputlookup other.csv'),/scope/);
});
test('over-limit transport data is rejected', async () => {
  const {instances,load}=setup(); const p=load(); const m=instances[0]; m.payload={results:Array(1002).fill({id:'x'})};
  m.emit('search:done',{content:{resultCount:1002}}); await assert.rejects(p,/limit/);
});
