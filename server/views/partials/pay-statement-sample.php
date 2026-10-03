<?php
$sampleEmployee=$state['employees'][0]??null;$sampleProfile=$sampleEmployee['profile']??[];$sampleMonth=substr(hr_today(),0,7);
?>
<section class="nf-card nf-pay-statement" aria-label="가지급명세서 샘플">
 <h2>씨앤씨 · <?= $eh($sampleMonth) ?> 가지급명세서 <span class="nf-muted">샘플</span></h2>
 <p class="nf-alert">서식 확인용 샘플입니다. 아래 금액은 예시이며 실제 지급 내역에 저장되지 않습니다.</p>
 <p><strong><?= $eh($sampleProfile['name']??$user['display_name']) ?></strong> · 사번 <?= $eh($sampleEmployee['employeeNo']??'미등록') ?> · 직급 <?= $eh(($sampleProfile['jobRank']??'')?:'미등록') ?></p>
 <p>산정 기간 <?= $eh($sampleMonth.'-01') ?> ~ <?= $eh((new DateTimeImmutable($sampleMonth.'-01'))->format('Y-m-t')) ?> · 지급일 <?= $eh((new DateTimeImmutable($sampleMonth.'-01'))->modify('+1 month')->format('Y-m-15')) ?></p>
 <div class="nf-totals" aria-label="샘플 지급 합계"><div><span>지급 합계</span><strong>2,260,000원</strong></div><div><span>공제 합계</span><strong>80,000원</strong></div><div><span>일그레이드 선지급</span><strong>60,000원</strong></div><div><span>실지급액</span><strong>2,120,000원</strong></div></div>
 <div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>지급 항목</th><th>예시 금액</th><th>산정 내역</th></tr></thead><tbody>
  <tr><th>기본급·주휴 포함 근로금액</th><td>1,800,000원</td><td>120시간 × 15,000원</td></tr>
  <tr><th>일그레이드</th><td>60,000원</td><td>이번 달 수령 총액 · 선지급 처리</td></tr>
  <tr><th>주그레이드</th><td>100,000원</td><td>마감된 주별 그레이드 합계</td></tr>
  <tr><th>월그레이드</th><td>200,000원</td><td>월별 실적 구간에 따른 수당</td></tr>
  <tr><th>직급수당</th><td>100,000원</td><td>직급에 따른 수당 예시</td></tr>
  <tr><th>기타 수당</th><td>0원</td><td>해당 없음</td></tr>
 </tbody></table></div>
 <h3>공제·정산</h3><table class="nf-table"><tbody><tr><th>일그레이드 선지급 차감</th><td>60,000원</td></tr><tr><th>기타 공제 합계</th><td>80,000원</td></tr></tbody></table>
 <p class="nf-pay-formula">실지급액 2,120,000원 = 지급 합계 2,260,000원 − 일그레이드 선지급 60,000원 − 공제 80,000원</p>
 <div class="nf-actions nf-no-print"><button type="button" data-print>샘플 인쇄·PDF 저장</button></div>
</section>
