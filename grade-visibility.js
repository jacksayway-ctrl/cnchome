(()=>{
 'use strict';
 const live=window.CNCHOME_LIVE;if(!live)return;
 const labels={daily:'일그레이드',weekly:'주그레이드',monthly:'월그레이드'},departments={insurance:'보험',cosmetics:'화장품',health:'건강보조식품'};
 const drafts={},messages={};let saving='';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function settings(department){return live.gradeVisibility?.[department]||{daily:true,weekly:true,monthly:true,revision:0};}
 function visible(period){return live.user.role!=='employee'||settings(live.user.department)[period]!==false;}
 function editor(department){
  if(live.user.role!=='admin'||!departments[department])return '';
  const value=drafts[department]||settings(department);
  return `<section class="panel grade-visibility"><h3>${departments[department]} · 직원 화면 노출</h3><p class="sub">체크한 그레이드만 직원 홈·그레이드·상단에 표시합니다. 지급 기준과 급여 계산은 그대로 유지됩니다.</p><form method="post" data-grade-visibility="${department}"><div class="grade-visibility-options">${Object.entries(labels).map(([key,label])=>`<label><input type="checkbox" name="${key}"${value[key]?' checked':''}${saving===department?' disabled':''}>${label} <span data-visibility-label>${value[key]?'보임':'숨김'}</span></label>`).join('')}<button type="submit"${saving?' disabled':''}>${saving===department?'저장 중…':'노출 설정 저장'}</button></div><p class="sub" role="status">${esc(messages[department]||'부서마다 따로 저장됩니다.')}</p></form></section>`;
 }
 document.addEventListener('change',event=>{
  const form=event.target.closest('[data-grade-visibility]');if(!form||event.target.type!=='checkbox')return;
  const department=form.dataset.gradeVisibility;
  const draft=drafts[department]||{...settings(department)};drafts[department]=draft;
  for(const key of Object.keys(labels))draft[key]=form.elements[key].checked;
  event.target.closest('label').querySelector('[data-visibility-label]').textContent=event.target.checked?'보임':'숨김';
  messages[department]='수정 중 · 저장하면 직원 화면에 반영됩니다.';form.querySelector('[role=status]').textContent=messages[department];
 });
 document.addEventListener('submit',async event=>{
  const form=event.target.closest('[data-grade-visibility]');if(!form)return;event.preventDefault();if(saving)return;
  const department=form.dataset.gradeVisibility,value={...(drafts[department]||settings(department))};saving=department;
  form.querySelectorAll('input,button').forEach(el=>el.disabled=true);
  form.querySelector('[role=status]').textContent='저장 중…';
  try{
   const response=await fetch('/grade-visibility-api.php?role=admin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':live.csrf},body:JSON.stringify({department,...value})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'저장하지 못했습니다.');
   live.gradeVisibility=data.gradeVisibility;delete drafts[department];messages[department]='저장 완료 · 직원 화면에 반영했습니다.';
  }catch(error){messages[department]=error.message;}
  finally{saving='';const current=document.querySelector('[data-grade-visibility]');if(current)current.closest('.grade-visibility').outerHTML=editor(current.dataset.gradeVisibility);}
 });
 window.GradeVisibility={editor,visible,allVisible:()=>Object.keys(labels).every(visible),anyVisible:()=>Object.keys(labels).some(visible)};
})();
