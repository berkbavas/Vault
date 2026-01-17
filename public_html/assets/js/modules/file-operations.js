/**
 * File Operations Module
 * Handles file upload, download, delete, and related operations
 */

const FileOperations = {
    CHUNK_SIZE: 10 * 1024 * 1024, // 10MB chunks

    /**
     * Handle file upload with chunked support
     * Files are encrypted with their parent folder's key (or masterKey if in root)
     */
    async handleFileUpload(files, masterKey, currentFolderId, getParentKeyFn) {
        if (!files || files.length === 0) return { success: true, count: 0 };

        // Calculate total size of all files
        let totalSize = 0;
        for (const file of files) {
            totalSize += file.size;
        }

        // Check storage quota before starting upload
        const quotaCheck = App.checkStorageQuota(totalSize);
        if (!quotaCheck.hasSpace) {
            const availableFormatted = App.formatBytes(quotaCheck.available);
            const requiredFormatted = App.formatBytes(quotaCheck.required);
            const usedFormatted = App.formatBytes(quotaCheck.used);
            const quotaFormatted = App.formatBytes(quotaCheck.quota);
            
            showToast(
                `Storage quota exceeded! Required: ${requiredFormatted}, Available: ${availableFormatted} (Used: ${usedFormatted} / ${quotaFormatted})`,
                'error'
            );
            
            return {
                success: false,
                quotaExceeded: true,
                message: `Not enough storage space. Required: ${requiredFormatted}, Available: ${availableFormatted}`
            };
        }

        const totalFiles = files.length;
        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Check if cancelled
            if (App.uploadProgressState.cancelled) {
                return {
                    success: false,
                    cancelled: true,
                    successCount,
                    failedCount,
                    message: `Upload cancelled. ${successCount} of ${totalFiles} files uploaded.`
                };
            }

            showLoading(`Encrypting ${file.name}...`);

            try {
                // Get parent key (master key if root, or current folder's key)
                const parentKey = await getParentKeyFn();

                // Generate new key for this file
                const fileKey = CryptoUtils.generateItemKey();

                // Encrypt file key with parent key
                const encryptedFileKey = await CryptoUtils.encryptItemKey(fileKey, parentKey);

                // Encrypt file in chunks with parent key (folder's key or masterKey for root)
                const encryptedBlob = await CryptoUtils.encryptFileInChunks(
                    file,
                    parentKey,
                    (processed, total) => {
                        const percent = Math.round((processed / total) * 100);
                        updateLoadingText(`Encrypting ${file.name}: ${percent}%`);
                    }
                );

                // Check if cancelled after encryption
                if (App.uploadProgressState.cancelled) {
                    hideLoading();
                    return {
                        success: false,
                        cancelled: true,
                        successCount,
                        failedCount,
                        message: `Upload cancelled. ${successCount} of ${totalFiles} files uploaded.`
                    };
                }

                // Encrypt filename with parent key
                const encryptedName = await CryptoUtils.encryptFilename(file.name, parentKey);

                hideLoading();
                const USE_CHUNKED = encryptedBlob.size > this.CHUNK_SIZE;

                // Show progress bar with file count
                showProgress('upload', file.name, encryptedBlob.size, i + 1, totalFiles);

                if (USE_CHUNKED) {
                    // Chunked upload for large files
                    const response = await this.uploadFileInChunks(
                        encryptedBlob,
                        encryptedName,
                        file.size,
                        encryptedFileKey,
                        currentFolderId,
                        this.CHUNK_SIZE,
                        file.name
                    );

                    if (!response.success) {
                        throw new Error(response.message || `Failed to upload ${file.name}`);
                    }
                } else {
                    // Standard upload for small files
                    const response = await API.files.upload(
                        encryptedBlob,
                        encryptedName,
                        file.size,
                        encryptedFileKey,
                        currentFolderId,
                        (loaded, total) => {
                            if (!App.uploadProgressState.cancelled) {
                                updateProgress('upload', loaded, total);
                            }
                        }
                    );

                    if (!response.success) {
                        throw new Error(response.message || `Failed to upload ${file.name}`);
                    }
                }

                // Check if cancelled after upload
                if (App.uploadProgressState.cancelled) {
                    return {
                        success: false,
                        cancelled: true,
                        successCount,
                        failedCount,
                        message: `Upload cancelled. ${successCount} of ${totalFiles} files uploaded.`
                    };
                }

                successCount++;
                
                // Update local storage tracking after successful upload
                App.storageUsed += encryptedBlob.size;

                // Show completion briefly if not the last file
                if (i < files.length - 1) {
                    document.getElementById('upload-progress-subtitle').textContent = `Complete! (${i + 1}/${totalFiles})`;
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    completeProgress('upload');
                }

                showToast(`${file.name} uploaded successfully!`, 'success');
            } catch (fileError) {
                failedCount++;
                console.error(`Failed to upload ${file.name}:`, fileError);
                showToast(`Failed to upload ${file.name}: ${fileError.message}`, 'error');
            }
        }

        return { success: true, successCount, failedCount, totalFiles };
    },

    /**
     * Upload file in chunks
     */
    async uploadFileInChunks(encryptedBlob, encryptedFilename, originalSize, encryptedFileKey, parentId, chunkSize) {
        const uploadId = 'upload_' + Date.now() + '_' + Math.random().toString(36);
        const totalSize = encryptedBlob.size;
        const totalChunks = Math.ceil(totalSize / chunkSize);
        let uploadedBytes = 0;

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            // Check if cancelled
            if (App.uploadProgressState.cancelled) {
                throw new Error('Upload cancelled by user');
            }

            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, totalSize);
            const chunkBlob = encryptedBlob.slice(start, end);

            const response = await API.files.uploadChunk(
                uploadId,
                chunkIndex,
                chunkBlob,
                (loaded, total) => {
                    if (!App.uploadProgressState.cancelled) {
                        updateProgress('upload', uploadedBytes + loaded, totalSize);
                    }
                }
            );

            if (!response.success) {
                throw new Error(response.message || 'Chunk upload failed');
            }

            uploadedBytes += chunkBlob.size;
            updateProgress('upload', uploadedBytes, totalSize);
        }

        // Finalize upload
        document.getElementById('upload-progress-subtitle').textContent = 'Finalizing...';
        const finalizeResponse = await API.files.finalizeUpload(
            uploadId,
            encryptedFilename,
            originalSize,
            totalChunks,
            encryptedFileKey,
            parentId
        );

        return finalizeResponse;
    },

    /**
     * Download file with range-based parallel downloading
     */
    async downloadFile(fileId, filename, masterKey) {
        // Get file size first
        const fileSize = await API.files.getFileSize(fileId);

        // Show progress bar
        showProgress('download', filename, fileSize);

        // Use parallel range-based download for files larger than 5MB
        const USE_RANGE_DOWNLOAD = fileSize > 5 * 1024 * 1024;

        let encryptedBlob;

        if (USE_RANGE_DOWNLOAD) {
            encryptedBlob = await this.downloadFileInRanges(fileId, fileSize, filename);
        } else {
            // Standard download for small files
            const response = await API.files.download(fileId);
            if (!response.ok) {
                throw new Error('Download failed');
            }

            // Track download progress
            const contentLength = response.headers.get('Content-Length');
            const total = parseInt(contentLength, 10);
            let loaded = 0;

            const reader = response.body.getReader();
            const chunks = [];

            while (true) {
                // Check if cancelled
                if (App.downloadProgressState.cancelled) {
                    reader.cancel();
                    throw new Error('Download cancelled by user');
                }

                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                loaded += value.length;

                if (total && !App.downloadProgressState.cancelled) {
                    updateProgress('download', loaded, total);
                }
            }

            encryptedBlob = new Blob(chunks);
        }

        // Check if cancelled before decryption
        if (App.downloadProgressState.cancelled) {
            throw new Error('Download cancelled by user');
        }

        document.getElementById('download-progress-subtitle').textContent = 'Decrypting...';

        // Try to detect format: new chunked format has size markers after main IV
        let decryptedData;

        try {
            // Try new chunked format first
            decryptedData = await CryptoUtils.decryptFileInChunks(
                encryptedBlob,
                masterKey,
                (processed, total) => {
                    // Show decryption progress
                }
            );
        } catch (error) {
            console.log('Trying legacy decryption format...');
            // Fall back to old format
            const encryptedData = await encryptedBlob.arrayBuffer();
            decryptedData = await CryptoUtils.decryptFile(encryptedData, masterKey);
        }

        // Create blob and download
        const blob = new Blob([decryptedData]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        completeProgress('download');
    },

    /**
     * Download file in parallel ranges with retry support
     */
    async downloadFileInRanges(fileId, fileSize, filename) {
        const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk
        const MAX_PARALLEL = 3; // Download 3 chunks in parallel
        const MAX_RETRIES = 3;

        const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
        const chunks = new Array(totalChunks);
        let downloadedBytes = 0;

        // Download chunk with retry logic
        const downloadChunk = async (chunkIndex, retries = 0) => {
            // Check if cancelled
            if (App.downloadProgressState.cancelled) {
                throw new Error('Download cancelled by user');
            }

            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE - 1, fileSize - 1);

            try {
                const response = await API.files.downloadRange(fileId, start, end);

                if (!response.ok) {
                    throw new Error(`Chunk ${chunkIndex} download failed: ${response.status}`);
                }

                const chunkData = await response.arrayBuffer();
                chunks[chunkIndex] = new Uint8Array(chunkData);

                downloadedBytes += chunkData.byteLength;
                if (!App.downloadProgressState.cancelled) {
                    updateProgress('download', downloadedBytes, fileSize);
                }

                return true;
            } catch (error) {
                if (retries < MAX_RETRIES && !App.downloadProgressState.cancelled) {
                    console.log(`Retrying chunk ${chunkIndex}, attempt ${retries + 1}/${MAX_RETRIES}`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
                    return downloadChunk(chunkIndex, retries + 1);
                }
                throw error;
            }
        };

        // Download chunks in parallel batches
        for (let i = 0; i < totalChunks; i += MAX_PARALLEL) {
            const batch = [];
            for (let j = 0; j < MAX_PARALLEL && (i + j) < totalChunks; j++) {
                batch.push(downloadChunk(i + j));
            }
            await Promise.all(batch);
        }

        // Combine all chunks into a single blob
        return new Blob(chunks);
    },

    /**
     * Delete file/folder
     */
    async deleteFile(fileId, filename) {
        const response = await API.files.delete(fileId);
        if (!response.success) {
            throw new Error(response.message || 'Delete failed');
        }
        return true;
    },

    /**
     * Delete multiple files
     */
    async deleteMultipleFiles(fileIds) {
        const response = await API.files.deleteMultiple(fileIds);
        if (!response.success) {
            throw new Error(response.message || 'Bulk delete failed');
        }
        return response;
    },

    /**
     * Rename file/folder
     * @param {number} fileId - ID of the file to rename
     * @param {string} newName - New filename
     * @param {CryptoKey} parentKey - Parent folder's key (or masterKey for root items)
     */
    async renameFile(fileId, newName, parentKey) {
        // Encrypt new name with parent key
        const encryptedName = await CryptoUtils.encryptFilename(newName, parentKey);

        const response = await API.files.rename(fileId, encryptedName);
        if (!response.success) {
            throw new Error(response.message || 'Rename failed');
        }
        return true;
    }
};
