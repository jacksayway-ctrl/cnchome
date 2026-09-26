<?php
declare(strict_types=1);
function hr_today(): string { return (new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul')))->format('Y-m-d'); }
function hr_json(mixed $v): string { return json_encode($v,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR); }
function hr_day(string $s): bool { $d=DateTimeImmutable::createFromFormat('!Y-m-d',$s); return $d && $d->format('Y-m-d')===$s; }
function hr_assert(bool $ok,string $message): void { if(!$ok) throw new InvalidArgumentException($message); }
function hr_int(mixed $v,int $max=1000000000): int { hr_assert(is_int($v)&&$v>=0&&$v<=$max,'금액 또는 시간을 확인해 주세요.'); return $v; }
function hr_contract_end(string $start,string $term): string {
    hr_assert(hr_day($start),'계약 개시일을 입력해 주세요.');
    $d=new DateTimeImmutable($start);
    if($term==='week')return $d->modify('+6 days')->format('Y-m-d');
    $months=['month'=>1,'quarter'=>3,'year'=>12,'twoYears'=>24];
    hr_assert(isset($months[$term]),'계약 기간을 선택해 주세요.');
    $target=$d->modify('first day of this month')->modify('+'.$months[$term].' months');
    // Same day next period, minus one day. If that day is absent, use month end.
    $day=(int)$d->format('d');$last=(int)$target->format('t');
    return $day>$last?$target->format('Y-m-t'):$target->setDate((int)$target->format('Y'),(int)$target->format('m'),$day)->modify('-1 day')->format('Y-m-d');
}
function hr_profile(array $in): array {
    $p=[];
    foreach(['name'=>60,'phone'=>20,'email'=>120,'birthDate'=>10,'address'=>240,'addressDetail'=>240,'postcode'=>10,'team'=>20,'role'=>20,'startDate'=>10,'endDate'=>10,'employment'=>10,'workplace'=>240,'duties'=>240,'weeklyHoliday'=>5,'payType'=>10,'wageEffective'=>10,'bank'=>50,'accountNumber'=>40,'accountHolder'=>60,'contractStart'=>10,'contractEnd'=>10,'contractTerm'=>20,'contractType'=>20,'memo'=>1000] as $key=>$max){
        hr_assert(!isset($in[$key])||is_string($in[$key]),'입력 형식을 확인해 주세요.');
        $p[$key]=trim($in[$key]??''); hr_assert(mb_strlen($p[$key])<=$max,'입력 내용이 너무 깁니다: '.$key);
    }
    hr_assert($p['name']!==''&&preg_match('/^0[0-9 -]{8,14}$/D',$p['phone'])===1,'이름과 연락처를 입력해 주세요.');
    hr_assert(in_array($p['team'],['insurance','cosmetics','health'],true),'부서를 확인해 주세요.');
    hr_assert(in_array($p['role'],['상담원','팀장','관리자'],true),'직책을 확인해 주세요.');
    hr_assert(in_array($p['employment'],['재직','휴직','퇴사'],true)&&hr_day($p['startDate']),'입사일과 재직 상태를 확인해 주세요.');
    foreach(['birthDate','endDate','wageEffective','contractStart','contractEnd'] as $key)hr_assert($p[$key]===''||hr_day($p[$key]),'날짜를 확인해 주세요: '.$key);
    hr_assert(!$p['email']||filter_var($p['email'],FILTER_VALIDATE_EMAIL)!==false,'이메일을 확인해 주세요.');
    hr_assert($p['employment']!=='퇴사'||($p['endDate']!==''&&$p['endDate']>=$p['startDate']),'퇴사일을 확인해 주세요.');
    hr_assert(in_array($p['payType'],['시급제','월급제'],true),'급여 방식을 확인해 주세요.');
    $p['payAmount']=hr_int($in['payAmount']??15000);hr_assert($p['payAmount']>0,'기본 급여액은 0원보다 커야 합니다.');
    $p['workDays']=$in['workDays']??[];
    hr_assert(is_array($p['workDays'])&&count($p['workDays'])>0&&count(array_diff($p['workDays'],['월','화','수','목','금']))===0,'근무요일을 선택해 주세요.');
    hr_assert(in_array($p['weeklyHoliday'],['토','일'],true),'주휴일을 선택해 주세요.');
    hr_assert($p['accountNumber']===''||preg_match('/^[0-9 -]{6,40}$/D',$p['accountNumber'])===1,'계좌번호를 확인해 주세요.');
    hr_assert(in_array($p['contractType'],['기간제','무기계약'],true),'계약 구분을 확인해 주세요.');
    if($p['contractTerm']){$p['contractEnd']=hr_contract_end($p['contractStart'],$p['contractTerm']);$p['contractType']='기간제';}
    hr_assert($p['contractType']!=='기간제'||(hr_day($p['contractStart'])&&hr_day($p['contractEnd'])&&$p['contractEnd']>=$p['contractStart']),'계약 개시일과 종료일을 확인해 주세요.');
    if($p['contractType']==='무기계약')$p['contractEnd']='';
    return $p;
}
function hr_calculate(array $profile,array $input): array {
    $minutes=hr_int($input['minutes']??null,44640);
    $allowance=hr_int($input['allowance']??null);$deductions=hr_int($input['deductions']??null);
    $rate=hr_int($profile['payAmount']);
    $base=$profile['payType']==='월급제'?$rate:(int)round($rate*$minutes/60);
    hr_assert($deductions<=$base+$allowance,'공제액은 지급 총액을 초과할 수 없습니다.');
    $note=trim((string)($input['note']??''));hr_assert(mb_strlen($note)<=1000,'산정 메모는 1,000자까지 입력할 수 있습니다.');
    return ['payType'=>$profile['payType'],'rate'=>$rate,'minutes'=>$minutes,'base'=>$base,'allowance'=>$allowance,'deductions'=>$deductions,'gross'=>$base+$allowance,'net'=>$base+$allowance-$deductions,'note'=>$note];
}
function hr_can_change(array $row,string $action,bool $admin,string $today): bool {
    if($row['month']!==substr($today,0,7)||$row['status']==='confirmed')return false;
    if($admin)return ($action==='savePayroll'&&in_array($row['status'],['draft','requested'],true))||($action==='publish'&&$row['status']==='draft');
    return in_array($action,['confirm','request'],true)&&$row['status']==='published';
}
function hr_snapshot(array $u): array {
    $d=db();$admin=$u['role']==='admin';
    $q=$d->prepare('SELECT * FROM hr_employees'.($admin?'':' WHERE user_id=?').' ORDER BY id');$q->execute($admin?[]:[$u['id']]);
    $employees=array_map(function($r){return ['id'=>(int)$r['id'],'employeeNo'=>$r['employee_no'],'userId'=>$r['user_id']?(int)$r['user_id']:null,'revision'=>(int)$r['revision'],'profile'=>json_decode($r['profile'],true,512,JSON_THROW_ON_ERROR)];},$q->fetchAll());
    $q=$d->prepare('SELECT p.* FROM hr_payroll p JOIN hr_employees e ON e.id=p.employee_id'.($admin?'':' WHERE e.user_id=? AND p.published_snapshot IS NOT NULL')." ORDER BY (p.status='confirmed') DESC,p.confirmed_at DESC,p.month DESC,p.id DESC");$q->execute($admin?[]:[$u['id']]);
    $payroll=[];
    foreach($q->fetchAll() as $r){
        $r['id']=(int)$r['id'];$r['employee_id']=(int)$r['employee_id'];$r['revision']=(int)$r['revision'];
        $r['calculation']=json_decode($r['calculation'],true,512,JSON_THROW_ON_ERROR);$r['published_snapshot']=$r['published_snapshot']?json_decode($r['published_snapshot'],true,512,JSON_THROW_ON_ERROR):null;
        if(!$admin)$r['calculation']=$r['published_snapshot']['calculation'];
        $ev=$d->prepare('SELECT event,note,snapshot,created_at FROM hr_payroll_events WHERE payroll_id=? ORDER BY id DESC');$ev->execute([$r['id']]);
        $r['events']=array_values(array_filter($ev->fetchAll(),fn($e)=>$admin||$e['event']!=='savePayroll'));
        foreach($r['events'] as &$e)$e['snapshot']=$e['snapshot']?json_decode($e['snapshot'],true,512,JSON_THROW_ON_ERROR):null;unset($e);
        $payroll[]=$r;
    }
    $accounts=$admin?$d->query("SELECT id,username,display_name FROM app_users WHERE role='employee' AND active=1 AND id NOT IN (SELECT user_id FROM hr_employees WHERE user_id IS NOT NULL) ORDER BY display_name")->fetchAll():[];
    return ['employees'=>$employees,'payroll'=>$payroll,'accounts'=>$accounts,'today'=>hr_today()];
}

class HRForbidden extends RuntimeException {}
function hr_mutate(array $user,array $in): void {
    $action=$in['action']??'';$admin=$user['role']==='admin';
    if(!in_array($action,$admin?['saveStaff','savePayroll','publish']:['confirm','request'],true))throw new HRForbidden('처리 권한이 없습니다.');
    try {
    $d=db();$d->beginTransaction();
    if($action==='saveStaff'){
        $p=hr_profile($in['profile']??[]);$id=hr_int($in['id']??0);$existing=null;
        if($id){$q=$d->prepare('SELECT * FROM hr_employees WHERE id=? FOR UPDATE');$q->execute([$id]);$existing=$q->fetch();hr_assert((bool)$existing,'직원을 찾을 수 없습니다.');hr_assert((int)$existing['revision']===($in['revision']??null),'다른 창에서 변경했습니다. 새로고침해 주세요.');}
        $uid=$existing['user_id']??null;
        if(!$existing){
            $day=str_replace('-','',hr_today());
            $q=$d->prepare('INSERT INTO hr_employee_sequences(day,serial) VALUES(?,1) ON DUPLICATE KEY UPDATE serial=serial+1');$q->execute([$day]);
            $q=$d->prepare('SELECT serial FROM hr_employee_sequences WHERE day=? FOR UPDATE');$q->execute([$day]);$seq=(int)$q->fetchColumn();
            $no='cnc'.$day.str_pad((string)$seq,3,'0',STR_PAD_LEFT);
        }else $no=$existing['employee_no'];
        if(!$uid && !empty($in['accountId'])){
            $accountId=hr_int($in['accountId']);$q=$d->prepare("SELECT id FROM app_users WHERE id=? AND role='employee' AND active=1 FOR UPDATE");$q->execute([$accountId]);hr_assert((bool)$q->fetch(),'연결할 직원 계정을 확인해 주세요.');
            $q=$d->prepare('SELECT id FROM hr_employees WHERE user_id=?');$q->execute([$accountId]);hr_assert(!$q->fetch(),'이미 연결된 계정입니다.');$uid=$accountId;
        }
        if(!$uid&&!empty($in['password'])){
            $pass=$in['password'];hr_assert(is_string($pass)&&strlen($pass)>=12&&strlen($pass)<=72,'새 직원 비밀번호는 12~72바이트로 입력해 주세요.');
            $q=$d->prepare("INSERT INTO app_users(username,display_name,password_hash,role,department) VALUES(?,?,?,'employee',?)");$q->execute([$no,$p['name'],password_hash($pass,PASSWORD_DEFAULT),$p['team']]);$uid=(int)$d->lastInsertId();
        }
        if($uid){$q=$d->prepare("UPDATE app_users SET display_name=?,department=? WHERE id=? AND role='employee'");$q->execute([$p['name'],$p['team'],$uid]);}
        if($existing){$q=$d->prepare('UPDATE hr_employees SET user_id=?,profile=?,revision=revision+1 WHERE id=?');$q->execute([$uid,hr_json($p),$id]);}
        else {$q=$d->prepare('INSERT INTO hr_employees(employee_no,user_id,profile) VALUES(?,?,?)');$q->execute([$no,$uid,hr_json($p)]);}
    }else{
        $id=hr_int($in['id']??0);$row=null;
        if($id){$q=$d->prepare('SELECT p.*,e.user_id,e.profile,e.employee_no FROM hr_payroll p JOIN hr_employees e ON e.id=p.employee_id WHERE p.id=? FOR UPDATE');$q->execute([$id]);$row=$q->fetch();hr_assert((bool)$row,'급여 내역을 찾을 수 없습니다.');
            if(!$admin&&(int)$row['user_id']!==(int)$user['id']){throw new HRForbidden('본인 급여만 확인할 수 있습니다.');}
            hr_assert((int)$row['revision']===($in['revision']??null),'내역이 변경됐습니다. 새로고침 후 확인해 주세요.');
            hr_assert(hr_can_change($row,$action,$admin,hr_today()),'확정·지난달 기록 또는 현재 상태에서는 수정할 수 없습니다.');
        }else hr_assert($action==='savePayroll','급여 내역을 선택해 주세요.');
        $eventSnapshot=null;$note=trim((string)($in['note']??''));hr_assert(mb_strlen($note)<=1000,'메모는 1,000자까지 입력해 주세요.');
        if($action==='savePayroll'){
            if(!$row){
                $employee=hr_int($in['employeeId']??null);$month=$in['month']??'';hr_assert($month===substr(hr_today(),0,7),'이번 달 급여만 작성할 수 있습니다.');
                $q=$d->prepare('SELECT profile,user_id FROM hr_employees WHERE id=? FOR UPDATE');$q->execute([$employee]);$emp=$q->fetch();hr_assert((bool)$emp,'직원을 선택해 주세요.');$profile=json_decode($emp['profile'],true,512,JSON_THROW_ON_ERROR);
            }else{$employee=(int)$row['employee_id'];$month=$row['month'];$profile=json_decode($row['profile'],true,512,JSON_THROW_ON_ERROR);}
            $calc=hr_calculate($profile,$in['calculation']??[]);$eventSnapshot=['calculation'=>$calc];
            if(!$row){$q=$d->prepare('INSERT INTO hr_payroll(employee_id,month,calculation) VALUES(?,?,?)');$q->execute([$employee,$month,hr_json($calc)]);$id=(int)$d->lastInsertId();}
            else {$q=$d->prepare("UPDATE hr_payroll SET calculation=?,status='draft',revision=revision+1 WHERE id=?");$q->execute([hr_json($calc),$id]);}
        }elseif($action==='publish'){
            hr_assert(!empty($row['user_id']),'먼저 직원 정보에 로그인 계정을 연결해 주세요.');$p=json_decode($row['profile'],true,512,JSON_THROW_ON_ERROR);
            $eventSnapshot=['name'=>$p['name'],'employeeNo'=>$row['employee_no'],'month'=>$row['month'],'calculation'=>json_decode($row['calculation'],true,512,JSON_THROW_ON_ERROR),'bank'=>$p['bank'],'accountNumber'=>$p['accountNumber'],'accountHolder'=>$p['accountHolder']];
            $q=$d->prepare("UPDATE hr_payroll SET status='published',published_snapshot=?,published_at=UTC_TIMESTAMP(6),revision=revision+1 WHERE id=?");$q->execute([hr_json($eventSnapshot),$id]);
        }elseif($action==='request'){
            hr_assert($note!=='','수정요청 메모를 입력해 주세요.');$q=$d->prepare("UPDATE hr_payroll SET status='requested',revision=revision+1 WHERE id=?");$q->execute([$id]);
        }elseif($action==='confirm'){
            hr_assert(($in['reviewed']??false)===true,'명세서 확인 항목을 체크해 주세요.');
            $q=$d->prepare("UPDATE hr_payroll SET status='confirmed',confirmed_at=UTC_TIMESTAMP(6),revision=revision+1 WHERE id=?");$q->execute([$id]);
        }
        $q=$d->prepare('INSERT INTO hr_payroll_events(payroll_id,actor_id,event,note,snapshot) VALUES(?,?,?,?,?)');$q->execute([$id,$user['id'],$action,$note,$eventSnapshot?hr_json($eventSnapshot):null]);
    }
    $d->commit();
    }catch(Throwable $e){if(isset($d)&&$d->inTransaction())$d->rollBack();throw $e;}
}
