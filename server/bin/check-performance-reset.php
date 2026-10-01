<?php
// Isolated in-memory fixtures; no production database or real customer data.
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/check-sales.php';require __DIR__.'/../lib/performance-reset.php';
$d->exec("CREATE TABLE test_fixture_batches(batch TEXT PRIMARY KEY,manifest TEXT);CREATE TABLE daily_grade_receipts(employee_id INTEGER,performance_date TEXT,amount INTEGER);CREATE TABLE intake_management_events(id INTEGER PRIMARY KEY,record_key TEXT,actor_id INTEGER,reason TEXT);
INSERT INTO app_users VALUES(5,'hantest','실제 입력 직원','employee','insurance',1);");
$target=['id'=>5,'role'=>'employee'];$otherCount=(int)$d->query('SELECT count(*) FROM sales_records WHERE employee_id<>5')->fetchColumn();
$input=array_replace($create,['requestKey'=>'f6f6f6f6-f6f6-f6f6-f6f6-f6f6f6f6f6f6','customer'=>'삭제 검증 고객','phone'=>'010-7777-1111']);sales_mutate($target,$input);$sale=(int)$d->query("SELECT id FROM sales_records WHERE request_key='f6f6f6f6-f6f6-f6f6-f6f6-f6f6f6f6f6f6'")->fetchColumn();
$d->prepare('INSERT INTO intake_management_events VALUES(1,?,1,?)')->execute([(string)$sale,'검증 기록']);$d->exec("INSERT INTO intake_management_events VALUES(2,'1',5,'다른 직원 접수에 남긴 기록'),(3,'test:5:1',1,'이전 예시 기록');INSERT INTO daily_grade_receipts VALUES(5,'2026-09-30',5000),(2,'2026-09-30',5000);");
$legacyState=['sales'=>[['id'=>1,'name'=>'삭제 예시','status'=>'정상']],'attendance'=>[['date'=>'2026-09-30','in'=>'10:00','out'=>'17:00']]];$d->prepare('INSERT INTO test_employee_data(user_id,state) VALUES(5,?)')->execute([hr_json($legacyState)]);
$backupDirectory=sys_get_temp_dir().'/cnchome-reset-fixture-'.bin2hex(random_bytes(6));
try{
    $result=performance_reset_hantest($backupDirectory);check(!$result['alreadyApplied']&&$result['receiptCount']===1&&$result['legacyReceiptCount']===1,'only the requested employee performance is cleared');
    $backup=json_decode(file_get_contents($result['backup']),true,512,JSON_THROW_ON_ERROR);check($backup['sales_records'][0]['id']===$sale&&count($backup['sales_counselor_details'])===1&&count($backup['intake_management_events'])===2,'complete private receipt and audit backup is saved before deletion');
    check((int)$d->query('SELECT count(*) FROM sales_records WHERE employee_id=5')->fetchColumn()===0&&(int)$d->query('SELECT count(*) FROM sales_counselor_details WHERE sale_id='.$sale)->fetchColumn()===0,'receipt children and receipt are removed');
    check((int)$d->query('SELECT count(*) FROM sales_records WHERE employee_id<>5')->fetchColumn()===$otherCount&&(int)$d->query('SELECT count(*) FROM intake_management_events WHERE id=2')->fetchColumn()===1&&(int)$d->query('SELECT count(*) FROM daily_grade_receipts WHERE employee_id=2')->fetchColumn()===1,'other employee receipts and cross-account audit authorship are preserved');
    $state=json_decode($d->query('SELECT state FROM test_employee_data WHERE user_id=5')->fetchColumn(),true);check($state['sales']===[]&&$state['attendance']===$legacyState['attendance'],'fixture receipt removal does not delete unrelated attendance');
    sales_mutate($target,array_replace($input,['requestKey'=>'a7a7a7a7-a7a7-a7a7-a7a7-a7a7a7a7a7a7']));$again=performance_reset_hantest($backupDirectory);
    check($again['alreadyApplied']&&(int)$d->query('SELECT count(*) FROM sales_records WHERE employee_id=5')->fetchColumn()===1,'future deployments never delete the new real records');
    check((fileperms($result['backup'])&0777)===0600,'customer backup is private');
    // A missing target suspends this request permanently rather than deleting a later account's entries.
    $d->exec("DELETE FROM test_fixture_batches;UPDATE app_users SET username='renamed-fixture' WHERE id=5");
    $missing=performance_reset_hantest($backupDirectory);
    check(!empty($missing['targetUnavailable'])&&!$missing['alreadyApplied']&&!$d->inTransaction(),'missing employee suspends cleanup without an open transaction');
    $d->exec("UPDATE app_users SET username='hantest' WHERE id=5");$later=performance_reset_hantest($backupDirectory);
    check(!empty($later['targetUnavailable'])&&(int)$d->query('SELECT count(*) FROM sales_records WHERE employee_id=5')->fetchColumn()===1,'a later matching account never receives the old suspended deletion request');
}finally{foreach(glob($backupDirectory.'/*.json')?:[] as $file)unlink($file);if(is_dir($backupDirectory))rmdir($backupDirectory);}
echo "PASS: requested account-only performance cleanup, private backup, atomic deletion, retained attendance and one-time protection for future actual records.\n";
