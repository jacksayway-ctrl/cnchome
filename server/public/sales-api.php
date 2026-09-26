<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/sales.php';
header('Content-Type: application/json; charset=utf-8');
function sales_reply(int $status,array $body): never {http_response_code($status);echo hr_json($body);exit;}
try {
    session_boot();$user=current_user();if(!$user)sales_reply(401,['error'=>'다시 로그인해 주세요.']);
    $month=(string)($_GET['month']??substr(hr_today(),0,7));hr_assert(sales_month($month),'조회할 월을 확인해 주세요.');
    if($_SERVER['REQUEST_METHOD']==='POST'){
        if(!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??''))sales_reply(403,['error'=>'새로고침 후 다시 시도해 주세요.']);
        $raw=file_get_contents('php://input',false,null,0,8193);if(strlen($raw)>8192)sales_reply(413,['error'=>'입력 내용이 너무 깁니다.']);
        $in=json_decode($raw,true,32,JSON_THROW_ON_ERROR);hr_assert(is_array($in),'입력 내용을 확인해 주세요.');sales_mutate($user,$in);
    }elseif($_SERVER['REQUEST_METHOD']!=='GET')sales_reply(405,['error'=>'허용되지 않은 요청입니다.']);
    sales_reply(200,sales_snapshot($user,$month));
}catch(HRForbidden $e){sales_reply(403,['error'=>$e->getMessage()]);}
catch(InvalidArgumentException|JsonException $e){sales_reply(422,['error'=>$e->getMessage()]);}
catch(Throwable $e){error_log('cnchome sales error '.get_class($e));sales_reply(503,['error'=>'접수 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.']);}
