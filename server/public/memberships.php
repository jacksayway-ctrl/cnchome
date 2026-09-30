<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/membership.php';
require_once CNC_RUNTIME_DIR.'/native.php';
try {
    session_boot();$user=current_user();if(!$user){header('Location: /login.php?role=admin');exit;}membership_admin($user);$error='';
    if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
        if(!is_string($_POST['csrf']??null)||!csrf_ok($_POST['csrf']))throw new HRForbidden('세션이 변경되었습니다. 새로고침 후 승인해 주세요.');
        try {
            membership_approve($user,personnel_natural($_POST['userId']??0),personnel_natural($_POST['revision']??0),membership_text($_POST['team']??'',20),membership_text($_POST['startDate']??'',10),membership_text($_POST['action']??'',20));
            $_SESSION['membership_notice']=($_POST['action']??'')==='approve'?'로그인을 승인했습니다. 직원은 첫 로그인 후 본인 정보를 입력합니다.':'가입 신청을 반려했습니다.';
            $target=($_POST['returnTo']??'')==='contracts'?'/contracts.php?role=admin':'/memberships.php?role=admin';header('Location: '.$target,true,303);exit;
        }catch(InvalidArgumentException $e){$error=$e->getMessage();http_response_code(422);}
    }elseif(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);header('Allow: GET, POST');exit;}
    $memberships=membership_list($user);$notice=$_SESSION['membership_notice']??'';unset($_SESSION['membership_notice']);
    native_start('회원가입 · 로그인 승인',$user,'adminMemberships',['membership.css']);
    if($notice)echo '<p class="nf-alert" role="status">'.view_h($notice).'</p>';
    if($error)echo '<p class="nf-alert" role="alert">'.view_h($error).'</p>';
    $membershipReturn='memberships';require view_root().'/partials/membership-list.php';native_end();
}catch(HRForbidden $e){http_response_code(403);render_view('error',['title'=>'처리 권한 없음','message'=>$e->getMessage(),'role'=>session_role()]);}
catch(Throwable $e){error_log('cnchome memberships: '.get_class($e));http_response_code(503);render_view('error',['title'=>'가입 신청을 불러오지 못했습니다.','message'=>'잠시 후 다시 시도해 주세요.','role'=>session_role()]);}
