/**
 * API Client for Vault Drive
 * Handles all HTTP requests to the backend
 */

const API = {
    baseURL: 'api/v1',
    token: null,

    /**
     * Initialize API with token
     */
    init() {
        this.token = sessionStorage.getItem('token');
    },

    /**
     * Set authentication token
     */
    setToken(token) {
        this.token = token;
        sessionStorage.setItem('token', token);
    },

    /**
     * Clear authentication token
     */
    clearToken() {
        this.token = null;
        sessionStorage.removeItem('token');
    },

    /**
     * Get authentication headers
     */
    getHeaders(contentType = 'application/json') {
        const headers = {
            'Content-Type': contentType
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    },

    /**
     * Make API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: this.getHeaders(options.contentType)
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    /**
     * Authentication APIs
     */
    auth: {
        async register(username, clientSalt, kdfSalt, passwordHash, encryptedMasterKey) {
            return await API.request('/user/register.php', {
                method: 'POST',
                body: JSON.stringify({
                    username,
                    client_salt: clientSalt, // hex string
                    kdf_salt: kdfSalt, // hex string
                    password_hash: passwordHash, // hex string
                    encrypted_master_key: encryptedMasterKey
                })
            });
        },

        async getClientSalt(username) {
            return await API.request('/user/get_client_salt.php', {
                method: 'POST',
                body: JSON.stringify({ username })
            });
        },

        async login(username, passwordHash) {
            return await API.request('/user/login.php', {
                method: 'POST',
                body: JSON.stringify({
                    username,
                    password_hash: passwordHash
                })
            });
        },

        async changePassword(currentPasswordHash, newPasswordHash, newClientSalt, newKdfSalt, newEncryptedMasterKey) {
            return await API.request('/user/change_password.php', {
                method: 'POST',
                body: JSON.stringify({
                    current_password_hash: currentPasswordHash, // hex string
                    new_password_hash: newPasswordHash, // hex string
                    new_client_salt: newClientSalt, // hex string
                    new_kdf_salt: newKdfSalt, // hex string
                    new_encrypted_master_key: newEncryptedMasterKey
                })
            });
        },

        async me() {
            return await API.request('/user/me.php', {
                method: 'GET'
            });
        }
    },

    /**
     * File APIs
     */
    files: {
        async list(parentId = null) {
            const params = parentId ? `?parent_id=${parentId}` : '';
            return await API.request(`/file/list.php${params}`, {
                method: 'GET'
            });
        },

        async upload(file, encryptedName, originalSize, encryptedKey, parentId = null, onProgress = null) {
            const formData = new FormData();
            formData.append('file', file);
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
                
                xhr.open('POST', `${API.baseURL}/file/upload.php`);
                xhr.setRequestHeader('Authorization', `Bearer ${API.token}`);
                xhr.send(formData);
            });
        },

        async download(fileId) {
            return await fetch(`${API.baseURL}/file/download.php?id=${fileId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${API.token}`
                }
            });
        },

        /**
         * Download file with range support
         * @param {number} fileId - File ID
         * @param {number} start - Start byte position
         * @param {number} end - End byte position
         */
        async downloadRange(fileId, start, end) {
            return await fetch(`${API.baseURL}/file/download.php?id=${fileId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${API.token}`,
                    'Range': `bytes=${start}-${end}`
                }
            });
        },

        /**
         * Get file size for range-based download
         */
        async getFileSize(fileId) {
            const response = await fetch(`${API.baseURL}/file/download.php?id=${fileId}`, {
                method: 'HEAD',
                headers: {
                    'Authorization': `Bearer ${API.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to get file size');
            }
            
            return parseInt(response.headers.get('Content-Length'), 10);
        },

        async delete(fileId) {
            return await API.request('/file/delete.php', {
                method: 'POST',
                body: JSON.stringify({ id: fileId })
            });
        },

        async deleteMultiple(fileIds) {
            return await API.request('/file/delete_multiple.php', {
                method: 'POST',
                body: JSON.stringify({ ids: fileIds })
            });
        },

        async rename(id, newEncryptedName) {
            return await API.request('/file/rename.php', {
                method: 'POST',
                body: JSON.stringify({ 
                    id: id,
                    new_encrypted_name: newEncryptedName
                })
            });
        },

        async move(fileId, newParentId = null, newEncryptedKey = null) {
            const body = { 
                id: fileId,
                new_parent_id: newParentId
            };
            
            if (newEncryptedKey !== null) {
                body.new_encrypted_key = newEncryptedKey;
            }
            
            return await API.request('/file/move.php', {
                method: 'POST',
                body: JSON.stringify(body)
            });
        },

        async createFolder(encryptedName, encryptedKey, parentId = null) {
    
            return await API.request('/file/create_folder.php', {
                method: 'POST',
                body: JSON.stringify({ 
                    encrypted_name: encryptedName,
                    encrypted_key: encryptedKey,
                    parent_id: parentId
                })
            });
        },

        /**
         * Upload a chunk of a file
         */
        async uploadChunk(uploadId, chunkIndex, chunkBlob, onProgress = null) {
            const formData = new FormData();
            formData.append('chunk', chunkBlob);
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
                
                xhr.open('POST', `${API.baseURL}/file/upload_chunk.php`);
                xhr.setRequestHeader('Authorization', `Bearer ${API.token}`);
                xhr.send(formData);
            });
        },

        /**
         * Finalize chunked upload
         */
        async finalizeUpload(uploadId, encryptedName, originalSize, totalChunks, encryptedKey, parentId = null) {
            return await API.request('/file/finalize_upload.php', {
                method: 'POST',
                body: JSON.stringify({
                    upload_id: uploadId,
                    encrypted_name: encryptedName,
                    original_size: originalSize,
                    total_chunks: totalChunks,
                    encrypted_key: encryptedKey,
                    parent_id: parentId
                })
            });
        }
    },

    admin : {
        async listUsers() {
            return await API.request('/admin/list_users.php', {
                method: 'GET'
            });
        },

        async updateQuota(userId, newQuota) {
            return await API.request('/admin/update_quota.php', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId,
                    quota: newQuota
                })
            });
        },
        
        async deleteUser(userId) {
            return await API.request('/admin/delete_user.php', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId
                })
            });
        }
    }
};

// Initialize on load
API.init();