<?php
declare(strict_types=1);
require_once __DIR__.'/notices.php';
class IntakePolicyForbidden extends RuntimeException {}
class IntakePolicyConflict extends RuntimeException {}
function intake_policy_defaults(): array {
 return ['version'=>1,'clients'=>[['id'=>'legacy','label'=>'메타버스']], 'codes'=>[
  ['id'=>'hanwha','label'=>'한화','aliases'=>[]],['id'=>'shinhan','label'=>'신한','aliases'=>[]],['id'=>'ga','label'=>'G/A','aliases'=>['GA']]],'policies'=>[]];
}
function intake_policy_check(bool $valid,string $message): void {if(!$valid)throw new InvalidArgumentException($message);}
function intake_policy_name(mixed $value,int $max): string {
 intake_policy_check(is_string($value),'이름을 확인해 주세요.');$value=trim($value);
 intake_policy_check($value!==''&&mb_strlen($value)<=$max&&!preg_match('/[\p{Cc}\p{Cf}]/u',$value),'이름 길이와 문자를 확인해 주세요.');return $value;
}
function intake_policy_normal(string $value): string {return mb_strtolower(preg_replace('/\s/u','',$value));}
function intake_policy_decode(string $raw): array {
 $state=json_decode($raw,true,64,JSON_THROW_ON_ERROR);
 return array_replace(intake_policy_defaults(),$state);
}
function intake_policy_snapshot(?array $user=null): array {
 $row=db()->query('SELECT revision,state FROM intake_policy_state WHERE id=1')->fetch();
 if(!$row)throw new RuntimeException('Policy migration required');
 $state=intake_policy_decode($row['state']);$today=(new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul')))->format('Y-m-d');
 if(($user['role']??'')==='employee')$state['policies']=array_filter($state['policies'],static function($policy)use($today){
  try{return !empty($policy['savedAt'])&&(new DateTimeImmutable($policy['savedAt']))->setTimezone(new DateTimeZone('Asia/Seoul'))->format('Y-m-d')===$today;}catch(Throwable $e){return false;}
 });
 $state['policies']=(object)$state['policies'];
 return array_replace($state,['revision'=>(int)$row['revision'],'date'=>$today]);
}
function intake_policy_history(array $user,int $id=0,int $before=0): array {
 if(($user['role']??'')!=='admin')throw new IntakePolicyForbidden('정책 변경 이력은 관리자만 확인할 수 있습니다.');
 if($id){$q=db()->prepare('SELECT payload FROM intake_policy_history WHERE id=?');$q->execute([$id]);$raw=$q->fetchColumn();intake_policy_check((bool)$raw,'정책 이력을 찾을 수 없습니다.');return ['state'=>intake_policy_decode($raw)];}
 $q=db()->prepare('SELECT h.id,h.revision,h.action,h.created_at,u.display_name AS actor FROM intake_policy_history h LEFT JOIN app_users u ON u.id=h.actor_id'.($before?' WHERE h.id<?':'').' ORDER BY h.id DESC LIMIT 100');$q->execute($before?[$before]:[]);$rows=$q->fetchAll();
 return ['history'=>$rows,'next'=>count($rows)===100?(int)end($rows)['id']:null];
}
function intake_policy_rows(mixed $rows,string $kind): array {
 intake_policy_check(is_array($rows)&&array_is_list($rows)&&count($rows)>=2&&count($rows)<=1000,'정책표는 제목을 포함해 2~1000행이어야 합니다.');
 foreach($rows as $row){
  intake_policy_check(is_array($row)&&array_is_list($row)&&count($row)>=1&&count($row)<=20,'정책표 열을 확인해 주세요.');
  foreach($row as $cell)intake_policy_check(is_string($cell)&&mb_strlen($cell)<=3000&&!str_contains($cell,"\0"),'정책표 셀을 확인해 주세요.');
 }
 intake_policy_check(count($rows[0])>=2,'지역과 수량 열을 확인해 주세요.');
 return $rows;
}
function intake_policy_apply(array $state,array $in,array $user): array {
 if(($user['role']??'')!=='admin')throw new IntakePolicyForbidden('관리자만 정책을 저장할 수 있습니다.');
 $action=$in['action']??'';
 if($action==='client'){
  $label=intake_policy_name($in['label']??null,60);$id=$in['id']??'';
  intake_policy_check(is_string($id)&&($id===''||preg_match('/^(?:legacy|client_[a-z0-9_]{1,64})$/D',$id)),'거래처를 확인해 주세요.');
  $found=false;foreach($state['clients'] as &$client){
   if($client['id']===$id){$client['label']=$label;$found=true;}
   elseif(intake_policy_normal($client['label'])===intake_policy_normal($label))throw new InvalidArgumentException('이미 등록된 거래처명입니다.');
  }unset($client);
  if(!$found){intake_policy_check($id==='','수정할 거래처를 찾을 수 없습니다.');intake_policy_check(count($state['clients'])<200,'거래처는 최대 200개입니다.');$id='client_'.bin2hex(random_bytes(12));$state['clients'][]=['id'=>$id,'label'=>$label];}
  $state['_changedId']=$id;
 }elseif($action==='code'){
  $label=intake_policy_name($in['label']??null,40);$id=$in['id']??'';$aliases=$in['aliases']??[];
  intake_policy_check(is_string($id)&&($id===''||preg_match('/^(?:hanwha|shinhan|ga|code_[a-z0-9_]{1,48})$/D',$id)),'접수 코드를 확인해 주세요.');
  intake_policy_check(is_array($aliases)&&array_is_list($aliases)&&count($aliases)<=40,'다른 표기는 최대 40개입니다.');
  $aliases=array_map(fn($v)=>intake_policy_name($v,40),$aliases);$found=false;
  foreach($state['codes'] as $code)if($code['id']===$id){$found=true;$aliases=array_merge($aliases,[$code['label']],$code['aliases']);}
  if($id!=='')intake_policy_check($found,'수정할 접수 코드를 찾을 수 없습니다.');
  $unique=[];$names=[intake_policy_normal($label)=>true];
  foreach($aliases as $alias){$key=intake_policy_normal($alias);if(!isset($names[$key])){$names[$key]=true;$unique[]=$alias;}}
  intake_policy_check(!isset($names['all'])&&count($unique)<=40,'접수 코드 이름과 다른 표기를 확인해 주세요.');
  foreach($state['codes'] as $code)if($code['id']!==$id)foreach(array_merge([$code['label']],$code['aliases']) as $name)intake_policy_check(!isset($names[intake_policy_normal($name)]),'다른 접수 코드와 이름 또는 표기가 중복됩니다.');
  if($id===''){intake_policy_check(count($state['codes'])<200,'접수 코드는 최대 200개입니다.');$id='code_'.bin2hex(random_bytes(12));$state['codes'][]=['id'=>$id,'label'=>$label,'aliases'=>$unique];}
  else foreach($state['codes'] as &$code)if($code['id']===$id)$code=['id'=>$id,'label'=>$label,'aliases'=>$unique];unset($code);
  $state['_changedId']=$id;
 }elseif($action==='publish'){
  $client=$in['client']??null;$carrier=$in['carrier']??null;$groups=$in['groups']??null;
  $reviewed=$in['reviewed']??false;intake_policy_check(is_bool($reviewed),'확인 완료 여부가 올바르지 않습니다.');
  intake_policy_check(in_array($client,array_column($state['clients'],'id'),true),'등록할 거래처를 먼저 서버에 저장해 주세요.');
  intake_policy_check(in_array($carrier,array_column($state['codes'],'id'),true),'등록할 접수 코드를 먼저 서버에 저장해 주세요.');
  intake_policy_check(is_array($groups)&&count($groups)>=1&&count($groups)<=2,'등록할 상품 정책을 확인해 주세요.');
  foreach($groups as $kind=>$rows){
   intake_policy_check(in_array($kind,['general','silver'],true),'일반·실버 상품을 확인해 주세요.');
   $rows=intake_policy_rows($rows,$kind);$key=$carrier.':'.($client==='legacy'?'':$client.':').$kind;
   $state['policies'][$key]=['client'=>$client,'carrier'=>$carrier,'kind'=>$kind,'rows'=>$rows,'reviewed'=>$reviewed,'savedAt'=>gmdate('Y-m-d\TH:i:s\Z'),'savedBy'=>$user['display_name']??'관리자'];
  }
 }else throw new InvalidArgumentException('지원하지 않는 정책 작업입니다.');
 return $state;
}
function intake_policy_mutate(array $user,array $input): array {
 if(($user['role']??'')!=='admin')throw new IntakePolicyForbidden('관리자만 정책을 저장할 수 있습니다.');
 intake_policy_check(is_int($input['revision']??null)&&$input['revision']>=0,'변경 버전을 확인해 주세요.');
 $d=db();$d->beginTransaction();
 try{
  $row=$d->query('SELECT revision,state FROM intake_policy_state WHERE id=1 FOR UPDATE')->fetch();
  if(!$row)throw new RuntimeException('Policy migration required');
  if((int)$row['revision']!==$input['revision'])throw new IntakePolicyConflict('다른 관리자가 정책을 변경했습니다. 최신 정책을 불러왔습니다. 작성한 표를 확인하고 다시 등록해 주세요.');
  $before=intake_policy_decode($row['state']);$state=intake_policy_apply($before,$input,$user);$changedId=$state['_changedId']??null;unset($state['_changedId']);
  $state['policies']=(object)$state['policies'];$json=json_encode($state,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
  intake_policy_check(strlen($json)<=20000000,'저장된 정책 용량이 너무 큽니다. 관리자에게 문의해 주세요.');
  $revision=(int)$row['revision']+1;
  $q=$d->prepare('UPDATE intake_policy_state SET state=?,revision=?,updated_at=CURRENT_TIMESTAMP WHERE id=1');$q->execute([$json,$revision]);
  $q=$d->prepare('INSERT INTO intake_policy_history(revision,actor_id,action,payload) VALUES(?,?,?,?)');$q->execute([$revision,$user['id'],$input['action'],$json]);
  if($input['action']==='publish')notice_policy_changes($before,$state,$revision,(int)$user['id']);
  $d->commit();return $state+['revision'=>$revision,'changedId'=>$changedId];
 }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
