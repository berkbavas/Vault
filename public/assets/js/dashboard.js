

const MAX_NAME_LENGTH = 255; // Maximum characters allowed for file and folder names
const MAX_QUOTA = 524288000;

// Dashboard File Manager JavaScript
let currentFolderId = null;
let selectedItem = null;
let breadcrumbPath = [];
let selectedItems = new Set();
let lastLoadedItems = [];
let userQuota = { used: 0, quota: MAX_QUOTA, remaining: MAX_QUOTA, percentage: 0 };
let masterKey = null;

// Initialize
document.addEventListener('DOMContentLoaded', async function () {
    API.init();
    masterKey = await CryptoUtils.getMasterKeyFromSession();

    const response = await API.auth.me();

    if (!masterKey || !response.success) {
        sessionStorage.clear();
        window.location.href = 'login.php';
        return;
    }

    loadFiles();
    loadQuota();
    setupEventListeners();
});

function getUploadProgressEls() {
    return {
        wrap: document.getElementById('uploadProgress'),
        name: document.getElementById('uploadProgressName'),
        pct: document.getElementById('uploadProgressPct'),
        fill: document.getElementById('uploadProgressFill'),
        bar: document.querySelector('#uploadProgress .up-bar'),
        sub: document.getElementById('uploadProgressSub')
    };
}

function showUploadProgress({ filename = 'Uploading…', percent = 0, sub = '' } = {}) {
    const el = getUploadProgressEls();
    if (!el.wrap) return;
    el.wrap.hidden = false;
    if (el.name) el.name.textContent = filename;
    updateUploadProgress(percent, sub);
}

function updateUploadProgress(percent, sub = '') {
    const el = getUploadProgressEls();
    if (!el.wrap) return;
    const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    if (el.pct) el.pct.textContent = `${p}%`;
    if (el.fill) el.fill.style.width = `${p}%`;
    if (el.bar) el.bar.setAttribute('aria-valuenow', String(p));
    if (el.sub) el.sub.textContent = sub;
}

function hideUploadProgress() {
    const el = getUploadProgressEls();
    if (!el.wrap) return;
    el.wrap.hidden = true;
}

function getDownloadProgressEls() {
    return {
        wrap: document.getElementById('downloadProgress'),
        name: document.getElementById('downloadProgressName'),
        pct: document.getElementById('downloadProgressPct'),
        fill: document.getElementById('downloadProgressFill'),
        bar: document.querySelector('#downloadProgress .up-bar'),
        sub: document.getElementById('downloadProgressSub')
    };
}

function showDownloadProgress({ filename = 'Uploading…', percent = 0, sub = '' } = {}) {
    const el = getDownloadProgressEls();
    if (!el.wrap) return;
    el.wrap.hidden = false;
    if (el.name) el.name.textContent = filename;
    updateDownloadProgress(percent, sub);
}

function updateDownloadProgress(percent, sub = '') {
    const el = getDownloadProgressEls();
    if (!el.wrap) return;
    const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    if (el.pct) el.pct.textContent = `${p}%`;
    if (el.fill) el.fill.style.width = `${p}%`;
    if (el.bar) el.bar.setAttribute('aria-valuenow', String(p));
    if (el.sub) el.sub.textContent = sub;
}

function hideDownloadProgress() {
    const el = getDownloadProgressEls();
    if (!el.wrap) return;
    el.wrap.hidden = true;
}

// Load user quota information
async function loadQuota() {
    try {
        const response = await API.auth.me();

        if (response.success) {
            userQuota.used = response.data.storage_used;
            userQuota.quota = response.data.storage_quota;
            userQuota.remaining = userQuota.quota - userQuota.used;
            userQuota.percentage = (userQuota.used / userQuota.quota) * 100;
            displayQuota();
        }
        else {
            throw new Error(response.message || 'Failed to retrieve quota information');
        }
    } catch (error) {
        showNotification('Failed to load quota: ' + error.message, 'error');
    }
}

