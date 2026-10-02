<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/intake-live.php';
header('Content-Type: application/json; charset=utf-8');
function intake_live_reply(int $code,array $body): never {http_response_code($code);echo hr_json($body);exit;}
try{
    session_boot();$user=current_user();if(!$user)intake_live_reply(401,['error'=>'로그인이 만료됐습니다. 다시 로그인해 주세요.']);
    if($_SERVER['REQUEST_METHOD']!=='GET')intake_live_reply(405,['error'=>'조회만 가능합니다.']);
    intake_live_reply(200,intake_live_snapshot($user,$_GET));
}catch(HRForbidden $e){intake_live_reply(403,['error'=>$e->getMessage()]);}
catch(InvalidArgumentException $e){intake_live_reply(422,['error'=>$e->getMessage()]);}
catch(Throwable $e){error_log('cnchome live intake: '.get_class($e));intake_live_reply(503,['error'=>'접수 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.']);}
