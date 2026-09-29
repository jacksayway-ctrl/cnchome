<?php
declare(strict_types=1);

function pay_statement_number(mixed $value,int $max=1000000000): int {
    hr_assert(is_string($value)&&preg_match('/^\d{1,10}$/D',$value)===1,'금액과 시간은 0 이상의 정수로 입력해 주세요.');
    return hr_int((int)$value,$max);
}
function pay_statement_text(mixed $value,int $max): string {
    hr_assert(is_string($value),'입력 형식을 확인해 주세요.');$value=trim($value);
    hr_assert(mb_strlen($value)<=$max,'입력 내용이 너무 깁니다.');return $value;
}
function pay_statement_weeks(string $month,array $calculation=[]): array {
    $first=new DateTimeImmutable($month.'-01');$last=$first->modify('last day of this month');
    $day=$first->modify('-'.((int)$first->format('N')-1).' days');$found=[];
    foreach($calculation['weeklyBreakdown']??[] as $row)$found[$row['weekStart']]=$row;
    $rows=[];while($day<=$last){$key=$day->format('Y-m-d');$rows[]=$found[$key]??['weekStart'=>$key,'minutes'=>0,'statutoryHoliday'=>null,'statutoryMethod'=>''];$day=$day->modify('+7 days');}return $rows;
}
function pay_statement_post(array $post,array $profile,string $month): array {
    $weeks=[];$assessments=[];$minutes=0;
    foreach(pay_statement_weeks($month) as $week){
        $key=$week['weekStart'];$m=pay_statement_number($post['weekMinutes'][$key]??'0',10080);$minutes+=$m;
        $weeks[]=['weekStart'=>$key,'minutes'=>$m];$raw=$post['statutoryHoliday'][$key]??'';
        $assessments[]=['weekStart'=>$key,'amount'=>$raw===''?null:pay_statement_number($raw),'method'=>pay_statement_text($post['statutoryMethod'][$key]??'',240)];
    }
    $allowances=[];$deductions=[];
    foreach(['allowanceItems','deductionItems'] as $key){
        $list=$post[$key]??[];hr_assert(is_array($list)&&count($list)<=15,'항목 수를 확인해 주세요.');
        foreach($list as $item){hr_assert(is_array($item),'항목 형식을 확인해 주세요.');$amount=pay_statement_number($item['amount']??'0');
            if($amount===0)continue;
            $entry=['label'=>pay_statement_text($item['label']??'',60),'amount'=>$amount,'method'=>pay_statement_text($item['method']??'',400),'kind'=>pay_statement_text($item['kind']??'other',30)];
            if($key==='allowanceItems')$allowances[]=$entry;else $deductions[]=$entry;
        }
    }
    return ['minutes'=>$profile['payType']==='시급제'?$minutes:pay_statement_number($post['minutes']??'0',44640),'weeklyMinutes'=>$weeks,'holidayInclusive'=>$profile['payType']==='시급제','allowance'=>array_sum(array_column($allowances,'amount')),'deductions'=>array_sum(array_column($deductions,'amount')),'note'=>pay_statement_text($post['note']??'',1000),'statementVersion'=>1,'payday'=>pay_statement_text($post['payday']??'',10),'periodStart'=>pay_statement_text($post['periodStart']??$month.'-01',10),'periodEnd'=>pay_statement_text($post['periodEnd']??(new DateTimeImmutable($month.'-01'))->format('Y-m-t'),10),'allowanceItems'=>$allowances,'deductionItems'=>$deductions,'weeklyStatutory'=>$assessments,'overtimeMinutes'=>pay_statement_number($post['overtimeMinutes']??'0',44640),'nightMinutes'=>pay_statement_number($post['nightMinutes']??'0',44640),'holidayWorkMinutes'=>pay_statement_number($post['holidayWorkMinutes']??'0',44640),'agreementConfirmed'=>isset($post['agreementConfirmed'])];
}
/** Only new, explicitly itemized statements use these rules; historical JSON is unchanged. */
function pay_statement_enrich(array $profile,array $input,array $calculation): array {
    if(!isset($input['statementVersion']))return $calculation;
    hr_assert($input['statementVersion']===1,'명세서 형식을 확인해 주세요.');
    $c=$calculation;$c['statementVersion']=1;
    foreach(['payday','periodStart','periodEnd'] as $key){$c[$key]=pay_statement_text($input[$key]??'',10);hr_assert(hr_day($c[$key]),'지급일과 산정 기간을 입력해 주세요.');}
    hr_assert($c['periodStart']<=$c['periodEnd']&&substr($c['periodStart'],0,7)===($input['month']??'')&&substr($c['periodEnd'],0,7)===($input['month']??''),'산정 기간은 귀속 월 안에서 선택해 주세요.');
    foreach(['allowanceItems'=>'allowance','deductionItems'=>'deductions'] as $key=>$total){
        $list=$input[$key]??[];hr_assert(is_array($list)&&array_is_list($list)&&count($list)<=15,'지급·공제 항목을 확인해 주세요.');$items=[];
        foreach($list as $item){hr_assert(is_array($item),'항목 형식을 확인해 주세요.');$amount=hr_int($item['amount']??null);
            if($amount===0)continue;$label=pay_statement_text($item['label']??'',60);$method=pay_statement_text($item['method']??'',400);$kind=pay_statement_text($item['kind']??'other',30);
            hr_assert($label!=='','지급·공제 항목명을 입력해 주세요.');$items[]=['label'=>$label,'amount'=>$amount,'method'=>$method,'kind'=>$kind];
        }
        hr_assert(array_sum(array_column($items,'amount'))===$c[$total],'세부 항목 합계와 총액이 다릅니다.');$c[$key]=$items;
    }
    foreach(['overtimeMinutes','nightMinutes','holidayWorkMinutes'] as $key)$c[$key]=hr_int($input[$key]??0,44640);
    $c['agreementConfirmed']=($input['agreementConfirmed']??false)===true;
    $c['statutoryHoliday']=0;$c['companySupport']=0;$c['holidayAssessmentComplete']=true;
    $assessments=$input['weeklyStatutory']??[];hr_assert(is_array($assessments)&&array_is_list($assessments)&&count($assessments)<=6,'주별 주휴 산정 내역을 확인해 주세요.');$found=[];
    foreach($assessments as $assessment){hr_assert(is_array($assessment)&&is_string($assessment['weekStart']??null)&&!isset($found[$assessment['weekStart']]),'중복된 주휴 산정 내역입니다.');$found[$assessment['weekStart']]=$assessment;}
    foreach($c['weeklyBreakdown'] as &$week){
        $assessment=$found[$week['weekStart']]??[];$raw=$assessment['amount']??null;
        $statutory=$raw===null?null:hr_int($raw);$method=pay_statement_text($assessment['method']??'',240);
        $floor=$week['holiday'];$support=max(0,$floor-($statutory??0));
        if(($week['minutes']>0||($statutory??0)>0)&&($statutory===null||$method===''))$c['holidayAssessmentComplete']=false;
        $week['contractHolidayFloor']=$floor;$week['statutoryHoliday']=$statutory;$week['companySupport']=$support;$week['statutoryMethod']=$method;
        $week['holiday']=($statutory??0)+$support;$week['gross']=$week['base']+$week['holiday'];
        $c['statutoryHoliday']+=$statutory??0;$c['companySupport']+=$support;
    }unset($week);
    if($c['holidayInclusive'])$c['holiday']=$c['statutoryHoliday']+$c['companySupport'];
    $c['gross']=$c['base']+$c['holiday']+$c['allowance'];hr_assert($c['deductions']<=$c['gross'],'공제액은 지급 총액을 초과할 수 없습니다.');$c['prepaidDaily']=hr_int($input['prepaidDaily']??0);
    if(isset($input['gradeSnapshot']))$c['gradeSnapshot']=$input['gradeSnapshot'];
    hr_assert($c['deductions']+$c['prepaidDaily']<=$c['gross'],'공제와 일그레이드 선지급 합계가 지급 총액을 초과합니다. 수령 기록을 확인해 주세요.');
    $c['net']=$c['gross']-$c['deductions']-$c['prepaidDaily'];return $c;
}
function pay_statement_publish_check(array $c): void {
    if(!isset($c['statementVersion']))return;
    hr_assert(hr_day($c['payday']??''),'지급일을 입력해 주세요.');
    if($c['holidayInclusive']){
        hr_assert(($c['agreementConfirmed']??false)===true,'기본시급과 수당의 구분에 대한 사전 약정·적용일을 확인해 주세요.');
        hr_assert(($c['holidayAssessmentComplete']??false)===true,'근무한 각 주의 법정 주휴수당과 산정 근거를 확인해 주세요. 비대상 주는 0원과 비대상 사유를 입력하세요.');
    }
    foreach(array_merge($c['allowanceItems']??[],$c['deductionItems']??[]) as $item)hr_assert(($item['method']??'')!=='','지급·공제 항목별 계산 방법 또는 공제 근거를 입력해 주세요.');
    foreach(['overtimeMinutes'=>'overtime','nightMinutes'=>'night','holidayWorkMinutes'=>'holidayWork'] as $key=>$kind){
        if(($c[$key]??0)>0){$found=false;foreach($c['allowanceItems']??[] as $item)if($item['kind']===$kind)$found=true;
            hr_assert($found,'연장·야간·휴일근로 시간이 있으면 해당 수당 금액과 계산 근거를 입력해 주세요.');}
    }
}
function pay_statement_status(string $status): string { return ['draft'=>'작성 중','published'=>'직원 확인 대기','requested'=>'수정 요청','confirmed'=>'확인 완료'][$status]??$status; }
function pay_statement_items(array $c,string $key): array {
    if(isset($c[$key]))return $c[$key];$amount=$c[$key==='allowanceItems'?'allowance':'deductions']??0;
    return $amount?[['label'=>$key==='allowanceItems'?'기존 수당 합계':'기존 공제 합계','amount'=>$amount,'method'=>'기존 기록에 항목별 세부 내역 없음','kind'=>'other']]:[];
}
