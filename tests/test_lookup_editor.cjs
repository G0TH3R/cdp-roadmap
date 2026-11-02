const test = require('node:test');
const assert = require('node:assert/strict');
const {checkLookupEditor} = require('../src/splunk_adapter.js');

function transport(payload, fail = false) {
    const calls = [];
    return {calls, ajax(options) {
        calls.push(options);
        return {done(fn) {if (!fail) fn(payload); return this;}, fail(fn) {if (fail) fn({status:403}); return this;}};
    }};
}

test('Lookup Editor discovery uses a bounded GET and never writes', async () => {
    const $ = transport({entry:[{name:'lookup_editor',content:{disabled:false}}]});
    assert.equal(await checkLookupEditor($, {make_url:p=>'/en-US'+p}), true);
    assert.equal($.calls.length, 1);
    assert.equal($.calls[0].url, '/en-US/splunkd/__raw/services/apps/local/lookup_editor');
    assert.equal($.calls[0].type, 'GET');
    assert.equal($.calls[0].timeout, 8000);
});

test('missing, disabled, denied and malformed Lookup Editor fail closed without blocking CSV reads', async () => {
    for (const payload of [{entry:[]}, {}, {entry:[{name:'other',content:{disabled:false}}]},
        {entry:[{name:'lookup_editor',content:{disabled:true}}]}, {entry:[{name:'lookup_editor',content:{}}]}]) {
        assert.equal(await checkLookupEditor(transport(payload), {make_url:p=>p}), false);
    }
    assert.equal(await checkLookupEditor(transport(null,true), {make_url:p=>p}), false);
    assert.equal(await checkLookupEditor(transport({entry:[{name:'lookup_editor',content:{disabled:'0'}}]}), {make_url:p=>p}), true);
});
