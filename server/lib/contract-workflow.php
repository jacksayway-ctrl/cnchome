<?php
declare(strict_types=1);

function contract_period(string $start,string $term,string $end,array $days): array {
    hr_assert(hr_day($start),'계약 시작일을 입력해 주세요.');
    hr_assert(in_array($term,['fiveDays','month','quarter','tenMonths','custom','unlimited'],true),'계약기간을 선택해 주세요.');
    if($term==='unlimited')return ['contractStart'=>$start,'contractEnd'=>'','contractType'=>'무기계약','periodPreset'=>$term];
    if($term==='custom'&&$end==='')$term='tenMonths';
    if($term==='fiveDays'){
        $names=['월','화','수','목','금','토','일'];
        hr_assert($days&&count(array_diff($days,$names))===0,'5일 계약을 계산할 근무요일을 선택해 주세요.');
        $d=new DateTimeImmutable($start);$count=0;
        for($i=0;$i<50;$i++,$d=$d->modify('+1 day'))if(in_array($names[(int)$d->format('N')-1],$days,true)&&++$count===5)break;
        $end=$d->format('Y-m-d');
    }elseif(in_array($term,['month','quarter','tenMonths'],true))$end=hr_contract_end($start,$term);
    hr_assert(hr_day($end)&&$end>=$start,'계약 종료일은 시작일 이후로 입력해 주세요.');
    return ['contractStart'=>$start,'contractEnd'=>$end,'contractType'=>'기간제','periodPreset'=>$term];
}
function contract_workflow_state(array $row): string {return ($row['approval_state']??'')?:($row['status']==='draft'?'draft':'pending');}
function contract_workflow_store(int $id,string $state,array $user,string $reason=''): void {
    $d=db();$q=$d->prepare('SELECT contract_id FROM hr_contract_approvals WHERE contract_id=?');$q->execute([$id]);
    if($q->fetch()){$q=$d->prepare('UPDATE hr_contract_approvals SET state=?,actor_id=?,reason=?,updated_at=UTC_TIMESTAMP(6) WHERE contract_id=?');$q->execute([$state,$user['id'],$reason,$id]);}
    else{$q=$d->prepare('INSERT INTO hr_contract_approvals(contract_id,state,actor_id,reason) VALUES(?,?,?,?)');$q->execute([$id,$state,$user['id'],$reason]);}
}
// The caller holds the contract row lock and owns the transaction.
function contract_workflow_mutate(array $user,array $in,array $row): void {
    $d=db();$action=$in['action'];$id=$row['id'];$state=contract_workflow_state($row);$t=$row['issued_snapshot']['terms']??[];
    hr_assert($row['status']!=='draft','발급 전 초안은 승인하거나 적용할 수 없습니다.');
    $reason=contract_text($in['reason']??'',500,'처리 사유');$snapshot=['sha256'=>$row['content_hash'],'reason'=>$reason];
    if(in_array($action,['approve','reject'],true)){
        hr_assert($user['role']==='employee'&&(int)$row['recipient_user_id']===(int)$user['id'],'본인 계약만 승인할 수 있습니다.');
        hr_assert($state==='pending','이미 처리한 계약입니다. 최신 상태를 확인해 주세요.');
        if($action==='approve'){
            hr_assert(($in['reviewed']??'')==='1','계약 내용과 사본 확인 항목을 선택해 주세요.');
            $name=contract_text($in['approvalName']??'',50,'승인자 성명');hr_assert($name===$t['employeeName'],'계약서에 표시된 본인 성명을 입력해 주세요.');
            $snapshot['name']=$name;$snapshot['notice']='직원 본인 계정의 계약 내용 승인 및 관리자 적용 요청';
            $q=$d->prepare("UPDATE hr_contracts SET status='received',received_at=UTC_TIMESTAMP(6),received_by=? WHERE id=?");$q->execute([$user['id'],$id]);
        }else hr_assert($reason!=='','수정이 필요한 내용을 입력해 주세요.');
        contract_workflow_store($id,$action==='approve'?'approved':'rejected',$user,$reason);
    }elseif($action==='apply'){
        hr_assert($user['role']==='admin'&&$state==='approved','직원 승인 완료 계약만 최종 적용할 수 있습니다.');
        hr_assert(($in['signedConfirmed']??'')==='1','당사자 서명·합의 확인 항목을 선택해 주세요.');
        $q=$d->prepare('SELECT * FROM hr_employees WHERE id=? FOR UPDATE');$q->execute([$row['employee_id']]);$employee=$q->fetch();
        hr_assert($employee&&(int)$employee['user_id']===(int)$row['recipient_user_id'],'직원 계정 연결이 변경되어 적용할 수 없습니다.');
        hr_assert((int)$employee['revision']===contract_number($in['employeeRevision']??0,100000000,'인사 수정 번호'),'인사정보가 변경됐습니다. 새로고침 후 적용 내용을 다시 확인해 주세요.');
        $q=$d->prepare("SELECT c.id FROM hr_contracts c JOIN hr_contract_approvals a ON a.contract_id=c.id WHERE c.employee_id=? AND c.version>? AND a.state='applied'");$q->execute([$row['employee_id'],$row['version']]);hr_assert(!$q->fetch(),'더 최신 계약이 적용되어 있습니다.');
        $before=json_decode($employee['profile'],true,512,JSON_THROW_ON_ERROR);$after=$before;
        foreach(['contractStart','contractEnd','contractType'] as $key)$after[$key]=$t[$key];
        if(!empty($t['hireDate'])){
            hr_assert(hr_day($t['hireDate'])&&$t['hireDate']<=$t['contractStart'],'입사일은 계약 시작일 이전 또는 같은 날로 입력해 주세요.');
            $after['startDate']=$t['hireDate'];
        }
        $after['contractTerm']='';$after['payday']=(string)$t['paymentDay'];
        $q=$d->prepare('UPDATE hr_employees SET profile=?,revision=revision+1 WHERE id=?');$q->execute([hr_json($after),$row['employee_id']]);
        $snapshot['before']=array_intersect_key($before,array_flip(['startDate','contractStart','contractEnd','contractType','payday']));
        $snapshot['after']=array_intersect_key($after,array_flip(['startDate','contractStart','contractEnd','contractType','payday']));$snapshot['signedConfirmed']=true;
        contract_workflow_store($id,'applied',$user,$reason);
    }elseif($action==='withdraw'){
        hr_assert($user['role']==='admin'&&in_array($state,['pending','approved','rejected'],true),'이미 적용되었거나 회수한 계약입니다.');
        hr_assert($reason!=='','발급 회수 사유를 입력해 주세요.');contract_workflow_store($id,'withdrawn',$user,$reason);
    }else throw new InvalidArgumentException('지원하지 않는 승인 작업입니다.');
    $q=$d->prepare('UPDATE hr_contracts SET revision=revision+1 WHERE id=?');$q->execute([$id]);contract_log($id,$user,$action,$snapshot);
}
