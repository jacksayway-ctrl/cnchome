'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const oldRevision='a'.repeat(40),newRevision='b'.repeat(40);
function run(t,scenario,setup=()=>{},publicDirectory=true){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cnc-deploy-check-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const dir of ['repo/server','state','lock','bin',...(publicDirectory?['public']:[])])fs.mkdirSync(path.join(root,dir),{recursive:true});
 const publicPath=path.join(root,'public'),state=path.join(root,'state'),repo=path.join(root,'repo');
 const previousStatus=JSON.stringify({revision:oldRevision,state:'complete'});
 if(publicDirectory)fs.writeFileSync(path.join(publicPath,'deployment-status.json'),previousStatus);
 const source=fs.readFileSync(path.join(__dirname,'server/auto-deploy.sh'),'utf8')
  .replaceAll('/run/lock',path.join(root,'lock')).replaceAll('/var/www/html',publicPath)
  .replaceAll('/var/lib/cnchome-deploy',state).replaceAll('/opt/cnchome',repo);
 fs.writeFileSync(path.join(root,'auto-deploy.sh'),source);
 const fakeGit=`#!${process.execPath}
const fs=require('node:fs'),p=require('node:path'),args=process.argv.slice(2),root=process.env.CNC_DEPLOY_FIXTURE;
fs.appendFileSync(p.join(root,'git-calls'),args.join(' ')+'\\n');
const scenario=process.env.CNC_DEPLOY_SCENARIO;
if(args[0]==='rev-parse'){console.log(args[1]==='origin/main'||fs.existsSync(p.join(root,'merged'))?'${newRevision}':'${oldRevision}');}
else if(args[0]==='diff'&&scenario==='dirty')process.exit(1);
else if(args[0]==='fetch'&&scenario==='fetch-error'){console.error('fixture-secret-must-stay-private');process.exit(17);}
else if(args[0]==='merge'){if(scenario==='merge-error')process.exit(42);fs.writeFileSync(p.join(root,'merged'),'1');}
`;
 fs.writeFileSync(path.join(root,'bin/git'),fakeGit,{mode:0o755});
 fs.writeFileSync(path.join(repo,'server/deploy.sh'),'#!/bin/bash\nprintf ran > '+path.join(root,'deployed')+'\nexit '+(scenario==='deploy-error'?'23':'0')+'\n');
 setup({root,state,publicPath});
 const result=spawnSync('bash',[path.join(root,'auto-deploy.sh')],{encoding:'utf8',timeout:10000,env:{...process.env,PATH:path.join(root,'bin')+':'+process.env.PATH,CNC_DEPLOY_FIXTURE:root,CNC_DEPLOY_SCENARIO:scenario}});
 if(result.error)throw result.error;
 const statusFile=path.join(publicPath,'auto-deploy-status.json');
 const status=fs.existsSync(statusFile)?JSON.parse(fs.readFileSync(statusFile,'utf8')):null;
 if(status){assert.deepEqual(Object.keys(status).sort(),['checkedAt','exitCode','revision','stage','state','targetRevision'].sort());assert.match(status.checkedAt,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);assert.equal(fs.statSync(statusFile).mode&0o777,0o644);assert.ok(!JSON.stringify(status).includes('fixture-secret'));}
 if(publicDirectory)assert.equal(fs.readFileSync(path.join(publicPath,'deployment-status.json'),'utf8'),previousStatus);
 return {root,state,status,result,calls:fs.readFileSync(path.join(root,'git-calls'),'utf8'),deployed:fs.existsSync(path.join(root,'deployed'))};
}
test('uncommitted server edits are preserved and reported before fetching',t=>{
 const r=run(t,'dirty');assert.equal(r.result.status,1);assert.equal(r.status.state,'blocked');assert.equal(r.status.stage,'tracked-edits');assert.equal(r.status.revision,oldRevision);assert.ok(!r.calls.includes('fetch'));assert.equal(r.deployed,false);
});
test('GitHub fetch errors are reported without publishing private Git output',t=>{
 const r=run(t,'fetch-error');assert.equal(r.result.status,17);assert.equal(r.status.state,'failed');assert.equal(r.status.stage,'fetch');assert.equal(r.status.exitCode,17);assert.match(r.result.stderr,/fixture-secret/);assert.equal(r.deployed,false);
});
test('diverged source history stops safely and reports the merge stage',t=>{
 const r=run(t,'merge-error');assert.equal(r.result.status,42);assert.equal(r.status.stage,'merge');assert.equal(r.status.targetRevision,newRevision);assert.equal(r.deployed,false);
});
test('already deployed source produces a fresh current-state heartbeat',t=>{
 const r=run(t,'current',({state})=>fs.writeFileSync(path.join(state,'success'),newRevision));assert.equal(r.result.status,0);assert.equal(r.status.state,'current');assert.equal(r.deployed,false);assert.ok(!r.calls.includes('merge'));
});
test('a failure backoff reports waiting without repeating deployment',t=>{
 const r=run(t,'waiting',({state})=>{fs.writeFileSync(path.join(state,'attempt'),newRevision);fs.writeFileSync(path.join(state,'retry-after'),String(Math.floor(Date.now()/1000)+600));});assert.equal(r.result.status,0);assert.equal(r.status.state,'waiting');assert.equal(r.status.stage,'retry-wait');assert.equal(r.deployed,false);
});
test('successful deployment records the new revision and clears retry state',t=>{
 const r=run(t,'success',({state})=>{fs.writeFileSync(path.join(state,'attempt'),newRevision);fs.writeFileSync(path.join(state,'retry-after'),'0');fs.writeFileSync(path.join(state,'retry-count'),'4');});assert.equal(r.result.status,0);assert.equal(r.deployed,true);assert.equal(r.status.state,'complete');assert.equal(r.status.revision,newRevision);assert.equal(fs.readFileSync(path.join(r.state,'success'),'utf8').trim(),newRevision);assert.equal(fs.existsSync(path.join(r.state,'retry-after')),false);assert.equal(fs.existsSync(path.join(r.state,'retry-count')),false);
});
test('failed deployment retains its exit code and schedules another attempt',t=>{
 const r=run(t,'deploy-error');assert.equal(r.result.status,1);assert.equal(r.status.state,'failed');assert.equal(r.status.stage,'deployment');assert.equal(r.status.exitCode,23);assert.equal(fs.existsSync(path.join(r.state,'success')),false);assert.equal(fs.readFileSync(path.join(r.state,'retry-count'),'utf8').trim(),'1');assert.ok(Number(fs.readFileSync(path.join(r.state,'retry-after'),'utf8'))>Math.floor(Date.now()/1000));
});
test('a changed GitHub revision proceeds despite an old revision backoff',t=>{
 const r=run(t,'success',({state})=>{fs.writeFileSync(path.join(state,'attempt'),oldRevision);fs.writeFileSync(path.join(state,'retry-after'),String(Math.floor(Date.now()/1000)+900));});assert.equal(r.result.status,0);assert.equal(r.deployed,true);assert.equal(r.status.state,'complete');
});
test('diagnostic output is optional when the web directory does not yet exist',t=>{
 const r=run(t,'success',()=>{},false);assert.equal(r.result.status,0);assert.equal(r.deployed,true);assert.equal(r.status,null);
});
test('a diagnostic write failure cannot block an otherwise valid deployment',t=>{
 const r=run(t,'success',({publicPath})=>fs.mkdirSync(path.join(publicPath,'auto-deploy-status.json.new')));assert.equal(r.result.status,0);assert.equal(r.deployed,true);assert.equal(r.status,null);assert.match(r.result.stderr,/Is a directory/);
});
