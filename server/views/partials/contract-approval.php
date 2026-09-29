<?php $approvalState=contract_workflow_state($selected); ?>
<?php if($role==='employee'&&$approvalState==='pending'): ?>
<form method="post" action="/contracts.php?role=employee&amp;id=<?= $selected['id'] ?>">
<?= native_csrf() ?><input type="hidden" name="action" value="approve"><input type="hidden" name="id" value="<?= $selected['id'] ?>"><input type="hidden" name="revision" value="<?= $selected['revision'] ?>">
<label class="contract-check"><input type="checkbox" name="reviewed" value="1" required>계약 내용과 사본을 확인했으며, 이 내용의 관리자 적용을 요청합니다.</label>
<label class="contract-field">승인자 성명<input name="approvalName" maxlength="50" placeholder="본인 성명 입력" autocomplete="name" required></label><button type="submit">계약 내용 승인</button>
</form>
<details><summary>수정 요청</summary><form method="post" action="/contracts.php?role=employee&amp;id=<?= $selected['id'] ?>"><?= native_csrf() ?><input type="hidden" name="action" value="reject"><input type="hidden" name="id" value="<?= $selected['id'] ?>"><input type="hidden" name="revision" value="<?= $selected['revision'] ?>"><label class="contract-field">수정이 필요한 내용<textarea name="reason" maxlength="500" rows="2" required></textarea></label><button type="submit">관리자에게 수정 요청</button></form></details>
<?php else: ?><p><?= view_h(contract_status($selected)) ?><?= !empty($selected['approval_reason'])?' · '.view_h($selected['approval_reason']):'' ?></p><?php endif ?>
