<?php
declare(strict_types=1);
native_start($admin?'급여·지급 관리':'가지급명세서',$user,$admin?'adminPayroll':'payslips');
$eh=fn(mixed $v):string=>htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
$url='/pay-statements.php?role='.$role;
?>
<?php if($error): ?><p class="nf-alert" role="alert"><?= $eh($error) ?></p><?php endif ?>
<?php if(isset($_GET['saved'])): ?><p class="nf-alert">저장했습니다.</p><?php endif ?>
<div class="nf-actions nf-no-print"><a href="<?= $eh($url) ?>">명세서 목록</a><?php if($admin): ?> <a href="<?= $eh($url.'&edit=1') ?>">이번 달 급여 작성</a><?php endif ?></div>
<?php if($editing&&$employee):
 $c=$calculation;$month=substr(hr_today(),0,7);$p=$employee['profile'];$payMonth=(new DateTimeImmutable($month.'-01'))->modify('+1 month');$defaultPayday=$payMonth->format('Y-m-').str_pad((string)min((int)($p['payday']?:15),(int)$payMonth->format('t')),2,'0',STR_PAD_LEFT);$hourly=$p['payType']==='시급제';
 $posted=($_SERVER['REQUEST_METHOD']==='POST'&&($_POST['action']??'')==='savePayroll')?$_POST:[];
 $field=fn(string $key,mixed $default=''):string=>$eh($posted[$key]??$c[$key]??$default);
 $items=[];foreach(['allowanceItems','deductionItems'] as $key){$items[$key]=is_array($posted[$key]??null)?$posted[$key]:pay_statement_items($c,$key);if($key==='allowanceItems')$items[$key]=array_values(array_filter($items[$key],fn($i)=>!in_array($i['kind']??'',['grade','gradeDaily','gradeWeekly','gradeMonthly'],true)&&!preg_match('/(?:일|주|월)\s*그레이드/u',$i['label']??'')));if(!$posted&&!isset($c[$key]))foreach($items[$key] as &$oldItem)$oldItem['method']='';unset($oldItem);while(count($items[$key])<8)$items[$key][]=['label'=>'','amount'=>0,'method'=>'','kind'=>'other'];}
 ?>