// Display quota information
function displayQuota() {
    const quotaBar = document.getElementById('quotaBar');
    const quotaUsed = document.getElementById('quotaUsed');
    const quotaTotal = document.getElementById('quotaTotal');
    const quotaPercentage = document.getElementById('quotaPercentage');
    const quotaFill = document.getElementById('quotaFill');

    if (!quotaBar) return;

    quotaBar.style.display = 'block';

    const usedMB = (userQuota.used / (1024 * 1024)).toFixed(2);
    const totalMB = (userQuota.quota / (1024 * 1024)).toFixed(0);
    const percentage = userQuota.percentage;

    if (quotaUsed) quotaUsed.textContent = usedMB + ' MB';
    if (quotaTotal) quotaTotal.textContent = totalMB + ' MB';
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

function setupEventListeners() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('file-input');

    // Drop zone events
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Hide context menu when clicking elsewhere
    document.addEventListener('click', hideContextMenu);

    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => {
        // re-render from cached items
        displayFiles(lastLoadedItems);
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = e.dataTransfer.files;
    uploadFiles(files);
}

async function handleFileSelect(e) {
    const files = e.target.files;
    await uploadFiles(files);

    // Clear the input so same file can be selected again if needed
    e.target.value = '';
}

function triggerFileUpload() {
    document.getElementById('file-input').click();
}

async function uploadFiles(files) {
    if (!masterKey) {
        showNotification('Session expired. Please login again.', 'error');
        setTimeout(() => { window.location.href = 'login.php'; }, 2000);
        return;
    }

    // Calculate total upload size
    const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);

    // Check if upload would exceed quota
    if (userQuota.remaining < totalSize) {
        const remainingMB = (userQuota.remaining / (1024 * 1024)).toFixed(2);
        const neededMB = (totalSize / (1024 * 1024)).toFixed(2);
        showAlert('Storage Quota Exceeded', `You have ${remainingMB} MB remaining, but need ${neededMB} MB for this upload.\n\nPlease delete some files to free up space.`);
        return;
    }

    // Upload sequentially (simple UX, consistent progress bar)
    for (let file of files) {
        // Validate filename length
        if (file.name.length > MAX_NAME_LENGTH) {
            showNotification(`Filename "${file.name}" is too long. Maximum ${MAX_NAME_LENGTH} characters allowed.`, 'error');
            continue;
        }

        showUploadProgress({ filename: file.name, percent: 0, sub: 'Encrypting…' });

        try {
            // Read file as ArrayBuffer
            const fileBuffer = await file.arrayBuffer();

            // Encrypt file content
            const encryptedFileBuffer = await CryptoUtils.encryptFile(fileBuffer, masterKey);

            // Encrypt filename
            const encryptedFilename = await CryptoUtils.encryptFilename(file.name, masterKey);

            // Create encrypted blob
            const encryptedBlob = new Blob([encryptedFileBuffer], { type: 'application/octet-stream' });

            updateUploadProgress(0, 'Uploading…');

            // Use chunked upload for files larger than 5MB
            const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
            const USE_CHUNKED_UPLOAD = encryptedBlob.size > 5 * 1024 * 1024;

            if (USE_CHUNKED_UPLOAD) {
                // Upload using chunks
                const response = await uploadFileInChunks(
                    encryptedBlob,
                    encryptedFilename,
                    file.size,
                    currentFolderId,
                    CHUNK_SIZE
                );

                if (response.success) {
                    updateUploadProgress(100, 'Done');
                    showNotification('File uploaded successfully: ' + file.name, 'success');
                } else {
                    showNotification('Upload failed: ' + (response.message || 'Unknown error'), 'error');
                }
            } else {
                // Standard upload for small files
                const response = await API.files.upload(
                    encryptedBlob,
                    encryptedFilename,
                    file.size,
                    currentFolderId,
                    (loaded, total) => {
                        const percent = (loaded / total) * 100;
                        updateUploadProgress(percent, 'Uploading…');
                    }
                );

                if (response.success) {
                    updateUploadProgress(100, 'Done');
                    showNotification('File uploaded successfully: ' + file.name, 'success');
                } else {
                    showNotification('Upload failed: ' + (response.message || 'Unknown error'), 'error');
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
            showNotification('Upload failed: ' + error.message, 'error');
        }
    }

    setTimeout(hideUploadProgress, 1000);
    loadFiles();
    loadQuota();
}

/**
 * Upload a file in chunks
 */
async function uploadFileInChunks(encryptedBlob, encryptedFilename, originalSize, parentId, chunkSize) {
    const uploadId = generateUploadId();
    const totalSize = encryptedBlob.size;
    const totalChunks = Math.ceil(totalSize / chunkSize);

    let uploadedBytes = 0;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, totalSize);
        const chunkBlob = encryptedBlob.slice(start, end);

        updateUploadProgress(
            (uploadedBytes / totalSize) * 100,
            `Uploading chunk ${chunkIndex + 1}/${totalChunks}…`
        );

        const response = await API.files.uploadChunk(
            uploadId,
            chunkIndex,
            chunkBlob,
            (loaded, total) => {
                const chunkProgress = (uploadedBytes + loaded) / totalSize * 100;
                updateUploadProgress(
                    chunkProgress,
                    `Uploading chunk ${chunkIndex + 1}/${totalChunks}…`
                );
            }
        );

        if (!response.success) {
            throw new Error(response.message || 'Chunk upload failed');
        }

        uploadedBytes += chunkBlob.size;
    }

    // Finalize upload
    updateUploadProgress(100, 'Finalizing…');
    const finalizeResponse = await API.files.finalizeUpload(
        uploadId,
        encryptedFilename,
        originalSize,
        totalChunks,
        parentId
    );

    return finalizeResponse;
}

