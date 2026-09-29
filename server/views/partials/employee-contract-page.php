<?php if(!$selected): ?>
<?php require view_root().'/partials/contract-basic-preview.php'; ?>
<?php else: $terms=$selected['issued_snapshot']['terms']??$selected['terms']; ?>
<section class="contract-panel contract-preview-panel">
<div class="contract-employee-toolbar nf-no-print">
<form method="get" action="/contracts.php" class="contract-version-select"><input type="hidden" name="role" value="employee"><label>내 계약서 <select name="id" aria-label="내 근로계약서 선택"><?php foreach($contracts as $row): $t=$row['issued_snapshot']['terms']??$row['terms']; ?><option value="<?= (int)$row['id'] ?>" <?= $selected['id']===$row['id']?'selected':'' ?>>제<?= (int)$row['version'] ?>판 · <?= view_h($t['contractStart'].' ~ '.($t['contractEnd']?:'기간의 정함 없음')) ?> · <?= view_h(contract_status($row)) ?></option><?php endforeach ?></select></label><button>불러오기</button></form>
<div class="contract-actions"><button type="button" data-contract-print>인쇄 / PDF 저장</button><a class="nf-contract-open" href="/contracts.php?role=employee&amp;id=<?= (int)$selected['id'] ?>&amp;document=1" target="_blank" rel="noopener">계약서만 새 창에서 보기</a><a href="/contracts.php?role=employee&amp;id=<?= (int)$selected['id'] ?>&amp;download=1">계약서 사본 저장</a><a href="/contracts.php?role=employee&amp;template=1">기본 양식 보기</a></div>
</div>
<p class="contract-hint nf-no-print"><?= view_h(contract_status($selected)) ?> · A4 세로 한 장 인쇄용입니다. 인쇄할 때 머리글·바닥글을 끄고 배율 100%를 선택해 주세요.</p>
<div class="contract-inline-preview"><?php $documentOnly=false;require view_root().'/contract-document.php'; ?></div>
<section class="contract-employee-approval nf-no-print"><h2>계약 내용 확인</h2><?php require view_root().'/partials/contract-approval.php'; ?><p class="contract-hint">웹 승인은 관리자 적용 요청 기록입니다. 당사자가 서명한 계약서 사본을 함께 보관해 주세요.</p></section>
</section>
<?php endif ?>
