<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/hr.php';
require_once CNC_RUNTIME_DIR.'/pay-statements.php';
require_once CNC_RUNTIME_DIR.'/grade-ledger.php';
require_once CNC_RUNTIME_DIR.'/native.php';
session_boot();$user=current_user();
if(!$user){header('Location: /login.php?role='.session_role());exit;}
$role=$user['role'];$admin=$role==='admin';$error='';
try {
    if($_SERVER['REQUEST_METHOD']==='POST'){
        if(!csrf_ok(is_string($_POST['csrf']??null)?$_POST['csrf']:'')){http_response_code(403);throw new HRForbidden('화면을 새로고침한 뒤 다시 요청해 주세요.');}
        $action=is_string($_POST['action']??null)?$_POST['action']:'';
        $in=['action'=>$action,'id'=>pay_statement_number($_POST['id']??'0'),'revision'=>pay_statement_number($_POST['revision']??'0')];
        if($action==='savePayroll'){
            if(!$admin)throw new HRForbidden('관리자만 급여를 작성할 수 있습니다.');
            $employeeId=pay_statement_number($_POST['employeeId']??'0');$month=substr(hr_today(),0,7);$state=hr_snapshot($user);$employee=null;
            foreach($state['employees'] as $candidate)if($candidate['id']===$employeeId)$employee=$candidate;
            hr_assert($employee!==null,'직원을 선택해 주세요.');
            $in+=['employeeId'=>$employeeId,'month'=>$month,'calculation'=>pay_statement_post($_POST,$employee['profile'],$month)];
        }else{$in['note']=pay_statement_text($_POST['note']??'',1000);$in['reviewed']=isset($_POST['reviewed']);}
        hr_mutate($user,$in);
        $id=$in['id'];
        if(!$id&&$action==='savePayroll'){$q=db()->prepare('SELECT id FROM hr_payroll WHERE employee_id=? AND month=?');$q->execute([$employeeId,$month]);$id=(int)$q->fetchColumn();}
        header('Location: /pay-statements.php?role='.$role.'&id='.$id.'&saved=1',true,303);exit;
    }
}catch(HRForbidden $e){http_response_code(403);$error=$e->getMessage();}
catch(InvalidArgumentException $e){http_response_code(422);$error=$e->getMessage();}
catch(Throwable $e){error_log('cnchome pay statement write: '.$e->getMessage());http_response_code(503);$error='저장 내용을 처리하지 못했습니다. 잠시 후 다시 확인해 주세요.';}
try {
    $state=hr_snapshot($user);$id=(int)($_GET['id']??$_POST['id']??0);$selected=null;
    foreach($state['payroll'] as $candidate)if($candidate['id']===$id)$selected=$candidate;
    if($id&&!$selected){http_response_code(404);$error='조회할 명세서가 없습니다.';}
    $editing=$admin&&((($_GET['edit']??'')==='1')||($_POST['action']??'')==='savePayroll');
    if($selected&&$editing&&!hr_can_change($selected,'savePayroll',true,hr_today())){$editing=false;$error='확정·지난달 기록 또는 현재 상태에서는 수정할 수 없습니다.';}
    $employeeId=(int)($selected['employee_id']??$_POST['employeeId']??$_GET['employeeId']??($state['employees'][0]['id']??0));$employee=null;
    foreach($state['employees'] as $candidate)if($candidate['id']===$employeeId)$employee=$candidate;
    $month=$selected['month']??substr(hr_today(),0,7);
    $calculation=$selected['calculation']??['minutes'=>0,'base'=>0,'holiday'=>0,'allowance'=>0,'deductions'=>0,'gross'=>0,'net'=>0,'note'=>'','payType'=>$employee['profile']['payType']??'시급제','rate'=>$employee['profile']['payAmount']??15000];
    $snapshot=$selected['published_snapshot']??null;
    require view_root().'/pay-statements.php';
}catch(Throwable $e){error_log('cnchome pay statement read: '.$e->getMessage());http_response_code(503);echo '<p>명세서를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>';}
