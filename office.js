(()=>{
const root=document.getElementById('tm-preview'), main=root.querySelector('#tm-main'), modal=root.querySelector('#tm-dialog'), body=root.querySelector('#tm-dialog-body');
if((window.CNCHOME_POLICY||window.CNCHOME_LIVE)&&!window.PolicySync){main.innerHTML='<p role="alert">정책 연결 파일을 불러오지 못했습니다. 새로고침해 주세요.</p>';return;}
GradeNumbers.bind(root);
const pageNames=[...new Set(['payslips','home','regions','attendance','sales','grade','as','adminHome','adminIntake','adminPending','adminPolicy','adminPerformance','adminGrade','adminAttendance','adminAs','adminStaff','adminSettings',...Object.keys(AdminWorkspace.pages)])];
function pageFromUrl(){const name=window.location.hash.slice(1)||window.CNCHOME_LIVE?.page||new URLSearchParams(window.location.search).get('page')||'';if(window.CNCHOME_LIVE){if(window.CNCHOME_LIVE.user.role!=='admin')return ['home','regions','attendance','sales','grade','as','payslips','myInfo'].includes(name)?name:'home';return pageNames.includes(name)&&(name.startsWith('admin')||name==='grade')?name:'adminHome';}return pageNames.includes(name)?name:'home'}
let homeStatus=null;
let page=pageFromUrl(),selected=22,noticeRead=false,cashReceived=false,outing='none',clockedOut=false;
const liveEmployee=window.CNCHOME_LIVE?.user.role==='employee';
const testEmployee=liveEmployee&&(window.CNCHOME_LIVE.isTestAccount??/^user[1-6]$/.test(window.CNCHOME_LIVE.user.username||''));
const performance={1:4,2:5,3:6,4:4,7:5,8:3,9:6,10:7,11:4,14:6,15:5,16:7,17:6,18:5,21:7,22:8,23:10,28:12,29:11,30:13};
const total=Object.values(performance).reduce((a,b)=>a+b,0);
if(!window.CNCHOME_LIVE){
root.querySelector('#tm-head-daily').textContent='6/'+performance[22];
root.querySelector('#tm-head-weekly').textContent='평균 6/'+Number(((performance[21]+performance[22])/5).toFixed(1));
root.querySelector('#tm-head-monthly').textContent=total<=60?'60건 이하':total<=70?'61~70건':total<=80?'71~80건':total<=90?'81~90건':total<=100?'91~100건':'101건 이상';
}
const names=['김예시','이예시','박예시','최예시','정예시','윤예시','장예시','한예시'];
const areas=['경기도 부천시','경기도 시흥시','경기도 고양시','충북 청주시','대전 서구','경기도 용인시','경기도 파주시','경남 창원시'];
const regions=[['부천시 · 시흥시','경기도','2 / 2','4 / 2','일반·실버 모두 확인','부천시 원미구 · 시흥시 정왕동'],['고양시 · 파주시','경기도','3 / 3','4 / 2','수도권 공유 수량','파주시 문산읍 · 고양시 덕양구'],['용인시 · 안성시','경기도','3 / 3','4 / 2','수도권 공유 수량','용인시 처인구 포곡읍 · 안성시 공도읍'],['충청북도','충청북도','3 / 3','1 / 1','대전·충청 공유 수량','청주시 오창읍 · 옥천군 옥천읍'],['대전 · 금산','대전광역시 · 충청남도','4 / 4','1 / 1','대전·충청 공유 수량','금산군 금산읍 · 대전 서구'],['창원시','경상남도','4 / 4','25 / 18','부산·울산·경남 공유 수량','창원시 의창구 북면'],['서울특별시','서울특별시','0 / 0','4 / 2','수도권 공유 수량','서울 강남구 · 송파구']];
const fmt=n=>n.toLocaleString('ko-KR');
const pill=(s,c='')=>`<span class="pill ${c}">${s}</span>`;
const table=(heads,rows)=>`<div class="scroll"><table><thead><tr>${heads.map(s=>`<th>${s}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(s=>`<td>${s}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const panel=(title,content)=>`<section class="panel"><h2>${title}</h2>${content}</section>`;
const stats=items=>`<div class="stats">${items.map(([a,b,c])=>`<div class="stat"><div class="sub">${a}</div><div class="value money">${b}</div><div class="sub">${c}</div></div>`).join('')}</div>`;
const colleaguePerformance=[
 {name:'상담원 A · 예시',color:'#db7c25',values:{1:5,2:4,3:7,4:5,7:6,8:5,9:4,10:8,11:6,14:5,15:7,16:6,17:8,18:7,21:6,22:7,23:11,28:10,29:12,30:14}},
 {name:'상담원 B · 예시',color:'#8657bd',values:{1:3,2:6,3:5,4:6,7:4,8:6,9:5,10:5,11:7,14:7,15:4,16:8,17:5,18:6,21:8,22:6,23:12,28:11,29:13,30:10}}
];
function graph(){
 const width=900,height=260,left=58,right=16,top=40,bottom=38,plotHeight=height-top-bottom,step=(width-left-right)/30;
 const peak=Math.max(...Object.values(performance),...colleaguePerformance.flatMap(c=>Object.values(c.values)));
 const max=Math.max(2,Math.ceil((peak+1)/2)*2),x=d=>left+(d-.5)*step,y=n=>height-bottom-n/max*plotHeight;
 let grid='';for(let n=0;n<=max;n+=2){grid+=`<line x1="${left}" y1="${y(n)}" x2="${width-right}" y2="${y(n)}" stroke="#dfe7f1"/><text x="${left-10}" y="${y(n)+5}" text-anchor="end" fill="#61738b" font-size="14">${n}</text>`}
 const bars=Object.entries(performance).map(([d,n])=>`<rect x="${x(+d)-step*.28}" y="${y(n)}" width="${step*.56}" height="${height-bottom-y(n)}" rx="3" fill="${selected===+d?'#1464ec':'#94bdff'}"><title>9월 ${d}일 · 나 ${n}건</title></rect>`).join('');
 const lines=colleaguePerformance.map(c=>{const entries=Object.entries(c.values);return `<polyline points="${entries.map(([d,n])=>x(+d)+','+y(n)).join(' ')}" fill="none" stroke="${c.color}" stroke-width="1.3" stroke-opacity=".65"/>${entries.map(([d,n])=>`<circle cx="${x(+d)}" cy="${y(n)}" r="4" fill="${c.color}" stroke="#fff" stroke-width="1.5"><title>9월 ${d}일 · ${c.name} ${n}건</title></circle>`).join('')}`}).join('');
 const dates=Array.from({length:30},(_,i)=>{const d=i+1,dow=new Date(2026,8,d).getDay(),holiday=calendarHolidays['2026-09-'+String(d).padStart(2,'0')],rest=dow===0||dow===6||Boolean(holiday);return `<text x="${x(d)}" y="${height-15}" text-anchor="middle" fill="${rest?'#c52c3d':'#61738b'}" font-size="12" font-weight="${rest?600:400}">${d}<title>${holiday|| (rest?'주말 휴무':'영업일')}</title></text>`}).join('');
 const targets=Array.from({length:30},(_,i)=>{const d=i+1;return `<rect class="chart-day-target" data-chart-day="${d}" role="button" tabindex="0" aria-label="9월 ${d}일 ${d>30?'집계 전':'나 '+(performance[d]||0)+'건'+colleaguePerformance.map(c=>', '+c.name+' '+(c.values[d]||0)+'건').join('')}" x="${x(d)-step/2}" y="${top}" width="${step}" height="${plotHeight}" fill="transparent"><title>9월 ${d}일: ${d>30?'집계 전':'나 '+(performance[d]||0)+'건 / '+colleaguePerformance.map(c=>c.name+' '+(c.values[d]||0)+'건').join(' / ')}</title></rect>`}).join('');
 return panel('9월 실적',`<div class="row"><span class="sub">A/S 제외 · 정상 실적</span><span class="pill">내 누적 ${total}건</span></div><div class="comparison-legend"><span><b style="color:#1464ec"><span class="ui-icon ui-icon-bar" aria-hidden="true"></span></b> 나 · 막대</span>${colleaguePerformance.map(c=>`<span><b style="color:${c.color}"><span class="ui-icon ui-icon-dot" aria-hidden="true"></span></b> ${c.name}</span>`).join('')}</div><div class="comparison-scroll"><svg class="comparison-chart" viewBox="0 0 ${width} ${height}" role="group" aria-label="나와 다른 직원의 9월 일별 정상 실적 비교, 왼쪽 축은 건수"><text x="8" y="18" fill="#61738b" font-size="13">건수</text>${grid}${bars}${lines}${dates}${targets}</svg></div><div class="legend"><span>9월 · 날짜</span><span>9월 ${selected}일: ${selected>30?'집계 전':'나 '+(performance[selected]||0)+'건 / '+colleaguePerformance.map(c=>c.name+' '+(c.values[selected]||0)+'건').join(' / ')}</span></div>`);
}

// September 2026 official holidays, verified against the KASA calendar announcement.
const calendarHolidays={'2026-09-24':'추석 연휴','2026-09-25':'추석','2026-09-26':'추석 연휴'};
function calendar(){let cells="<div class=\"day sales-outside-month\" aria-label=\"2026-08-30\"><span class=\"date-number\">8월 30</span></div><div class=\"day sales-outside-month\" aria-label=\"2026-08-31\"><span class=\"date-number\">8월 31</span></div>";for(let d=1;d<=30;d++){const holiday=calendarHolidays['2026-09-'+String(d).padStart(2,'0')]||'',dow=new Date(2026,8,d).getDay();const pending=d===22?2:0,asCount=d===22?1:0;const color=holiday||dow===0?'day-red':dow===6?'day-blue':'';cells+=`<button class="day ${color} ${d===selected?'active':''}" data-day="${d}" data-calendar-date="2026-09-${String(d).padStart(2,'0')}" aria-label="9월 ${d}일, 가접수 ${pending}건, 정상접수 ${performance[d]||0}건, A/S ${asCount}건"><span class="date-number">${d}</span>${pending?`<small class="count sales-status-pending">가접수 ${pending}</small>`:''}${performance[d]?`<small class="count sales-status-received">정상접수 ${performance[d]}</small>`:''}${asCount?`<small class="count sales-status-as">A/S ${asCount}</small>`:''}</button>`}cells+="<div class=\"day sales-outside-month\" aria-label=\"2026-10-01\"><span class=\"date-number\">10월 1</span></div><div class=\"day sales-outside-month\" aria-label=\"2026-10-02\"><span class=\"date-number\">10월 2</span></div><div class=\"day sales-outside-month\" aria-label=\"2026-10-03\"><span class=\"date-number\">10월 3</span></div>";return panel('나의 실적 달력',`<div class="row" style="margin-bottom:12px"><span>2026년 9월</span><span class="sub">날짜를 선택해 상세 내역 확인</span></div><div class="calendar">${['일','월','화','수','목','금','토'].map((x,i)=>`<div class="weekday ${i===0?'weekday-red':i===6?'weekday-blue':''}">${x}</div>`).join('')}${cells}</div>`)}

function dayRows(){const n=performance[selected]||0;return panel(`9월 ${selected}일 접수 내역`,n?table(['고객명','전화번호','지역','상태'],Array.from({length:n},(_,i)=>[names[i],`010-****-${String(1200+i)}`,areas[i],pill('정상 접수','green')])):'<p class="sub">이 날짜에는 표시할 접수 내역이 없습니다.</p>')}
function gradeTable(){if(gradeEmployeeDepartment()==='insurance')return gradeOriginalMonthlyTable(gradePolicy);return `<div class="scroll"><table class="grade-table"><thead><tr><th>정상 실적</th><th>시급</th><th>달성 수당</th><th>현재 구간 추가 수당</th><th>현재 내 구간</th></tr></thead><tbody>${gradePolicy.monthly.map(row=>[gradeRange(row,'monthly'),gradeMoney(row.hourly),gradeMoney(row.achievement),row.extra?`${gradeNumber(row.extraStart)}건부터 ${gradeMoney(row.extra)}/건`:'—']).map((r,i)=>{const current=gradePolicy.monthly[i]===gradeCalculate(gradePolicy,'monthly',total).row;return `<tr class="${current?'chosen':''}">${r.map(c=>`<td>${c}</td>`).join('')}<td>${current?`<span class="my-grade-position" style="margin-left:0"><picture class="grade-runner-picture"><source media="(prefers-reduced-motion: reduce)" srcset="data:image/png;base64,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"><img class="grade-runner" src="data:image/gif;base64,R0lGODlhQABAAIcAAP////7////+/v7+//7+/v3+//3+/v/9/f79/f/8/P78/P39//39/v39/fz9/vz9/fr+//z8/vv8/vr8/vv6/Pn6+/n5+vj5+/f5/Pf4/Pb5/Pb4/Pb4+/r29/X3+/X2+PX19/T1+PP2/PH1+/D1/fD0+/Dz+O/0++/z++7z+u3z+/3u7uvv9+nv+eju9/Lo6+Tr9t3n9dfi9NXf79Pf8dDe8vnU1PnOzfnNzNLc7c/d8c3b8cza8MzY68PU7sPS6b/P6LvN6faysPSpqLbH4vOnprTI57LE4LHE4LHD4K/F6K3A363A3qzE56fA5am+36a94Z+33Zqx15Sz4Zav1ZGw34qr3Ymq3Yym0Iikz4Wo3IGl24Sk1YSj04aizYShznyh2YSgzoOgzoKgzYKfzX2f04CezICdy3+ezX+dzH6czHyby3uay3id1HqZynmZynWc13CZ1vGYlvCLifCBf+xraOdmY+pfXHiYyXeXyXeWyXaWyHaFl3WVyHSVyHSKqHCX0HKTx2+TynGJqHCDmW+CmG+AlWuU0WmU02iT02WR02GO0WCN0FqGyW5/lVeJ01aGzlOEzUt+y2t8kml6kUN5yFVtilRqiExgeD91xTVvxDJuxjFrwidkv+dJRuZDQOU9OeU8OOQ8OOg7N+U7N+U6NuU5NeQ5Neg4NOU3M+U2MuQ1MeQyLuQxLOQvK+QuKuYrJ95EQt09O+MtKOMrJ+IrJ+IhHKxES0Vbd0Rbd0RadkFae0FXdDlTeT5ObCtQgkJNaDxLaSVjwCRjvyRivyNivyFhvyBfvR1evR1dvhxdvhtdvRtcvRpbvRlbvRlbvBlavBhavBdavBdZvBZZvBZYuxVYvBVYuxVXuxRXuxNWuxJVuhFVuxFVuhBWvhBUuhBUuQ9Uug9Tug5Tuw5TuQ1Tug1SuQxSuQxRuQtRuQtRuAtQuApQuAlQuAhQuwhPuAhOuAhOtwdOtwdNtwZNtwVNtwVMtwRMtgVLtgNLtgJKtgFKtgFJtQBItQBFtABDsyH/C05FVFNDQVBFMi4wAwEAAAAh+QQIBgAAACwAAAAAQABAAAAI/wABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsWKDBwAUJDggoGNGAgQsUJoEoWCCkSVNSiQw4IIlYHboFLmxwuBLkjIJGpDAgIEEAwQZAOADbBWsWqw+3dHJM+hBpQWxAlBaCJisUaJKqWo1i1bUqUNwvFAQVGkMLZEiaYmxVaBSQl5RnTJVilSoUGJZubLlSk6HAyaVOpnGDx48ftOc1L2bd6+py3xBpXpVx0ZbADrMhWs2bVqzcOZ0bKUsSy9mU6FM0fIkRCBikw4GQKL3LJvvbM/oQRrggLVrvqFeqZrTU8DtjgMAjBD27drvbNe+CRsBACTe1ntDrf+i1VlgAqvRURjrZv33tW7GUHQH8B2VKNm0zce0arRSu2nXTdNOJUSxNopyzAHgnFUEOQCAEvpMI80110gzjT5KAFAcfV7BUh4A5zGYFQBw9FPPN9+8ow8ck3GYH4j7bWSAVgc5GAQkwnQiSRN11VUILy8AgMBzHAXgkAwybMAdANHZBYAhuWiQAAEyRTfDD0waWZADDsCRzz1gACCBgwMpZYguIABAZUdIzYBHIEkAYICWAkkAQA33UEPNPTQQl9STunygZmIA/BCIF33EOadASJnQBjrTREOPFmImNYAjuoQwqEkDDHCEH2EkyiRSAOSARSbjVIPNNer4oOFAESz/pYsFm3IKQBJ9hBrnVkS48cYx3GA3DTnCtDBAAZWSYIkuLMgZVABI4RqGH0e4IIUfWTRSTjXZfENOM/ZEIqadIjzySy+HvPpstH2QwUYabKhxBiflQIMPHHHwk8w+VggEBCfu7BJMumSue2u7ZLjhxRPOaEMNOzRowAmk5xixRTzgePMLJi44yyC0t/qhBxYsTJFPM+tkogEAO4hjXTjsSHPPJpdgIuiaH0dHRBQbAKCJOs3oMwUAGAAwhT7MPNPNPIyowAcvmuIsIkE+pDNNN8i0AMACdi7iDz3C8AgApjdPPRABEwyQCD7M0PNIXZ2WkEgiWqd9ZtlmA4AsCsts/yNpEOpueRcueJvNwABxyAPNOZpgQACdxOVGkwWXQF2riA7yMI810eizRaUHoaTSJBVIjTkAPLBDzTXi7BA4Qg3EmneZAywSjzbDiMDk7BDZWYU+2RRzwu68O2TnFfkEXwLxxTNkpxXJF7N8k80v9Hz001fvPADIK8+89ghNAMDv2QyTPfgIDWDAAJWgkw0yKXyP/kAB2BnHPc+M08kRPc5PkJ1g6EfDoiEIPPCPRvOzExTeIY1spKMRXkDDHnrQP/TZyQj2qFA8nDCDPJDBDHnIQQWr5yAdKKMbz/BHmAAAhECMQQ1mgIGGGGCARfFOKTBIhjmewY7PEQUASMiDGKjWIIaOaU99KfBPNLLRjTikoAAFiE4UQIUHKgABCExgAgcAQKfTIYIfzFhVNP6RCA11igNUeMMX1rCHPbwhEEvQW94chIh/aANF2fAHIl4VHQ9kwQ9qSEMazABHOZqtUylAhDGIIQxlLOKJTUKKC56QhUp+4QkcGEAX8zaCE5QgfgbREgYygIEtVs9PA4miQdRHEE0esVPUO0gAZrlJ/9nylrjMpS7zFhAAIfkECAYAAAAsAAAAAEAAQACH/////v////7+//79/v7//v7+//39/f7//f7+/f3//f3+/f39/P3+/P399v3///z8/vv7/Pz+/Pz9+/z++/z8+/v8+vz9+vv++vv9+fv9+Pr99fj79vf59Pf89Pf78/f89fb48/b69PX38/X48fX7/fLy8PT77/P79fDy6+/3/Ofn6vD46e745ez24ujx3ef18+Hi3OXz2+Pw1+P11uH0097x79Xazdruzdjrytfsx9fvxNXuxdTrxNPrw9Hov9Htv87mu8znucnjt8jjtcrptcbhssTgscTgscPgrcTn9r699bKw86Oipb7lobzkpbnbnrrknbbem7PXmbbhl7ThkrDfjavYh6nciqfTiaXQiKTQhqLPkZ6uhaHNgKPXhKHOg6DNgp/NgZ/Ngp/LgJ7Mf53Mfp3MfpzMe53QfZvKe5vLe5rKe5nJepnKeZnKeZjJeJjJdJnQb5jV8JCO7n587XFv62BdrYKadpfJdpbJdZbLdZbIdJbIdZXIdJXHc5THc4Wbc4OXa5LOb4qwcIOZb4GWb4CVbn+VYI7SW4rPWIjOXYbHV4XKVIXOUoPNUYLMUYHJT4HMTH/KXHmiSHzKRnrHRHrJP3XIOXLGQGurUGJ5Mm3FSl55P16I6E9L5j875j465Tw45Dw46Do25Ts35To25Tk15Dk16Dg06Dgz5Tg05DMv5DAs5y8r5C8r3UA+3T074DQx4ywo4ysnkEdTRFt3RFp2RFh0QVd0MFODOU5uQk1oQ0xnLGnCKWbBJWPAIWG/H1++HV2+HF29G1y9Gly9Glu9Glu8GVu8GVq8GFq8F1q8F1m8F1m7Flm8Fli8Fli7FVi8FVi7FVe7FFe7E1e7E1a7Ela7Ela6ElW6EVW6EFW7EFS6D1S6D1O6DVO8DlO5DVK6DVK5ClK9DFG5C1C4ClG5ClC4CU+4CE+4CE+3CE64B064B063B023Bk64BU23BUy3BUy2BEy3BEu2A0u2A0q2Akq2Akq1Akm2AUq2AUm1AEi1AEe1AEW0AES0CP8AAQgcSLCgwYMIEypcyLChw4cQI0qcSLGixYsXESDAyPGhgI4gDRYA4MIFgAIPHnwMybEAAQ6aNMEomHIly4UEGDAgULAAhUO8XtmZo0QFTZU3DQZgQJBBgIEKAADaBavVLFefhhYlKMBA0oIfduz4UDAqIaqjRJFSxepqVqJGvwIgQCCDl1/lyv3ykoEuALNUUZ0yVYpUqLVtWX3yxKSETZAKJijqx82ZM279FE2IChiWYFOgQZcCBYqVKjowDDzmOAHAFH7GoFGjBs0YvykANgM463lwaMOuXKGWG9nSOWazZzM7Z2lz58+EQ62aVUeJQKQseZ4Ipk1acmrStAX/OwGgwe7Ag6XL8rREoAGvSXl26OXNe3Jp3np1KH/esyhVsnzCBAQAdCWXQBEAIMg9xnxnzD2CABABYK+gIospc5Rw3YEDJUBADdSIYwwzzBgjDjU1EJAAYLGkMhwAD3BYFgBEINNPO+rsIwwRf/VICC912HDdahcFUMBICjEVghONOFJFCwAw1WMhtzgAAAQDyHgQTyZM4cQBA0nZoyG1iGAAkiA9tcETRcz1VEE5aUCJP/9UQkIGUUEFgCG2gHBSdgA88cceSMxV0EY0zlNMMffoECVBUfHpJ5od8TTEH2AQ2uNcPJFQxCLdQMMMOojkBukBh9gywp8sPQVEG2L4/zFElHnioEUamIQjzTTK6INbawJVAEAgtghLKUg84eCGGG7gIFAKUeRRhh7KXCPNNeB5c0OPFwAwQye41LDpTUzx4IcYcODAQxhtrNEFI+Q0k80wzEhDTi8mMLDRDZvkogsjj34V1RF7iLFGG2fAoYUMkqRjTD5UTNGPMPWUesAV2XzTiS5WBPzVSEjg0cUZaxixAQ3kREMNNi8A8Eg8xLTjRST7NDNOLppMemAAPEnxxxYyCCQHPTE/woACK/wCjjLugCMNPogcwokIrMrFkwZCQMlAB76Ak0w8SQCgAQA/HDcMOsbgFsgtOmspEAYAJBFPMuD40gFdrV3xjzyPtP9MQKptcxiAAjkR8Eg7xNAjh4QCRdWEEwJlsGefVcsYVQzaUPOMONuKOVAAB0QVSC2Bc0gAAhtQcg4y6VQSekE6nfQSJ7hQfaxcTO1QjzLL0EOFqQgVIAEXXEhwu1wb0aCNNcyko8NSbkO0EQ+SVKNMPIt7ftACC0QPAM8WYAHGJt1gUwwLhnq/0EYy5LHFIuYUY8/vwKqfEE9PvHFGFuSLg4kGBXiT/QyyERacQQx/8AEU9EGMeAQBegM0SFSEsAcwwIEFJ0AGNdiRiHFFUCBqyoIZ3vCEjcjBHc9wxgwAAKYPNg4APuDDF/BgBIHowB3E2McVgOdC9sHhDGHIgxHQMCCJchDjHk3wmAuTpYY0kIEMkEDHMfThCAVEgCcuHMhGXBCGMUDiHcg4xyVM8LksahEAKRCEOJRRDWv0AAMecEEIzBgmALQAGNx4RjcWkYUtaGENWUhB+j7IpUusIxnhqEQWzlCGMnzhD0DwoP1OZwJLzEMZsxnGItjQhzz4IZCDHGBrquCPYDiDGcrYxjGGAIRWzlGAEWTKD9ABj3S04xz+aERBYElIAOxAEZFwBCXQQAKdKIBwdBQIFpPJEJ0g4Jg7YaY0p0nNalrzmt4LCAAh+QQIBgAAACwAAAAAQABAAIf////+/////v7+/v/+/v79/v/9/v7//f3+/f3//Pz+/Pz9/f/9/f79/f38/f78/f36/v/8/P78/P37/P77/P36/P7++/v++vr6+/35+fr4+fz2+fz1+fv7+Pj29/r1+Pv19vj89PT09/z09vr09fjx9fvw9fzw9Pvv8/vu8/rt8/vu8vn07/Lq7/fp7vfo7fbz6Orl6/X7397i6vbe5/bc5fHW4fPU3u7R3e/Q2+zO3PLN2e3G1OrE0ujE0ebA0e2+z+m5zeu2y+royc+2yum0yemwxOOvwd+twN+qwuf2trX1srD0p6Wmu9uht9met9yftdmds9eYteCZsNaSrdeRq9OLrN2PqdOMptCIqtyHqdyGqNyIpM+Ho86BpduFos6EoM6DoM6DoM2CoM2Dn8yCn815n9iBns2AnsyAncx/ncx+ncx+nMt9nMt9m8t8m8t2nNXylZLtdXJ8mst7msp6mct6mcp5mcp5mMp4mMl4l8p3l8l2lsl2lsh1lsp1lsh1lchzlcd0iqlyhJl0g5Zwg5lul9VrlNFplNNok9NqkcxhjtFgjdFaitFchsZVhs5vgphvgJVuf5VrfJJpepFVhc5Thc1NgMtEeslCdsQ/c8HrZmTpV1PoTUnlPDjoOzjlOzfkOzflOjblOTXkOTXoODTlNjLkNDDkMi7kMCzkLyvmKybeSkndPTvjLyvjLCjjLCfjJiKaUl1Sa41NY39DXHxFWnZEWnZCV3RDTmlCTWhBSmY3ccUwbccvasIlY8AkY8AkY78jYr8eX70dXb4cXb0bXL0aXLwaW70aW7wZW7wZWrwYWrwXWrwXWbwWWbwWWbsVWbwWWLwWWLsVWLsVV7sUWLsUV7sUV7kTV7swUH0yTHATVrsSVroSVboRVboQVr4QVLoQVLkPVLoPU7kOU7oOU7kMUrkMUbkLUbkLUbgLULgKULgIULsIT7gHTrcHTbcGTbcFTbcGTLcFTLcFTLYETLYFS7YES7YDS7YCS7YCSrYBSrYBSbUAR7UARLQI/wABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzamTY4AEABQcEbBxJgEAGSpMgDDyQ4MDIiAMGFCQwIMOsXZviDAlBsKXIlwkdOBAolCADAINynVqVqpOcJTIIsnQJ1KhAEyYEHtUKAJKuVp9CnXr1SlTOnVUNDi1S6devSkUADAVwtNDXUqREefI0KhWspk9ldKD68qiWevHChYtXTwvdx3Zb4R1FeRQoT6BMqYqVKk6InxuHCqFHjRm10tToCZFb9y6pypQvo0K1aciFqg4GPIrH7Jrva8ziPRrgoLXk17E9oXrFSUlaADJLBAtH7fc1auGClQDgMfJk2cyXWP8AcIDwyOjTq//Grp07AO96l3MSL9A80Ny7e/8OPrz4+6+fmALLfOMBkMBzA4lGmmmoqcbae7m0skoncRR4IIJWabEPPoox5thRde3CShwsCHShRgZspdBQPzAiDDBwycUVJLjAAEAAJ2oUAEQ22LBBVo9xFcktHCSAwEsy3dADdAgFMMEAcOSDjxkAVDCXkLeAAAABIxkAwA16BGJEkAQZ4OUO9DzzjD02EGfVkFpyudFRPQTyRR87kEmTXD4oMg40wW0BwARGDSDJLSRs+RJNR/whxh450DWAlwDgcAUbmZQzTTXUqPODjAJFAAAhtmSg6Eg7YjAFHmigEcNANUD/QYcddQzzzXXOmPNLCwMUMCgAJsxySwsAUHoeABpUYccaYriwAhJv2MEHFoqkM8014ZiDDD2WDEroCI1os80hoL7kpQthsDEHFl/sQQcdUbSwCD3I3AOHIf0Qw48VAv3gSzu1jFuuuQDEgIYaaURbRaQzTMPNM+z46As6zpxDhBfviAOONra8UOxzR+WQxx5j8DBUAFnkg8w6vGwAgA7kVDcOO83Y08sstMSJYMhTvEqAAxPwgg4y+0iBLABS7GOMMt/Aw4gKhOCiM4IyCWTAUDyk48w3w7gAwAKELvJPPL8kIdChUyNYkkwRDJAIPsbE08hjMZ2QSCJeYzAAnKdi/yiQrygY401wQQyc4FGD2JK23wwwYMg7y5zT8p4CEZcbTTbhkqicfuemwzvRMLOPoIQeVNJJk2TAud+EEjGPM86sg0kBuSnUgAR+lwnAC1xooikz+cDxa+4NBTAABlTk0YUj6ljjjD5ml068Qkc1GgYfTkjBWzfT6EDm9AYdxQMgZbShhsf4FsOOLydQDr7uM7yhxhl5RFrBB5m4U0w+jAz/vkA7+gAX5lAGQBCBLkeZATHGYYx+8OtK4DPeB6ZwhzHkYQop2hGhivCOazxjHZ+CIPF8hYRAjMENXKDApAZCKCu4AxnymJsIcycTJPwhDPPjgdVkQjsacMMZ77jE99iItyMRYKEPZVDDH5rwAaJQAACWeMcx3mG2GeZuRyNwwh/QUIY+XAEKULhCFKSQDmXIo1sq+l/VgGCHOYDBDXa4Axv8gI1scAMZNCCAsf4HHZnUgAuAwIMd9ECGTCXDH/wSFR8L4qUR9MAJUWjCGtDBDHYIkUmLnAlBRIAJrX0DE4ZYQUwyWZABMECFiegHMq4hjXD8AxGGIyUARIWIf3BDMdLwByytmMmYpAARwhDGL4qxiBQUoGqyPEgJTnCCFCRTIW4ayDGfmZCYjJKa2MymNrfJzW7yMSAAIfkECAYAAAAsAAAAAEAAQACH///////+/v///f////7///7+/v7//v7+/f7//f7+//39//z8/vz8/f3//f3+/f39/P3+/P39/Pz+/Pz9+/z++/z8/vr6+vv++fr9+fn5+Pr9+Pn89/n8/Pf39/j59vf59fn89ff79Pf89fb49PX38vX68fX68PT77/P77fL67fH46e/56e745u345ev15Ov29+Tl4ur14uXq+97d+t3c4er23+n23eb03OXz2+Tx3OPw2eP01+Lz09/y0N3x0dvsz9zvzdrty9rwzdjrzNjr7M3SxdbwwtLsvtHttsvqt8nls8flscPgr8LfrsHfp8Dlpr/l9bOy9aKg86Khza28orzkpbrbobfZn7bZnrXZmrbinLPXl7HZj6/fkazXjazaiqjXiqXQgabchqLPhKHOg6HOf6PafaLZfKHZkZ2ug6DOgqDNgp/NgZ7NgJ7MgJ3Kf57Mf53Mf53LeZ7W8ZKQto2jfZzLfZvLfJvLe5rKe5nKeprKepnLepnKeZnKeZnJeZjKdJzXeJjJd5jJdpfKdZbIdJXIc5THdYWacJnWcpTHcZLHaJPTZ4u/WonPWIjOVoXMcIOZUoPNcYKXb4CVboCVbX+UXXmhTXvDR3zJRnvJQXfIQHfIPXXH7Ghm62Ng6FJP5j055Tw46Ds35Ts35To25Do25Tk15Dk16Dg05Tg05DIu5DAs5Swn3ktK3T073Dc14ywo4yolT2R9RVt3RVp2RFp2RE9qQVt+Q1FtQk1oQEllNm/FL2rCLGnCLGjAKmfBKGXBJmS/I2K/I2G/ImG/IGC+H1++HV6+HV2+HV29HF29HFy9G1y9Gly9Glu9GVu9GVu8GVq8GFq8F1m8Flm8Fli7FVi7FFm/FFe7E1e7NVF3IFOfEla6ElW6EVW6EFS6D1S6D1O6DlO6DlO5DlO4DVK5DFK5C1G5C1G4CVG8C1C4ClC4CVC4CU+4CU64CE+5CE+3CE63B063Bk23BUy3BEy3BEy2A0u2A0q2Akq2AUq2AUm1AEm1AEi1AEe1CP8AAQgcSLCgwYMIEypcyLChw4cQI0qcSLEiwQcPLGqkuEDBxo8ID1RIk2aAwAIdQao8YGDErF2fpMwYiNKjyoYIKDhwQAEBQQcAEN2C1QrVpykzT6a8iRCCQacCgUbS9WoUKlaxTh1NCqAmU4JOY3SRJKlLDABQpVJNhYqUqFNYtSL9WhBoEmX84sXjpywJAKBqX7E9Rdgt3FikPEkpYqEA0wYGemQz94watWfmsvUw0CDwYMKES4UKtUoWKSkdHN+UAICRvmfZYmd7po8RAAmeUYE+JaoUVlBROtA1AECEL3HXZGe7Js6XCAARAEwVrJs3KVarPkWxINDmTeIojn3/Sy772rdjKKBLX4tKlKpYqzwVGbhA9VeemthRU06NnSadgVkVSynyKWUfXRQAoIU/z1gTmzXP+KMFADqtR5QpdNBwknd0/UTBI/+EU0014PzzSIVS7eIKHUkttZEACTBkgAEcmBFMPOsIcwYGM/4FwCS5wNAdhx0eRBwAKwBxxHM/AUAJLSAswMBNAgCgAQ4AHIlQglAUE8wSAkFQZVRO2kICAAeoJIABImyxCJgxGpQAcTeQYw465tzgQJxkUmLLCGiqFOMNi5RRCBE+DsQShT8QYs400NhTBYVNVvJnoCtB0EQhawiCZYyLAjCEF29gMo415hljgwBAkTnJpWmq/wnABVzsEQcZLKAlUA5ZCALIHcKEs1w09GgCAQTEIcCaJbR4gKlKxIUwhh19eMEBADlgkUcfgoQxxzjXXGOOOc3sgwaFUImxzTZf6MpUjC64EYcgW1jRhx995JFFCYHg88w7kmQizzP0+IUkI+rgsg0k7r4LwA9/sIGHH37kgUUOAJwwDDjT1GNEDdpk800yNiRBzDzYbGPLD4l+5dQRisRhMcZZVoEPNOT8kh4UN5MTDDjflIMNLrNk8Ox9ADARB6JZspaJO83oc4aVACSizzLeVFNPL0YgYubRHV5rQAJA7RByNtrsgC4IneAjTjqBlACAJbAWKVCVRyZohj7NuP+TiY9A8dALL0gAEAAEfgIaq91jzogBMORAg8+kCWaJFmsQsPaq4nYX5JQW80wDTjEpEKClT7oeMIEltZy5eOcJHGBDN91Ig88clBIkQJUsfTDLLB4Y8LrdCT5RDzTTzGMbsiEBIIMMlncepqiA/AKPN9HgkwhaWkq/UIxEDMIGH5gYc44z/WxvAOpy8sl4mkf44QYcg+jQwzLmLMNPIkCx731BMEraIdhgB0EwzQfLQAcz7qGJE7TsfwIZW9IMoQY8uCEIf0mQD4bRjmTggxMObBUEx8QECuahDC5IlFNWsAl7IMMeIIye99a0ASdwyg9qSCFUpneCFiLjHptIQY//vGcAB1zhEGuwQxh0KENdnYAT9UhGPyBRxBkCAANjuAMbBKGEgWDAIEA5QSfOUQ1r1AAA/isScX4wCDu0IQ9cwEIWxqCENRGENZKARzaQ8QI0/i9NQXADHtSwrT7IwRBniVMDAIADb1BjHo54oPSA8gIyGKIPfdBDIcJgAgCMKUFa0Acz8vGE3EEQKCpwQhaukAUrqMCTAzHABcbYjWGwwAHd+18unwIAIaBDcriDJQRjOacZzYkgesvHM9IBhi6obZfDNAhxWiCM8VwjHP4IRguGGM2m9JIf2aCGNSDVDyE0rJsHQQACzAAOd6zDHewww/rQ2RAcIMEIR/ABPR0iGkIy7ZMhCTgWBPr5z4Ia9KAITahCF8pQigQEACH5BAgGAAAALAAAAABAAEAAh////////v7////+/v7+//7+/v3+//3+/v/9/f79/v79/f/8/P39//39/v39/fz9/vz9/fz8/vz8/fv8/vv8/fj8/vz7/Pn7/fn6/Pn5+vj6/fj5+vf5/Pb5/Pr3+Pb4+/X4+/X2+PX19/T2+fH1+/D1/fD0++/0++/z++/z+e7z+v3t7e7y+vzp6fzp6Pfo6Ovw+env+enu9uju9+Xr9ePq9N/o9t3n9fvd3dTg89Te7tPe7tLf8s/d8s/d8c3b8c3Z68rZ8MvX6sTU7tLQ4MLT7brN6bjI4/a8u/WysPSvrbXI5rDG6LPF4LDC4K7B363E563A363A3qfA5am+3aO95KW73pq13paz4Jev1pGw35Ks1Iqr3Yuq246p0oao3IWo3Iek0YWizoKk2YShzoOhzoOgzoKfzYGfz4GezYCezYCezH+dzHee2PCOjH+cyn6czH2by3uay3uaynuZynqaynqZynqZyXmZynmYy3mYyXiYyXiXyXOb1neXyXWWyHSVx3KTx3CSxnOFmXSDlnCDmW+Y1WuV1GuU0WmU02iT02mRzmGO0WOKyFuK0W+CmG+AlVaGzmx+lGp5j1KEzUt+y0d7ykR4xu5ycOtmY+lYVedHQ+ZBPeZAPOY9OeU8OOY7N+Q8OOg6NuU6NuU5NuU5NeQ5Neg4NOU3M+Q1MOYwLOUuKd9OTd09O+A3NOMuKeMsKOMqJppUX1JrjUhdd0VadkRadkNYdUJRbUJNaEJKZjlyxjFtxSpnwSVjwCRjvyRivyNivz9dhyFhvx9fvR1evh1dvhxdvRtdvRxcvRtcvRpbvRlbvRlbvBlavBhavBdavBdZvBZZvBZZuxZYvBZYuxVYuxVXuxRXuzhMbC1RgxNWuxFVuxFVuhBWvhBUuhBUuQ9Uug9TuQ5TuQ1SuQxSuQxRuQtRuQtQuApQuAlQuAhQuwlPuAhPtwhOuAhOtwdOtwdNtwZNtwVNtwVMtwVMtgRMtgRLtgNLtgNKtgJKtgFKtgFJtQBItQBFtABCsgj/AAEIHEiwoMGDCBMqXMiwocOHECNKnEixosEBFjNCdPAAgIIFGDWKLFigwAZJk14MRABy5EQCBEgS2DBLVytMSVysbOmS4YMGAht0HAh0UK5Wq2BxwqlTIMuQPQ3GBECChMCpAIA+OioqFKpXSpnujEoQKJRKvnxVgpI1KIBCR0+ZGvXp09ewSVqQLQugjb52376109emLVC4reSWWkzX7ipVnTIp8QB1ZEcm+qJBs2YNWjR9TAD8fBvX1OLTozyBWlUqExILlUU2mHBJXTRsuLFFU3dpQoPDpVHbjUXKDY69AGKiGNbNWm5s1roNQwEAAunEpkF9ShVrk3GnCMjG/yTh65vz3Na++bJqHfGpUJ9UdXezAjxy0QQiyWv2vJm8SASMhpgoqcCiiRL1AbBAePe15QM54SwTTTTLhEOOD1kB54oqmiSxgEA8NejWFNf08447/EQzhWFv6YIJEgqAGFtFBwDlEwAzaEEJJWDc0FZbkNxSAQAFLBCASwJExIOPRDUJiS0iIFBATzHpUERyCREwAQB90KNPHxdgYABfT4ZApEsHALADH4Ic8SNBBKQJQBH1SCMNPTkESKYtZk45ElBFAELGHkAAIGdycs7QRCPhVPOMPF8AsCVRBDw5wpkuFUAAFX+cMUcNhsYpkAxPsPHGJeNUc40151w5FAARAP9ASC0bYDpSkhxkYQcbZKQwEKlr7EFHHsRwA1004/gCAwFjblnCLLfIYGhUaaZABht1ZMEBDFKsoYcdf1wxhjrSYPPNOMvQQ4mkW47giDbZICIaWWnWMMcadnghhh926LGFEAAwUo8y9/RhCD/G7MOFQEXwso4w8c5LLwBA7HEGHP1uAQQFANhgzTbSpJNDB72YE005S4zxDjjeaEOLtIdGBdQRgfDhBRAdPXAAF/ksg84uHQDwgzjOhZMONPbwMgstfd43sxUfBFXABLuYs4w+WACgAQBX6KNMM93Ew4gKhNxyqZ8iTtvREOdE000xMQDAwJaM+COPL2wBIAmftiL/V1KSsBKgyD3KyONIWzCZoIgicV9QKd9opz0mCsh086gREhc02iC1NJ22QDobAo8z5fACgqYDBfgAAZpmAK0IfTcYaw/ySPPMPpFegFBJGUwiCQaRN5gmBmikE80z3/CC4aQIOSDB5wKlmesdl7gDDzPtHLM89At1RIMXe4ihRxiM4HMMOceExjz3BQFFQxl4kAFIFjEa0g8z3cxThWiAs++WDmSQgxn+QAUO6KkN7KAGNdiRtdX5TwBpAoIf4HAGQDjhKvOqAjyw8Yx+GCI5Y/LfEPCwBjXowU0wGciWqkCObiiDH4boCFYaJAACgIBTaYiDHwAWM4FsKQjFKEcy/+5hCRakUERjkoIgzMAGMegAAP0ryJZ8UAx2GMMfh9CTiBIAACdYbA5WaIIUQADFg8TqBpcgBzaGYZUZ7oWLXjzDGuawB0FEAQAhNAgGAKAFfWAjGCbAUoOSKAg2xAEOaQjEHfMoxZ3h44+BdCNZBCAAEDxBDGEIAxmo8AECRJEgW+LCIwEpyM9x4JRRW0goRwmDB0xAkpOMmScVskps/MJ/UKTkJw+ypT5OQxlfSIQiVHBEXCKkI4p4hzOwYQ92+CMRmTOmQTqSiH9s4xu6eWY0pQknArAgEcMAhi+OMTYDwJKbBCHBCUygAnQyRIsCMac7FwKTYs7znvjMpz73yQXPfvozIAAh+QQIBgAAACwAAAAAQABAAIf///////7+///9/////v///v7+/v/+/v79/v/9/v7//f3//Pz+/Pz9/f/9/f79/f38/f78/f38/P78/P37/P77/Pz9+vv5+vz4+vz3+fz6+Pn29/n1+fz19/v09/z09/v19vjz9vz39ffy9frw9Pvv8/vt8vrq8Pjp7/ns7PLn7fbl6/Xi6vbg6fbd5vT64N/73t363dzh5ezd5fPb5PHc4/DY4/TT3/LQ3fLQ3O/P2uzN2evN2OvM2OvF1vD4y8rI1enF1OvD1O7C1O2+0ey/zua8z+y2y+qzx+Wxw+CrweKmv+X1s7L1oqDzoqHAscakvuWivOSht9meuuOgttmfttmdtNiatuKVs+CXstySr9yQq9WHqt+LptCFoc+Doc5+o9l8odmRna6DoM6CoM2Cn82Bns2Ans2AnsyAnct/nsx/ncx6ntXxkpC2jaN9m8t8m8t7msp6msp6mct6mcp5mcp5mcl5mMp0nNd4mMl3mMl4l8l2lsh0lsp0lch0lcdzlMdylMdziKRwmdZtl9Rvlc5ok9Nnj85aic9YiM5whJpwg5lTg8xRg8xwgpdvgJVugJVtf5RVfLZld41KfMhHe8lFeslBd8hAd8jsaGbrY2DoUk/mPTnlPDjoOzflOzflOjbkOjblOTXkOTXoODTlODTkMi7kMCzlLCfeS0rdPTvcNzXjLCjjKyfiJSBPZH1FW3dFWnZEWnZET2o+ZZxDWXVCU29CTWhASWU3cMUxbMQtacIsaMEqZ8EoZcAlY8AjYr8iYb8gYL4fX74eXr4dXb4dXb0cXb0cXL0bXL0aXL0aW70ZW70ZW7wZWrwYWrwXWbwWWbwWWLsUWb8UWL8VWLsUV7sTV7s1UXcgU58SVroSVboRVboQVLoPVLoPU7oOU7oOU7kOU7gNUrkMUrkMUbkLUbkLUbgJUbwLULgKULgJULgJT7gIT7gIT7cITrcHTrcHTrYGTbcFTLcETLcETLYES7YDS7YDSrYCSrYBSrYBSbUASbUASLUAR7UARrQI/wABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsSLBBw8saqS4QMHGjwgPVBAjZoDAAh1BqjxgAMQrXJqawBiI0qPKhggoOHBAAQFBBwAUzVqFapQmJzNPpryJEIJBpwKBLrqlytOoU61EHU0KoCZTgk5ZaGHESAsLAFClUiU16lMnUVi1Iv1aEOgRY/vcudtn7AgAoGpVsRVF2C3cVp8yNflhoQDTBgZuWBu3DBq0ZeOs3TDQIPBgwoRBceJkytWnJhoc35QAwFC+ZdZiW1uWzxAACZ5HgRbVCdQpVpuYWKBrAICHXd+qybZW7dsuDwAiAJgqWDfvT6dMaRIu0ObN4iWGcf9TLrsat2Elok9fO6pTKVamMv0YuED1V56W1EFbDk2dJZ2BWcUKKPIpZR9dFABwRT/LSBObNMv0cwUAOq1HVChtxHCSd3T9REEi/ngTTTTd+JNIhUApgksqbbwg0FIbCZAAQwYYkAEYvriTzi9gXFDjXwA4YksK3XHY4UHFAXACDkJA9xMAj8DCwQIM3CQAABjMAECSCCW4RDC+ICEQBFdGBaUsIABwgEoCGPCBFYGIOaNBCRTnQjjjmDOOCw7MaeYjaKqp0owzBPIFHz0AORBLFOrQxzjPMEMPFBQ+CUmga64EQRJ8kJGHljMyCsAOW6RBCTjSmCdMCwIAZaYjmFr/CUAFWcixxhcqoCUQDVbkcccbvnjDXDPyVAIBBMUhwNoksGgg6HcAdODFG3RskQEANFQRBx17dMEGONVUM844yegTBoVQcYENNlvoytSMK6CxRh5WSEFHHXTEUcUIeNyzDDuNVPLOMvL4BQAKh6ADCzaMuPsuADrYUQYcddShLw0AkABMN8/M4wML11jDTTEtHBFMPNNgU0sOin7lVBGBrHGxQAZEcQ8z4fCS3hI3h+NLN9yIQw0srzibKV1AJbFGoluyVgk7yeQDBpYADJLPMdtEM88uPjhSS5pHH3mtAQkAZUPI1lxjA7oc5HLPN+fgMQIAkcR6JABXJpkgGPkk/8NOJUCarUsuRgAQAASAgn23QGXWeEEv4TBzTxSVbokWaxCwBqviiw/k1BXwPNNNMCYQwKVPuh4wwSSxcN55Age0oI02ztzDRuUDCXAlSxu88soGBoR9t5fzMPMMPIegxWVBa8ogg+Wd68rDHby0s00z9wyifPQNzdiDHmXMQYkw5CjDj/YGoE6nn3cLsCYQdaChxh413HDMOMfsMwhQ6nNPkIwASAIgyvCGPDANB8cwBzLqUQkStMx/W5pREvwwBjigQQd/SRAOgLGOYtwDEw50lf/KNMExxOELK1CUU1BwCXoQgx4gfODiDpAADHDKhCh0mK5IgAkX1uMS6Vnekf+SJAVAjKEOZEihCD2XsUvUoxj5aEQIHFCmI10pA0qQ2Bu6kCv2PYkElzCHMfyBBdzR5QACUEEX+GCGNMBhCyeoU0JWmAxrnKMSBljiV4ojhT944QxnGMMfqAA9hLAGEfDYjwsA0L+HwewOechDHQJRBAB4sSBewgcy8lHGBFkRYlWgghSsAIRCIqQ4JviFNsqBiQtQgAJQgSBDWEMIezAjHTiIHuxqRDaHkMkI8CAYIYQwBUoJUZYGKU4IeNGNaIRDHe34Bxd0iEyDHPIfy3jGM4jBj4bFspoGgQwOdNEOdZxDHrrYTAPAmZDiSEAIQxACEUJgSnYapJGMtOdCBHATrGMdU58ADahAB0rQghr0oAMJCAAh+QQIBgAAACwAAAAAQABAAIf////+/////v7+/v/+/v79/v/9/v7//f3+/f3//Pz+/Pz9/f/9/f79/f38/f78/f36/v/8/P78/P37/P76/P7++/v++vr6+/76+/35+vv5+fr4+fz2+fz1+fv99vb29/r1+Pz19vj19ff09/zz9vr09fjx9fvw9f3w9fvw9Pvv8/vu8/rx8vfq8Pnz7O/p7/np7vfo7fXn7fbl6/Xi6vfh6fXe5vPc5PHp4enU3/DT3u/Q3fDQ2+zP2uzN2u/K1+rG1OvE0ujB0u34ycjE0ea/z+i+z+m5zeu2y+q3yea1yuq0yemzx+WuwuGoweb2trX1srD1sa/Lq7qht9qfttmbuOKas9qbsteYsNaUrdSTrNSNrNuKq92Mp9GIqtyHqdyGqNyCpduIpM+Ho86Fos6DoM6DoM2CoM2Cn82Bns2Ans2AnsyAncx/ncx4n9jzl5XykpB/nMp9nMt8m8t8mst7m8t7msp6mct6mcp5mcp5mMl0nNd4mMl4l8l3l8l2lsl1lsh0lchzjbJ0hJdvmNVtltVrlNFplNNvkslpk9Nok9NnktNnkM9hjtFgjdFaiM1Vhs5whJpwg5lvgphvgJVtfpRre5FpepFVhc5ShM1FesnsbmvpV1PoT0zmRUHlPDjoOzjlOzfkOzflOjblOTXkOTXoODTlNjLkNDDkMi7kMCzmKyaFaHlSa41IXXdEW3dEWnZDYY1DTmlAY5RCU29CTWjdQkHdPTvjMCzjLSnjLCjjLCfjJiKOQU44ccUybsYwa8MpZsElY8AkY8AkY78jYr8eX70dXb0cXb4cXb0bXb0cXL0bXL0aW70ZW7wZWrwYWrwXWrwXWbwWWbwWWbsWWLsVWbwVWLsUWLsVV7sUV7swUH0yTHATVrsSVroRVbsRVboQVr4QVLoQVLkPVLoOU7kNUrkMUbkLUbkLUbgLULgKULgIULsIT7gITrcHTrcHTbcGTbcFTbcGTLcFTLcFTLYETLYFS7YES7YDS7YCS7YCSrYBSrYBSbUARrQAQ7MI/wABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzamTY4AEABQcEbBxJgICGS5YgDDyQ4MDIiAMGFCQwQEOrWpzgDPFAsKXIlwkdOBAolCADAJFkoVqFq9OmKDgIsnQJ1KhAFCgEHtUKYFKtW6BEocqla1TOnVUNDl2CSZgwTEsADAVwVNJXU6VGffpEStUuVU6h4PBA9eXRL/XiiRMXr94XupDt3sJLqjKpUJ9CnVLFS9UbDz83DkVC7xq0a6av0UMit+7dUpYrY06VatMQC1UdDIAUD5q239qgxYM0wIHrybBlf0qli9OTtABkmiAm7hpwbdfEETMBwKNkyrObQ/+pAOBA4ZHSqVsHnn17dwDf9TLnNF7geaC6efsGLpy4cfhfgXLKLvSRB0AC0A00WmmnpbZaa/DJcssqnrxhIIIJWvXFPvgs1thjRx0VSS22vOGCQBhqZMBWCg0lhCPFDAOXXFxNQsuJAaSoUQAQ3ZADCFlBxhUlr3SQAAIvyaRDENEhFMAEA+yRDz5uAEDBXEPCIgIABIxkAAA69IEIE0ISZMCXPtAzzTT25FCcVZTAEgKXIx0VRCBk/PFDmTTJRQQj5FAjHBgATGDUAHGWQCdJAzQBiBl+8EDXAF+CqUUcmphTTTbXpCMEjQJFAMAgsGiw6EY8YoCFHmusMcNAN1D/YQcedxjzDXbSlCNMCwMUUCgAJ7QCSwwAVIoeABtogUcbZsCwQhNz4PFHF4ygU4024pTTDD2ZFGooCZBsw40hoL70JQxlyEFHF2T4YYcdV7TQCD3N3LMHIf0cww8XAhkBDDuxjFuuuQDMsEYbbESrhaQ0VNPNNOvkwAEw50hjjhJhuDNOONu4QqyxQB3FAx9+nAHEUAF4kU8z6vjCAQA+lGMdOetEY88vrbgyZ5fQHdUDFq8S4MAEvpzTzD5WIAtAFfsw4ww48DiyAqmK8gydTAIZMBQQ6EgDzjEvALCAoY38E48wTghUiZynQleSTBEMsAg+zMTzCGQxpaCIImFj/4Ao21ZnCICvKijjjXBHDKzgUYO8srPgAzHAACHvPGPOLxz0KVBxutFkEyxVQy7XADu8Yw00+xBq6EElnVRJBoFnaCgS80gjjTqaFKCbQg1IIHrWAMQghi/lVANNPnv8+vtCAQyAQRZ8jPFIOthIo0/aqy+P0FGOlvHHFFX05k01O5SpvVVABIKGHG3IAEAh/SSzDjApaH4+8DPM0UYafEhKAQiaaEcy8uEI5d3vSyAQAx3KEIgk0OUoNDgGOZjRD36J6nxfIgEW8lAGPlyhAAzgkaGW0I41reNTWIJcTABwAzHowQx2EMMIAMAjgRiKC/xgxjp8MQEGYE1wWCsCHv/ogAY81MEGxSqIqDIhj2XYowqKSwuPSDAFQLAhDXLIQg2aVJACDKAFwgBHN5xRAwKArCpdkoEY/IAGNqzBDkhMIUEM5YT44aMRALjg1QBQRTKoQQ0dnMIKEeKABWTiHcygR1zkSLAiBEIPfOBDHhBRhCRuDwA2AMc1zAGMEWDgAkL54Uh41AMqUGEKV9iTKA8iKi7k4xj7qNL9GjIABhAtHaYJAxcUkYgVDNJcNInJGYMCACGcwxnXsEc+2vGPQ0RxlqF63z+AIw1/OJOR0IwOA1ZwiGIUQxjIaMQKvJhNhZggBSlYQTkX8qaBkHOdCYnJL+FJz3ra8574zKfoAgIAIfkECAYAAAAsAAAAAEAAQACH/////v////7///7+//79/v7//v7+/f7//f7+//39//z8/f3//f3+/f39/P3+/P39/Pz+/Pz9+/z++/z8+fz+/vv7+/v8+vv9+fv9+Pr99/n99/n89vj89vf59Pf88/f8/fLy9fb49fX38/b79PX38vX78PT77/P76/H5/Onp6+/46e735+325Ov13uf13ubx8+Hi3OXz+9jX2uPx1eH009/y0t3tz9zxzdvxzdruzNjryNjwx9Xrw9XuxNLpwdLt3MvXv87lvc3lusvmucnjtcrqtsjktcbhssTgscPg9ru686Oiq8PnpL7lo7zhoLvko7jboLbZmrbimbbimrXel7ThmLHWk7DcjKzckavTi6fRhajciKTQh6LPfaLZfKLZhaHNhKHOhKDNg6DOg6DNgqDNjJ64gZ/NgZ7NgJ7Nf53MfpzMfpzLe53S8ZeV8I6L7nx6fZvLfJvJe5rLe5rKepnKeZnKeZnJeZjJeJjJdpfJdpbJdpbIcZnWdZbLdZbIdZXIdJTHc5THcompc4OXcIOZbpfVaJPTaJDLXIvSWIjOW4bJV4XJVIXOUoPNUYPNUYLMUILNb4GWb4CVbn+VVH67S37LSHzKRnvJRXrJ62Jf6VRR50RA5j875j465Tw45Dw46Do25Ts35To25Tk15Dk16Dg06Dgz5Tg05Tcz5DMv5DAs5y8r5C8r30tK3T074DQx4ywo4ysn4isnnlRgUGF6S2B7Q2aYRVt3RFp2Q1VxQk1oQ0xnOXHEM27GLWnCKWbBJWPAJGK/IGC+PV2HHV2+HF29G1y9Gly9Glu9GVu8GVq8GFq8F1q8QFd0F1m8F1m7Flm8Fli8Fli7FVi8FVi7FVe7FFe7E1e7NlF2IVSfEla7Ela6ElW6EVW6EFS6D1S6D1O6D1O5DlO5DVO8DVK5ClK9DFG5C1G5C1C4ClC4CU+4CE+4CE+3CE64B064B063Bk23BUy3BUy2BEy2BEu2A0u2Aku2A0q2Akq2AUq2AUm1AEi1AEe1AEa0AES0CP8AAQgcSLCgwYMIEypcyLChw4cQI0qcSLGixYsXESDAyPHhgI4gDRoA8OIFAAMKFHwMydFAgQ61asEomHIly4UFHDgoUNDABEq8Xml6oyQFTZU3DQZwQNBBgIEMABTa9YrVrFadhhYlOCBB0oIfevT4UDDq1FehQIlKtUoWVq1GvwIoUACDl2Dp0gXzgoEuALNUTZUiNUrUp7VtV3XatASETZAMJCjq9y1atG/9FEmICviVYFKgQY/y5GkVKjgyEjzmKAGAFH7Jpl27Ni0ZPykANksNPDi04VatUMuNnEnds9mzn6nLtLnzZ8KfVMnSpEQgUpY8TwzzVg35tWrehp3/APBgt+fB0WNtqg4ggdekPD38CtcdebVwvzyQN28KFKpYnCxRAQBdySUQBAAckk8y3iWTzyEAQOBcLKS4AYJ1Bg60QAE1XFNOMs88k0w519RQwAKAwXKKcAAokGFZABShTD/wtLNPMUX8pWMhvGgig3WrXRSAASMpxNQITzTyyBUtAMCUjpLkQgEAFRDw4kE8mVBFEwcM9KSOk+AiQgJFgvQUB1AcMddTBeWUwSX//INJCRhEBRUAk+QSwknYAQCFIH8kMVdBG8VIDzLI5LODkwRFleeeZXbEkxGCkBGojnPxVMIRi4AzzTPrQNgaVAdQkgsJfLL0VBB1nBEIEU7a/6kDF3L0Mk411jCjzxS5DWQBAITg8mukIPGkgx1n2KGDQChEsYcafjCzTTXbfCcODjpeAAANxDhjA6Y3McUDIGfkoYMPZdQxBxiMoANNN8Y8U805v5jgwEY4+JJNNoww+lVUSPyBBh11sJEHFzNYwo6DVUzRTzH2JALAAVt0Qw4x2WDh71cjJaEHGGvQgQQHNJxDzTXcuABAJPIcA88WkewDjTnZ1AKpgQHwZIUgXcwgkCH1uAyJAwygEMw4zMRzaz6JUIILqsTexNMGQ7DgpAfAjLOMPEwAkAEAPxhnzDrJVAGsnqleCYC2TMizzDjAeEBXa1j8Mw8kMcxl6s0vBv/AQE4FQALPMfX0EaFAUTXRhEAY4Il21MMBEIM310hTzg0bDxTAAVEFy/eLBSDAwSXqKMMOJpwXpNNJL9niDNRqM/WDPcw0U4/Zox5kQARmmBEB5F9tRIM32DzDzg5LqQ3RRjxYgg0z8hiS+UENNKA8ADlfoIUYvYDDDTIrDHr9QhvNsEcXi6CDDD64j48TAFHgsQYXvoBTTi8aGMCm+wZttEIcZxCED56gj2PIowjJ459BokKEP5ThDis4QTKs8Q6JfUmBAtkIBrighjtEYSOGiIe88mYnDG5kA1Cwwxj08C0A3GAdyoCHI3KzP/ed0AqACAMfsiCBAjDgAI2QhzH/7PGFXvGPKSzIgh7CkActNIkuBVCBMMrBDHcs7oJq20gLxpCHMfzBChsQX1RuMA1ueAhbWMwQT2wQBjqUgQ5R0FahDgQAJsCDGeEQBgpOJBCeGIguRADEGtKghjhkYY817JUX7mEMd2ACAAh4Uglv8pQMoIENYjjDGcIgCCGASyABaI0j7gExwwmEA2osQAP5wMpAcEEF4iOID0/QC3ckYx2ZiEQmhNG1SapKckIIgjBHgD2EMIUGx/DGMcqhDnGkYxgjEIAf1ZbIgrSmCPKIhzrUcQ5/NIICvryJARhAzr8xhCk9UEQkHGGJL5Qglhg0yDTj+RCdIICcO6GnPvfJCs9++vOfAAVAQAAAIfkECAYAAAAsAAAAAEAAQACH/////v////7+/v7//v7+/f7//f7+//39/v39//z8/vz8/f3//f3+/f39/P3+/P39+v7//Pz++/z++vz++vv9/vn5+fr7+fn6+Pr89/n89vn8+vf59vj89vj79vb49fn79fb49Pb49PX38/b88fX78PX98PT78PP47/T77/P77/P57vP77vP67fP7/e7u7PH46vD56e738ujr5ev12+b11uLz1uDw097w0d/y+dTU+c7N+c3M0t3vz93xzdvxzNruw9Tuw9Lpus7rucrjt8jitcrq9rKw9Kqp9KemtcbissTgscPgr8XorMTnrsHfrcDfrcDeqcHmp8DlqL7gpLvflrThmrHXk7DciqvdiKrdiqXQiKPPhajcgaXbg6TVhqHNhKHOhKDOg6DOgp/NgZ/NeZ/YgJ3Mf53Nf53Md53VfZzLfZvLe5rKepnKdZzXeZnKc5vW8I+N8IF/7Gto52ZjeJfJd5fJdpfJdZXIdoWXdJXIdIWZbpfVbJTQcpPHcZPHcJLGcISacIOZb4KYb4CVbX6UbHuRaZTTaZPTaJPTZJDSYY7RYYnHWYnRVobOVoXMZH6jU4TNT4HMQnjITHGkOXLFNG7EU2qKQGacMWvDKmbBJWPAJWO/6l9c50lG5kE+5Tw45Dw46Ds35Ts35To25Tk15Dk16Dg05Tcz5TYy5DUx5DIu5DEs5C8r5C4q5isn3kRC3T074y8q4ywo4ysn4isn4iEcrERLRVt3RFt3RFp2QVp7QVd0OVN5Pk5sK1CCQk1oPEtpJGO/I2K/IWG/H1+9HV2+HF29HFy9G1y9Gly9Glu9GVu9GVu8GVq8GFq8F1q8F1m8Flm8Fli7FVi8FVi7FVe7FFe7E1e7E1a7ElW6EVW7EVW6EFa+EFS6EFS5D1S6D1O5DlO6DlO5DVO6DVK5DFK5DFG5C1G4C1C4ClC4CVC4CFC7CU+4CE+3CE64CE63B063B023Bk23BU23BUy3BEy2BEu2A0u2Akq2AUq2AUm1AEm1AEi1AEa0AES0CP8AAQgcSLCgwYMIEypcyLChw4cQI0qcSLGixYsYM2rcyLFigwcAFCQ4IKBjRgIELhgyBKFggpElTUokMODCJWB05CDR4cLgS5IyCRqQwICBBAMEGQDYA0zVq1qrPnXSyTPoQaUFsQJQOghYLFGhSKViNYtW1KlHdsioEFQpDS6RInGhsVWgUkFeT5kqRWoUKFBiV7Wy1SpOhQMmlUqJtu/du33RpNS9m3dvqct8QaFyNSdHWwA9yoFbFi3aMnDlemylHEsv5lKgStHyZEQgYpMOBjia1+ya72vN5jka4IC168yuUsXpKeB2xwEASGzyVu33tWreNpEAABJv672gVM3/6iwwgVXoKYhxq/67GjdiKbgD8H4qlGza5WNaNTppXTTr0awzCVGsiSKLcsw5ZxUADgDARD7RQFNNNdBEkw8TDLL2CnkAmLdgVgC40Q893njjTj5uTAZAIMDg16F+Gxmg1UENCuHIJptI0kRddQ3CiwwAIKDgRgE4VEMNHGwHAHR2AUBILh8kQIBM0N0QxJJFFuSAA27gY08ZAEjQ4EBKEaKLCABM2RFSPNThxxIAGJClQBIAgIM90khjDw7EJeWkLiCkmRgAQfgBBh5wyikQUiekcU40z8zDRZhJDWAmmmo+N4ASeoSB6JJIAcCDFpWIM4011aADBIMDRQBAHrpc/yAolQAsgYencG6VRBtvFLPNddGMswkMAxRAaQmX6BJDnEEFgJStYeihRAxW6LHFI+RMc4034yxTTyRh1jlCI7/00gerzT6LxxhsoMGGGmZkQo4z98DBxz7G6IOFQEJkws4uwZw7Zrq1rjtGG19MwUw20qhjgwaaPGpOEV3A8003v+CybKhWOVurHnZo8UIV+CyTTiUaAOBDONWBow409mRyCS4ezLpgANAlQQUHAFiCzjL5VAEABgBUkU8yzXAjzyIt5MFLCDZ/SBAQ6ETDjTHLLlDnIv/Ms8mOABQCaNQfEkDBAInck8w8jdQ1wAAmJJIIDACcbWagmUptbArHaP8TqRDoaqnUHrjgLTWZA/ARjzPmWJIBAXMSlxtNNvGC6eGs+iAPNc/k0wWlB6GkUiEW5P1hgz6oI0014fgQOEINuIo54orAk40wIyw5O0R1XpHPNcOgoPvuDtWZBT7AmzA88QzViQXywyjPJPMLOQ+99NQ3D8DxwAs/ffYITQCA79dwgj34CHn8yDrXHLNCAAugj5BSRMjrzDt8hPm9/HURcccdzcjGM/YBB9Dxry4/eMMZvsCIcwgQH1QwIPqUYgM7oIEMd7CBFNoRDWnMIwoSpB5SZiAGNZDhD0QQCBb8oYz1qIYCYsoN8aakAjCwgQxtGAKD6gSHeiRjHMioAfiocNYBK7xhDGhQwxI6UCylRIIfxoBHJbCQhUQgggVvw5yxnoAHMaDBDGMABBSWVAAGsGAS7TBGOPBxj3b84xCvW9AWAYGGNawBDX94AgCMFb8WDKMf2PBNNPwBx4F9KAAB6IATtsBIMEyBiVlqEA4WMYxhbOIYi2BBAfZ3uAx4sgMHYRIJUGACFmTPYwMZwJwGYgBDbvKUiFylQd6WxQPa8pa4zKUupRYQACH5BAgGAAAALAAAAABAAEAAh/////7////+/v/+/f7+//7+/v3+//3+/v/9/f39//39/v39/f/8/P77+/z9/vz9/fz8/vz8/fv8/vv8/fv7/Pr8/vr7/vn7/fn7/Pf7/v75+ff5/ff5/Pb4+vX4/PX2+PT3/PP3/PP2+/L2+/f19vP1+P3y8fL1+/D0++/z++zx+erw+eju9+Xr9ePr9fHm6uLm6t7m89zm9dvk89nj8vvh4Njh79Xi9tPf8ubY4PjKydDd8c7b78zb8cvZ78TV7sXU7MHS7b/Q67rL5rfJ5uLEzLTG4a/F5au/3vKhn/KamKa726O95KG635y235m24p602Jmx1pi14Zaz4Jiw1pew1pGw35Kv3JSt1Iys3Imr3Yqn1JGeroSn24ek0IOj1YWizn2i2YCh1ISgzYOgzoOgzYKgzoKezYCezYCezH+ezH+dzH2czHybynuay3uaynKa1vGQju54dupjYONxcHmZynmYyniYyXiXyXeXyXeXyHaWyHKY0XOUyHGMsXODl3CDmW+Alm+AlWqRzGGP0mCLzVeHzlSEy25/lVGCzFCBykt+ylh6qkd7yUV6yTVuxC1pwlBie0ZfgUdcdyxnvj1dh+lSTuZAPec+OuU9OeU8OOU7N+U6Nug5NeU5NeQ5Neg4NOU3M+c0MOQyLuQwLOQvKuQuKt1AP909O907OeMtKeMrJ+MpJZBGU0Rbd0RadkRYdEFXdDBTgztObUJNaEJLZilmwSZkwCdkviVjvyRjwCNivyFgvh5fvh1evR1dvRxdvRtcvRpcvRpbvRpbvBlbvRlbvBlavBhavRhavBhZvBdavBdZvBdZuxZZvBZZuxZYuxVYuxVXuxRYuxRXuxNWuxJWuxJWuhJVuhFWuxFVuxFVuhBUug9Uug9Tug5Tuw5TuQ1Tuw5SuQ1Sug1SuQxSugxRuQtQuApSvQpQuQpQuAlPuAhPuAhOtwdOuAdOtwdNtwZNtwVMtwVMtgRMtwRLtgNLtgJKtgJKtQJJtgFKtgFJtQBItQBHtQBHtABEtAj/AAEIHEiwoMGDCBMqXMiwocOHECNKnEixosWLFw8cwMjxoQABHUMWLAAABgyBAhioRABSpMUCBD5EivTCxEEEKhmwdHmQgAMHBEZOQFTr1KU5cpTo0GECAU+FARwQdBBgoAIAgGilElVKFStToy5ZmhMniY4aNTQ8JRjix48QBa9mRdVpkyZNmziFGmVqVSlWo5SYaCmSAIELYXKdO5crzAXDAOTSQgXqk6fLnjhxwpTJlCUdayNLMNSPmzNn3PoZknBVMmXLmDllIjUqjk2nPCUAeMJvGDRq1KAN4/cEAGuskytj1uSJ1RzQAHDzVCDBkTpmwIEzU+eItWvlskmF/1LCAAADwi6Dpui1LVp2atG29UoB4AHy15pCOYcu/WlQEJB441520XgDCQj13ddJJqpcQp55oREEAQCD3DPMe8PcMwgAEEh2Ciir0FGDQP1FmAABOFBDzjDMMDMMOdTgQEACko2CSRIClRehQVcRYYw/77Czzy9ERGYkILWIGN0AaxUAE0JSicDEIYlY4QIAUhkZCCwZANDAjgJVVVBQKEjBhAEDZWmkIK58gABJ/gHAAxUtALDRQAQcIEIj//zTyAkXXGUVAIK88gEAcLq0kQt37OGFB3amGUAP9QgjzD0+YEnQVYUemqhIJK0AxhpvVMFBpAFcNYU6zjCzDiHGbf9qACKvlIDoWkG1QAYbdVQhQmQkGUHJN9FIk4w+xekmEAUA/PEKs58qCoCub7jhxZUAGDHIMNVIYw183vRgpAUA3FBJLDsYGdpVLWzxRhtg0IBEG4qUAw02wDATjTmQoODARjw8Isssh2ga4UYcVHEHqXaMQUk3x+QzxRP9/GIPrAZogU04lcyShcEHA5BwHmSUMUg27l0TAwCJyBPMO10osk8z6MgSiadg3soBFYNgYQg7xryTiAMKrJALOMnAA040+BCCyCS2RhsaSRwMEcMj5BwjzxEAXABAENcBs84wUjQLC845AxBAAgAcUc8x4NgCgmG6ZfHPPInIAAABtKL/nTYEECTyTjD1wMGhQFcxwYRAXnd6a9pXybBNcOSkq+ZAARhw1R+T+L1jnh40oo4x6zSieUE/IUpAB5PEEnXaUv1gzzLJ1DNFrAgVEAEXXEQgdWhU4dDeNObgAHLaDU1ohTzJaLOIEXsvtMACyKtdwAaPmGMNLmmYcYLa1TMklRDxGJPOIl70AYS64Sd0VSLrXHOLF6RiMQEBYrZvENs0bKPMPWGwQR/KkAcbREp/BtFNGCzUjh1MIA1quMMSoodAggRFBbeoBjsMQRUj4CENaGABBSsYKyvswxfyMBwAYnCHMuxhCOyr4PjaYY1i0AMOD4BCHciwBx4ckIRGYoI4xLiRDHcowg1j6AMUDiABNAFRIFLxwS/MQQx32CIPUMAAnp4oEN3sYBfgIMY3dgGEEaTABysYIQkPsDoz4GIcyuAGMnahi3LcYgYEcGIFq8IBLLSBDbYoxzOcAZxe/EMLuENgAAjAgSjoAQ1pOMMjwlEPe9BjH3fMIwmvIoQ+gAGEZwBDIbqghVKmMShrBMAM6pAHO9zBDn2YoAW5WJUYLAEKuDSCByRQAQlIAJW05OJDCsBGwxwgf8JMpjKXycxmOhOBAQEAIfkECAYAAAAsAAAAAEAAQACH///////+/v////7+/v7//v7+//39//38/v39/f7//f7+/f3//f3+/f39/P3+/P39+v7///z8//z7//v7/vz8/Pz+/Pz9+/z++vz++vv9+fr8+fn69/n99/n89vn8+Pj79vj99vj89vj79fj69ff79vb49fb49fX38/b69PX48fX78PX98PX7/fHx/fDw9O/w7/P67vP77vL57fH47PH66vD56e/56e735uz16OXt2OP01uHy09/y1N7u0t3w+dHQ+cjH49DYzNrxzNjrw9LqwtDnvtDswM/muc3rtsvqt8nltMnpscTix8HUrcDfqb/i9bCv8pya8pmXqL3dpLrdnbbdmLbhnrXYmbHWlrLdlq/WjavZiKrdh6nciqjXiKTQiKPPhqLOhKPUhKHOhKDOgKTag6DNgp/NeZ/Ygp7MgZ7NgJ7NgJ7MgJ3Lf53Mfp3MfpzMfZvLfJvLe5nJepnKdpvS8ZCO7nt57nJu7G9srn6WeZjJeJjJd5fJdpbIdZbIdJXIdYWYb5jVc5TJcpPHcJLGcoSZcIOZb4KYb4CVbJTRaZTTaJPTY5DSYI3RWYnRVYbOVYXOU4TNUoTNUILMbX6Ua3uRT33ETHvEW3GMVGqIRnnHQXfIQXTDPHTGOnPHNW/ENG3C6VtY6EtH5kA85Tw55Tw45Dw46Do25Ts35To25Tk15Dk16Dg05TYy5DYy5DMv5TAr5S4q3kdF3T074ywo4ysn4ycilEpVRVt3RFt4RFp2QVp7QlVyPk5sQk1oQUplMW3FLWjBJ2S+JWPAJGPAJGO/JGK/H16+HV29G129G1y9Gly9Glu9GVu8GVq8GFq8F1q8F1m8Flm8F1i6Fli8FVi8FVi7FVe7FFe7E1e7L098E1a7ElW6EVW6EFa9EFS6EFS5D1S6D1O5DlO6DlO5DVO6DVK5DFK5C1K6DFG5C1G4C1C4ClC4CVC6CE+4CU64CE63B063B023Bk24Bk23BU23BUy3BUy2BEy2BEu2A0u2A0q2Akq2AUq2AEe1CP8AAQgcSLCgwYMIEypcyLChw4cQI0qcSLGixYsYM2pk2OABAAQGIog8YGDAgI0WCxTYYMkShIQDDBiQEAFlQgIEChYgsEETMFF57kSRAgTIjxYtbC504EAgU4IMAAT69UpWLVu2YsVyNYoU0Dt2orgAcFJpVAAsWAg8CyAqol+0UJ0yVSpVKlWuXMGKdWsUkAllbTZdEokYsUhLADRtC+AQ3FasVkmWrKoULFh2lEIF0AVfPXDg6uHrwjiqY1qQJ69SZcqWX4EGNDdNcu8atGu2r91Lotj048iSTVW9k7SmZsUEINWDlq15Nmj1IBFw4Bt1ZNa1SEGBfRxAThXGwF3/c57tGjhjKgB4PA3Z1KpaecaW7O4dAHjx5M2jV9/4camt2wFgHH3IKcecc9BJR11/cdkiyg8AyETgQLPVdltuu/XW3yux2BHbgBOuxVk/+oAmGmlRmfYTENwdpwBbBTVlhCPHFIOYYiIi0ssLAFBAnwAM6aBDCGoxJmIiuoxgQAHd5dQDEQAoAORADDiAxj76oAEABosducsJADCpmQIA9MBHIUpESSEBPtgzzTT58DDdZonsYkKYx0VFBCFk0JEmTgBcAAAS8EgDHWmCUklAnSngeRwBCjDRhxqAMOEUADNcsk412FyzDpRdViDVLhs4+igAQ+zBxh5XiABACFtQ/6NNedKUQ0wNBCQQKAAraLLLDWrSR+YQcrThBxY3XHGJN+OBU04z90wSqKAoPLKNL4rgSGBUOIwhRxxjpBGKOc/oU4cg/iTjDxcCGRGMO7xsk22X9HH7BR1kDDLeNO3w4IEw6kiDThJlxBPON9vkgkOwE5KJghZzYIIONOx44gEAQowznjjtRJNPMJrkUoKpDb86xTHgONNPFgBoAIAV/SzjjDfzOBJDILs0KmaIuwpxTjXdJGMDAAsI6sg/9RBjKQCV2EnyhBUQ0Mg+y9TzCGM4scAII0NnsKjTO0+oKwzKdAMdEtrGGJUhudwZ9rYOCCLPM+iAwkEBU3rHFAE79f/Ui848M0AAD/JYAw0/Zex6kEosVaLB2/QJ+kQ90Uzzjhht5X1QAxbwfOkOyHgDDTmd7GEpjJ4jRAADIHwizzLvCBOGGn8MwXDqBwm6SD/JxMPJEXusAQcbC0OO+65W/MMMszsA4AQgZtDhRQcEaH58U0KIc4008jyxZQZa7EGGH1MYeTwAutJwTDnM+KPlBWTC4K0ZgBxxu+eQxsDJO8zEs0kFUWOMmdzABjro4H4hasoi/rGM89xtMQJoShHocIY+lC8nuFNgzLQhDSs4hUwRnMEb1MCHK9QHdwkgQA2EkQ9ncKMfjpCBQDAgqCvw4Qx86AECQ5QTG0yiH9Voxj63QkEJSoDiE09owxr6QIUTnk9XAODCOsqRDHC0ox3hoMcwwiAHM8yAb+cbyOoAYARi+OOK7ThHOjABBkLYD3VhFFQNsiAJSkiCE5cYAx1MCADrhTFtAAjAFdqghjhgwQkk6OMfC0KAC8DPCYQ4AwHjUAgnoG+RBtGVEwrhhjjEYQ2EsCQUMTkQAQhABE4IAxi+MIYpiKB6pERIB2bpqlgiRABkEqMfbSkQU5qSl8AMpjCHScxihiggACH5BAgGAAAALAAAAABAAEAAh////////v7///3////+///+/v7+//7+/v3+//3+/v/9/f/8/P39//39/v39/fz9/vz9/fz8/vz8/fv8/vv8/Pr8/v77+/r7/fn6/Pf5/ff5/Pf4+fb2+PX4+/T3/PT3+vP3/PX2+PP2+/L2+vvy8/T1+PL1+vH1+u/z++/z+e3y+fnv8Ovw9+nu+Pzm5eXr9eTr9ePq9OLq9uHq9uPp9OLl6uDp9t7n9Nzm9Nnj89Pf8tLd7s/d8c7c8c3a7czY6/jNzMXV7cLS677O57bL6rjK5/e9vLnJ47TI5rLF47DD4KjA5qa/5aW/5aO95KS84KK42pq24pm24pmx15iw1pew1pSz4ZGv3JWu1Y2q1oSp4Iml0ISl1Yejz4Whz4ShzoOhzn6i2Xyh2YOgzoOgzYKgzYKfzYGezYCezYCezPKbmfCMib+Lkn+dzH6czH2cy32by3uaynqaynqZynmZynmYynmYyXeZzniXyXeXyXaXynaXyHaWyHWWyHWVyHSVyHSVx3WFmnGa1nCY1W+VzmaR0l2M0FeHznCEmnCDmVOEzFGDzHGCl2+AlWt9klp7q06AzEt9yEd7yUV6yexraOtkYehSTuZDP+Y9OeU9OeU8OeU8OOU7N+Q7N+g6NuU6NuU5NeQ5Neg4NOU3M+QzL+UxLeQvK+UtKd9OTd09O+MsKOMqJuImIpdNWE9jfkddeURbeERadkNVcUJOakJNaEJJZDtyxTJswy1pwitowStnwChlwSdlwCVjwC1hrSJhvyBgvx9fvh1dvhxdvRtdvSxcohtcvRpcvRpbvRlbvRlbvBlavRhavRhavBdavBdZvBdZuxZZvBZYvBZYuxRZvxRYvxVYuxRXuxNXuzVRdz1HZBtUqBJWuxJVuhFVuxFVuhBVuhBUug9Tug9TuQ5Tug5TuQ5TuA1Tug1Sug1SuQxSuQxRuAtRuAtQuApQuAlRvAlPuAhPuQhPtwlOuAdOtwdOtgZNtwVMtwRMtwNLtgJKtgFKtgFJtQBJtQBItQBHtQj/AAEIHEiwoMGDCBMqXMiwocOHECNKnEixIkEHDixqpKhAwYKPCzoWGLlx4wEKZMgMYKigJMUDBji40laJEqU1atQYAQLEBQkSAwu4RIhgQoMGExAQbAAg0CxSp0ypWrXKlNVLWCtVWrOC5NCBDwyGFcg0Ea1Unjpt2qSJk9tRoEixouTC61cAYWVcWbToigy8ZAGYTSUqFKjDhz9lOnXJyN2CTIkI4ydPHj9hRAAwLXu2MGJQnECtogtAgdDHDAzouJYO2bNnyNJd02GAAWfChg9nIjVKjcAFjwdGAFBIH7JryK8h01cIQITbnj9tUmUJSOmWwQEYAOABlzhrya9Z/xOHywMACII7h9o0yhQloMCzC9yOItg38MmtfQuG4nx6wpmYgoljpcm31ASTuPNMeM+4M4lRt3mySiUulHaagQJNAEAU/iAzDXLTIONPFAAYJdgsoZSiBnDxYXjgIf+EE0004fxziIlMIVILKtYVKB9MBhlgQAZh7CJPO72EcYGQmgHAiCwrAGABhttpF6RALPQQhHlLAdAILB0ocICLMagAQAJdNvHLLkgI9IAAAzHVSCwhADBmdtv5gIcXNAAGgFI5jJMOO+ng0ACacXpJp53ybTdFH2nE8cOZArwpBDzMJIOPEyV2OWeddwa3XQxbzIHGHEMIVAEAUuDjjH7A2P8gAFOBMbJoqMHBKUIVfpABiBJMmXBLOtNYo4w9kjzwwHYIDOdILBswaiCaGjyRxxh5TPEBF/Q8Y0066RizjxgljqVFNtlk4aeBVSqhhxl1ZGELOs3Ms4gk8iBjT5sAtFDIO7Bko8i67KL5Qx5p6DEMN87cE8QM2FzzjTA2EPFLPdRkE8sOTbooEJo7bBHJOdCUk0t/TOSTTDm7hPONOdW84kq0uLrIVAu6kKOMPmEAgAEAg+hDTDfR3INLEIHEUoK0HgPAQAI4SIMcNjmU24Et+YzDjiAmKApq0xkCEMY+xsAjSZNM5XDLLakG8MCnTLsoJAa6lJNMPpxqaOUDw/H/7eStYIclBT3NhPOLCgRU+aebdkrw7NI1y3eUDN1w00w+gnRKkABwwrSBKzMbEHl2FwBghT3NLHOPum8iNGYNNVjpcelOuBONNfHg0ocSlIKtUKUAOEGPNd14E0kdX/zBO5MHJYAolWFZAY800djDhAljyAGG8tsp7vt8YQnizzLc2MMpADCAIccYfEyhQdxgIxB+P8OIIw0TJTL1Qhd0fMFHFe8bHbsEMgj6pWMYPNAcmkRAhT18YQ8AlJ3HhGSC4hzDHQgEQOkGQq0qOHAPVOiAAeDksQZUQBH+OAY4dJHA0tHqYwDQQBXy8AVAQEGCAxSBfZBBD3IJBAQGGZMG7rAQhzSkIQUAICGGwrIEe3zDGemYxCIgAYwwGEApA1EKFOzQhi8gUYkYYgoTolEOY6jDHezARj984KeVsMANaLDDDb3nIg31QBj7YIc71qEPXrSAeUwRQh/G0Ac2vrBpGrrBICChCEgY4gYSNMADiOiGLoxghN8700EUh6YYyKEMfEhCJgmSgAck4FCm7NIR+mAGOQxhCCxI4igTAqcTbOENbUgDHACxhRPIcpYGQRMN/tCGM6ThDGb4Q5+eB0yCCOkIcKjDHKR5BOY1EyEswMENcPCCay6kZgL05nwScAByivOc6EynOtfJznauMyAAIfkECAYAAAAsAAAAAEAAQACH/////v////7+/v7//v7+/f7//f7+//39//z8//z7/vz8/f3//f3+/f39/P7+/P3+/P39/Pz+/Pz9+/z+9v7/+vv9+fv9+fr8+Pr9+fn6+Pn69/n8+Pj79vn89vj89vj79fj7/vX1+vX29ff79fb49fT29Pb58fX78PX98PT77/T77/P77vP67fP7/fHx7vL66/D56O/46u716O72+ufn5ev14un03OXz6Nri1N/x1N3s097u0t/y0N3xz93xzdvvzNjrxdLowtPu+MvKw9Hov8/ovs7ouczpuMjjscfosMbossTg9ru69bCv0bC+rcTnrsHfrsHercDfrcDeqMHmpr3hmrfilrPgmbLZlLDbkqzUh6ncg6fbhKXXiKPPh6PPhqPPg6LShKHOg6HOg6DOeqDZgp/NgZ7MgJ7NgJ3Mf53Mdp3X8pya8piW8ImGxYaUfZzLfJrKe5rLe5rKepnKeZnKeZjJd5nOeJjJd5fJdpbJdpbIdoWXdJzXc5vWc5fMdJXJc5THcpPHcY64coSZdIOWcIOZb5jVa5TRaZTTaJPTZ5LTapHMYY7RYI3RWorRVobOb4KYb4CVbn+Va32TanmQUoTNS37LRnvKRHjG7Gto62Ng6VJO6EZC5j875j055Tw55Tw45Ts36Do25To25Tk15Do25Dk16Dg05Tcz5TUx5jIt5C8r5C8q5C0p3UA+3T074Dc04y0p4yom4yol4ygk3Do4V2yFUmuNSF13RVp2RFp2Q1h1Q05qQk1oQkhkQXfIPHTGM27GMWvCKGXBJWPALWCsIWG/Hl6+HV2+HF2+G129G1y9Glu9GVu9GVu8GVq8GFq8F1q8QVd0F1m8Flm8Flm7Fli8FVi7FVe7FFe7E1e7OExtLVGDElW6EVW6EFa+EFS6EFS5D1S6D1O5DlO5DVO6DVK5DFK5DFG5DFG4C1G4ClC4CFC7CU+4CE+3CE63B063B023Bk23BU23BUy3BEy2BEu2Aku2A0q2Akq2AUq2AUm1AEe1AESzAEKyCP8AAQgcSLCgwYMIEypcyLChw4cQI0qcSLGiQQEYBVjc2LDBA4IHQh5AgCABApEcKRIgoIFSJRouXIRIuXHAgIIEBmi49etVp5+agmpiw6ZNkyFDmMykefABA4EMPg58SqiXLVVYWbVqJWvWLFqrarliE0IjU4I3AZw4ITAtgKeRfMEaZYqUqLuhQn3yJGvTkLMGnz65VKzYpSdvoQIwJBfVqVKQIYdKJcvNTASApwJYo+9duHDv9K1J/JQxLMeRS4Fi9amJwAOZBX5Uoo+aNGzYpFHTpwSA08WNH5e6O2sTDQAHzMZmMAEYO2raomujxg7YBAalg5cKpYqVG8yYY7f/BbDi2Dds0rVh+3ZsBQAIwE+f+uSqExMAAmCLH3+iWDj00mETTjFswWcaXbNo4gIA4e030AMDQDLPM+k9Mw8kA/zG2CurrMKGQA06qJgP54zTDDXUNDPOOT68VVovsnDyV3IiBgYAFdn0Aw88/FBDBWmL/eLGgiHGZsBTBn0UQxaWWLLFDYklJgkvFACggIgBCBRAlgbxAKVmikmySwkCEODgTTsEMR5UDPRRjz5+WHBBAQQ9JSYJAJgpngEA7IBHIFBcAACfH/lATzXV1JNDhnUCcGee+z0VhCBi7IHFBoNCKIQ71EQzzxYATFDnAJPsYgKk+w1gABJ2mEGHFjUA/2ABAFzcE0022KwjhG8DRQBAIbpogGqqAACBRxpziAHlDMf8hw015RQDwwB0iooCLrzIMGiNfN4gxhxq6KFDGPZAF045zdRjSaiimvBIN9wgwmuNT9WgBR1onDFMOdHc08ch/CSzD6gAFDFMO7vEOy+3AGyAhR2AWLNNNezk0MEw6VCDzhFcwCMOON3kMsO2NQrEJwZLZGJONOsE0wEAP5CD3jjsSGOPMLjkgqeeJQOQ1jDnNKPPFQBgAIAV+jDzzDfyONICH7ycynPJmqZzzTfIxADAAqI24s88xSAGQKk79yxQBAEscg8z8zySmE0pKKKI1hUM8OjUItK5wjLeeP96xMIE/UaILmX3HMEDh8QDDTrCeJDTQBlCmFMGt0xTeI2i8lBPNdHkwwUAFSC0UgaVUHIB3vt9lAIw50RDzTp3jCwVQg1IYLbqwNjDjDr1ZBIHGbEiaTZCofcwzDvI3IMJFniIIYcYO0Q5fEGi+qCMO8nwAwxbUARiBhx5AEHy9AKJmoQy5yhjjyMphAoAq2igUYeaBnBp9gC+VkHPN870c4hAdOKTsdRghkAswWduqVFaruCOa1zDHWXwDZ1kUyw5wIEMgFhCAkVErRc4Ah/UCIc9rOAb+5kMADb4FhksBYIBmFA8H1GEP5ixDWQkwWcvVEwNxFCHMQgCCuPbj6/iEvcMdDyiD4tggU0OwicYYCEOagADpnIImCHCIxrVSEc8/JEIwBHEV0QAhBq+MEURxfAf2wiHN6jRjy7OriAMGIAR9jDGMp5pAC9IxDEKo4xGsKAAG9RMEehIRgBQUTwnUEEKWMCQpwxyjCMwgAMOeRZGDQSQCnnKHNXgBfLZZIkLeQoR9oAGMhghClP4gCHJp5CbTAEPZghXHQQhBQBMkJUHoZMUBKEGOKjhDLS0JS4RsiUQQAEMXvCCGKrwARcOcyEbiKYqn7mQAPAJcpSkppa2lE1tevOb4AynOMdJTm8GBAAh+QQIBgAAACwAAAAAQABAAIf///////7+///9/////v///v7+/v/+/v79/v/9/v7//f3//Pz9/f/9/f79/f38/f78/f38/P78/P37/P77/Pz6/P77+/35+vz4+vz3+f33+fz3+Pn1+Pv29/r09/z29vj19vj98fH19ffz9vr09fjy9fvx9Prv8/vs8fn67e3p7vf75OTm7PXl6/Xk6vTi6vbi6fTg6fbh5eze5vLc5vbb5PPY4vLW4vPT3/LR3fDP3PDP2uzN2evL1+rF1vD5z87F0+jD1O7A0u2/zub4xsX2trW2y+qzyemyxOCww+CwwuCmv+Wnu9ylv+WjveSju+Ght9qatuKZtuKcs9iZsdeYsNaXsNaUs+GPr9+VrtWNq9qNqdSEqeCMptCIpNCEpdWFoc+Eoc6BodJ9otl8odmDoM6DoM2Dn86CoM2Bns2Ans2Anszym5nxlZLufnuRna5/ncx+nMt7mst6msp6mcp5mcp5mMp4mMp4mMl4l8l0nNd3l8l3l8h2l8p2l8h2lsh1lsh1lch0lch1hZpxmtZwmNVwlMtyk8dok9Nmir9YiM5VhMpwg5lSg81Rg81xgpdvgJVrfZJae6tQgsxKfclHe8lFesnsa2jrZGHoUk7mQz/mPTnlPTnlPDnlPDjlOzfkOzfoOjblOjblOTXkOTXoODTlNzPkMy/lMS3kLyvlLSnfTk3dPTvjLCjjKibiJiLcNjNRZHxPY35HXXlEW3hEWnZDVXFCTmpCTWhCSWQ5ccQybMMvasMtacEraMErZ8AoZcEkY8AtYK0gYL4fX74dXb0cXb0cXbwbXb0sXKIbXL0aXL0aW70ZW70ZW7wZWr0YWr0YWrwXWrwXWbwXWbsWWbwWWLwWWLsVWLsUWb8UV7sTV7s3T3MbVKgSVrsSVboRVbsRVboQVLoPVLoPU7oPU7kOU7oOU7kOU7gNU7oNUroNUrkKUboLULgKULgJT7gJTrgIT7gITrcHTrcGTbcFTLcETLcES7YDS7YCSrYBSrYBSbUASbUASLUAR7QARrQI/wABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsSJBBw4saqSoQMGCjws6Fhi5ceMBCm/eDGCooCTFAwY+yMqF6dKlNmzYEPlBZEWIEAMLuESIYEKDBhMQEGwAYNAtWKpStXLlKpVVTVgxYXITguTQgQ8MhhXIlBEuVqFAefLU6ZNbU6NOvXKTwutXAGFfYGnUCMsLvGQBmGVVitSow4dFcVKlqcjdgkyNFNsXL96+YkYAMC17tjDiUZ9Gubq0AoACoY8ZGMChbR2zadOYrdOGwwADzoQNH+Z0yhQbgQseD4wAAFE+ZtqSa2OWDxGACLg9i/LUKtMP0y2FAzAAwEMvctiUa//DRq6XBwAQBHcm5clUKq4AgmsXyP0EsXDhlWMLR+wEevWEcZLKJo6ZNt9SE1jizjTiTeOOJUbhFoormJR22oEETQBAFP0wc01y1zDTTxQAGCXYU6iwEZx8GCKoiD/jVFONOP4oYmJZuaxChEDZaQeTQQYYkMEYwMTTTjBjXBCkZgA8YksK8WHI3XZACoSCDkGctxQAkNDCgQIHtOgCCgAksGUTwwBzhEAPCDAQU5DUIgIAYWrH3Q55gAEDYAAoVUM567CzDg0NmPkml7WAQOd83FEByBpy8FCmAG0G8Q40zdjjRIlbxqloncJx54IXdKhBxxACVQCAFPZIs98wMQj/wFRgjyS66HxujmBFIGYckgRTJeyyzjXYOENPJQ88wB0CxEVSywa3zmemBkzsUQYfVIzwxTzTYLPOOsroQ0aJY3HBDTda8HnglEj0gYYdW+iiTjTwOEKJPMzQsyYAKiDCDi3cLKLuumb2sMcafRzjjTT1+PDCNtqEU0wMRgQzTzbc1LIDky0KZGYOXSySDjXn+OLfEvg0cw4w4oSDTjazxAItqB0zpcIv5jiTzxgAYABAIfkg80019fDiwyC1kBBtxwwkQIM1yW1jA7kc6IJPOe3oUQKin3Y8kIZj6KPMO5UwydQNu+giBAABPODp0lIacMEv5zSDz6YaUvkAcXs3/2krzRiGJcU80YgTDAoETNknm3RK4KzSgM931AvfeBPNPXpwSpAAbsLUgSyybGBA5NpZAMAV9ETzTD3ptolQmDLIQGXHqjrhTjXYxNMLIEhM6vVClALgxDzYfAMOJXeEIUgS2yleUAKGShnWFe9YUw09S5hQxhxlLM+d87/TFxYh/TzjDT2bAtDC9mX8QYUGcHuNwPj8GEOONUuUyFQLXtQRxh9WgB/p1iWQQtRvHcbQgebMNIIq+CEMfgjg7Gr2gBIYxxgIzIHmPAYADVjhgRHkAADc1KJZOcIfxnDHMjSYN4JM64NhAMQUMGAAEjIKACdQxDuYIY5f3GCDBQmTBuqqQIcwHAIIHNOOanDAC3t0axy8qMEDlIIQBpoBDnSYggDAd5ewNIIfxKjGNIzBj0kMzCAMAAAT8KAGOJBpJdoJixb+8Q55yOMd/2idQpiyA0CUARBInJWdANCESUyiEZQgERUT4iYOeCEOcsjCAwoVvfAthClK8AMa6MCCjk3yKA0YC0PMZAM8oAEPSphBDyRlSYa46QJdiEMa5FAHPBwCVZVsZZWYcIgzpCENYBAEFCaoS4PAhAVbwAMd6LCHLbBAAAMs5kASMINq1sBnNpTmQbjIRW0aBHrQy6Y3x0nOcprznOhMpzoLEhAAIfkECAYAAAAsAAAAAEAAQACH///////+/v////7+/v7//v7+/f7//f7+//39//38/v39//z8//z7/vz8/f3//f3+/f39/P3+/P39/Pz+/Pz9+/z++vz+/Pv8+fr7+Pn7+Pj59/n89/j89vn89vj99vj89vj79fj79fj69vb49fb4+/Pz9Pb69PX48fX78PX98PX77/P77vL47PH5+vDw6vD56e/57uzx++Pi5+z24un02+Tz1+Lz1eHz1N/x0t/y1N7u5dniz9rszdrvy9nuyNbtxNLowNLtvtDswM/nwM7mvM7p+MjHu8vkucrntsvqt8jitMnptcbhysXXscPgr8LfrcDfrcDe9K2s8p2bqcHmqL7hqL3dobfaobbZmbbil7HZkqvUi6vbjqnSiKrdh6nchqjciKTQgqbbh6POhKPUhKHOfKHZhKDOg6DOg6DNgp/Ngp7MgZ7NgJ7NgJ7MgJ3Mf53MfpzMeJ3U8ZOR8ImH7XNwfJvLe5vLe5rKeprKepnKepjJeZnKeZjJeJjJd5fJdpfJdpbJdpbIdZbIdJXIcpTKcpPHco64doWXcoSZdIOWcIOZbpfVbJTQaJPTZ5DNXIvRVYbOb4KYVYXOVYXNUoPNUILMb4CVbX6UanqQV2yFT3/HSX3KSXvHQXbHUmuN62Vi6FpW6FFO50RB5j465Tw55Tw46Do15Ts35To25Ds36Dk15Tk15Dk16Dg05Tcz5jYy5DYy5DMv5TAs5C8q3kZF3T073Ts54zIu4ywo4ygkrElPS153RVt3QlyARFp2Qlh1Q1NvQ05qQk1oQUllOnPGNW/EM23EL2nBJmTAJWPAJGPAJGO/JGK/H16+HV29G1y9Gly9GVu8GVq8GFq8F1q8F1m8Flm8Fli7FVi8FVi7FVe7FFe7E1e7MU96ElW6EVW6EFa9EFS6EFS5D1S6D1O5DlO6DlO5DVO6DVK5DFK5DFG5C1G5C1G4ClC4CFC7CU+4CE+4CE63B063B023Bk23BU23BUy3BUy2BEy2BEu2A0u2Akq2AUq2AEi1AEW0CP8AAQgcSLCgwYMIEypcyLChw4cQI0qcSLGixYsYAQwYECCjR4QQIgxEsIDBggQINn6sWKBAhkyZZLhQgBAByQUrExIgULAAgQyaiNUaFQoUnSlSjMgoUSKnwggiAUAl+ABAImG3YOGilUtXLlqwRo0CVWfOFBcanQKoCkCFCoFs1wKQNMzWKlWoTJUyhSoVrFezdIkywmCAWpFLJilTNmmJVLgAFtV11YqV5cukZMmao3Zg1S/46okTVw/fF7lVJduifJlVKlO5BgtEcBhAknvaqGnLre1eEqmpJ1e2bCoWrTpocXaOQCBSPWrconOjVi8SgQjBV1d+nWuUlNmdAfD/RMFMnDbp3LSJY4YCgITIwk2xylVHBoCU4cUDIG8evXr27sG3WimzwPIdAMrlJ1Vzz6FHnXXYCXhKLqEYcR9tCgok0m288eYbcJFhNQsdtCWYIWRf8KPPaKWdVlVqxFQIXmcHxFWQSEJA0swyjT0mlyTBoNVAfgIwZIMNH7wlF2SX9CICAgWEx5MOQABwQJGeRSDHPvqYAYAFUTH5CwkARKnWAQDo4IchSlg5EHM52HPNNfnkcB1VAFwyZpmdVQWEIWfo0eZOAFRgGzzWUAdGoVQRoOcJfHZGwAFM/MEGIU5oCAALm7CDzTbatBOEjwBMAIAiv2gQqaQA/NCHG31g/wECAB9sgU036VlzjjIvEGAAoyl8AswMbuaHJg93vCGIFjNgsQk454lzTjT3VFKooSZA4o03jZAaXlU0lGGHHWWscQw60+gjByP+PNMPFwIJccw7vnDr7bcAzBCGHmcUct417uDQATLrWKNOEmLIM0443vBCLJonommCFnh0og417hTTAQA9lHMeOe5Uk88xn/AywqoZovmBFc2IIw0/WQCwAQBZ8AONNODQA8kKiABDppknMtpDOth88wwMADhgKCT/1KMMFQJhsifQJ05AgCP7QFMPJHLtpIIjjiBtgaNTBw3ArytA8w11RdyrYVWJ9PKz2Q9EwMg806hjzAYFYP8pHlQE+ISBJsBASnV+DxCQwzzZULOPGIwe1BIGmWCCweH5GUpFPdVcEw8Za/l9EAQUmP2YDc6AQ405nvTBxJKm6/SAB8XMA008yIzBxiA8FBv7QYYyws8z8ngyxB5txOEGsZj/bmgW/kQD7Q0AQEEIGnp0sQEBov9uag/kaGPNPFBbYIEWfZwhiBWwOw9AC82cA00/XlaAJgvipkEIEe2bbSgMnoAHNObBiQhYTS5qaoMb9FAD352IAFURQjIEmA5ltMBXngEAEQaRBj1s4QDcCxpbvNCOc1CDHekYVZggc4U/pAEQP3CglAAAg0rwQ3zgKIYP+geAIpkgDHGAgxrUWBA4BTlAcc14jjaysY4YGuogVeHBINAACPbZqDY2dIY1rBGNeVDiACssCAiv4Ic0/EEHMsyJSLjwD3jIYx7u+IcX3DYQNLVAeXjoAgagcoArqYUnVbCEJSrBiZj9SiFVIYIgzjCI1/3OIQKA4Bby4AY2HIEIUYjCrLrnEew84JNhTAiaapAHNbwhEILggyGgcLZHJqQqTzAEHGbJhlW20pUHiWQInjCGMYShDFYAQQhxqZANcGADsyLmQgQAMYEMU5kJEYA0OQnNalrzmtjMpjZ/FxAAIfkECAYAAAAsAAAAAEAAQACH/////v////7+//79/v7//v7+/f7//f7+//39//z8/f3//f3+/f39/P3+/P39/Pz+/Pz9+/z++/z9+Pz+/Pv7/vn5+vv++fv9+fr9+Pr9+Pn89/n99/n89fj89vf59Pf89Pf78/f8/vT09fb49fX38/b78/b69PX38vb88vX78PT77/P78fD06vD56O735ev14+r1+eTk/OHg4uft3ubz3eb13OX12uPx1+P11eDx1N/x0t7wz93x0NzuzdvxzNvxzNntxNXu+c/O+MjH1c3cwdLtu83quMnjt8fhtMjns8XgrcTnrsHfpL7lo73kzK+/o7jaobzkobfaoLbZmrbinLPXmbbimLXhmLLbmLDWl7DWl6/WkrHgk63UkazXi6zdiavdjajShqnciaTPh6TQh6PPhaLOgqbbfqPafaLZjKC/hKDOg6DOg6DNgqDOgp/NgJ/MgJ7MfaDT8puZ8pmX8IyKuYybf53Mf5zMfZzLfZvKfJvLfJrLe5rKepnKeZnKeZjKeJjJd5fJdpbIdZbIdJTIc4SYcpbMaJPTaI/KYYzPWonPWIfNcISacIOZU4TMb4CWb4CVa32UUYLMUILMWXurTYDMSHzKSnvFRnvJQ3nJ62lm6l9c6VJO5kE+5z465T055Tw45Ts35To26Dk15Tk15Dk16Dg05Tcz5zQw5DIu5DAs5C8q5C4q3UA/3T073Ts54y0p4ysn4yom4ycjc1ZoSV55RFx7RFp2Qlh0Qk5pQk1oQktmOHHFMm3GMGvDLGnCLGe/J2S/JmTBJWPAKF+xHl6+HV6+HF29G1y9Gly9Glu9GVu8GVq8GFq8F1q8GFm8F1m8F1m7Flm8Fli8Fli7FVi7FVe7FFi7FFe7OFFxMFODHFWoEla7Ela6ElW6EVa7EVW7EVW6EFS6D1S6D1O6DlO6DVO9DVK5C1K7DFG5C1C4ClC5ClC4CU+4CE+4CE64B063Bk23BUy3BEu2A0u2Aku2Akq2Akq1AUq2Akm2AUm2AUm1AEi1AEe1AEOzCP8AAQgcSLCgwYMIEypcyLChw4cQI0qcSLGixYsXDxzAyPGhAAEdQxYsAGDGDIECEqhEAFKkxQIEPNiyFUPEQQQqE7B0eZBAgwYERkqQxMuVp0115gwRIgIBT4UBGhBsEGDgAgCGdMFKxSrWrFaqPHFCqlRGjApPCYYIEiREwauOdr0iJSpUKFGjUKlqJYsVLVV0RLQUSYDAhTTE1q0jluZCYQBw5Z4yVapyqVGjPoFq1WlIWsgRGPkbN23aOH+MIlyN/Gqy5cugVqmqY9MpzwgAqPRbVi1btmrL+lEBoBpA3NaUK4cqNYuTZwC2eS6IkKldNN++o7XLpJq161GxUc3/SQAgwWCXQVcYE2cNezZr4oytAODAuGRToVA1FyIw+tOgHwBTTnvYWVMOMB/QZ99coMTyyXjlfUbQAwAgcs8y7i1zDyIAPBCZK6fIsokM/UlIkAIE6JANOstEE80y6GSjAwEKwKWLKg8KRJ6JbwGQBDP+xPMOP8gkAdmRjfAyInQDpFUATAhJVUIUj0zCBQwASHUkJLlMECGPVRUUlApXOGHAQFoeGQkuJCBA0n8A9JDFCwBsNBABB5RwyT//ZJLCBVdZBcCaIwDwpksbwRDIIGWAUCeaAfxAjzLK3ANElgRdRaihT5HUghl39KEFB48GcBUW7UwTjTuKEJepAWue/8ApnC+wkccfWpgAGUlIBGOONdc4k48VrgokAVa4UDDrUxvV2gcfZNAJgBKJLNPNNd28V44PR1oAAA635LLDkZ9d9UIYfexhxg1M6IFJOtV8g0w01qjziwoNbOSDL9to8wimEm7EwRaBxNEHIGsEQ04z+nBhhT/H1NOqAWJ8c84t2nwBcMAAcKCFIGy0kQg47XlTAwCUzJNMPGdYwo806WxjS6GHSkgSB1kk0gUj7zATzyQNLNACMeY4I8+v+CgiiS2y1mxzx0fQ8As6zcyzBAAZAFCEdci4s8wVWOVCM48DBaCAj/Q0Y44wHxSG2xf/zDPJyQRs6rSJDzxASTzJ0P9zSIcCXdWEEwJdMCguY5N9pA3iZEMNOjxsXLYBVxmC+LIm4tnBJe0w404mlBf0k6Ex2ZJL04pLFUQ9zzhDD9i4IVQABGqoAcHdn1GlA3vYqDNumoo3RCEX8zgTDiZIABCUQgwwEDwAARSwwS/qdCNMHG6kAP3zDEllhDzMsIPJGIUEQS73CV31iDveDEMGHn10IQEBYaJv0Nk4iAPNPWnkUEgbgrjBo+xnEG+h4ULr2IEE4hCHQEBBeQQUHQA+QIxuuIMSV2GCIOAQhxYMMIJSUcEi2oEMelwNAC/4wxsCIYXz2U8qKdDEPiLWiwwcACZQEMQaCHEEFz7PWzrohTz3jPGOX0RuAVUxARn6sMJL2el5UuEBMuCRDHtoQgUAOBMEXxAHPIQKS08kW1CWcAwWqcMSHZDcRnoQiDfsYQwgeAzZFmAANPDjG/Qahy9qcAAtCuoIhFhDIKqgPDstD04ocIY4kuEMZxjjH2AoVqYAIIVADkIJA/GWhOh4wHp4sh/CsAEB/Fg2AnSgC20ERBamkIUy9ACCaQlKEcTwBTCAwYOHLMhGXGArNvTBD3zwgxkwsL201O9OCrlKDgQhCD/4oQ+FgMICcvmUBkTgmhGg5kE2QgMoTEEKVUCCBooZwZ6UUyIFOEBh8HTMc7rznfCMpzznGc+AAAA7" width="40" height="40" alt="빨간 깃발을 들고 달리는 사람" style="vertical-align:middle;flex-shrink:0"></picture> 내 위치 · ${total}건</span>`:'—'}</td></tr>`}).join('')}</tbody></table></div>`}
function homeGradeCriteria(){
 if(!gradeEmployeeAvailable()||window.GradeVisibility?.anyVisible()===false)return '';
 const registered=gradeEntries.some(entry=>(entry.department||'insurance')===gradeEmployeeDepartment()&&entry.date<=gradeToday());
 const empty={daily:['시작 건수','건당 지급액'],weekly:['정상 실적','지급액'],monthly:['실적 구간','시급','달성 수당','추가 수당']};
 return panel('개인별 그레이드 지급 기준',Object.entries({daily:'일그레이드',weekly:'주그레이드',monthly:'월그레이드'}).filter(([period])=>gradePeriodVisible(period)).map(([period,label])=>'<h3>'+label+'</h3>'+(registered?gradeSummaryTable(period):table(empty[period],[empty[period].map((_,i)=>i===0?'등록된 기준 없음':'—')]))).join(''));
}
function homeStatusList(){
 if(!homeStatus)return '';
 let title,rows;
 if(homeStatus==='pending'){title='오늘 가접수 · 2건';rows=[['강예시','010-0000-1301','경기도 부천시 예시로 2',pill('가접수','pink')],['조예시','010-0000-1302','경기도 파주시 예시로 3',pill('가접수','pink')]]}
 else if(homeStatus==='normal'){title='오늘 정상 접수 · 8건';rows=Array.from({length:performance[22]},(_,i)=>[names[i],'010-****-'+String(1200+i),areas[i],pill('정상 접수','green')])}
 else{title='오늘 A/S · 1건';rows=[['김예시','010-0000-1200','경기도 부천시 예시로 1, 예시동 101호',pill('접수 중복','amber')]]}
 return panel(title,table(['고객명','전화번호','지역·주소',homeStatus==='as'?'A/S 사유':'상태'],rows));
}
function homeStatusButtons(){return `<div class="home-status-controls" role="group" aria-label="오늘 접수 상태별 목록">${[['pending','가접수 2건','pink'],['normal','정상 8건','green'],['as','A/S 1건','amber']].map(([key,label,color])=>`<button type="button" class="home-status-button ${color}" data-home-status="${key}" aria-pressed="${homeStatus===key}" aria-controls="tm-home-status-list">${label}</button>`).join('')}</div>`}
function home(){if(liveEmployee)return window.SalesWorkspace?.home()||'<p role="status">본인 실적을 불러오는 중입니다. 새로고침해 주세요.</p>';return `<section class="panel home-overview"><h2>실적관리</h2>${homeStatusButtons()}<p class="sub home-last-check">마지막 확인 16:40 · 예시 화면</p>${window.CNCHOME_LIVE?.user.role==='employee'?(window.AttendanceWorkspace?.homePanel()||'<section class="checkin-panel"><h3>오늘 출근</h3><span class="sub">불러오는 중…</span></section>'):`<div class="home-checkin-preview"><h3>오늘 출결</h3><span>10:00 출근</span>${pill(clockedOut?'퇴근 기록됨':'근무 중','green')}<button class="secondary" data-action="clockout" ${clockedOut?'disabled':''}>퇴근하기</button></div>`}</section><div id="tm-home-status-list" aria-live="polite">${homeStatusList()}</div>`+graph()+(gradeEmployeeAvailable()?panel('개인별 그레이드 지급 기준',`<h3>일그레이드</h3>${gradeSummaryTable('daily')}<h3>주그레이드(해당 주 평균 목표개수)</h3>${gradeSummaryTable('weekly')}<div style="margin-top:16px"><h3>월그레이드 기준표</h3>${gradeTable()}</div>`):'')}

const {regionMapShapes,regionBorders,regionHierarchyLabels,regionNamePoints,regionSelectedEdges}=window.CNCRegionGeometry;
// Preview settings; replace with saved administrator policy when backend is connected.
const intakeCodeStorageKey='cnchome.intakeCodes.v1';
let intakeCodes=IntakeCodeCatalog.read(null);
try{if(!window.CNCHOME_LIVE&&!window.PolicySync?.enabled)intakeCodes=IntakeCodeCatalog.read(localStorage.getItem(intakeCodeStorageKey))}catch(error){/* Default codes remain usable if storage is unavailable. */}
const regionCarrierSettings=[{id:'all',label:'가능지역 모두',visible:true,enabled:true},...intakeCodes.map(c=>({...c,visible:true,enabled:true}))];
function policyCodeHeader(text){return PolicyRegionRules.readIntakeCodeHeader(text,intakeCodes)}
const policyClientStorageKey='cnchome.policyClients.v1';
function policyReadClients(raw){
 const data=JSON.parse(raw||'null'),items=data?.version===1&&Array.isArray(data.clients)?data.clients:[];
 const seen=new Set(),names=new Set(),clients=items.filter(c=>{
  if(!c||!/^(?:legacy|client_[a-z0-9_]+)$/.test(c.id)||typeof c.label!=='string'||!c.label.trim()||c.label.length>60||seen.has(c.id)||names.has(c.label.trim()))return false;
  seen.add(c.id);names.add(c.label.trim());return true;
 }).map(c=>({id:c.id,label:c.label.trim()}));
 // Existing two-part policy keys belong to Metaverse. Preserve their IDs and data.
 if(!seen.has('legacy'))clients.unshift({id:'legacy',label:'메타버스'});
 return clients;
}
let policyClients=policyReadClients(null),policyPublicationClient='legacy',policyViewClient='legacy';
try{if(!window.CNCHOME_LIVE&&!window.PolicySync?.enabled)policyClients=policyReadClients(localStorage.getItem(policyClientStorageKey))}catch(error){}
function policyClientOptions(selected){return '<option value="">거래처 선택</option>'+policyClients.map(c=>'<option value="'+c.id+'" '+(selected===c.id?'selected':'')+'>'+policyEscape(c.label)+'</option>').join('')}
function policyClientKey(carrier,kind,client=policyPublicationClient){return client==='legacy'?carrier+':'+kind:carrier+':'+client+':'+kind}
function policyKeyParts(key){const parts=key.split(':');return {carrier:parts[0],client:parts.length===3?parts[1]:'legacy',kind:parts[parts.length-1]}}
function policyClientManagerPanel(){return panel('거래처 관리','<p class="sub">거래처를 먼저 등록한 뒤 거래처별로 한화·신한·G/A 등 접수 코드의 정책표를 올려 주세요.</p><button type="button" class="action" data-action="policy-client-add">거래처 추가</button>'+table(['거래처','등록 정책','관리'],policyClients.map(c=>[policyEscape(c.label),Object.keys(policyPublications).filter(k=>policyKeyParts(k).client===c.id).length+'건','<button type="button" class="secondary" data-action="policy-client-edit" data-client-id="'+c.id+'">수정</button>'])))}
function policyClientSave(input){
 if(window.PolicySync?.enabled)return policySaveClientServer(input);
 try{
  const label=String(input.label||'').trim();if(!label||label.length>60||/[\p{Cc}\p{Cf}]/u.test(label))throw new Error('거래처명은 1~60자로 입력해 주세요.');
  const clients=policyReadClients(localStorage.getItem(policyClientStorageKey));
  if(clients.some(c=>c.id!==input.id&&c.label.replace(/\s/g,'').toLowerCase()===label.replace(/\s/g,'').toLowerCase()))throw new Error('이미 등록된 거래처명입니다.');
  let id=input.id;
  if(id){const found=clients.find(c=>c.id===id);if(!found)throw new Error('수정할 거래처를 확인해 주세요.');found.label=label}
  else {let n=1;while(clients.some(c=>c.id==='client_'+n))n++;id='client_'+n;clients.push({id,label})}
  localStorage.setItem(policyClientStorageKey,JSON.stringify({version:1,clients}));
  policyClients=clients;return id;
 }catch(error){toast(error.message||'거래처를 저장하지 못했습니다.');return false}
}
root.addEventListener('click',e=>{
 const button=e.target.closest('[data-action^="policy-client-"]');if(!button)return;
 const client=policyClients.find(c=>c.id===button.dataset.clientId);
 open(client?'거래처 수정':'거래처 추가','<form id="tm-policy-client-form" data-client-id="'+(client?.id||'')+'"><label>거래처명<input name="label" required maxlength="60" value="'+policyEscape(client?.label||'')+'" placeholder="거래처 이름"></label><button type="submit" class="action">저장</button></form>');
});
root.addEventListener('submit',async e=>{
 if(e.target.id!=='tm-policy-client-form')return;e.preventDefault();
 const id=await policyClientSave({id:e.target.dataset.clientId,label:new FormData(e.target).get('label')});
 if(id){policyPublicationClient=id;modal.close();render();toast('거래처를 저장했습니다.')}
});
function intakeCodeOptions(selected=''){
 return '<option value="">접수 코드 선택</option>'+intakeCodes.map(c=>'<option value="'+c.id+'" '+(selected===c.id?'selected':'')+'>'+policyEscape(c.label)+'</option>').join('');
}
function intakeCodeManagerContent(){
 return '<p class="sub">접수 코드를 추가하거나 이름을 수정합니다. 이름을 바꿔도 기존 지역·수량 정책은 유지되며 이전 이름으로 된 표도 연결됩니다.</p><button type="button" class="action" data-action="intake-code-add">접수 코드 추가</button>'+table(['접수 코드','표에서 사용하는 다른 표기','등록 정책','관리'],intakeCodes.map(c=>[policyEscape(c.label),c.aliases.map(policyEscape).join(', ')||'—',Object.keys(policyPublications).filter(key=>key.startsWith(c.id+':')).length+'건','<button type="button" class="secondary" data-action="intake-code-edit" data-code-id="'+c.id+'" aria-label="'+policyEscape(c.label)+' 접수 코드 수정">수정</button>']))+'<p class="sub">새 코드는 정책 등록 목록과 접수 입력 화면에 바로 표시됩니다. 가능지역 목록·지도에는 해당 코드의 정책을 등록한 뒤 표시됩니다. 저장한 접수 코드는 서버에서 직원 페이지와 공유됩니다.</p>';
}
function intakeCodeManagerPanel(){return panel('접수 코드 관리','<div id="tm-intake-code-manager">'+intakeCodeManagerContent()+'</div>')}
function intakeCodeRefreshViews(){
 const manager=root.querySelector('#tm-intake-code-manager');if(manager)manager.innerHTML=intakeCodeManagerContent();
 const select=root.querySelector('#tm-policy-publication-carrier');if(select)select.innerHTML=intakeCodeOptions(policyPublicationCarrier);
 const intakeSelect=root.querySelector('#tm-intake-code');if(intakeSelect){const value=intakeSelect.value;intakeSelect.innerHTML=intakeCodeOptions(value)}
 if(page==='regions')render();
 if(['adminIntake','adminPolicy'].includes(page)){policyRefreshPreview();policyRefreshRegistered()}
}
function intakeCodeSave(input){
 if(window.PolicySync?.enabled)return policySaveCodeServer(input);
 try{
  // Merge against the latest saved registry so another tab's additions are retained.
  const current=IntakeCodeCatalog.read(localStorage.getItem(intakeCodeStorageKey));
  const next=IntakeCodeCatalog.upsert(current,input);
  localStorage.setItem(intakeCodeStorageKey,IntakeCodeCatalog.serialize(next));
  intakeCodes=next;regionCarrierSettings.splice(1,regionCarrierSettings.length-1,...intakeCodes.map(c=>({...c,visible:true,enabled:true})));
  intakeCodeRefreshViews();return true;
 }catch(error){
  const message=error.name==='QuotaExceededError'||error.name==='SecurityError'?'접수 코드를 저장하지 못했습니다. 브라우저 저장 공간과 권한을 확인해 주세요.':error.message;
  const target=root.querySelector('#tm-intake-code-error');if(target)target.textContent=message;else toast(message);
  return false;
 }
}
function intakeCodeOpen(id=''){
 if(policyOcrRunning){toast('OCR 분석이 끝난 뒤 접수 코드를 수정해 주세요.');return}
 const code=intakeCodes.find(c=>c.id===id);if(id&&!code)return;
 open(code?'접수 코드 수정':'접수 코드 추가','<form id="tm-intake-code-form" data-code-id="'+(code?.id||'')+'"><div class="fields"><label class="full">접수 코드 이름<input name="label" required maxlength="40" value="'+policyEscape(code?.label||'')+'" placeholder="예: 한화, 신한, G/A"></label><label class="full">다른 표기 (선택)<input name="aliases" value="'+policyEscape(code?.aliases.join(', ')||'')+'" placeholder="표에서 쓰는 다른 이름을 쉼표로 구분"></label></div><p class="sub">완전히 일치하는 코드 표제만 구분합니다. 지역명이나 OCR 원문은 바꾸지 않습니다.</p><p id="tm-intake-code-error" role="alert"></p><button type="submit" class="action">'+(code?'수정 저장':'추가 저장')+'</button></form>');
}
root.addEventListener('click',e=>{const button=e.target.closest('[data-action^="intake-code-"]');if(!button)return;intakeCodeOpen(button.dataset.action==='intake-code-edit'?button.dataset.codeId:'')});
root.addEventListener('submit',async e=>{
 if(e.target.id!=='tm-intake-code-form')return;e.preventDefault();if(!e.target.reportValidity())return;
 const form=new FormData(e.target),id=e.target.dataset.codeId;
 if(await intakeCodeSave({...(id?{id}:{}),label:String(form.get('label')||''),aliases:String(form.get('aliases')||'').split(/[,，\n]/).map(s=>s.trim()).filter(Boolean)})){
  modal.close();toast(id?'접수 코드가 수정되었습니다. 기존 정책 연결은 유지됩니다.':'접수 코드가 추가되었습니다. 정책표를 등록해 주세요.');
 }
});
let mapCarrier='all', mapSelectedGroup=null, mapHoveredGroup=null;
const jejuShapes=[{"name":"제주시","d":"M275.2,748.5L275,749.2L276.1,749.2L276.5,750.2L276,751.1L276.2,751.9L275.6,752L275.2,752.8L273.3,753.1L270,755.3L266.8,756.7L266.4,757.5L264.8,757.8L263.9,758.5L262.7,758.2L262.2,759.1L259.8,760.8L257.6,761L256.5,760.2L253.3,761L249.6,763.6L248.7,763.4L247.4,764.5L245.3,764.6L244.5,765.7L239.2,767.4L237.3,767.4L236.9,767.1L234.2,768.7L232.2,768.8L231.7,769.2L230.9,769L230,769.6L229.1,769L228.4,769.3L225.3,769L224.1,769.6L223.6,771.4L219.1,771.1L217.9,770.7L216.9,770.9L216.6,771.4L214.7,771.5L213.4,771.1L211.5,773.4L209.7,773.3L208.6,774L208.2,775.5L206.7,776.9L203.8,777.8L203,778.4L202.7,779.1L202.9,780.4L201.3,778.9L198,777.3L197.1,777.1L197.1,777.7L194.9,778.3L194.6,779.1L193.7,778.1L194.4,777.1L194,775.8L194.5,774.6L194.3,773.8L193.9,773.7L193.9,772.9L194.2,772.8L193.8,772.4L194.4,771.7L194.3,771.2L194.5,771.4L195.8,770.8L196.1,769.1L198.6,767.8L198.6,767.4L199.7,766.6L199.7,765.8L200.6,765L201.7,765.1L202.1,764.3L202.6,764.3L203.5,763.5L203.8,762.4L204.5,762.4L204.3,762.2L204.1,762.5L203.9,761.9L204.9,761.5L204.8,760.8L204.5,760.7L204.4,761.3L204.3,760.8L204.6,760.4L205.1,760.6L204.9,758.8L206,759.1L207.2,757.8L207.9,758L208.8,757.6L209.7,756.7L210.1,755.8L209.9,755L210.4,754.5L211.4,754.9L212.5,754.5L212.9,754.9L214.6,754L214.9,753.4L216.6,753.3L218.8,751.8L219.4,752.6L220.8,752.5L221.2,751.8L222.3,751.7L222.8,751.1L223.5,751.3L225,750.7L225.7,750.8L225.9,749.9L226.7,749.8L226.9,750.1L227,749.6L227.4,749.8L227.3,749.4L228.6,749.3L229.2,749L229.4,748.2L230.4,747.7L231.1,748.2L232.6,748.4L232.9,747.9L234.5,748.2L234.5,747.7L234.9,747.9L235.7,747.5L235.6,746.6L236.1,747.3L236.9,747.3L236.2,747.6L236.4,747.8L237.5,747.5L237.8,746.9L238.2,747.3L238.6,746.9L239.1,747.2L239.2,746.8L240.3,747.1L241.7,745.5L242.3,745.9L243.5,745.5L245.8,745.8L245.9,744.5L246.9,743.2L247.5,743.5L247.2,744L247.6,744L247.8,743.5L249.2,744.9L250.2,744.5L250.6,743.6L251.8,744.1L252.8,743.6L254.8,743.4L255.1,742.9L256.3,742.5L257.2,743.3L258,743.1L257.3,742.9L257.4,742.6L259.4,743L259.8,742.8L259.8,741.9L260.2,741.8L261.2,741.9L261.2,742.4L261.7,741.8L261.9,742.1L262.2,741.9L263.8,743.2L265.5,742.4L267,742.7L266.8,743.3L267.3,743.8L267,744.2L267.2,744.8L268.5,746.1L269.4,746.1L270.9,747.2L271.3,746.6L271.9,746.5L272.9,746.6L273.2,747L273.8,746.8L275.6,747.8L275.1,748.1L275.2,748.5Z","b":[193.7,741.8,276.5,780.4]},{"name":"서귀포시","d":"M276.3,753.2L276.4,754.1L277.2,754.5L277.7,754.2L277.3,755.2L277.6,756.4L278.5,755.3L278.1,754.8L278.2,754L278.9,754L278.9,753.3L279,755.2L280,755.8L279.9,756.4L278.8,755.7L278.3,755.9L277.5,757.1L277.5,758.5L279,759.8L278.2,760.7L277.5,760.2L277.7,759.2L276.8,759.2L277,760.1L276.2,761.4L275.9,762.8L275.3,763.4L275.8,763.9L275.7,764.8L273.2,765.9L271.8,767.5L272.1,767.5L272.1,767.9L271.4,768.4L271.7,768.7L271.1,770.5L270.6,770.7L270.2,771.8L268.8,772.5L268.9,773.5L269.5,773.6L269.3,774.3L268.8,774.3L267.3,776L265.8,775.8L264.9,776.6L264.6,776.1L263.1,776.5L261.4,776L261,776.8L260.3,777L260.1,777.9L258.6,778.8L258,779.7L257.4,779.8L256.6,779.3L256.4,779.7L255.9,779.5L252.9,780.7L250.6,780.7L250.5,781.2L248.4,780.3L248.7,780.9L246.6,781.4L246.8,781.9L246.3,782.2L246.4,782.5L244.2,783.5L244,784.5L242.4,785L242,785.5L241.3,785.2L241,784.6L239.6,784.1L238.6,784.3L238.4,784.7L238.8,785.4L238.4,785.7L238.7,785.3L237.7,784.3L237.5,784.9L238.1,785.4L236.5,784.6L235.8,784.9L235.4,784.5L234.6,784.9L233.3,784.6L232.2,786L230.8,786.2L230.7,785.8L230,785.7L229.2,786.3L228.5,786.3L228.6,786.9L228,787L226.8,785.9L226.6,784.8L225.7,784.5L223.2,785.4L222,784.3L220.9,784.1L218.5,785.5L217.4,785.6L217,786.1L216.3,785.9L216.3,786.2L215.8,785.1L215.7,785.4L213.9,785.2L212,785.8L212.9,785.4L212.8,784.9L212,784.6L210.8,785.2L210,786.4L209.2,786.5L208.7,787.1L207.9,789.2L208.4,790.4L207.7,790.5L207.3,789.9L205.7,790.8L204.7,789.9L205,789.8L205,788.8L204.1,788.7L203.5,787.3L203.3,787.7L202.5,787.2L201.7,785.4L200.1,784.4L198.3,784L196,782.1L195.7,781.1L194.6,780.1L194.7,778.5L197.1,777.7L197.1,777.1L200.8,778.6L202.9,780.4L202.7,779.1L203,778.4L203.8,777.8L206.7,776.9L208.2,775.5L208.6,774L209.7,773.3L211.5,773.4L213.4,771.1L214.7,771.5L216.6,771.4L216.9,770.9L217.9,770.7L219.1,771.1L223.6,771.4L224.1,769.6L225.3,769L228.2,769.3L229.1,769L230,769.6L230.9,769L231.7,769.2L232.2,768.8L234.8,768.5L236.9,767.1L237.3,767.4L240.8,767.1L242.8,766L244.7,765.6L245.3,764.6L247.4,764.5L248.7,763.4L249.6,763.6L253.3,761L256.5,760.2L257.6,761L259.8,760.8L262.2,759.1L262.7,758.2L263.9,758.5L264.8,757.8L266.4,757.5L266.8,756.7L270,755.3L273.3,753.1L274.8,752.7L275.9,753.4L276.3,753.2Z","b":[194.6,752.7,280,790.8]}];
const jejuRegionIndex=regions.length;
regions.push(['제주도','제주특별자치도','자료 대기',null,'접수 수량 확인 필요','제주시 · 서귀포시']);
// Use the same city geometry and group for rendering, focus bounds, and hover labels.
jejuShapes.forEach(city=>{
 city.group=jejuRegionIndex;
 const shape=regionMapShapes.find(f=>f.name===city.name);
 if(shape)Object.assign(shape,city);
});
const regionInsurancePolicies=regions.map(r=>({hanwha:{general:null,silver:null,unclassified:r[2]},shinhan:{general:null,silver:null},ga:{general:null,silver:r[3]}}));
function visibleRegionCarriers(){
 return regionCarrierSettings.filter(c=>c.id!=='all'&&c.visible&&c.enabled&&regionInsurancePolicies.some(p=>['general','silver'].some(kind=>p[c.id]?.[kind]!=null)));
}
function normalizeMapCarrier(){
 if(mapCarrier!=='all'&&!visibleRegionCarriers().some(c=>c.id===mapCarrier))mapCarrier='all';
}
function availableInsuranceItems(r,general){if(policyHasPublications())return policyPublishedInsuranceItems(r,general);const p=regionInsurancePolicies[regions.indexOf(r)],kind=general?'general':'silver';return visibleRegionCarriers().filter(c=>mapCarrier==='all'||mapCarrier===c.id).flatMap(c=>{const amount=p[c.id][kind];return amount&&Number(amount.split('/')[1])>0?[{label:c.label+' '+(general?'일반':'실버'),amount,remaining:Number(amount.split('/')[1])}]:[]});}
function regionCanReceive(r,general){return availableInsuranceItems(r,general).length>0;}
root.addEventListener('click',e=>{const b=e.target.closest('[data-map-carrier]');if(!b||b.disabled)return;mapCarrier=b.dataset.mapCarrier;root.querySelectorAll('[data-map-carrier]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.mapCarrier===mapCarrier)));filterRegions();});

function updateMapLabels(svg){
 if(policyHasPublications()){policyPublishedMapLabels(svg);return;}
 if(!svg)return;
 const layer=svg.querySelector('.map-label-layer');if(!layer)return;
 const host=svg.parentElement;
 const v=svg.viewBox.baseVal,dims=[v.x,v.y,v.width,v.height];
 const fullWidth=Number(svg.dataset.fullWidth),fullHeight=Number(svg.dataset.fullHeight);
 const showLabels=mapHoveredGroup!==null;
 layer.style.display=showLabels?'':'none';
 if(!showLabels){layer.innerHTML='';highlightMapRegionRow(null);return;}
 const general=(root.querySelector('#tm-age')?.selectedIndex??2)===0;
 const activeGroup=mapHoveredGroup??mapSelectedGroup;
 const extent=regionMapShapes.map(f=>f.b);
 const minX=Math.min(...extent.map(b=>b[0])),minY=Math.min(...extent.map(b=>b[1])),maxX=Math.max(...extent.map(b=>b[2])),maxY=Math.max(...extent.map(b=>b[3]));
 const inView=f=>f.b[2]>=dims[0]&&f.b[0]<=dims[0]+dims[2]&&f.b[3]>=dims[1]&&f.b[1]<=dims[1]+dims[3];
 const labelGroups=[...new Set(regionMapShapes.filter(f=>f.group>=0&&inView(f)&&(mapHoveredGroup===null||f.group===mapHoveredGroup)).map(f=>f.group))];
 // Keep label dimensions in map units so boxes and text scale with every zoom level.
 const baseLabelHeight=(maxY-minY+6)*.115,baseFontSize=(maxX-minX+6)*.021;
 const labelMeasure=document.createElement('canvas').getContext('2d'),labelFont=getComputedStyle(host).fontFamily;
 const textWidth=(text,size,weight=400)=>{labelMeasure.font=weight+' '+size+'px '+labelFont;return labelMeasure.measureText(text).width;};
 const labels=labelGroups.sort((a,b)=>Number(a===activeGroup)-Number(b===activeGroup)).map(i=>{
  const labelScale=i===mapHoveredGroup?1.5:1;
  let labelHeight=baseLabelHeight*labelScale,fontSize=baseFontSize*labelScale;
  const r=regions[i],items=[];
  items.push(...availableInsuranceItems(r,general).map(item=>item.label+' '+item.remaining+'건'));
  if(!items.length){if(i===jejuRegionIndex)items.push('접수 수량 확인 필요');else if(i===mapHoveredGroup)items.push('현재 접수 가능한 수량 없음');else return null;}
  let labelWidth=Math.max(textWidth(r[0],fontSize,700),textWidth(items.join(' · '),fontSize),textWidth('남은 수량 · 묶음 공유',fontSize*.8))+fontSize*1.1;
  // Scale normally, but keep oversized labels fully inside the viewport.
  const fitScale=Math.min(1,dims[2]*.94/labelWidth,dims[3]*.94/labelHeight);
  labelWidth*=fitScale;labelHeight*=fitScale;fontSize*=fitScale;
  const visible=regionMapShapes.filter(f=>f.group===i&&inView(f)),bb=visible.map(f=>f.b);
  const cx=(Math.max(dims[0],Math.min(...bb.map(b=>b[0])))+Math.min(dims[0]+dims[2],Math.max(...bb.map(b=>b[2]))))/2;
  const cy=(Math.max(dims[1],Math.min(...bb.map(b=>b[1])))+Math.min(dims[1]+dims[3],Math.max(...bb.map(b=>b[3]))))/2;
  return {i,r,items,cx,cy,labelWidth,labelHeight,fontSize};
 }).filter(Boolean);
 const gap=Math.min(dims[2],dims[3])*.012;
 const left=dims[0]+gap,top=dims[1]+gap,right=dims[0]+dims[2]-gap,bottom=dims[1]+dims[3]-gap;
 const occupied=[];
 let packed=true;
 for(const label of labels){
  const w=label.labelWidth,h=label.labelHeight;
  const x=Math.max(left,Math.min(label.cx-w/2,right-w)),y=Math.max(top,Math.min(label.cy-h/2,bottom-h));
  const xs=[x,left,right-w,...occupied.flatMap(b=>[b.x+b.w+gap,b.x-w-gap])];
  const ys=[y,top,bottom-h,...occupied.flatMap(b=>[b.y+b.h+gap,b.y-h-gap])];
  const candidates=xs.flatMap(x=>ys.map(y=>({x,y}))).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));
  const spot=candidates.find(p=>p.x>=left&&p.y>=top&&p.x+w<=right&&p.y+h<=bottom&&!occupied.some(b=>p.x<b.x+b.w+gap&&p.x+w+gap>b.x&&p.y<b.y+b.h+gap&&p.y+h+gap>b.y));
  if(!spot){packed=false;break;}
  label.lx=spot.x;label.ly=spot.y;occupied.push({...spot,w,h});
 }
 // If geographic placement cannot fit every box, use disjoint cells with one shared scale.
 if(!packed&&labels.length){
  const maxWidth=Math.max(...labels.map(l=>l.labelWidth)),maxHeight=Math.max(...labels.map(l=>l.labelHeight));
  let best=null;
  for(let cols=1;cols<=labels.length;cols++){
   const rows=Math.ceil(labels.length/cols),cw=(right-left)/cols,ch=(bottom-top)/rows;
   const scale=Math.min(1,cw*.92/maxWidth,ch*.92/maxHeight);
   if(!best||scale>best.scale)best={cols,cw,ch,scale};
  }
  labels.sort((a,b)=>a.cy-b.cy||a.cx-b.cx);
  labels.forEach((label,index)=>{
   label.labelWidth*=best.scale;label.labelHeight*=best.scale;label.fontSize*=best.scale;
   label.lx=left+(index%best.cols)*best.cw+(best.cw-label.labelWidth)/2;
   label.ly=top+Math.floor(index/best.cols)*best.ch+(best.ch-label.labelHeight)/2;
  });
 }
 // Keep hover cards at a fixed screen size and pin them to the map's upper-left corner.
 if(mapHoveredGroup!==null&&labels.length){
  const matrix=svg.getScreenCTM();
  const unitsPerPixel=matrix?1/Math.max(.001,Math.hypot(matrix.a,matrix.b)):dims[2]/Math.max(1,host.clientWidth);
  for(const label of labels){
   label.labelWidth=320*unitsPerPixel;
   label.labelHeight=150*unitsPerPixel;
   label.fontSize=26*unitsPerPixel;
   label.lx=dims[0]+12*unitsPerPixel;
   label.ly=dims[1];
  }
 }
 const mapLabels=labels.map(({i,r,items,cx,cy,labelWidth,labelHeight,fontSize,lx,ly})=>{
  return `<g class="map-item-label" data-map-label-group="${i}" pointer-events="none"><line x1="${cx}" y1="${cy}" x2="${lx+labelWidth/2}" y2="${ly+labelHeight/2}" stroke="#526b86" stroke-width="1" vector-effect="non-scaling-stroke"/><rect x="${lx}" y="${ly}" width="${labelWidth}" height="${labelHeight}" rx="${fontSize*.5}" fill="#fff" fill-opacity=".9" stroke="#7894b5" stroke-width="1" vector-effect="non-scaling-stroke"/><text x="${lx+fontSize*.55}" y="${ly+fontSize*1.35}" font-size="${fontSize}" font-weight="700" fill="#173653">${r[0]}</text><text x="${lx+fontSize*.55}" y="${ly+fontSize*2.7}" font-size="${fontSize}" fill="#1457bb">${policyEscape(items.join(' · '))}</text><text x="${lx+fontSize*.55}" y="${ly+fontSize*3.9}" font-size="${fontSize*.8}" fill="#61738b">남은 수량 · 묶음 공유</text></g>`;
 }).join('');
 highlightMapRegionRow(null);policyFollowMap(null);
 layer.innerHTML=mapLabels;
}

function layoutMapRegionNames(svg){
 if(!svg)return;updateMapLabels(svg);const v=svg.viewBox.baseVal,r=svg.getBoundingClientRect();
 if(!r.width||!r.height)return;
 const scale=Math.min(r.width/v.width,r.height/v.height),size=12.6/scale,boxes=[];
 const bounds=regionMapShapes.map(f=>f.b),fullWidth=Math.max(...bounds.map(b=>b[2]))-Math.min(...bounds.map(b=>b[0]))+6,zoom=fullWidth/v.width;
 const rank=el=>el.dataset.level==='province'?(zoom<3?3:0):el.dataset.level==='detail'?(zoom>=3?4:0):2;
 const names=[...svg.querySelectorAll('.map-region-name')].sort((a,b)=>rank(b)-rank(a)||Number(b.dataset.priority)-Number(a.dataset.priority));
 for(const label of names){
  if(label.dataset.level==='detail'&&zoom<3||label.dataset.level==='province'&&zoom>=3){label.style.display='none';continue;}
  const x=Number(label.getAttribute('x')),y=Number(label.getAttribute('y'));
  label.setAttribute('font-size',size);
  if(x<v.x||x>v.x+v.width||y<v.y||y>v.y+v.height){label.style.display='none';continue;}
  const w=label.textContent.length*size*.94,h=size*1.2,b={x:x-w/2,y:y-h/2,w,h};
  if(boxes.some(a=>b.x<a.x+a.w&&b.x+b.w>a.x&&b.y<a.y+a.h&&b.y+b.h>a.y)){label.style.display='none';continue;}
  label.style.display='';boxes.push(b);
 }
}

function updateRegionMap(){
 const host=root.querySelector('#tm-region-map');if(!host)return;
 const q=(root.querySelector('#tm-region-search')?.value||'').trim();
 const general=(root.querySelector('#tm-age')?.selectedIndex??2)===0;
 const matches=regions.map((r,i)=>(policyHasPublications()?policyPublishedSearchMatch(i,q):r.join(' ').includes(q))?i:-1).filter(i=>i>=0);
 const available=i=>i>=0&&regionCanReceive(regions[i],general);
 const activeGroup=mapHoveredGroup??mapSelectedGroup;
 const focused=f=>activeGroup!==null?f.group===activeGroup:!!q&&matches.includes(f.group);
 const selected=regionMapShapes.filter(focused);
 
 const combinedShapes=regionMapShapes;
 const extent=combinedShapes.map(f=>f.b);const minX=Math.min(...extent.map(b=>b[0])),minY=Math.min(...extent.map(b=>b[1])),maxX=Math.max(...extent.map(b=>b[2])),maxY=Math.max(...extent.map(b=>b[3]));let box=[minX-1,minY-1,maxX-minX+2,maxY-minY+2].join(' ');
 if(selected.length){const b=selected.map(f=>f.b),x=Math.min(...b.map(a=>a[0])),y=Math.min(...b.map(a=>a[1])),w=Math.max(...b.map(a=>a[2]))-x,h=Math.max(...b.map(a=>a[3]))-y;const ratio=(maxX-minX+2)/(maxY-minY+2);let vw=Math.max(w*2*Math.sqrt(3),8),vh=Math.max(h*2*Math.sqrt(3),8);if(vw/vh<ratio)vw=vh*ratio;else vh=vw/ratio;let viewX=x+w/2-vw/2,viewY=y+h/2-vh/2;if(mapHoveredGroup!==null){/* Match the supplied 537 × 492 reference: Seoul with surrounding provinces visible. */const hoverRatio=537/492;vw=Math.max(320,w*1.35);vh=Math.max(vw/hoverRatio,h*1.7);vw=vh*hoverRatio;const threeWheelSteps=Math.exp(3*100*.0015);vw*=threeWheelSteps;vh*=threeWheelSteps;viewX=x+w/2-vw/2;viewY=y+h/2-vh/2;}box=[viewX,viewY,vw,vh].join(' ')}
 const visibleShapes=combinedShapes;
 const paths=visibleShapes.map((f,index)=>{const on=available(f.group),hit=focused(f),status=policyHasPublications()?policyMapShapeStatus(f,index):null;return `<path d="${f.d}" class="region-shape ${f.name.endsWith('군')?'region-county':''} ${status?'region-policy-'+status.state:on?'region-available':''} ${hit?'region-match':''}" data-map-group="${f.group}" data-map-shape="${regionMapShapes.indexOf(f)}" ${f.group>=0?'tabindex="0" role="button"':''} aria-label="${f.name} · ${status?status.label:on?'접수 가능':'접수 불가 또는 자료 없음'}"><title>${f.name} · ${status?status.label:on?'접수 가능':'접수 불가 또는 자료 없음'}</title></path>`}).join('');
 const jb=jejuShapes.map(f=>f.b),jx=Math.min(...jb.map(b=>b[0])),jy=Math.min(...jb.map(b=>b[1])),jw=Math.max(...jb.map(b=>b[2]))-jx,jh=Math.max(...jb.map(b=>b[3]))-jy;
 const jejuLabel=`<text x="${jx+jw*.5}" y="${jy+jh*.51}" text-anchor="middle" dominant-baseline="middle" font-size="${jw*.12}" font-weight="700" fill="#174265" stroke="#fff" stroke-width="${jw*.008}" paint-order="stroke" pointer-events="none">제주도</text>`;
 const dims=box.split(' ').map(Number);
 const regionNames=regionHierarchyLabels.map(label=>`<text class="map-region-name" data-level="${label.level}" data-priority="${!policyHasPublications()&&activeGroup!==null&&label.group===activeGroup?1:0}" x="${label.point[0]}" y="${label.point[1]}" text-anchor="middle" dominant-baseline="middle" pointer-events="none">${label.name}</text>`).join('');
 host.style.setProperty('--map-ratio',dims[2]/dims[3]);host.innerHTML=`<svg viewBox="${box}" data-full-width="${maxX-minX+2}" data-full-height="${maxY-minY+2}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="전국 접수 가능지역 지도">${paths}<defs><clipPath id="tm-selected-map-clip">${visibleShapes.filter(f=>!focused(f)&&!available(f.group)).map(f=>`<path d="${f.d}"/>`).join('')}</clipPath><clipPath id="tm-available-inner-clip">${visibleShapes.filter(f=>available(f.group)||focused(f)).map(f=>`<path d="${f.d}"/>`).join('')}</clipPath></defs><g clip-path="url(#tm-selected-map-clip)"><path d="${regionBorders.city}" class="map-city-border"/><path d="${regionBorders.province}" class="map-province-border"/></g><path d="${regionBorders.city}" class="map-shared-inner-border" clip-path="url(#tm-available-inner-clip)"/>${[...new Set(visibleShapes.filter(f=>available(f.group)&&!focused(f)).map(f=>f.group))].map(i=>`<path d="${(!policyHasPublications()&&regionSelectedEdges[i])||combinedShapes.filter(f=>f.group===i).map(f=>f.d).join(' ')}" class="map-availability-border"/>`).join('')}${[...new Set(selected.map(f=>f.group))].filter(i=>i>=0).map(i=>`<path d="${(!policyHasPublications()&&regionSelectedEdges[i])||combinedShapes.filter(f=>f.group===i).map(f=>f.d).join(' ')}" class="map-availability-border map-search-border"/>`).join('')}${regionNames}${jejuLabel}<g class="map-label-layer"></g></svg>`;
 const renderedMap=host.querySelector(':scope > svg');
 layoutMapRegionNames(renderedMap);
 // Recalculate fixed pixel card dimensions after layout and whenever the map resizes.
 host._mapResizeObserver?.disconnect();
 host._mapResizeObserver=new ResizeObserver(()=>{
  if(renderedMap.isConnected)layoutMapRegionNames(renderedMap);
 });
 host._mapResizeObserver.observe(renderedMap);
 requestAnimationFrame(()=>{if(renderedMap.isConnected)layoutMapRegionNames(renderedMap);});
}
root.addEventListener('click',e=>{const choice=e.target.closest('[data-region-select]');if(choice){mapSelectedGroup=Number(choice.dataset.regionSelect);mapHoveredGroup=null;filterRegions();return}});
root.addEventListener('input',e=>{if(e.target.id==='tm-region-search'){mapSelectedGroup=null;mapHoveredGroup=null;}},true);
function previewTableRegion(e){const row=e.target.closest('#tm-region-results tr');const button=row?.querySelector('[data-region-select]');if(!button||row.contains(e.relatedTarget))return;mapSelectedGroup=Number(button.dataset.regionSelect);mapHoveredGroup=null;updateRegionMap();}
function highlightMapRegionRow(group){
 root.querySelectorAll('#tm-region-results [data-region-select]').forEach(button=>{
  button.closest('tr')?.classList.toggle('map-row-highlight',group!==null&&Number(button.dataset.regionSelect)===group);
 });
}
function clearMapHoverMemo(){
 mapHoveredGroup=null;
 const svg=root.querySelector('#tm-region-map > svg');
 if(svg){svg.querySelectorAll('.map-search-border').forEach(path=>path.remove());svg.querySelectorAll('.region-match').forEach(path=>path.classList.remove('region-match'));updateMapLabels(svg)}
 highlightMapRegionRow(null);policyFollowMap(null);
}
function mapCanShowMemo(target){return !!target?.matches?.('.region-available, .region-policy-possible, .region-policy-partial, .region-policy-blocked, .region-policy-review')}
function mapRegionHoverTarget(target){
 return target?.closest?.('#tm-region-map [data-map-label-group], #tm-region-map [data-map-group]')??null;
}
function mapRegionHoverGroup(target){
 if(!target)return null;
 const group=Number(target.dataset.mapLabelGroup??target.dataset.mapGroup);
 return Number.isInteger(group)&&group>=0?group:null;
}
root.addEventListener('mouseover',e=>{
 const target=mapRegionHoverTarget(e.target);
 if(!target||target.contains(e.relatedTarget))return;
 const group=mapRegionHoverGroup(target);
 if(!mapCanShowMemo(target)){clearMapHoverMemo();return}
 if(target.matches('[data-map-group]')&&group!==null){
  const svg=root.querySelector('#tm-region-map > svg');
  if(svg){
   mapHoveredGroup=group;
   svg.querySelectorAll('.region-shape[data-map-group]').forEach(path=>{
    path.classList.toggle('region-match',Number(path.dataset.mapGroup)===group);
   });
   svg.querySelectorAll('.map-search-border').forEach(path=>path.remove());
   const outline=document.createElementNS('http://www.w3.org/2000/svg','path');
   const shapes=regionMapShapes.filter(f=>f.group===group);
   outline.setAttribute('d',(!policyHasPublications()&&regionSelectedEdges[group])||shapes.map(f=>f.d).join(' '));
   outline.setAttribute('class','map-availability-border map-search-border');
   outline.setAttribute('pointer-events','none');
   svg.insertBefore(outline,svg.querySelector('.map-label-layer'));
   updateMapLabels(svg);
  }
 }
 highlightMapRegionRow(group);policyFollowMap(group,policyMapBindings[Number(target.dataset.mapShape)]?.path||[]);
});
root.addEventListener('mouseout',e=>{
 const target=mapRegionHoverTarget(e.target);
 if(!target||target.contains(e.relatedTarget))return;
 const next=mapRegionHoverTarget(e.relatedTarget);
 if(!mapCanShowMemo(next)){clearMapHoverMemo();return}
 highlightMapRegionRow(mapRegionHoverGroup(next));
});
root.addEventListener('mouseover',previewTableRegion);

root.addEventListener('focusin',previewTableRegion);

root.addEventListener('wheel',e=>{
 const host=e.target.closest('#tm-region-map');if(!host)return;
 const svg=host.querySelector('svg');if(!svg)return;e.preventDefault();
 const v=svg.viewBox.baseVal,r=svg.getBoundingClientRect();
 const centerX=v.x+v.width/2,centerY=v.y+v.height/2;
 const unit=e.deltaMode===1?16:e.deltaMode===2?r.height:1;
 const factor=Math.exp(Math.max(-.3,Math.min(.3,e.deltaY*unit*.0015)));
 const width=Math.max(8,Math.min(1800,v.width*factor)),ratio=width/v.width,height=v.height*ratio;
 svg.setAttribute('viewBox',[centerX-width/2,centerY-height/2,width,height].join(' '));layoutMapRegionNames(svg);


},{passive:false});

let mapDrag=null,mapSuppressClick=false;
root.addEventListener('pointerdown',e=>{
 const host=e.target.closest('#tm-region-map');
 if(!host||e.button!==0)return;
 const svg=host.querySelector(':scope > svg');if(!svg)return;
 const box=svg.viewBox.baseVal,rect=svg.getBoundingClientRect();
 const scale=Math.min(rect.width/box.width,rect.height/box.height);
 mapDrag={host,svg,id:e.pointerId,startX:e.clientX,startY:e.clientY,x:box.x,y:box.y,w:box.width,h:box.height,scale,moved:false};
 mapSuppressClick=false;
},true);
root.addEventListener('pointermove',e=>{
 if(!mapDrag||e.pointerId!==mapDrag.id)return;
 const d=mapDrag,dx=e.clientX-d.startX,dy=e.clientY-d.startY;
 if(!d.moved&&Math.hypot(dx,dy)<4)return;
 if(!d.moved){d.moved=true;d.host.setPointerCapture(e.pointerId);d.host.classList.add('map-dragging');}
 e.preventDefault();
 d.svg.setAttribute('viewBox',[d.x-dx/d.scale,d.y-dy/d.scale,d.w,d.h].join(' '));layoutMapRegionNames(d.svg);
});
function finishMapDrag(e){
 if(!mapDrag||e.pointerId!==mapDrag.id)return;
 const d=mapDrag;mapDrag=null;mapSuppressClick=d.moved;
 d.host.classList.remove('map-dragging');
 if(d.host.hasPointerCapture(e.pointerId))d.host.releasePointerCapture(e.pointerId);
}
root.addEventListener('pointerup',finishMapDrag);
root.addEventListener('pointercancel',finishMapDrag);
root.addEventListener('lostpointercapture',finishMapDrag);
root.addEventListener('pointerleave',e=>{if(mapDrag&&!mapDrag.moved)finishMapDrag(e);});
root.addEventListener('click',e=>{
 if(mapSuppressClick&&e.target.closest('#tm-region-map')){
  mapSuppressClick=false;e.preventDefault();e.stopImmediatePropagation();
 }
},true);

root.addEventListener('dblclick',e=>{
 if(!e.target.closest('#tm-region-map'))return;
 e.preventDefault();mapSelectedGroup=null;mapHoveredGroup=null;mapSuppressClick=false;
 const search=root.querySelector('#tm-region-search');if(search)search.value='';filterRegions();

});
function regionPolicyDateBadge(savedAt,example=false){
 const info=PolicyDates.describe(savedAt);
 return '<span class="policy-date-badge '+info.state+'">'+(example?'<span class="policy-example-label">예시</span>':'')+'<span>'+policyEscape(info.label)+'</span>'+(info.freshness?'<strong>'+policyEscape(info.freshness)+'</strong>':'')+'</span>';
}
function policyActiveEntries(){return Object.entries(policyPublications).filter(([,item])=>!window.PolicySync?.enabled||PolicyDates.day(item.savedAt)===PolicyDates.day(new Date()))}
function regionPolicyEntries(){return policyActiveEntries().filter(([key])=>policyKeyParts(key).client===policyViewClient)}
function regionPolicyDateSummary(){
 const entries=regionPolicyEntries();
 if(!entries.length)return '<span class="policy-date-note">등록 정책 없음</span>';
 const dates=entries.map(([,item])=>PolicyDates.describe(item.savedAt));
 const valid=dates.filter(info=>info.date).sort((a,b)=>b.date.localeCompare(a.date));
 const older=dates.filter(info=>info.state==='past').length,unknown=dates.filter(info=>info.state==='unknown').length;
 return regionPolicyDateBadge(valid[0]?.date||'')+(older?'<span class="policy-date-note">이전 날짜 정책 '+older+'건</span>':'')+(unknown?'<span class="policy-date-note">등록일 확인 필요 '+unknown+'건</span>':'');
}
function regionPolicyExampleTable(){
 const groups=[{label:'GA',kind:'일반 · 60세 이하',days:0,regions:[['수도권 (서울·인천·경기)','4건'],['광주·전남','1건']]},{label:'한화',kind:'일반 · 60세 이하',days:1,regions:[['서울특별시','3건'],['부산광역시','2건']]},{label:'신한',kind:'실버 · 61~70세',days:2,regions:[['인천광역시','2건'],['경기도','1건']]}];
 return '<p class="sub">날짜·지역 표시 예시입니다. 아래 지역과 수량은 실제 접수 기준이 아닙니다. 연령은 만 나이가 아닌 세는나이입니다.</p><div class="policy-example-columns">'+table(groups.map(g=>g.label),[groups.map(g=>regionPolicyDateBadge(PolicyDates.exampleDate(g.days),true)),groups.map(g=>policyEscape(g.kind)),groups.map(g=>'<ul class="policy-region-list">'+g.regions.map(([name,count])=>'<li><span>'+policyEscape(name)+'</span><strong>'+count+'</strong></li>').join('')+'</ul>')])+'</div>';
}
function policySourceColumnWidths(headers){
 return [88,...headers.map((header,index)=>/수량|인원|배정|이월|건수|한도|^(?:일반|실버)$/.test(header)?68:/상태|접수여부|가능여부/.test(header)?100:/상품|구분/.test(header)?90:index===0?160:140)];
}
function policySourcePriority(scope){
 if(scope?.unavailable||scope?.quantity===0)return 2;
 return scope?.quantity>0&&scope.include.length&&!scope.errors.length&&!scope.quantityReview?0:1;
}
function policySourceProvince(scope){
 const provinces=[...new Set([...(scope?.include||[]),...(scope?.exclude||[])].map(target=>target.province))];
 return provinces.length===1?provinces[0]:provinces.length>1?'multi':scope?.province||'review';
}
function policyGaSourceItems(policies){
 const groups=new Map();
 const targetKey=targets=>targets.map(target=>JSON.stringify([target.province,target.name||'',target.path||[]])).sort();
 for(const [key,item] of policies){
  const kind=policyKeyParts(key).kind,headers=item.rows[0]||[];
  const scopes=policyScopesForRows(item.rows);
  for(const scope of scopes){
   const targets=scope.include.length?scope.include:scope.explicitBlocks;
   const excluded=scope.exclude.filter(target=>!scope.explicitBlocks.some(block=>JSON.stringify(block)===JSON.stringify(target)));
   const signature=targets.length&&!scope.errors.length?JSON.stringify([targetKey(targets),targetKey(excluded),scope.only]):scope.text.replace(/\s/g,'');
   if(!groups.has(signature))groups.set(signature,[]);
   let entry=groups.get(signature).find(entry=>!entry.products[kind]);
   if(!entry){entry={region:scope.text,province:policySourceProvince(scope),products:{},refs:[],index:scope.index};groups.get(signature).push(entry);}
   const priority=policySourcePriority(scope);
   const qi=headers.findIndex(header=>/수량|인원|배정|이월|건수|한도/.test(header));
   const ri=headers.findIndex(header=>/지역|범위|구역|시.?군/.test(header)&&!/불가|제외|하위|세부|읍|면|동/.test(header));
   const notes=scope.row.flatMap((value,index)=>index===(qi<0?1:qi)||index===(ri<0?0:ri)||/상품|구분/.test(headers[index]||'')||!String(value).trim()?[]:[(headers[index]?headers[index]+': ':'')+value]);
   if(priority===1)notes.push(scope.quantityReview||scope.quantity===null?'수량 확인 필요':'지역·조건 확인 필요');
   entry.products[kind]={priority,quantity:scope.quantity,display:priority===2?'0':Number.isSafeInteger(scope.quantity)?String(scope.quantity):'확인 필요',notes};
   entry.refs.push({key,row:scope.index});
  }
 }
 return [...groups.values()].flat().map(entry=>{
  const products=Object.values(entry.products),priority=Math.min(...products.map(product=>product.priority));
  const notes=['general','silver'].flatMap(kind=>entry.products[kind]?.notes.length?[(kind==='general'?'일반':'실버')+' · '+entry.products[kind].notes.join(' / ')]:[]);
  return {...entry,priority,quantity:Math.max(0,...products.filter(product=>product.priority===0).map(product=>product.quantity)),cells:[policyEscape(entry.region)+notes.map(note=>'<br><small class="sub">'+policyEscape(note)+'</small>').join(''),entry.products.general?.display||'0',entry.products.silver?.display||'0']};
 });
}
function policySourceTable(key,rows,sourceItems=null){
 const raw=policyPublications[key]?.rows||[],scopes=policyScopesForRows(raw),byIndex=new Map(scopes.map(scope=>[scope.index,scope])),groups=new Map();
 const entries=sourceItems||rows.slice(1).map((cells,offset)=>{const index=offset+1,scope=byIndex.get(index);return {cells,index,province:policySourceProvince(scope),priority:policySourcePriority(scope),quantity:scope?.quantity||0};});
 for(const entry of entries){if(!groups.has(entry.province))groups.set(entry.province,[]);groups.get(entry.province).push(entry);}
 const compare=(a,b)=>a.priority-b.priority||(a.priority===0?b.quantity-a.quantity:0);
 for(const items of groups.values())items.sort((a,b)=>compare(a,b)||a.index-b.index);
 const orderedGroups=[0,1,2].flatMap(priority=>[...groups].map(([province,items])=>[province,items.filter(item=>item.priority===priority)]).filter(([,items])=>items.length).sort(([a,aa],[b,bb])=>compare(aa[0],bb[0])||a.localeCompare(b,'ko')));
 const body=orderedGroups.map(([province,items],groupIndex)=>{
  const priority=items[0].priority,heading=groupIndex===0||orderedGroups[groupIndex-1][1][0].priority!==priority?'<tr class="policy-source-status" data-policy-source-status="'+priority+'"><th colspan="'+(rows[0].length+1)+'">'+['접수 가능 지역','확인 필요 지역','접수 불가 지역 · 수량 0 포함'][priority]+'</th></tr>':'';
  return heading+items.map(({cells,index,refs},position)=>{
  const name=PolicyRegionRules.provinceNames[province]||(province==='multi'?'여러 시·도':'지역 확인'),display=[...cells];
  if(PolicyRegionRules.provinceNames[province]){for(const prefix of [name,province]){if(display[0].startsWith(prefix)){const rest=display[0].slice(prefix.length);if(!rest||/^(?:\s|:|：|전체|전역)/.test(rest)){display[0]=rest.replace(/^\s*[:：]?\s*/,'')||'전체';break;}}}}
  return '<tr data-policy-source-key="'+policyEscape(refs?.[0]?.key||key)+'" data-policy-source-row="'+index+'"'+(refs?' data-policy-source-refs="'+policyEscape(JSON.stringify(refs))+'"':'')+'>'+(position===0?'<th class="policy-province-cell" scope="rowgroup" rowspan="'+items.length+'">'+policyEscape(name)+'</th>':'')+display.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>';
  }).join('');
 }).join('');
 const widths=policySourceColumnWidths(rows[0].map((cell,index)=>sourceItems?cell:raw[0]?.[index]||cell));
 const columns=sourceItems?'':'<colgroup>'+widths.map(width=>'<col style="width:'+width+'px">').join('')+'</colgroup>';
 return '<div class="policy-source-scroll"><table class="policy-source-table">'+columns+'<thead><tr><th>시·도</th>'+rows[0].map(cell=>'<th>'+cell+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';
}
function policyHoverRows(group,path=[]){
 const place=PolicyRegionRules.catalog[group];if(!place)return [];
 return policySelectedKeys().flatMap(key=>{const scopes=policyPublishedScopes.get(key)||[];const result=PolicyRegionRules.evaluate(scopes,{...place,path});const indices=new Set([...(result.rows||[]),...(result.restrictions||[]).map(r=>r.row)]);return [...indices].map(row=>({key,row}));});
}
function policySourceMatches(dataset,matches){
 const refs=dataset.policySourceRefs?JSON.parse(dataset.policySourceRefs):[{key:dataset.policySourceKey,row:Number(dataset.policySourceRow)}];
 return refs.some(({key,row})=>matches.some(item=>item.row===row&&(item.key===key||(policyKeyParts(item.key).carrier===policyKeyParts(key).carrier&&JSON.stringify(policyPublications[item.key]?.rows)===JSON.stringify(policyPublications[key]?.rows)))));
}
function policyFitSourceScroller(scroller){
 const scrollTop=scroller.scrollTop;
 scroller.style.maxHeight='none';
 const blocked=scroller.querySelector('[data-policy-source-status="2"]');
 if(!blocked)return;
 const visible=scroller.querySelector('[data-policy-source-status="0"], [data-policy-source-status="1"]');
 const height=visible?Math.ceil(blocked.getBoundingClientRect().bottom-scroller.getBoundingClientRect().top+scroller.scrollTop+scroller.offsetHeight-scroller.clientHeight):440;
 scroller.style.maxHeight=Math.max(1,height)+'px';
 scroller.scrollTop=scrollTop;
}
function policyFitSourceScrollers(){for(const scroller of root.querySelectorAll('.policy-source-scroll'))policyFitSourceScroller(scroller);}
window.addEventListener('resize',()=>requestAnimationFrame(policyFitSourceScrollers));
document.fonts?.ready.then(()=>requestAnimationFrame(policyFitSourceScrollers));
function policyFollowMap(group,path=[]){
 const matches=group===null?[]:policyHoverRows(group,path),first=new Map();
 for(const row of root.querySelectorAll('[data-policy-source-key]')){
  const active=policySourceMatches(row.dataset,matches);
  row.classList.toggle('policy-source-highlight',active);
  const scroller=row.closest('.policy-source-scroll');if(active&&scroller&&!first.has(scroller))first.set(scroller,row);
 }
 for(const [scroller,row] of first){const rect=row.getBoundingClientRect(),box=scroller.getBoundingClientRect(),header=scroller.querySelector('thead')?.getBoundingClientRect().height||42;if(rect.top<box.top+header)scroller.scrollTop+=rect.top-box.top-header;else if(rect.bottom>box.bottom)scroller.scrollTop+=rect.bottom-box.bottom;}
}
function regionConditionsPanel(content){
 return '<section class="panel policy-registration-panel"><div class="policy-registration-heading"><h3>접수 정책표</h3><button type="button" class="action policy-intake-button" data-action="intake-window"><span class="ui-icon ui-icon-plus" aria-hidden="true"></span> 접수</button><a class="action policy-window-button" data-policy-new-window href="/employee.php?page=regions&amp;policyWindow=1" target="_blank" rel="noopener"><span class="ui-icon ui-icon-external" aria-hidden="true"></span> 새창으로 보기</a><div id="tm-region-policy-date" class="region-policy-date" aria-live="polite">'+regionPolicyDateSummary()+'</div></div>'+content+'</section>';
}
function regionConditionsTable(){
 requestAnimationFrame(policyFitSourceScrollers);
 const entries=regionPolicyEntries();
 if(!entries.length)return regionConditionsPanel('<p class="sub">선택한 거래처에 오늘 등록된 정책이 없습니다.</p>');
 const sections=[];let columnMin=400,hasGa=false;
 const carriers=[['ga','GA'],['hanwha','한화'],['shinhan','신한'],...intakeCodes.filter(c=>!['ga','hanwha','shinhan'].includes(c.id)).map(c=>[c.id,c.label])];
 for(const [id,label] of carriers){
  let policies=entries.filter(([key])=>policyKeyParts(key).carrier===id).sort(([a],[b])=>Number(a.endsWith(':silver'))-Number(b.endsWith(':silver')));
  if(!policies.length)continue;
  if(id==='ga'){
   hasGa=true;
   const dates=['general','silver'].map(kind=>{const item=policies.find(([key])=>policyKeyParts(key).kind===kind)?.[1];return '<div>'+(kind==='general'?'일반':'실버')+' '+(item?regionPolicyDateBadge(item.savedAt):'<span class="sub">미등록 · 수량 0</span>')+'</div>';}).join('');
   const content='<div class="policy-table-heading"><h3>GA · 일반 / 실버</h3></div>'+dates+policySourceTable(policies[0][0],[['지역 · 적용 조건','일반','실버']],policyGaSourceItems(policies))+'<p class="sub">같은 적용 범위의 정책이 없는 상품은 0으로 표시합니다. 수량은 원문 범위의 공유 수량입니다.</p>';
   sections.push('<section class="policy-carrier-column" data-policy-carrier="ga" style="min-width:0">'+content+'</section>');
   continue;
  }
  const common=['hanwha','shinhan'].includes(id)&&policies.length===2&&JSON.stringify(policies[0][1].rows)===JSON.stringify(policies[1][1].rows)&&!policies[0][1].rows[0].some(cell=>/^(상품(?:\s*구분)?|구분|연령구분)$/.test(String(cell).trim()));
  if(common)policies=[policies.reduce((a,b)=>String(a[1].savedAt)>String(b[1].savedAt)?a:b)];
  const cards=[];
  for(const [key,item] of policies){
   const kind=policyKeyParts(key).kind==='general'?'일반':'실버';
   const width=Math.max(0,...item.rows.map(row=>row.length));
   const rows=item.rows.map(row=>Array.from({length:width},(_,i)=>policyEscape(row[i]||'').replace(/\n/g,'<br>')));
   columnMin=Math.max(columnMin,16+policySourceColumnWidths(Array.from({length:width},(_,i)=>item.rows[0][i]||'')).reduce((sum,value)=>sum+value,0));
   cards.push('<div class="policy-table-heading"><h3>'+policyEscape(label)+(common?' · 일반·실버 공통':' · '+kind)+'</h3>'+regionPolicyDateBadge(item.savedAt)+'</div>'+policySourceTable(key,rows));
  }
  sections.push('<section class="policy-carrier-column" data-policy-carrier="'+policyEscape(id)+'" style="min-width:0">'+cards.join('')+'</section>');
 }
 const otherCount=sections.length-Number(hasGa),columns=[...(hasGa?['fit-content(340px)']:[]),...(otherCount?['repeat('+otherCount+',minmax('+columnMin+'px,1fr))']:[])].join(' ');
 return regionConditionsPanel('<div class="policy-carrier-scroll"><div class="policy-carrier-columns" style="display:grid;grid-template-columns:'+columns+';gap:16px;align-items:start">'+sections.join('')+'</div></div>'+'<p class="sub">접수 가능 → 확인 필요 → 접수 불가 순으로 표시하며, 각 구역 안에서 시·도별로 묶습니다. 정책별 등록일과 수량·연령·제외 조건을 확인해 주세요.</p>');
}
root.addEventListener('click',e=>{const link=e.target.closest('[data-policy-new-window]');if(!link)return;e.preventDefault();window.open(link.href,'_blank','popup,width=1280,height=900,scrollbars=yes,resizable=yes,noopener');});
function regionRefreshPolicyHeader(){const target=root.querySelector('#tm-region-policy-date');if(target)target.innerHTML=regionPolicyDateSummary()}
function regionPendingPanel(){
 const role=window.CNCHOME_LIVE?.user?.role;if(!['employee','admin'].includes(role))return '';
 const name=window.CNCHOME_LIVE.user.display_name,title=role==='admin'?'직원별 가접수 현황':(name?policyEscape(name)+'님의 ':'')+'가접수 현황';
 return `<section class="panel" data-pending-panel aria-labelledby="tm-pending-title"><div class="pending-intake-heading"><div class="pending-intake-title-actions"><h3 id="tm-pending-title">${title}</h3>${role==='employee'?'<button type="button" class="action" data-action="intake-window"><span class="ui-icon ui-icon-plus" aria-hidden="true"></span> 접수</button>':''}</div><button type="button" class="secondary" data-pending-refresh>새로고침</button></div><div data-pending-list><p role="status">가접수를 불러오는 중입니다.</p></div></section>`;
}
function regionPage(){const pending=regionPendingPanel();if(window.PolicySync?.enabled&&(!PolicySync.ready||!policyHasPublications()))return '<h2>접수 가능지역</h2>'+pending+policyServerStatusMarkup()+'<p class="notice">'+(PolicySync.ready?'오늘 등록된 접수 정책이 없습니다. 관리자가 정책을 등록하면 표시됩니다.':'서버 정책을 불러오는 중입니다.')+'</p>';normalizeMapCarrier();return `<div class="region-page-heading"><h2>접수 가능지역</h2>${policyServerStatusMarkup()}</div>${pending}<div class="policy-map-workspace"><div id="tm-region-conditions">${regionConditionsTable()}</div><details class="region-map-disclosure" ${new URL(window.CNCPageUrl||location.href).searchParams.has('policyWindow')?'open':''}><summary>접수 가능지역 지도 펼치기 · 접기</summary><a href="/employee.php?page=regions&amp;policyWindow=1" target="_blank" rel="noopener">지도·정책 새창으로 보기</a><div class="region-map-layout"><section class="panel region-map-panel"><div class="toolbar"><div class="map-carrier-buttons" role="group" aria-label="접수 코드별 가능지역">${[regionCarrierSettings.find(c=>c.id==='all'),...visibleRegionCarriers()].filter(Boolean).map(c=>`<button type="button" data-map-carrier="${c.id}" aria-pressed="${mapCarrier===c.id}" ${c.enabled?'':'disabled title="등록된 정책 없음"'}>${policyEscape(c.label)}${c.enabled?'':' · 정책 없음'}</button>`).join('')}</div></div><div id="tm-region-map"></div>${policyHasPublications()?'<p class="sub policy-map-legend"><span>파랑: 가능</span> · <span>노랑: 일부 제한</span> · <span>빨강: 불가</span> · 회색: 확인 필요</p><p class="sub">지도는 기존 시·군·구 경계를 사용합니다. 읍·면·동 제한과 경계가 갱신된 지역은 상세 목록을 기준으로 확인해 주세요.</p>':''}</section><section class="panel region-table-panel"><h3>시·군별 접수 지역</h3><div id="tm-region-results"></div><p class="sub">관리자가 공개한 정책만 표시합니다. 접수 연령과 세부 조건은 해당 정책을 확인해 주세요.</p></section></div></details></div>`}
function adminPending(){return regionPendingPanel()||panel('가접수 현황 미리보기','<p class="sub">실제 가접수 목록은 관리자 로그인 후 확인할 수 있습니다.</p>');}
function regionPolicyTable(carriers,rows){
 return `<div class="scroll"><table class="region-policy-table"><thead><tr><th rowspan="2" scope="col">지역</th>${carriers.map(c=>`<th colspan="2" scope="colgroup" class="carrier-group">${policyEscape(c.label)}</th>`).join('')}<th rowspan="2" scope="col" class="coverage-start">적용 범위</th></tr><tr>${carriers.map(()=>'<th scope="col" class="carrier-start">일반</th><th scope="col">실버</th>').join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((cell,i)=>`<td${i===row.length-1?' class="coverage-start"':i>0&&i%2===1?' class="carrier-start"':''}>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function regionDisplayName(r){
 if(r[0]===r[1]||r[0]==='제주도')return r[1];
 if(r[0]==='대전 · 금산')return '대전광역시 · 충청남도 금산군';
 return r[1]+' '+r[0];
}
function regionApplyAge(){
 const input=root.querySelector('#tm-customer-age'),value=input?.value||'',kind=PolicyInput.kindForAge(value),map=root.querySelector('#tm-region-map'),note=root.querySelector('#tm-region-age-note');
 if(map)map.hidden=false;
 if(value===''){if(note)note.textContent='';return true;}
 if(!kind){if(note)note.textContent='입력한 나이는 접수 연령 범위 밖입니다. 세는나이 1~70세를 확인해 주세요.';if(map)map.hidden=true;root.querySelector('#tm-region-results').innerHTML='<p class="notice">해당 나이에는 접수 가능한 보험 상품이 없습니다.</p>';return false;}
 root.querySelector('#tm-age').selectedIndex=kind==='general'?0:1;
 if(note)note.textContent='세는나이 '+value+'세 · '+(kind==='general'?'일반 정책 적용 (60세 이하)':'실버 정책 적용 (61~70세)');return true;
}
function filterRegions(){if(window.PolicySync?.enabled&&(!PolicySync.ready||!policyHasPublications()))return;regionRefreshPolicyHeader();if(!regionApplyAge())return;const summary=root.querySelector('#tm-region-conditions');if(summary)summary.innerHTML=regionConditionsTable();if(policyHasPublications()){policyFilterPublishedRegions();return}normalizeMapCarrier();const q=(root.querySelector('#tm-region-search')?.value||'').trim(),general=(root.querySelector('#tm-age')?.selectedIndex??2)===0;const canReceive=r=>regionCanReceive(r,general);const rows=regions.filter(r=>r.join(' ').includes(q)).sort((a,b)=>Number(canReceive(b))-Number(canReceive(a))||a[0].localeCompare(b[0],'ko'));const carriers=visibleRegionCarriers().filter(c=>mapCarrier==='all'||mapCarrier===c.id);const columns=carriers.flatMap(c=>['general','silver'].map(kind=>({carrier:c,kind})));root.querySelector('#tm-region-results').innerHTML=carriers.length?regionPolicyTable(carriers,rows.map(r=>{const p=regionInsurancePolicies[regions.indexOf(r)];return [`<button type="button" class="region-select-button" data-region-select="${regions.indexOf(r)}" aria-pressed="${mapSelectedGroup===regions.indexOf(r)}">${regionDisplayName(r)}</button>`,...columns.map(({carrier:c,kind})=>p[c.id][kind]?pill(p[c.id][kind],Number(p[c.id][kind].split('/')[1])>0?'green':'pink'):pill(c.id==='hanwha'?'구분 확인':'자료 대기','amber')),r[0]===r[1]?r[4]:r[0]+' · '+r[4]];}))+(rows.length?'':'<p>검색 결과가 없습니다.</p>'):'<p>현재 공개된 접수 정책이 없습니다.</p>';updateRegionMap()}
const attendanceToday=new Date();
let attendanceYear=attendanceToday.getFullYear(),attendanceMonth=attendanceToday.getMonth()+1;
function attendanceRecords(){
 if(window.CNCHOME_LIVE?.user.role==='employee'){
  const records=new Map((testEmployee?(window.CNCEmployeeTestState?.attendance||[]):[]).map(r=>[r.date,{date:r.date,start:r.checkedIn===false?'—':'',end:'',hours:'',status:r.status||'출근 완료 (테스트)'}]));
  for(const r of window.AttendanceWorkspace?.records()||[])records.set(r.date,{date:r.date,start:'',end:'',hours:'',status:r.approved?'출근 완료':'승인 대기'});
  return [...records.values()].sort((a,b)=>b.date.localeCompare(a.date));
 }
 const records=[
 {date:'2026-09-22',start:'10:00',end:clockedOut?'16:40':'—',status:clockedOut?'퇴근':'근무 중',hours:clockedOut?'6시간':'집계 중'},
 {date:'2026-09-21',start:'10:00',end:'17:00',status:'출근',hours:'6시간'},
 {date:'2026-09-18',start:'10:00',end:'17:00',status:'출근',hours:'6시간'},
 {date:'2026-09-17',start:'10:10',end:'17:00',status:'지각 10분',hours:'6시간'},
 {date:'2026-09-16',start:'10:00',end:'15:00',status:'휴가 2시간',hours:'근무 4 + 휴가 2'},
 {date:'2026-09-09',start:'10:00',end:'15:00',status:'조퇴',hours:'4시간'}
];
 // Demonstration attendance records; these are not actual employee records.
 const examples={4:{status:'결근',start:'—',end:'—',hours:'0시간'},8:{status:'병가',start:'—',end:'—',hours:'병가 1일'},11:{status:'휴가',start:'—',end:'—',hours:'휴가 1일'},14:{status:'외출',start:'10:00',end:'17:00',hours:'외출 1시간'}};
 for(let day=1;day<=22;day++){
  const date='2026-09-'+String(day).padStart(2,'0'),dow=new Date(2026,8,day).getDay();
  if(dow===0||dow===6||records.some(r=>r.date===date))continue;
  records.push({date,...(examples[day]||{start:'10:00',end:'17:00',status:'출근',hours:'6시간'})});
 }
 return records.sort((a,b)=>b.date.localeCompare(a.date));
}
function attendanceStatusMarkup(date,dow,holiday,record,request,today){
 let label,tone;
 if(request?.status==='approved'){label=request.kind+' 확인';tone=({병가:'sick',휴가:'leave',조퇴:'early',외출:'outing'})[request.kind];}
 else if(record){label=record.status;tone=label.includes('대기')?'pending':label.includes('지각')?'late':label==='결근'?'absent':label.includes('병가')?'sick':label.includes('휴가')?'leave':label==='조퇴'?'early':label==='외출'?'outing':'present';}
 else if(holiday){label='공휴일';tone='rest';}
 else if(dow===0||dow===6){label='공휴일';tone='rest';}
 else if(date>today){return '';}
 else{return '';}
 return `<span class="attendance-status attendance-status-${tone}">${label}</span>${record&&request?.status!=='approved'&&window.CNCHOME_LIVE?.user.role!=='employee'?(record.start!=='—'?`<small>${record.start} ~ ${record.end}</small>`:'')+`<small>${record.hours}</small>`:''}`;
}
function attendanceMonthKey(){return attendanceYear+'-'+String(attendanceMonth).padStart(2,'0')}
function attendanceRecordTable(records){const privateTime=window.CNCHOME_LIVE?.user.role==='employee';return records.length?table(privateTime?['날짜','상태']:['날짜','출근','퇴근','상태','인정 시간'],records.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>privateTime?[r.date,r.status]:[r.date,r.start,r.end,r.status,r.hours])):'<p class="sub">선택한 달의 출결 내역이 없습니다.</p>'}

// Holiday rules checked against the 2026-05-01 public holiday regulation and KASA 2027 calendar.
const attendanceHolidayCache=new Map();
function attendanceHolidays(year){
 if(window.CNCPublicHolidays)return window.CNCPublicHolidays.forYear(year);
 if(attendanceHolidayCache.has(year))return attendanceHolidayCache.get(year);
 const result={},groups=[];
 const key=d=>d.toISOString().slice(0,10),date=(m,d)=>new Date(Date.UTC(year,m-1,d)),shift=(d,n)=>new Date(d.getTime()+n*86400000);
 function add(days,name,sub){groups.push({days,name,sub});days.forEach((d,i)=>{const label=days.length===3&&i!==1?name+' 연휴':name;const k=key(d);result[k]=result[k]?result[k]+' · '+label:label;});}
 add([date(1,1)],'신정',false);add([date(3,1)],'삼일절',year>=2022?'weekend':false);
 add([date(5,5)],'어린이날','weekend');add([date(6,6)],'현충일',false);
 if(year>=2026){add([date(5,1)],'노동절','weekend');add([date(7,17)],'제헌절','weekend');}
 add([date(8,15)],'광복절',year>=2021?'weekend':false);add([date(10,3)],'개천절',year>=2021?'weekend':false);add([date(10,9)],'한글날',year>=2021?'weekend':false);add([date(12,25)],'성탄절',year>=2023?'weekend':false);
 const lunar=new Intl.DateTimeFormat('en-u-ca-dangi',{month:'numeric',day:'numeric',timeZone:'Asia/Seoul'});
 for(let d=date(1,1);d.getUTCFullYear()===year;d=shift(d,1)){
  const parts=lunar.formatToParts(d),m=parts.find(p=>p.type==='month').value,day=parts.find(p=>p.type==='day').value;
  if(m==='1'&&day==='1')add([shift(d,-1),d,shift(d,1)],'설날','sunday');
  if(m==='4'&&day==='8')add([d],'부처님오신날',year>=2023?'weekend':false);
  if(m==='8'&&day==='15')add([shift(d,-1),d,shift(d,1)],'추석','sunday');
 }
 // One-off nationally designated holidays; extend when new dates are announced.
 const special={'2022-03-09':'대통령선거','2022-06-01':'전국동시지방선거','2023-10-02':'임시공휴일','2024-04-10':'국회의원선거','2024-10-01':'임시공휴일','2025-01-27':'임시공휴일','2025-06-03':'대통령선거','2026-06-03':'전국동시지방선거'};
 Object.entries(special).forEach(([k,v])=>{if(k.startsWith(year+'-'))result[k]=v});
 groups.sort((a,b)=>a.days[0]-b.days[0]).forEach(g=>{
  if(!g.sub)return;
  const overlap=g.days.some(d=>d.getUTCDay()===0||(g.sub==='weekend'&&d.getUTCDay()===6)||(d.getUTCDay()!==0&&d.getUTCDay()!==6&&result[key(d)].includes(' · ')));
  if(!overlap)return;
  let next=shift(g.days[g.days.length-1],1);while(next.getUTCDay()===0||next.getUTCDay()===6||result[key(next)])next=shift(next,1);
  result[key(next)]='대체공휴일 ('+g.name+')';
 });
 attendanceHolidayCache.set(year,result);return result;
}
let attendanceSelectedDate=null;
const attendanceLeaveRequests=new Map();
function attendanceEscape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function attendanceRequestFor(date){return [...attendanceLeaveRequests.values()].find(r=>r.start<=date&&date<=r.end);}
function attendanceValidDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;const parsed=new Date(date+'T00:00:00Z');return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date;}
function attendanceTimeError(kind,start,end,startTime,endTime){
 const valid=t=>/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(t);
 if(kind!=='조퇴'&&kind!=='외출')return '';
 if(start!==end)return '조퇴·외출은 하루씩 신청해 주세요.';
 if(!valid(startTime))return (kind==='조퇴'?'조퇴':'외출')+' 시간을 선택해 주세요.';
 if(kind==='외출'&&(!valid(endTime)||endTime<=startTime))return '복귀 시간은 외출 시간 이후로 선택해 주세요.';
 return '';
}
function attendanceUpdateTimeFields(){
 const form=root.querySelector('#tm-attendance-leave-form');if(!form)return;
 const kind=form.querySelector('[name="kind"]:checked').value,timed=kind==='조퇴'||kind==='외출',outing=kind==='외출';
 const start=form.querySelector('[name="start"]'),end=form.querySelector('[name="end"]');
 const time=form.querySelector('[name="startTime"]'),back=form.querySelector('[name="endTime"]');
 form.querySelector('#tm-attendance-times').hidden=!timed;
 form.querySelector('#tm-attendance-return-time').hidden=!outing;
 form.querySelector('#tm-attendance-start-time-label').textContent=outing?'외출 시간':'조퇴 시간';
 time.disabled=!timed;time.required=timed;back.disabled=!outing;back.required=outing;
 end.readOnly=timed;if(timed)end.value=start.value;
}
root.addEventListener('change',e=>{
 if(e.target.matches('#tm-attendance-leave-form [name="kind"],#tm-attendance-leave-form [name="start"]'))attendanceUpdateTimeFields();
});
function attendanceLeaveForm(){
 if(!attendanceSelectedDate)return '';
 if(liveEmployee&&(!testEmployee||attendanceSelectedDate===gradeToday())){const record=attendanceRecords().find(r=>r.date===attendanceSelectedDate),isToday=attendanceSelectedDate===gradeToday();return '<section id="tm-attendance-leave" class="attendance-leave"><div class="row"><h3>'+attendanceEscape(attendanceSelectedDate)+' · 출결 내역</h3><button type="button" class="secondary" data-leave-close>닫기</button></div>'+(isToday?(window.AttendanceWorkspace?.homePanel()||'<p class="sub">출근 상태를 불러오는 중입니다.</p>'):'<p>'+attendanceEscape(record?.status||'등록된 출결 내역이 없습니다.')+'</p>')+'<p class="sub">휴가·병가·조퇴·외출 신청은 관리자에게 문의해 주세요.</p></section>';}
 const request=attendanceRequestFor(attendanceSelectedDate),holiday=attendanceHolidays(Number(attendanceSelectedDate.slice(0,4)))[attendanceSelectedDate];
 return `<section id="tm-attendance-leave" class="attendance-leave" aria-label="휴가·병가·조퇴·외출 신청"><div class="row"><h3>${attendanceSelectedDate} · 출결 신청</h3><button type="button" class="secondary" data-leave-close>닫기</button></div>${holiday?`<p class="attendance-holiday">${holiday}</p>`:''}${request?`<p role="status"><strong>${request.kind}${request.status==='approved'?' 확인':' · 신청 대기'}</strong> <span class="sub">(미리보기)</span></p><p>${request.start} ~ ${request.end}</p>${request.startTime?`<p>${request.kind==='조퇴'?'조퇴 시간':'외출 시간'} ${request.startTime}${request.endTime?' ~ '+request.endTime:''}</p>`:''}<p>${attendanceEscape(request.reason)}</p>${request.status==='pending'?'<button type="button" class="secondary" data-leave-cancel>신청 취소</button><details class="leave-approval-preview"><summary>승인 화면 미리보기</summary><p class="sub">실제 관리자 승인이 아닙니다. 승인 후 달력 표시만 확인합니다.</p><button type="button" class="secondary" data-leave-preview-approve>승인 후 표시 보기</button></details>':'<p class="sub">승인 후 표시를 미리 보는 중입니다. 실제 관리자에게 전송되지 않았습니다.</p><button type="button" class="secondary" data-leave-preview-reset>신청 대기 표시로 돌아가기</button>'}`:`<form id="tm-attendance-leave-form"><div class="attendance-leave-types" role="radiogroup" aria-labelledby="attendance-kind-label"><span id="attendance-kind-label">신청 구분</span><label><input type="radio" name="kind" value="휴가" checked> 휴가</label><label><input type="radio" name="kind" value="병가"> 병가</label><label><input type="radio" name="kind" value="조퇴"> 조퇴</label><label><input type="radio" name="kind" value="외출"> 외출</label></div><div class="attendance-leave-dates"><label>시작일<input type="date" name="start" value="${attendanceSelectedDate}" required></label><label>종료일<input type="date" name="end" value="${attendanceSelectedDate}" min="${attendanceSelectedDate}" required></label></div><div id="tm-attendance-times" class="attendance-leave-dates" hidden><label><span id="tm-attendance-start-time-label">조퇴 시간</span><input type="time" name="startTime" disabled></label><label id="tm-attendance-return-time" hidden>복귀 시간<input type="time" name="endTime" disabled></label></div><label>신청 사유<textarea name="reason" rows="2" maxlength="500" required placeholder="신청 사유를 입력해 주세요"></textarea></label><p class="sub">미리보기 신청입니다. 관리자에게 전송되지 않으며 새로고침하면 초기화됩니다.</p><button type="submit" class="action">신청하기</button></form>`}</section>`;
}
root.addEventListener('change',e=>{
 if(e.target.matches('#tm-attendance-leave-form [name="start"]')){const end=root.querySelector('#tm-attendance-leave-form [name="end"]');end.min=e.target.value;if(end.value<e.target.value)end.value=e.target.value;}
});
root.addEventListener('click',e=>{
 const day=e.target.closest('[data-attendance-date]');
 if(day){const date=day.dataset.attendanceDate;attendanceSelectedDate=attendanceSelectedDate===date?null:date;render();root.querySelector(`[data-attendance-date="${date}"]`)?.focus({preventScroll:true});if(attendanceSelectedDate)root.querySelector('#tm-attendance-leave')?.scrollIntoView({behavior:'smooth',block:'nearest'});return;}
 if(e.target.closest('[data-leave-close]')){const date=attendanceSelectedDate;attendanceSelectedDate=null;render();root.querySelector(`[data-attendance-date="${date}"]`)?.focus();return;}
 const request=attendanceRequestFor(attendanceSelectedDate);
 if(e.target.closest('[data-leave-cancel]')&&request?.status==='pending'){attendanceLeaveRequests.delete(request.start);render();toast('선택한 기간의 미리보기 신청을 취소했습니다.');}
 if(e.target.closest('[data-leave-preview-approve]')&&request){request.status='approved';render();toast('승인 후 표시 미리보기 · 실제 관리자 승인이 아닙니다.');}
 if(e.target.closest('[data-leave-preview-reset]')&&request){request.status='pending';render();}
});
root.addEventListener('submit',e=>{
 if(e.target.id!=='tm-attendance-leave-form')return;
 e.preventDefault();if(liveEmployee&&!testEmployee)return;if(!attendanceSelectedDate||!e.target.reportValidity())return;
 const form=new FormData(e.target),kind=form.get('kind'),reason=String(form.get('reason')||'').trim(),start=String(form.get('start')||''),end=String(form.get('end')||'');
 if(!['병가','휴가','조퇴','외출'].includes(kind)||!reason){toast('신청 구분과 사유를 입력해 주세요.');return;}
 if(!attendanceValidDate(start)||!attendanceValidDate(end)||end<start){toast('종료일은 시작일과 같거나 이후여야 합니다.');return;}
 const startTime=['조퇴','외출'].includes(kind)?String(form.get('startTime')||''):'',endTime=kind==='외출'?String(form.get('endTime')||''):'';
 const timeError=attendanceTimeError(kind,start,end,startTime,endTime);if(timeError){toast(timeError);return;}
 if([...attendanceLeaveRequests.values()].some(r=>start<=r.end&&end>=r.start)){toast('이미 신청한 기간과 겹칩니다. 기존 신청을 확인해 주세요.');return;}
 attendanceLeaveRequests.set(start,{kind,reason,start,end,startTime,endTime,status:'pending'});
 attendanceSelectedDate=start;attendanceYear=Number(start.slice(0,4));attendanceMonth=Number(start.slice(5,7));render();toast(kind+' 기간 신청 대기 · 미리보기이며 관리자에게 전송되지 않습니다.');
});
function attendanceLeaveBar(request,date,dow){
 if(!request)return '';
 const first=date===request.start||dow===0||date.endsWith('-01'),last=date===request.end||dow===6||Number(date.slice(8))===new Date(Number(date.slice(0,4)),Number(date.slice(5,7)),0).getDate();
 const label=request.kind+(request.status==='approved'?' 확인':' 신청');
 return `<span class="attendance-leave-bar ${first?'range-start':''} ${last?'range-end':''} ${request.status==='approved'?'is-approved':''}" title="${request.start} ~ ${request.end} · ${label} (미리보기)" aria-label="${label} (미리보기)">${first?label:'&nbsp;'}</span>`;
}

function attendanceUpcomingMonths(now=new Date(attendanceYear,attendanceMonth-1,1),offsets=[1,2,3]){
 return offsets.map(offset=>{const date=new Date(now.getFullYear(),now.getMonth()+offset,1);return {year:date.getFullYear(),month:date.getMonth()+1};});
}
function attendanceMonthShortcuts(offsets=[1]){
 return attendanceUpcomingMonths(new Date(attendanceYear,attendanceMonth-1,1),offsets).map(({year,month})=>`<button type="button" class="attendance-month-shortcut" data-attendance-jump-year="${year}" data-attendance-jump-month="${month}" aria-label="${year}년 ${month}월 달력 보기" aria-pressed="${attendanceYear===year&&attendanceMonth===month}">${offsets[0]<0?'전달':'다음달'}</button>`).join('');
}
root.addEventListener('click',e=>{
 const button=e.target.closest('[data-attendance-jump-month]');if(!button)return;
 attendanceYear=Number(button.dataset.attendanceJumpYear);attendanceMonth=Number(button.dataset.attendanceJumpMonth);attendanceSelectedDate=null;render();
 root.querySelector(`[data-attendance-jump-year="${attendanceYear}"][data-attendance-jump-month="${attendanceMonth}"]`)?.focus({preventScroll:true});
});
function attendanceBusinessDays(year,month){
 const holidays=attendanceHolidays(year),days=new Date(year,month,0).getDate();let count=0;
 for(let day=1;day<=days;day++){const dow=new Date(year,month-1,day).getDay(),key=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');if(dow!==0&&dow!==6&&!holidays[key])count++;}
 return count;
}
let attendanceDetailKind=null;
function attendanceDetailRows(year,month,kind){
 const rows=[],records=attendanceRecords(),label=({leave:'휴가',sick:'병가',early:'조퇴'})[kind];
 for(let day=1;day<=new Date(year,month,0).getDate();day++){
  const date=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'),record=records.find(r=>r.date===date),request=attendanceRequestFor(date);
  if(kind==='work'){
   if(record&&record.start!=='—'&&!(request?.status==='approved'&&['휴가','병가'].includes(request.kind)))rows.push([date,window.CNCHOME_LIVE?.user.role==='employee'?'관리자 확인':record.start+' ~ '+record.end,record.status+(record.hours?' · '+record.hours:''),'출근 기록']);
  }else if(request?.kind===label){
   rows.push([date,request.startTime?request.startTime+(request.endTime?' ~ '+request.endTime:''):'종일',request.kind+' · '+request.reason,request.status==='approved'?'승인 완료 (미리보기)':'승인 대기 (미리보기)']);
  }else if(record?.status.includes(label)&&!(request?.status==='approved'&&['휴가','병가'].includes(request.kind))){
   rows.push([date,record.status==='조퇴'&&record.end!=='—'?record.end+' 조퇴':record.status.includes('시간')?'상세 시간 미등록':'종일',record.status+' · '+record.hours,'승인 정보 없음']);
  }
 }
 return rows;
}
function attendanceDetailTable(){
 if(!attendanceDetailKind)return '';
 const label=({work:'근무일자',leave:'휴가',sick:'병가',early:'조퇴'})[attendanceDetailKind],rows=attendanceDetailRows(attendanceYear,attendanceMonth,attendanceDetailKind);
 return `<section id="tm-attendance-detail" class="attendance-detail"><div class="row"><h3>${attendanceYear}년 ${attendanceMonth}월 ${label} 내역</h3><button type="button" class="secondary" data-attendance-detail-close>닫기</button></div><p class="sub">출근 기록 · 신청 대기 내역도 함께 표시됩니다.</p><div class="scroll"><table><thead><tr><th>날짜</th><th>시간</th><th>내용</th><th>승인 여부</th></tr></thead><tbody>${rows.length?rows.map(row=>'<tr>'+row.map(cell=>'<td>'+attendanceEscape(cell)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="4">선택한 달에 해당 내역이 없습니다.</td></tr>'}</tbody></table></div></section>`;
}
root.addEventListener('click',e=>{
 const button=e.target.closest('[data-attendance-detail]');
 if(button){const kind=button.dataset.attendanceDetail;if(!['work','leave','sick','early'].includes(kind))return;attendanceDetailKind=attendanceDetailKind===kind?null:kind;render();root.querySelector(`[data-attendance-detail="${kind}"]`)?.focus({preventScroll:true});return;}
 if(e.target.closest('[data-attendance-detail-close]')){const kind=attendanceDetailKind;attendanceDetailKind=null;render();root.querySelector(`[data-attendance-detail="${kind}"]`)?.focus({preventScroll:true});}
});
function attendanceMonthlySummary(year,month){
 const totals={work:0,leave:0,sick:0,early:0},records=attendanceRecords(),holidays=attendanceHolidays(year);
 for(let day=1;day<=new Date(year,month,0).getDate();day++){
  const date=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'),record=records.find(r=>r.date===date),request=attendanceRequestFor(date),approved=request?.status==='approved'?request:null;
  const dow=new Date(year,month-1,day).getDay(),workday=dow!==0&&dow!==6&&!holidays[date];
  const status=approved?(workday?approved.kind:''):(record?.status||'');
  if(record&&record.start!=='—'&&(!approved||!['휴가','병가'].includes(approved.kind)))totals.work++;
  if(status.includes('휴가'))totals.leave++;
  if(status.includes('병가'))totals.sick++;
  if(status.includes('조퇴'))totals.early++;
 }
 return `<span class="attendance-month-totals" aria-label="선택한 달 출결 집계">${[['work','근무일자'],['leave','휴가'],['sick','병가'],['early','조퇴']].map(([key,label])=>`<button type="button" data-attendance-detail="${key}" aria-expanded="${attendanceDetailKind===key}" aria-controls="tm-attendance-detail" title="날짜별 상세 내역 보기">${label} <strong>${totals[key]}일</strong></button>`).join('')}</span>`;
}
function attendanceCalendar(){
 const holidays=attendanceHolidays(attendanceYear);
 const records=attendanceRecords(),years=records.map(r=>Number(r.date.slice(0,4))),nowYear=attendanceToday.getFullYear();
 const minYear=Math.min(nowYear-5,attendanceYear,...years),maxYear=Math.max(nowYear+5,attendanceYear,...years);
 const yearOptions=Array.from({length:maxYear-minYear+1},(_,i)=>minYear+i).map(y=>`<option value="${y}" ${y===attendanceYear?'selected':''}>${y}년</option>`).join('');
 const monthOptions=Array.from({length:12},(_,i)=>i+1).map(m=>`<option value="${m}" ${m===attendanceMonth?'selected':''}>${m}월</option>`).join('');
 const first=new Date(attendanceYear,attendanceMonth-1,1).getDay(),days=new Date(attendanceYear,attendanceMonth,0).getDate(),key=attendanceMonthKey();
 const todayKey=attendanceToday.getFullYear()+'-'+String(attendanceToday.getMonth()+1).padStart(2,'0')+'-'+String(attendanceToday.getDate()).padStart(2,'0');
 let cells='';
 const cellCount=Math.ceil((first+days)/7)*7;
 for(let index=0;index<cellCount;index++){
  const cellDate=new Date(attendanceYear,attendanceMonth-1,index-first+1),cellYear=cellDate.getFullYear(),cellMonth=cellDate.getMonth()+1,d=cellDate.getDate(),outside=cellMonth!==attendanceMonth||cellYear!==attendanceYear;
  const date=cellYear+'-'+String(cellMonth).padStart(2,'0')+'-'+String(d).padStart(2,'0'),dow=cellDate.getDay(),record=records.find(r=>r.date===date);
  const holiday=(cellYear===attendanceYear?holidays:attendanceHolidays(cellYear))[date]||'',request=attendanceRequestFor(date),expanded=attendanceSelectedDate===date;
  cells+=`<button type="button" data-attendance-date="${date}" aria-expanded="${expanded}" aria-controls="tm-attendance-leave" aria-label="${cellYear}년 ${cellMonth}월 ${d}일${holiday?' '+holiday:''} ${liveEmployee&&!testEmployee?'출결 내역 조회':'휴가·병가·조퇴·외출 신청'}" class="attendance-date ${outside?'outside-month':''} ${holiday||dow===0?'sunday':dow===6?'saturday':''} ${date===todayKey?'is-today':''} ${expanded?'is-selected':''}" ${date===todayKey?'aria-current="date"':''}><strong class="attendance-date-heading">${outside?cellMonth+'월 ':''}${d}${d===15?'<span class="attendance-payday"><svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="#ffe59a" stroke="#c59225" stroke-width="1.3"/><path d="M5.5 6.5 7.5 13.5 10 8.5 12.5 13.5 14.5 6.5M5 9.5h10" fill="none" stroke="#956516" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>지급일</span>':''}${date===todayKey?'<small>오늘</small>':''}</strong>${holiday?`<small class="attendance-holiday">${holiday}</small>`:''}${attendanceStatusMarkup(date,dow,holiday,record,request,todayKey)}${attendanceLeaveBar(request,date,dow)}</button>`;
 }
 return `<section class="panel"><div class="attendance-heading attendance-controls"><h3>출근 달력</h3><label><select id="tm-attendance-year" aria-label="연도">${yearOptions}</select></label>${attendanceMonthShortcuts([-1])}<label><select id="tm-attendance-month" aria-label="월">${monthOptions}</select></label>${attendanceMonthShortcuts()}<span class="attendance-business-days" title="토요일·일요일 및 등록된 공휴일 제외">${attendanceMonth}월 영업가능일 <strong>${attendanceBusinessDays(attendanceYear,attendanceMonth)}일</strong></span>${attendanceMonthlySummary(attendanceYear,attendanceMonth)}</div>${attendanceDetailTable()}<div class="attendance-calendar" aria-label="${attendanceYear}년 ${attendanceMonth}월 출근 달력">${['일','월','화','수','목','금','토'].map((day,i)=>`<div class="attendance-weekday ${i===0?'sunday':i===6?'saturday':''}">${day}</div>`).join('')}${cells}</div>${attendanceLeaveForm()}</section>`;
}
function attendanceHistory(){
 const records=attendanceRecords(),key=attendanceMonthKey(),current=records.filter(r=>r.date.slice(0,7)===key),before=records.filter(r=>r.date.slice(0,7)<key),after=records.filter(r=>r.date.slice(0,7)>key);
 const expandable=(label,items)=>items.length?`<details class="attendance-history"><summary>${label} 출결 이력 (${items.length}건)</summary>${attendanceRecordTable(items)}</details>`:'';
 return panel('출결 내역',`<p class="sub">${attendanceYear}년 ${attendanceMonth}월 · ${current.length}건</p>${attendanceRecordTable(current)}${expandable('이전',before)}${expandable('이후',after)}`);
}
root.addEventListener('change',e=>{
 if(e.target.id!=='tm-attendance-year'&&e.target.id!=='tm-attendance-month')return;
 attendanceYear=Number(root.querySelector('#tm-attendance-year').value);attendanceMonth=Number(root.querySelector('#tm-attendance-month').value);attendanceSelectedDate=null;render();root.querySelector('#'+e.target.id)?.focus();
});

function attendance(){if(liveEmployee&&!testEmployee){const state=window.AttendanceWorkspace?.getState();if(!state?.data)return panel('출근 달력','<p role="status">'+attendanceEscape(state?.error||'본인 출결 기록을 불러오는 중입니다.')+'</p>'+(state?.error?'<button type="button" class="secondary" data-checkin-refresh>다시 확인</button>':''));}return attendanceCalendar()}

let salesStatus='normal';
const salesPendingRecords=[
 {date:'2026-09-22',name:'강예시',phone:'010-0000-1301',area:'경기도 부천시 예시로 2'},
 {date:'2026-09-22',name:'조예시',phone:'010-0000-1302',area:'경기도 파주시 예시로 3'}
];
function salesAsRows(){return [['김예시','한화','접수 중복',pill('재콜 필요','amber')],['이예시','GA 실버','접수 중복',pill('재콜 예정')],['박예시','한화','동의 답변 미흡',pill('재콜 필요','amber')]]}
function salesStatusMenu(){const counts={'all-pending':salesPendingRecords.length,'today-pending':salesPendingRecords.filter(r=>r.date==='2026-09-22').length,normal:performance[selected]||0,as:salesAsRows().length};return '<div class="sales-status-menu" role="group" aria-label="접수 상태">'+[['normal','정상 접수','blue'],['all-pending','총 가접수','pink'],['today-pending','오늘의 가접수','pink'],['as','A/S','amber']].map(([key,label,color])=>`<button type="button" class="sales-filter-button ${color}" data-sales-status="${key}" aria-pressed="${salesStatus===key}" aria-controls="tm-sales-list">${label} <strong>${counts[key]}건</strong></button>`).join('')+'</div>'}
function salesStatusRows(){
 if(salesStatus==='normal')return dayRows();
 if(salesStatus==='as')return panel('A/S · 처리 필요',table(['고객','접수처','사유','상태'],salesAsRows()));
 const todayOnly=salesStatus==='today-pending';
 const records=salesPendingRecords.filter(r=>!todayOnly||r.date==='2026-09-22');
 return panel((todayOnly?'오늘의 가접수 · 9월 22일':'총 가접수 · 전체 기간')+' · '+records.length+'건',records.length?table(['접수일','고객명','전화번호','지역','상태'],records.map(r=>[r.date,r.name,r.phone,r.area,pill('가접수','pink')])):'<p class="sub">가접수 내역이 없습니다.</p>');
}

function sales(){if(liveEmployee)return window.SalesWorkspace?.render('sales')||'<p role="status">본인 실적을 불러오는 중입니다. 새로고침해 주세요.</p>';return `<div class="sales-pay">`+stats([['오늘까지 근로 급여 · 세전',gradeMoney(gradeCalculate(gradePolicy,'monthly',total,92).base),'예시 인정 92시간 × 현재 기준 시급'],['이번 달 예상 급여 · 세전',gradeMoney(gradeCalculate(gradePolicy,'monthly',total,132).total),'예시 132시간 + 현재 월 성과급'],['오늘 일그레이드',gradeMoney(AdminWorkspace.todayDaily().amount),'당일 별도 집계 · 급여 제외']])+`</div><section class="sales-summary" aria-label="이번 달 실적 요약"><div class="sales-status-received"><span>9월 정상 실적</span><strong>${total}건</strong></div><div class="sales-status-pending"><span>가접수</span><strong>2건</strong></div><div class="sales-status-as"><span>A/S</span><strong>3건</strong></div></section>`+`<h2>나의 실적</h2>`+graph()+calendar()+`${salesStatusMenu()}<div id="tm-sales-list" aria-live="polite">${salesStatusRows()}</div>`}
const gradeOpenDetails=new Set();
root.addEventListener('toggle',event=>{const detail=event.target;if(!detail.isConnected||!detail.dataset.gradeDisclosure)return;if(detail.open)gradeOpenDetails.add(detail.dataset.gradeDisclosure);else gradeOpenDetails.delete(detail.dataset.gradeDisclosure);},true);
function gradeDisclosure(key,title,content,card=false){return `<details class="${card?'grade-stat-disclosure':'panel grade-list-disclosure'}" data-grade-disclosure="${key}" ${gradeOpenDetails.has(key)?'open':''}><summary>${title}</summary><div class="grade-disclosure-content">${content}</div></details>`;}
function gradeDisclosureStats(group,items){return '<div class="grade-compact-stats">'+items.map(([label,value,content],index)=>gradeDisclosure(group+'-'+index,'<span>'+label+'</span><strong>'+value+'</strong>',content,true)).join('')+'</div>';}
function personalDailyContent(){
 const snapshot=window.GradeHeader?.getState(),data=snapshot?.data;
 if(!data)return `<h2>일 그레이드</h2><p class="sub" role="status">${gradeEscape(snapshot?.error||'본인 일 그레이드를 불러오는 중입니다.')}</p>`;
 const d=data.daily;
 return `<h2>일 그레이드</h2><p class="sub">${gradeEscape(window.CNCHOME_LIVE.user.display_name)} · ${gradeEscape(data.date)} · 오늘 본인 정상 실적 <strong>${d.count}건</strong></p>`+
 (d.eligible&&d.amount!=null?gradeDisclosureStats('daily',[
  ['이번 달 수령 총액',gradeMoney(d.monthPaid??gradePersonalData?.dailyPaid??0),table(['수령일','정상 실적','수령 금액'],(d.monthReceipts||gradePersonalData?.dailyDetails||[]).filter(day=>day.amount>0).map(day=>[gradeEscape(day.date),gradeNumber(day.count)+'건',gradeMoney(day.amount)]))],
  ['오늘 수령·선지급액',gradeMoney(d.paid),table(['날짜','달성 건수','선지급액'],[[gradeEscape(data.date),gradeNumber(d.paidCount)+'건',gradeMoney(d.paid)]])],
  ['급여일 재지급액',gradeMoney(d.pending),table(['달성액','자동 선지급액','급여일 재지급액'],[[gradeMoney(d.amount),gradeMoney(d.paid),gradeMoney(d.pending)]])]
 ]):'')+
 (!d.eligible?'<p class="sub">일 그레이드 지급 대상이 아닙니다.</p>':d.target==null||d.perCase==null?'<p class="sub">일 그레이드 지급 기준이 등록되지 않았습니다.</p>':'')+
 '<p class="sub">금액은 정상 접수 달성 건수로 누적 산출합니다. 수령 버튼과는 별개이며, 달성한 건은 버튼을 누르지 않아도 자동 수령·선지급 처리합니다. _원과 수령 완료 버튼은 상태 표시이며 급여일에 다시 지급하지 않습니다.</p>';
}
function daily(){if(!gradePeriodVisible('daily'))return '';if(!gradeEmployeeAvailable())return gradeDepartmentPending();
 if(window.CNCHOME_LIVE){
  if(window.CNCHOME_LIVE.user.role!=='employee')return panel('일 그레이드','<p class="sub">직원별 본인 정상 실적에 따라 각각 계산하여 지급합니다.</p>'+gradeSummaryTable('daily'));
  return `<section id="tm-personal-daily">${personalDailyContent()}</section>`;
 }
 const d=AdminWorkspace.todayDaily('staff-0');return `<h2>일 그레이드</h2><p>${d.date} · 매일 본인 실적부터 집계 · 급여·주휴수당 제외</p>`+stats([['오늘 본인 정상 실적',d.count+'건','개인별 당일 집계'],['오늘 개인 달성액',gradeMoney(d.amount),'시작 건수를 포함하여 건당 지급'],['오늘 지급액',gradeMoney(d.paid),'해당 직원의 관리자 지급 기록 기준']])+panel('오늘 지급 상태',d.paid?'지급 완료':'관리자 지급 확인 대기')+panel('일 그레이드',gradeSummaryTable('daily'));
}
window.addEventListener('cnc:grade-summary-updated',()=>{
 const dailyTarget=root.querySelector('#tm-personal-daily');if(dailyTarget)dailyTarget.innerHTML=personalDailyContent();
 const weeklyTarget=root.querySelector('#tm-personal-weekly');if(weeklyTarget)weeklyTarget.innerHTML=personalWeeklyContent();
});
function personalWeeklyContent(){
 const snapshot=window.GradeHeader?.getState(),data=snapshot?.data,title='<h2>지난주 개인별 주그레이드</h2>';
 if(!data)return title+`<p class="sub" role="status">${gradeEscape(snapshot?.error||'본인 주그레이드를 불러오는 중입니다.')}</p>`;
 if(!data.general)return title+'<p class="sub">일반직원 주그레이드 지급 대상이 아닙니다.</p>';
 const w=data.previousWeek||data.weekly,available=w.availableDays,average=w.basis==='average',ready=data.scheduleRegistered&&(w.policyRegistered??data.policyRegistered);
 const formula=average?`${w.count}건 ÷ 월~금 근무가능일 ${available??'미등록'}일`:'월~금 개인 정상 실적 합계';
 const dayTable=table(w.dates.map((day,i)=>`${gradeEscape(day.date.slice(5))} (${'월화수목금'[i]})`),[w.dates.map(day=>!day.scheduled?'대상일 아님':!day.completed?'집계 예정':gradeNumber(day.count)+'건')]);
 const parts=(w.parts||[]).map(p=>[gradeEscape(p.start+' ~ '+p.end),gradeEscape(p.effective),`${gradeMoney(p.fullBonus)} × ${p.days}/5`,gradeMoney(p.bonus)]);
 return title+`<p class="sub">${gradeEscape(w.start)} ~ ${gradeEscape(w.end)}</p>`+gradeDisclosureStats('weekly',[
 ['본인 지난주 정상 실적',gradeNumber(w.count)+'건',dayTable],
 [average?'월~금 기준 일평균':'본인 정상실적 합계',w.value==null?'미산정':gradeNumber(w.value)+'건',table(['정상 실적','근무가능일','계산 결과'],[[gradeNumber(w.count)+'건',(available??'미등록')+'일',w.value==null?'미산정':gradeNumber(w.value)+'건']])],
 ['지난주 주그레이드',ready?gradeMoney(w.amount):'미산정',parts.length?table(['적용 기간','기준 적용일','구간 금액 × 일수/5','지급대상액'],parts):'<p class="sub">근무정보와 지급 기준을 확인해 주세요.</p>']
 ])+
 `<p class="sub">주그레이드는 월~금 5일 기준입니다. 토·일은 계산에서 제외합니다. 입·퇴사나 근무요일로 대상일이 적으면 해당 일수로 평균을 구하고 지급액은 대상일수/5로 비례 계산합니다. 지난주 월요일부터 금요일까지의 실적과 해당 기간의 지급 기준으로 계산합니다.</p>`+
 (parts.length?gradeDisclosure('weekly-calculation','주그레이드 금액 계산 · '+gradeMoney(w.amount),table(['적용 기간','기준 적용일','단일 구간 금액 × 적용일수/5','지급대상액'],parts)):'')+
 gradeDisclosure('weekly-rules','개인별 주그레이드 지급 기준 (해당 구간에 단일 지급, 중복 지급 안 됨)',gradeWeeklyTable({weekly:w.rules}))+`<div class="notice">주그레이드는 달성한 구간의 금액을 한 번 지급하며 월그레이드와 함께 합산합니다. 이 주의 주그레이드는 ${gradeEscape(w.payrollMonth)} 급여에 반영합니다.</div>`;
}
function weekly(){if(!gradePeriodVisible('weekly'))return '';if(!gradeEmployeeAvailable())return gradeDepartmentPending();
 if(window.CNCHOME_LIVE?.user.role==='employee')return `<section id="tm-personal-weekly">${personalWeeklyContent()}</section>`;
 const count=15,result=gradeCalculate(gradePolicy,'weekly',count,0,5);
 return '<h2>개인별 주그레이드(해당 주 평균 목표개수)</h2>'+stats([['본인 이번 주 정상 실적',count+'건','개인 실적 예시 · 월~금'],['본인 일평균 정상 실적',gradeNumber(result.value)+'건',count+'건 ÷ 5일'],['본인 주그레이드 예상 지급액',gradeMoney(result.bonus),'해당 구간 단일 지급']])+panel('개인별 주그레이드 지급 기준 (해당 구간에 단일 지급, 중복 지급 안 됨)',gradeSummaryTable('weekly'));
}


function monthly(){if(!gradePeriodVisible('monthly'))return '';if(!gradeEmployeeAvailable())return gradeDepartmentPending();if(liveEmployee){const registered=gradeEntries.some(e=>(e.department||'insurance')===gradeEmployeeDepartment()&&e.date<=gradeToday());return (registered?panel('월그레이드 기준표',gradeEmployeeDepartment()==='insurance'?gradeOriginalMonthlyTable(gradePolicy):gradeSummaryTable('monthly')):panel('월그레이드 기준표','<p class="sub">등록된 월그레이드 지급 기준이 없습니다.</p>'));}const personal=window.CNCHOME_LIVE?.user.role==='employee'?gradePersonalTotalsPanel():'';if(gradeEmployeeDepartment()==='insurance')return personal+panel('월그레이드 기준표',gradeOriginalMonthlyTable(gradePolicy));const result=gradeCalculate(gradePolicy,'monthly',total);const next=gradePolicy.monthly.find(r=>r.min>total);return personal+`<h2>월그레이드</h2>`+stats([['이번 달 정상 실적',`${total}건`,'A/S 제외'],['현재 구간 시급',gradeMoney(result.hourly),'현재 적용 기준'],['현재 월 성과급',gradeMoney(result.bonus),`달성 ${gradeMoney(result.achievement)} + 추가 ${gradeMoney(result.extra)}`]])+(next?panel('다음 구간까지',`<div class="row"><strong>${next.min}건까지 ${next.min-total}건</strong><span>${total} / ${next.min}건</span></div><div class="track"><span style="width:${Math.min(100,total/next.min*100)}%"></span></div><p class="sub">${next.min}건 달성 시 시급 ${gradeMoney(next.hourly)} · 달성 수당 ${gradeMoney(next.achievement)}</p>`):panel('현재 구간','<p>최상위 구간을 달성했습니다.</p>'))+panel('현재 적용 월그레이드 기준표',gradeTable())+`<p class="sub">현재 기준으로 계산한 예시입니다. 과거 지급 내역은 자동 변경하지 않습니다.</p>`}

function grade(){if(!gradeEmployeeAvailable())return gradeDepartmentPending();if(window.GradeVisibility?.anyVisible()===false)return panel('그레이드','<p class="sub">현재 공개된 그레이드가 없습니다.</p>');return `<h2>그레이드</h2>`+(liveEmployee?gradePersonalTotalsPanel():'')+daily()+weekly()+monthly()+gradeHistoryHtml(gradeEmployeeDepartment(),true)}
function asPage(){if(liveEmployee)return window.SalesWorkspace?.render('as')||'<p role="status">본인 A/S 내역을 불러오는 중입니다. 새로고침해 주세요.</p>';return `<h2>나의 A/S</h2>`+stats([['처리 필요','3건','중복 2 · 동의 답변 미흡 1'],['오늘 재콜 예정','1건','9월 22일 16:50'],['재콜 완료','1건','기존 A/S 기록 보존']])+panel('처리 내역',table(['고객','접수처','사유','상태','상세'],[['김예시','한화','접수 중복',pill('재콜 필요','amber'),'<button class="secondary" data-action="as-detail">보기</button>'],['이예시','GA 실버','접수 중복',pill('재콜 예정'),'<button class="secondary" data-action="as-detail">보기</button>'],['박예시','한화','동의 답변 미흡',pill('재콜 필요','amber'),'<button class="secondary" data-action="as-detail">보기</button>'],['최예시','GA 실버','접수 중복',pill('재콜 완료','green'),'010-****-1203']]))+`<p class="sub">진행 중인 A/S의 상세 화면에서 연락처를 확인할 수 있습니다. 재콜 완료 시 다시 가려집니다.</p>`}
function adminPage(title,description,summary,rows){return `<div class="row"><div><h2>${title}</h2><p class="sub">${description}</p></div><span class="pill">관리자 전용</span></div>`+stats(summary)+panel('관리 항목',table(['구분','관리 내용','우선 확인'],rows))}
const adminTeams=[
 {id:'insurance',name:'보험팀'},
 {id:'cosmetics',name:'화장품팀'}
];
const adminEmployees=[
 {name:'김상담',team:'insurance',attendance:'출근',normal:8,pending:2,as:1,monthly:86,grade:'81~90건'},
 {name:'이민지',team:'insurance',attendance:'출근',normal:2,pending:0,as:0,monthly:78,grade:'71~80건'},
 {name:'박지훈',team:'insurance',attendance:'출근',normal:0,pending:0,as:0,monthly:74,grade:'71~80건'},
 {name:'최서연',team:'insurance',attendance:'휴가',normal:0,pending:0,as:0,monthly:69,grade:'61~70건'},
 {name:'정현우',team:'insurance',attendance:'출근',normal:0,pending:0,as:0,monthly:67,grade:'61~70건'},
 {name:'윤지영',team:'insurance',attendance:'출근',normal:0,pending:0,as:0,monthly:64,grade:'61~70건'},
 {name:'장민수',team:'insurance',attendance:'출근',normal:0,pending:0,as:0,monthly:59,grade:'60건 이하'},
 {name:'한수진',team:'insurance',attendance:'출근',normal:0,pending:0,as:0,monthly:57,grade:'60건 이하'},
 {name:'오정민',team:'cosmetics',attendance:'출근',normal:3,pending:1,as:0,monthly:82,grade:'81~90건'},
 {name:'강유진',team:'cosmetics',attendance:'출근',normal:2,pending:0,as:0,monthly:76,grade:'71~80건'},
 {name:'조성호',team:'cosmetics',attendance:'출근',normal:1,pending:1,as:1,monthly:72,grade:'71~80건'},
 {name:'신예은',team:'cosmetics',attendance:'출근',normal:1,pending:0,as:0,monthly:68,grade:'61~70건'},
 {name:'임동현',team:'cosmetics',attendance:'출근',normal:1,pending:0,as:0,monthly:65,grade:'61~70건'},
 {name:'서하나',team:'cosmetics',attendance:'출근',normal:0,pending:0,as:0,monthly:61,grade:'61~70건'},
 {name:'문태경',team:'cosmetics',attendance:'출근',normal:0,pending:0,as:0,monthly:55,grade:'60건 이하'},
 {name:'백소희',team:'cosmetics',attendance:'미출근',normal:0,pending:0,as:0,monthly:51,grade:'60건 이하'}
];
function adminAttendancePill(status){return pill(status,status==='출근'?'green':status==='휴가'?'amber':'pink')}
function adminTeamTotals(teamId){const people=adminEmployees.filter(employee=>employee.team===teamId);return {people,present:people.filter(employee=>employee.attendance==='출근').length,normal:people.reduce((sum,employee)=>sum+employee.normal,0),pending:people.reduce((sum,employee)=>sum+employee.pending,0),as:people.reduce((sum,employee)=>sum+employee.as,0),monthly:people.reduce((sum,employee)=>sum+employee.monthly,0)}}
const adminTeamPerformance={
 insurance:{1:18,2:21,3:24,4:19,7:23,8:20,9:26,10:28,11:22,14:25,15:27,16:24,17:29,18:26,21:25,22:10},
 cosmetics:{1:15,2:18,3:20,4:16,7:19,8:17,9:22,10:24,11:18,14:21,15:23,16:20,17:25,18:22,21:21,22:8}
};
function calendarNeighborCell(year,month,day){const date=new Date(Date.UTC(year,month-1,day));return `<div class="day sales-outside-month" aria-label="${date.toISOString().slice(0,10)}"><span class="date-number">${date.getUTCMonth()+1}월 ${date.getUTCDate()}</span></div>`;}
function adminTeamPerformanceCalendar(team){
 const daily=adminTeamPerformance[team.id]||{},monthTotal=Object.values(daily).reduce((sum,count)=>sum+count,0);
 const firstDay=new Date(2026,8,1).getDay();
 let cells=Array.from({length:firstDay},(_,i)=>calendarNeighborCell(2026,9,i-firstDay+1)).join('');
 for(let day=1;day<=30;day++){
  const count=daily[day],future=day>22;
  cells+=`<div class="day ${day===22?'active':''}" data-calendar-date="2026-09-${String(day).padStart(2,'0')}" aria-label="9월 ${day}일 ${future?'집계 전':'정상 접수 '+(count||0)+'건'}"><span class="date-number">${day}</span><small>${future?'집계 전':count?'정상 '+count+'건':'0건'}</small></div>`;
 }
 cells+=Array.from({length:(7-(firstDay+30)%7)%7},(_,i)=>calendarNeighborCell(2026,9,31+i)).join('');
 return panel(team.name+' 실적 달력',`<div class="row" style="margin-bottom:12px"><strong>2026년 9월</strong><span class="pill">정상접수 누계 ${monthTotal}건</span></div><div class="calendar">${['일','월','화','수','목','금','토'].map(day=>`<div class="weekday">${day}</div>`).join('')}${cells}</div>`);
}
function adminHome(){
 const totals=adminTeams.map(team=>({team,...adminTeamTotals(team.id)}));
 const present=totals.reduce((sum,item)=>sum+item.present,0),normal=totals.reduce((sum,item)=>sum+item.normal,0),pending=totals.reduce((sum,item)=>sum+item.pending,0),asCount=totals.reduce((sum,item)=>sum+item.as,0);
 const teamSummary=table(['팀','재직','오늘 출근','정상 접수','가접수','A/S','월 실적'],totals.map(item=>[item.team.name,item.people.length+'명',item.present+'명',item.normal+'건',item.pending+'건',item.as+'건',item.monthly+'건']).concat([['전체',adminEmployees.length+'명',present+'명',normal+'건',pending+'건',asCount+'건',totals.reduce((sum,item)=>sum+item.monthly,0)+'건']]));
 const teamPanels=totals.map(item=>panel(item.team.name+' 직원 현황',table(['직원','출결','정상 접수','가접수','A/S','월 실적','월그레이드'],item.people.map(employee=>[policyEscape(employee.name),adminAttendancePill(employee.attendance),employee.normal+'건',employee.pending+'건',employee.as+'건',employee.monthly+'건',employee.grade])))).join('');
 return `<div class="row"><div><h2>관리자 홈</h2><p class="sub">전체 직원을 영업팀별로 구분해 오늘 운영 현황을 확인합니다.</p></div><span class="pill">전체 직원 ${adminEmployees.length}명 · ${adminTeams.length}개 팀</span></div>`+
 `<div class="team-calendar-stack">${adminTeams.map(adminTeamPerformanceCalendar).join('')}</div>`+
 stats([['운영 팀',adminTeams.length+'개','보험팀 · 화장품팀'],['오늘 출근',present+'명','전체 '+adminEmployees.length+'명'],['오늘 전체 접수',(normal+pending+asCount)+'건','정상 '+normal+' · 가접수 '+pending+' · A/S '+asCount]])+
 panel('팀별 현황',teamSummary)+teamPanels+
 `<div class="notice">팀 목록에 새 팀을 추가하면 팀별 요약과 직원 현황 구역이 자동으로 확장됩니다.</div>`
}
let policyConfirmedRows='';
let policyRegistrationPending=false,policyRegistrationStatus={message:'',kind:'info'};
let policyRows=[],policyRegisteredRows=[],policyImageData='',policyImageName='',policyRegistered=false,policyOcrRunning=false,policyOcrProgress=0,policyPaddleOcr=null,policyPaddlePromise=null,policyIntakeTitle='';
function policyCleanText(value){return String(value??'')}
function policyCleanRows(rows){return rows.map(row=>row.map(policyCleanText))}
function policyEscape(value){return policyCleanText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
let policyDetectedCodes=[],policyCodeTitles=[];
function policyRememberCodes(codes){
 policyDetectedCodes=[...new Set(codes.map(code=>code?.id).filter(Boolean))];
 if(policyDetectedCodes.length===1){
  policyPublicationCarrier=policyDetectedCodes[0];
  const select=root.querySelector('#tm-policy-publication-carrier');if(select)select.value=policyPublicationCarrier;
 }
}
function policyDraftCodeMetadata(){
 const values=[...policyCodeTitles];
 const codeIndex=(policyRows[0]||[]).findIndex(cell=>/^(?:접수)?코드$/.test(String(cell||'').replace(/\s/g,'')));
 if(codeIndex>=0)for(const row of policyRows.slice(1)){if(String(row[codeIndex]||'').trim())values.push(row[codeIndex])}
 const known=[],unknown=[];
 for(const value of values){const code=policyCodeHeader(value);if(code)known.push(code.id);else unknown.push(value)}
 return {known:[...new Set(known)],unknown:[...new Set(unknown)]};
}
function parsePolicyText(text){
 policyDetectedCodes=[];policyCodeTitles=[];policyIntakeTitle='';
 const prepared=PolicyInput.prepare(text,policyCodeHeader);let parsed=prepared.rows;
 policyPublicationKind=prepared.kinds.length>1?'auto':prepared.kinds[0]||'auto';
 const kindSelect=root.querySelector('#tm-policy-publication-kind');if(kindSelect)kindSelect.value=policyPublicationKind;
 if(!parsed.length)return [];
 const codes=[];
 parsed=parsed.filter(row=>{
  const nonempty=row.filter(Boolean),code=nonempty.length===1?policyCodeHeader(nonempty[0]):null;
  if(!code)return true;
  codes.push(code);policyCodeTitles.push(code.title);return false;
 });
 policyIntakeTitle=policyCodeTitles.join(' · ');
 const header=parsed[0]||[],compact=value=>String(value||'').replace(/\s/g,'');
 const regionIndex=header.findIndex(cell=>/^(?:(?:접수)?가능)?지역(?:명)?$|^범위$|^시.?군(?:.?구)?$/.test(compact(cell)));
 const quantityIndex=header.findIndex(cell=>/수량|배정|이월|건수/.test(compact(cell)));
 if(regionIndex>=0&&quantityIndex>=0){
  const codeIndex=header.findIndex(cell=>/^(?:접수)?코드$/.test(compact(cell)));
  if(codeIndex>=0)for(const row of parsed.slice(1)){const code=policyCodeHeader(row[codeIndex]);if(code)codes.push(code)}
  const statusIndex=header.findIndex(cell=>/^(?:상태|접수여부|가능여부)$/.test(compact(cell)));
  const order=[regionIndex,quantityIndex,...(statusIndex>=0?[statusIndex]:[]),...header.map((_,i)=>i).filter(i=>i!==regionIndex&&i!==quantityIndex&&i!==statusIndex)];
  parsed=parsed.map(row=>order.map(index=>row[index]||''));
 }else if(parsed.length)parsed.unshift(['지역','수량','상태']);
 policyRememberCodes(codes);return parsed;
}

// Nationwide reference is independent of uploaded OCR images.
const policyProvinceNames=KoreaRegionCatalog.provinceNames;
const policyCityData=[...KoreaRegionCatalog.municipalities,...KoreaRegionCatalog.districts];
const policyCityGroups=Object.keys(policyProvinceNames).map(p=>[p,policyCityData.filter(c=>c.province===p).map(c=>(c.parent?c.parent+' ':'')+c.name).join(' · ')]);
const policyDirections=['북부','남부','서부','동부','중부','서북부','서남부','동북부','동남부','북서부','북동부','남서부','남동부'];
let policyCityOriginalRows=[],policyCityAudit=[],policyCityDrafts=new Map();
function policyCityProvince(text){
 const value=String(text).trim();
 return Object.keys(policyProvinceNames).find(p=>value.startsWith(policyProvinceNames[p])||new RegExp('^'+p+'(?:도|전체|[동서남북중]{1,2}부|\\s|[:：])').test(value))||'';
}
function policyCityDistance(a,b){
 const x=Array.from(a.normalize('NFD')),y=Array.from(b.normalize('NFD'));let previous=Array.from({length:y.length+1},(_,i)=>i);
 for(let i=1;i<=x.length;i++){const next=[i];for(let j=1;j<=y.length;j++)next[j]=Math.min(next[j-1]+1,previous[j]+1,previous[j-1]+(x[i-1]===y[j-1]?0:1));previous=next}
 return previous[y.length];
}
// Reference names confirmed in the supplied policy image; not a nationwide county registry.
const policyReferenceCounties=['성주','칠곡','예천','봉화','고령','청도','의성','청송','영양','영덕','울진','울릉'];
function policyCityIssues(text){
 if(policyCodeHeader(text))return [];
 const province=policyCityProvince(text),issues=[];
 for(const match of String(text).matchAll(/[가-힣]+/g)){
  const token=match[0],areaHeading=PolicyRegionRules.heading(token);if(areaHeading?.broad&&!areaHeading.parent)continue;if(token.length<2){if(token==='수')issues.push({token,start:match.index,end:match.index+token.length,kind:'unknown',choices:[]});continue}
  if(Object.values(policyProvinceNames).includes(token)||PolicyRegionRules.catalog.some(c=>c.kind==='county'&&c.aliases.includes(token)))continue;
  let exact=policyCityData.filter(c=>c.aliases.includes(token)||(c.province!=='광주'&&c.name.endsWith('시')&&c.name.replace(/(?:특별자치시|특별시|광역시)$/,'시')===token));
  if(province&&exact.some(c=>c.province===province))exact=exact.filter(c=>c.province===province);
  if(token==='광주'&&!province&&PolicyRegionRules.isGyeonggiGwangjuList(text))exact=exact.filter(c=>c.province==='경기');
  if(exact.length){if(exact.length>1)issues.push({token,start:match.index,end:match.index+token.length,kind:'ambiguous',choices:exact});continue}
  if(['전체','제외','포함','일부','지역','가능','불가','일반','실버','접수','마감','확인','필요','및','일원'].includes(token)||policyDirections.includes(token)||policyKnownRegion(token)||/[군구읍면동리]$/.test(token))continue;
  const scored=policyCityData.map(city=>({city,distance:Math.min(...city.aliases.map(alias=>policyCityDistance(token,alias)))}))
   .filter(x=>x.distance<=3).sort((a,b)=>(province?Number(b.city.province===province)-Number(a.city.province===province):0)||a.distance-b.distance||a.city.name.localeCompare(b.city.name,'ko'));
  issues.push({token,start:match.index,end:match.index+token.length,kind:'unknown',choices:scored.slice(0,3).map(x=>x.city)});
 }
 return issues;
}
function policyPrepareCityReview(){
 // OCR output stays verbatim; dictionary suggestions require explicit user selection.
 policyCityOriginalRows=policyRows.map(row=>[...row]);policyCityAudit=[];policyCityDrafts.clear();
 policySyncCityText();
}
function policySyncCityText(){const input=root.querySelector('#tm-policy-paste');if(input)input.value=policyRows.map(r=>r.join('\t')).join('\n')}
function policyCityReviewMarkup(){
 if(policyRows.length<2)return '';
 const rows=policyRows.slice(1).map((row,offset)=>{
  const index=offset+1,text=String(row[0]||''),issues=policyCityIssues(text),audit=policyCityAudit.filter(a=>a.row===index);
  const choices=issues.map(issue=>'<div style="margin:6px 0"><strong>'+policyEscape(issue.token)+'</strong> · '+(issue.kind==='ambiguous'?'동명 지명 · 시도 확인':'전국 시·군·구 기준에 없음')+
   (issue.choices.length?'<div class="row">'+issue.choices.map(city=>'<button type="button" class="secondary" data-action="policy-city-suggest" data-row="'+index+'" data-start="'+issue.start+'" data-end="'+issue.end+'" data-token="'+policyEscape(issue.token)+'" data-city="'+policyEscape(city.name)+'">'+policyEscape(city.province+' '+city.name)+'</button>').join('')+'</div>':' · 직접 수정하거나 원문을 유지해 주세요.')+'</div>').join('');
  const note=audit.map(a=>policyEscape(a.from+' → '+a.to+' · '+a.reason)).join('<br>');
  return [String(index),policyEscape(policyCityOriginalRows[index]?.[0]??text),'<input aria-label="'+index+'행 최종 지역명" data-city-row="'+index+'" value="'+policyEscape(policyCityDrafts.get(index)??text)+'" style="width:100%;min-width:250px;box-sizing:border-box"><button type="button" class="action" data-action="policy-city-save" data-row="'+index+'">수정 적용</button>',(note?'<div>'+note+'</div>':'')+(choices||(PolicyRegionRules.heading(text)?.broad&&!PolicyRegionRules.heading(text)?.parent?policyEscape(policyProvinceNames[PolicyRegionRules.heading(text).province]+' 전체 시·군에 적용'):'전국 지명 대조 완료 · 권역·하위 지명은 원문 유지'))];
 });
 return '<section style="margin-top:20px"><h3>마지막 지명 확인 · 수정</h3><p class="sub">전국 시·군·구 '+policyCityData.length+'개 기준 항목을 비교합니다. OCR 판독과 별도로 원문의 행정구역 표기를 확인합니다. 기준 명칭과 다른 원문은 직접 확인한 뒤 수정 적용을 누르세요. 수량과 한자·기호는 유지됩니다.</p>'+table(['행','원문 판독','최종 지역명','지명 확인 · 후보'],rows)+'<details><summary>전국 시·군·구 기준 보기</summary><p class="sub">기준 확인: 2026-09-24 · 행정안전부 및 지자체 공식 자료 · 광역시·제주 행정시 포함</p>'+table(['시도','기본 시'],policyCityGroups.map(([p,n])=>[policyEscape(policyProvinceNames[p]),policyEscape(n)]))+'</details></section>';
}
function policyReviewCount(){return policyConfirmedRows===JSON.stringify(policyRows)?0:policyScopesForRows(policyRows).filter(scope=>scope.errors.length).length;}
function policyUpdateCheckCount(){const el=root.querySelector('#tm-policy-check-count');if(el)el.textContent='체크할 항목 : '+policyReviewCount()+'건';}
function policyEditResult(message){
 const errors=policyScopesForRows(policyRows).filter(scope=>scope.errors.length);
 toast(message+(errors.length?' 추가 확인이 필요한 '+errors.length+'개 행: '+errors.map(scope=>scope.index+'행 ('+scope.errors.join(' · ')+')').join(', ')+'. 마지막 지명 확인 · 수정에서 수정해 주세요.':' 정책표 등록을 눌러 DB에 저장해 주세요.'));
}
async function policyApplyAllCityRows(){
 if(policyRegistrationPending)return false;
 if(policyOcrRunning)return;
 if(!policyRows.length&&!policyImageData&&root.querySelector('#tm-policy-paste')?.value.trim())policyConvertText();
 if(policyRows.length<2){toast('먼저 정책표를 변환해 주세요.');return;}
 const updates=[...root.querySelectorAll('[data-city-row]')].map(input=>({index:Number(input.dataset.cityRow),value:input.value.trim()}));
 if(updates.some(({index,value})=>!value||!Number.isInteger(index)||index<1||index>=policyRows.length)){toast('지역명이 빈 행이나 잘못된 행을 확인해 주세요.');return}
 let changed=0;
 for(const {index,value} of updates){
  const before=policyRows[index][0];
  if(before===value)continue;
  policyRows[index][0]=value;policyCityAudit.push({row:index,from:before,to:value,reason:'일괄 적용'});changed++;
 }
 policyCityDrafts.clear();
 if(changed)policyRegistered=false;
 policySyncCityText();policyRefreshPreview();
 return await policyRegister({reviewed:true});
}
function policyUpdateCityRow(index,text,reason){
 if(policyOcrRunning||!Number.isInteger(index)||index<1||index>=policyRows.length)return;
 const value=String(text).trim();if(!value){toast('지역명을 입력해 주세요.');return}
 const before=policyRows[index][0];if(before===value){policyEditResult(index+'행을 확인했습니다. 변경된 내용은 없습니다.');return;}
 policyCityDrafts.delete(index);policyRows[index][0]=value;policyCityAudit.push({row:index,from:before,to:value,reason});policyRegistered=false;
 policySyncCityText();policyRefreshPreview();policyEditResult(index+'행의 수정 내용을 적용했습니다.');
}


// Classification reads the original text; no OCR text is silently substituted.
let policyRegisteredCode='',policyRegisteredKey='',policyScopeSelected=0,policyScopeCity='',policyScopeDetail='';
function policyScopeTable(rows){
 if(rows.length<2)return '';
 const scopes=policyScopesForRows(rows),fmt=t=>(t.name||(PolicyRegionRules.provinceNames[t.province]||t.province)+' 전체')+(t.path.length?' → '+t.path.join(' → '):'');
 const renderTable=items=>table(['가능지역','불가지역','가능수량','적용 조건'],items.map(scope=>{
  const unavailable=scope.unavailable||scope.quantity===0;
  const uncertain=scope.errors.length||scope.quantityReview||scope.quantity===null;
  const allowed=unavailable?[]:scope.include;
  const denied=unavailable?[...scope.include,...scope.exclude]:scope.exclude;
  const unique=targets=>[...new Map(targets.map(target=>[JSON.stringify([target.province,target.name,target.path]),target])).values()];
  const allowedText=allowed.length?unique(allowed).map(fmt).join(', '):'';
  const deniedNames=denied.length?unique(denied).map(fmt).join(', '):'';
  const deniedText=!unavailable&&(scope.only||scope.listedOnly)?[deniedNames,'기재 지역 외 (이 행 기준)'].filter(Boolean).join(' · '):deniedNames;
  const notes=[...scope.errors.map(error=>error.replace(/^지역명 확인 필요:/,'지역확인:'))];
  if(scope.quantityReview||scope.quantity===null)notes.push('수량 확인 필요');
  if(scope.quantity===0)notes.push('수량 0');
  else if(scope.unavailable)notes.push('접수 불가');
  if(!unavailable&&scope.exclude.length){
   const explicit=scope.explicitBlocks||[];
   if(explicit.length)notes.push('접수 불가로 지정된 지역');
   if(scope.exclude.some(target=>!explicit.some(block=>JSON.stringify([block.province,block.name,block.path])===JSON.stringify([target.province,target.name,target.path]))))notes.push('제외 지역은 이 행에서 불가 · 별도 가능 정책은 별도 적용');
  }
  if(!unavailable&&(scope.only||scope.listedOnly))notes.push('기재 지역만 가능 · 나머지 불가');
  return [policyEscape(uncertain&&allowed.length?'확인 필요: '+allowedText:allowedText),policyEscape(deniedText),scope.quantity===null?'':String(scope.quantity),policyEscape(notes.join(' · ')||'기재 범위')];
 }));

 const groups=PolicyRegionRules.categories(scopes);
 return '<section style="margin-top:20px"><h3>시·도 / 권역별 접수 지역</h3><p class="sub">시·도 → 정책표에 기재된 권역 → 시·군 → 구·읍·면·동·리 순으로 분류합니다. 권역 구분이 없는 정책은 시·도 아래에 표시합니다. 권역은 기재된 지역만 가능하며, 수량은 원래 정책 행별로 공유합니다.</p>'+groups.map(group=>'<details open style="margin-top:16px"><summary><strong>'+policyEscape(group.label)+'</strong></summary>'+group.sections.map(section=>section.region?'<details open style="margin:12px 0 12px 16px"><summary><strong>'+policyEscape(policyFullProvinceNames(section.label))+'</strong></summary>'+renderTable(section.scopes)+'</details>':(group.sections.length>1?'<h4>권역 구분 없음</h4>':'')+renderTable(section.scopes)).join('')+'</details>').join('')+'</section>';
}
function policyScopeChecker(){
 if(policyRegisteredRows.length<2)return '';
 return '<section style="margin-top:16px"><h3>등록 정책의 시·군 / 상세 지역 확인</h3><div class="row"><label>확인할 시·군<select id="tm-policy-scope-city"><option value="">시·군 선택</option>'+PolicyRegionRules.catalog.map(c=>'<option value="'+policyEscape(c.province+'|'+c.name)+'" '+(policyScopeCity===c.province+'|'+c.name?'selected':'')+'>'+policyEscape((PolicyRegionRules.provinceNames[c.province]||c.province)+' '+c.name)+'</option>').join('')+'</select></label><label>구·읍·면·동·리 (선택)<input id="tm-policy-scope-detail" value="'+policyEscape(policyScopeDetail)+'" placeholder="예: 의창구 북면"></label></div><div role="status" id="tm-policy-scope-result">시·군을 선택해 주세요.</div></section>';
}

function policyDisplayColumns(rows){
 const width=Math.max(0,...rows.map(row=>row.length));
 return Array.from({length:width},(_,i)=>i).filter(i=>String(rows[0]?.[i]||'').trim()!=='상태'||rows.slice(1).some(row=>!['','접수 가능','접수가능','마감'].includes(String(row[i]||'').trim())));
}
function policyFullProvinceNames(value){
 const names=PolicyRegionRules.provinceNames;
 return String(value??'').replace(/(^|[\s,，/·:：(（])(경기|강원|충북|충남|전북|전남|경북|경남|제주|서울|부산|대구|인천|대전|울산|세종)(?=$|[\s,，/·:：)）]|전체|전역|서북부|서남부|동북부|동남부|북서부|북동부|남서부|남동부|북부|남부|서부|동부|중부)/g,(_,boundary,name)=>boundary+names[name]);
}
function policyVisibleRegion(value){return policyFullProvinceNames(value).replace(/必/g,'').replace(/ {2,}/g,' ').trim()}
function policyDisplayCell(rows,r,c){
 if(r>0&&c===1&&/^(?:접수\s*)?불가$/.test(String(rows[r]?.[c]??'').trim()))return '0';
 const raw=c===0&&r>0?policyVisibleRegion(rows[r]?.[c]):String(rows[r]?.[c]??'');
 const value=r>0&&String(rows[0]?.[c]||'').trim()==='상태'?raw.replace(/지역명 확인 필요/g,'지역확인'):raw;
 return r>0&&String(rows[0]?.[c]||'').trim()==='상태'?value.split(/[·ㆍ]/).map(part=>part.trim()).filter(part=>part&&!/^(?:접수\s*가능|마감)$/.test(part)).join(' · '):value;
}

let policyRegionReviewDraft=null;
root.addEventListener('click',e=>{
 const button=e.target.closest('[data-region-review]');if(!button||policyOcrRunning)return;
 const row=Number(button.dataset.regionReview);if(!Number.isInteger(row)||row<1||!policyRows[row])return;
 policyCancelAutoConvert();
 policyRegionReviewDraft={row,record:policyRows[row],before:String(policyRows[row][0]||'')};
 open('지역명 수정','<form id="tm-region-review-form"><p>'+row+'행의 지역명을 확인하고 수정해 주세요.</p><label>수정할 지역명<input id="tm-region-review-name" name="region" required value="'+policyEscape(policyRegionReviewDraft.before)+'" style="width:100%;box-sizing:border-box"></label><p class="sub">수정 내용은 변환 표에 반영됩니다. 정책표 등록을 누르면 최종 적용됩니다.</p><button type="submit" class="action">수정 적용</button><button type="button" class="secondary" data-action="close">취소</button></form>');
 const input=root.querySelector('#tm-region-review-name');input.focus();input.select();
});
root.addEventListener('submit',e=>{
 if(e.target.id!=='tm-region-review-form')return;e.preventDefault();
 const draft=policyRegionReviewDraft,value=String(new FormData(e.target).get('region')||'').trim();
 if(!value){root.querySelector('#tm-region-review-name').focus();return}
 if(policyOcrRunning||!draft||policyRows[draft.row]!==draft.record||String(draft.record[0]||'')!==draft.before){toast('표가 변경되었습니다. 지역확인을 다시 눌러 주세요.');modal.close();return}
 const record=draft.record;record[0]=value;policyCityDrafts.delete(draft.row);
 policyCityAudit.push({row:draft.row,from:draft.before,to:value,reason:'지역확인 버튼에서 직접 확인'});
 const status=policyRows[0].findIndex(h=>String(h).trim()==='상태');
 if(status>=0)record[status]=String(record[status]||'').split(/[·ㆍ]/).map(x=>x.trim()).filter(x=>x&&!/^(?:지역명 확인 필요|지역\s*확인)$/.test(x)).join(' · ');
 policyRegistered=false;policySyncCityText();policyRegionReviewDraft=null;modal.close();policyRefreshPreview();
 toast('지역명을 수정했습니다. 정책표 등록을 누르면 적용됩니다.');
});

function policySheetMarkup(rows){
 const originalColumns=policyDisplayColumns(rows),columns=[0,-1,1,...originalColumns.filter(c=>c>1)];
 const scopes=policyScopesForRows(rows),byRow=new Map(scopes.map(scope=>[scope.index,scope]));
 const fmt=t=>(t.name||(PolicyRegionRules.provinceNames[t.province]||t.province)+'전체')+(t.path.length?' '+t.path.join(' '):'');
 const label=c=>c===0?'가능지역':c===-1?'불가지역':c===1?'가능수량':rows[0]?.[c]||'';
 const input=(r,c,value,extra='')=>'<input type="text" data-policy-cell="'+r+':'+c+'" '+((c===0&&String(rows[r]?.[0]||'').includes('必'))?'data-policy-only="true" ':'')+extra+' aria-label="'+r+'행 '+label(c)+'" value="'+policyEscape(c===0?policyVisibleRegion(value):value)+'" style="box-sizing:border-box;width:100%;min-width:0;border:1px solid #b8cbbc;border-radius:4px;padding:5px;background:#fff">';
 const cells=(r,header)=>columns.map(c=>{
  const scope=byRow.get(r),raw=String(rows[r]?.[0]||''),zero=scope&&(scope.unavailable||scope.quantity===0);
  const exclusion=raw.match(/\s*[（(][^()（）]*(?:제외|불가)[^()（）]*[)）]/g)||[];
  let content='';
  if(header)content=policyEscape(label(c));
  else if(c===0)content=zero?'<span aria-label="빈 칸" style="display:block;min-height:30px;width:100%;box-sizing:border-box;border:1px solid #b8cbbc;border-radius:4px;background:#fff"></span>':input(r,0,exclusion.length?raw.replace(/\s*[（(][^()（）]*(?:제외|불가)[^()（）]*[)）]/g,'').trim():raw,'data-policy-suffix="'+policyEscape(exclusion.join(''))+'"');
  else if(c===-1){
   if(zero)content=input(r,0,raw).replace('aria-label="'+r+'행 가능지역"','aria-label="'+r+'행 불가지역"');
   else {
    const excluded=scope?.exclude?.map(fmt).join(', ')||'';
    const text=(scope?.only||scope?.listedOnly)?[excluded,'기재 지역 외 (이 행 기준)'].filter(Boolean).join(' · '):excluded;
    content=text?'<button type="button" class="secondary" data-region-review="'+r+'" aria-label="'+r+'행 불가지역 수정" style="width:100%;text-align:left;white-space:normal">'+policyEscape(text)+'</button>':'<span aria-label="빈 칸" style="display:block;min-height:30px;width:100%;box-sizing:border-box;border:1px solid #b8cbbc;border-radius:4px;background:#fff"></span>';
   }
  }else{
   const value=policyDisplayCell(rows,r,c);
   content=input(r,c,value);
   if(String(rows[0]?.[c]||'').trim()==='상태'&&/지역\s*확인/.test(value)){
    const rest=value.split(' · ').filter(part=>!/지역\s*확인/.test(part)).join(' · ');
    content='<button type="button" class="secondary" data-region-review="'+r+'" aria-label="'+r+'행 지역확인">지역확인</button>'+(rest?'<span>'+policyEscape(rest)+'</span>':'');
   }
  }
  const tag=header?'th':'td';
  return '<'+tag+(header?' scope="col"':'')+' class="'+(header?'sheet-heading ':'')+(c===0?'sheet-region':'')+'">'+content+'</'+tag+'>';
 }).join('');
 return '<p class="sub">가능지역과 수량은 바로 수정할 수 있습니다. 불가지역을 누르면 제외 조건을 수정합니다. 수정 후 정책표 등록을 눌러 주세요.</p><div class="policy-sheet-wrap" tabindex="0" role="region" aria-label="정책표 변환 결과"><table class="policy-sheet" aria-label="정책표 엑셀형 결과"><colgroup><col style="width:44px">'+columns.map(c=>'<col'+(c===0?'':' style="width:'+(c===1?'64px':c===-1?'24%':'164px')+'"')+'>').join('')+'</colgroup><thead><tr><th class="sheet-number sheet-letter"><button type="button" class="sheet-select-all" data-policy-select-all aria-label="데이터 셀 전체 선택" aria-pressed="false" title="데이터 셀 전체 선택 · Ctrl+C로 복사"><span class="ui-icon ui-icon-select" aria-hidden="true"></span></button></th>'+columns.map((c,i)=>'<th class="sheet-letter" scope="col">'+String.fromCharCode(65+i)+'</th>').join('')+'</tr><tr><th class="sheet-number">1</th>'+cells(0,true)+'</tr></thead><tbody>'+rows.slice(1).map((row,i)=>'<tr><th class="sheet-number" scope="row">'+(i+2)+'</th>'+cells(i+1,false)+'</tr>').join('')+'</tbody></table></div>';
}
root.addEventListener('input',e=>{
 const cell=e.target.closest('[data-policy-cell]');
 if(cell&&!policyOcrRunning){
  const [r,c]=cell.dataset.policyCell.split(':').map(Number);
  if(!Number.isInteger(r)||!Number.isInteger(c)||r<1||c<0||!policyRows[r])return;
  const edited=cell.value.trim()+(c===0&&cell.dataset.policySuffix?' '+cell.dataset.policySuffix.trim():'');
  const value=(c===1&&/^(?:접수\s*)?불가$/.test(edited)?'0':edited)+(c===0&&cell.dataset.policyOnly==='true'&&!edited.includes('必')?' 必':''),before=String(policyRows[r][c]||'');
  if(value===before)return;
  policyRows[r][c]=value;policyRegistered=false;policyUpdateCheckCount();
  if(c===0){policyCityDrafts.delete(r);policyCityAudit.push({row:r,from:before,to:value,reason:'변환 표에서 직접 수정'})}
  if(c===1){
   const status=policyRows[0].findIndex(h=>String(h).trim()==='상태');
   if(status>=0&&/^(?:접수 ?가능|마감|확인 필요.*)?$/.test(String(policyRows[r][status]||'')))
    policyRows[r][status]=/^\d+$/.test(value)?Number(value)===0?'마감':'접수 가능':'확인 필요 · 수량 확인';
  }
  policySyncCityText();
 }
 if(e.target.id==='tm-policy-edit-title'&&!policyOcrRunning){
  policyIntakeTitle=e.target.value.trim();policyCodeTitles=policyIntakeTitle?[policyIntakeTitle]:[];
  policyRememberCodes(policyCodeTitles.map(title=>policyCodeHeader(title)));policyRegistered=false;
 }
});
root.addEventListener('focusout',e=>{if(e.target.matches('[data-policy-cell],#tm-policy-edit-title')&&!policyOcrRunning){const feedback=root.querySelector('#tm-policy-edit-feedback');if(feedback)feedback.innerHTML=policyCityReviewMarkup()+policyScopeTable(policyRows)}});

let policySelectionAnchor=null;
function policyClearSelection(sheet){
 sheet.classList.remove('is-all-selected');
 sheet.querySelectorAll('.sheet-selected').forEach(cell=>cell.classList.remove('sheet-selected'));
 sheet.querySelector('[data-policy-select-all]')?.setAttribute('aria-pressed','false');
}
function policySelectEveryCell(sheet){
 policyClearSelection(sheet);
 sheet.querySelectorAll('tbody td').forEach(cell=>cell.classList.add('sheet-selected'));
 sheet.querySelector('[data-policy-select-all]')?.setAttribute('aria-pressed','true');
 sheet.tabIndex=0;sheet.focus();
}
root.addEventListener('mousedown',e=>{
 if((e.shiftKey||e.ctrlKey||e.metaKey)&&e.target.closest('.policy-sheet tbody td'))e.preventDefault();
});
root.addEventListener('click',e=>{
 if(e.target.closest('.policy-cell-menu'))return;
 const sheet=e.target.closest('.policy-sheet');
 if(!sheet){
  root.querySelectorAll('.policy-sheet').forEach(policyClearSelection);
  policySelectionAnchor=null;return;
 }
 if(e.target.closest('[data-policy-select-all]')){
  policySelectEveryCell(sheet);policySelectionAnchor=sheet.querySelector('tbody td');return;
 }
 const cell=e.target.closest('tbody td');
 if(!cell)return;
 if(e.shiftKey||e.ctrlKey||e.metaKey){
  e.preventDefault();e.stopImmediatePropagation();
  if(e.shiftKey){
   const anchor=policySelectionAnchor&&sheet.contains(policySelectionAnchor)?policySelectionAnchor:cell;
   if(!e.ctrlKey&&!e.metaKey)policyClearSelection(sheet);
   const firstRow=Math.min(anchor.parentElement.sectionRowIndex,cell.parentElement.sectionRowIndex);
   const lastRow=Math.max(anchor.parentElement.sectionRowIndex,cell.parentElement.sectionRowIndex);
   const firstCol=Math.min(anchor.cellIndex,cell.cellIndex),lastCol=Math.max(anchor.cellIndex,cell.cellIndex);
   Array.from(sheet.tBodies[0].rows).slice(firstRow,lastRow+1).forEach(row=>{
    Array.from(row.cells).slice(firstCol,lastCol+1).forEach(c=>c.classList.add('sheet-selected'));
   });
   policySelectionAnchor=anchor;
  }else{
   cell.classList.toggle('sheet-selected');policySelectionAnchor=cell;
  }
  sheet.tabIndex=0;sheet.focus();
 }else{
  policyClearSelection(sheet);policySelectionAnchor=cell;
 }
},true);
root.addEventListener('keydown',e=>{
 const sheet=e.target.closest('.policy-sheet');
 if(!sheet)return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){
  e.preventDefault();policySelectEveryCell(sheet);policySelectionAnchor=sheet.querySelector('tbody td');
 }else if(e.key==='Escape'){
  policyClearSelection(sheet);policySelectionAnchor=null;
 }
});
function policySelectedMatrix(sheet){
 const selected=sheet?Array.from(sheet.querySelectorAll('tbody td.sheet-selected')):[];
 if(!selected.length)return [];
 const rowIndices=selected.map(c=>c.parentElement.sectionRowIndex),colIndices=selected.map(c=>c.cellIndex);
 const cells=[];
 for(let r=Math.min(...rowIndices);r<=Math.max(...rowIndices);r++){
  const row=[];
  for(let c=Math.min(...colIndices);c<=Math.max(...colIndices);c++){
   const cell=sheet.tBodies[0].rows[r].cells[c],input=cell.querySelector('input');
   row.push(cell.classList.contains('sheet-selected')?String(input?input.value:cell.textContent).replace(/[\t\r\n]+/g,' ').trim():'');
  }
  cells.push(row);
 }

 return cells;
}

root.addEventListener('copy',e=>{
 const sheet=document.activeElement?.closest('.policy-sheet'),cells=policySelectedMatrix(sheet);
 if(!cells.length||!e.clipboardData)return;
 e.clipboardData.setData('text/plain',cells.map(row=>row.join('\t')).join('\r\n'));
 e.clipboardData.setData('text/html','<table><tbody>'+cells.map(row=>'<tr>'+row.map(value=>'<td>'+policyEscape(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table>');
 e.preventDefault();
});
let policyContextSheet=null;
function policyCloseCellMenu(){root.querySelector('.policy-cell-menu')?.remove()}
function policyPasteCells(sheet,text){
 if(policyOcrRunning||!sheet||!sheet.isConnected)return;
 const selected=Array.from(sheet.querySelectorAll('tbody td.sheet-selected'));
 const anchor=selected.length?selected.reduce((a,b)=>a.parentElement.sectionRowIndex<b.parentElement.sectionRowIndex||a.parentElement.sectionRowIndex===b.parentElement.sectionRowIndex&&a.cellIndex<b.cellIndex?a:b):policySelectionAnchor;
 if(!anchor||!sheet.contains(anchor))return;
 const rows=String(text).replace(/\r\n?/g,'\n').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));
 const changes=[];
 for(let r=0;r<rows.length;r++)for(let c=0;c<rows[r].length;c++){
  const cell=sheet.tBodies[0].rows[anchor.parentElement.sectionRowIndex+r]?.cells[anchor.cellIndex+c];
  if(!cell){alert('붙여넣을 내용이 표 범위를 벗어납니다.');return}
  const input=cell.querySelector('input[data-policy-cell]');
  if(!input){if(rows[r][c].trim()){alert('불가지역 조건은 해당 셀을 눌러 수정해 주세요. 붙여넣기는 직접 수정 가능한 셀에 사용할 수 있습니다.');return}continue}
  changes.push([input,rows[r][c]]);
 }
 changes.forEach(([input,value])=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))});
 const feedback=root.querySelector('#tm-policy-edit-feedback');
 if(feedback)feedback.innerHTML=policyCityReviewMarkup()+policyScopeTable(policyRows);
}
root.addEventListener('paste',e=>{
 const sheet=e.target.closest('.policy-sheet');
 if(!sheet||!e.clipboardData)return;
 const text=e.clipboardData.getData('text/plain');
 if(!sheet.querySelector('.sheet-selected')&&!/[\t\r\n]/.test(text))return;
 e.preventDefault();e.stopImmediatePropagation();policyPasteCells(sheet,text);
},true);
root.addEventListener('contextmenu',e=>{
 const cell=e.target.closest('.policy-sheet tbody td');
 if(!cell)return;
 e.preventDefault();policyCloseCellMenu();
 const sheet=cell.closest('.policy-sheet');policyContextSheet=sheet;
 if(!cell.classList.contains('sheet-selected')){policyClearSelection(sheet);cell.classList.add('sheet-selected');policySelectionAnchor=cell}
 const menu=document.createElement('div');
 menu.className='policy-cell-menu';menu.setAttribute('role','menu');
 menu.style.cssText='position:fixed;z-index:10000;background:white;border:1px solid #bbc9c0;box-shadow:0 4px 16px #0002;padding:4px;min-width:160px;left:'+Math.min(e.clientX,window.innerWidth-180)+'px;top:'+Math.min(e.clientY,window.innerHeight-100)+'px';
 menu.innerHTML='<button type="button" role="menuitem" data-policy-clipboard="copy">복사　Ctrl+C</button><button type="button" role="menuitem" data-policy-clipboard="paste">붙여넣기　Ctrl+V</button>';
 root.appendChild(menu);
 menu.querySelector('button').focus();
});
root.addEventListener('click',async e=>{
 const action=e.target.closest('[data-policy-clipboard]');
 if(!action){policyCloseCellMenu();return}
 const sheet=policyContextSheet;policyCloseCellMenu();
 if(!sheet?.isConnected)return;
 sheet.tabIndex=0;sheet.focus();
 try{
  if(action.dataset.policyClipboard==='copy'){
   const cells=policySelectedMatrix(sheet);
   await navigator.clipboard.writeText(cells.map(row=>row.join('\t')).join('\r\n'));
  }else policyPasteCells(sheet,await navigator.clipboard.readText());
 }catch(error){
  alert(action.dataset.policyClipboard==='copy'?'브라우저에서 클립보드 접근을 허용하거나 Ctrl+C를 눌러 복사해 주세요.':'브라우저에서 클립보드 접근을 허용하거나 Ctrl+V를 눌러 붙여넣어 주세요.');
 }
});
root.addEventListener('keydown',e=>{if(e.key==='Escape')policyCloseCellMenu()});

function policyPreviewMarkup(){
 if(policyRows.length){return policySheetMarkup(policyRows)+'<div id="tm-policy-edit-feedback">'+policyCityReviewMarkup()+policyScopeTable(policyRows)+'</div>';}
 if(policyImageData)return '<div class="notice">정책표 전용 OCR이 표선으로 행과 수량 열을 먼저 나눈 뒤, 한글과 한문(번체·간체)을 로컬에서 인식합니다.</div><img src="'+policyImageData+'" alt="붙여넣은 정책표 이미지" style="display:block;max-width:100%;max-height:420px;margin:12px auto;border:1px solid var(--tm-line);border-radius:8px"><p class="sub">파일: '+policyEscape(policyImageName||'클립보드 이미지')+' · 이미지는 외부 서버에 전송되지 않습니다.</p><div class="row"><button type="button" class="action" data-action="policy-ocr" '+(policyOcrRunning?'disabled':'')+'>'+(policyOcrRunning?'전용 OCR 분석 중':'정책표 최고정밀 OCR로 변환')+'</button><span id="tm-policy-ocr-status" class="sub">'+(policyOcrRunning?'표 구조 분석 중 · '+policyOcrProgress+'%':'행·수량·색상 전용 분석')+'</span></div><div class="track" aria-label="OCR 진행률"><span id="tm-policy-ocr-progress" style="width:'+policyOcrProgress+'%"></span></div>';
 return '<p class="sub">아직 변환할 정책표가 없습니다. 엑셀 표·텍스트를 붙여넣거나 이미지를 선택해 주세요.</p>';
}
function policyRegisteredPreviewMarkup(){
 if(policyRegisteredKey)policyRegisteredCode=policyKeyLabel(policyRegisteredKey);
 if(!policyRegisteredRows.length)return '<div class="notice">아직 등록된 정책표가 없습니다. 위에서 내용을 변환하고 확인한 뒤 등록해 주세요.</div>';
 const columns=policyDisplayColumns(policyRegisteredRows),width=columns.length,normalized=policyRegisteredRows.map((row,r)=>columns.map(c=>policyEscape(policyDisplayCell(policyRegisteredRows,r,c))));
 return '<div class="notice">정상 등록 확인'+(policyRegisteredCode?' · '+policyEscape(policyRegisteredCode):'')+' · '+policyRegisteredRows.length+'행 '+width+'열</div>'+table(normalized[0].map((heading,index)=>heading||'열 '+(index+1)),normalized.slice(1))+policyScopeTable(policyRegisteredRows)+policyScopeChecker();
}
function policyRefreshScopeResult(){
 const target=root.querySelector('#tm-policy-scope-result');if(!target)return;
 const city=PolicyRegionRules.catalog.find(c=>c.province+'|'+c.name===policyScopeCity);
 if(!city){target.textContent='시·군을 선택해 주세요.';return}
 const result=PolicyRegionRules.evaluate(policyScopesForRows(policyRegisteredRows),{...city,path:policyScopeDetail.trim().split(/\s+/).filter(Boolean)});
 target.innerHTML=policyResultPill(result)+' · '+policyEscape(result.reason);
}
function policyRefreshRegistered(){const target=root.querySelector('#tm-policy-registered-preview');if(target){target.innerHTML=policyRegisteredPreviewMarkup();policyRefreshScopeResult()}}
function policyProvinceQualifiedRegion(raw,scope){
 const text=String(raw||'').trim();
 if(!text||!scope||scope.errors?.length)return text;
 const provinces=[...new Set([...(scope.include||[]),...(scope.exclude||[])].map(t=>t.province))];
 if(provinces.length!==1)return text;
 const province=provinces[0];
 if(!['경기','강원','충북','충남','전북','전남','경북','경남','제주'].includes(province))return text;
 const aliases=[province,PolicyRegionRules.provinceNames[province],...({강원:['강원도'],전북:['전라북도']}[province]||[])].filter(Boolean);
 if(aliases.some(name=>text.startsWith(name)))return text;
 return PolicyRegionRules.provinceNames[province]+' : '+text;
}
function policyFillMissingProvinces(){
 let changed=false;
 for(const scope of policyScopesForRows(policyRows)){
  const row=policyRows[scope.index];if(!row)continue;
  const before=String(row[0]||''),after=policyFullProvinceNames(policyProvinceQualifiedRegion(before,scope));
  if(after!==before){row[0]=after;changed=true}
 }
 if(changed)policySyncCityText();
}

function policyRefreshPreview(){policyUpdateCheckCount();const convert=root.querySelector('[data-action="policy-parse"]');if(convert)convert.disabled=policyOcrRunning;policyFillMissingProvinces();const source=root.querySelector('#tm-policy-source');if(source)source.open=!policyRows.length;const target=root.querySelector('#tm-policy-preview');if(target)target.innerHTML=policyPreviewMarkup();const register=root.querySelector('[data-action="policy-register"]');if(register)register.disabled=policyRegistrationPending||!!window.PolicySync?.saving;policyRefreshAnalysis()}
let policyTimerStarted=0,policyTimerElapsed=0,policyTimerInterval=null,policyTimerPhase='';
function policyTimerText(){return policyTimerPhase+' · '+((policyTimerInterval!==null?window.performance.now()-policyTimerStarted:policyTimerElapsed)/1000).toFixed(1)+'초'}
function policyTimerMarkup(){return '<div id="tm-policy-timer" role="timer" aria-live="off" aria-label="정책표 변환 경과 시간" style="margin:12px 0;padding:10px 14px;border-radius:8px;background:#eef4ff;color:#174e90;font-variant-numeric:tabular-nums;font-weight:700;'+(policyTimerPhase?'':'display:none')+'">'+(policyTimerPhase?policyTimerText():'')+'</div>'}
function policyTimerRefresh(){const el=root.querySelector('#tm-policy-timer');if(el){el.style.display=policyTimerPhase?'':'none';el.textContent=policyTimerPhase?policyTimerText():''}}
function policyTimerStart(){clearInterval(policyTimerInterval);policyTimerStarted=window.performance.now();policyTimerElapsed=0;policyTimerPhase='이미지 준비 중';policyTimerInterval=setInterval(policyTimerRefresh,100);policyTimerRefresh()}
function policyTimerStop(phase){if(policyTimerInterval!==null)policyTimerElapsed=window.performance.now()-policyTimerStarted;clearInterval(policyTimerInterval);policyTimerInterval=null;policyTimerPhase=phase;policyTimerRefresh()}
let policyAutoTimer=null,policyInputVersion=0;
function policyCancelAutoConvert(){clearTimeout(policyAutoTimer);policyAutoTimer=null;policyInputVersion++}
function policyApplyConvertedText(text){policyRows=policyCleanRows(parsePolicyText(text));policyPrepareCityReview();policyFillMissingProvinces();policyRegistered=false;policyConfirmedRows='';}
function policyConvertText(){policyCancelAutoConvert();if(policyOcrRunning)return;policyTimerStop('');const text=root.querySelector('#tm-policy-paste')?.value||'';policyApplyConvertedText(text);policyAnalysis=[];policyImageData='';policyImageName='';policyRegistered=false;policyRefreshPreview();toast(policyRows.length?'붙여넣은 내용을 표로 변환했습니다.':'변환할 텍스트를 붙여넣어 주세요.');}
function policyConvertInput(){if(policyImageData)policyRunOcr();else policyConvertText()}
root.addEventListener('input',e=>{if(e.target.id==='tm-policy-paste'){policyCancelAutoConvert();policyRows=[];policyImageData='';policyImageName='';policyRegistered=false;policyTimerStop('');policyRefreshPreview();}});
function policyHandleImage(file){
 if(policyOcrRunning){toast('OCR 분석이 끝난 뒤 이미지를 변경해 주세요.');return}
 if(!file||!file.type.startsWith('image/'))return;
 policyCancelAutoConvert();const version=policyInputVersion;policyTimerStart();
 const reader=new FileReader();
 reader.onload=()=>{if(policyOcrRunning||version!==policyInputVersion)return;policyOcrTiming=policyOcrTotalTiming=0;policyCityDrafts.clear();policyCityOriginalRows=[];policyCityAudit=[];policyImageData=String(reader.result||'');policyImageName=file.name||'클립보드 이미지';policyAnalysis=[];policyRows=[];policyIntakeTitle='';policyDetectedCodes=[];policyCodeTitles=[];policyRegistered=false;policyRefreshPreview();policyTimerStop('이미지 준비 완료');toast('이미지가 준비되었습니다. 변환 버튼을 눌러 주세요.');};
 reader.onerror=()=>{if(version===policyInputVersion){policyTimerStop('이미지 읽기 실패');toast('이미지를 읽지 못했습니다. 다시 선택해 주세요.')}};
 reader.readAsDataURL(file);
}
function policyUpdateOcrProgress(message){const status=root.querySelector('#tm-policy-ocr-status'),bar=root.querySelector('#tm-policy-ocr-progress');if(status)status.textContent=message;if(bar)bar.style.width=policyOcrProgress+'%'}
function policyOcrTimeout(promise,ms,message){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(message)),ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})})}
function policyLoadCanvas(dataUrl){
 return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const scale=Math.min(1,2800/image.naturalWidth),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const context=canvas.getContext('2d',{alpha:false,willReadFrequently:true});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);resolve({canvas,context,data:context.getImageData(0,0,canvas.width,canvas.height)});};image.onerror=()=>reject(new Error('이미지를 읽지 못했습니다.'));image.src=dataUrl;});
}
function policyGroups(values,gap=2){
 const groups=[];for(const value of values){const last=groups[groups.length-1];if(!last||value-last[last.length-1]>gap)groups.push([value]);else last.push(value)}return groups.map(group=>Math.round(group.reduce((sum,value)=>sum+value,0)/group.length));
}
function policyColorName(r,g,b){
 if(r>175&&g<125&&b<125)return '마감';
 if(g>r*1.08&&g>b*.9)return '접수 가능';
 if(r>185&&g>170&&b<150)return '접수 가능';
 if(b>r*1.08&&b>g*.9)return '별도 확인';
 if(r>205&&g>185&&b>165)return '접수 가능';
 return '일반';
}
function policyAnalyzeTable(source){
 const {canvas,context,data}=source,w=canvas.width,h=canvas.height,p=data.data,dark=(x,y)=>{const i=(y*w+x)*4;return p[i]+p[i+1]+p[i+2]<210};
 const horizontal=[];for(let y=0;y<h;y++){let count=0;for(let x=0;x<w;x+=2)if(dark(x,y))count++;if(count>w*.36)horizontal.push(y)}
 let lines=policyGroups(horizontal,2);if(lines.length<2)throw new Error('표의 위·아래 가로선을 찾지 못했습니다. 한 줄 표도 위·아래 테두리를 포함해 주세요.');
 if(lines[0]>5)lines.unshift(0);if(lines[lines.length-1]<h-5)lines.push(h-1);
 const bands=[];for(let i=0;i<lines.length-1;i++){const top=lines[i]+1,bottom=lines[i+1]-1;if(bottom-top>=7)bands.push({top,bottom,center:(top+bottom)/2})}
 if(!bands.length)throw new Error('읽을 수 있는 정책표 행을 찾지 못했습니다.');
 let divider=Math.round(w*.88),best=-1;for(let x=Math.round(w*.65);x<Math.round(w*.97);x++){let count=0;for(let y=0;y<h;y+=2)if(dark(x,y))count++;if(count>best){best=count;divider=x}}
 if(best<h*.22)throw new Error('수량 열의 세로선이 불명확합니다. 표 전체가 포함된 선명한 이미지를 사용해 주세요.');
 const clean=document.createElement('canvas');clean.width=w;clean.height=h;const cc=clean.getContext('2d',{alpha:false});cc.fillStyle='#fff';cc.fillRect(0,0,w,h);
 for(const band of bands){const sample={};for(let y=band.top+2;y<band.bottom-1;y+=3)for(let x=3;x<w-3;x+=4){const i=(y*w+x)*4,key=(p[i]>>4)+','+(p[i+1]>>4)+','+(p[i+2]>>4);sample[key]=(sample[key]||0)+1}const bgKey=Object.keys(sample).sort((a,b)=>sample[b]-sample[a])[0]||'15,15,15',bg=bgKey.split(',').map(v=>Number(v)*16+8);let rr=0,gg=0,bb=0,n=0;
  for(let y=band.top+2;y<band.bottom-1;y++)for(let x=2;x<w-2;x++){const i=(y*w+x)*4,dr=p[i]-bg[0],dg=p[i+1]-bg[1],db=p[i+2]-bg[2],distance=Math.sqrt(dr*dr+dg*dg+db*db),lum=(p[i]+p[i+1]+p[i+2])/3;if(distance>62&&lum<215){cc.fillStyle='#000';cc.fillRect(x,y,1,1)}}
  for(let y=band.top+2;y<band.bottom-1;y+=3)for(let x=3;x<Math.min(divider-3,w);x+=5){const i=(y*w+x)*4;rr+=p[i];gg+=p[i+1];bb+=p[i+2];n++}band.status=policyColorName(rr/n,gg/n,bb/n);
 }
 return new Promise((resolve,reject)=>clean.toBlob(blob=>blob?resolve({blob,bands,divider,width:w,height:h}):reject(new Error('전용 OCR 이미지를 만들지 못했습니다.')),'image/png'));
}
function policyItemPosition(item){
 const points=Array.isArray(item?.poly)?item.poly:[],pairs=points.map(point=>Array.isArray(point)?point:[point?.x,point?.y]).filter(point=>Number.isFinite(point[0])&&Number.isFinite(point[1]));
 if(!pairs.length)return {x:0,y:0,h:18};const xs=pairs.map(point=>point[0]),ys=pairs.map(point=>point[1]);return {x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,h:Math.max(10,Math.max(...ys)-Math.min(...ys))};
}
function policyBuildRows(items,layout){
 const entries=(items||[]).filter(item=>String(item?.text||'').trim()).map(item=>({text:String(item.text).trim(),...policyItemPosition(item)}));
 const rows=layout.bands.map(band=>({band,left:[],right:[]}));
 for(const entry of entries){let target=rows.reduce((best,row)=>Math.abs(row.band.center-entry.y)<Math.abs(best.band.center-entry.y)?row:best,rows[0]);(entry.x>layout.divider?target.right:target.left).push(entry)}
 const textRows=rows.map(row=>({name:row.left.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ').trim(),qty:row.right.sort((a,b)=>a.x-b.x).map(item=>item.text).join('').replace(/[Oo]/g,'0').replace(/[Il|]/g,'1').match(/\d+/)?.[0]||'',status:row.band.status}));
 const titleIndex=textRows.findIndex(row=>row.name&&!row.qty);policyIntakeTitle=titleIndex>=0?textRows[titleIndex].name:'';
 const body=textRows.filter((row,index)=>index!==titleIndex&&(row.name||row.qty));
 return [['지역','수량','상태'],...body.map(row=>[row.name||'확인 필요',row.qty||'확인 필요',row.status])];
}
function policyLoadOcrScript(){
 if(window.Tesseract)return Promise.resolve(window.Tesseract);
 if(policyPaddlePromise)return policyPaddlePromise;
 policyPaddlePromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('한국어·한문 OCR 실행 파일을 불러오지 못했습니다.'));script.onerror=()=>reject(new Error('한국어 OCR 실행 파일 다운로드에 실패했습니다.'));document.head.appendChild(script)});
 return policyPaddlePromise;
}
async function policyGetPaddleOcr(){
 if(policyPaddleOcr)return policyPaddleOcr;
 const ready=[];
 try{
 const Tesseract=await policyLoadOcrScript();
 const create=async(lang,label)=>{
  policyUpdateOcrProgress(label+' 모델 준비');
  let expired=false;
  const pending=Tesseract.createWorker(lang,1,{
   workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
   corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js',
   langPath:'https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main',
   gzip:false,cachePath:'policy-best-v1',
   logger:m=>{if(m.status==='loading language traineddata')policyUpdateOcrProgress(label+' 모델 다운로드 · '+Math.round((m.progress||0)*100)+'%')}
  });
  pending.then(w=>{if(expired)w.terminate().catch(()=>{})},()=>{});
  try{const w=await policyOcrTimeout(pending,180000,label+' 모델 준비 제한 시간을 초과했습니다.');ready.push(w);return w}
  catch(error){expired=true;throw error}
 };
 const prepared=await Promise.allSettled([create('kor+chi_tra+chi_sim','한국어·한문(번체·간체)'),create('eng','숫자'),create('kor','한국어')]);
 const failure=prepared.find(r=>r.status==='rejected');if(failure)throw failure.reason;
 const [worker,digitWorker,regionWorker]=prepared.map(r=>r.value);
 let regionWorkerPromise=Promise.resolve(regionWorker),hanWorkerPromise;
 policyPaddleOcr={worker,digitWorker,getRegionWorker:()=>regionWorkerPromise||(regionWorkerPromise=create('kor','지역명 전용 한국어')),getHanWorker:()=>hanWorkerPromise||(hanWorkerPromise=create('chi_tra','한자 전용')),dispose:async()=>{await Promise.allSettled(ready.map(w=>w.terminate()))}};
 return policyPaddleOcr;
 }catch(error){await Promise.allSettled(ready.map(w=>w.terminate()));policyPaddleOcr=null;policyPaddlePromise=null;throw error}
}
async function policyResetPaddleOcr(){if(policyPaddleOcr?.dispose)await policyPaddleOcr.dispose().catch(()=>{});policyPaddleOcr=null;policyPaddlePromise=null}

function policyNormalizeCell(p,w,h,binary){
 const hist=new Array(256).fill(0),values=new Uint8Array(w*h);
 for(let k=0;k<values.length;k++){values[k]=Math.max(p.data[k*4],p.data[k*4+1],p.data[k*4+2]);hist[values[k]]++}
 // The dominant intensity is the cell background, including blue cells.
 let background=hist.indexOf(Math.max(...hist));background=Math.max(32,background);
 let weight=0,partial=0,best=-1,threshold=128,total=w*h,sum=0;
 const normalized=new Uint8Array(total),nh=new Array(256).fill(0);
 for(let k=0;k<total;k++){normalized[k]=Math.min(255,Math.round(values[k]*255/background));nh[normalized[k]]++;sum+=normalized[k]}
 for(let t=0;t<255;t++){weight+=nh[t];partial+=t*nh[t];if(!weight||weight===total)continue;const delta=partial/weight-(sum-partial)/(total-weight),variance=weight*(total-weight)*delta*delta;if(variance>best){best=variance;threshold=t}}
 let left=w,top=h,right=-1,bottom=-1;
 const inkLimit=Math.min(180,Math.max(50,threshold));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=y*w+x,v=normalized[k];if(v<=inkLimit){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
 const out=binary?(v<=threshold?0:255):v; p.data[k*4]=p.data[k*4+1]=p.data[k*4+2]=out;p.data[k*4+3]=255}
 if(right<left)return {left:0,top:0,width:w,height:h,blank:true};
 left=Math.max(0,left-2);top=Math.max(0,top-2);right=Math.min(w-1,right+2);bottom=Math.min(h-1,bottom+2);
 return {left,top,width:right-left+1,height:bottom-top+1,blank:false};
}

function policyRemoveCellRules(p,w,h){
 // Only remove near-continuous lines at the cell boundary, never internal strokes.
 const dark=(x,y)=>{const k=(y*w+x)*4;return Math.max(p.data[k],p.data[k+1],p.data[k+2])<100};
 const rows=[],cols=[],edgeX=Math.min(3,Math.floor(w*.05)),edgeY=Math.min(3,Math.floor(h*.12));
 for(let y=0;y<h;y++)if(y<edgeY||y>=h-edgeY){let n=0;for(let x=0;x<w;x++)if(dark(x,y))n++;if(n/w>.85)rows.push(y)}
 for(let x=0;x<w;x++)if(x<edgeX||x>=w-edgeX){let n=0;for(let y=0;y<h;y++)if(dark(x,y))n++;if(n/h>.85)cols.push(x)}
 const white=(x,y)=>{const k=(y*w+x)*4;p.data[k]=p.data[k+1]=p.data[k+2]=p.data[k+3]=255};
 for(const y of rows)for(let x=0;x<w;x++)white(x,y);
 for(const x of cols)for(let y=0;y<h;y++)white(x,y);
 return p;
}
function policyRegionNoise(text){
 const value=String(text||'').replace(/\s/g,''),letters=(value.match(/[가-힣\u3400-\u9fff\uf900-\ufaff]/g)||[]).length,hasHan=/[\u3400-\u9fff\uf900-\ufaff]/.test(value);
 return letters<(hasHan?1:2)||/[|=<>_]/.test(value)||(letters>0&&(value.match(/[0-9]/g)||[]).length>=letters);
}


// Separate foreground from the dominant RGB background, irrespective of text polarity.
function policyColorForeground(p,w,h,channel=false){
 const bins=new Map();
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
 const k=(y*w+x)*4,key=(p.data[k]>>2)+','+(p.data[k+1]>>2)+','+(p.data[k+2]>>2);
 let bin=bins.get(key);if(!bin){bin=[0,0,0,0];bins.set(key,bin)}
 bin[0]++;bin[1]+=p.data[k];bin[2]+=p.data[k+1];bin[3]+=p.data[k+2];
 }
 const dominant=[...bins.values()].sort((a,b)=>b[0]-a[0])[0];
 if(!dominant)return;
 const bg=dominant.slice(1).map(v=>v/dominant[0]),distances=new Float32Array(w*h),hist=new Array(256).fill(0);
 for(let i=0;i<w*h;i++){
 const k=i*4,d=Math.max(Math.abs(p.data[k]-bg[0]),Math.abs(p.data[k+1]-bg[1]),Math.abs(p.data[k+2]-bg[2]));
 distances[i]=d;if(d>6)hist[Math.min(255,Math.round(d))]++;
 }
 const count=hist.reduce((a,b)=>a+b,0);let cumulative=0,contrast=255;
 for(let i=0;i<256;i++){cumulative+=hist[i];if(count&&cumulative>=count*.9){contrast=i;break}}
 contrast=Math.max(12,contrast);
 // A second reading uses the RGB channel with greatest foreground separation.
 // This preserves equal-brightness colored ink that grayscale cannot distinguish.
 if(channel){
 const energy=[0,0,0];
 for(let i=0;i<w*h;i++)if(distances[i]>6)for(let c=0;c<3;c++)energy[c]+=Math.abs(p.data[i*4+c]-bg[c]);
 const c=energy.indexOf(Math.max(...energy)),levels=[];
 for(let i=0;i<w*h;i++){distances[i]=Math.abs(p.data[i*4+c]-bg[c]);if(distances[i]>6)levels.push(distances[i])}
 levels.sort((a,b)=>a-b);contrast=Math.max(12,levels[Math.floor(levels.length*.9)]||12);
 }
 const noiseFloor=Math.min(4,contrast*.1);
 for(let i=0;i<w*h;i++){
 // Preserve antialiased edges, mapping both white and black ink to dark pixels.
 const v=Math.round(255*(1-Math.max(0,Math.min(1,(distances[i]-noiseFloor)/(contrast-noiseFloor)))));
 p.data[i*4]=p.data[i*4+1]=p.data[i*4+2]=v;p.data[i*4+3]=255;
 }
 policyRemoveCellRules(p,w,h);
}


function policyWhiteInk(p,w,h,convert=false){
 // White text differs from saturated backgrounds in its weakest RGB channel.
 const histogram=new Array(256).fill(0);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const k=(y*w+x)*4;histogram[Math.min(p.data[k],p.data[k+1],p.data[k+2])]++}
 const total=histogram.reduce((a,b)=>a+b,0);let n=0,background=255;
 for(let v=0;v<256;v++){n+=histogram[v];if(n>=total*.5){background=v;break}}
 let white=0;for(let v=Math.max(220,background+40);v<256;v++)white+=histogram[v];
 const detected=background<190&&white>=3&&white<total*.4;
 if(!convert||!detected)return detected;
 for(let i=0;i<w*h;i++){const k=i*4,min=Math.min(p.data[k],p.data[k+1],p.data[k+2]);
 const coverage=Math.max(0,Math.min(1,(min-background)/(255-background)));
 const value=Math.round(255*(1-coverage));
 p.data[k]=p.data[k+1]=p.data[k+2]=value;p.data[k+3]=255;
 }
 return true;
}

function policyCellImage(source,x0,y0,x1,y1,binary=false){
 const w=Math.max(1,x1-x0),h=Math.max(1,y1-y0),p=source.context.getImageData(x0,y0,w,h);
 if(binary==='rules')policyRemoveCellRules(p,w,h);
 if(binary==='color'||binary==='channel'||binary==='stroke'||binary==='detail'||binary==='channelcrop'||binary==='whitecrop')policyColorForeground(p,w,h,binary==='channel'||binary==='channelcrop');
 if(binary==='white'||binary==='whitepixel')policyWhiteInk(p,w,h,true);
 const original=(binary==='original'||binary==='pixel'||binary==='title')?source.context.getImageData(x0,y0,w,h):null;
 const box=binary==='detail'?{left:0,top:0,width:w,height:h}:policyNormalizeCell(p,w,h,binary===true),small=document.createElement('canvas');small.width=w;small.height=h;small.getContext('2d').putImageData(original||p,0,0);
 // Keep the entire row height in the original-color pass so thin strokes are not cropped.
 if(original||['stroke','color','channel','white','whitepixel'].includes(binary)){box.top=0;box.height=h;box.left=0;box.width=w}
 const scale=(binary==='stroke'||binary==='detail')?6:binary==='whitepixel'?4:binary==='title'?3:binary==='pixel'?4:Math.max(2,Math.min(5,64/box.height)),out=document.createElement('canvas');out.width=Math.ceil(box.width*scale)+32;out.height=Math.ceil(box.height*scale)+32;
 const ctx=out.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);ctx.imageSmoothingEnabled=binary!=='detail'&&binary!=='stroke'&&binary!=='whitepixel'&&binary!==true&&binary!=='pixel'&&binary!=='title';ctx.imageSmoothingQuality='high';ctx.drawImage(small,box.left,box.top,box.width,box.height,16,16,box.width*scale,box.height*scale);return out;
}
// Locate the printed colon from two vertically aligned ink components.
// Coordinates come from the source pixels, never a guessed/corrected region name.
function policyHeadingCrop(source,layout,band){
 const x0=2,w=layout.divider-4,h=band.bottom-band.top;
 if(w<12||h<8)return null;
 const p=source.context.getImageData(x0,band.top,w,h);
 policyColorForeground(p,w,h);
 const ink=new Uint8Array(w*h),seen=new Uint8Array(w*h),parts=[];
 for(let i=0;i<ink.length;i++)ink[i]=p.data[i*4]<150?1:0;
 for(let i=0;i<ink.length;i++){
  if(!ink[i]||seen[i])continue;
  const stack=[i];seen[i]=1;let left=w,right=0,top=h,bottom=0,count=0;
  while(stack.length){const q=stack.pop(),x=q%w,y=Math.floor(q/w);count++;
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy,k=ny*w+nx;
    if(nx>=0&&nx<w&&ny>=0&&ny<h&&ink[k]&&!seen[k]){seen[k]=1;stack.push(k)}
   }
  }
  parts.push({left,right,top,bottom,count});
 }
 const dots=parts.filter(c=>c.right-c.left+1<=Math.max(2,h*.18)&&c.bottom-c.top+1<=Math.max(2,h*.22));
 const matches=[];
 for(const a of dots)for(const b of dots){
  const left=Math.min(a.left,b.left),right=Math.max(a.right,b.right);
  if(a.bottom>=b.top||Math.abs(a.left+a.right-b.left-b.right)>2||b.bottom-a.top<h*.18||b.bottom-a.top>h*.65)continue;
  if(a.top<h*.1||b.bottom>h*.9)continue;
  // Colon must be isolated from letters by empty vertical columns on both sides.
  if(left<2||right>w-3)continue;
  let clear=true;for(let y=0;y<h;y++)if(ink[y*w+left-1]||ink[y*w+right+1])clear=false;
  const before=parts.filter(c=>c.right<left-1&&c.count>=4),after=parts.filter(c=>c.left>right+1&&c.count>=4);
  if(!clear||before.length<2||!after.length)continue;
  const first=Math.min(...parts.filter(c=>c.right<left-1).map(c=>c.left));
  if(left-first<h*1.5)continue;
  matches.push({left:x0+Math.max(0,first-2),right:x0+left-1,colon:x0+left});
 }
 // Ambiguous punctuation is left for manual review rather than an arbitrary crop.
 const unique=[...new Map(matches.map(m=>[m.colon,m])).values()];
 return unique.length===1?unique[0]:null;
}
function policyHeadingConsensus(candidates){
 const groups=new Map();
 for(const c of candidates){
  const text=String(c.text||'').trim(),key=text.replace(/\s/g,'');
  if(!/^[가-힣]+$/.test(key)||!policyKnownRegion(key)||c.confidence<75)continue;
  if(!groups.has(key))groups.set(key,new Map());
  const family=groups.get(key),previous=family.get(c.family);
  if(!previous||c.confidence>previous.confidence)family.set(c.family,{...c,text});
 }
 const supported=[...groups.values()].filter(g=>g.size>=2);
 if(supported.length!==1)return null;
 return [...supported[0].values()].sort((a,b)=>b.confidence-a.confidence)[0];
}
function policyStandaloneHeading(text){
 const compact=String(text||'').replace(/\s/g,'');
 return /^[가-힣]{2,4}(?:동|서|남|북|동남|동북|서남|서북|남동|남서|북동|북서|중)[부구]$/.test(compact);
}
async function policyReadHeading(source,layout,band,ocr,currentText=''){
 const crop=policyHeadingCrop(source,layout,band)||(policyStandaloneHeading(currentText)?{left:2,right:layout.divider-2}:null);
 if(!crop)return {candidates:[],selected:null};
 const worker=await ocr.getRegionWorker(),candidates=[];
 for(const [variant,mode] of [['pixel','7'],['stroke','7'],['channel','13'],['original','13'],['color','8']]){
  await worker.setParameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:'',preserve_interword_spaces:'1',user_defined_dpi:'300'});
  const result=await policyOcrTimeout(worker.recognize(policyCellImage(source,crop.left,band.top,crop.right,band.bottom,variant)),30000,'지역명 확대 판독 제한 시간을 초과했습니다.');
  candidates.push({text:String(result.data?.text||'').trim().replace(/\s+/g,' '),confidence:Number(result.data?.confidence||0),family:'heading-kor-'+(variant==='stroke'?'color':variant),mode});
  if(candidates.length>=3&&policyHeadingConsensus(candidates))break;
 }
 return {candidates,selected:policyHeadingConsensus(candidates)};
}
function policyApplyHeading(name,heading){
 // Keep the city list, Han characters, and symbols exactly as the full-line OCR read them.
 const colon=String(name.text||'').search(/[:：]/);
 if(!heading||(colon<0&&!policyStandaloneHeading(name.text)))return name;
 const previous=(colon<0?name.text:name.text.slice(0,colon)).replace(/\s/g,''),next=heading.text.replace(/\s/g,'');
 if(previous===next)return name;
 if(policyKnownRegion(previous))return {...name,review:true};
 return {...name,text:heading.text.trim()+(colon<0?'':' '+name.text.slice(colon)),review:true,headingCorrected:true};
}

function policyQuantityStatus(text,review){
 if(review||!/^\d+$/.test(text))return '확인 필요';
 return Number(text)===0?'마감':'접수 가능';
}

// Compare independent preprocessing/layout readings; do not guess region names.
function policyChooseReading(candidates,digits){
 const usable=candidates.filter(c=>c.text&&(digits?/^\d+$/.test(c.text):/[가-힣\u3400-\u9fff\uf900-\ufaff]/.test(c.text)));
 if(!usable.length)return {text:'',confidence:0,review:true};
 const groups=new Map();
 for(const c of usable){const key=digits?c.text:c.text.replace(/\s/g,'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c)}
 const ranked=[...groups.values()].sort((a,b)=>b.length-a.length||Math.max(...b.map(c=>c.confidence))-Math.max(...a.map(c=>c.confidence)));
 const best=ranked[0].slice().sort((a,b)=>b.confidence-a.confidence)[0];
 return {...best,review:groups.size>1||usable.length!==candidates.length||ranked[0].length<2||best.confidence<85||(!digits&&/[A-Za-z=]/.test(best.text))};
}


// Validate actual OCR candidates against map names and standard province aliases.
// This dictionary never generates or substitutes a missing OCR reading.
function policyKnownRegion(text){
 const value=String(text||'').split(/[:：]/,1)[0].replace(/\s/g,'');
 const aliases=['수도권','부울경','광주주전남','광주전남','서울','부산','대구','인천','광주','대전','울산','세종','세종특별자치시','경기','강원','강원특별자치도','충북','충남','전북','전남','경북','경남','제주','제주도','제주특별자치도','전북특별자치도'];
 const names=[...aliases,...policyCityData.flatMap(r=>r.aliases)];
 // Parse a real province/city name followed by a directional coverage label.
 // Validate only: retain the original OCR text, punctuation and Han characters.
 return names.some(name=>value===name||(value.startsWith(name)&&/^(?:동|서|남|북|동남|동북|서남|서북|남동|남서|북동|북서|중)부$/.test(value.slice(name.length)))||value===name+'전체');
}
function policyRegionSuspicious(text){
 if(!/[가-힣]{2}/.test(String(text).replace(/\s/g,'')))return true;
 if(/[A-Za-z0-9=<>_]/.test(text))return true;
 const heading=String(text).split(/[:：]/,1)[0].replace(/\s/g,'');
 if(/^[가-힣]{2,12}$/.test(heading)&&!policyKnownRegion(heading))return true;
 let depth=0;for(const ch of text){if(ch==='(')depth++;if(ch===')'&&--depth<0)return true}
 return depth!==0;
}
function policyBandHasDivider(source,layout,band){
 let hits=0,total=0;
 for(let y=band.top+1;y<band.bottom;y++){total++;let dark=false;
 for(let x=Math.max(0,layout.divider-1);x<=Math.min(layout.width-1,layout.divider+1);x++){
 const k=(y*layout.width+x)*4,p=source.data.data;if(p[k]+p[k+1]+p[k+2]<210)dark=true}
 if(dark)hits++}
 return total>0&&hits/total>.65;
}



let policyAnalysis=[];
function policyAnalysisMarkup(){
 return '<div class="notice">'+(policyOcrTiming?'인식 '+policyOcrTiming.toFixed(1)+'초 · 전체 '+policyOcrTotalTiming.toFixed(1)+'초(모델 준비 포함) · ':'')+'획 보존 분석 · 원본 확대, 배경색 대비, RGB 채널 분리 결과를 비교합니다. 글자색에 관계없이 분석합니다. 점수는 OCR 신뢰도이며 정답 확률은 아닙니다.</div>'+
 (policyAnalysis.length?table(['행','선택 결과','다른 판독 결과','분석'],policyAnalysis.map(item=>[String(item.row),policyEscape(item.text),policyEscape(item.alternatives),policyEscape(item.reason)])):'<p class="sub">이미지를 다시 변환하면 행별 판독 결과를 확인할 수 있습니다.</p>');
}
function policyRefreshAnalysis(){const el=root.querySelector('#tm-policy-analysis');if(el)el.innerHTML=policyAnalysisMarkup()}
function policyAnalyzeExisting(){
 if(policyOcrRunning){toast('OCR 완료 후 확인해 주세요.');return}
 policyRefreshAnalysis();
 if(!policyAnalysis.length)toast('이전 결과에는 분석 기록이 없습니다. 원본 이미지를 다시 변환해 주세요.');
}
function policySelectRegion(candidates){
 const usable=candidates.filter(c=>/[가-힣\u3400-\u9fff\uf900-\ufaff]/.test(c.text)&&!policyRegionNoise(c.text));
 if(!usable.length)return {text:'',confidence:0,review:true};
 // A heading can agree even when the city list or a Han character differs.
 const headingOf=text=>String(text).split(/[:：]/,1)[0].replace(/\s/g,'');
 const headings=new Map();
 for(const c of usable){
  const key=headingOf(c.text);
  if(!policyKnownRegion(key)||c.confidence<70)continue;
  if(!headings.has(key))headings.set(key,new Set());
  headings.get(key).add(c.family);
 }
 const groups=new Map();
 for(const c of usable){
 const key=c.text.replace(/\s/g,'');
 if(!groups.has(key))groups.set(key,new Map());
 const family=groups.get(key),previous=family.get(c.family);
 if(!previous||previous.confidence<c.confidence)family.set(c.family,c);
 }
 const ranking=[...groups.values()].map(families=>{
 const readings=[...families.values()],best=readings.slice().sort((a,b)=>b.confidence-a.confidence)[0];
 // Repeated segmentation of the same pixels is not an independent vote.
 const mean=readings.reduce((sum,c)=>sum+c.confidence,0)/readings.length;
 const headingSupport=headings.get(headingOf(best.text))?.size||0;
 return {best,known:policyKnownRegion(best.text)&&headingSupport>=2&&mean>=70,score:mean+Math.min(2,readings.length-1)*8,count:readings.length};
 }).sort((a,b)=>b.score-a.score);
 const top=ranking[0];
 return {...top.best,review:usable.length!==candidates.length||groups.size>1||top.count<2||top.best.confidence<85||policyRegionSuspicious(top.best.text)};
}


function policyTitleShape(text){return !!policyCodeHeader(text)}
function policySelectTitle(candidates){
 const readable=candidates.filter(c=>String(c.text||'').trim());
 const valid=readable.filter(c=>/(?:^|[^\d])(?:0?[1-9]|1[0-2])\s*월(?:\s|$)/.test(c.text));
 const pool=valid.length?valid:readable;
 if(!pool.length)return {text:'',confidence:0,review:true};
 const ranked=pool.map(c=>({...c,support:new Set(pool.filter(x=>x.text.replace(/\s/g,'')===c.text.replace(/\s/g,'')).map(x=>x.family)).size}))
 .sort((a,b)=>(b.confidence+8*Math.min(2,b.support-1))-(a.confidence+8*Math.min(2,a.support-1)));
 const best=ranked[0];
 return {...best,review:!valid.length||best.support<2||best.confidence<85||new Set(readable.map(c=>c.text.replace(/\s/g,''))).size>1};
}

// Pack cell images into a column; OCR bounding boxes map back to the original rows.
function policyPackCells(source,layout,digits,variant,indices=null){
 const selected=indices||layout.bands.map((_,index)=>index);
 const cells=selected.map(index=>{const band=layout.bands[index];
  const left=digits?layout.divider+2:2,right=digits?layout.width-2:layout.divider-2;
  return policyCellImage(source,left,band.top,right,band.bottom,variant);
 });
 const canvas=document.createElement('canvas');canvas.width=Math.max(...cells.map(c=>c.width))+32;
 canvas.height=cells.reduce((n,c)=>n+c.height+24,24);const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
 let y=24;const slots=cells.map(cell=>{const slot={top:y,bottom:y+cell.height};context.drawImage(cell,16,y);y+=cell.height+24;return slot});
 return {canvas,slots,indices:selected};
}
function policyUnpackLines(data,pack){
 const groups=pack.slots.map(()=>[]);
 const lines=data.lines||data.blocks?.flatMap(b=>b.paragraphs?.flatMap(p=>p.lines||[])||[])||[];
 for(const line of lines){if(!line.bbox)continue;const center=(line.bbox.y0+line.bbox.y1)/2,index=pack.slots.findIndex(s=>center>=s.top&&center<=s.bottom);if(index>=0)groups[index].push(line)}
 return groups.map(lines=>({words:lines.flatMap(l=>l.words||[]),text:lines.sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0).map(l=>l.text.trim()).join(' ').replace(/\s+/g,' ').trim(),confidence:lines.length?lines.reduce((n,l)=>n+Number(l.confidence||0),0)/lines.length:0}));
}
async function policyBatchRead(worker,pack,whitelist=''){
 await worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:whitelist,preserve_interword_spaces:'1',user_defined_dpi:'300'});
 const result=await policyOcrTimeout(worker.recognize(pack.canvas),120000,'표 일괄 인식 제한 시간을 초과했습니다.');
 return policyUnpackLines(result.data,pack);
}
// Only repeated readings of the actual cropped pixels can resolve an OCR warning.
// A repeated call with the same preprocessing family is not an independent vote.
function policyConfirmedCropReading(readings,pattern){
 const groups=new Map();
 for(const reading of readings){
  const text=String(reading.text||'').trim(),confidence=Number(reading.confidence||0);
  if(!reading.family||confidence<85||!pattern.test(text))continue;
  const key=text.replace(/\s/g,'');
  if(!groups.has(key))groups.set(key,new Map());
  const families=groups.get(key),previous=families.get(reading.family);
  if(!previous||confidence>previous.confidence)families.set(reading.family,{...reading,text,confidence});
 }
 const supported=[...groups.values()].filter(families=>families.size>=2);
 if(supported.length!==1)return null;
 return [...supported[0].values()].sort((a,b)=>b.confidence-a.confidence)[0];
}
function policyNameNeedsReview(chosen,korean,mixed,cropConfirmed,glyphUncertain){
 return !chosen.text||chosen.confidence<85||glyphUncertain||/[＃#]/.test(chosen.text)||
  (!cropConfirmed&&korean.text.replace(/\s/g,'')!==mixed.text.replace(/\s/g,''));
}
// Recheck only rows whose actual OCR readings disagree. Names never come from a dictionary.
function policyInitialName(korean,mixed){
 const hasHan=/[\u3400-\u9fff\uf900-\ufaff]/.test(mixed.text);
 return hasHan&&mixed.confidence>=65?mixed:korean.text?korean:mixed;
}
function policyConfirmedRowReading(readings){
 // Keep punctuation and all characters when comparing; ignore whitespace only.
 const pattern=/^(?=.*[가-힣\u3400-\u9fff\uf900-\ufaff])[가-힣\u3400-\u9fff\uf900-\ufaff0-9\s,:：，、/·()（）.\-]+$/u;
 const hasHan=text=>/[\u3400-\u9fff\uf900-\ufaff]/u.test(String(text||''));
 const mixed=readings.filter(reading=>reading.model==='한국어·한문');
 if(!mixed.some(reading=>hasHan(reading.text)))return policyConfirmedCropReading(readings,pattern);
 // Korean-only models cannot supply or disprove Han characters. Require the
 // mixed model to repeat the complete printed text across different images.
 const confirmed=policyConfirmedCropReading(mixed,pattern);
 // Never silently drop a Han condition that appeared in an actual reading.
 if(!confirmed||!hasHan(confirmed.text))return null;
 const hangul=text=>(String(text||'').match(/[가-힣]/gu)||[]).join('');
 const expected=hangul(confirmed.text);
 if(!expected)return hasHan(confirmed.text)?confirmed:null;
 // This comparison verifies Korean strokes only. Never use the reduced text
 // as output, and never hide an extra Hangul syllable mistaken for a Han glyph.
 const koreanConfirmed=readings.some(reading=>reading.model==='한국어'&&reading.family&&reading.family!=='color'&&reading.confidence>=85&&hangul(reading.text)===expected);
 return koreanConfirmed?confirmed:null;
}
async function policyVerifyDisputedRows(source,layout,ocr,koreanRows,mixedRows){
 const pending=[],evidence=new Map(),verified=new Map(),korean=await ocr.getRegionWorker();
 for(let i=0;i<layout.bands.length;i++){
  const a=koreanRows[i],b=mixedRows[i],chosen=policyInitialName(a,b);
  if(!policyNameNeedsReview(chosen,a,b,false,false))continue;
  pending.push(i);evidence.set(i,[{...a,family:'color',model:'한국어'},{...b,family:'color',model:'한국어·한문'}]);
 }
 let remaining=pending;
 for(const variant of ['stroke','channel']){
  if(!remaining.length)break;
  policyUpdateOcrProgress('판독이 엇갈린 '+remaining.length+'개 행의 글자 획 재확인');
  const pack=policyPackCells(source,layout,false,variant,remaining);
  const results=await Promise.allSettled([policyBatchRead(korean,pack),policyBatchRead(ocr.worker,pack)]);
  // A retry failure keeps the original reading and review flag, rather than losing the table.
  results.forEach((result,modelIndex)=>{
   if(result.status!=='fulfilled')return;
   result.value.forEach((reading,offset)=>evidence.get(remaining[offset]).push({...reading,family:variant,model:modelIndex?'한국어·한문':'한국어'}));
  });
  const next=[];
  for(const index of remaining){
   const readings=evidence.get(index),confirmed=policyConfirmedRowReading(readings);
   if(confirmed)verified.set(index,{...confirmed,confirmed:true,readings});else next.push(index);
  }
  remaining=next;
 }
 for(const index of remaining)verified.set(index,{confirmed:false,readings:evidence.get(index)});
 return verified;
}

function policyLiteralConditionSlots(text){
 const parts=String(text).split(/([,，、/·])/u);
 return parts.length>1?parts.flatMap((part,index)=>index%2===0&&/^(?:포함|제외|전체|일부|지역|가능|불가|일반|실버|접수|마감|확인|필요|일원)$/.test(part.trim())?[index]:[]):[];
}
function policyConfirmedLiteralAudit(readings,initial){
 const slots=policyLiteralConditionSlots(initial),parts=String(initial).split(/([,，、/·])/u);
 if(!slots.length)return policyConfirmedRowReading(readings);
 const output=parts.slice(),confirmed=[];
 for(const slot of slots){
  const candidates=readings.flatMap(reading=>{
   const tokens=String(reading.text||'').split(/([,，、/·])/u);
   if(tokens.length!==parts.length||parts.some((part,i)=>i%2===1&&part!==tokens[i]))return [];
   return [{...reading,text:tokens[slot].trim()}];
  });
  const chosen=policyConfirmedCropReading(candidates,/^[가-힣]+$/u);
  if(!chosen)return null;
  output[slot]=parts[slot].replace(/\S(?:[\s\S]*\S)?/,chosen.text);confirmed.push(chosen);
 }
 // Each replacement is actual OCR evidence at the same list position.
 // Never replace unaffected names with a less accurate whole-row retry.
 return {text:output.join(''),confidence:Math.min(...confirmed.map(item=>item.confidence))};
}
function policyNeedsLiteralAudit(text){
 if(policyCityIssues(text).some(issue=>issue.kind==='unknown'))return true;
 // A condition word occupying a list item may itself be an OCR error.
 // Re-read its pixels; never assume which place or condition was printed.
 return policyLiteralConditionSlots(text).length>0;
}
// A place reference only selects a crop for another OCR pass. It never supplies output text.
async function policyAuditLiteralRows(source,layout,ocr,koreanRows,mixedRows,verified){
 const audited=new Map(),korean=await ocr.getRegionWorker();
 for(let index=0;index<layout.bands.length;index++){
  const initial=verified.get(index)?.confirmed?verified.get(index):policyInitialName(koreanRows[index],mixedRows[index]);
  if(/[\u3400-\u9fff\uf900-\ufaff]/.test(initial.text)||!policyNeedsLiteralAudit(initial.text))continue;
  const band=layout.bands[index],readings=[];
  policyUpdateOcrProgress('미확인 표기의 원본 획 재판독 · '+(index+1)+'행');
  for(const variant of ['channel','white','original','channelcrop','whitecrop']){
   try{
    await korean.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'',preserve_interword_spaces:'1',user_defined_dpi:'300'});
    const result=await policyOcrTimeout(korean.recognize(policyCellImage(source,2,band.top,layout.divider-2,band.bottom,variant)),30000,'원본 행 재판독 제한 시간');
    readings.push({text:String(result.data?.text||'').trim(),confidence:Number(result.data?.confidence||0),family:variant,model:'한국어'});
   }catch(error){readings.push({text:'',confidence:0,family:variant,model:'한국어'})}
   if(policyConfirmedLiteralAudit(readings,initial.text))break;
  }
  const confirmed=policyConfirmedLiteralAudit(readings,initial.text);
  audited.set(index,{...(confirmed||initial),confirmed:!!confirmed,readings,audit:true});
 }
 return audited;
}
function policyQuantityCellReading(numeric,unrestricted){
 const text=String(unrestricted?.text||'').trim(),compact=text.replace(/\s/g,''),digits=String(numeric?.text||'').replace(/\s/g,'');
 const confidence=Number(unrestricted?.confidence||0);
 // An unrestricted reading protects printed conditions from digit-only hallucinations.
 if(/^(?:접수)?불가$/.test(compact))return {text:'0',sourceText:text,review:confidence<85,kind:'blocked'};
 if(/[가-힣\u3400-\u9fff]/u.test(text))return {text,review:true,kind:'text'};
 const valid=/^\d+$/.test(digits),conflict=/^\d+$/.test(compact)&&compact!==digits;
 return {text:valid?digits:text,review:!valid||Number(numeric?.confidence||0)<65||conflict,kind:valid?'number':'unknown'};
}
function policyIsCodeTitle(index,name,quantityWords,quantity){
 if(index!==0||!policyCodeHeader(name))return false;
 const text=String(quantityWords?.text||'').replace(/\s/g,'');
 return /^(?:이월|수량|배정|건수|인원|한도)$/.test(text)||(!text&&!/^\d+$/.test(quantity));
}
async function policyRecognizeBatch(source,layout,ocr){
 const started=Date.now();
 const names=policyPackCells(source,layout,false,'color'),numbers=policyPackCells(source,layout,true,'color');
 const korean=await ocr.getRegionWorker();
 policyUpdateOcrProgress('표 전체의 한글·한자·수량을 병렬 인식 중');
 const results=await Promise.allSettled([policyBatchRead(korean,names),policyBatchRead(ocr.worker,names),policyBatchRead(ocr.digitWorker,numbers,'0123456789')]);
 const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
 const [kor,mixed,qty]=results.map(r=>r.value),quantityWords=await policyBatchRead(korean,numbers),rows=[['지역','수량','상태']];policyIntakeTitle='';
 const verifiedRows=await policyVerifyDisputedRows(source,layout,ocr,kor,mixed);
 const auditedRows=await policyAuditLiteralRows(source,layout,ocr,kor,mixed,verifiedRows);
 for(let i=0;i<layout.bands.length;i++){
  const a=kor[i],b=mixed[i];
  // Only OCR readings are candidates. Never synthesize a place name from a gazetteer.
  const verification=auditedRows.get(i)||verifiedRows.get(i);
  let chosen=verification?.confirmed?verification:policyInitialName(a,b);
  const repairs=[];let nameRereadConfirmed=!!verification?.confirmed,glyphRereadUncertain=false;
  if(verification)repairs.push('획 재확인: '+verification.readings.filter(r=>r.family!=='color').map(r=>r.family+' '+r.model+': '+r.text+' ['+Math.round(r.confidence)+']').join(' / '));
  let quantityReading=policyQuantityCellReading(qty[i],quantityWords[i]);
  let quantity=quantityReading.text,quantityReview=quantityReading.review;
  if(PolicyInput.kindHeading(chosen.text)){rows.push([chosen.text]);continue;}
  if(policyIsCodeTitle(i,chosen.text,quantityWords[i],quantity)){
   policyIntakeTitle=chosen.text;policyAnalysis.push({row:1,text:chosen.text,alternatives:a.text+' / '+b.text+' · 수량 열 표제: '+quantityWords[i].text,reason:'접수 코드·열 제목 분리'});continue;
  }
  if(quantityReview){
   await korean.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'',preserve_interword_spaces:'1',user_defined_dpi:'300'});
   const band=layout.bands[i],r=await policyOcrTimeout(korean.recognize(policyCellImage(source,layout.divider+2,band.top,layout.width-2,band.bottom,'channel')),30000,'수량·조건 문자 재판독 제한 시간');
   const reread={text:String(r.data?.text||'').trim(),confidence:Number(r.data?.confidence||0)},retry=policyQuantityCellReading(qty[i],reread);
   repairs.push('수량·조건 원문: '+quantityWords[i].text+' ['+Math.round(quantityWords[i].confidence)+'] / '+reread.text+' ['+Math.round(reread.confidence)+']');
   if(quantityReading.kind==='text'&&quantityWords[i].confidence>=85){
    // Preserve text even if the second pass fails; never replace a condition by a guessed digit.
    if(retry.kind==='text'&&reread.confidence>quantityWords[i].confidence)quantity=reread.text;
   }else if(retry.kind==='blocked'&&!retry.review){quantity=retry.text;quantityReview=false}
   else if(retry.kind==='text'){quantity=retry.text;quantityReview=true}
   else if(/^\d+$/.test(reread.text)&&reread.confidence>=80&&reread.text===qty[i].text.replace(/\s/g,'')){quantity=reread.text;quantityReview=false}
  }
  // Isolate uncertain glyphs using OCR pixel boxes, never neighboring place names.
  if(/[＃#]/.test(chosen.text)){
   const symbols=(chosen.words||[]).filter(w=>/^[＃#]$/.test(w.text.trim()));
   for(const symbol of symbols){
    const band=layout.bands[i],cell=policyCellImage(source,2,band.top,layout.divider-2,band.bottom,'color');
    const scale=(cell.width-32)/(layout.divider-4);
    const left=Math.max(2,Math.floor((symbol.bbox.x0-32)/scale)+2-2),right=Math.min(layout.divider-2,Math.ceil((symbol.bbox.x1-32)/scale)+2+2);
    if(right<=left)continue;
    const han=await ocr.getHanWorker(),readings=[];
    for(const variant of ['color','original']){
     await han.setParameters({tessedit_pageseg_mode:'10',tessedit_char_whitelist:'',user_defined_dpi:'300'});
     const r=await policyOcrTimeout(han.recognize(policyCellImage(source,left,band.top,right,band.bottom,variant)),30000,'개별 문자 인식 제한 시간');
     readings.push({text:String(r.data?.text||'').trim(),confidence:Number(r.data?.confidence||0)});
    }
    repairs.push('문자 영역: '+readings.map(r=>r.text+' ['+Math.round(r.confidence)+']').join(' / '));
    if(readings[0].text===readings[1].text&&/^[\u3400-\u9fff\uf900-\ufaff]$/.test(readings[0].text)&&readings.every(r=>r.confidence>=70)){chosen={...chosen,text:chosen.text.replace(/[＃#]/,readings[0].text)};glyphRereadUncertain=glyphRereadUncertain||readings.some(r=>r.confidence<85)}
   }
  }
  if(chosen.confidence<85&&/^[가-힣]{2,4}$/.test(chosen.text)){
   const band=layout.bands[i],readings=[];
   for(const variant of ['whitepixel','white','color']){
    await korean.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'',preserve_interword_spaces:'1',user_defined_dpi:'300'});
    const r=await policyOcrTimeout(korean.recognize(policyCellImage(source,2,band.top,layout.divider-2,band.bottom,variant)),30000,'짧은 행 재인식 제한 시간');
    readings.push({text:String(r.data?.text||'').trim(),confidence:Number(r.data?.confidence||0),family:variant});
   }
   repairs.push('행 확대: '+readings.map(r=>r.text+' ['+Math.round(r.confidence)+']').join(' / '));
   const supported=policyConfirmedCropReading(readings,/^[가-힣]{2,4}$/);
   if(supported){chosen={...chosen,...supported};nameRereadConfirmed=true}
  }
  const review=!!(verification?.audit&&!verification.confirmed)||policyNameNeedsReview(chosen,a,b,nameRereadConfirmed,glyphRereadUncertain);
  policyAnalysis.push({row:rows.length+1,text:chosen.text||'판독 실패',alternatives:'한국어: '+a.text+' ['+Math.round(a.confidence)+'] / 한국어·한문: '+b.text+' ['+Math.round(b.confidence)+']'+(repairs.length?' / '+repairs.join(' / '):''),reason:review?'판독 불일치 또는 저신뢰 · 원본 확인 필요':nameRereadConfirmed?'서로 다른 확대 영상의 실제 판독 일치':repairs.length?'글자 영역 재판독 결과 적용':'두 인식기의 실제 판독 일치'});
  rows.push([chosen.text||'확인 필요',quantity||'확인 필요',(quantity.replace(/\s/g,'')==='불가'?'마감':/[가-힣]/.test(quantity)?'확인 필요 · 수량 대신 조건 표기':policyQuantityStatus(quantity,quantityReview))+(review?' · 지역확인':'')]);
 }
 policyOcrTiming=(Date.now()-started)/1000;
 return rows;
}
let policyOcrTiming=0,policyOcrTotalTiming=0;

async function policyRunOcr(){
 policyCancelAutoConvert();
 if(!policyImageData||policyOcrRunning)return;if(policyTimerInterval===null)policyTimerStart();policyTimerPhase='변환 중';policyTimerRefresh();const totalStarted=Date.now();let recognitionStarted=0;policyOcrTiming=0;policyOcrRunning=true;policyAnalysis=[];policyRefreshAnalysis();policyOcrProgress=3;policyRefreshPreview();
 try{
  policyUpdateOcrProgress('표선·숫자 열 분석 · 3%');const source=await policyLoadCanvas(policyImageData),layout=await policyAnalyzeTable(source);policyOcrProgress=12;policyUpdateOcrProgress('행 '+layout.bands.length+'개 감지 · 12%');
  const ocr=await policyGetPaddleOcr();policyOcrProgress=55;policyUpdateOcrProgress('정리된 글자만 로컬 인식 · 55%');
  recognitionStarted=Date.now();policyRows=policyCleanRows(await policyRecognizeBatch(source,layout,ocr));policyCodeTitles=policyIntakeTitle?[policyIntakeTitle]:[];policyRememberCodes(policyCodeTitles.map(title=>policyCodeHeader(title)));policyOcrTiming=(Date.now()-recognitionStarted)/1000;policyOcrTotalTiming=(Date.now()-totalStarted)/1000;policyPrepareCityReview();if(policyRows.length<2)throw new Error('정책표 내용을 찾지 못했습니다.');
  policyApplyConvertedText([...policyCodeTitles,...policyRows.map(row=>row.join('\t'))].join('\n'));
  const recognized=policyRows.map(row=>row.join('\t')).join('\n'),textarea=root.querySelector('#tm-policy-paste');if(textarea)textarea.value=recognized;
  policyTimerStop('변환 완료');policyOcrProgress=100;policyRegistered=false;policyImageData='';policyImageName='';policyRefreshPreview();toast('정책표 OCR 완료 · 인식 '+policyOcrTiming.toFixed(1)+'초. 확인이 필요한 셀을 확인해 주세요.');
 }catch(error){policyTimerStop('변환 실패');await policyResetPaddleOcr();policyOcrProgress=0;policyOcrRunning=false;policyRefreshPreview();const message='전용 OCR 오류: '+(error?.message||'변환 실패');policyUpdateOcrProgress(message);toast(message)}
 finally{policyOcrRunning=false;const convert=root.querySelector('[data-action="policy-parse"]');if(convert)convert.disabled=false;const button=root.querySelector('[data-action="policy-ocr"]');if(button){button.disabled=false;button.textContent='정책표 전용 OCR로 다시 변환'}}
}
let adminIntakeSection='policy';
root.addEventListener('click',e=>{
 const button=e.target.closest('[data-intake-section-button]');if(!button)return;
 const key=button.dataset.intakeSectionButton;if(!['policy','clients','codes'].includes(key))return;
 adminIntakeSection=key;
 root.querySelectorAll('[data-intake-section-button]').forEach(item=>{const selected=item.dataset.intakeSectionButton===key;item.setAttribute('aria-pressed',String(selected));item.className=selected?'action':'secondary'});
 root.querySelectorAll('[data-intake-section-panel]').forEach(item=>{const selected=item.dataset.intakeSectionPanel===key;item.hidden=!selected;item.style.display=selected?'':'none'});
});
function adminIntake(){
 const management=panel('접수·지역 관리 항목',table(['구분','관리 내용','우선 확인'],[
  ['접수 목록','기간·직원·접수 코드·상태별 조회','오늘 접수'],
  ['상태 관리','가접수·정상접수·취소·A/S 변경','승인 기록'],
  ['담당자·중복','담당자 배정과 전화번호·주소 중복 확인','미배정·중복'],
  ['접수 가능지역','시·군·구 및 읍·면·동 범위 설정','제주 포함'],
  ['접수 코드·상품 구분','관리자가 추가한 코드별 일반·실버 관리','등록 정책'],
  ['지역별 수량','오늘 배정·남은 수량·묶음 공유','마감 지역'],
  ['적용 일정','지역 정책 시작일·종료일과 변경 이력','예약 변경']
 ]));
 const policyPanel=panel('정책표 등록',`<p class="sub">엑셀에서 복사한 표, 일반 텍스트 또는 정책표 이미지를 붙여넣을 수 있습니다. 붙여넣은 뒤 변환 버튼을 눌러 주세요. 일반·실버와 지역별 수량을 자동 분류하며, 결과를 확인한 뒤 등록합니다.</p>${policyPublicationControls()}<details id="tm-policy-source" class="policy-paste-source" ${policyRows.length?'':'open'}><summary>정책표 붙여넣기 · 원문 텍스트</summary><label>엑셀 표·텍스트·이미지 붙여넣기<textarea id="tm-policy-paste" rows="7" placeholder="여기에 엑셀 표나 텍스트를 붙여넣으세요. 이미지도 Ctrl+V로 붙여넣을 수 있습니다."></textarea></label></details><div class="toolbar"><label class="secondary" style="display:inline-flex;align-items:center;cursor:pointer">이미지 선택<input id="tm-policy-image" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button type="button" class="secondary" data-action="policy-parse" ${policyOcrRunning?'disabled':''}>변환</button><button type="button" class="secondary" data-action="policy-analyze">OCR 분석 내역</button><button type="button" class="secondary" data-action="policy-clear">초기화</button><button type="button" class="action" data-action="policy-register" ${policyRegistrationPending?'disabled':''}>${policyRegistrationPending?'저장 중…':'정책표 등록'}</button><button type="button" class="action" data-action="policy-city-save-all">일괄 적용</button><span id="tm-policy-check-count" role="status" aria-live="polite" style="color:#1457bb;background:#eef4ff;border:1px solid #b9d2ff;border-radius:8px;padding:9px 12px;font-weight:700">체크할 항목 : ${policyReviewCount()}건</span></div><p id="tm-policy-register-status" role="status" aria-live="polite" style="padding:12px;border-radius:8px;background:#eef4ff;white-space:pre-wrap" ${policyRegistrationStatus.message?'':'hidden'}>${policyEscape(policyRegistrationStatus.message)}</p>${policyTimerMarkup()}<div id="tm-policy-preview" aria-live="polite">${policyPreviewMarkup()}</div><div id="tm-policy-analysis" aria-live="polite">${policyAnalysisMarkup()}</div>`);
 const registeredPanel=panel('등록 결과 미리보기',`<p class="sub">등록된 정책표의 행·열과 실제 내용을 확인할 수 있습니다. 한화·신한·G/A는 접수 코드이며 지역명과 별도로 관리합니다.</p><div id="tm-policy-registered-preview" aria-live="polite">${policyRegisteredPreviewMarkup()}</div>`);
 const items=[['policy','정책표 등록',policyPanel+registeredPanel+'<div data-policy-history></div>'+policyNationalCatalogPanel()+management],['clients','거래처 관리',policyClientManagerPanel()],['codes','접수 코드 관리',intakeCodeManagerPanel()]];
 return '<div class="toolbar" role="group" aria-label="정책 등록 관리 메뉴">'+items.map(([key,label])=>'<button type="button" class="'+(adminIntakeSection===key?'action':'secondary')+'" data-intake-section-button="'+key+'" aria-pressed="'+(adminIntakeSection===key)+'" aria-controls="tm-intake-section-'+key+'">'+label+'</button>').join('')+'</div>'+items.map(([key,label,content])=>'<section id="tm-intake-section-'+key+'" data-intake-section-panel="'+key+'" aria-label="'+label+'"'+(adminIntakeSection===key?'':' hidden style="display:none"')+'>'+content+'</section>').join('');
}

/* Preview records: historical aggregates have no recorded employee/customer detail. */
const adminPerformanceRecords=[];
Object.entries(adminTeamPerformance).forEach(([team,days])=>Object.entries(days).forEach(([day,count])=>{
 for(let i=0;i<count;i++)adminPerformanceRecords.push({id:team+'-'+day+'-'+i,firstDate:'2026-09-'+String(day).padStart(2,'0'),team,employee:'담당 미지정',customer:'예시 접수 '+(i+1),status:'normal',history:[]});
}));
function performanceRecordCount(record){return record.status==='normal'?1:0}
function adminPerformanceDetails(){
 const date=adminPerformanceMonth+'-'+String(adminPerformanceDay).padStart(2,'0');
 const records=adminPerformanceRecords.filter(r=>r.firstDate===date);
 if(!records.length)return '';
 return panel(date+' · 접수 목록', '<p class="sub">기존 월별 실적 예시입니다. 직원·고객 원자료가 없어 담당자는 미지정으로 표시합니다. A/S 등록·차감 검토는 별도의 A/S 관리 화면에서 확인할 수 있으며 이 예시 합계와는 아직 연결되지 않았습니다.</p>'+adminTeams.map(team=>{
 const items=records.filter(r=>r.team===team.id);if(!items.length)return '';
 const people=[...new Set(items.map(r=>r.employee))];
 return '<details open><summary>'+policyEscape(team.name)+' · 정상접수 '+items.reduce((n,r)=>n+performanceRecordCount(r),0)+'건</summary>'+table(['직원','정상접수','A/S'],people.map(name=>[policyEscape(name),items.filter(r=>r.employee===name&&r.status==='normal').length+'건',items.filter(r=>r.employee===name&&r.status==='as').length+'건']))+table(['접수번호','최초 접수일','직원','접수','상품 구분','상태','처리','변경 이력'],items.map(r=>[policyEscape(r.id),r.firstDate,policyEscape(r.employee),policyEscape(r.customer),performanceProduct(r)==='insurance'?'<select aria-label="보험 상품 구분" data-performance-kind="'+r.id+'">'+[['','미지정'],['general','일반'],['silver','실버']].map(([key,label])=>'<option value="'+key+'" '+((r.insuranceKind||'')===key?'selected':'')+'>'+label+'</option>').join('')+'</select>':performanceProduct(r)==='cosmetics'?'화장품':performanceProduct(r)==='supplements'?'건강보조식품':'기타',r.status==='as'?pill('A/S','amber'):pill('정상접수','green'),'<button class="secondary" data-page="adminAs">A/S 검토 화면</button>',r.history.map(h=>policyEscape(h)).join('<br>')||'—']))+'</details>';
 }).join(''));
}
// A/S registration and deduction review are separated in AdminWorkspace.

let adminPerformanceMonth='2026-09',adminPerformanceDay=22;
function adminPerformanceDaily(teamId){const daily={};adminPerformanceRecords.filter(r=>r.team===teamId&&r.firstDate.slice(0,7)===adminPerformanceMonth).forEach(r=>{const day=Number(r.firstDate.slice(8));daily[day]=(daily[day]||0)+performanceRecordCount(r)});return daily}

let performanceWeekStart=1;
try{const saved=localStorage.getItem('tm-performance-week-start');if(saved!==null&&/^[0-6]$/.test(saved))performanceWeekStart=Number(saved)}catch(error){}
let performanceWeekAnchor=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function performanceWeekDates(anchor,startDay){
 const date=new Date(anchor+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()-startDay+7)%7);
 return Array.from({length:7},(_,i)=>{const day=new Date(date);day.setUTCDate(day.getUTCDate()+i);return day.toISOString().slice(0,10)});
}
function performanceProduct(record){return record.productCategory||({insurance:'insurance',cosmetics:'cosmetics',supplements:'supplements'})[record.team]||'other'}
function performanceWeekly(){
 const dates=performanceWeekDates(performanceWeekAnchor,performanceWeekStart);
 const records=adminPerformanceRecords.filter(r=>dates.includes(r.firstDate));
 const groups=[['보험 · 일반',r=>performanceProduct(r)==='insurance'&&r.insuranceKind==='general'],['보험 · 실버',r=>performanceProduct(r)==='insurance'&&r.insuranceKind==='silver'],['보험 · 구분 미지정',r=>performanceProduct(r)==='insurance'&&!['general','silver'].includes(r.insuranceKind)],['화장품',r=>performanceProduct(r)==='cosmetics'],['건강보조식품',r=>performanceProduct(r)==='supplements']];
 if(records.some(r=>performanceProduct(r)==='other'))groups.push(['기타',r=>performanceProduct(r)==='other']);
 const count=items=>items.reduce((n,r)=>n+performanceRecordCount(r),0);
 const rows=groups.map(([name,filter])=>{const items=records.filter(filter);return [name,...dates.map(date=>count(items.filter(r=>r.firstDate===date))+'건'),'<strong>'+count(items)+'건</strong>',items.filter(r=>r.status==='as').length+'건']});
 rows.push(['<strong>전체 합계</strong>',...dates.map(date=>count(records.filter(r=>r.firstDate===date))+'건'),'<strong>'+count(records)+'건</strong>',records.filter(r=>r.status==='as').length+'건']);
 return panel('상품별 주간 실적',`<div class="toolbar performance-week-toolbar"><button class="secondary" data-performance-week="-1">이전 주</button><strong>${dates[0]} ~ ${dates[6]}</strong><button class="secondary" data-performance-week="1">다음 주</button><button class="secondary" data-performance-week="today">이번 주</button><label>기준일 <input type="date" id="performance-week-date" value="${performanceWeekAnchor}"></label><label>주 시작 요일 <select id="performance-week-start">${['일','월','화','수','목','금','토'].map((name,i)=>`<option value="${i}" ${i===performanceWeekStart?'selected':''}>${name}요일</option>`).join('')}</select></label></div><p class="sub">최초 접수일 기준 정상 실적 · A/S 전환 시 차감, 완료 시 복구 · 주 시작 요일은 이 브라우저에 저장됩니다.</p>`+
 '<div class="scroll">'+table(['상품 구분',...dates.map(date=>date.slice(5)+' ('+['일','월','화','수','목','금','토'][new Date(date+'T00:00:00Z').getUTCDay()]+')'),'주간 정상 합계','A/S'],rows)+'</div>'+
 '<p class="sub">기존 보험 예시 자료에는 일반·실버 구분이 없어 미지정으로 집계합니다. 건강보조식품은 등록된 접수가 없습니다.</p>');
}
root.addEventListener('change',event=>{
 if(event.target.dataset.performanceKind){const record=adminPerformanceRecords.find(r=>r.id===event.target.dataset.performanceKind);if(record&&['','general','silver'].includes(event.target.value)){record.insuranceKind=event.target.value;render()}return}
 if(event.target.id==='performance-week-start'){performanceWeekStart=Number(event.target.value);try{localStorage.setItem('tm-performance-week-start',String(performanceWeekStart))}catch(error){}render()}
 if(event.target.id==='performance-week-date'&&/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)){performanceWeekAnchor=event.target.value;render()}
});
root.addEventListener('click',event=>{
 const button=event.target.closest('[data-performance-week]');if(!button)return;
 if(button.dataset.performanceWeek==='today')performanceWeekAnchor=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 else{const date=new Date(performanceWeekAnchor+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+Number(button.dataset.performanceWeek)*7);performanceWeekAnchor=date.toISOString().slice(0,10)}
 render();
});

function adminPerformance(){
 const todayParts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const todayPart=type=>todayParts.find(part=>part.type===type).value;
 const todayDate=todayPart('year')+'-'+todayPart('month')+'-'+todayPart('day');
 const [year,month]=adminPerformanceMonth.split('-').map(Number),days=new Date(year,month,0).getDate(),first=new Date(year,month-1,1).getDay();
 const rows=adminTeams.map(team=>({team,daily:adminPerformanceDaily(team.id)}));
 const monthSum=row=>Object.values(row.daily).reduce((sum,n)=>sum+n,0);
 const dailySum=day=>rows.reduce((sum,row)=>sum+(row.daily[day]||0),0);
 const totalCount=rows.reduce((sum,row)=>sum+monthSum(row),0),hasData=rows.some(row=>Object.keys(row.daily).length);
 const cutoff=adminPerformanceMonth==='2026-09'?22:0;
 let cells=Array.from({length:first},(_,i)=>calendarNeighborCell(year,month,i-first+1)).join('');
 for(let day=1;day<=days;day++){
  const dow=new Date(year,month-1,day).getDay(),date=adminPerformanceMonth+'-'+String(day).padStart(2,'0'),holiday=calendarHolidays[date];
  const available=hasData&&day<=cutoff;
  cells+=`<button type="button" class="day ${holiday||dow===0?'day-red':dow===6?'day-blue':''} ${day===adminPerformanceDay?'active':''} ${date===todayDate?'team-performance-today':''}" ${date===todayDate?'aria-current="date"':''} data-calendar-date="${date}" data-admin-performance-day="${day}" aria-pressed="${day===adminPerformanceDay}"><span class="date-number">${day}</span>${available?rows.map((row,i)=>`<small class="team-performance-count team-tone-${i%4}">${policyEscape(row.team.name)} <b>${row.daily[day]||0}건</b></small>`).join('')+`<small class="team-performance-total">전체 <b>${dailySum(day)}건</b></small>` :''}</button>`;
 }
 const pad=(7-(first+days)%7)%7;cells+=Array.from({length:pad},(_,i)=>calendarNeighborCell(year,month,days+1+i)).join('');
 const summary=rows.map(row=>[policyEscape(row.team.name),hasData?monthSum(row)+'건':'—']);
 if(rows.length)summary.push(['<strong>전체 합계</strong>','<strong>'+ (hasData?totalCount+'건':'—')+'</strong>']);
 const selectedAvailable=hasData&&adminPerformanceDay<=cutoff;
 return `<div class="row"><h2>실적 관리</h2><span class="pill">관리자 전용</span></div>
 <div class="toolbar"><button type="button" class="secondary" data-admin-performance-month="-1">이전 달</button><strong>${year}년 ${month}월</strong><button type="button" class="secondary" data-admin-performance-month="1">다음 달</button></div>`+
 stats([['전체 정상 실적',hasData?totalCount+'건':'—','선택 월 · 가접수와 A/S 제외'],...rows.map(row=>[policyEscape(row.team.name),hasData?monthSum(row)+'건':'—','선택 월 정상접수 합계'])])+
 performanceWeekly()+
 panel('팀별 성과 · 월 합계',table(['팀','정상접수 합계'],summary))+
 panel('팀별 실적 달력',`<div class="row" style="margin-bottom:12px"><strong>${year}년 ${month}월</strong><span class="sub">날짜별 정상접수 · 팀별 수량과 전체 합계</span></div><div class="team-performance-scroll"><div class="calendar team-performance-calendar">${['일','월','화','수','목','금','토'].map((name,i)=>`<div class="weekday ${i===0?'weekday-red':i===6?'weekday-blue':''}">${name}</div>`).join('')}${cells}</div></div>`)+
 panel(`${month}월 ${adminPerformanceDay}일 · 팀별 합계`,selectedAvailable?table(['팀','정상접수'],rows.map(row=>[policyEscape(row.team.name),(row.daily[adminPerformanceDay]||0)+'건']).concat([['<strong>전체 합계</strong>','<strong>'+dailySum(adminPerformanceDay)+'건</strong>']])):'')+adminPerformanceDetails();
}
root.addEventListener('click',event=>{
 const button=event.target.closest('[data-admin-performance-day],[data-admin-performance-month]');if(!button)return;
 if(button.dataset.adminPerformanceDay)adminPerformanceDay=Number(button.dataset.adminPerformanceDay);
 else{const [year,month]=adminPerformanceMonth.split('-').map(Number),date=new Date(year,month-1+Number(button.dataset.adminPerformanceMonth),1);adminPerformanceMonth=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');adminPerformanceDay=1}
 render();
});
// Editable grade policy. Bounds: weekly average upper bound is exclusive; other counts are inclusive.
const gradePolicyKey='tm-office-grade-policy-v1';
const gradeDepartments={insurance:'보험팀',cosmetics:'화장품팀',health:'건강보조식품팀'};
let gradeDepartment=new URL(window.CNCPageNavigation?.url()||location.href).searchParams.get('department')||new URL(window.CNCPageNavigation?.url()||location.href).searchParams.get('team')||'insurance';if(!Object.hasOwn(gradeDepartments,gradeDepartment))gradeDepartment='insurance';
const gradeDraftCache={};
function gradeEmployeeDepartment(id='staff-0'){if(window.CNCHOME_LIVE)return window.CNCHOME_LIVE.user.department;const p=adminEmployees[Number(id.replace('staff-',''))];return p?.department||p?.team||'';}
function gradePeriodVisible(period){return window.GradeVisibility?.visible(period)!==false;}
window.addEventListener('cnc:grade-visibility-updated',()=>{if(liveEmployee&&['home','grade'].includes(page)){if(modal.open)modal.close();render();}});
function gradeEmployeeAvailable(){if(!window.CNCHOME_LIVE||window.CNCHOME_LIVE.user.role==='admin'||gradeEmployeeDepartment()==='insurance')return true;return gradeEntries.some(e=>e.department===gradeEmployeeDepartment()&&e.date<=gradeToday());}
function gradeDepartmentPending(){return panel(gradeDepartments[gradeEmployeeDepartment()]+' 그레이드', '<p class="sub">부서 전용 지급 기준을 준비 중입니다. 관리자가 해당 부서의 기준을 등록하면 확인할 수 있습니다.</p>');}
function gradeEmptyPolicy(){const row=()=>({min:0,max:null,hourly:0,achievement:0,extraStart:null,extra:0});return {version:1,dailyCash:{start:1,perCase:0},weeklyBasis:'total',daily:[row()],weekly:[row()],monthly:[row()]};}
const gradePeriods={daily:'일그레이드',weekly:'주그레이드',monthly:'월그레이드'};
function gradeDefaults(){return {version:1,dailyCash:{start:6,perCase:5000},weeklyBasis:'average',daily:[{min:0,max:5,hourly:0,achievement:0,extraStart:null,extra:0},{min:6,max:null,hourly:0,achievement:0,extraStart:6,extra:5000}],weekly:[{min:0,max:8,hourly:0,achievement:0,extraStart:null,extra:0},{min:8,max:9,hourly:0,achievement:30000,extraStart:null,extra:0},{min:9,max:10,hourly:0,achievement:35000,extraStart:null,extra:0},{min:10,max:null,hourly:0,achievement:40000,extraStart:null,extra:0}],monthly:[{min:0,max:99,hourly:14000,achievement:0,extraStart:null,extra:0},{min:100,max:109,hourly:14000,achievement:0,extraStart:100,extra:5000},{min:110,max:119,hourly:15000,achievement:50000,extraStart:110,extra:5000},{min:120,max:129,hourly:15000,achievement:100000,extraStart:120,extra:5000},{min:130,max:139,hourly:15000,achievement:200000,extraStart:130,extra:10000},{min:140,max:null,hourly:16000,achievement:300000,extraStart:140,extra:10000}]}}
function gradeGenerateWeekly(start,amount,step=5000){if(![start,amount,step].every(Number.isSafeInteger)||start<1||start+19>100000000||amount<0||step<0||amount+step*19>100000000)throw Error('주 기준 시작값·금액·증가액을 확인해 주세요.');return [{min:0,max:start,hourly:0,achievement:0,extraStart:null,extra:0},...Array.from({length:20},(_,i)=>({min:start+i,max:i===19?null:start+i+1,hourly:0,achievement:amount+step*i,extraStart:null,extra:0}))];}
function gradeRestoreMonthlyDraft(draft){if(draft.monthlyManualVersion===1)return;const source=draft.monthlyAuto?.source;if(source){draft.monthly=structuredClone(source.slice(0,6));draft.monthly.at(-1).max=null;}if(gradeDepartment==='insurance'&&draft.monthly.length>1){const shift=100-draft.monthly[1].min;draft.monthly.forEach((r,i)=>{if(i)r.min+=shift;if(r.max!==null)r.max+=shift;if(r.extraStart!==null)r.extraStart+=shift;});}delete draft.monthlyAuto;draft.monthlyManualVersion=1;}
function gradeConfiguredPeriods(date=gradeToday(),through=null){
 const configured=new Set();
 for(const entry of gradeEntries){
  if((entry.department||'insurance')!==gradeDepartment||entry.date>date)continue;
  if(through&&entry.date===through.date&&(entry.savedAt>through.savedAt||(entry.savedAt===through.savedAt&&(entry.id??0)>(through.id??0))))continue;
  const period=entry.period||'all';for(const key of Object.keys(gradePeriods))if(period==='all'||period===key)configured.add(key);
 }
 return configured;
}
function gradePrepareDraft(policy,through=null){const draft=structuredClone(policy);if(gradeDepartment!=='insurance'){for(const key of ['monthlyReference','monthlyManualVersion','weeklyAuto','weeklyDraftVersion','weeklyStartEightVersion'])delete draft[key];const configured=gradeConfiguredPeriods(through?.date||gradeToday(),through);for(const period of Object.keys(gradePeriods)){if(configured.has(period))continue;if(period==='daily')draft.dailyCash={start:NaN,perCase:NaN};else{draft[period]=[{min:NaN,max:null,hourly:NaN,achievement:NaN,extraStart:null,extra:NaN}];if(period==='weekly')draft.weeklyBasis='';}}return draft;}if(gradeDepartment==='insurance'&&!draft.weeklyDraftVersion){draft.weekly=gradeDefaults().weekly;draft.weeklyBasis='average';draft.weeklyDraftVersion=1;}if(!draft.weeklyAuto){const r=draft.weekly[1];draft.weeklyAuto={start:r?.min||8,amount:r?.achievement||0,step:5000};draft.weekly=gradeGenerateWeekly(draft.weeklyAuto.start,draft.weeklyAuto.amount);draft.weeklyBasis='average';}if(!draft.weeklyStartEightVersion){const shift=8-draft.weekly[1].min;draft.weekly.forEach((r,i)=>{if(i)r.min+=shift;if(r.max!==null)r.max+=shift;});draft.weeklyAuto.start=8;draft.weeklyStartEightVersion=1;}gradeRestoreMonthlyDraft(draft);if(gradeDepartment==='insurance'&&!draft.monthlyReference)draft.monthlyReference=gradeMonthlyReferenceRows();return draft;}
function gradeSyncWeeklyBounds(policy){const rows=policy.weekly;rows.forEach((r,i)=>{r.max=i===rows.length-1?null:rows[i+1].min-(gradeExclusive(policy,'weekly')?0:1)});}
function gradeNumber(value){return Number.isNaN(value)?'':GradeNumbers.format(value)}
function gradeAutoInput(label,key,value,kind,min=0,max=100000000){return `<label>${label}<input type="text" inputmode="numeric" data-grade-number min="${min}" max="${max}" step="1" required data-grade-auto="${kind}" data-auto-key="${key}" value="${gradeNumber(value)}"></label>`;}
function gradeWeeklyTable(policy,edit=false){if(!policy.weeklyAuto)return table(['실적 구간','지급액'],policy.weekly.map(r=>[gradeRange(r,'weekly',policy),gradeMoney(r.achievement)]));const rows=policy.weekly.slice(1),a=policy.weeklyAuto;return `${edit?`<div class="grade-auto-controls">${gradeAutoInput('시작 건수','start',a.start,'weekly',1)}${gradeAutoInput('시작 금액 (원)','amount',a.amount,'weekly')}${gradeAutoInput('칸마다 증가액 (원)','step',a.step,'weekly')}</div><p class="sub">건수는 1씩 증가 · 총 20칸 · 금액은 시작 금액 + 증가액 × 칸 순서</p>`:''}<div class="grade-week-track" tabindex="0" role="region" aria-label="주 그레이드 20칸 가로 스크롤"><table data-weekly-horizontal><thead><tr>${rows.map(r=>`<th>${gradeNumber(r.min)}건</th>`).join('')}</tr></thead><tbody><tr>${rows.map(r=>`<td><strong>${gradeMoney(r.achievement)}</strong></td>`).join('')}</tr></tbody></table></div>`;}

function gradeExclusive(policy,period){return period==='weekly'&&policy.weeklyBasis==='average'}
function gradeValidate(policy){
 if(policy?.monthlyReference){
  const ref=policy.monthlyReference,original=gradeMonthlyReferenceRows();
  if(!Array.isArray(ref)||ref.length!==original.length||ref.some((r,i)=>!r||(i===ref.length-1?r.max!==null:!Number.isSafeInteger(r.max)||r.max<0||r.max>99999999||(i>0&&r.max<=ref[i-1].max))||(!Number.isSafeInteger(r.threshold)||r.threshold<0||r.threshold>100000000)||['hourly','achievement','extra','example'].some(k=>!Number.isSafeInteger(r[k])||r[k]<(k==='hourly'?15000:0)||r[k]>100000000)))return '월 실적 구간은 앞 구간보다 큰 정수로 입력해 주세요. 예상실적은 0건 이상, 수당은 0원 이상, 시급은 15,000원 이상의 정수여야 합니다.';
 }

 if(policy?.dailyCash&&(!Number.isSafeInteger(policy.dailyCash.start)||policy.dailyCash.start<1||policy.dailyCash.start>100000000||!Number.isSafeInteger(policy.dailyCash.perCase)||policy.dailyCash.perCase<0||policy.dailyCash.perCase>100000000))return '일 그레이드 시작 건수와 건당 지급액을 확인해 주세요.';
 if(!policy||policy.version!==1||!['average','total'].includes(policy.weeklyBasis))return '기준 형식이 올바르지 않습니다.';
 for(const period of Object.keys(gradePeriods)){
  const rows=policy[period],title=gradePeriods[period],exclusive=gradeExclusive(policy,period);
  if(!Array.isArray(rows)||!rows.length)return title+': 구간을 한 개 이상 입력해 주세요.';
  if(period==='weekly'&&rows.length>21)return '주 그레이드는 최대 20개 기준까지 설정할 수 있습니다.';
  for(let i=0;i<rows.length;i++){
   const r=rows[i];if(!r)return title+': 구간을 확인해 주세요.';
   for(const key of ['min','max','hourly','achievement','extraStart','extra']){
    if(r[key]===null&&['max','extraStart'].includes(key))continue;
    if(!Number.isSafeInteger(r[key])||r[key]<0||r[key]>100000000)return `${title} ${i+1}행: 음수가 아닌 정수를 입력해 주세요. (최대 100,000,000)`;
   }
   if(i===0&&r.min!==0)return title+': 첫 구간은 0건부터 시작해야 합니다.';
   if(r.max!==null&&(exclusive?r.max<=r.min:r.max<r.min))return `${title} ${i+1}행: 종료 기준을 확인해 주세요.`;
   if(i<rows.length-1&&r.max===null)return title+': 마지막 구간만 상한을 비울 수 있습니다.';
   if(i===rows.length-1&&r.max!==null)return title+': 마지막 구간의 상한은 비워 주세요. (이상)';
   if(i>0&&r.min!==rows[i-1].max+(exclusive?0:1))return `${title} ${i+1}행: 구간이 겹치거나 누락되지 않도록 이전 구간에 이어 주세요.`;
   if(r.extra>0&&(r.extraStart===null||r.extraStart<r.min||(r.max!==null&&(exclusive?r.extraStart>=r.max:r.extraStart>r.max))))return `${title} ${i+1}행: 추가수당 시작 건수를 해당 구간 안에 입력해 주세요.`;
  }
 }
 return '';
}
function gradeCalculate(policy,period,count,hours=0,workdays=5){
 if(period==='daily'){const cash=policy.dailyCash||{start:6,perCase:5000},paidCount=Math.max(0,Math.floor(count)-cash.start+1),amount=paidCount*cash.perCase;return {row:{min:cash.start,max:null},value:count,hourly:0,base:0,achievement:amount,extra:0,bonus:amount,total:amount,paidCount};}
 const value=gradeExclusive(policy,period)?count/workdays:count;
 const row=policy[period].find(r=>value>=r.min&&(r.max===null||(gradeExclusive(policy,period)?value<r.max:value<=r.max)));
 if(!row)return {row:null,value,hourly:0,base:0,achievement:0,extra:0,bonus:0,total:0};
 const extra=period==='daily'||row.extraStart===null?0:Math.max(0,Math.floor(value)-row.extraStart+1)*row.extra;
 const base=period==='daily'?0:Math.round(hours*row.hourly),bonus=row.achievement+extra;
 return {row,value,hourly:row.hourly,base,achievement:row.achievement,extra,bonus,total:base+bonus};
}
function gradeToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function gradeValidDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2000-01-01'||value>'2099-12-31')return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value}
function gradePolicyAt(entries,date,department='insurance'){return entries.filter(e=>(e.department||'insurance')===department&&e.date<=date).sort((a,b)=>a.date.localeCompare(b.date)||a.savedAt.localeCompare(b.savedAt)).at(-1)?.policy||((!liveEmployee||testEmployee)&&department==='insurance'?gradeDefaults():gradeEmptyPolicy())}
function gradeNormalizeEntry(e){return {...e,policy:{...e.policy,dailyCash:e.policy.dailyCash||{start:6,perCase:(e.department||'insurance')==='insurance'?5000:0}}};}
function gradeReadStore(raw){if(!raw)return [];const parsed=JSON.parse(raw);if(parsed.version===1&&!gradeValidate(parsed))return [gradeNormalizeEntry({date:'2000-01-01',savedAt:'2000-01-01T00:00:00.000Z',policy:parsed})];if(parsed.version!==2||!Array.isArray(parsed.entries)||parsed.entries.some(e=>(e.department!==undefined&&!Object.hasOwn(gradeDepartments,e.department))||!gradeValidDate(e.date)||typeof e.savedAt!=='string'||gradeValidate(e.policy)))throw new Error('Invalid grade settings');return parsed.entries.map(gradeNormalizeEntry)}
let gradeEntries=[],gradeStorageMessage='';
try{gradeEntries=window.CNCHOME_LIVE?gradeReadStore(JSON.stringify({version:2,entries:window.CNCHOME_LIVE.entries})):gradeReadStore(localStorage.getItem(gradePolicyKey))}catch(error){gradeStorageMessage='저장된 기준을 읽을 수 없습니다. 저장 전에 브라우저 저장 설정을 확인해 주세요.'}
let gradePolicy=gradePolicyAt(gradeEntries,gradeToday());
let gradeDraft=gradePrepareDraft(gradePolicyAt(gradeEntries,gradeToday(),gradeDepartment)),gradeDirty=false,gradeDirtyPeriods=new Set(),gradeSavedStatus={},gradePreviewPeriod='monthly',gradeEffectiveDate=gradeToday(),gradePending=null,gradeHistoryPages={};
function gradeRange(row,period,policy=gradePolicy){return row.max===null?`${gradeNumber(row.min)}건 이상`:gradeExclusive(policy,period)?`${gradeNumber(row.min)}건 이상 ~ ${gradeNumber(row.max)}건 미만`:row.min===0?`${gradeNumber(row.max)}건 이하`:`${gradeNumber(row.min)}~${gradeNumber(row.max)}건`}
function gradeMoney(n){return fmt(n)+'원'}
function gradeSummaryTable(period){if(period==='monthly'&&gradeEmployeeDepartment()==='insurance')return gradeOriginalMonthlyTable(gradePolicy);if(period==='daily')return gradeDailyCashTable(gradePolicy);if(period==='weekly')return gradeWeeklyTable(gradePolicy);return table(['정상 실적'+(gradeExclusive(gradePolicy,period)?' (일평균)':''),'시급','달성 수당','현재 구간 추가 수당'],gradePolicy[period].map(r=>[gradeRange(r,period),r.hourly?gradeMoney(r.hourly):'미적용',gradeMoney(r.achievement),r.extra?`${gradeNumber(r.extraStart)}건부터 ${gradeMoney(r.extra)}/건`:'없음']))}
function gradeRefreshHeader(){if(window.CNCHOME_LIVE){window.GradeHeader?.render();return;}root.querySelector('#tm-head-daily').textContent=(gradePolicy.dailyCash?.start??6)+'/'+AdminWorkspace.todayDaily().count;root.querySelector('#tm-head-weekly').textContent=(gradeExclusive(gradePolicy,'weekly')?'평균 ':'')+(gradePolicy.weekly.find(r=>r.achievement||r.extra)?.min??0)+'/'+Number((15/(gradeExclusive(gradePolicy,'weekly')?5:1)).toFixed(1));const insurance=gradeEmployeeDepartment()==='insurance',r=insurance?gradeReferenceMonthly(total,0,gradePolicy).row:gradeCalculate(gradePolicy,'monthly',total).row;root.querySelector('#tm-head-monthly').textContent=r?(insurance?r.label:gradeRange(r,'monthly')):'구간 없음'}
function gradeInput(period,index,key,value){return `<input type="text" inputmode="numeric" data-grade-number min="0" max="100000000" step="1" ${['max','extraStart'].includes(key)?'':'required'} data-grade-period="${period}" data-grade-index="${index}" data-grade-field="${key}" aria-label="${gradePeriods[period]} ${index+1}행 ${{min:'시작 건수',max:'종료 건수',hourly:'시급',achievement:'달성 수당',extraStart:'추가수당 시작 건수',extra:'건당 추가수당'}[key]}" value="${value===null?'':gradeNumber(value)}" placeholder="${key==='max'?'상한 없음':key==='extraStart'?'없음':gradeDepartment==='insurance'?'0':''}">`}
function gradeMonthlyReferenceRows(){return [
 {label:'100건 이하',max:100,hourly:15000,achievement:0,threshold:100,extra:0,example:0},
 {label:'101~110건',max:110,hourly:15000,achievement:0,threshold:100,extra:5000,example:105},
 {label:'111~120건',max:120,hourly:16000,achievement:50000,threshold:110,extra:5000,example:115},
 {label:'121~130건',max:130,hourly:16000,achievement:100000,threshold:120,extra:5000,example:125},
 {label:'131~140건',max:140,hourly:16000,achievement:200000,threshold:130,extra:10000,example:135},
 {label:'141~150건',max:150,hourly:17000,achievement:300000,threshold:140,extra:10000,example:145},
 {label:'151~160건',max:160,hourly:17000,achievement:400000,threshold:150,extra:10000,example:155},
 {label:'161~170건',max:170,hourly:17000,achievement:500000,threshold:160,extra:10000,example:165},
 {label:'171건 이상',max:null,hourly:18000,achievement:600000,threshold:170,extra:10000,example:175}
];}
function gradeSyncMonthlyReference(rows){
 rows.forEach((r,i)=>{const previous=i?rows[i-1].max:0;const min=i===0?0:previous+1;if(r.example<min||(r.max!==null&&r.example>r.max))r.example=r.max===null?min:Math.floor((min+r.max)/2);r.label=i===0?gradeNumber(r.max)+'건 이하':gradeNumber(previous+1)+(r.max===null?'건 이상':'~'+gradeNumber(r.max)+'건');});
}
function gradeEditMonthlyRange(rows,index,key,value){
 if(!Number.isSafeInteger(value)||value<(key==='min'?1:0)||value>99999999)throw Error('실적 구간은 0 이상의 정수로 입력해 주세요.');
 const boundary=key==='min'?index-1:index;
 if(boundary<0||boundary>=rows.length-1)throw Error('수정할 구간을 확인해 주세요.');
 const end=key==='min'?value-1:value;
 if(boundary>0&&end<=rows[boundary-1].max)throw Error('앞 구간보다 큰 건수를 입력해 주세요.');
 if(end+(rows.length-2-boundary)*10>99999999)throw Error('실적 구간의 최대 건수를 초과했습니다.');
 for(let i=boundary;i<rows.length-1;i++)rows[i].max=end+(i-boundary)*10;
 gradeSyncMonthlyReference(rows);
}
function gradeReferenceMonthly(count,hours,policy=null){const row=(policy?.monthlyReference||gradeMonthlyReferenceRows()).find(r=>r.max===null||count<=r.max),extra=Math.max(0,count-row.threshold)*row.extra,base=Math.floor(hours*row.hourly);return {row,hourly:row.hourly,base,achievement:row.achievement,extra,bonus:row.achievement+extra,total:base+row.achievement+extra};}
function gradeOriginalMonthlyTable(policy=null,editable=false,context={}){
 if(liveEmployee&&window.GradeVisibility?.allVisible()===false){const rows=policy?.monthlyReference||gradeMonthlyReferenceRows();gradeSyncMonthlyReference(rows);return table(['실적 구간','시급','목표달성수당','초과 건당 수당'],rows.map(r=>[gradeEscape(r.label),gradeMoney(r.hourly),gradeMoney(r.achievement),gradeMoney(r.extra)]));}
 queueMicrotask(gradeRefreshEstimates);
 const estimateContext={policy:policy||gradePolicy,editable,basis:'full-month',...context};
 const rows=policy?.monthlyReference||gradeMonthlyReferenceRows();gradeSyncMonthlyReference(rows);
 const input=(r,i,key)=>`<input type="text" inputmode="numeric" data-grade-number min="${key==='hourly'?15000:0}" max="100000000" step="1" required data-grade-monthly-reference="${key}" data-grade-reference-index="${i}" aria-label="${gradeEscape(r.label)} ${{hourly:'시급',achievement:'목표달성수당',extra:'초과 건당 수당',max:'실적 구간 종료 건수',min:'실적 구간 시작 건수',example:'월 예상 정상 접수 건수'}[key]}" value="${gradeNumber(key==='min'?rows[i-1].max+1:r[key])}">`;
 const cells=rows.map((r,i)=>{
  const fields=[editable?(i===0?input(r,i,'max')+'건 이하':input(r,i,'min')+(r.max===null?'건 이상':'~'+input(r,i,'max')+'건')):gradeEscape(r.label),editable?input(r,i,'hourly'):gradeMoney(r.hourly),'기본 '+gradeMoney(r.hourly),editable?input(r,i,'achievement'):r.achievement?gradeMoney(r.achievement):'-',editable?(gradeNumber(r.threshold)+'건 초과분 '+input(r,i,'extra')):r.extra?gradeNumber(r.threshold)+'건 초과분 '+gradeMoney(r.extra):'-',(editable?input(r,i,'example'):gradeNumber(r.example))+'건<br><small class="sub" data-estimate-average></small>'];
  return '<tr>'+fields.map(value=>'<td>'+value+'</td>').join('')+['daily','weekly','monthly','total','salary'].map(key=>`<td><span data-estimate-column="${key}">—</span>${['daily','weekly'].includes(key)?'<small class="sub" data-estimate-minimum="'+key+'"></small>':''}${key==='total'?'<small data-estimate-breakdown="base"></small>':key==='salary'?'<small data-estimate-breakdown="advance"></small>':''}</td>`).join('')+'</tr>';
 }).join('');
 return `<div class="grade-estimate-block"><div class="scroll"><table class="grade-table" data-original-monthly data-grade-estimate="${gradeEscape(JSON.stringify(estimateContext))}"><caption data-grade-caption>월 전체 예상액 계산 중</caption><thead><tr><th>실적 구간</th><th>시급</th><th>위촉수수료</th><th>목표달성수당</th><th>실적수당</th><th>예상실적<br>(월 정상 접수)</th><th>일그레이드<br>월 합계</th><th>주그레이드<br>월 합계</th><th>월그레이드<br>합계</th><th>예상 총액</th><th>급여일 예상액</th></tr></thead><tbody>${cells}</tbody></table></div><p class="sub">예상 총액 = 시간근무금액 + 일 + 주 + 월그레이드. 급여일 예상액 = 예상 총액 − 일그레이드 선지급액 (기타 공제 전).</p><details class="grade-calculation-details"><summary>실적별 일·주 계산 내역과 합산식 확인</summary><div data-grade-calculation>계산 중입니다.</div></details><p class="sub">${editable?'이 기준표는 수정 중인 일·주·월 기준을 한 달 전체에 적용한 비교 예시입니다. 예상실적·시급·수당 변경 시 합계를 다시 계산합니다. 예상실적은 월그레이드 저장 시 함께 저장됩니다. 실제 급여는 저장한 적용일을 기준으로 이전·새 기준을 나누어 계산합니다. 실적 구간 변경 시 다음 구간은 10건 단위로 연결됩니다.':context.fixed?'선택한 이전 지급 기준을 한 달 전체에 적용한 비교 예시입니다.':'관리자가 저장한 현재 지급 기준을 한 달 전체에 적용한 예상표입니다. 실제 근무기록·계약시급과 적용일을 반영한 금액은 위 내 합계에서 확인합니다.'} ${gradeNumber(rows[rows.length-2].max+1)}건 이상은 마지막 구간을 계속 적용합니다.</p></div>`;
}
function gradeMinimumComparison(result,policy){
 const perCase=policy.dailyCash?.perCase||0,dailyCount=policy.dailyCash?.start||0,dailyRate=gradeCalculate(policy,'daily',7).bonus,weeklyCount=8,weeklyRate=gradeCalculate(policy,'weekly',8*(policy.weeklyBasis==='average'?5:1),0,5).bonus;
 result.minimumGrade={daily:{applied:false,originalAmount:result.daily,unitAmount:dailyRate,minimumCount:7,days:result.days},weekly:{applied:false,originalAmount:result.weekly,unitAmount:weeklyRate,minimumCount:weeklyCount,weeklyBasis:policy.weeklyBasis,includedDays:0}};
 result.dailyDetails=(result.records||[]).map(r=>{const paidCount=Math.max(0,Math.floor(r.count)-dailyCount+1);return {date:r.date,count:r.count,start:dailyCount,perCase,paidCount,amount:paidCount*perCase};});
 const referenceRows=policy.monthlyReference||gradeMonthlyReferenceRows(),referenceIndex=referenceRows.findIndex(r=>r.max===null||result.count<=r.max);
 if(referenceIndex>=0&&referenceIndex<2){
  result.zeroGradeComparison=true;result.monthlyReferenceIndex=referenceIndex;
  for(const day of result.dailyDetails){day.originalAmount=day.amount;day.amount=0;}
  for(const week of result.weeks||[]){week.originalBonus=week.bonus;week.bonus=0;week.parts=(week.segments||[]).map(part=>({...part,originalBonus:part.bonus,fullBonus:0,bonus:0,achievement:0,extra:0}));week.segments=week.parts;}
  if(typeof result.monthly==='number')result.monthly=0;else{result.monthly={...result.monthly,bonus:0,achievement:0,extra:0,total:result.base,segments:(result.monthly.segments||[]).map(part=>({...part,fullBonus:0,bonus:0,achievement:0,extra:0}))};}
  result.daily=0;result.weekly=0;result.salary=result.base;result.total=result.base;result.calculationAmount=result.count*50000-result.total;return result;
 }
 if(result.daily===0&&dailyRate>0&&result.dailyDetails.length){result.minimumGrade.daily.applied=true;for(const day of result.dailyDetails){day.originalAmount=day.amount;day.floorApplied=true;day.minimumCount=7;day.minimumPaidCount=Math.max(0,7-dailyCount+1);day.amount=dailyRate;}result.daily=result.dailyDetails.reduce((sum,day)=>sum+day.amount,0);}
 if(result.weekly===0&&weeklyRate>0){for(const week of result.weeks||[]){if(!week.included)continue;week.floorApplied=true;week.minimumCount=weeklyCount;week.originalBonus=week.bonus;let raw=0,previous=0;week.parts=(week.segments||[]).map(part=>{raw+=weeklyRate*part.days/5;const rounded=Math.round(raw),bonus=rounded-previous;previous=rounded;return {...part,floorApplied:true,minimumCount:weeklyCount,originalBonus:part.bonus,fullBonus:weeklyRate,bonus};});week.bonus=previous;result.minimumGrade.weekly.includedDays+=week.availableDays||0;}result.weekly=(result.weeks||[]).filter(w=>w.included).reduce((sum,w)=>sum+w.bonus,0);result.minimumGrade.weekly.applied=result.weekly>0;}
 result.salary=result.base+(typeof result.monthly==='number'?result.monthly:result.monthly.bonus)+result.weekly;result.total=result.salary+result.daily;result.calculationAmount=result.count*50000-result.total;return result;
}
function gradeEstimateDetails(data){
 return data.rows.map(result=>{
  const grouped=new Map();
  for(const day of result.dailyDetails||[]){const key=[day.count,day.start,day.perCase,day.amount,!!day.floorApplied].join(':');const group=grouped.get(key)||{...day,days:0,total:0};group.days++;group.total+=day.amount;grouped.set(key,group);}
  const daily=[...grouped.values()].sort((a,b)=>a.count-b.count).map(g=>[gradeNumber(g.count)+'건 × '+g.days+'일',result.zeroGradeComparison?'해당 실적 구간 · 일그레이드 0원':g.floorApplied?gradeNumber(g.minimumCount)+'건 기준 누적 '+gradeNumber(g.minimumPaidCount)+'건 × '+gradeMoney(g.perCase)+' = '+gradeMoney(g.amount):gradeNumber(g.start)+'건째부터 '+gradeNumber(g.paidCount)+'건 × '+gradeMoney(g.perCase),gradeMoney(g.amount)+' × '+g.days+'일 = '+gradeMoney(g.total)]);
  const weekly=(result.weeks||[]).map(w=>[gradeEscape(w.start+' ~ '+w.end),gradeNumber(w.count)+'건 ÷ '+(w.days??w.availableDays)+'일 = '+gradeNumber(Number(w.average.toFixed(2)))+'건',result.zeroGradeComparison?'해당 실적 구간 · 주그레이드 0원':(w.parts||[]).map(part=>(part.floorApplied?gradeNumber(part.minimumCount)+'건 기준 ':'')+gradeMoney(part.fullBonus)+' × '+part.days+'/5').join(' + '),gradeMoney(w.bonus),w.included?'이번 달 합산':w.payrollMonth!==data.month?gradeEscape(w.payrollMonth)+' 합산':'집계 전 · 제외']);
  const monthly=typeof result.monthly==='number'?result.monthly:result.monthly?.bonus||0;
  return `<details><summary>월 ${gradeNumber(result.count)}건 · 일 ${gradeMoney(result.daily)} / 주 ${gradeMoney(result.weekly)} / 월 ${gradeMoney(monthly)}</summary>${daily.length?table(['하루 정상 접수 · 일수','하루 일그레이드 계산','월 누적 금액'],daily):''}${weekly.length?table(['월~금 기간','주 정상 접수 ÷ 영업일','해당 구간 × 지급 비율','주 수당','합산 대상'],weekly):''}<p>예상 총액: 시간근무금액 ${gradeMoney(result.base)} + 일 ${gradeMoney(result.daily)} + 주 ${gradeMoney(result.weekly)} + 월 ${gradeMoney(monthly)} = <strong>${gradeMoney(result.total)}</strong><br>급여일 예상액: ${gradeMoney(result.total)} − 일그레이드 선지급 ${gradeMoney(result.daily)} = <strong>${gradeMoney(result.salary)}</strong></p></details>`;
 }).join('');
}

let gradeEstimateTimer;
let gradePersonalData=null,gradePersonalBusy=false,gradePersonalError='',gradePersonalReadAt=0;
function gradePersonalTotalsContent(){
 if(!gradePersonalData)return '<p class="sub">'+gradeEscape(gradePersonalError||'본인 실적과 그레이드 합계를 불러오는 중입니다.')+'</p>';
 const d=gradePersonalData;
 if(window.GradeVisibility?.allVisible()===false){
  const periods=[['daily','일그레이드',d.daily],['weekly','주그레이드 · 진행 주 포함',d.weeklyAccrued],['monthly','월그레이드',d.monthly]].filter(([period])=>gradePeriodVisible(period));
  return `<div class="grade-actual-totals">${periods.map(([,label,value])=>`<div><span>${label}</span><strong>${gradeMoney(value)}</strong></div>`).join('')}</div><p class="sub">${gradeEscape(d.month)} · ${gradeEscape(d.asOf)} 기준 · 공개된 그레이드 항목입니다.</p>`+
   (gradePeriodVisible('daily')?`<details><summary>일그레이드 날짜별 계산</summary>${table(['날짜','정상 접수','금액'],(d.dailyDetails||[]).map(day=>[gradeEscape(day.date),gradeNumber(day.count)+'건',gradeMoney(day.amount)]))}</details>`:'')+
   (gradePeriodVisible('weekly')?`<details><summary>주그레이드 계산</summary>${table(['기간','정상 접수','금액'],(d.weeklyDetails||[]).map(week=>[gradeEscape(week.start+' ~ '+week.end),gradeNumber(week.count)+'건',gradeMoney(week.bonus)]))}</details>`:'');
 }
 const dailyRows=(d.dailyDetails||[]).map(day=>[gradeEscape(day.date),gradeNumber(day.count)+'건',`${day.start}건째부터 ${day.paidCount}건 × ${gradeMoney(day.perCase)}`,gradeMoney(day.amount),gradeEscape(day.effective)]);
 const weeklyRows=(d.weeklyDetails||[]).map(week=>[gradeEscape(week.start+' ~ '+week.end),`${gradeNumber(week.count)}건 ÷ ${week.days}일 = ${gradeNumber(Number(week.average.toFixed(2)))}건`,gradeMoney(week.bonus),week.included?'이번 달 합산':week.payrollMonth!==d.month?gradeEscape(week.payrollMonth)+' 귀속 · 이번 달 제외':'집계 진행 중 · 합계 제외']);
 return `<div class="grade-actual-totals">${[['일그레이드',d.daily],['주그레이드 · 진행 주 포함',d.weeklyAccrued],['월그레이드',d.monthly],['그레이드 합계',d.gradeTotal]].map(([label,value])=>`<div><span>${label}</span><strong>${gradeMoney(value)}</strong></div>`).join('')}</div><p class="sub">현재까지의 정상 실적과 날짜별 적용 기준으로 계산합니다. 진행 중인 주의 금액은 실적에 따라 바뀌며, 아래 급여 예상액에는 집계가 끝난 주만 합산합니다.</p><p class="sub">${gradeEscape(d.month)} · ${gradeEscape(d.asOf)} 기준 · 정상 ${gradeNumber(d.count)}건 · 기록된 근무 ${gradeNumber(d.hours)}시간 · ${d.payType==='월급제'?'계약 월급 '+gradeMoney(d.contractRate):'적용 시급 '+(d.rate===null?'기간별 적용':gradeMoney(d.rate))}</p><div class="scroll"><table class="grade-table"><thead><tr><th>시간근무금액</th><th>일그레이드 합계</th><th>주그레이드 합계</th><th>월그레이드 합계</th><th>예상 총액</th><th>급여일 예상액</th></tr></thead><tbody><tr>${['workPay','daily','weekly','monthly','total','payday'].map(key=>`<td><strong>${gradeMoney(d[key])}</strong></td>`).join('')}</tr></tbody></table></div><p class="sub">예상 총액 = 시간근무금액 + 일 + 주 + 월그레이드. 급여일 예상액 = 시간근무금액 + 주 + 월그레이드 (기타 정산·공제 전).</p><p class="sub">일그레이드 합계는 버튼과 별개로 날짜별 달성액을 모두 더한 금액입니다. 자동 수령·선지급액 ${gradeMoney(d.dailyPaid)}. 버튼을 누르지 않아도 전액 선지급 처리하여 급여일에 같은 금액을 차감합니다.</p>`+
 (d.payType!=='월급제'&&d.workDetails?.length?`<details><summary>시간근무금액 계산 근거</summary>${table(['적용 기간','근무시간','적용 시급','계산 금액'],d.workDetails.map(p=>[gradeEscape(p.start+' ~ '+p.end),gradeNumber(p.hours)+'시간',gradeMoney(p.hourly),gradeMoney(p.hours*p.hourly)]))}<p class="sub">기간별 적용 시급 × 실제 근무시간을 합산하고 원 미만은 월 합계에서 한 번 버립니다. 등록 기본시급을 보장합니다.</p></details>`:'')+
 (dailyRows.length?`<details><summary>일그레이드 날짜별 계산 · 합계 ${gradeMoney(d.daily)}</summary>${table(['날짜','정상 접수','누적 계산','달성액','기준 적용일'],dailyRows)}</details>`:'')+
 (weeklyRows.length?`<details><summary>주그레이드 월~금 5일 계산 · 마감 주 합계 ${gradeMoney(d.weekly)}</summary>${table(['월~금 기간','정상 합계 ÷ 근무가능일','해당 구간 지급대상액','이번 달 반영'],weeklyRows)}<p class="sub">주별 단일 구간 금액을 적용일수/5로 계산합니다. 주그레이드 합계에는 집계가 끝난 주만 포함하며, 월말을 넘긴 주는 금요일이 속한 달에 한 번 합산합니다.</p></details>`:'');
}
function gradePersonalTotalsPanel(){queueMicrotask(gradeLoadPersonalTotals);return '<section class="panel"><h3>이번 달 내 그레이드 합계 · 실제 기록</h3><div data-personal-grade-totals>'+gradePersonalTotalsContent()+'</div></section>';}
async function gradeLoadPersonalTotals(){
 if(gradePersonalBusy||Date.now()-gradePersonalReadAt<4000||!root.querySelector('[data-personal-grade-totals]'))return;
 gradePersonalBusy=true;gradePersonalReadAt=Date.now();
 try{const response=await fetch('/grade-personal-totals.php?role=employee',{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'합계를 불러오지 못했습니다.');gradePersonalData=data;gradePersonalError='';}
 catch(error){gradePersonalData=null;gradePersonalError=error.message;}
 finally{gradePersonalBusy=false;root.querySelectorAll('[data-personal-grade-totals]').forEach(el=>el.innerHTML=gradePersonalTotalsContent());}
}
window.addEventListener('cnc:grade-summary-updated',gradeLoadPersonalTotals);
function gradeInvalidateEstimates(){
 for(const table of root.querySelectorAll('[data-grade-estimate]')){
  if(!JSON.parse(table.dataset.gradeEstimate).editable)continue;
  delete table.dataset.estimateKey;table.setAttribute('aria-busy','true');
  table.querySelector('[data-grade-caption]').textContent='입력한 실적·기준으로 다시 계산 중';
  table.querySelectorAll('[data-estimate-column],[data-estimate-average],[data-estimate-breakdown]').forEach(el=>{el.textContent='—';el.title='';});
  table.closest('.grade-estimate-block').querySelector('[data-grade-calculation]').textContent='입력한 기준으로 다시 계산 중입니다.';
 }
}
async function gradeRefreshEstimates(){
 for(const table of root.querySelectorAll('[data-grade-estimate]')){
  const context=JSON.parse(table.dataset.gradeEstimate),policy=context.editable?gradeDraft:context.policy;
  const date=context.editable?gradeEffectiveDate:(context.date||gradeToday()),month=context.month||date.slice(0,7),department=context.department||(context.editable?gradeDepartment:gradeEmployeeDepartment());
  const exampleRows=policy.monthlyReference||gradeMonthlyReferenceRows();gradeSyncMonthlyReference(exampleRows);
  table.querySelectorAll('[data-grade-monthly-reference="example"]').forEach((el,i)=>el.value=gradeNumber(exampleRows[i].example));
  const counts=exampleRows.map(r=>r.example),body={policy,counts,month,department,date,basis:context.basis||'effective',preview:!!context.preview,fixed:!!context.fixed,historyId:context.historyId===undefined?undefined:Number(context.historyId)};
  const key=JSON.stringify(body);if(table.dataset.estimateKey===key)continue;table.dataset.estimateKey=key;
  const caption=table.querySelector('[data-grade-caption]');caption.textContent='예상액 계산 중';table.setAttribute('aria-busy','true');
  table.querySelectorAll('[data-estimate-column],[data-estimate-breakdown]').forEach(el=>{el.textContent='—';el.title='';});
  table.querySelectorAll('[data-estimate-minimum]').forEach(el=>el.textContent='');
  const calculation=table.closest('.grade-estimate-block').querySelector('[data-grade-calculation]');calculation.textContent='계산 중입니다.';
  try{
   const error=gradeValidate(policy);if(error)throw Error(error);
   if(!gradeValidDate(date))throw Error('올바른 적용 시작일을 선택해 주세요.');
   let data;if(window.CNCHOME_LIVE){const response=await fetch('/grade-estimates.php?role='+encodeURIComponent(window.CNCHOME_LIVE.user.role),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':window.CNCHOME_LIVE.csrf},body:key});data=await response.json();if(!response.ok)throw Error(data.error||'계산할 수 없습니다.');}
   else{const days=GradeCalendar.workdays(month).length;data={month,days,hours:days*6,rows:counts.map(count=>gradeMinimumComparison(gradeAggregateCalculate(policy,department,count,days,6,{month,entries:[]}),policy))};}
   if(!table.isConnected||table.dataset.estimateKey!==key)continue;
   if(data.policy&&window.CNCHOME_LIVE?.user.role==='employee'&&JSON.stringify(policy)!==JSON.stringify(data.policy)){
    table.closest('.grade-estimate-block').outerHTML=gradeOriginalMonthlyTable(data.policy,false,{...context,policy:data.policy});continue;
   }
   table.querySelectorAll('tbody tr').forEach((row,i)=>{
    const result=data.rows[i];row.querySelectorAll('[data-estimate-column]').forEach(cell=>{const value=result[cell.dataset.estimateColumn];cell.textContent=gradeMoney(typeof value==='number'?value:value?.bonus||0);});
    row.querySelectorAll('[data-estimate-minimum]').forEach(el=>{const minimum=result.minimumGrade?.[el.dataset.estimateMinimum];el.textContent=minimum?.applied?gradeNumber(minimum.minimumCount)+'건 '+(el.dataset.estimateMinimum==='daily'?'누적 기준 적용':'기준 적용'):'';el.title=minimum?.applied?'기준 지급액 '+gradeMoney(minimum.unitAmount)+'을 근무일·주별 지급 비율로 계산':'';});
    const average=row.querySelector('[data-estimate-average]');if(average)average.textContent='일평균 '+gradeNumber(data.days?Number((counts[i]/data.days).toFixed(2)):0)+'건';
    const total=row.querySelector('[data-estimate-column="total"]'),salary=row.querySelector('[data-estimate-column="salary"]');
    if(typeof result.base==='number'){const monthly=typeof result.monthly==='number'?result.monthly:result.monthly?.bonus;total.title='시간근무금액 '+gradeMoney(result.base)+' + 일 '+gradeMoney(result.daily)+' + 주 '+gradeMoney(result.weekly)+' + 월 '+gradeMoney(monthly);}
    salary.title='예상 총액 '+gradeMoney(result.total)+' − 일그레이드 선지급 '+gradeMoney(result.daily)+' = '+gradeMoney(result.salary);
    row.querySelector('[data-estimate-breakdown="base"]').textContent='시간근무 '+gradeMoney(result.base)+' ('+gradeNumber(data.days)+'일 × '+gradeMoney(result.hours?result.base/result.hours:0)+')';
    row.querySelector('[data-estimate-breakdown="advance"]').textContent='일 선지급 −'+gradeMoney(result.daily);
   });
   caption.textContent=`${data.month} · 영업일 ${data.days}일 × 하루 6시간 = ${data.hours}시간 · ${body.fixed?'선택한 이전 기준 · 월 전체 비교':body.basis==='full-month'?(context.editable?'수정 중 기준 · 월 전체 비교 (실제 급여는 적용일별 계산)':(data.effectiveDate?data.effectiveDate+' 적용 기준':'현재 적용 기준')+' · 월 전체 비교 (실제 급여는 위 내 합계 확인)'):body.preview?date+' 적용일별 미리보기':'저장된 적용일별 기준'}`;
   calculation.innerHTML=gradeEstimateDetails(data);
   table.setAttribute('aria-busy','false');
  }catch(error){if(table.dataset.estimateKey===key){caption.textContent=error.message;calculation.textContent=error.message;table.setAttribute('aria-busy','false');delete table.dataset.estimateKey;}}
 }
}

function gradeEscape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
let dailyCashOffset=0;
function gradeDailyCashTable(policy,personal=null,date=''){
 const c=policy.dailyCash||{start:6,perCase:5000};
 if(!Number.isSafeInteger(c.start)||c.start<1||!Number.isSafeInteger(c.perCase)||c.perCase<0)return '<p class="sub">시작 건수와 건당 지급액을 입력해 주세요.</p>';
 if(personal)dailyCashOffset=Math.min(dailyCashOffset,Math.max(0,Math.floor((personal.count-c.start)/20)*20));
 const offset=personal?dailyCashOffset:0,steps=Array.from({length:20},(_,i)=>c.start+offset+i);
 return `<div class="grade-week-track" tabindex="0" role="region" aria-label="일 그레이드 건별 지급액"><table data-daily-horizontal><thead><tr>${steps.map(n=>`<th>${gradeNumber(n)}건</th>`).join('')}</tr></thead><tbody><tr>${steps.map(n=>`<td>${personal&&n<=personal.count&&c.perCase>0?`<strong aria-label="자동 수령 처리 · ${gradeMoney(c.perCase)}">_원</strong><br><button type="button" class="secondary" disabled title="달성액은 버튼 확인 없이 자동 선지급 처리됩니다.">수령 완료</button>`:`<strong>${gradeMoney(c.perCase)}</strong>`}</td>`).join('')}</tr></tbody></table></div>${personal?`<div class="row"><button type="button" class="secondary" data-daily-shift="-20" ${offset===0?'disabled':''}>이전</button><button type="button" class="secondary" data-daily-shift="20" ${c.start+offset+20>personal.count?'disabled':''}>다음</button></div>`:''}`;
}
root.addEventListener('click',e=>{
 const shift=e.target.closest('[data-daily-shift]');if(!shift)return;
 dailyCashOffset=Math.max(0,dailyCashOffset+Number(shift.dataset.dailyShift));const target=root.querySelector('#tm-personal-daily');if(target)target.innerHTML=personalDailyContent();
});

const gradePeriodFields={daily:['daily','dailyCash'],weekly:['weekly','weeklyBasis','weeklyAuto','weeklyDraftVersion','weeklyStartEightVersion'],monthly:['monthly','monthlyReference','monthlyManualVersion']};
const gradePeriodLabels={daily:'일그레이드',weekly:'주그레이드',monthly:'월그레이드'};
function gradePeriodValues(policy,period){return Object.fromEntries(gradePeriodFields[period].filter(key=>Object.hasOwn(policy,key)).map(key=>[key,structuredClone(policy[key])]));}
function gradeMergePeriod(base,changes,period){const merged=structuredClone(base);for(const key of gradePeriodFields[period])delete merged[key];return Object.assign(merged,gradePeriodValues(changes,period));}
function gradeEditorTable(period){return `<div data-grade-section="${period}">${gradeEditorContent(period)}<div class="grade-save-bar"><span data-grade-apply-date>적용 시작일 ${gradeEscape(gradeEffectiveDate)}</span><span data-grade-period-status="${period}" role="status">${gradeEscape(gradeSavedStatus[period]||(gradeDepartment!=='insurance'&&!gradeConfiguredPeriods().has(period)?'기준 미등록 · 입력 후 저장해 주세요.':'변경 후 저장하면 DB에 반영됩니다.'))}</span><button type="button" class="action" data-grade-save-period="${period}" ${gradeServerSaving?'disabled':''}>${gradePeriodLabels[period]} 저장</button></div></div>`;}
function gradeSavePeriod(period){
 if(gradeServerSaving||!Object.hasOwn(gradePeriodFields,period))return;
 const target=root.querySelector('#tm-grade-error');target.textContent='';
 if(!gradeValidDate(gradeEffectiveDate)){target.textContent='올바른 적용 시작일을 선택해 주세요.';return;}
 if(period==='monthly'&&gradeDepartment==='insurance'&&!gradeDraft.monthlyReference)gradeDraft.monthlyReference=gradeMonthlyReferenceRows();
 const candidate=gradeMergePeriod(gradePolicyAt(gradeEntries,gradeEffectiveDate,gradeDepartment),gradeDraft,period),error=gradeValidate(candidate);
 if(error){target.textContent=error;return;}
 gradePending={department:gradeDepartment,date:gradeEffectiveDate,period,policy:candidate,inline:true};
 gradeCommit();
}
function gradeSampleEstimatesPanel(){queueMicrotask(gradeLoadSampleEstimates);return '<section class="panel"><h3>하루 정상 접수 10~15건 · 예상 지급 기준표</h3><div data-grade-samples><p class="sub">월 전체 일·주·월그레이드를 계산하는 중입니다.</p></div></section>';}
async function gradeLoadSampleEstimates(){
 const target=root.querySelector('[data-grade-samples]');if(!target||!window.CNCHOME_LIVE)return;
 const body={department:gradeDepartment,month:gradeEffectiveDate.slice(0,7),date:gradeEffectiveDate,policy:gradeDraft,basis:'full-month',dailySamples:true},key=JSON.stringify(body);if(target.dataset.sampleKey===key)return;target.dataset.sampleKey=key;target.textContent='월 전체 예시를 다시 계산 중입니다.';
 try{
  const response=await fetch('/grade-estimates.php?role=admin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':window.CNCHOME_LIVE.csrf},body:key});const data=await response.json();if(!response.ok)throw Error(data.error||'예시를 계산하지 못했습니다.');
  if(!target.isConnected||target.dataset.sampleKey!==key)return;
  target.innerHTML=`<p class="sub">${gradeEscape(data.month)} · 저장된 영업일 ${data.days}일에 하루 10~15건씩 정상 접수하는 예시입니다. 주그레이드는 월~금 중 영업일을 기준으로 계산하며 지급 비율의 기준은 5일입니다. 수정 중인 일·주·월 기준을 한 달 전체에 적용한 비교 예시이며, 실제 급여는 저장한 적용일별로 계산합니다.</p>`+table(['하루 정상 접수','월 정상 접수','일그레이드 합계','주그레이드 합계','월그레이드','그레이드 총액','급여일 그레이드'],data.samples.map(r=>[r.perDay+'건',r.count+'건',...['daily','weekly','monthly','gradeTotal','paydayGrade'].map(k=>gradeMoney(r[k]))]))+'<p class="sub">위 표는 그레이드 수당 합계입니다. 시간근무금액은 별도이며, 일그레이드 전액을 선지급으로 차감해 급여일에는 주·월그레이드만 합산합니다.</p>';
 }catch(error){if(target.isConnected&&target.dataset.sampleKey===key){target.textContent=error.message;delete target.dataset.sampleKey;}}
}
function gradeEditorContent(period){if(period==='monthly'&&gradeDepartment==='insurance')return panel('월그레이드 기준표 · 일반직원',gradeOriginalMonthlyTable(gradeDraft,true));if(period==='weekly'&&gradeDepartment==='insurance')return `<section class="panel grade-editor"><h2>주그레이드(해당 주 평균 목표개수) · ${gradeExclusive(gradeDraft,'weekly')?'일평균 정상 실적':'주 정상 실적 합계'} 기준</h2><p class="sub">시작값을 바꾸면 20칸의 건수와 금액을 자동으로 채웁니다. 달성한 가장 높은 기준의 금액을 한 번 지급합니다. 변경 내용 확인 후 저장하면 적용됩니다.</p>${gradeWeeklyTable(gradeDraft,true)}<p class="sub">월~금 한 주에 한 번 계산합니다. 월말에 걸친 주는 다음 달 주그레이드로 이어져 해당 달 급여에 합산됩니다. 일그레이드는 명세서에 표시하고 달성액 전액을 자동 수령·선지급으로 차감합니다.</p></section>`;if(period==='daily'){const c=gradeDraft.dailyCash;return `<section class="panel grade-editor"><h2>일그레이드 · 별도 현금 관리</h2><p class="notice">직원 본인의 당일 정상 실적을 기준으로 개인별 지급합니다. 시작 건부터 건당 지급하며 상한은 없습니다. 명세서에 일그레이드 발생액을 표시하고 버튼 확인 없이 전액 수령·선지급으로 처리하여 같은 금액을 차감합니다. 주·월그레이드는 함께 지급합니다.</p><div class="grade-auto-controls"><label>시작 건수<input type="text" inputmode="numeric" data-grade-number min="1" max="100000000" step="1" required data-grade-dailycash="start" aria-label="일 그레이드 지급 시작 건수" value="${gradeNumber(c.start)}"></label><label>건당 지급액 (원)<input type="text" inputmode="numeric" data-grade-number min="0" max="100000000" step="1" required data-grade-dailycash="perCase" aria-label="일 그레이드 건당 지급액" value="${gradeNumber(c.perCase)}"></label></div><p class="sub">건수는 1씩 증가 · 시작 건수를 포함하여 건당 지급액을 계산합니다.</p><div id="tm-grade-daily-table">${gradeDailyCashTable(gradeDraft)}</div></section>`;}return `<section class="panel grade-editor"><div class="row"><h2>${gradePeriods[period]}</h2><button type="button" class="secondary" data-grade-add="${period}"><span class="ui-icon ui-icon-plus" aria-hidden="true"></span> 구간 추가</button></div>${period==='daily'?'<p class="notice">TM 전용 별도 지급입니다. 달성수당을 설정해 주세요. 시급·건당 추가수당은 일 그레이드에 적용하지 않습니다.</p>':''}${period==='weekly'?`<label class="grade-basis">실적 기준 <select id="tm-grade-week-basis" required>${!gradeDraft.weeklyBasis?'<option value="" selected disabled>실적 기준 선택</option>':''}<option value="average" ${gradeDraft.weeklyBasis==='average'?'selected':''}>정상실적 ÷ 주 근무가능일 (일평균)</option><option value="total" ${gradeDraft.weeklyBasis==='total'?'selected':''}>주 정상실적 합계</option></select></label>`:''}<div class="scroll"><table class="grade-edit-table"><caption>${gradePeriods[period]} 수정 가능한 지급 기준표</caption><thead><tr><th>시작 건수<br>(이상)</th><th>종료 건수<br>(${gradeExclusive(gradeDraft,period)?'미만':'이하'})</th><th>시급<br>(원/시간)</th><th>달성 수당<br>(원)</th><th>추가수당<br>시작 건수</th><th>건당 추가수당<br>(원/건)</th><th>구간 관리</th></tr></thead><tbody>${gradeDraft[period].map((r,i)=>`<tr>${['min','max','hourly','achievement','extraStart','extra'].map(k=>`<td>${gradeInput(period,i,k,r[k])}</td>`).join('')}<td><button type="button" class="secondary" data-grade-remove="${period}" data-grade-row="${i}" ${gradeDraft[period].length===1?'disabled':''} aria-label="${gradePeriods[period]} ${i+1}행 삭제">삭제</button></td></tr>`).join('')}</tbody></table></div><p class="sub">마지막 종료 건수를 비우면 ‘이상’ 구간입니다. 시급 0원은 미적용, 추가수당 0원은 지급 없음입니다.${gradeExclusive(gradeDraft,period)?' 주간 추가수당은 일평균의 정수 건수를 기준으로 계산합니다.':''}</p></section>`}
function gradeCalendarEvaluate(policy,department,period,count,hours,days){return period==='monthly'&&department==='insurance'?gradeReferenceMonthly(count,hours,policy):gradeCalculate(policy,period,count,hours,days);}
function gradeCalendarSignature(policy,department,period){return JSON.stringify(period==='daily'?policy.dailyCash:period==='weekly'?[policy.weeklyBasis,policy.weekly]:department==='insurance'?(policy.monthlyReference||gradeMonthlyReferenceRows()):policy.monthly);}
function gradeAggregateCalculate(policy,department,count,days,hoursPerDay,options={}){
 const error=gradeValidate(policy);if(error)throw Error(error);
 const month=options.month||'2026-09',records=options.records||GradeCalendar.distribute(month,count,days,hoursPerDay);
 return GradeCalendar.calculate({month,records,entries:options.entries||[],defaults:policy,department,role:options.role||'general',evaluate:(p,period,n,h,d)=>gradeCalendarEvaluate(p,department,period,n,h,d),signature:(p,period)=>gradeCalendarSignature(p,department,period)});
}
let gradePreviewApp=null;
function gradeCalendarApp(){return gradePreviewApp||(gradePreviewApp=GradeCalendarPreview.create({root,storage:localStorage,department:()=>gradeDepartment,policy:()=>gradeDraft,entries:()=>gradeEntries,effectiveDate:()=>gradeEffectiveDate,defaults:()=>gradeDepartment==='insurance'?gradePrepareDraft(gradeDefaults()):gradeEmptyPolicy(),validate:gradeValidate,evaluate:(p,period,n,h,d)=>gradeCalendarEvaluate(p,gradeDepartment,period,n,h,d),signature:(p,period)=>gradeCalendarSignature(p,gradeDepartment,period),money:gradeMoney,escape:gradeEscape,table:(headers,rows)=>table(headers,rows)}));}
function gradePreviewHtml(){return gradeCalendarApp().html();}
function gradeUpdatePreview(calculate=false){gradeCalendarApp().update(calculate);}
root.addEventListener('submit',event=>{if(event.target.id==='tm-grade-preview-form'){event.preventDefault();gradeUpdatePreview(true);}});
function gradeSetDirty(period){gradeDirty=true;if(period){gradeDirtyPeriods.add(period);gradeSavedStatus[period]='수정 중 · 아직 저장하지 않았습니다.';const status=root.querySelector('[data-grade-period-status="'+period+'"]');if(status)status.textContent=gradeSavedStatus[period];}const el=root.querySelector('#tm-grade-save-status');if(el)el.textContent='수정 중 · 아직 저장하지 않았습니다.';gradeInvalidateEstimates();if(!window.CNCHOME_LIVE)gradeUpdatePreview();clearTimeout(gradeEstimateTimer);gradeEstimateTimer=setTimeout(()=>{gradeRefreshEstimates();gradeLoadSampleEstimates()},300)}
function adminGrade(){return `<div class="row"><div><h2>${gradeDepartments[gradeDepartment]} 그레이드 관리 · 일반직원</h2><p class="sub">일반직원 개인별 지급 기준입니다. 주그레이드는 본인 정상 실적이 기준을 충족한 직원에게만 지급하며 미달자는 0원입니다. 주·월 그레이드는 개인 급여에 합산하며, 팀장은 별도 서식으로 설정합니다.</p></div><span class="pill">관리자 전용</span></div><p class="sub">${gradeDepartments[gradeDepartment]} 기준만 수정·저장합니다. 다른 탭의 수정 중 내용은 탭을 이동해도 유지되며, 저장하지 않고 새로고침하면 사라집니다. 보험팀의 기존 기준은 보험팀에만 적용합니다. 화장품팀·건강보조식품팀은 별도 입력한 기준을 저장한 뒤 해당 직원에게 공개됩니다.</p><div class="notice">일반직원 1명·선택 부서의 날짜별 계산 예시입니다. 저장한 기준과 입력 예시는 현재 브라우저에 보관됩니다. 부서 이동·공제 등 추가 검토는 <a href="./payroll.php">급여 계산 검토</a>에서 확인하세요. 저장한 적용일과 기준은 직원 그레이드·급여 재산정에 반영됩니다.</div>${window.GradeVisibility?.editor(gradeDepartment)||''}<form id="tm-grade-form"><div class="grade-save-bar"><label>적용 시작일 <input id="tm-grade-effective-date" type="date" min="2000-01-01" max="2099-12-31" required value="${gradeEffectiveDate}"></label><span id="tm-grade-save-status" role="status">${gradeDirty?'수정 중 · 아직 저장하지 않았습니다.':gradeStorageMessage||'저장된 기준'}</span><button type="button" class="secondary" data-grade-cancel>수정 취소</button><button class="secondary" type="submit">전체 변경 내용 확인</button></div><p id="tm-grade-error" role="alert"></p>${window.CNCHOME_LIVE&&gradeDepartment==='insurance'?gradeSampleEstimatesPanel():''}${Object.keys(gradePeriods).map(gradeEditorTable).join('')}</form>${window.CNCHOME_LIVE?'':gradePreviewHtml()}${gradeHistoryHtml()}`}
root.addEventListener('input',event=>{const el=event.target;if(el.dataset.gradeMonthlyReference){if(['min','max'].includes(el.dataset.gradeMonthlyReference)){gradeSetDirty('monthly');return;}if(!gradeDraft.monthlyReference)gradeDraft.monthlyReference=gradeMonthlyReferenceRows();gradeDraft.monthlyReference[Number(el.dataset.gradeReferenceIndex)][el.dataset.gradeMonthlyReference]=el.value===''?NaN:GradeNumbers.parse(el.value);gradeSetDirty('monthly')}else if(el.dataset.gradeDailycash){gradeDraft.dailyCash[el.dataset.gradeDailycash]=el.value===''?NaN:GradeNumbers.parse(el.value);const view=root.querySelector('#tm-grade-daily-table');if(view)view.innerHTML=gradeDailyCashTable(gradeDraft);gradeSetDirty('daily')}else if(el.dataset.gradeField){const field=el.dataset.gradeField;gradeDraft[el.dataset.gradePeriod][Number(el.dataset.gradeIndex)][field]=el.value===''?(['max','extraStart'].includes(field)?null:NaN):GradeNumbers.parse(el.value);gradeSetDirty(el.dataset.gradePeriod)}});
root.addEventListener('change',event=>{const el=event.target;if(['min','max'].includes(el.dataset.gradeMonthlyReference)){try{const next=structuredClone(gradeDraft);if(!next.monthlyReference)next.monthlyReference=gradeMonthlyReferenceRows();gradeEditMonthlyRange(next.monthlyReference,Number(el.dataset.gradeReferenceIndex),el.dataset.gradeMonthlyReference,GradeNumbers.parse(el.value));const error=gradeValidate(gradeMergePeriod(gradePolicyAt(gradeEntries,gradeEffectiveDate,gradeDepartment),next,'monthly'));if(error)throw Error(error);el.setCustomValidity('');gradeDraft=next;gradeSetDirty('monthly');render();}catch(error){el.setCustomValidity(error.message);root.querySelector('#tm-grade-error').textContent=error.message;}return;}if(el.dataset.gradeAuto){const kind=el.dataset.gradeAuto,key=el.dataset.autoKey,value=el.value===''?NaN:GradeNumbers.parse(el.value);try{const next=structuredClone(gradeDraft);if(kind==='weekly'){next.weeklyAuto[key]=value;const a=next.weeklyAuto;next.weekly=gradeGenerateWeekly(a.start,a.amount,a.step);next.weeklyBasis='average';}const error=gradeValidate(gradeMergePeriod(gradePolicyAt(gradeEntries,gradeEffectiveDate,gradeDepartment),next,kind));if(error)throw Error(error);el.setCustomValidity('');gradeDraft=next;gradeSetDirty(kind);render();}catch(error){el.setCustomValidity(error.message);root.querySelector('#tm-grade-error').textContent=error.message;}return;}if(el.id==='tm-grade-effective-date'){gradeEffectiveDate=el.value;root.querySelectorAll('[data-grade-apply-date]').forEach(node=>node.textContent='적용 시작일 '+gradeEffectiveDate);gradeSetDirty()}else if(el.id==='tm-grade-week-basis'){gradeDraft.weeklyBasis=el.value;gradeDraft.weekly.forEach((r,i)=>{if(i<gradeDraft.weekly.length-1)r.max=gradeDraft.weekly[i+1].min-(el.value==='average'?0:1)});gradeSetDirty('weekly');render()}else if(el.id==='tm-grade-preview-period'){gradeUpdatePreview()}});
root.addEventListener('click',event=>{
 const history=event.target.closest('[data-grade-history-view]');
 if(history&&!event.target.closest('[data-grade-load]')){gradeShowHistory(Number(history.dataset.gradeHistoryView)-1);return;}
 const b=event.target.closest('button');if(!b)return;
 if(gradeServerSaving&&(b.dataset.gradeDepartment||b.dataset.gradeLoad||b.hasAttribute('data-grade-cancel')))return;
 if(b.dataset.gradeSavePeriod){gradeSavePeriod(b.dataset.gradeSavePeriod);return;}
 if(b.dataset.gradeDepartment){const next=b.dataset.gradeDepartment;if(!Object.hasOwn(gradeDepartments,next)||next===gradeDepartment)return;gradeDraftCache[gradeDepartment]={draft:structuredClone(gradeDraft),dirty:gradeDirty,dirtyPeriods:[...gradeDirtyPeriods],savedStatus:{...gradeSavedStatus},date:gradeEffectiveDate};gradeDepartment=next;if(window.CNCPageNavigation?.setDepartment)window.CNCPageNavigation.setDepartment(next);else{const departmentUrl=new URL(location.href);departmentUrl.searchParams.set('department',next);window.history.replaceState(window.history.state,'',departmentUrl);}window.PolicySync?.load();const saved=gradeDraftCache[next];gradeDraft=saved?structuredClone(saved.draft):gradePrepareDraft(gradePolicyAt(gradeEntries,gradeToday(),next));gradeDirty=saved?.dirty||false;gradeDirtyPeriods=new Set(saved?.dirtyPeriods||[]);gradeSavedStatus=saved?.savedStatus||{};gradeEffectiveDate=saved?.date||gradeToday();gradeStorageMessage='';gradeHistoryPages={};render();return;}
 if(b.hasAttribute('data-grade-history-page')){const department=b.dataset.gradeHistoryDepartment||gradeDepartment;gradeHistoryPages[department]=Math.max(1,(gradeHistoryPages[department]||1)+Number(b.dataset.gradeHistoryPage));const history=root.querySelector('#tm-grade-history');history.outerHTML=page==='grade'?gradeHistoryHtml(gradeEmployeeDepartment(),true):gradeHistoryHtml();root.querySelector('[data-grade-history-page=\"'+b.dataset.gradeHistoryPage+'\"]')?.focus({preventScroll:true});return}
 if(b.hasAttribute('data-grade-confirm')){gradeCommit();return}
 if(b.hasAttribute('data-grade-back')){gradePending=null;modal.close();return}
 if(b.dataset.gradeLoad){const entry=gradeEntries[Number(b.dataset.gradeLoad)-1];if(entry&&(entry.department||'insurance')===gradeDepartment){gradeDraft=gradePrepareDraft(entry.policy,entry);gradeEffectiveDate=entry.date;gradeDirty=false;gradeDirtyPeriods.clear();gradeSavedStatus={};render()}return}
 if(b.hasAttribute('data-grade-cancel')){gradeDraft=gradePrepareDraft(gradePolicyAt(gradeEntries,gradeToday(),gradeDepartment));gradeDirty=false;gradeDirtyPeriods.clear();gradeSavedStatus={};gradeEffectiveDate=gradeToday();render();return}
 if(b.dataset.gradeAdd){const period=b.dataset.gradeAdd,rows=gradeDraft[period],last=rows[rows.length-1];if(!Number.isSafeInteger(last.min)||last.min<0){toast('마지막 구간의 시작 건수를 먼저 입력해 주세요.');return}const min=last.max===null?last.min+(period==='weekly'?1:10):last.max+(gradeExclusive(gradeDraft,period)?0:1);last.max=min-(gradeExclusive(gradeDraft,period)?0:1);rows.push({...last,min,max:null,extraStart:last.extra>0?min:null});gradeSetDirty(period);render();return}
 if(b.dataset.gradeRemove){const rows=gradeDraft[b.dataset.gradeRemove];if(rows.length>1){rows.splice(Number(b.dataset.gradeRow),1);gradeSetDirty(b.dataset.gradeRemove);render()}}
});
function gradeShowHistory(index){
 const entry=gradeEntries[index],department=page==='grade'?gradeEmployeeDepartment():gradeDepartment;
 if(!entry||(entry.department||'insurance')!==department)return;
 const policy=entry.savedPolicy||entry.policy;
 open('이전 적용 그레이드 기준',`<p><strong>${gradeEscape(gradeDepartments[department])}</strong></p><p>변경일시: ${gradeEscape(new Date(entry.savedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))}<br>적용 시작일: ${gradeEscape(entry.date)}${entry.savedBy?'<br>변경자: '+gradeEscape(entry.savedBy):''}<br>소속·직책: ${gradeEscape(entry.savedAffiliation||'기록 없음')}${entry.affiliationBasis==='current'?' (현재 소속)':''}</p>${Object.keys(gradePeriods).filter(period=>gradePeriodVisible(period)).map(period=>panel(gradePeriods[period],period==='monthly'&&department==='insurance'?gradeOriginalMonthlyTable(policy,false,{fixed:true,historyId:entry.id,department,month:entry.date.slice(0,7)}):period==='daily'?gradeDailyCashTable(policy):period==='weekly'?gradeWeeklyTable(policy):table(['실적 구간','시급','달성 수당','추가수당'],policy[period].map(r=>[gradeRange(r,period,policy),gradeMoney(r.hourly),gradeMoney(r.achievement),r.extra?gradeNumber(r.extraStart)+'건부터 '+gradeMoney(r.extra)+'/건':'없음'])))).join('')}`);
}
function gradeHistoryHtml(department=gradeDepartment,employee=false){
 const ordered=gradeEntries.map((entry,index)=>({entry,index})).filter(({entry})=>(entry.department||'insurance')===department).sort((a,b)=>b.entry.savedAt.localeCompare(a.entry.savedAt)||b.index-a.index);
 const pageCount=Math.max(1,Math.ceil(ordered.length/5)),historyPage=Math.min(gradeHistoryPages[department]||1,pageCount),visible=ordered.slice((historyPage-1)*5,historyPage*5),today=gradeToday(),active=gradePolicyAt(gradeEntries,today,department);gradeHistoryPages[department]=historyPage;
 const rows=visible.map(({entry,index})=>[new Date(entry.savedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),gradeEscape(entry.savedBy||'기록 없음'),gradeEscape(entry.savedAffiliation||'기록 없음')+(entry.affiliationBasis==='current'?'<small class="sub"> (현재 소속)</small>':''),entry.date,gradePeriodLabels[entry.period]||'전체 기준',active===entry.policy?'현재 적용':gradePolicyAt(gradeEntries,entry.date,department)!==entry.policy?'대체된 기준':entry.date>today?'적용 예정':'이전 기준',`<button type="button" class="secondary" data-grade-history-view="${index+1}">적용 기준 보기</button>${employee?'':` <button type="button" class="secondary" data-grade-load="${index+1}">표로 불러오기</button>`}`]);
 return `<section class="panel" id="tm-grade-history"><div class="row"><h2>그레이드 변경 이력</h2><span class="sub">총 ${ordered.length}건${ordered.length?` · ${(historyPage-1)*5+1}~${Math.min(historyPage*5,ordered.length)}건 표시`:''}</span></div><div id="tm-grade-history-list">${ordered.length?`<div class="scroll"><table><thead><tr>${['변경일시','변경자','변경자 소속·직책','적용 시작일','저장 항목','상태','기준 확인'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((cells,i)=>`<tr data-grade-history-view="${visible[i].index+1}" style="cursor:pointer">${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p class="sub">저장된 변경 이력이 없습니다. 기준을 확인 후 적용하면 여기에 표시됩니다.</p>'}</div>${ordered.length>5?`<nav class="row" style="justify-content:center;margin-top:14px" aria-label="그레이드 변경 이력 페이지"><button type="button" class="secondary" data-grade-history-page="-1" data-grade-history-department="${department}" ${historyPage===1?'disabled':''}>이전 페이지</button><span>${historyPage} / ${pageCount}페이지</span><button type="button" class="secondary" data-grade-history-page="1" data-grade-history-department="${department}" ${historyPage===pageCount?'disabled':''}>다음 페이지</button></nav>`:''}</section>`;
}
root.addEventListener('submit',event=>{if(event.target.id!=='tm-grade-form')return;event.preventDefault();if(gradeServerSaving)return;const error=gradeValidate(gradeDraft);const target=root.querySelector('#tm-grade-error');if(error){target.textContent=error;return}if(!gradeValidDate(gradeEffectiveDate)){target.textContent='올바른 적용 시작일을 선택해 주세요.';return}
 gradePending={department:gradeDepartment,date:gradeEffectiveDate,policy:JSON.parse(JSON.stringify(gradeDraft))};
 open('그레이드 변경 내용 확인',`<p><strong>${gradeDepartments[gradePending.department]}</strong> 기준</p><p>적용 시작일: <strong>${gradePending.date}</strong> · ${gradePending.date>gradeToday()?'적용 예약':'확인 시 적용'}</p><p class="sub">지정일 이전은 기존 기준, 지정일부터는 변경 기준으로 계산합니다. 주·월 중간 변경도 날짜별로 나눈 뒤 급여에 합산합니다. 같은 적용일에는 마지막 저장 기준을 적용하며, 확정된 급여는 변경하지 않습니다.</p>${Object.keys(gradePeriods).map(period=>panel(gradePeriods[period],period==='monthly'&&gradePending.department==='insurance'?gradeOriginalMonthlyTable(gradePending.policy,false,{preview:true,department:gradePending.department,date:gradePending.date}):period==='daily'?gradeDailyCashTable(gradePending.policy):period==='weekly'?gradeWeeklyTable(gradePending.policy):table(['정상 실적'+(gradeExclusive(gradePending.policy,period)?' (일평균)':''),'시급','달성수당','추가수당'],gradePending.policy[period].map(r=>[gradeRange(r,period,gradePending.policy),gradeMoney(r.hourly),gradeMoney(r.achievement),r.extra?`${gradeNumber(r.extraStart)}건부터 ${gradeMoney(r.extra)}/건`:'없음'])))).join('')}<p id="tm-grade-confirm-error" role="alert"></p><div class="row"><button type="button" class="secondary" data-grade-back>돌아가서 수정</button><button type="button" class="action" data-grade-confirm>확인 후 적용</button></div>`);
});
function gradeFinishSave(pending,savedPolicy,next){
 gradeEntries=next;gradePolicy=gradePolicyAt(next,gradeToday(),gradeEmployeeDepartment());
 const periods=pending.period&&pending.period!=='all'?[pending.period]:Object.keys(gradePeriodFields);
 for(const period of periods){
  // Preserve edits made in another section, or while this request was in flight.
  if(JSON.stringify(gradePeriodValues(gradeDraft,period))===JSON.stringify(gradePeriodValues(pending.policy,period))){
   gradeDraft=gradeMergePeriod(gradeDraft,savedPolicy,period);gradeDirtyPeriods.delete(period);
   gradeSavedStatus[period]=(window.CNCHOME_LIVE?'DB 저장 완료':'저장 완료')+' · '+pending.date+' 적용';
  }else{gradeDirtyPeriods.add(period);gradeSavedStatus[period]='수정 중 · 저장 이후 추가 변경이 있습니다.';}
 }
 gradeDirty=gradeDirtyPeriods.size>0||gradeEffectiveDate!==pending.date;delete gradeDraftCache[pending.department];gradePending=null;
 gradeStorageMessage=(window.CNCHOME_LIVE?'DB 저장 완료':'저장 완료')+' · '+(gradePeriodLabels[pending.period]||'전체 기준')+' · '+pending.date+'부터 적용';
 gradeRefreshHeader();if(!pending.inline)modal.close();if(page==='adminGrade')render();toast(gradeStorageMessage);
}
function gradeSaveError(pending,message){
 const target=root.querySelector(pending.inline?'#tm-grade-error':'#tm-grade-confirm-error');if(target)target.textContent=message;
 if(pending.period){gradeSavedStatus[pending.period]='저장 실패 · 입력값은 유지됩니다.';const status=root.querySelector('[data-grade-period-status="'+pending.period+'"]');if(status)status.textContent=gradeSavedStatus[pending.period];}
}
function gradeCommit(){if(window.CNCHOME_LIVE){gradeCommitServer();return;}if(!gradePending)return;const pending=structuredClone(gradePending);try{
 const latest=gradeReadStore(localStorage.getItem(gradePolicyKey));const entry={...pending,savedAt:new Date().toISOString()};const next=[...latest,entry];localStorage.setItem(gradePolicyKey,JSON.stringify({version:2,entries:next}));gradeFinishSave(pending,pending.policy,next);
 }catch(error){gradeSaveError(pending,'저장하지 못했습니다. 브라우저 저장 공간과 설정을 확인해 주세요. 변경 기준은 유지됩니다.');}}
window.addEventListener('storage',event=>{if(window.CNCHOME_LIVE||event.key!==gradePolicyKey)return;try{gradeEntries=gradeReadStore(event.newValue);gradePolicy=gradePolicyAt(gradeEntries,gradeToday(),gradeEmployeeDepartment());for(const key of Object.keys(gradeDraftCache))if(!gradeDraftCache[key].dirty)delete gradeDraftCache[key];if(!gradeDirty)gradeDraft=gradePrepareDraft(gradePolicyAt(gradeEntries,gradeToday(),gradeDepartment));gradeRefreshHeader();if(page==='grade'||(page==='adminGrade'&&!gradeDirty))render()}catch(error){toast('다른 창의 그레이드 기준을 읽지 못했습니다.')}});

let gradeServerSaving=false;
async function gradeCommitServer(){
 if(!gradePending||gradeServerSaving)return;
 gradeServerSaving=true;
 root.querySelectorAll('[data-grade-save-period],[data-grade-department],[data-grade-cancel],[data-grade-load],#tm-grade-form button[type="submit"]').forEach(el=>el.disabled=true);
 const button=root.querySelector('[data-grade-confirm]');if(button){button.disabled=true;button.textContent='DB에 저장 중…';}
 const pending=structuredClone(gradePending);
 try{
  const response=await fetch('/grade-api.php?role=admin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':window.CNCHOME_LIVE.csrf},body:JSON.stringify({...pending,revision:window.CNCHOME_LIVE.revision})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'저장하지 못했습니다.');
  const next=gradeReadStore(JSON.stringify({version:2,entries:data.entries}));
  window.CNCHOME_LIVE.revision=data.revision;gradeServerSaving=false;
  gradeFinishSave(pending,data.saved?.policy||pending.policy,next);
 }catch(error){gradeSaveError(pending,error.message||'통신에 실패했습니다. 새로고침으로 저장 여부를 확인해 주세요.');}
 finally{gradeServerSaving=false;root.querySelectorAll('[data-grade-save-period],[data-grade-department],[data-grade-cancel],[data-grade-load],#tm-grade-form button[type="submit"]').forEach(el=>el.disabled=false);if(button){button.disabled=false;button.textContent='확인 후 적용';}}
}
function gradeLiveChrome(){
 const live=window.CNCHOME_LIVE;
 root.classList.add('live-mode');
 root.querySelector('.team').textContent=gradeDepartments[live.user.department]+' · '+(live.user.role==='admin'?'관리자':'직원');
 root.querySelector('.mobile-note').textContent='회사 관리';
 root.querySelectorAll('[data-page]').forEach(b=>{b.hidden=live.user.role==='admin'?!(b.dataset.page==='grade'||b.dataset.page.startsWith('admin')):!['home','regions','attendance','sales','grade','as','payslips','myInfo'].includes(b.dataset.page);});
 root.querySelectorAll('.top-notice').forEach(el=>el.hidden=true);
 root.querySelectorAll('.payroll-link').forEach(el=>el.hidden=live.user.role==='admin');
 root.querySelectorAll('.nav-cut,.aw-nav-group').forEach(el=>el.hidden=live.user.role!=='admin');
 root.querySelector('.work > header').hidden=live.user.role==='admin';root.querySelector('.work > .sample').hidden=true;
 const legacyAccount=root.querySelector('#live-account');if(legacyAccount)legacyAccount.remove();
 if(page==='adminGrade'){
  const notice=main.querySelector('.notice:not(.grade-editor .notice)');
  if(notice)notice.textContent='일·주·월그레이드의 저장 버튼을 누르면 해당 항목만 DB에 저장됩니다. 저장된 기준은 적용일부터 직원 계산에 반영됩니다. 하루 10~15건 예시로 합계를 확인할 수 있습니다.';
 }
}

function adminAttendance(){return adminPage('출결 관리','직원의 출퇴근 기록과 휴가·병가·조퇴·외출 신청을 승인하고 수정합니다.',[['오늘 출근','14명','전체 16명'],['승인 대기','2건','휴가 1 · 외출 1'],['미등록','1명','출근 확인']],[
 ['출퇴근 현황','출근·퇴근 시각과 인정시간 확인','미등록'],
 ['신청 승인','휴가·병가·조퇴·외출 승인/반려','대기 건'],
 ['근무일 설정','공휴일·회사 휴무일·영업가능일 관리','이번 달'],
 ['출결 정정','누락·오입력 수정과 사유 기록','수정 이력']
 ])}
function adminAs(){return adminPage('A/S 관리','A/S 사유, 담당자, 재콜 일정과 완료 결과를 관리합니다.',[['처리 필요','3건','중복 2 · 동의 미흡 1'],['오늘 재콜','1건','16:50 예정'],['완료','1건','기록 보존']],[
 ['A/S 접수','사유 분류와 우선순위 지정','신규 건'],
 ['담당자 배정','재콜 담당자와 처리기한 지정','미배정'],
 ['처리 현황','대기·진행·완료 상태 확인','지연 건'],
 ['완료 기록','통화 결과와 후속 조치 보존','완료 검수']
 ])}
function adminStaff(){
 const administrators=adminEmployees.filter(employee=>employee.role==='관리자').length;
 const rows=adminEmployees.map(employee=>[policyEscape(employee.name),adminTeams.find(team=>team.id===employee.team)?.name||'미배정',policyEscape(employee.phone||'—'),policyEscape(employee.role||'상담원'),adminAttendancePill(employee.attendance),policyEscape(employee.startDate||'—')]);
 return `<div class="row"><div><h2>직원 관리</h2><p class="sub">직원 등록과 계정·소속팀·근무 상태·화면 권한을 관리합니다.</p></div><button type="button" class="action" data-action="staff-add"><span class="ui-icon ui-icon-plus" aria-hidden="true"></span> 직원 등록</button></div>`+
 stats([['재직 직원',adminEmployees.length+'명',adminTeams.length+'개 팀'],['관리자',administrators+'명','관리자 권한'],['미배정 직원',adminEmployees.filter(employee=>!employee.team).length+'명','팀 배정 필요']])+
 panel('직원 목록',table(['직원','소속팀','연락처','권한','근무 상태','입사일'],rows))+
 panel('직원 관리 항목',table(['구분','관리 내용','우선 확인'],[
  ['직원 등록','신규 직원 계정과 기본정보 등록','신규 입사'],
  ['팀 배정','팀·팀장 지정 및 이동 이력','미배정'],
  ['권한 관리','상담원·팀장·관리자 접근 권한','관리자 권한'],
  ['퇴사 처리','접근 차단과 기록 보존','미정산 확인']
 ]))
}
function adminSettings(){return adminPage('운영 설정','공지, 팀 구성, 공휴일, 접수 상태와 공통 운영 기준을 관리합니다.',[['공지','1건','보험팀 중요 공지'],['운영 팀','2개','보험영업팀'],['설정 변경','0건','오늘 없음']],[
 ['공지 관리','직원 화면 상단 공지 등록·종료','미확인 직원'],
 ['팀 설정','팀명·팀장·구성원 관리','팀 이동'],
 ['상태 설정','접수 및 A/S 상태값 관리','사용 중 항목'],
 ['변경 이력','관리자별 설정 변경 기록','최근 변경']
 ])+intakeCodeManagerPanel()}
window.CNCEmployeePages={home,sales,attendance,as:asPage};
window.addEventListener('cnc:attendance-changed',()=>{if(page==='attendance'&&!root.querySelector('#tm-attendance-leave-form :focus'))render();});
function render(){if(window.CNCHOME_LIVE){page=pageFromUrl();if(window.CNCPageNavigation)CNCPageNavigation.setPage(page);else{const url=new URL(window.location.href);url.searchParams.set('page',page);window.history.replaceState(window.history.state,'',url);}}gradePolicy=gradePolicyAt(gradeEntries,gradeToday(),gradeEmployeeDepartment());gradeRefreshHeader();const adminView=page.startsWith('admin');root.querySelector('.work > header').hidden=adminView;root.querySelector('.work > .sample').hidden=adminView;root.querySelector('.header-grades').hidden=adminView;root.querySelector('header').classList.toggle('admin-header',adminView);const noticeButton=root.querySelector('.notice-confirm');if(noticeButton){noticeButton.disabled=noticeRead;noticeButton.textContent=noticeRead?'확인 완료':'확인했습니다';}main.innerHTML=page==='adminAttendance'&&window.CNCHOME_LIVE?'<section class="panel checkin-admin" data-admin-checkins></section>':window.DailyGradeWorkspace?.handles(page)?DailyGradeWorkspace.render(page):window.SalesWorkspace?.handles(page)?SalesWorkspace.render(page):HRWorkspace.handles(page)?HRWorkspace.render(page):AdminWorkspace.pages[page]?AdminWorkspace.render(page):({home,regions:regionPage,attendance,sales,grade,as:asPage,adminHome:()=>AdminWorkspace.home()+adminHome(),adminIntake,adminPending,adminPolicy:adminIntake,adminPerformance,adminGrade,adminStaff:()=>AdminWorkspace.staffLinks()+adminStaff(),adminSettings:()=>AdminWorkspace.settings()+adminSettings()})[page]();root.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});if(page==='regions')filterRegions();if(page==='adminGrade'&&!window.CNCHOME_LIVE)gradeUpdatePreview();if(window.CNCHOME_LIVE){gradeLiveChrome();HRWorkspace.chrome();window.SalesWorkspace?.chrome();window.DailyGradeWorkspace?.chrome()}}
function toast(s){const t=root.querySelector('#tm-toast');t.textContent=s;t.hidden=false;if(['adminIntake','adminPolicy'].includes(page))policyRegistrationMessage(s);}
function open(title,html){root.querySelector('#tm-dialog-title').textContent=title;body.innerHTML=html;modal.showModal()}
function intake(){if(window.SalesWorkspace?.intake())return;open('보험 접수 등록',`<p class="sub">입력 체험용입니다. 실제 접수나 저장은 되지 않습니다.</p><form id="tm-intake-form"><div class="fields"><label>거래처<select required>${policyClientOptions(policyViewClient)}</select></label><label>접수 코드<select id="tm-intake-code" required>${intakeCodeOptions()}</select></label><label>상품 구분<select required><option>일반</option><option>실버</option></select></label><label>고객명<input required placeholder="예시 이름"></label><label>전화번호<input type="tel" required pattern="[0-9-]{10,13}" placeholder="010-0000-0000"></label><label>출생연도<input type="number" min="1920" max="2026" required placeholder="1965"></label><label class="full">상담받을 주소<input required placeholder="시·군·구 및 상세 주소"></label><label>통화 가능시간<input type="time" required></label><label>방문 가능시간<input type="time" required></label><label class="full">상담 메모<textarea rows="2"></textarea></label></div><button class="action" type="submit">입력 완료 체험</button></form>`)}
root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.salesStatus){salesStatus=b.dataset.salesStatus;root.querySelectorAll('[data-sales-status]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.salesStatus===salesStatus)));root.querySelector('#tm-sales-list').innerHTML=salesStatusRows();return}if(b.dataset.homeStatus){homeStatus=homeStatus===b.dataset.homeStatus?null:b.dataset.homeStatus;root.querySelectorAll('[data-home-status]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.homeStatus===homeStatus)));const target=root.querySelector('#tm-home-status-list');target.innerHTML=homeStatusList();return}if(b.dataset.page){if(window.location.hash==='#'+b.dataset.page){page=b.dataset.page;render();main.scrollTop=0}else{window.location.hash=b.dataset.page}return}if(b.dataset.day){selected=+b.dataset.day;render();return}switch(b.dataset.action){case 'close':modal.close();break;case 'intake-window':{const url=new URL(window.CNCPageUrl||location.href);url.searchParams.set('page','regions');url.searchParams.set('policyWindow','1');url.searchParams.set('intakeWindow','1');url.hash='regions';window.open(url.href,'_blank','popup,width=900,height=740,scrollbars=yes,resizable=yes,noopener');break;}case 'intake':intake();break;case 'staff-add':open('직원 등록',`<p class="sub">신규 직원의 기본정보와 소속·권한을 입력해 주세요.</p><form id="tm-staff-add-form"><div class="fields"><label>직원 이름<input name="name" required autocomplete="off" placeholder="이름"></label><label>연락처<input name="phone" type="tel" required placeholder="010-0000-0000"></label><label>소속팀<select name="team" required><option value="">팀 선택</option>${adminTeams.map(team=>`<option value="${team.id}">${team.name}</option>`).join('')}</select></label><label>권한<select name="role" required><option>상담원</option><option>팀장</option><option>관리자</option></select></label><label>입사일<input name="startDate" type="date" required value="2026-09-23"></label><label>근무 상태<select name="attendance"><option>출근</option><option>미출근</option><option>휴가</option></select></label></div><button type="submit" class="action">직원 등록</button></form>`);break;case 'notice-detail':open('보험팀 중요 공지','<p>접수 가능지역을 확인한 후 상담해 주세요.</p>');break;case 'notice':noticeRead=true;render();toast('공지 확인 완료 · 미리보기에서만 반영됩니다.');break;case 'cash':open('현금 수령 확인',`<p>오늘 일그레이드 <strong>${gradeMoney(gradeCalculate(gradePolicy,'daily',AdminWorkspace.todayDaily().count).bonus)}</strong>을 받으셨나요?</p><p class="sub">예시 수령 확인이며 실제 지급 기록은 생성되지 않습니다.</p><button class="action" data-action="confirm-cash">예시 수령 확인</button>`);break;case 'confirm-cash':cashReceived=true;modal.close();render();toast('예시 수령 확인 완료');break;case 'clockout':open('퇴근 기록 확인',`<p>예시 시각 <strong>16:40</strong>으로 퇴근을 기록합니다.</p><p class="sub">점심 제외 5시간 40분 → 인정 6시간</p><button class="action" data-action="confirm-clockout">예시 퇴근 확인</button>`);break;case 'confirm-clockout':clockedOut=true;modal.close();render();toast('퇴근 기록 체험 완료');break;case 'outing':open('외출 사전 승인 신청',`<form id="tm-outing-form"><div class="fields"><label>외출 구분<select name="kind"><option>개인 외출</option><option>업무 외출</option></select></label><label>예정일<input type="date" value="2026-09-22" required></label><label>외출 예정<input type="time" name="start" required></label><label>복귀 예정<input type="time" name="end" required></label><label class="full">사유<textarea required rows="2"></textarea></label></div><p class="sub">승인 후 외출 시작이 가능합니다.</p><button type="submit" class="action">신청 체험</button></form>`);break;case 'as-detail':open('진행 중인 A/S · 예시 상세',`<p><strong>김예시</strong> · 한화</p><p>전화번호: 010-0000-1200</p><p>주소: 경기도 부천시 예시로 1, 예시동 101호</p><p>${pill('접수 중복','amber')}</p><label>재콜 예정 시각<input type="datetime-local" value="2026-09-22T16:50"></label><p class="sub">표시된 연락처와 주소는 가상 자료입니다.</p><button class="action" data-action="recall">재콜 일정 확인 체험</button>`);break;case 'recall':modal.close();toast('재콜 일정 확인 체험 완료 · 실제로 저장되지 않습니다.');break;}});
root.addEventListener('paste',e=>{if(e.target.id!=='tm-policy-paste')return;const imageItem=[...(e.clipboardData?.items||[])].find(item=>item.type.startsWith('image/'));if(imageItem){e.preventDefault();policyHandleImage(imageItem.getAsFile());}});
root.addEventListener('change',e=>{if(e.target.id==='tm-policy-image'&&e.target.files?.[0])policyHandleImage(e.target.files[0]);});
root.addEventListener('change',e=>{if(e.target.id==='tm-policy-scope-detail'){policyScopeDetail=e.target.value;policyRefreshScopeResult()}else if(e.target.id==='tm-policy-scope-city'){policyScopeCity=e.target.value;policyRefreshScopeResult()}});
root.addEventListener('input',e=>{if(e.target.matches('[data-city-row]'))policyCityDrafts.set(Number(e.target.dataset.cityRow),e.target.value)});
root.addEventListener('click',async e=>{const button=e.target.closest('[data-action^="policy-"]');if(!button)return;const action=button.dataset.action;if(window.PolicySync?.saving){toast('정책을 저장 중입니다. 잠시 기다려 주세요.');return}if(policyOcrRunning){toast('OCR 분석이 끝난 뒤 다시 시도해 주세요.');return}if(action==='policy-city-save-all'){await policyApplyAllCityRows();}else if(action==='policy-city-save'){
 const index=Number(button.dataset.row);policyUpdateCityRow(index,root.querySelector('[data-city-row="'+index+'"]')?.value||'','직접 수정');
 }else if(action==='policy-city-suggest'){
 const index=Number(button.dataset.row),start=Number(button.dataset.start),end=Number(button.dataset.end),current=policyRows[index]?.[0];
 if(policyCityDrafts.has(index)&&policyCityDrafts.get(index)!==current){toast('입력한 지역명을 먼저 수정 적용해 주세요.');return}if(typeof current==='string'&&current.slice(start,end)===button.dataset.token&&policyCityData.some(c=>c.name===button.dataset.city))policyUpdateCityRow(index,current.slice(0,start)+button.dataset.city+current.slice(end),'후보 선택');
 }else if(action==='policy-analyze'){policyAnalyzeExisting();}else if(action==='policy-ocr'){policyRunOcr();}else if(action==='policy-parse'){policyConvertInput();}else if(action==='policy-clear'){policyTimerStop('');policyCancelAutoConvert();policyOcrTiming=policyOcrTotalTiming=0;policyIntakeTitle='';policyDetectedCodes=[];policyCodeTitles=[];policyCityDrafts.clear();policyCityOriginalRows=[];policyCityAudit=[];policyAnalysis=[];policyRows=[];policyImageData='';policyImageName='';policyRegistered=false;const input=root.querySelector('#tm-policy-paste');if(input)input.value='';const file=root.querySelector('#tm-policy-image');if(file)file.value='';policyRefreshPreview();}else if(action==='policy-register'){await policyRegister();}});
root.addEventListener('input',e=>{if(['tm-region-search','tm-customer-age'].includes(e.target.id))filterRegions()});
root.addEventListener('change',e=>{if(e.target.id==='tm-age')filterRegions();if(e.target.id==='tm-map-carrier'){mapCarrier=e.target.value;filterRegions();}});
root.addEventListener('submit',e=>{e.preventDefault();if(e.target.id==='tm-staff-add-form'){if(!e.target.reportValidity())return;const f=new FormData(e.target);adminEmployees.push({name:String(f.get('name')).trim(),phone:String(f.get('phone')).trim(),team:String(f.get('team')),role:String(f.get('role')),startDate:String(f.get('startDate')),attendance:String(f.get('attendance')),normal:0,pending:0,as:0,monthly:0,grade:'60건 이하'});modal.close();page='adminStaff';render();toast('직원이 등록되었습니다. · 미리보기에서만 반영됩니다.');return}if(e.target.id==='tm-outing-form'){const f=new FormData(e.target);if(f.get('end')<=f.get('start')){toast('복귀 예정 시간은 외출 예정 시간 이후로 입력해 주세요.');return}outing='pending';root.dataset.outingKind=f.get('kind');modal.close();render();toast('외출 신청 체험 완료 · 관리자 승인 대기 상태입니다.')}else if(e.target.id==='tm-intake-form'){modal.close();toast('접수 입력 체험 완료 · 실제 접수·수량·실적에는 반영되지 않습니다.')}});
root.addEventListener('click',e=>{const target=e.target.closest('[data-chart-day]');if(target){selected=Number(target.dataset.chartDay);render()}});
root.addEventListener('keydown',e=>{const target=e.target.closest('[data-chart-day]');if(target&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selected=Number(target.dataset.chartDay);render()}});
// Metadata for the 250 municipality/district polygons already embedded in index.html.
// End indices are exclusive. Source geometry stays unchanged; no 읍·면·동 geometry is implied.
const policyMapProvinceRanges=[
 {province:'서울특별시',start:0,end:25,first:'종로구',last:'강동구'},
 {province:'부산광역시',start:25,end:41,first:'중구',last:'기장군'},
 {province:'대구광역시',start:41,end:49,first:'중구',last:'달성군'},
 {province:'인천광역시',start:49,end:59,first:'중구',last:'옹진군'},
 {province:'광주광역시',start:59,end:64,first:'동구',last:'광산구'},
 {province:'대전광역시',start:64,end:69,first:'동구',last:'대덕구'},
 {province:'울산광역시',start:69,end:74,first:'중구',last:'울주군'},
 {province:'세종특별자치시',start:74,end:75,first:'세종시',last:'세종시'},
 {province:'경기도',start:75,end:117,first:'수원시장안구',last:'양평군'},
 {province:'강원특별자치도',start:117,end:135,first:'춘천시',last:'양양군'},
 {province:'충청북도',start:135,end:149,first:'충주시',last:'증평군'},
 {province:'충청남도',start:149,end:165,first:'천안시동남구',last:'태안군'},
 {province:'전북특별자치도',start:165,end:180,first:'전주시완산구',last:'부안군'},
 {province:'전라남도',start:180,end:202,first:'목포시',last:'신안군'},
 {province:'경상북도',start:202,end:226,first:'포항시남구',last:'울릉군'},
 {province:'경상남도',start:226,end:248,first:'진주시',last:'합천군'},
 {province:'제주특별자치도',start:248,end:250,first:'제주시',last:'서귀포시'}
];
function policyMapCanonicalProvince(value){
 const name=String(value||'').replace(/\s/g,'');
 return ({강원도:'강원특별자치도',전라북도:'전북특별자치도',제주도:'제주특별자치도',세종시:'세종특별자치시'})[name]||name;
}
function policyMapMetadata(shapes){
 // Fail closed if the source dataset is replaced or reordered. Rebuild the manifest explicitly.
 if(!Array.isArray(shapes)||shapes.length!==250)throw new Error('지도 지역 자료의 개수가 변경되었습니다. 분류표를 확인해 주세요.');
 let hash=2166136261;
 for(const char of shapes.map(shape=>shape.name).join('\n'))hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
 if(hash!==0x8dec6c80)throw new Error('지도 지역 자료의 순서 또는 이름이 변경되었습니다. 분류표를 확인해 주세요.');
 let previousEnd=0;
 for(const range of policyMapProvinceRanges){
  if(range.start!==previousEnd||range.end<=range.start||shapes[range.start]?.name!==range.first||shapes[range.end-1]?.name!==range.last)throw new Error('지도 시도 분류가 일치하지 않습니다.');
  previousEnd=range.end;
 }
 if(previousEnd!==shapes.length)throw new Error('지도 시도 분류에서 누락된 지역이 있습니다.');
 return shapes.map((shape,index)=>{
  const sourceProvince=policyMapProvinceRanges.find(range=>index>=range.start&&index<range.end).province;
  // Verified administrative changes; these update identity only, never polygon coordinates.
  // 군위: https://www.mois.go.kr/frt/bbs/type010/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000008&nttId=97607
  // 미추홀: https://www.mois.go.kr/frt/bbs/type010/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000008&nttId=62371
  const province=sourceProvince==='경상북도'&&shape.name==='군위군'?'대구광역시':sourceProvince;
  const name=sourceProvince==='인천광역시'&&shape.name==='남구'?'미추홀구':shape.name==='세종시'?'세종특별자치시':shape.name;
  return {index,sourceProvince,province,sourceName:shape.name,name};
 });
}
function policyMapCatalogMatch(metadata,catalog){
 const compact=value=>String(value||'').replace(/\s/g,'');
 const candidates=catalog.map((entry,index)=>({entry,index})).filter(({entry})=>policyMapCanonicalProvince(entry.province)===metadata.province);
 const exact=candidates.filter(({entry})=>compact(entry.name)===metadata.name);
 if(exact.length===1)return exact[0];
 if(exact.length>1)return null;
 // Districts of an ordinary city are part of that city's first-level group.
 const cityParents=candidates.filter(({entry})=>{
  const name=compact(entry.name);
  return /시$/.test(name)&&metadata.name.startsWith(name)&&/^[가-힣]+구$/.test(metadata.name.slice(name.length));
 });
 if(cityParents.length===1)return cityParents[0];
 if(cityParents.length>1)return null;
 // Standalone metropolitan districts use the metropolitan city as their first-level group.
 // Counties remain independent; never absorb a missing county into a metropolitan group.
 if(/구$/.test(metadata.name)&&/특별시$|광역시$/.test(metadata.province)){
  const metro=candidates.filter(({entry})=>compact(entry.name)===metadata.province);
  if(metro.length===1)return metro[0];
 }
 return null;
}

// Registered policies are the single source for the administrator and employee views.
const policyStorageKey='cnchome.regionPolicies.v1';
let policyPublications={},policyPublicationCarrier='',policyPublicationKind='',policyRegionStatus='all';
let policyPublishedScopes=new Map(),policyPublishedResults=new Map(),policyMapBindings=[];
const policyStateLabels={possible:'접수 가능',blocked:'접수 불가',partial:'일부 지역만 가능',review:'확인 필요'};
function policyHasPublications(){return policyActiveEntries().length>0}
function policyBindMapShapes(shapes,catalog){
 const fullCatalog=catalog.map(place=>({...place,province:PolicyRegionRules.provinceNames[place.province]||place.province}));
 return policyMapMetadata(shapes).map(meta=>{
  const found=policyMapCatalogMatch(meta,fullCatalog);if(!found)return {group:-1,path:[]};
  const suffix=meta.name.startsWith(found.entry.name)?meta.name.slice(found.entry.name.length):meta.name;
  return {group:found.index,path:meta.name===found.entry.name?[]:/구$/.test(suffix)?[suffix]:[]};
 });
}
function policyReadPublications(value,codes=intakeCodes){
 const data=JSON.parse(value||'null');if(!data||data.version!==1||!data.policies)return {};
 const valid={};
 for(const [key,item] of Object.entries(data.policies)){
  if(!/^[a-z][a-z0-9_]*:(?:client_[a-z0-9_]+:)?(general|silver)$/.test(key)||!codes.some(c=>key.startsWith(c.id+':'))||!item||!Array.isArray(item.rows)||item.rows.length<2||item.rows.length>1000)continue;
  if(!item.rows.every(row=>Array.isArray(row)&&row.length<=20&&row.every(cell=>typeof cell==='string'&&cell.length<=3000)))continue;
  const {carrier,kind,client}=policyKeyParts(key);valid[key]={client,carrier,kind,rows:item.rows,savedAt:String(item.savedAt||'')};
 }
 return valid;
}
function policyPublicationControls(){
 return policyServerStatusMarkup()+'<div class="row"><label>등록 거래처<select id="tm-policy-publication-client">'+policyClientOptions(policyPublicationClient)+'</select></label><label>등록 접수 코드<select id="tm-policy-publication-carrier">'+intakeCodeOptions(policyPublicationCarrier)+'</select></label><label>등록 상품<select id="tm-policy-publication-kind"><option value="">상품 선택</option><option value="auto" '+(policyPublicationKind==='auto'?'selected':'')+'>자동 분류 · 한화/신한 미구분은 모두 적용</option><option value="general" '+(policyPublicationKind==='general'?'selected':'')+'>일반 · 60세 이하</option><option value="silver" '+(policyPublicationKind==='silver'?'selected':'')+'>실버 · 61~70세</option></select></label></div><p class="sub">만 나이가 아닌 세는나이 기준입니다. 일반·실버는 지역명이 아닌 상품 구분이며, 두 상품이 있으면 각각 등록합니다. 자동 분류 시 한화·신한의 구분 없는 행은 일반·실버 모두에 적용하며, 구분이 적힌 행은 해당 상품에만 적용합니다. 일반 또는 실버를 직접 선택하면 선택한 상품에만 등록합니다. 등록하면 해당 거래처·접수 코드·상품의 이전 정책만 대체합니다. 정책표 등록 완료 후 서버 DB에 저장되며, 직원은 다른 PC에서도 접수 가능지역에서 확인할 수 있습니다.</p>';
}
function policyNationalCatalogRows(query=''){
 const q=query.replace(/\s/g,'');
 const entries=[...KoreaRegionCatalog.municipalities.map(c=>({...c,parent:''})),...KoreaRegionCatalog.districts];
 const found=entries.filter(c=>[c.province,KoreaRegionCatalog.provinceNames[c.province],c.parent,c.name,...(c.aliases||[])].join('').replace(/\s/g,'').includes(q));
 return '<p class="sub">'+found.length+'개 기준 항목 · 광역시와 제주 행정시 포함 · 이미지 업로드 여부와 무관한 전국 목록</p>'+table(['시도·정책 구분','시·군','구'],found.map(c=>[policyEscape(KoreaRegionCatalog.provinceNames[c.province]||c.province),policyEscape(c.parent||c.name),c.parent?policyEscape(c.name):'—']));
}
function policyNationalCatalogPanel(){
 return panel('전국 시·군·구 기준 목록','<details><summary>전국 기준 목록 검색</summary><p class="sub">원문과 정확히 일치하는 명칭을 대조합니다. 동명 지역은 시도·상위 시로 구별하고, 원문을 임의로 바꾸지 않습니다.</p><label>전국 지역명 검색<input id="tm-policy-catalog-search" placeholder="예: 연천군, 분당구, 고성군"></label><div id="tm-policy-catalog-results">'+policyNationalCatalogRows()+'</div></details>');
}
function policyScopesForRows(rows){return PolicyRegionRules.parseRows(rows,{intakeCodes})}
function policyPublishRows({reviewed=false}={}){
 if(!policyClients.some(c=>c.id===policyPublicationClient)){toast('정책을 등록할 거래처를 선택해 주세요.');return false}
 const metadata=policyDraftCodeMetadata();policyDetectedCodes=metadata.known;
 if(metadata.unknown.length){toast('등록되지 않은 접수 코드가 있습니다: '+metadata.unknown.join(', ')+'. 접수 코드 관리에서 추가한 뒤 등록해 주세요.');return false}
 if(policyDetectedCodes.length>1){toast('한 표에 여러 접수 코드가 있습니다. 정책을 접수 코드별로 나누어 등록해 주세요.');return false}
 if(policyDetectedCodes.length===1&&policyDetectedCodes[0]!==policyPublicationCarrier){toast('표에 기재된 접수 코드와 선택한 접수 코드가 다릅니다. 등록 접수 코드를 확인해 주세요.');return false}
 if(!policyPublicationKind&&['hanwha','shinhan'].includes(policyPublicationCarrier)){policyPublicationKind='auto';const select=root.querySelector('#tm-policy-publication-kind');if(select)select.value='auto';}
 if(!intakeCodes.some(c=>c.id===policyPublicationCarrier)||!['general','silver','auto'].includes(policyPublicationKind)){toast('등록할 접수 코드와 일반·실버 상품을 선택해 주세요.');return false}
 let groups;try{groups=PolicyInput.groups(policyRows,policyPublicationKind,policyPublicationCarrier)}catch(error){toast(error.message);return false}
 const scopes=policyScopesForRows(policyRows);
 if(!scopes.length){toast('등록할 지역 데이터가 없습니다.');return false}
 const errors=scopes.filter(s=>s.errors.length);
 if(errors.length&&!reviewed){policyRefreshPreview();policyEditResult('등록 전에 지역 수정이 필요합니다.');return false}
 if(window.PolicySync?.enabled)return policyPublishServer(groups,reviewed);
 let updated,nextCodes;
 try{
  nextCodes=IntakeCodeCatalog.read(localStorage.getItem(intakeCodeStorageKey));
  const latest=policyReadPublications(localStorage.getItem(policyStorageKey),nextCodes);
  updated={...policyPublications,...latest};const savedAt=new Date().toISOString();
  for(const [kind,rows] of Object.entries(groups))updated[policyClientKey(policyPublicationCarrier,kind)]={client:policyPublicationClient,carrier:policyPublicationCarrier,kind,rows:policyCleanRows(rows),savedAt};
  localStorage.setItem(policyStorageKey,JSON.stringify({version:1,policies:updated}));
 }catch(error){toast('브라우저에 정책을 저장하지 못했습니다. 저장 공간과 사이트 저장 권한을 확인해 주세요.');return false}
 intakeCodes=nextCodes;regionCarrierSettings.splice(1,regionCarrierSettings.length-1,...intakeCodes.map(c=>({...c,visible:true,enabled:true})));
 policyPublications=updated;policyRebuildPublishedRegions();intakeCodeRefreshViews();return true;
}
function policyRebuildPublishedRegions(){
 policyPublishedScopes=new Map();policyPublishedResults=new Map();
 regionCarrierSettings.filter(c=>c.id!=='all').forEach(c=>c.enabled=false);
 if(!policyHasPublications())return;
 policyPublishedScopes=new Map(policyActiveEntries().map(([key,item])=>[key,policyScopesForRows(item.rows)]));
 policyPublishedResults=new Map();
 for(const [key,scopes] of policyPublishedScopes)policyPublishedResults.set(key,PolicyRegionRules.catalog.map(place=>PolicyRegionRules.evaluate(scopes,place)));
 regions.splice(0,regions.length,...PolicyRegionRules.catalog.map(place=>[place.name,PolicyRegionRules.provinceNames[place.province]||place.province,'','','등록 정책 기준',place.name]));
 regionInsurancePolicies.splice(0,regionInsurancePolicies.length,...regions.map(()=>Object.fromEntries(intakeCodes.map(c=>[c.id,{general:null,silver:null}]))));
 for(const [key,results] of policyPublishedResults){const {carrier,kind,client}=policyKeyParts(key);if(client!==policyViewClient)continue;results.forEach((result,index)=>{const qty=result.state==='possible'||result.state==='partial'?result.quantity:0;regionInsurancePolicies[index][carrier][kind]=(qty??0)+' / '+(qty??0)})}
 regionCarrierSettings.filter(c=>c.id!=='all').forEach(c=>{if([...policyPublishedScopes.keys()].some(k=>k.startsWith(c.id+':')))c.enabled=true});
 policyMapBindings=policyBindMapShapes(regionMapShapes,PolicyRegionRules.catalog);
 policyMapBindings.forEach((binding,index)=>{regionMapShapes[index].group=binding.group});
 mapSelectedGroup=null;mapHoveredGroup=null;normalizeMapCarrier();
}
function policySelectedKeys(){
 const selection=root.querySelector('#tm-age')?.selectedIndex??2,kind=selection===0?'general':selection===1?'silver':'';
 return [...policyPublishedScopes.keys()].filter(key=>policyKeyParts(key).client===policyViewClient&&(!kind||key.endsWith(':'+kind))&&(mapCarrier==='all'||key.startsWith(mapCarrier+':')));
}
function policyKeyLabel(key){const {carrier:id,kind,client}=policyKeyParts(key);return ((policyClients.find(c=>c.id===client)?.label||'거래처 확인 필요')+' · ')+(regionCarrierSettings.find(c=>c.id===id)?.label||id)+' '+(kind==='general'?'일반':'실버')}
function policyResultForGroup(index){
 const items=policySelectedKeys().map(key=>({key,...policyPublishedResults.get(key)[index]}));
 const preferred=['possible','partial','review','blocked'].map(state=>items.find(item=>item.state===state)).find(Boolean);
 return {state:preferred?.state||'review',items,reason:preferred?.reason||'선택한 상품에 등록된 정책이 없습니다.'};
}
function policyResultPill(result){return pill(policyStateLabels[result.state]||'확인 필요',result.state==='possible'?'green':result.state==='blocked'?'pink':'amber')}
function policyPublishedInsuranceItems(r,general){
 const index=regions.indexOf(r),keys=new Set(policySelectedKeys());
 const items=[...policyPublishedResults].filter(([key])=>keys.has(key)).flatMap(([key,results])=>{
  const result=results[index];return result&&['possible','partial'].includes(result.state)?[{key,label:policyKeyLabel(key)+(result.state==='partial'?' · 일부 제한':''),amount:result.quantity,remaining:result.quantity??'확인',state:result.state}]:[];
 });
 // Show a shared unclassified table once; do not duplicate its quota across ages.
 return items.filter((item,i)=>!items.slice(0,i).some(prior=>policyKeyParts(prior.key).carrier===policyKeyParts(item.key).carrier&&JSON.stringify(policyPublications[prior.key]?.rows)===JSON.stringify(policyPublications[item.key]?.rows)));
}
function policyPathsForPlace(scopes,place){
 const paths=new Map();
 for(const scope of scopes)for(const target of [...scope.include,...scope.exclude]){
  if(target.province===place.province&&target.name===place.name&&target.path.length)paths.set(target.path.join(' '),target.path);
 }
 return [...paths.values()];
}
function policyPublishedDetails(index,result){
 const place=PolicyRegionRules.catalog[index];
 return result.items.map(item=>{
  const scopes=policyPublishedScopes.get(item.key),paths=policyPathsForPlace(scopes,place);
  const rows=item.rows||[];
  const shared=(item.quantities||[]).map(q=>'정책 '+q.row+'행 · '+q.quantity+'건 공유').join(' / ')||(rows.length?'정책 '+rows.map(i=>i+'행').join(', '):'');
  const details=paths.map(path=>{const child=PolicyRegionRules.evaluate(scopes,{...place,path});return '<li><strong>'+policyEscape(path.join(' → '))+'</strong> '+policyResultPill(child)+'<span class="sub"> '+policyEscape(child.reason)+'</span></li>'}).join('');
  return '<div class="policy-region-detail"><strong>'+policyEscape(policyKeyLabel(item.key))+'</strong> '+policyResultPill(item)+'<p class="sub">'+policyEscape(item.reason)+(shared?' · '+policyEscape(shared):'')+'</p>'+(details?'<ul class="policy-child-regions">'+details+'</ul>':'')+'</div>';
 }).join('');
}
function policyGroupedRegionTable(items){
 const groups=new Map();for(const item of items){const key=item.place.province;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
 return [...groups].sort(([a],[b])=>a.localeCompare(b,'ko')).map(([province,rows])=>'<details class="policy-province-group" data-policy-province="'+policyEscape(province)+'" open><summary><strong>'+policyEscape(PolicyRegionRules.provinceNames[province]||province)+'</strong> · '+rows.length+'개 시·군</summary>'+table(['시·군','접수 상태','읍·면·동 등 상세 / 제외 지역'],rows.map(({place,index,result})=>['<button type="button" class="region-select-button" data-region-select="'+index+'" aria-pressed="'+(mapSelectedGroup===index)+'">'+policyEscape(place.name)+'</button>',policyResultPill(result),policyPublishedDetails(index,result)]))+'</details>').join('')||'<p class="sub">검색 조건에 맞는 지역이 없습니다.</p>';
}
function policyFilterPublishedRegions(){
 normalizeMapCarrier();const q=(root.querySelector('#tm-region-search')?.value||'').replace(/\s/g,'');
 const keys=policySelectedKeys(),results=PolicyRegionRules.catalog.map((place,index)=>({place,index,result:policyResultForGroup(index)}));
 const filtered=results.filter(({place,result})=>{
  const paths=keys.flatMap(key=>policyPathsForPlace(policyPublishedScopes.get(key),place)).map(path=>path.join(' '));
  const search=[place.province,PolicyRegionRules.provinceNames[place.province],place.name,...place.aliases,...paths].join('').replace(/\s/g,'');
  return (!q||search.includes(q))&&(policyRegionStatus==='all'||(policyRegionStatus==='blocked'?result.items.some(item=>item.state==='blocked')||keys.some(key=>policyPathsForPlace(policyPublishedScopes.get(key),place).some(path=>PolicyRegionRules.evaluate(policyPublishedScopes.get(key),{...place,path}).state==='blocked')):result.state===policyRegionStatus));
 }).sort((a,b)=>['partial','possible','review','blocked'].indexOf(a.result.state)-['partial','possible','review','blocked'].indexOf(b.result.state)||a.place.province.localeCompare(b.place.province,'ko')||a.place.name.localeCompare(b.place.name,'ko'));
 const controls='<label>접수 상태<select id="tm-region-status"><option value="all">전체 지역</option><option value="possible" '+(policyRegionStatus==='possible'?'selected':'')+'>접수 가능</option><option value="partial" '+(policyRegionStatus==='partial'?'selected':'')+'>일부 지역만 가능</option><option value="blocked" '+(policyRegionStatus==='blocked'?'selected':'')+'>접수 불가 지역 포함</option><option value="review" '+(policyRegionStatus==='review'?'selected':'')+'>확인 필요</option></select></label>';
 root.querySelector('#tm-region-results').innerHTML=controls+(keys.length?'<p class="sub">'+filtered.length+'개 시·군 · 수량은 정책 행별 공유 수량이며 시·군별로 합산하지 않습니다.</p>'+policyGroupedRegionTable(filtered):'<p class="notice">선택한 접수 코드·상품에 등록된 정책이 없습니다.</p>');
 updateRegionMap();
}
function policyMapShapeStatus(shape,index){
 const binding=policyMapBindings[index];if(!binding||binding.group<0)return {state:'review',label:'지도 지역 연결 확인 필요'};
 const place=PolicyRegionRules.catalog[binding.group],keys=policySelectedKeys();
 const values=keys.map(key=>{
  const result=PolicyRegionRules.evaluate(policyPublishedScopes.get(key),{...place,path:binding.path||[]});
  const parent=policyPublishedResults.get(key)[binding.group];
  // A literal 읍/면 without a stated 구 cannot be placed into one district polygon.
  const confirmedBlock=(result.restrictions||[]).some(r=>r.kind==='blocked'&&PolicyRegionRules.contains(r,{...place,path:binding.path}));
  if(!confirmedBlock&&binding.path.length&&parent.state==='partial'&&(parent.restrictions||[]).some(r=>r.path.length&&!/구$/.test(r.path[0])))return {...result,state:'partial'};
  return result;
 });
 const state=['possible','partial','review','blocked'].find(s=>values.some(v=>v.state===s))||'review';
 return {state,label:policyStateLabels[state]};
}
function policyPublishedMapLabels(svg){
 const layer=svg?.querySelector('.map-label-layer');if(!layer)return;
 const index=mapHoveredGroup;if(index===null||!regions[index]){layer.innerHTML='';return}
 const result=policyResultForGroup(index),v=svg.viewBox.baseVal,matrix=svg.getScreenCTM();
 const quota=result.items.flatMap(item=>(item.quantities||[]).map(q=>policyKeyLabel(item.key)+' '+q.quantity+'건 공유')).join(' · ');
 const unit=matrix?1/Math.max(.001,Math.hypot(matrix.a,matrix.b)):v.width/400;
 const x=v.x+10*unit,y=v.y+10*unit,w=Math.min(340*unit,v.width-20*unit),h=104*unit;
 layer.innerHTML='<g pointer-events="none"><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+8*unit+'" fill="white" stroke="#7894b5" stroke-width="1" vector-effect="non-scaling-stroke"/><text x="'+(x+10*unit)+'" y="'+(y+26*unit)+'" font-size="'+16*unit+'" fill="#173653">'+policyEscape(regionDisplayName(regions[index]))+'</text><text x="'+(x+10*unit)+'" y="'+(y+52*unit)+'" font-size="'+15*unit+'" fill="#173653">'+policyEscape(policyStateLabels[result.state])+'</text><text x="'+(x+10*unit)+'" y="'+(y+79*unit)+'" font-size="'+12*unit+'" fill="#61738b">'+policyEscape(quota.length>32?quota.slice(0,31)+'…':quota||'읍·면·동 및 제외 조건은 목록에서 확인')+'</text></g>';
}
root.addEventListener('change',e=>{
 if(e.target.id==='tm-policy-publication-client'){policyPublicationClient=e.target.value;policyRegistered=false;}
 if(e.target.id==='tm-region-client'){policyViewClient=e.target.value;policyRebuildPublishedRegions();filterRegions()}
 if(e.target.id==='tm-policy-publication-carrier')policyPublicationCarrier=e.target.value;
 if(e.target.id==='tm-policy-publication-kind')policyPublicationKind=e.target.value;
 if(e.target.id==='tm-region-status'){policyRegionStatus=e.target.value;policyFilterPublishedRegions()}
});
root.addEventListener('input',e=>{
 if(e.target.id==='tm-policy-catalog-search')root.querySelector('#tm-policy-catalog-results').innerHTML=policyNationalCatalogRows(e.target.value);
 if(e.target.id==='tm-policy-scope-detail'){policyScopeDetail=e.target.value;policyRefreshScopeResult()}
});
function policyPublishedSearchMatch(index,q){
 const place=PolicyRegionRules.catalog[index];if(!place)return false;
 const paths=policySelectedKeys().flatMap(key=>policyPathsForPlace(policyPublishedScopes.get(key),place));
 return [place.province,PolicyRegionRules.provinceNames[place.province],place.name,...place.aliases,...paths.map(p=>p.join(''))].join('').replace(/\s/g,'').includes(q.replace(/\s/g,''));
}
window.addEventListener('storage',e=>{
 if(window.CNCHOME_LIVE||window.PolicySync?.enabled)return;
 if(e.key!==policyStorageKey&&e.key!==intakeCodeStorageKey&&e.key!==policyClientStorageKey)return;
 try{
  intakeCodes=IntakeCodeCatalog.read(localStorage.getItem(intakeCodeStorageKey));
  regionCarrierSettings.splice(1,regionCarrierSettings.length-1,...intakeCodes.map(c=>({...c,visible:true,enabled:true})));
  policyClients=policyReadClients(localStorage.getItem(policyClientStorageKey));
  for(const [selector,value] of [['#tm-policy-publication-client',policyPublicationClient],['#tm-region-client',policyViewClient]]){const select=root.querySelector(selector);if(select)select.innerHTML=policyClientOptions(value)}
  const next=policyReadPublications(localStorage.getItem(policyStorageKey));
  if(Object.keys(next).length){policyPublications=next;policyRebuildPublishedRegions()}
  intakeCodeRefreshViews();
 }catch(error){toast('다른 탭의 변경 내용을 읽지 못했습니다. 새로고침 후 확인해 주세요.')}
});
try{
 if(!window.CNCHOME_LIVE&&!window.PolicySync?.enabled)policyPublications=policyReadPublications(localStorage.getItem(policyStorageKey));policyRebuildPublishedRegions();
 const latest=Object.values(policyPublications).sort((a,b)=>b.savedAt.localeCompare(a.savedAt))[0];
 if(latest){policyRegisteredRows=policyCleanRows(latest.rows);policyRegisteredKey=policyClientKey(latest.carrier,latest.kind,latest.client);policyViewClient=latest.client;policyRebuildPublishedRegions();policyRegisteredCode=policyKeyLabel(policyRegisteredKey);policyPublicationCarrier=latest.carrier;policyPublicationKind=latest.kind;}
}catch(error){/* Keep the original screen when no valid saved policy is available. */}



function policyRegistrationMessage(message,kind='info'){
 policyRegistrationStatus={message:String(message),kind};
 const el=root.querySelector('#tm-policy-register-status');if(!el)return;
 el.textContent=policyRegistrationStatus.message;el.hidden=false;el.dataset.state=kind;
 el.setAttribute('role',kind==='error'?'alert':'status');
 el.style.background=kind==='error'?'#fff1f2':kind==='success'?'#ecfdf5':'#eef4ff';
}
async function policyRegister({reviewed=false}={}){
 if(policyRegistrationPending)return false;
 policyRegistrationPending=true;const button=root.querySelector('[data-action="policy-register"]');
 if(button){button.disabled=true;button.textContent='저장 중…';}
 try{
  policyRegistrationMessage('등록 내용을 확인하고 있습니다.','progress');
  if(!policyRows.length&&!policyImageData&&root.querySelector('#tm-policy-paste')?.value.trim())policyConvertText();
  if(!policyRows.length)throw new Error('먼저 정책표를 붙여넣고 변환 버튼을 눌러 주세요.');
  if(window.PolicySync?.enabled&&!PolicySync.ready){
   policyRegistrationMessage('서버 정책 연결을 다시 확인하고 있습니다.','progress');
   if(!await PolicySync.load())throw new Error(PolicySync.error||'정책 DB를 불러오지 못했습니다. 다시 로그인한 뒤 등록해 주세요.');
  }
  const inputs=[...root.querySelectorAll('[data-city-row]')];
  if(inputs.some(input=>!input.value.trim()))throw new Error('지역명이 빈 행을 확인해 주세요.');
  for(const input of inputs){const index=Number(input.dataset.cityRow),value=input.value.trim();if(policyRows[index]&&policyRows[index][0]!==value){policyCityAudit.push({row:index,from:policyRows[index][0],to:value,reason:'등록 시 직접 수정'});policyRows[index][0]=value;}}
  policyCityDrafts.clear();policySyncCityText();
  const rows=policyCleanRows(policyRows),client=policyPublicationClient,carrier=policyPublicationCarrier,reviewedFingerprint=JSON.stringify(policyRows);
  if(!await policyPublishRows({reviewed}))return false;
  if(reviewed){policyConfirmedRows=reviewedFingerprint;policyUpdateCheckCount();}
  policyRegistered=true;policyRegisteredRows=rows;
  policyRegisteredKey=policyPublicationKind==='auto'?'':policyClientKey(carrier,policyPublicationKind,client);
  policyRegisteredCode=policyRegisteredKey?policyKeyLabel(policyRegisteredKey):'일반 · 60세 이하 / 실버 · 61~70세 자동 분류';
  policyScopeSelected=0;policyScopeCity='';policyScopeDetail='';policyRefreshPreview();policyRefreshRegistered();
  const message=window.PolicySync?.enabled?(reviewed?'전체 확인 완료 · ':'')+'DB 저장 및 재조회 확인 완료. 상담원 접수 가능지역에서 확인할 수 있습니다.':'정책표를 저장했습니다.';
  toast(message);policyRegistrationMessage(message,'success');return true;
 }catch(error){toast(error.message||'정책 등록 중 오류가 발생했습니다.');policyRegistrationMessage(error.message||'정책 등록 중 오류가 발생했습니다.','error');return false;}
 finally{policyRegistrationPending=false;const current=root.querySelector('[data-action="policy-register"]');if(current){current.disabled=false;current.textContent='정책표 등록';}}
}

function policyServerStatusMarkup(){
 if(!window.PolicySync?.enabled)return '';
 const message=PolicySync.error||(!PolicySync.ready?'서버 정책을 불러오는 중입니다.':PolicySync.saving?'서버 DB에 저장 중입니다.':'서버 DB 정책 · 직원 페이지와 공유됩니다.');
 return '<div class="sub" data-policy-server-status role="status">'+policyEscape(message)+' <button type="button" class="secondary" data-policy-server-refresh>최신 정책 불러오기</button></div>';
}
let policyLoadedDepartment=null;
function policyServerApply(data){
 const departmentChanged=policyLoadedDepartment!==null&&policyLoadedDepartment!==data.department;
 if(departmentChanged){policyRows=[];policyRegisteredRows=[];policyRegisteredKey='';policyRegisteredCode='';policyPublicationClient='legacy';policyViewClient='legacy';}
 policyLoadedDepartment=data.department;
 const codes=IntakeCodeCatalog.read(JSON.stringify({version:1,codes:data.codes})),clients=policyReadClients(JSON.stringify({version:1,clients:data.clients}));
 const publications=policyReadPublications(JSON.stringify({version:1,policies:data.policies}),codes);
 intakeCodes=codes;policyClients=clients;policyPublications=publications;
 if(!policyPublicationClient&&clients.length===1)policyPublicationClient=clients[0].id;
 if(!PolicySync.ready||departmentChanged){
  const latest=Object.values(publications).sort((a,b)=>b.savedAt.localeCompare(a.savedAt))[0];
  if(latest){policyViewClient=latest.client;policyPublicationCarrier=latest.carrier;policyPublicationKind=latest.kind;policyRegisteredRows=policyCleanRows(latest.rows);policyRegisteredKey=policyClientKey(latest.carrier,latest.kind,latest.client);policyRegisteredCode=policyKeyLabel(policyRegisteredKey);}
 }

 regionCarrierSettings.splice(1,regionCarrierSettings.length-1,...intakeCodes.map(c=>({...c,visible:true,enabled:true})));
 if(policyRegisteredKey)policyRegisteredCode=policyKeyLabel(policyRegisteredKey);
 policyRebuildPublishedRegions();
 if(!policyClients.some(c=>c.id===policyViewClient))policyViewClient='legacy';
 // Keep the administrator's in-progress table; only refresh shared catalog choices.
 for(const [selector,value,html] of [
  ['#tm-policy-publication-client',policyPublicationClient,policyClientOptions(policyPublicationClient)],
  ['#tm-region-client',policyViewClient,policyClientOptions(policyViewClient)],
  ['#tm-policy-publication-carrier',policyPublicationCarrier,intakeCodeOptions(policyPublicationCarrier)]]){
  const select=root.querySelector(selector);if(select){select.innerHTML=html;select.value=value;}
 }
}
function policyServerNotify(){
 for(const target of root.querySelectorAll('[data-policy-server-status]'))target.outerHTML=policyServerStatusMarkup();
 const button=root.querySelector('[data-action="policy-register"]');if(button){button.disabled=policyRegistrationPending||PolicySync.saving;button.textContent=button.disabled?'저장 중…':'정책표 등록';}
 if(['adminIntake','adminPolicy'].includes(page))policyRefreshRegistered();
 if(page==='regions'){
  const search=root.querySelector('#tm-region-search')?.value,age=root.querySelector('#tm-customer-age')?.value,kind=root.querySelector('#tm-age')?.selectedIndex;
  render();
  if(search!==undefined&&root.querySelector('#tm-region-search'))root.querySelector('#tm-region-search').value=search;
  if(age!==undefined&&root.querySelector('#tm-customer-age'))root.querySelector('#tm-customer-age').value=age;
  if(kind!==undefined&&root.querySelector('#tm-age'))root.querySelector('#tm-age').selectedIndex=kind;
  if(policyHasPublications())filterRegions();
 }
}
async function policySaveClientServer(input){
 try{const data=await PolicySync.save({action:'client',...input});return data.changedId;}catch(error){toast(error.message);return false;}
}
async function policySaveCodeServer(input){
 try{await PolicySync.save({action:'code',...input});intakeCodeRefreshViews();return true;}catch(error){toast(error.message);return false;}
}
async function policyPublishServer(groups,reviewed=false){
 const client=policyPublicationClient,carrier=policyPublicationCarrier;let acknowledged=false;
 try{
  await PolicySync.save({action:'publish',client,carrier,groups,reviewed});
  acknowledged=true;policyRegistrationMessage('DB 저장 응답을 받았습니다. 저장된 정책을 다시 조회하고 있습니다.','progress');
  const saved=await PolicySync.readback();
  for(const [kind,rows] of Object.entries(groups)){
   const key=policyClientKey(carrier,kind,client),item=saved.policies[key];
   if(!item||JSON.stringify(item.rows)!==JSON.stringify(rows))throw new Error('DB 저장 후 조회 내용이 달라졌습니다. 다른 관리자 변경 여부를 확인한 뒤 최신 정책을 불러와 주세요.');
  }
  intakeCodeRefreshViews();return true;
 }catch(error){const message=(acknowledged?'DB 저장 응답은 받았지만 재조회 확인에 실패했습니다. 최신 정책을 불러와 저장 여부를 확인해 주세요. ':'')+error.message;toast(message);policyRegistrationMessage(message,'error');return false;}
}

root.addEventListener('click',e=>{if(e.target.closest('[data-policy-server-refresh]'))PolicySync.load();});
window.PolicySync?.init({apply:policyServerApply,notify:policyServerNotify,active:()=>['regions','adminPending'].includes(page)||(['adminIntake','adminPolicy'].includes(page)&&!policyRows.length&&!modal.open)});

AdminWorkspace.init({root,employees:adminEmployees,dailyAward:(count,employee='staff-0',department)=>count?gradeCalculate(gradePolicyAt(gradeEntries,gradeToday(),department||gradeEmployeeDepartment(employee)),'daily',count).achievement:0,render,open,close:()=>modal.close(),toast});
HRWorkspace.init({root,render,toast});
window.SalesWorkspace?.init({root,render,open,close:()=>modal.close(),toast,homeGrades:homeGradeCriteria});
window.DailyGradeWorkspace?.init({root,render});
window.addEventListener('hashchange',()=>{page=pageFromUrl();render();main.scrollTop=0});
render();
if(new URL(window.CNCPageUrl||location.href).searchParams.get('intakeWindow')==='1')intake();
})();
