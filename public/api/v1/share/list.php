<?php

/**
 * List Shared Folder Contents API
 * Lists files/folders inside a shared folder
 */

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->listFiles();
    
} catch (Exception $e) {
    JsonResponse::error('Failed to list files', 500, ['exception' => $e->getMessage()])->send();
}
