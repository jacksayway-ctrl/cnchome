<?php if ($preview || $role==='admin'):
$selectedGroup=null;$selectedLabel='';
foreach ($navigation['admin'] as $group) foreach ($group['items'] as [$route,$label]) if ($route===$page) {$selectedGroup=$group;$selectedLabel=$label;}
?>
<section id="aw-subpages" class="aw-subpages"<?= $selectedGroup===null?' hidden':'' ?>>
<?php if ($selectedGroup!==null): ?>
<?php if(in_array($selectedGroup['items'][0][0],['adminPolicy','adminGrade','adminPayroll'],true)):
 require_once (defined('CNC_RUNTIME_DIR')?CNC_RUNTIME_DIR:dirname(__DIR__,2).'/lib').'/department-scope.php';
 $managementDepartment=management_request_department(); ?>
<nav class="aw-department-tabs" aria-label="관리 부서">
<?php foreach(management_departments() as $departmentKey=>$departmentName): ?>
<a href="<?= view_h('/office.php?'.http_build_query(['role'=>'admin','page'=>$page,'department'=>$departmentKey])) ?>"<?= $managementDepartment===$departmentKey?' class="active" aria-current="page"':'' ?>><?= view_h($departmentName) ?></a>
<?php endforeach ?></nav>
<?php endif ?>
<div class="aw-location"><span>관리자</span><span aria-hidden="true">/</span><strong><?= view_h($selectedGroup['label']) ?></strong><span aria-hidden="true">/</span><span><?= view_h($selectedLabel) ?></span></div>
<div class="aw-subpage-links" role="navigation" aria-label="<?= view_h($selectedGroup['label']) ?> 하위 페이지">
<?php foreach ($selectedGroup['items'] as [$route,$label]): ?>
<button type="button" data-page="<?= view_h($route) ?>"<?= $page===$route?' class="active" aria-current="page"':'' ?>><?= view_h($label) ?></button>
<?php endforeach; ?>
<?php if ($selectedGroup['items'][0][0]==='adminPayroll'): ?><a href="<?= view_h('./payroll.php?role=admin&department='.($managementDepartment??'insurance')) ?>">급여 계산 검토 <span class="ui-icon ui-icon-external" aria-hidden="true"></span></a><?php endif; ?>
</div>
<?php endif; ?>
</section>
<?php endif; ?>
