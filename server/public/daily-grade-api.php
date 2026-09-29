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
    header('Allow: GET');
    daily_grade_reply(405,['error'=>'달성한 일그레이드는 자동 수령 처리됩니다. 버튼 확인은 필요하지 않습니다.']);
}catch(HRForbidden $e){daily_grade_reply(403,['error'=>$e->getMessage()]);}
catch(InvalidArgumentException|JsonException $e){daily_grade_reply(422,['error'=>$e->getMessage()]);}
catch(Throwable $e){error_log('cnchome daily grade: '.get_class($e));daily_grade_reply(503,['error'=>'일 그레이드를 처리하지 못했습니다. 새로고침 후 저장 여부를 확인해 주세요.']);}
