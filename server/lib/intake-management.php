<?php
declare(strict_types=1);
require_once __DIR__.'/sales.php';

function intake_admin(array $user): void {if(($user['role']??'')!=='admin')throw new HRForbidden('접수관리는 관리자만 사용할 수 있습니다.');}
function intake_text(mixed $value,int $max): string {hr_assert(is_string($value),'입력 형식을 확인해 주세요.');$value=trim($value);hr_assert(mb_strlen($value)<=$max,'입력 내용이 너무 깁니다.');return $value;}
function intake_number(mixed $value): int {hr_assert((is_string($value)&&ctype_digit($value))||is_int($value),'번호를 확인해 주세요.');return hr_int((int)$value,2147483647);}
function intake_filters(array $query): array {
    $f=[];foreach(['month'=>7,'q'=>80,'region'=>80,'team'=>20,'status'=>10,'scope'=>10,'employee'=>12,'from'=>10,'to'=>10] as $key=>$max)$f[$key]=intake_text($query[$key]??'', $max);
    $f['month']=$f['month']?:'all';hr_assert($f['month']==='all'||sales_month($f['month']),'조회 월을 확인해 주세요.');
    hr_assert(in_array($f['team'],['','insurance','cosmetics','health'],true),'부서를 확인해 주세요.');
    hr_assert(in_array($f['status'],['','pending','normal','as'],true),'접수 상태를 확인해 주세요.');
    $f['scope']=$f['scope']?:'real';hr_assert(in_array($f['scope'],['real','test','all'],true),'자료 구분을 확인해 주세요.');
    hr_assert($f['employee']===''||ctype_digit($f['employee']),'담당 직원을 확인해 주세요.');
    foreach(['from','to'] as $key)hr_assert($f[$key]===''||(hr_day($f[$key])&&($f['month']==='all'||substr($f[$key],0,7)===$f['month'])),'조회 날짜는 선택한 월 안에서 입력해 주세요.');
    hr_assert(!$f['from']||!$f['to']||$f['from']<=$f['to'],'조회 시작일과 종료일을 확인해 주세요.');
    $f['p']=max(1,intake_number($query['p']??1));return $f;
}
function intake_filtered(array $records,array $f): array {
    $q=mb_strtolower($f['q']);$digits=preg_replace('/\D/','',$f['q']);
    $phoneQuery=$digits!==''&&(bool)preg_match('/^[0-9\s()+.\-]+$/uD',$f['q']);
    $rows=array_values(array_filter($records,function($r)use($f,$q,$digits,$phoneQuery){
        if($f['month']!=='all'&&!str_starts_with($r['date'],$f['month']))return false;
        if($f['scope']!=='all'&&(bool)$r['isTest']!==($f['scope']==='test'))return false;
        if($f['team']!==''&&$r['team']!==$f['team'])return false;
        if($f['status']!==''&&$r['status']!==$f['status'])return false;
        if($f['employee']!==''&&(int)$r['employeeId']!==(int)$f['employee'])return false;
        if(($f['from']&&$r['date']<$f['from'])||($f['to']&&$r['date']>$f['to']))return false;
        $region=mb_strtolower($f['region']??'');if($region!==''&&!str_contains(mb_strtolower((string)($r['consultationPlace']??'').' '.(string)($r['address']??'')),$region))return false;
        if($q!==''){
            $name=mb_strtolower((string)($r['customer']??''));
            if(!str_contains($name,$q)&&!($phoneQuery&&str_contains(sales_phone_key((string)($r['phone']??'')),$digits)))return false;
        }
        return true;
    }));
    usort($rows,fn($a,$b)=>strcmp($b['date'],$a['date'])?:strnatcmp($b['id'],$a['id']));return $rows;
}
function intake_url(array $filters=[],array $extra=[]): string {return '/intake.php?'.http_build_query(array_replace(['role'=>'admin'],$filters,$extra));}
function intake_status(string $status): string {return ['pending'=>'가접수','normal'=>'정상접수','as'=>'A/S'][$status]??$status;}
function intake_time(string $value): string {return (new DateTimeImmutable($value,new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Seoul'))->format('Y-m-d H:i:s');}
function intake_status_datetime(mixed $value): string {
    $value=intake_text($value,16);$value=str_replace('T',' ',$value);
    $date=DateTimeImmutable::createFromFormat('!Y-m-d H:i',$value,new DateTimeZone('Asia/Seoul'));
    hr_assert($date!==false&&$date->format('Y-m-d H:i')===$value,'상태 변경 날짜·시간을 올바르게 입력해 주세요.');
    return $value;
}
function intake_status_changed_at(string $id): string {
    $q=db()->prepare("SELECT before_data,after_data,created_at FROM intake_management_events WHERE record_key=? AND action IN ('edit','status') ORDER BY id DESC");$q->execute([$id]);
    foreach($q->fetchAll() as $event){$after=json_decode($event['after_data'],true,512,JSON_THROW_ON_ERROR);if(isset($after['statusChangedAt']))return (string)$after['statusChangedAt'];$before=json_decode($event['before_data'],true,512,JSON_THROW_ON_ERROR);if(isset($after['status'],$before['status'])&&$after['status']!==$before['status'])return substr(intake_time($event['created_at']),0,16);}
    return '';
}
function intake_audit(string $id,array $user,string $action,array $before,array $after,string $reason): void {
    if(isset($before['status'],$after['status'])&&$before['status']!==$after['status']&&!isset($after['statusChangedAt'])){$before['statusChangedAt']=intake_status_changed_at($id);$after['statusChangedAt']=(new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul')))->format('Y-m-d H:i');}
    $q=db()->prepare('INSERT INTO intake_management_events(record_key,actor_id,action,before_data,after_data,reason) VALUES(?,?,?,?,?,?)');$q->execute([$id,$user['id'],$action,hr_json($before),hr_json($after),$reason]);
}
// The memo is versioned with the receipt edit, so its value and author/time commit together.
function intake_premium_memo(string $id,string $field='premiumMemo'): string {
    $q=db()->prepare("SELECT after_data FROM intake_management_events WHERE record_key=? AND action IN ('edit','create') ORDER BY id DESC");$q->execute([$id]);
    while($json=$q->fetchColumn()){$after=json_decode($json,true,512,JSON_THROW_ON_ERROR);if(array_key_exists($field,$after))return (string)$after[$field];}
    return '';
}
function intake_history(array $user,string $id): array {
    intake_admin($user);$q=db()->prepare('SELECT e.action,e.before_data,e.after_data,e.reason,e.created_at,u.display_name AS actor FROM intake_management_events e JOIN app_users u ON u.id=e.actor_id WHERE record_key=? ORDER BY e.id DESC LIMIT 100');$q->execute([$id]);$rows=$q->fetchAll();
    foreach($rows as &$row){$row['before']=json_decode($row['before_data'],true,512,JSON_THROW_ON_ERROR);$row['after']=json_decode($row['after_data'],true,512,JSON_THROW_ON_ERROR);}unset($row);
    if(ctype_digit($id)){
        $q=db()->prepare('SELECT e.old_status,e.new_status,e.created_at,u.display_name AS actor FROM sales_events e JOIN app_users u ON u.id=e.actor_id WHERE sale_id=? ORDER BY e.id DESC LIMIT 100');$q->execute([(int)$id]);
        foreach($q->fetchAll() as $r)$rows[]=['action'=>$r['old_status']===''?'create':'status','before'=>['status'=>$r['old_status']],'after'=>['status'=>$r['new_status']],'reason'=>'','created_at'=>$r['created_at'],'actor'=>$r['actor']];
    }
    usort($rows,fn($a,$b)=>strcmp($b['created_at'],$a['created_at']));return array_slice($rows,0,100);
}
// Callers must supply only records they are allowed to read; null is for an already authorized administrator.
function intake_outstanding_recalls(?array $recordIds=null): array {
    if($recordIds===[])return [];$d=db();$requests=[];$params=$recordIds===null?[]:array_values(array_unique(array_map('strval',$recordIds)));
    $q=$d->prepare("SELECT e.id,e.record_key,e.action,e.after_data,e.reason,e.created_at,u.display_name AS actor FROM intake_management_events e JOIN app_users u ON u.id=e.actor_id WHERE e.action IN ('recall','resubmit')".($recordIds===null?'':' AND e.record_key IN ('.implode(',',array_fill(0,count($params),'?')).')')." AND NOT EXISTS (SELECT 1 FROM intake_management_events later WHERE later.record_key=e.record_key AND later.id>e.id AND later.action IN ('recall','resubmit','status','hold')) ORDER BY e.id");$q->execute($params);
    foreach($q->fetchAll() as $event){$after=json_decode($event['after_data'],true,512,JSON_THROW_ON_ERROR);$event['carrier']=(string)($after['carrier']??'');$requests[$event['record_key']]=$event;}
    $ids=array_values(array_filter(array_keys($requests),fn($id)=>ctype_digit((string)$id)));
    if($ids){$q=$d->prepare("SELECT e.sale_id,MAX(e.created_at) AS handled_at FROM sales_events e JOIN app_users u ON u.id=e.actor_id WHERE u.role='admin' AND e.old_status<>'' AND e.sale_id IN (".implode(',',array_fill(0,count($ids),'?')).") GROUP BY e.sale_id");$q->execute($ids);foreach($q->fetchAll() as $event){$id=(string)$event['sale_id'];if($event['handled_at']>=$requests[$id]['created_at'])unset($requests[$id]);}}
    return $requests;
}
function intake_recall_queue(array $user,array $filters): array {
    intake_admin($user);$d=db();$requests=intake_outstanding_recalls();
    if(!$requests)return [];
    $records=[];
    $q=$d->query("SELECT s.*,u.display_name AS employee_name,c.consultation_place FROM sales_records s JOIN app_users u ON u.id=s.employee_id LEFT JOIN sales_consultation_details c ON c.sale_id=s.id WHERE s.status='pending'");
    foreach($q->fetchAll() as $r){$id=(string)$r['id'];if(!isset($requests[$id]))continue;$records[]=['id'=>$id,'date'=>$r['first_date'],'employeeId'=>(int)$r['employee_id'],'employee'=>$r['employee_name'],'team'=>$r['department'],'customer'=>$r['customer_name'],'phone'=>$r['phone'],'carrier'=>$r['carrier'],'consultationPlace'=>$r['consultation_place']??'','note'=>$r['note'],'status'=>'pending','revision'=>(int)$r['revision'],'isTest'=>(bool)$r['is_test']];}
    if($filters['scope']!=='real')foreach($d->query('SELECT t.state,t.revision,u.id,u.display_name,u.department FROM test_employee_data t JOIN app_users u ON u.id=t.user_id')->fetchAll() as $test){
        foreach(json_decode($test['state'],true,512,JSON_THROW_ON_ERROR)['sales']??[] as $sale){$id='test:'.$test['id'].':'.$sale['id'];if($sale['status']!=='가접수'||!isset($requests[$id]))continue;$records[]=['id'=>$id,'date'=>$sale['date'],'employeeId'=>(int)$test['id'],'employee'=>$test['display_name'],'team'=>$test['department'],'customer'=>$sale['name'],'phone'=>$sale['phone']??'','carrier'=>$sale['carrier']??'','consultationPlace'=>$sale['consultationPlace']??'','note'=>$sale['note']??'','status'=>'pending','revision'=>(int)$test['revision'],'isTest'=>true];}
    }
    $records=intake_filtered($records,array_replace($filters,['month'=>'','from'=>'','to'=>'','status'=>'pending']));$rows=[];
    foreach($records as $row){$row['recall']=$requests[$row['id']];$rows[]=$row;}
    usort($rows,fn($a,$b)=>strcmp($a['date'],$b['date'])?:strcmp($a['recall']['created_at'],$b['recall']['created_at'])?:strnatcmp($a['id'],$b['id']));return $rows;
}
function intake_recall_request(string $id,int $eventId): array {
    $q=db()->prepare("SELECT id,action,after_data,created_at FROM intake_management_events WHERE record_key=? AND action IN ('recall','resubmit','status','hold') ORDER BY id DESC LIMIT 1");$q->execute([$id]);$event=$q->fetch();
    hr_assert($event&&(int)$event['id']===$eventId&&in_array($event['action'],['recall','resubmit'],true),'이미 처리되었거나 새 재콜 요청이 있습니다. 새로고침해 주세요.');
    if(ctype_digit($id)){$q=db()->prepare("SELECT MAX(e.created_at) FROM sales_events e JOIN app_users u ON u.id=e.actor_id WHERE e.sale_id=? AND u.role='admin' AND e.old_status<>''");$q->execute([(int)$id]);$handled=$q->fetchColumn();hr_assert(!$handled||$handled<$event['created_at'],'다른 화면에서 처리한 요청입니다. 새로고침해 주세요.');}
    return json_decode($event['after_data'],true,512,JSON_THROW_ON_ERROR);
}
function intake_delete(array $user,string $id,int $revision): void {
    intake_admin($user);hr_assert(ctype_digit($id),'삭제할 접수 번호를 확인해 주세요.');$d=db();$d->beginTransaction();
    try{
        $q=$d->prepare('SELECT * FROM sales_records WHERE id=? FOR UPDATE');$q->execute([(int)$id]);$row=$q->fetch();
        hr_assert($row&&(int)$row['revision']===$revision,'접수 내용이 변경되었거나 이미 삭제됐습니다. 새로고침 후 확인해 주세요.');
        $archive=['sales_records'=>[$row]];
        $children=['sales_events','sales_consultation_details','sales_receipt_details','sales_birth_details','sales_counselor_details'];
        foreach($children as $table){$q=$d->prepare('SELECT * FROM '.$table.' WHERE sale_id=? FOR UPDATE');$q->execute([(int)$id]);$archive[$table]=$q->fetchAll();}
        intake_audit($id,$user,'delete',$archive,['deleted'=>true],'관리자가 접수증 삭제를 확인했습니다.');
        foreach($children as $table){$q=$d->prepare('DELETE FROM '.$table.' WHERE sale_id=?');$q->execute([(int)$id]);}
        $q=$d->prepare('DELETE FROM sales_records WHERE id=? AND revision=?');$q->execute([(int)$id,$revision]);hr_assert($q->rowCount()===1,'삭제 중 접수 내용이 변경됐습니다.');
        $d->commit();
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
function intake_update(array $user,array $in): void {
    intake_admin($user);$id=intake_text($in['id']??'',60);$revision=intake_number($in['revision']??0);$action=intake_text($in['action']??'',15);hr_assert(in_array($action,['status','edit','hold','delete'],true),'지원하지 않는 작업입니다.');
    if($action==='delete'){intake_delete($user,$id,$revision);return;}
    $reason=intake_text($in['reason']??'',500);if($action==='hold'&&$reason==='')$reason='내용 확인 후 가접수 유지';$status=intake_text($in['status']??'',10);hr_assert(in_array($status,['pending','normal','as'],true),'상태를 확인해 주세요.');
    $recallId=intake_number($in['recallEventId']??0);if($recallId)hr_assert(($action==='status'&&$status==='normal')||($action==='hold'&&$status==='pending'),'재콜 확인 작업을 다시 선택해 주세요.');
    $d=db();$d->beginTransaction();
    try{
        if(preg_match('/^test:(\d+):(\d+)$/D',$id,$m)){
            hr_assert(in_array($action,['status','hold'],true),'이전 테스트 자료는 상태만 변경할 수 있습니다.');
            $q=$d->prepare('SELECT state,revision FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([(int)$m[1]]);$row=$q->fetch();hr_assert($row&&(int)$row['revision']===$revision,'자료가 변경됐습니다. 새로고침 후 확인해 주세요.');
            $request=$recallId?intake_recall_request($id,$recallId):null;$state=json_decode($row['state'],true,512,JSON_THROW_ON_ERROR);$found=false;$after=['status'=>$status];
            foreach($state['sales'] as &$sale)if((int)$sale['id']===(int)$m[2]){$before=['status'=>['가접수'=>'pending','정상'=>'normal','A/S'=>'as'][$sale['status']]];if($request){hr_assert($before['status']==='pending','가접수 상태를 다시 확인해 주세요.');if($status==='normal'&&($request['carrier']??'')!==''){$before['carrier']=$sale['carrier']??'';$sale['carrier']=intake_text($request['carrier'],100);$after['carrier']=$sale['carrier'];}}$sale['status']=['pending'=>'가접수','normal'=>'정상','as'=>'A/S'][$status];$found=true;}unset($sale);
            hr_assert($found,'접수를 찾을 수 없습니다.');hr_assert($action==='hold'?($before['status']==='pending'&&$status==='pending'):$before['status']!==$status,'현재 상태를 다시 확인해 주세요.');
            $q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),(int)$m[1]]);
            if($recallId)$after['recallEventId']=$recallId;intake_audit($id,$user,$action,$before,$after,$reason);
        }else{
            hr_assert(ctype_digit($id),'접수 번호를 확인해 주세요.');$q=$d->prepare('SELECT * FROM sales_records WHERE id=? FOR UPDATE');$q->execute([(int)$id]);$row=$q->fetch();hr_assert((bool)$row,'접수를 찾을 수 없습니다.');hr_assert((int)$row['revision']===$revision,'다른 화면에서 변경했습니다. 새로고침 후 다시 확인해 주세요.');
            $request=$recallId?intake_recall_request($id,$recallId):null;if($request)hr_assert($row['status']==='pending','가접수 상태를 다시 확인해 주세요.');
            if(in_array($action,['status','hold'],true)){
                hr_assert($action==='hold'?($row['status']==='pending'&&$status==='pending'):$row['status']!==$status,'현재 상태를 다시 확인해 주세요.');
                $before=['status'=>$row['status']];$after=['status'=>$status];$carrier=$row['carrier'];if($request&&$status==='normal'&&($request['carrier']??'')!==''){$carrier=intake_text($request['carrier'],100);$before['carrier']=$row['carrier'];$after['carrier']=$carrier;}if($recallId)$after['recallEventId']=$recallId;
                $q=$d->prepare('UPDATE sales_records SET status=?,carrier=?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?');$q->execute([$status,$carrier,(int)$id]);
                intake_audit($id,$user,$action,$before,$after,$reason);
            }else{
                $employee=sales_edit_employee($user,$in,(int)$row['employee_id'],(bool)$row['is_test']);$in['counselorName']=$employee['display_name'];
                $fields=['customer_name'=>['customer',100],'phone'=>['phone',20],'carrier'=>['carrier',100],'note'=>['note',1000]];$next=[];
                foreach($fields as $column=>[$key,$max])$next[$column]=intake_text($in[$key]??'',$max);
                hr_assert($next['customer_name']!==''&&preg_match('/^[0-9-]{9,15}$/D',$next['phone']),'고객명과 전화번호를 확인해 주세요.');
                $time=intake_text($in['consultationTime']??'',5);$place=intake_text($in['consultationPlace']??'',500);$band=intake_text($in['premiumBand']??'',6);
                hr_assert($time===''||preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/D',$time),'상담 시간을 확인해 주세요.');hr_assert(in_array($band,['','100000','200000','300000'],true),'보험료 구분을 확인해 주세요.');
                $q=$d->prepare('SELECT consultation_time,consultation_place,premium_band FROM sales_consultation_details WHERE sale_id=?');$q->execute([(int)$id]);$details=$q->fetch();
                $q=$d->prepare('SELECT gender,call_availability AS callAvailability,visit_schedule AS visitSchedule FROM sales_receipt_details WHERE sale_id=?');$q->execute([(int)$id]);$receiptRow=$q->fetch();$currentReceipt=($receiptRow?:[])+sales_counselor_fields((int)$id);$receipt=sales_receipt_fields($in,$currentReceipt);
                $beforeReceipt=sales_receipt_fields([],$currentReceipt);
                $q=$d->prepare('SELECT birth_date FROM sales_birth_details WHERE sale_id=?');$q->execute([(int)$id]);$storedBirth=$q->fetchColumn();
                $beforeBirth=['birth_date'=>$storedBirth===false?'':(string)$storedBirth,'birth_year'=>(int)$row['birth_year'],'insurance_kind'=>(string)$row['insurance_kind']];$afterBirth=$beforeBirth;
                // Older callers may omit the date, and year-only records must not gain an invented birthday.
                if(array_key_exists('birthDate',$in)){
                    $birthDate=intake_text($in['birthDate'],10);
                    hr_assert($birthDate!==''||$beforeBirth['birth_date']==='','기존 생년월일을 지울 수 없습니다. 올바른 생년월일을 입력해 주세요.');
                    if($birthDate!==''){
                        hr_assert(hr_day($birthDate)&&$birthDate<=$row['first_date'],'생년월일은 올바른 날짜이며 최초 접수일 이전이어야 합니다.');$birthYear=(int)substr($birthDate,0,4);
                        hr_assert($birthYear>=1900,'출생연도를 확인해 주세요.');
                        $afterBirth=['birth_date'=>$birthDate,'birth_year'=>$birthYear,'insurance_kind'=>$employee['department']==='insurance'?sales_kind($birthYear,$row['first_date']):''];
                    }
                }
                $manualKind=intake_text($in['insuranceKind']??'',10);hr_assert(in_array($manualKind,['','general','silver'],true),'일반 또는 실버를 선택해 주세요.');
                if(($in['insuranceKindMode']??'')==='age'||$employee['department']!==$row['department'])$afterBirth['insurance_kind']=$employee['department']==='insurance'&&$afterBirth['birth_year']>=1900?sales_kind($afterBirth['birth_year'],$row['first_date']):'';
                elseif($manualKind!==''){hr_assert($employee['department']==='insurance','보험팀 접수에서만 상품 구분을 변경할 수 있습니다.');$afterBirth['insurance_kind']=$manualKind;}
                elseif($afterBirth['birth_date']===$beforeBirth['birth_date'])$afterBirth['insurance_kind']=$beforeBirth['insurance_kind'];
                $before=[];foreach(array_keys($next) as $column)$before[$column]=(string)$row[$column];
                $before+=$beforeReceipt+$beforeBirth+['employee_id'=>(int)$row['employee_id'],'department'=>$row['department'],'consultation_time'=>(string)($details['consultation_time']??''),'consultation_place'=>(string)($details['consultation_place']??''),'premium_band'=>(string)($details['premium_band']??''),'status'=>$row['status']];
                $after=$next+$receipt+$afterBirth+['employee_id'=>(int)$employee['id'],'department'=>$employee['department'],'consultation_time'=>$time,'consultation_place'=>$place,'premium_band'=>$band,'status'=>$status];
                $before['premiumMemo']=intake_premium_memo($id);$after['premiumMemo']=intake_text($in['premiumMemo']??$before['premiumMemo'],500);
                $before['receiptMemo']=intake_premium_memo($id,'receiptMemo');$after['receiptMemo']=intake_text($in['receiptMemo']??$before['receiptMemo'],500);
                if(array_key_exists('statusChangedAt',$in)){$before['statusChangedAt']=intake_status_changed_at($id);$after['statusChangedAt']=intake_status_datetime($in['statusChangedAt']);}
                hr_assert($before!==$after,'변경된 내용이 없습니다.');
                $q=$d->prepare('UPDATE sales_records SET employee_id=?,department=?,customer_name=?,phone=?,carrier=?,note=?,birth_year=?,insurance_kind=?,status=?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?');$q->execute([(int)$employee['id'],$employee['department'],$next['customer_name'],$next['phone'],$next['carrier'],$next['note'],$afterBirth['birth_year'],$afterBirth['insurance_kind'],$status,(int)$id]);
                if($afterBirth['birth_date']!==$beforeBirth['birth_date']){
                    $q=$d->prepare($storedBirth===false?'INSERT INTO sales_birth_details(birth_date,sale_id) VALUES(?,?)':'UPDATE sales_birth_details SET birth_date=? WHERE sale_id=?');$q->execute([$afterBirth['birth_date'],(int)$id]);
                }
                if($details){$q=$d->prepare('UPDATE sales_consultation_details SET consultation_time=?,consultation_place=?,premium_band=? WHERE sale_id=?');$q->execute([$time,$place,$band,(int)$id]);}
                else{$q=$d->prepare('INSERT INTO sales_consultation_details(sale_id,consultation_time,consultation_place,premium_band) VALUES(?,?,?,?)');$q->execute([(int)$id,$time,$place,$band]);}
                if($receiptRow){$q=$d->prepare('UPDATE sales_receipt_details SET gender=?,call_availability=?,visit_schedule=? WHERE sale_id=?');$q->execute([$receipt['gender'],$receipt['callAvailability'],$receipt['visitSchedule'],(int)$id]);}
                else{$q=$d->prepare('INSERT INTO sales_receipt_details(sale_id,gender,call_availability,visit_schedule) VALUES(?,?,?,?)');$q->execute([(int)$id,$receipt['gender'],$receipt['callAvailability'],$receipt['visitSchedule']]);}
                sales_save_counselor((int)$id,$receipt['counselorName']);
                intake_audit($id,$user,'edit',$before,$after,$reason);
                // A status change here must close outstanding requests just like the status-only action.
                if($row['status']!==$status)intake_audit($id,$user,'status',['status'=>$row['status']],['status'=>$status]+(isset($after['statusChangedAt'])?['statusChangedAt'=>$after['statusChangedAt']]:[]),$reason);
            }
        }
        $d->commit();
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
function intake_create(array $user,array $post): array {
    intake_admin($user);$in=['action'=>'create','employeeId'=>intake_number($post['employeeId']??0)];
    foreach(['date'=>10,'customer'=>100,'phone'=>20,'birthDate'=>10,'carrier'=>100,'note'=>1000,'premiumMemo'=>500,'receiptMemo'=>500,'consultationTime'=>5,'consultationPlace'=>500,'premiumBand'=>6,'requestKey'=>36,'gender'=>4,'callAvailability'=>200,'visitSchedule'=>500,'counselorName'=>100] as $key=>$max)$in[$key]=intake_text($post[$key]??'',$max);
    hr_assert(hr_day($in['birthDate']),'생년월일을 입력해 주세요.');[$in['birthYear'],$in['birthMonth'],$in['birthDay']]=explode('-',$in['birthDate']);
    $in['duplicateConfirmed']=($post['duplicateConfirmed']??'')==='1';sales_mutate($user,$in);$q=db()->prepare('SELECT id,is_test FROM sales_records WHERE request_key=?');$q->execute([$in['requestKey']]);return $q->fetch();
}
function intake_csv_cell(mixed $value): string {$s=(string)$value;return preg_match('/^[\s\x00-\x1f]*[=+@-]/u',$s)?"'".$s:$s;}


/** Small, authenticated search response; never send full receipt payloads to the browser. */
function intake_live_search(array $user,string $query,string $scope='real'): array {
    intake_admin($user);$query=intake_text($query,80);hr_assert(in_array($scope,['real','test','all'],true),'자료 구분을 확인해 주세요.');
    if($query==='')return ['records'=>[],'hasMore'=>false];
    $phoneQuery=preg_match('/^[0-9\s()+.\-]+$/uD',$query)===1;$digits=preg_replace('/\D/','',$query);
    $needle=$phoneQuery?$digits:$query;if($needle==='')return ['records'=>[],'hasMore'=>false];
    $pattern='%'.str_replace(['!','%','_'],['!!','!%','!_'],$needle).'%';
    $column=$phoneQuery?"REPLACE(REPLACE(s.phone,'-',''),' ','')":'s.customer_name';
    $sql="SELECT s.id,s.first_date AS date,s.customer_name AS customer,s.phone,s.status,s.is_test,s.employee_id AS employeeId,u.display_name AS employee,u.display_name AS counselorName FROM sales_records s JOIN app_users u ON u.id=s.employee_id WHERE ".$column." LIKE ? ESCAPE '!'";
    $params=[$pattern];if($scope!=='all'){$sql.=' AND s.is_test=?';$params[]=$scope==='test'?1:0;}
    $q=db()->prepare($sql.' ORDER BY s.first_date DESC,s.id DESC LIMIT 21');$q->execute($params);$rows=[];
    foreach($q->fetchAll() as $row){$row['id']=(string)$row['id'];$row['isTest']=(bool)$row['is_test'];unset($row['is_test']);$rows[]=$row;}
    if($scope!=='real'){
        $q=db()->query('SELECT t.user_id,t.state,u.display_name AS employee FROM test_employee_data t JOIN app_users u ON u.id=t.user_id');
        foreach($q->fetchAll() as $owner)foreach(json_decode($owner['state'],true,512,JSON_THROW_ON_ERROR)['sales']??[] as $sale){
            $value=$phoneQuery?sales_phone_key((string)($sale['phone']??'')):mb_strtolower((string)($sale['name']??''));
            if(!str_contains($value,mb_strtolower($needle)))continue;
            $rows[]=['id'=>'test:'.$owner['user_id'].':'.$sale['id'],'date'=>$sale['date'],'customer'=>$sale['name'],'phone'=>$sale['phone']??'','status'=>['가접수'=>'pending','정상'=>'normal','A/S'=>'as'][$sale['status']]??'pending','employee'=>$owner['employee'],'counselorName'=>$owner['employee'],'employeeId'=>(int)$owner['user_id'],'isTest'=>true];
        }
    }
    usort($rows,fn($a,$b)=>strcmp($b['date'],$a['date'])?:strnatcmp($b['id'],$a['id']));
    return ['records'=>array_slice($rows,0,20),'hasMore'=>count($rows)>20];
}
