<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/calendar-holidays.php';
header('Content-Type: application/json; charset=utf-8');
function calendar_holiday_reply(int $status,array $body): never {
    if(isset($body['holidays']))$body['holidays']=(object)$body['holidays'];
    http_response_code($status);echo hr_json($body);exit;
}
try{
    session_boot();$user=current_user();if(!$user)calendar_holiday_reply(401,['error'=>'다시 로그인해 주세요.']);
    if($_SERVER['REQUEST_METHOD']==='GET'){
        [$from,$to]=calendar_holiday_range($_GET);calendar_holiday_reply(200,calendar_holidays_read($user,$from,$to));
    }
    if($_SERVER['REQUEST_METHOD']!=='POST'){header('Allow: GET, POST');calendar_holiday_reply(405,['error'=>'허용되지 않은 요청입니다.']);}
    if(($user['role']??'')!=='admin')throw new HRForbidden('관리자만 휴일을 지정할 수 있습니다.');
    $csrf=$_SERVER['HTTP_X_CSRF_TOKEN']??'';
    if(!is_string($csrf)||!csrf_ok($csrf))throw new HRForbidden('새로고침한 뒤 다시 저장해 주세요.');
    $raw=file_get_contents('php://input',false,null,0,4097);hr_assert(is_string($raw)&&strlen($raw)<=4096,'요청이 너무 큽니다.');
    $input=json_decode($raw,true,16,JSON_THROW_ON_ERROR);hr_assert(is_array($input)&&!array_is_list($input),'입력 형식을 확인해 주세요.');
    calendar_holiday_save($user,$input);[$from,$to]=calendar_holiday_range(['month'=>substr($input['date'],0,7)]);
    calendar_holiday_reply(200,calendar_holidays_read($user,$from,$to));
}catch(CalendarHolidayConflict $e){calendar_holiday_reply(409,['error'=>$e->getMessage()]);}
catch(HRForbidden $e){calendar_holiday_reply(403,['error'=>$e->getMessage()]);}
catch(InvalidArgumentException|JsonException $e){calendar_holiday_reply(422,['error'=>$e->getMessage()]);}
catch(Throwable $e){error_log('cnchome calendar holidays: '.get_class($e));calendar_holiday_reply(503,['error'=>'휴일 정보를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.']);}
