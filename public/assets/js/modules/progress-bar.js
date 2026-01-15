/**
 * Progress Bar Module
 * Handles progress bar display and updates for upload/download operations
 */

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
