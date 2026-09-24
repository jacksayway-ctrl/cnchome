'use strict';
const assert=require('node:assert/strict');
const R=require('./region-rules.js');
const p=(province,name,...path)=>({province,name,path});
const scope=(text,quantity=4,status='',headers=[])=>R.parseRow([text,String(quantity),status],0,headers);
const state=(scopes,place)=>R.evaluate(Array.isArray(scopes)?scopes:[scopes],place).state;
let count=0;function test(name,fn){try{fn();count++;}catch(error){console.error('FAIL:',name);throw error}}
test('complete city/county reference with duplicate county names retained',()=>{assert.equal(R.catalog.filter(x=>x.kind==='county').length,82);assert.equal(R.catalog.filter(x=>x.kind==='city').length,85);assert.equal(R.resolvePlace('고성군').length,2)});
test('single county is recognized without companion words',()=>{const s=scope('성주');assert.deepEqual(s.errors,[]);assert.equal(s.include[0].name,'성주군');assert.equal(state(s,p('경북','성주군')),'possible');assert.equal(state(s,p('경북','칠곡군')),'blocked')});
test('no OCR typo substitution',()=>{for(const name of ['성수','중남 서부','찬안시']){const s=scope(name);assert.equal(s.text,name);assert.ok(s.errors.length);assert.equal(s.include.length,0)}});
test('intake code headings use exact aliases and preserve the original title',()=>{for(const [text,id,label] of [['한화','hanwha','한화'],['신한','shinhan','신한'],['G/A','ga','G/A'],['GA','ga','G/A'],['g / a','ga','G/A'],['  접수 코드: 한화 일반 2026년 06월  ','hanwha','한화'],['신한 12월 실버','shinhan','신한'],['G/A 2026년','ga','G/A']])assert.deepEqual(R.readIntakeCodeHeader(text),{id,label,title:text.trim()})});
test('intake headings never consume mixed geographic names or invalid dates',()=>{for(const text of ['한화동','신한면','한화 서울','서울 한화','한화 13월','신한 0월','G/A 6훨','GA 2026','한화 일반 실버','한화 신한','G/A 성주군','접수 코드: 한화 서울'])assert.equal(R.readIntakeCodeHeader(text),null,text)});
test('standalone intake title is metadata and a later header controls actual columns',()=>{const rows=[['한화 6월','',''],['수량','접수 가능지역','접수 불가지역'],['4','서산시','대산읍']];const original=JSON.stringify(rows),scopes=R.parseRows(rows);assert.equal(scopes.length,1);assert.equal(scopes[0].index,2);assert.equal(scopes[0].quantity,4);assert.deepEqual(scopes[0].errors,[]);assert.equal(state(scopes,p('충남','서산시')),'partial');assert.equal(state(scopes,p('충남','서산시','대산읍')),'blocked');assert.equal(JSON.stringify(rows),original)});
test('an explicit intake-code column is kept outside the region classification',()=>{for(const code of ['한화','신한','G/A']){const rows=[['접수 코드','지역','수량'],[code,'성주군','3']],original=JSON.stringify(rows),scopes=R.parseRows(rows);assert.equal(scopes.length,1);assert.equal(scopes[0].text,'성주군');assert.deepEqual(scopes[0].errors,[]);assert.equal(state(scopes,p('경북','성주군')),'possible');assert.equal(JSON.stringify(rows),original)}});
test('an intake code with a quantity is not silently discarded as a title',()=>{for(const code of ['한화','신한','G/A']){const scopes=R.parseRows([['지역','수량'],[code,'4']]);assert.equal(scopes.length,1);assert.equal(scopes[0].text,code);assert.ok(scopes[0].errors.length);assert.equal(scopes[0].include.length,0)}});
test('geographic text containing a code remains unresolved and unchanged',()=>{for(const text of ['한화 서울','신한면','한화동']){const s=scope(text);assert.equal(s.text,text);assert.ok(s.errors.length);assert.notEqual(state(s,p('서울','서울특별시')),'possible')}});
test('heading before a city/county table preserves separate lower-level columns',()=>{const rows=[['접수 코드：G / A 실버'],['시/군','읍/면/동','수량'],['서산시','대산읍','4']],scopes=R.parseRows(rows);assert.equal(scopes.length,1);assert.deepEqual(scopes[0].errors,[]);assert.equal(state(scopes,p('충남','서산시','대산읍')),'possible');assert.equal(state(scopes,p('충남','서산시','음암면')),'blocked')});
test('custom intake title is metadata only when the configured catalog contains it',()=>{const C=require('./intake-codes.js'),codes=C.upsert(C.read(null),{label:'신규 접수',aliases:['NEW']}),rows=[['NEW 일반 6월'],['지역','수량'],['성주군','3']],before=JSON.stringify(rows),scopes=R.parseRows(rows,{intakeCodes:codes});assert.equal(scopes.length,1);assert.deepEqual(scopes[0].errors,[]);assert.equal(state(scopes,p('경북','성주군')),'possible');assert.equal(R.parseRows(rows).length,2);assert.equal(JSON.stringify(rows),before)});
test('parseRows keeps legacy explicit headers and supports options headers',()=>{const rows=[['3','성주군']],headers=['수량','지역'];assert.deepEqual(R.parseRows(rows,headers),R.parseRows(rows,{headers}));assert.equal(R.parseRows(rows,headers)[0].quantity,3);assert.equal(state(R.parseRows(rows,headers),p('경북','성주군')),'possible')});
test('province-wide exclusions are ordinary valid rules',()=>{const s=scope('경남전체 (창원, 김해, 양산 제외)',2);assert.deepEqual(s.errors,[]);assert.equal(state(s,p('경남','창원시')),'blocked');assert.equal(state(s,p('경남','진주시')),'possible');assert.equal(state(s,p('경남','고성군')),'possible');assert.equal(state(s,p('강원','고성군')),'blocked')});
test('必 is preserved and restricts to explicit cities',()=>{const s=scope('충남 북부: 천안시, 아산시 必',8);assert.ok(s.text.includes('必'));assert.deepEqual(s.errors,[]);assert.equal(state(s,p('충남','천안시')),'possible');assert.equal(state(s,p('충남','서산시')),'blocked')});
test('direction-only categories never imply invented membership',()=>{const s=scope('경기 북부',3);assert.ok(s.errors.length);assert.equal(state(s,p('경기','파주시')),'review');assert.notEqual(state(s,p('경기','수원시')),'possible')});
test('county quantity remains a shared row amount',()=>{const s=scope('성주, 칠곡, 예천',3);for(const name of ['성주군','칠곡군','예천군'])assert.equal(R.evaluate([s],p('경북',name)).quantity,3);assert.equal(s.sharedQuantity,true);assert.equal(s.include.length,3)});
test('child-only rows do not permit whole city or unlisted children',()=>{const s=scope('서산시: 대산읍, 지곡면');assert.deepEqual(s.errors,[]);assert.equal(state(s,p('충남','서산시')),'partial');assert.equal(state(s,p('충남','서산시','대산읍')),'possible');assert.equal(state(s,p('충남','서산시','지곡면')),'possible');assert.equal(state(s,p('충남','서산시','음암면')),'blocked')});
test('an excluded child makes only its parent partial',()=>{const s=scope('서산시 전체 (대산읍 제외)');assert.deepEqual(s.errors,[]);assert.equal(state(s,p('충남','서산시')),'partial');assert.equal(state(s,p('충남','서산시','대산읍')),'blocked');assert.equal(state(s,p('충남','서산시','음암면')),'possible')});
test('separate blocked rows override a city allow without blocking siblings',()=>{const all=scope('서산시');const no=R.parseRow(['서산시 대산읍','','접수 불가'],1);assert.equal(state([all,no],p('충남','서산시')),'partial');assert.equal(state([all,no],p('충남','서산시','대산읍')),'blocked');assert.equal(state([all,no],p('충남','서산시','지곡면')),'possible')});
test('separate excluded column supplies context from parent',()=>{const s=R.parseRow(['서산시','4','대산읍, 지곡면'],0,['접수 가능지역','수량','접수 불가지역']);assert.deepEqual(s.errors,[]);assert.equal(s.exclude.length,2);assert.equal(state(s,p('충남','서산시')),'partial');assert.equal(state(s,p('충남','서산시','대산읍')),'blocked')});
test('nested district and township preserve every parent',()=>{const s=scope('용인시 처인구 포곡읍, 모현읍');assert.deepEqual(s.errors,[]);assert.deepEqual(s.include.map(t=>t.path),[['처인구','포곡읍'],['처인구','모현읍']]);assert.equal(state(s,p('경기','용인시','처인구','포곡읍')),'possible');assert.equal(state(s,p('경기','용인시','기흥구')),'blocked');assert.equal(state(s,p('경기','용인시')),'partial')});
test('child names without explicit parent are not guessed',()=>{const s=scope('대산읍');assert.ok(s.errors.some(e=>e.includes('상위 시·군')));assert.equal(s.include.length,0)});
test('suffix-free child names are not guessed',()=>{const s=scope('서산시: 대산');assert.ok(s.errors.length);assert.equal(s.include.length,0)});
test('ambiguous names require province',()=>{for(const name of ['광주','고성군']){const s=scope(name);assert.ok(s.errors.some(e=>e.includes('시도 구분')));assert.equal(s.include.length,0)}assert.deepEqual(scope('경기: 광주').errors,[]);assert.equal(scope('강원: 고성').include[0].province,'강원')});
test('literal # is preserved and never silently changed to 必',()=>{const s=scope('천안시 #');assert.equal(s.text,'천안시 #');assert.ok(s.errors.length);assert.equal(s.only,false)});
test('metropolitan district is subordinate to metropolitan city',()=>{const s=scope('서울: 강남구, 송파구');assert.equal(state(s,p('서울','서울특별시')),'partial');assert.equal(state(s,p('서울','서울특별시','강남구')),'possible');assert.equal(state(s,p('서울','서울특별시','서초구')),'blocked')});
test('mixed provinces in a comma/slash list do not inherit another city province',()=>{const s=scope('인천/김포');assert.deepEqual(s.errors,[]);assert.equal(state(s,p('인천','인천광역시')),'possible');assert.equal(state(s,p('경기','김포시')),'possible')});
test('city and county lists support cross-province original policy rows',()=>{const s=scope('대구, 김천, 안동, 구미, 영주, 상주, 문경, 의성, 청도, 고령, 성주, 칠곡, 예천, 봉화',0);assert.deepEqual(s.errors,[]);assert.equal(s.include.length,14);assert.equal(state(s,p('경북','성주군')),'blocked')});
test('zero quantity blocks even a broad positive rule',()=>{const all=scope('충남 전체',7);const no=R.parseRow(['서산시','0'],1);assert.equal(state([all,no],p('충남','서산시')),'blocked');assert.equal(state([all,no],p('충남','천안시')),'possible')});
test('unknown quantity does not become available',()=>{assert.equal(state(scope('서산시','?'),p('충남','서산시')),'review')});
test('불가 in quantity is a blocker without needing numeric count',()=>{assert.equal(state(scope('서산시','불가'),p('충남','서산시')),'blocked')});
test('explicit unavailable heading applies to following rows only until available heading',()=>{const scopes=R.parseRows([['지역','수량','상태'],['접수 가능지역'],['서산시','4'],['접수 불가 지역'],['서산시 대산읍'],['접수 가능 지역'],['성주군','2']]);assert.equal(scopes.length,3);assert.equal(state(scopes,p('충남','서산시','대산읍')),'blocked');assert.equal(state(scopes,p('경북','성주군')),'possible')});
test('explicit province heading supplies duplicate county disambiguation',()=>{const scopes=R.parseRows([['강원:'],['고성군','3']]);assert.equal(scopes.length,1);assert.deepEqual(scopes[0].errors,[]);assert.equal(state(scopes,p('강원','고성군')),'possible')});
test('region names are not changed by parsing',()=>{const row=['  서산시 전체 (대산읍 제외)  ','4'];const before=JSON.stringify(row);R.parseRow(row);assert.equal(JSON.stringify(row),before)});
test('overlapping distinct quantities require confirmation rather than summing',()=>{const broad=scope('충남 전체',2);const narrow=R.parseRow(['서산시','4'],1);assert.equal(state([broad,narrow],p('충남','서산시')),'review');assert.equal(R.evaluate([broad,narrow],p('충남','서산시')).quantity,null)});
test('structured status exclusions are scoped to named children',()=>{const s=scope('서산시','4','접수 불가: 대산읍');assert.equal(state(s,p('충남','서산시')),'partial');assert.equal(state(s,p('충남','서산시','대산읍')),'blocked')});
test('a parent-row exclusion does not cancel a dedicated positive city row',()=>{const rest=scope('경남전체 (창원, 김해, 양산 제외)',2);const changwon=R.parseRow(['창원','7'],1);const busan=R.parseRow(['부산, 김해, 양산','5'],2);assert.equal(state([rest,changwon,busan],p('경남','창원시')),'possible');assert.equal(R.evaluate([rest,changwon,busan],p('경남','창원시')).quantity,7);assert.equal(state([rest,changwon,busan],p('경남','김해시')),'possible');assert.equal(R.evaluate([rest,changwon,busan],p('경남','김해시')).quantity,5);assert.equal(R.evaluate([rest,changwon,busan],p('경남','진주시')).quantity,2)});
test('a separately labelled excluded column overrides another positive city rule',()=>{const rest=R.parseRow(['경남전체','2','창원'],0,['접수 가능지역','수량','접수 불가지역']);const changwon=R.parseRow(['창원','7'],1);assert.equal(state([rest,changwon],p('경남','창원시')),'blocked')});
test('zero quota broad row does not block a city excluded from that row',()=>{const rest=scope('경남전체 (창원 제외)',0);const changwon=R.parseRow(['창원','7'],1);assert.equal(state([rest,changwon],p('경남','창원시')),'possible');assert.equal(state([rest,changwon],p('경남','진주시')),'blocked')});
test('metropolitan whole province includes its separately classified counties',()=>{const s=scope('부산 전체',4);assert.equal(state(s,p('부산','기장군')),'possible');assert.equal(state(s,p('부산','부산광역시')),'possible')});
test('nonparenthesized explicit whole-city exclusions are parsed without broadening a child',()=>{const s=scope('서산시 전체 대산읍 제외',4);assert.deepEqual(s.errors,[]);assert.equal(state(s,p('충남','서산시')),'partial');assert.equal(state(s,p('충남','서산시','대산읍')),'blocked');assert.equal(state(s,p('충남','서산시','지곡면')),'possible')});
test('zero broad quota with an excluded positive child is partial at municipality level',()=>{const zero=scope('서산시 전체 (대산읍 제외)',0);const child=R.parseRow(['서산시 대산읍','3'],1);assert.equal(state([zero,child],p('충남','서산시')),'partial');assert.equal(state([zero,child],p('충남','서산시','대산읍')),'possible');assert.equal(state([zero,child],p('충남','서산시','지곡면')),'blocked')});
test('必 without an explicit municipality list never broadens a province',()=>{const s=scope('충북 必',3);assert.ok(s.errors.length);assert.equal(state(s,p('충북','청주시')),'review')});
test('separate municipality and township columns build a subtree',()=>{const s=R.parseRow(['서산시','대산읍, 지곡면','4','음암면'],0,['시/군','읍/면/동','수량','접수 불가지역']);assert.deepEqual(s.errors,[]);assert.equal(s.quantity,4);assert.equal(state(s,p('충남','서산시')),'partial');assert.equal(state(s,p('충남','서산시','대산읍')),'possible');assert.equal(state(s,p('충남','서산시','음암면')),'blocked')});
test('separate province and municipality columns disambiguate matching names',()=>{const s=R.parseRow(['강원','고성군','전체','3'],0,['시/도','시/군','읍/면/동','수량']);assert.deepEqual(s.errors,[]);assert.equal(state(s,p('강원','고성군')),'possible');assert.equal(state(s,p('경남','고성군')),'blocked')});
test('unique standalone district resolves to its parent with a child-only scope',()=>{const s=scope('종로구');assert.deepEqual(s.errors,[]);assert.equal(state(s,p('서울','서울특별시')),'partial');assert.equal(state(s,p('서울','종로구')),'possible');assert.equal(state(s,p('서울','서울특별시','중구')),'blocked')});
test('duplicate standalone district requires its parent rather than guessing',()=>{const s=scope('동구');assert.ok(s.errors.length);assert.equal(s.include.length,0);assert.equal(state(s,p('부산','부산광역시','동구')),'review')});
test('known district under a wrong explicit city never permits the city',()=>{const s=scope('서산시 종로구');assert.ok(s.errors.length);assert.equal(s.include.length,0);assert.notEqual(state(s,p('충남','서산시')),'possible')});
test('old Incheon districts require administrative scope review',()=>{const s=scope('인천: 중구');assert.ok(s.errors.some(x=>x.includes('행정구역 변경')));assert.equal(s.include.length,0)});
test('unknown district is not treated as a valid child',()=>{const s=scope('서울: 없는구');assert.ok(s.errors.length);assert.equal(s.include.length,0)});
for(const city of R.catalog)test('catalog municipality '+city.id,()=>{const s=scope(city.province+': '+city.name,3);assert.deepEqual(s.errors,[]);assert.equal(state(s,city),'possible')});
for(const district of R.districts)test('catalog district hierarchy '+district.id,()=>{const s=scope(district.province+' '+district.parent+' '+district.name,3);assert.deepEqual(s.errors,[]);assert.equal(state(s,p(district.province,district.parent,district.name)),'possible');assert.equal(state(s,p(district.province,district.parent)),'partial');assert.ok(s.include.every(t=>t.path.length>0))});
console.log(count+' region rule tests passed');

