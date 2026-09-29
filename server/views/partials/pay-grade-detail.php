<?php
$gradeLive=$gradeLive??false;
$g=$grade??$c['gradeSnapshot']??($employee?grade_employee_context($employee,$selected['month']??$month):null);
$cashSettlement=$gradeLive||($c['dailyGradeSettlement']??'')==='cash';
if($g): ?>
<section class="nf-grade-detail"><h3>그레이드 산정 · <?= $eh($g['month']) ?></h3>
<p class="nf-muted"><?= isset($c['gradeSnapshot'])&&!$gradeLive?'저장 당시 산정 내역':($gradeLive?'저장 시 최신 실적·수령 기록으로 자동 반영':'현재 기준 참고 내역 · 기존 게시 금액은 유지') ?> · 정상 실적 <?= $eh($g['count']) ?>건 · <?= $eh($g['asOf']??'') ?> 기준</p>
<?php if($cashSettlement): ?>
<table class="nf-table"><thead><tr><th>일그레이드 발생액</th><th>일그레이드 현금 지급</th><th>일그레이드 현금 지급 대기</th><th>주그레이드</th><th>월그레이드</th></tr></thead><tbody><tr><td><?= native_money($g['daily']) ?></td><td><?= native_money($g['dailyReceived']??0) ?></td><td><?= native_money(max(0,$g['daily']-($g['dailyReceived']??0))) ?></td><td><?= native_money($g['weekly']) ?></td><td><?= native_money($g['monthly']) ?></td></tr></tbody></table>
<p><strong>급여일 그레이드 지급액 <?= native_money($g['weekly']+$g['monthly']) ?></strong> = 주그레이드 + 월그레이드. 두 항목은 함께 지급합니다.</p>
<p>일그레이드는 당일 현금 지급 항목입니다. 수령 확인된 지급 총액을 명세서에 표시하고 같은 금액을 선지급으로 빼므로 급여일 실지급액에는 포함되지 않습니다. 미수령액은 별도 현금 지급 대기로 관리합니다.</p>
<?php else: ?>
<table class="nf-table"><thead><tr><th>일그레이드 발생액</th><th>주그레이드</th><th>월그레이드</th><th>일그레이드 선지급</th><th>기존 그레이드 잔여 지급액</th></tr></thead><tbody><tr><td><?= native_money($g['daily']) ?></td><td><?= native_money($g['weekly']) ?></td><td><?= native_money($g['monthly']) ?></td><td>− <?= native_money($g['dailyReceived']??0) ?></td><td><?= native_money($g['daily']+$g['weekly']+$g['monthly']-($g['dailyReceived']??0)) ?></td></tr></tbody></table>
<p class="nf-muted"><?= isset($c['gradeSnapshot'])?'이전 산정 방식의 기록입니다. 당시에는 일그레이드 발생액에서 선지급액을 뺀 나머지도 급여에 반영했습니다.':'현재 그레이드 기준 참고 내역이며, 이 명세서의 기존 지급액과는 다를 수 있습니다.' ?> 저장된 금액은 그대로 표시하며, 새로 계산하여 저장하면 일그레이드가 별도 현금 정산으로 분리됩니다.</p>
<?php endif ?>
<details><summary>적용일별 비율·주별 산정 근거</summary><table class="nf-table"><thead><tr><th>구분</th><th>적용 기간</th><th>적용 기준일</th><th>기준 수당</th><th>반영 비율</th><th>반영액</th></tr></thead><tbody>
<?php foreach($g['parts'] as $part): ?><tr><th>월그레이드</th><td><?= $eh($part['start'].' ~ '.$part['end']) ?></td><td><?= $eh($part['effective']) ?></td><td><?= native_money($part['fullBonus']) ?></td><td><?= $part['days'] ?> / <?= $g['days'] ?>일</td><td><?= native_money($part['bonus']) ?></td></tr><?php endforeach ?>
<?php foreach($g['weeks'] as $week): foreach($week['parts'] as $part): ?><tr><th>주그레이드<?= !$week['included']?' ('.($week['missing']?'집계 중':$week['payrollMonth'].' 귀속').')':'' ?></th><td><?= $eh($part['start'].' ~ '.$part['end']) ?></td><td><?= $eh($part['effective']) ?></td><td><?= native_money($part['fullBonus']) ?></td><td><?= $part['days'] ?> / 5일</td><td><?= $week['included']?native_money($part['bonus']):'이번 달 합산 제외' ?></td></tr><?php endforeach; endforeach ?>
</tbody></table><p class="nf-muted">각 주·월 전체 실적으로 구간을 정한 뒤 적용기간 비율을 곱합니다. 주는 금요일이 속한 달에 한 번 반영하며 아직 끝나지 않은 주는 집계 중입니다. 원 단위 반올림은 기간 합계에 한 번 적용합니다.</p></details>
</section><?php endif; $gradeLive=false; ?>
