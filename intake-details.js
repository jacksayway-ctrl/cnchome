(function(global){
 'use strict';
 const compact=value=>String(value||'').replace(/\s/g,'');
 const codeName=value=>compact(value).replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
 const policyScopes=new WeakMap();
 function scopesFor(policy,snapshot,rules){
  let cached=policyScopes.get(policy);
  if(!cached||cached.rows!==policy.rows||cached.codes!==snapshot.codes||cached.rules!==rules){cached={rows:policy.rows,codes:snapshot.codes,rules,scopes:rules.parseRows(policy.rows,{intakeCodes:snapshot.codes})};policyScopes.set(policy,cached);}
  return cached.scopes;
 }
 function birthInfo(year,month,day,date){
  const result={age:null,kind:null,birthDate:'',error:''};
  if(!/^\d{4}$/.test(String(year)))return result;
  if(Number(year)<1900||Number(year)>Number(date.slice(0,4))){result.error='출생연도를 확인해 주세요.';return result;}
  result.age=Number(date.slice(0,4))-Number(year)+1;result.kind=result.age<=60?'general':result.age<=70?'silver':null;
  if(!month||!day)return result;
  const m=Number(month),d=Number(day),value=new Date(Date.UTC(Number(year),m-1,d));
  if(!/^\d{1,2}$/.test(String(month))||!/^\d{1,2}$/.test(String(day))||m<1||m>12||d<1||d>31||value.getUTCFullYear()!==Number(year)||value.getUTCMonth()!==m-1||value.getUTCDate()!==d){result.error='올바른 생년월일을 입력해 주세요.';return result;}
  result.birthDate=year+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  if(result.birthDate>date)result.error='생년월일은 접수일 이후일 수 없습니다.';
  return result;
 }
 function placeIndex(catalog){
  const list=[],provinceAliases=key=>[catalog.provinceNames[key],key,...(key==='강원'?['강원도']:key==='전북'?['전라북도']:[])];
  for(const [province,name] of Object.entries(catalog.provinceNames)){
   const metro=catalog.municipalities.find(item=>item.province===province&&item.metropolitan);
   list.push({id:province,label:name,aliases:provinceAliases(province),place:metro?{province,name:metro.name,path:[]}:null});
  }
  for(const city of catalog.municipalities){
   if(city.metropolitan)continue;
   list.push({id:city.id,label:catalog.provinceNames[city.province]+' '+city.name,aliases:[...city.aliases,...provinceAliases(city.province).flatMap(p=>city.aliases.map(a=>p+a))],place:{province:city.province,name:city.name,path:[]}});
  }
  for(const district of catalog.districts){
   const parent=catalog.municipalities.find(item=>item.id===district.parentId),local=[district.name,district.name.replace(/구$/,'')];
   const prefixes=district.autonomous?provinceAliases(district.province):provinceAliases(district.province).flatMap(p=>(parent?.aliases||[district.parent]).map(a=>p+a));
   list.push({id:district.id,label:catalog.provinceNames[district.province]+' '+(district.autonomous?'':district.parent+' ')+district.name,aliases:[...local,...prefixes.flatMap(p=>local.map(a=>p+a))],place:{province:district.province,name:district.parent,path:[district.name]}});
  }
  return list;
 }
 function resolveLocation(value,index){
  const input=compact(value);if(!input)return null;
  let length=0,matches=[];
  for(const item of index)for(const alias of item.aliases){const key=compact(alias);if(!key||!input.startsWith(key))continue;if(key.length>length){length=key.length;matches=[item];}else if(key.length===length&&!matches.some(x=>x.id===item.id))matches.push(item);}
  if(matches.length!==1)return null;
  const item=matches[0];if(!item.place)return {label:item.label,place:null};
  // Preserve only complete administrative suffixes. Café/building text is not a region.
  let offset=0,consumed=0;while(offset<value.length&&consumed<length){if(!/\s/.test(value[offset]))consumed++;offset++;}
  const tail=value.slice(offset).trim(),path=[...item.place.path];
  for(const token of tail.split(/\s+/)){if(/^[가-힣0-9·]+(?:읍|면|동|리)$/.test(token))path.push(token);else break;}
  const children=index.filter(x=>x.place&&x.place.province===item.place.province&&x.place.name===item.place.name&&x.place.path.length>item.place.path.length);
  const incomplete=!!tail&&children.some(child=>child.place.path[item.place.path.length]?.startsWith(tail));
  return {label:item.label+(path.length>item.place.path.length?' '+path.slice(item.place.path.length).join(' '):''),place:{...item.place,path},incomplete};
 }
 function assess(snapshot,rules,location,kind,carrier){
  if(!snapshot)return {state:'review',text:'정책을 불러오는 중입니다.',items:[]};
  if(!location?.place||location.incomplete)return {state:'review',text:'상담 장소의 시·군·구를 선택하면 접수 가능 여부를 표시합니다.',items:[]};
  const wanted=codeName(carrier),codes=snapshot.codes.filter(code=>!wanted||[code.id,code.label,...(code.aliases||[])].some(name=>codeName(name)===wanted));
  if(!codes.length)return {state:'review',text:'입력한 접수 코드를 찾을 수 없습니다. GA·한화·신한 등 등록 코드를 확인해 주세요.',items:[]};
  const items=[];
  for(const code of codes){
   const policies=Object.values(snapshot.policies).filter(p=>p.carrier===code.id&&p.kind===kind);
   if(!policies.length){items.push({label:code.label,state:'review',reason:'해당 연령의 정책 미등록',quantity:null});continue;}
   for(const policy of policies){const result=rules.evaluate(scopesFor(policy,snapshot,rules),location.place);items.push({...result,label:code.label+(snapshot.clients.length>1?' / '+(snapshot.clients.find(c=>c.id===policy.client)?.label||'거래처'):'')});}
  }
  const state=items.some(x=>x.state==='possible')?'possible':items.some(x=>x.state==='partial')?'partial':items.some(x=>x.state==='review')?'review':'blocked';
  const text={possible:'접수 가능 · '+location.label,partial:'상세 지역 확인 필요 · '+location.label+'의 일부 구·읍·면·동만 가능하거나 제외됩니다.',review:'확인 필요 · 등록 정책이나 해당 지역의 범위·수량을 확인해 주세요.',blocked:'접수 불가 · '+location.label+'에 적용되는 접수 가능 수량이 없습니다.'}[state];
  return {state,text,items};
 }
 let cleanup=()=>{};
 function attach(form,options){
  if(!form)return;cleanup();
  const fields=form.elements,index=placeIndex(global.KoreaRegionCatalog),panel=form.querySelector('[data-intake-eligibility]'),summary=form.querySelector('[data-intake-decision]'),list=form.querySelector('[data-intake-options]');
  const labels={possible:'가능',partial:'일부 가능 · 상세 확인',review:'확인 필요',blocked:'불가'};
  function update(){
   const info=birthInfo(fields.birthYear.value,fields.birthMonth.value,fields.birthDay.value,fields.date.value),team=options.team();
   fields.birthDay.setCustomValidity(info.error);form.querySelector('[data-age-number]').value=info.age===null?'—':info.age+'세';
   form.querySelector('[data-age-kind]').value=info.age===null?'—':!info.kind?'연령 초과':info.kind==='silver'?'실버':'일반';
   form.querySelector('[data-sales-age]').textContent=info.error||'세는나이 기준 · 60세 이하 일반 / 61~70세 실버';
   let result;
   if(team!=='insurance')result={state:'review',text:team?'보험 접수 정책 적용 대상이 아닙니다.':'담당 직원을 선택하면 해당 부서의 접수 기준을 확인합니다.',items:[]};
   else if(info.error||info.age===null)result={state:'review',text:info.error||'생년월일을 입력하면 나이에 맞는 접수 정책을 확인합니다.',items:[]};
   else if(!info.kind)result={state:'blocked',text:'접수 불가 · 보험 접수는 세는나이 70세까지 가능합니다.',items:[]};
   else if(global.PolicySync?.error)result={state:'review',text:'정책 조회 실패 · 연결을 확인한 뒤 다시 확인해 주세요.',items:[]};
   else result=assess(global.PolicySync?.snapshot,global.PolicyRegionRules,resolveLocation(fields.consultationPlace.value,index),info.kind,fields.carrier.value);
   panel.dataset.state=result.state;summary.textContent=result.text;list.replaceChildren();
   for(const item of result.items){const badge=global.document.createElement('span');badge.dataset.state=item.state;badge.textContent=item.label+' '+labels[item.state]+(item.quantity!==null&&item.quantity!==undefined?' '+item.quantity+'건':'');badge.title=item.reason;list.append(badge);}
  }
  function input(event){
   const el=event.target;if(['birthYear','birthMonth','birthDay'].includes(el.name)&&!event.isComposing){el.value=el.value.replace(/\D/g,'').slice(0,el.maxLength);const next={birthYear:'birthMonth',birthMonth:'birthDay'}[el.name];const valid=el.name==='birthYear'?Number(el.value)>=1900&&Number(el.value)<=Number(fields.date.value.slice(0,4)):Number(el.value)>=1&&Number(el.value)<=12;if(next&&el.value.length===el.maxLength&&valid)fields[next].focus();}
   update();
  }
  form.addEventListener('input',input);form.addEventListener('change',update);
  const unsubscribe=global.PolicySync?.subscribe(update)||(()=>{}),dialog=form.closest('dialog');
  cleanup=()=>{unsubscribe();form.removeEventListener('input',input);form.removeEventListener('change',update);dialog?.removeEventListener('close',onClose);};
  function onClose(){cleanup();}dialog?.addEventListener('close',onClose,{once:true});
  update();global.PolicySync?.load();
 }
 const api={attach,core:{birthInfo,placeIndex,resolveLocation,assess}};if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.IntakeDetails=api;
})(typeof window!=='undefined'?window:globalThis);
