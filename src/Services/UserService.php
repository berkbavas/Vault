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

    public function createUser(string $username, string $clientSalt, string $kdfSalt, string $passwordHash, string $encryptedMasterKey)
    {
        if ($this->isUsernameTaken($username)) {
            throw new Exception('Username already taken');
        }

        $serverSalt = random_bytes($this->config['security']['salt_bytes']);
        $serverSaltHex = bin2hex($serverSalt);
        $passwordHashBin = hex2bin($passwordHash);
        $hashedPassword = hash_pbkdf2(
            $this->config['security']['pbkdf2_algorithm'],
            $passwordHashBin,
            $serverSalt,
            $this->config['security']['pbkdf2_iterations'],
            $this->config['security']['pbkdf2_key_length'],
            true
        );
        $hashedPasswordHex = bin2hex($hashedPassword);
        $userFolder = $this->generateUserFolderName($username);

        $stmt = $this->pdo->prepare("INSERT INTO {$this->table} 
        (username, password_hash, client_salt, kdf_salt, server_salt, encrypted_master_key, user_folder, created_at) 
        VALUES (:username, :password_hash, :client_salt, :kdf_salt, :server_salt, :encrypted_master_key, :user_folder, NOW())");

        $stmt->execute([
            'username' => $username,
            'password_hash' => $hashedPasswordHex,
            'client_salt' => $clientSalt,
            'kdf_salt' => $kdfSalt,
            'server_salt' => $serverSaltHex,
            'user_folder' => $userFolder,
            'encrypted_master_key' => $encryptedMasterKey,
        ]);


        $this->createUserFolder($userFolder);
    }

    public function verify($username, $passwordHash)
    {
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
            $this->config['security']['pbkdf2_key_length'],
            true
        );

        if (!hash_equals($storedHash, $computedHash)) {
            throw new Exception('Invalid username or password');
        }

        return $user;
    }


    public function changePassword($userId, $currentPasswordHash, $newPasswordHash, $newEncryptedMasterKey, $newClientSalt, $newKdfSalt)
    {
        // Verify current password
        $user = $this->findById($userId);

        if (!$user) {
            throw new Exception('User not found');
        }

        $this->verify($user['username'], $currentPasswordHash);

        // Compute new server salt and password hash
        $newPasswordBin = hex2bin($newPasswordHash);
        $newServerSaltBin = random_bytes($this->config['security']['salt_bytes']);
        $newHashOfPassword = hash_pbkdf2(
            $this->config['security']['pbkdf2_algorithm'],
            $newPasswordBin,
            $newServerSaltBin,
            $this->config['security']['pbkdf2_iterations'],
            $this->config['security']['pbkdf2_key_length'],
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
            'server_salt' => bin2hex($newServerSaltBin),
            'encrypted_master_key' => $newEncryptedMasterKey,
            'client_salt' => $newClientSalt,
            'kdf_salt' => $newKdfSalt,
            'updated_at' => date('Y-m-d H:i:s'),
            'id' => $userId
        ]);

        return $this->findById($userId);
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
        $uploadDir = $this->getUserFolderPath($user['user_folder']);

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

    private function generateUserFolderName(string $username): string
    {
        return 'user_' . uniqid() . '_' . md5($username . time());
    }

    private function createUserFolder(string $userFolder): void
    {
        $uploadDir = $this->getUserFolderPath($userFolder);

        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
    }

    public function getUserFolderPath(string $userFolder): string
    {
        return $this->config['storage']['upload_dir'] . '/' . $userFolder;
    }

    public function findById(int $id): array|null
    {
        $stmt = $this->pdo->prepare("SELECT * FROM {$this->table} WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        return  $user ?: null;
    }

    public function findByUsername(string $username): array|null
    {
        $stmt = $this->pdo->prepare("SELECT * FROM {$this->table} WHERE username = :username");
        $stmt->execute(['username' => $username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        return  $user ?: null;
    }

    private function isUsernameTaken(string $username): bool
    {
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM {$this->table} WHERE username = :username");
        $stmt->execute(['username' => $username]);
        return $stmt->fetchColumn() > 0;
    }
}
