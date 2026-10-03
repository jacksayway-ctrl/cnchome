<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/native.php';require_once CNC_RUNTIME_DIR.'/intake-live.php';
session_boot();$user=current_user();if(!$user){header('Location: /login.php?role=admin');exit;}
if($user['role']!=='admin'){http_response_code(403);render_view('error',['title'=>'관리자 전용 메뉴입니다.','message'=>'관리자로 로그인해 주세요.','role'=>'admin']);exit;}
$calendarToday=hr_today();$calendarMonth=substr($calendarToday,0,7);$calendarSeed=['month'=>$calendarMonth,'today'=>$calendarToday];
try{$calendarDb=db();$calendarDb->beginTransaction();$calendarSeed=intake_live_calendar($calendarDb,$calendarMonth,$calendarToday);$calendarDb->commit();}catch(Throwable $e){if(isset($calendarDb)&&$calendarDb->inTransaction())$calendarDb->rollBack();error_log('cnchome initial intake calendar: '.get_class($e));$calendarSeed=['month'=>$calendarMonth,'today'=>$calendarToday,'loaded'=>false];}
native_start('전체 접수 관리',$user,'adminIntake',['intake-management.css','intake-live-calendar.css']);
require view_root().'/intake-live.php';native_end();
