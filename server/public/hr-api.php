<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/hr.php';
header('Content-Type: application/json; charset=utf-8');
function hr_reply(int $code,array $body): never {http_response_code($code);echo hr_json($body);exit;}
try {
    session_boot();$user=current_user();if(!$user)hr_reply(401,['error'=>'다시 로그인해 주세요.']);
    if($_SERVER['REQUEST_METHOD']==='GET')hr_reply(200,hr_snapshot($user));
    if($_SERVER['REQUEST_METHOD']!=='POST')hr_reply(405,['error'=>'허용되지 않은 요청입니다.']);
    if(!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??''))hr_reply(403,['error'=>'새로고침 후 다시 시도해 주세요.']);
    $raw=file_get_contents('php://input',false,null,0,32769);if(strlen($raw)>32768)hr_reply(413,['error'=>'입력 내용이 너무 큽니다.']);
    $in=json_decode($raw,true,64,JSON_THROW_ON_ERROR);hr_assert(is_array($in),'입력을 확인해 주세요.');
    $action=$in['action']??'';$admin=$user['role']==='admin';
    if(!in_array($action,$admin?['saveStaff','savePayroll','publish']:['confirm','request'],true))hr_reply(403,['error'=>'처리 권한이 없습니다.']);
    hr_mutate($user,$in);hr_reply(200,hr_snapshot($user));
}catch(HRForbidden $e){hr_reply(403,['error'=>$e->getMessage()]);}
catch(InvalidArgumentException|JsonException $e){if(isset($d)&&$d->inTransaction())$d->rollBack();hr_reply(422,['error'=>$e->getMessage()]);}
catch(PDOException $e){if(isset($d)&&$d->inTransaction())$d->rollBack();error_log('cnchome HR database error '.$e->getCode());hr_reply($e->getCode()==='23000'?409:503,['error'=>$e->getCode()==='23000'?'이미 등록된 직원·계정 또는 해당 월 급여입니다. 새로고침해 주세요.':'저장에 실패했습니다. 새로고침하여 저장 여부를 확인해 주세요.']);}
catch(Throwable $e){if(isset($d)&&$d->inTransaction())$d->rollBack();error_log('cnchome HR error '.get_class($e));hr_reply(503,['error'=>'처리하지 못했습니다. 새로고침 후 확인해 주세요.']);}