/**
 * Generate a unique upload ID
 */
function generateUploadId() {
    return 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function loadFiles() {
    try {
        const response = await API.files.list(currentFolderId);
        if (response.success && response.data) {
            lastLoadedItems = response.data.files || [];
            await decryptFileNames(lastLoadedItems, masterKey);
            await displayFiles(lastLoadedItems);
        } else {
            throw new Error(response.message || 'Failed to load files');
        }
    } catch (error) {
        console.error('Load files error:', error);
        showNotification('Failed to load files: ' + error.message, 'error');
    }
}


async function decryptFileNames(files, masterKey) {
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
}

async function displayFiles(files) {
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
                        ${filteredFiles.map(file => createFileCard(file)).join('')}
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
                                ${filteredFiles.map(file => createFileRow(file)).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
    }
}

function createFileRow(file) {
    const isFolder = file.type === 'folder';
    const icon = getFileIcon(file);
    const displayName = file.decrypted_name;
    const displayNameEnc = encodeURIComponent(displayName);
    const size = isFolder ? '—' : formatFileSize(file.original_size);
    const date = new Date(file.updated_at || file.created_at).toLocaleDateString();
    const escapedName = escapeHtml(displayName);
    const displayNameAttr = escapeAttr(displayName);
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
}

function createFileCard(file) {
    const isFolder = file.type === 'folder';
    const icon = getFileIcon(file);
    const displayName = file.decrypted_name;
    const displayNameEnc = encodeURIComponent(displayName);
    const size = isFolder ? '' : formatFileSize(file.original_size);
    const date = new Date(file.updated_at || file.created_at).toLocaleDateString();
    const escapedName = escapeHtml(displayName);
    const displayNameAttr = escapeAttr(displayName);

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
}

function escapeAttr(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getFileIcon(file) {
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
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function selectRow(row) {
    document.querySelectorAll('.file-row.selected, .file-card.selected').forEach(el => {
        el.classList.remove('selected');
    });
    row.classList.add('selected');
    selectedItem = {
        id: row.dataset.id,
        type: row.dataset.type,
        name: row.dataset.name
    };
}

async function downloadFileById(fileId) {
    if (!masterKey) {
        showNotification('Session expired. Please login again.', 'error');
        return;
    }

    try {
        // Find file info from loaded items to get decrypted name
        const fileInfo = lastLoadedItems.find(f => f.id == fileId);
        const displayName = fileInfo?.decrypted_name || 'file';

        showDownloadProgress({ filename: displayName, percent: 0, sub: 'Downloading...' });

        // Fetch encrypted file
        const response = await API.files.download(fileId);

        if (!response.ok) {
            throw new Error('Download failed');
        }

        const contentLength = response.headers.get("Content-Length");
        const total = parseInt(contentLength, 10);
        let loaded = 0;

        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            loaded += value.length;

            if (total) {
                const percent = (loaded / total) * 100;
                updateDownloadProgress(percent, 'Downloading...');
            }
        }

        updateDownloadProgress(100, 'Decrypting...');

        const encryptedBlob = new Blob(chunks);
        const encryptedBuffer = await encryptedBlob.arrayBuffer();

        // Decrypt file
        const decryptedBuffer = await CryptoUtils.decryptFile(encryptedBuffer, masterKey);

        // Create download
        const blob = new Blob([decryptedBuffer]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = displayName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('File downloaded successfully', 'success');
        setTimeout(hideDownloadProgress, 1000);
    } catch (error) {
        console.error('Download error:', error);
        hideDownloadProgress();
        showNotification('Download failed: ' + error.message, 'error');
    }
}

function renameItemById(itemId, currentName, itemType) {
    selectedItem = { id: itemId, name: decodeURIComponent(currentName || ''), type: itemType };
    showRenameModal();
}

function showMoveModalById(itemId, itemName, itemType) {
    selectedItem = { id: itemId, name: decodeURIComponent(itemName || ''), type: itemType };
    showMoveModal();
}

function deleteItemById(itemId, itemName, itemType) {
    selectedItem = { id: itemId, name: decodeURIComponent(itemName || ''), type: itemType };
    deleteItem();
}

function navigateToFolder(folderId, folderNameEnc = null) {
    if (folderId === null) {
        // Navigate to root
        currentFolderId = null;
        breadcrumbPath = [];
    } else {
        currentFolderId = folderId;
        if (folderNameEnc) {
            const folderName = decodeURIComponent(folderNameEnc);
            breadcrumbPath.push({ id: folderId, name: folderName });
        }
    }

    selectedItems.clear();
    updateBreadcrumb();
    loadFiles();
}

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    let html = `<span class="crumb ${breadcrumbPath.length === 0 ? 'active' : ''}" onclick="navigateToFolder(null)">
        <i class="fas fa-house"></i> Home
    </span>`;

    breadcrumbPath.forEach((folder, index) => {
        html += ` <span class="crumb-sep"><i class="fas fa-chevron-right"></i></span> `;
        html += `<span class="crumb ${index === breadcrumbPath.length - 1 ? 'active' : ''}" onclick="navigateToBreadcrumb(${index})">${escapeHtml(folder.name)}</span>`;
    });

    breadcrumb.innerHTML = html;
}

function navigateToBreadcrumb(index) {
    breadcrumbPath = breadcrumbPath.slice(0, index + 1);
    currentFolderId = breadcrumbPath[index].id;
    updateBreadcrumb();
    loadFiles();
}

function refreshFiles() {
    loadFiles();
    showNotification('Files refreshed', 'success');
}

function showCreateFolderModal() {
    const modal = document.getElementById('createFolderModal');
    const input = document.getElementById('folderName');

    modal.style.display = 'block';
    input.value = ''; // Clear previous value
    input.focus();

    // Add Enter key listener
    const handleEnter = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            createFolder();
            input.removeEventListener('keypress', handleEnter);
        }
    };
    input.addEventListener('keypress', handleEnter);
}

