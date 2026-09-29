<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/views.php';
require_once CNC_RUNTIME_DIR.'/contracts.php';
require_once CNC_RUNTIME_DIR.'/native.php';
try {
    session_boot();$user=current_user();
    if(!$user){header('Location: /login.php?role='.session_role());exit;}
    $role=$user['role'];$error='';$failedPost=[];
    if($_SERVER['REQUEST_METHOD']==='POST'){
        try{
            hr_assert(is_string($_POST['csrf']??null)&&csrf_ok($_POST['csrf']),'인증 시간이 만료됐습니다. 새로고침 후 다시 시도해 주세요.');
            $id=contract_mutate($user,$_POST);$_SESSION['contract_notice']='저장했습니다.';
            header('Location: /contracts.php?role='.$role.($id?'&id='.$id:''),true,303);exit;
        }catch(InvalidArgumentException $e){$error=$e->getMessage();$failedPost=$_POST;}
    }
    $id=isset($_GET['id'])&&is_string($_GET['id'])&&ctype_digit($_GET['id'])?(int)$_GET['id']:0;
    $selected=$id?contract_find($id,$user):null;
    if($id&&!$selected){http_response_code(404);render_view('error',['title'=>'계약서를 찾을 수 없습니다.','message'=>'계약 번호 또는 열람 권한을 확인해 주세요.','role'=>$role]);exit;}
    $documentOnly=isset($_GET['document'])||isset($_GET['download']);$download=isset($_GET['download']);
    if($documentOnly){
        if(!$selected){http_response_code(404);exit;}
        if($download){header('Content-Type: text/html; charset=utf-8');header('Content-Disposition: attachment; filename="employment-contract-'.$selected['id'].'-v'.$selected['version'].'.html"');}
        render_view('contract-document',compact('user','role','selected','documentOnly','download'));exit;
    }
    $company=contract_company_row();$contracts=contract_list($user);
    if(!$selected&&$role==='employee'&&$contracts)$selected=$contracts[0];
    $employees=$role==='admin'?db()->query('SELECT id,employee_no,profile FROM hr_employees ORDER BY id')->fetchAll():[];
    $events=[];
    if($selected){$q=db()->prepare('SELECT ce.event,ce.created_at,u.display_name FROM hr_contract_events ce JOIN app_users u ON u.id=ce.actor_id WHERE ce.contract_id=? ORDER BY ce.id DESC LIMIT 30');$q->execute([$selected['id']]);$events=$q->fetchAll();}
    $notice=$_SESSION['contract_notice']??'';unset($_SESSION['contract_notice']);
    render_view('contracts',compact('user','role','selected','company','contracts','employees','events','error','notice','failedPost'));
} catch(Throwable $e){
    error_log('cnchome contracts: '.$e->getMessage());http_response_code(503);
    render_view('error',['title'=>'근로계약서를 불러오지 못했습니다.','message'=>'잠시 후 다시 시도해 주세요.','role'=>session_role()]);
}
