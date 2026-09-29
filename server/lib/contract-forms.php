<?php
declare(strict_types=1);
function contract_form_field(array $values,string $prefix,string $key,string $label,int $max,string $type='text'): void {
    echo '<label class="contract-field"><span>'.view_h($label).'</span><input type="'.view_h($type).'" name="'.view_h($prefix.'['.$key.']').'" value="'.view_h((string)($values[$key]??'')).'" maxlength="'.$max.'"'.($type==='number'?' min="0" max="1000000" step="1"':'').'></label>';
}
function contract_period_fields(array $values,string $prefix): void {
    $name=fn($key)=>$prefix?$prefix.'['.$key.']':$key;
    $preset=$values['periodPreset']??(($values['contractType']??'')==='무기계약'?'unlimited':(empty($values['contractEnd'])?'tenMonths':'custom'));
    $start=($values['contractStart']??'')?:hr_today();$end=$values['contractEnd']??'';
    if($end===''&&hr_day($start)&&in_array($preset,['fiveDays','month','quarter','tenMonths','custom'],true))$end=contract_period($start,$preset,'',['월','화','수','목','금'])['contractEnd'];
    echo '<label class="contract-field">계약기간<select data-period-preset name="'.view_h($name('periodPreset')).'">';
    foreach(['tenMonths'=>'10개월 (기본)','fiveDays'=>'5일 (근무요일 기준)','month'=>'1개월','quarter'=>'3개월','custom'=>'직접 입력','unlimited'=>'기간의 정함 없음'] as $key=>$label)echo '<option value="'.$key.'"'.($preset===$key?' selected':'').'>'.$label.'</option>';
    echo '</select></label>';
    foreach(['contractStart'=>'계약 시작일','contractEnd'=>'계약 종료일'] as $key=>$label)echo '<label class="contract-field">'.$label.'<input data-period-'.($key==='contractStart'?'start':'end').' type="date" name="'.view_h($name($key)).'" value="'.view_h($key==='contractStart'?$start:$end).'"></label>';
    echo '<span class="contract-hint" data-period-message>시작일은 수정할 수 있습니다. 종료일이 비어 있으면 10개월로 계산합니다. 5일은 근무요일 기준입니다.</span>';
}
function contract_company_fields(array $values,string $prefix): void {
    foreach(['employerName'=>['사업장명',50],'representative'=>['대표자 성명',30],'businessNumber'=>['사업자등록번호',20],'employerAddress'=>['사업장 주소',100],'employerPhone'=>['사업장 연락처',20]] as $key=>$meta)contract_form_field($values,$prefix,$key,$meta[0],$meta[1]);
}
function contract_payment_fields(array $values,string $prefix): void {
    contract_form_field($values,$prefix,'paymentPeriod','임금 산정기간',50);
    echo '<label class="contract-field"><span>지급월</span><select name="'.view_h($prefix.'[paymentTiming]').'">';foreach(['당월','다음 달'] as $value)echo '<option'.(($values['paymentTiming']??'')===$value?' selected':'').'>'.$value.'</option>';echo '</select></label>';
    contract_form_field($values,$prefix,'paymentDay','급여 지급일 (1~31일)',2,'number');
    contract_form_field($values,$prefix,'paymentMethod','급여 지급 방법',50);
    contract_form_field($values,$prefix,'bonusTerms','상여금 약정 (없으면 없음)',100);
    contract_form_field($values,$prefix,'otherAllowanceTerms','기타 수당·그레이드 기준 (없으면 없음)',100);
}
