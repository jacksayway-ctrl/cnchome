<?php
declare(strict_types=1);
require '/opt/cnchome-runtime/bootstrap.php';
require '/opt/cnchome-runtime/hr.php';
try {
    session_boot(); $user=current_user();
    if (!$user) {header('Location: /login.php?role='.session_role()); exit;}
    $boot=snapshot($user)+['user'=>$user,'csrf'=>$_SESSION['csrf'],'hr'=>hr_snapshot($user)];
    $html=file_get_contents('/opt/cnchome-runtime/index.html');
    $script='<script>window.CNCHOME_LIVE='.json_encode($boot,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR).';</script><script src="/session-context.js"></script><script defer src="/test-workspace.js"></script>';
    $html=str_replace('<title>씨앤씨 · 직원 화면 미리보기</title>','<title>씨앤씨 · 업무 관리</title>',$html);
    // Apply role visibility before the browser can paint any navigation.
    $role=$user['role']==='admin'?'admin':'employee';
    $html=str_replace('<html lang="ko">','<html lang="ko" data-cnc-role="'.$role.'">',$html);
    $html=preg_replace_callback('/<aside\b[^>]*>.*?<\/aside>/s',function($aside)use($role){return preg_replace_callback('/<button\b[^>]*data-page="([^"]+)"[^>]*>.*?<\/button>/s',function($match)use($role){
        $page=$match[1];$allowed=$role==='admin'?(str_starts_with($page,'admin')||$page==='grade'):in_array($page,['home','regions','attendance','sales','grade','as','payslips','myInfo'],true);
        return $allowed?$match[0]:'';
    },$aside[0]);},$html);
    $visibility='<style>html[data-cnc-role] [hidden]{display:none!important}html[data-cnc-role="employee"] [data-page^="admin"],html[data-cnc-role="employee"] .nav-cut,html[data-cnc-role="employee"] .aw-nav-group,html[data-cnc-role="employee"] .aw-sections,html[data-cnc-role="employee"] #aw-subpages{display:none!important}html[data-cnc-role="admin"] aside [data-page]:not([data-page^="admin"]):not([data-page="grade"]),html[data-cnc-role="admin"] .work>header,html[data-cnc-role="admin"] .work>.sample,html[data-cnc-role="admin"] .top-notice,html[data-cnc-role="admin"] .payroll-link{display:none!important}</style>';
    echo str_replace('<head>','<head>'.$visibility.$script,$html);
} catch(Throwable $e) {http_response_code(503); echo '운영 화면을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';}
