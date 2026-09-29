<?php
declare(strict_types=1);
require_once __DIR__.'/grade-ledger.php';
require_once __DIR__.'/contracts.php';

function seed_five_test_staff(): array {
    $batch='five-test-staff-20260929';$d=db();$d->beginTransaction();
    try{
        $q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute([$batch]);
        if($raw=$q->fetchColumn()){$d->commit();return ['existing'=>true,'manifest'=>json_decode($raw,true,512,JSON_THROW_ON_ERROR)];}
        $admin=(int)$d->query("SELECT id FROM app_users WHERE role='admin' AND active=1 ORDER BY id LIMIT 1")->fetchColumn();hr_assert($admin>0,'테스트 자료를 생성할 관리자 계정이 없습니다.');
        $today=hr_today();$month=substr($today,0,7);$days=array_values(array_filter(grade_dates($month),fn($day)=>$day<=$today));$manifest=[];
        foreach(range(2,6) as $n){
            $username='user'.$n;$name='테스트 직원 '.$n;$q=$d->prepare('SELECT id FROM app_users WHERE username=?');$q->execute([$username]);hr_assert(!$q->fetchColumn(),$username.' 계정이 이미 있어 기존 자료를 보존했습니다.');
            $q=$d->prepare("INSERT INTO app_users(username,display_name,password_hash,role,department) VALUES(?,?,?,'employee','insurance')");$q->execute([$username,$name,password_hash('1234',PASSWORD_DEFAULT)]);$uid=(int)$d->lastInsertId();$employeeNo='cncTEST20260929'.$n;
            $p=hr_profile(['name'=>$name,'phone'=>'010-0000-000'.$n,'email'=>$username.'@example.invalid','birthDate'=>'199'.$n.'-01-01','address'=>'[테스트] 가상 주소','addressDetail'=>'점검용 '.$n.'호','postcode'=>'00000','gender'=>$n%2?'남':'여','nationality'=>'대한민국','team'=>'insurance','role'=>'상담원','startDate'=>$month.'-01','employment'=>'재직','workplace'=>'[테스트] 씨앤씨 상담실','duties'=>'전화상담 · 기능 점검','jobType'=>'전화상담','workDays'=>['월','화','수','목','금'],'workStart'=>'10:00','workEnd'=>'17:00','breakStart'=>'12:00','breakEnd'=>'13:00','weeklyHoliday'=>'일','payType'=>'시급제','payAmount'=>15000,'wageEffective'=>$today,'bank'=>'가상은행(테스트)','accountNumber'=>'00000000000'.$n,'accountHolder'=>$name,'contractStart'=>$month.'-01','contractEnd'=>hr_contract_end($month.'-01','quarter'),'contractTerm'=>'','contractType'=>'기간제','payday'=>'15','career'=>'[테스트] 상담 경력 1년','qualification'=>'[테스트] 상담 교육 수료','emergencyName'=>'가상 보호자','emergencyPhone'=>'010-0000-001'.$n,'memo'=>'삭제 가능한 가상 직원. 실제 근로·급여 지급 대상이 아닙니다.']);
            $q=$d->prepare('INSERT INTO hr_employees(employee_no,user_id,profile) VALUES(?,?,?)');$q->execute([$employeeNo,$uid,hr_json($p)]);$eid=(int)$d->lastInsertId();
            $state=['sales'=>[],'attendance'=>[],'fixtures'=>[$batch=>['createdAt'=>gmdate('c'),'userId'=>$uid,'employeeId'=>$eid]]];$weeks=[];
            foreach($days as $index=>$date){
                $normal=5+(($index+$n)%6);
                foreach(['정상'=>$normal,'가접수'=>1,'A/S'=>1] as $status=>$number)for($i=0;$i<$number;$i++){$sid=count($state['sales'])+1;$state['sales'][]=['id'=>$sid,'date'=>$date,'name'=>'[테스트 '.$n.'] 가상고객 '.$sid,'carrier'=>['GA','한화','신한'][$sid%3],'kind'=>$sid%4?'일반':'실버','status'=>$status,'fixture'=>$batch];}
                $state['attendance'][]=['date'=>$date,'in'=>'10:00','out'=>'17:00','status'=>'정상 (가상 점검)','fixture'=>$batch];$start=grade_week($date)[0];$weeks[$start]=($weeks[$start]??0)+360;
            }
            $q=$d->prepare('INSERT INTO test_employee_data(user_id,state) VALUES(?,?)');$q->execute([$uid,hr_json($state)]);
            $entries=grade_history('insurance');
            foreach($days as $date){$policy=grade_zero_policy();foreach($entries as $entry)if($entry['date']<=$date)$policy=$entry['policy'];$normal=count(array_filter($state['sales'],fn($sale)=>$sale['date']===$date&&$sale['status']==='정상'));$start=$policy['dailyCash']['start'];$amount=$policy['dailyCash']['perCase'];
                if($amount)for($milestone=$start;$milestone<=min($normal,$date===$today?$start+1:$normal);$milestone++){$q=$d->prepare('INSERT INTO daily_grade_receipts(employee_id,performance_date,milestone,amount,department) VALUES(?,?,?,?,?)');$q->execute([$uid,$date,$milestone,$amount,'insurance']);}
            }
            $grade=grade_employee_context(['userId'=>$uid,'profile'=>$p],$month);$weeklyMinutes=[];$statutory=[];
            foreach($weeks as $start=>$minutes){$weeklyMinutes[]=['weekStart'=>$start,'minutes'=>$minutes];$statutory[]=['weekStart'=>$start,'amount'=>0,'method'=>'가상 점검 예시: 법정 비대상으로 설정, 약정액 전액을 회사 지원금으로 표시'];}
            $input=['month'=>$month,'minutes'=>array_sum($weeks),'weeklyMinutes'=>$weeklyMinutes,'weeklyStatutory'=>$statutory,'holidayInclusive'=>true,'allowance'=>0,'deductions'=>0,'allowanceItems'=>[],'deductionItems'=>[],'statementVersion'=>1,'payday'=>(new DateTimeImmutable($month.'-01'))->modify('+1 month')->format('Y-m-15'),'periodStart'=>$month.'-01','periodEnd'=>(new DateTimeImmutable($month.'-01'))->format('Y-m-t'),'agreementConfirmed'=>true,'note'=>'[테스트] 기능 점검용 가상 급여. 실제 지급·약정·승인이 아닙니다.'];
            $calc=hr_calculate($p,grade_payroll_input($input,$grade));pay_statement_publish_check($calc);$snapshot=['name'=>$name,'employeeNo'=>$employeeNo,'month'=>$month,'calculation'=>$calc,'bank'=>$p['bank'],'accountNumber'=>$p['accountNumber'],'accountHolder'=>$name];
            $q=$d->prepare("INSERT INTO hr_payroll(employee_id,month,status,calculation,published_snapshot,published_at) VALUES(?,?,'published',?,?,UTC_TIMESTAMP(6))");$q->execute([$eid,$month,hr_json($calc),hr_json($snapshot)]);$payrollId=(int)$d->lastInsertId();
            $q=$d->prepare('INSERT INTO hr_payroll_events(payroll_id,actor_id,event,note,snapshot) VALUES(?,?,?,?,?)');$q->execute([$payrollId,$admin,'publish','[테스트] 점검 자료 생성 · 실제 지급 아님',hr_json($snapshot)]);
            $company=array_replace(contract_company_defaults(),['employerName'=>'씨앤씨(가상 점검용)','representative'=>'테스트 대표자','employerAddress'=>'[테스트] 가상 사업장','employerPhone'=>'02-000-0000','bonusTerms'=>'없음','otherAllowanceTerms'=>'주·월그레이드 함께 지급. 일그레이드 선지급액은 정산 시 차감.','extraTerms'=>'기능 점검용 가상 계약서이며 실제 근로계약·서명·동의가 아닙니다.']);
            $terms=contract_default_terms(['profile'=>hr_json($p)],$company);$terms['existingWageAgreement']=true;foreach(['insurancePension','insuranceHealth','insuranceEmployment','insuranceAccident'] as $key)$terms[$key]='적용';
            $snapshot=['formatVersion'=>2,'employeeNo'=>$employeeNo,'version'=>1,'terms'=>$terms];$json=hr_json($snapshot);
            $q=$d->prepare("INSERT INTO hr_contracts(employee_id,recipient_user_id,version,status,terms,issued_snapshot,content_hash,created_by,issued_at) VALUES(?,?,1,'issued',?,?,?,?,UTC_TIMESTAMP(6))");$q->execute([$eid,$uid,hr_json($terms),$json,hash('sha256',$json),$admin]);$contractId=(int)$d->lastInsertId();
            $q=$d->prepare('INSERT INTO hr_contract_events(contract_id,actor_id,event,snapshot) VALUES(?,?,?,?)');$q->execute([$contractId,$admin,'issued',hr_json(['reason'=>'가상 점검용 계약서. 직원 승인·관리자 적용 전.'])]);
            $manifest[]=['username'=>$username,'userId'=>$uid,'employeeId'=>$eid,'payrollId'=>$payrollId,'contractId'=>$contractId];
        }
        $q=$d->prepare('INSERT INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([$batch,hr_json($manifest)]);$d->commit();return ['existing'=>false,'manifest'=>$manifest];
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
