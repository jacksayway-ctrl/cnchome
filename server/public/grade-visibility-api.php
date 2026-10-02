<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/grade-visibility.php';
header('Content-Type: application/json; charset=utf-8');
function visibility_reply(int $status,array $body): never {http_response_code($status);echo hr_json($body);exit;}
try{
    session_boot();$user=current_user();if(!$user)visibility_reply(401,['error'=>'다시 로그인해 주세요.']);
    if($_SERVER['REQUEST_METHOD']==='GET')visibility_reply(200,['gradeVisibility'=>grade_visibility_for($user)]);
    if($_SERVER['REQUEST_METHOD']!=='POST')visibility_reply(405,['error'=>'허용되지 않은 요청입니다.']);
    if(!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??''))visibility_reply(403,['error'=>'새로고침한 뒤 다시 저장해 주세요.']);
    $raw=file_get_contents('php://input',false,null,0,4097);hr_assert(strlen($raw)<=4096,'요청이 너무 큽니다.');
    $input=json_decode($raw,true,16,JSON_THROW_ON_ERROR);hr_assert(is_array($input),'입력 형식을 확인해 주세요.');
    visibility_reply(200,['gradeVisibility'=>grade_visibility_save($user,$input)]);
}catch(GradeVisibilityConflict $e){visibility_reply(409,['error'=>$e->getMessage()]);}
catch(HRForbidden $e){visibility_reply(403,['error'=>$e->getMessage()]);}
catch(InvalidArgumentException|JsonException $e){visibility_reply(422,['error'=>'노출 설정을 확인해 주세요. '.$e->getMessage()]);}
catch(Throwable $e){error_log('cnchome grade visibility: '.get_class($e));visibility_reply(503,['error'=>'저장 여부를 새로고침으로 확인한 뒤 다시 시도해 주세요.']);}
