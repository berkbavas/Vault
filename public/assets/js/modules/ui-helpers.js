/**
 * UI Helper Functions
 * Utility functions for UI operations like loading, toasts, formatting, etc.
 */

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

function confirmMove() {
    App.confirmMove();
}

/**
 * Get file icon based on file extension
 */
function getFileIcon(filename) {
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
        return { icon: 'fa-file-excel', color: 'spreadsheet' };
    }
    if (['ppt', 'pptx'].includes(ext)) {
        return { icon: 'fa-file-powerpoint', color: 'presentation' };
    }
    if (ext === 'pdf') {
        return { icon: 'fa-file-pdf', color: 'pdf' };
    }

    // Archive files
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
        return { icon: 'fa-file-zipper', color: 'archive' };
    }

    // Code files
    if (['html', 'css', 'js', 'php', 'py', 'java', 'c', 'cpp', 'json', 'xml'].includes(ext)) {
        return { icon: 'fa-file-code', color: 'code' };
    }

    // Text files
    if (['txt', 'md', 'rtf'].includes(ext)) {
        return { icon: 'fa-file-lines', color: 'text' };
    }

    // Default
    return { icon: 'fa-file', color: 'default' };
}
