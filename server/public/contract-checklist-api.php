<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/contract-checklist.php';
header('Content-Type: application/json; charset=utf-8');
function contract_checklist_reply(int $status,array $body): never {http_response_code($status);echo hr_json($body);exit;}
try{
    session_boot();$user=current_user();if(!$user)contract_checklist_reply(401,['error'=>'로그인이 만료됐습니다. 다시 로그인해 주세요.']);
    if($_SERVER['REQUEST_METHOD']!=='GET')contract_checklist_reply(405,['error'=>'조회만 가능합니다.']);
    contract_checklist_reply(200,contract_checklist_snapshot($user));
}catch(HRForbidden $e){contract_checklist_reply(403,['error'=>$e->getMessage()]);}
catch(Throwable $e){error_log('cnchome contract checklist: '.get_class($e));contract_checklist_reply(503,['error'=>'계약 현황을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.']);}
