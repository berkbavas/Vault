/**
 * Vault Drive - Main Application
 * Single Page Application for secure file management
 */

const App = {
    currentUser: null,
    masterKey: null,
    currentFolderId: null,
    currentFolder: null, // Metadata of the current folder we're inside
    files: [],
    folderHistory: [],
    selectedFileForRename: null,
    selectedFileForMove: null,
    selectedItems: new Set(),
    uploadProgress: null,
    downloadProgress: null,
    folderKeyCache: new Map(), // Cache for decrypted folder keys
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
        // Check if user is already logged in
        const token = sessionStorage.getItem('token');
        const masterKeyHex = sessionStorage.getItem('masterKey');

        if (token && masterKeyHex) {
            try {
                showLoading('Loading your files...');
                this.masterKey = await CryptoUtils.importMasterKey(masterKeyHex);
                await this.loadUserInfo();
                await this.loadQuota();
                this.showApp();
                await this.loadFiles();
                hideLoading();
            } catch (error) {
                console.error('Session restore failed:', error);
                this.logout();
            }
        }

        this.setupEventListeners();
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
            e.target.value = ''; // Reset input
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

        if (!username || !password) {
            showToast('Please enter username and password', 'error');
            return;
        }

        try {
            showLoading('Logging in...');

            // Get client salt
            const saltResponse = await API.auth.getClientSalt(username);
            if (!saltResponse.success) {
                throw new Error(saltResponse.message || 'Failed to get client salt');
            }

            const clientSalt = CryptoUtils.hexToArrayBuffer(saltResponse.data.client_salt);

            // Hash password for authentication
            const passwordHash = await CryptoUtils.hashPassword(password, clientSalt);

            // Login
            const loginResponse = await API.auth.login(username, passwordHash);
            if (!loginResponse.success) {
                throw new Error(loginResponse.message || 'Login failed');
            }

            // Store token
            API.setToken(loginResponse.data.token);

            const kdfSalt = CryptoUtils.hexToArrayBuffer(loginResponse.data.user.kdf_salt);
            const encryptedMasterKey = loginResponse.data.user.encrypted_master_key;

            // Derive key and decrypt master key
            const passwordKey = await CryptoUtils.deriveKey(password, kdfSalt);
            const masterKeyHex = await CryptoUtils.decryptMasterKey(encryptedMasterKey, passwordKey);
            this.masterKey = await CryptoUtils.importMasterKey(masterKeyHex);

            // Store master key in session
            CryptoUtils.storeMasterKeyInSession(masterKeyHex);

            // Load user info
            await this.loadUserInfo();
            await this.loadQuota();

            // Show app
            this.showApp();
            await this.loadFiles();

            showToast('Login successful!', 'success');
            hideLoading();
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

        if (!username || !password || !confirmPassword) {
            showToast('Please fill in all fields', 'error');
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
            showLoading('Creating your account...');

            // Generate salts
            const clientSalt = CryptoUtils.generateSalt();
            const kdfSalt = CryptoUtils.generateSalt();

            // Hash password
            const passwordHash = await CryptoUtils.hashPassword(password, clientSalt);

            // Generate and encrypt master key
            const masterKey = await CryptoUtils.generateMasterKey();
            const passwordKey = await CryptoUtils.deriveKey(password, kdfSalt);
            const encryptedMasterKey = await CryptoUtils.encryptMasterKey(masterKey, passwordKey);

            // Register
            const response = await API.auth.register(
                username,
                CryptoUtils.arrayBufferToHex(clientSalt),
                CryptoUtils.arrayBufferToHex(kdfSalt),
                passwordHash,
                encryptedMasterKey
            );

            if (!response.success) {
                throw new Error(response.message || 'Registration failed');
            }

            showToast('Registration successful! Please login.', 'success');
            this.showLoginForm();

            // Pre-fill username
            document.getElementById('login-username').value = username;

            hideLoading();
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
        const response = await API.auth.me();
        if (response.success) {
            this.currentUser = response.data;
            document.getElementById('username-display').textContent = this.currentUser.username;
            this.updateQuotaDisplay(response.data.storage_used, response.data.storage_quota);
        }
    },

    /**
     * Load quota information
     */
    async loadQuota() {
        try {
            const response = await API.auth.me();
            if (response.success) {
                this.updateQuotaDisplay(response.data.storage_used, response.data.storage_quota);
            }
        } catch (error) {
            console.error('Load quota error:', error);
        }
    },

    /**
     * Update quota display
     */
    updateQuotaDisplay(used, total) {
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
            checkbox.checked = isChecked;
            const fileId = parseInt(checkbox.dataset.fileId);
            if (isChecked) {
                this.selectedItems.add(fileId);
            } else {
                this.selectedItems.delete(fileId);
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

        // Container
        if (bulkActions) {
            bulkActions.style.display = hasSelection ? 'flex' : 'none';
        }

        // Button (defensive: in case container styling changes later)
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
            showLoading(`Deleting ${this.selectedItems.size} item(s)...`);

            const response = await API.files.deleteMultiple(Array.from(this.selectedItems));
            if (!response.success) {
                throw new Error(response.message || 'Bulk delete failed');
            }

            this.selectedItems.clear();
            this.updateBulkActions();
            showToast('Selected items deleted successfully', 'success');


            await this.loadFiles(this.currentFolderId);
            await this.loadQuota();
            hideLoading();
        } catch (error) {
            console.error('Bulk delete error:', error);
            showToast(error.message || 'Delete failed', 'error');
            hideLoading();
        }
    },

    /**
     * Get file icon based on file extension
     * Returns object with icon class and color class
     */
    getFileIcon(filename) {
        const ext = filename.toLowerCase().split('.').pop();

        // Image files
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) {
            return { icon: 'fa-file-image', color: 'image' };
        }

        // Video files
        if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext)) {
            return { icon: 'fa-file-video', color: 'video' };
        }

        // Audio files
        if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
            return { icon: 'fa-file-audio', color: 'audio' };
        }

        // Document files
        if (['doc', 'docx'].includes(ext)) {
            return { icon: 'fa-file-word', color: 'document' };
        }
        if (['xls', 'xlsx'].includes(ext)) {
            return { icon: 'fa-file-excel', color: 'document' };
        }
        if (['ppt', 'pptx'].includes(ext)) {
            return { icon: 'fa-file-powerpoint', color: 'document' };
        }
        if (ext === 'pdf') {
            return { icon: 'fa-file-pdf', color: 'pdf' };
        }

        // Archive files
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
            return { icon: 'fa-file-archive', color: 'archive' };
        }

        // Code files
        if (['html', 'css', 'js', 'php', 'py', 'java', 'c', 'cpp', 'json', 'xml'].includes(ext)) {
            return { icon: 'fa-file-code', color: 'code' };
        }

        // Text files
        if (['txt', 'md', 'rtf'].includes(ext)) {
            return { icon: 'fa-file-alt', color: 'text' };
        }

        // Default
        return { icon: 'fa-file', color: 'default' };
    },

    /**
     * Load files for current folder
     */
    async loadFiles(folderId = null) {
        try {
            // Clear selections
            this.toggleAllSelections(false);
            this.updateBulkActions();


            const response = await API.files.list(folderId);
            if (!response.success) {
                throw new Error(response.message || 'Failed to load files');
            }

            this.files = response.data.files;
            await this.renderFileList();
            this.updateBreadcrumb();

        } catch (error) {
            console.error('Load files error:', error);
            showToast(error.message || 'Failed to load files', 'error');
        }
    },

    /**
     * Render file list with multiple selection support
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
            text = this.currentFolderId === null ? "There are no files" : "This folder is empty";
            document.getElementById('empty-title').innerText = text;
            return;
        }

        document.querySelector('.file-list').style.display = '';
        document.querySelector('.file-cards').style.display = '';
        document.getElementById('empty-state').classList.add('hidden');

        for (const file of this.files) {
            // Decrypt filename
            let displayName = 'Decrypting...';
            try {
                displayName = await CryptoUtils.decryptFilename(file.encrypted_name, this.masterKey);
            } catch (error) {
                console.error('Failed to decrypt filename:', error);
                displayName = '[Decryption failed]';
            }

            // Render desktop row
            this.renderDesktopRow(file, displayName, tbody);

            // Render mobile card
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
            nameDiv.onclick = () => this.openFolder(file.id, displayName);
            nameDiv.style.cursor = 'pointer';
        }

        let iconClass, colorClass;
        if (file.type === 'folder') {
            iconClass = 'fa-folder-open';
            colorClass = 'folder';
        } else {
            const iconData = this.getFileIcon(displayName);
            iconClass = iconData.icon;
            colorClass = iconData.color;
        }
        nameDiv.innerHTML = `
                <i class="fas ${iconClass} file-icon ${colorClass}"></i>
                <span>${escapeHtml(displayName)}</span>
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
            const iconData = this.getFileIcon(displayName);
            iconClass = iconData.icon;
            colorClass = iconData.color;
        }
        const size = file.type === 'folder' ? '' : formatFileSize(file.original_size);
        const date = formatDate(file.created_at);

        card.innerHTML = `
            <div class="file-card-header">
                <input type="checkbox" class="file-checkbox file-card-checkbox" data-file-id="${file.id}" 
                       onchange="App.toggleFileSelection(${file.id}, this.checked)">
            </div>
            <div class="file-card-content" ${file.type === 'folder' ? `onclick="App.openFolder(${file.id}, '${escapeHtml(displayName)}')" style="cursor: pointer;"` : ''}>
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
                ${file.type === 'file' ? `
                    <button class="action-btn" onclick="App.downloadFile(${file.id}, '${escapeHtml(displayName)}')" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                ` : ''}
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
 * Update bulk actions visibility
 */
    updateBulkActions() {
        const bulkActions = document.getElementById('bulk-actions');
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        const selectedCount = document.getElementById('selected-count');

        const hasSelection = this.selectedItems.size > 0;

        // Container
        if (bulkActions) {
            bulkActions.style.opacity = hasSelection ? 1 : 0;
        }

        // Button (defensive: in case container styling changes later)
        if (bulkDeleteBtn) {
            bulkDeleteBtn.style.display = hasSelection ? 'inline-flex' : 'none';
        }

        if (selectedCount) {
            selectedCount.textContent = String(this.selectedItems.size);
        }
    },

    /**
     * ========================================
     * HIERARCHICAL KEY MANAGEMENT
     * ========================================
     */

    /**
     * Get the parent key for creating new items
     * If in root, return master key. Otherwise return current folder's key
     */
    async getParentKey() {
        if (this.currentFolderId === null) {
            // In root folder, use master key
            return this.masterKey;
        }

        // Get current folder's decrypted key from cache or decrypt it
        if (this.folderKeyCache.has(this.currentFolderId)) {
            return this.folderKeyCache.get(this.currentFolderId);
        }

        // Need to decrypt the current folder's key
        if (!this.currentFolder || !this.currentFolder.encrypted_key) {
            throw new Error('Current folder key not found');
        }

        // Recursively get parent key to decrypt current folder's key
        const parentKey = await this.getKeyForItem(this.currentFolder);
        return parentKey;
    },

    /**
     * Get decrypted key for any file/folder item
     * Recursively decrypts up the hierarchy
     */
    async getKeyForItem(item) {
        // Check cache first
        if (item.type === 'folder' && this.folderKeyCache.has(item.id)) {
            return this.folderKeyCache.get(item.id);
        }

        let parentKey;
        if (item.parent_id === null || item.parent_id === undefined) {
            // Root level item, use master key
            parentKey = this.masterKey;
        } else {
            // Get parent folder's key
            const parentFolder = this.files.find(f => f.id === item.parent_id);
            if (!parentFolder) {
                throw new Error('Parent folder not found');
            }
            parentKey = await this.getKeyForItem(parentFolder);
        }

        // Decrypt this item's key
        const itemKeyRaw = await CryptoUtils.decryptItemKey(item.encrypted_key, parentKey);
        const itemKey = await CryptoUtils.importRawKey(itemKeyRaw);

        // Cache if it's a folder
        if (item.type === 'folder') {
            this.folderKeyCache.set(item.id, itemKey);
        }

        return itemKey;
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
     */
    async openFolder(folderId, folderName) {
        // Store the folder object before navigating into it
        const folderObj = this.files.find(f => f.id === folderId && f.type === 'folder');
        if (folderObj) {
            this.currentFolder = folderObj;
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
        
        // We need to load the parent folder to get the folder object
        // Then navigate into it
        if (index === 0) {
            // First folder in history, load from root
            const response = await API.files.list(null);
            if (response.success) {
                const folderObj = response.data.files.find(f => f.id === folder.id && f.type === 'folder');
                if (folderObj) {
                    this.currentFolder = folderObj;
                }
            }
        } else {
            // Load from parent folder
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
     * Handle file upload with chunked support
     */
    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        const totalFiles = files.length;
        let successCount = 0;
        let failedCount = 0;

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                // Check if cancelled
                if (App.uploadProgressState.cancelled) {
                    showToast(`Upload cancelled. ${successCount} of ${totalFiles} files uploaded.`, 'info');
                    break;
                }

                showLoading(`Encrypting ${file.name}...`);

                // Get parent key (master key if root, or current folder's key)
                const parentKey = await this.getParentKey();

                // Generate new key for this file
                const fileKey = CryptoUtils.generateItemKey();

                // Encrypt file key with parent key
                const encryptedFileKey = await CryptoUtils.encryptItemKey(fileKey, parentKey);

                // Encrypt file in chunks to save memory
                const encryptedBlob = await CryptoUtils.encryptFileInChunks(
                    file,
                    this.masterKey,
                    (processed, total) => {
                        const percent = Math.round((processed / total) * 100);
                        updateLoadingText(`Encrypting ${file.name}: ${percent}%`);
                    }
                );

                // Check if cancelled after encryption
                if (App.uploadProgressState.cancelled) {
                    hideLoading();
                    showToast(`Upload cancelled. ${successCount} of ${totalFiles} files uploaded.`, 'info');
                    break;
                }

                // Encrypt filename
                const encryptedName = await CryptoUtils.encryptFilename(file.name, this.masterKey);

                hideLoading();

                const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
                const USE_CHUNKED = encryptedBlob.size > CHUNK_SIZE;

                // Show progress bar with file count
                showProgress('upload', file.name, encryptedBlob.size, i + 1, totalFiles);

                try {
                    if (USE_CHUNKED) {
                        // Chunked upload for large files
                        const response = await this.uploadFileInChunks(
                            encryptedBlob,
                            encryptedName,
                            file.size,
                            encryptedFileKey,
                            this.currentFolderId,
                            CHUNK_SIZE,
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
                            this.currentFolderId,
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
                        showToast(`Upload cancelled. ${successCount} of ${totalFiles} files uploaded.`, 'info');
                        break;
                    }

                    successCount++;
                    
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

            await this.loadFiles(this.currentFolderId);
            await this.loadQuota();
            
            if (!App.uploadProgressState.cancelled && totalFiles > 1) {
                if (failedCount === 0) {
                    showToast(`All ${successCount} files uploaded successfully!`, 'success');
                } else if (successCount > 0) {
                    showToast(`${successCount} files uploaded, ${failedCount} failed`, 'info');
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
     * Upload file in chunks
     */
    async uploadFileInChunks(encryptedBlob, encryptedFilename, originalSize, encryptedFileKey, parentId, chunkSize, displayName) {
        const uploadId = this.generateUploadId();
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
     * Generate unique upload ID
     */
    generateUploadId() {
        return 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Download file with range-based parallel downloading
     */
    async downloadFile(fileId, filename) {
        try {
            showLoading(`Preparing download for ${filename}...`);

            // Get file size first
            const fileSize = await API.files.getFileSize(fileId);

            hideLoading();
            
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
            // Old format: [IV(12)] + [encrypted_data]
            // New format: [IV(12)] + [size(4) + chunkIV(12) + encrypted_data] + ...
            let decryptedData;

            try {
                // Try new chunked format first
                decryptedData = await CryptoUtils.decryptFileInChunks(
                    encryptedBlob,
                    this.masterKey,
                    (processed, total) => {
                        // Show decryption progress
                    }
                );
            } catch (error) {
                console.log('Trying legacy decryption format...');
                // Fall back to old format
                const encryptedData = await encryptedBlob.arrayBuffer();
                decryptedData = await CryptoUtils.decryptFile(encryptedData, this.masterKey);
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
            showToast(`${filename} downloaded successfully!`, 'success');
        } catch (error) {
            console.error('Download error:', error);
            showToast(error.message || 'Download failed', 'error');
            hideProgress('download');
            hideLoading();
        }
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
        if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
            return;
        }

        try {
            showLoading(`Deleting ${filename}...`);

            const response = await API.files.delete(fileId);
            if (!response.success) {
                throw new Error(response.message || 'Delete failed');
            }

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
     */
    async handleRename() {
        const newName = document.getElementById('rename-input').value.trim();
        if (!newName) {
            showToast('Please enter a name', 'error');
            return;
        }

        try {
            showLoading('Renaming...');

            // Encrypt new name
            const encryptedName = await CryptoUtils.encryptFilename(newName, this.masterKey);

            const response = await API.files.rename(this.selectedFileForRename, encryptedName);
            if (!response.success) {
                throw new Error(response.message || 'Rename failed');
            }

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

            // Get parent key (master key if root, or current folder's key)
            const parentKey = await this.getParentKey();

            // Generate new key for this folder
            const folderKey = CryptoUtils.generateItemKey();

            // Encrypt folder key with parent key
            const encryptedFolderKey = await CryptoUtils.encryptItemKey(folderKey, parentKey);

            // Encrypt folder name
            const encryptedName = await CryptoUtils.encryptFilename(folderName, this.masterKey);

            const response = await API.files.createFolder(encryptedName, encryptedFolderKey, this.currentFolderId);
            if (!response.success) {
                throw new Error(response.message || 'Failed to create folder');
            }

            closeNewFolderModal();
            showToast('Folder created successfully!', 'success');
            await this.loadFiles(this.currentFolderId);
            hideLoading();
        } catch (error) {
            console.error('Create folder error:', error);
            showToast(error.message || 'Failed to create folder', 'error');
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
     */
    async loadFolderTree() {
        try {
            showLoading('Loading folders...');

            const response = await API.files.list(null);
            if (!response.success) {
                throw new Error('Failed to load folders');
            }

            const allFiles = response.data.files || response.data;
            const folders = allFiles.filter(f => f.type === 'folder');

            const treeContainer = document.getElementById('folder-tree');
            treeContainer.innerHTML = '';

            // Root folder option
            const rootItem = document.createElement('div');
            rootItem.className = 'folder-item';
            rootItem.dataset.folderId = 'null';
            rootItem.innerHTML = `
                <i class="fas fa-home" style="margin-right: 8px;"></i>
                <span>Root</span>
            `;
            rootItem.onclick = () => this.selectMoveDestination(rootItem);
            treeContainer.appendChild(rootItem);

            // Decrypt and display folders
            for (const folder of folders) {
                if (folder.id === this.selectedFileForMove) continue; // Can't move to itself

                const folderItem = document.createElement('div');
                folderItem.className = 'folder-item';
                folderItem.dataset.folderId = folder.id;

                try {
                    const displayName = await CryptoUtils.decryptFilename(folder.encrypted_name, this.masterKey);
                    folderItem.innerHTML = `
                        <i class="fas fa-folder-open" style="margin-right: 8px;"></i>
                        <span>${escapeHtml(displayName)}</span>
                    `;
                    folderItem.onclick = () => this.selectMoveDestination(folderItem);
                    treeContainer.appendChild(folderItem);
                } catch (error) {
                    console.error('Failed to decrypt folder name:', error);
                }
            }

            hideLoading();
        } catch (error) {
            console.error('Load folder tree error:', error);
            showToast(error.message || 'Failed to load folders', 'error');
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
            showToast('Please select a destination folder', 'error');
            return;
        }

        const newParentId = selectedFolder.dataset.folderId === 'null' ? null : parseInt(selectedFolder.dataset.folderId);

        try {
            showLoading('Moving...');

            const response = await API.files.move(this.selectedFileForMove, newParentId);
            if (!response.success) {
                throw new Error(response.message || 'Move failed');
            }

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

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            showToast('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 4) {
            showToast('New password must be at least 4 characters', 'error');
            return;
        }

        try {
            showLoading('Changing password...');

            // Get current salts
            const saltResponse = await API.auth.getClientSalt(this.currentUser.username);
            if (!saltResponse.success) {
                throw new Error('Failed to get salts');
            }

            const currentClientSalt = CryptoUtils.hexToArrayBuffer(saltResponse.data.client_salt);
            const currentPasswordHash = await CryptoUtils.hashPassword(currentPassword, currentClientSalt);

            // Generate new salts
            const newClientSalt = CryptoUtils.generateSalt();
            const newKdfSalt = CryptoUtils.generateSalt();

            // Hash new password
            const newPasswordHash = await CryptoUtils.hashPassword(newPassword, newClientSalt);

            // Re-encrypt master key with new password
            const newPasswordKey = await CryptoUtils.deriveKey(newPassword, newKdfSalt);
            const newEncryptedMasterKey = await CryptoUtils.encryptMasterKey(this.masterKey, newPasswordKey);

            // Change password
            const response = await API.auth.changePassword(
                currentPasswordHash,
                newPasswordHash,
                CryptoUtils.arrayBufferToHex(newClientSalt),
                CryptoUtils.arrayBufferToHex(newKdfSalt),
                newEncryptedMasterKey
            );

            if (!response.success) {
                throw new Error(response.message || 'Failed to change password');
            }

            closeChangePasswordModal();
            showToast('Password changed successfully!', 'success');
            hideLoading();
        } catch (error) {
            console.error('Change password error:', error);
            showToast(error.message || 'Failed to change password', 'error');
            hideLoading();
        }
    }
};

// Utility Functions

function showLoading(text = 'Loading...') {
    document.getElementById('loading-overlay').classList.remove('hidden');
    document.getElementById('loading-text').textContent = text;
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

function updateLoadingText(text) {
    document.getElementById('loading-text').textContent = text;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<i class="fas fa-check-circle" stroke-width="2" style="color: #10b981;"></i>',
        error: '<i class="fas fa-exclamation-circle" stroke-width="2" style="color: #ef4444;"></i>',
        info: '<i class="fas fa-info-circle" stroke-width="2" style="color: #3b82f6;"></i>'
    };

    toast.innerHTML = `
        ${icons[type] || icons.info}
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatFileSize(bytes) {
    if (bytes === 0 || bytes === '0') return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;

    return date.toLocaleDateString();
}

// Modal control functions
function closeChangePasswordModal() {
    document.getElementById('change-password-modal').classList.add('hidden');
}

function closeRenameModal() {
    document.getElementById('rename-modal').classList.add('hidden');
}

function closeNewFolderModal() {
    document.getElementById('new-folder-modal').classList.add('hidden');
}

function closeMoveModal() {
    document.getElementById('move-modal').classList.add('hidden');
}

// ===== Progress Bar Functions =====

/**
 * Show progress bar
 * @param {string} type - 'upload' or 'download'
 * @param {string} filename - Name of the file
 * @param {number} total - Total size in bytes
 * @param {number} currentFile - Current file number (optional)
 * @param {number} totalFiles - Total number of files (optional)
 */
function showProgress(type, filename, total, currentFile = 1, totalFiles = 1) {
    const modal = document.getElementById(`${type}-progress-modal`);
    const title = document.getElementById(`${type}-progress-title`);
    const progressState = type === 'upload' ? App.uploadProgressState : App.downloadProgressState;
    
    progressState.isActive = true;
    progressState.startTime = Date.now();
    progressState.lastUpdate = Date.now();
    progressState.loaded = 0;
    progressState.total = total;
    progressState.speed = 0;
    progressState.filename = filename;
    progressState.cancelled = false;
    progressState.currentFile = currentFile;
    progressState.totalFiles = totalFiles;
    
    // Set title based on type and file count
    if (totalFiles > 1) {
        title.textContent = type === 'upload' 
            ? `Uploading (${currentFile}/${totalFiles})` 
            : `Downloading (${currentFile}/${totalFiles})`;
    } else {
        title.textContent = type === 'upload' ? 'Uploading' : 'Downloading';
    }
    
    document.getElementById(`${type}-progress-subtitle`).textContent = filename;
    document.getElementById(`${type}-progress-percentage`).textContent = '0%';
    document.getElementById(`${type}-progress-bar-fill`).style.width = '0%';
    document.getElementById(`${type}-progress-speed`).textContent = '-- KB/s';
    document.getElementById(`${type}-progress-size`).textContent = `0 / ${formatFileSize(total)}`;
    document.getElementById(`${type}-progress-time`).textContent = 'Calculating...';
    
    modal.classList.remove('hidden', 'complete');
}

/**
 * Update progress bar
 * @param {string} type - 'upload' or 'download'
 * @param {number} loaded - Bytes loaded
 * @param {number} total - Total bytes
 */
function updateProgress(type, loaded, total) {
    const progressState = type === 'upload' ? App.uploadProgressState : App.downloadProgressState;
    if (!progressState.isActive) return;
    
    const now = Date.now();
    const timeDiff = (now - progressState.lastUpdate) / 1000; // seconds
    
    if (timeDiff > 0.1) { // Update at most every 100ms
        const bytesDiff = loaded - progressState.loaded;
        const speed = bytesDiff / timeDiff; // bytes per second
        
        // Smooth speed calculation (exponential moving average)
        progressState.speed = progressState.speed * 0.7 + speed * 0.3;
        progressState.loaded = loaded;
        progressState.lastUpdate = now;
        
        // Update UI
        const percentage = Math.min(Math.round((loaded / total) * 100), 100);
        document.getElementById(`${type}-progress-percentage`).textContent = percentage + '%';
        document.getElementById(`${type}-progress-bar-fill`).style.width = percentage + '%';
        
        // Update speed
        const speedKB = progressState.speed / 1024;
        const speedMB = speedKB / 1024;
        let speedText;
        if (speedMB > 1) {
            speedText = speedMB.toFixed(2) + ' MB/s';
        } else {
            speedText = speedKB.toFixed(2) + ' KB/s';
        }
        document.getElementById(`${type}-progress-speed`).textContent = speedText;
        
        // Update size
        document.getElementById(`${type}-progress-size`).textContent = 
            `${formatFileSize(loaded)} / ${formatFileSize(total)}`;
        
        // Calculate time remaining
        if (progressState.speed > 0) {
            const remaining = (total - loaded) / progressState.speed;
            document.getElementById(`${type}-progress-time`).textContent = formatTime(remaining);
        }
    }
}

/**
 * Complete progress (show success state briefly then hide)
 * @param {string} type - 'upload' or 'download'
 */
function completeProgress(type) {
    const progressState = type === 'upload' ? App.uploadProgressState : App.downloadProgressState;
    if (!progressState.isActive) return;
    
    const modal = document.getElementById(`${type}-progress-modal`);
    const card = modal.querySelector('.progress-card');
    
    document.getElementById(`${type}-progress-percentage`).textContent = '100%';
    document.getElementById(`${type}-progress-bar-fill`).style.width = '100%';
    document.getElementById(`${type}-progress-subtitle`).textContent = 'Complete!';
    document.getElementById(`${type}-progress-time`).textContent = 'Done';
    
    card.classList.add('complete');
    
    // Hide after 2 seconds
    setTimeout(() => {
        hideProgress(type);
    }, 2000);
}

/**
 * Hide progress bar
 * @param {string} type - 'upload' or 'download'
 */
function hideProgress(type) {
    const modal = document.getElementById(`${type}-progress-modal`);
    const card = modal.querySelector('.progress-card');
    const progressState = type === 'upload' ? App.uploadProgressState : App.downloadProgressState;
    
    modal.classList.add('hidden');
    card.classList.remove('complete');
    progressState.isActive = false;
    progressState.cancelled = false;
    progressState.currentFile = 0;
    progressState.totalFiles = 0;
}

/**
 * Format time in seconds to human readable
 */
function formatTime(seconds) {
    if (seconds < 60) {
        return Math.round(seconds) + ' sec';
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return `${mins}m ${secs}s`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    }
}

// Add cancelProgress to App object
App.cancelProgress = function(type) {
    const progressState = type === 'upload' ? App.uploadProgressState : App.downloadProgressState;
    const operationType = type === 'upload' ? 'upload' : 'download';
    
    if (confirm(`Are you sure you want to cancel this ${operationType}?`)) {
        progressState.cancelled = true;
        hideProgress(type);
        showToast(`${operationType.charAt(0).toUpperCase() + operationType.slice(1)} cancelled`, 'info');
    }
};

function confirmMove() {
    App.confirmMove();
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
