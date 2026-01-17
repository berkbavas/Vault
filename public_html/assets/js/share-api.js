/**
 * Share API Client for Vault Drive
 * Handles all HTTP requests for shared content access
 */

const ShareAPI = {
    baseURL: 'api/v1',

    /**
     * Make API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                'Content-Type': options.contentType || 'application/json'
            }
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Share API Error:', error);
            throw error;
        }
    },

    /**
     * Get share info (public - no password required)
     */
    async getShareInfo(token) {
        return await this.request('/share/info.php', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
    },

    /**
     * Verify password and get encrypted key
     */
    async verifyPassword(token, passwordHash) {
        return await this.request('/share/verify.php', {
            method: 'POST',
            body: JSON.stringify({ token, password_hash: passwordHash })
        });
    },

    /**
     * List files in shared folder
     */
    async listFiles(token, passwordHash, parentId = null) {
        return await this.request('/share/list.php', {
            method: 'POST',
            body: JSON.stringify({
                token,
                password_hash: passwordHash,
                parent_id: parentId
            })
        });
    },

    /**
     * Download file from shared folder
     */
    async download(token, passwordHash, fileId) {
        const params = new URLSearchParams({
            token,
            password_hash: passwordHash,
            file_id: fileId
        });
        
        return await fetch(`${this.baseURL}/share/download.php?${params}`, {
            method: 'GET'
        });
    },

    /**
     * Get file size for range-based download
     */
    async getFileSize(token, passwordHash, fileId) {
        const params = new URLSearchParams({
            token,
            password_hash: passwordHash,
            file_id: fileId
        });

        const response = await fetch(`${this.baseURL}/share/download.php?${params}`, {
            method: 'HEAD'
        });

        if (!response.ok) {
            throw new Error('Failed to get file size');
        }

        return parseInt(response.headers.get('Content-Length'), 10);
    },

    /**
     * Download file with range support
     */
    async downloadRange(token, passwordHash, fileId, start, end) {
        const params = new URLSearchParams({
            token,
            password_hash: passwordHash,
            file_id: fileId
        });

        return await fetch(`${this.baseURL}/share/download.php?${params}`, {
            method: 'GET',
            headers: {
                'Range': `bytes=${start}-${end}`
            }
        });
    },

    /**
     * Upload file to shared folder
     */
    async upload(token, passwordHash, file, encryptedName, originalSize, encryptedKey, parentId = null, onProgress = null) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('token', token);
        formData.append('password_hash', passwordHash);
        formData.append('encrypted_name', encryptedName);
        formData.append('original_size', originalSize);
        formData.append('encrypted_key', encryptedKey);
        if (parentId) {
            formData.append('parent_id', parentId);
        }

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    onProgress(e.loaded, e.total);
                }
            });

            xhr.addEventListener('load', () => {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response);
                } catch (e) {
                    reject(new Error('Invalid response from server'));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Upload failed')));
            xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

            xhr.open('POST', `${this.baseURL}/share/upload.php`);
            xhr.send(formData);
        });
    },

    /**
     * Upload a chunk of a file
     */
    async uploadChunk(token, passwordHash, uploadId, chunkIndex, chunkBlob, onProgress = null) {
        const formData = new FormData();
        formData.append('chunk', chunkBlob);
        formData.append('token', token);
        formData.append('password_hash', passwordHash);
        formData.append('upload_id', uploadId);
        formData.append('chunk_index', chunkIndex);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    onProgress(e.loaded, e.total);
                }
            });

            xhr.addEventListener('load', () => {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response);
                } catch (e) {
                    reject(new Error('Invalid response from server'));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Chunk upload failed')));
            xhr.addEventListener('abort', () => reject(new Error('Chunk upload aborted')));

            xhr.open('POST', `${this.baseURL}/share/upload_chunk.php`);
            xhr.send(formData);
        });
    },

    /**
     * Finalize chunked upload
     */
    async finalizeUpload(token, passwordHash, uploadId, encryptedName, originalSize, totalChunks, encryptedKey, parentId = null) {
        return await this.request('/share/finalize_upload.php', {
            method: 'POST',
            body: JSON.stringify({
                token,
                password_hash: passwordHash,
                upload_id: uploadId,
                encrypted_name: encryptedName,
                original_size: originalSize,
                total_chunks: totalChunks,
                encrypted_key: encryptedKey,
                parent_id: parentId
            })
        });
    },

    /**
     * Delete file/folder in shared folder
     */
    async delete(token, passwordHash, fileId) {
        return await this.request('/share/delete.php', {
            method: 'POST',
            body: JSON.stringify({
                token,
                password_hash: passwordHash,
                file_id: fileId
            })
        });
    },

    /**
     * Rename file/folder in shared folder
     */
    async rename(token, passwordHash, fileId, newEncryptedName) {
        return await this.request('/share/rename.php', {
            method: 'POST',
            body: JSON.stringify({
                token,
                password_hash: passwordHash,
                file_id: fileId,
                new_encrypted_name: newEncryptedName
            })
        });
    },

    /**
     * Move file/folder in shared folder
     */
    async move(token, passwordHash, fileId, newParentId = null, newEncryptedKey = null) {
        return await this.request('/share/move.php', {
            method: 'POST',
            body: JSON.stringify({
                token,
                password_hash: passwordHash,
                file_id: fileId,
                new_parent_id: newParentId,
                new_encrypted_key: newEncryptedKey
            })
        });
    },

    /**
     * Create folder in shared folder
     */
    async createFolder(token, passwordHash, encryptedName, encryptedKey, parentId = null) {
        return await this.request('/share/create_folder.php', {
            method: 'POST',
            body: JSON.stringify({
                token,
                password_hash: passwordHash,
                encrypted_name: encryptedName,
                encrypted_key: encryptedKey,
                parent_id: parentId
            })
        });
    }
};
