/* Date-based grade calculation for one ordinary employee and one department. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.GradeCalendar=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const generalRoles=new Set(['general','상담원','일반직원','TM','TM 직원']);
  const isGeneral=role=>generalRoles.has(role??'general');
  function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='2000-01-01'&&value<='2099-12-31'&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
  function shift(date,days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
  function monthDates(month){
    if(typeof month!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('급여 귀속 월을 확인해 주세요.');
    const days=[];for(let date=month+'-01';date.startsWith(month);date=shift(date,1))days.push(date);return days;
  }
  const weekday=date=>new Date(date+'T00:00:00Z').getUTCDay();
  const workdays=month=>monthDates(month).filter(date=>weekday(date)>0&&weekday(date)<6);
  function week(date){if(!validDate(date))throw Error('실적 날짜를 확인해 주세요.');const start=shift(date,-((weekday(date)+6)%7)),end=shift(start,4);return {start,end,payrollMonth:end.slice(0,7),dates:Array.from({length:5},(_,i)=>shift(start,i))};}
  function validateRecord(record){
    if(!validDate(record.date)||!Number.isFinite(record.count)||record.count<0||record.count>1000000||!Number.isInteger(record.count*2)||!Number.isFinite(record.hours)||record.hours<0||record.hours>24||!Number.isInteger(record.hours*2))throw Error('날짜별 실적은 0.5건 단위, 시간은 0~24시간(0.5시간 단위)으로 입력해 주세요.');
    if(record.role!==undefined&&!['general','상담원','일반직원','TM','TM 직원','leader','팀장','manager','관리직','관리자'].includes(record.role))throw Error('직책을 확인해 주세요.');
    return record;
  }
  function distribute(month,count,days,hours){
    const dates=workdays(month);
    if(!Number.isInteger(days)||days<1||days>dates.length)throw Error(month+'의 월~금 근무일은 최대 '+dates.length+'일입니다.');
    validateRecord({date:dates[0],count,hours});if(hours===0)throw Error('하루 근무시간을 입력해 주세요.');
    const whole=Math.floor(count),base=Math.floor(whole/days),remainder=whole%days;
    return dates.map((date,i)=>({date,count:i<days?base+(i<remainder?1:0)+(i===remainder?count-whole:0):0,hours:i<days?hours:0,role:'general'}));
  }
  function calculate({month,records,entries=[],defaults,department='insurance',role='general',evaluate,signature=(policy,period)=>JSON.stringify(period==='daily'?policy.dailyCash:period==='weekly'?[policy.weeklyBasis,policy.weekly]:policy.monthly)}){
    monthDates(month);
    if(!isGeneral(role))return {eligible:false,month,reason:'일반직원 주·월 그레이드만 계산합니다. 팀장은 별도 서식으로 설정합니다.'};
    if(!Array.isArray(records)||!Array.isArray(entries)||!defaults||typeof evaluate!=='function')throw Error('그레이드 계산 자료를 확인해 주세요.');
    const ledger=new Map();for(const record of records){validateRecord(record);if(ledger.has(record.date))throw Error('같은 날짜의 실적을 중복 입력할 수 없습니다.');ledger.set(record.date,record);}
    const history=entries.filter(e=>(e.department||'insurance')===department).map((e,index)=>{if(!validDate(e.date)||!e.policy)throw Error('기준 적용 시작일을 확인해 주세요.');return {...e,index};}).sort((a,b)=>a.date.localeCompare(b.date)||String(a.savedAt||'').localeCompare(String(b.savedAt||''))||a.index-b.index);
    const at=date=>history.filter(e=>e.date<=date).at(-1)?.policy||defaults;
    function segments(dates,period){
      const groups=[];
      for(const date of dates){const policy=at(date),key=signature(policy,period),last=groups.at(-1);if(last?.key===key){last.end=date;last.dates.push(date);}else groups.push({start:date,end:date,dates:[date],policy,key});}
      return groups.map(group=>{
        const rows=group.dates.map(date=>ledger.get(date)).filter(Boolean),count=rows.reduce((sum,r)=>sum+r.count,0),hours=rows.filter(r=>isGeneral(r.role)).reduce((sum,r)=>sum+r.hours,0),allHours=rows.reduce((sum,r)=>sum+r.hours,0);
        const roleShare=allHours?hours/allHours:rows.some(r=>isGeneral(r.role)&&r.count>0)?1:0;
        const days=group.dates.filter(date=>weekday(date)>0&&weekday(date)<6).length;
        const calculated=evaluate(group.policy,period,count,hours,Math.max(1,days));
        const achievement=Math.round((calculated.achievement||0)*roleShare),extra=Math.round((calculated.extra||0)*roleShare);
        return {start:group.start,end:group.end,count,hours,days,roleShare,hourly:calculated.hourly||0,base:calculated.base||0,achievement,extra,bonus:achievement+extra};
      });
    }
    const monthlyRows=[...ledger.values()].filter(r=>r.date.startsWith(month)),monthlySegments=segments(monthDates(month),'monthly');
    // Floor the combined basic pay only once; a table change does not round each segment.
    const base=Math.floor(monthlySegments.reduce((sum,s)=>sum+s.hours*s.hourly,0));
    const monthly={segments:monthlySegments,base,achievement:monthlySegments.reduce((sum,s)=>sum+s.achievement,0),extra:monthlySegments.reduce((sum,s)=>sum+s.extra,0)};
    monthly.bonus=monthly.achievement+monthly.extra;
    const weeks=[...new Set(workdays(month).map(date=>week(date).start))].map(start=>{
      const info=week(start),parts=segments(info.dates,'weekly'),missing=info.dates.filter(date=>!ledger.has(date));
      const count=parts.reduce((sum,s)=>sum+s.count,0),bonus=parts.reduce((sum,s)=>sum+s.bonus,0),included=info.payrollMonth===month&&!missing.length;
      return {...info,segments:parts,count,average:count/5,bonus,missing,included,carryover:info.payrollMonth>month,fromPreviousMonth:start.slice(0,7)<month};
    });
    const weekly=weeks.filter(w=>w.included).reduce((sum,w)=>sum+w.bonus,0);
    const daily=monthlyRows.filter(r=>isGeneral(r.role)).reduce((sum,r)=>sum+(evaluate(at(r.date),'daily',r.count,0,1).bonus||0),0);
    const hours=monthlyRows.filter(r=>isGeneral(r.role)).reduce((sum,r)=>sum+r.hours,0),days=monthlyRows.filter(r=>isGeneral(r.role)&&r.hours>0).length,count=monthlyRows.reduce((sum,r)=>sum+r.count,0),salary=base+weekly+monthly.bonus;
    const rates=[...new Set(monthlySegments.filter(s=>s.hours>0).map(s=>s.hourly))];
    return {eligible:true,month,count,days,hours,hourly:rates.length===1?rates[0]:null,rates,records:monthlyRows,distribution:monthlyRows.filter(r=>r.hours>0).map(r=>r.count),weeks,weekly,monthly,base,daily,salary,total:salary+daily,calculationAmount:count*50000-(salary+daily)};
  }
  return Object.freeze({validDate,shift,monthDates,workdays,week,validateRecord,distribute,calculate,isGeneral});
});
