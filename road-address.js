(function(global){
 'use strict';
 const endpoint='https://api.poesis.kr/post/search.php',cache=new Map();
 const cacheAge=5*60*1000,cacheLimit=100,responseLimit=1024*1024;
 const clean=value=>typeof value==='string'?value.replace(/\s+/gu,' ').trim():'';
 const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const copy=result=>({items:result.items.map(item=>({...item})),count:result.count});
 const failed=()=>Error('주소 검색에 연결하지 못했습니다. 잠시 후 다시 입력하거나 주소를 직접 입력해 주세요.');
 const aborted=()=>new global.DOMException('주소 검색을 취소했습니다.','AbortError');
 function shouldSearch(value){
  if(typeof value!=='string'||value.length>120||/[\u0000-\u001f\u007f\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/u.test(value))return false;
  const query=clean(value);
  if((query.match(/[가-힣]/gu)||[]).length<2)return false;
  return /\d/u.test(query)||/[가-힣0-9·]+(?:로|길)$/u.test(query);
 }
 function field(value,limit,required=false){
  if(value===undefined||value===null){if(required)throw failed();return '';}
  if(typeof value!=='string'||value.length>limit||/[\u0000-\u001f\u007f]/u.test(value))throw failed();
  const result=clean(value);if(required&&!result)throw failed();return result;
 }
 function parse(data,query){
  if(!plain(data)||typeof data.error!=='string'||data.error.length>2000)throw failed();
  if(data.error){
   if(/quota/iu.test(data.error))throw Error('주소 검색 가능 횟수를 초과했습니다. 주소를 직접 입력해 주세요.');
   throw failed();
  }
  if(!Number.isSafeInteger(data.count)||data.count<0||data.count>1000000||!Array.isArray(data.results)||data.results.length>1000||data.results.length>data.count||data.count>0&&!data.results.length)throw failed();
  const kind=/[가-힣0-9·]+(?:로|길)(?=\s|\d|$)/u.test(query)?'도로명':'지번';
  const seen=new Set(),items=[];
  for(const entry of data.results.slice(0,50)){
   if(!plain(entry))throw failed();
   const common=field(entry.ko_common,160,true),parcel=field(entry.ko_jibeon,180,true),road=field(entry.ko_doro,180);
   const building=(field(entry.building_name,200)||field(entry.other_addresses,10000)).slice(0,160),buildingId=field(entry.building_id,80),addressId=field(entry.address_id,80);
   // Policy matching consumes the leading province/city and legal locality.
   // Keep those from the parcel address even when the query uses a road name.
   const parcelAddress=common+' '+parcel,label=parcelAddress+(road&&road!==parcel?' · '+road:'');
   if(label.length>500)throw failed();
   const id='address:'+(buildingId||addressId||label);
   if(seen.has(id))continue;seen.add(id);
   const secondary=building;
   items.push({id,label,secondary,kind});
  }
  if(data.count>0&&!items.length)throw failed();
  return {items,count:data.count};
 }
 function remember(query,result){
  const now=Date.now();
  for(const [key,value] of cache)if(now-value.savedAt>=cacheAge)cache.delete(key);
  cache.delete(query);cache.set(query,{savedAt:now,result:copy(result)});
  while(cache.size>cacheLimit)cache.delete(cache.keys().next().value);
 }
 async function search(value,{signal}={}){
  if(signal?.aborted)throw aborted();
  if(!shouldSearch(value))return {items:[],count:0};
  const query=clean(value),cached=cache.get(query);
  if(cached&&Date.now()-cached.savedAt<cacheAge)return copy(cached.result);
  if(cached)cache.delete(query);
  const controller=new global.AbortController();let timedOut=false;
  const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted){signal.removeEventListener('abort',cancel);throw aborted();}
  const timer=global.setTimeout(()=>{timedOut=true;controller.abort();},8000);
  try{
   const url=new global.URL(endpoint);
   url.searchParams.set('v','3.5.0');url.searchParams.set('q',query);url.searchParams.set('ref',global.location.hostname);
   const response=await global.fetch(url.href,{method:'GET',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',headers:{Accept:'application/json'},signal:controller.signal});
   if(!response.ok||Number(response.headers.get('content-length'))>responseLimit)throw failed();
   const body=await response.text();if(body.length>responseLimit)throw failed();
   let data;try{data=JSON.parse(body);}catch(error){throw failed();}
   const result=parse(data,query);if(signal?.aborted)throw aborted();
   remember(query,result);return copy(result);
  }catch(error){
   if(signal?.aborted)throw aborted();
   if(timedOut)throw Error('주소 검색 응답이 늦어지고 있습니다. 다시 입력하거나 주소를 직접 입력해 주세요.');
   if(error instanceof Error&&/^주소 검색/u.test(error.message))throw error;
   throw failed();
  }finally{global.clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }
 function attach(form){
  const input=form?.querySelector('[name="consultationPlace"]');
  if(input)input.dataset.addressSearch='true';
 }
 global.RoadAddress={search,shouldSearch,attach};
})(window);
