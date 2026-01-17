<?php

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\StorageController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new StorageController();
    $userId = $controller->requireAuth();
    $controller->delete($userId);
    
} catch (Exception $e) {
    JsonResponse::error('Delete failed', 500, ['exception' => $e->getMessage()])->send();
}
