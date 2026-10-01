<?php
// Isolated cache fixture only. Never calls the provider or the production database.
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require __DIR__.'/../lib/address-search.php';
function address_check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
function address_rejects(callable $call,string $class,string $message): void {try{$call();}catch(Throwable $e){address_check($e instanceof $class,$message.' (wrong exception)');return;}throw new RuntimeException($message);}
$db=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$db->exec('CREATE TABLE address_search_cache(query_hash TEXT PRIMARY KEY,response_json TEXT NOT NULL,cached_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,stale_until INTEGER NOT NULL);CREATE INDEX address_cache_expiry ON address_search_cache(stale_until);CREATE INDEX address_cache_recent ON address_search_cache(cached_at,query_hash);');
$row=['ko_common'=>'대전광역시 서구','ko_jibeon'=>'탄방동 1','ko_doro'=>'문정로 10','building_name'=>'주소 검증 건물','building_id'=>'fixture-building-1','address_id'=>'fixture-address-1','other_addresses'=>'다른 도로명 설명'];
$raw=json_encode(['error'=>'','count'=>1,'results'=>[$row],'unneeded_provider_value'=>'discarded'],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
$calls=0;$queries=[];$fetch=static function(string $query)use(&$calls,&$queries,$raw):string{$calls++;$queries[]=$query;return $raw;};
$now=2000000000;
$first=address_search($db,'  대전   탄방동 1  ',$fetch,$now);
address_check($calls===1&&$queries===['대전 탄방동 1']&&$first['count']===1&&$first['results'][0]['ko_doro']===$row['ko_doro'],'first search normalizes spaces and preserves parcel plus road results');
$second=address_search($db,'대전 탄방동 1',$fetch,$now+1);
address_check($calls===1&&$second===$first,'another window reuses one DB cache entry without a provider request');
$stored=$db->query('SELECT * FROM address_search_cache')->fetch();
address_check(strlen($stored['query_hash'])===64&&!str_contains($stored['query_hash'],'대전')&&array_keys($stored)===['query_hash','response_json','cached_at','expires_at','stale_until'],'cache stores only a versioned query hash, public result and expiry data');
address_check(!str_contains($stored['response_json'],'unneeded_provider_value')&&(int)$stored['expires_at']===$now+21600,'provider extras are discarded and successful addresses expire after six hours');
address_search($db,'대전 탄방동 1',$fetch,$now+ADDRESS_SEARCH_FRESH_SECONDS);
address_check($calls===2,'expired public results refresh once');
$unavailable=static function(string $query):string{throw new AddressSearchUnavailable();};
$staleAt=$now+ADDRESS_SEARCH_FRESH_SECONDS*2;
address_check(address_search($db,'대전 탄방동 1',$unavailable,$staleAt)===$first,'provider outage can reuse a previously valid result within seven days');
address_rejects(fn()=>address_search($db,'대전 탄방동 1',$unavailable,$now+ADDRESS_SEARCH_FRESH_SECONDS+ADDRESS_SEARCH_STALE_SECONDS),AddressSearchUnavailable::class,'expired stale data cannot survive the retention deadline');
address_rejects(fn()=>address_search($db,'서울 없는길 9',$unavailable,$now),AddressSearchUnavailable::class,'provider failure without an existing result remains a failure');
address_check((int)$db->query('SELECT COUNT(*) FROM address_search_cache')->fetchColumn()===1,'provider failures are never cached as empty results');
$emptyCalls=0;$empty=static function(string $query)use(&$emptyCalls):string{$emptyCalls++;return '{"error":"","count":0,"results":[]}';};
address_search($db,'부산 없는길 9',$empty,$now);
address_search($db,'부산 없는길 9',$empty,$now+599);
address_check($emptyCalls===1,'genuine zero results have a short ten-minute cache');
address_rejects(fn()=>address_search($db,'부산 없는길 9',$unavailable,$now+600),AddressSearchUnavailable::class,'expired zero-result searches never become stale fallback');
address_search($db,'부산 없는길 9',$empty,$now+600);
address_check($emptyCalls===2,'zero-result cache expires after ten minutes');
foreach([null,[],42,'한','ㄷㅈ 1',"대전\n탄방동 1",'대전'.str_repeat('가',119),"대전\xFF",'대전'."\u{200B}".'1'] as $bad){address_rejects(fn()=>address_search($db,$bad,$fetch,$now),InvalidArgumentException::class,'invalid, incomplete, oversized and control-character queries are rejected');}
address_check($calls===2,'query validation rejects before fetching');
$longRows=[];for($i=0;$i<55;$i++)$longRows[]=array_replace($row,['building_id'=>'fixture-'.$i]);
$bounded=address_search_decode(json_encode(['error'=>'','count'=>100,'results'=>$longRows],JSON_THROW_ON_ERROR));
address_check(count($bounded['results'])===50&&$bounded['count']===100,'bounded stored rows retain provider total so capped results cannot auto-select as unique');
$optional=address_search_decode(json_encode(['error'=>'','count'=>1,'results'=>[array_replace($row,['other_addresses'=>str_repeat('가',9999)])]],JSON_THROW_ON_ERROR));
address_check(mb_strlen($optional['results'][0]['other_addresses'])===160,'oversized optional display descriptions are bounded before caching');
$invalidPayloads=[
    '{invalid',str_repeat(' ',ADDRESS_SEARCH_BODY_LIMIT+1),
    json_encode(['error'=>'quota exceeded','count'=>0,'results'=>[]]),
    json_encode(['error'=>'','count'=>1,'results'=>[]]),
    json_encode(['error'=>'','count'=>0,'results'=>[$row]]),
    json_encode(['error'=>'','count'=>'1','results'=>[$row]]),
    json_encode(['error'=>'','count'=>1,'results'=>[['ko_common'=>'대전','ko_jibeon'=>['unexpected']]]]),
    json_encode(['error'=>'','count'=>1,'results'=>[array_replace($row,['ko_doro'=>"bad\nroad"])]]),
    json_encode(['error'=>'','count'=>1,'results'=>[array_replace($row,['ko_common'=>str_repeat('가',161)])]]),
    json_encode(['error'=>'','count'=>1001,'results'=>array_fill(0,1001,$row)])
];
foreach($invalidPayloads as $body){address_rejects(fn()=>address_search($db,'인천 검증길 8',static fn(string $query):string=>$body,$now),AddressSearchUnavailable::class,'malformed, excessive and provider-error payloads are not cached');}
$q=$db->prepare('SELECT COUNT(*) FROM address_search_cache WHERE query_hash=?');$q->execute([address_search_cache_key('인천 검증길 8')]);address_check((int)$q->fetchColumn()===0,'rejected upstream payloads leave no cached result');
// SQL metacharacters remain query text and cannot alter the isolated schema.
address_search($db,"대전 ' OR 1=1 -- 9",$fetch,$now);
address_check((int)$db->query('SELECT COUNT(*) FROM address_search_cache')->fetchColumn()===3,'query metacharacters are bound and hashed safely');
$db->prepare('UPDATE address_search_cache SET response_json=? WHERE query_hash=?')->execute(['{"error":"","count":1,"results":[]}',address_search_cache_key('대전 탄방동 1')]);
address_search($db,'대전 탄방동 1',$fetch,$now+1);
address_check($calls===4,'corrupt stored payload is validated and refreshed rather than returned');
// Cache retention is bounded, even for many distinct valid address searches.
$db->beginTransaction();$insert=$db->prepare('INSERT INTO address_search_cache VALUES(?,?,?,?,?)');
for($i=0;$i<ADDRESS_SEARCH_CACHE_LIMIT+3;$i++)$insert->execute([hash('sha256','fixture-prune-'.$i),$raw,$now-10,$now+1,$now+10]);$db->commit();
address_search($db,'광주 검증길 5',$fetch,$now);
address_check((int)$db->query('SELECT COUNT(*) FROM address_search_cache')->fetchColumn()===ADDRESS_SEARCH_CACHE_LIMIT,'distinct cached queries are capped at two thousand entries');
address_search($db,'광주 검증길 6',$fetch,$now+ADDRESS_SEARCH_STALE_SECONDS+10);
address_check((int)$db->query('SELECT COUNT(*) FROM address_search_cache')->fetchColumn()===1,'expired cache rows are removed during successful refresh');
echo "PASS: isolated address cache normalization, shared reuse, expiry, bounded stale fallback, short empty TTL, input/schema validation, response limits, safe binding and finite retention.\n";
