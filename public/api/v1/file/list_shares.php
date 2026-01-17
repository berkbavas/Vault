<?php

/**
 * List User's Shares API
 * Lists all shares created by the authenticated user
 */

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->listShares();
    
} catch (Exception $e) {
    JsonResponse::error('Failed to list shares', 500, ['exception' => $e->getMessage()])->send();
}
