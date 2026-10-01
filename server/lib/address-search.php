<?php
declare(strict_types=1);

// Shared public address results only: no applicant, employee or session data.
const ADDRESS_SEARCH_BODY_LIMIT=1048576;
const ADDRESS_SEARCH_FRESH_SECONDS=21600;
const ADDRESS_SEARCH_EMPTY_SECONDS=600;
const ADDRESS_SEARCH_STALE_SECONDS=604800;
const ADDRESS_SEARCH_CACHE_LIMIT=2000;

class AddressSearchUnavailable extends RuntimeException {}

function address_search_query(mixed $value): string {
    if(!is_string($value)||!mb_check_encoding($value,'UTF-8')||mb_strlen($value)>120||preg_match('/[\p{Cc}\p{Cf}\x{1100}-\x{11ff}\x{3130}-\x{318f}\x{a960}-\x{a97f}\x{d7b0}-\x{d7ff}]/u',$value))throw new InvalidArgumentException('검색할 주소를 확인해 주세요.');
    $query=trim(preg_replace('/\s+/u',' ',$value));
    if(preg_match_all('/[가-힣]/u',$query)<2)throw new InvalidArgumentException('주소를 한글 두 글자 이상 입력해 주세요.');
    return $query;
}

function address_search_cache_key(string $query): string {
    return hash('sha256','postcodify:3.5.0:ko:'.mb_strtolower($query,'UTF-8'));
}

function address_search_text(mixed $value,int $limit,bool $required=false): string {
    if($value===null&&!$required)return '';
    if(!is_string($value)||!mb_check_encoding($value,'UTF-8')||mb_strlen($value)>$limit||preg_match('/[\p{Cc}\p{Cf}]/u',$value))throw new AddressSearchUnavailable();
    $value=trim(preg_replace('/\s+/u',' ',$value));
    if($required&&$value==='')throw new AddressSearchUnavailable();
    return $value;
}

function address_search_decode(string $body): array {
    if(strlen($body)>ADDRESS_SEARCH_BODY_LIMIT)throw new AddressSearchUnavailable();
    try{$data=json_decode($body,true,16,JSON_THROW_ON_ERROR);}catch(JsonException $e){throw new AddressSearchUnavailable();}
    if(!is_array($data)||!isset($data['error'])||!is_string($data['error'])||$data['error']!==''||!isset($data['count'])||!is_int($data['count'])||$data['count']<0||$data['count']>1000000||!isset($data['results'])||!is_array($data['results'])||!array_is_list($data['results'])||count($data['results'])>1000||count($data['results'])>$data['count']||($data['count']>0&&$data['results']===[]))throw new AddressSearchUnavailable();
    $results=[];
    foreach(array_slice($data['results'],0,50) as $row){
        if(!is_array($row)||array_is_list($row))throw new AddressSearchUnavailable();
        $item=[];
        foreach(['ko_common'=>160,'ko_jibeon'=>180,'ko_doro'=>180,'building_name'=>200,'other_addresses'=>10000,'building_id'=>80,'address_id'=>80] as $key=>$limit){
            $item[$key]=address_search_text($row[$key]??null,$limit,in_array($key,['ko_common','ko_jibeon'],true));
        }
        // The UI displays at most 160 characters of this optional description.
        $item['other_addresses']=mb_substr($item['other_addresses'],0,160,'UTF-8');
        $results[]=$item;
    }
    // Keep the provider's total; a capped response must not become a unique match.
    return ['error'=>'','count'=>$data['count'],'results'=>$results];
}

