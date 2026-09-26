<script>window.CNCHOME_NAVIGATION=<?= view_json($navigation) ?>;<?php if ($boot!==null): ?>window.CNCHOME_LIVE=<?= view_json($boot) ?>;<?php endif; ?></script>
<?php if ($boot!==null): ?>
<script src="<?= view_h(asset_url('session-context.js')) ?>"></script>
<?php endif; ?>
