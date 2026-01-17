<?php

/**
 * Delete Share API
 * Deletes a share created by the authenticated user
 */

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->deleteShare();
    
} catch (Exception $e) {
    JsonResponse::error('Failed to delete share', 500, ['exception' => $e->getMessage()])->send();
}
