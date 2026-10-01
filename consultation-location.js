(function(global){
 'use strict';
 const initials='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
 const compact=value=>String(value||'').normalize('NFC').replace(/[ᄀ-ᄒ]/g,c=>initials[c.charCodeAt(0)-0x1100]).replace(/\s+/gu,'');
 const treeCache=new WeakMap(),flatCache=new WeakMap(),searchCache=new WeakMap();
 function prefixMatches(text,search){
  return [...search].every((letter,i)=>{const code=text.charCodeAt(i)-0xac00;return letter===text[i]||(initials.includes(letter)&&code>=0&&code<11172&&initials[Math.floor(code/588)]===letter);});
 }
 function startsWith(value,query){return prefixMatches(compact(value),compact(query));}
 function searchIndex(roots){
  if(searchCache.has(roots))return searchCache.get(roots);
  const entries=[],byLabel=new Map(),firstLetter=new Map(),firstInitial=new Map();
  function collect(nodes,ancestors,province){for(const node of nodes){
   const entry={node,ancestors,province:province||node,aliases:[...new Set(node.aliases.map(compact).filter(Boolean))]};
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
  let remaining=compact(value),scope=roots,scoped=false,province=null;
  const parts=String(value||'').trim().split(/\s+/u).filter(Boolean).map(compact),trailingSpace=/\s$/u.test(String(value||'')),index=searchIndex(roots);
  function descendants(nodes){return nodes.flatMap(node=>[...node.children,...descendants(node.children)]);}
  const unique=nodes=>[...new Map(nodes.map(node=>[node.id,node])).values()];
  // This spelling alias suggests the catalog address; it never changes entered text.
  const aliases=(node,root)=>root?.id==='대전'&&node.label==='대전광역시 서구 탄방동'?[...node.aliases,'탐방동']:node.aliases;
  const nextOptions=node=>node.children.length?node.children:[node];
  // Selecting a full catalog address adds a space: continue into children or close at a leaf.
  const selected=trailingSpace?index.byLabel.get(String(value||'').trim()):null;
  if(selected)return selected.node.children;
  // Spaced tokens may start at any address level. Match them in ancestor order;
  // short initials such as ㅅ must not force 서울/세종 and hide 설성면 or other towns.
  if(parts.length&&(parts.length>1||trailingSpace)){
   const explicitProvince=roots.find(node=>node.aliases.some(alias=>compact(alias)===parts[0]));
   if(parts.length===1&&explicitProvince)return explicitProvince.children;
   const last=parts[parts.length-1],candidates=new Set((initials.includes(last[0])?index.firstInitial:index.firstLetter).get(last[0])||[]);
   const daejeon=roots.find(node=>node.id==='대전'),allowTypo=parts.length>1&&daejeon?.aliases.some(alias=>startsWith(alias,parts[0]));
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
   const provinces=explicitProvince?[explicitProvince]:roots.filter(node=>node.aliases.some(alias=>startsWith(alias,parts[0])));
   if(provinces.length){
    remaining=parts.slice(1).join('');scope=provinces.flatMap(node=>node.children);scoped=true;province=provinces.length===1?provinces[0]:null;
   }
  }
  const direct=()=>(flatCache.get(roots)||descendants(roots)).filter(node=>node.aliases.some(alias=>startsWith(alias,value)));
  // Compact queries also stay inside the resolved province, with optional skipped levels.
  while(remaining){
   let match=null;
   for(const node of scoped?[...scope,...descendants(scope)]:scope)for(const alias of aliases(node,province)){const name=compact(alias);if(name&&remaining.startsWith(name)&&(!match||name.length>match.name.length))match={node,name};}
   if(!match)break;
   if(!scoped)province=match.node;
   remaining=remaining.slice(match.name.length);scope=match.node.children;scoped=true;
   if(!scope.length)return remaining?[]:nextOptions(match.node);
  }
  if(!remaining)return scope;
  const candidates=scoped?[...scope,...descendants(scope)]:scope;
  const matches=candidates.filter(node=>aliases(node,province).some(alias=>startsWith(alias,remaining)));
  // One initial per successive address level: ㄱㅇㅅ -> 경기도 / 이천시 / 설성면.
  const compound=[];
  if(remaining.length>=2&&[...remaining].every(letter=>initials.includes(letter))){
   function walk(nodes,offset){for(const node of nodes){if(!startsWith(node.name,remaining[offset]))continue;if(offset===remaining.length-1)compound.push(node);else walk(node.children,offset+1);}}
   walk(scope,0);
  }
  if(scoped)return unique([...matches,...compound]);
  // Also allow direct city/district searches; full paths distinguish identical names.
  return unique([...(matches.length?[...matches,...roots.flatMap(node=>node.children).filter(node=>node.aliases.some(alias=>startsWith(alias,value)))]:direct()),...compound]);
 }
 function attach(form){
  const input=form?.querySelector('[name="consultationPlace"],[data-personnel-address]'),list=form?.querySelector('[data-place-options]'),status=form?.querySelector('[data-place-status]');
  if(!input||!list||input.dataset.placeReady)return;
  input.dataset.placeReady='true';const roots=buildIndex(global.KoreaRegionCatalog),initialStatus=status.textContent;let options=[],active=-1,composing=false,choosing=false,suppressAutoInput=false,autoTimer=0;
  function cancelAutoChoose(){global.clearTimeout(autoTimer);autoTimer=0;}
  function hide(){cancelAutoChoose();list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
  function highlight(index){active=index;for(const [i,node] of [...list.children].entries())node.setAttribute('aria-selected',String(i===index));if(index>=0){input.setAttribute('aria-activedescendant',list.children[index].id);list.children[index].scrollIntoView?.({block:'nearest'});}}
  function choose(index){
   cancelAutoChoose();const item=options[index];if(!item)return;
   choosing=true;
   try{input.value=item.label+' ';input.focus();input.setSelectionRange(input.value.length,input.value.length);input.dispatchEvent(new global.Event('input',{bubbles:true}));}
   finally{choosing=false;}
  }
  function scheduleAutoChoose(){
   cancelAutoChoose();
   if(choosing||composing||options.length!==1||!input.value.trim()||global.document.activeElement!==input||input.disabled||input.readOnly||input.selectionStart!==input.value.length||input.selectionEnd!==input.value.length)return;
   const value=input.value,item=options[0];
   autoTimer=global.setTimeout(()=>{
    autoTimer=0;
    if(choosing||composing||!input.isConnected||global.document.activeElement!==input||input.disabled||input.readOnly||input.value!==value||input.selectionStart!==value.length||input.selectionEnd!==value.length||list.hidden||options.length!==1||options[0]!==item)return;
    choose(0);
   },350);
  }
  function render(){
   const found=suggestions(input.value,roots);options=found.slice(0,100);active=-1;input.removeAttribute('aria-activedescendant');list.replaceChildren();
   for(const [index,item] of options.entries()){
    const row=global.document.createElement('button');row.type='button';row.tabIndex=-1;row.id=list.id+'-'+index;row.setAttribute('role','option');row.setAttribute('aria-selected','false');row.textContent=item.label;row.dataset.placeIndex=String(index);
    row.addEventListener('pointerdown',event=>event.preventDefault());row.addEventListener('mousedown',event=>event.preventDefault());row.addEventListener('click',()=>choose(index));list.append(row);
   }
   list.hidden=!options.length;input.setAttribute('aria-expanded',String(!!options.length));list.scrollTop=0;
   status.textContent=options.length?(found.length>options.length?'지역 '+found.length+'개 중 '+options.length+'개 표시 · 글자를 더 입력하면 좁혀집니다.':'지역 '+options.length+'개 · 읍·면·동·리도 첫 글자나 초성으로 선택하세요.'):'상세 주소나 건물·카페 이름을 이어서 입력할 수 있습니다.';
  }
  input.addEventListener('input',event=>{
   cancelAutoChoose();render();
   if(!event.isComposing&&!suppressAutoInput&&event.inputType?.startsWith('insert'))scheduleAutoChoose();
  });input.addEventListener('focus',render);
  form.addEventListener('reset',()=>{hide();suppressAutoInput=false;options=[];list.replaceChildren();status.textContent=initialStatus;});
  input.addEventListener('compositionstart',()=>{cancelAutoChoose();composing=true;});input.addEventListener('compositionend',()=>{composing=false;render();scheduleAutoChoose();});
  for(const event of ['pointerdown','mousedown'])input.addEventListener(event,cancelAutoChoose);
  input.addEventListener('blur',()=>{cancelAutoChoose();suppressAutoInput=false;global.setTimeout(()=>{if(global.document.activeElement!==input)hide();},0);});
  // Run before the Korean helper emits its synchronous input from keydown.
  input.addEventListener('keydown',event=>{
   cancelAutoChoose();suppressAutoInput=event.key==='Backspace'||event.key==='Delete'||((event.ctrlKey||event.metaKey)&&/^[zy]$/i.test(event.key));
  },true);
  input.addEventListener('keyup',()=>{suppressAutoInput=false;});
  input.addEventListener('keydown',event=>{
   if(composing||event.isComposing||event.keyCode===229)return;
   if(event.key==='Escape'&&!list.hidden){event.preventDefault();event.stopPropagation();hide();return;}
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    if(list.hidden)render();if(!options.length)return;event.preventDefault();highlight(active<0?(event.key==='ArrowDown'?0:options.length-1):(active+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);
   }else if(event.key==='Enter'&&!list.hidden&&options.length){event.preventDefault();choose(active<0?0:active);}
  });
 }
 const api={attach,core:{startsWith,buildIndex,suggestions}};if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.ConsultationLocation=api;
})(typeof window!=='undefined'?window:globalThis);
