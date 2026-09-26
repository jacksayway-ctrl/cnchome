<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';

function sales_kind(int $birthYear, string $date): string {
    $age=(int)substr($date,0,4)-$birthYear+1;
    hr_assert($age>=1&&$age<=70,'보험 접수는 세는나이 70세까지 가능합니다.');
    return $age<=61?'general':'silver';
}
function sales_month(string $month): bool {return (bool)preg_match('/^\d{4}-(0[1-9]|1[0-2])$/D',$month);}
function sales_test_user(array $user): bool {return ($user['username']??'')==='user1'&&($user['display_name']??'')==='테스트 직원';}
function sales_snapshot(array $user,string $month): array {
    hr_assert(sales_month($month),'조회할 월을 확인해 주세요.');
    $admin=$user['role']==='admin';$d=db();
    $q=$d->prepare('SELECT s.*,u.display_name AS employee_name FROM sales_records s JOIN app_users u ON u.id=s.employee_id WHERE s.first_date>=? AND s.first_date<?'.($admin?'':' AND s.employee_id=?').' ORDER BY s.first_date,s.id');
    // Include the adjoining days so a selectable seven-day week is complete at month boundaries.
    $start=(new DateTimeImmutable($month.'-01'))->modify('-6 days')->format('Y-m-d');
    $next=(new DateTimeImmutable($month.'-01'))->modify('+1 month')->modify('+6 days')->format('Y-m-d');
    $q->execute($admin?[$start,$next]:[$start,$next,$user['id']]);$records=[];
    foreach($q->fetchAll() as $r)$records[]=['id'=>(string)$r['id'],'date'=>$r['first_date'],'employeeId'=>(int)$r['employee_id'],'employee'=>$r['employee_name'],'team'=>$r['department'],'customer'=>$r['customer_name'],'carrier'=>$r['carrier'],'kind'=>$r['insurance_kind'],'status'=>$r['status'],'revision'=>(int)$r['revision'],'isTest'=>(bool)$r['is_test'],'phone'=>$r['phone'],'address'=>$r['address'],'birthYear'=>(int)$r['birth_year'],'note'=>$r['note']];
    // Keep existing test-account changes visible as explicitly marked test records.
    $q=$d->prepare('SELECT t.state,t.revision,u.id,u.display_name,u.department FROM test_employee_data t JOIN app_users u ON u.id=t.user_id'.($admin?'':' WHERE u.id=?'));
    $q->execute($admin?[]:[$user['id']]);
    foreach($q->fetchAll() as $r){$state=json_decode($r['state'],true,512,JSON_THROW_ON_ERROR);foreach($state['sales']??[] as $sale){if($sale['date']<$start||$sale['date']>=$next)continue;$status=['정상'=>'normal','가접수'=>'pending','A/S'=>'as'][$sale['status']]??null;if(!$status)continue;$records[]=['id'=>'test:'.$r['id'].':'.$sale['id'],'date'=>$sale['date'],'employeeId'=>(int)$r['id'],'employee'=>$r['display_name'],'team'=>$r['department'],'customer'=>$sale['name'],'carrier'=>$sale['carrier'],'kind'=>$sale['kind']==='실버'?'silver':'general','status'=>$status,'revision'=>(int)$r['revision'],'isTest'=>true];}}
    $staff=$admin?$d->query("SELECT id,display_name AS name,department AS team FROM app_users WHERE role='employee' AND active=1 ORDER BY id")->fetchAll():[];
    return ['records'=>$records,'staff'=>$staff,'month'=>$month,'today'=>hr_today(),'fetchedAt'=>gmdate('c')];
}
function sales_mutate(array $user,array $in): void {
    $d=db();$d->beginTransaction();
    try {
        $action=$in['action']??'';
        if($action==='create'){
            $owner=$user['role']==='admin'?($in['employeeId']??0):$user['id'];
            $q=$d->prepare("SELECT id,username,display_name,department FROM app_users WHERE id=? AND active=1 AND role='employee'");$q->execute([$owner]);$employee=$q->fetch();hr_assert((bool)$employee,'담당 직원을 선택해 주세요.');
            $date=(string)($in['date']??hr_today());hr_assert(hr_day($date)&&$date<=hr_today(),'접수일을 확인해 주세요.');
            $name=trim((string)($in['customer']??''));$phone=trim((string)($in['phone']??''));$address=trim((string)($in['address']??''));$carrier=trim((string)($in['carrier']??''));$note=trim((string)($in['note']??''));
            hr_assert($name!==''&&mb_strlen($name)<=100,'고객명을 확인해 주세요.');hr_assert((bool)preg_match('/^[0-9-]{9,15}$/D',$phone),'전화번호를 확인해 주세요.');hr_assert($address!==''&&mb_strlen($address)<=500&&mb_strlen($carrier)<=100&&mb_strlen($note)<=1000,'주소·접수 코드·메모 길이를 확인해 주세요.');
            $birth=filter_var($in['birthYear']??null,FILTER_VALIDATE_INT);hr_assert($birth!==false&&$birth>=1900&&$birth<=(int)substr($date,0,4),'출생연도를 확인해 주세요.');
            $kind=$employee['department']==='insurance'?sales_kind($birth,$date):'';
            $key=(string)($in['requestKey']??'');hr_assert((bool)preg_match('/^[a-f0-9-]{36}$/D',$key),'접수 화면을 다시 열어 주세요.');
            $q=$d->prepare('SELECT employee_id FROM sales_records WHERE request_key=?');$q->execute([$key]);$existing=$q->fetch();
            if($existing){hr_assert((int)$existing['employee_id']===(int)$owner,'접수 요청을 확인해 주세요.');$d->commit();return;}
            $q=$d->prepare("INSERT INTO sales_records(employee_id,department,first_date,customer_name,phone,address,carrier,insurance_kind,birth_year,note,status,is_test,request_key) VALUES(?,?,?,?,?,?,?,?,?,?,'pending',?,?)");
            $q->execute([$owner,$employee['department'],$date,$name,$phone,$address,$carrier,$kind,$birth,$note,sales_test_user($employee)?1:0,$key]);
            $id=(int)$d->lastInsertId();$q=$d->prepare('INSERT INTO sales_events(sale_id,actor_id,old_status,new_status) VALUES(?,?,?,?)');$q->execute([$id,$user['id'],'','pending']);
        }elseif($action==='status'){
            $status=$in['status']??'';hr_assert(in_array($status,['pending','normal','as'],true),'접수 상태를 확인해 주세요.');$id=(string)($in['id']??'');
            if(preg_match('/^test:(\d+):(\d+)$/D',$id,$match)){
                if($user['role']!=='admin'&&(int)$match[1]!=(int)$user['id'])throw new HRForbidden('본인 접수만 변경할 수 있습니다.');
                $q=$d->prepare('SELECT state,revision FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([(int)$match[1]]);$r=$q->fetch();hr_assert((bool)$r,'접수를 찾을 수 없습니다.');hr_assert((int)$r['revision']===($in['revision']??null),'다른 화면에서 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
                $state=json_decode($r['state'],true,512,JSON_THROW_ON_ERROR);$found=false;foreach($state['sales'] as &$sale){if((int)$sale['id']===(int)$match[2]){$sale['status']=['pending'=>'가접수','normal'=>'정상','as'=>'A/S'][$status];$found=true;}}unset($sale);hr_assert($found,'접수를 찾을 수 없습니다.');
                $q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),(int)$match[1]]);
            }else{
                hr_assert(ctype_digit($id),'접수를 확인해 주세요.');$q=$d->prepare('SELECT * FROM sales_records WHERE id=? FOR UPDATE');$q->execute([(int)$id]);$r=$q->fetch();hr_assert((bool)$r,'접수를 찾을 수 없습니다.');
                if($user['role']!=='admin'&&(int)$r['employee_id']!==(int)$user['id'])throw new HRForbidden('본인 접수만 변경할 수 있습니다.');
                hr_assert((int)$r['revision']===($in['revision']??null),'다른 화면에서 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
                $q=$d->prepare('UPDATE sales_records SET status=?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?');$q->execute([$status,(int)$id]);
                $q=$d->prepare('INSERT INTO sales_events(sale_id,actor_id,old_status,new_status) VALUES(?,?,?,?)');$q->execute([(int)$id,$user['id'],$r['status'],$status]);
            }
        }else throw new InvalidArgumentException('지원하지 않는 접수 작업입니다.');
        $d->commit();
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
