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

}
