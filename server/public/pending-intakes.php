<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/intake-management.php';
header('Content-Type: application/json; charset=utf-8');
try{
session_boot();$user=current_user();if(!$user){http_response_code(401);echo '{}';exit;}hr_assert($user['role']==='employee','직원 본인 가접수 전용입니다.');$d=db();
if($_SERVER['REQUEST_METHOD']==='POST'){
 if(!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??''))throw new HRForbidden('새로고침 후 다시 요청해 주세요.');
 $in=json_decode(file_get_contents('php://input',false,null,0,4096),true,16,JSON_THROW_ON_ERROR);$id=intake_text($in['id']??'',60);$memo=intake_text($in['memo']??'',500);$carrier=intake_text($in['carrier']??'',100);hr_assert($memo!==''&&$carrier!=='','접수 코드와 재접수 메모를 입력해 주세요.');$revision=intake_number($in['revision']??0);
 $d->beginTransaction();
 if(preg_match('/^test:(\d+):(\d+)$/D',$id,$m)){
  if((int)$m[1]!==(int)$user['id'])throw new HRForbidden('본인 접수만 요청할 수 있습니다.');
  $q=$d->prepare('SELECT state,revision FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([$user['id']]);$r=$q->fetch();hr_assert($r&&(int)$r['revision']===$revision,'접수 내용이 변경되었습니다. 새로고침해 주세요.');$state=json_decode($r['state'],true);$found=false;
  foreach($state['sales'] as &$sale)if((int)$sale['id']===(int)$m[2]){hr_assert($sale['status']==='가접수','가접수만 재접수 요청할 수 있습니다.');$sale['note']=mb_substr(($sale['note']??'')."\n[재접수 요청] ".$carrier.' · '.$memo,-1000);$found=true;}unset($sale);hr_assert($found,'접수를 찾을 수 없습니다.');$q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),$user['id']]);
 }else{
  hr_assert(ctype_digit($id),'접수 번호를 확인해 주세요.');$q=$d->prepare('SELECT * FROM sales_records WHERE id=? AND employee_id=? FOR UPDATE');$q->execute([$id,$user['id']]);$r=$q->fetch();hr_assert($r&&$r['status']==='pending'&&(int)$r['revision']===$revision,'본인 가접수 상태를 새로고침해 주세요.');$note=mb_substr($r['note']."\n[재접수 요청] ".$carrier.' · '.$memo,-1000);$q=$d->prepare('UPDATE sales_records SET note=?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?');$q->execute([$note,$id]);
 }
 intake_audit($id,$user,'resubmit',['status'=>'pending'],['status'=>'pending','carrier'=>$carrier],$memo);$d->commit();
}elseif($_SERVER['REQUEST_METHOD']!=='GET'){http_response_code(405);exit;}
$q=$d->prepare("SELECT DISTINCT DATE_FORMAT(first_date,'%Y-%m') FROM sales_records WHERE employee_id=? AND status='pending'");$q->execute([$user['id']]);$months=$q->fetchAll(PDO::FETCH_COLUMN);$q=$d->prepare('SELECT state FROM test_employee_data WHERE user_id=?');$q->execute([$user['id']]);$state=json_decode($q->fetchColumn()?:'{}',true);foreach($state['sales']??[] as $s)if($s['status']==='가접수')$months[]=substr($s['date'],0,7);
$rows=[];foreach(array_unique($months) as $month)foreach(sales_snapshot($user,$month)['records'] as $r)if($r['status']==='pending')$rows[$r['id']]=$r;
echo hr_json(['records'=>array_values($rows)]);
}catch(Throwable $e){if(isset($d)&&$d->inTransaction())$d->rollBack();http_response_code($e instanceof HRForbidden?403:422);echo json_encode(['error'=>$e instanceof InvalidArgumentException||$e instanceof HRForbidden?$e->getMessage():'가접수 처리에 실패했습니다.'],JSON_UNESCAPED_UNICODE);}
