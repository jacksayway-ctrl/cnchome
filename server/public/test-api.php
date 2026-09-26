<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/hr.php';
header('Content-Type: application/json; charset=utf-8');
function test_reply(int $status,array $body): never {http_response_code($status);echo hr_json($body);exit;}
try{
 session_boot();$u=current_user();
 if(!$u)test_reply(401,['error'=>'다시 로그인해 주세요.']);
 if($u['username']!=='user1'||$u['role']!=='employee'||$u['display_name']!=='테스트 직원')test_reply(403,['error'=>'테스트 직원 전용입니다.']);
 $d=db();$d->beginTransaction();$q=$d->prepare('SELECT state,revision FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([$u['id']]);$r=$q->fetch();
 if(!$r){$d->rollBack();test_reply(404,['error'=>'테스트 자료 준비 중입니다.']);}
 $state=json_decode($r['state'],true,512,JSON_THROW_ON_ERROR);
 if($_SERVER['REQUEST_METHOD']==='POST'){
  if(!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??'')){$d->rollBack();test_reply(403,['error'=>'새로고침 후 다시 시도해 주세요.']);}
  $in=json_decode(file_get_contents('php://input',false,null,0,4097),true,32,JSON_THROW_ON_ERROR);
  if(($in['revision']??null)!==(int)$r['revision']){$d->rollBack();test_reply(409,['error'=>'다른 창에서 변경되었습니다. 새로고침해 주세요.']);}
  if(($in['action']??'')==='status'){
   hr_assert(in_array($in['status']??'', ['정상','가접수','A/S'],true),'접수 상태를 확인해 주세요.');$found=false;
   foreach($state['sales'] as &$sale)if($sale['id']===($in['id']??null)){$sale['status']=$in['status'];$found=true;}unset($sale);hr_assert($found,'실적을 선택해 주세요.');
  }elseif(($in['action']??'')==='clock'){
   $today=hr_today();$time=(new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul')))->format('H:i');$found=false;
   foreach($state['attendance'] as &$row)if($row['date']===$today){$row['out']=$time;$row['status']='테스트 퇴근';$found=true;}unset($row);
   if(!$found)$state['attendance'][]=['date'=>$today,'in'=>$time,'out'=>'','status'=>'테스트 출근'];
  }else throw new InvalidArgumentException('지원하지 않는 테스트입니다.');
  $q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),$u['id']]);$r['revision']++;
 }elseif($_SERVER['REQUEST_METHOD']!=='GET'){$d->rollBack();test_reply(405,['error'=>'허용되지 않은 요청입니다.']);}
 $d->commit();test_reply(200,['state'=>$state,'revision'=>(int)$r['revision']]);
}catch(InvalidArgumentException|JsonException $e){if(isset($d)&&$d->inTransaction())$d->rollBack();test_reply(422,['error'=>'입력 내용을 확인해 주세요.']);}
catch(Throwable $e){if(isset($d)&&$d->inTransaction())$d->rollBack();test_reply(503,['error'=>'테스트 자료를 불러오지 못했습니다.']);}
