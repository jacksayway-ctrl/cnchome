<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/daily-grade.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
function daily_grade_reply(int $status,array $body): never {http_response_code($status);echo hr_json($body);exit;}
try {
    session_boot();$user=current_user();if(!$user)daily_grade_reply(401,['error'=>'다시 로그인해 주세요.']);
    $method=$_SERVER['REQUEST_METHOD'];
    if($method==='GET'){
        $date=$_GET['date']??hr_today();hr_assert(is_string($date),'날짜를 확인해 주세요.');
        if($user['role']==='admin')daily_grade_reply(200,daily_grade_admin($user,$date));
        hr_assert(hr_day($date)&&$date<=hr_today(),'날짜를 확인해 주세요.');
        daily_grade_reply(200,grade_summary_snapshot($user,$date));
    }
    if($method!=='POST')daily_grade_reply(405,['error'=>'허용되지 않은 요청입니다.']);
    if(!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??''))daily_grade_reply(403,['error'=>'새로고침 후 다시 시도해 주세요.']);
    $raw=file_get_contents('php://input',false,null,0,4097);if(strlen($raw)>4096)daily_grade_reply(413,['error'=>'입력이 너무 큽니다.']);
    $in=json_decode($raw,true,16,JSON_THROW_ON_ERROR);hr_assert(is_array($in),'입력을 확인해 주세요.');
    daily_grade_confirm($user,$in);daily_grade_reply(200,['ok'=>true]);
}catch(HRForbidden $e){daily_grade_reply(403,['error'=>$e->getMessage()]);}
catch(InvalidArgumentException|JsonException $e){daily_grade_reply(422,['error'=>$e->getMessage()]);}
catch(Throwable $e){error_log('cnchome daily grade: '.get_class($e));daily_grade_reply(503,['error'=>'일 그레이드를 처리하지 못했습니다. 새로고침 후 저장 여부를 확인해 주세요.']);}
