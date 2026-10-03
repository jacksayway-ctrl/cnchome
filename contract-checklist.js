(()=>{
 'use strict';
 const live=window.CNCHOME_LIVE;if(!live||live.user.role!=='admin')return;
 const departments={insurance:'보험',cosmetics:'화장품',health:'건강보조식품'},labels={all:'전체 직원',missing:'미작성',pending:'작성 대기',completed:'작성 완료',renewal:'갱신 확인'};
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let data=null,error='',loading=false,open=false,filter='all',lastRead=0;
 const markup=()=>'<section class="panel contract-checklist-panel" data-contract-checklist><p class="sub" role="status">근로계약서 현황을 불러오는 중입니다.</p></section>';
 function content(){
  if(!data)return '<div class="row"><h3>근로계약서 작성</h3><button type="button" class="secondary" data-contract-checklist-refresh>새로고침</button></div><p class="sub" role="status">'+esc(error||'계약 현황을 불러오는 중입니다.')+'</p>';
  const rows=data.records.filter(r=>filter==='all'||(filter==='renewal'?r.renewal:r.group===filter));
  const summary='근로계약서 작성 · 미작성 '+data.counts.missing+'명 · 작성 대기 '+data.counts.pending+'명 · 작성 완료 '+data.counts.completed+'명 · 갱신 확인 '+data.counts.renewal+'명';
  return '<details data-contract-checklist-details'+(open?' open':'')+'><summary>'+summary+'</summary><div class="contract-checklist-toolbar"><div role="group" aria-label="계약 상태별 조회">'+Object.entries(labels).map(([key,label])=>'<button type="button" class="secondary" data-contract-checklist-filter="'+key+'" aria-pressed="'+(filter===key)+'">'+label+' '+(key==='all'?data.total:data.counts[key])+'명</button>').join('')+'</div><button type="button" class="secondary" data-contract-checklist-refresh'+(loading?' disabled':'')+'>새로고침</button></div><p class="sub">'+esc(data.today)+' 기준 · 재직·휴직 직원 '+data.total+'명 · 갱신 확인: 만료 또는 30일 이내. 퇴사·사용중지·테스트 직원 '+data.excluded+'명 제외.</p>'+(error?'<p role="alert" class="sub">'+esc(error)+'</p>':'')+'<div class="scroll"><table><thead><tr>'+['직원 / 사번','부서','작성 상태','현재 계약기간','갱신까지 남은 기간','관리'].map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr><td><strong>'+esc(r.name)+'</strong><br><small class="sub">'+esc(r.employeeNo)+'</small></td><td>'+esc(departments[r.department]||r.department)+'</td><td><span class="contract-checklist-state '+esc(r.group)+'">'+esc(r.status)+'</span>'+(r.version?'<small class="sub"> · '+r.version+'차</small>':'')+(r.payType==='월급제'&&r.group==='missing'?'<br><small class="sub">별도 계약 양식 확인</small>':'')+'</td><td>'+esc(r.start||'미입력')+' ~ '+esc(r.end||((r.renewalText==='기간의 정함 없음')?'기간의 정함 없음':'미입력'))+'<br><small class="sub">'+esc(r.periodSource)+'</small></td><td class="'+(r.renewal?'contract-checklist-due':'')+'">'+esc(r.renewalText)+(r.nextStart&&r.renewal?'<br><small class="sub">다음 계약 '+esc(r.nextStart)+' 시작 예정</small>':'')+'</td><td><a href="'+esc(r.url)+'" data-contract-checklist-link>'+ (r.group==='missing'?'작성 관리':'계약 확인')+'</a></td></tr>').join(''):'<tr><td colspan="6">해당 상태의 직원이 없습니다.</td></tr>')+'</tbody></table></div></details>';
 }
 function paint(){for(const el of document.querySelectorAll('[data-contract-checklist]'))el.innerHTML=content();}
 async function load(force=false){
  if(loading||(!force&&Date.now()-lastRead<30000))return;loading=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch('/contract-checklist-api.php?role=admin',{credentials:'same-origin',cache:'no-store',signal:controller.signal});const result=await response.json();if(!response.ok)throw Error(result.error||'계약 현황을 불러오지 못했습니다.');data=result;error='';lastRead=Date.now();}
  catch(e){error=e.name==='AbortError'?'응답이 지연되고 있습니다. 새로고침해 주세요.':e.message;}finally{clearTimeout(timeout);loading=false;paint();}
 }
 document.addEventListener('toggle',event=>{if(event.target.matches?.('[data-contract-checklist-details]'))open=event.target.open;},true);
 document.addEventListener('click',event=>{
  const refresh=event.target.closest('[data-contract-checklist-refresh]');if(refresh){load(true);return;}
  const button=event.target.closest('[data-contract-checklist-filter]');if(button){filter=button.dataset.contractChecklistFilter;open=true;paint();document.querySelector('[data-contract-checklist-filter="'+filter+'"]')?.focus({preventScroll:true});return;}
  const link=event.target.closest('[data-contract-checklist-link]');if(link&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();const child=window.open(link.href,'cnc-contract-checklist','popup,width='+Math.min(1360,screen.availWidth)+',height='+Math.min(920,screen.availHeight)+',resizable=yes,scrollbars=yes');if(child)child.focus();else location.assign(link.href);}
 });
 function mount(){if(!document.querySelector('[data-contract-checklist]'))return;paint();load();}
 function start(){const main=document.getElementById('tm-main');if(main)new MutationObserver(mount).observe(main,{childList:true});mount();}
 window.ContractChecklist={markup};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.addEventListener('focus',()=>{if(document.querySelector('[data-contract-checklist]'))load(true);});
 setInterval(()=>{if(!document.hidden&&document.querySelector('[data-contract-checklist]'))load(true);},60000);
})();
