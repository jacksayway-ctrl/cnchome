<?php
declare(strict_types=1);
require_once __DIR__.'/sales.php';

function intake_admin(array $user): void {if(($user['role']??'')!=='admin')throw new HRForbidden('접수관리는 관리자만 사용할 수 있습니다.');}
function intake_text(mixed $value,int $max): string {hr_assert(is_string($value),'입력 형식을 확인해 주세요.');$value=trim($value);hr_assert(mb_strlen($value)<=$max,'입력 내용이 너무 깁니다.');return $value;}
function intake_number(mixed $value): int {hr_assert((is_string($value)&&ctype_digit($value))||is_int($value),'번호를 확인해 주세요.');return hr_int((int)$value,2147483647);}
function intake_filters(array $query): array {
    $f=[];foreach(['month'=>7,'q'=>80,'team'=>20,'status'=>10,'scope'=>10,'employee'=>12,'from'=>10,'to'=>10] as $key=>$max)$f[$key]=intake_text($query[$key]??'', $max);
    $f['month']=$f['month']?:substr(hr_today(),0,7);hr_assert(sales_month($f['month']),'조회 월을 확인해 주세요.');
    hr_assert(in_array($f['team'],['','insurance','cosmetics','health'],true),'부서를 확인해 주세요.');
    hr_assert(in_array($f['status'],['','pending','normal','as'],true),'접수 상태를 확인해 주세요.');
    $f['scope']=$f['scope']?:'real';hr_assert(in_array($f['scope'],['real','test','all'],true),'자료 구분을 확인해 주세요.');
    hr_assert($f['employee']===''||ctype_digit($f['employee']),'담당 직원을 확인해 주세요.');
    foreach(['from','to'] as $key)hr_assert($f[$key]===''||(hr_day($f[$key])&&substr($f[$key],0,7)===$f['month']),'조회 날짜는 선택한 월 안에서 입력해 주세요.');
    hr_assert(!$f['from']||!$f['to']||$f['from']<=$f['to'],'조회 시작일과 종료일을 확인해 주세요.');
    $f['p']=max(1,intake_number($query['p']??1));return $f;
}
function intake_filtered(array $records,array $f): array {
    $q=mb_strtolower($f['q']);$digits=preg_replace('/\D/','',$f['q']);
    $rows=array_values(array_filter($records,function($r)use($f,$q,$digits){
        if(!str_starts_with($r['date'],$f['month']))return false;
        if($f['scope']!=='all'&&(bool)$r['isTest']!==($f['scope']==='test'))return false;
        if($f['team']!==''&&$r['team']!==$f['team'])return false;
        if($f['status']!==''&&$r['status']!==$f['status'])return false;
        if($f['employee']!==''&&(int)$r['employeeId']!==(int)$f['employee'])return false;
        if(($f['from']&&$r['date']<$f['from'])||($f['to']&&$r['date']>$f['to']))return false;
        if($q!==''){
            $hay=mb_strtolower(implode(' ',array_map(fn($key)=>(string)($r[$key]??''),['id','customer','phone','employee','carrier','consultationPlace'])));
            if(!str_contains($hay,$q)&&!($digits!==''&&preg_match('/^[0-9 -]+$/D',$f['q'])&&str_contains(preg_replace('/\D/','',$r['phone']??''),$digits)))return false;
        }
        return true;
    }));
    usort($rows,fn($a,$b)=>strcmp($b['date'],$a['date'])?:strnatcmp($b['id'],$a['id']));return $rows;
}
function intake_url(array $filters=[],array $extra=[]): string {return '/intake.php?'.http_build_query(array_replace(['role'=>'admin'],$filters,$extra));}
function intake_status(string $status): string {return ['pending'=>'가접수','normal'=>'정상접수','as'=>'A/S'][$status]??$status;}
function intake_time(string $value): string {return (new DateTimeImmutable($value,new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Seoul'))->format('Y-m-d H:i:s');}
function intake_audit(string $id,array $user,string $action,array $before,array $after,string $reason): void {
    $q=db()->prepare('INSERT INTO intake_management_events(record_key,actor_id,action,before_data,after_data,reason) VALUES(?,?,?,?,?,?)');$q->execute([$id,$user['id'],$action,hr_json($before),hr_json($after),$reason]);
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
function intake_update(array $user,array $in): void {
    intake_admin($user);$id=intake_text($in['id']??'',60);$revision=intake_number($in['revision']??0);$action=intake_text($in['action']??'',15);hr_assert(in_array($action,['status','edit'],true),'지원하지 않는 작업입니다.');
    $reason=intake_text($in['reason']??'',500);$status=intake_text($in['status']??'',10);hr_assert(in_array($status,['pending','normal','as'],true),'상태를 확인해 주세요.');
    $d=db();$d->beginTransaction();
    try{
        if(preg_match('/^test:(\d+):(\d+)$/D',$id,$m)){
            hr_assert($action==='status','이전 테스트 자료는 상태만 변경할 수 있습니다.');
            $q=$d->prepare('SELECT state,revision FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([(int)$m[1]]);$row=$q->fetch();hr_assert($row&&(int)$row['revision']===$revision,'자료가 변경됐습니다. 새로고침 후 확인해 주세요.');
            $state=json_decode($row['state'],true,512,JSON_THROW_ON_ERROR);$found=false;
            foreach($state['sales'] as &$sale)if((int)$sale['id']===(int)$m[2]){$before=['status'=>['가접수'=>'pending','정상'=>'normal','A/S'=>'as'][$sale['status']]];$sale['status']=['pending'=>'가접수','normal'=>'정상','as'=>'A/S'][$status];$found=true;}unset($sale);
            hr_assert($found,'접수를 찾을 수 없습니다.');hr_assert($before['status']!==$status,'현재 상태와 같습니다.');
            $q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),(int)$m[1]]);
            intake_audit($id,$user,'status',$before,['status'=>$status],$reason);
        }else{
            hr_assert(ctype_digit($id),'접수 번호를 확인해 주세요.');$q=$d->prepare('SELECT * FROM sales_records WHERE id=? FOR UPDATE');$q->execute([(int)$id]);$row=$q->fetch();hr_assert((bool)$row,'접수를 찾을 수 없습니다.');hr_assert((int)$row['revision']===$revision,'다른 화면에서 변경했습니다. 새로고침 후 다시 확인해 주세요.');
            if($action==='status'){
                hr_assert($row['status']!==$status,'현재 상태와 같습니다.');
                $q=$d->prepare('UPDATE sales_records SET status=?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?');$q->execute([$status,(int)$id]);
                intake_audit($id,$user,'status',['status'=>$row['status']],['status'=>$status],$reason);
            }else{
                $fields=['customer_name'=>['customer',100],'phone'=>['phone',20],'carrier'=>['carrier',100],'note'=>['note',1000]];$next=[];
                foreach($fields as $column=>[$key,$max])$next[$column]=intake_text($in[$key]??'',$max);
                hr_assert($next['customer_name']!==''&&preg_match('/^[0-9-]{9,15}$/D',$next['phone']),'고객명과 전화번호를 확인해 주세요.');
                $time=intake_text($in['consultationTime']??'',5);$place=intake_text($in['consultationPlace']??'',500);$band=intake_text($in['premiumBand']??'',6);
                hr_assert($time===''||preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/D',$time),'상담 시간을 확인해 주세요.');hr_assert(in_array($band,['','100000','200000','300000'],true),'보험료 구분을 확인해 주세요.');
                $q=$d->prepare('SELECT consultation_time,consultation_place,premium_band FROM sales_consultation_details WHERE sale_id=?');$q->execute([(int)$id]);$details=$q->fetch();
                $before=array_intersect_key($row,$next)+($details?:['consultation_time'=>'','consultation_place'=>'','premium_band'=>'']);
                $after=$next+['consultation_time'=>$time,'consultation_place'=>$place,'premium_band'=>$band];hr_assert($before!==$after,'변경된 내용이 없습니다.');
                $q=$d->prepare('UPDATE sales_records SET customer_name=?,phone=?,carrier=?,note=?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?');$q->execute([$next['customer_name'],$next['phone'],$next['carrier'],$next['note'],(int)$id]);
                if($details){$q=$d->prepare('UPDATE sales_consultation_details SET consultation_time=?,consultation_place=?,premium_band=? WHERE sale_id=?');$q->execute([$time,$place,$band,(int)$id]);}
                else{$q=$d->prepare('INSERT INTO sales_consultation_details(sale_id,consultation_time,consultation_place,premium_band) VALUES(?,?,?,?)');$q->execute([(int)$id,$time,$place,$band]);}
                intake_audit($id,$user,'edit',$before,$after,$reason);
            }
        }
        $d->commit();
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
function intake_create(array $user,array $post): array {
    intake_admin($user);$in=['action'=>'create','employeeId'=>intake_number($post['employeeId']??0)];
    foreach(['date'=>10,'customer'=>100,'phone'=>20,'birthDate'=>10,'carrier'=>100,'note'=>1000,'consultationTime'=>5,'consultationPlace'=>500,'premiumBand'=>6,'requestKey'=>36] as $key=>$max)$in[$key]=intake_text($post[$key]??'',$max);
    hr_assert(hr_day($in['birthDate']),'생년월일을 입력해 주세요.');[$in['birthYear'],$in['birthMonth'],$in['birthDay']]=explode('-',$in['birthDate']);
    sales_mutate($user,$in);$q=db()->prepare('SELECT id,is_test FROM sales_records WHERE request_key=?');$q->execute([$in['requestKey']]);return $q->fetch();
}
function intake_csv_cell(mixed $value): string {$s=(string)$value;return preg_match('/^[\s\x00-\x1f]*[=+@-]/u',$s)?"'".$s:$s;}