async function createFolder() {
    const nameInput = document.getElementById('folderName');
    const name = nameInput.value.trim();

    try {
        if (!masterKey) {
            throw new Error('Session expired. Please login again.');
        }

        if (!name) {
            throw new Error('Please enter a folder name');
        }

        // Validate folder name length
        if (name.length > MAX_NAME_LENGTH) {
            throw new Error(`Folder name must be ${MAX_NAME_LENGTH} characters or less`);
        }

        const encryptedFolderName = await CryptoUtils.encryptFilename(name, masterKey);
        const response = await API.files.createFolder(encryptedFolderName, currentFolderId);

        if (response.success) {
            showNotification('Folder created successfully', 'success');
            closeModal('createFolderModal');
            nameInput.value = ''; // Clear input
            loadFiles();
        } else {
            throw new Error(response.message || 'Failed to create folder');
        }
    }
    catch (error) {
        showNotification(error.message, 'error');
    }
}

function showRenameModal() {
    if (!selectedItem) {
        showNotification('Please select an item first', 'error');
        return;
    }

    document.getElementById('renameModal').style.display = 'block';
    document.getElementById('newName').value = selectedItem.name || '';
    document.getElementById('newName').focus();
}

async function renameItem() {
    if (!selectedItem) {
        showNotification('Please select an item first', 'error');
        return;
    }
    const newNameInput = document.getElementById('newName');
    const newName = newNameInput.value.trim();
    try {
        if (!masterKey) {
            throw new Error('Session expired. Please login again.');
        }
        if (!newName) {
            throw new Error('Please enter a new name');
        }
        // Validate new name length
        if (newName.length > MAX_NAME_LENGTH) {
            throw new Error(`Name must be ${MAX_NAME_LENGTH} characters or less`);
        }
        const encryptedNewName = await CryptoUtils.encryptFilename(newName, masterKey);
        const response = await API.files.rename(selectedItem.id, encryptedNewName);
        if (response.success) {
            showNotification('Item renamed successfully', 'success');
            closeModal('renameModal');
            loadFiles();
        } else {
            throw new Error(response.message || 'Failed to rename item');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }

}

async function deleteItem() {
    if (!selectedItem) {
        showNotification('Please select an item first', 'error');
        return;
    }

    const confirmed = await showConfirm('Confirm Deletion', `Are you sure you want to delete "${selectedItem.name}"? This action cannot be undone.`);
    if (!confirmed) return;
    try {
        const response = await API.files.delete(selectedItem.id);
        if (response.success) {
            showNotification('Item deleted successfully', 'success');
            loadFiles();
        }
        else {
            throw new Error(response.message || 'Failed to delete item');
        }
    } catch (error) {
        showNotification('Failed to delete item: ' + error.message, 'error');
    }
}

let moveDestinationId = null;

async function showMoveModal() {
    if (!selectedItem) {
        showNotification('Please select an item first', 'error');
        return;
    }

    moveDestinationId = currentFolderId; // Default to current folder
    await loadFolderTree();
    document.getElementById('moveModal').style.display = 'block';
}

async function loadFolderTree() {
    try {
        // Load all folders recursively by fetching all files
        const allFolders = await fetchAllFolders();
        displayFolderTree(allFolders);
    } catch (error) {
        showNotification('Failed to load folders: ' + error.message, 'error');
    }
}

async function fetchAllFolders() {
    // Fetch all files to build complete folder tree
    const result = await API.files.list(null);

    if (!result.success) {
        throw new Error(result.message || 'Failed to load folders');
    }

    // Recursively fetch folders from all levels
    const allFolders = [];
    const files = result.data.files || [];
    const foldersToProcess = files.filter(item => item.type === 'folder');
    allFolders.push(...foldersToProcess);

    // Fetch subfolders for each folder
    for (const folder of foldersToProcess) {
        const subfolders = await fetchSubfolders(folder.id);
        allFolders.push(...subfolders);
    }

    return allFolders;
}

async function fetchSubfolders(parentId) {
    const result = await API.files.list(parentId);

    if (!result.success) {
        return [];
    }

    const files = result.data.files || [];
    const folders = files.filter(item => item.type === 'folder');
    const allFolders = [...folders];

    // Recursively fetch subfolders
    for (const folder of folders) {
        const subfolders = await fetchSubfolders(folder.id);
        allFolders.push(...subfolders);
    }

    return allFolders;
}

async function displayFolderTree(allFiles) {
    const container = document.getElementById('folderTree');

    // Decrypt folder names if needed
    if (masterKey) {
        for (let file of allFiles) {
            if (file.encrypted_name) {
                try {
                    file.decrypted_name = await CryptoUtils.decryptFilename(file.encrypted_name, masterKey);
                } catch (error) {
                    file.decrypted_name = '[Decryption failed]';
                }
            } else {
                file.decrypted_name = file.name;
            }
        }
    } else {
        allFiles.forEach(file => file.decrypted_name = file.name);
    }

    // Root folder option
    let html = `
        <div class="folder-item ${moveDestinationId === null ? 'selected' : ''}" onclick="selectMoveDestination(null)">
            <i class="fas fa-home"></i> <strong>Root (Home)</strong>
        </div>
    `;

    // Build folder tree recursively
    const folders = allFiles.filter(f => f.type === 'folder' && !f.parent_id);

    for (let folder of folders) {
        // Skip if trying to move folder into itself
        if (selectedItem && selectedItem.id == folder.id) {
            continue;
        }
        html += renderFolderTreeItem(folder, allFiles, 0);
    }

    container.innerHTML = html;
}

function renderFolderTreeItem(folder, allFiles, level) {
    const indent = level * 20;
    const isSelected = moveDestinationId == folder.id;
    const displayName = escapeHtml(folder.decrypted_name || folder.name);

    let html = `
        <div class="folder-item ${isSelected ? 'selected' : ''}" style="padding-left: ${indent + 10}px" onclick="selectMoveDestination(${folder.id})">
            <i class="fas fa-folder"></i> ${displayName}
        </div>
    `;

    // Get subfolders
    const subfolders = allFiles.filter(f => f.type === 'folder' && f.parent_id == folder.id);
    for (let subfolder of subfolders) {
        // Skip if trying to move folder into itself or its children
        if (selectedItem && (selectedItem.id == subfolder.id)) {
            continue;
        }
        html += renderFolderTreeItem(subfolder, allFiles, level + 1);
    }

    return html;
}

function selectMoveDestination(folderId) {
    moveDestinationId = folderId;
    // Update visual selection
    document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
}

async function moveItem() {
    if (!selectedItem) return;

    try {
        const response = await API.files.move(selectedItem.id, moveDestinationId);

        if (response.success) {
            showNotification('Item moved successfully', 'success');
            closeModal('moveModal');
            loadFiles();
        } else {
            throw new Error(response.message || 'Failed to move item');
        }
    } catch (error) {
        console.error('Move error:', error);
        showNotification('Failed to move: ' + error.message, 'error');
    }
}

function downloadFile() {
    if (!selectedItem || selectedItem.type !== 'file') {
        showNotification('Please select a file to download', 'error');
        return;
    }

    downloadFileById(selectedItem.id);
    hideContextMenu();
}

function hideContextMenu() {
    // Context menu removed - using inline action buttons
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Custom Alert Modal
function showAlert(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customAlertModal');
        const titleEl = document.getElementById('alertTitle');
        const messageEl = document.getElementById('alertMessage');
        const okBtn = document.getElementById('alertOkBtn');

        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.style.display = 'block';

        const handleOk = () => {
            modal.style.display = 'none';
            okBtn.removeEventListener('click', handleOk);
            resolve();
        };

        okBtn.addEventListener('click', handleOk);

        // Allow Enter key to confirm
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleOk();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    });
}

