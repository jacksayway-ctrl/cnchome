<?php if ($preview || $role==='admin'):
$selectedGroup=null;$selectedLabel='';
foreach ($navigation['admin'] as $group) foreach ($group['items'] as [$route,$label]) if ($route===$page) {$selectedGroup=$group;$selectedLabel=$label;}
?>
<section id="aw-subpages" class="aw-subpages"<?= $selectedGroup===null?' hidden':'' ?>>
<?php if ($selectedGroup!==null): ?>
<div class="aw-location"><span>관리자</span><span aria-hidden="true">/</span><strong><?= view_h($selectedGroup['label']) ?></strong><span aria-hidden="true">/</span><span><?= view_h($selectedLabel) ?></span></div>
<div class="aw-subpage-links" role="navigation" aria-label="<?= view_h($selectedGroup['label']) ?> 하위 페이지">
<?php foreach ($selectedGroup['items'] as [$route,$label]): ?>
<button type="button" data-page="<?= view_h($route) ?>"<?= $page===$route?' class="active" aria-current="page"':'' ?>><?= view_h($label) ?></button>
<?php endforeach; ?>
<?php if ($selectedGroup['items'][0][0]==='adminPayroll'): ?><a href="./payroll.php?role=admin">급여 계산 검토 ↗</a><?php endif; ?>
</div>
<?php endif; ?>
</section>
<?php endif; ?>
