<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/grade-estimates.php';
session_boot();header('Content-Type: application/json; charset=utf-8');
try{
    $user=current_user();if(!$user){http_response_code(401);echo hr_json(['error'=>'다시 로그인해 주세요.']);exit;}
    hr_assert($_SERVER['REQUEST_METHOD']==='POST'&&csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??''),'요청을 확인해 주세요.');
    $in=json_decode(file_get_contents('php://input',false,null,0,65537),true,64,JSON_THROW_ON_ERROR);hr_assert(is_array($in),'입력 형식을 확인해 주세요.');$department=$user['role']==='admin'?($in['department']??'insurance'):$user['department'];hr_assert(in_array($department,['insurance','cosmetics','health'],true),'부서를 확인해 주세요.');
    $month=$in['month']??substr(hr_today(),0,7);hr_assert(is_string($month),'월을 확인해 주세요.');
    echo hr_json(grade_estimates($in,grade_history($department),business_calendar_rules($month),$user['role']==='admin'));
}catch(InvalidArgumentException|JsonException $e){http_response_code(422);echo hr_json(['error'=>$e->getMessage()]);}catch(Throwable $e){error_log('grade estimate: '.$e->getMessage());http_response_code(503);echo hr_json(['error'=>'예상액을 계산하지 못했습니다.']);}