for(const [heading,names,unlisted] of [
  ['경기동부',['구리시','남양주시','하남시','양평군','이천시'],'광주시'],
  ['경기남부',['용인시','안성시'],'수원시']
]) for(const separator of [': ', '：', ' ']) test('directional explicit list '+heading+separator,()=>{
  const short=names.map(n=>n.replace(/[시군]$/,''));
  for(const list of [short.join(' '),short.join(', '),names.join(', ')]){
    const text=heading+separator+list,s=scope(text);
    assert.deepEqual(s.errors,[]);assert.equal(s.text,text);assert.equal(s.listedOnly,true);
    assert.deepEqual(s.include.map(t=>t.name),names);assert.ok(s.include.every(t=>t.name));
    for(const name of names)assert.equal(state(s,p('경기',name)),'possible');
    assert.equal(state(s,p('경기',unlisted)),'blocked');
  }
});
test('spaced direction heading restricts children and preserves exclusions',()=>{
  const s=scope('경기 남부 용인시 처인구 포곡읍, 안성시 (안성시 제외)');
  assert.deepEqual(s.errors,[]);
  assert.equal(state(s,p('경기','용인시','처인구','포곡읍')),'possible');
  assert.equal(state(s,p('경기','용인시','기흥구')),'blocked');
  assert.equal(state(s,p('경기','안성시')),'blocked');
});
test('unknown directional list member still requires review',()=>{
  const s=scope('경기남부 용인, 없는지역');assert.ok(s.errors.length);
  assert.notEqual(state(s,p('경기','용인시')),'possible');
});
console.log('Directional list regression tests passed');

