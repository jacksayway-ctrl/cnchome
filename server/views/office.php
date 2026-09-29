<!doctype html>
<html lang="ko"<?= $preview ? '' : ' data-cnc-role="'.view_h($role).'"' ?>>
<head>
<?php require __DIR__.'/partials/head.php'; ?>
</head><body<?= ($page==='regions' && ($_GET['policyWindow']??'')==='1') ? ' class="policy-window"' : '' ?>>
<div id="tm-preview">
<noscript><p class="notice">메뉴·지도·계산 기능을 사용하려면 브라우저의 JavaScript를 켜 주세요.</p></noscript>
<div class="shell">

<?php require __DIR__.'/partials/sidebar.php'; ?>
<div class="work<?= !$preview && $role==='employee' ? ' employee-compact-header' : '' ?><?= $page==='regions' ? ' region-intake-page' : '' ?>"><?php if($preview||$role!=='admin'): ?><section <?= !$preview ? 'hidden' : '' ?> class="top-notice" aria-label="팀 공지사항"><strong>보험팀 중요 공지</strong><button class="notice-message" data-action="notice-detail" title="공지 전체 보기">접수 가능지역을 확인한 후 상담해 주세요.</button><button class="notice-confirm" data-action="notice">확인했습니다</button></section><?php endif ?><header <?= !$preview && $role==='admin' ? 'hidden' : '' ?>><?php if ($preview || $role!=='employee'): ?><div><h1><?= $preview ? '안녕하세요, 김상담님' : view_h($user['display_name']).'님, 안녕하세요' ?></h1><div class="sub"><?= $preview ? '보험영업 1팀 · 2026년 9월 22일 (화)' : view_h(department_label($user['department'])).' · '.(new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul')))->format('Y년 m월 d일') ?></div></div><?php endif; ?><div class="header-grades" role="region" aria-label="영업일 및 본인 그레이드 현황"><span class="header-grade-item"><span>영업일</span><strong id="tm-head-workdays"><?= $preview?'22일 / 16일':'불러오는 중' ?></strong></span><span class="header-grade-item"><span>일그레이드</span><strong id="tm-head-daily"><?= $preview?'8 / 6건':'불러오는 중' ?></strong></span><span class="header-grade-item"><span>주그레이드(해당 주 평균 목표개수)</span><strong id="tm-head-weekly"><?= $preview?'평균 3 / 8건':'불러오는 중' ?></strong></span><span class="header-grade-item"><span>월그레이드</span><strong id="tm-head-monthly"><?= $preview?'81~90건':'불러오는 중' ?></strong></span></div><?php if ($preview || $role!=='employee'): ?><button class="action" data-action="intake"><span class="ui-icon ui-icon-plus" aria-hidden="true"></span> 접수 등록</button><?php endif; ?></header><div <?= !$preview ? 'hidden' : '' ?> class="sample">직원 화면 미리보기 · 모든 이름·실적·금액은 예시입니다.</div><div id="tm-toast" class="toast" role="status" hidden></div><?php require __DIR__.'/partials/subpages.php'; ?><main id="tm-main"><p class="page-loading" role="status">화면을 불러오는 중입니다.</p></main></div>
</div>
<dialog id="tm-dialog" aria-labelledby="tm-dialog-title"><div class="row"><h2 id="tm-dialog-title">접수 등록</h2><button class="secondary" data-action="close" aria-label="창 닫기">닫기</button></div><div id="tm-dialog-body"></div></dialog>

<?php foreach (['korea-regions.js','korea-localities.js','intake-codes.js','region-rules.js','admin-xlsx.js','admin-workspace.js','holiday-pay.js','hr-workspace.js','grade-numbers.js','grade-calendar.js','grade-calendar-preview.js','policy-dates.js','policy-input.js','policy-sync.js','consultation-location.js','intake-details.js','sales-workspace.js','daily-grade-workspace.js','office.js','grade-header.js'] as $file): ?>
<script src="<?= view_h(asset_url($file)) ?>"></script>
<?php endforeach; ?>
</div>
</body></html>
