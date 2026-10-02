(()=>{
 'use strict';
 if(window.CNCHOME_POLICY?.role!=='admin'&&window.CNCHOME_LIVE?.user?.role!=='admin')return;
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=value=>{const d=new Date(/Z|[+]\d\d:\d\d$/.test(value)?value:value.replace(' ','T')+'Z');return Number.isNaN(d.getTime())?'등록일 미확인':d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});};
 const actions={publish:'정책 업로드·변경',client:'거래처 변경',code:'접수 코드 변경'};
 const department=()=>{const value=new URL(window.CNCPageNavigation?.url()||location.href).searchParams.get('department')||new URL(window.CNCPageNavigation?.url()||location.href).searchParams.get('team');return ['insurance','cosmetics','health'].includes(value)?value:'insurance';};
 let history=[],next=null,revision=null,loading=false;
 async function read(params){const response=await fetch('/intake-policy-api.php?role=admin&history=1&department='+department()+params,{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'정책 이력을 불러오지 못했습니다.');return data;}
 function policies(state){
  const rows=Object.entries(state?.policies||{}).sort((a,b)=>String(b[1].savedAt).localeCompare(String(a[1].savedAt)));
  return rows.map(([key,item])=>{const client=state.clients?.find(x=>x.id===item.client)?.label||item.client,carrier=state.codes?.find(x=>x.id===item.carrier)?.label||item.carrier,kind=item.kind==='silver'?'실버':'일반';
   return '<details class="policy-history-item"><summary>'+escape(date(item.savedAt))+' · '+escape(client)+' · '+escape(carrier)+' · '+kind+' · '+Math.max(0,item.rows.length-1)+'행</summary><div class="scroll"><table><thead><tr>'+item.rows[0].map(x=>'<th>'+escape(x)+'</th>').join('')+'</tr></thead><tbody>'+item.rows.slice(1).map(row=>'<tr>'+row.map(x=>'<td>'+escape(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></details>';
  }).join('')||'<p class="sub">등록된 정책이 없습니다.</p>';
 }
 function listing(){return history.map(row=>'<details class="policy-history-item" data-policy-history-id="'+Number(row.id)+'"><summary>'+escape(date(row.created_at))+' · '+escape(actions[row.action]||row.action)+' · '+escape(row.actor||'기록 없음')+' · 버전 '+Number(row.revision)+'</summary><div data-policy-history-content></div></details>').join('')+(next?'<button type="button" class="secondary" data-policy-history-more>이전 기록 더 보기</button>':'')||'<p class="sub">저장된 변경 이력이 없습니다.</p>';}
 async function loadHistory(target,more=false){
  if(loading)return;loading=true;
  try{const data=await read(more?'&before='+next:'');history=more?[...history,...data.history]:data.history;next=data.next;revision=window.PolicySync?.snapshot?.revision;target.innerHTML=listing();}
  catch(e){target.textContent=e.message;}finally{loading=false;}
 }
 function mount(){for(const target of document.querySelectorAll('[data-policy-history]:not([data-mounted])')){
  target.dataset.mounted='1';target.innerHTML='<details class="panel policy-history-current"><summary>등록 정책 목록 · 날짜별 펼쳐보기</summary><div data-policy-current-list>'+policies(window.PolicySync?.snapshot)+'</div></details><details class="panel" data-policy-history-list><summary>정책 업로드·변경 이력</summary><div data-policy-history-rows></div></details>';
  target.addEventListener('toggle',async e=>{
   if(!e.target.open)return;
   if(e.target.matches('[data-policy-history-list]')){const rows=e.target.querySelector('[data-policy-history-rows]');if(!rows.childNodes.length||revision!==window.PolicySync?.snapshot?.revision)loadHistory(rows);}
   if(e.target.matches('[data-policy-history-id]')&&!e.target.dataset.loaded){e.target.dataset.loaded='1';const content=e.target.querySelector('[data-policy-history-content]');content.textContent='불러오는 중…';try{const data=await read('&id='+e.target.dataset.policyHistoryId);content.innerHTML=policies(data.state);}catch(error){delete e.target.dataset.loaded;content.textContent=error.message;}}
  },true);
  target.addEventListener('click',e=>{if(e.target.closest('[data-policy-history-more]'))loadHistory(target.querySelector('[data-policy-history-rows]'),true);});
 }}
 function sync(){mount();for(const list of document.querySelectorAll('[data-policy-current-list]'))list.innerHTML=policies(window.PolicySync?.snapshot);}
 window.PolicySync?.subscribe(sync);const main=document.getElementById('tm-main');if(main)new MutationObserver(mount).observe(main,{childList:true,subtree:true});mount();
})();
