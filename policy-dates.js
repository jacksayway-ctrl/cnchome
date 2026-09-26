(function(root){
 'use strict';
 const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
 function day(value){
  if(value==null||value==='')return null;
  const date=value instanceof Date?value:new Date(value);
  return Number.isFinite(date.getTime())?formatter.format(date):null;
 }
 function describe(savedAt,now=new Date()){
  const date=day(savedAt),today=day(now);
  if(!date||!today)return {date:null,label:'등록일 확인 필요',freshness:'',state:'unknown',age:null};
  const age=Math.round((Date.parse(today)-Date.parse(date))/86400000);
  return {date,label:date.replace(/-/g,'.')+' 정책표',freshness:age===0?'오늘 등록':age>0?age+'일 전 등록':'등록일 확인 필요',state:age===0?'today':age>0?'past':'unknown',age};
 }
 function exampleDate(daysAgo,now=new Date()){
  return new Date(Date.parse(day(now)+'T00:00:00+09:00')-daysAgo*86400000).toISOString();
 }
 const api={day,describe,exampleDate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PolicyDates=api;
})(typeof window!=='undefined'?window:globalThis);
