<?php
// Isolated in-memory fixture only; never connects to the production database.
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require __DIR__.'/check-sales.php';
require __DIR__.'/../lib/intake-management.php';
$d->exec('CREATE TABLE intake_management_events(id INTEGER PRIMARY KEY AUTOINCREMENT,record_key TEXT,actor_id INTEGER REFERENCES app_users(id),action TEXT,before_data TEXT,after_data TEXT,reason TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
// A historical receipt proves classification uses its original year, not today's year.
$birthEditKey='91919191-aaaa-bbbb-cccc-010101010101';
sales_mutate($admin,['action'=>'create','employeeId'=>2,'date'=>'2020-06-01','customer'=>'생일 정정 검증 고객','phone'=>'010-9191-0101','birthYear'=>1961,'carrier'=>'한화','note'=>'한화','counselorName'=>'보험 직원','requestKey'=>$birthEditKey]);
$q=$d->prepare('SELECT id FROM sales_records WHERE request_key=?');$q->execute([$birthEditKey]);$birthEditId=(string)$q->fetchColumn();
$birthEditRecord=fn()=>array_column(sales_snapshot($admin,'2020-06')['records'],null,'id')[$birthEditId];
$birthEditInput=function()use($birthEditRecord):array{
    $r=$birthEditRecord();$in=['action'=>'edit','id'=>$r['id'],'revision'=>$r['revision']];
    foreach(['customer','phone','carrier','note','consultationTime','consultationPlace','premiumBand','counselorName','gender','callAvailability','visitSchedule','status'] as $key)$in[$key]=$r[$key];
    return $in;
};
$birthEditState=function()use($d,$birthEditId,$birthEditRecord):array{
    $q=$d->prepare('SELECT birth_date FROM sales_birth_details WHERE sale_id=?');$q->execute([$birthEditId]);$dates=$q->fetchAll();
    $q=$d->prepare('SELECT action,before_data,after_data,reason FROM intake_management_events WHERE record_key=? ORDER BY id');$q->execute([$birthEditId]);
    return ['record'=>$birthEditRecord(),'dates'=>$dates,'events'=>$q->fetchAll()];
};
$original=$birthEditRecord();check($original['birthDate']===''&&$original['birthYear']===1961&&$original['kind']==='general','fixture begins as a year-only age-60 historical receipt');
rejects(fn()=>intake_update($admin,$birthEditInput()),'omitted birthday with unchanged fields is still a no-op');
rejects(fn()=>intake_update($admin,$birthEditInput()+['birthDate'=>'','birthYear'=>'2000']),'empty year-only birthday cannot fake an edit or replace the original year');
intake_update($admin,array_replace($birthEditInput(),['birthDate'=>'','birthYear'=>'2000','note'=>'생일 미입력 유지']));
$preserved=$birthEditRecord();check($preserved['birthDate']===''&&$preserved['birthYear']===1961&&$preserved['kind']==='general'&&$birthEditState()['dates']===[],'explicit empty birthday preserves year-only records without fabricating a detail row');

// Fail after the birth detail insertion: record, new detail and audit must all roll back.
$beforeInsert=$birthEditState();
try{intake_update(['id'=>999,'role'=>'admin'],$birthEditInput()+['birthDate'=>'1960-02-29']);throw new RuntimeException('Expected audit failure');}catch(PDOException $e){}
check($birthEditState()===$beforeInsert,'audit failure rolls back the new birthday detail, derived kind and revision');
$birthOnly=$birthEditInput()+['birthDate'=>'1960-02-29','birthYear'=>'2000','employeeId'=>'3','date'=>'2026-10-01'];
rejects(fn()=>intake_update($one,$birthOnly),'employee cannot use administrator birth editing');
intake_update($admin,$birthOnly);$silver=$birthEditRecord();
check($silver['birthDate']==='1960-02-29'&&$silver['birthYear']===1960&&$silver['kind']==='silver','valid leap birthday supplies birth year and changes age 60 to age 61 silver');
check($silver['employeeId']===$original['employeeId']&&$silver['date']===$original['date']&&$silver['revision']===$preserved['revision']+1,'birth-only edit increments once without changing owner or original date');
$birthEvents=$birthEditState()['events'];$birthEvent=$birthEvents[count($birthEvents)-1];$birthBefore=json_decode($birthEvent['before_data'],true,512,JSON_THROW_ON_ERROR);$birthAfter=json_decode($birthEvent['after_data'],true,512,JSON_THROW_ON_ERROR);
check($birthEvent['action']==='edit'&&$birthBefore['birth_date']===''&&$birthBefore['birth_year']===1961&&$birthBefore['insurance_kind']==='general'&&$birthAfter['birth_date']==='1960-02-29'&&$birthAfter['birth_year']===1960&&$birthAfter['insurance_kind']==='silver','edit audit contains original and corrected birthday, birth year and insurance kind');
$stable=$birthEditState();
rejects(fn()=>intake_update($admin,$birthOnly),'stale birthday cannot overwrite a newer receipt');
rejects(fn()=>intake_update($admin,$birthEditInput()+['birthDate'=>'1960-02-29']),'same complete birthday is a no-op');
foreach(['','1961-02-29','1960-02-30','1960-2-29','1960-13-01','1899-01-01','1949-01-01','2020-06-02','2021-01-01',null,[]] as $invalidBirth)rejects(fn()=>intake_update($admin,$birthEditInput()+['birthDate'=>$invalidBirth]),'invalid, cleared, future or over-age birthday is rejected');
check($birthEditState()===$stable&&!$d->inTransaction(),'invalid, stale and no-op birthday edits preserve all data and audit history');

// Missing birthday in an older form must preserve the full stored date and its classification.
intake_update($admin,array_replace($birthEditInput(),['note'=>'기존 양식의 내용 수정']));$omitted=$birthEditRecord();
check($omitted['birthDate']===$silver['birthDate']&&$omitted['birthYear']===$silver['birthYear']&&$omitted['kind']===$silver['kind'],'legacy form omitting birthday retains the full birthday and classification');
intake_update($admin,$birthEditInput()+['birthDate'=>'1961-02-28']);$general=$birthEditRecord();
check($general['birthDate']==='1961-02-28'&&$general['birthYear']===1961&&$general['kind']==='general','corrected birthday recomputes general classification using original receipt year');
intake_update($admin,$birthEditInput()+['birthDate'=>'1961-03-01']);$dayChanged=$birthEditRecord();
check($dayChanged['birthDate']==='1961-03-01'&&$dayChanged['birthYear']===1961&&$dayChanged['kind']==='general'&&$dayChanged['revision']===$general['revision']+1&&count($birthEditState()['dates'])===1,'month/day-only correction updates the existing birth row and counts as one real change');

// A late status-audit failure must also roll back birthday and detail changes together.
$rollbackBefore=$birthEditState();
$d->exec("CREATE TRIGGER fail_birth_status_audit BEFORE INSERT ON intake_management_events WHEN NEW.action='status' BEGIN SELECT RAISE(ABORT,'birth status audit fixture'); END");
try{intake_update($admin,array_replace($birthEditInput(),['birthDate'=>'1960-02-29','status'=>'normal','counselorName'=>'화장품 직원']));throw new RuntimeException('Expected status audit failure');}catch(PDOException $e){}
$d->exec('DROP TRIGGER fail_birth_status_audit');
check($birthEditState()===$rollbackBefore&&!$d->inTransaction(),'second audit failure rolls back birthday, year, kind, counselor, status, revision and earlier audit');
echo "PASS: administrator birth-only edits, full date validation, immutable owner/date, historical age classification, year-only compatibility, audit details, stale/no-op guards and atomic birth-detail rollback.\n";

// Explicit administrator product choice survives later edits with no radio selected.
intake_update($admin,$birthEditInput()+['insuranceKind'=>'silver']);
check($birthEditRecord()['kind']==='silver','administrator can select silver without changing birthday');
intake_update($admin,array_replace($birthEditInput(),['birthDate'=>$birthEditRecord()['birthDate'],'note'=>'분류 유지 확인']));
check($birthEditRecord()['kind']==='silver','unselected product keeps stored classification on subsequent edits');
rejects(fn()=>intake_update($admin,$birthEditInput()+['insuranceKind'=>'other']),'invalid manual product rejected');
intake_update($admin,$birthEditInput()+['insuranceKind'=>'general']);
check($birthEditRecord()['kind']==='general','administrator can select general explicitly');
echo "PASS: explicit product selection, omitted-choice preservation and invalid product rejection.\n";
