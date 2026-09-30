<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/pending-intakes.php';
header('Content-Type: application/json; charset=utf-8');
try{
session_boot();$user=current_user();if(!$user){http_response_code(401);echo '{}';exit;}pending_intake_authorize($user);$d=db();
if($_SERVER['REQUEST_METHOD']==='POST'){
 pending_intake_authorize($user,true);
 if(!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??''))throw new HRForbidden('새로고침 후 다시 요청해 주세요.');
 $in=json_decode(file_get_contents('php://input',false,null,0,4096),true,16,JSON_THROW_ON_ERROR);$id=intake_text($in['id']??'',60);$memo=intake_text($in['memo']??'',500);$carrier=intake_text($in['carrier']??'',100);$action=intake_text($in['action']??'recall',10);hr_assert(in_array($action,['memo','recall'],true),'지원하지 않는 작업입니다.');hr_assert($memo!==''&&($action==='memo'||$carrier!==''),'메모와 접수 가능한 코드를 확인해 주세요.');$revision=intake_number($in['revision']??0);
 $d->beginTransaction();
 if(preg_match('/^test:(\d+):(\d+)$/D',$id,$m)){
  if((int)$m[1]!==(int)$user['id'])throw new HRForbidden('본인 접수만 요청할 수 있습니다.');
  $q=$d->prepare('SELECT state,revision FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([$user['id']]);$r=$q->fetch();hr_assert($r&&(int)$r['revision']===$revision,'접수 내용이 변경되었습니다. 새로고침해 주세요.');$state=json_decode($r['state'],true);$found=false;
  foreach($state['sales'] as &$sale)if((int)$sale['id']===(int)$m[2]){hr_assert($sale['status']==='가접수','가접수만 재접수 요청할 수 있습니다.');$date=$sale['date'];$found=true;}unset($sale);hr_assert($found,'접수를 찾을 수 없습니다.');$q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),$user['id']]);
 }else{
  hr_assert(ctype_digit($id),'접수 번호를 확인해 주세요.');$q=$d->prepare('SELECT * FROM sales_records WHERE id=? AND employee_id=? FOR UPDATE');$q->execute([$id,$user['id']]);$r=$q->fetch();hr_assert($r&&$r['status']==='pending'&&(int)$r['revision']===$revision,'본인 가접수 상태를 새로고침해 주세요.');$date=$r['first_date'];$q=$d->prepare('UPDATE sales_records SET revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?');$q->execute([$id]);
 }
 intake_audit($id,$user,$action,['status'=>'pending'],['status'=>'pending','carrier'=>$carrier,'date'=>$date],$memo);$d->commit();
}elseif($_SERVER['REQUEST_METHOD']!=='GET'){http_response_code(405);exit;}
echo hr_json(pending_intake_snapshot($user));
}catch(Throwable $e){if(isset($d)&&$d->inTransaction())$d->rollBack();http_response_code($e instanceof HRForbidden?403:422);echo json_encode(['error'=>$e instanceof InvalidArgumentException||$e instanceof HRForbidden?$e->getMessage():'가접수 처리에 실패했습니다.'],JSON_UNESCAPED_UNICODE);}
