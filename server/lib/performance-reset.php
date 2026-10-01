<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';

/** One authorized cleanup for hantest; a durable marker protects future real entries. */
function performance_reset_hantest(string $backupDirectory): array {
    $batch='hantest-performance-clear-20261001-user-request-v1';$d=db();$d->beginTransaction();
    try{
        $q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute([$batch]);
        if($raw=$q->fetchColumn()){$d->commit();return ['alreadyApplied'=>true]+json_decode($raw,true,512,JSON_THROW_ON_ERROR);}
        $q=$d->prepare("SELECT id,username,role FROM app_users WHERE username=? AND role='employee' FOR UPDATE");$q->execute(['hantest']);$user=$q->fetch();
        hr_assert((bool)$user,'hantest 직원 계정을 찾을 수 없습니다.');$uid=(int)$user['id'];
        $q=$d->prepare('SELECT * FROM sales_records WHERE employee_id=? FOR UPDATE');$q->execute([$uid]);$records=$q->fetchAll();$ids=array_column($records,'id');
        $backup=['account'=>$user,'requestedAt'=>'2026-10-01','savedAt'=>gmdate('c'),'sales_records'=>$records];
        $childTables=['sales_events','sales_consultation_details','sales_receipt_details','sales_birth_details','sales_counselor_details'];
        foreach($childTables as $table){$backup[$table]=[];foreach(array_chunk($ids,400) as $chunk){$q=$d->prepare('SELECT * FROM '.$table.' WHERE sale_id IN ('.implode(',',array_fill(0,count($chunk),'?')).') FOR UPDATE');$q->execute($chunk);$backup[$table]=array_merge($backup[$table],$q->fetchAll());}}
        $legacyPrefix='test:'.$uid.':%';$backup['intake_management_events']=[];
        $q=$d->prepare('SELECT * FROM intake_management_events WHERE record_key LIKE ? FOR UPDATE');$q->execute([$legacyPrefix]);$backup['intake_management_events']=$q->fetchAll();
        foreach(array_chunk($ids,400) as $chunk){$q=$d->prepare('SELECT * FROM intake_management_events WHERE record_key IN ('.implode(',',array_fill(0,count($chunk),'?')).') FOR UPDATE');$q->execute(array_map('strval',$chunk));$backup['intake_management_events']=array_merge($backup['intake_management_events'],$q->fetchAll());}
        $q=$d->prepare('SELECT * FROM daily_grade_receipts WHERE employee_id=? FOR UPDATE');$q->execute([$uid]);$backup['daily_grade_receipts']=$q->fetchAll();
        $q=$d->prepare('SELECT state,revision FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([$uid]);$legacy=$q->fetch();$backup['test_employee_data']=$legacy?:null;
        $state=$legacy?json_decode($legacy['state'],true,512,JSON_THROW_ON_ERROR):[];$legacyCount=count($state['sales']??[]);
        if(!is_dir($backupDirectory)&&!mkdir($backupDirectory,0700,true))throw new RuntimeException('실적 백업 폴더를 만들 수 없습니다.');
        if(!chmod($backupDirectory,0700))throw new RuntimeException('실적 백업 폴더 권한을 적용할 수 없습니다.');
        $path=$backupDirectory.'/hantest-performance-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(6)).'.json';
        $handle=fopen($path,'x');if(!$handle)throw new RuntimeException('실적 백업 파일을 만들 수 없습니다.');
        try{$json=hr_json($backup);if(!chmod($path,0600)||fwrite($handle,$json)!==strlen($json)||!fflush($handle))throw new RuntimeException('실적 백업을 저장하지 못했습니다.');}finally{fclose($handle);}
        // Delete only children of this account's receipts, then the receipts themselves.
        foreach(array_chunk($ids,400) as $chunk){$marks=implode(',',array_fill(0,count($chunk),'?'));foreach($childTables as $table){$q=$d->prepare('DELETE FROM '.$table.' WHERE sale_id IN ('.$marks.')');$q->execute($chunk);}$q=$d->prepare('DELETE FROM intake_management_events WHERE record_key IN ('.$marks.')');$q->execute(array_map('strval',$chunk));}
        $q=$d->prepare('DELETE FROM intake_management_events WHERE record_key LIKE ?');$q->execute([$legacyPrefix]);
        $q=$d->prepare('DELETE FROM sales_records WHERE employee_id=?');$q->execute([$uid]);
        $q=$d->prepare('DELETE FROM daily_grade_receipts WHERE employee_id=?');$q->execute([$uid]);
        if($legacy){$state['sales']=[];$q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),$uid]);}
        $q=$d->prepare('SELECT COUNT(*) FROM sales_records WHERE employee_id=?');$q->execute([$uid]);hr_assert((int)$q->fetchColumn()===0,'hantest 실적 삭제를 확인하지 못했습니다.');
        $manifest=['username'=>'hantest','userId'=>$uid,'receiptCount'=>count($ids),'legacyReceiptCount'=>$legacyCount,'dailyGradeReceiptCount'=>count($backup['daily_grade_receipts']),'backup'=>$path,'completedAt'=>gmdate('c')];
        $q=$d->prepare('INSERT INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([$batch,hr_json($manifest)]);$d->commit();return ['alreadyApplied'=>false]+$manifest;
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
