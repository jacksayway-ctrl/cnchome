<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/views.php';
try {
    if (!isset($_GET['role'])) $_GET['role']='admin';
    session_boot();$user=current_user();
    if (!$user) {header('Location: /login.php?role=admin');exit;}
    if ($user['role']!=='admin') {http_response_code(403);render_view('error',['title'=>'관리자 전용 화면입니다.','message'=>'관리자로 로그인해 주세요.']);exit;}
    render_view('office',['preview'=>true,'page'=>'home','role'=>'admin']);
} catch (Throwable $e) {http_response_code(503);render_view('error',['title'=>'미리보기를 불러오지 못했습니다.','message'=>'잠시 후 다시 시도해 주세요.']);}
