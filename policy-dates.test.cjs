const test=require('node:test'),assert=require('node:assert/strict');
const dates=require('./policy-dates.js');
test('registration dates use the Korean calendar across UTC midnight',()=>{
 const now=new Date('2026-09-26T08:00:00Z');
 assert.equal(dates.describe('2026-09-25T15:01:00Z',now).state,'today');
 assert.equal(dates.describe('2026-09-25T14:59:00Z',now).freshness,'1일 전 등록');
 assert.equal(dates.describe('2026-09-24T00:00:00Z',now).label,'2026.09.24 정책표');
});
test('older dates remain exact over month and year boundaries',()=>{
 assert.equal(dates.describe('2025-12-31T23:00:00+09:00',new Date('2026-01-02T00:00:00+09:00')).age,2);
});
test('missing, malformed and future timestamps cannot appear as today',()=>{
 const now=new Date('2026-09-26T08:00:00Z');
 for(const value of ['',null,undefined,'not-a-date','<img src=x>'])assert.equal(dates.describe(value,now).state,'unknown');
 assert.equal(dates.describe('2026-09-30T00:00:00Z',now).state,'unknown');
});
test('examples have today, yesterday and two days ago in Korea',()=>{
 const now=new Date('2026-09-25T15:00:01Z');
 for(const offset of [0,1,2])assert.equal(dates.describe(dates.exampleDate(offset,now),now).age,offset);
});
