<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/native.php';require_once CNC_RUNTIME_DIR.'/intake-alerts.php';
try{
    session_boot();$user=current_user();if(!$user){header('Location: /login.php?role=admin');exit;}intake_admin($user);
    if($_SERVER['REQUEST_METHOD']!=='GET'){http_response_code(405);header('Allow: GET');exit;}
    $f=intake_alert_filters($_GET);$data=intake_alert_snapshot($user,$f);
    if(isset($_GET['fragment'])){header('Content-Type: text/html; charset=utf-8');require view_root().'/partials/intake-alert-list.php';exit;}
    native_start('가접수 알림',$user,'adminIntakeAlerts',['intake-management.css']);require view_root().'/intake-alerts.php';native_end();
}catch(HRForbidden $e){http_response_code(403);render_view('error',['title'=>'관리자 전용 메뉴','message'=>$e->getMessage(),'role'=>'admin']);}
catch(InvalidArgumentException $e){http_response_code(422);render_view('error',['title'=>'조회 조건 확인','message'=>$e->getMessage(),'role'=>'admin']);}
catch(Throwable $e){error_log('cnchome intake alerts: '.$e->getMessage());http_response_code(503);render_view('error',['title'=>'가접수 알림을 불러오지 못했습니다.','message'=>'잠시 후 다시 조회해 주세요.','role'=>'admin']);}
