<?php
// In-memory database only. Reuse the proven sales fixture and its role checks.
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require __DIR__.'/check-sales.php';
require __DIR__.'/../lib/intake-management.php';
require __DIR__.'/../lib/native.php';
$d->exec("ALTER TABLE sales_events ADD COLUMN created_at TEXT DEFAULT '';
UPDATE sales_events SET created_at='2026-09-01 00:00:00';
CREATE TABLE intake_management_events(id INTEGER PRIMARY KEY AUTOINCREMENT,record_key TEXT,actor_id INTEGER REFERENCES app_users(id),action TEXT,before_data TEXT,after_data TEXT,reason TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);");
$row=$d->query('SELECT * FROM sales_records WHERE id=1')->fetch();$revision=(int)$row['revision'];
rejects(fn()=>intake_update($one,['action'=>'status','id'=>'1','revision'=>$revision,'status'=>'as']),'employees cannot enter intake administration');
intake_update($admin,['action'=>'status','id'=>'1','revision'=>$revision,'status'=>'as','reason'=>'내용 확인 필요']);
check($d->query('SELECT status FROM sales_records WHERE id=1')->fetchColumn()==='as','admin state updates shared sales record');
check((int)$d->query('SELECT count(*) FROM intake_management_events')->fetchColumn()===1,'state audit recorded');
rejects(fn()=>intake_update($admin,['action'=>'status','id'=>'1','revision'=>$revision,'status'=>'normal']),'stale status rejected');
$edit=['action'=>'edit','id'=>'1','revision'=>$revision+1,'status'=>'as','customer'=>'<script>alert(1)</script>','phone'=>'010-1234-5678','carrier'=>'GA','note'=>'확인한 상담 내용','consultationTime'=>'16:40','consultationPlace'=>'경기도 이천시','premiumBand'=>'300000','reason'=>'고객 요청 정정'];
intake_update($admin,$edit);
$saved=$d->query('SELECT * FROM sales_records WHERE id=1')->fetch();
check($saved['customer_name']===$edit['customer']&&$saved['employee_id']===$row['employee_id']&&$saved['first_date']===$row['first_date'],'editable fields change without shifting owner/date');
check($d->query('SELECT consultation_place FROM sales_consultation_details WHERE sale_id=1')->fetchColumn()==='경기도 이천시','consultation changes persist');
check(sales_counselor_fields(1)['counselorName']==='변경 상담원','other administrator edits preserve the stored counselor');
$events=intake_history($admin,'1');check(count($events)>=3&&in_array('edit',array_column($events,'action'),true),'old creation/state history and new edits coexist');
$bad=$edit;$bad['revision']=$revision+2;$bad['phone']='bad-phone';rejects(fn()=>intake_update($admin,$bad),'invalid phone rejected');
// Audit insertion failure must roll the state change back.
try{intake_update(['id'=>999,'role'=>'admin'],['action'=>'status','id'=>'1','revision'=>$revision+2,'status'=>'normal']);throw new RuntimeException('Expected audit failure');}catch(PDOException $e){}
check($d->query('SELECT status FROM sales_records WHERE id=1')->fetchColumn()==='as','audit failure rolls back status change');
$legacy=$d->query('SELECT revision FROM test_employee_data WHERE user_id=4')->fetchColumn();
intake_update($admin,['action'=>'status','id'=>'test:4:1','revision'=>(int)$legacy,'status'=>'as','reason'=>'테스트 처리']);
check(count(intake_history($admin,'test:4:1'))===1,'legacy test status changes are audited');
$filters=intake_filters(['month'=>$month,'scope'=>'real','q'=>'01012345678']);$snapshot=sales_snapshot($admin,$month);$filtered=intake_filtered($snapshot['records'],$filters);
check(in_array('1',array_column($filtered,'id'),true),'phone search ignores hyphens');
check(count(array_filter($filtered,fn($r)=>$r['isTest']))===0,'test rows stay out of real scope');
check(count(intake_filtered($snapshot['records'],intake_filters(['month'=>$month,'scope'=>'test'])))>0,'test records remain accessible separately');
rejects(fn()=>intake_filters(['month'=>$month,'from'=>'2000-01-01']),'date filter cannot silently cross month');
check(intake_csv_cell('=HYPERLINK("bad")')[0]==="'"&&intake_csv_cell("\t+123")[0]==="'",'CSV export blocks formula injection');
$created=intake_create($admin,['employeeId'=>'2','date'=>$today,'customer'=>'관리자 접수','phone'=>'010-9999-8888','birthDate'=>'1990-01-01','requestKey'=>'11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
$retry=intake_create($admin,['employeeId'=>'2','date'=>$today,'customer'=>'관리자 접수','phone'=>'010-9999-8888','birthDate'=>'1990-01-01','requestKey'=>'11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
check($created['id']===$retry['id'],'native registration is retry-safe');
// Render the actual detail page with untrusted customer text.
$snapshot=sales_snapshot($admin,$month);$rows=intake_filtered($snapshot['records'],$filters);$list=$rows;$selected=array_values(array_filter($snapshot['records'],fn($r)=>$r['id']==='1'))[0];
$user=$admin;$mode='list';$error='';$notice='';$posted=[];$total=count($rows);$pages=1;$testCount=1;$counts=['pending'=>0,'normal'=>0,'as'=>1];$history=intake_history($admin,'1');$_SESSION=['csrf'=>'fixture-token'];
ob_start();require __DIR__.'/../views/intake.php';$html=ob_get_clean();
check(!str_contains($html,'<script>alert(1)</script>')&&str_contains($html,'&lt;script&gt;'),'customer text escaped in list and detail');
preg_match('/<template data-intake-edit-data>(.*?)<\/template>/s',$html,$editDataMatch);
$editBoot=json_decode(html_entity_decode($editDataMatch[1]??'',ENT_QUOTES|ENT_HTML5,'UTF-8'),true,512,JSON_THROW_ON_ERROR);
check(($editBoot['record']['premiumBand']??'')==='300000','stored premium band reaches the shared receipt editor unchanged');
check(str_contains($html,'fixture-token')&&str_contains($html,'name="revision"'),'mutations carry CSRF and revision');
check(str_contains($html,'<th>상담원</th>')&&str_contains($html,'data-intake-id="1"')&&str_contains($html,'data-intake-toggle aria-expanded="true"')&&str_contains($html,'id="intake-detail-1" data-intake-detail data-intake-loaded="true"'),'selected receipt stays expanded beneath its searchable table row with counselor column');
check(substr_count($html,'data-intake-edit-host')===1&&str_contains($html,'<template data-intake-edit-hidden>')&&str_contains($html,'name="action" value="edit"')&&($editBoot['record']['status']??'')==='as'&&($editBoot['record']['counselorName']??'')==='변경 상담원','one guarded shared receipt editor receives the selected counselor and approval status');
check(($editBoot['record']['customer']??'')===$selected['customer']&&str_contains($html,'admin-intake-edit.js')&&str_contains($html,'consultation-location.js')&&str_contains($html,'<th>상품 구분</th>'),'shared editor retains untrusted text as data and loads address search with product classification');
$detailFragment=true;ob_start();require __DIR__.'/../views/intake.php';$fragmentHtml=ob_get_clean();$detailFragment=false;
check(str_contains($fragmentHtml,'data-intake-detail-panel data-intake-record="1"')&&!str_contains($fragmentHtml,'<script')&&!str_contains($fragmentHtml,'data-intake-row')&&!str_contains($fragmentHtml,'접수 목록'),'lazy detail response contains only the requested receipt panel without page scripts or list');
check(str_contains($fragmentHtml,'&lt;script&gt;')&&str_contains($fragmentHtml,'fixture-token')&&str_contains($fragmentHtml,'name="revision"')&&str_contains($fragmentHtml,'name="id" value="1"'),'lazy detail keeps escaped customer text and exact record, CSRF and revision guards');
// Registration uses the same receipt renderer and scoped staff identity data.
$mode='new';$registrationData=['user'=>['id'=>1,'role'=>'admin','display_name'=>'관리자'],'csrf'=>'fixture-token','staff'=>$snapshot['staff'],'counselorNames'=>$snapshot['counselorNames'],'listUrl'=>intake_url(),'employeeId'=>'2'];
ob_start();require __DIR__.'/../views/intake.php';$registrationHtml=ob_get_clean();$mode='list';
check(str_contains($registrationHtml,'id="admin-intake-register-data"')&&str_contains($registrationHtml,'data-admin-receipt')&&str_contains($registrationHtml,'admin-intake-register.js')&&!str_contains($registrationHtml,'data-intake-create'),'native registration mounts the shared employee receipt with administrator staff selection');
echo "PASS: intake admin authorization, shared status, edits, atomic audit, stale writes, test isolation, filters, CSV safety, registration retry and rendered escaping.\n";

require __DIR__.'/../lib/intake-alerts.php';
$pending=$d->query('SELECT * FROM sales_records WHERE id='.(int)$created['id'])->fetch();
intake_update($admin,['action'=>'hold','id'=>(string)$pending['id'],'revision'=>(int)$pending['revision'],'status'=>'pending','reason'=>'고객 연락 대기']);
check($d->query('SELECT status FROM sales_records WHERE id='.(int)$pending['id'])->fetchColumn()==='pending','hold preserves pending status');
rejects(fn()=>intake_update($admin,['action'=>'hold','id'=>(string)$pending['id'],'revision'=>(int)$pending['revision'],'status'=>'pending']),'stale hold rejected');
$queue=intake_alert_snapshot($admin,intake_alert_filters(['scope'=>'real','review'=>'held']));
check(in_array((string)$pending['id'],array_column($queue['rows'],'id'),true),'held intake appears in classified queue');
$unheld=intake_alert_snapshot($admin,intake_alert_filters(['scope'=>'real','review'=>'new']));check(!in_array((string)$pending['id'],array_column($unheld['rows'],'id'),true),'held item excluded from unreviewed queue');
$lastMonth=(new DateTimeImmutable($month.'-01'))->modify('-1 day')->format('Y-m-d');$d->prepare('UPDATE sales_records SET first_date=? WHERE id=?')->execute([$lastMonth,$pending['id']]);
$queue=intake_alert_snapshot($admin,intake_alert_filters(['scope'=>'real']));check(in_array((string)$pending['id'],array_column($queue['rows'],'id'),true),'previous month pending stays in live queue');
$newest=intake_alert_snapshot($admin,intake_alert_filters(['scope'=>'all','order'=>'newest']));$oldest=intake_alert_snapshot($admin,intake_alert_filters(['scope'=>'all','order'=>'oldest']));
check(array_column($newest['rows'],'id')===array_reverse(array_column($oldest['rows'],'id')),'queue sorting is reversible');
try{intake_alert_snapshot($one,intake_alert_filters([]));throw new RuntimeException('employee queue allowed');}catch(HRForbidden $e){}
$f=intake_alert_filters(['scope'=>'all']);$data=$newest;ob_start();require __DIR__.'/../views/partials/intake-alert-list.php';$queueHtml=ob_get_clean();
check(str_contains($queueHtml,'data-intake-window')&&str_contains($queueHtml,'popup=1'),'queue opens detailed intake in separate window');
echo "PASS: realtime queue role isolation, all-month coverage, both sort orders and audited pending holds.\n";

// The recall workflow is verified only against this isolated in-memory fixture.
$recallId=(string)$pending['id'];$baseNote=str_repeat('기존 메모 ',80);$d->prepare('UPDATE sales_records SET note=?,carrier=? WHERE id=?')->execute([$baseNote,'GA',$recallId]);
$addRecall=function(string $key,string $action,string $memo,string $carrier='한화')use($d,$one,$lastMonth):int{
    $d->prepare('UPDATE sales_records SET revision=revision+1 WHERE id=?')->execute([$key]);
    intake_audit($key,$one,$action,['status'=>'pending'],['status'=>'pending','carrier'=>$carrier,'date'=>$lastMonth],$memo);return (int)$d->lastInsertId();
};
$firstRequest=$addRecall($recallId,'resubmit','기존 재접수 메모');
$currentRequest=$addRecall($recallId,'recall','<script>재콜 메모</script>');
$addRecall($recallId,'memo','재콜 이후 추가 메모','');
$recallFilters=intake_filters(['month'=>$month,'scope'=>'real','status'=>'normal','from'=>$today,'to'=>$today]);
$recallQueue=intake_recall_queue($admin,$recallFilters);$recallRow=array_values(array_filter($recallQueue,fn($r)=>$r['id']===$recallId))[0]??null;
check($recallRow!==null&&$recallRow['date']===$lastMonth,'recall queue includes previous month and ignores monthly date/status restriction');
check((int)$recallRow['recall']['id']===$currentRequest&&$recallRow['recall']['carrier']==='한화','latest recall replaces earlier request and survives a later memo');
check($recallRow['note']===$baseNote,'appended recall notes preserve the original full note');
check(intake_recall_queue($admin,array_replace($recallFilters,['employee'=>'3']))===[],'recall queue respects employee filter');
check(intake_recall_queue($admin,array_replace($recallFilters,['team'=>'cosmetics']))===[],'recall queue respects department filter');
check(intake_recall_queue($admin,array_replace($recallFilters,['scope'=>'test']))===[],'real recall is excluded from test scope');
check(isset(intake_outstanding_recalls([$recallId])[$recallId])&&intake_outstanding_recalls([])===[],'employee request flags use the same outstanding-event rule and empty scope stays empty');
rejects(fn()=>intake_recall_queue($one,$recallFilters),'employee cannot read administrator recall queue');
$revision=(int)$recallRow['revision'];
rejects(fn()=>intake_update($admin,['id'=>$recallId,'revision'=>$revision,'action'=>'status','status'=>'normal','recallEventId'=>$firstRequest]),'superseded recall rejected with current record revision');
rejects(fn()=>intake_update($one,['id'=>$recallId,'revision'=>$revision,'action'=>'status','status'=>'normal','recallEventId'=>$currentRequest]),'employee cannot approve recall');
// Render the populated queue: notes must be escaped and mutation guards must be present.
ob_start();require __DIR__.'/../views/intake.php';$recallHtml=ob_get_clean();
check(str_contains($recallHtml,'정상접수 확인표')&&str_contains($recallHtml,'name="recallEventId"')&&str_contains($recallHtml,'fixture-token'),'recall confirmation table includes request identity, revision and CSRF controls');
check(!str_contains($recallHtml,'<script>재콜 메모</script>')&&str_contains($recallHtml,'&lt;script&gt;재콜 메모&lt;/script&gt;'),'recall memo is escaped in rendered table');
intake_update($admin,['id'=>$recallId,'revision'=>$revision,'action'=>'hold','status'=>'pending','recallEventId'=>$currentRequest,'reason'=>'추가 상담 필요']);
$heldRow=$d->query('SELECT * FROM sales_records WHERE id='.(int)$recallId)->fetch();
check($heldRow['status']==='pending'&&$heldRow['note']===$baseNote&&$heldRow['carrier']==='GA','hold preserves original memo, carrier and pending status');
check(!isset(intake_outstanding_recalls([$recallId])[$recallId])&&intake_recall_queue($admin,$recallFilters)===[],'processed hold leaves both administrator queue and employee waiting flag');
rejects(fn()=>intake_update($admin,['id'=>$recallId,'revision'=>(int)$heldRow['revision'],'action'=>'status','status'=>'normal','recallEventId'=>$currentRequest]),'already processed request cannot be replayed with a newer revision');
$approvedRequest=$addRecall($recallId,'recall','추가 통화 후 정상 확인 요청','신한');$approvedRevision=(int)$d->query('SELECT revision FROM sales_records WHERE id='.(int)$recallId)->fetchColumn();
intake_update($admin,['id'=>$recallId,'revision'=>$approvedRevision,'action'=>'status','status'=>'normal','recallEventId'=>$approvedRequest,'reason'=>'정상 확인 완료']);
$approvedRow=$d->query('SELECT * FROM sales_records WHERE id='.(int)$recallId)->fetch();
check($approvedRow['status']==='normal'&&$approvedRow['carrier']==='신한'&&$approvedRow['first_date']===$lastMonth&&$approvedRow['note']===$baseNote,'approval applies requested carrier and keeps original intake date and full memo');
check(intake_recall_queue($admin,$recallFilters)===[],'approved recall leaves pending confirmation queue');
$recallHistory=intake_history($admin,$recallId);$reasons=array_column($recallHistory,'reason');
check(in_array('재콜 이후 추가 메모',$reasons,true)&&in_array('기존 재접수 메모',$reasons,true)&&in_array('<script>재콜 메모</script>',$reasons,true),'every appended memo remains in audit history after approval');
// Handling from the original sales page also closes recall requests, even after reopening pending.
intake_update($admin,['id'=>$recallId,'revision'=>(int)$approvedRow['revision'],'action'=>'status','status'=>'pending']);
$externalRequest=$addRecall($recallId,'recall','기존 접수 화면 확인');$externalRevision=(int)$d->query('SELECT revision FROM sales_records WHERE id='.(int)$recallId)->fetchColumn();
sales_mutate($admin,['id'=>$recallId,'revision'=>$externalRevision,'action'=>'status','status'=>'normal']);sales_mutate($admin,['id'=>$recallId,'revision'=>$externalRevision+1,'action'=>'status','status'=>'pending']);
// The SQLite fixture lacks the production sales_events timestamp default.
$d->prepare('UPDATE sales_events SET created_at=? WHERE sale_id=? AND old_status<>?')->execute(['2999-01-01 00:00:00',$recallId,'']);
check(intake_recall_queue($admin,$recallFilters)===[]&&!isset(intake_outstanding_recalls([$recallId])[$recallId]),'original sales status handling closes recall after status is reopened');
rejects(fn()=>intake_update($admin,['id'=>$recallId,'revision'=>$externalRevision+2,'action'=>'status','status'=>'normal','recallEventId'=>$externalRequest]),'old recall cannot be approved after original sales screen handling');
echo "PASS: all-month recall queue, scoped access, append-only memos, latest-request guards, approval/hold behavior, original-date preservation, escaped rendering and shared employee waiting state.\n";

// Both regions screens share this feed, but employee reads must never broaden to another owner.
require __DIR__.'/../lib/pending-intakes.php';
$oldPendingDate=(new DateTimeImmutable($month.'-01'))->modify('-14 months')->format('Y-m-d');
$d->prepare('UPDATE sales_records SET first_date=?,note=? WHERE id=?')->execute([$oldPendingDate,'기존 상담 메모',$legacyId]);
intake_audit((string)$legacyId,$one,'memo',[],[],'이어 쓴 상담 메모');
intake_audit((string)$legacyId,$one,'recall',['status'=>'pending'],['status'=>'pending','carrier'=>'GA','date'=>$oldPendingDate],'재콜 확인 요청');
$testState=json_decode($d->query('SELECT state FROM test_employee_data WHERE user_id=4')->fetchColumn(),true,512,JSON_THROW_ON_ERROR);
$testState['sales'][]=['id'=>42,'date'=>$oldPendingDate,'name'=>'이전 월 테스트 가접수','status'=>'가접수','carrier'=>'한화','kind'=>'일반','birthDate'=>'1990-03-23','consultationTime'=>'15:20','consultationPlace'=>'경기도 이천시','premiumBand'=>'200000','note'=>'테스트 기존 메모'];
$testState['sales'][]=['id'=>43,'date'=>$today,'name'=>'정상 테스트 제외','status'=>'정상','carrier'=>'GA','kind'=>'일반'];
$d->prepare('UPDATE test_employee_data SET state=? WHERE user_id=4')->execute([hr_json($testState)]);
intake_audit('test:4:42',$testUser,'memo',[],[],'테스트 추가 메모');
sales_mutate($testUser,array_replace($create,['requestKey'=>'90909090-aaaa-bbbb-cccc-000000000001','customer'=>'실제 테이블 테스트 가접수']));
$onePending=pending_intake_snapshot($one)['records'];$twoPending=pending_intake_snapshot($two)['records'];$testPending=pending_intake_snapshot($testUser)['records'];$allPending=pending_intake_snapshot($admin)['records'];
check($onePending!==[]&&array_values(array_unique(array_column($onePending,'employeeId'))) === [2],'employee regions feed includes only own real pending records');
check($twoPending!==[]&&array_values(array_unique(array_column($twoPending,'employeeId'))) === [3],'second employee cannot read first employee or test pending records');
check($testPending!==[]&&array_values(array_unique(array_column($testPending,'employeeId'))) === [4]&&count(array_filter($testPending,fn($r)=>$r['isTest']))===count($testPending),'test employee reads own legacy and real-table test records only');
$oneById=array_column($onePending,null,'id');$allById=array_column($allPending,null,'id');$testById=array_column($testPending,null,'id');
check(isset($oneById[$legacyId])&&$oneById[$legacyId]['date']===$oldPendingDate&&$oneById[$legacyId]['note']==='기존 상담 메모','old pending records remain visible across year and month boundaries without changing notes');
check(array_column($oneById[$legacyId]['memoHistory'],'memo')===['이어 쓴 상담 메모','재콜 확인 요청']&&$oneById[$legacyId]['recallPending']===true,'employee pending feed preserves append-only history and outstanding recall status');
check(isset($testById['test:4:42'])&&!isset($testById['test:4:43'])&&$testById['test:4:42']['birthDate']==='1990-03-23'&&$testById['test:4:42']['consultationPlace']==='경기도 이천시','legacy test pending includes full consultation details and excludes completed statuses');
check(array_column($testById['test:4:42']['memoHistory'],'memo')===['테스트 추가 메모']&&!isset($oneById['test:4:42']),'test memo history cannot leak into another employee feed');
$owners=array_values(array_unique(array_column($allPending,'employeeId')));sort($owners);
check($owners===[2,3,4]&&count($allPending)===count($onePending)+count($twoPending)+count($testPending),'administrator regions feed contains every employee pending record once');
check($allById[$legacyId]===$oneById[$legacyId]&&$allById['test:4:42']===$testById['test:4:42'],'administrator and employee pending rows use identical details, memo history and recall state');
check($allById['test:4:42']['employee']==='테스트 직원'&&$allById['test:4:42']['team']==='insurance'&&$allById['test:4:42']['isTest']===true,'administrator receives owner, department and explicit test classification for filters');
check(!isset($allById['1'])&&count(array_filter($allPending,fn($r)=>$r['status']!=='pending'))===0,'administrator pending feed excludes A/S and normal records');
$d->exec("INSERT INTO app_users VALUES(5,'empty','접수 없는 직원','employee','insurance',1)");
check(pending_intake_snapshot(['id'=>5,'role'=>'employee'])===['records'=>[]],'employee with no pending records receives an empty feed');
$forbidden=function(callable $fn,string $message):void{try{$fn();}catch(HRForbidden $e){return;}throw new RuntimeException($message);};
$forbidden(fn()=>pending_intake_snapshot(['id'=>2,'role'=>'manager']),'unknown role must receive forbidden pending access');
$forbidden(fn()=>pending_intake_authorize($admin,true),'administrator must not submit an employee recall request');
pending_intake_authorize($one,true);pending_intake_authorize($admin);
echo "PASS: administrator all-month pending feed, employee ownership isolation, complete test/real row metadata, scoped memo history, recall parity, empty results and recall authorization.\n";

// Inline pending edits use the same owner/revision guard for native and legacy records.
$pendingRow=fn(array $user,string $id)=>array_column(pending_intake_snapshot($user)['records'],null,'id')[$id];
$before=$pendingRow($one,(string)$legacyId);$birth=((int)substr($before['date'],0,4)-60).'-05-06';
$editPending=['action'=>'edit','id'=>(string)$legacyId,'revision'=>$before['revision'],'customer'=>'정정 고객 <script>','phone'=>'010-1234-9876','birthDate'=>$birth,'birthYear'=>'1999','carrier'=>'신한','consultationTime'=>'16:25','consultationPlace'=>'경기도 이천시 부발읍','premiumBand'=>'300000','memo'=>'접수정보 정정 사유','gender'=>'남','callAvailability'=>'퇴근 후 6시~8시','visitSchedule'=>'다음 주 월요일 자택','employeeId'=>3,'date'=>$today,'status'=>'normal','note'=>'덮어쓰면 안 됨'];
$forbidden(fn()=>pending_intake_update($two,$editPending),'another employee must not edit a real pending receipt');
pending_intake_update($one,$editPending);$after=$pendingRow($one,(string)$legacyId);
check($after['customer']===$editPending['customer']&&$after['phone']===$editPending['phone']&&$after['consultationPlace']===$editPending['consultationPlace']&&$after['consultationTime']==='16:25'&&$after['premiumBand']==='300000','employee receipt changes persist, including missing consultation detail insertion');
check($after['gender']==='남'&&$after['callAvailability']==='퇴근 후 6시~8시'&&$after['visitSchedule']==='다음 주 월요일 자택','receipt additions survive employee edits and reload');
check($after['birthDate']===$birth&&$after['birthYear']===(int)substr($birth,0,4)&&$after['kind']==='silver','full date controls birth year and age classification');
foreach(['employeeId','date','status','note','address'] as $key)check($after[$key]===$before[$key],'inline edit preserves '.$key);
check($after['revision']===$before['revision']+1&&$after['lastEditAt']!==''&&$after['recallPending'],'edit is audited once and preserves outstanding recall');
rejects(fn()=>pending_intake_update($one,$editPending),'stale pending revision rejected');
$same=array_replace($editPending,['revision'=>$after['revision'],'memo'=>'']);rejects(fn()=>pending_intake_update($one,$same),'unchanged fields cannot create an edit');
foreach(['phone'=>'invalid','birthDate'=>'1990-02-30','consultationTime'=>'25:10','premiumBand'=>'50000','customer'=>'','consultationPlace'=>str_repeat('가',501),'gender'=>'기타','callAvailability'=>str_repeat('가',201),'visitSchedule'=>str_repeat('가',501)] as $key=>$value)rejects(fn()=>pending_intake_update($one,array_replace($same,[$key=>$value])),'invalid inline field rejected: '.$key);
check($pendingRow($one,(string)$legacyId)===$after,'invalid and stale edits leave every field, revision and history intact');
pending_intake_update($admin,['action'=>'edit','id'=>(string)$legacyId,'revision'=>$after['revision'],'consultationTime'=>'17:40']);
$afterAdmin=$pendingRow($one,(string)$legacyId);check($afterAdmin['consultationTime']==='17:40'&&$afterAdmin['customer']===$after['customer'],'administrator may edit one field while retaining all omitted fields');
pending_intake_update($admin,['action'=>'memo','id'=>(string)$legacyId,'revision'=>$afterAdmin['revision'],'memo'=>'관리자 확인 메모']);
$memoId=(int)$d->lastInsertId();$d->prepare('UPDATE intake_management_events SET created_at=? WHERE id=?')->execute(['2026-09-30 08:07:06',$memoId]);
$memoRow=$pendingRow($one,(string)$legacyId);$lastMemo=$memoRow['memoHistory'][count($memoRow['memoHistory'])-1];
check($lastMemo['memo']==='관리자 확인 메모'&&$lastMemo['actor']==='관리자'&&$lastMemo['at']==='2026-09-30 17:07:06','appended memo exposes server timestamp in Seoul time and its author');
check($memoRow['note']===$before['note']&&in_array('접수정보 정정 사유',array_column($memoRow['memoHistory'],'memo'),true),'original note and edit reason survive later memo additions');
check($pendingRow($admin,(string)$legacyId)===$memoRow,'both roles see identical edits and timestamped history');
$forbidden(fn()=>pending_intake_update($admin,['action'=>'recall','id'=>(string)$legacyId,'revision'=>$memoRow['revision'],'carrier'=>'GA','memo'=>'권한 검증']),'administrator recall remains forbidden after enabling edit and memo');
$eventsBefore=(int)$d->query('SELECT count(*) FROM intake_management_events')->fetchColumn();
try{pending_intake_update(['id'=>999,'role'=>'admin'],['action'=>'edit','id'=>(string)$legacyId,'revision'=>$memoRow['revision'],'customer'=>'감사 실패 시 취소']);throw new RuntimeException('Expected audit failure');}catch(PDOException $e){}
check($pendingRow($one,(string)$legacyId)===$memoRow&&(int)$d->query('SELECT count(*) FROM intake_management_events')->fetchColumn()===$eventsBefore,'failed audit rolls back inline content and revision atomically');
rejects(fn()=>pending_intake_update($one,['action'=>'edit','id'=>'1','revision'=>(int)$d->query('SELECT revision FROM sales_records WHERE id=1')->fetchColumn(),'customer'=>'완료된 건 수정']),'non-pending records cannot be edited through pending feed');

$legacyBefore=$pendingRow($testUser,'test:4:42');
$legacyEdit=['action'=>'edit','id'=>'test:4:42','revision'=>$legacyBefore['revision'],'customer'=>'테스트 수정 고객','phone'=>'010-1111-2222','birthDate'=>'1988-02-29','carrier'=>'GA','consultationTime'=>'09:30','consultationPlace'=>'서울특별시 강남구','premiumBand'=>'100000'];
$forbidden(fn()=>pending_intake_update($one,$legacyEdit),'another employee must not edit legacy test receipts');
pending_intake_update($testUser,$legacyEdit);$legacyAfter=$pendingRow($testUser,'test:4:42');
check($legacyAfter['customer']==='테스트 수정 고객'&&$legacyAfter['birthDate']==='1988-02-29'&&$legacyAfter['birthYear']===1988&&$legacyAfter['phone']==='010-1111-2222'&&$legacyAfter['consultationPlace']==='서울특별시 강남구','legacy receipt supports all inline customer and consultation edits');
check($legacyAfter['date']===$legacyBefore['date']&&$legacyAfter['note']===$legacyBefore['note']&&$legacyAfter['originalMemoAt']===''&&$legacyAfter['status']==='pending','legacy edit preserves original receipt and does not fabricate old memo timestamps');
rejects(fn()=>pending_intake_update($testUser,$legacyEdit),'stale legacy edits rejected');
pending_intake_update($admin,['action'=>'edit','id'=>'test:4:42','revision'=>$legacyAfter['revision'],'birthDate'=>'','birthYear'=>'1991']);
$yearOnly=$pendingRow($testUser,'test:4:42');check($yearOnly['birthDate']===''&&$yearOnly['birthYear']===1991,'year-only legacy edit remains readable without an invented birthday');
$legacySales=array_column(sales_snapshot($admin,substr($yearOnly['date'],0,7))['records'],null,'id');check($legacySales['test:4:42']['birthYear']===1991,'edited legacy birth year is shared with the original intake screens');
pending_intake_update($testUser,['action'=>'memo','id'=>'test:4:42','revision'=>$yearOnly['revision'],'memo'=>'새 날짜가 남는 직원 메모']);
$legacyMemo=$pendingRow($testUser,'test:4:42');check(count($legacyMemo['memoHistory'])===2&&$legacyMemo['memoHistory'][1]['at']!==''&&$legacyMemo['note']==='테스트 기존 메모','legacy memo appends a timestamp without replacing original notes');
check($pendingRow($admin,'test:4:42')===$legacyMemo,'administrator and employee legacy edits remain in sync');
pending_intake_update($one,['action'=>'edit','id'=>(string)$legacyId,'revision'=>$memoRow['revision'],'birthDate'=>'','birthYear'=>'1990']);
$yearOnlyReal=$pendingRow($one,(string)$legacyId);check($yearOnlyReal['birthDate']===''&&$yearOnlyReal['birthYear']===1990&&$yearOnlyReal['kind']==='general','clearing full birthday updates the year and removes stale birth detail');
$counselorBefore=$pendingRow($one,(string)$legacyId);
pending_intake_update($one,['action'=>'edit','id'=>(string)$legacyId,'revision'=>$counselorBefore['revision'],'counselorName'=>'실제 상담원']);
$counselorAfter=$pendingRow($one,(string)$legacyId);check($counselorAfter['counselorName']==='실제 상담원'&&$counselorAfter['employeeId']===$counselorBefore['employeeId'],'counselor edits round trip through the database without changing the authenticated owner');
// A regular employee must not discover or mutate fixtures attached to their own ID.
$isolationPending=$d->query('SELECT * FROM sales_records WHERE id='.(int)$legacyId)->fetch();
$isolationPendingCount=count(pending_intake_snapshot($one)['records']);
$isolationPendingEvents=(int)$d->query('SELECT count(*) FROM intake_management_events')->fetchColumn();
$isolationLegacy=$d->query('SELECT state FROM test_employee_data WHERE user_id=4')->fetchColumn();
$d->exec('UPDATE sales_records SET is_test=1 WHERE id='.(int)$legacyId);
$d->prepare('INSERT INTO test_employee_data(user_id,state) VALUES(2,?)')->execute([$isolationLegacy]);
$isolationRows=pending_intake_snapshot($one)['records'];
check(count($isolationRows)===$isolationPendingCount-1&&count(array_filter($isolationRows,fn($row)=>$row['isTest']))===0,'regular pending feed excludes stale own fixtures and marked test records');
$isolationAdminRows=array_column(pending_intake_snapshot($admin)['records'],null,'id');
check(isset($isolationAdminRows[(string)$legacyId],$isolationAdminRows['test:2:42']),'administrator pending management retains explicitly marked fixture records');
foreach(['edit','memo','recall'] as $isolationAction){
    foreach([[(string)$legacyId,(int)$isolationPending['revision']],['test:2:42',1]] as [$isolationId,$isolationRevision]){
        $forbidden(fn()=>pending_intake_update($one,['action'=>$isolationAction,'id'=>$isolationId,'revision'=>$isolationRevision,'customer'=>'허용되지 않는 수정','carrier'=>'GA','memo'=>'허용되지 않는 메모']),'regular employee cannot '.$isolationAction.' own fixture through a forged record ID');
    }
}
check((int)$d->query('SELECT count(*) FROM intake_management_events')->fetchColumn()===$isolationPendingEvents&&$d->query('SELECT revision FROM sales_records WHERE id='.(int)$legacyId)->fetchColumn()===$isolationPending['revision']&&$d->query('SELECT state FROM test_employee_data WHERE user_id=2')->fetchColumn()===$isolationLegacy,'denied fixture actions leave records and audit history untouched');
$d->exec('DELETE FROM test_employee_data WHERE user_id=2');
$d->prepare('UPDATE sales_records SET is_test=? WHERE id=?')->execute([$isolationPending['is_test'],$legacyId]);
check(count(pending_intake_snapshot($one)['records'])===$isolationPendingCount&&!$d->inTransaction(),'pending isolation checks restore the fixture');
echo "PASS: inline real/legacy receipt edits, administrator and employee parity, per-owner access, immutable owner/date/status/notes, complete field validation, no-op and stale rejection, atomic audit rollback and timestamped append-only memo history.\n";

// Administrator search keeps every matching receipt, including duplicate names/phones.
$searchBase=array_column(sales_snapshot($admin,$month)['records'],null,'id')['1'];
$searchBase=array_replace($searchBase,['date'=>$today,'isTest'=>false,'employee'=>'검색제외 상담원','carrier'=>'검색제외 정책','consultationPlace'=>'검색제외 지역']);
$searchRecords=[
    array_replace($searchBase,['id'=>'search-a','customer'=>'김고객','phone'=>'010-5555-1234']),
    array_replace($searchBase,['id'=>'search-b','customer'=>'김고객 (중복)','phone'=>'01055551234']),
    array_replace($searchBase,['id'=>'search-c','customer'=>'다른고객','phone'=>'010-5555-1234']),
    array_replace($searchBase,['id'=>'search-d','customer'=>'김고객','phone'=>'010-0000-4321']),
    array_replace($searchBase,['id'=>'search-old','customer'=>'김고객','phone'=>'010-5555-1234','date'=>$lastMonth]),
    array_replace($searchBase,['id'=>'search-test','customer'=>'김고객','phone'=>'010-5555-1234','isTest'=>true]),
];
$searchFilters=intake_filters(['month'=>$month,'scope'=>'real']);
$matchedNames=array_column(intake_filtered($searchRecords,array_replace($searchFilters,['q'=>'김고객'])),'id');sort($matchedNames);
check($matchedNames===['search-a','search-b','search-d'],'name search shows every same-name receipt, including stored duplicate labels');
$matchedPhones=array_column(intake_filtered($searchRecords,array_replace($searchFilters,['q'=>'(010) 5555-1234'])),'id');sort($matchedPhones);
check($matchedPhones===['search-a','search-b','search-c'],'formatted phone search shows all matches regardless of stored hyphens or customer name');
foreach(['검색제외','search-a','김5555'] as $query)check(intake_filtered($searchRecords,array_replace($searchFilters,['q'=>$query]))===[],'name/phone search does not match unrelated fields or extract digits from text');
check(count(intake_filtered($searchRecords,array_replace($searchFilters,['q'=>'1234'])))===3,'partial phone search retains month and real-data scope');

// Counselor, details and approval status save in one revision and one transaction.
$combinedCreated=intake_create($admin,['employeeId'=>'2','date'=>$today,'customer'=>'함께 수정 고객','phone'=>'010-8765-4321','birthDate'=>'1990-01-01','counselorName'=>'보험 직원','note'=>'한화','requestKey'=>'12345678-aaaa-bbbb-cccc-010101010101']);
$combinedId=(string)$combinedCreated['id'];
$combinedRecord=fn()=>array_column(sales_snapshot($admin,$month)['records'],null,'id')[$combinedId];
$combinedBefore=$combinedRecord();
intake_audit($combinedId,$one,'recall',['status'=>'pending'],['status'=>'pending','carrier'=>'한화'],'결합 수정 전 재콜');
check(isset(intake_outstanding_recalls([$combinedId])[$combinedId]),'combined edit fixture starts with an outstanding recall');
$combinedEdit=['action'=>'edit','id'=>$combinedId,'revision'=>$combinedBefore['revision'],'customer'=>'함께 수정한 고객','phone'=>'010-8765-4321','carrier'=>'GA','note'=>'실버','consultationTime'=>'11:30','consultationPlace'=>'경기도 이천시','premiumBand'=>'200000','counselorName'=>'화장품 직원','gender'=>'여','callAvailability'=>'오후 2~3시','visitSchedule'=>'주민센터','status'=>'normal','reason'=>'상담원 및 승인 상태 확인','employeeId'=>'3','date'=>$lastMonth];
rejects(fn()=>intake_update($one,$combinedEdit),'employee cannot combine counselor and approval changes');
intake_update($admin,$combinedEdit);$combinedAfter=$combinedRecord();
check($combinedAfter['status']==='normal'&&$combinedAfter['counselorName']==='화장품 직원'&&$combinedAfter['customer']==='함께 수정한 고객'&&$combinedAfter['consultationTime']==='11:30','combined administrator edit persists counselor, status and receipt details together');
check($combinedAfter['revision']===$combinedBefore['revision']+1&&$combinedAfter['employeeId']===$combinedBefore['employeeId']&&$combinedAfter['date']===$combinedBefore['date'],'combined edit advances one revision and never reassigns owner or original receipt date');
check(!isset(intake_outstanding_recalls([$combinedId])[$combinedId]),'status change through expanded receipt editing closes the outstanding recall');
$combinedHistory=intake_history($admin,$combinedId);$combinedStatus=array_values(array_filter($combinedHistory,fn($event)=>$event['action']==='status'));$combinedDetail=array_values(array_filter($combinedHistory,fn($event)=>$event['action']==='edit'));
check(count($combinedStatus)===1&&$combinedStatus[0]['before']['status']==='pending'&&$combinedStatus[0]['after']['status']==='normal'&&count($combinedDetail)===1&&$combinedDetail[0]['after']['counselorName']==='화장품 직원','combined save audits the edited data and the actual status transition');
rejects(fn()=>intake_update($admin,$combinedEdit),'stale expanded receipt form cannot overwrite a newer counselor or status');
$combinedSame=array_replace($combinedEdit,['revision'=>$combinedAfter['revision']]);rejects(fn()=>intake_update($admin,$combinedSame),'unchanged counselor/details/status does not create another revision or audit');
check($combinedRecord()===$combinedAfter&&intake_history($admin,$combinedId)===$combinedHistory,'stale and no-op expanded edits preserve all stored fields and history');

// Fail specifically at the second audit, after every data write and the edit audit.
$d->exec("CREATE TRIGGER reject_combined_status_audit BEFORE INSERT ON intake_management_events WHEN NEW.action='status' AND NEW.record_key='".$combinedId."' BEGIN SELECT RAISE(ABORT,'isolated status audit failure'); END;");
try{intake_update($admin,array_replace($combinedSame,['status'=>'as','counselorName'=>'보험 직원','customer'=>'취소되어야 하는 변경','consultationPlace'=>'취소 지역']));throw new RuntimeException('Expected combined audit failure');}catch(PDOException $e){}finally{$d->exec('DROP TRIGGER reject_combined_status_audit');}
check($combinedRecord()===$combinedAfter&&intake_history($admin,$combinedId)===$combinedHistory&&!$d->inTransaction(),'failed status audit rolls back counselor, status, receipt details, revision and first edit audit');

// A counselor-only correction must not silently mark a pending recall as handled.
intake_update($admin,array_replace($combinedSame,['status'=>'pending']));
$statusOnly=$combinedRecord();check($statusOnly['status']==='pending'&&$statusOnly['counselorName']===$combinedAfter['counselorName']&&$statusOnly['revision']===$combinedAfter['revision']+1,'changing only approval status is a valid expanded-form edit');
intake_audit($combinedId,$one,'recall',['status'=>'pending'],['status'=>'pending','carrier'=>'한화'],'상담원 정정 중 재콜 유지');
$beforeCounselorOnly=$combinedRecord();$statusCount=(int)$d->query("SELECT count(*) FROM intake_management_events WHERE record_key='".$combinedId."' AND action='status'")->fetchColumn();
intake_update($admin,array_replace($combinedEdit,['revision'=>$beforeCounselorOnly['revision'],'status'=>'pending','counselorName'=>'보험 직원']));
$afterCounselorOnly=$combinedRecord();
check($afterCounselorOnly['counselorName']==='보험 직원'&&$afterCounselorOnly['status']==='pending'&&isset(intake_outstanding_recalls([$combinedId])[$combinedId]),'counselor-only edit preserves status and outstanding recall');
check((int)$d->query("SELECT count(*) FROM intake_management_events WHERE record_key='".$combinedId."' AND action='status'")->fetchColumn()===$statusCount,'unchanged status never emits a false status-handled event');
echo "PASS: administrator name/phone duplicate search, normalized phones, atomic counselor/status edits, immutable receipt ownership/date, stale and no-op guards, status audit rollback and precise recall handling.\n";

// Pending disclosure saves fields and status atomically, while employee submissions stay pending.
$transitionRow=$combinedRecord();
$d->exec("CREATE TRIGGER reject_pending_transition BEFORE INSERT ON intake_management_events WHEN NEW.action='status' AND NEW.record_key='".$combinedId."' BEGIN SELECT RAISE(ABORT,'isolated pending audit failure'); END;");
try{pending_intake_update($admin,['action'=>'edit','id'=>$combinedId,'revision'=>$transitionRow['revision'],'status'=>'as','counselorName'=>'취소 상담원']);throw new RuntimeException('Expected transition audit failure');}catch(PDOException $e){}finally{$d->exec('DROP TRIGGER reject_pending_transition');}
check($combinedRecord()===$transitionRow&&!$d->inTransaction(),'pending transition audit failure rolls back receipt fields and status');
pending_intake_update($admin,['action'=>'edit','id'=>$combinedId,'revision'=>$transitionRow['revision'],'status'=>'normal','note'=>'한화','counselorName'=>'관리자 선택 상담원']);
$transitioned=$combinedRecord();check($transitioned['status']==='normal'&&$transitioned['counselorName']==='관리자 선택 상담원','pending disclosure applies selected status and counselor together');
check(!in_array($combinedId,array_column(pending_intake_snapshot($admin)['records'],'id'),true),'normal transition disappears from pending feed');
check(!isset(intake_outstanding_recalls([$combinedId])[$combinedId]),'pending status transition resolves recall waiting state');
foreach(['normal','as'] as $createdStatus){
 $key=$createdStatus==='normal'?'65656565-aaaa-bbbb-cccc-000000000001':'65656565-aaaa-bbbb-cccc-000000000002';
 sales_mutate($admin,array_replace($create,['employeeId'=>2,'status'=>$createdStatus,'requestKey'=>$key,'customer'=>'관리자 상태 선택 '.$createdStatus]));
 $q=$d->prepare('SELECT status FROM sales_records WHERE request_key=?');$q->execute([$key]);check($q->fetchColumn()===$createdStatus,'admin registration persists selected status');
}
echo "PASS: pending receipt transitions and administrator registration status selection.\n";

// Read-only side search is administrator-only, spans months, and returns bounded summaries.
$searchRow=$combinedRecord();$searchResult=intake_live_search($admin,$searchRow['customer'],'real');
check(in_array($combinedId,array_column($searchResult['records'],'id'),true),'side search finds a receipt by customer name');
$phoneResult=intake_live_search($admin,str_replace('-','',$searchRow['phone']),'real');
check(in_array($combinedId,array_column($phoneResult['records'],'id'),true),'side search normalizes phone separators');
$oldResult=intake_live_search($admin,$pendingRow($one,(string)$legacyId)['customer'],'real');
check(in_array((string)$legacyId,array_column($oldResult['records'],'id'),true),'side search includes old receipt months');
rejects(fn()=>intake_live_search($one,'고객','real'),'employee cannot access administrator side search');
rejects(fn()=>intake_live_search($admin,'고객','invalid'),'invalid data scope rejected');
check(intake_live_search($admin,'','real')['records']===[],'empty query does not enumerate receipts');
check(intake_live_search($admin,'%_','real')['records']===[],'wildcard characters are literal search text');
check(count($searchResult['records'])<=20&&!array_key_exists('birthDate',$searchResult['records'][0]),'results are bounded and contain no full receipt details');
foreach(intake_live_search($admin,'고객','test')['records'] as $found)check($found['isTest']===true,'test search never includes real rows');
echo "PASS: admin side search, name/phone matching, month independence, literal wildcard escaping and data scope.\n";
