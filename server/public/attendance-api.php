<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/attendance.php';
header('Content-Type: application/json; charset=utf-8');
try{
    session_boot();$user=current_user();if(!$user){http_response_code(401);echo hr_json(['error'=>'다시 로그인해 주세요.']);exit;}
    $method=$_SERVER['REQUEST_METHOD'];
    if($method==='POST'){
        attendance_authorize($user,true);
        if(!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??''))throw new HRForbidden('새로고침 후 다시 시도해 주세요.');
        $raw=file_get_contents('php://input',false,null,0,1025);hr_assert(strlen($raw)<=1024,'입력 내용을 확인해 주세요.');
        $in=json_decode($raw,true,8,JSON_THROW_ON_ERROR);
        hr_assert(is_array($in),'출근 버튼으로 다시 기록해 주세요.');attendance_mutate($user,$in);
    }elseif($method!=='GET'){http_response_code(405);header('Allow: GET, POST');echo hr_json(['error'=>'허용되지 않은 요청입니다.']);exit;}
    echo hr_json(attendance_snapshot($user,$_GET['date']??null));
}catch(HRForbidden $e){http_response_code(403);echo hr_json(['error'=>$e->getMessage()]);}
catch(InvalidArgumentException|JsonException $e){http_response_code(422);echo hr_json(['error'=>'출근 요청 또는 조회 날짜를 확인해 주세요.']);}
catch(Throwable $e){error_log('cnchome attendance: '.get_class($e));http_response_code(503);echo hr_json(['error'=>'출근 기록을 처리하지 못했습니다. 새로고침 후 기록 여부를 확인해 주세요.']);}
