<?php if(isset($selected['issued_snapshot'])&&($selected['issued_snapshot']['formatVersion']??1)<2){require __DIR__.'/contract-document-v1.php';return;} ?>
<?php
$terms=$selected['issued_snapshot']['terms']??$selected['terms'];
$documentOnly=$documentOnly??false;$download=$download??false;
$hours=contract_schedule_totals($terms);$money=fn($n)=>number_format((float)$n).'원';
$duration=fn($n)=>rtrim(rtrim(number_format($n/60,2,'.',''),'0'),'.').'시간';
if($documentOnly): ?>
<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>근로계약서 · <?= view_h($terms['employeeName']) ?> · 제<?= $selected['version'] ?>판</title>
<?php if($download): $cssPath=(defined('CNC_ASSET_ROOT')?CNC_ASSET_ROOT:dirname(__DIR__,2)).'/contract.css'; ?>
<style><?= is_file($cssPath)?file_get_contents($cssPath):'' ?></style>
<?php else: ?><link rel="stylesheet" href="<?= view_h(asset_url('contract.css')) ?>"><?php endif; ?></head><body class="contract-document-page">
<div class="contract-print-tools"><strong>A4 · 세로 · 배율 100%</strong><span>브라우저의 머리글·바닥글은 끄고 인쇄하세요.</span><?php if(!$download): ?><button type="button" data-contract-print>인쇄 / PDF 저장</button><a href="/contracts.php?role=<?= $role ?>&amp;id=<?= $selected['id'] ?>&amp;download=1">계약서 사본 저장</a><?php else: ?><span>Ctrl+P (Mac: ⌘P)로 인쇄할 수 있습니다.</span><?php endif; ?></div>
<?php endif; ?>
<article class="contract-sheet contract-form-v2" aria-label="근로계약서 제<?= $selected['version'] ?>판">
<header class="contract-sheet-heading"><h1>근 로 계 약 서</h1><div>문서 <?= view_h($selected['employee_no']) ?> · 제<?= $selected['version'] ?>판<?= $selected['status']==='draft'?' · 미발행 초안':'' ?></div></header>
<p class="contract-intro">사용자 <?= view_h($terms['employerName']) ?>와 근로자 <?= view_h($terms['employeeName']) ?>는 아래와 같이 근로계약을 체결한다.</p>
<table class="contract-main-form"><colgroup><col class="contract-label-col"><col><col class="contract-label-col"><col></colgroup><tbody>
<tr><th>근무지</th><td><?= view_h($terms['workplace']) ?></td><th>담당업무</th><td><?= view_h($terms['duties']) ?></td></tr>
<tr><th>계약기간</th><td colspan="3"><?= view_h($terms['contractStart']) ?>부터 <?= $terms['contractType']==='무기계약'?'기간의 정함 없음':view_h($terms['contractEnd']).'까지' ?> · 임금 적용일 <?= view_h($terms['wageEffective']) ?></td></tr>
<tr><th>임금</th><td colspan="3">
<p><strong>기본시급 <?= $money($terms['baseHourly']) ?> + 주휴·회사 지원 시간당 환산액 <?= $money($terms['supportHourly']) ?> = 합산 보장 <?= $money($terms['baseHourly']+$terms['supportHourly']) ?>/시간</strong></p>
<p>① 기본급 = 기본시급 × 실제 근로시간. 주별 보장액 = <?= $money($terms['supportHourly']) ?> × 해당 주 실제 근로시간. 법정 주휴수당은 법정 요건·소정근로시간에 따라 별도 산정하며, 보장액보다 많으면 차액을 추가 지급하고 적으면 차액을 회사 지원금으로 지급한다.</p>
<p>② 15시간 미만·입사 첫 주 등 법정 주휴수당 비대상인 때에도 위 보장액을 회사 지원금으로 지급한다. 합산 환산액은 기본시급 자체가 아니며 법정 수당·유급휴가 등은 별도 산정한다.</p>
<p>③ 연장·야간·휴일근로는 법정 한도와 동의 절차에 따르며 적용 법령상 가산수당을 별도 지급한다. 최저임금·유급휴가수당·퇴직급여 등 법정 권리를 제한하지 않는다.</p>
<p>④ 본 임금 구분은 당사자가 서명·합의한 적용일부터 적용한다. 기존 기본시급·수당 약정을 일방적으로 낮추거나 소급 변경하지 않으며 유효한 합의 전에는 기존 약정을 유지한다.</p>
<p><b>상여금</b> <?= view_h($terms['bonusTerms']??'') ?> · <b>기타 수당</b> <?= view_h($terms['otherAllowanceTerms']??'') ?></p>
</td></tr>
<tr><th>급여지급</th><td colspan="3"><?= view_h($terms['paymentPeriod']) ?> 산정분을 <?= view_h($terms['paymentTiming']) ?> <?= (int)$terms['paymentDay'] ?>일에 <?= view_h($terms['paymentMethod']) ?>한다. 해당 일이 없으면 말일, 휴일이면 직전 영업일에 지급한다. 세금·사회보험 등 법정 공제액과 계산 내역을 구분한 임금명세서를 교부한다.</td></tr>
<tr><th>계약요건</th><td colspan="3">계약기간·근무장소·담당업무 등 근로조건의 변경은 당사자의 합의와 관계 법령에 따른다. 계약기간 연장 시 변경 내용을 서면으로 정한다.</td></tr>
<tr><th>근로 및<br>휴일·휴게</th><td colspan="3">
<table class="contract-schedule"><thead><tr><th>요일</th><?php foreach($terms['schedule'] as $day): ?><th><?= $day['day'] ?></th><?php endforeach ?></tr></thead><tbody><tr><th>근로시간</th><?php foreach($terms['schedule'] as $day): ?><td><?= $day['working']?view_h($day['start'].'~'.$day['end']):'휴무' ?></td><?php endforeach ?></tr><tr><th>휴게시간</th><?php foreach($terms['schedule'] as $day): ?><td><?= $day['working']&&$day['breakStart']?view_h($day['breakStart'].'~'.$day['breakEnd']):'—' ?></td><?php endforeach ?></tr></tbody></table>
<p>주 <?= $hours['days'] ?>일 · 소정근로 주 <?= $duration($hours['minutes']) ?> (휴게 제외). 휴게는 자유롭게 사용하며 근로 4시간에 30분 이상, 8시간에 1시간 이상을 근로 도중 부여한다.</p>
<p>주휴일: 매주 <?= view_h($terms['weeklyHoliday']) ?>요일. 법정 요건에 따라 유급으로 부여하며 근로자의 날·그 밖의 휴일·연차유급휴가는 적용 법령에 따른다. <?= view_h(trim($terms['holidayDetail'].' '.$terms['leaveDetail'])) ?></p>
</td></tr>
<tr><th>복무규정</th><td colspan="3">근로자는 관계 법령과 취업규칙을 준수하고 담당 업무를 성실히 수행한다. 손해배상 등은 관계 법령에 따르며 위약금이나 손해배상액을 예정하지 않는다.</td></tr>
<tr><th>퇴사·보험</th><td colspan="3"><p>퇴직 시 업무 인수인계에 협조하며 임금·퇴직급여 등 금품 청산은 관계 법령에 따른다.</p><p>국민연금 <?= view_h($terms['insurancePension']??'확인 필요') ?> · 건강보험 <?= view_h($terms['insuranceHealth']??'확인 필요') ?> · 고용보험 <?= view_h($terms['insuranceEmployment']??'확인 필요') ?> · 산재보험 <?= view_h($terms['insuranceAccident']??'확인 필요') ?>. <?= ($terms['insuranceException']??'')?'법정 제외 사유: '.view_h($terms['insuranceException']):'가입·보험료 부담은 관계 법령에 따른다.' ?></p></td></tr>
<tr><th>기타</th><td colspan="3"><?= view_h($terms['extraTerms']) ?> 정하지 않은 사항은 근로기준법 등 관계 법령에 따른다. 체결 시 근로자의 요구와 관계없이 서명한 계약서 사본을 종이 또는 저장·출력 가능한 전자문서로 교부한다.</td></tr>
</tbody></table>
<p class="contract-written-date"><?= view_h($terms['signedDate']?:'　　　년　　월　　일') ?></p>
<table class="contract-sign-table"><tbody><tr><th>사용자<br>(갑)</th><td>사업체 <?= view_h($terms['employerName']) ?> · 대표 <?= view_h($terms['representative']) ?> <b>(서명 또는 인)</b><br>주소 <?= view_h($terms['employerAddress']) ?><br>연락처 <?= view_h($terms['employerPhone']) ?><?= $terms['businessNumber']?' · 사업자등록번호 '.view_h($terms['businessNumber']):'' ?></td></tr><tr><th>근로자<br>(을)</th><td>성명 <?= view_h($terms['employeeName']) ?> <b>(서명 또는 인)</b> · 생년월일 <?= view_h($terms['employeeBirth']) ?><br>주소 <?= view_h($terms['employeeAddress']) ?><br>연락처 <?= view_h($terms['employeePhone']) ?></td></tr></tbody></table>
<footer class="contract-sheet-footer">문서 <?= (int)$selected['id'] ?> · 제<?= (int)$selected['version'] ?>판 · <?= $selected['status']==='draft'?'미발행 · 서명 전 확인용':'발행 '.contract_korea_time($selected['issued_at']) ?><?= $selected['content_hash']?' · 검증값 '.view_h(substr($selected['content_hash'],0,20)):'' ?><br>웹 승인·관리자 적용은 업무 처리 기록입니다. 당사자가 서명한 계약서 사본을 함께 보관합니다.</footer>
</article>
<?php if($documentOnly): ?><?php if(!$download): ?><script src="<?= view_h(asset_url('contract.js')) ?>" defer></script><?php endif; ?></body></html><?php endif; ?>
