<?php

/**
 * Download Shared File API
 * Downloads a file from a shared folder
 */

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->download();
    
} catch (Exception $e) {
    JsonResponse::error('Download failed', 500, ['exception' => $e->getMessage()])->send();
}
