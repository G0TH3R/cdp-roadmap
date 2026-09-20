#!/usr/bin/env python3
"""Build the production React canvas, Splunk loader, Studio fallback, and release."""
import configparser
import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile

APP = Path(__file__).resolve().parents[1]
MTIME = 1577836800


def main():
    conf = configparser.ConfigParser()
    conf.read(APP / 'default/app.conf')
    version = conf['launcher']['version']
    if version != json.loads((APP / 'package.json').read_text())['version']:
        raise ValueError('Package and app versions differ')
    subprocess.run([sys.executable, str(APP / 'tools/build.py')], check=True)
    static = APP / 'appserver/static'
    static.mkdir(parents=True, exist_ok=True)
    stem = 'cdp-schedule-' + version.replace('.', '-')
    js_path = static / (stem + '.js')
    subprocess.run([str(APP / 'node_modules/.bin/esbuild'), str(APP / 'src/web/entry.jsx'),
                    '--bundle', '--minify', '--format=iife', '--global-name=CDPSchedule',
                    '--loader:.css=text', '--define:process.env.NODE_ENV="production"',
                    '--target=chrome100,firefox100,safari15.4', '--legal-comments=inline',
                    '--outfile=' + str(js_path)], check=True, cwd=APP)
    query = (APP / 'src/base.spl').read_text()
    adapter = (APP / 'src/splunk_adapter.js').read_text()
    bootstrap = '''
require(['splunkjs/mvc/searchmanager', 'splunk.util', 'splunkjs/mvc/simplexml/ready!'], function (SearchManager, util) {
    var host = document.getElementById('cdp-schedule-root');
    if (!host) return;
    try {
        var load = CDPScheduleAdapter.createLoadData(SearchManager, __QUERY__);
        var editor = util.make_url('/app/lookup_editor/lookup_edit') + '?namespace=cdp_roadmap&lookup=cdp_roadmap.csv&type=csv&owner=nobody';
        host.textContent = '';
        CDPSchedule.mount(host, {loadData: load, editorUrl: editor});
        window.addEventListener('beforeunload', load.cancel);
    } catch (error) {
        host.textContent = 'CDP Program Management could not initialize.';
    }
}, function () {
    var host = document.getElementById('cdp-schedule-root');
    if (host) host.textContent = 'CDP Program Management could not load Splunk components.';
});
'''.replace('__QUERY__', json.dumps(query))
    js_path.write_text(js_path.read_text() + '\n' + adapter + '\n' + bootstrap)
    (static / (stem + '.css')).write_text('''/* Scoped page host; application styling is isolated in its shadow root. */
.dashboard-body { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: none !important; background: #171d21; }
#cdp_schedule_panel { margin: 0; }
#cdp_schedule_panel .panel-body { padding: 0 !important; background: #171d21; }
#cdp-schedule-root { display: block; min-height: calc(100vh - 48px); width: 100%; color: #f2f4f5; background: #171d21; }
.dashboard-row .dashboard-cell { padding: 0; }
''')
    (APP / 'default/data/ui/views/roadmap.xml').write_text('''<dashboard version="1.1" theme="dark" hideTitle="true" hideEdit="true" hideAppBar="true" script="''' + stem + '''.js" stylesheet="''' + stem + '''.css">
  <label>CDP Program Management</label>
  <description>Projects, activities, ownership, and delivery status.</description>
  <row><panel id="cdp_schedule_panel"><html>
    <div id="cdp-schedule-root" aria-label="CDP Program Management">Loading…</div>
    <noscript>JavaScript unavailable. <a href="studio_roadmap">Projects Scheulde</a></noscript>
  </html></panel></row>
</dashboard>
''')
    # Preserve old bookmarks without retaining an instructional page.
    (APP / 'default/data/ui/views/guide.xml').write_text((APP / 'default/data/ui/views/roadmap.xml').read_text())
    runtime = []
    for directory in ['default', 'metadata', 'lookups', 'appserver']:
        for path in (APP / directory).rglob('*'):
            if path.is_symlink():
                raise ValueError('Runtime symlink rejected: ' + str(path))
            if path.is_file():
                # Retain old source assets for rollback, but ship only the current version.
                if path.parent == static and path.name.startswith('cdp-schedule-') and path.name not in (stem + '.js', stem + '.css'):
                    continue
                runtime.append(path)
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w') as archive:
        for path in sorted(runtime):
            data = path.read_bytes()
            info = tarfile.TarInfo('cdp_roadmap/' + str(path.relative_to(APP)))
            info.size, info.mode, info.mtime = len(data), 0o644, MTIME
            archive.addfile(info, io.BytesIO(data))
    package = APP / 'build' / ('cdp_roadmap-' + version + '.tgz')
    package.parent.mkdir(exist_ok=True)
    package.write_bytes(gzip.compress(raw.getvalue(), mtime=MTIME))
    manifest = {'version': version, 'package': package.name,
                'package_sha256': hashlib.sha256(package.read_bytes()).hexdigest(),
                'runtime_files': {str(p.relative_to(APP)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(runtime)}}
    (APP / 'build/manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'package': str(package), 'runtime_files': len(runtime), 'sha256': manifest['package_sha256']}, indent=2))


if __name__ == '__main__':
    main()
