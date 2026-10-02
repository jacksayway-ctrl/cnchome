(()=>{
 'use strict';
 const root=document.querySelector('[data-intake-live]');if(!root)return;
 const form=root.querySelector('[data-live-filters]'),body=root.querySelector('[data-live-rows]'),status=root.querySelector('[data-live-status]');
 const teams={insurance:'보험',cosmetics:'화장품',health:'건강보조식품'},labels={pending:'가접수',normal:'정상접수',as:'A/S'};
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let page=1,pages=1,selected='',paused=false,busy=false,queued=false,version=0,latest=0,signature='',typing=false,timer,seen=false,inputUntil=0;
 const fresh=new Set();
 function filterChanged(){version++;page=1;latest=0;seen=false;fresh.clear();signature='';root.querySelector('[data-live-arrivals]').hidden=true;load(true);}
 function draw(data){
  const next=JSON.stringify(data.records);if(next!==signature){
   for(const row of data.records)if(seen&&Number(row.id)>latest)fresh.add(row.id);
   const focused=document.activeElement?.closest('[data-live-record]')?.dataset.liveRecord;
   body.innerHTML=data.records.length?data.records.map(r=>`<tr class="${fresh.has(r.id)?'intake-live-new':''}"><td>${esc(r.receivedAt||'—')}</td><td>${esc(r.date)}</td><td>${esc(teams[r.department]||r.department)}</td><td>${esc(r.employee)}</td><td><strong>${esc(r.customer)}</strong>${fresh.has(r.id)?'<span class="intake-live-new-badge">새 접수</span>':''}</td><td>${esc(r.phone)}</td><td>${esc(r.region||'—')}</td><td><span class="intake-status ${esc(r.status)}">${esc(labels[r.status]||r.status)}</span></td><td><a href="${esc(r.url)}" data-live-record="${esc(r.id)}">보기·수정</a></td></tr>`).join(''):'<tr><td colspan="9">조회 조건에 맞는 접수가 없습니다.</td></tr>';
   if(focused)body.querySelector('[data-live-record="'+CSS.escape(focused)+'"]')?.focus({preventScroll:true});signature=next;
  }
  for(const button of root.querySelectorAll('[data-live-filter]')){const key=button.dataset.liveFilter;button.setAttribute('aria-pressed',String(key===selected));button.querySelector('strong').textContent=(key?data.counts[key]:Object.values(data.counts).reduce((a,b)=>a+b,0)).toLocaleString('ko-KR');}
  page=data.page;pages=data.pages;root.querySelector('[data-live-pagination]').textContent=page+' / '+pages+' 페이지 · '+data.total.toLocaleString('ko-KR')+'건';
  root.querySelector('[data-live-page=prev]').disabled=page<=1;root.querySelector('[data-live-page=next]').disabled=page>=pages;
  if(data.newCount>0){const notice=root.querySelector('[data-live-arrivals]');notice.hidden=false;notice.textContent='새 접수 '+data.newCount+'건이 들어왔습니다.'+(page>1?' 첫 페이지에서 확인하세요.':'');}
  latest=Math.max(latest,data.latestId);seen=true;status.textContent=(paused?'자동 갱신 일시정지 · ':'5초마다 자동 갱신 · ')+'마지막 확인 '+data.checkedAt;
 }
 async function load(force=false){
  if(busy){if(force)queued=true;return;}
  if(!force&&(paused||document.hidden||typing||Date.now()<inputUntil))return;
  busy=true;const requestVersion=version,controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  const params=new URLSearchParams({role:'admin',team:form.elements.team.value,q:form.elements.q.value.trim(),status:selected,p:String(page),after:String(latest)});
  try{
   const response=await fetch('/intake-live-api.php?'+params,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   const data=await response.json();if(!response.ok)throw Error(data.error||'접수 목록을 불러오지 못했습니다.');
   if(requestVersion===version)draw(data);
  }catch(error){if(requestVersion===version)status.textContent=error.name==='AbortError'?'응답 지연 · 다시 확인 중입니다.':error.message;}
  finally{clearTimeout(timeout);busy=false;if(queued){queued=false;load(true);}}
 }
 form.addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);filterChanged();});
 form.addEventListener('reset',()=>{setTimeout(()=>{selected='';filterChanged();},0);});
 form.elements.team.addEventListener('change',filterChanged);
 form.elements.q.addEventListener('compositionstart',()=>{typing=true;clearTimeout(timer);version++;});
 form.elements.q.addEventListener('compositionend',()=>{typing=false;clearTimeout(timer);timer=setTimeout(filterChanged,300);});
 form.elements.q.addEventListener('input',()=>{inputUntil=Date.now()+600;version++;clearTimeout(timer);if(!typing)timer=setTimeout(filterChanged,300);});
 root.addEventListener('click',event=>{
  const target=event.target.closest('button,a');if(!target)return;
  if(target.hasAttribute('data-live-refresh'))load(true);
  if(target.hasAttribute('data-live-pause')){paused=!paused;target.setAttribute('aria-pressed',String(paused));target.textContent=paused?'자동 갱신 다시 시작':'자동 갱신 일시정지';if(paused)status.textContent='자동 갱신 일시정지';else load(true);}
  if(target.hasAttribute('data-live-filter')){selected=target.dataset.liveFilter;filterChanged();}
  if(target.hasAttribute('data-live-page')){page=Math.max(1,Math.min(pages,page+(target.dataset.livePage==='prev'?-1:1)));version++;load(true);}
  if(target.hasAttribute('data-live-record')&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();const child=window.open(target.href,'cnc-intake-management','popup,width='+Math.min(1360,screen.availWidth)+',height='+Math.min(920,screen.availHeight)+',resizable=yes,scrollbars=yes');if(child)child.focus();else location.assign(target.href);}
 });
 window.addEventListener('focus',()=>load());window.addEventListener('cnc:sales-changed',()=>load());
 window.addEventListener('storage',e=>{if(e.key==='cnchome.sales.changed')load();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
 setInterval(()=>load(),5000);load(true);
})();
