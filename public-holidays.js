/* Shared Korean public holidays for calendar display; company workday and payroll data remain separate.
 * Official 2026 calendar: https://www.kasi.re.kr/kor/publication/post/newsMaterial/32031
 * Official 2027 calendar: https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431
 * 2027 lunar dates: https://astro.kasi.re.kr/kor/life/post/calendarData?search_year=2027
 * Labor/Constitution Day restoration: https://www.mpm.go.kr/mpm/comm/newsPress/newsPressRelease/?boardId=bbs_0000000000000029&category=&cntId=4250&mode=view&pageIdx=
 */
(function(global){
 'use strict';
 const verified={
  2026:{'01-01':'신정','02-16':'설날 연휴','02-17':'설날','02-18':'설날 연휴','03-01':'삼일절','03-02':'대체공휴일 (삼일절)','05-01':'노동절','05-05':'어린이날','05-24':'부처님오신날','05-25':'대체공휴일 (부처님오신날)','06-03':'전국동시지방선거','06-06':'현충일','07-17':'제헌절','08-15':'광복절','08-17':'대체공휴일 (광복절)','09-24':'추석 연휴','09-25':'추석','09-26':'추석 연휴','10-03':'개천절','10-05':'대체공휴일 (개천절)','10-09':'한글날','12-25':'성탄절'},
  2027:{'01-01':'신정','02-06':'설날 연휴','02-07':'설날','02-08':'설날 연휴','02-09':'대체공휴일 (설날)','03-01':'삼일절','05-01':'노동절','05-03':'대체공휴일 (노동절)','05-05':'어린이날','05-13':'부처님오신날','06-06':'현충일','07-17':'제헌절','07-19':'대체공휴일 (제헌절)','08-15':'광복절','08-16':'대체공휴일 (광복절)','09-14':'추석 연휴','09-15':'추석','09-16':'추석 연휴','10-03':'개천절','10-04':'대체공휴일 (개천절)','10-09':'한글날','10-11':'대체공휴일 (한글날)','12-25':'성탄절','12-27':'대체공휴일 (성탄절)'}
 };
 const special={'2022-03-09':'대통령선거','2022-06-01':'전국동시지방선거','2023-10-02':'임시공휴일','2024-04-10':'국회의원선거','2024-10-01':'임시공휴일','2025-01-27':'임시공휴일','2025-06-03':'대통령선거','2026-06-03':'전국동시지방선거'};
 const cache=new Map(),empty=Object.freeze({}),dateKey=date=>date.toISOString().slice(0,10),shift=(date,days)=>new Date(date.getTime()+days*86400000);
 let lunar;
 function forYear(value){
  const year=Number(value);if(!Number.isInteger(year)||year<2000||year>2100)return empty;
  if(cache.has(year))return cache.get(year);
  if(verified[year]){const result=Object.freeze(Object.fromEntries(Object.entries(verified[year]).map(([day,label])=>[year+'-'+day,label])));cache.set(year,result);return result;}
  const result={},groups=[],date=(month,day)=>new Date(Date.UTC(year,month-1,day));
  function add(days,label,substitute){groups.push({days,label,substitute});days.forEach((day,index)=>{const name=days.length===3&&index!==1?label+' 연휴':label,key=dateKey(day);result[key]=result[key]?result[key]+' · '+name:name;});}
  add([date(1,1)],'신정',false);add([date(3,1)],'삼일절',year>=2022?'weekend':false);
  add([date(5,5)],'어린이날',year>=2014?'weekend':false);add([date(6,6)],'현충일',false);
  if(year>=2026){add([date(5,1)],'노동절','weekend');add([date(7,17)],'제헌절','weekend');}
  else if(year<=2007)add([date(7,17)],'제헌절',false);
  add([date(8,15)],'광복절',year>=2021?'weekend':false);add([date(10,3)],'개천절',year>=2021?'weekend':false);
  if(year>=2013)add([date(10,9)],'한글날',year>=2021?'weekend':false);
  add([date(12,25)],'성탄절',year>=2023?'weekend':false);
  // Other years use the platform's Korean lunar calendar and current regular holiday rules.
  // Newly proclaimed temporary/election holidays are added to the dated list above when announced.
  try{
   lunar??=new Intl.DateTimeFormat('en-u-ca-dangi',{month:'numeric',day:'numeric',timeZone:'Asia/Seoul'});
   if(lunar.resolvedOptions().calendar==='dangi')for(let day=date(1,1);day.getUTCFullYear()===year;day=shift(day,1)){
    const parts=lunar.formatToParts(day),month=parts.find(part=>part.type==='month')?.value,number=parts.find(part=>part.type==='day')?.value;
    if(month==='1'&&number==='1')add([shift(day,-1),day,shift(day,1)],'설날',year>=2014?'sunday':false);
    if(month==='4'&&number==='8')add([day],'부처님오신날',year>=2023?'weekend':false);
    if(month==='8'&&number==='15')add([shift(day,-1),day,shift(day,1)],'추석',year>=2014?'sunday':false);
   }
  }catch(error){/* Fixed official dates still display if a platform has no Korean lunar calendar. */}
  for(const [day,label] of Object.entries(special))if(day.startsWith(year+'-'))result[day]=label;
  const replacements=[];
  groups.sort((a,b)=>a.days[0]-b.days[0]).forEach(group=>{
   if(!group.substitute)return;
   const causes=group.days.filter(day=>day.getUTCDay()===0||(group.substitute==='weekend'&&day.getUTCDay()===6)||(![0,6].includes(day.getUTCDay())&&result[dateKey(day)].includes(' · '))).map(dateKey);
   if(!causes.length)return;
   // Coinciding holidays share one substitute date rather than creating an extra day.
   // Compare the triggering dates, including a national holiday inside a three-day lunar holiday.
   const shared=replacements.find(replacement=>causes.some(day=>replacement.causes.includes(day)));
   if(shared){shared.labels.push(group.label);result[shared.date]='대체공휴일 ('+shared.labels.join(' · ')+')';return;}
   let next=shift(group.days[group.days.length-1],1);while([0,6].includes(next.getUTCDay())||result[dateKey(next)])next=shift(next,1);
   const nextKey=dateKey(next);result[nextKey]='대체공휴일 ('+group.label+')';replacements.push({date:nextKey,causes,labels:[group.label]});
  });
  Object.freeze(result);cache.set(year,result);return result;
 }
 function validDate(value){return typeof value==='string'&&/^(?:20\d{2}|2100)-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&dateKey(new Date(value+'T00:00:00Z'))===value;}
 const company=new Map(),monthLoaded=new Map(),monthRequests=new Map();
 function name(date){if(!validDate(date))return '';return [...new Set([forYear(Number(date.slice(0,4)))[date]||'',company.get(date)||''].filter(Boolean))].join(' · ');}
 function setCompanyHolidays(month,holidays){
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)&&!/^2100-(0[1-9]|1[0-2])$/.test(month))return;
  for(const day of company.keys())if(day.startsWith(month+'-'))company.delete(day);
  for(const [day,label] of Object.entries(holidays||{}))if(validDate(day)&&day.startsWith(month+'-')&&typeof label==='string'&&label.trim())company.set(day,label.trim());
  monthLoaded.set(month,Date.now());
 }
 function role(){
  if(global.CNCHOME_LIVE?.user?.role)return global.CNCHOME_LIVE.user.role;
  const context=global.document?.getElementById('native-session-data');
  if(context){try{return JSON.parse(context.textContent).user.role;}catch(error){}}
  return global.document?.documentElement.dataset.cncRole||'employee';
 }
 function loadCompanyMonth(month,force=false){
  if(!global.fetch||!global.document||(!global.CNCHOME_LIVE&&!global.document.getElementById('native-session-data')))return;
  if(monthRequests.has(month)||(!force&&Date.now()-(monthLoaded.get(month)||0)<60000))return;
  monthRequests.set(month,true);const controller=new AbortController(),timer=global.setTimeout(()=>controller.abort(),10000);
  global.fetch('/calendar-holidays-api.php?'+new URLSearchParams({role:role(),month}),{credentials:'same-origin',cache:'no-store',signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error('Holiday lookup failed');const data=await response.json();setCompanyHolidays(month,data.holidays);decorate(global.document);})
   .catch(()=>{monthLoaded.set(month,Date.now());})
   .finally(()=>{global.clearTimeout(timer);monthRequests.delete(month);});
 }
 const selector='.calendar [data-calendar-date],.calendar [data-sales-day],.calendar .sales-outside-month[aria-label],.attendance-calendar [data-attendance-date],.intake-live-calendar-grid time[datetime],.bc-grid .bc-day';
 function decorate(scope=global.document,refresh=false){
  if(!scope?.querySelectorAll)return;
  const months=new Set();
  const cells=[...(scope.matches?.(selector)?[scope]:[]),...scope.querySelectorAll(selector)];
  for(const element of cells){
   const business=element.matches('.bc-day'),time=element.matches('time'),cell=time?element.closest('td'):element;
   if(!cell)continue;
   const date=business?(element.querySelector('input[name="days[]"]')?.value||element.getAttribute('aria-label')):element.dataset.calendarDate||element.dataset.salesDay||element.dataset.attendanceDate||(time?element.getAttribute('datetime'):element.getAttribute('aria-label'));
   if(!validDate(date))continue;
   months.add(date.slice(0,7));
   const holiday=name(date),sunday=new Date(date+'T00:00:00Z').getUTCDay()===0;
   if(time&&holiday&&cell.dataset.calendarWorkday!=='open')cell.querySelectorAll('[data-calendar-department]').forEach(row=>row.remove());
   cell.classList.toggle('cnc-calendar-holiday',Boolean(holiday));cell.classList.toggle('cnc-calendar-sunday',sunday);
   const container=business?cell.querySelector('.bc-day-box'):cell;
   if(!container)continue;
   const heading=time?element:business?container.querySelector('strong'):cell.querySelector('.date-number,.attendance-date-heading')||cell.firstElementChild;
   if(heading)heading.classList.add('cnc-calendar-date');
   let label=container.querySelector('.attendance-holiday')||container.querySelector('[data-cnc-holiday-label]');
   if(holiday){
    if(!label){label=global.document.createElement('small');label.dataset.cncHolidayLabel='';if(heading?.parentElement===container)heading.insertAdjacentElement('afterend',label);else container.append(label);}
    label.classList.add('cnc-holiday-label');if(label.textContent!==holiday)label.textContent=holiday;
   }else if(label?.hasAttribute('data-cnc-holiday-label'))label.remove();
   else if(label?.classList.contains('cnc-holiday-label')){label.classList.remove('cnc-holiday-label');if(label.textContent)label.textContent='';}
  }
  for(const month of months)loadCompanyMonth(month,refresh);
 }
 global.CNCPublicHolidays=Object.freeze({forYear,name,decorate,setCompanyHolidays});
 if(!global.document)return;
 function start(){
  decorate(global.document);
  let scheduled=false;
  const observer=new MutationObserver(()=>{
   if(scheduled)return;scheduled=true;
   global.requestAnimationFrame(()=>{scheduled=false;decorate(global.document);});
  });
  observer.observe(global.document.body,{childList:true,subtree:true});
  global.addEventListener('focus',()=>decorate(global.document,true));
  global.document.addEventListener('visibilitychange',()=>{if(!global.document.hidden)decorate(global.document,true);});
  global.addEventListener('cnc:calendar-holidays-changed',()=>decorate(global.document,true));
 }
 if(global.document.readyState==='loading')global.document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof globalThis!=='undefined'?globalThis:this);
