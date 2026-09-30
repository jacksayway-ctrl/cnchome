<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/membership.php';
header('Content-Type: application/json; charset=utf-8');
try {
    session_boot();$user=current_user();if(!$user){http_response_code(401);echo hr_json(['error'=>'로그인이 필요합니다.']);exit;}
    if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);header('Allow: GET');exit;}
    echo hr_json(membership_notification($user));
}catch(HRForbidden $e){http_response_code(403);echo hr_json(['error'=>$e->getMessage()]);}
catch(Throwable $e){http_response_code(503);echo hr_json(['error'=>'가입 승인 알림을 불러오지 못했습니다.']);}
