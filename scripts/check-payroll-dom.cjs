// Development-only DOM integration check; no runtime dependency.
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(root,'payroll.html'),'utf8'),{url:'http://preview.local/payroll.html',runScripts:'outside-only',virtualConsole:vc});
const w=dom.window,d=w.document,q=id=>d.getElementById(id);
w.fetch=async url=>{assert.equal(url,'./docs/payroll-requirements.json');return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'docs/payroll-requirements.json'),'utf8'))};};
const input=(id,value)=>{q(id).value=value;q(id).dispatchEvent(new w.Event('input',{bubbles:true}));};
async function main(){
 for(const file of ['payroll-engine.js','payroll-preview.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
 await new Promise(r=>setTimeout(r,10));
 assert.equal(q('calculation-error').textContent,'');assert.ok(q('payroll-output').textContent.includes('세전'));assert.equal(q('daily-count'),null);assert.ok(d.querySelector('a[href="./index.html#adminPayroll"]'));
 const initial=q('payroll-output').textContent;
 input('s0-minutes','999999');assert.ok(q('calculation-error').textContent);assert.equal(q('payroll-output').textContent,'');
 q('reset').click();assert.equal(q('calculation-error').textContent,'');assert.equal(q('payroll-output').textContent,initial);
 input('adjustment-reason','<img src=x onerror=alert(1)>');input('adjustment','10000');assert.equal(d.querySelectorAll('#payroll-output img').length,0);assert.ok(q('payroll-output').textContent.includes('<img'));
 q('adjustment-reviewed').checked=true;input('s0-base','20000');assert.equal(q('adjustment-reviewed').checked,false);assert.match(q('finalization-issues').textContent,/보정 재확인/);
 input('rule-search','Q-425');assert.match(q('rule-list').textContent,/진행 중 A\/S/);assert.match(q('rule-list').textContent,/확정 급여는 유지/);
 input('rule-search','G-018');assert.match(q('rule-list').textContent,/월 급여로 합산하지 않는다/);
 assert.match(q('management-result').textContent,/원/);assert.match(q('team-result').textContent,/A팀/);assert.deepEqual(errors,[]);
 console.log('PASS: payroll calculation, invalid input recovery, daily separation, adjustment reconfirmation, escaped text, rule search and admin return link.');dom.window.close();
}
main().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
