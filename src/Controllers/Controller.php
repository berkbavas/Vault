<?php

namespace App\Controllers;

use App\Http\Request;
use App\Http\JsonResponse;
use App\Core\Bootstrap;
use PDO;

abstract class Controller
{
    protected $request;
    protected $pdo;
    protected $config;

    public function __construct()
    {
        $app = Bootstrap::getInstance();
        $this->pdo = $app->getDatabase();
        $this->config = $app->getConfig();
        $this->request = Request::capture();
    }

    /**
     * Send JSON response
     */
    protected function json($data, $statusCode = 200)
    {
        return new JsonResponse($data, $statusCode);
    }

    /**
     * Send success response
     */
    protected function success($data = null, $message = 'Success', $statusCode = 200)
    {
        return JsonResponse::success($data, $message, $statusCode);
    }

    /**
     * Send error response
     */
    protected function error($message = 'Error', $statusCode = 400, $errors = null)
    {
        return JsonResponse::error($message, $statusCode, $errors);
    }

    /**
     * Validate request data
     */
    protected function validate(array $rules)
    {
        $errors = $this->request->validate($rules);

        if (!empty($errors)) {
            JsonResponse::validationError($errors)->send();
            exit;
        }
    }

    protected function validateJson(array $rules)
    {
        $errors = $this->request->validateJson($rules);

        if (!empty($errors)) {
            JsonResponse::validationError($errors)->send();
            exit;
        }
    }

    protected function validateFile()
    {
        $errors = $this->request->validateFile();

        if (!empty($errors)) {
            JsonResponse::validationError($errors)->send();
            exit;
        }
    }

    protected function validateChunk()
    {
        $errors = $this->request->validateChunk();

        if (!empty($errors)) {
            JsonResponse::validationError($errors)->send();
            exit;
        }
    }


    /**
     * Get authenticated user ID from JWT
     */
    protected function getAuthUserId(): ?int
    {
        $token = $this->request->bearerToken();

        if (!$token) {
            JsonResponse::unauthorized('No token provided')->send();
            exit;
        }

        try {
            $payload = $this->verifyJWT($token);
            return $payload['user_id'] ?? null;
        } catch (\Exception $e) {
            JsonResponse::unauthorized('Invalid token')->send();
            exit;
        }
    }

    /**
     * Require authentication and get user ID
     */
    protected function requireAuth(): int
    {
        $userId = $this->getAuthUserId();
        if (!$userId) {
            JsonResponse::unauthorized('Authentication required')->send();
            exit;
        }
        return $userId;
    }
    
    /**
     * Require admin privileges
     */
    protected function requireAdmin(): int
    {
        $userId = $this->requireAuth();

        // Check if user is admin
        $stmt = $this->pdo->prepare("SELECT is_admin FROM users WHERE id = :id");
        $stmt->execute(['id' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !$user['is_admin']) {
            JsonResponse::forbidden('Admin access required')->send();
            exit;
        }

        return $userId;
    }

    /**
     * Get authenticated user ID (alias for requireAuth)
     */
    protected function getUserId(): int
    {
        return $this->requireAuth();
    }

    /**
     * Verify JWT token
     */
    private function verifyJWT($token)
    {
        $secret = $this->config['jwt']['secret'];

        // Split token
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new \Exception('Invalid token format');
        }

        list($header, $payload, $signature) = $parts;

        // Verify signature
        $validSignature = hash_hmac('sha256', $header . '.' . $payload, $secret, true);
        $validSignature = $this->base64UrlEncode($validSignature);

        if ($signature !== $validSignature) {
            throw new \Exception('Invalid signature');
        }

        // Decode payload
        $payloadData = json_decode($this->base64UrlDecode($payload), true);

        // Check expiration
        if (isset($payloadData['exp']) && $payloadData['exp'] < time()) {
            throw new \Exception('Token expired');
        }

        return $payloadData;
    }

    /**
     * Create JWT token
     */
    protected function createJWT(array $payload)
    {
        $secret = $this->config['jwt']['secret'];
        $expiration = $this->config['jwt']['expiration'];

        // Add expiration
        $payload['exp'] = time() + $expiration;
        $payload['iat'] = time();

        // Create header
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);

        // Create payload
        $payload = json_encode($payload);

        // Encode
        $base64UrlHeader = $this->base64UrlEncode($header);
        $base64UrlPayload = $this->base64UrlEncode($payload);

        // Create signature
        $signature = hash_hmac('sha256', $base64UrlHeader . '.' . $base64UrlPayload, $secret, true);
        $base64UrlSignature = $this->base64UrlEncode($signature);

        // Create JWT
        return $base64UrlHeader . '.' . $base64UrlPayload . '.' . $base64UrlSignature;
    }

    /**
     * Base64 URL encode
     */
    private function base64UrlEncode($data)
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Base64 URL decode
     */
    private function base64UrlDecode($data)
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
