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
$mode='list';$error='';$notice='';$posted=[];$total=count($rows);$pages=1;$testCount=1;$counts=['pending'=>0,'normal'=>0,'as'=>1];$history=intake_history($admin,'1');$_SESSION=['csrf'=>'fixture-token'];
ob_start();require __DIR__.'/../views/intake.php';$html=ob_get_clean();
check(!str_contains($html,'<script>alert(1)</script>')&&str_contains($html,'&lt;script&gt;'),'customer text escaped in list and detail');
check(str_contains($html,'value="300000" selected'),'stored premium band remains selected when editing');
check(str_contains($html,'fixture-token')&&str_contains($html,'name="revision"'),'mutations carry CSRF and revision');
echo "PASS: intake admin authorization, shared status, edits, atomic audit, stale writes, test isolation, filters, CSV safety, registration retry and rendered escaping.\n";
