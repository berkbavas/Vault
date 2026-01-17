/**
 * Progress Bar Module
 * Handles progress bar display and updates for upload/download operations
 */

// Crypto animation intervals storage
const cryptoAnimationIntervals = {
    upload: { matrix: null, stream: null, hex: null },
    download: { matrix: null, stream: null, hex: null }
};

/**
 * Get the current app's progress state
 * Works with both App (main app) and ShareApp (share page)
 */
function getProgressState(type) {
    // Check which app is available
    if (typeof ShareApp !== 'undefined') {
        return type === 'upload' ? ShareApp.uploadProgressState : ShareApp.downloadProgressState;
    } else if (typeof App !== 'undefined') {
        return type === 'upload' ? App.uploadProgressState : App.downloadProgressState;
    }
    // Fallback: return a dummy state
    return {
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
    };
}

/**
 * Generate random hex string
 */
function randomHex(length = 8) {
    const chars = '0123456789ABCDEF';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Generate random binary string
 */
function randomBinary(length = 8) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += Math.random() > 0.5 ? '1' : '0';
    }
    return result;
}

/**
 * Initialize matrix rain effect
 */
function initMatrixRain(type) {
    const container = document.getElementById(`${type}-matrix-bg`);
    if (!container) return;
    
    // Clear existing
    container.innerHTML = '';
    
    // Create matrix columns
    const columnCount = 8;
    for (let i = 0; i < columnCount; i++) {
        const column = document.createElement('div');
        column.className = 'matrix-column';
        column.style.left = `${(i / columnCount) * 100}%`;
        column.style.animationDelay = `${Math.random() * 2}s`;
        column.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;
        column.textContent = randomHex(6);
        container.appendChild(column);
    }
    
    // Update matrix content periodically
    cryptoAnimationIntervals[type].matrix = setInterval(() => {
        const columns = container.querySelectorAll('.matrix-column');
        columns.forEach(col => {
            col.textContent = randomHex(6);
        });
    }, 500);
}

/**
 * Initialize binary stream updates
 */
function initBinaryStreams(type) {
    const leftStream = document.getElementById(`${type}-stream-left`);
    const rightStream = document.getElementById(`${type}-stream-right`);
    
    if (!leftStream || !rightStream) return;
    
    cryptoAnimationIntervals[type].stream = setInterval(() => {
        leftStream.textContent = randomBinary(8);
        rightStream.textContent = randomBinary(8);
    }, 200);
}

/**
 * Create floating hex characters
 */
function createFloatingHex(type) {
    const animation = document.getElementById(`${type}-crypto-animation`);
    if (!animation) return;
    
    cryptoAnimationIntervals[type].hex = setInterval(() => {
        const hex = document.createElement('div');
        hex.className = 'hex-float';
        hex.textContent = randomHex(2);
        hex.style.left = `${20 + Math.random() * 60}%`;
        hex.style.bottom = '20px';
        hex.style.animationDuration = `${1.5 + Math.random() * 1}s`;
        animation.appendChild(hex);
        
        // Remove after animation
        setTimeout(() => {
            hex.remove();
        }, 2500);
    }, 300);
}

/**
 * Start crypto animation
 */
function startCryptoAnimation(type) {
    const animation = document.getElementById(`${type}-crypto-animation`);
    if (!animation) return;
    
    // Reset state
    animation.classList.remove('complete');
    animation.classList.add(type === 'upload' ? 'encrypting' : 'decrypting');
    
    // Initialize animations
    initMatrixRain(type);
    initBinaryStreams(type);
    createFloatingHex(type);
}

/**
 * Stop crypto animation
 */
function stopCryptoAnimation(type) {
    // Clear all intervals
    Object.values(cryptoAnimationIntervals[type]).forEach(interval => {
        if (interval) clearInterval(interval);
    });
    cryptoAnimationIntervals[type] = { matrix: null, stream: null, hex: null };
}

/**
 * Set crypto animation to complete state
 */
function completeCryptoAnimation(type) {
    stopCryptoAnimation(type);
    
    const animation = document.getElementById(`${type}-crypto-animation`);
    
    if (animation) {
        animation.classList.remove('encrypting', 'decrypting');
        animation.classList.add('complete');
    }
}

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
    const progressState = getProgressState(type);
    
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
    
    // Start crypto animation
    startCryptoAnimation(type);
    
    modal.classList.remove('hidden', 'complete');
}

/**
 * Update progress bar
 * @param {string} type - 'upload' or 'download'
 * @param {number} loaded - Bytes loaded
 * @param {number} total - Total bytes
 */
function updateProgress(type, loaded, total) {
    const progressState = getProgressState(type);
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
    const progressState = getProgressState(type);
    if (!progressState.isActive) return;
    
    const modal = document.getElementById(`${type}-progress-modal`);
    const card = modal.querySelector('.progress-card');
    
    document.getElementById(`${type}-progress-percentage`).textContent = '100%';
    document.getElementById(`${type}-progress-bar-fill`).style.width = '100%';
    document.getElementById(`${type}-progress-subtitle`).textContent = 'Complete!';
    document.getElementById(`${type}-progress-time`).textContent = 'Done';
    
    // Complete the crypto animation
    completeCryptoAnimation(type);
    
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
    const cryptoAnimation = document.getElementById(`${type}-crypto-animation`);
    const progressState = getProgressState(type);
    
    // Stop crypto animation and clean up
    stopCryptoAnimation(type);
    
    // Reset crypto animation state
    if (cryptoAnimation) {
        cryptoAnimation.classList.remove('encrypting', 'decrypting', 'complete');
        // Clear any floating hex elements
        cryptoAnimation.querySelectorAll('.hex-float').forEach(el => el.remove());
    }
    
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
