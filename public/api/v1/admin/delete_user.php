<?php
require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\AuthController;
use App\Http\JsonResponse;

try {
    // Initialize application
    Bootstrap::init();

    // Handle request
    $controller = new AuthController();
    $controller->deleteUser();
} catch (Exception $e) {
    JsonResponse::error('Internal server error', 500, ['exception' => $e->getMessage()])->send();
}
