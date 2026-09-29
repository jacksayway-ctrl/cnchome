<?php
// Failed POSTs retain entered values and their original revision until explicitly reloaded.
$failedPost=$failedPost??[];$failedAction=is_string($failedPost['action']??null)?$failedPost['action']:'';
$companyValues=$company['settings'];$companyRevision=$company['revision'];
if($failedAction==='saveCompany'&&is_array($failedPost['company']??null)){$companyValues=contract_restore_form(array_replace(contract_company_defaults(),$companyValues),$failedPost['company']);$companyRevision=is_scalar($failedPost['revision']??null)?(string)$failedPost['revision']:'0';}
$filterTeam=$filterTeam??'';$filterEmployee=$filterEmployee??0;$filterProfile=$filterProfile??null;$selector='';
if($role==='admin'){
    ob_start(); ?><form method="get" action="/contracts.php" class="contract-selector nf-no-print" data-contract-filter><input type="hidden" name="role" value="admin"><label>부서 <select name="team"><option value="">전체 부서</option><?php foreach(['insurance'=>'보험','cosmetics'=>'화장품','health'=>'건강식품'] as $key=>$label): ?><option value="<?= $key ?>" <?= $filterTeam===$key?'selected':'' ?>><?= $label ?></option><?php endforeach ?></select></label><label>직원 <select name="employeeId"><option value="0">전체 직원</option><?php foreach($employees as $e): $p=json_decode($e['profile'],true); ?><option value="<?= (int)$e['id'] ?>" <?= $filterEmployee===(int)$e['id']?'selected':'' ?>><?= view_h($p['name'].' · '.$e['employee_no']) ?></option><?php endforeach ?></select></label><button>불러오기</button></form><?php $selector=ob_get_clean();
}
native_start('근로계약서',$user,$role==='admin'?'adminContracts':'contracts',[],false,$selector);
function contract_form_field(array $values,string $prefix,string $key,string $label,int $max,string $type='text'): void {
    echo '<label class="contract-field"><span>'.view_h($label).'</span><input type="'.view_h($type).'" name="'.view_h($prefix.'['.$key.']').'" value="'.view_h((string)($values[$key]??'')).'" maxlength="'.$max.'"'.($type==='number'?' min="0" max="1000000" step="1"':'').'></label>';
}
function contract_period_fields(array $values,string $prefix): void {
    $name=fn($key)=>$prefix?$prefix.'['.$key.']':$key;
    $preset=$values['periodPreset']??(($values['contractType']??'')==='무기계약'?'unlimited':($prefix?'custom':'fiveDays'));
    echo '<label class="contract-field">계약기간<select data-period-preset name="'.view_h($name('periodPreset')).'">';
    foreach(['fiveDays'=>'5일 (근무요일 기준)','month'=>'1개월','quarter'=>'3개월','custom'=>'직접 입력','unlimited'=>'기간의 정함 없음'] as $key=>$label)echo '<option value="'.$key.'"'.($preset===$key?' selected':'').'>'.$label.'</option>';
    echo '</select></label>';
    foreach(['contractStart'=>'계약 시작일','contractEnd'=>'계약 종료일'] as $key=>$label)echo '<label class="contract-field">'.$label.'<input data-period-'.($key==='contractStart'?'start':'end').' type="date" name="'.view_h($name($key)).'" value="'.view_h($values[$key]??($key==='contractStart'?hr_today():contract_period(hr_today(),'fiveDays','',['월','화','수','목','금'])['contractEnd'])).'"></label>';
    echo '<span class="contract-hint" data-period-message>5일은 설정된 근무요일 기준입니다. 공휴일 등 예외는 직접 입력으로 조정하세요.</span>';
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
?>
<link rel="stylesheet" href="<?= view_h(asset_url('contract.css')) ?>">
<?php if($error): ?><p class="contract-alert" role="alert"><?= view_h($error) ?></p><?php endif; ?>
<?php if($notice): ?><p class="contract-notice" role="status"><?= view_h($notice) ?></p><?php endif; ?>
<?php if($filterProfile): ?><p class="contract-selection-info"><strong><?= view_h($filterProfile['name']) ?></strong> · <?= view_h(department_label($filterProfile['team'])) ?> · <?= view_h($filterProfile['role']) ?> · 입사 <?= view_h($filterProfile['startDate']) ?> · 급여일 <?= view_h($filterProfile['payday']?:'15') ?>일</p><?php endif ?>
<p class="contract-description">관리자 발급 → 직원 내용 승인 → 관리자 최종 적용 순서로 진행합니다. 승인 기록과 계약서 사본을 보관하며, 당사자 서명은 별도로 확인합니다.</p>
<?php if($role==='admin'): ?>
<details class="contract-panel" <?= !$company['revision']||$failedAction==='saveCompany'?'open':'' ?>><summary>회사 정보 · 계약 기본 서식</summary>
<p class="contract-hint">새 초안의 기본값입니다. 이미 작성하거나 발행한 계약은 바뀌지 않습니다.</p>
<form method="post" action="/contracts.php?role=admin"><?= native_csrf() ?><input type="hidden" name="action" value="saveCompany"><input type="hidden" name="revision" value="<?= view_h((string)$companyRevision) ?>">
<div class="contract-form-grid"><?php contract_company_fields($companyValues,'company');contract_payment_fields($companyValues,'company'); ?></div>
<label class="contract-field"><span>추가 약정 기본 내용 (300자 이내)</span><textarea name="company[extraTerms]" maxlength="300" rows="3"><?= view_h($companyValues['extraTerms']) ?></textarea></label>
<button type="submit">회사 기본 서식 저장</button></form></details>
<section class="contract-panel"><h2>직원별 계약 작성</h2><form method="post" action="/contracts.php?role=admin" class="contract-create" data-contract-period-form><?= native_csrf() ?><input type="hidden" name="action" value="create"><label>직원 선택 <select name="employeeId" required><option value="">직원 선택</option><?php foreach($employees as $employee): $p=json_decode($employee['profile'],true,512,JSON_THROW_ON_ERROR); ?><option value="<?= (int)$employee['id'] ?>" <?= $filterEmployee===(int)$employee['id']?'selected':'' ?>><?= view_h($p['name'].' · '.$employee['employee_no'].' · '.$p['payType']) ?></option><?php endforeach; ?></select></label><?php contract_period_fields([], ''); ?><button type="submit">새 계약 초안 만들기</button></form><p class="contract-hint">시급제 계약 서식입니다. 회사·직원 정보, 근무시간, 보험 적용 여부를 확인한 후 발행하세요. 발행 후에는 개정 초안으로만 변경합니다.</p></section>
<?php endif; ?>
<section class="contract-panel"><h2><?= $role==='admin'?'계약 관리 목록':'내 근로계약서' ?></h2>
<?php if(!$contracts): ?><p>아직 <?= $role==='admin'?'작성한':'발행된' ?> 계약서가 없습니다.</p><?php else: ?>
<div class="contract-table-scroll"><table class="contract-list"><thead><tr><th>직원</th><th>문서</th><th>임금 적용일</th><th>상태</th><th>최근 처리일</th><th>열람</th></tr></thead><tbody>
<?php foreach($contracts as $row): $t=$row['issued_snapshot']['terms']??$row['terms']; ?><tr <?= $selected&&$selected['id']===$row['id']?'class="contract-selected"':'' ?>><td><?= view_h($t['employeeName']) ?></td><td>제<?= $row['version'] ?>판</td><td><?= view_h($t['wageEffective']?:'미입력') ?></td><td><?= view_h(contract_status($row)) ?></td><td><?= view_h(contract_korea_time($row['approval_updated_at']??$row['received_at'])) ?></td><td><a href="/contracts.php?role=<?= $role ?>&amp;id=<?= $row['id'] ?>">상세</a></td></tr><?php endforeach; ?>
</tbody></table></div><?php endif; ?></section>
<?php if($selected): $terms=$selected['issued_snapshot']['terms']??$selected['terms']; ?>
<section class="contract-panel"><div class="contract-section-title"><h2><?= view_h($terms['employeeName']) ?> · 제<?= $selected['version'] ?>판</h2><span><?= view_h(contract_status($selected)) ?></span></div>
<div class="contract-actions"><a class="contract-button" href="/contracts.php?role=<?= $role ?>&amp;id=<?= $selected['id'] ?>&amp;document=1" data-contract-open>계약서 팝업으로 보기</a><a href="/contracts.php?role=<?= $role ?>&amp;id=<?= $selected['id'] ?>&amp;document=1" target="_blank" rel="noopener">A4 한 장 인쇄</a><a href="/contracts.php?role=<?= $role ?>&amp;id=<?= $selected['id'] ?>&amp;download=1">사본 저장 (HTML)</a></div>
<p class="contract-hint">기본시급 <?= number_format($terms['baseHourly']) ?>원 + 주휴수당·회사 지원금 시간당 환산액 <?= number_format($terms['supportHourly']) ?>원 = 합산 보장 환산액 <?= number_format($terms['baseHourly']+$terms['supportHourly']) ?>원. 법정 수당이 보장액보다 크면 차액을 추가 지급합니다.</p>
<?php if($role==='admin'&&$selected['status']==='draft'):
$formTerms=array_replace(['periodPreset'=>$terms['contractType']==='무기계약'?'unlimited':'custom'],$terms);$formRevision=$selected['revision'];$unsavedForm=$failedAction==='save'&&is_scalar($failedPost['id']??null)&&(string)$failedPost['id']===(string)$selected['id'];
if($unsavedForm&&is_array($failedPost['terms']??null)){$formTerms=contract_restore_form($formTerms,$failedPost['terms']);$formRevision=is_scalar($failedPost['revision']??null)?(string)$failedPost['revision']:'0';}
?>
<?php if($unsavedForm): ?><p class="contract-alert">입력 내용과 원래 수정 번호를 보존했습니다. 오류를 고쳐 다시 저장하세요. 다른 창에서 변경된 경우 <a href="/contracts.php?role=admin&amp;id=<?= $selected['id'] ?>">최신 내용 다시 불러오기</a>로 먼저 확인해 주세요. 미리보기는 마지막으로 저장된 내용입니다.</p><?php endif; ?>
<form method="post" action="/contracts.php?role=admin&amp;id=<?= $selected['id'] ?>" data-contract-period-form><?= native_csrf() ?><input type="hidden" name="action" value="save"><input type="hidden" name="id" value="<?= $selected['id'] ?>"><input type="hidden" name="revision" value="<?= view_h((string)$formRevision) ?>">
<fieldset><legend>계약 당사자</legend><div class="contract-form-grid"><?php contract_company_fields($formTerms,'terms');foreach(['employeeName'=>['근로자 성명',50],'employeeBirth'=>['생년월일',10,'date'],'employeeAddress'=>['근로자 주소',120],'employeePhone'=>['근로자 연락처',20]] as $key=>$meta)contract_form_field($formTerms,'terms',$key,$meta[0],$meta[1],$meta[2]??'text'); ?></div></fieldset>
<fieldset><legend>계약기간 · 업무</legend><div class="contract-form-grid"><?php contract_period_fields($formTerms,'terms');foreach(['signedDate'=>'작성일','wageEffective'=>'임금 적용일'] as $key=>$label)contract_form_field($formTerms,'terms',$key,$label,10,'date');contract_form_field($formTerms,'terms','workplace','근무 장소',100);contract_form_field($formTerms,'terms','duties','업무 내용',100); ?><input type="hidden" name="terms[contractType]" value="<?= view_h($formTerms['contractType']) ?>"></div></fieldset>
<fieldset><legend>요일별 근로시간 · 휴게</legend><p class="contract-hint">휴게를 제외한 주 소정근로시간을 입력합니다. 이 서식은 일 8시간·주 40시간 이내, 같은 날 출퇴근하는 근무를 지원합니다.</p><div class="contract-table-scroll"><table class="contract-schedule-editor"><thead><tr><th>근무요일</th><th>시작</th><th>종료</th><th>휴게 시작</th><th>휴게 종료</th></tr></thead><tbody>
<?php foreach($formTerms['schedule'] as $i=>$day): ?><tr><th><label><input type="checkbox" name="terms[schedule][<?= $i ?>][working]" value="1" <?= $day['working']?'checked':'' ?>> <?= $day['day'] ?></label></th><?php foreach(['start'=>'근로 시작','end'=>'근로 종료','breakStart'=>'휴게 시작','breakEnd'=>'휴게 종료'] as $key=>$label): ?><td><input aria-label="<?= $day['day'].'요일 '.$label ?>" type="time" name="terms[schedule][<?= $i ?>][<?= $key ?>]" value="<?= view_h($day[$key]) ?>"></td><?php endforeach; ?></tr><?php endforeach; ?>
</tbody></table></div><div class="contract-form-grid"><label class="contract-field"><span>매주 주휴일</span><select name="terms[weeklyHoliday]"><?php foreach(['월','화','수','목','금','토','일'] as $day): ?><option <?= $formTerms['weeklyHoliday']===$day?'selected':'' ?>><?= $day ?></option><?php endforeach; ?></select></label><?php contract_form_field($formTerms,'terms','holidayDetail','추가 휴일 약정',100);contract_form_field($formTerms,'terms','leaveDetail','추가 휴가 약정',100); ?></div></fieldset>
<fieldset><legend>임금 · 지급 조건</legend><div class="contract-form-grid"><?php contract_form_field($formTerms,'terms','baseHourly','기본시급 (원)',7,'number');contract_form_field($formTerms,'terms','supportHourly','주휴·회사 지원 시간당 환산액 (원)',7,'number');contract_payment_fields($formTerms,'terms'); ?></div><p class="contract-hint">예: 기본시급 12,500원 + 시간당 환산액 2,500원 = 합산 보장 15,000원. 실제 법정 주휴수당과 비교해 부족분은 추가 지급합니다. 15시간 미만 등 법정 대상이 아닌 때에는 회사 지원금으로 구분합니다.</p><label class="contract-check"><input type="checkbox" name="terms[existingWageAgreement]" value="1" <?= $formTerms['existingWageAgreement']?'checked':'' ?>>기존 임금 약정을 확인했습니다. 이 초안으로 기존 기본시급을 일방적으로 낮추거나 소급 변경하지 않으며, 당사자 서명·합의 전에는 기존 약정을 유지합니다.</label></fieldset>
<fieldset><legend>사회보험</legend><div class="contract-form-grid"><?php foreach(['insurancePension'=>'국민연금','insuranceHealth'=>'건강보험','insuranceEmployment'=>'고용보험','insuranceAccident'=>'산재보험'] as $key=>$label): ?><label class="contract-field"><span><?= $label ?></span><select name="terms[<?= $key ?>]"><?php foreach(['확인 필요','적용','법정 제외'] as $value): ?><option <?= ($formTerms[$key]??'확인 필요')===$value?'selected':'' ?>><?= $value ?></option><?php endforeach; ?></select></label><?php endforeach; ?><?php contract_form_field($formTerms,'terms','insuranceException','법정 제외 사유 (해당 시)',100); ?></div></fieldset>
<p class="contract-hint">A4 한 장 인쇄용 자유 입력 문구: <?= contract_print_text_length($formTerms) ?> / 700자. 성명·주소·업무·추가 약정 등의 합계이며 날짜·시간·금액·선택 항목은 제외합니다. 발행할 때 한도를 확인합니다.</p>
<label class="contract-field"><span>추가 약정 (300자 이내 · 법령에 반하는 내용은 효력이 없습니다)</span><textarea name="terms[extraTerms]" maxlength="300" rows="3"><?= view_h($formTerms['extraTerms']) ?></textarea></label>
<div class="contract-actions"><button type="submit">초안 저장</button><span>저장 후 미리보기와 발행을 진행하세요.</span></div></form>
<?php $issues=contract_issue_errors($terms,$selected); if($issues): ?><details class="contract-issue-check"><summary>발행 전 확인할 항목 <?= count($issues) ?>개</summary><ul><?php foreach($issues as $issue): ?><li><?= view_h($issue) ?></li><?php endforeach; ?></ul></details><?php endif; ?>
<form method="post" action="/contracts.php?role=admin&amp;id=<?= $selected['id'] ?>" class="contract-issue-form"><?= native_csrf() ?><input type="hidden" name="action" value="issue"><input type="hidden" name="id" value="<?= $selected['id'] ?>"><input type="hidden" name="revision" value="<?= $selected['revision'] ?>"><p>발급하면 저장된 내용이 고정되고 직원에게 승인 요청으로 표시됩니다.</p><button type="submit" <?= $issues||$unsavedForm?'disabled':'' ?>>직원에게 승인 요청</button></form>
<?php elseif($role==='admin'): ?>
<?php if(contract_workflow_state($selected)==='approved'): ?>
<form method="post" action="/contracts.php?role=admin&amp;id=<?= $selected['id'] ?>"><?= native_csrf() ?><input type="hidden" name="action" value="apply"><input type="hidden" name="id" value="<?= $selected['id'] ?>"><input type="hidden" name="revision" value="<?= $selected['revision'] ?>"><input type="hidden" name="employeeRevision" value="<?= (int)$selected['employee_revision'] ?>"><p>인사정보에 계약기간 <?= view_h($terms['contractStart'].' ~ '.($terms['contractEnd']?:'기간의 정함 없음')) ?> 및 급여일 <?= (int)$terms['paymentDay'] ?>일을 반영합니다.</p><label class="contract-check"><input type="checkbox" name="signedConfirmed" value="1" required>당사자 서명·합의를 확인했고 인사정보에 적용합니다.</label><button type="submit">관리자 최종 적용</button></form>
<?php endif ?>
<?php if(!empty($selected['approval_reason'])): ?><p class="contract-alert">처리 사유: <?= view_h($selected['approval_reason']) ?></p><?php endif ?>
<?php if(in_array(contract_workflow_state($selected),['pending','approved','rejected'],true)): ?><details><summary>발급 회수</summary><form method="post" action="/contracts.php?role=admin&amp;id=<?= $selected['id'] ?>"><?= native_csrf() ?><input type="hidden" name="action" value="withdraw"><input type="hidden" name="id" value="<?= $selected['id'] ?>"><input type="hidden" name="revision" value="<?= $selected['revision'] ?>"><label class="contract-field">회수 사유<input name="reason" maxlength="500" required></label><button type="submit">승인 요청 회수</button></form></details><?php endif ?>

<form method="post" action="/contracts.php?role=admin&amp;id=<?= $selected['id'] ?>"><?= native_csrf() ?><input type="hidden" name="action" value="revise"><input type="hidden" name="id" value="<?= $selected['id'] ?>"><button type="submit">이 계약으로 개정 초안 만들기</button></form>
<?php else: ?><p>발행일 <?= view_h(contract_korea_time($selected['issued_at'])) ?> · 확인일 <?= view_h(contract_korea_time($selected['received_at'])) ?></p><?php endif; ?>
<?php if($events): ?><details class="contract-audit"><summary>발행·확인 기록</summary><ul><?php foreach($events as $event): ?><li><?= view_h(contract_korea_time($event['created_at'])) ?> · <?= view_h(['created'=>'초안 생성','revisedDraft'=>'개정 초안 생성','draftSaved'=>'초안 저장','issued'=>'계약 발행','received'=>'내용·사본 확인','approve'=>'직원 승인','reject'=>'수정 요청','apply'=>'관리자 적용','withdraw'=>'발급 회수'][$event['event']]??$event['event']) ?> · <?= view_h($event['display_name']) ?><?php $audit=json_decode($event['snapshot']??'null',true);if(!empty($audit['reason']))echo ' · '.view_h($audit['reason']); ?></li><?php endforeach; ?></ul></details><?php endif; ?>
</section>
<?php if($role==='employee'): ?><section class="contract-panel"><h2>계약 승인</h2><?php require view_root().'/partials/contract-approval.php'; ?></section><?php endif ?>
<dialog id="contract-dialog" class="contract-dialog" <?= $role==='employee'&&!$error?'data-auto-open':'' ?>><div class="contract-dialog-bar"><strong>근로계약서 · 제<?= $selected['version'] ?>판</strong><button type="button" data-contract-close aria-label="계약서 닫기">닫기</button></div><div class="contract-dialog-content"><?php $documentOnly=false;require view_root().'/contract-document.php'; ?></div><div class="contract-dialog-footer"><div class="contract-actions"><a href="/contracts.php?role=<?= $role ?>&amp;id=<?= $selected['id'] ?>&amp;document=1" target="_blank" rel="noopener">인쇄 / PDF 저장</a><a href="/contracts.php?role=<?= $role ?>&amp;id=<?= $selected['id'] ?>&amp;download=1">계약서 사본 저장</a></div>
<?php if($role==='employee')require view_root().'/partials/contract-approval.php'; ?></div></dialog>
<?php endif; ?>
<script src="<?= view_h(asset_url('contract.js')) ?>" defer></script>
<?php native_end(); ?>
