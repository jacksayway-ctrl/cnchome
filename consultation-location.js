(function(global){
 'use strict';
 const initials='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
 const compact=value=>String(value||'').normalize('NFC').replace(/[ᄀ-ᄒ]/g,c=>initials[c.charCodeAt(0)-0x1100]).replace(/\s+/gu,'');
 const treeCache=new WeakMap(),flatCache=new WeakMap(),searchCache=new WeakMap(),descendantCache=new WeakMap(),scopeCache=new WeakMap(),aliasCache=new WeakMap(),queryCache=new WeakMap();
 // Catalog trees are immutable between builds. Share their derived data across forms.
 const QUERY_CACHE_LIMIT=128;
 function normalizedAliases(node){
  if(!aliasCache.has(node))aliasCache.set(node,[...new Set(node.aliases.map(compact).filter(Boolean))]);
  return aliasCache.get(node);
 }
 function descendants(nodes){
  if(!descendantCache.has(nodes))descendantCache.set(nodes,nodes.flatMap(node=>[...node.children,...descendants(node.children)]));
  return descendantCache.get(nodes);
 }
 function scopedNodes(nodes){
  if(!scopeCache.has(nodes))scopeCache.set(nodes,[...nodes,...descendants(nodes)]);
  return scopeCache.get(nodes);
 }
 function prefixMatches(text,search){
  let i=0;for(const letter of search){const code=text.charCodeAt(i)-0xac00;if(letter!==text[i]&&!(initials.includes(letter)&&code>=0&&code<11172&&initials[Math.floor(code/588)]===letter))return false;i++;}return true;
 }
 function startsWith(value,query){return prefixMatches(compact(value),compact(query));}
 function searchIndex(roots){
  if(searchCache.has(roots))return searchCache.get(roots);
  const entries=[],byLabel=new Map(),firstLetter=new Map(),firstInitial=new Map();
  function collect(nodes,ancestors,province){for(const node of nodes){
   const entry={node,ancestors,province:province||node,aliases:normalizedAliases(node)};
   entries.push(entry);byLabel.set(node.label,entry);collect(node.children,[...ancestors,entry],entry.province);
  }}
  collect(roots,[],null);entries.sort((a,b)=>a.ancestors.length-b.ancestors.length||a.node.label.localeCompare(b.node.label,'ko'));
  function add(index,key,entry){if(!index.has(key))index.set(key,new Set());index.get(key).add(entry);}
  for(const entry of entries)for(const alias of entry.aliases){
   add(firstLetter,alias[0],entry);const code=alias.charCodeAt(0)-0xac00;
   if(code>=0&&code<11172)add(firstInitial,initials[Math.floor(code/588)],entry);
  }
  const result={entries,byLabel,firstLetter,firstInitial};searchCache.set(roots,result);return result;
 }
 function buildIndex(catalog,localities=global.KoreaLocalities){
  if(!catalog)return [];
  const cached=treeCache.get(catalog);if(cached&&cached.localities===localities)return cached.roots;
  const roots=Object.entries(catalog.provinceNames).map(([key,name])=>({id:key,label:name,name,aliases:[name,key,...(key==='강원'?['강원도']:key==='전북'?['전라북도']:[])],children:[]}));
  const byProvince=new Map(roots.map(item=>[item.id,item])),byCity=new Map();
  for(const city of catalog.municipalities){
   if(city.metropolitan)continue;
   const parent=byProvince.get(city.province);if(!parent)continue;
   const node={id:city.id,name:city.name,label:parent.label+' '+city.name,aliases:city.aliases,children:[]};parent.children.push(node);byCity.set(city.id,node);
  }
  for(const district of catalog.districts){
   const parent=district.autonomous?byProvince.get(district.province):byCity.get(district.parentId);if(!parent)continue;
   parent.children.push({id:district.id,name:district.name,label:parent.label+' '+district.name,aliases:[...district.aliases,district.name.replace(/구$/,'')],children:[]});
  }
  const paths=new Map();function register(nodes){for(const node of nodes){paths.set(node.label,node);register(node.children);}}register(roots);
  for(const [province,parentName,places] of localities?.groups||[]){
   const label=catalog.provinceNames[province]+(parentName?' '+parentName:'');const parent=paths.get(label);if(!parent)continue;
   for(const place of places){let target=parent;for(const name of place.split(' ')){
    let child=target.children.find(item=>item.name===name);
    if(!child){child={id:target.id+':'+name,name,label:target.label+' '+name,aliases:[name],children:[]};target.children.push(child);paths.set(child.label,child);}target=child;
   }}
  }
  function sort(nodes){for(const node of nodes){node.children.sort((a,b)=>a.name.localeCompare(b.name,'ko'));sort(node.children);}}sort(roots);
  flatCache.set(roots,searchIndex(roots).entries.filter(entry=>entry.ancestors.length).map(entry=>entry.node));
  treeCache.set(catalog,{localities,roots});
  return roots;
 }
 function suggestions(value,roots){
  const key=String(value||'');let cached=queryCache.get(roots);
  if(!cached){cached=new Map();queryCache.set(roots,cached);}
  if(cached.has(key)){const result=cached.get(key);cached.delete(key);cached.set(key,result);return result;}
  const result=findSuggestions(key,roots);cached.set(key,result);
  if(cached.size>QUERY_CACHE_LIMIT)cached.delete(cached.keys().next().value);
  return result;
 }
 function findSuggestions(value,roots){
  let remaining=compact(value),scope=roots,scoped=false,province=null;
  const parts=String(value||'').trim().split(/\s+/u).filter(Boolean).map(compact),trailingSpace=/\s$/u.test(String(value||'')),index=searchIndex(roots);
  const unique=nodes=>[...new Map(nodes.map(node=>[node.id,node])).values()];
  // This spelling alias suggests the catalog address; it never changes entered text.
  const aliases=(node,root)=>root?.id==='대전'&&node.label==='대전광역시 서구 탄방동'?[...normalizedAliases(node),'탐방동']:normalizedAliases(node);
  const nextOptions=node=>node.children.length?node.children:[node];
  // Selecting a full catalog address adds a space: continue into children or close at a leaf.
  const selected=trailingSpace?index.byLabel.get(String(value||'').trim()):null;
  if(selected)return selected.node.children;
  // Spaced tokens may start at any address level. Match them in ancestor order;
  // short initials such as ㅅ must not force 서울/세종 and hide 설성면 or other towns.
  if(parts.length&&(parts.length>1||trailingSpace)){
   const explicitProvince=roots.find(node=>normalizedAliases(node).some(alias=>alias===parts[0]));
   if(parts.length===1&&explicitProvince)return explicitProvince.children;
   const last=parts[parts.length-1],candidates=new Set((initials.includes(last[0])?index.firstInitial:index.firstLetter).get(last[0])||[]);
   const daejeon=roots.find(node=>node.id==='대전'),allowTypo=parts.length>1&&daejeon&&normalizedAliases(daejeon).some(alias=>prefixMatches(alias,parts[0]));
   const typoEntry=allowTypo?index.byLabel.get('대전광역시 서구 탄방동'):null;
   if(typoEntry&&prefixMatches('탐방동',last))candidates.add(typoEntry);
   const matches=[];
   for(const entry of candidates){
    if(explicitProvince&&entry.province!==explicitProvince)continue;
    if(!entry.aliases.some(alias=>prefixMatches(alias,last))&&!(entry===typoEntry&&prefixMatches('탐방동',last)))continue;
    let offset=0,matched=true;
    for(const part of parts.slice(0,-1)){
     while(offset<entry.ancestors.length&&!entry.ancestors[offset].aliases.some(alias=>prefixMatches(alias,part)))offset++;
     if(offset===entry.ancestors.length){matched=false;break;}offset++;
    }
    if(matched)matches.push(entry.node);
   }
   if(matches.length)return unique(matches);
   if(parts.length===1)return [];
   // A segment can itself contain compact levels, such as 대전 서구탄방동.
   const provinces=explicitProvince?[explicitProvince]:roots.filter(node=>normalizedAliases(node).some(alias=>prefixMatches(alias,parts[0])));
   if(provinces.length){
    remaining=parts.slice(1).join('');scope=provinces.flatMap(node=>node.children);scoped=true;province=provinces.length===1?provinces[0]:null;
   }
  }
  const query=compact(value),direct=()=>(flatCache.get(roots)||descendants(roots)).filter(node=>normalizedAliases(node).some(alias=>prefixMatches(alias,query)));
  // Compact queries also stay inside the resolved province, with optional skipped levels.
  while(remaining){
   let match=null;
   for(const node of scoped?scopedNodes(scope):scope)for(const name of aliases(node,province)){if(name&&remaining.startsWith(name)&&(!match||name.length>match.name.length))match={node,name};}
   if(!match)break;
   if(!scoped)province=match.node;
   remaining=remaining.slice(match.name.length);scope=match.node.children;scoped=true;
   if(!scope.length)return remaining?[]:nextOptions(match.node);
  }
  if(!remaining)return scope;
  const candidates=scoped?scopedNodes(scope):scope;
  const matches=candidates.filter(node=>aliases(node,province).some(alias=>prefixMatches(alias,remaining)));
  // One initial per successive address level: ㄱㅇㅅ -> 경기도 / 이천시 / 설성면.
  const compound=[];
  if(remaining.length>=2&&[...remaining].every(letter=>initials.includes(letter))){
   function walk(nodes,offset){for(const node of nodes){if(!startsWith(node.name,remaining[offset]))continue;if(offset===remaining.length-1)compound.push(node);else walk(node.children,offset+1);}}
   walk(scope,0);
  }
  if(scoped)return unique([...matches,...compound]);
  // Also allow direct city/district searches; full paths distinguish identical names.
  return unique([...(matches.length?[...matches,...roots.flatMap(node=>node.children).filter(node=>normalizedAliases(node).some(alias=>prefixMatches(alias,query)))]:direct()),...compound]);
 }
 function attach(form){
  const input=form?.querySelector('[name="consultationPlace"],[data-personnel-address]'),list=form?.querySelector('[data-place-options]'),status=form?.querySelector('[data-place-status]');
  if(!input||!list||input.dataset.placeReady)return;
  input.dataset.placeReady='true';const roots=buildIndex(global.KoreaRegionCatalog),initialStatus=status.textContent;let options=[],active=-1,composing=false,choosing=false,suppressAutoInput=false,autoTimer=0,renderTimer=0,renderVersion=0,queuedValue='',queuedAuto=false,queuedIntent=0,searchTimer=0,searchVersion=0,searchController=null,autoAllowed=true,autoIntent=0,selectedAddress='';
  function cancelAutoChoose(){global.clearTimeout(autoTimer);autoTimer=0;}
  function cancelRender(){global.clearTimeout(renderTimer);renderTimer=0;renderVersion++;}
  function cancelSearch(){global.clearTimeout(searchTimer);searchTimer=0;searchVersion++;searchController?.abort();searchController=null;}
  function conceal(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');if(active>=0)list.children[active]?.setAttribute('aria-selected','false');active=-1;}
  function hide(){cancelAutoChoose();cancelRender();cancelSearch();conceal();}
  function highlight(index){if(active>=0)list.children[active]?.setAttribute('aria-selected','false');active=index;if(index>=0){const row=list.children[index];row.setAttribute('aria-selected','true');input.setAttribute('aria-activedescendant',row.id);row.scrollIntoView?.({block:'nearest'});}}
  function choose(index){
   cancelAutoChoose();cancelRender();cancelSearch();const item=options[index];if(!item)return;
   selectedAddress=item.kind?item.label:'';
   choosing=true;
   try{input.value=item.label+' ';input.focus();input.setSelectionRange(input.value.length,input.value.length);input.dispatchEvent(new global.Event('input',{bubbles:true}));}
   finally{choosing=false;}
  }
  function scheduleAutoChoose(){
   cancelAutoChoose();
   if(choosing||composing||!autoAllowed||options.length!==1||!input.value.trim()||global.document.activeElement!==input||input.disabled||input.readOnly||input.selectionStart!==input.value.length||input.selectionEnd!==input.value.length)return;
   const value=input.value,item=options[0];
   autoTimer=global.setTimeout(()=>{
    autoTimer=0;
    if(choosing||composing||!autoAllowed||!input.isConnected||global.document.activeElement!==input||input.disabled||input.readOnly||input.value!==value||input.selectionStart!==value.length||input.selectionEnd!==value.length||list.hidden||options.length!==1||options[0]!==item)return;
    choose(0);
   },350);
  }
  function display(found,total=found.length,address=false){
   const next=found.slice(0,100),unchanged=next.length===options.length&&list.children.length===next.length&&next.every((item,index)=>item.label===options[index].label&&item.secondary===options[index].secondary&&item.kind===options[index].kind);
   if(active>=0)list.children[active]?.setAttribute('aria-selected','false');
   options=next;autoAllowed=total===1&&options.length===1;active=-1;input.removeAttribute('aria-activedescendant');
   if(!unchanged){
    const fragment=global.document.createDocumentFragment();
    for(const [index,item] of options.entries()){
     const row=global.document.createElement('button');row.type='button';row.tabIndex=-1;row.id=list.id+'-'+index;row.setAttribute('role','option');row.setAttribute('aria-selected','false');row.textContent=item.label;row.dataset.placeIndex=String(index);
     if(item.secondary){const detail=global.document.createElement('small');detail.className='sales-address-detail';detail.textContent=item.secondary;row.append(detail);}
     fragment.append(row);
    }
    list.replaceChildren(fragment);
   }
   list.hidden=!options.length;input.setAttribute('aria-expanded',String(!!options.length));list.scrollTop=0;
   const message=address?(options.length?'주소 '+total+'개'+(total>options.length?' 중 '+options.length+'개 표시':'')+' · 도로명·지번 함께 검색 · 제공: Postcodify':'일치하는 주소가 없습니다. 동·리와 번지 또는 도로명과 건물번호를 확인해 주세요.'):(options.length?(found.length>options.length?'지역 '+found.length+'개 중 '+options.length+'개 표시 · 글자를 더 입력하면 좁혀집니다.':'지역 '+options.length+'개 · 읍·면·동·리도 첫 글자나 초성으로 선택하세요.'):'상세 주소나 건물·카페 이름을 이어서 입력할 수 있습니다.');
   if(status.textContent!==message)status.textContent=message;
  }
  function render(allowAuto=false){
   cancelRender();cancelSearch();if(composing)return;const found=suggestions(input.value,roots);display(found);
   const provider=global.RoadAddress,value=input.value,query=value.trim();
   if(selectedAddress&&query!==selectedAddress&&!query.startsWith(selectedAddress+' '))selectedAddress='';
   if(choosing||composing||found.length||selectedAddress||!input.dataset.addressSearch||!provider?.shouldSearch(query)||global.document.activeElement!==input||input.disabled||input.readOnly)return;
   const version=searchVersion,requestKey=form.dataset.requestKey,intent=autoIntent;
   const cached=provider.cached?.(query);if(cached){display(cached.items,cached.count,true);if(allowAuto)scheduleAutoChoose();return;}
   status.textContent='도로명·지번 주소를 검색합니다…';
   searchTimer=global.setTimeout(async()=>{
    searchTimer=0;
    const current=()=>version===searchVersion&&input.isConnected&&input.value===value&&form.dataset.requestKey===requestKey&&global.document.activeElement===input&&!input.disabled&&!input.readOnly&&!composing&&!form.hasAttribute('data-saved');
    if(!current())return;
    const controller=new global.AbortController();searchController=controller;
    try{
     const result=await provider.search(query,{signal:controller.signal});
     if(!current())return;
     display(result.items,result.count,true);if(allowAuto&&intent===autoIntent)scheduleAutoChoose();
    }catch(error){
     if(!current()||controller.signal.aborted)return;
     display([]);status.textContent=typeof error?.message==='string'&&error.message.startsWith('주소 검색')?error.message:'주소 검색에 연결하지 못했습니다. 잠시 후 다시 입력하거나 주소를 직접 입력해 주세요.';
    }finally{if(searchController===controller)searchController=null;}
   },80);
  }
  function scheduleRender(allowAuto){
   const value=input.value,intent=autoIntent,carryAuto=renderTimer&&queuedValue===value&&queuedIntent===intent&&queuedAuto;
   cancelAutoChoose();cancelRender();cancelSearch();conceal();
   if(composing)return;
   queuedValue=value;queuedIntent=intent;queuedAuto=allowAuto||carryAuto;
   const version=renderVersion,requestKey=form.dataset.requestKey;
   renderTimer=global.setTimeout(()=>{
    renderTimer=0;
    if(version!==renderVersion||!input.isConnected||input.value!==value||form.dataset.requestKey!==requestKey||global.document.activeElement!==input||input.disabled||input.readOnly||composing||form.hasAttribute('data-saved'))return;
    const auto=queuedAuto&&intent===autoIntent;render(auto);if(auto)scheduleAutoChoose();
   },100);
  }
  function optionRow(event){const row=event.target.closest?.('[data-place-index]');return row&&row.parentElement===list?row:null;}
  for(const eventName of ['pointerdown','mousedown'])list.addEventListener(eventName,event=>{if(optionRow(event))event.preventDefault();});
  list.addEventListener('click',event=>{const row=optionRow(event);if(row&&!list.hidden&&!renderTimer&&!composing)choose(Number(row.dataset.placeIndex));});
  input.addEventListener('input',event=>{
   const allowAuto=!event.isComposing&&!suppressAutoInput&&!!event.inputType?.startsWith('insert');
   if(event.isComposing||composing){hide();return;}
   if(choosing){cancelAutoChoose();render();return;}
   scheduleRender(allowAuto);
  });input.addEventListener('focus',()=>render());
  form.addEventListener('reset',()=>{hide();selectedAddress='';suppressAutoInput=false;options=[];list.replaceChildren();status.textContent=initialStatus;});
  form.addEventListener('submit',hide,true);form.closest('dialog')?.addEventListener('close',hide);
  input.addEventListener('compositionstart',()=>{composing=true;hide();});input.addEventListener('compositionend',()=>{composing=false;scheduleRender(true);});
  for(const event of ['pointerdown','mousedown'])input.addEventListener(event,()=>{autoIntent++;cancelAutoChoose();});
  input.addEventListener('blur',()=>{cancelAutoChoose();suppressAutoInput=false;global.setTimeout(()=>{if(global.document.activeElement!==input)hide();},0);});
  // Run before the Korean helper emits its synchronous input from keydown.
  input.addEventListener('keydown',event=>{
   autoIntent++;cancelAutoChoose();suppressAutoInput=event.key==='Backspace'||event.key==='Delete'||((event.ctrlKey||event.metaKey)&&/^[zy]$/i.test(event.key));
  },true);
  input.addEventListener('keyup',()=>{suppressAutoInput=false;});
  input.addEventListener('keydown',event=>{
   if(composing||event.isComposing||event.keyCode===229)return;
   if(event.key==='Escape'&&(!list.hidden||renderTimer||searchTimer||searchController)){event.preventDefault();event.stopPropagation();hide();return;}
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    if(renderTimer||list.hidden)render();if(!options.length)return;event.preventDefault();highlight(active<0?(event.key==='ArrowDown'?0:options.length-1):(active+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);
   }else if(event.key==='Enter'){
    if(renderTimer)render();if(!list.hidden&&options.length){event.preventDefault();choose(active<0?0:active);}
   }
  });
 }
 const api={attach,core:{startsWith,buildIndex,suggestions}};if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.ConsultationLocation=api;
})(typeof window!=='undefined'?window:globalThis);
