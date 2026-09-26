const test=require('node:test'),assert=require('node:assert/strict');
const input=require('./policy-input.js'),rules=require('./region-rules.js');
const parse=text=>input.prepare(text,t=>rules.readIntakeCodeHeader(t));
test('standalone product headings and ages are metadata; trailing numbers are quantities',()=>{
 const p=parse('GA\n일반 61세 이하\n수도권 4\n광주주전남 1\n실버 62~70세\n부산광역시 2');
 assert.deepEqual(p.kinds,['general','silver']);
 assert.deepEqual(p.rows.slice(1),[['GA'],['수도권','4','일반'],['광주주전남','1','일반'],['부산광역시','2','실버']]);
 const rows=p.rows.filter(r=>r[0]!=='GA'),groups=input.groups(rows,'auto');
 assert.equal(groups.general.length,3);assert.equal(groups.silver.length,2);
 const scopes=rules.parseRows(groups.general);assert(scopes.every(s=>s.errors.length===0));
 for(const [province,name] of [['서울','서울특별시'],['인천','인천광역시'],['경기','수원시']]){const r=rules.evaluate(scopes,{province,name});assert.equal(r.quantity,4);assert.equal(r.sharedQuantity,true);}
 assert.equal(rules.evaluate(scopes,{province:'전남',name:'목포시'}).quantity,1);
 assert.equal(rules.evaluate(scopes,{province:'광주',name:'광주광역시'}).quantity,1);
 assert.notEqual(rules.evaluate(scopes,{province:'부산',name:'부산광역시'}).state,'possible');
});
test('general and silver quantity columns split into independent policies including zero',()=>{
 const p=parse('지역\t일반\t실버\n수도권\t4\t2\n광주주전남\t1\t0');
 const g=input.groups(p.rows,'auto');assert.equal(g.general[1][1],'4');assert.equal(g.silver[1][1],'2');assert.equal(g.silver[2][1],'0');
 assert.throws(()=>input.groups(p.rows,'general'),/다릅니다/);
 const withExclusions=parse('지역\t일반\t실버\t제외지역\n수도권\t4\t2\t서울특별시 강남구');
 const split=input.groups(withExclusions.rows,'auto');for(const kind of ['general','silver']){assert.equal(split[kind][1][2],'서울특별시 강남구');assert.equal(rules.evaluate(rules.parseRows(split[kind]),{province:'서울',name:'강남구'}).state,'blocked');}
});
test('carrier title determines kind without making its age a region or quota',()=>{
 const p=parse('GA 실버 62~70세\n수도권 4');assert.deepEqual(p.kinds,['silver']);assert.deepEqual(p.rows.at(-1),['수도권','4','실버']);
});
test('unknown product is not guessed and similar geographic names remain literal',()=>{
 const p=parse('일반산업단지 4');assert.deepEqual(p.kinds,[]);assert.equal(p.rows[0][0],'일반산업단지');
 assert.throws(()=>input.groups([['지역','수량'],['수도권','4']],'auto'),/구분이 없는/);
});
test('counting-age boundaries distinguish 61, 62, 70 and 71',()=>{
 assert.equal(input.kindForAge(61),'general');assert.equal(input.kindForAge(62),'silver');assert.equal(input.kindForAge(70),'silver');for(const age of [71,0,-1,61.5,''])assert.equal(input.kindForAge(age),'');
});
