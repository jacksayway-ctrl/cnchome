/* Administrator-managed intake codes. No geographic inference or OCR rewriting. */
(function(root){
  'use strict';
  const defaults=Object.freeze([
    Object.freeze({id:'hanwha',label:'한화',aliases:Object.freeze([])}),
    Object.freeze({id:'shinhan',label:'신한',aliases:Object.freeze([])}),
    Object.freeze({id:'ga',label:'G/A',aliases:Object.freeze(['GA'])})
  ]);
  const normalize=value=>String(value??'').replace(/\s/g,'').toUpperCase();
  const copy=items=>items.map(item=>({id:item.id,label:item.label,aliases:[...item.aliases]}));
  const fail=message=>{throw new Error(message)};
  function name(value,kind){
    if(typeof value!=='string')fail(kind+'을 입력해 주세요.');
    if(/[\p{Cc}\p{Cf}]/u.test(value))fail(kind+'에 줄바꿈이나 제어 문자를 사용할 수 없습니다.');
    const text=value.trim();
    if(!text)fail(kind+'을 입력해 주세요.');
    if(text.length>40)fail(kind+'은 40자 이하로 입력해 주세요.');
    if(normalize(text)==='ALL')fail('all은 전체 조회용 이름이므로 접수 코드로 사용할 수 없습니다.');
    return text;
  }
  function validate(input){
    if(!Array.isArray(input)||input.length>200)fail('접수 코드 목록을 확인해 주세요. 최대 200개까지 등록할 수 있습니다.');
    const ids=new Set(),names=new Map();
    const items=input.map(item=>{
      if(!item||typeof item!=='object'||typeof item.id!=='string'||!(/^(?:hanwha|shinhan|ga|code_[a-z0-9_]{1,48})$/.test(item.id)))fail('접수 코드 식별자가 올바르지 않습니다.');
      if(ids.has(item.id))fail('중복된 접수 코드 식별자가 있습니다.');
      ids.add(item.id);
      const label=name(item.label,'접수 코드명');
      if(!Array.isArray(item.aliases)||item.aliases.length>40)fail('접수 코드의 이전 표기는 40개 이하의 목록으로 입력해 주세요.');
      const aliases=[],ownNames=new Set([normalize(label)]);
      for(const value of item.aliases){const alias=name(value,'이전 표기'),key=normalize(alias);if(!ownNames.has(key)){ownNames.add(key);aliases.push(alias)}}
      // Built-in IDs and their original spellings remain usable after a rename.
      const standard=defaults.find(code=>code.id===item.id);
      if(standard)for(const alias of [standard.label,...standard.aliases]){const key=normalize(alias);if(!ownNames.has(key)){ownNames.add(key);aliases.push(alias)}}
      if(aliases.length>40)fail('접수 코드의 이전 표기는 최대 40개까지 저장할 수 있습니다.');
      for(const key of ownNames){if(names.has(key)&&names.get(key)!==item.id)fail('접수 코드명 또는 이전 표기가 다른 코드와 중복됩니다.');names.set(key,item.id)}
      return {id:item.id,label,aliases};
    });
    for(const standard of defaults){
      if(ids.has(standard.id))continue;
      for(const value of [standard.label,...standard.aliases]){const key=normalize(value);if(names.has(key))fail('기본 접수 코드와 같은 이름을 다른 코드에 사용할 수 없습니다.');names.set(key,standard.id)}
      items.push(...copy([standard]));
    }
    if(items.length>200)fail('접수 코드는 기본 코드를 포함하여 최대 200개까지 등록할 수 있습니다.');
    return items;
  }
  function read(raw){
    try{const data=typeof raw==='string'?JSON.parse(raw):raw;if(!data||data.version!==1)return copy(defaults);return validate(data.codes)}catch(error){return copy(defaults)}
  }
  function upsert(codes,input){
    const next=validate(codes);
    if(!input||typeof input!=='object')fail('등록할 접수 코드를 확인해 주세요.');
    const label=name(input.label,'접수 코드명');
    if(input.id!=null&&input.id!==''){
      const index=next.findIndex(item=>item.id===input.id);
      if(index<0)fail('수정할 접수 코드를 찾을 수 없습니다. 목록을 다시 확인해 주세요.');
      const before=next[index],aliases=input.aliases===undefined?[...before.aliases]:input.aliases;
      if(!Array.isArray(aliases))fail('이전 표기는 목록으로 입력해 주세요.');
      next[index]={id:before.id,label,aliases:[...aliases,...(normalize(before.label)!==normalize(label)?[before.label]:[])]};
    }else{
      let number=1;while(next.some(item=>item.id==='code_'+number))number++;
      next.push({id:'code_'+number,label,aliases:input.aliases===undefined?[]:input.aliases});
    }
    return validate(next);
  }
  function serialize(codes){return JSON.stringify({version:1,codes:validate(codes)})}
  const api={version:1,defaults,normalize,read,upsert,serialize};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.IntakeCodeCatalog=api;
})(typeof window!=='undefined'?window:globalThis);