// Custom Confirm Modal
let confirmResolve = null;

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customConfirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');

        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.style.display = 'block';

        confirmResolve = resolve;
    });
}

function closeCustomConfirm(result) {
    const modal = document.getElementById('customConfirmModal');
    modal.style.display = 'none';
    if (confirmResolve) {
        confirmResolve(result);
        confirmResolve = null;
    }
}

// Make closeCustomConfirm available globally for onclick handlers
window.closeCustomConfirm = closeCustomConfirm;

// Track active notifications for cascading
let activeNotifications = [];

function showNotification(message, type = 'info') {
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
        activeNotifications.forEach(n => {
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
    activeNotifications.push(notificationData);


    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);

    // Remove notification after timeout
    const removeNotification = () => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(400px)';

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
            // Remove from active notifications
            const index = activeNotifications.indexOf(notificationData);
            if (index > -1) {
                activeNotifications.splice(index, 1);
            }
            // Reposition remaining notifications
            repositionNotifications();
        }, 300);
    };

    setTimeout(removeNotification, 5000);

    // Allow click to dismiss
    notification.style.cursor = 'pointer';
    notification.addEventListener('click', removeNotification);
}

function repositionNotifications() {
    let top = 20;
    activeNotifications.forEach(n => {
        if (n.element && n.element.parentNode) {
            n.element.style.top = top + 'px';
            top += n.element.offsetHeight + 10;
        }
    });
}

