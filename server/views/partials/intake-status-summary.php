<?php $summaryBasis=$filters['dateBasis']??'first'; ?>
<nav class="intake-summary" aria-label="접수 상태별 조회">
<a href="<?= $eh(intake_url($filters,['status'=>'','dateBasis'=>'first','p'=>1])) ?>"<?= $filters['status']===''?' aria-current="page"':'' ?>>전체 상태<strong><?= number_format(array_sum($summaryCounts)) ?>건</strong></a>
<?php foreach($summaryCounts as $summaryStatus=>$summaryCount): ?>
<a href="<?= $eh(intake_url($filters,['status'=>$summaryStatus,'dateBasis'=>'first','p'=>1])) ?>"<?= $filters['status']===$summaryStatus&&$summaryBasis==='first'?' aria-current="page"':'' ?><?= $summaryStatus==='normal'?' data-intake-count-basis="first"':'' ?>><?= $summaryStatus==='normal'?'접수 <small>가접수일 기준</small>':$eh(intake_status($summaryStatus)) ?><strong><?= number_format($summaryCount) ?>건</strong></a>
<?php if($summaryStatus==='normal'): ?><a href="<?= $eh(intake_url($filters,['status'=>'normal','dateBasis'=>'actual','p'=>1])) ?>" data-intake-count-basis="actual"<?= $filters['status']==='normal'&&$summaryBasis==='actual'?' aria-current="page"':'' ?>>접수 <small>실제 접수일 기준</small><strong><?= number_format($actualNormalCount??$summaryCount) ?>건</strong></a><?php endif ?>
<?php endforeach ?>
</nav>
