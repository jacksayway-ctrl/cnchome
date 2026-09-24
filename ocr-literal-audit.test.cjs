'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'index.html'),'utf8');
const ctx={};
vm.runInNewContext(html.slice(html.indexOf('function policyConfirmedCropReading('),html.indexOf('function policyQuantityCellReading(')),ctx);
const reading=(text,confidence=95)=>({text,confidence});
ctx.policyUpdateOcrProgress=()=>{};
ctx.policyCellImage=(_s,_a,_b,_c,_d,variant)=>variant;
ctx.policyOcrTimeout=promise=>promise;
let calls=[];
async function audit(text,replies,unknown=true){
 calls=[];ctx.policyCityIssues=()=>unknown?[{kind:'unknown',choices:[{name:'사전후보'}]}]:[];
 const worker={setParameters:async()=>{},recognize:async variant=>{calls.push(variant);const r=replies[variant];if(!r)throw Error('unreadable');return {data:r}}};
 return ctx.policyAuditLiteralRows({}, {bands:[{top:0,bottom:20}],divider:100},{getRegionWorker:async()=>worker},[reading(text)],[reading(text)],new Map());
}
(async()=>{
 let got=await audit('서울',{},false);assert.equal(got.size,0);assert.equal(calls.length,0);
 got=await audit('양수',{channel:reading('양주'),white:reading('양주')});assert.equal(got.get(0).text,'양주');assert.equal(got.get(0).confirmed,true);assert.equal(calls.length,2);
 got=await audit('제수',{channel:reading('제주',84),white:reading('제주'),original:reading('잡음',3),channelcrop:reading('제주')});assert.equal(got.get(0).text,'제주');assert.equal(calls.length,4);
 got=await audit('원본오자',{channel:reading('원본오자'),white:reading('원본오자')});assert.equal(got.get(0).text,'원본오자','reference choices must never replace source spelling');
 got=await audit('성수',{channel:reading('성주'),white:reading('성수')});assert.equal(got.get(0).text,'성수');assert.equal(got.get(0).confirmed,false);
 got=await audit('서산시 必',{});assert.equal(got.size,0,'Korean-only audit cannot remove a Han condition');assert.equal(calls.length,0);
 got=await audit('실패원문',{});assert.equal(got.get(0).text,'실패원문');assert.equal(got.get(0).confirmed,false);
 got=await audit('포함, 경주',{channel:reading('포항, 경주'),white:reading('포항, 경주')},false);assert.equal(got.get(0).text,'포항, 경주');assert.equal(got.get(0).confirmed,true);
 got=await audit('포함, 경주',{channel:reading('포함, 경주'),white:reading('포함, 경주')},false);assert.equal(got.get(0).text,'포함, 경주','genuine source words must remain unchanged');
 got=await audit('포함, 경주',{channel:reading('포항, 경주'),white:reading('포함, 경주')},false);assert.equal(got.get(0).confirmed,false);assert.equal(got.get(0).text,'포함, 경주');
 got=await audit('경남 전체 (창원, 김해, 양산 제외)',{},false);assert.equal(got.size,0,'normal exclusion clauses do not trigger extra OCR');
 console.log('11 selective literal OCR audit safeguards passed');
})().catch(error=>{console.error(error);process.exitCode=1});
