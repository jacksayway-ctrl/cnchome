<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/native.php';require_once CNC_RUNTIME_DIR.'/notices.php';
session_boot();$user=current_user();if(!$user){header('Location: /login.php?role='.session_role());exit;}
$data=notice_snapshot($user);native_start('회사 공지사항',$user,'notices');
echo '<section class="nf-card"><table class="nf-table"><thead><tr><th>등록 날짜·시간</th><th>제목·내용</th></tr></thead><tbody>';
foreach($data['company'] as $item){$time=(new DateTimeImmutable($item['createdAt']))->setTimezone(new DateTimeZone('Asia/Seoul'))->format('Y-m-d H:i');echo '<tr><td>'.h($time).'</td><td><details><summary>'.h($item['title']).'</summary><p>'.nl2br(h($item['body'])).'</p></details></td></tr>';}
if(!$data['company'])echo '<tr><td colspan="2">등록된 공지가 없습니다.</td></tr>';echo '</tbody></table></section>';native_end();
