const test=require('node:test'),assert=require('node:assert/strict');
const catalog=require('./korea-regions.js'),data=require('./korea-localities.js'),search=require('./consultation-location.js').core,details=require('./intake-details.js').core,rules=require('./region-rules.js');
const roots=search.buildIndex(catalog,data),index=details.placeIndex(catalog,data);
const names=value=>search.suggestions(value,roots).map(node=>node.label);
test('all imported legal localities attach to an existing exact parent with no omitted groups',()=>{
 const labels=new Set();let maxChildren=0;function walk(nodes){maxChildren=Math.max(maxChildren,nodes.length);for(const node of nodes){assert(!labels.has(node.label));labels.add(node.label);walk(node.children);}}walk(roots);
 let total=0;for(const [province,parent,places] of data.groups)for(const place of places){assert(labels.has([catalog.provinceNames[province],parent,place].filter(Boolean).join(' ')));total++;}
 assert.equal(total,data.count);assert(total>20000);assert(maxChildren<=100,'all children of a selected region fit in one dropdown batch');
 assert.equal(search.buildIndex(catalog,data),roots,'catalog is reused while typing');
});
test('initial-only search continues through province, city, myeon and ri',()=>{
 assert(names('ㄱ').includes('경기도'));assert(names('ᄀ').includes('경기도'));
 assert(names('경기도 ㅇㅊ').includes('경기도 이천시'));assert(names('경기도 ㅇㅊ').includes('경기도 연천군'));assert.deepEqual(names('경기도 이천시 ㅅㅅ'),['경기도 이천시 설성면']);
 assert(names('경기도 이천시 설성면 ㅈ').includes('경기도 이천시 설성면 장능리'));
 assert.deepEqual(names('경기도 이천시 설성면 ㅈㄴ'),['경기도 이천시 설성면 장능리']);
 assert.deepEqual(names('경기도 수원시 영통구 ㅁㅍ'),['경기도 수원시 영통구 망포동']);
 assert(names('세종특별자치시 ㅈㅊㅇ').includes('세종특별자치시 조치원읍'));
 assert.deepEqual(names('경기도 이천시 설성면 장능리 상담실'),[]);
});
test('editing address or an unfinished locality initial never reuses the previous policy decision',()=>{
 const snap={codes:[{id:'ga',label:'GA',aliases:[]}],clients:[{id:'legacy',label:'메타버스'}],policies:{p:{client:'legacy',carrier:'ga',kind:'general',rows:[['지역','수량'],['경기도 이천시 설성면 장능리 필수','4']]}}};
 const decide=value=>details.assess(snap,rules,details.resolveLocation(value,index),'general','GA');
 const location=details.resolveLocation('경기도 이천시 설성면 장능리 상담실',index);assert.deepEqual(location.place,{province:'경기',name:'이천시',path:['설성면','장능리']});
 assert.equal(decide('경기도 이천시 설성면 장능리').state,'possible');assert.equal(decide('경기도 이천시 설성면 자석리').state,'blocked');
 assert.equal(decide('경기도 이천시 설성면 ㅈ').state,'review');assert.equal(decide('경기도 이천시 ㅅㅅ').state,'review');assert.equal(decide('ㄱ').state,'review');
});
