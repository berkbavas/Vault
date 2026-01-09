<?php

namespace App\Controllers;

use App\Services\UserService;
use App\Http\JsonResponse;
use Exception;

class AuthController extends Controller
{
    private $userService;

    public function __construct()
    {
        parent::__construct();
        $this->userService = new UserService($this->pdo);
    }

    /**
     * Register a new user
     */
    public function register()
    {
        try {
            // Check allow_registration config
            if (!$this->config['user']['allow_registration']) {
                return $this->error('User registration is disabled', 403)->send();
            }

            $minUsernameLength = $this->config['user']['username_min_length'];
            $maxUsernameLength = $this->config['user']['username_max_length'];

            // Validate input
            $this->validateJson([
                'username' => "required|string|min:$minUsernameLength|max:$maxUsernameLength",
                'client_salt' => 'required|string',
                'kdf_salt' => 'required|string',
                'password_hash' => 'required|string',
                'encrypted_master_key' => 'required|string',
            ]);

            $username = $this->request->json('username');
            $clientSalt = $this->request->json('client_salt');
            $kdfSalt = $this->request->json('kdf_salt');
            $passwordHash = $this->request->json(key: 'password_hash');
            $encryptedMasterKey = $this->request->json('encrypted_master_key');

            // Create user with additional security fields
            $userData = [
                'username' => trim($username),
                'client_salt' => $clientSalt,
                'kdf_salt' => $kdfSalt,
                'password_hash' => $passwordHash,
                'encrypted_master_key' => $encryptedMasterKey,
                'storage_quota' => $this->config['storage']['default_quota']
            ];

            $user = $this->userService->create($userData);

            // Create JWT token
            $token = $this->createJWT([
                'user_id' => $user['id'],
                'username' => $user['username']
            ]);

            return $this->success([
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'kdf_salt' => $user['kdf_salt'],
                    'encrypted_master_key' => $user['encrypted_master_key']
                ],
                'token' => $token
            ], 'User registered successfully', 201)->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 400)->send();
        }
    }

    /**
     * Get client salt by username
     * 
     * This is a public endpoint used during login process.
     * The client needs the salt to derive the encryption key.
     */
    public function getClientSalt()
    {
        try {

            $minUsernameLength = $this->config['user']['username_min_length'];
            $maxUsernameLength = $this->config['user']['username_max_length'];

            $this->validateJson(['username' => "required|string|min:$minUsernameLength|max:$maxUsernameLength"]);

            // Get username from query string or request body
            $username = $this->request->json('username');

            // Find user by username
            $user = $this->userService->findByUsername(trim($username));

            if (!$user) {
                // Return error without revealing if user exists (security)
                return $this->error('Invalid username', 404)->send();
            }

            return $this->success([
                'username' => $user['username'],
                'client_salt' => $user['client_salt'],
            ], 'Client salt retrieved successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 400)->send();
        }
    }

    /**
     * Login user
     */
    public function login()
    {
        try {

            $minUsernameLength = $this->config['user']['username_min_length'];
            $maxUsernameLength = $this->config['user']['username_max_length'];

            // Validate input
            $this->validateJson([
                'username' => "required|string|min:$minUsernameLength|max:$maxUsernameLength",
                'password_hash' => 'required|string',
            ]);

            $username = $this->request->json('username');
            $passwordHash = $this->request->json('password_hash');

            // Verify credentials
            $user = $this->userService->verify($username, $passwordHash);

            // Create JWT token
            $token = $this->createJWT([
                'user_id' => $user['id'],
                'username' => $user['username'],
            ]);

            // Update last login timestamp
            $this->userService->lastLoginUpdate($user['id']);

            return $this->success([
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'kdf_salt' => $user['kdf_salt'],
                    'encrypted_master_key' => $user['encrypted_master_key'],
                    'storage_used' => $user['storage_used'],
                    'storage_quota' => $user['storage_quota'],
                ],
                'token' => $token
            ], 'Login successful')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 401)->send();
        }
    }

    /**
     * Change password
     */
    public function changePassword()
    {
        try {
            $userId = $this->getAuthUserId();

            $this->validateJson([
                'current_password_hash' => 'required|string',
                'new_password_hash' => 'required|string',
                'new_encrypted_master_key' => 'required|string',
                'new_client_salt' => 'required|string',
                'new_kdf_salt' => 'required|string',
            ]);

            $currentPasswordHash = $this->request->json('current_password_hash');
            $newPasswordHash = $this->request->json('new_password_hash');
            $newEncryptedMasterKey = $this->request->json('new_encrypted_master_key');
            $newClientSalt = $this->request->json('new_client_salt');
            $newKdfSalt = $this->request->json('new_kdf_salt');
            $user = $this->userService->changePassword(
                $userId,
                $currentPasswordHash,
                $newPasswordHash,
                $newEncryptedMasterKey,
                $newClientSalt,
                $newKdfSalt
            );

            return $this->success($user, 'Password changed successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 400)->send();
        }
    }

    /**
     * Get current authenticated user info
     */
    public function me()
    {
        try {
            $userId = $this->getAuthUserId();
            $user = $this->userService->findById($userId);
            return $this->success([
                'id' => $user['id'],
                'username' => $user['username'],
                'client_salt' => $user['client_salt'],
                'kdf_salt' => $user['kdf_salt'],
                'encrypted_master_key' => $user['encrypted_master_key'],
                'storage_used' => $user['storage_used'],
                'storage_quota' => $user['storage_quota'],
            ], 'User info retrieved successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 400)->send();
        }
    }

    /**
     * Logout (optional - for token blacklisting)
     */
    public function logout()
    {
        // In a stateless JWT setup, logout is typically handled client-side
        // by removing the token. If you implement token blacklisting,
        // you would add the token to a blacklist here.

        return $this->success(null, 'Logged out successfully')->send();
    }
}
