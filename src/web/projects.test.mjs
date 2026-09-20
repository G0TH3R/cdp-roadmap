import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareData, timelineAxis, projectLanes, filterRows} from './data.mjs';
const item=(id,project,start,end)=>({id,project,milestone:id,workstream:'Delivery',owner:'Team',status:'Planned',start_date:start,end_date:end,validation:'OK'});

test('multiple activities group by project; parallel work stacks and later work reuses tracks',()=>{
  const model=prepareData([
    item('A','One','2026-10-01','2026-10-20'),
    item('B','One','2026-10-10','2026-10-25'),
    item('C','One','2026-11-10','2026-11-20'),
    item('D','Two','2026-10-01','2026-10-20'),
  ]);
  const groups=projectLanes(model.rows,timelineAxis(model.rows));
  assert.equal(groups.length,2);
  assert.deepEqual(groups.map(g=>g.activities.length),[3,1]);
  assert.equal(groups[0].trackCount,2);
  const byId=Object.fromEntries(groups[0].activities.map(a=>[a.row.id,a]));
  assert.notEqual(byId.A.track,byId.B.track);
  assert.equal(byId.A.track,byId.C.track);
});

test('legacy rows remain visible without mutating or guessing project assignments',()=>{
  const input=[item('A',undefined,'2026-10-01','2026-10-20'),item('B','Unassigned project','2026-10-01','2026-10-20')];
  const original=structuredClone(input);
  const model=prepareData(input);
  assert.deepEqual(input,original);
  assert.equal(model.unassignedCount,1);
  const groups=projectLanes(model.rows,timelineAxis(model.rows));
  assert.equal(groups.length,2);
  assert.notEqual(groups[0].key,groups[1].key);
  assert.equal(filterRows(model.rows,{project:JSON.stringify('')}).length,1);
  assert.equal(filterRows(model.rows,{project:JSON.stringify('Unassigned project')})[0].id,'B');
});

test('simultaneous milestone points have separate hit areas and invalid records are omitted',()=>{
  const model=prepareData([
    item('A','One','2026-10-01','2026-10-01'),
    item('B','One','2026-10-01','2026-10-01'),
    item('C','One','2026-10-01','2026-10-12'),
    item('BAD','One','2026-10-20','2026-10-01'),
  ]);
  const [group]=projectLanes(model.rows,timelineAxis(model.rows));
  assert.equal(model.rows.length,4);
  assert.equal(group.activities.length,3);
  assert.equal(new Set(group.activities.map(a=>a.track)).size,3);
});

test('project grouping does not split by owner or status and project filters compose',()=>{
  const model=prepareData([
    {...item('A','One','2026-10-01','2026-10-20'),status:'Complete'},
    {...item('B','One','2026-10-21','2026-11-05'),owner:'Other'},
    item('C','Two','2026-10-01','2026-10-20'),
  ]);
  assert.equal(projectLanes(model.rows,timelineAxis(model.rows)).length,2);
  assert.deepEqual(filterRows(model.rows,{project:JSON.stringify('One'),status:'Planned',owner:'Other'}).map(r=>r.id),['B']);
});
