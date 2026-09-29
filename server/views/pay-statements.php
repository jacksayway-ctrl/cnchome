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
 $c=$calculation;$month=substr(hr_today(),0,7);$p=$employee['profile'];$hourly=$p['payType']==='시급제';
 $posted=($_SERVER['REQUEST_METHOD']==='POST'&&($_POST['action']??'')==='savePayroll')?$_POST:[];
 $field=fn(string $key,mixed $default=''):string=>$eh($posted[$key]??$c[$key]??$default);
 $items=[];foreach(['allowanceItems','deductionItems'] as $key){$items[$key]=is_array($posted[$key]??null)?$posted[$key]:pay_statement_items($c,$key);if(!$posted&&!isset($c[$key]))foreach($items[$key] as &$oldItem)$oldItem['method']='';unset($oldItem);while(count($items[$key])<8)$items[$key][]=['label'=>'','amount'=>0,'method'=>'','kind'=>'other'];}
 ?>
<section class="nf-card"><h2>이번 달 급여 작성</h2>
<?php if(!$selected): ?><form method="get" class="nf-actions"><input type="hidden" name="role" value="admin"><input type="hidden" name="edit" value="1"><label>직원 <select name="employeeId"><?php foreach($state['employees'] as $e): ?><option value="<?= $e['id'] ?>" <?= $e['id']===$employeeId?'selected':'' ?>><?= $eh($e['profile']['name'].' · '.$e['employeeNo']) ?></option><?php endforeach ?></select></label><button>직원 선택</button></form><?php endif ?>
<form method="post" action="<?= $eh($url.($selected?'&id='.$selected['id']:'').'&edit=1') ?>">
<?= native_csrf() ?><input type="hidden" name="action" value="savePayroll"><input type="hidden" name="id" value="<?= $selected['id']??0 ?>"><input type="hidden" name="revision" value="<?= $eh($posted['revision']??$selected['revision']??0) ?>"><input type="hidden" name="employeeId" value="<?= $employeeId ?>">
<p><strong><?= $eh($p['name']) ?></strong> · <?= $eh($employee['employeeNo']) ?> · 귀속 <?= $eh($month) ?></p>
<div class="nf-grid">
<label class="nf-field">지급일<input type="date" name="payday" required value="<?= $field('payday',(new DateTimeImmutable($month.'-01'))->format('Y-m-t')) ?>"></label>
<label class="nf-field">산정 시작일<input type="date" name="periodStart" required value="<?= $field('periodStart',$month.'-01') ?>"></label>
<label class="nf-field">산정 종료일<input type="date" name="periodEnd" required value="<?= $field('periodEnd',(new DateTimeImmutable($month.'-01'))->format('Y-m-t')) ?>"></label>
<?php if(!$hourly): ?><label class="nf-field">인정 근로시간 (분)<input type="number" min="0" max="44640" name="minutes" required value="<?= $field('minutes',0) ?>"></label><?php endif ?>
</div>
<?php if($hourly): ?>
<p>기본시급 <strong><?= native_money($p['payAmount']/1.2) ?></strong> + 주휴·회사 약정수당 환산액 <strong><?= native_money($p['payAmount']-$p['payAmount']/1.2) ?></strong> = 시간당 약정 합산 기준 <strong><?= native_money($p['payAmount']) ?></strong></p>
<p class="nf-muted">법정 주휴수당은 소정근로시간·개근·주 경계와 적용 요건을 확인해 실제 금액을 입력하세요. 비대상 주는 0원과 사유를 입력합니다. 회사는 법정 주휴수당이 약정 기준에 못 미치는 금액을 별도 지원하며 15시간 미만에도 지원합니다. 법정 금액이 약정 기준을 넘으면 차액을 추가합니다.</p>
<div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>주 시작일 (월)</th><th>이달 인정시간 (분)</th><th>법정 주휴수당 (원)</th><th>산정식·해당 주 요건 또는 비대상 사유</th></tr></thead><tbody>
<?php foreach(pay_statement_weeks($month,$c) as $w): $key=$w['weekStart']; ?><tr><th><?= $eh($key) ?></th><td><input aria-label="<?= $eh($key) ?> 인정시간" type="number" min="0" max="10080" required name="weekMinutes[<?= $eh($key) ?>]" value="<?= $eh($posted['weekMinutes'][$key]??$w['minutes']) ?>"></td><td><input aria-label="<?= $eh($key) ?> 법정 주휴수당" type="number" min="0" max="1000000000" name="statutoryHoliday[<?= $eh($key) ?>]" value="<?= $eh($posted['statutoryHoliday'][$key]??$w['statutoryHoliday']??'') ?>" placeholder="미확인"></td><td><input aria-label="<?= $eh($key) ?> 산정 근거" maxlength="240" name="statutoryMethod[<?= $eh($key) ?>]" value="<?= $eh($posted['statutoryMethod'][$key]??$w['statutoryMethod']??'') ?>" placeholder="예: 주 소정 30시간 ÷ 5일 × 기본시급 / 비대상 사유"></td></tr><?php endforeach ?>
</tbody></table></div>
<label><input type="checkbox" name="agreementConfirmed" value="1" <?= isset($posted['agreementConfirmed'])||(!$posted&&!empty($c['agreementConfirmed']))?'checked':'' ?>> 근로계약의 기본시급·수당 구분, 근로자 사전 약정 및 적용일을 확인했습니다.</label>
<p class="nf-muted">이미 발생한 임금이나 기존 계약의 기본시급을 이 화면만으로 소급하여 낮추지 않습니다. 주가 월 경계에 걸리면 주휴수당이 다른 달에 중복 계산되지 않도록 지급 귀속을 확인하세요.</p>
<?php else: ?><p>월급 기준 <?= native_money($p['payAmount']) ?>. 계약상 주휴 포함 여부와 추가 수당을 확인해 입력하세요.</p><?php endif ?>
<div class="nf-grid"><?php foreach(['overtimeMinutes'=>'연장근로','nightMinutes'=>'야간근로','holidayWorkMinutes'=>'휴일근로'] as $key=>$label): ?><label class="nf-field"><?= $label ?> (분)<input type="number" name="<?= $key ?>" value="<?= $field($key,0) ?>" min="0" max="44640" required></label><?php endforeach ?></div>
<?php foreach(['allowanceItems'=>'기타 지급 항목 (기본급·주휴·회사 약정수당 제외)','deductionItems'=>'공제 항목'] as $key=>$label): ?>
<h3><?= $label ?></h3><div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>항목명</th><?php if($key==='allowanceItems'): ?><th>구분</th><?php endif ?><th>금액 (원)</th><th><?= $key==='allowanceItems'?'계산 방법 (시간·단가·할증률 등)':'계산 방법 또는 공제 근거' ?></th></tr></thead><tbody>
<?php foreach($items[$key] as $index=>$item): ?><tr><td><input aria-label="<?= $label ?> <?= $index+1 ?> 항목명" name="<?= $key ?>[<?= $index ?>][label]" maxlength="60" value="<?= $eh($item['label']??'') ?>" placeholder="<?= $key==='allowanceItems'?'연장수당·그레이드 등':'국민연금·소득세 등' ?>"></td><?php if($key==='allowanceItems'): ?><td><select aria-label="지급 구분" name="<?= $key ?>[<?= $index ?>][kind]"><?php foreach(['other'=>'기타','overtime'=>'연장','night'=>'야간','holidayWork'=>'휴일근로','grade'=>'그레이드'] as $kind=>$text): ?><option value="<?= $kind ?>" <?= ($item['kind']??'other')===$kind?'selected':'' ?>><?= $text ?></option><?php endforeach ?></select></td><?php endif ?><td><input aria-label="<?= $label ?> <?= $index+1 ?> 금액" type="number" min="0" max="1000000000" required name="<?= $key ?>[<?= $index ?>][amount]" value="<?= $eh($item['amount']??0) ?>"></td><td><input aria-label="<?= $label ?> <?= $index+1 ?> 계산 방법" maxlength="400" name="<?= $key ?>[<?= $index ?>][method]" value="<?= $eh($item['method']??'') ?>"></td></tr><?php endforeach ?>
</tbody></table></div><?php endforeach ?>
<label class="nf-field">산정 메모<textarea name="note" maxlength="1000" rows="2"><?= $field('note') ?></textarea></label>
<div class="nf-actions"><button type="submit">계산하여 저장</button><a href="<?= $eh($url) ?>">취소</a></div></form></section>
<?php elseif($selected): $c=$calculation;$name=$snapshot['name']??$employee['profile']['name']??'';$employeeNo=$snapshot['employeeNo']??$employee['employeeNo']??''; ?>
<section class="nf-card nf-pay-statement"><h2>씨앤씨 · <?= $eh($selected['month']) ?> 가지급명세서</h2>
<p><strong><?= $eh($name) ?></strong> · 사번 <?= $eh($employeeNo) ?> · <?= $eh(pay_statement_status($selected['status'])) ?></p>
<p>산정 기간 <?= $eh($c['periodStart']??$selected['month'].'-01') ?> ~ <?= $eh($c['periodEnd']??(new DateTimeImmutable($selected['month'].'-01'))->format('Y-m-t')) ?> · 지급일 <?= $eh($c['payday']??'기존 기록 미등록') ?></p>
<div class="nf-totals" aria-label="지급 합계"><div><span>지급 합계</span><strong><?= native_money($c['gross']) ?></strong></div><div><span>공제 합계</span><strong><?= native_money($c['deductions']) ?></strong></div><div><span>실지급액</span><strong><?= native_money($c['net']) ?></strong></div></div>
<table class="nf-table"><thead><tr><th>지급 항목</th><th>금액</th><th>계산 방법</th></tr></thead><tbody>
<tr><th>기본급</th><td><?= native_money($c['base']) ?></td><td><?= $c['payType']==='월급제'?'계약 월급':native_money($c['baseRate']??$c['rate']).' × '.$eh($c['minutes']).'분 ÷ 60 (원 단위 반올림)' ?></td></tr>
<?php if(isset($c['statementVersion'])&&$c['holidayInclusive']): ?>
<tr><th>법정 주휴수당</th><td><?= native_money($c['statutoryHoliday']) ?></td><td>주별 산정 내역 합계<?= !$c['holidayAssessmentComplete']?' · 산정 확인 전':'' ?></td></tr>
<tr><th>회사 약정수당</th><td><?= native_money($c['companySupport']) ?></td><td>각 주의 약정 주휴·지원 기준액에서 법정 주휴수당을 뺀 부족분 (최소 0원)</td></tr>
<?php elseif(!empty($c['holidayInclusive'])): ?><tr><th>주휴·회사 지원 합계 (기존 기록)</th><td><?= native_money($c['holiday']) ?></td><td><?= native_money($c['holidayRate']) ?> × 인정시간. 기존 기록에 법정·지원 구분 없음</td></tr><?php endif ?>
<?php foreach(pay_statement_items($c,'allowanceItems') as $item): ?><tr><th><?= $eh($item['label']) ?></th><td><?= native_money($item['amount']) ?></td><td><?= $eh($item['method']) ?></td></tr><?php endforeach ?>
</tbody></table>
<?php if($c['holidayInclusive']??false): ?><p>기본시급 <strong><?= native_money($c['baseRate']) ?></strong> + 주휴·회사 약정수당 환산 <strong><?= native_money($c['holidayRate']) ?></strong> = 약정 합산 <strong><?= native_money($c['rate']) ?>/시간</strong>. 법정수당이 이를 초과하면 초과액을 별도로 지급합니다.</p><?php endif ?>
<?php if(isset($c['statementVersion'])): ?><p>연장근로 <?= $eh($c['overtimeMinutes']) ?>분 · 야간근로 <?= $eh($c['nightMinutes']) ?>분 · 휴일근로 <?= $eh($c['holidayWorkMinutes']) ?>분 (중복 시간은 각 항목에 표시)</p><?php endif ?>
<table class="nf-table"><thead><tr><th>공제 항목</th><th>금액</th><th>계산 방법·근거</th></tr></thead><tbody><?php foreach(pay_statement_items($c,'deductionItems') as $item): ?><tr><th><?= $eh($item['label']) ?></th><td><?= native_money($item['amount']) ?></td><td><?= $eh($item['method']) ?></td></tr><?php endforeach ?><?php if(!$c['deductions']): ?><tr><th>공제 없음</th><td>0원</td><td>—</td></tr><?php endif ?></tbody></table>
<?php if($c['weeklyBreakdown']??[]): ?><h3>주별 기본급·주휴·지원 내역</h3><div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>주 시작일</th><th>시간 (분)</th><th>기본급</th><th>법정 주휴</th><th>회사 약정</th><th>주 합계</th><th>주휴 산정 근거</th></tr></thead><tbody><?php foreach($c['weeklyBreakdown'] as $w): ?><tr><th><?= $eh($w['weekStart']) ?></th><td><?= $eh($w['minutes']) ?></td><td><?= native_money($w['base']) ?></td><td><?= array_key_exists('statutoryHoliday',$w)?($w['statutoryHoliday']===null?'미확인':native_money($w['statutoryHoliday'])):'미구분' ?></td><td><?= isset($w['companySupport'])?native_money($w['companySupport']):'미구분' ?></td><td><?= native_money($w['gross']) ?></td><td><?= $eh($w['statutoryMethod']??'기존 주휴·지원 합계 '.native_money($w['holiday'])) ?></td></tr><?php endforeach ?></tbody></table></div><?php endif ?>
<?php if($c['note']): ?><p>산정 메모: <?= nl2br($eh($c['note'])) ?></p><?php endif ?>
<?php $payee=$snapshot??$employee['profile'];$bankLine=implode(' / ',array_filter([$payee['bank']??'',$payee['accountNumber']??'',$payee['accountHolder']??'']));if($bankLine): ?><p>지급 계좌: <?= $eh($bankLine) ?></p><?php endif ?>
<p class="nf-muted">확인은 명세서 수령·내용 확인 상태입니다. 실제 이체 완료, 임금청구권 포기 또는 계산 내용에 대한 법적 적합성 확인을 뜻하지 않습니다.</p>
<div class="nf-actions nf-no-print"><button type="button" data-print>인쇄·PDF 저장</button>
<?php if($admin&&hr_can_change($selected,'savePayroll',true,hr_today())): ?><a href="<?= $eh($url.'&id='.$selected['id'].'&edit=1') ?>">수정</a><?php endif ?>
<?php if($admin&&hr_can_change($selected,'publish',true,hr_today())): ?><form method="post" action="<?= $eh($url.'&id='.$selected['id']) ?>"><?= native_csrf() ?><input type="hidden" name="action" value="publish"><input type="hidden" name="id" value="<?= $selected['id'] ?>"><input type="hidden" name="revision" value="<?= $selected['revision'] ?>"><button>직원에게 게시</button></form><?php endif ?></div>
<?php if(!$admin&&hr_can_change($selected,'confirm',false,hr_today())): ?>
<form method="post" class="nf-card nf-no-print" action="<?= $eh($url.'&id='.$selected['id']) ?>"><?= native_csrf() ?><input type="hidden" name="id" value="<?= $selected['id'] ?>"><input type="hidden" name="revision" value="<?= $selected['revision'] ?>"><label><input type="checkbox" name="reviewed" value="1"> 명세서를 수령하고 내용을 확인했습니다.</label><div class="nf-actions"><button name="action" value="confirm">내용 확인</button></div><label class="nf-field">수정 요청 사유<textarea name="note" maxlength="1000" rows="2"></textarea></label><button name="action" value="request">수정 요청</button></form>
<?php endif ?>
<?php if($selected['events']??[]): ?><details class="nf-no-print"><summary>처리·이전 게시 기록</summary><table class="nf-table"><thead><tr><th>처리 시각 (한국)</th><th>처리</th><th>메모</th><th>당시 게시·산정액</th></tr></thead><tbody><?php foreach($selected['events'] as $event): $when=(new DateTimeImmutable($event['created_at'],new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Seoul'))->format('Y-m-d H:i'); ?><tr><td><?= $eh($when) ?></td><td><?= $eh(['savePayroll'=>'산정 저장','publish'=>'게시','request'=>'수정 요청','confirm'=>'직원 확인'][$event['event']]??$event['event']) ?></td><td><?= $eh($event['note']) ?></td><td><?= isset($event['snapshot']['calculation']['net'])?native_money($event['snapshot']['calculation']['net']):'—' ?></td></tr><?php endforeach ?></tbody></table></details><?php endif ?>
</section>
<?php else: ?>
<section class="nf-card"><p class="nf-muted">게시된 명세서는 직원에게 발급한 내용으로 보존됩니다. 확인 완료·지난달 내역은 조회만 할 수 있습니다.</p><div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>귀속 월</th><?php if($admin): ?><th>직원</th><?php endif ?><th>지급 합계</th><th>공제 합계</th><th>실지급액</th><th>상태</th><th>상세</th></tr></thead><tbody>
<?php foreach($state['payroll'] as $row): $rowName=$row['published_snapshot']['name']??'';if(!$rowName)foreach($state['employees'] as $e)if($e['id']===$row['employee_id'])$rowName=$e['profile']['name']; ?><tr><th><?= $eh($row['month']) ?></th><?php if($admin): ?><td><?= $eh($rowName) ?></td><?php endif ?><td><?= native_money($row['calculation']['gross']) ?></td><td><?= native_money($row['calculation']['deductions']) ?></td><td><?= native_money($row['calculation']['net']) ?></td><td><?= $eh(pay_statement_status($row['status'])) ?></td><td><a href="<?= $eh($url.'&id='.$row['id']) ?>">상세 보기</a></td></tr><?php endforeach ?>
<?php if(!$state['payroll']): ?><tr><td colspan="7">등록된 명세서가 없습니다.</td></tr><?php endif ?>
</tbody></table></div></section>
<?php endif; native_end(); ?>
