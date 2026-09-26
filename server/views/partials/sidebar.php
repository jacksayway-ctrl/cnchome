<aside>
<div class="brand cnc-brand"><img src="./cnc-mark.svg" alt="C&amp;C" width="12" height="8"><strong>씨앤씨</strong></div>
<div class="team"><?= $preview?'보험영업 1팀 · 상담원':view_h(department_label($user['department'])).' · '.($role==='admin'?'관리자':'직원') ?></div>
<div class="mobile-note"><?= $preview?'PC용 화면 미리보기':'회사 관리' ?></div>
<nav aria-label="<?= $role==='admin'&&!$preview?'관리자':'직원' ?> 메뉴">
<?php if ($preview || $role==='employee'): ?>
<?php foreach ($navigation['employee'] as [$route,$label,$icon]): if ($preview&&in_array($route,['myInfo','payslips'],true)) continue; ?>
<button type="button" data-page="<?= view_h($route) ?>"<?= $page===$route?' class="active" aria-current="page"':'' ?>><span aria-hidden="true"><?= view_h($icon) ?></span><?= view_h($label) ?></button>
<?php endforeach; ?>
<?php endif; ?>
<?php if ($preview || $role==='admin'): ?>
<div class="nav-cut">관리자 모드</div><div class="aw-sections">
<?php foreach ($navigation['admin'] as $index=>$group): $selected=in_array($page,array_column($group['items'],0),true); ?>
<button type="button" data-aw-section="<?= $index ?>" aria-controls="aw-subpages"<?= $selected?' class="active" aria-current="true"':'' ?>><span aria-hidden="true"><?= view_h($group['icon']) ?></span><?= view_h($group['label']) ?></button>
<?php endforeach; ?>
</div>
<?php endif; ?>
</nav></aside>
