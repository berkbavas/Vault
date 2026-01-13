<!doctype html>
<html lang="en">

<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Vault Drive</title>

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet">

    <!-- Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />

    <link rel="stylesheet" href="assets/css/styles.css?v=<?php echo filemtime('assets/css/styles.css'); ?>" />
</head>

<body>
    <!-- Loading Overlay -->
    <div id="loading-overlay" class="loading-overlay hidden" aria-hidden="true">
        <div class="loading-card" role="status" aria-live="polite">
            <div class="spinner" aria-hidden="true"></div>
            <div id="loading-text" class="loading-text">Loading...</div>
        </div>
    </div>

    <!-- Auth -->
    <div id="auth-container" class="auth-shell">
        <div class="auth-card">
            <div class="auth-brand">
                <div class="brand-badge" aria-hidden="true"><i class="fa-solid fa-shield-halved"></i></div>
                <div class="brand-text">
                    <div class="brand-name">Vault Drive</div>
                    <div class="brand-subtitle">Zero‑knowledge secure storage</div>
                </div>
            </div>

            <div class="auth-tabs" role="tablist" aria-label="Authentication tabs">
                <button class="tab-btn is-active" data-tab="login" type="button">
                    Sign in
                </button>
                <button class="tab-btn" data-tab="register" type="button">
                    Create account
                </button>
            </div>

            <!-- Login -->
            <div id="login-form" class="auth-form active" role="tabpanel">
                <form id="login-form-element" class="form">
                    <div class="field">
                        <div class="input-group">
                            <span class="input-icon"><i class="fa-regular fa-user"></i></span>
                            <input id="login-username" type="text" autocomplete="username" placeholder="Username" required />
                        </div>
                    </div>

                    <div class="field">
                        <div class="input-group">
                            <span class="input-icon"><i class="fa-solid fa-key"></i></span>
                            <input id="login-password" type="password" autocomplete="current-password" placeholder="Password" required />
                        </div>
                    </div>

                    <button class="btn btn-primary btn-block" type="submit">
                        <i class="fa-solid fa-right-to-bracket"></i>
                        Sign in
                    </button>


                </form>
            </div>

            <!-- Register -->
            <div id="register-form" class="auth-form" role="tabpanel">
                <form id="register-form-element" class="form">
                    <div class="field">
                        <div class="input-group">
                            <span class="input-icon"><i class="fa-regular fa-user"></i></span>
                            <input id="register-username" type="text" autocomplete="username" placeholder="Choose a username" required />
                        </div>
                    </div>

                    <div class="field">
                        <div class="input-group">
                            <span class="input-icon"><i class="fa-solid fa-lock"></i></span>
                            <input id="register-password" type="password" autocomplete="new-password" placeholder="Create a password" required />
                        </div>
                    </div>

                    <div class="field">
                        <div class="input-group">
                            <span class="input-icon"><i class="fa-solid fa-lock"></i></span>
                            <input id="register-confirm-password" type="password" autocomplete="new-password" placeholder="Repeat password" required />
                        </div>
                    </div>

                    <button class="btn btn-primary btn-block" type="submit">
                        <i class="fa-solid fa-user-plus"></i>
                        Create account
                    </button>

                </form>
            </div>

            <div class="auth-note">
                <div class="note-row">
                    <i class="fa-regular fa-circle-check"></i>
                    <span>Encryption happens in your browser.</span>
                </div>
                <div class="note-row">
                    <i class="fa-regular fa-circle-check"></i>
                    <span>Server never sees plaintext names or files.</span>
                </div>
            </div>
        </div>
    </div>

    <!-- App -->
    <div id="app-container" class="app-shell hidden">
        <!-- Sidebar Backdrop -->
        <div id="sidebar-backdrop" class="sidebar-backdrop" hidden></div>

        <!-- Sidebar -->
        <aside class="sidebar" aria-label="Sidebar">
            <div class="sidebar-top">
                <div class="sidebar-brand">
                    <div class="brand-badge small" aria-hidden="true"><i class="fa-solid fa-shield-halved"></i></div>
                    <div>
                        <div class="brand-name">Vault Drive</div>
                        <div class="brand-subtitle">Secure storage</div>
                    </div>
                </div>

                <div class="sidebar-actions">
                    <button id="upload-btn" class="btn btn-primary btn-wide" type="button">
                        <i class="fa-solid fa-upload"></i>
                        Upload
                    </button>

                    <button id="new-folder-btn" class="btn btn-secondary btn-wide" type="button">
                        <i class="fa-solid fa-folder-plus"></i>
                        New folder
                    </button>

                    <input type="file" id="file-input" multiple class="hidden" />

                    <div id="bulk-actions" class="bulk-actions" style="display: none;">
                        <button id="bulk-delete-btn" class="btn btn-danger btn-wide" type="button">
                            <i class="fa-solid fa-trash"></i>
                            Delete
                            <span class="badge" id="selected-count">0</span>
                        </button>
                    </div>
                </div>

                <div class="sidebar-card">
                    <div class="sidebar-card-title">Storage</div>
                    <div class="quota-mini">
                        <div class="quota-row">
                            <span class="quota-label"><i class="fa-solid fa-database"></i> Used</span>
                            <span class="quota-value"><span id="quota-used">0</span> / <span id="quota-total">0</span></span>
                        </div>
                        <div class="quota-bar" aria-hidden="true">
                            <div id="quota-bar-fill" class="quota-bar-fill" style="width: 0%"></div>
                        </div>
                        <div class="quota-row quota-row-bottom">
                            <span class="quota-hint">Usage</span>
                            <span id="quota-percentage" class="quota-percent">0%</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="sidebar-bottom">
                <div class="user-card">
                    <div class="user-avatar" aria-hidden="true"><i class="fa-regular fa-user"></i></div>
                    <div class="user-meta">
                        <div class="user-name" id="username-display"></div>
                        <div class="user-sub">Encrypted session</div>
                    </div>
                </div>

                <div class="sidebar-actions">
                    <button id="change-password-btn" class="btn btn-tertiary btn-wide" type="button" title="Change Password">
                        <i class="fa-solid fa-lock"></i>
                        Change password
                    </button>

                    <button id="logout-btn" class="btn btn-tertiary btn-wide" type="button" title="Logout">
                        <i class="fa-solid fa-right-from-bracket"></i>
                        Logout
                    </button>
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

                    <!-- Breadcrumb moved into header -->
                    <nav class="breadcrumb" id="breadcrumb" aria-label="Breadcrumb"></nav>
                </div>

                <div class="topbar-right">

                </div>
            </header>

            <main class="content">
                <div class="content-card">
                    <div class="content-card-header">
                        <div class="content-card-title">Files</div>
                        <div class="content-card-subtitle">Encrypted names, decrypted locally</div>
                    </div>

                    <!-- Desktop Table View -->
                    <div class="table-wrap desktop-view">
                        <table class="file-list" aria-label="File list">
                            <thead>
                                <tr>
                                    <th class="checkbox-col">
                                        <input type="checkbox" class="select-all-checkbox" id="select-all"
                                            onchange="App.toggleAllSelections(this.checked)" title="Select All">
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
                        <div class="empty-title">This folder is empty</div>
                        <div class="empty-subtitle">Upload files or create a new folder to get started.</div>
                    </div>
                </div>
            </main>
        </section>
    </div>

    <!-- Change Password Modal -->
    <div id="change-password-modal" class="modal hidden" aria-hidden="true">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Change Password</h3>
                <button class="modal-close" onclick="closeChangePasswordModal()" aria-label="Close">&times;</button>
            </div>
            <form id="change-password-form" class="modal-body">
                <div class="field">
                    <label for="current-password">Current password</label>
                    <input type="password" id="current-password" required autocomplete="current-password" placeholder="Current password">
                </div>
                <div class="field">
                    <label for="new-password">New password</label>
                    <input type="password" id="new-password" required autocomplete="new-password" placeholder="New password">
                </div>
                <div class="field">
                    <label for="confirm-new-password">Confirm new password</label>
                    <input type="password" id="confirm-new-password" required autocomplete="new-password" placeholder="Repeat new password">
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeChangePasswordModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Change password</button>
                </div>
            </form>
        </div>
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
                    <button type="button" class="btn btn-primary" onclick="App.confirmMove()">Move here</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Toasts -->
    <div id="toast-container" class="toast-container" aria-live="polite" aria-atomic="true"></div>

    <script>
        // UI-only: sidebar drawer on mobile + auth tabs (keeps existing App event listeners too)
        (function() {
            const shell = document.documentElement;
            const toggle = document.getElementById('sidebar-toggle');
            const app = document.getElementById('app-container');
            const backdrop = document.getElementById('sidebar-backdrop');

            if (toggle && app) {
                toggle.addEventListener('click', () => app.classList.toggle('sidebar-open'));
            }

            if (backdrop && app) {
                backdrop.addEventListener('click', () => app.classList.remove('sidebar-open'));
            }

            const tabButtons = document.querySelectorAll('.tab-btn');
            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    tabButtons.forEach(b => b.classList.remove('is-active'));
                    btn.classList.add('is-active');
                    const target = btn.dataset.tab;
                    if (target === 'login') {
                        document.getElementById('register-form')?.classList.remove('active');
                        document.getElementById('login-form')?.classList.add('active');
                    } else {
                        document.getElementById('login-form')?.classList.remove('active');
                        document.getElementById('register-form')?.classList.add('active');
                    }
                });
            });
        })();
    </script>

    <!-- Scripts -->
    <script src="assets/js/crypto-utils.js?v=<?php echo filemtime('assets/js/crypto-utils.js'); ?>"></script>
    <script src="assets/js/api.js?v=<?php echo filemtime('assets/js/api.js'); ?>"></script>
    <script src="assets/js/app.js?v=<?php echo filemtime('assets/js/app.js'); ?>"></script>
</body>

</html>