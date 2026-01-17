<?php

/**
 * Create Folder in Shared Folder API
 * Creates a new folder inside a shared folder
 */

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->createFolder();
    
} catch (Exception $e) {
    JsonResponse::error('Create folder failed', 500, ['exception' => $e->getMessage()])->send();
}
