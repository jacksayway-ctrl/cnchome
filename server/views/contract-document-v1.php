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
<article class="contract-sheet" aria-label="근로계약서 제<?= $selected['version'] ?>판">
<header class="contract-sheet-heading"><h1>근로계약서 <small>(시급제)</small></h1><div>문서 <?= view_h($selected['employee_no']) ?> · 제<?= $selected['version'] ?>판<?= $selected['status']==='draft'?' · 미발행 초안':'' ?></div></header>
<p class="contract-intro">사용자와 근로자는 아래의 근로조건을 정하고, 관계 법령에 따른 권리와 의무를 성실히 이행한다.</p>
<table class="contract-parties"><tbody>
<tr><th rowspan="2">사용자</th><td><b>사업장명</b> <?= view_h($terms['employerName']?:'미입력') ?></td><td><b>대표자</b> <?= view_h($terms['representative']?:'미입력') ?></td><td><b>연락처</b> <?= view_h($terms['employerPhone']?:'미입력') ?></td></tr>
<tr><td colspan="3"><b>주소</b> <?= view_h($terms['employerAddress']?:'미입력') ?><?= $terms['businessNumber']?' · 사업자등록번호 '.view_h($terms['businessNumber']):'' ?></td></tr>
<tr><th rowspan="2">근로자</th><td><b>성명</b> <?= view_h($terms['employeeName']) ?></td><td><b>생년월일</b> <?= view_h($terms['employeeBirth']?:'미입력') ?></td><td><b>연락처</b> <?= view_h($terms['employeePhone']?:'미입력') ?></td></tr>
<tr><td colspan="3"><b>주소</b> <?= view_h($terms['employeeAddress']?:'미입력') ?></td></tr>
</tbody></table>
<section><h2>1. 계약기간 및 업무</h2><p><b>계약기간</b> <?= view_h($terms['contractStart']?:'미입력') ?>부터 <?= $terms['contractType']==='무기계약'?'기간의 정함 없음':view_h($terms['contractEnd']?:'미입력').'까지' ?> · <b>임금 적용일</b> <?= view_h($terms['wageEffective']?:'미입력') ?></p><p><b>근무장소</b> <?= view_h($terms['workplace']?:'미입력') ?> · <b>업무</b> <?= view_h($terms['duties']?:'미입력') ?></p></section>
<section><h2>2. 근로일별 소정근로시간 및 휴게시간</h2>
<table class="contract-schedule"><thead><tr><th>요일</th><?php foreach($terms['schedule'] as $day): ?><th><?= $day['day'] ?></th><?php endforeach; ?></tr></thead><tbody>
<tr><th>근로시간</th><?php foreach($terms['schedule'] as $day): ?><td><?= $day['working']?view_h(($day['start']?:'—').'~'.($day['end']?:'—')):'휴무' ?></td><?php endforeach; ?></tr>
<tr><th>휴게시간</th><?php foreach($terms['schedule'] as $day): ?><td><?= $day['working']&&$day['breakStart']?view_h($day['breakStart'].'~'.$day['breakEnd']):'—' ?></td><?php endforeach; ?></tr>
</tbody></table><p>주 <?= $hours['days'] ?>일 · 소정근로 주 <?= $duration($hours['minutes']) ?> (휴게시간 제외). 휴게는 근로자가 자유롭게 사용하며, 근로 4시간에 30분 이상·8시간에 1시간 이상을 근로시간 도중 부여한다.</p></section>
<section><h2>3. 임금의 구성·계산·지급</h2>
<table class="contract-wage"><thead><tr><th>기본시급</th><th>주휴수당·회사 지원금 시간당 환산액</th><th>합산 보장 환산액</th></tr></thead><tbody><tr><td><?= $money($terms['baseHourly']) ?></td><td><?= $money($terms['supportHourly']) ?></td><td><strong><?= $money($terms['baseHourly']+$terms['supportHourly']) ?></strong></td></tr></tbody></table>
<p>① 기본급은 기본시급 × 실제 근로시간으로 산정한다. 주별 보장액은 <?= $money($terms['supportHourly']) ?> × 해당 주 실제 근로시간이며, 주휴수당은 법정 요건·소정근로시간에 따라 별도 산정한다. 해당 주 법정 주휴수당이 보장액보다 많으면 그 차액을 추가 지급하고, 적으면 차액을 회사 지원금으로 지급한다.</p>
<p>② 15시간 미만 근무·입사 첫 주 등 법정 주휴수당 지급 대상이 아닌 경우에도 위 보장액을 회사 지원금으로 지급한다. 합산 환산액은 기본시급 자체가 아니며, 법정 수당·유급휴가 등 추가 지급액에 따라 실제 지급액이 증가할 수 있다.</p>
<p>③ 연장·야간·휴일근로는 법정 한도 및 동의 절차에 따르고, 적용 법령에 따른 가산수당을 별도 지급한다. 이 계약으로 법정 최저임금·유급휴가수당·퇴직급여 등 권리를 제한하지 않는다.</p>
<p>④ <b>산정기간</b> <?= view_h($terms['paymentPeriod']) ?> · <b>지급일</b> <?= view_h($terms['paymentTiming']) ?> <?= (int)$terms['paymentDay'] ?>일 (해당 일이 없으면 말일, 휴일이면 직전 영업일) · <b>방법</b> <?= view_h($terms['paymentMethod']) ?>. 세금·사회보험 등 법정 공제액을 구분하고 계산 내역을 적은 임금명세서를 지급한다.</p>
<p>⑤ <b>상여금</b> <?= view_h($terms['bonusTerms']??'미입력') ?> · <b>기타 수당</b> <?= view_h($terms['otherAllowanceTerms']??'미입력') ?></p>
<p>⑥ 본 임금 구분은 당사자가 서명·합의한 적용일부터 적용한다. 기존 기본시급·수당 약정을 일방적으로 낮추거나 소급 변경하지 않으며, 별도 유효한 합의 전에는 기존 약정을 유지한다.</p>
</section>
<section><h2>4. 휴일·휴가 및 사회보험</h2>
<p><b>주휴일</b> 매주 <?= view_h($terms['weeklyHoliday']) ?>요일. 법정 요건에 따라 유급으로 부여하며, 근로자의 날 및 그 밖의 휴일·연차유급휴가는 적용 법령에 따른다. <?= view_h(trim($terms['holidayDetail'].' '.$terms['leaveDetail'])) ?></p>
<p><b>사회보험</b> 국민연금 <?= view_h($terms['insurancePension']??'확인 필요') ?> · 건강보험 <?= view_h($terms['insuranceHealth']??'확인 필요') ?> · 고용보험 <?= view_h($terms['insuranceEmployment']??'확인 필요') ?> · 산재보험 <?= view_h($terms['insuranceAccident']??'확인 필요') ?>. <?= ($terms['insuranceException']??'')?'법정 제외 사유: '.view_h($terms['insuranceException']):'가입·보험료 부담은 관계 법령에 따른다.' ?></p>
</section>
<section><h2>5. 기타 약정 및 계약서 교부</h2><p><?= $terms['extraTerms']?nl2br(view_h($terms['extraTerms'])).' ':'' ?>이 계약에서 정하지 않은 사항은 근로기준법 등 관계 법령에 따른다. 사용자는 체결 시 근로자의 요구와 관계없이 서명한 계약서 사본을 종이 또는 저장·출력 가능한 전자문서로 근로자에게 교부한다.</p></section>
<div class="contract-signatures"><p><b>작성일</b> <?= view_h($terms['signedDate']?:'　　　년　　월　　일') ?></p><div><span>사용자(대표자) <?= view_h($terms['representative']) ?> <b>(서명 또는 인)</b></span><span>근로자 <?= view_h($terms['employeeName']) ?> <b>(서명 또는 인)</b></span></div></div>
<footer class="contract-sheet-footer">문서 <?= $selected['id'] ?> · 제<?= $selected['version'] ?>판 · <?= $selected['status']==='draft'?'미발행 · 서명 전 확인용':'발행 '.contract_korea_time($selected['issued_at']) ?><?= $selected['content_hash']?' · 검증값 '.view_h(substr($selected['content_hash'],0,20)):'' ?><br>웹 승인·관리자 적용은 업무 처리 기록입니다. 당사자가 서명한 계약서 사본을 함께 보관합니다.</footer>
</article>
<?php if($documentOnly): ?><?php if(!$download): ?><script src="<?= view_h(asset_url('contract.js')) ?>" defer></script><?php endif; ?></body></html><?php endif; ?>
