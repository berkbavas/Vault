<?php

/**
 * Rename in Shared Folder API
 * Renames a file/folder in a shared folder
 */

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->rename();
    
} catch (Exception $e) {
    JsonResponse::error('Rename failed', 500, ['exception' => $e->getMessage()])->send();
}
