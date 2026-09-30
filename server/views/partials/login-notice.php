<link rel="stylesheet" href="<?= view_h(asset_url('login-notice.css')) ?>">
<dialog data-user-id="<?= (int)($user['id']??0) ?>" data-user-role="<?= view_h($role) ?>" data-notice-version="system-v1" id="cnc-login-notice" aria-labelledby="cnc-login-notice-title" aria-describedby="cnc-login-notice-description">
    <button type="button" class="cnc-login-notice-close" data-login-notice-close aria-label="공지 닫기"><span aria-hidden="true">×</span></button>
    <div class="cnc-login-notice-copy">
        <span class="cnc-login-notice-label">C&amp;C · 시스템 안내</span>
        <h2 id="cnc-login-notice-title">이용 전 꼭 확인해 주세요</h2>
        <p id="cnc-login-notice-description">현재 시스템은 정식배포용이 아니며 개발안정화를 거치지 않은 것임으로 시급계산 혹은 그레이드 연산 등의 민감한 정보는 관리직원과 반드시 상의하시기 바랍니다.</p>
    </div>
    <img class="cnc-login-notice-image" src="<?= view_h(asset_url('login-system-notice-v1.png')) ?>" alt="" aria-hidden="true" width="1024" height="1024" fetchpriority="high">
    <div class="cnc-login-notice-footer"><label class="cnc-login-notice-today"><input type="checkbox" data-login-notice-today>오늘은 열지 않기</label><button type="button" class="cnc-login-notice-confirm" data-login-notice-close autofocus>확인했습니다</button></div>
</dialog>
<script src="<?= view_h(asset_url('login-notice.js')) ?>" defer></script>
