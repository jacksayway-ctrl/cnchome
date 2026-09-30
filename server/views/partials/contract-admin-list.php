<section class="contract-panel nf-no-print" data-contract-management-list><div class="membership-heading"><h2>계약 관리 목록</h2><a class="nf-button" href="/memberships.php?role=admin">회원가입 · 로그인 승인</a></div>
<p class="contract-hint">직원 행을 누르면 계약 내용을 확인하고 수정할 수 있는 새창이 열립니다.</p>
<?php if(!$contracts): ?><p>아직 작성한 계약서가 없습니다.</p><?php else: ?>
<div class="contract-table-scroll"><table class="contract-list"><thead><tr><th>직원</th><th>문서</th><th>발행일</th><th>임금 적용일</th><th>상태</th><th>최근 처리일</th></tr></thead><tbody>
<?php foreach($contracts as $row): $t=$row['issued_snapshot']['terms']??$row['terms']; ?>
<tr class="contract-click-row<?= $selected&&$selected['id']===$row['id']?' contract-selected':'' ?>" data-contract-window-row tabindex="0" aria-label="<?= view_h($t['employeeName'].' 제'.$row['version'].'판 새창에서 열기') ?>">
<td><a data-contract-window href="/contracts.php?role=admin&amp;id=<?= $row['id'] ?>&amp;editWindow=1" target="_blank" rel="noopener"><?= view_h($t['employeeName']) ?></a></td><td>제<?= $row['version'] ?>판</td><td><?= $row['issued_at']?view_h(contract_korea_time($row['issued_at'])):'미발행' ?></td><td><?= view_h($t['wageEffective']?:'미입력') ?></td><td><?= view_h(contract_status($row)) ?></td><td><?= view_h(contract_korea_time($row['approval_updated_at']??$row['received_at'])) ?></td></tr>
<?php endforeach; ?></tbody></table></div><?php endif; ?></section>

<?php $membershipReturn='contracts';$memberships=$memberships??[];require view_root().'/partials/membership-list.php'; ?>
