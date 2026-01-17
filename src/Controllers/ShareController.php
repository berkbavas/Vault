<?php

namespace App\Controllers;

use App\Services\ShareService;
use App\Services\StorageService;
use App\Http\JsonResponse;
use Exception;

class ShareController extends Controller
{
    private $shareService;
    private $storageService;

    private $rules = [
        'create_share' => [
            'file_id' => 'required|integer',
            'encrypted_key' => 'required|string|min:120|max:120|hex',
            'password_hash' => 'required|string|min:64|max:64|hex',
            'password_salt' => 'required|string|min:64|max:64|hex',
            'kdf_salt' => 'required|string|min:64|max:64|hex',
        ],

        'get_share_info' => [
            'token' => 'required|string|min:64',
        ],

        'verify_password' => [
            'token' => 'required|string|min:64',
            'password_hash' => 'required|string|min:64|max:64|hex',
        ],

        'list_files' => [
            'token' => 'required|string|min:64',
            'password_hash' => 'required|string|min:64|max:64|hex',
            'parent_id' => 'nullable|integer',
        ],

        'download' => [
            'token' => 'required|string',
            'password_hash' => 'required|string|min:64|max:64|hex',
            'file_id' => 'required|string',
        ],

        'upload' => [
            'token' => 'required|string',
            'password_hash' => 'required|string|min:64|max:64|hex',
            'parent_id' => 'nullable',
            'encrypted_name' => 'required|string|max:510|hex',
            'original_size' => 'required|string',
            'encrypted_key' => 'required|string|min:120|max:120|hex',
        ],

        'upload_chunk' => [
            'token' => 'required|string',
            'password_hash' => 'required|string|min:64|max:64|hex',
            'upload_id' => 'required|string|max:64',
            'chunk_index' => 'required|string',
        ],

        'finalize_upload' => [
            'token' => 'required|string',
            'password_hash' => 'required|string|min:64|max:64|hex',
            'upload_id' => 'required|string|max:64',
            'encrypted_name' => 'required|string|max:510|hex',
            'parent_id' => 'nullable',
            'original_size' => 'required|integer|min:0',
            'total_chunks' => 'required|integer|min:1',
            'encrypted_key' => 'required|string|min:120|max:120|hex'
        ],

        'delete' => [
            'token' => 'required|string',
            'password_hash' => 'required|string|min:64|max:64|hex',
            'file_id' => 'required|integer',
        ],

        'rename' => [
            'token' => 'required|string',
            'password_hash' => 'required|string|min:64|max:64|hex',
            'file_id' => 'required|integer',
            'new_encrypted_name' => 'required|string|max:510|hex',
        ],

        'move' => [
            'token' => 'required|string',
            'password_hash' => 'required|string|min:64|max:64|hex',
            'file_id' => 'required|integer',
            'new_parent_id' => 'nullable|integer',
            'new_encrypted_key' => 'required|string|min:120|max:120|hex',
        ],

        'create_folder' => [
            'token' => 'required|string',
            'password_hash' => 'required|string|min:64|max:64|hex',
            'parent_id' => 'nullable|integer',
            'encrypted_name' => 'required|string|max:510|hex',
            'encrypted_key' => 'required|string|min:120|max:120|hex',
        ],

        'list_shares' => [
            // No parameters needed
        ],

        'delete_share' => [
            'share_id' => 'required|integer',
        ],
    ];

    public function __construct()
    {
        parent::__construct();
        $this->shareService = new ShareService($this->pdo);
        $this->storageService = new StorageService($this->pdo);
    }

