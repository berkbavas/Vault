<?php

/**
 * Delete from Shared Folder API
 * Deletes a file/folder from a shared folder
 */

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->delete();
    
} catch (Exception $e) {
    JsonResponse::error('Delete failed', 500, ['exception' => $e->getMessage()])->send();
}
