<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/grade-summary.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');
function grade_summary_reply(int $status,array $body): never {http_response_code($status);echo hr_json($body);exit;}
try{
 session_boot();$user=current_user();if(!$user)grade_summary_reply(401,['error'=>'다시 로그인해 주세요.']);
 if($_SERVER['REQUEST_METHOD']!=='GET')grade_summary_reply(405,['error'=>'조회만 가능합니다.']);
 grade_summary_reply(200,grade_summary_snapshot($user));
}catch(HRForbidden $e){grade_summary_reply(403,['error'=>$e->getMessage()]);}
catch(Throwable $e){error_log('cnchome grade summary: '.get_class($e));grade_summary_reply(503,['error'=>'그레이드 현황을 불러오지 못했습니다.']);}
