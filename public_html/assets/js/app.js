/**
 * Vault Drive - Main Application
 * Single Page Application for secure file management
 * 
 * This is the main coordinator that uses modular components:
 * - AuthModule: Authentication and user management
 * - FileOperations: File upload/download/delete
 * - FolderOperations: Folder creation and hierarchy
 * - Progress Bar: Upload/download progress tracking
 * - UI Helpers: Utility functions
 */

const App = {
    currentUser: null,
    masterKey: null,
    currentFolderId: null,
    currentFolder: null,
    files: [],
    folderHistory: [],
    selectedFileForRename: null,
    selectedFileForMove: null,
    selectedItems: new Set(),
    folderKeyCache: new Map(),
    // Storage quota tracking
    storageUsed: 0,
    storageQuota: 0,
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
     * Initialize the application
     */
    async init() {
        // Show loading animation on startup
        showLoading('Initializing secure environment...');
        
        try {
            // Check if user is already logged in
            const token = sessionStorage.getItem('token');
            const masterKeyHex = sessionStorage.getItem('masterKey');

            if (token && masterKeyHex) {
                updateLoadingText('Restoring encrypted session...');

                this.masterKey = await CryptoUtils.importMasterKey(masterKeyHex);

                updateLoadingText('Loading user data...');
                await this.loadUserInfo();
                
                updateLoadingText('Decrypting file list...');
                await this.loadFiles();
                
                updateLoadingText('Loading quota information...');
                await this.loadQuota();
                
                this.showApp();
            }
            
            this.setupEventListeners();
            
            // Hide loading after initialization
            hideLoading();
        } catch (error) {
            console.error('Initialization error:', error);
            hideLoading();
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Auth form switching
        document.getElementById('show-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });

        document.getElementById('show-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        // Login form
        document.getElementById('login-form-element')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });

        // Register form
        document.getElementById('register-form-element')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRegister();
        });

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.logout();
        });

        // Change password
        document.getElementById('change-password-btn')?.addEventListener('click', () => {
            this.showChangePasswordModal();
        });

        document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleChangePassword();
        });

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
    },

    /**
     * Show login form
     */
    showLoginForm() {
        document.getElementById('register-form').classList.remove('active');
        document.getElementById('login-form').classList.add('active');
    },

    /**
     * Show register form
     */
    showRegisterForm() {
        document.getElementById('login-form').classList.remove('active');
        document.getElementById('register-form').classList.add('active');
    },

    /**
     * Handle user login
     */
    async handleLogin() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        try {
            showLoading('Logging in...');
            const { masterKey, user } = await AuthModule.handleLogin(username, password);

            this.masterKey = masterKey;
            this.currentUser = user;

            await this.loadUserInfo();
            await this.loadFiles();
            await this.loadQuota();
            this.showApp();
            hideLoading();
            showToast('Login successful!', 'success');
        } catch (error) {
            console.error('Login error:', error);
            showToast(error.message || 'Login failed', 'error');
            hideLoading();
        }
    },

    /**
     * Handle user registration
     */
    async handleRegister() {
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        try {
            showLoading('Creating account...');
            await AuthModule.handleRegister(username, password, confirmPassword);

            this.showLoginForm();
            hideLoading();
            showToast('Registration successful! Please log in.', 'success');
        } catch (error) {
            console.error('Registration error:', error);
            showToast(error.message || 'Registration failed', 'error');
            hideLoading();
        }
    },

    /**
     * Load user info
     */
    async loadUserInfo() {
        try {
            this.currentUser = await AuthModule.loadUserInfo();
            document.getElementById('username-display').textContent = this.currentUser.username;

            // Show admin panel button if user is admin
            if (this.currentUser.is_admin == 1) {
                document.getElementById('admin-panel-btn')?.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Failed to load user info:', error);
        }
    },

    /**
     * Load quota information
     */
    async loadQuota() {
        try {
            const response = await API.auth.me();
            if (response.success) {
                this.storageUsed = parseInt(response.data.storage_used) || 0;
                this.storageQuota = parseInt(response.data.storage_quota) || 0;
                this.updateQuotaDisplay(this.storageUsed, this.storageQuota);
            }
        } catch (error) {
            console.error('Failed to load quota:', error);
        }
    },

    /**
     * Get available storage space
     */
    getAvailableStorage() {
        return this.storageQuota - this.storageUsed;
    },

    /**
     * Check if there's enough storage for files
     * @param {number} totalSize - Total size of files to upload in bytes
     * @returns {object} - { hasSpace: boolean, available: number, required: number }
     */
    checkStorageQuota(totalSize) {
        const available = this.getAvailableStorage();
        return {
            hasSpace: available >= totalSize,
            available: available,
            required: totalSize,
            used: this.storageUsed,
            quota: this.storageQuota
        };
    },

    /**
     * Format bytes to human readable string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Update quota display
     */
    updateQuotaDisplay(used, total) {
        // Update internal state
        this.storageUsed = used;
        this.storageQuota = total;

        const quotaUsed = document.getElementById('quota-used');
        const quotaTotal = document.getElementById('quota-total');
        const quotaPercentage = document.getElementById('quota-percentage');
        const quotaBarFill = document.getElementById('quota-bar-fill');

        if (!quotaUsed || !quotaTotal || !quotaPercentage || !quotaBarFill) return;

        const usedMB = (used / (1024 * 1024)).toFixed(2);
        const totalMB = (total / (1024 * 1024)).toFixed(0);
        const percentage = Math.round((used / total) * 100);

        quotaUsed.textContent = usedMB + ' MB';
        quotaTotal.textContent = totalMB + ' MB';
        quotaPercentage.textContent = percentage + '%';
        quotaBarFill.style.width = percentage + '%';

        // Change color based on usage
        quotaBarFill.classList.remove('warning', 'danger');
        if (percentage >= 90) {
            quotaBarFill.classList.add('danger');
        } else if (percentage >= 75) {
            quotaBarFill.classList.add('warning');
        }
    },

    /**
     * Show main app interface
     */
    showApp() {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
    },

    /**
     * Show auth interface
     */
    showAuth() {
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('auth-container').classList.remove('hidden');
    },

    /**
     * Logout user
     */
    logout() {
        API.clearToken();
        CryptoUtils.clearMasterKeyFromSession();
        this.currentUser = null;
        this.masterKey = null;
        this.currentFolderId = null;
        this.currentFolder = null;
        this.files = [];
        this.folderHistory = [];
        this.selectedItems.clear();
        this.folderKeyCache.clear();
        this.showAuth();
        showToast('Logged out successfully', 'info');
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
     * Toggle all file selections
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
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        const selectedCount = document.getElementById('selected-count');

        const hasSelection = this.selectedItems.size > 0;

        if (bulkActions) {
            bulkActions.style.opacity = hasSelection ? 1 : 0;
        }

        if (bulkDeleteBtn) {
            bulkDeleteBtn.style.display = hasSelection ? 'inline-flex' : 'none';
        }

        if (selectedCount) {
            selectedCount.textContent = String(this.selectedItems.size);
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
            const fileIds = Array.from(this.selectedItems);
            await FileOperations.deleteMultipleFiles(fileIds);

            this.selectedItems.clear();
            this.updateBulkActions();

            showToast(`${fileIds.length} item(s) deleted successfully!`, 'success');
            await this.loadFiles(this.currentFolderId);
            await this.loadQuota();
            hideLoading();
        } catch (error) {
            console.error('Delete error:', error);
            showToast(error.message || 'Delete failed', 'error');
            hideLoading();
        }
    },

    /**
     * Load files for current folder
     */
    async loadFiles(folderId = null) {
        try {
            const response = await API.files.list(folderId);

            if (response.success) {
                this.files = response.data.files;
                this.selectedItems.clear();
                await this.renderFileList();
                this.updateBreadcrumb();
                this.updateBulkActions();
            }
        } catch (error) {
            console.error('Failed to load files:', error);
            showToast('Failed to load files', 'error');
        }
    },

    /**
     * Render file list with multiple selection support
     * File/folder names are decrypted with their parent's key
     * Sorted: folders first (alphabetically), then files (alphabetically)
     */
    async renderFileList() {
        const tbody = document.getElementById('file-list-body');
        const cardsContainer = document.getElementById('file-cards-container');
        tbody.innerHTML = '';
        cardsContainer.innerHTML = '';

        if (this.files.length === 0) {
            document.querySelector('.file-list').style.display = 'none';
            document.querySelector('.file-cards').style.display = 'none';
            document.getElementById('empty-state').classList.remove('hidden');
            return;
        }

        document.querySelector('.file-list').style.display = '';
        document.querySelector('.file-cards').style.display = '';
        document.getElementById('empty-state').classList.add('hidden');

        // Get parent key for decryption (masterKey for root, folder's key for subfolders)
        const parentKey = await this.getParentKey();

        // Decrypt all filenames first for sorting
        const filesWithNames = [];
        for (const file of this.files) {
            try {
                const displayName = await CryptoUtils.decryptFilename(file.encrypted_name, parentKey);
                filesWithNames.push({ file, displayName });
            } catch (error) {
                console.error('Error decrypting file name:', error);
                filesWithNames.push({ file, displayName: '[Decryption Error]' });
            }
        }

        // Sort: folders first (alphabetically), then files (alphabetically)
        filesWithNames.sort((a, b) => {
            // Folders come before files
            if (a.file.type === 'folder' && b.file.type !== 'folder') return -1;
            if (a.file.type !== 'folder' && b.file.type === 'folder') return 1;
            // Same type: sort alphabetically (case-insensitive)
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
        checkboxTd.style.width = '40px';
        checkboxTd.innerHTML = `
            <input type="checkbox" class="file-checkbox" data-file-id="${file.id}" 
                   onchange="App.toggleFileSelection(${file.id}, this.checked)">
        `;
        tr.appendChild(checkboxTd);

        // Name column
        const nameTd = document.createElement('td');
        const nameDiv = document.createElement('div');
        nameDiv.className = 'file-name';
        if (file.type === 'folder') {
            nameDiv.style.cursor = 'pointer';
            nameDiv.onclick = () => this.openFolder(file.id, displayName);
        }

        let iconClass, colorClass;
        if (file.type === 'folder') {
            iconClass = 'fa-folder-open';
            colorClass = 'folder';
        } else {
            const iconData = getFileIcon(displayName);
            iconClass = iconData.icon;
            colorClass = iconData.color;
        }
        
        // Show share indicator if file is shared
        const shareIndicator = file.share_id ? '<i class="fas fa-link share-indicator" title="Shared"></i>' : '';
        
        nameDiv.innerHTML = `
            <i class="fas ${iconClass} file-icon ${colorClass}"></i>
            <span>${escapeHtml(displayName)}</span>
            ${shareIndicator}
        `;
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
                <button class="action-btn" onclick="App.downloadFile(${file.id}, '${escapeHtml(displayName)}')" title="Download">
                    <i class="fas fa-download"></i>
                </button>
            `;
        }

        actionsDiv.innerHTML += `
            <button class="action-btn" onclick="App.showShareModal(${file.id}, '${escapeHtml(displayName)}', '${file.type}')" title="Share">
                <i class="fas fa-share-nodes"></i>
            </button>
            <button class="action-btn" onclick="App.showRenameModal(${file.id}, '${escapeHtml(displayName)}')" title="Rename">
                <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn" onclick="App.showMoveModal(${file.id})" title="Move">
                <i class="fas fa-arrows-alt"></i>
            </button>
            <button class="action-btn danger" onclick="App.deleteFile(${file.id}, '${escapeHtml(displayName)}')" title="Delete">
                <i class="fa-regular fa-trash-can"></i>
            </button>
        `;

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
        const shareIndicator = file.share_id ? '<i class="fas fa-link share-indicator" title="Shared"></i>' : '';

        card.innerHTML = `
            <div class="file-card-header">
                <input type="checkbox" class="file-checkbox file-card-checkbox" data-file-id="${file.id}" 
                       onchange="App.toggleFileSelection(${file.id}, this.checked)">
            </div>
            <div class="file-card-content" ${file.type === 'folder' ? `onclick="App.openFolder(${file.id}, '${escapeHtml(displayName)}')" style="cursor: pointer;"` : ''}>
                <div class="file-card-icon ${colorClass}">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="file-card-name">${escapeHtml(displayName)} ${shareIndicator}</div>
                <div class="file-card-meta">
                    ${file.type === 'file' ? `<span>${size}</span>` : '<span>Folder</span>'}
                </div>
                <span>${date}</span>
            </div>
            <div class="file-card-actions">
                ${file.type === 'file' ? `
                    <button class="action-btn" onclick="App.downloadFile(${file.id}, '${escapeHtml(displayName)}')" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                ` : ''}
                <button class="action-btn" onclick="App.showShareModal(${file.id}, '${escapeHtml(displayName)}', '${file.type}')" title="Share">
                    <i class="fas fa-share-nodes"></i>
                </button>
                <button class="action-btn" onclick="App.showRenameModal(${file.id}, '${escapeHtml(displayName)}')" title="Rename">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn" onclick="App.showMoveModal(${file.id})" title="Move">
                    <i class="fas fa-arrows-alt"></i>
                </button>
                <button class="action-btn danger" onclick="App.deleteFile(${file.id}, '${escapeHtml(displayName)}')" title="Delete">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        `;

        container.appendChild(card);
    },

    /**
     * Get the parent key for creating new items
     * Returns masterKey for root, or cached folder key for subfolders
     */
    async getParentKey() {
        if (this.currentFolderId === null) {
            return this.masterKey;
        }

        if (this.folderKeyCache.has(this.currentFolderId)) {
            return this.folderKeyCache.get(this.currentFolderId);
        }

        // If we're in a folder but key is not cached, this is an error state
        // This shouldn't happen as openFolder caches the key before navigating
        throw new Error('Current folder key not found in cache');
    },

    /**
     * Update breadcrumb navigation
     */
    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        breadcrumb.innerHTML = '';

        // Home/Root
        const homeLink = document.createElement('a');
        homeLink.href = '#';
        homeLink.className = 'breadcrumb-item';
        homeLink.innerHTML = '<i class="fas fa-home"></i> Home';
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
            const folderId = this.folderHistory[i].id;
            folderLink.onclick = (e) => {
                e.preventDefault();
                this.navigateToFolder(i);
            };
            breadcrumb.appendChild(folderLink);
        }
    },

    /**
     * Open folder
     * Decrypts folder key and caches it before navigating
     */
    async openFolder(folderId, folderName) {
        const folderObj = this.files.find(f => f.id === folderId && f.type === 'folder');
        if (folderObj) {
            this.currentFolder = folderObj;

            // Decrypt folder key with current parent key and cache it
            if (!this.folderKeyCache.has(folderId) && folderObj.encrypted_key) {
                try {
                    const parentKey = await this.getParentKey();
                    const folderKeyRaw = await CryptoUtils.decryptItemKey(folderObj.encrypted_key, parentKey);
                    const folderKey = await CryptoUtils.importRawKey(folderKeyRaw);
                    this.folderKeyCache.set(folderId, folderKey);
                } catch (error) {
                    console.error('Error caching folder key:', error);
                }
            }
        }

        this.folderHistory.push({ id: folderId, name: folderName });
        this.currentFolderId = folderId;
        await this.loadFiles(folderId);
    },

    /**
     * Navigate to root
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

        if (index === 0) {
            const response = await API.files.list(null);
            if (response.success) {
                const folderObj = response.data.files.find(f => f.id === folder.id && f.type === 'folder');
                if (folderObj) {
                    this.currentFolder = folderObj;
                }
            }
        } else {
            const parentFolder = this.folderHistory[index - 1];
            const response = await API.files.list(parentFolder.id);
            if (response.success) {
                const folderObj = response.data.files.find(f => f.id === folder.id && f.type === 'folder');
                if (folderObj) {
                    this.currentFolder = folderObj;
                }
            }
        }

        await this.loadFiles(folder.id);
    },

    /**
     * Handle file upload
     */
    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        try {
            const result = await FileOperations.handleFileUpload(
                files,
                this.masterKey,
                this.currentFolderId,
                () => this.getParentKey()
            );

            await this.loadFiles(this.currentFolderId);
            await this.loadQuota();

            if (!result.cancelled && result.totalFiles > 1) {
                if (result.failedCount === 0) {
                    showToast(`All ${result.successCount} files uploaded successfully!`, 'success');
                } else if (result.successCount > 0) {
                    showToast(`${result.successCount} of ${result.totalFiles} files uploaded successfully`, 'info');
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
            showToast(error.message || 'Upload failed', 'error');
        } finally {
            hideProgress('upload');
            hideLoading();
        }
    },

    /**
     * Download file
     * File is decrypted with parent key (folder's key or masterKey for root)
     */
    async downloadFile(fileId, filename) {
        try {
            showLoading(`Preparing download for ${filename}...`);
            hideLoading();

            // Get parent key for file decryption
            const parentKey = await this.getParentKey();
            await FileOperations.downloadFile(fileId, filename, parentKey);
            showToast(`${filename} downloaded successfully!`, 'success');
        } catch (error) {
            console.error('Download error:', error);
            showToast(error.message || 'Download failed', 'error');
            hideProgress('download');
            hideLoading();
        }
    },

    /**
     * Delete file/folder
     */
    async deleteFile(fileId, filename) {
        if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
            return;
        }

        try {
            showLoading(`Deleting ${filename}...`);
            await FileOperations.deleteFile(fileId, filename);

            showToast(`${filename} deleted successfully!`, 'success');
            await this.loadFiles(this.currentFolderId);
            await this.loadQuota();
            hideLoading();
        } catch (error) {
            console.error('Delete error:', error);
            showToast(error.message || 'Delete failed', 'error');
            hideLoading();
        }
    },

    /**
     * Show rename modal
     */
    showRenameModal(fileId, currentName) {
        this.selectedFileForRename = fileId;
        document.getElementById('rename-input').value = currentName;
        document.getElementById('rename-modal').classList.remove('hidden');
        document.getElementById('rename-input').focus();
    },

    /**
     * Handle rename
     * Filename is encrypted with parent key (folder's key or masterKey for root)
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
            await FileOperations.renameFile(this.selectedFileForRename, newName, parentKey);

            closeRenameModal();
            showToast('Renamed successfully!', 'success');
            await this.loadFiles(this.currentFolderId);
            hideLoading();
        } catch (error) {
            console.error('Rename error:', error);
            showToast(error.message || 'Rename failed', 'error');
            hideLoading();
        }
    },

    /**
     * Show new folder modal
     */
    showNewFolderModal() {
        document.getElementById('folder-name-input').value = '';
        document.getElementById('new-folder-modal').classList.remove('hidden');
        document.getElementById('folder-name-input').focus();
    },

    /**
     * Handle create folder
     */
    async handleCreateFolder() {
        const folderName = document.getElementById('folder-name-input').value.trim();
        if (!folderName) {
            showToast('Please enter a folder name', 'error');
            return;
        }

        try {
            showLoading('Creating folder...');
            await FolderOperations.createFolder(
                folderName,
                this.masterKey,
                this.currentFolderId,
                () => this.getParentKey()
            );

            closeNewFolderModal();
            showToast('Folder created successfully!', 'success');
            await this.loadFiles(this.currentFolderId);
            hideLoading();
        } catch (error) {
            console.error('Folder creation error:', error);
            showToast(error.message || 'Folder creation failed', 'error');
            hideLoading();
        }
    },

    /**
     * Show move modal
     */
    async showMoveModal(fileId) {
        this.selectedFileForMove = fileId;
        document.getElementById('move-modal').classList.remove('hidden');
        await this.loadFolderTree();
    },

    /**
     * Load folder tree for move operation
     * Folder names are decrypted with their parent's key
     */
    async loadFolderTree() {
        try {
            showLoading('Loading folders...');

            const response = await API.files.list(this.currentFolderId);
            if (!response.success) {
                throw new Error('Failed to load folders');
            }

            const tree = await FolderOperations.buildFolderTree(
                response.data.files,
                this.masterKey,
                this.currentFolderId,
                this.selectedFileForMove,
                this.folderKeyCache
            );

            // Render tree
            const container = document.getElementById('folder-tree');
            container.innerHTML = '';

            tree.forEach(item => {
                const div = document.createElement('div');
                div.className = 'folder-item' + (item.disabled ? ' disabled' : '');
                div.style.paddingLeft = (item.level * 20) + 'px';
                div.dataset.folderId = item.id;

                div.innerHTML = `
                    <i class="fas ${item.id === null ? 'fa-home' : 'fa-folder'}"></i>
                    <span>${escapeHtml(item.name)}</span>
                `;

                if (!item.disabled) {
                    div.onclick = function () {
                        App.selectMoveDestination(this);
                    };
                }

                container.appendChild(div);
            });

            hideLoading();
        } catch (error) {
            console.error('Failed to load folder tree:', error);
            showToast('Failed to load folders', 'error');
            hideLoading();
        }
    },

    /**
     * Select move destination
     */
    selectMoveDestination(element) {
        document.querySelectorAll('.folder-item').forEach(item => {
            item.classList.remove('selected');
        });
        element.classList.add('selected');
    },

    /**
     * Confirm move
     */
    async confirmMove() {
        const selectedFolder = document.querySelector('.folder-item.selected');
        if (!selectedFolder) {
            showToast('Please select a destination', 'error');
            return;
        }

        const newParentId = selectedFolder.dataset.folderId === 'null' ? null : parseInt(selectedFolder.dataset.folderId);

        try {
            showLoading('Moving...');

            const item = this.files.find(f => f.id === this.selectedFileForMove);
            await FolderOperations.moveFile(
                this.selectedFileForMove,
                newParentId,
                item,
                this.files,
                this.masterKey,
                this.folderKeyCache
            );

            closeMoveModal();
            showToast('Moved successfully!', 'success');
            await this.loadFiles(this.currentFolderId);
            hideLoading();
        } catch (error) {
            console.error('Move error:', error);
            showToast(error.message || 'Move failed', 'error');
            hideLoading();
        }
    },

    /**
     * Show share modal
     */
    showShareModal(fileId, fileName, fileType) {
        const file = this.files.find(f => f.id === fileId);
        this.selectedFileForShare = { 
            id: fileId, 
            name: fileName, 
            type: fileType,
            shareId: file?.share_id || null,
            shareToken: file?.share_token || null,
            shareExpiresAt: file?.share_expires_at || null
        };
        
        document.getElementById('share-file-name').textContent = fileName;
        
        // Check if already shared
        if (file && file.share_id) {
            // Show existing share info
            document.getElementById('share-form').classList.add('hidden');
            document.getElementById('existing-share-info').classList.remove('hidden');
            
            const shareUrl = window.location.origin + '/vault-drive/public/share.php?token=' + file.share_token;
            document.getElementById('existing-share-link').value = shareUrl;
            
            // Show expiration info
            const expiresInfo = document.getElementById('share-expires-info');
            if (file.share_expires_at) {
                const expiresDate = new Date(file.share_expires_at);
                const now = new Date();
                if (expiresDate < now) {
                    expiresInfo.textContent = 'Expired on ' + expiresDate.toLocaleString();
                    expiresInfo.style.color = 'var(--danger)';
                } else {
                    expiresInfo.textContent = 'Expires on ' + expiresDate.toLocaleString();
                    expiresInfo.style.color = 'var(--warn)';
                }
            } else {
                expiresInfo.textContent = 'No expiration';
                expiresInfo.style.color = 'var(--muted)';
            }
        } else {
            // Show create share form
            document.getElementById('existing-share-info').classList.add('hidden');
            document.getElementById('share-form').classList.remove('hidden');
            document.getElementById('share-password').value = '';
            document.getElementById('share-confirm-password').value = '';
            document.getElementById('share-expires-at').value = '';
            document.getElementById('share-can-upload').checked = false;
            document.getElementById('share-can-delete').checked = false;
            document.getElementById('share-can-rename').checked = false;
            document.getElementById('share-can-move').checked = false;
            document.getElementById('share-link-container').classList.add('hidden');
            document.getElementById('create-share-btn').classList.remove('hidden');
        }
        
        document.getElementById('share-modal').classList.remove('hidden');
    },

    /**
     * Copy existing share link
     */
    copyExistingShareLink() {
        const input = document.getElementById('existing-share-link');
        input.select();
        document.execCommand('copy');
        showToast('Link copied to clipboard!', 'success');
    },

    /**
     * Remove share
     */
    async removeShare() {
        if (!this.selectedFileForShare || !this.selectedFileForShare.shareId) {
            showToast('No share selected', 'error');
            return;
        }

        if (!confirm('Are you sure you want to remove this share? The link will no longer work.')) {
            return;
        }

        try {
            showLoading('Removing share...');
            
            const response = await API.files.deleteShare(this.selectedFileForShare.shareId);
            
            if (!response.success) {
                throw new Error(response.message || 'Failed to remove share');
            }

            closeShareModal();
            showToast('Share removed successfully!', 'success');
            await this.loadFiles(this.currentFolderId);
            hideLoading();

        } catch (error) {
            console.error('Remove share error:', error);
            showToast('Failed to remove share: ' + error.message, 'error');
            hideLoading();
        }
    },

    /**
     * Handle share creation
     */
    async handleCreateShare() {
        const password = document.getElementById('share-password').value;
        const confirmPassword = document.getElementById('share-confirm-password').value;

        if (!password) {
            showToast('Please enter a password', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        if (password.length < 4) {
            showToast('Password must be at least 4 characters', 'error');
            return;
        }

        try {
            showLoading('Creating share...');

            // Generate salts
            const passwordSalt = CryptoUtils.generateSalt();
            const kdfSalt = CryptoUtils.generateSalt();

            // Hash password for server verification
            const passwordHash = await CryptoUtils.hashPassword(password, passwordSalt);

            // Derive key from password for encryption
            const sharePasswordKey = await CryptoUtils.deriveKey(password, kdfSalt);

            // Get the file's key
            const file = this.files.find(f => f.id === this.selectedFileForShare.id);
            if (!file) {
                throw new Error('File not found');
            }

            // Decrypt the file's key with parent key
            const parentKey = await this.getParentKey();
            const fileKeyBuffer = await CryptoUtils.decryptItemKey(file.encrypted_key, parentKey);

            // Re-encrypt file key with share password key
            const shareKey = await CryptoUtils.importRawKey(fileKeyBuffer);
            const exportedShareKey = await crypto.subtle.exportKey('raw', shareKey);
            const encryptedShareKey = await CryptoUtils.encryptMasterKey(shareKey, sharePasswordKey);

            // Get permissions
            const permissions = {
                can_upload: document.getElementById('share-can-upload').checked ? 1 : 0,
                can_delete: document.getElementById('share-can-delete').checked ? 1 : 0,
                can_rename: document.getElementById('share-can-rename').checked ? 1 : 0,
                can_move: document.getElementById('share-can-move').checked ? 1 : 0
            };

            // Get expiration date
            const expiresAtInput = document.getElementById('share-expires-at').value;
            const expiresAt = expiresAtInput ? new Date(expiresAtInput).toISOString() : null;

            // Create share on server
            const response = await API.files.createShare(
                this.selectedFileForShare.id,
                encryptedShareKey,
                passwordHash,
                CryptoUtils.arrayBufferToHex(passwordSalt),
                CryptoUtils.arrayBufferToHex(kdfSalt),
                permissions,
                expiresAt
            );

            if (!response.success) {
                throw new Error(response.message || 'Failed to create share');
            }

            // Show share link
            const shareUrl = response.data.share_url || (window.location.origin + '/vault-drive/public/share.php?token=' + response.data.token);
            document.getElementById('share-link-input').value = shareUrl;
            document.getElementById('share-link-container').classList.remove('hidden');
            document.getElementById('create-share-btn').classList.add('hidden');

            // Reload files to update share status
            await this.loadFiles(this.currentFolderId);
            
            hideLoading();
            showToast('Share created successfully!', 'success');

        } catch (error) {
            console.error('Share creation error:', error);
            showToast('Failed to create share: ' + error.message, 'error');
            hideLoading();
        }
    },

    /**
     * Copy share link to clipboard
     */
    copyShareLink() {
        const input = document.getElementById('share-link-input');
        input.select();
        document.execCommand('copy');
        showToast('Link copied to clipboard!', 'success');
    },

    /**
     * Show change password modal
     */
    showChangePasswordModal() {
        document.getElementById('change-password-modal').classList.remove('hidden');
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-new-password').value = '';
    },

    /**
     * Handle change password
     */
    async handleChangePassword() {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmNewPassword = document.getElementById('confirm-new-password').value;

        try {
            showLoading('Changing password...');
            await AuthModule.handleChangePassword(
                currentPassword,
                newPassword,
                confirmNewPassword,
                this.masterKey
            );

            closeChangePasswordModal();
            showToast('Password changed successfully! Please log in again.', 'success');

            // Log out user
            setTimeout(() => {
                this.logout();
            }, 2000);

            hideLoading();
        } catch (error) {
            console.error('Password change error:', error);
            showToast(error.message || 'Password change failed', 'error');
            hideLoading();
        }
    },

    /**
     * Cancel progress operation
     */
    cancelProgress(type) {
        const progressState = type === 'upload' ? this.uploadProgressState : this.downloadProgressState;
        const operationType = type === 'upload' ? 'upload' : 'download';

        if (confirm(`Are you sure you want to cancel this ${operationType}?`)) {
            progressState.cancelled = true;
            showToast(`${operationType.charAt(0).toUpperCase() + operationType.slice(1)} cancelled`, 'info');
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
