<?php

namespace App\Services;

use PDO;
use Exception;
use App\Core\Bootstrap;

class UserService
{
    private $pdo;
    private $table = 'users';
    private $config;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
        $this->config = Bootstrap::getInstance()->getConfig();
    }

    /**
     * Create a new user
     */
    public function create(array $data)
    {
        // Validate required fields
        $this->validateUserData($data, true);

        // Check if username already exists
        if ($this->usernameExists($data['username'])) {
            throw new Exception('Username already exists');
        }

        $passwordHash = hex2bin($data['password_hash']);
        $serverSalt = random_bytes($this->config['security']['salt_bytes']);
        $hashOfPasswordHash = hash_pbkdf2(
            $this->config['security']['pbkdf2_algorithm'],
            $passwordHash,
            $serverSalt,
            $this->config['security']['pbkdf2_iterations'],
            $this->config['security']['hash_bytes'],
            true
        );

        // Generate user folder
        $userFolder = 'user_' . uniqid() . '_' . md5($data['username'] . time());

        // Prepare user data
        $insertData = [
            'username' => $data['username'],
            'client_salt' => $data['client_salt'],
            'kdf_salt' => $data['kdf_salt'],
            'server_salt' => bin2hex($serverSalt),
            'password_hash' => bin2hex($hashOfPasswordHash),
            'encrypted_master_key' => $data['encrypted_master_key'],
            'user_folder' => $userFolder,
            'storage_used' => 0,
            'storage_quota' => $data['storage_quota'] ?? $this->config['storage']['default_quota'],
            'created_at' => date('Y-m-d H:i:s')
        ];

        // Insert user
        $stmt = $this->pdo->prepare("
            INSERT INTO {$this->table} 
            (username, client_salt, kdf_salt, server_salt, password_hash, encrypted_master_key, user_folder, storage_used, storage_quota, created_at) 
            VALUES (:username, :client_salt, :kdf_salt, :server_salt, :password_hash, :encrypted_master_key, :user_folder, :storage_used, :storage_quota, :created_at)
        ");

        $stmt->execute($insertData);

        $userId = $this->pdo->lastInsertId();

        // Create user upload directory
        $uploadDir = $this->config['storage']['upload_dir'] . '/' . $userFolder;
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        return $this->findById($userId);
    }

    /**
     * Verify user credentials
     */
    public function verify($username, $passwordHash)
    {
        $this->validateUserData([
            'username' => $username,
            'password_hash' => $passwordHash
        ]);

        $user = $this->findByUsername($username);

        if (!$user) {
            throw new Exception('Invalid username or password');
        }

        $serverSalt = hex2bin($user['server_salt']);
        $storedHash = hex2bin($user['password_hash']);

        $computedHash = hash_pbkdf2(
            $this->config['security']['pbkdf2_algorithm'],
            hex2bin($passwordHash),
            $serverSalt,
            $this->config['security']['pbkdf2_iterations'],
            $this->config['security']['hash_bytes'],
            true
        );

        if (!hash_equals($storedHash, $computedHash)) {
            throw new Exception('Invalid username or password');
        }

        return $user;
    }

    /** 
     * Change password
     */

    public function changePassword($userId, $currentPasswordHash, $newPasswordHash, $newEncryptedMasterKey, $newClientSalt, $newKdfSalt)
    {
        // Validate inputs
        $this->validateUserData([
            'password_hash' => $currentPasswordHash
        ]);

        $this->validateUserData([
            'password_hash' => $newPasswordHash,
            'encrypted_master_key' => $newEncryptedMasterKey,
            'client_salt' => $newClientSalt,
            'kdf_salt' => $newKdfSalt
        ]);

        // Verify current password
        $user = $this->findById($userId);
        $this->verify($user['username'], $currentPasswordHash);

        // Compute new server salt and password hash
        $newPasswordBin = hex2bin($newPasswordHash);
        $newServerSalt = random_bytes($this->config['security']['salt_bytes']);
        $newHashOfPassword = hash_pbkdf2(
            $this->config['security']['pbkdf2_algorithm'],
            $newPasswordBin,
            $newServerSalt,
            $this->config['security']['pbkdf2_iterations'],
            $this->config['security']['hash_bytes'],
            true
        );

        // Update user record
        $stmt = $this->pdo->prepare("
            UPDATE {$this->table} 
            SET password_hash = :password_hash, 
                server_salt = :server_salt, 
                encrypted_master_key = :encrypted_master_key,
                client_salt = :client_salt,
                kdf_salt = :kdf_salt,
                updated_at = :updated_at
            WHERE id = :id
        ");

        $stmt->execute([
            'password_hash' => bin2hex($newHashOfPassword),
            'server_salt' => bin2hex($newServerSalt),
            'encrypted_master_key' => $newEncryptedMasterKey,
            'client_salt' => $newClientSalt,
            'kdf_salt' => $newKdfSalt,
            'updated_at' => date('Y-m-d H:i:s'),
            'id' => $userId
        ]);

        return $this->findById($userId);
    }


    /**
     * Find user by ID
     */
    public function findById($id)
    {
        $stmt = $this->pdo->prepare("SELECT * FROM {$this->table} WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            throw new Exception('User not found');
        }

        // Remove sensitive data
        unset($user['password_hash']);

        return $user;
    }

    /**
     * Find user by username
     */
    public function findByUsername($username)
    {
        $stmt = $this->pdo->prepare("SELECT * FROM {$this->table} WHERE username = ? LIMIT 1");
        $stmt->execute([$username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            return null;
        }

        return $user;
    }

    public function lastLoginUpdate($userId)
    {
        $stmt = $this->pdo->prepare("UPDATE {$this->table} SET last_login_at = :last_login_at WHERE id = :id");
        $stmt->execute([
            'last_login_at' => date('Y-m-d H:i:s'),
            'id' => $userId
        ]);
    }

    /**
     * Check if username exists
     */
    private function usernameExists($username, $excludeId = null)
    {
        $sql = "SELECT COUNT(*) as count FROM {$this->table} WHERE username = ?";
        $params = [$username];

        if ($excludeId) {
            $sql .= " AND id != ?";
            $params[] = $excludeId;
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetch(PDO::FETCH_ASSOC)['count'] > 0;
    }


    /**
     * Validate user data
     */
    private function validateUserData(array $data, $isCreation = false)
    {
        if ($isCreation) {
            if (empty($data['username'])) {
                throw new Exception('Username is required');
            }

            if (empty($data['client_salt'])) {
                throw new Exception('Client salt is required');
            }

            if (empty($data['kdf_salt'])) {
                throw new Exception('KDF salt is required');
            }

            if (empty($data['password_hash'])) {
                throw new Exception('Password hash is required');
            }

            if (empty($data['encrypted_master_key'])) {
                throw new Exception('Encrypted master key is required');
            }
        }

        $minLength = $this->config['user']['username_min_length'];
        $maxLength = $this->config['user']['username_max_length'];

        if (isset($data['username']) && strlen($data['username']) < $minLength) {
            throw new Exception("Username must be at least {$minLength} characters");
        }

        if (isset($data['username']) && strlen($data['username']) > $maxLength) {
            throw new Exception("Username must not exceed {$maxLength} characters");
        }
        
        if (isset($data['username']) && !preg_match($this->config['user']['username_pattern'], $data['username'])) {
            throw new Exception('Username contains invalid characters');
        }

        if (isset($data['client_salt']) && !$this->validateHex($data['client_salt'], $this->config['security']['salt_bytes'])) {
            throw new Exception('Invalid client salt format');
        }

        if (isset($data['kdf_salt']) && !$this->validateHex($data['kdf_salt'], $this->config['security']['salt_bytes'])) {
            throw new Exception('Invalid KDF salt format');
        }

        if (isset($data['password_hash']) && !$this->validateHex($data['password_hash'], $this->config['security']['hash_bytes'])) {
            throw new Exception('Invalid password hash format');
        }

        if (isset($data['encrypted_master_key']) && !$this->validateHex($data['encrypted_master_key'], $this->config['security']['encrypted_key_bytes'])) {
            throw new Exception('Invalid encrypted master key format');
        }
    }

    /**
     * Validate hexadecimal string with expected byte length
     */
    private function validateHex($hex, $expectedBytes)
    {
        if (!is_string($hex)) {
            return false;
        }

        // Check if it's valid hex
        if (!ctype_xdigit($hex)) {
            return false;
        }

        // Check length (2 hex chars = 1 byte)
        $expectedLength = $expectedBytes * 2;
        if (strlen($hex) !== $expectedLength) {
            return false;
        }

        return true;
    }

    private function validateBase64($b64, $expectedBytes)
    {
        if (!is_string($b64)) {
            return false;
        }

        $decoded = base64_decode($b64, true);
        if ($decoded === false) {
            return false;
        }

        if (strlen($decoded) !== $expectedBytes) {
            return false;
        }

        return true;
    }

    /**
     * Get all users (Admin only)
     */
    public function getAllUsers()
    {
        $stmt = $this->pdo->query("SELECT id, username, storage_used, storage_quota, is_admin, created_at, last_login_at FROM {$this->table} ORDER BY created_at DESC");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Update user quota (Admin only)
     */
    public function updateQuota($userId, $newQuota)
    {
        if (!is_numeric($newQuota) || $newQuota < 0) {
            throw new Exception('Invalid quota value');
        }

        $stmt = $this->pdo->prepare("UPDATE {$this->table} SET storage_quota = :quota, updated_at = :updated_at WHERE id = :id");
        $stmt->execute([
            'quota' => $newQuota,
            'updated_at' => date('Y-m-d H:i:s'),
            'id' => $userId
        ]);

        return $this->findById($userId);
    }

    /**
     * Delete user (Admin only)
     */
    public function deleteUser($userId)
    {
        // Get user info before deletion
        $user = $this->findById($userId);
        
        // Delete user's files from database (cascade will handle this)
        // Delete user's physical files
        $uploadDir = $this->config['storage']['upload_dir'] . '/' . $user['user_folder'];
        if (file_exists($uploadDir)) {
            $this->deleteDirectory($uploadDir);
        }

        // Delete user from database
        $stmt = $this->pdo->prepare("DELETE FROM {$this->table} WHERE id = :id");
        $stmt->execute(['id' => $userId]);

        return ['success' => true, 'message' => 'User deleted successfully'];
    }

    /**
     * Check if user is admin
     */
    public function isAdmin($userId)
    {
        $stmt = $this->pdo->prepare("SELECT is_admin FROM {$this->table} WHERE id = ? LIMIT 1");
        $stmt->execute([$userId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        return $result && $result['is_admin'] == 1;
    }

    /**
     * Recursively delete directory
     */
    private function deleteDirectory($dir)
    {
        if (!file_exists($dir)) {
            return true;
        }

        if (!is_dir($dir)) {
            return unlink($dir);
        }

        foreach (scandir($dir) as $item) {
            if ($item == '.' || $item == '..') {
                continue;
            }

            if (!$this->deleteDirectory($dir . DIRECTORY_SEPARATOR . $item)) {
                return false;
            }
        }

        return rmdir($dir);
    }
}
