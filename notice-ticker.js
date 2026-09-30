(function(global){
 'use strict';
 function mergeActivity(previous,incoming){const items=new Map(previous.map(item=>[item.id,item]));for(const item of incoming)items.set(item.id,item);return [...items.values()].sort((a,b)=>a.id-b.id).slice(-100);}
 function changedNotices(previous,incoming){const old=new Map(previous.map(item=>[item.id,item]));return incoming.filter(item=>!old.has(item.id)||old.get(item.id).title!==item.title||old.get(item.id).body!==item.body);}
 function attach(bar){
  const live=global.CNCHOME_LIVE;if(!live||bar.dataset.noticeAttached)return;bar.dataset.noticeAttached='true';
  const doc=global.document,area=bar.querySelector('.cnc-notice-area')||doc.createElement('div');area.className='cnc-notice-area';area.replaceChildren();bar.prepend(area);
  let company=live.notices?.company||[],activity=live.notices?.activity||[],cursor=live.notices?.cursor??null,busy=false,dialog=null;
  const url=()=>'/notices-api.php?role='+encodeURIComponent(live.user.role)+(cursor===null?'':'&after='+cursor);
  function element(tag,className,text){const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function showDialog(title){if(dialog)dialog.remove();dialog=element('dialog','cnc-notice-dialog');dialog.setAttribute('aria-label',title);const head=element('div','cnc-notice-dialog-heading');head.append(element('h2','',title));const close=element('button','','닫기');close.type='button';close.addEventListener('click',()=>dialog.close());head.append(close);dialog.append(head);doc.body.append(dialog);dialog.showModal();return dialog;}
  function showList(channel){
   if(channel==='company'){global.location.assign('/notices.php?role='+encodeURIComponent(live.user.role));return;}
   const list=channel==='company'?company:activity.slice().reverse(),box=showDialog(channel==='company'?'회사 공지사항':'정책 수량 감소 알림');
   if(!list.length)box.append(element('p','','아직 등록된 내용이 없습니다.'));
   for(const item of list){const card=element('article','cnc-notice-card');card.append(element('strong','',item.title),element('p','',item.body),element('small','',new Date(item.createdAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})));box.append(card);}
  }
  function channel(label,key,empty){
   const box=element('section','cnc-notice-channel'),heading=element('strong','cnc-notice-label',label),viewport=element('button','cnc-notice-viewport'),text=element('span','cnc-notice-text',empty);
   viewport.type='button';viewport.setAttribute('aria-label',label+' 전체 보기');viewport.append(text);viewport.addEventListener('click',()=>showList(key));heading.style.cursor='pointer';heading.addEventListener('click',()=>showList(key));box.append(heading,viewport);area.append(box);
   let items=[],pending=[],current=null,index=0,timer=null,paused=false;
   const reduced=()=>global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   function animate(){
    clearTimeout(timer);text.style.animation='none';text.style.transform='';
    if(!current)return;
    if(reduced()){text.style.transform='translateX(0)';if(!paused)timer=setTimeout(next,8000);return;}
    const start=viewport.clientWidth||240,end=text.scrollWidth||Math.max(100,text.textContent.length*8);
    text.style.setProperty('--cnc-notice-start',start+'px');text.style.setProperty('--cnc-notice-end',-end+'px');text.style.setProperty('--cnc-notice-duration',Math.max(8,(start+end)/55)+'s');
    void text.offsetWidth;text.style.animation='';text.style.animationPlayState=paused?'paused':'running';
   }
   function next(){
    if(!items.length){current=null;text.textContent=empty;viewport.title=empty;animate();return;}
    current=pending.shift()||items[index++%items.length];
    text.textContent=current.title+' · '+current.body;viewport.title=text.textContent;animate();
   }
   text.addEventListener('animationend',next);
   function pause(){paused=true;clearTimeout(timer);text.style.animationPlayState='paused';}
   function resume(){paused=false;if(reduced())timer=setTimeout(next,8000);else text.style.animationPlayState='running';}
   box.addEventListener('mouseenter',pause);box.addEventListener('mouseleave',resume);box.addEventListener('focusin',pause);box.addEventListener('focusout',resume);
   return {box,update(nextItems){const changes=changedNotices(items,nextItems);items=nextItems;pending=pending.filter(item=>items.some(value=>value.id===item.id));for(const item of changes){pending=pending.filter(value=>value.id!==item.id);pending.push(item);}if(!current||!items.some(item=>item.id===current.id))next();},resize:animate,error(message){viewport.title=message;if(!current){text.textContent=message;text.style.animation='none';}}};
  }
  const left=channel('회사 공지','company','접수 가능지역을 확인한 후 상담해 주세요.'),right=channel('정책 수량 감소','activity','새로운 수량 감소 알림이 없습니다.');
  left.update(company.slice().reverse());right.update(activity);
  async function refresh(body){
   if(busy)return;busy=true;
   try{const response=await global.fetch(url(),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':live.csrf},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||'공지를 불러오지 못했습니다.');company=data.company||[];activity=mergeActivity(activity,data.activity||[]);cursor=Number(data.cursor)||0;left.update(company.slice().reverse());right.update(activity);return true;}
   catch(error){if(body)throw error;left.error('공지 연결 확인 중 · 잠시 후 다시 불러옵니다.');right.error('수량 감소 알림 연결 확인 중');return false;}
   finally{busy=false;}
  }
  function manage(){
   const box=showDialog('회사 공지 관리'),form=element('form','cnc-notice-form'),message=element('p','cnc-notice-error');message.setAttribute('role','alert');
   form.innerHTML='<label>공지 제목<input name="title" maxlength="120" required></label><label>공지 대상<select name="department"><option value="">전체 직원</option><option value="insurance">보험팀</option><option value="cosmetics">화장품팀</option><option value="health">건강보조식품팀</option></select></label><label>공지 내용<textarea name="body" rows="4" maxlength="1500" required></textarea></label><button type="submit">공지 등록</button>';
   const requestKey=global.crypto.randomUUID();form.append(message);box.append(form,element('h3','','게시 중인 공지'));
   form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity()||busy)return;const submit=form.querySelector('[type="submit"]');submit.disabled=true;message.textContent='';try{const input=Object.fromEntries(new global.FormData(form));if(await refresh({...input,action:'publish',requestKey}))manage();}catch(error){message.textContent=error.message;}finally{submit.disabled=false;}});
   for(const item of company){const card=element('article','cnc-notice-card'),end=element('button','','게시 종료');end.type='button';card.append(element('strong','',item.title),element('p','',item.body),end);box.append(card);end.addEventListener('click',async()=>{if(busy)return;end.disabled=true;try{if(await refresh({action:'archive',id:item.id}))manage();}catch(error){message.textContent=error.message;end.disabled=false;}});}
  }
  if(live.user.role==='admin'){const button=element('button','cnc-notice-manage','관리');button.type='button';button.setAttribute('aria-label','회사 공지 관리');button.addEventListener('click',manage);left.box.append(button);}
  global.addEventListener('resize',()=>{left.resize();right.resize();});global.addEventListener('focus',()=>refresh());
  global.setInterval(()=>{if(!doc.hidden)refresh();},5000);refresh();
 }
 const api={attach,core:{mergeActivity,changedNotices}};if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.NoticeTicker=api;
})(typeof window!=='undefined'?window:globalThis);