function toggleFileSelection(fileId, isChecked) {
    if (isChecked) {
        selectedItems.add(fileId);
    } else {
        selectedItems.delete(fileId);
    }
    updateDeleteButton();
    updateSelectAllCheckbox();
}

function toggleSelectAll(isChecked) {
    const checkboxes = document.querySelectorAll('.file-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
        const fileId = parseInt(checkbox.dataset.id);
        if (isChecked) {
            selectedItems.add(fileId);
        } else {
            selectedItems.delete(fileId);
        }
    });
    updateDeleteButton();
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.file-checkbox');
    if (checkboxes.length === 0) {
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        return;
    }
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    if (selectAllCheckbox) selectAllCheckbox.checked = allChecked;
}

function updateDeleteButton() {
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const countSpan = document.getElementById('selectedCount');
    if (deleteBtn && countSpan) {
        if (selectedItems.size > 0) {
            deleteBtn.style.display = 'flex';
            countSpan.textContent = `(${selectedItems.size})`;
        } else {
            deleteBtn.style.display = 'none';
        }
    }
}

async function deleteSelected() {
    if (selectedItems.size === 0) {
        showNotification('No items selected', 'error');
        return;
    }

    const confirmed = await showConfirm('Delete Multiple Items', `Are you sure you want to delete ${selectedItems.size} item(s)?`);
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

    selectedItems.clear();
    updateDeleteButton();

    if (successCount > 0) {
        showNotification(`Successfully deleted ${successCount} item(s)`, 'success');
    }
    if (errorCount > 0) {
        showNotification(`Failed to delete ${errorCount} item(s)`, 'error');
    }

    loadFiles();
    loadQuota(); // Refresh quota after deletion
}

