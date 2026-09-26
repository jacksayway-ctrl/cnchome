(function(root){
 'use strict';
 const compact=v=>String(v??'').replace(/\s/g,'');
 const ageWords=/(?:\d+\s*[~～–-]\s*)?\d+\s*세\s*(?:이하|이상|까지)?/g;
 function kindHeading(value){const text=String(value??'').replace(ageWords,'').replace(/(?:세는나이|만나이아님|만 나이 아님)/g,'').replace(/[\s()[\]·:：-]/g,'');return text==='일반'?'general':text==='실버'?'silver':''}
 function kindForAge(value){const age=Number(value);return value!==''&&Number.isInteger(age)&&age>=1&&age<=61?'general':Number.isInteger(age)&&age>=62&&age<=70?'silver':''}
 function inline(value){
  let text=String(value??''),kind='';
  const prefix=text.match(/^\s*(일반|실버)(?=\s|[:：]|\d+\s*세)/),suffix=text.match(/(?:\s+|[·:：])(일반|실버)\s*$/);
  if(prefix){kind=prefix[1]==='일반'?'general':'silver';text=text.slice(prefix[0].length).replace(/^\s*[:：]?\s*/,'').replace(ageWords,'').trim()}
  else if(suffix){kind=suffix[1]==='일반'?'general':'silver';text=text.slice(0,suffix.index).trim()}
  return {text,kind};
 }
 function prepare(text,codeHeader=()=>null){
  const lines=String(text||'').replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);
  const csv=lines.some(x=>/지역.*[,，].*(?:수량|건수|일반|실버)/.test(x));
  const raw=lines.map(line=>(line.includes('\t')?line.split('\t'):csv?line.split(','):line.split(/\s{2,}/)).map(x=>x.trim()));
  const result=[],marks=[];let current='',header=null,kindColumn=-1,dual=null;
  for(const input of raw){
   let row=[...input];const nonempty=row.filter(Boolean),title=nonempty.join(' ');
   const regionColumn=row.findIndex(x=>/^(?:(?:접수)?가능지역|지역|지역명|범위|시.?군(?:.?구)?)$/.test(compact(x)));
   if(regionColumn>=0){
    const columns=row.map((x,i)=>({i,kind:kindHeading(x.replace(/수량|건수|가능개수/g,''))})).filter(x=>x.kind);
    if(columns.length===2){const rest=row.map((_,i)=>i).filter(i=>i!==regionColumn&&!columns.some(c=>c.i===i));dual={region:regionColumn,columns,rest};kindColumn=-1;header=['지역','수량',...rest.map(i=>row[i])];if(!result.some((_,i)=>marks[i]==='header')){result.push(header);marks.push('header')}continue;}
    dual=null;header=row;kindColumn=row.findIndex(x=>/^(?:상품(?:구분)?|구분|연령구분)$/.test(compact(x)));if(!result.some((_,i)=>marks[i]==='header')){result.push(row);marks.push('header')}continue;
   }
   const code=nonempty.length===1?codeHeader(title):null;
   if(code){const match=compact(title).match(/일반|실버/);if(match)current=match[0]==='일반'?'general':'silver';result.push(row);marks.push('title');continue;}
   const heading=nonempty.length===1?kindHeading(title):'';if(heading){current=heading;continue;}
   if(dual){for(const c of dual.columns){if(String(row[c.i]??'').trim()==='')continue;result.push([row[dual.region]||'',row[c.i],...dual.rest.map(i=>row[i]||'')]);marks.push(c.kind)}continue;}
   const first=inline(row[0]);row[0]=first.text;let kind=first.kind||(kindColumn>=0?kindHeading(row[kindColumn]):'')||current;
   if(row.filter(Boolean).length===1){const m=row[0].match(/^(.*[가-힣)）])\s*[:：]?\s+(\d+)\s*(?:건|개)?$/);if(m)row=[m[1].trim(),m[2]];}
   result.push(row);marks.push(kind);
  }
  const kinds=[...new Set(marks.filter(x=>x==='general'||x==='silver'))];
  if(kinds.length&&kindColumn<0){
   const width=Math.max(2,...result.filter((_,i)=>marks[i]!=='title').map(r=>r.length));
   for(let i=0;i<result.length;i++){if(marks[i]==='title')continue;while(result[i].length<width)result[i].push('');result[i].push(marks[i]==='header'?'상품 구분':marks[i]==='general'?'일반':marks[i]==='silver'?'실버':'');}
   if(!marks.includes('header')){result.unshift([...Array.from({length:width},(_,i)=>i===0?'지역':i===1?'수량':i===2?'상태':'열 '+(i+1)),'상품 구분']);}
  }
  return {rows:result,kinds};
 }
 function groups(rows,fallback){
  const header=rows[0]||[],index=header.findIndex(x=>/^(?:상품(?:구분)?|구분|연령구분)$/.test(compact(x))),result={};
  for(const row of rows.slice(1)){const kind=(index>=0?kindHeading(row[index]):'')||(fallback==='general'||fallback==='silver'?fallback:'');if(!kind)throw Error('일반·실버 구분이 없는 행이 있습니다. 등록 상품을 선택해 주세요.');if(fallback!=='auto'&&fallback&&kind!==fallback)throw Error('표의 일반·실버 구분과 선택한 등록 상품이 다릅니다. 자동 분류를 선택해 주세요.');(result[kind]??=[header]).push(row);}
  return result;
 }
 const api={prepare,groups,kindHeading,kindForAge};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PolicyInput=api;
})(typeof window!=='undefined'?window:globalThis);
