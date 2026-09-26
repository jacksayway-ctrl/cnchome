<?php
declare(strict_types=1);
require '/opt/cnchome-runtime/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
try {
    session_boot();$user=current_user();
    echo json_encode($user?['authenticated'=>true,'name'=>$user['display_name'],'csrf'=>$_SESSION['csrf']]:['authenticated'=>false],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
} catch(Throwable $e) {http_response_code(503);echo '{"error":"로그인 상태를 확인하지 못했습니다."}';}