function address_search_fetch(string $query): string {
    $url='https://api.poesis.kr/post/search.php?v=3.5.0&q='.rawurlencode($query).'&ref=cncstaff.com';
    if(function_exists('curl_init')){
        $curl=curl_init($url);if($curl===false)throw new AddressSearchUnavailable();
        $body='';$overflow=false;
        try{
            curl_setopt_array($curl,[CURLOPT_FOLLOWLOCATION=>false,CURLOPT_MAXREDIRS=>0,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_CONNECTTIMEOUT_MS=>1500,CURLOPT_TIMEOUT_MS=>4500,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_HTTPHEADER=>['Accept: application/json'],CURLOPT_USERAGENT=>'CNCAddressSearch/1.0',CURLOPT_WRITEFUNCTION=>static function($handle,string $chunk)use(&$body,&$overflow):int{if(strlen($body)+strlen($chunk)>ADDRESS_SEARCH_BODY_LIMIT){$overflow=true;return 0;}$body.=$chunk;return strlen($chunk);}]);
            $ok=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);
            if($ok===false||$overflow||$status!==200)throw new AddressSearchUnavailable();
            return $body;
        }finally{curl_close($curl);}
    }
    $deadline=microtime(true)+4.5;
    $context=stream_context_create(['http'=>['method'=>'GET','timeout'=>4.5,'follow_location'=>0,'max_redirects'=>0,'ignore_errors'=>true,'header'=>"Accept: application/json\r\nUser-Agent: CNCAddressSearch/1.0\r\n"],'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'allow_self_signed'=>false]]);
    $stream=@fopen($url,'rb',false,$context);if($stream===false)throw new AddressSearchUnavailable();
    try{
        $body='';$meta=stream_get_meta_data($stream);$headers=$meta['wrapper_data']??[];
        if(!is_array($headers)||!preg_match('/^HTTP\/\S+ 200(?: |$)/D',$headers[0]??''))throw new AddressSearchUnavailable();
        while(!feof($stream)){
            $remaining=$deadline-microtime(true);if($remaining<=0)throw new AddressSearchUnavailable();
            $seconds=(int)$remaining;stream_set_timeout($stream,$seconds,max(1,(int)(($remaining-$seconds)*1000000)));
            $chunk=@fread($stream,8192);$meta=stream_get_meta_data($stream);
            if($chunk===false||!empty($meta['timed_out'])||strlen($body)+strlen($chunk)>ADDRESS_SEARCH_BODY_LIMIT)throw new AddressSearchUnavailable();
            $body.=$chunk;
        }
        return $body;
    }finally{fclose($stream);}
}

function address_search_cached(PDO $db,string $key,int $now): ?array {
    $q=$db->prepare('SELECT response_json,expires_at,stale_until FROM address_search_cache WHERE query_hash=? AND stale_until>?');$q->execute([$key,$now]);$row=$q->fetch(PDO::FETCH_ASSOC);
    if(!$row)return null;
    try{$data=address_search_decode((string)$row['response_json']);}catch(AddressSearchUnavailable $e){return null;}
    return ['data'=>$data,'fresh'=>(int)$row['expires_at']>$now];
}

function address_search_store(PDO $db,string $key,array $data,int $now): void {
    $empty=$data['count']===0;$ttl=$empty?ADDRESS_SEARCH_EMPTY_SECONDS:ADDRESS_SEARCH_FRESH_SECONDS;
    $values=[$key,json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$now,$now+$ttl,$now+($empty?$ttl:ADDRESS_SEARCH_STALE_SECONDS)];
    $sql='INSERT INTO address_search_cache(query_hash,response_json,cached_at,expires_at,stale_until) VALUES(?,?,?,?,?)';
    $sql.=$db->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'?' ON CONFLICT(query_hash) DO UPDATE SET response_json=excluded.response_json,cached_at=excluded.cached_at,expires_at=excluded.expires_at,stale_until=excluded.stale_until':' ON DUPLICATE KEY UPDATE response_json=VALUES(response_json),cached_at=VALUES(cached_at),expires_at=VALUES(expires_at),stale_until=VALUES(stale_until)';
    $db->prepare($sql)->execute($values);
    $db->prepare('DELETE FROM address_search_cache WHERE stale_until<=?')->execute([$now]);
    // Indexed, bounded pruning also limits distinct searches retained in the cache.
    $db->exec('DELETE FROM address_search_cache WHERE query_hash IN (SELECT query_hash FROM (SELECT query_hash FROM address_search_cache ORDER BY cached_at DESC,query_hash DESC LIMIT '.ADDRESS_SEARCH_CACHE_LIMIT.',100) AS excess_address_cache)');
}

function address_search(PDO $db,mixed $value,?callable $fetch=null,?int $now=null): array {
    $query=address_search_query($value);$key=address_search_cache_key($query);$now??=time();
    $cached=address_search_cached($db,$key,$now);if($cached&&$cached['fresh'])return $cached['data'];
    // Concurrent windows reuse an existing result rather than queue behind a slow provider.
    $lock=null;
    if($db->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'){
        $lock='cnc-address-'.substr($key,0,48);$q=$db->prepare('SELECT GET_LOCK(?,0)');$q->execute([$lock]);
        if((int)$q->fetchColumn()!==1){if($cached&&$cached['data']['count']>0)return $cached['data'];$lock=null;}
    }
    try{
        $cached=address_search_cached($db,$key,$now);if($cached&&$cached['fresh'])return $cached['data'];
        try{$body=($fetch??'address_search_fetch')($query);if(!is_string($body))throw new AddressSearchUnavailable();$data=address_search_decode($body);}
        catch(AddressSearchUnavailable $e){if($cached&&$cached['data']['count']>0)return $cached['data'];throw $e;}
        try{address_search_store($db,$key,$data,$now);}catch(PDOException $e){error_log('cnchome address cache write unavailable');}
        return $data;
    }finally{
        if($lock!==null){try{$db->prepare('SELECT RELEASE_LOCK(?)')->execute([$lock]);}catch(PDOException $e){error_log('cnchome address cache lock unavailable');}}
    }
}
