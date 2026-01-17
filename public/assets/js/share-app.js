/**
 * Share App - Shared Content Access Application
 * Provides encrypted access to shared files and folders
 */

const ShareApp = {
    // State
    token: null,
    passwordHash: null,
    shareKey: null, // The decrypted share key (used as master key for this share)
    shareInfo: null,
    shareFileId: null,
    currentFolderId: null,
    currentFolder: null,
    files: [],
    folderHistory: [],
    selectedItems: new Set(),
    folderKeyCache: new Map(),
    selectedFileForRename: null,
    selectedFileForMove: null,

    CHUNK_SIZE: 10 * 1024 * 1024, // 10MB chunks

    uploadProgressState: {
        isActive: false,
        startTime: null,
        lastUpdate: null,
        loaded: 0,
        total: 0,
        speed: 0,
        filename: null,
        cancelled: false,
        currentFile: 0,
        totalFiles: 0
    },
    downloadProgressState: {
        isActive: false,
        startTime: null,
        lastUpdate: null,
        loaded: 0,
        total: 0,
        speed: 0,
        filename: null,
        cancelled: false,
        currentFile: 0,
        totalFiles: 0
    },

    /**
     * Initialize the share app
     */
    async init() {
        showLoading('Loading share...');

        try {
            // Get token from URL
            const urlParams = new URLSearchParams(window.location.search);
            this.token = urlParams.get('token');

            if (!this.token) {
                this.showError('Invalid Share Link', 'No share token provided in the URL.');
                hideLoading();
                return;
            }

            // Get share info
            const response = await ShareAPI.getShareInfo(this.token);

            if (!response.success) {
                this.showError('Share Not Found', response.message || 'This share link may be invalid or expired.');
                hideLoading();
                return;
            }

            this.shareInfo = response.data;
            this.setupPasswordForm();
            this.setupEventListeners();
            hideLoading();

        } catch (error) {
            console.error('Init error:', error);
            this.showError('Error', 'Failed to load share information.');
            hideLoading();
        }
    },

    /**
     * Show error state
     */
    showError(title, message) {
        document.getElementById('password-form-container').classList.add('hidden');
        document.getElementById('error-container').classList.remove('hidden');
        document.getElementById('error-title').textContent = title;
        document.getElementById('error-message').textContent = message;
    },

    /**
     * Setup password form
     */
    setupPasswordForm() {
        document.getElementById('password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handlePasswordSubmit();
        });
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Upload files
        document.getElementById('upload-btn')?.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        document.getElementById('file-input')?.addEventListener('change', async (e) => {
            await this.handleFileUpload(e.target.files);
            e.target.value = '';
        });

        // New folder
        document.getElementById('new-folder-btn')?.addEventListener('click', () => {
            this.showNewFolderModal();
        });

        document.getElementById('new-folder-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleCreateFolder();
        });

        // Rename form
        document.getElementById('rename-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRename();
        });

        // Bulk delete
        document.getElementById('bulk-delete-btn')?.addEventListener('click', async () => {
            await this.deleteSelectedFiles();
        });

        // Single file download
        document.getElementById('download-single-file-btn')?.addEventListener('click', async () => {
            await this.downloadSingleFile();
        });
    },

    /**
     * Handle password submission
     */
    async handlePasswordSubmit() {
        const password = document.getElementById('share-password').value;

        if (!password) {
            showToast('Please enter a password', 'error');
            return;
        }

        try {
            showLoading('Verifying password...');

            // Derive password hash using the share's salt
            const passwordSaltBuffer = CryptoUtils.hexToArrayBuffer(this.shareInfo.password_salt);
            this.passwordHash = await CryptoUtils.hashPassword(password, new Uint8Array(passwordSaltBuffer));

            // Verify password with server
            const response = await ShareAPI.verifyPassword(this.token, this.passwordHash);

            if (!response.success) {
                showToast(response.message || 'Invalid password', 'error');
                hideLoading();
                return;
            }

            // Derive the key derivation key from password
            updateLoadingText('Deriving encryption key...');
            const kdfSaltBuffer = CryptoUtils.hexToArrayBuffer(this.shareInfo.kdf_salt);
            const sharePasswordKey = await CryptoUtils.deriveKey(password, new Uint8Array(kdfSaltBuffer));

            // Decrypt the share key
            updateLoadingText('Decrypting share key...');
            const shareKeyHex = await CryptoUtils.decryptMasterKey(response.data.encrypted_key, sharePasswordKey);
            this.shareKey = await CryptoUtils.importMasterKey(shareKeyHex);

            // Store share data
            this.shareFileId = response.data.file_id;
            this.shareInfo = { ...this.shareInfo, ...response.data };

            // Cache the share folder key
            this.folderKeyCache.set(this.shareFileId, this.shareKey);

            // Show the app
            updateLoadingText('Loading files...');

            if (this.shareInfo.item_type === 'folder') {
                await this.loadFiles();
                this.showApp();
            } else {
                // Single file share - show download view
                this.showSingleFileView();
            }

            hideLoading();
            showToast('Access granted!', 'success');

        } catch (error) {
            console.error('Password verification error:', error);
            showToast('Failed to verify password: ' + error.message, 'error');
            hideLoading();
        }
    },

    /**
     * Show single file download view
     */
    async showSingleFileView() {
        document.getElementById('password-container').classList.add('hidden');
        document.getElementById('share-app-container').classList.remove('hidden');

        // Hide folder-related UI
        document.querySelector('.table-wrap').classList.add('hidden');
        document.getElementById('file-cards-container').classList.add('hidden');
        document.getElementById('empty-state').classList.add('hidden');

        // Decrypt and show file name
        try {
            const decryptedName = await CryptoUtils.decryptFilename(this.shareInfo.encrypted_name, this.shareKey);
            document.getElementById('single-file-name').textContent = decryptedName;
            document.getElementById('single-file-view').classList.remove('hidden');
            document.getElementById('content-title').textContent = 'Shared File';
        } catch (e) {
            document.getElementById('single-file-name').textContent = 'Encrypted File';
        }

        this.updateShareInfo();
        this.updatePermissionsUI();
    },

    /**
     * Download single shared file
     */
    async downloadSingleFile() {
        try {
            const decryptedName = await CryptoUtils.decryptFilename(this.shareInfo.encrypted_name, this.shareKey);
            await this.downloadFile(this.shareFileId, decryptedName);
        } catch (error) {
            console.error('Download error:', error);
            showToast('Download failed: ' + error.message, 'error');
        }
    },

    /**
     * Show the main app interface
     */
    showApp() {
        document.getElementById('password-container').classList.add('hidden');
        document.getElementById('share-app-container').classList.remove('hidden');
        document.getElementById('single-file-view').classList.add('hidden');

        this.updateShareInfo();
        this.updatePermissionsUI();
        this.updateBreadcrumb();
    },

    /**
     * Update share info display
     */
    updateShareInfo() {
        const typeEl = document.getElementById('share-type');
        const expiresEl = document.getElementById('share-expires');

        if (typeEl) {
            typeEl.textContent = this.shareInfo.item_type === 'folder' ? 'Folder' : 'File';
        }

        if (expiresEl) {
            if (this.shareInfo.expires_at) {
                expiresEl.textContent = formatDate(this.shareInfo.expires_at);
            } else {
                expiresEl.textContent = 'Never';
            }
        }
    },

    /**
     * Update permissions UI
     */
    updatePermissionsUI() {
        const perms = {
            'perm-download': true, // Always allowed
            'perm-upload': this.shareInfo.can_upload,
            'perm-delete': this.shareInfo.can_delete,
            'perm-rename': this.shareInfo.can_rename,
            'perm-move': this.shareInfo.can_move
        };

        for (const [id, allowed] of Object.entries(perms)) {
            const el = document.getElementById(id);
            if (el) {
                if (allowed) {
                    el.classList.add('allowed');
                    el.classList.remove('denied');
                } else {
                    el.classList.add('denied');
                    el.classList.remove('allowed');
                }
            }
        }

        // Show/hide action buttons based on permissions
        if (this.shareInfo.can_upload) {
            document.getElementById('upload-btn')?.classList.remove('hidden');
            document.getElementById('new-folder-btn')?.classList.remove('hidden');
        }

        if (this.shareInfo.can_delete) {
            document.getElementById('bulk-delete-btn')?.classList.remove('hidden');
        }
    },

    /**
     * Load files from shared folder
     */
    async loadFiles(parentId = null) {
        try {
            const response = await ShareAPI.listFiles(this.token, this.passwordHash, parentId);

            if (!response.success) {
                showToast(response.message || 'Failed to load files', 'error');
                return;
            }

            this.files = response.data.files || [];

            // Cache folder key if provided
            if (response.data.encrypted_key && parentId) {
                // We need to decrypt and cache the folder key
                // The folder key is encrypted with its parent's key
            }

            this.currentFolderId = parentId;
            await this.renderFiles();
            this.updateBreadcrumb();
            this.selectedItems.clear();
            this.updateBulkActions();

        } catch (error) {
            console.error('Load files error:', error);
            showToast('Failed to load files', 'error');
        }
    },

    /**
     * Render files list
     * File/folder names are decrypted with their parent's key
     * Sorted: folders first (alphabetically), then files (alphabetically)
     */
    async renderFiles() {
        const tbody = document.getElementById('file-list-body');
        const cardsContainer = document.getElementById('file-cards-container');
        const emptyState = document.getElementById('empty-state');

        tbody.innerHTML = '';
        cardsContainer.innerHTML = '';

        if (this.files.length === 0) {
            emptyState.classList.remove('hidden');
            document.getElementById('empty-title').textContent = 'This folder is empty';
            return;
        }

        emptyState.classList.add('hidden');

        // Get parent key for decryption (shareKey for root, folder's key for subfolders)
        const parentKey = await this.getParentKey();

        // Decrypt all filenames first for sorting
        const filesWithNames = [];
        for (const file of this.files) {
            let displayName = 'Encrypted';
            try {
                displayName = await CryptoUtils.decryptFilename(file.encrypted_name, parentKey);
            } catch (e) {
                console.error('Failed to decrypt filename:', e);
            }
            filesWithNames.push({ file, displayName });
        }

        // Sort: folders first (alphabetically), then files (alphabetically)
        filesWithNames.sort((a, b) => {
            if (a.file.type === 'folder' && b.file.type !== 'folder') return -1;
            if (a.file.type !== 'folder' && b.file.type === 'folder') return 1;
            return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
        });

        // Render sorted files
        for (const { file, displayName } of filesWithNames) {
            this.renderDesktopRow(file, displayName, tbody);
            this.renderMobileCard(file, displayName, cardsContainer);
        }
    },

    /**
     * Render desktop table row
     */
    renderDesktopRow(file, displayName, tbody) {
        const tr = document.createElement('tr');
        tr.dataset.fileId = file.id;

        // Checkbox column
        const checkboxTd = document.createElement('td');
        checkboxTd.innerHTML = `
            <input type="checkbox" class="file-checkbox" data-file-id="${file.id}" 
                   onchange="ShareApp.toggleFileSelection(${file.id}, this.checked)">
        `;
        tr.appendChild(checkboxTd);

        // Name column
        const nameTd = document.createElement('td');
        const nameDiv = document.createElement('div');
        nameDiv.className = 'file-name';

        let iconClass, colorClass;
        if (file.type === 'folder') {
            iconClass = 'fa-folder-open';
            colorClass = 'folder';
        } else {
            const iconData = getFileIcon(displayName);
            iconClass = iconData.icon;
            colorClass = iconData.color;
        }

        nameDiv.innerHTML = `
            <span class="file-icon ${colorClass}"><i class="fas ${iconClass}"></i></span>
            <span class="file-name-text">${escapeHtml(displayName)}</span>
        `;

        if (file.type === 'folder') {
            nameDiv.style.cursor = 'pointer';
            nameDiv.onclick = () => this.openFolder(file.id, displayName);
        }

        nameTd.appendChild(nameDiv);
        tr.appendChild(nameTd);

        // Size column
        const sizeTd = document.createElement('td');
        sizeTd.className = 'text-secondary';
        sizeTd.textContent = file.type === 'folder' ? '—' : formatFileSize(file.original_size);
        tr.appendChild(sizeTd);

        // Modified column
        const modifiedTd = document.createElement('td');
        modifiedTd.className = 'text-secondary';
        modifiedTd.textContent = formatDate(file.created_at);
        tr.appendChild(modifiedTd);

        // Actions column
        const actionsTd = document.createElement('td');
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'file-actions';

        if (file.type === 'file') {
            actionsDiv.innerHTML += `
                <button class="action-btn" onclick="ShareApp.downloadFile(${file.id}, '${escapeHtml(displayName)}')" title="Download">
                    <i class="fas fa-download"></i>
                </button>
            `;
        }

        if (this.shareInfo.can_rename) {
            actionsDiv.innerHTML += `
                <button class="action-btn" onclick="ShareApp.showRenameModal(${file.id}, '${escapeHtml(displayName)}')" title="Rename">
                    <i class="fas fa-edit"></i>
                </button>
            `;
        }

        if (this.shareInfo.can_move) {
            actionsDiv.innerHTML += `
                <button class="action-btn" onclick="ShareApp.showMoveModal(${file.id})" title="Move">
                    <i class="fas fa-arrows-alt"></i>
                </button>
            `;
        }

        if (this.shareInfo.can_delete) {
            actionsDiv.innerHTML += `
                <button class="action-btn danger" onclick="ShareApp.deleteFile(${file.id}, '${escapeHtml(displayName)}')" title="Delete">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            `;
        }

        actionsTd.appendChild(actionsDiv);
        tr.appendChild(actionsTd);

        tbody.appendChild(tr);
    },

    /**
     * Render mobile card view
     */
    renderMobileCard(file, displayName, container) {
        const card = document.createElement('div');
        card.className = 'file-card';
        card.dataset.fileId = file.id;

        let iconClass, colorClass;
        if (file.type === 'folder') {
            iconClass = 'fa-folder-open';
            colorClass = 'folder';
        } else {
            const iconData = getFileIcon(displayName);
            iconClass = iconData.icon;
            colorClass = iconData.color;
        }
        const size = file.type === 'folder' ? '' : formatFileSize(file.original_size);
        const date = formatDate(file.created_at);

        let actionsHtml = '';
        if (file.type === 'file') {
            actionsHtml += `
                <button class="action-btn" onclick="ShareApp.downloadFile(${file.id}, '${escapeHtml(displayName)}')" title="Download">
                    <i class="fas fa-download"></i>
                </button>
            `;
        }
        if (this.shareInfo.can_rename) {
            actionsHtml += `
                <button class="action-btn" onclick="ShareApp.showRenameModal(${file.id}, '${escapeHtml(displayName)}')" title="Rename">
                    <i class="fas fa-edit"></i>
                </button>
            `;
        }
        if (this.shareInfo.can_move) {
            actionsHtml += `
                <button class="action-btn" onclick="ShareApp.showMoveModal(${file.id})" title="Move">
                    <i class="fas fa-arrows-alt"></i>
                </button>
            `;
        }
        if (this.shareInfo.can_delete) {
            actionsHtml += `
                <button class="action-btn danger" onclick="ShareApp.deleteFile(${file.id}, '${escapeHtml(displayName)}')" title="Delete">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            `;
        }

        card.innerHTML = `
            <div class="file-card-header">
                <input type="checkbox" class="file-checkbox file-card-checkbox" data-file-id="${file.id}" 
                       onchange="ShareApp.toggleFileSelection(${file.id}, this.checked)">
            </div>
            <div class="file-card-content" ${file.type === 'folder' ? `onclick="ShareApp.openFolder(${file.id}, '${escapeHtml(displayName)}')" style="cursor: pointer;"` : ''}>
                <div class="file-card-icon ${colorClass}">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="file-card-name">${escapeHtml(displayName)}</div>
                <div class="file-card-meta">
                    ${file.type === 'file' ? `<span>${size}</span>` : '<span>Folder</span>'}
                </div>
                <span>${date}</span>
            </div>
            <div class="file-card-actions">
                ${actionsHtml}
            </div>
        `;

        container.appendChild(card);
    },

    /**
     * Open folder
     */
    async openFolder(folderId, folderName) {
        const folderObj = this.files.find(f => f.id === folderId && f.type === 'folder');
        if (folderObj) {
            this.currentFolder = folderObj;
            
            // Cache the folder key
            if (folderObj.encrypted_key) {
                try {
                    const parentKey = await this.getParentKey();
                    const folderKeyBuffer = await CryptoUtils.decryptItemKey(folderObj.encrypted_key, parentKey);
                    const folderKey = await CryptoUtils.importRawKey(folderKeyBuffer);
                    this.folderKeyCache.set(folderId, folderKey);
                } catch (e) {
                    console.error('Failed to cache folder key:', e);
                }
            }
        }

        this.folderHistory.push({ id: folderId, name: folderName });
        this.currentFolderId = folderId;
        await this.loadFiles(folderId);
    },

    /**
     * Navigate to share root
     */
    async navigateToRoot() {
        this.folderHistory = [];
        this.currentFolderId = null;
        this.currentFolder = null;
        await this.loadFiles();
    },

    /**
     * Navigate to specific folder in history
     */
    async navigateToFolder(index) {
        this.folderHistory = this.folderHistory.slice(0, index + 1);
        const folder = this.folderHistory[index];
        this.currentFolderId = folder.id;
        await this.loadFiles(folder.id);
    },

    /**
     * Update breadcrumb navigation
     */
    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        breadcrumb.innerHTML = '';

        // Share root
        const homeLink = document.createElement('a');
        homeLink.href = '#';
        homeLink.className = 'breadcrumb-item';
        homeLink.innerHTML = '<i class="fas fa-share-nodes"></i> Share';
        homeLink.onclick = (e) => {
            e.preventDefault();
            this.navigateToRoot();
        };
        breadcrumb.appendChild(homeLink);

        // Folder path
        for (let i = 0; i < this.folderHistory.length; i++) {
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.innerHTML = '<i class="fas fa-chevron-right"></i>';
            breadcrumb.appendChild(separator);

            const folderLink = document.createElement('a');
            folderLink.href = '#';
            folderLink.className = 'breadcrumb-item';
            folderLink.textContent = this.folderHistory[i].name;
            folderLink.onclick = (e) => {
                e.preventDefault();
                this.navigateToFolder(i);
            };
            breadcrumb.appendChild(folderLink);
        }
    },

    /**
     * Get the parent key for current context
     */
    async getParentKey() {
        if (this.currentFolderId === null) {
            return this.shareKey;
        }

        if (this.folderKeyCache.has(this.currentFolderId)) {
            return this.folderKeyCache.get(this.currentFolderId);
        }

        // If not cached, we need to derive it from the chain
        // For now, return share key as fallback
        return this.shareKey;
    },

    /**
     * Download file
     * File is decrypted with parent key (folder's key or shareKey for root)
     */
    async downloadFile(fileId, filename) {
        try {
            showProgress('download', filename, 0);

            // Get file size
            const fileSize = await ShareAPI.getFileSize(this.token, this.passwordHash, fileId);
            updateProgress('download', 0, fileSize);

            // Download file
            const response = await ShareAPI.download(this.token, this.passwordHash, fileId);
            if (!response.ok) {
                throw new Error('Download failed');
            }

            // Read with progress tracking
            const contentLength = response.headers.get('Content-Length');
            const total = parseInt(contentLength, 10);
            let loaded = 0;

            const reader = response.body.getReader();
            const chunks = [];

            while (true) {
                if (this.downloadProgressState.cancelled) {
                    reader.cancel();
                    throw new Error('Download cancelled');
                }

                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                loaded += value.length;
                updateProgress('download', loaded, total);
            }

            const encryptedBlob = new Blob(chunks);

            // Decrypt file with parent key
            updateLoadingText('Decrypting file...');
            document.getElementById('download-progress-subtitle').textContent = 'Decrypting...';

            const parentKey = await this.getParentKey();
            const decryptedData = await CryptoUtils.decryptFileInChunks(
                encryptedBlob,
                parentKey,
                (processed, total) => {
                    const percent = Math.round((processed / total) * 100);
                    document.getElementById('download-progress-subtitle').textContent = `Decrypting: ${percent}%`;
                }
            );

            // Create download
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
            showToast('Download complete!', 'success');

        } catch (error) {
            console.error('Download error:', error);
            hideProgress('download');
            showToast('Download failed: ' + error.message, 'error');
        }
    },

    /**
     * Handle file upload
     */
    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        if (!this.shareInfo.can_upload) {
            showToast('Upload not allowed for this share', 'error');
            return;
        }

        const totalFiles = files.length;
        let successCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (this.uploadProgressState.cancelled) {
                showToast(`Upload cancelled. ${successCount} of ${totalFiles} files uploaded.`, 'info');
                break;
            }

            try {
                showLoading(`Encrypting ${file.name}...`);

                // Get parent key (shareKey for root, folder's key for subfolders)
                const parentKey = await this.getParentKey();

                // Generate new key for this file
                const fileKey = CryptoUtils.generateItemKey();

                // Encrypt file key with parent key
                const encryptedFileKey = await CryptoUtils.encryptItemKey(fileKey, parentKey);

                // Encrypt file with parent key
                const encryptedBlob = await CryptoUtils.encryptFileInChunks(
                    file,
                    parentKey,
                    (processed, total) => {
                        const percent = Math.round((processed / total) * 100);
                        updateLoadingText(`Encrypting ${file.name}: ${percent}%`);
                    }
                );

                // Encrypt filename with parent key
                const encryptedName = await CryptoUtils.encryptFilename(file.name, parentKey);

                hideLoading();
                const USE_CHUNKED = encryptedBlob.size > this.CHUNK_SIZE;

                showProgress('upload', file.name, encryptedBlob.size, i + 1, totalFiles);

                if (USE_CHUNKED) {
                    await this.uploadFileInChunks(
                        encryptedBlob,
                        encryptedName,
                        file.size,
                        encryptedFileKey,
                        this.currentFolderId
                    );
                } else {
                    const response = await ShareAPI.upload(
                        this.token,
                        this.passwordHash,
                        encryptedBlob,
                        encryptedName,
                        file.size,
                        encryptedFileKey,
                        this.currentFolderId,
                        (loaded, total) => {
                            if (!this.uploadProgressState.cancelled) {
                                updateProgress('upload', loaded, total);
                            }
                        }
                    );

                    if (!response.success) {
                        throw new Error(response.message || 'Upload failed');
                    }
                }

                successCount++;
                completeProgress('upload');
                showToast(`${file.name} uploaded successfully!`, 'success');

            } catch (error) {
                console.error(`Upload error for ${file.name}:`, error);
                showToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
            }
        }

        await this.loadFiles(this.currentFolderId);
    },

    /**
     * Upload file in chunks
     */
    async uploadFileInChunks(encryptedBlob, encryptedFilename, originalSize, encryptedFileKey, parentId) {
        const uploadId = 'share_upload_' + Date.now() + '_' + Math.random().toString(36);
        const totalSize = encryptedBlob.size;
        const totalChunks = Math.ceil(totalSize / this.CHUNK_SIZE);
        let uploadedBytes = 0;

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            if (this.uploadProgressState.cancelled) {
                throw new Error('Upload cancelled');
            }

            const start = chunkIndex * this.CHUNK_SIZE;
            const end = Math.min(start + this.CHUNK_SIZE, totalSize);
            const chunkBlob = encryptedBlob.slice(start, end);

            const response = await ShareAPI.uploadChunk(
                this.token,
                this.passwordHash,
                uploadId,
                chunkIndex,
                chunkBlob,
                (loaded, total) => {
                    if (!this.uploadProgressState.cancelled) {
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
        const finalizeResponse = await ShareAPI.finalizeUpload(
            this.token,
            this.passwordHash,
            uploadId,
            encryptedFilename,
            originalSize,
            totalChunks,
            encryptedFileKey,
            parentId
        );

        if (!finalizeResponse.success) {
            throw new Error(finalizeResponse.message || 'Finalize failed');
        }

        return finalizeResponse;
    },

    /**
     * Delete file
     */
    async deleteFile(fileId, filename) {
        if (!this.shareInfo.can_delete) {
            showToast('Delete not allowed for this share', 'error');
            return;
        }

        if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
            return;
        }

        try {
            showLoading('Deleting...');
            const response = await ShareAPI.delete(this.token, this.passwordHash, fileId);

            if (!response.success) {
                throw new Error(response.message || 'Delete failed');
            }

            showToast('Deleted successfully!', 'success');
            await this.loadFiles(this.currentFolderId);
            hideLoading();

        } catch (error) {
            console.error('Delete error:', error);
            showToast('Delete failed: ' + error.message, 'error');
            hideLoading();
        }
    },

    /**
     * Delete selected files
     */
    async deleteSelectedFiles() {
        if (this.selectedItems.size === 0) {
            showToast('No files selected', 'error');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${this.selectedItems.size} item(s)?`)) {
            return;
        }

        try {
            showLoading('Deleting files...');

            for (const fileId of this.selectedItems) {
                await ShareAPI.delete(this.token, this.passwordHash, fileId);
            }

            this.selectedItems.clear();
            this.updateBulkActions();

            showToast('Items deleted successfully!', 'success');
            await this.loadFiles(this.currentFolderId);
            hideLoading();

        } catch (error) {
            console.error('Delete error:', error);
            showToast('Delete failed: ' + error.message, 'error');
            hideLoading();
        }
    },

    /**
     * Show rename modal
     */
    showRenameModal(fileId, currentName) {
        if (!this.shareInfo.can_rename) {
            showToast('Rename not allowed for this share', 'error');
            return;
        }

        this.selectedFileForRename = fileId;
        document.getElementById('rename-input').value = currentName;
        document.getElementById('rename-modal').classList.remove('hidden');
    },

    /**
     * Handle rename
    /**
     * Handle rename
     * Filename is encrypted with parent key (folder's key or shareKey for root)
     */
    async handleRename() {
        const newName = document.getElementById('rename-input').value.trim();

        if (!newName) {
            showToast('Please enter a name', 'error');
            return;
        }

        try {
            showLoading('Renaming...');

            // Get parent key for filename encryption
            const parentKey = await this.getParentKey();
            const encryptedName = await CryptoUtils.encryptFilename(newName, parentKey);
            const response = await ShareAPI.rename(
                this.token,
                this.passwordHash,
                this.selectedFileForRename,
                encryptedName
            );

            if (!response.success) {
                throw new Error(response.message || 'Rename failed');
            }

            closeRenameModal();
            showToast('Renamed successfully!', 'success');
            await this.loadFiles(this.currentFolderId);
            hideLoading();

        } catch (error) {
            console.error('Rename error:', error);
            showToast('Rename failed: ' + error.message, 'error');
            hideLoading();
        }
    },

    /**
     * Show new folder modal
     */
    showNewFolderModal() {
        if (!this.shareInfo.can_upload) {
            showToast('Creating folders not allowed for this share', 'error');
            return;
        }

        document.getElementById('folder-name-input').value = '';
        document.getElementById('new-folder-modal').classList.remove('hidden');
    },

    /**
     * Handle create folder
     * Folder name is encrypted with parent key (folder's key or shareKey for root)
     */
    async handleCreateFolder() {
        const folderName = document.getElementById('folder-name-input').value.trim();

        if (!folderName) {
            showToast('Please enter a folder name', 'error');
            return;
        }

        try {
            showLoading('Creating folder...');

            const parentKey = await this.getParentKey();

            // Generate folder key
            const folderKey = CryptoUtils.generateItemKey();

            // Encrypt folder key with parent key
            const encryptedFolderKey = await CryptoUtils.encryptItemKey(folderKey, parentKey);

            // Encrypt folder name with parent key
            const encryptedName = await CryptoUtils.encryptFilename(folderName, parentKey);

            const response = await ShareAPI.createFolder(
                this.token,
                this.passwordHash,
                encryptedName,
                encryptedFolderKey,
                this.currentFolderId
            );

            if (!response.success) {
                throw new Error(response.message || 'Create folder failed');
            }

            closeNewFolderModal();
            showToast('Folder created successfully!', 'success');
            await this.loadFiles(this.currentFolderId);
            hideLoading();

        } catch (error) {
            console.error('Create folder error:', error);
            showToast('Create folder failed: ' + error.message, 'error');
            hideLoading();
        }
    },

    /**
     * Show move modal
     */
    showMoveModal(fileId) {
        if (!this.shareInfo.can_move) {
            showToast('Move not allowed for this share', 'error');
            return;
        }

        this.selectedFileForMove = fileId;
        this.buildFolderTree();
        document.getElementById('move-modal').classList.remove('hidden');
    },

    /**
     * Build folder tree for move modal
     */
    async buildFolderTree() {
        const tree = document.getElementById('folder-tree');
        tree.innerHTML = '<div class="loading-tree">Loading folders...</div>';

        try {
            // Get all folders from share root
            const response = await ShareAPI.listFiles(this.token, this.passwordHash, null);
            
            if (!response.success) {
                tree.innerHTML = '<div class="error-tree">Failed to load folders</div>';
                return;
            }

            const folders = response.data.files.filter(f => f.type === 'folder');
            tree.innerHTML = '';

            // Add share root option
            const rootItem = document.createElement('div');
            rootItem.className = 'folder-tree-item selected';
            rootItem.dataset.folderId = '';
            rootItem.innerHTML = '<i class="fas fa-share-nodes"></i> Share Root';
            rootItem.onclick = () => this.selectMoveDestination(rootItem, null);
            tree.appendChild(rootItem);

            // Add folders
            for (const folder of folders) {
                let displayName = 'Encrypted';
                try {
                    displayName = await CryptoUtils.decryptFilename(folder.encrypted_name, this.shareKey);
                } catch (e) {}

                const item = document.createElement('div');
                item.className = 'folder-tree-item';
                item.dataset.folderId = folder.id;
                item.innerHTML = `<i class="fas fa-folder"></i> ${escapeHtml(displayName)}`;
                item.onclick = () => this.selectMoveDestination(item, folder.id);
                tree.appendChild(item);
            }

        } catch (error) {
            console.error('Build folder tree error:', error);
            tree.innerHTML = '<div class="error-tree">Failed to load folders</div>';
        }
    },

    /**
     * Select move destination
     */
    selectMoveDestination(element, folderId) {
        document.querySelectorAll('.folder-tree-item').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        this.moveDestinationId = folderId;
    },

    /**
     * Confirm move
     */
    async confirmMove() {
        if (this.moveDestinationId === undefined) {
            showToast('Please select a destination folder', 'error');
            return;
        }

        try {
            showLoading('Moving...');

            // Get new parent key
            let newParentKey;
            if (this.moveDestinationId === null) {
                newParentKey = this.shareKey;
            } else if (this.folderKeyCache.has(this.moveDestinationId)) {
                newParentKey = this.folderKeyCache.get(this.moveDestinationId);
            } else {
                // Fallback to share key
                newParentKey = this.shareKey;
            }

            // Get the file being moved
            const file = this.files.find(f => f.id === this.selectedFileForMove);
            if (!file) {
                throw new Error('File not found');
            }

            // Re-encrypt file key with new parent key
            const currentParentKey = await this.getParentKey();
            const fileKeyBuffer = await CryptoUtils.decryptItemKey(file.encrypted_key, currentParentKey);
            const newEncryptedKey = await CryptoUtils.encryptItemKey(fileKeyBuffer, newParentKey);

            const response = await ShareAPI.move(
                this.token,
                this.passwordHash,
                this.selectedFileForMove,
                this.moveDestinationId,
                newEncryptedKey
            );

            if (!response.success) {
                throw new Error(response.message || 'Move failed');
            }

            closeMoveModal();
            showToast('Moved successfully!', 'success');
            await this.loadFiles(this.currentFolderId);
            hideLoading();

        } catch (error) {
            console.error('Move error:', error);
            showToast('Move failed: ' + error.message, 'error');
            hideLoading();
        }
    },

    /**
     * Toggle file selection
     */
    toggleFileSelection(fileId, isChecked) {
        if (isChecked) {
            this.selectedItems.add(fileId);
        } else {
            this.selectedItems.delete(fileId);
        }
        this.updateBulkActions();
    },

    /**
     * Toggle all selections
     */
    toggleAllSelections(isChecked) {
        document.getElementById('select-all').checked = isChecked;
        const checkboxes = document.querySelectorAll('.file-checkbox');
        checkboxes.forEach(checkbox => {
            const fileId = parseInt(checkbox.dataset.fileId);
            if (isChecked) {
                this.selectedItems.add(fileId);
                checkbox.checked = true;
            } else {
                this.selectedItems.delete(fileId);
                checkbox.checked = false;
            }
        });
        this.updateBulkActions();
    },

    /**
     * Update bulk actions visibility
     */
    updateBulkActions() {
        const bulkActions = document.getElementById('bulk-actions');
        const selectedCount = document.getElementById('selected-count');

        const hasSelection = this.selectedItems.size > 0;

        if (bulkActions) {
            bulkActions.style.opacity = hasSelection ? 1 : 0;
        }

        if (selectedCount) {
            selectedCount.textContent = String(this.selectedItems.size);
        }
    },

    /**
     * Cancel progress
     */
    cancelProgress(type) {
        if (type === 'upload') {
            this.uploadProgressState.cancelled = true;
        } else if (type === 'download') {
            this.downloadProgressState.cancelled = true;
        }
        hideProgress(type);
    }
};

// Modal helper functions
function closeRenameModal() {
    document.getElementById('rename-modal').classList.add('hidden');
}

function closeNewFolderModal() {
    document.getElementById('new-folder-modal').classList.add('hidden');
}

function closeMoveModal() {
    document.getElementById('move-modal').classList.add('hidden');
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    ShareApp.init();
});
