<?php

/**
 * Get Share Info API
 * Returns share metadata without requiring password (for UI display)
 */

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->getShareInfo();
    
} catch (Exception $e) {
    JsonResponse::error('Failed to get share info', 500, ['exception' => $e->getMessage()])->send();
}
