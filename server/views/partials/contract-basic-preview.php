<section class="contract-panel contract-preview-panel" data-contract-basic-form>
<div class="contract-section-title nf-no-print"><h2>근로계약서 기본 양식</h2><span>공통 열람·인쇄용</span></div>
<div class="contract-actions nf-no-print"><button type="button" data-contract-print>인쇄 / PDF 저장</button><a href="/contracts.php?role=<?= $role ?>&amp;template=1&amp;document=1" target="_blank" rel="noopener">양식만 새 창에서 보기</a><a href="/contracts.php?role=<?= $role ?>&amp;template=1&amp;download=1">기본 양식 저장</a><?php if($role==='employee'&&$contracts): ?><a href="/contracts.php?role=employee">내 발급 계약서 보기</a><?php endif ?></div>
<p class="contract-hint nf-no-print">발급 전에도 확인할 수 있는 기본 양식입니다. 성명·계약기간 등 개인별 항목은 빈칸이며, 실제 발급 계약서는 별도로 확인합니다.</p>
<div class="contract-inline-preview"><?php
// Keep the real selection untouched so a template cannot acquire approval controls.
(static function(array $form,string $role): void {
    $selected=$form;$documentOnly=false;$download=false;
    require view_root().'/contract-document.php';
})(contract_basic_form($company['settings']),$role);
?></div>
</section>
