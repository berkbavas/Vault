<!doctype html>
<html lang="en">

<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Shared Content - Vault Drive</title>

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">

    <!-- Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />

    <link rel="stylesheet" href="./assets/css/style.css?v=<?php echo filemtime('./assets/css/style.css') ?>" />
    <link rel="stylesheet" href="./assets/css/animations.css?v=<?php echo filemtime('./assets/css/animations.css') ?>" />
</head>

<body>
    <!-- Loading Overlay -->
    <div id="loading-overlay" class="loading-overlay" aria-hidden="true">
        <div class="loading-card" role="status" aria-live="polite">
            <div class="loading-terminal-header">
                <div class="terminal-dots">
                    <span class="dot red"></span>
                    <span class="dot yellow"></span>
                    <span class="dot green"></span>
                </div>
                <span class="terminal-title">vault_drive.exe</span>
            </div>
            <div class="loading-body">
                <div class="spinner"></div>
                <span id="loading-text" class="loading-text">Initializing...</span>
            </div>
        </div>
    </div>

    <!-- Progress Bars Container -->
    <div id="progress-container" class="progress-container">
        <!-- Upload Progress Bar -->
        <div id="upload-progress-modal" class="progress-modal hidden" data-type="upload">
            <div class="progress-card">
                <div class="progress-header">
                    <div class="progress-icon">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                    </div>
                    <div class="progress-info">
                        <div class="progress-title" id="upload-progress-title">Uploading file...</div>
                        <div class="progress-subtitle" id="upload-progress-subtitle">Preparing...</div>
                    </div>
                    <button class="progress-close" onclick="ShareApp.cancelProgress('upload')" title="Cancel">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="progress-body">
                    <div id="upload-crypto-animation" class="crypto-animation encrypting">
                        <div class="crypto-matrix-bg" id="upload-matrix-bg"></div>
                        <div class="data-flow"></div>
                        <div class="data-flow"></div>
                        <div class="crypto-stream left" id="upload-stream-left">01001010</div>
                        <div class="crypto-stream right" id="upload-stream-right">10110101</div>
                        <div class="crypto-icon-wrapper">
                            <div class="crypto-ring"></div>
                            <div class="crypto-ring"></div>
                            <div class="crypto-ring"></div>
                            <div class="crypto-particle"></div>
                            <div class="crypto-particle"></div>
                            <div class="crypto-particle"></div>
                            <div class="crypto-particle"></div>
                            <div class="crypto-icon">
                                <i class="fa-solid fa-lock"></i>
                            </div>
                        </div>
                        <div class="crypto-status" id="upload-crypto-status"></div>
                    </div>

                    <div class="progress-bar-container">
                        <div class="progress-bar-track">
                            <div class="progress-bar-fill" id="upload-progress-bar-fill"></div>
                            <div class="progress-bar-glow"></div>
                        </div>
                        <div class="progress-percentage" id="upload-progress-percentage">0%</div>
                    </div>
                    <div class="progress-stats">
                        <div class="progress-stat">
                            <span class="stat-label">Speed:</span>
                            <span class="stat-value" id="upload-progress-speed">-- KB/s</span>
                        </div>
                        <div class="progress-stat">
                            <span class="stat-label">Size:</span>
                            <span class="stat-value" id="upload-progress-size">-- / --</span>
                        </div>
                        <div class="progress-stat">
                            <span class="stat-label">Time left:</span>
                            <span class="stat-value" id="upload-progress-time">Calculating...</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Download Progress Bar -->
        <div id="download-progress-modal" class="progress-modal hidden" data-type="download">
            <div class="progress-card">
                <div class="progress-header">
                    <div class="progress-icon">
                        <i class="fa-solid fa-cloud-arrow-down"></i>
                    </div>
                    <div class="progress-info">
                        <div class="progress-title" id="download-progress-title">Downloading file...</div>
                        <div class="progress-subtitle" id="download-progress-subtitle">Preparing...</div>
                    </div>
                    <button class="progress-close" onclick="ShareApp.cancelProgress('download')" title="Cancel">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="progress-body">
                    <div id="download-crypto-animation" class="crypto-animation decrypting">
                        <div class="crypto-matrix-bg" id="download-matrix-bg"></div>
                        <div class="data-flow"></div>
                        <div class="data-flow"></div>
                        <div class="crypto-stream left" id="download-stream-left">10110101</div>
                        <div class="crypto-stream right" id="download-stream-right">01001010</div>
                        <div class="crypto-icon-wrapper">
                            <div class="crypto-ring"></div>
                            <div class="crypto-ring"></div>
                            <div class="crypto-ring"></div>
                            <div class="crypto-particle"></div>
                            <div class="crypto-particle"></div>
                            <div class="crypto-particle"></div>
                            <div class="crypto-particle"></div>
                            <div class="crypto-icon">
                                <i class="fa-solid fa-lock-open"></i>
                            </div>
                        </div>
                        <div class="crypto-status" id="download-crypto-status"></div>
                    </div>

                    <div class="progress-bar-container">
                        <div class="progress-bar-track">
                            <div class="progress-bar-fill" id="download-progress-bar-fill"></div>
                            <div class="progress-bar-glow"></div>
                        </div>
                        <div class="progress-percentage" id="download-progress-percentage">0%</div>
                    </div>
                    <div class="progress-stats">
                        <div class="progress-stat">
                            <span class="stat-label">Speed:</span>
                            <span class="stat-value" id="download-progress-speed">-- KB/s</span>
                        </div>
                        <div class="progress-stat">
                            <span class="stat-label">Size:</span>
                            <span class="stat-value" id="download-progress-size">-- / --</span>
                        </div>
                        <div class="progress-stat">
                            <span class="stat-label">Time left:</span>
                            <span class="stat-value" id="download-progress-time">Calculating...</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Password Prompt -->
    <div id="password-container" class="auth-shell">
        <div class="auth-card">
            <div class="auth-header">
                <div class="green-dot"></div>
                <div class="yellow-dot"></div>
                <div class="red-dot"></div>
            </div>
            <div class="auth-brand">
                <div class="brand-badge" aria-hidden="true"><i class="fa-solid fa-share-nodes"></i></div>
                <div class="brand-text">
                    <div class="brand-name">Shared Content</div>
                    <div class="brand-subtitle" id="share-subtitle">Enter password to access</div>
                </div>
            </div>

            <div id="password-form-container" class="auth-form active" role="tabpanel">
                <form id="password-form" class="form">
                    <div class="field">
                        <div class="input-group">
                            <span class="input-icon"><i class="fa-solid fa-key"></i></span>
                            <input id="share-password" type="password" autocomplete="current-password"
                                placeholder="Share password" required />
                        </div>
                    </div>

                    <button class="btn btn-primary btn-block" type="submit">
                        <i class="fa-solid fa-unlock"></i>
                        Unlock
                    </button>
                </form>
            </div>

            <div id="error-container" class="auth-form">
                <div class="empty-state">
                    <div class="empty-icon"><i class="fa-solid fa-circle-exclamation"></i></div>
                    <div class="empty-title" id="error-title">Share Not Found</div>
                    <div class="empty-subtitle" id="error-message">This share link may be invalid or expired.</div>
                    <a href="index.php" class="btn btn-primary" style="margin-top: 20px;">
                        <i class="fas fa-home"></i> Go to Home
                    </a>
                </div>
            </div>

            <div class="auth-note">
                <div class="note-row">
                    <i class="fa-regular fa-circle-check"></i>
                    <span>End-to-end encrypted sharing.</span>
                </div>
                <div class="note-row">
                    <i class="fa-regular fa-circle-check"></i>
                    <span>Password never leaves your browser.</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Shared Content App -->
    <div id="share-app-container" class="app-shell hidden">
        <!-- Sidebar Backdrop -->
        <div id="sidebar-backdrop" class="sidebar-backdrop" hidden></div>

        <!-- Sidebar -->
        <aside class="sidebar" aria-label="Sidebar">
            <div class="sidebar-top">
                <div class="sidebar-brand">
                    <div class="brand-badge small" aria-hidden="true"><i class="fa-solid fa-share-nodes"></i></div>
                    <div class="brand-text">
                        <div class="brand-name">Shared Content</div>
                        <div class="brand-subtitle">Encrypted access</div>
                    </div>
                </div>

                <div class="sidebar-card">
                    <div class="sidebar-card-title">Share Info</div>
                    <div class="share-info-mini">
                        <div class="share-info-row">
                            <span class="share-info-label"><i class="fa-solid fa-folder"></i> Type</span>
                            <span class="share-info-value" id="share-type">-</span>
                        </div>
                        <div class="share-info-row">
                            <span class="share-info-label"><i class="fa-solid fa-clock"></i> Expires</span>
                            <span class="share-info-value" id="share-expires">Never</span>
                        </div>
                    </div>
                </div>

                <div class="sidebar-card">
                    <div class="sidebar-card-title">Permissions</div>
                    <div class="share-permissions">
                        <div class="permission-item" id="perm-download">
                            <i class="fa-solid fa-download"></i> Download
                        </div>
                        <div class="permission-item" id="perm-upload">
                            <i class="fa-solid fa-upload"></i> Upload
                        </div>
                        <div class="permission-item" id="perm-delete">
                            <i class="fa-solid fa-trash"></i> Delete
                        </div>
                        <div class="permission-item" id="perm-rename">
                            <i class="fa-solid fa-edit"></i> Rename
                        </div>
                        <div class="permission-item" id="perm-move">
                            <i class="fa-solid fa-arrows-alt"></i> Move
                        </div>
                    </div>
                </div>

                <div class="sidebar-actions" id="share-actions">
                    <button id="upload-btn" class="btn btn-primary btn-wide hidden" type="button">
                        <i class="fa-solid fa-upload"></i>
                        Upload
                    </button>

                    <button id="new-folder-btn" class="btn btn-secondary btn-wide hidden" type="button">
                        <i class="fa-solid fa-folder-plus"></i>
                        New folder
                    </button>

                    <input type="file" id="file-input" multiple class="hidden" />

                    <div id="bulk-actions" class="bulk-actions" style="opacity: 0;">
                        <button id="bulk-delete-btn" class="btn btn-danger btn-wide hidden" type="button">
                            <i class="fa-solid fa-trash"></i>
                            Delete
                            <span class="badge" id="selected-count">0</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="sidebar-bottom">
                <div class="sidebar-actions">
                    <a href="index.php" class="btn btn-tertiary btn-wide">
                        <i class="fa-solid fa-home"></i>
                        Go to Vault Drive
                    </a>
                </div>
            </div>
        </aside>

        <!-- Main -->
        <section class="main">
            <header class="topbar">
                <div class="topbar-left">
                    <button id="sidebar-toggle" class="icon-btn" type="button" aria-label="Toggle sidebar">
                        <i class="fa-solid fa-bars"></i>
                    </button>

                    <nav class="breadcrumb" id="breadcrumb" aria-label="Breadcrumb"></nav>
                </div>
            </header>

            <main class="content">
                <div class="content-card">
                    <div class="content-card-header">
                        <div class="content-card-title" id="content-title">Shared Files</div>
                        <div class="content-card-subtitle">Encrypted names, decrypted locally</div>
                    </div>

                    <!-- Desktop Table View -->
                    <div class="table-wrap desktop-view">
                        <table class="file-list" aria-label="File list">
                            <thead>
                                <tr>
                                    <th class="checkbox-col">
                                        <input type="checkbox" class="select-all-checkbox" id="select-all"
                                            onchange="ShareApp.toggleAllSelections(this.checked)" title="Select All">
                                    </th>
                                    <th>Name</th>
                                    <th class="col-size">Size</th>
                                    <th class="col-modified">Modified</th>
                                    <th class="col-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="file-list-body"></tbody>
                        </table>
                    </div>

                    <!-- Mobile Card View -->
                    <div class="file-cards mobile-view" id="file-cards-container"></div>

                    <div id="empty-state" class="empty-state hidden">
                        <div class="empty-icon" aria-hidden="true"><i class="fa-regular fa-folder-open"></i></div>
                        <div class="empty-title" id="empty-title">This folder is empty</div>
                        <div class="empty-subtitle">No files or folders here yet.</div>
                    </div>

                    <!-- Single file download view -->
                    <div id="single-file-view" class="empty-state hidden">
                        <div class="empty-icon" aria-hidden="true"><i class="fa-solid fa-file"></i></div>
                        <div class="empty-title" id="single-file-name">-</div>
                        <div class="empty-subtitle" id="single-file-info">-</div>
                        <button class="btn btn-primary" id="download-single-file-btn">
                            <i class="fa-solid fa-download"></i>
                            Download File
                        </button>
                    </div>
                </div>
            </main>
        </section>
    </div>

    <!-- Rename Modal -->
    <div id="rename-modal" class="modal hidden" aria-hidden="true">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Rename</h3>
                <button class="modal-close" onclick="closeRenameModal()" aria-label="Close">&times;</button>
            </div>
            <form id="rename-form" class="modal-body">
                <div class="field">
                    <label for="rename-input">New name</label>
                    <input type="text" id="rename-input" required placeholder="New name">
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeRenameModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Rename</button>
                </div>
            </form>
        </div>
    </div>

    <!-- New Folder Modal -->
    <div id="new-folder-modal" class="modal hidden" aria-hidden="true">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Create New Folder</h3>
                <button class="modal-close" onclick="closeNewFolderModal()" aria-label="Close">&times;</button>
            </div>
            <form id="new-folder-form" class="modal-body">
                <div class="field">
                    <label for="folder-name-input">Folder name</label>
                    <input type="text" id="folder-name-input" required placeholder="Folder name">
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeNewFolderModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Create</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Move Modal -->
    <div id="move-modal" class="modal hidden" aria-hidden="true">
        <div class="modal-content move-modal-content">
            <div class="modal-header">
                <h3>Move to</h3>
                <button class="modal-close" onclick="closeMoveModal()" aria-label="Close">&times;</button>
            </div>
            <div class="move-modal-body">
                <div class="folder-tree" id="folder-tree"></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeMoveModal()">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="ShareApp.confirmMove()">Move here</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Toasts -->
    <div id="toast-container" class="toast-container" aria-live="polite" aria-atomic="true"></div>

    <script>
        // UI-only: sidebar drawer on mobile
        (function() {
            const toggle = document.getElementById('sidebar-toggle');
            const app = document.getElementById('share-app-container');
            const backdrop = document.getElementById('sidebar-backdrop');

            if (toggle && app) {
                toggle.addEventListener('click', () => app.classList.toggle('sidebar-open'));
            }

            if (backdrop && app) {
                backdrop.addEventListener('click', () => app.classList.remove('sidebar-open'));
            }
        })();
    </script>

    <!-- Scripts -->
    <script src="assets/js/crypto-utils.js?v=<?php echo filemtime('assets/js/crypto-utils.js'); ?>"></script>
    <script src="assets/js/modules/ui-helpers.js?v=<?php echo filemtime('assets/js/modules/ui-helpers.js'); ?>"></script>
    <script src="assets/js/modules/progress-bar.js?v=<?php echo filemtime('assets/js/modules/progress-bar.js'); ?>"></script>
    <script src="assets/js/share-api.js?v=<?php echo filemtime('assets/js/share-api.js'); ?>"></script>
    <script src="assets/js/share-app.js?v=<?php echo filemtime('assets/js/share-app.js'); ?>"></script>

</body>

</html>