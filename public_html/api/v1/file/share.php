<?php

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->createShare();
    
} catch (Exception $e) {
    JsonResponse::error('Share failed', 500, ['exception' => $e->getMessage()])->send();
}
