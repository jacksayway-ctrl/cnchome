const test=require('node:test'),assert=require('node:assert/strict');const sales=require('./sales-workspace.js').core;
test('live status transition moves a record without duplicating team or date totals',()=>{
 const rows=[{team:'insurance',date:'2026-09-26',status:'pending'},{team:'insurance',date:'2026-09-25',status:'as'},{team:'cosmetics',date:'2026-09-26',status:'normal'}];
 assert.deepEqual(sales.daily(rows,'insurance','2026-09-26'),{pending:1,normal:0,as:0});rows[0].status='normal';
 assert.deepEqual(sales.daily(rows,'insurance','2026-09-26'),{pending:0,normal:1,as:0});rows[2].status='as';
 assert.deepEqual(sales.daily(rows,'cosmetics','2026-09-26'),{pending:0,normal:0,as:1});assert.equal(sales.counts(rows).as,2);
});
test('counting age uses the selected year, not whether the birthday has passed',()=>{
 assert.deepEqual(sales.ageKind(1966,'2026-01-01'),{age:61,kind:'general'});assert.deepEqual(sales.ageKind(1965,'2026-01-01'),{age:62,kind:'silver'});assert.equal(sales.ageKind(1957,'2026-12-31').kind,'silver');assert.equal(sales.ageKind(1956,'2026-01-01').kind,null);
});
test('weekly calendar includes the previous month for each configured starting day',()=>{
 assert.deepEqual(sales.weekDates('2026-10-01',1),['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04']);assert.equal(sales.weekDates('2026-10-01',0)[0],'2026-09-27');
});
