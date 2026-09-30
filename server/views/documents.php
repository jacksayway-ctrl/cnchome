<?php require_once (defined('CNC_RUNTIME_DIR')?CNC_RUNTIME_DIR:dirname(__DIR__).'/lib').'/native.php';native_start('운영 문서',$user,'adminChecklist',['documents.css']); ?>
<p><a href="./office.php?role=<?= view_h($role) ?>">업무 화면</a> · <a href="./documents.php?role=<?= view_h($role) ?>">문서 목록</a></p>
<h1><?= $file===''?'운영 문서':view_h($file) ?></h1>
<?php if ($file===''): ?><ul><?php foreach ($files as $name): ?><li><a href="?role=<?= view_h($role) ?>&amp;file=<?= rawurlencode($name) ?>"><?= view_h($name) ?></a></li><?php endforeach; ?></ul>
<?php else: ?><p><a href="?role=<?= view_h($role) ?>&amp;file=<?= rawurlencode($file) ?>&amp;raw=1">원문 보기</a></p><pre><?= view_h($content) ?></pre><?php endif; ?>
<?php native_end(); ?>
