<?php
// Pure guard checks: no bootstrap, database connection or live records are loaded.
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/delete-test-staff-345.php';
function dts345_check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
foreach([3,4,5] as $n){
    $profile=['name'=>'테스트 직원 '.$n,'team'=>'insurance','memo'=>'삭제 가능한 가상 직원. 실제 근로·급여 지급 대상이 아닙니다.'];
    // Deliberately different IDs verify that account IDs are not employee IDs.
    $employee=['id'=>$n,'employee_no'=>'cncTEST20260929'.$n,'user_id'=>$n+20,'profile'=>hr_json($profile)];
    $account=['id'=>$n+20,'username'=>'user'.$n,'display_name'=>$profile['name'],'role'=>'employee','department'=>'insurance','active'=>0];
    $fixture=['username'=>'user'.$n,'employeeId'=>$n,'userId'=>$n+20];
    dts345_check(dts345_identity($employee,$account,$fixture,$n),'original suspended fixture must match');
    dts345_check(!dts345_identity($employee,array_replace($account,['active'=>1]),$fixture,$n),'active account must be preserved');
    dts345_check(!dts345_identity($employee,array_replace($account,['role'=>'admin']),$fixture,$n),'admin account must be preserved');
    dts345_check(!dts345_identity($employee,$account,array_replace($fixture,['userId'=>$n]),$n),'mismatched seed account must be preserved');
    dts345_check(!dts345_identity(array_replace($employee,['profile'=>hr_json(array_replace($profile,['name'=>'실제 직원']))]),$account,$fixture,$n),'renamed employee must be preserved');
    dts345_check(!dts345_identity(array_replace($employee,['employee_no'=>'REUSED']),$account,$fixture,$n),'reused employee ID must be preserved');
    dts345_check(!dts345_identity($employee,$account,$fixture,6),'employee six is never in scope');
}
$note='[테스트] 기능 점검용 가상 급여. 실제 지급·약정·승인이 아닙니다.';
$attendance=['date'=>'2026-09-29','in'=>'10:00','out'=>'17:00','fixture'=>'test-full-attendance-grade-20260930-v3','status'=>'만근 (테스트)'];
dts345_check(dts345_synthetic_attendance($attendance),'known refreshed fixture attendance is recognized');
dts345_check(!dts345_synthetic_attendance(array_replace($attendance,['fixture'=>'manual'])),'native attendance must be preserved');
$event=['event'=>'publish','note'=>'시스템: 임시 명세서 기본급·주휴 구분 표시 (총액 유지)','snapshot'=>hr_json(['calculation'=>['note'=>$note]])];
dts345_check(dts345_synthetic_payroll_event($event),'known fixture display migration is recognized');
dts345_check(!dts345_synthetic_payroll_event(array_replace($event,['snapshot'=>hr_json(['calculation'=>['note'=>'실제 급여']])])),'real payroll event must be preserved');
$payroll=['status'=>'published','confirmed_at'=>null,'calculation'=>hr_json(['note'=>$note]),'published_snapshot'=>hr_json(['calculation'=>['note'=>$note]])];
dts345_check(dts345_synthetic_payroll($payroll),'unconfirmed fixture payroll is recognized');
dts345_check(!dts345_synthetic_payroll(array_replace($payroll,['status'=>'confirmed'])),'confirmed payroll must be preserved');
dts345_check(!dts345_synthetic_payroll(array_replace($payroll,['confirmed_at'=>'2026-10-03'])),'confirmation timestamp must be preserved');
dts345_check(!dts345_synthetic_payroll(array_replace($payroll,['calculation'=>hr_json(['note'=>'실제 급여'])])),'actual payroll must be preserved');
dts345_check(!dts345_synthetic_payroll(array_replace($payroll,['published_snapshot'=>hr_json(['calculation'=>['note'=>'다른 명세서']])])),'changed published snapshot must be preserved');
$terms=['extraTerms'=>'기능 점검용 가상 계약서이며 실제 근로계약·서명·동의가 아닙니다.','employerName'=>'씨앤씨(가상 점검용)'];
$contract=['status'=>'issued','received_at'=>null,'received_by'=>null,'terms'=>hr_json($terms),'issued_snapshot'=>hr_json(['terms'=>$terms])];
dts345_check(dts345_synthetic_contract($contract),'unreceived fixture contract is recognized');
dts345_check(!dts345_synthetic_contract(array_replace($contract,['status'=>'received'])),'received contract must be preserved');
dts345_check(!dts345_synthetic_contract(array_replace($contract,['received_by'=>123])),'recipient acceptance must be preserved');
dts345_check(!dts345_synthetic_contract(array_replace($contract,['terms'=>'{}'])),'real or edited contract must be preserved');
dts345_check(!dts345_synthetic_contract(array_replace($contract,['issued_snapshot'=>'invalid json'])),'invalid snapshot must fail closed');
echo "PASS: test staff 3/4/5 identity guards, employee six exclusion and protected payroll/contract states.\n";
