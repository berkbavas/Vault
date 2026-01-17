<?php

/**
 * Move in Shared Folder API
 * Moves a file/folder within a shared folder
 */

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->move();
    
} catch (Exception $e) {
    JsonResponse::error('Move failed', 500, ['exception' => $e->getMessage()])->send();
}