<section class="nf-card"><h2>이번 달 급여 작성</h2>
<?php if(!$selected): ?><form method="get" class="nf-actions"><input type="hidden" name="role" value="admin"><input type="hidden" name="edit" value="1"><label>직원 <select name="employeeId"><?php foreach($state['employees'] as $e): ?><option value="<?= $e['id'] ?>" <?= $e['id']===$employeeId?'selected':'' ?>><?= $eh($e['profile']['name'].' · '.$e['employeeNo']) ?></option><?php endforeach ?></select></label><button>직원 선택</button></form><?php endif ?>
<form method="post" action="<?= $eh($url.($selected?'&id='.$selected['id']:'').'&edit=1') ?>">
<?= native_csrf() ?><input type="hidden" name="action" value="savePayroll"><input type="hidden" name="id" value="<?= $selected['id']??0 ?>"><input type="hidden" name="revision" value="<?= $eh($posted['revision']??$selected['revision']??0) ?>"><input type="hidden" name="employeeId" value="<?= $employeeId ?>">
<p><strong><?= $eh($p['name']) ?></strong> · <?= $eh($employee['employeeNo']) ?> · 귀속 <?= $eh($month) ?></p>
<div class="nf-grid">
<label class="nf-field">지급일<input type="date" name="payday" required value="<?= $field('payday',$defaultPayday) ?>"></label>
<label class="nf-field">산정 시작일<input type="date" name="periodStart" required value="<?= $field('periodStart',$month.'-01') ?>"></label>
<label class="nf-field">산정 종료일<input type="date" name="periodEnd" required value="<?= $field('periodEnd',(new DateTimeImmutable($month.'-01'))->format('Y-m-t')) ?>"></label>
<?php if(!$hourly): ?><label class="nf-field">인정 근로시간 (분)<input type="number" min="0" max="44640" name="minutes" required value="<?= $field('minutes',0) ?>"></label><?php endif ?>
</div>
<?php if($hourly): ?>
<p><strong>시간근무금액 = 실제 근무시간 × <?= native_money($p['payAmount']) ?></strong></p>
<p>기본시급 <strong><?= native_money($p['payAmount']/1.2) ?></strong> + 주휴수당 포함분 <strong><?= native_money($p['payAmount']-$p['payAmount']/1.2) ?></strong> (시간당 환산) = <strong><?= native_money($p['payAmount']) ?>/시간</strong>. 주휴 포함분을 합산 시급에 다시 더하지 않습니다.</p>
<p class="nf-muted">법정 주휴수당은 소정근로시간·개근·주 경계와 적용 요건을 확인해 실제 금액을 입력하세요. 비대상 주는 0원과 사유를 입력합니다. 회사는 법정 주휴수당이 약정 기준에 못 미치는 금액을 별도 지원하며 15시간 미만에도 지원합니다. 법정 금액이 약정 기준을 넘으면 차액을 추가합니다.</p>
<div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>주 시작일 (월)</th><th>이달 실제 근무시간 (분)</th><th>법정 주휴수당 (원)</th><th>산정식·해당 주 요건 또는 비대상 사유</th></tr></thead><tbody>
<?php foreach(pay_statement_weeks($month,$c) as $w): $key=$w['weekStart']; ?><tr><th><?= $eh($key) ?></th><td><input aria-label="<?= $eh($key) ?> 인정시간" type="number" min="0" max="10080" required name="weekMinutes[<?= $eh($key) ?>]" value="<?= $eh($posted['weekMinutes'][$key]??$w['minutes']) ?>"></td><td><input aria-label="<?= $eh($key) ?> 법정 주휴수당" type="number" min="0" max="1000000000" name="statutoryHoliday[<?= $eh($key) ?>]" value="<?= $eh($posted['statutoryHoliday'][$key]??$w['statutoryHoliday']??'') ?>" placeholder="미확인"></td><td><input aria-label="<?= $eh($key) ?> 산정 근거" maxlength="240" name="statutoryMethod[<?= $eh($key) ?>]" value="<?= $eh($posted['statutoryMethod'][$key]??$w['statutoryMethod']??'') ?>" placeholder="예: 주 소정 30시간 ÷ 5일 × 기본시급 / 비대상 사유"></td></tr><?php endforeach ?>
</tbody></table></div>
<label><input type="checkbox" name="agreementConfirmed" value="1" <?= isset($posted['agreementConfirmed'])||(!$posted&&!empty($c['agreementConfirmed']))?'checked':'' ?>> 근로계약의 기본시급·수당 구분, 근로자 사전 약정 및 적용일을 확인했습니다.</label>
<p class="nf-muted">이미 발생한 임금이나 기존 계약의 기본시급을 이 화면만으로 소급하여 낮추지 않습니다. 주가 월 경계에 걸리면 주휴수당이 다른 달에 중복 계산되지 않도록 지급 귀속을 확인하세요.</p>
<?php else: ?><p>월급 기준 <?= native_money($p['payAmount']) ?>. 계약상 주휴 포함 여부와 추가 수당을 확인해 입력하세요.</p><?php endif ?>
<div class="nf-grid"><?php foreach(['overtimeMinutes'=>'연장근로','nightMinutes'=>'야간근로','holidayWorkMinutes'=>'휴일근로'] as $key=>$label): ?><label class="nf-field"><?= $label ?> (분)<input type="number" name="<?= $key ?>" value="<?= $field($key,0) ?>" min="0" max="44640" required></label><?php endforeach ?></div>
<?php $grade=grade_employee_context($employee,$month);$gradeLive=true;require view_root().'/partials/pay-grade-detail.php';unset($grade); ?>
<?php foreach(['allowanceItems'=>'기타 지급 항목 (기본급·주휴·회사 약정수당 제외)','deductionItems'=>'공제 항목'] as $key=>$label): ?>
<h3><?= $label ?></h3><div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>항목명</th><?php if($key==='allowanceItems'): ?><th>구분</th><?php endif ?><th>금액 (원)</th><th><?= $key==='allowanceItems'?'계산 방법 (시간·단가·할증률 등)':'계산 방법 또는 공제 근거' ?></th></tr></thead><tbody>
<?php foreach($items[$key] as $index=>$item): ?><tr><td><input aria-label="<?= $label ?> <?= $index+1 ?> 항목명" name="<?= $key ?>[<?= $index ?>][label]" maxlength="60" value="<?= $eh($item['label']??'') ?>" placeholder="<?= $key==='allowanceItems'?'연장수당·기타 수당 등':'국민연금·소득세 등' ?>"></td><?php if($key==='allowanceItems'): ?><td><select aria-label="지급 구분" name="<?= $key ?>[<?= $index ?>][kind]"><?php foreach(['other'=>'기타','overtime'=>'연장','night'=>'야간','holidayWork'=>'휴일근로'] as $kind=>$text): ?><option value="<?= $kind ?>" <?= ($item['kind']??'other')===$kind?'selected':'' ?>><?= $text ?></option><?php endforeach ?></select></td><?php endif ?><td><input aria-label="<?= $label ?> <?= $index+1 ?> 금액" type="number" min="0" max="1000000000" required name="<?= $key ?>[<?= $index ?>][amount]" value="<?= $eh($item['amount']??0) ?>"></td><td><input aria-label="<?= $label ?> <?= $index+1 ?> 계산 방법" maxlength="400" name="<?= $key ?>[<?= $index ?>][method]" value="<?= $eh($item['method']??'') ?>"></td></tr><?php endforeach ?>
</tbody></table></div><?php endforeach ?>
<label class="nf-field">산정 메모<textarea name="note" maxlength="1000" rows="2"><?= $field('note') ?></textarea></label>
<div class="nf-actions"><button type="submit">계산하여 저장</button><a href="<?= $eh($url) ?>">취소</a></div></form></section>
<?php else: $openId=$selected['id']??0; ?>
<section class="nf-card nf-pay-list"><p class="nf-muted nf-no-print">직원 행을 클릭하면 아래에 명세서가 펼쳐지고 다시 클릭하면 닫힙니다.</p><div class="nf-table-wrap"><table class="nf-table nf-pay-list-table"><thead class="nf-pay-summary"><tr><th>귀속 월</th><?php if($admin): ?><th>직원</th><?php endif ?><th>지급 합계</th><th>공제 합계</th><th>일그레이드 선지급</th><th>실지급액</th><th>상태</th></tr></thead><tbody>
<?php foreach($state['payroll'] as $row):
 $employee=null;foreach($state['employees'] as $e)if($e['id']===$row['employee_id'])$employee=$e;
 $rowName=$row['published_snapshot']['name']??$employee['profile']['name']??'';$expanded=$openId===$row['id'];
 ?><tr class="nf-pay-summary nf-pay-toggle" tabindex="0" data-pay-toggle="pay-<?= $row['id'] ?>" aria-expanded="<?= $expanded?'true':'false' ?>" aria-controls="pay-<?= $row['id'] ?>" aria-label="<?= $eh($rowName.' '.$row['month'].' 명세서 열기·닫기') ?>"><th><a href="<?= $eh($url.'&id='.$row['id']) ?>"><?= $eh($row['month']) ?></a></th><?php if($admin): ?><td><?= $eh($rowName) ?></td><?php endif ?><td><?= native_money($row['calculation']['gross']) ?></td><td><?= native_money($row['calculation']['deductions']) ?></td><td><?= native_money($row['calculation']['prepaidDaily']??0) ?></td><td><strong><?= native_money($row['calculation']['net']) ?></strong></td><td><?= $eh(pay_statement_status($row['status'])) ?></td></tr>
 <tr id="pay-<?= $row['id'] ?>" class="nf-pay-detail" <?= $expanded?'':'hidden' ?>><td colspan="<?= $admin?7:6 ?>"><?php $selected=$row;$calculation=$row['calculation'];$snapshot=$row['published_snapshot'];require view_root().'/partials/pay-statement-detail.php'; ?></td></tr>
<?php endforeach ?>
<?php if(!$state['payroll']): ?><tr><td colspan="7">등록된 명세서가 없습니다.</td></tr><?php endif ?>
</tbody></table></div></section>
<?php endif; native_end(); ?>
