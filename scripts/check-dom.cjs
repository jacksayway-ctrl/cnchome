'use strict';
const {readdirSync}=require('node:fs');
const {join}=require('node:path');
const {spawnSync}=require('node:child_process');
const checks=readdirSync(__dirname).filter(name=>name.endsWith('-dom.cjs')&&name!=='check-dom.cjs').sort();
let failures=0;
for(const name of checks){
 const result=spawnSync(process.execPath,[join(__dirname,name)],{stdio:'inherit',timeout:30000});
 if(result.status!==0){failures++;console.error('FAIL:',name,result.error?.message||'');}
}
console.log('DOM checks:',checks.length-failures+'/'+checks.length+' passed');
process.exitCode=failures?1:0;