test('categories follow explicit directions and leave unsectioned rows at province level',()=>{
 const scopes=R.parseRows([['지역','수량'],['충남북부: 천안 아산','4'],['충남서부: 서산 태안','3'],['충남: 공주','2'],['경기남부: 용인 안성','5']]);
 const groups=R.categories(scopes),chungnam=groups.find(g=>g.province==='충남');
 assert.deepEqual(chungnam.sections.map(s=>s.label),['충남북부','충남서부','권역 구분 없음']);
 assert.equal(chungnam.sections[0].scopes[0].quantity,4);
 assert.deepEqual(chungnam.sections[0].scopes[0].include.map(t=>t.name),['천안시','아산시']);
 assert.equal(groups.find(g=>g.province==='경기').sections[0].label,'경기남부');
});
test('standalone directional headings supply category and context without a province-wide allow',()=>{
 const scopes=R.parseRows([['지역','수량'],['충남 북부:'],['천안, 아산','4'],['충남서부'],['서산 태안','3'],['충남:'],['공주','2']]);
 assert.equal(scopes.length,3);assert.ok(scopes.every(s=>!s.errors.length));
 assert.deepEqual(scopes.map(s=>s.region),['북부','서부','']);
 assert.equal(state(scopes,p('충남','천안시')),'possible');
 assert.equal(state(scopes,p('충남','논산시')),'blocked');
 assert.equal(R.categories(scopes)[0].sections.length,3);
});
test('an unsectioned mixed province policy does not invent regional categories or split quota',()=>{
 const scopes=R.parseRows([['지역','수량'],['인천/김포','5']]);
 const groups=R.categories(scopes);assert.equal(groups.length,2);
 assert.ok(groups.every(g=>g.sections.length===1&&g.sections[0].region===''));
 assert.ok(groups.every(g=>g.sections[0].scopes[0]===scopes[0]));
});
console.log('Policy category regression tests passed');
