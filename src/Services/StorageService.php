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
     * List files in a folder
     */
    public function list($userId, $parentId = null)
    {
        if ($parentId === null) {
            // Root files
            $stmt = $this->pdo->prepare("
                SELECT id, encrypted_name, type, size, original_size, mime_type, created_at, updated_at 
                FROM files 
                WHERE user_id = ? AND parent_id IS NULL 
                ORDER BY type DESC
            ");
            $stmt->execute([$userId]);
        } else {
            // Files in specific folder
            $stmt = $this->pdo->prepare("
                SELECT id, encrypted_name, type, size, original_size, mime_type, created_at, updated_at 
                FROM files 
                WHERE user_id = ? AND parent_id = ? 
                ORDER BY type DESC
            ");
            $stmt->execute([$userId, $parentId]);
        }

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function createFolder($userId, $parentId, $folderName)
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO files (user_id, parent_id, encrypted_name, type, size) 
            VALUES (?, ?, ?, 'folder', 0)
        ");
        $stmt->execute([$userId, $parentId, $folderName]);

        return $this->pdo->lastInsertId();
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

    public function move($userId, $id, $newParentId = null)
    {
        $stmt = $this->pdo->prepare("
            UPDATE files 
            SET parent_id = ?, updated_at = NOW() 
            WHERE id = ? AND user_id = ?
        ");
        $stmt->execute([$newParentId, $id, $userId]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Upload a file
     */
    public function upload($userId, $file, $parentId, $encryptedName, $originalSize)
    {
        // Get user folder
        $stmt = $this->pdo->prepare("SELECT user_folder FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !$user['user_folder']) {
            throw new Exception('User folder not found');
        }

        $userFolder = $user['user_folder'];
        $uploadPath = $this->uploadDir . '/' . $userFolder;

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
            INSERT INTO files (user_id, parent_id, encrypted_name, type, path, size, original_size, mime_type) 
            VALUES (?, ?, ?, 'file', ?, ?, ?, 'application/octet-stream')
        ");
        $stmt->execute([$userId, $parentId, $encryptedName, $filename, $fileSize, $originalSize]);

        $fileId = $this->pdo->lastInsertId();

        // Update user storage
        $stmt = $this->pdo->prepare("UPDATE users SET storage_used = storage_used + ? WHERE id = ?");
        $stmt->execute([$fileSize, $userId]);

        return [
            'id' => $fileId,
            'encrypted_name' => $encryptedName,
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
    public function finalizeChunkedUpload($userId, $uploadId, $parentId, $encryptedName, $originalSize, $totalChunks)
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
            INSERT INTO files (user_id, parent_id, encrypted_name, type, path, size, original_size, mime_type) 
            VALUES (?, ?, ?, 'file', ?, ?, ?, 'application/octet-stream')
        ");
        $stmt->execute([$userId, $parentId, $encryptedName, $filename, $fileSize, $originalSize]);

        $fileId = $this->pdo->lastInsertId();

        // Update user storage
        $stmt = $this->pdo->prepare("UPDATE users SET storage_used = storage_used + ? WHERE id = ?");
        $stmt->execute([$fileSize, $userId]);

        // Clean up chunks directory
        $this->deleteChunksDirectory($chunksDir);

        return [
            'id' => $fileId,
            'encrypted_name' => $encryptedName,
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

}
