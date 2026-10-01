(function(global){
 'use strict';
 const sdkUrl='https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
 const attached=new WeakMap();let sdkPromise=null,sequence=0;
 const clean=value=>typeof value==='string'?value.replace(/\s+/gu,' ').trim():'';
 const constructor=()=>global.kakao?.Postcode||global.daum?.Postcode;
 function load(){
  if(constructor())return Promise.resolve(constructor());
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise((resolve,reject)=>{
   const existing=[...global.document.scripts].find(script=>script.src===sdkUrl);
   const script=existing||global.document.createElement('script');let timer;
   function finish(error){
    global.clearTimeout(timer);script.removeEventListener('load',loaded);script.removeEventListener('error',failed);
    if(error){if(!existing)script.remove();reject(error);}else resolve(constructor());
   }
   function loaded(){finish(constructor()?null:Error('주소 검색을 불러오지 못했습니다.'));}
   function failed(){finish(Error('주소 검색에 연결하지 못했습니다.'));}
   script.addEventListener('load',loaded,{once:true});script.addEventListener('error',failed,{once:true});
   timer=global.setTimeout(failed,15000);
   if(!existing){script.src=sdkUrl;script.async=true;global.document.head.append(script);}
  }).catch(error=>{sdkPromise=null;throw error;});
  return sdkPromise;
 }
 function provinceName(value){
  const names=global.KoreaRegionCatalog?.provinceNames||{};
  if(names[value])return names[value];
  if(value==='강원도'&&names.강원)return names.강원;
  if(value==='전라북도'&&names.전북)return names.전북;
  return value;
 }
 function formatAddress(data){
  const road=clean(data.roadAddress),parcel=clean(data.jibunAddress),main=clean(data.address);
  // autoRoadAddress/autoJibunAddress are guesses when several addresses map to
  // one result. Only use the confirmed address type selected by the user.
  const base=data.userSelectedType==='J'?(parcel||(data.addressType==='J'?main:'')):(road||(data.addressType==='R'?main:''));
  if(!base)return '';
  const sido=clean(data.sido),district=clean(data.sigungu),town=clean(data.bname1),locality=clean(data.bname2)||clean(data.bname);
  const parts=[sido,district,town,locality].filter((part,index,all)=>part&&part!==all[index-1]);
  if(!sido||!district&&!town&&!locality)return base;
  // Keep the legal region first: policy matching reads the leading hierarchy.
  // Preserve the exact road/parcel remainder rather than inventing a mapping.
  let remainder=base;
  for(const [index,part] of parts.entries()){
   const choices=index===0?[part,provinceName(part)]:[part];
   const matched=choices.find(value=>remainder===value||remainder.startsWith(value+' '));
   if(!matched)break;
   remainder=remainder.slice(matched.length).trim();
  }
  const region=[provinceName(sido),...parts.slice(1)].join(' ');
  return region+(remainder?' · '+remainder:'');
 }
 function styles(){
  if(global.document.querySelector('[data-road-address-style]'))return;
  const style=global.document.createElement('style');style.dataset.roadAddressStyle='true';
  style.textContent='.road-address{margin-top:6px;min-width:0}.road-address-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.road-address button{margin:0;padding:6px 9px;font-size:12px;line-height:1.4;white-space:normal}.road-address-status{font-size:11px;line-height:1.5;color:#61758f}.road-address-status[data-error=true]{color:#a33333}.road-address-panel{margin-top:8px;border:1px solid #bcc2ca;background:#fff}.road-address-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;font-size:12px;color:#173966;background:#f0f5fd}.road-address-host{width:100%;height:440px;min-width:0}.road-address [hidden]{display:none!important}';
  global.document.head.append(style);
 }
 function attach(form){
  const input=form?.querySelector('[name="consultationPlace"]');
  if(!input||attached.has(input))return;
  styles();const doc=global.document,dialog=form.closest('dialog'),id='road-address-'+(++sequence);
  const wrapper=doc.createElement('div'),tools=doc.createElement('div'),button=doc.createElement('button'),status=doc.createElement('span');
  const panel=doc.createElement('div'),heading=doc.createElement('div'),title=doc.createElement('span'),closeButton=doc.createElement('button'),host=doc.createElement('div');
  wrapper.className='road-address';wrapper.dataset.roadAddress='true';tools.className='road-address-tools';
  button.type='button';button.className='secondary';button.textContent='도로명·지번 주소 검색';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',id);
  status.className='road-address-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='도로명·건물명·지번으로 검색';
  panel.id=id;panel.className='road-address-panel';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','도로명·지번 주소 검색');
  heading.className='road-address-heading';title.textContent='도로명·지번 주소 검색';closeButton.type='button';closeButton.className='secondary';closeButton.textContent='닫기';closeButton.setAttribute('aria-label','주소 검색 닫기');
  host.className='road-address-host';heading.append(title,closeButton);panel.append(heading,host);tools.append(button,status);wrapper.append(tools,panel);
  (input.closest('.sales-place-control')||input).insertAdjacentElement('afterend',wrapper);
  let version=0;
  const editable=()=>form.isConnected&&input.isConnected&&!input.disabled&&!input.readOnly&&form.getAttribute('aria-busy')!=='true'&&!form.hasAttribute('data-saved')&&(!dialog||dialog.open);
  function close(focus=false){version++;panel.hidden=true;host.replaceChildren();button.disabled=false;button.setAttribute('aria-expanded','false');if(focus&&editable())button.focus();}
  function reset(){close();status.textContent='도로명·건물명·지번으로 검색';delete status.dataset.error;}
  async function search(){
   if(!editable())return;
   close();const token=version,key=form.dataset.requestKey,query=input.value.trim();
   panel.hidden=false;button.disabled=true;button.setAttribute('aria-expanded','true');delete status.dataset.error;status.textContent='주소 검색을 불러오는 중입니다…';
   try{
    const Postcode=await load();
    if(token!==version||!editable()||key!==form.dataset.requestKey)return;
    button.disabled=false;status.textContent='검색 결과에서 주소를 선택해 주세요.';
    new Postcode({width:'100%',height:'100%',minWidth:0,oncomplete:data=>{
     if(token!==version||!editable()||key!==form.dataset.requestKey)return;
     const address=formatAddress(data);
     if(!address||input.maxLength>0&&address.length>input.maxLength){status.dataset.error='true';status.textContent='선택한 주소를 입력하지 못했습니다. 다른 주소를 선택하거나 직접 입력해 주세요.';return;}
     close();input.value=address;input.dispatchEvent(new global.Event('input',{bubbles:true}));input.dispatchEvent(new global.Event('change',{bubbles:true}));input.focus();input.setSelectionRange(address.length,address.length);
     status.textContent='선택한 주소를 입력했습니다. 상세 장소를 이어서 입력할 수 있습니다.';delete status.dataset.error;
    }}).embed(host,{q:query,autoClose:false});
   }catch(error){
    if(token!==version)return;
    close();status.dataset.error='true';status.textContent='주소 검색에 연결하지 못했습니다. 다시 검색하거나 주소를 직접 입력해 주세요.';
   }
  }
  button.addEventListener('click',search);closeButton.addEventListener('click',()=>close(true));
  wrapper.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopPropagation();close(true);}});
  input.addEventListener('input',()=>{if(!panel.hidden)reset();});
  form.addEventListener('reset',reset);form.addEventListener('submit',()=>close(),true);dialog?.addEventListener('close',reset);
  attached.set(input,{close:reset});
 }
 global.RoadAddress={attach};
})(window);
