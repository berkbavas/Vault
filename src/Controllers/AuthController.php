<?php

namespace App\Controllers;

use App\Services\UserService;
use App\Http\JsonResponse;
use Exception;

class AuthController extends Controller
{
    private $userService;
    private $rules = [
        'register' => [
            'username'              => 'required|string|min:3|max:255|alpha_num_dash',
            'client_salt'           => 'required|string|min:64|max:64|hex',
            'kdf_salt'              => 'required|string|min:64|max:64|hex',
            'password_hash'         => 'required|string|min:64|max:64|hex',
            'encrypted_master_key'  => 'required|string|min:120|max:120|hex',
        ],

        'login' => [
            'username'      => 'required|string|min:3|max:255|alpha_num_dash',
            'password_hash' => 'required|string|min:64|max:64|hex',
        ],

        'change_password' => [
            'current_password_hash'     => 'required|string|min:64|max:64|hex',
            'new_password_hash'         => 'required|string|min:64|max:64|hex',
            'new_encrypted_master_key'  => 'required|string|min:120|max:120|hex',
            'new_client_salt'           => 'required|string|min:64|max:64|hex',
            'new_kdf_salt'              => 'required|string|min:64|max:64|hex',
        ],

        'get_client_salt' => [
            'username' => 'required|string|min:3|max:255|alpha_num_dash',
        ],

        'update_quota' => [
            'user_id' => 'required|integer',
            'quota' => 'required|integer|min:0',
        ],

        'delete_user' => [
            'user_id' => 'required|integer',
        ],
    ];

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

            // Validate input
            $this->validateJson($this->rules['register']);

            $username = trim($this->request->json('username'));
            $clientSalt = $this->request->json('client_salt');
            $kdfSalt = $this->request->json('kdf_salt');
            $passwordHash = $this->request->json(key: 'password_hash');
            $encryptedMasterKey = $this->request->json('encrypted_master_key');

            $this->userService->createUser(
                $username,
                $clientSalt,
                $kdfSalt,
                $passwordHash,
                $encryptedMasterKey
            );

            $user = $this->userService->findByUsername($username);

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
                    'encrypted_master_key' => $user['encrypted_master_key'],
                    'storage_used' => $user['storage_used'],
                    'storage_quota' => $user['storage_quota'],
                    'is_admin' => $user['is_admin'] ?? 0,
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
            // Validate input
            $this->validateJson($this->rules['get_client_salt']);

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

            // Validate input
            $this->validateJson($this->rules['login']);

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
                    'is_admin' => $user['is_admin'] ?? 0,
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

            // Validate input
            $this->validateJson($this->rules['change_password']);

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
                'is_admin' => $user['is_admin'] ?? 0,
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

    /**
     * List all users (admin only)
     */
    public function listUsers()
    {
        try {
            $this->requireAdmin();
            $users = $this->userService->getAllUsers();
            return $this->success($users, 'Users retrieved successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 400)->send();
        }
    }


    /**
     * Update user storage quota (admin only)
     */
    public function updateQuota()
    {
        try {
            $this->requireAdmin();
            $this->validateJson($this->rules['update_quota']);
            $userId = $this->request->json('user_id');
            $quota = $this->request->json('quota');
            $this->userService->updateQuota($userId, $quota);
            return $this->success(null, 'User quota updated successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 400)->send();
        }
    }

    /**
     * Delete a user (admin only)
     */
    public function deleteUser()
    {
        try {
            $this->requireAdmin();
            $this->validateJson($this->rules['delete_user']);
            $userId = $this->request->json('user_id');
            $this->userService->deleteUser($userId);
            return $this->success(null, 'User deleted successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 400)->send();
        }
    }
}
