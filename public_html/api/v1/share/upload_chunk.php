<?php

/**
 * Upload Chunk to Shared Folder API
 * Uploads a chunk of a file to a shared folder
 */

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->uploadChunk();
    
} catch (Exception $e) {
    JsonResponse::error('Chunk upload failed', 500, ['exception' => $e->getMessage()])->send();
}