// Keyboard shortcuts
// document.addEventListener('keydown', function (e) {
//     if (e.key === 'Delete') {
//         if (selectedItems.size > 0) {
//             deleteSelected();
//         } else if (selectedItem) {
//             deleteItem();
//         }
//     } else if (e.key === 'F2' && selectedItem) {
//         showRenameModal();
//     } else if (e.ctrlKey && e.key === 'u') {
//         e.preventDefault();
//         triggerFileUpload();
//     } else if (e.ctrlKey && e.key === 'a') {
//         e.preventDefault();
//         const selectAllCheckbox = document.getElementById('selectAll');
//         if (selectAllCheckbox) {
//             selectAllCheckbox.checked = true;
//             toggleSelectAll(true);
//         }
//     }
// });

// Expose functions for inline HTML handlers (dashboard.php & generated rows)
Object.assign(window, {
    triggerFileUpload,
    showCreateFolderModal,
    refreshFiles,
    deleteSelected,
    navigateToFolder,
    navigateToBreadcrumb,
    selectRow,
    toggleSelectAll,
    toggleFileSelection,
    downloadFileById,
    renameItemById,
    renameItem,
    deleteItemById,
    closeModal,
    createFolder,
    deleteItem,
    showMoveModalById,
    selectMoveDestination,
    moveItem,
    showChangePasswordModal,
    togglePasswordVisibility,
    handleChangePassword,
});

