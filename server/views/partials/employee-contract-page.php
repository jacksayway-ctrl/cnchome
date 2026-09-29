<?php $openContract=$selected['id']??0; ?>
<section class="contract-panel contract-issued-list"><h2 class="nf-no-print">내 근로계약서</h2>
<p class="contract-hint nf-no-print">발행일이 최근인 순서입니다. 행을 누르면 계약서가 펼쳐지고 다시 누르면 닫힙니다.</p>
<?php if(!$contracts): ?><p class="nf-no-print">아직 발행된 계약서가 없습니다. 아래 기본 양식을 확인할 수 있습니다.</p><?php else: ?>
<div class="contract-table-scroll"><table class="contract-list"><thead class="nf-no-print"><tr><th>발행일</th><th>문서</th><th>계약기간</th><th>상태</th></tr></thead><tbody>
<?php foreach($contracts as $row): $t=$row['issued_snapshot']['terms']??$row['terms'];$expanded=$openContract===$row['id']; ?>
<tr class="contract-click-row contract-summary-row nf-no-print" tabindex="0" data-contract-toggle="contract-detail-<?= $row['id'] ?>" aria-expanded="<?= $expanded?'true':'false' ?>" aria-controls="contract-detail-<?= $row['id'] ?>" aria-label="<?= view_h('제'.$row['version'].'판 계약서 펼치기·닫기') ?>"><th><a href="/contracts.php?role=employee&amp;id=<?= $row['id'] ?>"><?= view_h(contract_korea_time($row['issued_at'])) ?></a></th><td>제<?= $row['version'] ?>판</td><td><?= view_h($t['contractStart'].' ~ '.($t['contractEnd']?:'기간의 정함 없음')) ?></td><td><?= view_h(contract_status($row)) ?></td></tr>
<tr class="contract-detail-row" id="contract-detail-<?= $row['id'] ?>" data-contract-detail <?= $expanded?'':'hidden' ?>><td colspan="4">
<?php $selected=$row;require view_root().'/partials/employee-contract-detail.php'; ?>
</td></tr><?php endforeach; ?>
</tbody></table></div><?php endif ?></section>
<?php if(!$contracts||$basicRequested): require view_root().'/partials/contract-basic-preview.php';else: ?>
<p class="contract-actions nf-no-print"><a href="/contracts.php?role=employee&amp;template=1">근로계약서 기본 양식 보기</a></p>
<?php endif ?>
