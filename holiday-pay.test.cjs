const test=require('node:test'),assert=require('node:assert/strict'),{split}=require('./holiday-pay.js');
test('one Monday at six hours still receives weekly support within 15000/hour',()=>{
 const c=split(15000,[{weekStart:'2026-09-28',minutes:360}]);
 assert.equal(c.baseRate,12500);assert.equal(c.holidayRate,2500);assert.equal(c.base,75000);assert.equal(c.holiday,15000);assert.equal(c.workGross,90000);
});
test('under, at, and above fifteen hours have no eligibility discontinuity',()=>{
 for(const hours of [1,6,12,15,18,30]){const c=split(15000,[{weekStart:'2026-09-28',minutes:hours*60}]);assert.equal(c.workGross,hours*15000);assert.equal(c.holiday,hours*2500);assert.equal(c.base,hours*12500);}
});
test('weekly rows sum exactly to monthly gross even with fractional minutes',()=>{
 const c=split(17000,[{weekStart:'2026-09-28',minutes:1},{weekStart:'2026-09-21',minutes:361},{weekStart:'2026-09-14',minutes:799}]);
 assert.equal(c.workGross,Math.round(17000*1161/60));assert.equal(c.base+c.holiday,c.workGross);
 assert.equal(c.weeklyBreakdown.reduce((s,r)=>s+r.gross,0),c.workGross);
 assert.equal(c.weeklyBreakdown.reduce((s,r)=>s+r.holiday,0),c.holiday);
 for(const row of c.weeklyBreakdown)assert.equal(row.base+row.holiday,row.gross);
});
