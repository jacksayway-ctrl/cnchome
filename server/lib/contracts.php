<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';
require_once __DIR__.'/contract-workflow.php';

function contract_text(mixed $value,int $max,string $label): string {
    hr_assert(is_string($value),$label.' 입력 형식을 확인해 주세요.');
    $value=preg_replace('/\s+/u',' ',trim($value));
    hr_assert(mb_strlen($value)<=$max,$label.'은 '.$max.'자 이내로 입력해 주세요.');
    hr_assert(!preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u',$value),$label.'에 사용할 수 없는 문자가 있습니다.');
    return $value;
}
function contract_number(mixed $value,int $max,string $label): int {
    hr_assert((is_string($value)&&preg_match('/^\d+$/D',$value))||is_int($value),$label.'을 숫자로 입력해 주세요.');
    $n=(int)$value;hr_assert($n>=0&&$n<=$max,$label.' 범위를 확인해 주세요.');return $n;
}
function contract_company_defaults(): array {
    return ['employerName'=>'씨앤씨','representative'=>'하정희','businessNumber'=>'','employerAddress'=>'인천 부평구 부평대로 301, 남광센트렉스 921호','employerPhone'=>'','paymentDay'=>'15','paymentPeriod'=>'매월 1일부터 말일까지','paymentTiming'=>'다음 달','paymentMethod'=>'근로자 명의 계좌로 입금','bonusTerms'=>'','otherAllowanceTerms'=>'','extraTerms'=>''];
}
function contract_company(array $input): array {
    $out=[];
    foreach(['employerName'=>50,'representative'=>30,'businessNumber'=>20,'employerAddress'=>100,'employerPhone'=>20,'paymentPeriod'=>50,'paymentTiming'=>10,'paymentMethod'=>50,'bonusTerms'=>100,'otherAllowanceTerms'=>100,'extraTerms'=>300] as $key=>$max)$out[$key]=contract_text($input[$key]??'',$max,$key);
    $out['paymentDay']=contract_number($input['paymentDay']??15,31,'급여 지급일');
    hr_assert($out['paymentDay']>0,'급여 지급일을 입력해 주세요.');
    hr_assert(in_array($out['paymentTiming'],['당월','다음 달'],true),'지급월을 선택해 주세요.');
    return $out;
}
function contract_company_row(): array {
    $r=db()->query('SELECT revision,settings FROM hr_contract_settings WHERE id=1')->fetch();
    return $r?['revision'=>(int)$r['revision'],'settings'=>json_decode($r['settings'],true,512,JSON_THROW_ON_ERROR)]:['revision'=>0,'settings'=>contract_company_defaults()];
}
function contract_default_terms(array $employee,array $company): array {
    $p=json_decode($employee['profile'],true,512,JSON_THROW_ON_ERROR);$rate=(int)($p['payAmount']??15000);
    $base=(int)round($rate/1.2);$schedule=[];
    foreach(['월','화','수','목','금','토','일'] as $day)$schedule[]=['day'=>$day,'working'=>in_array($day,$p['workDays']??[],true),'start'=>$p['workStart']??'','end'=>$p['workEnd']??'','breakStart'=>$p['breakStart']??'','breakEnd'=>$p['breakEnd']??''];
    $terms=array_replace(contract_company_defaults(),$company,[
        'employeeName'=>$p['name']??'','employeeBirth'=>$p['birthDate']??'','employeeAddress'=>trim(($p['address']??'').' '.($p['addressDetail']??'')),'employeePhone'=>$p['phone']??'',
        'periodPreset'=>($p['contractType']??'무기계약')==='무기계약'?'unlimited':'custom','contractType'=>$p['contractType']??'무기계약','contractStart'=>($p['contractStart']??'')?:($p['startDate']??''),'contractEnd'=>$p['contractEnd']??'',
        'signedDate'=>hr_today(),'wageEffective'=>hr_today(),'workplace'=>($p['workplace']??'')?:(($company['employerName']??'')?:'씨앤씨'),'duties'=>($p['duties']??'')?:'전화상담',
        'baseHourly'=>$p['payType']==='시급제'?$base:12500,'supportHourly'=>$p['payType']==='시급제'?$rate-$base:2500,
        'paymentDay'=>($p['payday']??'')?:($company['paymentDay']??15),'weeklyHoliday'=>$p['weeklyHoliday']??'일','holidayDetail'=>'','leaveDetail'=>'','schedule'=>$schedule,'existingWageAgreement'=>false,'insurancePension'=>'확인 필요','insuranceHealth'=>'확인 필요','insuranceEmployment'=>'확인 필요','insuranceAccident'=>'적용','insuranceException'=>'',
    ]);
    foreach($terms as $key=>$value)if(is_string($value))$terms[$key]=preg_replace('/\s+/u',' ',trim($value));
    return $terms;
}
function contract_basic_form(array $company): array {
    // A shared, unsaved form: no personnel data, recipient, issue or approval record.
    $terms=contract_default_terms(['profile'=>hr_json(['payType'=>'시급제','payAmount'=>15000,'contractType'=>'기간제'])],$company);
    $terms['signedDate']='';$terms['wageEffective']='';
    return ['id'=>0,'version'=>0,'status'=>'template','employee_no'=>'','terms'=>$terms,'issued_snapshot'=>null,'content_hash'=>'','issued_at'=>null];
}
function contract_time_minutes(string $value): ?int {
    if(preg_match('/^(\d{2}):(\d{2})$/D',$value,$m)!==1||(int)$m[1]>23||(int)$m[2]>59)return null;
    return (int)$m[1]*60+(int)$m[2];
}
function contract_terms(array $in): array {
    $t=contract_company($in);
    foreach(['employeeName'=>50,'employeeBirth'=>10,'employeeAddress'=>120,'employeePhone'=>20,'contractType'=>10,'contractStart'=>10,'contractEnd'=>10,'signedDate'=>10,'wageEffective'=>10,'workplace'=>100,'duties'=>100,'weeklyHoliday'=>1,'holidayDetail'=>100,'leaveDetail'=>100,'insurancePension'=>10,'insuranceHealth'=>10,'insuranceEmployment'=>10,'insuranceAccident'=>10,'insuranceException'=>100] as $key=>$max)$t[$key]=contract_text($in[$key]??'',$max,$key);
    foreach(['employeeBirth','contractStart','contractEnd','signedDate','wageEffective'] as $k)hr_assert($t[$k]===''||hr_day($t[$k]),'날짜 형식을 확인해 주세요: '.$k);
    hr_assert(in_array($t['contractType'],['기간제','무기계약'],true),'계약 구분을 선택해 주세요.');
    hr_assert(in_array($t['weeklyHoliday'],['월','화','수','목','금','토','일'],true),'주휴일을 선택해 주세요.');
    $t['baseHourly']=contract_number($in['baseHourly']??0,1000000,'기본시급');
    $t['supportHourly']=contract_number($in['supportHourly']??0,1000000,'주휴수당 환산액');
    foreach(['insurancePension','insuranceHealth','insuranceEmployment','insuranceAccident'] as $key)hr_assert(in_array($t[$key],['적용','법정 제외','확인 필요'],true),'사회보험 적용 여부를 확인해 주세요.');
    $t['existingWageAgreement']=($in['existingWageAgreement']??'')==='1';
    $t['schedule']=[];$schedule=$in['schedule']??[];hr_assert(is_array($schedule),'근무시간을 확인해 주세요.');
    foreach(['월','화','수','목','금','토','일'] as $i=>$day){
        $raw=$schedule[$i]??[];hr_assert(is_array($raw),'요일별 근무시간을 확인해 주세요.');
        $row=['day'=>$day,'working'=>($raw['working']??'')==='1'];
        foreach(['start','end','breakStart','breakEnd'] as $key){$row[$key]=contract_text($raw[$key]??'',5,'근무·휴게 시간');hr_assert($row[$key]===''||contract_time_minutes($row[$key])!==null,'시간은 00:00 형식으로 입력해 주세요.');}
        if(!$row['working'])foreach(['start','end','breakStart','breakEnd'] as $key)$row[$key]='';
        $t['schedule'][]=$row;
    }
    $preset=contract_text($in['periodPreset']??($t['contractType']==='무기계약'?'unlimited':'custom'),15,'기간 선택');
    $t=array_replace($t,contract_period($t['contractStart'],$preset,$t['contractEnd'],array_column(array_filter($t['schedule'],fn($d)=>$d['working']),'day')));
    return $t;
}
function contract_schedule_totals(array $terms): array {
    $minutes=0;$days=0;
    foreach($terms['schedule'] as $r){if(!$r['working'])continue;$s=contract_time_minutes($r['start']);$e=contract_time_minutes($r['end']);$bs=contract_time_minutes($r['breakStart']);$be=contract_time_minutes($r['breakEnd']);if($s===null||$e===null)continue;$minutes+=max(0,$e-$s-(($bs!==null&&$be!==null)?max(0,$be-$bs):0));$days++;}
    return ['minutes'=>$minutes,'days'=>$days];
}
function contract_print_text_length(array $terms): int {
    $length=0;
    foreach(['employerName','representative','businessNumber','employerAddress','employerPhone','paymentPeriod','paymentMethod','bonusTerms','otherAllowanceTerms','extraTerms','employeeName','employeeAddress','employeePhone','workplace','duties','holidayDetail','leaveDetail','insuranceException'] as $key)$length+=mb_strlen($terms[$key]??'');
    return $length;
}
function contract_issue_errors(array $t,array $employee): array {
    $errors=[];
    if(contract_print_text_length($t)>700)$errors[]='A4 한 장 인쇄를 위해 자유 입력 문구 합계를 700자 이내로 줄여 주세요 (현재 '.contract_print_text_length($t).'자).';
    // The A4 template has bounded fields; imported personnel text must meet the same limits.
    foreach(['employerName'=>50,'representative'=>30,'businessNumber'=>20,'employerAddress'=>100,'employerPhone'=>20,'paymentPeriod'=>50,'paymentTiming'=>10,'paymentMethod'=>50,'bonusTerms'=>100,'otherAllowanceTerms'=>100,'extraTerms'=>300,'employeeName'=>50,'employeeAddress'=>120,'employeePhone'=>20,'workplace'=>100,'duties'=>100,'holidayDetail'=>100,'leaveDetail'=>100,'insuranceException'=>100] as $key=>$max){
        if(mb_strlen($t[$key]??'')>$max)$errors[]='A4 한 장 서식의 입력 길이를 초과했습니다: '.$key.' ('.$max.'자 이내)';
        if(preg_match('/[\r\n\t]/u',$t[$key]??''))$errors[]='인쇄용 문장의 줄바꿈은 초안 저장 후 정리됩니다. 다시 저장해 주세요.';
    }
    foreach(['employerName'=>'사업장명','representative'=>'대표자','employerAddress'=>'사업장 주소','employerPhone'=>'사업장 연락처','employeeName'=>'근로자 성명','employeeBirth'=>'생년월일','employeeAddress'=>'근로자 주소','employeePhone'=>'근로자 연락처','contractStart'=>'계약 시작일','signedDate'=>'작성일','wageEffective'=>'임금 적용일','workplace'=>'근무 장소','duties'=>'업무 내용','paymentPeriod'=>'임금 산정기간','paymentMethod'=>'지급 방법','bonusTerms'=>'상여금 약정 (없으면 없음)','otherAllowanceTerms'=>'기타 수당 약정 (없으면 없음)'] as $key=>$label)if($t[$key]==='')$errors[]=$label.'을 입력해 주세요.';
    if(!$employee['user_id'])$errors[]='직원 로그인 계정을 먼저 연결해 주세요.';
    if($t['contractType']==='기간제'&&($t['contractEnd']===''||$t['contractEnd']<$t['contractStart']))$errors[]='기간제 계약 종료일을 확인해 주세요.';
    if($t['contractType']==='기간제'&&$t['wageEffective']!==''&&$t['contractEnd']!==''&&$t['wageEffective']>$t['contractEnd'])$errors[]='임금 적용일은 계약기간 안에 있어야 합니다.';
    if($t['employeeBirth']!==''&&$t['employeeBirth']>hr_today())$errors[]='생년월일을 확인해 주세요.';
    if($t['wageEffective']!==''&&$t['contractStart']!==''&&$t['wageEffective']<$t['contractStart'])$errors[]='임금 적용일은 계약 시작일 이후여야 합니다.';
    if($t['wageEffective']!==''&&$t['wageEffective']<hr_today())$errors[]='새 임금 구분은 소급 적용할 수 없습니다. 적용일을 오늘 이후로 입력해 주세요.';
    if($t['baseHourly']<=0)$errors[]='기본시급을 입력해 주세요.';
    if(substr($t['wageEffective'],0,4)==='2026'&&$t['baseHourly']<10320)$errors[]='2026년 기본시급은 최저임금 10,320원 이상이어야 합니다.';
    if(!$t['existingWageAgreement'])$errors[]='기존 임금 약정 확인 항목을 확인해 주세요.';
    foreach(['insurancePension'=>'국민연금','insuranceHealth'=>'건강보험','insuranceEmployment'=>'고용보험','insuranceAccident'=>'산재보험'] as $key=>$label){if($t[$key]==='확인 필요')$errors[]=$label.' 적용 여부를 확인해 주세요.';if($t[$key]==='법정 제외'&&$t['insuranceException']==='')$errors[]='사회보험 법정 제외 사유를 입력해 주세요.';}
    $total=0;$days=0;
    foreach($t['schedule'] as $r){
        if(!$r['working'])continue;$days++;$day=$r['day'];$s=contract_time_minutes($r['start']);$e=contract_time_minutes($r['end']);$bs=contract_time_minutes($r['breakStart']);$be=contract_time_minutes($r['breakEnd']);
        if($s===null||$e===null||$e<=$s){$errors[]=$day.'요일 출퇴근 시간을 입력해 주세요. 이 서식은 같은 날의 근무시간을 지원합니다.';continue;}
        $break=0;
        if($r['breakStart']!==''||$r['breakEnd']!==''){
            if($bs===null||$be===null||$bs<$s||$be>$e||$be<=$bs){$errors[]=$day.'요일 휴게시간을 근무시간 안에 입력해 주세요.';continue;}$break=$be-$bs;
        }
        $work=$e-$s-$break;$total+=$work;
        if($work<=0||$work>480)$errors[]=$day.'요일 소정근로시간은 0시간 초과, 8시간 이내로 입력해 주세요.';
        if(($work>=480&&$break<60)||($work>=240&&$break<30))$errors[]=$day.'요일 법정 휴게시간을 확인해 주세요 (4시간 30분, 8시간 1시간 이상).';
        if($day===$t['weeklyHoliday'])$errors[]='주휴일과 정기 근무요일을 다르게 지정해 주세요.';
    }
    if(!$days||$total>2400)$errors[]='주 소정근로시간을 0시간 초과, 40시간 이내로 입력해 주세요.';
    return array_values(array_unique($errors));
}
function contract_decode(array $r): array {
    foreach(['id','employee_id','version','revision'] as $k)$r[$k]=(int)$r[$k];
    $r['terms']=json_decode($r['terms'],true,512,JSON_THROW_ON_ERROR);
    $r['issued_snapshot']=$r['issued_snapshot']?json_decode($r['issued_snapshot'],true,512,JSON_THROW_ON_ERROR):null;
    return $r;
}
function contract_find(int $id,array $user,bool $lock=false): ?array {
    $q=db()->prepare('SELECT c.*,e.employee_no,e.user_id,e.profile,e.revision AS employee_revision,a.state AS approval_state,a.reason AS approval_reason,a.updated_at AS approval_updated_at FROM hr_contracts c JOIN hr_employees e ON e.id=c.employee_id LEFT JOIN hr_contract_approvals a ON a.contract_id=c.id WHERE c.id=?'.($user['role']==='admin'?'':' AND c.recipient_user_id=? AND c.status<>\'draft\'').($lock?' FOR UPDATE':''));
    $q->execute($user['role']==='admin'?[$id]:[$id,$user['id']]);$r=$q->fetch();return $r?contract_decode($r):null;
}
function contract_list(array $user): array {
    $q=db()->prepare('SELECT c.*,e.employee_no,e.user_id,e.profile,e.revision AS employee_revision,a.state AS approval_state,a.reason AS approval_reason,a.updated_at AS approval_updated_at FROM hr_contracts c JOIN hr_employees e ON e.id=c.employee_id LEFT JOIN hr_contract_approvals a ON a.contract_id=c.id'.($user['role']==='admin'?'':' WHERE c.recipient_user_id=? AND c.status<>\'draft\'').' ORDER BY c.id DESC');$q->execute($user['role']==='admin'?[]:[$user['id']]);return array_map('contract_decode',$q->fetchAll());
}
function contract_log(int $id,array $user,string $event,?array $snapshot=null): void {
    $q=db()->prepare('INSERT INTO hr_contract_events(contract_id,actor_id,event,snapshot) VALUES(?,?,?,?)');$q->execute([$id,$user['id'],$event,$snapshot?hr_json($snapshot):null]);
}
function contract_mutate(array $user,array $in): int {
    $action=contract_text($in['action']??'',30,'처리');$admin=$user['role']==='admin';
    hr_assert(in_array($action,$admin?['saveCompany','create','revise','save','issue','apply','withdraw']:['acknowledge','approve','reject'],true),'처리 권한이 없습니다.');
    $d=db();$d->beginTransaction();
    try{
        if($action==='saveCompany'){
            $settings=contract_company($in['company']??[]);$revision=contract_number($in['revision']??0,100000000,'수정 번호');
            // Insert-or-ignore serializes first-time creation across different administrators.
            $q=$d->prepare('INSERT IGNORE INTO hr_contract_settings(id,settings,revision,updated_by) VALUES(1,?,0,?)');$q->execute([hr_json(contract_company_defaults()),$user['id']]);
            $q=$d->query('SELECT revision FROM hr_contract_settings WHERE id=1 FOR UPDATE');$old=$q->fetch();
            hr_assert((int)$old['revision']===$revision,'회사 서식이 변경됐습니다. 새로고침 후 다시 저장해 주세요.');
            $q=$d->prepare('UPDATE hr_contract_settings SET settings=?,revision=revision+1,updated_by=? WHERE id=1');$q->execute([hr_json($settings),$user['id']]);
            $d->commit();return 0;
        }
        if($action==='create'||$action==='revise'){
            $source=null;
            if($action==='revise'){$id=contract_number($in['id']??0,PHP_INT_MAX,'계약 번호');$source=contract_find($id,$user,true);hr_assert((bool)$source&&$source['status']!=='draft','발행한 계약을 선택해 주세요.');$employeeId=$source['employee_id'];}
            else $employeeId=contract_number($in['employeeId']??0,PHP_INT_MAX,'직원 번호');
            $q=$d->prepare('SELECT * FROM hr_employees WHERE id=? FOR UPDATE');$q->execute([$employeeId]);$employee=$q->fetch();hr_assert((bool)$employee,'직원을 선택해 주세요.');
            $profile=json_decode($employee['profile'],true,512,JSON_THROW_ON_ERROR);hr_assert(($profile['payType']??'')==='시급제','이 계약 서식은 시급제용입니다. 월급제 직원은 별도의 월급제 계약 서식으로 작성해 주세요.');
            $q=$d->prepare("SELECT id FROM hr_contracts WHERE employee_id=? AND status='draft' ORDER BY id DESC LIMIT 1");$q->execute([$employeeId]);$draft=$q->fetchColumn();
            hr_assert(!$draft,'이 직원의 미발행 초안이 있습니다. 기존 초안을 먼저 확인해 주세요.');
            $q=$d->prepare('SELECT COALESCE(MAX(version),0)+1 FROM hr_contracts WHERE employee_id=?');$q->execute([$employeeId]);$version=(int)$q->fetchColumn();
            $terms=$source?$source['issued_snapshot']['terms']:contract_default_terms($employee,contract_company_row()['settings']);
            if($source){$terms['signedDate']=hr_today();$terms['wageEffective']=hr_today();$terms['existingWageAgreement']=false;}
            if($action==='create'&&isset($in['periodPreset']))$terms=array_replace($terms,contract_period(contract_text($in['contractStart']??'',10,'계약 시작일'),contract_text($in['periodPreset'],15,'기간 선택'),contract_text($in['contractEnd']??'',10,'종료일'),array_column(array_filter($terms['schedule'],fn($day)=>$day['working']),'day')));
            if($action==='create'&&$terms['contractStart']>hr_today())$terms['wageEffective']=$terms['contractStart'];
            $q=$d->prepare('INSERT INTO hr_contracts(employee_id,version,terms,created_by) VALUES(?,?,?,?)');$q->execute([$employeeId,$version,hr_json($terms),$user['id']]);$id=(int)$d->lastInsertId();contract_log($id,$user,$source?'revisedDraft':'created');
        }else{
            $id=contract_number($in['id']??0,PHP_INT_MAX,'계약 번호');$row=contract_find($id,$user,true);hr_assert((bool)$row,'계약을 찾을 수 없거나 열람 권한이 없습니다.');
            hr_assert($row['revision']===contract_number($in['revision']??0,100000000,'수정 번호'),'계약 내용이 변경됐습니다. 새로고침 후 다시 확인해 주세요.');
            if(in_array($action,['approve','reject','apply','withdraw'],true)){contract_workflow_mutate($user,$in,$row);}
            elseif($action==='acknowledge'){
                hr_assert(contract_workflow_state($row)==='pending','이미 승인 처리된 계약입니다.');
                hr_assert($row['status']==='issued','이미 확인했거나 확인할 수 없는 계약입니다.');hr_assert(($in['reviewed']??'')==='1','계약 내용 및 사본 열람 확인 항목을 선택해 주세요.');
                $q=$d->prepare("UPDATE hr_contracts SET status='received',received_at=UTC_TIMESTAMP(6),received_by=?,revision=revision+1 WHERE id=?");$q->execute([$user['id'],$id]);contract_log($id,$user,'received',['sha256'=>$row['content_hash'],'notice'=>'내용 및 사본 열람 확인. 근로계약 서명이나 임금 변경 동의의 대체가 아님.']);
            }elseif($action==='save'){
                hr_assert($row['status']==='draft','발행된 계약은 직접 수정할 수 없습니다. 개정 초안을 만들어 주세요.');
                $terms=contract_terms($in['terms']??[]);$q=$d->prepare('UPDATE hr_contracts SET terms=?,revision=revision+1 WHERE id=?');$q->execute([hr_json($terms),$id]);contract_log($id,$user,'draftSaved');
            }elseif($action==='issue'){
                hr_assert($row['status']==='draft','이미 발행한 계약입니다.');$errors=contract_issue_errors($row['terms'],$row);hr_assert(!$errors,implode(' ',$errors));
                $snapshot=['formatVersion'=>2,'employeeNo'=>$row['employee_no'],'version'=>$row['version'],'terms'=>$row['terms']];$json=hr_json($snapshot);$hash=hash('sha256',$json);
                $q=$d->prepare("UPDATE hr_contracts SET status='issued',issued_snapshot=?,content_hash=?,recipient_user_id=?,issued_at=UTC_TIMESTAMP(6),revision=revision+1 WHERE id=?");$q->execute([$json,$hash,$row['user_id'],$id]);contract_log($id,$user,'issued',['sha256'=>$hash,'version'=>$row['version']]);
            }
        }
        $d->commit();return $id;
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
function contract_korea_time(?string $value): string {
    return $value?(new DateTimeImmutable($value,new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Seoul'))->format('Y-m-d H:i'):'—';
}
function contract_status(array|string $value): string {if(is_array($value))return ['draft'=>'작성 중','pending'=>'직원 승인 대기','approved'=>'직원 승인 · 관리자 적용 대기','rejected'=>'수정 요청','applied'=>'관리자 적용 완료','withdrawn'=>'발급 회수'][contract_workflow_state($value)]??'확인 필요';return ['draft'=>'작성 중','issued'=>'직원 승인 대기','received'=>'사본 확인 완료'][$value]??$value;}

// Re-display a rejected form without trusting unexpected array shapes or replacing its old revision.
function contract_restore_form(array $stored,array $input): array {
    $out=$stored;
    foreach($stored as $key=>$value){
        if(is_array($value)){
            if(isset($input[$key])&&is_array($input[$key]))$out[$key]=contract_restore_form($value,$input[$key]);
        }elseif(is_bool($value)){$out[$key]=($input[$key]??'')==='1';}
        elseif(isset($input[$key])&&is_scalar($input[$key])){$out[$key]=mb_substr((string)$input[$key],0,5000);}
    }
    return $out;
}
