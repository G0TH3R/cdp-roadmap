/* Read-only SplunkJS search boundary. No lookup write or credential handling. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.CDPScheduleAdapter = factory();
}(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    function createLoadData(SearchManager, query, options) {
        if (!query.startsWith('| inputlookup max=1001 cdp_roadmap.csv\n')) throw new Error('Unexpected lookup scope');
        const timeoutMs = (options && options.timeoutMs) || 45000;
        let active = null, sequence = 0;
        function loadData() {
            if (active) active.cancel();
            return new Promise(function (resolve, reject) {
                let manager, results, timer, settled = false, done = false;
                const own = { cancel: function () { finish(new Error('Search cancelled'), null, true); } };
                active = own;
                function finish(error, rows, cancel) {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    if (results) results.off('data', read);
                    if (manager) {
                        manager.off();
                        if (cancel && typeof manager.cancel === 'function') manager.cancel();
                        if (typeof manager.dispose === 'function') manager.dispose();
                    }
                    if (active === own) active = null;
                    if (error) reject(error); else resolve(rows);
                }
                function read() {
                    if (settled || !done || !results) return;
                    const data = results.data();
                    if (!data) return;
                    let rows;
                    if (Array.isArray(data.results)) rows = data.results;
                    else if (Array.isArray(data.fields) && Array.isArray(data.rows)) {
                        const names = data.fields.map(function (f) { return typeof f === 'string' ? f : f.name; });
                        rows = data.rows.map(function (values) { return Object.fromEntries(names.map(function (name, i) { return [name, values[i]]; })); });
                    } else return;
                    if (rows.length > 1001) { finish(new Error('Result limit exceeded')); return; }
                    finish(null, rows);
                }
                try {
                    manager = new SearchManager({
                        id: 'cdp_schedule_' + Date.now() + '_' + (++sequence),
                        app: 'cdp_roadmap', search: query,
                        earliest_time: '-24h', latest_time: 'now',
                        autostart: false, preview: false, cache: false
                    });
                    results = manager.data('results', {output_mode: 'json_rows', count: 1001});
                    results.on('data', read);
                    manager.on('search:done', function (event) {
                        done = true;
                        if (event && event.content && Number(event.content.resultCount) === 0) finish(null, []);
                        else read();
                    });
                    manager.on('search:error', function () { finish(new Error('Unable to read the roadmap lookup. Check app permissions and try Reload.')); });
                    manager.on('search:failed', function () { finish(new Error('Roadmap search failed. Check app permissions and try Reload.')); });
                    manager.on('search:cancelled', function () { finish(new Error('Search cancelled')); });
                    timer = setTimeout(function () { finish(new Error('Roadmap search timed out. Try Reload.'), null, true); }, timeoutMs);
                    manager.startSearch();
                } catch (error) {
                    finish(new Error('Unable to initialize the roadmap search.'), null, true);
                }
            });
        }
        loadData.cancel = function () { if (active) active.cancel(); };
        return loadData;
    }
    return {createLoadData: createLoadData};
}));
