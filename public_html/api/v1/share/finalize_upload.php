<?php

/**
 * Finalize Chunked Upload to Shared Folder API
 * Finalizes a chunked upload to a shared folder
 */

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->finalizeUpload();
    
} catch (Exception $e) {
    JsonResponse::error('Finalize upload failed', 500, ['exception' => $e->getMessage()])->send();
}
