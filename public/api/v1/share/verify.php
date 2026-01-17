<?php

/**
 * Verify Share Password API
 * Verifies password and returns encrypted key if correct
 */

require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\ShareController;
use App\Http\JsonResponse;

try {
    Bootstrap::init();
    
    $controller = new ShareController();
    $controller->verifyPassword();
    
} catch (Exception $e) {
    JsonResponse::error('Verification failed', 500, ['exception' => $e->getMessage()])->send();
}
