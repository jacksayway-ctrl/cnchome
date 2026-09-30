<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/membership.php';
require_once CNC_RUNTIME_DIR.'/native.php';
try {
    session_boot();$user=current_user();if(!$user){header('Location: /login.php?role=employee');exit;}
    if($user['role']!=='employee')throw new HRForbidden('직원 본인 정보만 입력할 수 있습니다.');
    $member=membership_record((int)$user['id']);if(!$member||$member['status']!=='approved')throw new HRForbidden('가입 승인된 직원만 사용할 수 있습니다.');
    $record=personnel_records($user)[0]??null;hr_assert((bool)$record,'연결된 인사정보를 확인해 주세요.');$profile=$record['profile'];$formRevision=$record['revision'];$error='';
    if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
        if(!is_string($_POST['csrf']??null)||!csrf_ok($_POST['csrf']))throw new HRForbidden('세션이 변경되었습니다. 새로고침 후 저장해 주세요.');
        try {membership_save_profile($user,$_POST);header('Location: /office.php?role=employee#home',true,303);exit;}
        catch(InvalidArgumentException $e){$error=$e->getMessage();http_response_code(422);foreach(['name','phone','email','birthDate','address','addressDetail','postcode','gender','nationality','bank','accountNumber','accountHolder','emergencyName','emergencyPhone','career','qualification'] as $key)if(is_string($_POST[$key]??null))$profile[$key]=$_POST[$key];$formRevision=is_scalar($_POST['revision']??null)?(string)$_POST['revision']:0;}
    }elseif(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);header('Allow: GET, POST');exit;}
    native_start('본인 정보 입력',$user,'myInfo',['membership.css']);require view_root().'/profile-entry.php';native_end();
}catch(HRForbidden $e){http_response_code(403);render_view('error',['title'=>'처리 권한 없음','message'=>$e->getMessage(),'role'=>session_role()]);}
catch(Throwable $e){error_log('cnchome profile entry: '.get_class($e));http_response_code(503);render_view('error',['title'=>'본인 정보를 불러오지 못했습니다.','message'=>'잠시 후 다시 시도해 주세요.','role'=>session_role()]);}
