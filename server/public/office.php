<?php
declare(strict_types=1);
require '/opt/cnchome-runtime/bootstrap.php';
require '/opt/cnchome-runtime/hr.php';
try {
    session_boot(); $user=current_user();
    if (!$user) {header('Location: /login.php'); exit;}
    $boot=snapshot($user)+['user'=>$user,'csrf'=>$_SESSION['csrf'],'hr'=>hr_snapshot($user)];
    $html=file_get_contents('/opt/cnchome-runtime/index.html');
    $script='<script>window.CNCHOME_LIVE='.json_encode($boot,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR).';</script>';
    $html=str_replace('<title>씨앤씨 · 직원 화면 미리보기</title>','<title>씨앤씨 · 업무 관리</title>',$html);
    echo str_replace('<head>','<head>'.$script,$html);
} catch(Throwable $e) {http_response_code(503); echo '운영 화면을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';}
