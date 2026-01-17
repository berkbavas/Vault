<?php

namespace App\Services;

use PDO;
use Exception;
use App\Core\Bootstrap;

class ShareService
{
    private $pdo;
    private $config;
    private $uploadDir;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
        $this->config = Bootstrap::getInstance()->getConfig();
        $this->uploadDir = $this->config['storage']['upload_dir'];
    }

    /**
     * Generate a secure share token
     */
    public function generateShareToken($length = 64)
    {
        return bin2hex(random_bytes($length));
    }

    /**
     * Create a new share with password protection
     */
    public function createShare(
        $fileId, 
        $encryptedKey, 
        $passwordHash, 
        $passwordSalt, 
        $kdfSalt,
        $permissions = [],
        $expiresAt = null
    ) {
        $token = $this->generateShareToken($this->config['security']['share_token_bytes']);

        $canUpload = $permissions['can_upload'] ?? 0;
        $canDelete = $permissions['can_delete'] ?? 0;
        $canRename = $permissions['can_rename'] ?? 0;
        $canMove = $permissions['can_move'] ?? 0;

        $stmt = $this->pdo->prepare("
            INSERT INTO file_shares (
                file_id, token, encrypted_key, 
                password_hash, password_salt, kdf_salt,
                can_upload, can_delete, can_rename, can_move,
                expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $fileId, $token, $encryptedKey,
            $passwordHash, $passwordSalt, $kdfSalt,
            $canUpload, $canDelete, $canRename, $canMove,
            $expiresAt
        ]);

        return $token;
    }

    /**
     * Get share by token (public info only - no encrypted_key)
     */
    public function getShareInfo($token)
    {
        $stmt = $this->pdo->prepare("
            SELECT 
                fs.id, fs.file_id, fs.password_salt, fs.kdf_salt,
                fs.can_upload, fs.can_delete, fs.can_rename, fs.can_move,
                fs.expires_at, fs.created_at,
                f.type as item_type, f.encrypted_name
            FROM file_shares fs
            JOIN files f ON fs.file_id = f.id
            WHERE fs.token = ?
        ");
        $stmt->execute([$token]);
        $share = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$share) {
            return null;
        }

        // Check expiration
        if ($share['expires_at'] !== null && strtotime($share['expires_at']) < time()) {
            return null;
        }

        return $share;
    }

    /**
     * Verify share password and return encrypted key
     */
    public function verifyPassword($token, $passwordHash)
    {
        $stmt = $this->pdo->prepare("
            SELECT id, password_hash, encrypted_key, expires_at
            FROM file_shares
            WHERE token = ?
        ");
        $stmt->execute([$token]);
        $share = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$share) {
            throw new Exception('Share not found');
        }

        // Check expiration
        if ($share['expires_at'] !== null && strtotime($share['expires_at']) < time()) {
            throw new Exception('Share has expired');
        }

        // Verify password hash
        if (!hash_equals($share['password_hash'], $passwordHash)) {
            throw new Exception('Invalid password');
        }

        // Update access count and last accessed time
        $stmt = $this->pdo->prepare("
            UPDATE file_shares 
            SET access_count = access_count + 1, last_accessed_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$share['id']]);

        return $share['encrypted_key'];
    }

    /**
     * Get full share data (after password verification)
     */
    public function getShare($token)
    {
        $stmt = $this->pdo->prepare("
            SELECT fs.*, f.user_id, f.type as item_type, f.encrypted_name, f.path
            FROM file_shares fs
            JOIN files f ON fs.file_id = f.id
            WHERE fs.token = ?
        ");
        $stmt->execute([$token]);
        $share = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$share) {
            throw new Exception('Share not found');
        }

        // Check expiration
        if ($share['expires_at'] !== null && strtotime($share['expires_at']) < time()) {
            throw new Exception('Share has expired');
        }

        return $share;
    }

    /**
     * Validate share access for an operation
     */
    public function validateShareAccess($token, $passwordHash, $operation = 'read')
    {
        $stmt = $this->pdo->prepare("
            SELECT fs.*, f.user_id, f.type as item_type
            FROM file_shares fs
            JOIN files f ON fs.file_id = f.id
            WHERE fs.token = ?
        ");
        $stmt->execute([$token]);
        $share = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$share) {
            throw new Exception('Share not found');
        }

        // Check expiration
        if ($share['expires_at'] !== null && strtotime($share['expires_at']) < time()) {
            throw new Exception('Share has expired');
        }

        // Verify password hash
        if (!hash_equals($share['password_hash'], $passwordHash)) {
            throw new Exception('Invalid password');
        }

        // Check permissions based on operation
        switch ($operation) {
            case 'upload':
                if (!$share['can_upload']) {
                    throw new Exception('Upload not allowed for this share');
                }
                break;
            case 'delete':
                if (!$share['can_delete']) {
                    throw new Exception('Delete not allowed for this share');
                }
                break;
            case 'rename':
                if (!$share['can_rename']) {
                    throw new Exception('Rename not allowed for this share');
                }
                break;
            case 'move':
                if (!$share['can_move']) {
                    throw new Exception('Move not allowed for this share');
                }
                break;
            case 'read':
            case 'download':
            case 'list':
                // Always allowed
                break;
            default:
                throw new Exception('Unknown operation');
        }

        return $share;
    }

    /**
     * Check if a file/folder is within the shared scope
     */
    public function isWithinShare($shareFileId, $targetFileId)
    {
        if ($shareFileId == $targetFileId) {
            return true;
        }

        // Walk up the parent chain
        $currentId = $targetFileId;
        $maxDepth = 100; // Prevent infinite loops
        $depth = 0;

        while ($currentId !== null && $depth < $maxDepth) {
            $stmt = $this->pdo->prepare("SELECT parent_id FROM files WHERE id = ?");
            $stmt->execute([$currentId]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$result) {
                return false;
            }

            if ($result['parent_id'] == $shareFileId) {
                return true;
            }

            $currentId = $result['parent_id'];
            $depth++;
        }

        return false;
    }

    /**
     * List files in a shared folder
     */
    public function listFiles($share, $parentId = null)
    {
        $shareFileId = $share['file_id'];
        
        // If parentId is null, list contents of the shared folder itself
        $targetParentId = $parentId ?? $shareFileId;

        // Verify the target is within the share scope
        if ($parentId !== null && !$this->isWithinShare($shareFileId, $parentId)) {
            throw new Exception('Access denied: folder is outside shared scope');
        }

        $stmt = $this->pdo->prepare("
            SELECT id, parent_id, encrypted_name, encrypted_key, type, size, original_size, created_at, updated_at
            FROM files 
            WHERE parent_id = ? AND user_id = ?
        ");
        $stmt->execute([$targetParentId, $share['user_id']]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get file for download from shared folder
     */
    public function getSharedFileForDownload($share, $fileId)
    {
        // Verify file is within share scope
        if (!$this->isWithinShare($share['file_id'], $fileId)) {
            throw new Exception('Access denied: file is outside shared scope');
        }

        $stmt = $this->pdo->prepare("
            SELECT f.*, u.user_folder
            FROM files f
            JOIN users u ON f.user_id = u.id
            WHERE f.id = ? AND f.user_id = ? AND f.type = 'file'
        ");
        $stmt->execute([$fileId, $share['user_id']]);
        $file = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$file) {
            throw new Exception('File not found');
        }

        $filePath = $this->uploadDir . '/' . $file['user_folder'] . '/' . $file['path'];

        if (!file_exists($filePath)) {
            throw new Exception('Physical file not found');
        }

        return [
            'path' => $filePath,
            'encrypted_name' => $file['encrypted_name'],
            'encrypted_key' => $file['encrypted_key'],
            'size' => $file['size'],
            'mime_type' => $file['mime_type'] ?? 'application/octet-stream'
        ];
    }

    /**
     * Upload a file to shared folder
     */
    public function uploadToShare($share, $file, $parentId, $encryptedName, $originalSize, $encryptedKey)
    {
        $userId = $share['user_id'];
        $shareFileId = $share['file_id'];

        // If parentId is null, upload to share root
        $targetParentId = $parentId ?? $shareFileId;

        // Verify parent is within share scope
        if ($parentId !== null && !$this->isWithinShare($shareFileId, $parentId)) {
            throw new Exception('Access denied: cannot upload outside shared scope');
        }

        // Get user folder
        $userService = new UserService($this->pdo);
        $user = $userService->findById($userId);
        $userFolder = $user['user_folder'];
        $uploadPath = $userService->getUserFolderPath($userFolder);

        // Create user directory if it doesn't exist
        if (!file_exists($uploadPath)) {
            mkdir($uploadPath, 0755, true);
        }

        // Generate unique filename
        $filename = uniqid() . '.enc';
        $filePath = $uploadPath . '/' . $filename;

        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $filePath)) {
            throw new Exception('Failed to save file');
        }

        $fileSize = filesize($filePath);

        // Insert into database
        $stmt = $this->pdo->prepare("
            INSERT INTO files (user_id, parent_id, encrypted_name, type, path, size, original_size, mime_type, encrypted_key) 
            VALUES (?, ?, ?, 'file', ?, ?, ?, 'application/octet-stream', ?)
        ");
        $stmt->execute([$userId, $targetParentId, $encryptedName, $filename, $fileSize, $originalSize, $encryptedKey]);
        $fileId = $this->pdo->lastInsertId();

        // Update user storage
        $stmt = $this->pdo->prepare("UPDATE users SET storage_used = storage_used + ? WHERE id = ?");
        $stmt->execute([$fileSize, $userId]);

        return [
            'id' => $fileId,
            'encrypted_name' => $encryptedName,
            'encrypted_key' => $encryptedKey,
            'size' => $fileSize,
            'original_size' => $originalSize,
            'type' => 'file'
        ];
    }

    /**
     * Upload chunk for shared folder
     */
    public function uploadChunkToShare($share, $uploadId, $chunkIndex, $chunkData)
    {
        $userId = $share['user_id'];

        // Get user folder
        $stmt = $this->pdo->prepare("SELECT user_folder FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !$user['user_folder']) {
            throw new Exception('User folder not found');
        }

        $userFolder = $user['user_folder'];
        $chunksDir = $this->uploadDir . '/' . $userFolder . '/chunks/' . $uploadId;

        // Create chunks directory if it doesn't exist
        if (!file_exists($chunksDir)) {
            mkdir($chunksDir, 0755, true);
        }

        // Save chunk to disk
        $chunkPath = $chunksDir . '/' . $chunkIndex;

        if (file_put_contents($chunkPath, $chunkData) === false) {
            throw new Exception('Failed to save chunk');
        }

        // Update metadata.json
        $metadataPath = $chunksDir . '/metadata.json';
        $metadata = [];

        if (file_exists($metadataPath)) {
            $metadataContent = file_get_contents($metadataPath);
            $metadata = json_decode($metadataContent, true) ?? [];
        }

        if (!isset($metadata['chunks'])) {
            $metadata['chunks'] = [];
        }

        $metadata['chunks'][$chunkIndex] = [
            'index' => $chunkIndex,
            'size' => strlen($chunkData),
            'uploaded_at' => date('Y-m-d H:i:s')
        ];

        $metadata['last_updated'] = date('Y-m-d H:i:s');

        if (file_put_contents($metadataPath, json_encode($metadata, JSON_PRETTY_PRINT)) === false) {
            throw new Exception('Failed to update metadata');
        }

        return [
            'chunk_index' => $chunkIndex,
            'saved' => true
        ];
    }

    /**
     * Finalize chunked upload for shared folder
     */
    public function finalizeChunkedUploadToShare($share, $uploadId, $parentId, $encryptedName, $originalSize, $totalChunks, $encryptedKey)
    {
        $userId = $share['user_id'];
        $shareFileId = $share['file_id'];

        // If parentId is null, upload to share root
        $targetParentId = $parentId ?? $shareFileId;

        // Verify parent is within share scope
        if ($parentId !== null && !$this->isWithinShare($shareFileId, $parentId)) {
            throw new Exception('Access denied: cannot upload outside shared scope');
        }

        // Get user folder
        $stmt = $this->pdo->prepare("SELECT user_folder FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !$user['user_folder']) {
            throw new Exception('User folder not found');
        }

        $userFolder = $user['user_folder'];
        $chunksDir = $this->uploadDir . '/' . $userFolder . '/chunks/' . $uploadId;
        $uploadPath = $this->uploadDir . '/' . $userFolder;

        // Verify all chunks exist
        for ($i = 0; $i < $totalChunks; $i++) {
            $chunkPath = $chunksDir . '/' . $i;
            if (!file_exists($chunkPath)) {
                throw new Exception("Missing chunk: $i");
            }
        }

        // Generate unique filename for final file
        $filename = uniqid() . '.enc';
        $finalPath = $uploadPath . '/' . $filename;

        // Merge chunks
        $finalFile = fopen($finalPath, 'wb');
        if (!$finalFile) {
            throw new Exception('Failed to create final file');
        }

        for ($i = 0; $i < $totalChunks; $i++) {
            $chunkPath = $chunksDir . '/' . $i;
            $chunkData = file_get_contents($chunkPath);
            fwrite($finalFile, $chunkData);
        }

        fclose($finalFile);

        $fileSize = filesize($finalPath);

        // Insert into database
        $stmt = $this->pdo->prepare("
            INSERT INTO files (user_id, parent_id, encrypted_name, type, path, size, original_size, mime_type, encrypted_key) 
            VALUES (?, ?, ?, 'file', ?, ?, ?, 'application/octet-stream', ?)
        ");
        $stmt->execute([$userId, $targetParentId, $encryptedName, $filename, $fileSize, $originalSize, $encryptedKey]);

        $fileId = $this->pdo->lastInsertId();

        // Update user storage
        $stmt = $this->pdo->prepare("UPDATE users SET storage_used = storage_used + ? WHERE id = ?");
        $stmt->execute([$fileSize, $userId]);

        // Clean up chunks directory
        $this->deleteChunksDirectory($chunksDir);

        return [
            'id' => $fileId,
            'encrypted_name' => $encryptedName,
            'encrypted_key' => $encryptedKey,
            'size' => $fileSize,
            'original_size' => $originalSize,
            'type' => 'file'
        ];
    }

    /**
     * Delete file/folder in shared folder
     */
    public function deleteInShare($share, $fileId)
    {
        $userId = $share['user_id'];
        $shareFileId = $share['file_id'];

        // Cannot delete the shared folder itself
        if ($fileId == $shareFileId) {
            throw new Exception('Cannot delete the shared folder itself');
        }

        // Verify file is within share scope
        if (!$this->isWithinShare($shareFileId, $fileId)) {
            throw new Exception('Access denied: file is outside shared scope');
        }

        $storageService = new StorageService($this->pdo);
        return $storageService->delete($userId, $fileId);
    }

    /**
     * Rename file/folder in shared folder
     */
    public function renameInShare($share, $fileId, $newEncryptedName)
    {
        $userId = $share['user_id'];
        $shareFileId = $share['file_id'];

        // Cannot rename the shared folder itself
        if ($fileId == $shareFileId) {
            throw new Exception('Cannot rename the shared folder itself');
        }

        // Verify file is within share scope
        if (!$this->isWithinShare($shareFileId, $fileId)) {
            throw new Exception('Access denied: file is outside shared scope');
        }

        $storageService = new StorageService($this->pdo);
        return $storageService->rename($userId, $fileId, $newEncryptedName);
    }

    /**
     * Move file/folder within shared folder
     */
    public function moveInShare($share, $fileId, $newParentId, $newEncryptedKey = null)
    {
        $userId = $share['user_id'];
        $shareFileId = $share['file_id'];

        // Cannot move the shared folder itself
        if ($fileId == $shareFileId) {
            throw new Exception('Cannot move the shared folder itself');
        }

        // Verify source is within share scope
        if (!$this->isWithinShare($shareFileId, $fileId)) {
            throw new Exception('Access denied: file is outside shared scope');
        }

        // Verify destination is within share scope
        if ($newParentId !== null && !$this->isWithinShare($shareFileId, $newParentId) && $newParentId != $shareFileId) {
            throw new Exception('Access denied: destination is outside shared scope');
        }

        // If moving to share root, set parent to share folder
        if ($newParentId === null) {
            $newParentId = $shareFileId;
        }

        $storageService = new StorageService($this->pdo);
        return $storageService->move($userId, $fileId, $newParentId, $newEncryptedKey);
    }

    /**
     * Create folder in shared folder
     */
    public function createFolderInShare($share, $parentId, $encryptedName, $encryptedKey)
    {
        $userId = $share['user_id'];
        $shareFileId = $share['file_id'];

        // If parentId is null, create in share root
        $targetParentId = $parentId ?? $shareFileId;

        // Verify parent is within share scope
        if ($parentId !== null && !$this->isWithinShare($shareFileId, $parentId)) {
            throw new Exception('Access denied: cannot create folder outside shared scope');
        }

        $storageService = new StorageService($this->pdo);
        return $storageService->createFolder($userId, $targetParentId, $encryptedName, $encryptedKey);
    }

    /**
     * Get file by ID (with share scope check)
     */
    public function getFileInShare($share, $fileId)
    {
        // Verify file is within share scope
        if (!$this->isWithinShare($share['file_id'], $fileId) && $fileId != $share['file_id']) {
            throw new Exception('Access denied: file is outside shared scope');
        }

        $stmt = $this->pdo->prepare("
            SELECT * FROM files WHERE id = ? AND user_id = ?
        ");
        $stmt->execute([$fileId, $share['user_id']]);

        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Get folder key for a folder in shared scope
     */
    public function getFolderKeyInShare($share, $folderId)
    {
        // Verify folder is within share scope
        if (!$this->isWithinShare($share['file_id'], $folderId) && $folderId != $share['file_id']) {
            throw new Exception('Access denied: folder is outside shared scope');
        }

        $stmt = $this->pdo->prepare("
            SELECT encrypted_key FROM files WHERE id = ? AND user_id = ? AND type = 'folder'
        ");
        $stmt->execute([$folderId, $share['user_id']]);
        $folder = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$folder) {
            throw new Exception('Folder not found');
        }

        return $folder['encrypted_key'];
    }

    /**
     * Delete chunks directory and its contents
     */
    private function deleteChunksDirectory($dir)
    {
        if (!is_dir($dir)) {
            return;
        }

        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            if (is_dir($path)) {
                $this->deleteChunksDirectory($path);
            } else {
                unlink($path);
            }
        }
        rmdir($dir);
    }

    /**
     * Delete a share
     */
    public function deleteShare($shareId, $userId)
    {
        // Verify ownership
        $stmt = $this->pdo->prepare("
            SELECT fs.id FROM file_shares fs
            JOIN files f ON fs.file_id = f.id
            WHERE fs.id = ? AND f.user_id = ?
        ");
        $stmt->execute([$shareId, $userId]);
        $share = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$share) {
            throw new Exception('Share not found or access denied');
        }

        $stmt = $this->pdo->prepare("DELETE FROM file_shares WHERE id = ?");
        $stmt->execute([$shareId]);

        return true;
    }

    /**
     * List shares created by a user
     */
    public function listUserShares($userId)
    {
        $stmt = $this->pdo->prepare("
            SELECT fs.*, f.encrypted_name, f.type as item_type
            FROM file_shares fs
            JOIN files f ON fs.file_id = f.id
            WHERE f.user_id = ?
            ORDER BY fs.created_at DESC
        ");
        $stmt->execute([$userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
