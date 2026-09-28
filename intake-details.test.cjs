const test=require('node:test'),assert=require('node:assert/strict');
const {birthInfo,placeIndex,resolveLocation,assess}=require('./intake-details.js').core;
const catalog=require('./korea-regions.js'),rules=require('./region-rules.js'),index=placeIndex(catalog);
const locate=value=>resolveLocation(value,index);
const policy=(rows,kind='general',carrier='ga')=>({client:'legacy',carrier,kind,rows});
const snapshot=policies=>({clients:[{id:'legacy',label:'메타버스'}],codes:[{id:'ga',label:'GA',aliases:['G/A']},{id:'hanwha',label:'한화',aliases:[]},{id:'shinhan',label:'신한',aliases:[]}],policies});
test('full birth dates retain counting age, exact age boundary and calendar validation',()=>{
 assert.deepEqual(birthInfo('1990','03','23','2026-09-28'),{age:37,kind:'general',birthDate:'1990-03-23',error:''});
 assert.equal(birthInfo('1967','12','31','2026-01-01').kind,'general');assert.equal(birthInfo('1966','12','31','2026-01-01').kind,'silver');
 assert.equal(birthInfo('1957','01','01','2026-09-28').age,70);assert.equal(birthInfo('1956','01','01','2026-09-28').kind,null);
 assert.equal(birthInfo('199','03','23','2026-09-28').age,null);assert.equal(birthInfo('1990','','','2026-09-28').age,37);
 for(const [y,m,d] of [['1990','02','29'],['2000','04','31'],['1990','13','01'],['1990','01','00'],['2026','12','31']])assert(birthInfo(y,m,d,'2026-09-28').error);
 assert.equal(birthInfo('2000','02','29','2026-09-28').error,'');
});
test('place resolution preserves districts and complete local detail while rejecting ambiguous place names',()=>{
 assert.deepEqual(locate('경기도 수원시 영통구 망포동 상담 카페').place,{province:'경기',name:'수원시',path:['영통구','망포동']});
 assert.deepEqual(locate('서울특별시 강남구 카페').place,{province:'서울',name:'서울특별시',path:['강남구']});
 assert.equal(locate('경기도').place,null);assert.equal(locate('경기도 수원시 영').incomplete,true);
 assert.equal(locate('중구'),null);assert.equal(locate('광주'),null);assert.equal(locate('경'),null);
 assert.equal(locate('수원시').place.name,'수원시');assert.equal(locate('경기도 광주시').place.name,'광주시');
});
test('policy assessment follows age product, carrier, numeric quota and explicit exclusions',()=>{
 const data=snapshot({general:policy([['지역','수량'],['경기도 수원시','4']]),silver:policy([['지역','수량'],['경기도 수원시','0']],'silver')});
 const place=locate('경기도 수원시 영통구');
 assert.equal(assess(data,rules,place,'general','GA').state,'possible');assert.equal(assess(data,rules,place,'general','G/A').items[0].quantity,4);
 assert.equal(assess(data,rules,place,'silver','GA').state,'blocked');assert.equal(assess(data,rules,locate('부산광역시 해운대구'),'general','GA').state,'blocked');
 assert.equal(assess(data,rules,place,'general','한화').state,'review');assert.equal(assess(data,rules,place,'general','미등록').state,'review');assert.equal(assess(data,rules,place,'general','').state,'possible');
 const limited=snapshot({general:policy([['지역','수량'],['경기도 수원시 (영통구 제외)','4']])});
 assert.equal(assess(limited,rules,locate('경기도 수원시'),'general','GA').state,'partial');assert.equal(assess(limited,rules,place,'general','GA').state,'blocked');assert.equal(assess(limited,rules,locate('경기도 수원시 권선구'),'general','GA').state,'possible');
 assert.equal(assess(null,rules,place,'general','GA').state,'review');assert.equal(assess(data,rules,locate('경기도'),'general','GA').state,'review');
});
