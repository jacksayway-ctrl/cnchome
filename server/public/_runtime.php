<?php
declare(strict_types=1);
// Repository layout for development; private runtime directory on Cafe24.
define('CNC_RUNTIME_DIR', is_file(__DIR__.'/../lib/bootstrap.php') ? dirname(__DIR__).'/lib' : '/opt/cnchome-runtime');
define('CNC_ASSET_ROOT', is_file(__DIR__.'/../../office.js') ? dirname(__DIR__,2) : __DIR__);
require_once CNC_RUNTIME_DIR.'/bootstrap.php';
