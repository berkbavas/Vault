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

            $this->validate(['encrypted_name' => 'required|max:255']);

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
            $this->validate([
                'id' => 'required',
                'new_encrypted_name' => 'required|max:255'
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
            $this->validate([
                'id' => 'required'
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

            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                return $this->error('File upload failed', 400)->send();
            }

            $file = $_FILES['file'];
            $parentId = $_POST['parent_id'] ?? null;
            $encryptedName = $_POST['encrypted_name'] ?? '';
            $originalSize = $_POST['original_size'] ?? 0;

            if (empty($encryptedName)) {
                return $this->error('Encrypted filename is required', 400)->send();
            }

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
            $this->validate(['id' => 'required']);

            $fileId = $this->request->json('id');
            $deleted = $this->storageService->delete($userId, $fileId);

            return $this->success([
                'deleted' => $deleted
            ], 'Item deleted successfully')->send();
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 500)->send();
        }
    }

    public function download()
    {
        try {
            $userId = $this->requireAuth();
            $fileId = $this->request->query('id');

            if (!$fileId) {
                throw new Exception('File ID is required');
            }

            $fileData = $this->storageService->getFileForDownload($userId, $fileId);

            // Set headers for download
            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="' . $fileData['encrypted_name'] . '"');
            header('Content-Length: ' . $fileData['size']);
            header('Cache-Control: no-cache, must-revalidate');
            header('Pragma: public');

            // Read and output file
            readfile($fileData['path']);
            exit;
        } catch (Exception $e) {
            return $this->error($e->getMessage(), 404)->send();
        }
    }
}
