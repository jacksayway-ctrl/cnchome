const test=require('node:test'),assert=require('node:assert/strict');
const {buildIndex,suggestions,startsWith}=require('./consultation-location.js').core;
const roots=buildIndex(require('./korea-regions.js'));
const names=value=>suggestions(value,roots).map(node=>node.label);
test('province and city first letters and Korean initials narrow the same region hierarchy',()=>{
 assert(names('경').includes('경기도'));assert(names('ㄱ').includes('경기도'));assert(names('ㄱㄱㄷ').includes('경기도'));
 assert(names('경기도 ').includes('경기도 수원시'));
 for(const query of ['경기도 수','경기수']){assert(names(query).includes('경기도 수원시'));assert(names(query).includes('경기도 성남시 수정구'));assert(names(query).every(name=>name.startsWith('경기도 ')));}
 assert(names('경기도 ㅅ').includes('경기도 성남시'));assert.deepEqual(names('경기도 수원시 ㅇ'),['경기도 수원시 영통구']);
 assert(names('수').includes('경기도 수원시'));assert.equal(startsWith('수원시','수ㅇ'),true);
});
test('metropolitan districts, counties and identical region names retain their full parent paths',()=>{
 assert(names('서울 강').includes('서울특별시 강남구'));assert(names('부산 기').includes('부산광역시 기장군'));
 assert(names('중').includes('서울특별시 중구'));assert(names('중').includes('부산광역시 중구'));
 assert(names('광').includes('광주광역시'));assert(names('광').includes('경기도 광주시'));
 assert.deepEqual(names('광주시'),['경기도 광주시']);
 assert(names('경기도 수원시 ').every(x=>x.startsWith('경기도 수원시 ')));
 assert(names('경기도 ').every(x=>x.startsWith('경기도 ')));
});
test('completed leaf selections and free-form details are preserved without guessing a region',()=>{
 assert.deepEqual(names('경기도 수원시 영통구 '),[]);assert.deepEqual(names('경기도 수원시 영통구 상담 카페'),[]);
 assert.deepEqual(names('자택 방문'),[]);assert.deepEqual(names('세종특별자치시 '),[]);
 assert.equal(names('').length,17);assert.deepEqual(suggestions('경',buildIndex(null)),[]);
});
