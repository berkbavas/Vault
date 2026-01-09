<?php

/**
 * Get Client Salt Endpoint
 * 
 * GET /api/get_client_salt.php?username=<username>
 * 
 * This endpoint retrieves the client salt for a given username.
 * The client salt is needed to derive the encryption key on the client side.
 * 
 * This is a public endpoint (no authentication required) as it's needed
 * before the user can log in.
 */

// Load autoloader
require_once __DIR__ . '/../../../../autoload.php';

use App\Core\Bootstrap;
use App\Controllers\AuthController;
use App\Http\JsonResponse;

try {
    // Initialize application
    Bootstrap::init();

    // Handle request
    $controller = new AuthController();
    $controller->getClientSalt();
} catch (Exception $e) {
    JsonResponse::error('Internal server error', 500, ['exception' => $e->getMessage()])->send();
}
