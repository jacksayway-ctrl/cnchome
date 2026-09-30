<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';

function attendance_now(?DateTimeImmutable $now=null): DateTimeImmutable {
    return ($now??new DateTimeImmutable('now'))->setTimezone(new DateTimeZone('Asia/Seoul'));
}
function attendance_authorize(array $user,bool $write=false): void {
    if(!in_array($user['role']??'',['employee','admin'],true)||($write&&$user['role']!=='employee'))throw new HRForbidden('출근 기록 권한이 없습니다.');
}
function attendance_check_in(array $user,?DateTimeImmutable $now=null): void {
    attendance_authorize($user,true);$now=attendance_now($now);$day=$now->format('Y-m-d');
    $start=$now->setTime(10,0,0);$effective=$now<$start?$start:$now;
    $d=db();$d->beginTransaction();
    try{
        // Lock the owner, including the first check-in, to serialize separate browser sessions.
        $q=$d->prepare("SELECT id FROM app_users WHERE id=? AND role='employee' AND active=1 FOR UPDATE");$q->execute([$user['id']]);
        if(!$q->fetchColumn())throw new HRForbidden('출근 기록 권한이 없습니다.');
        $q=$d->prepare('SELECT work_date FROM employee_checkins WHERE user_id=? AND work_date=?');$q->execute([$user['id'],$day]);
        if(!$q->fetchColumn()){
            $q=$d->prepare('INSERT INTO employee_checkins(user_id,work_date,check_in_at) VALUES(?,?,?)');
            $q->execute([$user['id'],$day,$effective->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u')]);
        }
        $d->commit();
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
function attendance_mutate(array $user,array $in,?DateTimeImmutable $now=null): void {
    attendance_authorize($user,true);
    hr_assert(($in['action']??'')==='checkIn'&&array_diff(array_keys($in),['action'])===[],'출근 버튼으로 다시 기록해 주세요.');
    attendance_check_in($user,$now);
}
function attendance_snapshot(array $user,mixed $date=null,?DateTimeImmutable $now=null): array {
    attendance_authorize($user);$today=attendance_now($now)->format('Y-m-d');$d=db();
    if($user['role']==='employee'){
        // Do not select or serialize timestamps for employees, even on a forged admin/date query.
        $q=$d->prepare('SELECT work_date FROM employee_checkins WHERE user_id=? ORDER BY work_date DESC');$q->execute([$user['id']]);
        $days=$q->fetchAll(PDO::FETCH_COLUMN);
        return ['today'=>$today,'checkedIn'=>in_array($today,$days,true),'records'=>array_map(fn($day)=>['date'=>$day,'status'=>'출근 완료'],$days)];
    }
    $date=$date??$today;hr_assert(is_string($date)&&hr_day($date),'조회 날짜를 확인해 주세요.');
    $q=$d->prepare("SELECT u.id,u.username,u.display_name,u.department,c.work_date,c.check_in_at FROM app_users u LEFT JOIN employee_checkins c ON c.user_id=u.id AND c.work_date=? WHERE u.role='employee' AND (u.active=1 OR c.work_date IS NOT NULL) ORDER BY u.display_name,u.id");$q->execute([$date]);$rows=[];
    foreach($q->fetchAll() as $row)$rows[]=['employeeId'=>(int)$row['id'],'employee'=>$row['display_name'],'team'=>$row['department'],'date'=>$date,'checkedIn'=>$row['check_in_at']!==null,'checkInTime'=>$row['check_in_at']===null?'':(new DateTimeImmutable($row['check_in_at'],new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Seoul'))->format('H:i'),'isTest'=>cnc_test_user($row+['role'=>'employee'])];
    return ['today'=>$today,'date'=>$date,'records'=>$rows];
}
function attendance_test_public_state(array $state): array {
    $state['attendance']=array_map(function($row){
        $checkedIn=!empty($row['in']);$status=$checkedIn?'출근 완료':'미등록';
        foreach(['병가','휴가','결근','조퇴','외출'] as $label)if(str_contains((string)($row['status']??''),$label)){$status=$label;break;}
        return ['date'=>$row['date'],'status'=>$status.' (테스트)','checkedIn'=>$checkedIn];
    },$state['attendance']??[]);
    return $state;
}
