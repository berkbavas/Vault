<?php

/**
 * Upload to Shared Folder API
 * Uploads a file to a shared folder
 */

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->upload();
    
} catch (Exception $e) {
    JsonResponse::error('Upload failed', 500, ['exception' => $e->getMessage()])->send();
}
