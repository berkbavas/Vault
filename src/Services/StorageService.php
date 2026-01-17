<?php

namespace App\Services;

use PDO;
use Exception;
use App\Core\Bootstrap;

class StorageService
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
     * List files in a folder with share info
     */
    public function list($userId, $parentId = null)
    {
        $sql = "
            SELECT f.*, 
                   s.id as share_id, 
                   s.token as share_token,
                   s.expires_at as share_expires_at,
                   s.can_upload as share_can_upload,
                   s.can_delete as share_can_delete,
                   s.can_rename as share_can_rename,
                   s.can_move as share_can_move
            FROM files f
            LEFT JOIN file_shares s ON f.id = s.file_id
            WHERE f.user_id = :user_id AND f.parent_id " . ($parentId === null ? "IS NULL" : "= :parent_id");
        
        $stmt = $this->pdo->prepare($sql);
        $params = ['user_id' => $userId];
        if ($parentId !== null) {
            $params['parent_id'] = $parentId;
        }
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function createFolder($userId, $parentId, $folderName, $encryptedKey)
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO files (user_id, parent_id, encrypted_name, type, size, encrypted_key) 
            VALUES (?, ?, ?, 'folder', 0, ?)
        ");
        $stmt->execute([$userId, $parentId, $folderName, $encryptedKey]);

        return $this->pdo->lastInsertId();
    }

    public function getFolderKey($userId, $folderId)
    {
        $stmt = $this->pdo->prepare("
            SELECT encrypted_key 
            FROM files 
            WHERE id = ? AND user_id = ? AND type = 'folder'
        ");
        $stmt->execute([$folderId, $userId]);
        $folder = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$folder) {
            throw new Exception('Folder not found');
        }

        return $folder['encrypted_key'];
    }

    /**
     * Rename a file or folder
     */
    public function rename($userId, $fileId, $newName)
    {
        $stmt = $this->pdo->prepare("
            UPDATE files 
            SET encrypted_name = ?, updated_at = NOW() 
            WHERE id = ? AND user_id = ?
        ");
        $stmt->execute([$newName, $fileId, $userId]);

        return $stmt->rowCount() > 0;
    }

    public function move($userId, $id, $newParentId = null, $newEncryptedKey = null)
    {
        if ($newEncryptedKey !== null) {
            // Update parent_id and encrypted_key (key re-encrypted by client)
            $stmt = $this->pdo->prepare("
                UPDATE files 
                SET parent_id = ?, encrypted_key = ?, updated_at = NOW() 
                WHERE id = ? AND user_id = ?
            ");
            $stmt->execute([$newParentId, $newEncryptedKey, $id, $userId]);
        } else {
            // Only update parent_id
            $stmt = $this->pdo->prepare("
                UPDATE files 
                SET parent_id = ?, updated_at = NOW() 
                WHERE id = ? AND user_id = ?
            ");
            $stmt->execute([$newParentId, $id, $userId]);
        }

        return $stmt->rowCount() > 0;
    }


    /**
     * Upload a file
     */
    public function upload($userId, $file, $parentId, $encryptedName, $originalSize, $encryptedKey)
    {
        // Get user folder
        $userService = new UserService($this->pdo);
        $user = $userService->findById($userId);
        $userFolder = $user['user_folder'];
        $uploadPath = $userService->getUserFolderPath($userFolder);

        // Check storage quota before upload
        $fileSize = $file['size'];
        $userService->validateStorageQuota($userId, $fileSize);

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
        $stmt->execute([$userId, $parentId, $encryptedName, $filename, $fileSize, $originalSize, $encryptedKey]);
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
     * Delete a file or folder
     */
    public function delete($userId, $fileId)
    {
        // Get file info
        $stmt = $this->pdo->prepare("SELECT * FROM files WHERE id = ? AND user_id = ?");
        $stmt->execute([$fileId, $userId]);
        $file = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$file) {
            throw new Exception('File not found');
        }

        $freedSpace = 0;

        if ($file['type'] === 'file') {
            // Delete physical file
            if ($file['path']) {
                $stmt = $this->pdo->prepare("SELECT user_folder FROM users WHERE id = ?");
                $stmt->execute([$userId]);
                $user = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($user && $user['user_folder']) {
                    $filePath = $this->uploadDir . '/' . $user['user_folder'] . '/' . $file['path'];
                    if (file_exists($filePath)) {
                        unlink($filePath);
                    }
                }
            }
            $freedSpace = $file['size'] ?? 0;
        } else {
            // Delete folder recursively
            $freedSpace = $this->deleteFolderRecursive($userId, $fileId);
        }

        // Delete from database
        $stmt = $this->pdo->prepare("DELETE FROM files WHERE id = ? AND user_id = ?");
        $stmt->execute([$fileId, $userId]);

        // Update user storage
        if ($freedSpace > 0) {
            $stmt = $this->pdo->prepare("UPDATE users SET storage_used = GREATEST(0, storage_used - ?) WHERE id = ?");
            $stmt->execute([$freedSpace, $userId]);
        }

        return true;
    }

    public function deleteMultiple($userId, $fileIds)
    {
        $deletedCount = 0;

        foreach ($fileIds as $fileId) {
            try {
                if ($this->delete($userId, $fileId)) {
                    $deletedCount++;
                }
            } catch (Exception $e) {

                continue;
            }
        }

        return $deletedCount;
    }

    /**
     * Delete folder recursively
     */
    private function deleteFolderRecursive($userId, $folderId)
    {
        $totalFreed = 0;

        // Get all children
        $stmt = $this->pdo->prepare("SELECT * FROM files WHERE parent_id = ? AND user_id = ?");
        $stmt->execute([$folderId, $userId]);
        $children = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($children as $child) {
            if ($child['type'] === 'folder') {
                $totalFreed += $this->deleteFolderRecursive($userId, $child['id']);
            } else {
                // Delete physical file
                if ($child['path']) {
                    $stmt = $this->pdo->prepare("SELECT user_folder FROM users WHERE id = ?");
                    $stmt->execute([$userId]);
                    $user = $stmt->fetch(PDO::FETCH_ASSOC);

                    if ($user && $user['user_folder']) {
                        $filePath = $this->uploadDir . '/' . $user['user_folder'] . '/' . $child['path'];
                        if (file_exists($filePath)) {
                            unlink($filePath);
                        }
                    }
                }
                $totalFreed += $child['size'] ?? 0;
            }

            // Delete child from database
            $stmt = $this->pdo->prepare("DELETE FROM files WHERE id = ? AND user_id = ?");
            $stmt->execute([$child['id'], $userId]);
        }

        return $totalFreed;
    }

    /**
     * Get file data for download
     */
    public function getFileForDownload($userId, $fileId)
    {
        $stmt = $this->pdo->prepare("SELECT * FROM files WHERE id = ? AND user_id = ? AND type = 'file'");
        $stmt->execute([$fileId, $userId]);
        $file = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$file) {
            throw new Exception('File not found');
        }

        // Get user folder
        $stmt = $this->pdo->prepare("SELECT user_folder FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !$user['user_folder']) {
            throw new Exception('User folder not found');
        }

        $filePath = $this->uploadDir . '/' . $user['user_folder'] . '/' . $file['path'];

        if (!file_exists($filePath)) {
            throw new Exception('Physical file not found');
        }

        return [
            'path' => $filePath,
            'encrypted_name' => $file['encrypted_name'],
            'size' => $file['size'],
            'mime_type' => $file['mime_type'] ?? 'application/octet-stream'
        ];
    }

    /**
     * Upload a chunk of a file
     */
    public function uploadChunk($userId, $uploadId, $chunkIndex, $chunkData)
    {
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
     * Finalize chunked upload by merging all chunks
     */
    public function finalizeChunkedUpload($userId, $uploadId, $parentId, $encryptedName, $originalSize, $totalChunks, $encryptedKey)
    {
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

        // Verify all chunks exist and calculate total size
        $totalSize = 0;
        for ($i = 0; $i < $totalChunks; $i++) {
            $chunkPath = $chunksDir . '/' . $i;
            if (!file_exists($chunkPath)) {
                throw new Exception("Missing chunk: $i");
            }
            $totalSize += filesize($chunkPath);
        }

        // Check storage quota before finalizing upload
        $userService = new UserService($this->pdo);
        $userService->validateStorageQuota($userId, $totalSize);

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
        $stmt->execute([$userId, $parentId, $encryptedName, $filename, $fileSize, $originalSize, $encryptedKey]);

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
    
    public function getFileById($fileId, $userId)
    {
        $stmt = $this->pdo->prepare("SELECT * FROM files WHERE id = ? and user_id =  ?");
        $stmt->execute([$fileId, $userId]);
        $file = $stmt->fetch(PDO::FETCH_ASSOC);
        return $file;
    }
}
