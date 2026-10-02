<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';
require_once __DIR__.'/../lib/sales-performance.php';
require_once __DIR__.'/../lib/user1-cleanup.php';
require_once __DIR__.'/../lib/receipt-identity-repair.php';

function requested_duplicate_ids(array $rows): array {
    $normal=[];$pending=[];
    foreach($rows as $row){
        if((bool)$row['is_test']||sales_customer_key($row['customer_name'])!=='백석구')continue;
        $phone=sales_phone_key($row['phone']);if(strlen($phone)<9)continue;
        if($row['status']==='normal')$normal[$phone]=true;
        elseif($row['status']==='pending'&&$row['updated_at']<='2026-10-02 04:51:27.999999')$pending[(int)$row['id']]=$phone;
    }
    return array_keys(array_filter($pending,fn($phone)=>isset($normal[$phone])));
}
if(in_array('--check',$argv,true)){
    $base=['id'=>1,'customer_name'=>'백석구','phone'=>'010-1234-5678','is_test'=>0,'status'=>'normal','updated_at'=>'2026-10-02 04:00:00'];
    $rows=[$base,array_replace($base,['id'=>2,'status'=>'pending','customer_name'=>'백석구(중복접수)','phone'=>'01012345678']),array_replace($base,['id'=>3,'status'=>'pending','phone'=>'01099999999']),array_replace($base,['id'=>4,'status'=>'as']),array_replace($base,['id'=>5,'status'=>'pending','is_test'=>1]),array_replace($base,['id'=>6,'status'=>'pending','customer_name'=>'다른 고객']),array_replace($base,['id'=>7,'status'=>'pending','updated_at'=>'2026-10-02 05:00:00'])];
    if(requested_duplicate_ids($rows)!==[2]||requested_duplicate_ids(array_slice($rows,1))!==[])throw new RuntimeException('cleanup selection check failed');
    echo "PASS: exact matching normal receipt, status, phone, scope and request cutoff.\n";exit;
}
function cleanup_public_result(array $result): void {
    $path='/var/www/html/maintenance-result-20261002.json';
    $data=hr_json(array_intersect_key($result,array_flip(['state','reason','deletedCount'])));
    if(file_put_contents($path.'.new',$data,LOCK_EX)===false||!chmod($path.'.new',0644)||!rename($path.'.new',$path))throw new RuntimeException('result_report_failed');
}
$batch='pending-duplicate-cleanup-20261002-045127-v1';$d=db();
try{
    $d->beginTransaction();
    $q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute([$batch]);
    if(($existing=$q->fetchColumn())!==false){$d->commit();cleanup_public_result(json_decode($existing,true,512,JSON_THROW_ON_ERROR));echo "Authorized duplicate cleanup already reviewed.\n";exit;}
    // Lock matching receipts in a stable order; new or subsequently edited pending rows are excluded.
    $q=$d->query("SELECT * FROM sales_records WHERE is_test=0 AND customer_name LIKE '%백%석%구%' AND status IN ('pending','normal') ORDER BY id FOR UPDATE");
    $rows=$q->fetchAll();$ids=requested_duplicate_ids($rows);
    if(!$ids){$result=['state'=>'blocked','reason'=>'no_matching_unchanged_pending_duplicate','deletedCount'=>0];$q=$d->prepare('INSERT INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([$batch,hr_json($result)]);$d->commit();cleanup_public_result($result);echo "No matching unchanged duplicate; no deletions.\n";exit;}
    $snapshot=user1_cleanup_receipt_snapshot($d,$ids,[]);
    $backup=receipt_identity_repair_backup('/var/backups/cnchome/pending-duplicate-cleanup',['batch'=>$batch,'matchedReceipts'=>$rows,'deletedReceiptData'=>$snapshot]);
    $marks=implode(',',array_fill(0,count($ids),'?'));
    // Preserve management audit rows and all payroll/grade ledgers. Receipt children are backed up above.
    foreach(['sales_events','sales_consultation_details','sales_receipt_details','sales_birth_details','sales_counselor_details'] as $table){$q=$d->prepare('DELETE FROM '.$table.' WHERE sale_id IN ('.$marks.')');$q->execute($ids);}
    $q=$d->prepare("DELETE FROM sales_records WHERE status='pending' AND is_test=0 AND id IN ($marks)");$q->execute($ids);
    if($q->rowCount()!==count($ids))throw new RuntimeException('Deletion count mismatch.');
    $q=$d->prepare('INSERT INTO test_fixture_batches(batch,manifest) VALUES(?,?)');
    $q->execute([$batch,hr_json(['state'=>'complete','deletedIds'=>$ids,'deletedCount'=>count($ids),'backup'=>$backup,'completedAt'=>gmdate('c')])]);
    $d->commit();cleanup_public_result(['state'=>'complete','deletedCount'=>count($ids)]);echo 'Authorized pending duplicate cleanup complete: '.count($ids)." deleted; normal receipts preserved.\n";
}catch(Throwable $e){if($d->inTransaction())$d->rollBack();fwrite(STDERR,"Authorized duplicate cleanup stopped; transaction rolled back.\n");exit(1);}
