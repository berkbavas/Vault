<?php

namespace App\Controllers;

use App\Services\StorageService;
use App\Http\JsonResponse;
use Exception;

class StorageController extends Controller
{
    private $storageService;

    public function __construct()
    {
        parent::__construct();
        $this->storageService = new StorageService($this->pdo);
    }

    /**
     * List files in a folder
     */
    public function list()
    {
        try {
            $userId = $this->requireAuth();

            $this->validate([
                'parent_id' => 'nullable|integer'
            ]);

            $parentId = $this->request->query('parent_id', null);

            $files = $this->storageService->list($userId, $parentId);

            return $this->success([
                'files' => $files,
                'parent_id' => $parentId
            ])->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 500)->send();
        }
    }

    public function createFolder()
    {
        try {
            $userId = $this->requireAuth();

            $this->validateJson([
                'parent_id' => 'nullable|integer',
                'encrypted_name' => 'required|string|max:255'
            ]);

            $parentId = $this->request->json('parent_id');
            $encryptedName = $this->request->json('encrypted_name');

            $folderId = $this->storageService->createFolder($userId, $parentId, $encryptedName);

            return $this->success([
                'folder_id' => $folderId
            ], 'Folder created successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 500)->send();
        }
    }

    /**
     * Rename a file or folder
     */
    public function rename()
    {
        try {
            $userId = $this->requireAuth();
            $this->validateJson([
                'id' => 'required|integer',
                'new_encrypted_name' => 'required|string|max:255'
            ]);

            $fileId = $this->request->json('id');
            $newEncryptedName = $this->request->json('new_encrypted_name');
            $item = $this->storageService->rename($userId, $fileId, $newEncryptedName);

            return $this->success([
                'item' => $item
            ], 'Item renamed successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 500)->send();
        }
    }

    public function move()
    {
        try {
            $userId = $this->requireAuth();
            
            $this->validateJson([
                'id' => 'required|integer',
                'new_parent_id' => 'nullable|integer'
            ]);

            $fileId = $this->request->json('id');
            $newParentId = $this->request->json('new_parent_id', null);

            $moved = $this->storageService->move($userId, $fileId, $newParentId);

            return $this->success([
                'moved' => $moved
            ], 'Item moved successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 500)->send();
        }
    }

    public function upload()
    {
        try {
            $userId = $this->requireAuth();

            $this->validateFile();
            $this->validate([
                'encrypted_name' => 'required|string|max:255',
                'original_size' => 'required|integer'
            ]);

            $file = $_FILES['file'];
            $parentId = $this->request->post('parent_id', null);
            $encryptedName = $this->request->post('encrypted_name', '');
            $originalSize = $this->request->post('original_size', 0);

            $fileData = $this->storageService->upload($userId, $file, $parentId, $encryptedName, $originalSize);

            return $this->success([
                'file' => $fileData
            ], 'File uploaded successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 500)->send();
        }
    }

    public function delete()
    {
        try {
            $userId = $this->requireAuth();

            $this->validateJson(['id' => 'required|integer']);

            $fileId = $this->request->json('id');
            $deleted = $this->storageService->delete($userId, $fileId);

            return $this->success([
                'deleted' => $deleted
            ], 'Item deleted successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 500)->send();
        }
    }

    public function deleteMultiple()
    {
        try {
            $userId = $this->requireAuth();

            $this->validateJson(['ids' => 'required|array']);

            $fileIds = $this->request->json('ids');
            $deleted = $this->storageService->deleteMultiple($userId, $fileIds);

            return $this->success([
                'deleted' => $deleted
            ], 'Items deleted successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 500)->send();
        }
    }

    public function download()
    {
        try {
            $userId = $this->requireAuth();

            $this->validate(['id' => 'required|integer']);

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
            exit;
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 404)->send();
        }
    }

    /**
     * Upload a chunk of a file
     */
    public function uploadChunk()
    {
        try {
            $userId = $this->requireAuth();

            $this->validateChunk();

            $this->validate([
                'upload_id' => 'required|string',
                'chunk_index' => 'nullable|integer'
            ]);

            $uploadId = $this->request->post('upload_id');
            $chunkIndex = $this->request->post('chunk_index');

            // Read chunk data
            $chunkData = file_get_contents($_FILES['chunk']['tmp_name']);

            $result = $this->storageService->uploadChunk($userId, $uploadId, $chunkIndex, $chunkData);

            return $this->success($result, 'Chunk uploaded successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 500)->send();
        }
    }

    /**
     * Finalize chunked upload
     */
    public function finalizeUpload()
    {
        try {
            $userId = $this->requireAuth();

            $this->validateJson([
                'upload_id' => 'required|string',
                'encrypted_name' => 'required|string|max:255',
                'parent_id' => 'nullable',
                'original_size' => 'required|integer',
                'total_chunks' => 'required|integer'
            ]);

            $uploadId = $this->request->json('upload_id');
            $encryptedName = $this->request->json('encrypted_name');
            $parentId = $this->request->json('parent_id');
            $originalSize = $this->request->json('original_size', 0);
            $totalChunks = $this->request->json('total_chunks');

            $fileData = $this->storageService->finalizeChunkedUpload(
                $userId,
                $uploadId,
                $parentId,
                $encryptedName,
                $originalSize,
                $totalChunks
            );

            return $this->success([
                'file' => $fileData
            ], 'File uploaded successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 500)->send();
        }
    }
}
