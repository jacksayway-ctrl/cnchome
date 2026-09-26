<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://t1.kakaocdn.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://raw.githubusercontent.com; media-src 'self' data: blob:; object-src 'none'; frame-src https://postcode.map.kakao.com https://postcode.map.daum.net https://t1.kakaocdn.net; base-uri 'none'; form-action 'self'; worker-src 'self' blob: https://cdn.jsdelivr.net">
<title>씨앤씨 · <?= $preview?'직원 화면 미리보기':'업무 관리' ?></title>
<link rel="icon" href="./cnc-mark.svg" type="image/svg+xml">
<?php foreach (['admin-workspace.css','hr-workspace.css','office.css','session-navigation.css'] as $file): ?>
<link rel="stylesheet" href="<?= view_h(asset_url($file)) ?>">
<?php endforeach; ?>
<?php require __DIR__.'/boot.php'; ?>
<script src="<?= view_h(asset_url('session-navigation.js')) ?>" defer></script>
<?php if (!$preview): ?><script src="<?= view_h(asset_url('test-workspace.js')) ?>" defer></script><?php endif; ?>
