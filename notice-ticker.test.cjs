const test=require('node:test'),assert=require('node:assert/strict');
const {mergeActivity,changedNotices}=require('./notice-ticker.js').core;
test('polling keeps ordered announcements without replaying unchanged entries as new',()=>{
 const one={id:1,title:'수량 감소',body:'4 → 3'},two={id:2,title:'수량 감소',body:'3 → 2'};
 const merged=mergeActivity([one],[one,two]);assert.deepEqual(merged,[one,two]);assert.deepEqual(changedNotices([one],merged),[two]);assert.deepEqual(changedNotices(merged,merged),[]);
 assert.deepEqual(changedNotices([one],[{...one,body:'변경된 공지'}]),[{...one,body:'변경된 공지'}]);
});
