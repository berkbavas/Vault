/**
 * Vault Drive - Main Application
 * Single Page Application for secure file management
 */

const App = {
    currentUser: null,
    masterKey: null,
    currentFolderId: null,
    files: [],
    folderHistory: [],
    selectedFileForRename: null,
    selectedFileForMove: null,

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
        const confirmPassword = document.getElementById('register-password-confirm').value;

        if (!username || !password || !confirmPassword) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        if (password.length < 8) {
            showToast('Password must be at least 8 characters', 'error');
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
        this.files = [];
        this.folderHistory = [];
        this.showAuth();
        showToast('Logged out successfully', 'info');
    },

    /**
     * Load files for current folder
     */
    async loadFiles(folderId = null) {
        try {
            showLoading('Loading files...');

            const response = await API.files.list(folderId);
            if (!response.success) {
                throw new Error(response.message || 'Failed to load files');
            }

            this.files = response.data.files;
            await this.renderFileList();
            this.updateBreadcrumb();

            hideLoading();
        } catch (error) {
            console.error('Load files error:', error);
            showToast(error.message || 'Failed to load files', 'error');
            hideLoading();
        }
    },

    /**
     * Render file list
     */
    async renderFileList() {
        const tbody = document.getElementById('file-list-body');
        tbody.innerHTML = '';

        if (this.files.length === 0) {
            document.querySelector('.file-list').style.display = 'none';
            document.getElementById('empty-state').classList.remove('hidden');
            return;
        }

        document.querySelector('.file-list').style.display = 'table';
        document.getElementById('empty-state').classList.add('hidden');

        for (const file of this.files) {
            const tr = document.createElement('tr');

            // Decrypt filename
            let displayName = 'Decrypting...';
            try {
                displayName = await CryptoUtils.decryptFilename(file.encrypted_name, this.masterKey);
            } catch (error) {
                console.error('Failed to decrypt filename:', error);
                displayName = '[Decryption failed]';
            }

            // Name column
            const nameTd = document.createElement('td');
            const nameDiv = document.createElement('div');
            nameDiv.className = 'file-name';
            if (file.is_folder === '1') {
                nameDiv.onclick = () => this.openFolder(file.id, displayName);
            }
            nameDiv.innerHTML = `
                <svg class="file-icon ${file.is_folder === '1' ? 'folder' : 'file'}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    ${file.is_folder === '1'
                    ? '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>'
                    : '<path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>'
                }
                </svg>
                <span>${escapeHtml(displayName)}</span>
            `;
            nameTd.appendChild(nameDiv);
            tr.appendChild(nameTd);

            // Size column
            const sizeTd = document.createElement('td');
            sizeTd.className = 'text-secondary';
            sizeTd.textContent = file.is_folder === '1' ? '—' : formatFileSize(file.original_size);
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

            if (file.is_folder === '0') {
                actionsDiv.innerHTML += `
                    <button class="action-btn" onclick="App.downloadFile(${file.id}, '${escapeHtml(displayName)}')" title="Download">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5m0 0l5-5m-5 5V3" stroke-width="2"/>
                        </svg>
                    </button>
                `;
            }

            actionsDiv.innerHTML += `
                <button class="action-btn" onclick="App.showRenameModal(${file.id}, '${escapeHtml(displayName)}')" title="Rename">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-width="2"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="2"/>
                    </svg>
                </button>
                <button class="action-btn" onclick="App.showMoveModal(${file.id})" title="Move">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" stroke-width="2"/>
                        <polyline points="13 2 13 9 20 9" stroke-width="2"/>
                    </svg>
                </button>
                <button class="action-btn danger" onclick="App.deleteFile(${file.id}, '${escapeHtml(displayName)}')" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="3 6 5 6 21 6" stroke-width="2"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke-width="2"/>
                    </svg>
                </button>
            `;

            actionsTd.appendChild(actionsDiv);
            tr.appendChild(actionsTd);

            tbody.appendChild(tr);
        }
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
        homeLink.textContent = 'Home';
        homeLink.onclick = (e) => {
            e.preventDefault();
            this.navigateToRoot();
        };
        breadcrumb.appendChild(homeLink);

        // Folder path
        for (let i = 0; i < this.folderHistory.length; i++) {
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '/';
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
     * Handle file upload
     */
    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        try {
            showLoading(`Uploading ${files.length} file(s)...`);

            for (const file of files) {
                // Read file
                const fileData = await file.arrayBuffer();

                // Encrypt file
                const encryptedData = await CryptoUtils.encryptFile(fileData, this.masterKey);

                // Encrypt filename
                const encryptedName = await CryptoUtils.encryptFilename(file.name, this.masterKey);

                // Upload
                const blob = new Blob([encryptedData]);
                const response = await API.files.upload(
                    blob,
                    encryptedName,
                    file.size,
                    this.currentFolderId,
                    (loaded, total) => {
                        const percent = Math.round((loaded / total) * 100);
                        updateLoadingText(`Uploading ${file.name}: ${percent}%`);
                    }
                );

                if (!response.success) {
                    throw new Error(response.message || `Failed to upload ${file.name}`);
                }
            }

            showToast(`${files.length} file(s) uploaded successfully!`, 'success');
            await this.loadFiles(this.currentFolderId);
            hideLoading();
        } catch (error) {
            console.error('Upload error:', error);
            showToast(error.message || 'Upload failed', 'error');
            hideLoading();
        }
    },

    /**
     * Download file
     */
    async downloadFile(fileId, filename) {
        try {
            showLoading(`Downloading ${filename}...`);

            const response = await API.files.download(fileId);
            if (!response.ok) {
                throw new Error('Download failed');
            }

            const encryptedData = await response.arrayBuffer();

            // Decrypt file
            const decryptedData = await CryptoUtils.decryptFile(encryptedData, this.masterKey);

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

            showToast(`${filename} downloaded successfully!`, 'success');
            hideLoading();
        } catch (error) {
            console.error('Download error:', error);
            showToast(error.message || 'Download failed', 'error');
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

            const response = await API.files.delete(fileId);
            if (!response.success) {
                throw new Error(response.message || 'Delete failed');
            }

            showToast(`${filename} deleted successfully!`, 'success');
            await this.loadFiles(this.currentFolderId);
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

            // Encrypt folder name
            const encryptedName = await CryptoUtils.encryptFilename(folderName, this.masterKey);

            const response = await API.files.createFolder(encryptedName, this.currentFolderId);
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

            const allFiles = response.data;
            const folders = allFiles.filter(f => f.is_folder === '1');

            const treeContainer = document.getElementById('folder-tree');
            treeContainer.innerHTML = '';

            // Root folder option
            const rootItem = document.createElement('div');
            rootItem.className = 'folder-item';
            rootItem.dataset.folderId = 'null';
            rootItem.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke-width="2"/>
                </svg>
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
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke-width="2"/>
                        </svg>
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

        if (newPassword.length < 8) {
            showToast('New password must be at least 8 characters', 'error');
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
        success: '<path d="M20 6L9 17l-5-5" stroke-width="2"/>',
        error: '<path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2"/>',
        info: '<path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2"/>'
    };

    toast.innerHTML = `
        <svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            ${icons[type] || icons.info}
        </svg>
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

function confirmMove() {
    App.confirmMove();
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
