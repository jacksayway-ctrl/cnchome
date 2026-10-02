<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/intake-management.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
try{
    session_boot();$user=current_user();if(!$user){http_response_code(401);echo hr_json(['error'=>'로그인 상태를 확인해 주세요.']);exit;}intake_admin($user);
    if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);header('Allow: GET');echo hr_json(['error'=>'조회 요청을 확인해 주세요.']);exit;}
    $query=intake_text($_GET['q']??'',80);$scope=intake_text($_GET['scope']??'real',10);session_write_close();
    echo hr_json(intake_live_search($user,$query,$scope));
}catch(HRForbidden $e){http_response_code(403);echo hr_json(['error'=>$e->getMessage()]);}
catch(InvalidArgumentException $e){http_response_code(422);echo hr_json(['error'=>$e->getMessage()]);}
catch(Throwable $e){http_response_code(503);echo hr_json(['error'=>'접수 검색에 실패했습니다. 잠시 후 다시 입력해 주세요.']);}
