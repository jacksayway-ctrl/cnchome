<?php
declare(strict_types=1);
require_once __DIR__.'/grade-ledger.php';

/** Explicit one-time refresh of the six named demo accounts. Never real employee data. */
function seed_test_inspection_refresh(): array {
    $batch='test-inspection-refresh-20260929-v1';$d=db();$d->beginTransaction();
    try {
        $q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute([$batch]);
        if($raw=$q->fetchColumn()){$d->commit();return ['existing'=>true,'manifest'=>json_decode($raw,true,512,JSON_THROW_ON_ERROR)];}
        $admin=(int)$d->query("SELECT id FROM app_users WHERE role='admin' AND active=1 ORDER BY id LIMIT 1")->fetchColumn();hr_assert($admin>0,'테스트 자료를 준비할 관리자 계정이 없습니다.');
        $today=hr_today();$month=substr($today,0,7);$manifest=[];
        $users=$d->query("SELECT u.*,e.id AS employee_id,e.employee_no,e.profile FROM app_users u JOIN hr_employees e ON e.user_id=u.id WHERE u.active=1 AND u.role='employee' ORDER BY u.id")->fetchAll();
        foreach($users as $user){
            if(!cnc_test_user($user))continue;
            $uid=(int)$user['id'];$eid=(int)$user['employee_id'];$n=(int)substr($user['username'],4);
            $profile=json_decode($user['profile'],true,512,JSON_THROW_ON_ERROR);$beforeProfile=$profile;
            // user1 was provisioned with its creation date; allow the full current-month demo to be reviewed.
            if($n===1&&$profile['startDate']>$month.'-01'){
                $oldStart=$profile['startDate'];$profile['startDate']=$month.'-01';
                foreach(['contractStart','wageEffective'] as $key)if(empty($profile[$key])||$profile[$key]===$oldStart)$profile[$key]=$month.'-01';
            }
            $defaults=['email'=>$user['username'].'@example.invalid','birthDate'=>'1980-01-01','address'=>'[테스트] 가상 주소','addressDetail'=>'기능 점검용 상담실','postcode'=>'00000','gender'=>'기타','nationality'=>'대한민국','workplace'=>'씨앤씨 테스트 상담실','duties'=>'전화상담 · 기능 점검','jobType'=>'전화상담','workStart'=>'10:00','workEnd'=>'17:00','breakStart'=>'12:00','breakEnd'=>'13:00','payday'=>'15','bank'=>'가상은행(테스트)','accountNumber'=>'00000000000'.$n,'accountHolder'=>$profile['name'],'career'=>'[테스트] 상담 경력 예시','qualification'=>'[테스트] 상담 교육 수료','emergencyName'=>'가상 보호자','emergencyPhone'=>'010-0000-001'.$n];
            foreach($defaults as $key=>$value)if(empty($profile[$key]))$profile[$key]=$value;
            $profile=hr_profile($profile);
            if($profile!==$beforeProfile){$q=$d->prepare('UPDATE hr_employees SET profile=?,revision=revision+1 WHERE id=?');$q->execute([hr_json($profile),$eid]);}
            $q=$d->prepare('SELECT state FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([$uid]);$raw=$q->fetchColumn();
            $state=$raw?json_decode($raw,true,512,JSON_THROW_ON_ERROR):['sales'=>[],'attendance'=>[]];$state['sales']=$state['sales']??[];$state['attendance']=$state['attendance']??[];
            $entry=['userId'=>$uid,'employeeId'=>$eid,'username'=>$user['username'],'month'=>$month,'profileBefore'=>$beforeProfile,'salesIds'=>[],'attendanceDates'=>[],'normalByDate'=>[],'payroll'=>'preserved'];
            $counts=[];foreach($state['sales'] as $sale)$counts[$sale['date']][$sale['status']]=($counts[$sale['date']][$sale['status']]??0)+1;
            $q=$d->prepare('SELECT first_date,status,COUNT(*) AS amount FROM sales_records WHERE employee_id=? AND department=? AND is_test=1 AND first_date>=? AND first_date<=? GROUP BY first_date,status');$q->execute([$uid,$user['department'],$month.'-01',$today]);
            foreach($q->fetchAll() as $r){$status=['normal'=>'정상','pending'=>'가접수','as'=>'A/S'][$r['status']]??null;if($status)$counts[$r['first_date']][$status]=($counts[$r['first_date']][$status]??0)+(int)$r['amount'];}
            $serial=max(array_merge([0],array_column($state['sales'],'id')));$eligible=[];
            foreach(grade_dates($month) as $index=>$date){
                $weekday=['월','화','수','목','금'][(int)(new DateTimeImmutable($date))->format('N')-1];
                if($date>$today||$date<$profile['startDate']||(!empty($profile['endDate'])&&$date>$profile['endDate'])||!in_array($weekday,$profile['workDays'],true))continue;
                $eligible[$date]=true;$targets=['정상'=>10+(($index+$n)%6),'가접수'=>2,'A/S'=>1];
                foreach($targets as $status=>$target)for($i=$counts[$date][$status]??0;$i<$target;$i++){
                    $id=++$serial;$state['sales'][]=['id'=>$id,'date'=>$date,'name'=>'[테스트 '.$n.'] 가상고객 '.$id,'carrier'=>['GA','한화','신한'][$id%3],'kind'=>$id%4?'일반':'실버','status'=>$status,'fixture'=>$batch];$entry['salesIds'][]=$id;
                }
                $entry['normalByDate'][$date]=max($targets['정상'],$counts[$date]['정상']??0);
                if(!array_filter($state['attendance'],fn($row)=>$row['date']===$date)){$state['attendance'][]=['date'=>$date,'in'=>'10:00','out'=>'17:00','status'=>'정상 (가상 점검)','fixture'=>$batch];$entry['attendanceDates'][]=$date;}
            }
            foreach($state['sales'] as &$sale){
                if(!isset($eligible[$sale['date']]))continue;
                $id=(int)$sale['id'];$year=(int)substr($sale['date'],0,4)-($sale['kind']==='실버'?64:39)+1;
                foreach(['phone'=>'010-0000-'.str_pad((string)($id%10000),4,'0',STR_PAD_LEFT),'birthDate'=>$year.'-01-15','consultationTime'=>sprintf('%02d:%02d',10+($id%6),($id*7)%60),'consultationPlace'=>'[테스트] '.['서울특별시 강남구 가상 상담실','경기도 수원시 영통구 가상 상담실','인천광역시 부평구 가상 상담실'][$id%3],'premiumBand'=>['100000','200000','300000'][$id%3],'note'=>'기능 점검용 가상 접수 · 실제 고객 아님'] as $key=>$value)if(empty($sale[$key]))$sale[$key]=$value;
            }unset($sale);
            foreach($state['attendance'] as &$row)if(isset($eligible[$row['date']])&&empty($row['out'])&&!empty($row['fixture'])&&($row['date']<$today||(new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul')))->format('H:i')>='17:00')){$row['out']='17:00';$row['status']='정상 (가상 점검)';}unset($row);
            usort($state['attendance'],fn($a,$b)=>strcmp($a['date'],$b['date']));$state['fixtures'][$batch]=['createdAt'=>gmdate('c'),'salesIds'=>$entry['salesIds'],'attendanceDates'=>$entry['attendanceDates']];
            if($raw){$q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),$uid]);}
            else{$q=$d->prepare('INSERT INTO test_employee_data(user_id,state) VALUES(?,?)');$q->execute([$uid,hr_json($state)]);}
            $grade=grade_employee_context(['userId'=>$uid,'profile'=>$profile],$month);
            $entry['normalTotal']=$grade['count'];$entry['daily']=$grade['daily'];$entry['weekly']=$grade['weekly'];
            $q=$d->prepare('SELECT * FROM hr_payroll WHERE employee_id=? AND month=? FOR UPDATE');$q->execute([$eid,$month]);$payroll=$q->fetch();$old=$payroll?json_decode($payroll['calculation'],true,512,JSON_THROW_ON_ERROR):null;
            $fixturePay=$old&&str_contains($old['note']??'','테스트')&&str_contains($old['note']??'','가상');
            // Refresh only unconfirmed published demo statements; preserve user-edited drafts and confirmations.
            if(!$payroll||($payroll['status']==='published'&&$fixturePay)){
                $weeks=[];foreach($state['attendance'] as $row)if(isset($eligible[$row['date']])&&!empty($row['out'])){$minutes=max(0,(int)round((strtotime($row['date'].' '.$row['out'])-strtotime($row['date'].' '.$row['in']))/60)-60);$monday=grade_week($row['date'])[0];$weeks[$monday]=($weeks[$monday]??0)+$minutes;}
                $weeklyMinutes=[];$statutory=[];foreach($weeks as $monday=>$minutes){$weeklyMinutes[]=['weekStart'=>$monday,'minutes'=>$minutes];$statutory[]=['weekStart'=>$monday,'amount'=>0,'method'=>'가상 점검 예시: 약정 포함분을 회사 지원금으로 표시'];}
                $input=['month'=>$month,'minutes'=>array_sum($weeks),'weeklyMinutes'=>$weeklyMinutes,'weeklyStatutory'=>$statutory,'holidayInclusive'=>true,'allowance'=>0,'deductions'=>0,'allowanceItems'=>[],'deductionItems'=>[],'statementVersion'=>1,'payday'=>(new DateTimeImmutable($month.'-01'))->modify('+1 month')->format('Y-m-15'),'periodStart'=>$month.'-01','periodEnd'=>(new DateTimeImmutable($month.'-01'))->format('Y-m-t'),'agreementConfirmed'=>true,'note'=>'[테스트] '.$batch.' · 정상 접수·출결과 연결한 가상 급여 예시. 실제 지급·약정·승인이 아닙니다.'];
                $calc=hr_calculate($profile,grade_payroll_input($input,$grade));pay_statement_publish_check($calc);
                $snapshot=['name'=>$profile['name'],'employeeNo'=>$user['employee_no'],'month'=>$month,'calculation'=>$calc,'bank'=>$profile['bank'],'accountNumber'=>$profile['accountNumber'],'accountHolder'=>$profile['accountHolder']];
                if($payroll){
                    $before=$payroll['published_snapshot']?json_decode($payroll['published_snapshot'],true,512,JSON_THROW_ON_ERROR):['calculation'=>$old];
                    $q=$d->prepare('INSERT INTO hr_payroll_events(payroll_id,actor_id,event,note,snapshot) VALUES(?,?,?,?,?)');$q->execute([$payroll['id'],$admin,'savePayroll','[테스트] 기본 자료 보강 전 가상 명세서 보관',hr_json($before)]);
                    $q=$d->prepare('UPDATE hr_payroll SET calculation=?,published_snapshot=?,published_at=UTC_TIMESTAMP(6),revision=revision+1 WHERE id=?');$q->execute([hr_json($calc),hr_json($snapshot),$payroll['id']]);$payrollId=(int)$payroll['id'];
                }else{$q=$d->prepare("INSERT INTO hr_payroll(employee_id,month,status,calculation,published_snapshot,published_at) VALUES(?,?,'published',?,?,UTC_TIMESTAMP(6))");$q->execute([$eid,$month,hr_json($calc),hr_json($snapshot)]);$payrollId=(int)$d->lastInsertId();}
                $q=$d->prepare('INSERT INTO hr_payroll_events(payroll_id,actor_id,event,note,snapshot) VALUES(?,?,?,?,?)');$q->execute([$payrollId,$admin,'publish','[테스트] 요청한 기본 자료·자동 일그레이드 선지급 반영 · 실제 지급 아님',hr_json($snapshot)]);
                $entry['payroll']='refreshed';$entry['payrollId']=$payrollId;$entry['paydayNet']=$calc['net'];
            }
            $manifest[]=$entry;
        }
        $q=$d->prepare('INSERT INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([$batch,hr_json($manifest)]);$d->commit();return ['existing'=>false,'manifest'=>$manifest];
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
