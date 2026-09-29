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
    if(isset($_GET['calculate'])){
        if($role!=='admin')throw new HRForbidden('관리자만 사용할 수 있습니다.');
        try{$start=contract_text($_GET['start']??'',10,'시작일');$term=contract_text($_GET['term']??'',15,'기간');$days=$_GET['days']??['월','화','수','목','금'];hr_assert(is_array($days),'근무요일을 확인해 주세요.');foreach($days as $day)hr_assert(is_string($day),'근무요일을 확인해 주세요.');
            if(isset($_GET['employeeId'])){$q=db()->prepare('SELECT profile FROM hr_employees WHERE id=?');$q->execute([contract_number($_GET['employeeId'],PHP_INT_MAX,'직원')]);$p=$q->fetchColumn();hr_assert((bool)$p,'직원을 선택해 주세요.');$days=json_decode($p,true,512,JSON_THROW_ON_ERROR)['workDays']??[];}
            $result=contract_period($start,$term,'',$days);header('Content-Type: application/json; charset=utf-8');echo hr_json($result);
        }catch(InvalidArgumentException $e){http_response_code(422);header('Content-Type: application/json; charset=utf-8');echo hr_json(['error'=>$e->getMessage()]);}exit;
    }

    if($_SERVER['REQUEST_METHOD']==='POST'){
        try{
            hr_assert(is_string($_POST['csrf']??null)&&csrf_ok($_POST['csrf']),'인증 시간이 만료됐습니다. 새로고침 후 다시 시도해 주세요.');
            $id=contract_mutate($user,$_POST);$_SESSION['contract_notice']='저장했습니다.';
            header('Location: /contracts.php?role='.$role.($id?'&id='.$id:''),true,303);exit;
        }catch(InvalidArgumentException $e){$error=$e->getMessage();$failedPost=$_POST;http_response_code(422);}
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
    $filterTeam='';$filterEmployee=0;$filterProfile=null;
    if($role==='admin'){
        $filterTeam=is_string($_GET['team']??null)?$_GET['team']:'';hr_assert(in_array($filterTeam,['','insurance','cosmetics','health'],true),'부서를 확인해 주세요.');
        $filterEmployee=isset($_GET['employeeId'])?contract_number($_GET['employeeId'],PHP_INT_MAX,'직원'):(int)($selected['employee_id']??0);
        if($filterTeam)$employees=array_values(array_filter($employees,fn($e)=>json_decode($e['profile'],true,512,JSON_THROW_ON_ERROR)['team']===$filterTeam));
        $match=null;foreach($employees as $e)if((int)$e['id']===$filterEmployee)$match=$e;
        if(!$match)$filterEmployee=0;else $filterProfile=json_decode($match['profile'],true,512,JSON_THROW_ON_ERROR);
        if($filterTeam||$filterEmployee){$ids=array_map(fn($e)=>(int)$e['id'],$employees);$contracts=array_values(array_filter($contracts,fn($c)=>in_array((int)$c['employee_id'],$ids,true)&&(!$filterEmployee||(int)$c['employee_id']===$filterEmployee)));}
        if(!$id&&$filterEmployee)$selected=$contracts[0]??null;
    }
    $events=[];
    if($selected){$q=db()->prepare('SELECT ce.event,ce.created_at,ce.snapshot,u.display_name FROM hr_contract_events ce JOIN app_users u ON u.id=ce.actor_id WHERE ce.contract_id=? ORDER BY ce.id DESC LIMIT 30');$q->execute([$selected['id']]);$events=$q->fetchAll();}
    $notice=$_SESSION['contract_notice']??'';unset($_SESSION['contract_notice']);
    render_view('contracts',compact('user','role','selected','company','contracts','employees','events','error','notice','failedPost','filterTeam','filterEmployee','filterProfile'));
} catch(HRForbidden $e){http_response_code(403);render_view('error',['title'=>'처리 권한 없음','message'=>$e->getMessage(),'role'=>session_role()]);}
catch(Throwable $e){
    error_log('cnchome contracts: '.$e->getMessage());http_response_code(503);
    render_view('error',['title'=>'근로계약서를 불러오지 못했습니다.','message'=>'잠시 후 다시 시도해 주세요.','role'=>session_role()]);
}
