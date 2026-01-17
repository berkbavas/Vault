<?php

namespace App\Controllers;

use App\Services\StorageService;
use App\Http\JsonResponse;
use Exception;

class StorageController extends Controller
{
    private $storageService;
    private $rules = [
        'list_files' => [
            'parent_id' => 'nullable|integer',
        ],

        'create_folder' => [
            'parent_id' => 'nullable|integer',
            'encrypted_name' => 'required|string|max:510|hex',
            'encrypted_key' => 'required|string|min:120|max:120|hex',
        ],

        'rename' => [
            'id' => 'required|integer',
            'new_encrypted_name' => 'required|string|max:510|hex',
        ],

        'move' => [
            'id' => 'required|integer',
            'new_parent_id' => 'nullable|integer',
            'new_encrypted_key' => 'required|string|min:120|max:120|hex',
        ],

        'upload' => [
            'parent_id' => 'nullable|integer',
            'encrypted_name' => 'required|string|max:510|hex',
            'original_size' => 'required|string',
            'encrypted_key' => 'required|string|min:120|max:120|hex',
        ],

        'delete' => [
            'id' => 'required|integer',
        ],

        'delete_multiple' => [
            'ids' => 'required|array',
        ],

        'download' => [
            'id' => 'required|string',
        ],

        'upload_chunk' => [
            'upload_id' => 'required|string|max:64',
            'chunk_index' => 'required|string',
        ],

        'finalize_upload' => [
            'upload_id' => 'required|string|max:64',
            'encrypted_name' => 'required|string|max:510|hex',
            'parent_id' => 'nullable',
            'original_size' => 'required|integer|min:0',
            'total_chunks' => 'required|integer|min:1',
            'encrypted_key' => 'required|string|min:120|max:120|hex'
        ],

        'share_file' => [
            'file_id' => 'required|integer',
            'encrypted_key' => 'required|string|min:120|max:120|hex'
        ],
    ];

    public function __construct()
    {
        parent::__construct();
        $this->storageService = new StorageService($this->pdo);
    }

    public function list($userId)
    {
        $this->validateJson($this->rules['list_files']);
        $parentId = $this->request->json('parent_id', null);
        $files = $this->storageService->list($userId, $parentId);

        // Fetch encrypted_key for the folder if parent_id is provided
        $folderKey = null;
        if ($parentId !== null) {
            $folderKey = $this->storageService->getFolderKey($userId, $parentId);
        }

        return $this->success([
            'files' => $files,
            'parent_id' => $parentId,
            'encrypted_key' => $folderKey
        ])->send();
    }

    public function createFolder($userId)
    {
        $this->validateJson($this->rules['create_folder']);
        $parentId = $this->request->json('parent_id');
        $encryptedName = $this->request->json('encrypted_name');
        $encryptedKey = $this->request->json('encrypted_key');
        $folderId = $this->storageService->createFolder($userId, $parentId, $encryptedName, $encryptedKey);

        return $this->success([
            'folder_id' => $folderId
        ], 'Folder created successfully')->send();
    }

    public function rename($userId)
    {
        $this->validateJson($this->rules['rename']);
        $fileId = $this->request->json('id');
        $newEncryptedName = $this->request->json('new_encrypted_name');
        $this->storageService->rename($userId, $fileId, $newEncryptedName);

        return $this->success([
            'id' => $fileId
        ], 'Item renamed successfully')->send();
    }

    public function move($userId)
    {
        $this->validateJson($this->rules['move']);
        $fileId = $this->request->json('id');
        $newParentId = $this->request->json('new_parent_id', null);
        $newEncryptedKey = $this->request->json('new_encrypted_key', null);

        $this->storageService->move($userId, $fileId, $newParentId, $newEncryptedKey);

        return $this->success([
            'id' => $fileId
        ], 'Item moved successfully')->send();
    }

    public function delete($userId)
    {
        $this->validateJson($this->rules['delete']);
        $fileId = $this->request->json('id');
        $this->storageService->delete($userId, $fileId);
        return $this->success([
            'id' => $fileId
        ], 'Item deleted successfully')->send();
    }

    public function deleteMultiple($userId)
    {
        $this->validateJson($this->rules['delete_multiple']);
        $fileIds = $this->request->json('ids');
        $this->storageService->deleteMultiple($userId, $fileIds);

        return $this->success([
            'ids' => $fileIds
        ], 'Items deleted successfully')->send();
    }

