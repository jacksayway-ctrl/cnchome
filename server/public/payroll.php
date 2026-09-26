<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/views.php';
try {
    if (!isset($_GET['role'])) $_GET['role']='admin';
    session_boot();$user=current_user();
    if (!$user) {header('Location: /login.php?role=admin');exit;}
    $role=$user['role'];
    if ($role!=='admin') {http_response_code(403);render_view('error',['title'=>'관리자 전용 화면입니다.','message'=>'직원 명세서는 업무 화면의 가지급명세서 메뉴에서 확인해 주세요.']);exit;}
    $boot=['user'=>$user,'csrf'=>$_SESSION['csrf']];
    render_view('payroll',compact('boot','user','role'));
} catch (Throwable $e) {http_response_code(503);render_view('error',['title'=>'급여 화면을 불러오지 못했습니다.','message'=>'잠시 후 다시 시도해 주세요.','role'=>'admin']);}
