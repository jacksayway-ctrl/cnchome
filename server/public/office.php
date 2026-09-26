<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/hr.php';
require_once CNC_RUNTIME_DIR.'/views.php';
try {
    session_boot();$user=current_user();
    if (!$user) {header('Location: /login.php?role='.session_role());exit;}
    $role=$user['role'];$page=office_page($role,$_GET['page']??null);
    $boot=snapshot($user)+['user'=>$user,'page'=>$page,'csrf'=>$_SESSION['csrf'],'hr'=>hr_snapshot($user)];
    render_view('office',compact('boot','user','role','page'));
} catch (Throwable $e) {
    error_log('cnchome office: '.$e->getMessage());
    http_response_code(503);
    render_view('error',['title'=>'화면을 불러오지 못했습니다.','message'=>'잠시 후 새로고침해 주세요.','role'=>session_role()]);
}
