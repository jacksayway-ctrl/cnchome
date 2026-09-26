'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const rules=require('./region-rules.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'office.js'),'utf8');
const context={policyCodeHeader:text=>rules.readIntakeCodeHeader(text)};
vm.runInNewContext(source.slice(source.indexOf('function policyQuantityCellReading('),source.indexOf('async function policyRecognizeBatch(')),context);
const read=(digit,text,confidence=95)=>context.policyQuantityCellReading({text:digit,confidence:95},{text,confidence});
assert.equal(read('15','15').text,'15');
assert.equal(read('15','15').review,false);
assert.equal(read('15','16').review,true,'conflicting numeric readings require review');
assert.equal(read('0','불가').text,'0','printed unavailable quantity is normalized to zero');
assert.equal(read('0','불가').review,false);
assert.equal(read('0','불가',60).review,true);
for(const text of ['실버만','일반만','별도 문의','이월']){
 assert.equal(read('0',text).text,text,'digit-only hallucination must not replace printed words');
 assert.equal(read('0',text).review,true,'text never invents an available quota');
}
assert.equal(read('','').review,true);
assert.equal(context.policyIsCodeTitle(0,'한화 6월',{text:'이월'},'0'),true);
assert.equal(context.policyIsCodeTitle(0,'한 화',{text:''},''),true);
assert.equal(context.policyIsCodeTitle(0,'G/A',{text:'수량'},'0'),true);
assert.equal(context.policyIsCodeTitle(0,'한화',{text:'3'},'3'),false,'code plus actual quantity is not silently removed');
assert.equal(context.policyIsCodeTitle(1,'한화',{text:'이월'},'0'),false);
assert.equal(context.policyIsCodeTitle(0,'한화동',{text:'이월'},'0'),false);
assert.equal(context.policyIsCodeTitle(0,'한화',{text:'실버만'},'실버만'),false);
console.log('Quantity words, numeric conflicts, title headings and false-title guard checks passed');