    public function upload($userId)
    {
        $this->validateFile();
        $this->validate($this->rules['upload']); // To validate parent_id if provided

        $file = $this->request->file('file');
        $parentId = $this->request->post('parent_id', null);
        $encryptedName = $this->request->post('encrypted_name', '');
        $originalSize = $this->request->post('original_size', 0);
        $encryptedKey = $this->request->post('encrypted_key');

        $fileData = $this->storageService->upload($userId, $file, $parentId, $encryptedName, $originalSize, $encryptedKey);

        return $this->success([
            'file' => $fileData
        ], 'File uploaded successfully')->send();
    }

    public function download($userId)
    {
        $this->validate($this->rules['download']);
        $fileId = $this->request->query('id');
        $fileData = $this->storageService->getFileForDownload($userId, $fileId);

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
            // Parse Range header (e.g., "bytes=0-1023")
            if (preg_match('/bytes=(\d+)-(\d*)/', $rangeHeader, $matches)) {
                $start = intval($matches[1]);
                $end = !empty($matches[2]) ? intval($matches[2]) : $fileSize - 1;
                $isRangeRequest = true;
            }
        }

        // Validate range
        if ($start > $end || $start < 0 || $end >= $fileSize) {
            header('HTTP/1.1 416 Requested Range Not Satisfiable');
            header("Content-Range: bytes */$fileSize");
            exit;
        }

        $contentLength = $end - $start + 1;

        // Set appropriate status code
        if ($isRangeRequest) {
            header('HTTP/1.1 206 Partial Content');
            header("Content-Range: bytes $start-$end/$fileSize");
        } else {
            header('HTTP/1.1 200 OK');
        }

        // Set headers for download
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $fileData['encrypted_name'] . '"');
        header('Content-Length: ' . $contentLength);
        header('Accept-Ranges: bytes');
        header('Cache-Control: no-cache, must-revalidate');
        header('Pragma: public');

        // Disable output buffering
        if (ob_get_level()) {
            ob_end_clean();
        }

        // Open file for reading
        $handle = fopen($filePath, 'rb');
        if ($handle === false) {
            throw new Exception('Cannot open file for reading');
        }

        // Seek to start position if range request
        if ($start > 0) {
            fseek($handle, $start);
        }

        // Stream file in chunks (8MB chunks to save memory)
        $chunkSize = 8 * 1024 * 1024; // 8MB chunks
        $bytesRemaining = $contentLength;

        while (!feof($handle) && $bytesRemaining > 0) {
            $readSize = min($chunkSize, $bytesRemaining);
            $chunk = fread($handle, $readSize);

            if ($chunk === false) {
                break;
            }

            echo $chunk;
            $bytesRemaining -= strlen($chunk);

            // Flush output buffers to send data immediately
            if (ob_get_level()) {
                ob_flush();
            }
            flush();

            // Check if client disconnected
            if (connection_status() != CONNECTION_NORMAL) {
                break;
            }
        }

        fclose($handle);
    }

    /**
     * Upload a chunk of a file
     */
    public function uploadChunk($userId)
    {
        $this->validateChunk();
        $this->validate($this->rules['upload_chunk']);
        $uploadId = $this->request->post('upload_id');
        $chunkIndex = $this->request->post('chunk_index');

        // Read chunk data
        $chunkData = file_get_contents($_FILES['chunk']['tmp_name']);

        $result = $this->storageService->uploadChunk($userId, $uploadId, $chunkIndex, $chunkData);

        return $this->success($result, 'Chunk uploaded successfully')->send();
    }

    /**
     * Finalize chunked upload
     */
    public function finalizeUpload($userId)
    {
        $this->validateJson($this->rules['finalize_upload']);

        $uploadId = $this->request->json('upload_id');
        $encryptedName = $this->request->json('encrypted_name');
        $parentId = $this->request->json('parent_id');
        $originalSize = $this->request->json('original_size', 0);
        $totalChunks = $this->request->json('total_chunks');
        $encryptedKey = $this->request->json('encrypted_key');

        $fileData = $this->storageService->finalizeChunkedUpload(
            $userId,
            $uploadId,
            $parentId,
            $encryptedName,
            $originalSize,
            $totalChunks,
            $encryptedKey
        );

        return $this->success([
            'file' => $fileData
        ], 'File uploaded successfully')->send();
    }

    public function share($userId)
    {
        $this->validateJson($this->rules['share_file']);

        $fileId = $this->request->json('file_id');
        $encryptedKey = $this->request->json('encrypted_key');
        $expiresAt = $this->request->json('expires_at', null);

        $file = $this->storageService->getFileById($fileId, $userId);

        if ($file === null) {
            return $this->error('File not found or access denied', 404)->send();
        }

        $token = $this->storageService->createShare($fileId, $encryptedKey, $expiresAt);

        return $this->success([
            'token' => $token
        ], 'File shared successfully')->send();
    }
}
