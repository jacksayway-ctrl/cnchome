<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';

function sales_kind(int $birthYear, string $date): string {
    $age=(int)substr($date,0,4)-$birthYear+1;
    hr_assert($age>=1&&$age<=70,'보험 접수는 세는나이 70세까지 가능합니다.');
    return $age<=60?'general':'silver';
}
function sales_month(string $month): bool {return (bool)preg_match('/^\d{4}-(0[1-9]|1[0-2])$/D',$month);}
function sales_test_user(array $user): bool {
    if(($user['role']??'')!=='employee'||(int)($user['id']??0)<=0)return false;
    // Resolve classification from the account, never from a posted flag or partial caller metadata.
    $q=db()->prepare('SELECT username,display_name,role FROM app_users WHERE id=?');$q->execute([(int)$user['id']]);
    return cnc_test_user($q->fetch()?:[]);
}
class SalesDuplicate extends RuntimeException {
    public function __construct(public readonly int $count){parent::__construct('같은 이름과 전화번호로 접수된 기존 자료가 있습니다.');}
}
function sales_customer_key(string $name): string {return preg_replace('/\s+/u','',preg_replace('/(?:\s*\(중복\))+\s*$/u','',trim($name)));}
function sales_phone_key(string $phone): string {return preg_replace('/\D/','',$phone);}
function sales_duplicate_count(array $employee,string $name,string $phone): int {
    $test=cnc_test_user($employee);$nameKey=sales_customer_key($name);$phoneKey=sales_phone_key($phone);$d=db();$count=0;
    $q=$d->prepare("SELECT customer_name FROM sales_records WHERE is_test=? AND REPLACE(REPLACE(phone,'-',''),' ','')=? FOR UPDATE");$q->execute([$test?1:0,$phoneKey]);
    foreach($q->fetchAll() as $row)if(sales_customer_key($row['customer_name'])===$nameKey)$count++;
    if($test){$q=$d->query('SELECT t.state,u.username,u.display_name,u.role FROM test_employee_data t JOIN app_users u ON u.id=t.user_id');foreach($q->fetchAll() as $row){if(!cnc_test_user($row))continue;$state=json_decode($row['state'],true,512,JSON_THROW_ON_ERROR);foreach($state['sales']??[] as $sale)if(sales_phone_key($sale['phone']??'')===$phoneKey&&sales_customer_key($sale['name']??'')===$nameKey)$count++;}}
    return $count;
}
function sales_counselor_fields(int $saleId): array {
    $q=db()->prepare('SELECT counselor_name FROM sales_counselor_details WHERE sale_id=?');$q->execute([$saleId]);$value=$q->fetchColumn();return ['counselorName'=>$value===false?'':(string)$value];
}
function sales_save_counselor(int $saleId,string $name): void {
    $d=db();$q=$d->prepare('SELECT sale_id FROM sales_counselor_details WHERE sale_id=?');$q->execute([$saleId]);$exists=$q->fetchColumn()!==false;
    $q=$d->prepare($exists?'UPDATE sales_counselor_details SET counselor_name=? WHERE sale_id=?':'INSERT INTO sales_counselor_details(counselor_name,sale_id) VALUES(?,?)');$q->execute([$name,$saleId]);
}
function sales_receipt_fields(array $in,array $current=[]): array {
    $fields=[];foreach(['gender'=>4,'callAvailability'=>200,'visitSchedule'=>500,'counselorName'=>100] as $key=>$max){$value=$in[$key]??$current[$key]??'';hr_assert(is_string($value)&&mb_strlen($value)<=$max,'상담원·성별·통화 가능시간·방문 내용을 확인해 주세요.');$fields[$key]=trim($value);}
    hr_assert(in_array($fields['gender'],['','남','여'],true),'성별을 확인해 주세요.');return $fields;
}
function sales_counselor_names(array $user): array {
    $d=db();$q=$d->prepare('SELECT id,username,display_name,role,department FROM app_users WHERE id=? AND active=1');$q->execute([(int)($user['id']??0)]);$account=$q->fetch();
    if(!$account)return [];
    $names=[];$own=trim((string)$account['display_name']);if($own!=='')$names[]=$own;
    $admin=$account['role']==='admin';$test=cnc_test_user($account);
    $q=$d->prepare("SELECT u.username,u.display_name,u.role FROM app_users u LEFT JOIN employee_memberships m ON m.user_id=u.id WHERE u.role='employee' AND u.active=1 AND (m.status IS NULL OR m.status='approved')".($admin?'':' AND u.department=?').' ORDER BY u.display_name,u.id');
    $q->execute($admin?[]:[$account['department']]);
    foreach($q->fetchAll() as $row){if(!$test&&cnc_test_user($row))continue;$name=trim((string)$row['display_name']);if($name!==''&&!in_array($name,$names,true))$names[]=$name;}
    return $names;
}
function sales_snapshot(array $user,string $month): array {
    hr_assert(sales_month($month),'조회할 월을 확인해 주세요.');
    $admin=$user['role']==='admin';$d=db();$test=sales_test_user($user);
    $q=$d->prepare('SELECT s.*,u.display_name AS employee_name,c.consultation_time,c.consultation_place,c.premium_band,b.birth_date,rd.gender,rd.call_availability,rd.visit_schedule,cc.counselor_name,rd.created_at AS receipt_created_at FROM sales_records s JOIN app_users u ON u.id=s.employee_id LEFT JOIN sales_consultation_details c ON c.sale_id=s.id LEFT JOIN sales_birth_details b ON b.sale_id=s.id LEFT JOIN sales_receipt_details rd ON rd.sale_id=s.id LEFT JOIN sales_counselor_details cc ON cc.sale_id=s.id WHERE s.first_date>=? AND s.first_date<?'.($admin?'':' AND s.employee_id=?'.($test?'':' AND s.is_test=0')).' ORDER BY s.first_date,s.id');
    // Include the adjoining days so a selectable seven-day week is complete at month boundaries.
    $start=(new DateTimeImmutable($month.'-01'))->modify('-6 days')->format('Y-m-d');
    $next=(new DateTimeImmutable($month.'-01'))->modify('+1 month')->modify('+6 days')->format('Y-m-d');
    $q->execute($admin?[$start,$next]:[$start,$next,$user['id']]);$records=[];
    foreach($q->fetchAll() as $r)$records[]=['id'=>(string)$r['id'],'date'=>$r['first_date'],'employeeId'=>(int)$r['employee_id'],'employee'=>$r['employee_name'],'team'=>$r['department'],'customer'=>$r['customer_name'],'carrier'=>$r['carrier'],'kind'=>$r['insurance_kind'],'status'=>$r['status'],'revision'=>(int)$r['revision'],'isTest'=>(bool)$r['is_test'],'phone'=>$r['phone'],'address'=>$r['address'],'birthYear'=>(int)$r['birth_year'],'birthDate'=>$r['birth_date']??'','note'=>$r['note'],'consultationTime'=>$r['consultation_time']??'','consultationPlace'=>$r['consultation_place']??'','premiumBand'=>$r['premium_band']??'','gender'=>$r['gender']??'','callAvailability'=>$r['call_availability']??'','visitSchedule'=>$r['visit_schedule']??'','counselorName'=>$r['counselor_name']??'','receivedAt'=>$r['receipt_created_at']??''];
    // Fixture rows are available only to dedicated test accounts and administrator management.
    if($admin||$test){
    $q=$d->prepare('SELECT t.state,t.revision,u.id,u.display_name,u.department FROM test_employee_data t JOIN app_users u ON u.id=t.user_id'.($admin?'':' WHERE u.id=?'));
    $q->execute($admin?[]:[$user['id']]);
    foreach($q->fetchAll() as $r){$state=json_decode($r['state'],true,512,JSON_THROW_ON_ERROR);foreach($state['sales']??[] as $sale){if($sale['date']<$start||$sale['date']>=$next)continue;$status=['정상'=>'normal','가접수'=>'pending','A/S'=>'as'][$sale['status']]??null;if(!$status)continue;$records[]=['id'=>'test:'.$r['id'].':'.$sale['id'],'date'=>$sale['date'],'employeeId'=>(int)$r['id'],'employee'=>$r['display_name'],'team'=>$r['department'],'customer'=>$sale['name'],'carrier'=>$sale['carrier'],'kind'=>$sale['kind']==='실버'?'silver':'general','status'=>$status,'revision'=>(int)$r['revision'],'isTest'=>true,'phone'=>$sale['phone']??'','birthDate'=>$sale['birthDate']??'','birthYear'=>(int)($sale['birthYear']??substr($sale['birthDate']??'',0,4)),'note'=>$sale['note']??'','consultationTime'=>$sale['consultationTime']??'','consultationPlace'=>$sale['consultationPlace']??'','premiumBand'=>$sale['premiumBand']??'','gender'=>$sale['gender']??'','callAvailability'=>$sale['callAvailability']??'','visitSchedule'=>$sale['visitSchedule']??'','counselorName'=>$sale['counselorName']??''];}}
    }
    $staff=$admin?$d->query("SELECT id,display_name AS name,department AS team FROM app_users WHERE role='employee' AND active=1 ORDER BY id")->fetchAll():[];
    return ['records'=>$records,'staff'=>$staff,'counselorNames'=>sales_counselor_names($user),'isTestAccount'=>$test,'month'=>$month,'today'=>hr_today(),'fetchedAt'=>gmdate('c')];
}
function sales_mutate(array $user,array $in): void {
    $d=db();$d->beginTransaction();
    try {
        $action=$in['action']??'';
        if($action==='create'){
            $owner=$user['role']==='admin'?($in['employeeId']??0):$user['id'];
            $q=$d->prepare("SELECT id,username,display_name,role,department FROM app_users WHERE id=? AND active=1 AND role='employee'");$q->execute([$owner]);$employee=$q->fetch();hr_assert((bool)$employee,'담당 직원을 선택해 주세요.');
            $date=(string)($in['date']??hr_today());hr_assert(hr_day($date)&&$date<=hr_today(),'접수일을 확인해 주세요.');
            $name=trim((string)($in['customer']??''));$phone=trim((string)($in['phone']??''));$address=trim((string)($in['address']??''));$carrier=trim((string)($in['carrier']??''));$note=trim((string)($in['note']??''));
            $consultationTime=trim((string)($in['consultationTime']??''));$consultationPlace=trim((string)($in['consultationPlace']??''));$premiumBand=(string)($in['premiumBand']??'');$receipt=sales_receipt_fields($in);
            hr_assert($consultationTime===''||(bool)preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/D',$consultationTime),'상담 시간을 확인해 주세요.');
            hr_assert(mb_strlen($consultationPlace)<=500,'상담 장소는 500자 이내로 입력해 주세요.');
            hr_assert(in_array($premiumBand,['','100000','200000','300000'],true),'현재 납부 보험료를 선택해 주세요.');
            hr_assert($name!==''&&mb_strlen($name)<=100,'고객명을 확인해 주세요.');hr_assert((bool)preg_match('/^[0-9-]{9,15}$/D',$phone),'전화번호를 확인해 주세요.');
            hr_assert(mb_strlen($address)<=500,'주소는 500자 이내로 입력해 주세요.');hr_assert(mb_strlen($carrier)<=100&&mb_strlen($note)<=1000,'접수 코드·메모 길이를 확인해 주세요.');
            $birth=filter_var($in['birthYear']??null,FILTER_VALIDATE_INT);hr_assert($birth!==false&&$birth>=1900&&$birth<=(int)substr($date,0,4),'출생연도를 확인해 주세요.');
            $birthDate='';$birthMonth=$in['birthMonth']??'';$birthDay=$in['birthDay']??'';
            if($birthMonth!==''||$birthDay!==''){
                hr_assert((is_string($birthMonth)||is_int($birthMonth))&&(is_string($birthDay)||is_int($birthDay)),'생년월일을 확인해 주세요.');
                hr_assert((bool)preg_match('/^\d{1,2}$/D',(string)$birthMonth)&&(bool)preg_match('/^\d{1,2}$/D',(string)$birthDay)&&checkdate((int)$birthMonth,(int)$birthDay,$birth),'올바른 생년월일을 입력해 주세요.');
                $birthDate=sprintf('%04d-%02d-%02d',$birth,(int)$birthMonth,(int)$birthDay);hr_assert($birthDate<=$date,'생년월일은 접수일 이후일 수 없습니다.');
            }
            $kind=$employee['department']==='insurance'?sales_kind($birth,$date):'';
            $key=(string)($in['requestKey']??'');hr_assert((bool)preg_match('/^[a-f0-9-]{36}$/D',$key),'접수 화면을 다시 열어 주세요.');
            $q=$d->prepare('SELECT employee_id,is_test FROM sales_records WHERE request_key=?');$q->execute([$key]);$existing=$q->fetch();
            if($existing){hr_assert((int)$existing['employee_id']===(int)$owner,'접수 요청을 확인해 주세요.');if($user['role']!=='admin'&&!cnc_test_user($employee)&&!empty($existing['is_test']))throw new HRForbidden('접수 요청을 확인해 주세요.');$d->commit();return;}
            $duplicates=sales_duplicate_count($employee,$name,$phone);
            if($duplicates){if(($in['duplicateConfirmed']??false)!==true)throw new SalesDuplicate($duplicates);$name=mb_substr(preg_replace('/(?:\s*\(중복\))+\s*$/u','',trim($name)),0,95).' (중복)';}
            $q=$d->prepare("INSERT INTO sales_records(employee_id,department,first_date,customer_name,phone,address,carrier,insurance_kind,birth_year,note,status,is_test,request_key) VALUES(?,?,?,?,?,?,?,?,?,?,'pending',?,?)");
            $q->execute([$owner,$employee['department'],$date,$name,$phone,$address,$carrier,$kind,$birth,$note,cnc_test_user($employee)?1:0,$key]);
            $id=(int)$d->lastInsertId();sales_save_counselor($id,$receipt['counselorName']);
            $q=$d->prepare('INSERT INTO sales_receipt_details(sale_id,gender,call_availability,visit_schedule) VALUES(?,?,?,?)');$q->execute([$id,$receipt['gender'],$receipt['callAvailability'],$receipt['visitSchedule']]);
            $q=$d->prepare('INSERT INTO sales_consultation_details(sale_id,consultation_time,consultation_place,premium_band) VALUES(?,?,?,?)');$q->execute([$id,$consultationTime,$consultationPlace,$premiumBand]);
            if($birthDate!==''){$q=$d->prepare('INSERT INTO sales_birth_details(sale_id,birth_date) VALUES(?,?)');$q->execute([$id,$birthDate]);}
            $q=$d->prepare('INSERT INTO sales_events(sale_id,actor_id,old_status,new_status) VALUES(?,?,?,?)');$q->execute([$id,$user['id'],'','pending']);
        }elseif($action==='status'){
            $status=$in['status']??'';hr_assert(in_array($status,['pending','normal','as'],true),'접수 상태를 확인해 주세요.');$id=(string)($in['id']??'');
            if(preg_match('/^test:(\d+):(\d+)$/D',$id,$match)){
                if($user['role']!=='admin'&&((int)$match[1]!=(int)$user['id']||!sales_test_user($user)))throw new HRForbidden('본인 접수만 변경할 수 있습니다.');
                $q=$d->prepare('SELECT state,revision FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([(int)$match[1]]);$r=$q->fetch();hr_assert((bool)$r,'접수를 찾을 수 없습니다.');hr_assert((int)$r['revision']===($in['revision']??null),'다른 화면에서 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
                $state=json_decode($r['state'],true,512,JSON_THROW_ON_ERROR);$found=false;foreach($state['sales'] as &$sale){if((int)$sale['id']===(int)$match[2]){$sale['status']=['pending'=>'가접수','normal'=>'정상','as'=>'A/S'][$status];$found=true;}}unset($sale);hr_assert($found,'접수를 찾을 수 없습니다.');
                $q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),(int)$match[1]]);
            }else{
                hr_assert(ctype_digit($id),'접수를 확인해 주세요.');$q=$d->prepare('SELECT * FROM sales_records WHERE id=? FOR UPDATE');$q->execute([(int)$id]);$r=$q->fetch();hr_assert((bool)$r,'접수를 찾을 수 없습니다.');
                if($user['role']!=='admin'&&((int)$r['employee_id']!==(int)$user['id']||(!empty($r['is_test'])&&!sales_test_user($user))))throw new HRForbidden('본인 접수만 변경할 수 있습니다.');
                hr_assert((int)$r['revision']===($in['revision']??null),'다른 화면에서 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
                $q=$d->prepare('UPDATE sales_records SET status=?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?');$q->execute([$status,(int)$id]);
                $q=$d->prepare('INSERT INTO sales_events(sale_id,actor_id,old_status,new_status) VALUES(?,?,?,?)');$q->execute([(int)$id,$user['id'],$r['status'],$status]);
            }
        }else throw new InvalidArgumentException('지원하지 않는 접수 작업입니다.');
        $d->commit();
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
