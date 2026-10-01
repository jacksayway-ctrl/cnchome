<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){header('Allow: POST');throw new WindowSessionError(405,'허용되지 않은 요청입니다.');}
    session_boot();
    if(!current_user())throw new WindowSessionError(401,'다시 로그인해 주세요.');
    if(!csrf_ok((string)($_SERVER['HTTP_X_CSRF_TOKEN']??'')))throw new WindowSessionError(403,'새로고침 후 새 창을 다시 열어 주세요.');
    $raw=file_get_contents('php://input',false,null,0,1025);
    if($raw===false||strlen($raw)>1024)throw new WindowSessionError(413,'요청 내용이 너무 큽니다.');
    try{$input=json_decode($raw,true,8,JSON_THROW_ON_ERROR);}catch(JsonException $e){throw new WindowSessionError(400,'새 창의 로그인 정보를 확인해 주세요.');}
    if(!is_array($input)||array_keys($input)!==['windowId']||!window_session_valid_id($input['windowId']??null))throw new WindowSessionError(400,'새 창의 로그인 정보를 확인해 주세요.');
    $id=window_session_fork($input['windowId'],session_timeout_minutes());
    echo json_encode(['ok'=>true,'windowId'=>$id],JSON_THROW_ON_ERROR);
}catch(WindowSessionError $e){window_session_error_response($e);}
catch(Throwable $e){error_log('cnchome window fork error '.get_class($e));http_response_code(503);echo '{"error":"새 창을 열지 못했습니다. 잠시 후 다시 시도해 주세요."}';}
