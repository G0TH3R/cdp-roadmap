#!/usr/bin/env python3
"""Ad-hoc exact-bundle Chrome verification with synthetic, isolated search results."""
import functools
import html
import http.server
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import tempfile
import threading

APP = Path(__file__).resolve().parents[1]
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
MOCK = r'''
let mode='fixture', dispatched=0;
const statuses=['Planned','In progress','At risk','Blocked','Complete'];
const now=new Date(), date=(offset,day=1)=>new Date(Date.UTC(now.getFullYear(),now.getMonth()+offset,day)).toISOString().slice(0,10);
const base={project:'Project Alpha',workstream:'Test work',owner:'Test owner',start_date:date(0),end_date:date(2),validation:'OK',dependency_ids:'',acceptance_criteria:'Synthetic browser test only'};
const fixture=statuses.map((status,i)=>({...base,project:i<3?'Project Alpha':'Project Beta',id:'TEST-'+i,milestone:i===0?'<img src=x onerror=alert(1)>':'Test activity '+i,timeline_label:i===0?'Short & safe':'',status}));
fixture.push({...base,id:'POINT',milestone:'Test decision',status:'Planned',start_date:date(1),end_date:date(1)});
fixture.push({...base,id:'BAD',milestone:'Invalid test',status:'Planned',end_date:'',validation:'Invalid date'});
class E {constructor(){this.events={}} on(n,f){(this.events[n]||=[]).push(f)} off(n,f){if(!n)this.events={};else this.events[n]=(this.events[n]||[]).filter(x=>x!==f)} emit(n,x){for(const f of this.events[n]||[])f(x)}}
class Manager extends E {
 constructor(options){super();this.options=options;this.results=new E();this.results.data=()=>this.payload;}
 data(type,options){if(options.count!==1001)throw Error('Missing transport cap');return this.results;}
 startSearch(){dispatched++;if(this.options.app!=='cdp_roadmap'||this.options.earliest_time!=='-24h'||this.options.latest_time!=='now'||!this.options.search.startsWith('| inputlookup max=1001 cdp_roadmap.csv'))throw Error('Search boundary mismatch');setTimeout(()=>{if(mode==='error'){this.emit('search:failed');return;}let rows=mode==='empty'?[]:mode==='overflow'?Array.from({length:1001},(_,i)=>({...base,id:'LIMIT-'+i,milestone:'Test '+i,status:'Planned'})):fixture;this.payload={results:rows};this.emit('search:done',{content:{resultCount:rows.length}});this.results.emit('data');},40);}
 dispose(){} cancel(){}
}
function require(dependencies,callback){callback(Manager,{make_url:path=>path});}
'''
TEST = r'''
const checks=[];const pause=()=>new Promise(r=>setTimeout(r,120));
function ok(value,label){if(!value)throw Error(label);checks.push(label);}
function luminance(rgb){const c=rgb.match(/[\d.]+/g).slice(0,3).map(n=>Number(n)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function contrast(element){const style=getComputedStyle(element),a=luminance(style.color),b=luminance(style.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
function colorContrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function gridlineHierarchy(s,label){
 const background=getComputedStyle(s.querySelector('#roadmap .panel')).backgroundColor;
 const week=getComputedStyle(s.querySelector('.week-gridline')).borderLeftColor;
 const month=getComputedStyle(s.querySelector('.month')).borderLeftColor;
 const today=getComputedStyle(s.querySelector('.today-marker')).borderLeftColor;
 const weekRatio=colorContrast(background,week),monthRatio=colorContrast(background,month),todayRatio=colorContrast(background,today);
 ok(weekRatio>=1.45,label+' week gridline visible');
 ok(monthRatio>=weekRatio+.35,label+' month boundary stronger than week gridline');
 ok(todayRatio>=monthRatio,label+' Today marker stronger than month boundary');
 ok(getComputedStyle(s.querySelector('.week-gridline')).borderLeftWidth==='1px'&&getComputedStyle(s.querySelector('.today-marker')).borderLeftWidth==='2px',label+' line-width hierarchy');
}
async function run(){
 await pause();await pause();
 const s=document.getElementById('cdp-schedule-root').shadowRoot;
 const text=()=>s.textContent;
 const button=name=>[...s.querySelectorAll('button')].find(x=>x.textContent.trim()===name);
 ok(s.querySelector('.brand strong').textContent==='CDP Program Management','requested app name');
 ok(s.querySelector('h1').textContent==='Projects Scheulde','exact requested heading');
 ok(!button('Guide')&&!s.querySelector('[aria-label="Open editing guide"]'),'no guide controls');
 ok(!s.querySelector('.preview-strip')&&!s.querySelector('.subtitle'),'no instructional chrome');
 ok(!/Click any activity|Maintain entries|Add the project column/.test(text()),'no instructional prose');
 ok(s.querySelectorAll('.timeline-row').length===2,'two grouped project lanes');
 ok(s.querySelectorAll('.bar').length===6,'six valid activities including milestone');
 ok(s.querySelectorAll('.week').length>4&&s.querySelector('.week').getAttribute('aria-label').includes('FY'),'federal fiscal week axis');
 ok(s.querySelector('.today-marker')&&s.querySelector('.today-marker').getAttribute('aria-label').startsWith('Today:'),'dynamic accessible Today marker');
 ok(s.querySelector('.bar span').textContent==='Short & safe'&&!s.querySelector('.bar span').textContent.includes('Planned'),'short bar label omits status');
 ok(!s.querySelector('footer')&&!s.querySelector('.timeline-foot')&&!/automatic dependency scheduler|Read-only view of cdp_roadmap.csv|Designed for clarity/.test(text()),'timeline ends without footer copy');
 ok(s.querySelector('.content').getBoundingClientRect().width>=innerWidth-(innerWidth<=760?24:2),'full viewport workspace width');
 ok(getComputedStyle(s.querySelector('a.primary')).backgroundColor==='rgb(92, 192, 92)','Splunk green primary action');
 const alpha=s.querySelector('.project-row');
 const boxes=[...alpha.querySelectorAll('.bar:not(.milestone)')].map(el=>el.getBoundingClientRect());
 ok(new Set(boxes.map(box=>box.top)).size===3,'parallel activities stack without overlap');
 const before=s.querySelector('.timeline-scroll').getBoundingClientRect().top;
 button('Expand timeline').click();await pause();
 ok(s.querySelector('.timeline-scroll').getBoundingClientRect().top<before,'focus reclaims vertical space');
 ok(button('Exit focus').getAttribute('aria-pressed')==='true','focus state accessible');
 const focusTheme=[...s.querySelectorAll('.theme-toggle button')].find(b=>b.textContent==='Light'&&b.getBoundingClientRect().height);
 focusTheme.click();await pause();ok(s.querySelector('.canvas').dataset.theme==='light','theme toggle works in focus');
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await pause();
 ok(button('Expand timeline'),'Escape exits focus');
 const project=s.querySelector('[aria-label="Filter project"]');project.value=JSON.stringify('Project Beta');project.dispatchEvent(new Event('change',{bubbles:true}));await pause();
 ok(s.querySelectorAll('.project-row').length===1&&s.querySelectorAll('.bar').length===2,'project filter groups two activities');
 button('Reset').click();await pause();
 ok(dispatched===1,'one bounded initial search');
 button('Dark').click();await pause();
 gridlineHierarchy(s,'dark');
 for(const cls of ['planned','progress','risk','blocked','complete'])ok(contrast(s.querySelector('.bar.'+cls))>=4.5,'dark '+cls+' text contrast');
 for(const cls of ['planned','progress','risk','blocked','complete'])ok(s.querySelector('.bar.'+cls),'semantic '+cls);
 ok(s.querySelector('.bar.milestone'),'zero-duration point');
 ok(getComputedStyle(s.querySelector('.canvas')).backgroundColor!=='rgb(255, 255, 255)','dark canvas');
 ok(s.querySelector('a.primary').href.includes('namespace=cdp_roadmap&lookup=cdp_roadmap.csv'),'scoped editor link');
 s.querySelector('.bar').click();await pause();ok(s.querySelector('dialog').open,'read-only details opens');ok(!s.querySelector('dialog input'),'no pretend save controls');
 s.querySelector('[aria-label="Close entry"]').click();await pause();ok(!s.querySelector('dialog'),'details closes');
 window.location.hash='#guide';await pause();ok(s.querySelector('h1').textContent==='Projects Scheulde'&&!s.querySelector('#guide'),'old guide hash falls back safely');
 window.location.hash='#roadmap';await pause();
 const select=s.querySelector('[aria-label="Filter status"]');select.value='In progress';select.dispatchEvent(new Event('change',{bubbles:true}));await pause();
 ok(s.querySelectorAll('.timeline-row').length===1,'status filters timeline');
 button('Light').click();await pause();
 ok(s.querySelector('.canvas').dataset.theme==='light'&&select.value==='In progress'&&s.querySelectorAll('.bar').length===1,'light mode preserves filtered activities');
 ok(getComputedStyle(s.querySelector('.canvas')).backgroundColor==='rgb(242, 244, 245)','light canvas palette');
 gridlineHierarchy(s,'light');
 s.querySelector('.bar').click();await pause();ok(getComputedStyle(s.querySelector('dialog')).backgroundColor==='rgb(255, 255, 255)','details uses light theme');s.querySelector('[aria-label="Close entry"]').click();await pause();
 button('Overview').click();await pause();ok(s.querySelectorAll('.entry-link').length===1,'filters persist across tabs');
 button('Reset').click();await pause();ok(s.querySelectorAll('.entry-link').length===7,'invalid record retained in register');ok(!s.querySelector('img'),'HTML-like values escaped');ok(dispatched===1,'tabs and filters cause no new searches');
 mode='error';button('Reload').click();await pause();await pause();ok(s.querySelector('[role="alert"]')&&text().includes('Entries could not be loaded'),'search error visible');ok(!s.querySelector('.entry-link'),'failed read has no stale data');
 mode='empty';button('Reload').click();await pause();await pause();ok(text().includes('No entries yet'),'empty lookup explicit');
 mode='overflow';button('Reload').click();await pause();await pause();ok(s.querySelectorAll('.entry-link').length===1000,'render cap 1000');ok(text().includes('Entry limit exceeded'),'overflow warning');
 mode='fixture';button('Reload').click();await pause();await pause();button('Roadmap').click();await pause();
 ok(document.documentElement.scrollWidth<=innerWidth,'page has no horizontal overflow');
 for(const cls of ['planned','progress','risk','blocked','complete'])ok(contrast(s.querySelector('.bar.'+cls))>=4.5,'light '+cls+' text contrast');
 ok(localStorage.getItem('cdp-schedule.theme.v1')==='light'&&localStorage.length===1,'only theme preference stored');
 CDPSchedule.mount(document.getElementById('cdp-schedule-root'),{loadData:async()=>fixture,editorUrl:'/app/lookup_editor/lookup_edit?namespace=cdp_roadmap&lookup=cdp_roadmap.csv'});await pause();await pause();
 ok(s.querySelector('.canvas').dataset.theme==='light','theme restored on fresh mount');
 button('Dark').click();await pause();ok(s.querySelector('.canvas').dataset.theme==='dark','switch back to dark');
 button('Light').click();await pause();ok(s.querySelector('.canvas').dataset.theme==='light','final light-theme capture');
 const result={status:'pass',checks,dispatched,viewport:innerWidth};document.getElementById('verify-result').textContent=JSON.stringify(result);
}
run().catch(e=>{document.getElementById('verify-result').textContent=JSON.stringify({status:'fail',checks,error:e.message});});
'''

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def main():
    version=json.loads((APP/'package.json').read_text())['version'].replace('.','-')
    bundle=(APP/'appserver/static'/('cdp-schedule-'+version+'.js')).read_text()
    results=[]
    with tempfile.TemporaryDirectory(prefix='hermes-verify-browser-') as directory:
        folder=Path(directory)
        (folder/'bundle.js').write_text(bundle)
        (folder/'index.html').write_text('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#verify-result{display:none}</style></head><body><div id="cdp-schedule-root"></div><pre id="verify-result">PENDING</pre><script>'+MOCK+'</script><script src="bundle.js"></script><script>'+TEST+'</script></body></html>')
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(folder)))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            for width,height in [(1920,1080),(1440,1100),(390,844)]:
                command=[CHROME,'--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu','--use-mock-keychain','--password-store=basic','--disable-background-networking','--disable-sync','--disable-extensions',f'--user-data-dir={folder / str(width)}',f'--window-size={width},{height}','--virtual-time-budget=8000','--dump-dom',f'--screenshot={APP / "build" / ("browser-smoke-light-"+str(width)+".png")}',f'http://127.0.0.1:{server.server_port}/index.html#roadmap']
                process=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
                try:
                    stdout,stderr=process.communicate(timeout=20)
                except subprocess.TimeoutExpired:
                    # macOS Chrome can emit the completed DOM but hang during shutdown.
                    # Terminate only this isolated test process group, never the user's browser.
                    try:
                        os.killpg(process.pid,signal.SIGTERM)
                    except ProcessLookupError:
                        pass
                    except PermissionError:
                        process.send_signal(signal.SIGTERM)
                    try:
                        stdout,stderr=process.communicate(timeout=5)
                    except subprocess.TimeoutExpired:
                        try:
                            os.killpg(process.pid,signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                        except PermissionError:
                            process.kill()
                        stdout,stderr=process.communicate()
                match=re.search(r'<pre id="verify-result">(.*?)</pre>',stdout,re.S)
                if not match or match.group(1)=='PENDING':
                    raise RuntimeError('Browser did not finish: '+stderr[-2000:])
                result=json.loads(html.unescape(match.group(1)))
                print(json.dumps(result))
                if result['status']!='pass': raise RuntimeError(result.get('error','Browser test failed'))
                results.append(result)
        finally:
            server.shutdown();server.server_close()
    (APP/'build/browser-smoke.json').write_text(json.dumps({'type':'ad-hoc exact-bundle verification with synthetic results','runs':results},indent=2)+'\n')
    print('Ad-hoc browser verification passed; temporary harness and browser profiles removed.')

if __name__=='__main__':
    main()
