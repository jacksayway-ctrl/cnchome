<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/hr.php';
require_once CNC_RUNTIME_DIR.'/native.php';
require_once CNC_RUNTIME_DIR.'/personnel.php';
try {
    session_boot();$user=current_user();
    if(!$user){header('Location: /login.php?role='.session_role());exit;}
    $admin=$user['role']==='admin';$role=$user['role'];$error='';$saved=false;
    $records=personnel_records($user);$record=null;
    $id=$admin?personnel_natural($_GET['id']??0):(int)($records[0]['id']??0);
    foreach($records as $item)if($item['id']===$id){$record=$item;break;}
    $isNew=$admin&&($_GET['new']??'')==='1';
    if($admin&&$id&&!$record)throw new HRForbidden('직원을 찾을 수 없습니다.');
    $editing=$admin&&($isNew||($_GET['edit']??'')==='1');
    $profile=$record['profile']??personnel_default_profile();$formRevision=(int)($record['revision']??0);
    if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
        if(!$admin)throw new HRForbidden('인사정보 변경은 관리자만 할 수 있습니다.');
        if(!is_string($_POST['csrf']??null)||!csrf_ok($_POST['csrf']))throw new HRForbidden('세션이 변경되었습니다. 새로고침 후 다시 저장해 주세요.');
        try {
            $postId=personnel_natural($_POST['id']??0);
            hr_assert($postId===($isNew?0:$id),'직원 정보가 변경되었습니다. 다시 열어 주세요.');
            $formRevision=personnel_natural($_POST['revision']??0);
            $profile=personnel_post_profile($_POST,$record['profile']??[]);
            $password=$_POST['password']??'';hr_assert(is_string($password),'계정 입력을 확인해 주세요.');
            $input=['action'=>'saveStaff','id'=>$postId,'revision'=>$formRevision,'profile'=>$profile,'accountId'=>personnel_natural($_POST['accountId']??0),'password'=>$password];
            hr_mutate($user,$input);
            $_SESSION['personnel_saved']=true;
            header('Location: /personnel.php?role=admin'.($postId?'&id='.$postId:''),true,303);exit;
        }catch(InvalidArgumentException $e){$error=$e->getMessage();$editing=true;http_response_code(422);}
        catch(PDOException $e){error_log('cnchome personnel save '.$e->getCode());$error=$e->getCode()==='23000'?'이미 연결된 직원 계정입니다. 다른 계정을 선택해 주세요.':'저장에 실패했습니다. 새로고침 후 저장 여부를 확인해 주세요.';$editing=true;http_response_code(409);}
    }elseif(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);header('Allow: GET, POST');throw new HRForbidden('허용되지 않은 요청입니다.');}
    if(isset($_SESSION['personnel_saved'])){$saved=true;unset($_SESSION['personnel_saved']);}
    $accounts=[];
    if($editing&&empty($record['user_id']))$accounts=db()->query("SELECT id,username,display_name FROM app_users WHERE role='employee' AND active=1 AND id NOT IN (SELECT user_id FROM hr_employees WHERE user_id IS NOT NULL) ORDER BY display_name")->fetchAll();
    native_start($admin?'인사기록카드':'내 정보 · 인사기록카드',$user,$admin?($isNew?'adminStaffRegister':'adminStaff'):'myInfo');
    require view_root().'/personnel.php';
    native_end();
}catch(HRForbidden $e){
    if(http_response_code()!==405)http_response_code(403);
    if(isset($user)&&$user){native_start('인사기록카드',$user,$user['role']==='admin'?'adminStaff':'myInfo');echo '<p class="nf-alert">'.h($e->getMessage()).'</p>';native_end();}
    else echo h($e->getMessage());
}catch(InvalidArgumentException $e){
    http_response_code(422);
    if(isset($user)&&$user){native_start('인사기록카드',$user,$user['role']==='admin'?'adminStaff':'myInfo');echo '<p class="nf-alert">'.h($e->getMessage()).'</p>';native_end();}
    else echo h($e->getMessage());
}catch(Throwable $e){
    error_log('cnchome personnel '.get_class($e).': '.$e->getMessage());http_response_code(503);
    echo '<!doctype html><html lang="ko"><meta charset="utf-8"><title>인사정보</title><p>인사정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p></html>';
}
