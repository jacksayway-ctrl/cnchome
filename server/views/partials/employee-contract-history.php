<?php $contractHistory=$contractHistory??[]; ?>
<section class="nf-no-print contract-history" aria-label="근로계약서 작성·갱신 이력">
<h3>근로계약서 작성·갱신 이력</h3>
<p class="contract-hint">작성일·계약 변경일은 관리자가 입력한 날짜입니다.</p>
<div class="contract-table-scroll"><table class="contract-list"><thead><tr><th>문서</th><th>작성일</th><th>계약 변경일</th><th>발행일</th><th>처리 상태</th></tr></thead><tbody>
<?php foreach($contractHistory as $history): ?><tr><th><?php if($history['issued']): ?><a href="/contracts.php?role=employee&amp;id=<?= $history['id'] ?>">제<?= $history['version'] ?>판</a><?php else: ?>제<?= $history['version'] ?>판<?php endif ?></th><td><?= view_h($history['signedDate']?:'미입력') ?></td><td><?= view_h($history['changedDate']?:'—') ?></td><td><?= view_h($history['issuedAt']?:'미발행') ?></td><td><?= view_h($history['status']) ?></td></tr><?php endforeach ?>
<?php if(!$contractHistory): ?><tr><td colspan="5">등록된 작성·갱신 이력이 없습니다.</td></tr><?php endif ?>
</tbody></table></div></section>
