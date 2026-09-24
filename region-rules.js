/* Policy scope parser. OCR text is never rewritten; aliases identify explicit administrative names only.
 * City/county name reference: https://www.mois.go.kr/frt/sub/a04/localGovernment/screen.do
 * Reviewed 2026-09-24. Province keys preserve the business policy's legacy labels (including 전남/광주).
 * Child names are literal policy declarations, not an invented nationwide 읍/면 boundary gazetteer.
 */
(function (root) {
  'use strict';
  const reference=root.KoreaRegionCatalog||(typeof require==='function'?require('./korea-regions.js'):null);
  if(!reference)throw new Error('KoreaRegionCatalog must be loaded before PolicyRegionRules.');
  const intakeCatalog=root.IntakeCodeCatalog||(typeof require==='function'?require('./intake-codes.js'):null);
  if(!intakeCatalog)throw new Error('IntakeCodeCatalog must be loaded before PolicyRegionRules.');
  const provinceNames=reference.provinceNames;
  const catalog=reference.municipalities;
  const districts=reference.districts;
  const byAlias = new Map();
  for (const item of catalog) for (const alias of item.aliases) {if(!byAlias.has(alias))byAlias.set(alias,[]);byAlias.get(alias).push(item)}
  const provinceAliases = Object.keys(provinceNames).flatMap(province => [provinceNames[province],province,...({강원:['강원도'],전북:['전라북도']}[province]||[])].map(alias=>({alias,province}))).sort((a,b)=>b.alias.length-a.alias.length);
  const directions = ['북부','남부','서부','동부','중부','서북부','서남부','동북부','동남부','북서부','북동부','남서부','남동부'];
  const stopWords = new Set(['전체','전역','모든','지역','일부','및','또는','포함','제외','만','가능','불가','접수','접수가능','접수불가','가능지역','불가지역','접수가능지역','접수불가지역','필수','한정']);
  const childLevel = token => /구$/.test(token)?1:/[읍면동]$/.test(token)?2:/리$/.test(token)?3:0;
  const compact = value => String(value||'').replace(/\s/g,'');
  // Intake codes describe a policy, never an administrative place. Match a complete
  // metadata heading only; do not erase code-like words from geographic text.
  const intakeHeaderDate='(?:[1-9]\\d{3}년(?:(?:0?[1-9]|1[0-2])월)?|(?:0?[1-9]|1[0-2])월)';
  const intakeHeaderSuffix=new RegExp('^(?:(?:일반|실버)(?:'+intakeHeaderDate+')?|'+intakeHeaderDate+'(?:일반|실버)?)?$','i');
  function readIntakeCodeHeader(text,codes=intakeCatalog.defaults) {
    const title=String(text??'').trim(),value=intakeCatalog.normalize(title),values=[value,value.replace(/^접수코드[:：]?/,'')];
    if(!Array.isArray(codes))return null;
    const exact=codes.filter(code=>[code.label,...(code.aliases||[])].some(alias=>values.includes(intakeCatalog.normalize(alias))));
    const matches=exact.length?exact:codes.filter(code=>[code.label,...(code.aliases||[])].some(alias=>{const key=intakeCatalog.normalize(alias);return key&&values.some(text=>text.startsWith(key)&&intakeHeaderSuffix.test(text.slice(key.length)))}));
    if(matches.length!==1)return null;
    return {id:matches[0].id,label:matches[0].label,title};
  }
  const unique = values => [...new Set(values)];
  const cloneTarget = target => ({province:target.province,name:target.name||'',path:[...(target.path||[])]});
  const targetKey = target => [target.province,target.name,...target.path].join('|');
  const dedupe = targets => [...new Map(targets.map(target=>[targetKey(target),target])).values()];
  const label = target => [target.province,target.name||'전체',...(target.path||[])].filter(Boolean).join(' ');
  const resolveProvince = value => provinceAliases.find(p=>p.alias===String(value||''))?.province || '';
  function resolvePlace(name,province) {
    const key=resolveProvince(province)||province||'';
    return (byAlias.get(String(name||'').trim())||[]).filter(item=>!key||item.province===key);
  }
  function heading(text) {
    const raw=String(text||'').trim(),value=compact(raw).replace(/必/g,'');
    for(const p of provinceAliases){
      if(!value.startsWith(p.alias))continue;
      const rest=value.slice(p.alias.length);
      // 광주 alone could be 경기도 광주시; require the explicit metropolitan name or a province qualifier.
      if(p.alias==='광주'&&!rest)continue;
      if(!rest||rest==='전체'||rest==='전역'||directions.includes(rest))return {province:p.province,region:directions.includes(rest)?rest:'전체',parent:null,broad:!directions.includes(rest)};
    }
    const names=value.replace(/(?:전체|전역)$/,'');
    let choices=resolvePlace(names);
    if(choices.length===1)return {province:choices[0].province,region:'',parent:choices[0],broad:true};
    // Explicit province + city/county (spaces are optional only at known exact boundaries).
    for(const p of provinceAliases){if(value.startsWith(p.alias)){choices=resolvePlace(value.slice(p.alias.length).replace(/(?:전체|전역)$/,''),p.province);if(choices.length===1)return {province:p.province,region:'',parent:choices[0],broad:true}}}
    return null;
  }
  // Read a directional heading only at exact catalog/token boundaries. The
  // heading supplies province context, never an allow for the whole province.
  function directionalPrefix(text) {
    for(const p of provinceAliases){
      if(!text.startsWith(p.alias))continue;
      const rest=text.slice(p.alias.length).trimStart();
      for(const direction of [...directions].sort((a,b)=>b.length-a.length)){
        if(!rest.startsWith(direction))continue;
        const tail=rest.slice(direction.length);
        if(tail&&!/^[\s:：(]/.test(tail))continue;
        return {province:p.province,region:direction,parent:null,broad:false,body:tail.replace(/^\s*[:：]?\s*/, '')};
      }
    }
    return null;
  }
  function listTargets(text,context={}) {
    const targets=[],errors=[],candidates=[];
    let explicitProvince=context.province||'',lastParent=context.parent||null,lastPath=context.path?[...context.path]:[],pending=null;
    const flush=()=>{if(pending){const entry=catalog.find(c=>c.province===pending.province&&c.name===pending.name);targets.push(entry?.metropolitan&&!pending.path.length?{province:pending.province,name:'',path:[]}:cloneTarget(pending));lastParent=entry||lastParent;lastPath=[...pending.path];pending=null}};
    const chunks=String(text||'').replace(/[必]/g,' ').split(/[,，、/·;；\n]+/);
    for(const chunk of chunks){
      let parentInChunk=false;
      const tokens=chunk.match(/[가-힣0-9]+/g)||[];
      for(let i=0;i<tokens.length;i++){
        const token=tokens[i];
        if(stopWords.has(token))continue;
        if(directions.includes(token)){errors.push('권역에 속하는 시·군 목록 필요: '+token);continue}
        let choices=resolvePlace(token,explicitProvince);
        const province=provinceAliases.find(p=>p.alias===token);
        if(province&&tokens[i+1]===provinceNames[province.province]){flush();explicitProvince=province.province;lastParent=catalog.find(c=>c.metropolitan&&c.province===explicitProvince)||null;lastPath=[];continue}
        // Full province names or non-city province aliases are explicit context; metro short names in a list are places.
        if(province&&(!byAlias.has(token)||province.alias===provinceNames[province.province])){
          if(pending?.province===province.province&&catalog.some(c=>c.metropolitan&&c.name===pending.name)&&!pending.path.length)pending=null;else flush();explicitProvince=province.province;lastParent=catalog.find(c=>c.metropolitan&&c.province===explicitProvince)||null;lastPath=[];
          if(i===tokens.length-1)targets.push({province:explicitProvince,name:'',path:[]});
          continue;
        }
        if(choices.length===1){flush();lastParent=choices[0];lastPath=[];parentInChunk=true;pending={province:lastParent.province,name:lastParent.name,path:[]};continue}
        if(choices.length>1){flush();errors.push('시도 구분 필요: '+token);candidates.push(...choices.map(c=>({province:c.province,name:c.name,path:[]})));lastParent=null;lastPath=[];continue}
        if(/구$/.test(token)){
          const parent=(pending&&catalog.find(c=>c.province===pending.province&&c.name===pending.name))||lastParent;
          let matches=districts.filter(d=>d.aliases.includes(token)&&(!explicitProvince||d.province===explicitProvince));
          if(parent&&(parentInChunk||context.parent))matches=matches.filter(d=>d.province===parent.province&&d.parent===parent.name);
          else if(parent&&matches.length>1){const underParent=matches.filter(d=>d.province===parent.province&&d.parent===parent.name);if(underParent.length)matches=underParent}
          if(matches.length===1){
            const district=matches[0];
            // The explicit municipality is a parent, not an additional whole-city allow.
            if(pending&&pending.province===district.province&&pending.name===district.parent&&!pending.path.length)pending=null;else flush();
            lastParent=catalog.find(c=>c.province===district.province&&c.name===district.parent);lastPath=[];
            pending={province:district.province,name:district.parent,path:[...district.path]};parentInChunk=true;continue;
          }
          if(matches.length>1){flush();errors.push('상위 시도·시 구분 필요: '+token);candidates.push(...matches.map(d=>({province:d.province,name:d.parent,path:[...d.path]})));lastParent=null;lastPath=[];continue}
          const legacy=(reference.legacyRegions||[]).find(d=>d.name===token&&d.province===(explicitProvince||parent?.province));
          errors.push(legacy?'행정구역 변경 확인: '+token+' · '+legacy.reason:'상위 시·군 또는 구 명칭 확인 필요: '+token);pending=null;lastParent=null;lastPath=[];continue;
        }
        const level=childLevel(token);
        if(level){
          let parent=pending?catalog.find(c=>c.province===pending.province&&c.name===pending.name):lastParent;
          if(!parent&&explicitProvince)parent=catalog.find(c=>c.metropolitan&&c.province===explicitProvince)||null;
          if(!parent){errors.push('상위 시·군 필요: '+token);continue}
          const path=pending?[...pending.path]:[...lastPath];
          if(path.length&&childLevel(path[path.length-1])>=level){flush();while(path.length&&childLevel(path[path.length-1])>=level)path.pop()}
          pending={province:parent.province,name:parent.name,path:[...path,token]};lastParent=parent;continue;
        }
        // Compact province qualifiers are allowed; no edit distance, suffix guessing, or OCR correction.
        const h=heading(token);
        if(h&&!h.parent){flush();explicitProvince=h.province;lastParent=catalog.find(c=>c.metropolitan&&c.province===h.province)||null;lastPath=[];if(h.broad)targets.push({province:h.province,name:'',path:[]});else errors.push('권역에 속하는 시·군 목록 필요: '+token);continue}
        errors.push('지역명 확인 필요: '+token);lastParent=null;lastPath=[];
      }
      flush();
    }
    return {targets:dedupe(targets),errors:unique(errors),candidates:dedupe(candidates)};
  }
  const isBlocked = value => /^(?:접수\s*)?(?:불가|불가능|불가지역|불가\s*지역|제외|제외\s*지역|마감|접수\s*마감)$/.test(String(value||'').trim());
  const isExcludedHeader = value => /(?:불가|제외)/.test(compact(value))&&/지역|범위|구역|시군|읍면/.test(compact(value));
  function parseRow(row,index=0,headers=[],options={}) {
    row=Array.isArray(row)?row:[row];headers=Array.isArray(headers)?headers:[];
    const cleanHeaders=headers.map(compact);
    const quantityIndex=cleanHeaders.findIndex(x=>/수량|인원|배정|이월|건수|한도/.test(x));
    const qi=quantityIndex>=0?quantityIndex:1;
    const includeIndex=cleanHeaders.findIndex(x=>/지역|범위|구역|시.?군/.test(x)&&!isExcludedHeader(x)&&!/하위|세부|읍|면|동/.test(x));
    const ri=includeIndex>=0?includeIndex:0;
    const excludedIndices=cleanHeaders.flatMap((h,i)=>isExcludedHeader(h)?[i]:[]);
    const statusIndex=cleanHeaders.findIndex(x=>/상태|접수여부|가능여부/.test(x));
    const si=statusIndex>=0?statusIndex:(!headers.length&&!excludedIndices.includes(2)?2:-1);
    const sourceText=String(row[ri]||'').trim(),quantityText=String(row[qi]??'').trim(),status=si>=0?String(row[si]||'').trim():'';
    const provinceIndex=cleanHeaders.findIndex(x=>/^(?:시.?도|광역)$/.test(x));
    const childIndices=cleanHeaders.flatMap((x,i)=>i!==ri&&!isExcludedHeader(x)&&/^(?:구|읍|면|동|리|읍.?면(?:.?동)?|읍.?면.?동.?리|하위지역|세부지역)$/.test(x)?[i]:[]);
    const childText=childIndices.map(i=>String(row[i]||'').trim()).filter(Boolean).join(' ');
    const regionText=[provinceIndex>=0?String(row[provinceIndex]||'').trim():'',sourceText].filter(Boolean).join(' ');
    const text=regionText+(childText?' : '+childText:'');
    const parsedQuantity=isBlocked(quantityText)?0:/^\d+$/.test(quantityText)?Number(quantityText):null;
    const quantity=Number.isSafeInteger(parsedQuantity)&&parsedQuantity>=0?parsedQuantity:null;
    const errors=[],candidates=[];let include=[],exclude=[],explicitBlocks=[];
    let work=text.replace(/（/g,'(').replace(/）/g,')').replace(/：/g,':');
    let unavailable=!!options.unavailable||isBlocked(quantityText)||isBlocked(status);
    if(/^(?:접수\s*)?(?:불가|제외)\s*지역\s*[:：]/.test(work)){unavailable=true;work=work.replace(/^[^:]+:/,'').trim()}
    if(/^(?:접수\s*)?가능\s*지역\s*[:：]/.test(work))work=work.replace(/^[^:]+:/,'').trim();
    const only=/必|(?:만\s*가능|한정)/.test(work);
    let context={province:options.province||'',parent:null,path:[]},region=options.region||'';
    const colon=work.indexOf(':'),pre=colon>=0?work.slice(0,colon):work.split('(')[0];
    const prefix=colon<0?directionalPrefix(work):null;
    const h=heading(pre)||prefix;
    if(h){context={province:h.province,parent:h.parent,path:[]};region=h.region}
    const baseTarget=h&&h.broad?(h.parent&&!h.parent.metropolitan?{province:h.parent.province,name:h.parent.name,path:[]}:{province:h.province,name:'',path:[]}):null;
    const parens=[];work=work.replace(/\(([^()]*)\)/g,(_,value)=>{parens.push(value);return ' '});
    let body=colon>=0?work.slice(work.indexOf(':')+1):prefix?directionalPrefix(work).body:work;
    const exclusions=[];const addExclusion=(text,explicit=false)=>exclusions.push({text,explicit});
    for(const part of parens){if(/제외|불가/.test(part))addExclusion(part.replace(/접수\s*불가|불가|제외/g,' '),/불가/.test(part));else body+=' '+part}
    // A separate inline exclusion label (e.g. 서산시 전체; 접수 불가: 대산읍).
    const inline=body.match(/(?:접수\s*)?(?:불가|제외)\s*(?:지역)?\s*:/);
    if(inline){addExclusion(body.slice(inline.index+inline[0].length),true);body=body.slice(0,inline.index)}
    if(/(?:제외|불가)\s*$/.test(body)&&!isBlocked(body)){
      const allMatch=body.match(/^(.*?)\s*전체\s*(.*)$/);
      if(allMatch&&heading(allMatch[1])){const bh=heading(allMatch[1]);context={province:bh.province,parent:bh.parent,path:[]};include.push(bh.parent?{province:bh.parent.province,name:bh.parent.name,path:[]}:{province:bh.province,name:'',path:[]});addExclusion(allMatch[2].replace(/제외|불가/g,' '),/불가/.test(allMatch[2]));body=''}
      else {addExclusion(body.replace(/접수\s*불가|불가|제외/g,' '),true);body=''}
    }
    if(colon<0&&h&&!prefix){
      // A direction is metadata only. It does not imply administrative membership.
      if(h.broad&&(!parens.length||exclusions.length))include.push(baseTarget);
      if(!h.broad&&!body.replace(pre,'').trim())errors.push('권역에 속하는 시·군 목록 필요: '+pre.trim());
      body=body.replace(pre,'').trim();
    }
    if(prefix&&!body.trim())errors.push('권역에 속하는 시·군 목록 필요: '+pre.trim());
    if(colon>=0&&baseTarget&&/^(?:전체|전역|모든 지역)$/.test(body.trim()))include.push(baseTarget);
    const parsed=listTargets(body,context);include.push(...parsed.targets);errors.push(...parsed.errors);candidates.push(...parsed.candidates);
    if(!context.parent&&include.length===1&&include[0].name&&!include[0].path.length)context.parent=catalog.find(c=>c.province===include[0].province&&c.name===include[0].name)||null;
    if(!context.province&&include.length===1)context.province=include[0].province;
    for(const i of excludedIndices){const value=String(row[i]||'').trim();if(value&&!/^(?:없음|해당\s*없음|[-—–])$/.test(value))addExclusion(value,true)}
    // Status cells may carry an explicit blocked area instead of a yes/no status.
    const statusExclusion=status.match(/^(?:접수\s*)?(?:불가|제외)\s*(?:지역)?\s*[:：]\s*(.+)$/);
    if(statusExclusion)addExclusion(statusExclusion[1],true);
    for(const item of exclusions){const parsed=listTargets(item.text,context);exclude.push(...parsed.targets);if(item.explicit)explicitBlocks.push(...parsed.targets);errors.push(...parsed.errors);candidates.push(...parsed.candidates)}
    include=dedupe(include.filter(Boolean));exclude=dedupe(exclude);
    if(unavailable){exclude=dedupe([...exclude,...include]);explicitBlocks=[...exclude];include=[]}
    if(!include.length&&exclude.length)explicitBlocks=[...exclude];
    explicitBlocks=dedupe(explicitBlocks);
    if(only&&!include.some(target=>target.name)&&!unavailable)errors.push('必 적용 시·군 또는 하위 지역 목록 필요');
    if(only&&exclude.length&&!unavailable)errors.push('必와 제외 조건이 함께 있어 적용 범위 확인 필요');
    if(/[#＃]/.test(text))errors.push('# 기호의 적용 의미 확인 필요');
    if(!include.length&&!exclude.length)errors.push('적용할 시·군 또는 하위 지역 필요');
    const quantityReview=/^확인\s*필요/.test(status);
    return {index,text,row:[...row],province:h?.province||options.province||'',region,quantity,quantityText,quantityReview,unavailable,only,listedOnly:!!(region&&region!=='전체'&&include.length),mode:unavailable?'blocked':exclude.length?'exclude':only?'only':include.some(t=>!t.name)?'all':'listed',include,exclude,explicitBlocks,candidates:dedupe(candidates),errors:unique(errors),sharedQuantity:true};
  }
  function parseRows(rows,options={}) {
    if(!Array.isArray(rows))return [];
    const legacyHeaders=Array.isArray(options);let headers=legacyHeaders?options:(options?.headers||[]);
    const intakeCodes=legacyHeaders?intakeCatalog.defaults:(options?.intakeCodes||intakeCatalog.defaults);
    const isTableHeader=row=>row.some(cell=>/^(?:수량|인원|배정|이월|건수|한도)$/.test(compact(cell)))&&row.some(cell=>/^(?:(?:접수)?가능지역|지역|지역명|적용범위|범위|시.?군(?:.?구)?)$/.test(compact(cell)));
    const result=[];let unavailable=false,province='',region='';
    for(let i=0;i<rows.length;i++){
      const row=rows[i];if(!Array.isArray(row)||!row.some(cell=>String(cell||'').trim()))continue;
      if(isTableHeader(row)){headers=row;continue}
      const nonempty=row.filter(cell=>String(cell||'').trim());const text=String(nonempty[0]||'').trim();
      if(nonempty.length===1&&readIntakeCodeHeader(text,intakeCodes))continue;
      if(nonempty.length===1&&/^(?:접수\s*)?(?:가능|불가|제외)\s*지역\s*[:：]?$/.test(text)){unavailable=/불가|제외/.test(text);continue}
      if(nonempty.length===1){
        const h=heading(text.replace(/[:：]$/, ''));
        if(h&&!h.parent){province=h.province;region=h.broad?'':h.region;continue}
      }
      result.push(parseRow(row,i,headers,{unavailable,province,region}));
    }
    return result;
  }
  // Categories come from policy declarations, never inferred direction membership.
  // An unsectioned policy remains directly under its province.
  function categories(scopes) {
    const groups=new Map();
    for(const scope of scopes){
      const provinces=unique([scope.province,...scope.include.map(t=>t.province),...scope.exclude.map(t=>t.province)].filter(Boolean));
      if(!provinces.length)provinces.push('');
      for(const province of provinces){
        if(!groups.has(province))groups.set(province,{province,label:provinceNames[province]||province||'지역 확인 필요',sections:[]});
        const group=groups.get(province),region=scope.region&&scope.region!=='전체'&&(!scope.province||scope.province===province)?scope.region:'';
        let section=group.sections.find(s=>s.region===region);
        if(!section){section={region,label:region?province+region:'권역 구분 없음',scopes:[]};group.sections.push(section)}
        section.scopes.push(scope);
      }
    }
    return [...groups.values()].sort((a,b)=>a.label.localeCompare(b.label,'ko'));
  }
  function normalizePlace(place) {
    if(!place)return null;
    const province=resolveProvince(place.province)||place.province||'';
    const choices=resolvePlace(place.name||'',province);
    if(choices.length===1)return {province:choices[0].province,name:choices[0].name,path:Array.isArray(place.path)?place.path.map(String):[]};
    const matches=districts.filter(d=>d.aliases.includes(place.name||'')&&(!province||d.province===province)&&(!place.parent||d.parent===place.parent));
    if(matches.length!==1)return null;
    const district=matches[0],path=Array.isArray(place.path)?place.path.map(String):[];
    return {province:district.province,name:district.parent,path:path[0]===district.name?path:[...district.path,...path]};
  }
  function contains(target,place) {
    return target.province===place.province&&(!target.name||target.name===place.name)&&(target.path||[]).every((part,i)=>place.path[i]===part);
  }
  function intersects(target,place) {return contains(target,place)||contains(place,target)}
  function evaluate(scopes,rawPlace) {
    const place=normalizePlace(rawPlace);
    const response=(state,reason,matches=[],restrictions=[])=>{
      const ids=unique(matches.map(s=>s.index)),allowMatches=matches.filter(s=>!s.unavailable&&s.quantity>0);
      const quantities=unique(allowMatches.map(s=>s.index)).map(index=>({row:index,quantity:allowMatches.find(s=>s.index===index).quantity}));
      return {state,reason,quantity:state!=='blocked'&&state!=='review'&&quantities.length===1?quantities[0].quantity:null,rows:ids,matches:matches.map(s=>({index:s.index,text:s.text,quantity:s.quantity})),quantities,restrictions,sharedQuantity:true};
    };
    if(!place)return response('review','시도와 시·군을 명확하게 선택해 주세요.');
    const directAllow=[],partialAllow=[],childAllow=[],directBlock=[],childBlock=[],review=[],localExcluded=[];const restrictions=[];
    for(const scope of scopes||[]){
      const localExcludes=(scope.exclude||[]).filter(target=>!(scope.explicitBlocks||[]).some(block=>targetKey(block)===targetKey(target)));
      const blockedHere=localExcludes.some(target=>contains(target,place));
      const excludedChildren=localExcludes.filter(target=>intersects(target,place)&&!contains(target,place));
      for(const target of localExcludes){if(intersects(target,place)){restrictions.push({...cloneTarget(target),kind:'excluded',row:scope.index,text:scope.text});localExcluded.push(scope)}}
      const blocks=[...(scope.explicitBlocks||[]),...((scope.quantity===0&&!blockedHere)?scope.include||[]:[])];
      for(const target of blocks){if(!intersects(target,place))continue;restrictions.push({...cloneTarget(target),kind:'blocked',row:scope.index,text:scope.text});if(contains(target,place)&&!(scope.quantity===0&&excludedChildren.length&&!(scope.explicitBlocks||[]).some(block=>targetKey(block)===targetKey(target))))directBlock.push(scope);else childBlock.push(scope)}
      const related=(scope.include||[]).some(target=>intersects(target,place));
      const uncertain=(scope.errors||[]).length||scope.quantityReview||scope.quantity===null;
      if(uncertain&&!blockedHere&&(related||(scope.errors?.length&&scope.province===place.province)||(scope.candidates||[]).some(target=>intersects(target,place))))review.push(scope);
      if(scope.unavailable||scope.quantity===0||uncertain||blockedHere)continue;
      for(const target of scope.include||[]){
        if(!intersects(target,place))continue;
        restrictions.push({...cloneTarget(target),kind:'included',row:scope.index,text:scope.text});
        if(contains(target,place)){if(excludedChildren.length)partialAllow.push(scope);else directAllow.push(scope)}else childAllow.push(scope);
      }
    }
    if(directBlock.length)return response('blocked','정책에 접수 불가로 표시되었거나 수량이 0인 지역입니다.',directBlock,restrictions);
    if(review.length)return response('review','이 지역에 적용될 원문 범위 또는 수량을 확인해야 합니다.',review,restrictions);
    const allowed=directAllow.length?directAllow:partialAllow.length?partialAllow:childAllow;
    if(!allowed.length)return response('blocked',localExcluded.length?'해당 정책 행의 접수 범위에서 제외된 지역입니다.':'등록된 접수 가능 범위에 포함되지 않은 지역입니다.',[...childBlock,...localExcluded],restrictions);
    if(unique(directAllow.map(s=>s.index)).length>1&&unique(directAllow.map(s=>s.quantity)).length>1)return response('review','동일 지역의 서로 다른 수량 정책이 겹쳐 적용 행을 확인해야 합니다.',directAllow,restrictions);
    if(!directAllow.length||childBlock.length)return response('partial',!directAllow.length&&!partialAllow.length?'명시된 구·읍·면·동·리만 접수 가능합니다. 나머지는 불가합니다.':'일부 구·읍·면·동·리가 제외됩니다. 하위 지역을 확인해 주세요.',[...allowed,...childBlock],restrictions);
    return response('possible','등록된 적용 범위입니다. 수량은 원문 정책 행의 지역들이 공유합니다.',directAllow,restrictions);
  }
  const api={version:1,referenceUrl:'https://www.mois.go.kr/frt/sub/a04/localGovernment/screen.do',provinceNames,catalog,districts,readIntakeCodeHeader,resolvePlace,resolveProvince,heading,parseRow,parseRows,categories,evaluate,contains,label};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.PolicyRegionRules=api;
})(typeof window!=='undefined'?window:globalThis);
