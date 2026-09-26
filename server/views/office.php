<!doctype html>
<html lang="ko"<?= $preview ? '' : ' data-cnc-role="'.view_h($role).'"' ?>>
<head>
<?php require __DIR__.'/partials/head.php'; ?>
</head><body>
<div id="tm-preview">
<noscript><p class="notice">메뉴·지도·계산 기능을 사용하려면 브라우저의 JavaScript를 켜 주세요.</p></noscript>
<div class="shell">

<?php require __DIR__.'/partials/sidebar.php'; ?>
<div class="work"><section <?= !$preview && $role==='admin' ? 'hidden' : '' ?> class="top-notice" aria-label="팀 공지사항"><strong>보험팀 중요 공지</strong><button class="notice-message" data-action="notice-detail" title="공지 전체 보기">접수 가능지역을 확인한 후 상담해 주세요.</button><button class="notice-confirm" data-action="notice">확인했습니다</button></section><header <?= !$preview && $role==='admin' ? 'hidden' : '' ?>><div><h1><?= $preview ? '안녕하세요, 김상담님' : view_h($user['display_name']).'님, 안녕하세요' ?></h1><div class="sub"><?= $preview ? '보험영업 1팀 · 2026년 9월 22일 (화)' : view_h(department_label($user['department'])).' · '.(new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul')))->format('Y년 m월 d일') ?></div></div><div class="header-grades"><table aria-label="일·주 목표 대비 달성, 월 실적 구간, 이번 달 및 진행 영업일"><caption>일·주: 목표/달성 · 월: 현재 실적 구간 · 영업일: 월 전체/오늘 포함 진행 일수, 예시 회사 일정</caption><thead><tr><th scope="col">영업일 <small style="display:block;font-size:11px;font-weight:400">이번 달 / 현재 진행</small></th><th scope="col">일그레이드</th><th scope="col">주그레이드</th><th scope="col">월그레이드</th></tr></thead><tbody><tr><td class="achieved" id="tm-head-workdays" title="예시 회사 일정: 이번 달 22일 / 오늘 포함 진행 16일">22일 / 16일</td><td class="achieved" id="tm-head-daily">6/8</td><td class="achieved" id="tm-head-weekly">평균 6/3</td><td class="achieved" id="tm-head-monthly">81~90건</td></tr></tbody></table></div><button class="action" data-action="intake">＋ 접수 등록</button></header><div <?= !$preview && $role==='admin' ? 'hidden' : '' ?> class="sample">직원 화면 미리보기 · 모든 이름·실적·금액은 예시입니다.</div><div id="tm-toast" class="toast" role="status" hidden></div><?php require __DIR__.'/partials/subpages.php'; ?><main id="tm-main"><p class="page-loading" role="status">화면을 불러오는 중입니다.</p></main></div>
</div>
<dialog id="tm-dialog" aria-labelledby="tm-dialog-title"><div class="row"><h2 id="tm-dialog-title">접수 등록</h2><button class="secondary" data-action="close" aria-label="창 닫기">닫기</button></div><div id="tm-dialog-body"></div></dialog>

<?php foreach (['korea-regions.js','intake-codes.js','region-rules.js','admin-xlsx.js','admin-workspace.js','hr-workspace.js','grade-numbers.js','grade-calendar.js','grade-calendar-preview.js','policy-dates.js','office.js'] as $file): ?>
<script src="<?= view_h(asset_url($file)) ?>"></script>
<?php endforeach; ?>
</div>
</body></html>
