<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/native.php';require_once CNC_RUNTIME_DIR.'/pending-intakes.php';require_once CNC_RUNTIME_DIR.'/pending-rollover.php';
$detailFragment=($_GET['detail']??'')==='1';
try{
    session_boot();$user=current_user();if(!$user){if($detailFragment){http_response_code(401);exit;}header('Location: /login.php?role=admin');exit;}intake_admin($user);
    if($detailFragment&&($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);header('Allow: GET');exit;}
    $popup=($_GET['popup']??'')==='1';$filters=intake_filters($_GET);if($filters['team']==='')$filters['team']='insurance';if($popup)$filters['popup']='1';$mode=($_GET['new']??'')==='1'?'new':'list';$error='';$posted=[];$duplicateCount=0;
    if($_SERVER['REQUEST_METHOD']==='POST'){
        if(!is_string($_POST['csrf']??null)||!csrf_ok($_POST['csrf']))throw new HRForbidden('인증 시간이 만료됐습니다. 새로고침해 주세요.');
        try{
            if(($_POST['action']??'')==='create'){
                if($filters['team']!==''){
                    $employeeQuery=db()->prepare("SELECT department FROM app_users WHERE id=? AND role='employee'");
                    $employeeQuery->execute([intake_number($_POST['employeeId']??0)]);
                    hr_assert($employeeQuery->fetchColumn()===$filters['team'],'선택한 직원이 현재 부서와 다릅니다.');
                }
                $row=intake_create($user,$_POST);
                $target=intake_url(['month'=>substr($_POST['date'],0,7),'team'=>$filters['team'],'scope'=>$row['is_test']?'test':'real'],['id'=>$row['id']]);
            }
            else{intake_update($user,$_POST);$target=intake_url($filters,($_POST['action']??'')==='delete'?['new'=>'1']:['id'=>$_POST['id']]);}
            $_SESSION['intake_notice']=($_POST['action']??'')==='delete'?'접수증을 삭제했습니다.':'접수 내용을 저장했습니다.';header('Location: '.$target,true,303);exit;
        }catch(SalesDuplicate $e){http_response_code(409);$error=$e->getMessage();$duplicateCount=$e->count;$posted=array_filter($_POST,'is_string');}
        catch(InvalidArgumentException $e){http_response_code(422);$error=$e->getMessage();$posted=array_filter($_POST,'is_string');}
    }elseif($_SERVER['REQUEST_METHOD']!=='GET'){http_response_code(405);header('Allow: GET, POST');exit;}
    pending_rollover($user);$snapshot=$filters['month']==='all'?pending_intake_snapshot($user,true):sales_snapshot($user,$filters['month']);
    if($mode==='list'){
        $records=array_column($snapshot['records'],null,'id');
        foreach(intake_actual_normal_records($user,$filters) as $record)$records[$record['id']]=array_replace($records[$record['id']]??[],$record);
        $snapshot['records']=array_values($records);
    }
    $id=intake_text($_GET['id']??'',60);
    // A date/status edit can move an earlier call outside the current count; keep its detail accessible.
    if($id!==''&&!in_array($id,array_column($snapshot['records'],'id'),true)&&ctype_digit($id)){
        $q=db()->prepare('SELECT first_date FROM sales_records WHERE id=?');$q->execute([(int)$id]);$firstDate=$q->fetchColumn();
        if($firstDate)foreach(sales_snapshot($user,substr((string)$firstDate,0,7))['records'] as $record)if($record['id']===$id)$snapshot['records'][]=$record;
    }
    $counts=['pending'=>0,'normal'=>0,'as'=>0];$summaryRows=intake_filtered($snapshot['records'],array_replace($filters,['status'=>'','dateBasis'=>'first']));foreach($summaryRows as $r)$counts[$r['status']]++;
    $actualNormalCount=count(intake_filtered($snapshot['records'],array_replace($filters,['status'=>'normal','dateBasis'=>'actual'])));
    $rows=intake_filtered($snapshot['records'],$filters);$total=count($rows);$pages=max(1,(int)ceil($total/30));$filters['p']=min($filters['p'],$pages);
    $selected=null;foreach($snapshot['records'] as $row)if($row['id']===$id)$selected=$row;
    if($id&&!$selected){http_response_code(404);$error='선택한 월에서 접수 내역을 찾을 수 없습니다.';}
    if($detailFragment){
        if(!$selected){http_response_code(404);exit;}
        $history=intake_history($user,$id);
        header('Content-Type: text/html; charset=utf-8');header('X-CNC-Intake-Detail: 1');
        require view_root().'/intake.php';exit;
    }
    // Re-open the saved record on its actual result page after a filtered edit.
    if($selected){$position=array_search($id,array_column($rows,'id'),true);if($position!==false)$filters['p']=(int)floor($position/30)+1;}
    $list=array_slice($rows,($filters['p']-1)*30,30);
    if(($_GET['export']??'')==='csv'){
        header('Content-Type: text/csv; charset=UTF-8');header('Content-Disposition: attachment; filename="intake-'.$filters['month'].'.csv"');$out=fopen('php://output','w');fwrite($out,"\xEF\xBB\xBF");
        fputcsv($out,['접수번호','가접수일','실제 접수일','담당자','상담원','부서','고객명','전화번호','생년월일/출생연도','접수 코드','상담 시간','지역(동)','성별','통화 가능시간','방문 일정·장소','월보험료','메모','상태','자료 구분'],',','"','');
        foreach($rows as $r)fputcsv($out,array_map('intake_csv_cell',[$r['id'],$r['date'],$r['status']==='normal'?($r['statusDate']??$r['date']):'',$r['employee'],$r['counselorName']??'',department_label($r['team']),$r['customer'],$r['phone']??'',($r['birthDate']??'')?:($r['birthYear']??''),$r['carrier']??'',$r['consultationTime']??'',$r['consultationPlace']??'',$r['gender']??'',$r['callAvailability']??'',$r['visitSchedule']??'',$r['premiumBand']??'',$r['note']??'',intake_status($r['status']),$r['isTest']?'테스트':'운영']),',','"','');fclose($out);exit;
    }
    $history=$selected?intake_history($user,$id):[];$recallQueue=$mode==='list'&&!$popup?intake_recall_queue($user,$filters):[];
    $testCount=count(array_filter($snapshot['records'],fn($r)=>$r['isTest']&&($filters['month']==='all'||str_starts_with($r['date'],$filters['month']))));
    $notice=$_SESSION['intake_notice']??'';unset($_SESSION['intake_notice']);
    $requestKey=$posted['requestKey']??sprintf('%s-%s-%s-%s-%s',bin2hex(random_bytes(4)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(6)));
    $registrationData=null;
    if($mode==='new'){
        $staff=$snapshot['staff'];
        $staff=$filters['team']===''?$staff:array_values(array_filter($staff,fn($member)=>$member['team']===$filters['team']));
        $registrationData=['user'=>array_intersect_key($user,array_flip(['id','role','display_name','department'])),'csrf'=>(string)($_SESSION['csrf']??''),'staff'=>$staff,'counselorNames'=>$snapshot['counselorNames'],'listUrl'=>intake_url(['month'=>$filters['month'],'team'=>$filters['team'],'scope'=>$filters['scope']]),'employeeId'=>$filters['employee'],'team'=>$filters['team']];
    }
    $activePage=$mode==='new'?'adminIntakeRegister':($filters['status']==='pending'?'adminPending':'adminIntake');
    $title='접수관리';
    native_start($title,$user,$activePage,['intake-management.css','receipt-form.css','intake-month.css'],$popup);require view_root().'/intake.php';native_end();
}catch(HRForbidden $e){http_response_code(403);render_view('error',['title'=>'관리자 전용 메뉴입니다.','message'=>$e->getMessage(),'role'=>'admin']);}
catch(InvalidArgumentException $e){http_response_code(422);render_view('error',['title'=>'조회 조건을 확인해 주세요.','message'=>$e->getMessage(),'role'=>'admin']);}
catch(Throwable $e){error_log('cnchome intake management: '.$e->getMessage());http_response_code(503);render_view('error',['title'=>'접수관리를 불러오지 못했습니다.','message'=>'잠시 후 다시 시도해 주세요.','role'=>'admin']);}
