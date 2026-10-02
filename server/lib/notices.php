<?php
declare(strict_types=1);
class NoticeForbidden extends RuntimeException {}
function notice_assert(bool $ok,string $message): void {if(!$ok)throw new InvalidArgumentException($message);}
function notice_add(string $channel,string $department,string $title,string $body,int $actor,string $source): void {
 $q=db()->prepare('INSERT INTO office_notices(channel,department,title,body,actor_id,source_key) VALUES(?,?,?,?,?,?)');
 $q->execute([$channel,$department,mb_substr($title,0,120),mb_substr($body,0,1500),$actor,$source]);
}
function notice_snapshot(array $user,?int $after=null): array {
 $d=db();$where="active=1";$args=[];
 if($user['role']!=='admin'){$where.=" AND (department='' OR department=?)";$args[]=$user['department'];}
 $q=$d->prepare("SELECT id,channel,department,title,body,created_at FROM office_notices WHERE $where AND channel='company' ORDER BY id DESC LIMIT 30");$q->execute($args);$company=$q->fetchAll();
 $sql="SELECT id,channel,department,title,body,created_at FROM office_notices WHERE $where AND channel='activity'";
 $activityArgs=$args;if($after!==null){$sql.=' AND id>?';$activityArgs[]=$after;}
 $sql.=$after===null?' ORDER BY id DESC LIMIT 30':' ORDER BY id ASC LIMIT 100';
 $q=$d->prepare($sql);$q->execute($activityArgs);$activity=$q->fetchAll();if($after===null)$activity=array_reverse($activity);
 $format=fn($row)=>['id'=>(int)$row['id'],'channel'=>$row['channel'],'department'=>$row['department'],'title'=>$row['title'],'body'=>$row['body'],'createdAt'=>str_replace(' ','T',$row['created_at']).'Z'];
 return ['company'=>array_map($format,$company),'activity'=>array_map($format,$activity),'cursor'=>$activity?max(array_column($activity,'id')):($after??0),'canManage'=>$user['role']==='admin'];
}
function notice_mutate(array $user,array $input): void {
 if($user['role']!=='admin')throw new NoticeForbidden('관리자만 회사 공지를 관리할 수 있습니다.');
 $d=db();$action=$input['action']??'';
 if($action==='publish'){
  foreach(['title'=>120,'body'=>1500,'department'=>20,'requestKey'=>36] as $field=>$max){notice_assert(is_string($input[$field]??null),'공지 입력을 확인해 주세요.');notice_assert(mb_strlen($input[$field])<=$max,'공지 내용이 너무 깁니다.');}
  $title=trim($input['title']);$body=trim($input['body']);$department=$input['department'];
  notice_assert($title!==''&&$body!=='','공지 제목과 내용을 입력해 주세요.');
  notice_assert(in_array($department,['','insurance','cosmetics','health'],true),'공지 대상을 확인해 주세요.');
  notice_assert((bool)preg_match('/^[a-f0-9-]{36}$/D',$input['requestKey']),'공지 등록 화면을 다시 열어 주세요.');
  $source='company:'.$input['requestKey'];
  $q=$d->prepare('SELECT id FROM office_notices WHERE source_key=?');$q->execute([$source]);if($q->fetch())return;
  try{notice_add('company',$department,$title,$body,(int)$user['id'],$source);}catch(PDOException $e){$q->execute([$source]);if(!$q->fetch())throw $e;}
 }elseif($action==='archive'){
  notice_assert(is_int($input['id']??null)&&$input['id']>0,'공지를 선택해 주세요.');
  $q=$d->prepare("UPDATE office_notices SET active=0 WHERE id=? AND channel='company'");$q->execute([$input['id']]);
 }else throw new InvalidArgumentException('지원하지 않는 공지 작업입니다.');
}
function notice_policy_rows(array $rows): array {
 $headers=array_map(fn($value)=>preg_replace('/\s/u','',(string)$value),$rows[0]??[]);$quantity=1;$status=-1;$region=0;
 foreach($headers as $i=>$header){if(preg_match('/수량|인원|배정|이월|건수|한도/u',$header)){$quantity=$i;break;}}
 foreach($headers as $i=>$header){if(preg_match('/상태|접수여부|가능여부/u',$header))$status=$i;if(preg_match('/지역|범위|구역|시.?군/u',$header)&&!preg_match('/제외|불가|하위|세부|읍|면|동/u',$header))$region=$i;}
 $result=[];
 foreach(array_slice($rows,1) as $row){
  $raw=trim((string)($row[$quantity]??''));$state=$status<0?'':trim((string)($row[$status]??''));
  $blocked=(bool)preg_match('/^(?:접수\s*)?(?:불가|불가능|제외|마감)$/u',$raw.'')||(bool)preg_match('/^(?:접수\s*)?(?:불가|불가능|제외|마감)$/u',$state);
  $number=$blocked?0:(preg_match('/^\d{1,9}$/D',$raw)?(int)$raw:null);
  $identity=[];foreach($row as $i=>$cell)if($i!==$quantity&&$i!==$status)$identity[]=preg_replace('/\s/u','',(string)$cell);
  $key=hash('sha256',json_encode($identity,JSON_UNESCAPED_UNICODE));
  if(isset($result[$key])){$result[$key]['quantity']=null;continue;}
  $result[$key]=['region'=>mb_substr(trim((string)($row[$region]??'')),0,250),'quantity'=>$number];
 }
 return $result;
}
function notice_policy_changes(array $before,array $after,int $revision,int $actor,string $department='insurance'): void {
 $labels=array_column($after['codes'],'label','id');$clients=array_column($after['clients'],'label','id');
 foreach((array)$after['policies'] as $key=>$policy){
  $old=$before['policies'][$key]??null;if($old&&$old['rows']===$policy['rows'])continue;
  $prefix=($clients[$policy['client']]??'거래처').' · '.($labels[$policy['carrier']]??$policy['carrier']).' '.($policy['kind']==='silver'?'실버':'일반');
  $source='policy:'.$revision.':'.substr(hash('sha256',$key),0,16);
  if(!$old)continue;
  $previous=notice_policy_rows($old['rows']);$next=notice_policy_rows($policy['rows']);
  foreach($previous as $identity=>$item){
   if($item['quantity']===null||$item['quantity']<=0)continue;
   $current=$next[$identity]['quantity']??null;
   // Report only a confirmed numeric decrease in the same scope. Never infer zero for missing/unknown rows.
   if($current!==null&&$current<$item['quantity'])notice_add('activity',$department,'접수 가능 수량 감소',$prefix.' · '.$item['region'].' '.$item['quantity'].'건 → '.$current.'건'.($current===0?' · 접수 마감':''),$actor,$source.':'.substr($identity,0,16));
  }
 }
}
