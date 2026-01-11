const Dashboard = {
    MAX_NAME_LENGTH: 255, // Maximum characters allowed for file and folder names
    MAX_QUOTA: 52428800,  // 50 MB in bytes

    user: null,
    userQuota: { used: 0, quota: 52428800, remaining: 52428800, percentage: 0 },
    currentFolderId: null,
    files: [],
    activeNotifications: [],
    masterKey: null,
    confirmResolve: null,

    async init() {
        API.init();
        await this.redirectIfNotLoggedIn();
        this.loadUsername();
        this.loadUserQuota();
        await this.loadFiles();
        this.setupEventListeners();
    },

    async redirectIfNotLoggedIn() {
        const response = await API.auth.me();
        if (!API.getMasterKey() || !response.success) {
            API.clearToken();
            API.clearMasterKey();
            window.location.href = 'login.php';
            return;
        }

        this.masterKey = await CryptoUtils.importMasterKey(API.getMasterKey());
        this.user = response.data;
    },

    loadUsername() {
        const username = document.getElementById('username');
        if (this.user && username) {
            username.textContent = this.user.username;
        }

    },

    loadUserQuota() {
        if (this.user) {
            this.userQuota.used = this.user.storage_used;
            this.userQuota.quota = this.user.storage_quota;
            this.userQuota.remaining = this.userQuota.quota - this.userQuota.used;
            this.userQuota.percentage = (this.userQuota.used / this.userQuota.quota) * 100;

            const quotaBar = document.getElementById('quotaBar');
            const quotaUsed = document.getElementById('quotaUsed');
            const quotaTotal = document.getElementById('quotaTotal');
            const quotaPercentage = document.getElementById('quotaPercentage');
            const quotaFill = document.getElementById('quotaFill');

            if (!quotaBar) return;

            quotaBar.style.display = 'block';

            const usedMB = this.formatFileSize(this.userQuota.used);
            const totalMB = this.formatFileSize(this.userQuota.quota);
            const percentage = this.userQuota.percentage;

            if (quotaUsed) quotaUsed.textContent = usedMB;
            if (quotaTotal) quotaTotal.textContent = totalMB;
            if (quotaPercentage) quotaPercentage.textContent = percentage.toFixed(1) + '%';
            if (quotaFill) {
                quotaFill.style.width = percentage + '%';

                // Change color based on usage
                if (percentage >= 90) {
                    quotaFill.style.backgroundColor = '#ef4444';
                } else if (percentage >= 75) {
                    quotaFill.style.backgroundColor = '#f59e0b';
                } else {
                    quotaFill.style.backgroundColor = '#3b82f6';
                }
            }
        }
        else {
            this.showNotification('Failed to load quota', 'error');
        }
    },

    async loadFiles() {
        try {
            const response = await API.files.list(this.currentFolderId);
            if (response.success && response.data) {
                this.files = response.data.files || [];
                await this.decryptFileNames(this.files, this.masterKey);
                await this.displayFiles(this.files);
            } else {
                throw new Error(response.message || 'Failed to load files');
            }
        } catch (error) {
            console.error('Load files error:', error);
            this.showNotification('Failed to load files: ' + error.message, 'error');
        }
    },

    async decryptFileNames(files, masterKey) {
        return Promise.all(files.map(async (file) => {
            if (file.encrypted_name) {
                try {
                    file.decrypted_name = await CryptoUtils.decryptFilename(file.encrypted_name, masterKey);
                } catch (error) {
                    file.decrypted_name = '[Decryption Error]';
                }
            }
            return file;
        }));
    },


    async displayFiles(files) {
        const container = document.getElementById('file-container');
        const searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();
        container.innerHTML = '';
        let filteredFiles = files;
        if (searchQuery) {
            filteredFiles = files.filter(file => {
                const name = (file.decrypted_name || '').toLowerCase();
                return name.includes(searchQuery);
            });
        }

        if (filteredFiles.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h4>${searchQuery ? 'No matches' : 'No files or folders'}</h4>
                <p>${searchQuery ? 'Try a different search.' : 'Upload files or create folders to get started'}</p>
            </div>
        `;
        }
        else {
            container.innerHTML = `
                    <div class="file-grid">
                        ${filteredFiles.map(file => this.createFileCard(file)).join('')}
                    </div>
                    <div class="files-table-wrapper">
                        <table class="file-table">
                            <thead>
                                <tr>
                                    <th class="file-checkbox-header">
                                        <input type="checkbox" id="selectAll" onchange="toggleSelectAll(this.checked)" title="Select All">
                                    </th>
                                    <th class="file-icon-header"></th>
                                    <th class="file-name">Name</th>
                                    <th>Size</th>
                                    <th>Date Modified</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredFiles.map(file => this.createFileRow(file)).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
        }
    },

    createFileRow(file) {
        const isFolder = file.type === 'folder';
        const icon = this.getFileIcon(file);
        const displayName = file.decrypted_name;
        const displayNameEnc = encodeURIComponent(displayName);
        const size = isFolder ? '—' : this.formatFileSize(file.original_size);
        const date = new Date(file.updated_at || file.created_at).toLocaleDateString();
        const escapedName = this.escapeHtml(displayName);
        const displayNameAttr = this.escapeAttr(displayName);
        return `
        <tr class="file-row" data-id="${file.id}" data-type="${file.type}" data-name="${displayNameAttr}" onclick="selectRow(this)">
            <td class="file-checkbox-cell" onclick="event.stopPropagation();">
                <input type="checkbox" class="file-checkbox" data-id="${file.id}" onchange="toggleFileSelection(${file.id}, this.checked)">
            </td>
            <td class="file-icon-cell" ondblclick="${isFolder ? `navigateToFolder(${file.id}, '${displayNameEnc}')` : `downloadFileById(${file.id})`}">
                <i class="${icon.icon} ${icon.class}"></i>
            </td>
            <td class="file-name-cell" ondblclick="${isFolder ? `navigateToFolder(${file.id}, '${displayNameEnc}')` : `downloadFileById(${file.id})`}" title="${displayNameAttr}">
                ${escapedName}
            </td>
            <td class="file-size-cell">${size}</td>
            <td class="file-date-cell">${date}</td>
            <td class="file-actions-cell" onclick="event.stopPropagation();">
                ${isFolder ? '' : `<button class="btn-icon-sm" onclick="event.stopPropagation(); downloadFileById(${file.id})" title="Download">
                    <i class="fas fa-download"></i>
                </button>`}
                <button class="btn-icon-sm" onclick="event.stopPropagation(); showMoveModalById(${file.id}, '${displayNameEnc}', '${file.type}')" title="Move">
                    <i class="fas fa-arrows-alt"></i>
                </button>
                <button class="btn-icon-sm" onclick="event.stopPropagation(); renameItemById(${file.id}, '${displayNameEnc}', '${file.type}')" title="Rename">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon-sm btn-danger" onclick="event.stopPropagation(); deleteItemById(${file.id}, '${displayNameEnc}', '${file.type}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>   
            </td>
        </tr>
    `;
    },

    createFileCard(file) {
        const isFolder = file.type === 'folder';
        const icon = this.getFileIcon(file);
        const displayName = file.decrypted_name;
        const displayNameEnc = encodeURIComponent(displayName);
        const size = isFolder ? '' : this.formatFileSize(file.original_size);
        const date = new Date(file.updated_at || file.created_at).toLocaleDateString();
        const escapedName = this.escapeHtml(displayName);
        const displayNameAttr = this.escapeAttr(displayName);

        return `
        <div class="file-card" data-id="${file.id}" data-type="${file.type}" data-name="${displayNameAttr}" onclick="selectRow(this)">
            <div class="file-card-checkbox" onclick="event.stopPropagation();">
                <input type="checkbox" class="file-checkbox" data-id="${file.id}" onchange="toggleFileSelection(${file.id}, this.checked)">
            </div>
            <div class="file-card-icon" ondblclick="${isFolder ? `navigateToFolder(${file.id}, '${displayNameEnc}')` : `downloadFileById(${file.id})`}">
                <i class="${icon.icon} ${icon.class}"></i>
            </div>
            <div class="file-card-info" ondblclick="${isFolder ? `navigateToFolder(${file.id}, '${displayNameEnc}')` : `downloadFileById(${file.id})`}">
                <div class="file-card-name" title="${displayNameAttr}">${escapedName}</div>
                ${isFolder ? '<div class="file-card-meta">Folder</div>' : `<div class="file-card-meta">${size} • ${date}</div>`}
            </div>
            <div class="file-card-actions">
                ${isFolder ? '' : `<button class="btn-icon-sm" onclick="downloadFileById(${file.id})" title="Download">
                    <i class="fas fa-download"></i>
                </button>`}
                <button class="btn-icon-sm" onclick="showMoveModalById(${file.id}, '${displayNameEnc}', '${file.type}')" title="Move">
                    <i class="fas fa-arrows-alt"></i>
                </button>
                <button class="btn-icon-sm" onclick="renameItemById(${file.id}, '${displayNameEnc}', '${file.type}')" title="Rename">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon-sm btn-danger" onclick="deleteItemById(${file.id}, '${displayNameEnc}', '${file.type}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    },


    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    escapeAttr(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    getFileIcon(file) {
        if (file.type === 'folder') {
            return { icon: 'fas fa-folder', class: 'folder' };
        }

        const nameForExt = (file.decrypted_name || '').toLowerCase();
        const ext = nameForExt.includes('.') ? nameForExt.split('.').pop() : '';
        const mimeType = file.mime_type || '';

        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(ext) || mimeType.startsWith('image/')) {
            return { icon: 'fas fa-image', class: 'image' };
        }

        if (['mp4', 'avi', 'mov', 'wmv', 'flv'].includes(ext) || mimeType.startsWith('video/')) {
            return { icon: 'fas fa-video', class: 'video' };
        }

        if (['doc', 'docx', 'pdf', 'txt', 'rtf'].includes(ext)) {
            return { icon: 'fas fa-file-alt', class: 'document' };
        }

        if (['mp3', 'wav', 'ogg'].includes(ext) || mimeType.startsWith('audio/')) {
            return { icon: 'fas fa-music', class: 'audio' };
        }

        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mimeType === 'application/zip') {
            return { icon: 'fas fa-file-archive', class: 'archive' };
        }

        if (['xls', 'xlsx', 'csv'].includes(ext)) {
            return { icon: 'fas fa-file-excel', class: 'spreadsheet' };
        }

        if (['ppt', 'pptx'].includes(ext)) {
            return { icon: 'fas fa-file-powerpoint', class: 'presentation' };
        }

        if (['html', 'css', 'js', 'php', 'py', 'java', 'c', 'cpp'].includes(ext) || mimeType === 'text/html') {
            return { icon: 'fas fa-file-code', class: 'code' };
        }

        if (['json', 'xml', 'yml', 'yaml'].includes(ext) || mimeType === 'application/json') {
            return { icon: 'fas fa-file-code', class: 'code' };
        }

        if (['exe', 'msi', 'dmg'].includes(ext) || mimeType === 'application/x-msdownload') {
            return { icon: 'fas fa-cogs', class: 'executable' };
        }


        return { icon: 'fas fa-file', class: 'file' };
    },

    refreshFiles() {
        this.loadFiles();
        this.showNotification('Files refreshed', 'success');
    },

    triggerFileUpload() {
        document.getElementById('file-input').click();
    },

    async createFolder() {
        const nameInput = document.getElementById('folderName');
        const name = nameInput.value.trim();

        try {
            if (!this.masterKey) {
                throw new Error('Session expired. Please login again.');
            }

            if (!name) {
                throw new Error('Please enter a folder name');
            }

            // Validate folder name length
            if (name.length > this.MAX_NAME_LENGTH) {
                throw new Error(`Folder name must be ${this.MAX_NAME_LENGTH} characters or less`);
            }

            const encryptedFolderName = await CryptoUtils.encryptFilename(name, this.masterKey);
            const response = await API.files.createFolder(encryptedFolderName, this.currentFolderId);

            if (response.success) {
                this.showNotification('Folder created successfully', 'success');
                this.closeModal('createFolderModal');
                nameInput.value = ''; // Clear input
                this.loadFiles();
            } else {
                throw new Error(response.message || 'Failed to create folder');
            }
        }
        catch (error) {
            this.showNotification(error.message, 'error');
        }
    },

    showCreateFolderModal() {
        const modal = document.getElementById('createFolderModal');
        const input = document.getElementById('folderName');

        modal.style.display = 'block';
        input.value = ''; // Clear previous value
        input.focus();

        // Add Enter key listener
        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.createFolder();
                input.removeEventListener('keypress', handleEnter);
            }
        };
        input.addEventListener('keypress', handleEnter);
    },

    async deleteSelected() {
        if (selectedItems.size === 0) {
            this.showNotification('No items selected', 'error');
            return;
        }

        const confirmed = await this.showConfirm('Delete Multiple Items', `Are you sure you want to delete ${selectedItems.size} item(s)?`);
        if (!confirmed) {
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const itemId of selectedItems) {
            try {
                const result = await API.files.delete(itemId);
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
            }
        }

        this.selectedItems.clear();
        this.updateDeleteButton();

        if (successCount > 0) {
            this.showNotification(`Successfully deleted ${successCount} item(s)`, 'success');
        }
        if (errorCount > 0) {
            this.showNotification(`Failed to delete ${errorCount} item(s)`, 'error');
        }

        this.loadFiles();
        this.loadQuota(); // Refresh quota after deletion
    },

    setupEventListeners() {
        Object.assign(window, {
            triggerFileUpload: this.triggerFileUpload.bind(this),
            refreshFiles: this.refreshFiles.bind(this),
            showCreateFolderModal: this.showCreateFolderModal.bind(this),
            createFolder: this.createFolder.bind(this),
            deleteSelected: this.deleteSelected.bind(this),
        });
    },

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification-toast';
        notification.style.cssText = `
        position: fixed;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
        border-radius: 5px;
        z-index: 2000;
        max-width: 400px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        opacity: 0;
        transform: translateX(400px);
        transition: opacity 0.3s ease, transform 0.3s ease, top 0.3s ease;
    `;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Calculate position based on existing notifications
        const calculateTop = () => {
            let top = 20;
            this.activeNotifications.forEach(n => {
                if (n.element && n.element.parentNode) {
                    top += n.element.offsetHeight + 10;
                }
            });
            return top;
        };

        // Set initial position and trigger animation
        notification.style.top = calculateTop() + 'px';

        // Add to active notifications
        const notificationData = { element: notification };
        this.activeNotifications.push(notificationData);

        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);

        const repositionNotifications = () => {
            let top = 20;
            this.activeNotifications.forEach(n => {
                if (n.element && n.element.parentNode) {
                    n.element.style.top = top + 'px';
                    top += n.element.offsetHeight + 10;
                }
            });
        };

        // Remove notification after timeout
        const removeNotification = () => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(400px)';

            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
                // Remove from active notifications
                const index = this.activeNotifications.indexOf(notificationData);
                if (index > -1) {
                    this.activeNotifications.splice(index, 1);
                }
                // Reposition remaining notifications
                repositionNotifications();
            }, 300);
        };

        setTimeout(removeNotification, 5000);

        // Allow click to dismiss
        notification.style.cursor = 'pointer';
        notification.addEventListener('click', removeNotification);
    },

    showConfirm(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('customConfirmModal');
            const titleEl = document.getElementById('confirmTitle');
            const messageEl = document.getElementById('confirmMessage');

            titleEl.textContent = title;
            messageEl.textContent = message;
            modal.style.display = 'block';

            this.confirmResolve = resolve;
        });
    },

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Dashboard.init();
});