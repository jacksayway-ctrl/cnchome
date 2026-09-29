<?php
$templateValues=contract_template_values($company['settings']);$templateRevision=$company['revision'];
if($failedAction==='saveTemplate'&&is_array($failedPost['template']??null)){
    $templateValues=contract_restore_form($templateValues,$failedPost['template']);
    $postedDays=$failedPost['template']['workDays']??[];
    $templateValues['workDays']=is_array($postedDays)?array_values(array_filter($postedDays,fn($day)=>is_string($day)&&in_array($day,['월','화','수','목','금','토','일'],true))):[];
    $templateRevision=is_scalar($failedPost['revision']??null)?(string)$failedPost['revision']:'0';
}
?>
<details class="contract-template-editor nf-no-print" open><summary>기본 양식 입력·수정</summary>
<form method="post" action="/contracts.php?role=admin" data-contract-period-form>
<?= native_csrf() ?><input type="hidden" name="action" value="saveTemplate"><input type="hidden" name="revision" value="<?= view_h((string)$templateRevision) ?>">
<div class="contract-form-grid">
<?php contract_period_fields($templateValues,'template');
foreach(['workplace'=>['근무 장소',100],'duties'=>['담당 업무',100]] as $key=>$meta)contract_form_field($templateValues,'template',$key,$meta[0],$meta[1]);
foreach(['workStart'=>'근로 시작','workEnd'=>'근로 종료','breakStart'=>'휴게 시작','breakEnd'=>'휴게 종료'] as $key=>$label)contract_form_field($templateValues,'template',$key,$label,5,'time');
contract_form_field($templateValues,'template','baseHourly','기본시급 (원)',7,'number');contract_form_field($templateValues,'template','supportHourly','주휴·회사 지원 환산액 (원)',7,'number'); ?>
<label class="contract-field">유급 주휴일<select name="template[weeklyHoliday]"><?php foreach(['월','화','수','목','금','토','일'] as $day): ?><option value="<?= $day ?>" <?= $templateValues['weeklyHoliday']===$day?'selected':'' ?>><?= $day ?>요일</option><?php endforeach ?></select></label>
</div>
<fieldset class="contract-weekdays"><legend>근무요일 · 선택하지 않은 요일은 휴일</legend><?php foreach(['월','화','수','목','금','토','일'] as $day): ?><label><input type="checkbox" name="template[workDays][]" value="<?= $day ?>" data-template-workday <?= in_array($day,$templateValues['workDays'],true)?'checked':'' ?>><?= $day ?></label><?php endforeach ?></fieldset>
<p class="contract-hint">기본 휴일은 토·일요일입니다. 입사일·성명 등 개인별 정보는 상단에서 직원을 선택한 뒤 계약 초안의 입력란에서 수정합니다.</p>
<button type="submit">기본 양식 저장</button> <span class="contract-hint">저장하면 직원의 공통 기본 양식에도 반영됩니다.</span>
</form></details>