    /**
     * Create a new share (requires authentication)
     */
    public function createShare()
    {
        $userId = $this->requireAuth();
        $this->validateJson($this->rules['create_share']);

        $fileId = $this->request->json('file_id');
        $encryptedKey = $this->request->json('encrypted_key');
        $passwordHash = $this->request->json('password_hash');
        $passwordSalt = $this->request->json('password_salt');
        $kdfSalt = $this->request->json('kdf_salt');
        $expiresAt = $this->request->json('expires_at', null);
        $permissions = [
            'can_upload' => $this->request->json('can_upload', 0) ? 1 : 0,
            'can_delete' => $this->request->json('can_delete', 0) ? 1 : 0,
            'can_rename' => $this->request->json('can_rename', 0) ? 1 : 0,
            'can_move' => $this->request->json('can_move', 0) ? 1 : 0,
        ];

        // Verify user owns the file
        $file = $this->storageService->getFileById($fileId, $userId);
        if (!$file) {
            return $this->error('File not found or access denied', 404)->send();
        }

        $token = $this->shareService->createShare(
            $fileId,
            $encryptedKey,
            $passwordHash,
            $passwordSalt,
            $kdfSalt,
            $permissions,
            $expiresAt
        );

        return $this->success([
            'token' => $token,
            'share_url' => $this->config['app']['url'] . '/public/share.php?token=' . $token
        ], 'Share created successfully')->send();
    }

    /**
     * Get share info (no password required - returns public info)
     */
    public function getShareInfo()
    {
        $this->validateJson($this->rules['get_share_info']);

        $token = $this->request->json('token');
        $share = $this->shareService->getShareInfo($token);

        if (!$share) {
            return $this->error('Share not found or expired', 404)->send();
        }

        return $this->success([
            'item_type' => $share['item_type'],
            'encrypted_name' => $share['encrypted_name'],
            'password_salt' => $share['password_salt'],
            'kdf_salt' => $share['kdf_salt'],
            'can_upload' => (bool) $share['can_upload'],
            'can_delete' => (bool) $share['can_delete'],
            'can_rename' => (bool) $share['can_rename'],
            'can_move' => (bool) $share['can_move'],
            'expires_at' => $share['expires_at'],
        ])->send();
    }

