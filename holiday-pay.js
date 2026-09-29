(function(global){
'use strict';
function split(rate,weeks){
 let running=0,previousGross=0,previousBase=0;
 const rows=[...weeks].sort((a,b)=>a.weekStart.localeCompare(b.weekStart)).map(row=>{
  if(!Number.isSafeInteger(row.minutes)||row.minutes<0)throw Error('주별 인정시간을 확인해 주세요.');
  running+=row.minutes;const gross=Math.round(rate*running/60),base=Math.round(rate*running/72);
  const result={weekStart:row.weekStart,minutes:row.minutes,base:base-previousBase,holiday:(gross-previousGross)-(base-previousBase),gross:gross-previousGross};
  previousGross=gross;previousBase=base;return result;
 });
 return {minutes:running,baseRate:rate/1.2,holidayRate:rate-rate/1.2,base:previousBase,holiday:previousGross-previousBase,workGross:previousGross,weeklyBreakdown:rows};
}
const api={split};if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.HolidayPay=api;
})(typeof window!=='undefined'?window:globalThis);
