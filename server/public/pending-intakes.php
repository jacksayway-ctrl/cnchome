<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/pending-intakes.php';require_once CNC_RUNTIME_DIR.'/pending-rollover.php';
header('Content-Type: application/json; charset=utf-8');
try{
session_boot();$user=current_user();if(!$user){http_response_code(401);echo '{}';exit;}pending_intake_authorize($user);$d=db();
if($_SERVER['REQUEST_METHOD']==='POST'){
 if(!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??''))throw new HRForbidden('새로고침 후 다시 요청해 주세요.');
 $in=json_decode(file_get_contents('php://input',false,null,0,16384),true,16,JSON_THROW_ON_ERROR);
 hr_assert(is_array($in)&&!array_is_list($in),'접수 입력 형식을 확인해 주세요.');pending_intake_update($user,$in);
}elseif($_SERVER['REQUEST_METHOD']!=='GET'){http_response_code(405);exit;}
pending_rollover($user);echo hr_json(pending_intake_snapshot($user,($_GET['allStatuses']??'')==='1'));
}catch(Throwable $e){if(isset($d)&&$d->inTransaction())$d->rollBack();http_response_code($e instanceof HRForbidden?403:422);echo json_encode(['error'=>$e instanceof InvalidArgumentException||$e instanceof HRForbidden?$e->getMessage():'가접수 처리에 실패했습니다.'],JSON_UNESCAPED_UNICODE);}