    /**
     * Verify password and get encrypted key
     */
    public function verifyPassword()
    {
        $this->validateJson($this->rules['verify_password']);

        $token = $this->request->json('token');
        $passwordHash = $this->request->json('password_hash');

        try {
            $encryptedKey = $this->shareService->verifyPassword($token, $passwordHash);
            $share = $this->shareService->getShare($token);
            
            // Get storage info for the share owner (for quota checking)
            $storageInfo = $this->shareService->getShareOwnerStorageInfo($token);

            return $this->success([
                'encrypted_key' => $encryptedKey,
                'file_id' => $share['file_id'],
                'item_type' => $share['item_type'],
                'encrypted_name' => $share['encrypted_name'],
                'can_upload' => (bool) $share['can_upload'],
                'can_delete' => (bool) $share['can_delete'],
                'can_rename' => (bool) $share['can_rename'],
                'can_move' => (bool) $share['can_move'],
                'storage_used' => $storageInfo['storage_used'],
                'storage_quota' => $storageInfo['storage_quota'],
                'storage_available' => $storageInfo['available'],
            ])->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 401)->send();
        }
    }

    /**
     * List files in shared folder
     */
    public function listFiles()
    {
        $this->validateJson($this->rules['list_files']);

        $token = $this->request->json('token');
        $passwordHash = $this->request->json('password_hash');
        $parentId = $this->request->json('parent_id', null);

        try {
            $share = $this->shareService->validateShareAccess($token, $passwordHash, 'list');
            $files = $this->shareService->listFiles($share, $parentId);

            // Get folder key if navigating into a subfolder
            $folderKey = null;
            if ($parentId !== null) {
                $folderKey = $this->shareService->getFolderKeyInShare($share, $parentId);
            }

            return $this->success([
                'files' => $files,
                'parent_id' => $parentId,
                'encrypted_key' => $folderKey,
                'share_file_id' => $share['file_id'],
            ])->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 403)->send();
        }
    }

    /**
     * Download file from shared folder
     */
    public function download()
    {
        $this->validate($this->rules['download']);

        $token = $this->request->query('token');
        $passwordHash = $this->request->query('password_hash');
        $fileId = $this->request->query('file_id');

        try {
            $share = $this->shareService->validateShareAccess($token, $passwordHash, 'download');
            $fileData = $this->shareService->getSharedFileForDownload($share, $fileId);

            // Check if file exists
            if (!file_exists($fileData['path'])) {
                throw new Exception('File not found');
            }

            $fileSize = $fileData['size'];
            $filePath = $fileData['path'];

            // Handle HEAD request (for getting file size)
            if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
                header('Content-Type: application/octet-stream');
                header('Content-Length: ' . $fileSize);
                header('Accept-Ranges: bytes');
                header('Cache-Control: no-cache, must-revalidate');
                exit;
            }

            // Check if Range header is present (for resumable downloads)
            $rangeHeader = isset($_SERVER['HTTP_RANGE']) ? $_SERVER['HTTP_RANGE'] : null;

            $start = 0;
            $end = $fileSize - 1;
            $isRangeRequest = false;

            if ($rangeHeader !== null) {
                if (preg_match('/bytes=(\d+)-(\d*)/', $rangeHeader, $matches)) {
                    $start = intval($matches[1]);
                    $end = !empty($matches[2]) ? intval($matches[2]) : $fileSize - 1;
                    $isRangeRequest = true;
                }
            }

            if ($start > $end || $start < 0 || $end >= $fileSize) {
                header('HTTP/1.1 416 Requested Range Not Satisfiable');
                header("Content-Range: bytes */$fileSize");
                exit;
            }

            $contentLength = $end - $start + 1;

            if ($isRangeRequest) {
                header('HTTP/1.1 206 Partial Content');
                header("Content-Range: bytes $start-$end/$fileSize");
            } else {
                header('HTTP/1.1 200 OK');
            }

            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="' . $fileData['encrypted_name'] . '"');
            header('Content-Length: ' . $contentLength);
            header('Accept-Ranges: bytes');
            header('Cache-Control: no-cache, must-revalidate');
            header('Pragma: public');

            if (ob_get_level()) {
                ob_end_clean();
            }

            $handle = fopen($filePath, 'rb');
            if ($handle === false) {
                throw new Exception('Cannot open file for reading');
            }

            if ($start > 0) {
                fseek($handle, $start);
            }

            $chunkSize = 8 * 1024 * 1024;
            $bytesRemaining = $contentLength;

            while (!feof($handle) && $bytesRemaining > 0) {
                $readSize = min($chunkSize, $bytesRemaining);
                $chunk = fread($handle, $readSize);

                if ($chunk === false) {
                    break;
                }

                echo $chunk;
                $bytesRemaining -= strlen($chunk);

                if (ob_get_level()) {
                    ob_flush();
                }
                flush();

                if (connection_status() != CONNECTION_NORMAL) {
                    break;
                }
            }

            fclose($handle);
        } catch (Exception $e) {
            JsonResponse::error($e->getMessage(), 403)->send();
        }
    }

    /**
     * Upload file to shared folder
     */
    public function upload()
    {
        $this->validateFile();
        $this->validate($this->rules['upload']);

        $token = $this->request->post('token');
        $passwordHash = $this->request->post('password_hash');
        $parentId = $this->request->post('parent_id', null);
        $encryptedName = $this->request->post('encrypted_name');
        $originalSize = $this->request->post('original_size', 0);
        $encryptedKey = $this->request->post('encrypted_key');
        $file = $this->request->file('file');

        try {
            $share = $this->shareService->validateShareAccess($token, $passwordHash, 'upload');
            $fileData = $this->shareService->uploadToShare(
                $share, $file, $parentId, $encryptedName, $originalSize, $encryptedKey
            );

            return $this->success([
                'file' => $fileData
            ], 'File uploaded successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 403)->send();
        }
    }

    /**
     * Upload chunk to shared folder
     */
    public function uploadChunk()
    {
        $this->validateChunk();
        $this->validate($this->rules['upload_chunk']);

        $token = $this->request->post('token');
        $passwordHash = $this->request->post('password_hash');
        $uploadId = $this->request->post('upload_id');
        $chunkIndex = $this->request->post('chunk_index');
        $chunkData = file_get_contents($_FILES['chunk']['tmp_name']);

        try {
            $share = $this->shareService->validateShareAccess($token, $passwordHash, 'upload');
            $result = $this->shareService->uploadChunkToShare($share, $uploadId, $chunkIndex, $chunkData);

            return $this->success($result, 'Chunk uploaded successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 403)->send();
        }
    }

    /**
     * Finalize chunked upload to shared folder
     */
    public function finalizeUpload()
    {
        $this->validateJson($this->rules['finalize_upload']);

        $token = $this->request->json('token');
        $passwordHash = $this->request->json('password_hash');
        $uploadId = $this->request->json('upload_id');
        $encryptedName = $this->request->json('encrypted_name');
        $parentId = $this->request->json('parent_id');
        $originalSize = $this->request->json('original_size', 0);
        $totalChunks = $this->request->json('total_chunks');
        $encryptedKey = $this->request->json('encrypted_key');

        try {
            $share = $this->shareService->validateShareAccess($token, $passwordHash, 'upload');
            $fileData = $this->shareService->finalizeChunkedUploadToShare(
                $share, $uploadId, $parentId, $encryptedName, $originalSize, $totalChunks, $encryptedKey
            );

            return $this->success([
                'file' => $fileData
            ], 'File uploaded successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 403)->send();
        }
    }

    /**
     * Delete file/folder in shared folder
     */
    public function delete()
    {
        $this->validateJson($this->rules['delete']);

        $token = $this->request->json('token');
        $passwordHash = $this->request->json('password_hash');
        $fileId = $this->request->json('file_id');

        try {
            $share = $this->shareService->validateShareAccess($token, $passwordHash, 'delete');
            $this->shareService->deleteInShare($share, $fileId);

            return $this->success([
                'id' => $fileId
            ], 'Item deleted successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 403)->send();
        }
    }

    /**
     * Rename file/folder in shared folder
     */
    public function rename()
    {
        $this->validateJson($this->rules['rename']);

        $token = $this->request->json('token');
        $passwordHash = $this->request->json('password_hash');
        $fileId = $this->request->json('file_id');
        $newEncryptedName = $this->request->json('new_encrypted_name');

        try {
            $share = $this->shareService->validateShareAccess($token, $passwordHash, 'rename');
            $this->shareService->renameInShare($share, $fileId, $newEncryptedName);

            return $this->success([
                'id' => $fileId
            ], 'Item renamed successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 403)->send();
        }
    }

    /**
     * Move file/folder in shared folder
     */
    public function move()
    {
        $this->validateJson($this->rules['move']);

        $token = $this->request->json('token');
        $passwordHash = $this->request->json('password_hash');
        $fileId = $this->request->json('file_id');
        $newParentId = $this->request->json('new_parent_id', null);
        $newEncryptedKey = $this->request->json('new_encrypted_key', null);

        try {
            $share = $this->shareService->validateShareAccess($token, $passwordHash, 'move');
            $this->shareService->moveInShare($share, $fileId, $newParentId, $newEncryptedKey);

            return $this->success([
                'id' => $fileId
            ], 'Item moved successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 403)->send();
        }
    }

    /**
     * Create folder in shared folder
     */
    public function createFolder()
    {
        $this->validateJson($this->rules['create_folder']);

        $token = $this->request->json('token');
        $passwordHash = $this->request->json('password_hash');
        $parentId = $this->request->json('parent_id');
        $encryptedName = $this->request->json('encrypted_name');
        $encryptedKey = $this->request->json('encrypted_key');

        try {
            $share = $this->shareService->validateShareAccess($token, $passwordHash, 'upload');
            $folderId = $this->shareService->createFolderInShare($share, $parentId, $encryptedName, $encryptedKey);

            return $this->success([
                'folder_id' => $folderId
            ], 'Folder created successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 403)->send();
        }
    }

    /**
     * List user's shares (requires authentication)
     */
    public function listShares()
    {
        $userId = $this->requireAuth();
        $this->validateJson($this->rules['list_shares']);
        $shares = $this->shareService->listUserShares($userId);

        return $this->success([
            'shares' => $shares
        ])->send();
    }

    /**
     * Delete a share (requires authentication)
     */
    public function deleteShare()
    {
        $userId = $this->requireAuth();
        $this->validateJson($this->rules['delete_share']);
        $shareId = $this->request->json('share_id');

        if (!$shareId) {
            return $this->error('Share ID is required', 400)->send();
        }

        try {
            $this->shareService->deleteShare($shareId, $userId);
            return $this->success([
                'id' => $shareId
            ], 'Share deleted successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 403)->send();
        }
    }
}
