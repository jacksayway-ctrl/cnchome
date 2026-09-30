<!doctype html><html lang="ko" class="cnc-login"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>직원 등록 요청 · 씨앤씨</title><link rel="icon" href="/cnc-mark.svg"><link rel="stylesheet" href="<?= view_h(asset_url('login.css')) ?>"><link rel="stylesheet" href="<?= view_h(asset_url('company-ui.css')) ?>">
<main><div class="company-brand"><img src="/cnc-mark.svg" alt="C&amp;C" width="14" height="9"><strong>씨앤씨</strong></div><h1>직원 등록 요청</h1><p class="sub">직원 등록 요청 → 관리자 로그인 승인 → 본인 정보 입력</p>
<?php if($success): ?><p class="signup-success" role="status">직원 등록 요청이 완료됐습니다. 관리자 승인 후 신청한 아이디로 로그인해 주세요.</p>
<?php else: ?><form method="post" action="/signup.php?role=employee"><input type="hidden" name="csrf" value="<?= view_h($_SESSION['csrf']) ?>">
<label>아이디<input name="username" required maxlength="64" pattern="[a-zA-Z0-9_.-]{3,64}" autocomplete="username" autocapitalize="none" value="<?= view_h($values['username']) ?>"></label>
<label>비밀번호<input name="password" type="password" required autocomplete="new-password"></label>
<label>비밀번호 확인<input name="passwordConfirm" type="password" required autocomplete="new-password"></label>
<label>이름<input name="name" required maxlength="60" autocomplete="name" value="<?= view_h($values['name']) ?>"></label><label>연락처<input name="phone" type="tel" required maxlength="15" autocomplete="tel" value="<?= view_h($values['phone']) ?>"></label>
<p class="error" role="alert"><?= view_h($error) ?></p><button type="submit">직원 등록 요청</button></form><?php endif; ?><a class="login-secondary" href="/login.php?role=employee">로그인으로 돌아가기</a><p class="sub">상세 개인정보는 관리자 로그인 승인 후 입력합니다.</p></main></html>
