<section class="nf-card membership-profile">
<h2><?= $member['profile_completed']?'기본정보 수정':'가입 승인 완료 · 기본정보를 입력해 주세요' ?></h2>
<p class="membership-hint">* 필수 입력 · 가입 시 작성한 이름과 연락처는 미리 표시됩니다. 저장한 내용은 내정보와 관리자 인사정보에 함께 반영됩니다.</p>
<p class="membership-context">아이디 <?= view_h($user['username']) ?> · 사번 <?= view_h($record['employee_no']) ?> · <?= view_h(department_label($profile['team'])) ?></p>
<?php if($error): ?><p class="nf-alert nf-error" role="alert"><?= view_h($error) ?></p><?php endif; ?>
<form method="post" action="/profile-entry.php?role=employee">
<?= native_csrf() ?><input type="hidden" name="revision" value="<?= view_h((string)$formRevision) ?>">
<?php
$sections=[
    ['기본 인적사항',[
        ['name','이름','text',60,true,'name',''],
        ['phone','연락처','tel',20,true,'tel','010-0000-0000'],
        ['birthDate','생년월일','date',10,true,'bday',''],
        ['gender','성별','select',10,false,'sex',''],
        ['email','이메일','email',120,false,'email',''],
        ['nationality','국적','text',60,false,'',''],
    ]],
    ['주소',[
        ['address','주소','text',240,true,'address-line1','도로명 또는 지번 주소'],
        ['addressDetail','상세주소','text',240,false,'address-line2','동·호수 등'],
        ['postcode','우편번호','text',10,false,'postal-code',''],
    ]],
    ['급여 지급 계좌',[
        ['bank','은행 선택','bank',50,true,'',''],
        ['accountNumber','계좌번호 입력','text',40,true,'','숫자 또는 하이픈으로 입력'],
        ['accountHolder','예금주','text',60,true,'','예금주 이름'],
    ]],
    ['비상 연락처 · 선택',[
        ['emergencyName','성명·관계','text',60,false,'','이름과 관계'],
        ['emergencyPhone','비상 연락처','tel',20,false,'','010-0000-0000'],
    ]],
];
foreach($sections as [$title,$fields]): ?>
<fieldset class="membership-profile-section"><legend><?= view_h($title) ?></legend><div class="membership-profile-grid">
<?php foreach($fields as [$key,$label,$type,$max,$required,$autocomplete,$placeholder]): ?>
<label><span><?= view_h($label) ?><?= $required?' *':'' ?></span>
<?php if($type==='bank'): ?>
<select name="bank" required><?php foreach(personnel_banks((string)($profile['bank']??'')) as $value=>$text): ?><option value="<?= view_h($value) ?>"<?= ($profile['bank']??'')===$value?' selected':'' ?>><?= view_h($text) ?></option><?php endforeach; ?></select>
<?php elseif($type==='select'): ?>
<select name="<?= view_h($key) ?>" autocomplete="<?= view_h($autocomplete) ?>"><?php foreach([''=>'선택','남'=>'남','여'=>'여','기타'=>'기타'] as $value=>$text): ?><option value="<?= view_h($value) ?>"<?= ($profile[$key]??'')===$value?' selected':'' ?>><?= view_h($text) ?></option><?php endforeach; ?></select>
<?php else: ?>
<input name="<?= view_h($key) ?>" type="<?= view_h($type) ?>" maxlength="<?= $max ?>" value="<?= view_h($profile[$key]??'') ?>"<?= $required?' required':'' ?><?= $autocomplete?' autocomplete="'.view_h($autocomplete).'"':'' ?><?= $placeholder?' placeholder="'.view_h($placeholder).'"':'' ?><?= $type==='date'?' max="'.hr_today().'"':'' ?><?= in_array($key,['accountNumber','postcode'],true)?' inputmode="numeric"':'' ?>>
<?php endif; ?>
</label>
<?php endforeach; ?>
</div></fieldset>
<?php endforeach; ?>
<div class="membership-actions"><button type="submit" class="primary">정보 저장</button><?php if($member['profile_completed']): ?><a class="nf-button" href="/personnel.php?role=employee">취소 · 내정보</a><?php endif; ?></div>
</form>
</section>
