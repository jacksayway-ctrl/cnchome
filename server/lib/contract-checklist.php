<?php
declare(strict_types=1);
require_once __DIR__.'/contracts.php';

function contract_checklist_row(array $employee,array $contracts,string $today): array {
    $p=$employee['profile'];$latest=null;$current=null;$future=[];
    foreach($contracts as $contract){
        $state=contract_workflow_state($contract);if($state==='withdrawn')continue;
        if($latest===null)$latest=$contract;
        if($state!=='applied')continue;
        $terms=$contract['issued_snapshot']['terms']??$contract['terms'];$start=$terms['contractStart']??'';
        if(!is_string($start)||!hr_day($start))continue;
        if($start<=$today&&$current===null)$current=$contract;
        elseif($start>$today)$future[]=$contract;
    }
    usort($future,fn($a,$b)=>strcmp(($a['issued_snapshot']['terms']??$a['terms'])['contractStart'],($b['issued_snapshot']['terms']??$b['terms'])['contractStart']));
    $state=$latest?contract_workflow_state($latest):'missing';
    $status=['missing'=>'미작성','draft'=>'작성 중','pending'=>'직원 승인 대기','approved'=>'관리자 적용 대기','rejected'=>'수정 요청','applied'=>'작성 완료'][$state]??'확인 필요';
    $group=$state==='missing'?'missing':($state==='applied'?'completed':'pending');
    $period=$current??($future[0]??null);$terms=$period?($period['issued_snapshot']['terms']??$period['terms']):$p;
    $source=$period?'적용 계약서':'인사기록';$start=$terms['contractStart']??'';$end=$terms['contractEnd']??'';
    $start=is_string($start)&&hr_day($start)?$start:'';$end=is_string($end)&&hr_day($end)?$end:'';
    $unlimited=($terms['contractType']??'')==='무기계약';$remaining=null;$renewal=false;$nextStart='';
    if($current&&$end&&isset($future[0])){
        $nextStart=($future[0]['issued_snapshot']['terms']??$future[0]['terms'])['contractStart'];
    }
    $renewed=$nextStart!==''&&$end!==''&&$nextStart<=(new DateTimeImmutable($end))->modify('+1 day')->format('Y-m-d');
    if($start>$today)$renewalText='계약 시작 예정 · '.$start;
    elseif($unlimited)$renewalText='기간의 정함 없음';
    elseif($end){
        $remaining=(int)(new DateTimeImmutable($today))->diff(new DateTimeImmutable($end))->format('%r%a');
        $renewalText=$renewed?'갱신 완료 · '.$nextStart.' 시작':($remaining<0?abs($remaining).'일 경과':($remaining===0?'오늘 만료':$remaining.'일 남음'));
        $renewal=!$renewed&&$remaining<=30;
    }else $renewalText='종료일 확인 필요';
    return ['employeeId'=>$employee['id'],'employeeNo'=>$employee['employee_no'],'name'=>$p['name']??'','department'=>$p['team']??'insurance','employment'=>$p['employment']??'재직','status'=>$status,'state'=>$state,'group'=>$group,'contractId'=>$latest?(int)$latest['id']:null,'version'=>$latest?(int)$latest['version']:null,'start'=>$start,'end'=>$unlimited?'':$end,'periodSource'=>$source,'remainingDays'=>$remaining,'renewal'=>$renewal,'renewalText'=>$renewalText,'nextStart'=>$nextStart,'payType'=>$p['payType']??'','url'=>$latest?'/contracts.php?role=admin&id='.$latest['id'].'&editWindow=1':'/contracts.php?role=admin&employeeId='.$employee['id']];
}
function contract_checklist_snapshot(array $user,?string $today=null): array {
    if(($user['role']??'')!=='admin')throw new HRForbidden('근로계약서 운영 점검은 관리자만 조회할 수 있습니다.');
    $today=$today??hr_today();hr_assert(hr_day($today),'기준일을 확인해 주세요.');
    $d=db();$d->beginTransaction();
    try{
        $employees=$d->query('SELECT e.id,e.employee_no,e.user_id,e.profile,u.username,u.display_name,u.role,u.active FROM hr_employees e LEFT JOIN app_users u ON u.id=e.user_id ORDER BY e.id')->fetchAll();
        $contracts=$d->query('SELECT c.id,c.employee_id,c.version,c.status,c.terms,c.issued_snapshot,a.state AS approval_state FROM hr_contracts c LEFT JOIN hr_contract_approvals a ON a.contract_id=c.id ORDER BY c.employee_id,c.version DESC,c.id DESC')->fetchAll();
        $byEmployee=[];foreach($contracts as $contract){$contract['terms']=json_decode($contract['terms'],true,512,JSON_THROW_ON_ERROR);$contract['issued_snapshot']=$contract['issued_snapshot']?json_decode($contract['issued_snapshot'],true,512,JSON_THROW_ON_ERROR):null;$byEmployee[(int)$contract['employee_id']][]=$contract;}
        $records=[];$excluded=0;$counts=['missing'=>0,'pending'=>0,'completed'=>0,'renewal'=>0];
        foreach($employees as $employee){
            $p=json_decode($employee['profile'],true,512,JSON_THROW_ON_ERROR);
            if(($p['employment']??'재직')==='퇴사'||(!empty($p['endDate'])&&$p['endDate']<$today)||($employee['user_id']&&!$employee['active'])||cnc_test_user($employee)){$excluded++;continue;}
            $employee['id']=(int)$employee['id'];$employee['profile']=$p;
            $row=contract_checklist_row($employee,$byEmployee[$employee['id']]??[],$today);$records[]=$row;$counts[$row['group']]++;if($row['renewal'])$counts['renewal']++;
        }
        $rank=['missing'=>0,'pending'=>1,'completed'=>2];usort($records,fn($a,$b)=>$rank[$a['group']]<=>$rank[$b['group']]?:($b['renewal']<=>$a['renewal'])?:(($a['remainingDays']??PHP_INT_MAX)<=>($b['remainingDays']??PHP_INT_MAX))?:strcmp($a['name'],$b['name']));
        $d->commit();return ['today'=>$today,'records'=>$records,'counts'=>$counts,'total'=>count($records),'excluded'=>$excluded,'renewalWindowDays'=>30];
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
