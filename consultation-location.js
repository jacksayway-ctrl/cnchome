(function(global){
 'use strict';
 const initials='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
 const compact=value=>String(value||'').normalize('NFC').replace(/[ᄀ-ᄒ]/g,c=>initials[c.charCodeAt(0)-0x1100]).replace(/\s+/gu,'');
 const treeCache=new WeakMap(),flatCache=new WeakMap();
 function startsWith(value,query){
  const text=compact(value),search=compact(query);
  return [...search].every((letter,i)=>{const code=text.charCodeAt(i)-0xac00;return letter===text[i]||(initials.includes(letter)&&code>=0&&code<11172&&initials[Math.floor(code/588)]===letter);});
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
  const flat=[];function flatten(nodes,depth){for(const node of nodes){flat.push({node,depth});flatten(node.children,depth+1);}}flatten(roots,0);
  flatCache.set(roots,flat.filter(x=>x.depth>0).sort((a,b)=>a.depth-b.depth||a.node.label.localeCompare(b.node.label,'ko')).map(x=>x.node));
  treeCache.set(catalog,{localities,roots});
  return roots;
 }
 function suggestions(value,roots){
  let remaining=compact(value),scope=roots,scoped=false;
  function descendants(nodes){return nodes.flatMap(node=>[...node.children,...descendants(node.children)]);}
  const direct=()=>(flatCache.get(roots)||descendants(roots)).filter(node=>node.aliases.some(alias=>startsWith(alias,value)));
  // Resolve complete province/city aliases first, then filter only their children.
  while(remaining){
   let match=null;
   for(const node of scope)for(const alias of node.aliases){const name=compact(alias);if(name&&remaining.startsWith(name)&&(!match||name.length>match.name.length))match={node,name};}
   if(!match)break;
   remaining=remaining.slice(match.name.length);scope=match.node.children;scoped=true;
   if(!scope.length)return [];
  }
  if(!remaining)return scope;
  const matches=scope.filter(node=>node.aliases.some(alias=>startsWith(alias,remaining)));
  // One initial per successive address level: ㄱㅇㅅ -> 경기도 / 이천시 / 설성면.
  const compound=[];
  if(remaining.length>=2&&[...remaining].every(letter=>initials.includes(letter))){
   function walk(nodes,offset){for(const node of nodes){if(!startsWith(node.name,remaining[offset]))continue;if(offset===remaining.length-1)compound.push(node);else walk(node.children,offset+1);}}
   walk(scope,0);
  }
  const unique=nodes=>[...new Map(nodes.map(node=>[node.id,node])).values()];
  if(scoped)return unique([...(matches.length?matches:compound.length?[]:direct()),...compound]);
  // Also allow direct city/district searches; full paths distinguish identical names.
  return unique([...(matches.length?[...matches,...roots.flatMap(node=>node.children).filter(node=>node.aliases.some(alias=>startsWith(alias,value)))]:direct()),...compound]);
 }
 function attach(form){
  const input=form?.querySelector('[name="consultationPlace"],[data-personnel-address]'),list=form?.querySelector('[data-place-options]'),status=form?.querySelector('[data-place-status]');
  if(!input||!list||input.dataset.placeReady)return;
  input.dataset.placeReady='true';const roots=buildIndex(global.KoreaRegionCatalog),initialStatus=status.textContent;let options=[],active=-1,composing=false;
  function hide(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
  function highlight(index){active=index;for(const [i,node] of [...list.children].entries())node.setAttribute('aria-selected',String(i===index));if(index>=0){input.setAttribute('aria-activedescendant',list.children[index].id);list.children[index].scrollIntoView?.({block:'nearest'});}}
  function choose(index){const item=options[index];if(!item)return;input.value=item.label+' ';input.focus();input.setSelectionRange(input.value.length,input.value.length);input.dispatchEvent(new global.Event('input',{bubbles:true}));}
  function render(){
   const found=suggestions(input.value,roots);options=found.slice(0,100);active=-1;input.removeAttribute('aria-activedescendant');list.replaceChildren();
   for(const [index,item] of options.entries()){
    const row=global.document.createElement('button');row.type='button';row.tabIndex=-1;row.id=list.id+'-'+index;row.setAttribute('role','option');row.setAttribute('aria-selected','false');row.textContent=item.label;row.dataset.placeIndex=String(index);
    row.addEventListener('pointerdown',event=>event.preventDefault());row.addEventListener('mousedown',event=>event.preventDefault());row.addEventListener('click',()=>choose(index));list.append(row);
   }
   list.hidden=!options.length;input.setAttribute('aria-expanded',String(!!options.length));list.scrollTop=0;
   status.textContent=options.length?(found.length>options.length?'지역 '+found.length+'개 중 '+options.length+'개 표시 · 글자를 더 입력하면 좁혀집니다.':'지역 '+options.length+'개 · 읍·면·동·리도 첫 글자나 초성으로 선택하세요.'):'상세 주소나 건물·카페 이름을 이어서 입력할 수 있습니다.';
  }
  input.addEventListener('input',render);input.addEventListener('focus',render);
  form.addEventListener('reset',()=>{hide();options=[];list.replaceChildren();status.textContent=initialStatus;});
  input.addEventListener('compositionstart',()=>{composing=true;});input.addEventListener('compositionend',()=>{composing=false;render();});
  input.addEventListener('blur',()=>global.setTimeout(()=>{if(global.document.activeElement!==input)hide();},0));
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
