/**
 * UI Helper Functions
 * Utility functions for UI operations like loading, toasts, formatting, etc.
 */

// Loading state management
const LoadingManager = {
    matrixInterval: null,
    progressInterval: null,
    logIndex: 0,
    bootLogs: [
        { text: '[SYS] Initializing secure environment...', type: 'normal' },
        { text: '[OK] Cryptographic modules loaded', type: 'success' },
        { text: '[SYS] Establishing encrypted connection...', type: 'normal' },
        { text: '[OK] TLS handshake complete', type: 'success' },
        { text: '[SYS] Loading user interface...', type: 'normal' },
        { text: '[OK] Components initialized', type: 'success' },
        { text: '[SYS] Verifying session integrity...', type: 'normal' },
        { text: '[OK] Session validated', type: 'success' }
    ],

    /**
     * Initialize matrix rain effect
     */
    initMatrixEffect() {
        const container = document.getElementById('loading-matrix');
        if (!container) return;

        const chars = '0123456789ABCDEF@#$%&*<>/\\|{}[]';
        const columns = 15;

        for (let i = 0; i < columns; i++) {
            const char = document.createElement('div');
            char.className = 'matrix-char';
            char.textContent = chars.charAt(Math.floor(Math.random() * chars.length));
            char.style.left = `${(i / columns) * 100}%`;
            char.style.animationDuration = `${1 + Math.random() * 2}s`;
            char.style.animationDelay = `${Math.random() * 2}s`;
            container.appendChild(char);
        }

        // Update characters periodically
        this.matrixInterval = setInterval(() => {
            const matrixChars = container.querySelectorAll('.matrix-char');
            matrixChars.forEach(char => {
                if (Math.random() > 0.7) {
                    char.textContent = chars.charAt(Math.floor(Math.random() * chars.length));
                }
            });
        }, 100);
    },

    /**
     * Start progress animation
     */
    startProgress() {
        const fill = document.getElementById('boot-progress-fill');
        if (!fill) return;

        let progress = 0;
        this.progressInterval = setInterval(() => {
            // Simulate varying load speed
            const increment = Math.random() * 8 + 2;
            progress = Math.min(progress + increment, 95);
            fill.style.width = `${progress}%`;
        }, 150);
    },

    /**
     * Complete progress animation
     */
    completeProgress() {
        const fill = document.getElementById('boot-progress-fill');
        if (fill) {
            fill.style.width = '100%';
        }
    },

    /**
     * Add boot log entry
     */
    addBootLog(text, type = 'normal') {
        const logContainer = document.getElementById('boot-log');
        if (!logContainer) return;

        const line = document.createElement('div');
        line.className = 'boot-log-line';
        
        if (type === 'success') {
            line.innerHTML = `<span class="success">${text}</span>`;
        } else if (type === 'warn') {
            line.innerHTML = `<span class="warn">${text}</span>`;
        } else {
            line.textContent = text;
        }
        
        logContainer.appendChild(line);

        // Keep only last 4 lines visible
        const lines = logContainer.querySelectorAll('.boot-log-line');
        if (lines.length > 4) {
            lines[0].remove();
        }
    },

    /**
     * Run boot sequence animation
     */
    runBootSequence() {
        this.logIndex = 0;
        const addNextLog = () => {
            if (this.logIndex < this.bootLogs.length) {
                const log = this.bootLogs[this.logIndex];
                this.addBootLog(log.text, log.type);
                this.logIndex++;
            }
        };

        // Add logs progressively
        const logInterval = setInterval(() => {
            addNextLog();
            if (this.logIndex >= this.bootLogs.length) {
                clearInterval(logInterval);
            }
        }, 400);
    },

    /**
     * Clean up intervals
     */
    cleanup() {
        if (this.matrixInterval) {
            clearInterval(this.matrixInterval);
            this.matrixInterval = null;
        }
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }
};

function showLoading(text = 'Initializing secure environment...') {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const bootLog = document.getElementById('boot-log');
    const progressFill = document.getElementById('boot-progress-fill');

    // Reset state
    if (bootLog) bootLog.innerHTML = '';
    if (progressFill) progressFill.style.width = '0%';

    overlay.classList.remove('hidden', 'fade-out');
    if (loadingText) loadingText.textContent = text;

    // Start animations
    LoadingManager.initMatrixEffect();
    LoadingManager.startProgress();
    LoadingManager.runBootSequence();
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    
    // Complete progress first
    LoadingManager.completeProgress();

    // Update final status
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = 'Ready!';

    // Add final log
    LoadingManager.addBootLog('[OK] System ready', 'success');

    // Fade out after a brief moment
    setTimeout(() => {
        overlay.classList.add('fade-out');
        
        // Cleanup and hide after transition
        setTimeout(() => {
            overlay.classList.add('hidden');
            LoadingManager.cleanup();
            
            // Clear matrix container
            const matrixContainer = document.getElementById('loading-matrix');
            if (matrixContainer) matrixContainer.innerHTML = '';
        }, 500);
    }, 300);
}

function updateLoadingText(text) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = text;
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

function closeShareModal() {
    const modal = document.getElementById('share-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    // Reset the modal state
    const form = document.getElementById('share-form');
    const linkContainer = document.getElementById('share-link-container');
    if (form) form.classList.remove('hidden');
    if (linkContainer) linkContainer.classList.add('hidden');
}

function confirmMove() {
    // Check which app is available
    if (typeof ShareApp !== 'undefined') {
        ShareApp.confirmMove();
    } else if (typeof App !== 'undefined') {
        App.confirmMove();
    }
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