// ========== CHANGE PASSWORD MODAL ==========

function showChangePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'block';
    document.getElementById('currentPasswordInput').value = '';
    document.getElementById('newPasswordInput').value = '';
    document.getElementById('confirmPasswordInput').value = '';
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.parentElement.querySelector('.toggle-password i');

    if (input.type === 'password') {
        input.type = 'text';
        button.classList.remove('fa-eye');
        button.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        button.classList.remove('fa-eye-slash');
        button.classList.add('fa-eye');
    }
}

async function handleChangePassword(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPasswordInput').value;
    const newPassword = document.getElementById('newPasswordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;
    const submitBtn = document.getElementById('changePasswordBtn');

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showNotification('New passwords do not match', 'error');
        return;
    }

    if (currentPassword === newPassword) {
        showNotification('New password must be different from current password', 'error');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Changing Password...';

        // Get current user data
        const userResponse = await API.auth.me();
        if (!userResponse.success) {
            throw new Error('Failed to retrieve user data');
        }

        const userData = userResponse.data;
        const username = userData.username;
        const currentKdfSalt = userData.kdf_salt;
        const currentEncryptedMasterKey = userData.encrypted_master_key;
        const currentClientSalt = userData.client_salt;

        // Derive current password hash to verify
        const currentClientSaltBytes = CryptoUtils.hexToArrayBuffer(currentClientSalt);
        const currentPasswordHash = await CryptoUtils.hashPassword(currentPassword, currentClientSaltBytes);
        const currentPasswordHashHex = CryptoUtils.arrayBufferToHex(currentPasswordHash);

        // Decrypt master key with current password to verify it works
        const currentKdfSaltBytes = CryptoUtils.hexToArrayBuffer(currentKdfSalt);
        const currentKek = await CryptoUtils.deriveKey(currentPassword, currentKdfSaltBytes);
        let masterKeyHex;
        try {
            masterKeyHex = await CryptoUtils.decryptMasterKey(currentEncryptedMasterKey, currentKek);
        } catch (error) {
            throw new Error('Current password is incorrect');
        }

        // Import master key
        const masterKeyForReEncryption = await CryptoUtils.importMasterKey(masterKeyHex);

        // Generate new salts
        const newClientSalt = crypto.getRandomValues(new Uint8Array(32));
        const newKdfSalt = crypto.getRandomValues(new Uint8Array(32));

        // Derive new password hash
        const newPasswordHash = await CryptoUtils.hashPassword(newPassword, newClientSalt);
        const newPasswordHashHex = CryptoUtils.arrayBufferToHex(newPasswordHash);

        // Re-encrypt master key with new password
        const newKek = await CryptoUtils.deriveKey(newPassword, newKdfSalt);
        const newEncryptedMasterKey = await CryptoUtils.encryptMasterKey(masterKeyForReEncryption, newKek);

        // Call change password API
        const response = await API.auth.changePassword(
            currentPasswordHashHex,
            newPasswordHashHex,
            CryptoUtils.bytesToHex(newClientSalt),
            CryptoUtils.bytesToHex(newKdfSalt),
            newEncryptedMasterKey
        );

        if (response.success) {
            showNotification('Password changed successfully! Redirecting to login...', 'success');

            // Clear session and redirect to login
            setTimeout(() => {
                sessionStorage.clear();
                window.location.href = 'login.php';
            }, 2000);
        } else {
            throw new Error(response.message || 'Failed to change password');
        }

    } catch (error) {
        console.error('Change password error:', error);
        showNotification(error.message || 'Failed to change password', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Change Password';
    }
}
