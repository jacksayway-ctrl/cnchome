<section class="contract-preview-panel">
<div class="contract-actions nf-no-print"><button type="button" data-contract-print>인쇄 / PDF 저장</button><a class="nf-contract-open" href="/contracts.php?role=employee&amp;id=<?= $selected['id'] ?>&amp;document=1" target="_blank" rel="noopener">계약서만 새 창에서 보기</a><a href="/contracts.php?role=employee&amp;id=<?= $selected['id'] ?>&amp;download=1">계약서 사본 저장</a></div>
<p class="contract-hint nf-no-print">발행일 <?= view_h(contract_korea_time($selected['issued_at'])) ?> · <?= view_h(contract_status($selected)) ?> · A4 세로 한 장 인쇄용</p>
<div class="contract-inline-preview"><?php $documentOnly=false;require view_root().'/contract-document.php'; ?></div>
<section class="contract-employee-approval nf-no-print"><h2>계약 내용 확인</h2><?php require view_root().'/partials/contract-approval.php'; ?><p class="contract-hint">웹 승인은 관리자 적용 요청 기록입니다. 당사자가 서명한 계약서 사본을 함께 보관해 주세요.</p></section>
</section>
