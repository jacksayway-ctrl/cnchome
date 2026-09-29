<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/grade-ledger.php';
session_boot();header('Content-Type: application/json; charset=utf-8');
try{
    $user=current_user();if(!$user){http_response_code(401);echo hr_json(['error'=>'다시 로그인해 주세요.']);exit;}
    hr_assert($_SERVER['REQUEST_METHOD']==='POST'&&csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??''),'요청을 확인해 주세요.');
    $in=json_decode(file_get_contents('php://input',false,null,0,65537),true,64,JSON_THROW_ON_ERROR);hr_assert(is_array($in),'입력 형식을 확인해 주세요.');$department=$user['role']==='admin'?($in['department']??'insurance'):$user['department'];hr_assert(in_array($department,['insurance','cosmetics','health'],true),'부서를 확인해 주세요.');
    $month=$in['month']??substr(hr_today(),0,7);hr_assert(is_string($month),'월을 확인해 주세요.');$dates=grade_dates($month);$entries=grade_history($department);$policy=normalize_policy($in['policy']??null);$preview=($in['preview']??false)===true;
    if($preview){hr_assert($user['role']==='admin'&&valid_day($in['date']??null),'적용일을 확인해 주세요.');$entries[]=['date'=>$in['date'],'savedAt'=>'9999','policy'=>$policy];}
    if(($in['fixed']??false)===true){hr_assert($user['role']==='admin','이전 기준 열람 권한이 없습니다.');$entries=[['date'=>'2000-01-01','policy'=>$policy]];}
    $counts=$in['counts']??[];hr_assert(is_array($counts)&&array_is_list($counts)&&count($counts)<=20,'예상 실적을 확인해 주세요.');$results=[];
    foreach($counts as $count){bounded($count);$results[]=grade_ledger($month,grade_forecast_records($month,$count),$entries);}
    echo hr_json(['month'=>$month,'days'=>count($dates),'hours'=>count($dates)*6,'rows'=>$results]);
}catch(InvalidArgumentException|JsonException $e){http_response_code(422);echo hr_json(['error'=>$e->getMessage()]);}catch(Throwable $e){error_log('grade estimate: '.$e->getMessage());http_response_code(503);echo hr_json(['error'=>'예상액을 계산하지 못했습니다.']);}
