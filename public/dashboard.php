<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Vault Drive</title>
    <link rel="stylesheet" href="./assets/css/style.css?v=<?php echo filemtime('./assets/css/style.css'); ?>">
    <link rel="stylesheet" href="./assets/css/dashboard.css?v=<?php echo filemtime('./assets/css/dashboard.css'); ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
</head>

<body class="app-page">
    <div class="dashboard">
        <header class="topbar">
            <div class="brandline">
                <div class="brandmark" aria-hidden="true"><i class="fa-solid fa-lock"></i></div>
                <div>
                    <div class="brand-name">Vault Drive</div>
                    <div class="subtitle">Signed in as <strong id="username"></strong></div>
                </div>
            </div>

            <div class="topbar-actions">
                <button class="btn btn-ghost" onclick="showChangePasswordModal()" title="Change Password" type="button">
                    <i class="fa-solid fa-key"></i>
                    Change Password
                </button>

                <a href="logout.php" class="btn btn-ghost" title="Logout">
                    <i class="fa-solid fa-right-from-bracket"></i>
                    Logout
                </a>
            </div>
        </header>

        <section class="panel">
            <div class="quota-bar" id="quotaBar">
                <div class="quota-info">
                    <span class="quota-text">
                        <i class="fa-solid fa-hard-drive"></i>
                        <span id="quotaUsed">0 MB</span> of <span id="quotaTotal">50 MB</span> used
                    </span>
                    <span class="quota-percentage" id="quotaPercentage">0%</span>
                </div>
                <div class="quota-progress">
                    <div class="quota-fill" id="quotaFill" style="width: 0%"></div>
                </div>
            </div>

            <div class="panel-row">
                <div class="actions">
                    <button class="btn btn-primary" onclick="triggerFileUpload()" type="button">
                        <i class="fas fa-upload"></i>
                        Upload
                    </button>
                    <button class="btn btn-secondary" onclick="showCreateFolderModal()" type="button">
                        <i class="fas fa-folder-plus"></i>
                        New folder
                    </button>
                    <button class="btn btn-secondary" onclick="refreshFiles()" type="button">
                        <i class="fas fa-rotate"></i>
                        Refresh
                    </button>
                    <button class="btn btn-danger" onclick="deleteSelected()" style="display:none" id="deleteSelectedBtn" type="button">
                        <i class="fas fa-trash"></i>
                        Delete <span id="selectedCount">0</span>
                    </button>
                </div>

                <div class="search">
                    <div class="input-group" style="height:42px;">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input id="searchInput" type="text" placeholder="Search in this folder" autocomplete="off" />
                    </div>
                </div>
            </div>

            <nav class="crumbs" id="breadcrumb" aria-label="Breadcrumb">
                <span class="crumb active" onclick="navigateToFolder(null)">
                    <i class="fas fa-house"></i> Home
                </span>
            </nav>

            <div class="drop" id="dropZone" role="button" tabindex="0">
                <div class="drop-icon"><i class="fas fa-cloud-arrow-up"></i></div>
                <div>
                    <div class="drop-title">Drop files to upload</div>
                    <div class="drop-sub">…or click to browse</div>
                </div>
                <input type="file" id="file-input" multiple>
            </div>

            <!-- Upload progress (shown during uploads) -->
            <div class="upload-progress" id="uploadProgress" hidden>
                <div class="up-row">
                    <div class="up-name" id="uploadProgressName">Uploading…</div>
                    <div class="up-pct" id="uploadProgressPct">0%</div>
                </div>
                <div class="up-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                    <div class="up-fill" id="uploadProgressFill" style="width:0%"></div>
                </div>
                <div class="up-sub" id="uploadProgressSub">Preparing…</div>
            </div>

            <!-- Download progress (shown during download) -->
            <div class="upload-progress" id="downloadProgress" hidden>
                <div class="up-row">
                    <div class="up-name" id="downloadProgressName">Uploading…</div>
                    <div class="up-pct" id="downloadProgressPct">0%</div>
                </div>
                <div class="up-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                    <div class="up-fill" id="downloadProgressFill" style="width:0%"></div>
                </div>
                <div class="up-sub" id="downloadProgressSub">Preparing…</div>
            </div>

            <div id="file-container">
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <h4>No files or folders</h4>
                    <p>Upload files or create folders to get started</p>
                </div>
            </div>
        </section>

        <footer class="app-footer">
            <p>&copy; 2026 Vault Drive. All rights reserved.</p>
        </footer>
    </div>

    <!-- Create Folder Modal -->
    <div class="modal" id="createFolderModal">
        <div class="modal-content">
            <div class="modal-header">
                <h4>Create New Folder</h4>
                <button class="close" onclick="closeModal('createFolderModal')"><i class="fa-regular fa-circle-xmark"></i></button>
            </div>
            <div class="form-group">
                <label>Folder Name:</label>
                <input type="text" class="form-control" id="folderName" placeholder="Enter folder name">
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal('createFolderModal')" type="button">Cancel</button>
                <button class="btn btn-success" onclick="createFolder()" type="button">Create</button>
            </div>
        </div>
    </div>

    <!-- Rename Modal -->
    <div class="modal" id="renameModal">
        <div class="modal-content">
            <div class="modal-header">
                <h4>Rename Item</h4>
                <button class="close" onclick="closeModal('renameModal')"><i class="fa-regular fa-circle-xmark"></i></button>
            </div>
            <div class="form-group">
                <label>New Name:</label>
                <input type="text" class="form-control" id="newName" placeholder="Enter new name">
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal('renameModal')" type="button">Cancel</button>
                <button class="btn btn-success" onclick="renameItem()" type="button">Rename</button>
            </div>
        </div>
    </div>

    <!-- Move Modal -->
    <div class="modal" id="moveModal">
        <div class="modal-content">
            <div class="modal-header">
                <h4>Move Item</h4>
                <button class="close" onclick="closeModal('moveModal')"><i class="fa-regular fa-circle-xmark"></i></button>
            </div>
            <div class="form-group">
                <label>Select Destination Folder:</label>
                <div id="folderTree" class="folder-tree">
                    <!-- Folder tree will be populated dynamically -->
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal('moveModal')" type="button">Cancel</button>
                <button class="btn btn-success" onclick="moveItem()" type="button">Move</button>
            </div>
        </div>
    </div>

    <!-- Change Password Modal -->
    <div class="modal" id="changePasswordModal">
        <div class="modal-content">
            <div class="modal-header">
                <h4>Change Password</h4>
                <button class="close" onclick="closeModal('changePasswordModal')"><i class="fa-regular fa-circle-xmark"></i></button>
            </div>
            <form id="changePasswordForm" onsubmit="handleChangePassword(event)">
                <div class="form-group">
                    <label for="currentPasswordInput">Current Password</label>
                    <div class="input-group">
                        <span class="input-icon">
                            <i class="fa-solid fa-lock"></i>
                        </span>
                        <input type="password" id="currentPasswordInput" placeholder="Enter current password" required>
                        <button type="button" class="toggle-password" onclick="togglePasswordVisibility('currentPasswordInput')">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label for="newPasswordInput">New Password</label>
                    <div class="input-group">
                        <span class="input-icon">
                            <i class="fa-solid fa-key"></i>
                        </span>
                        <input type="password" id="newPasswordInput" placeholder="Enter new password" required>
                        <button type="button" class="toggle-password" onclick="togglePasswordVisibility('newPasswordInput')">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                    <div class="password-meter" id="passwordMeterChange">
                        <div class="password-meter-bar" id="passwordMeterBarChange"></div>
                    </div>
                    <small class="password-hint" id="passwordStrengthChange"></small>
                </div>

                <div class="form-group">
                    <label for="confirmPasswordInput">Confirm New Password</label>
                    <div class="input-group">
                        <span class="input-icon">
                            <i class="fa-solid fa-key"></i>
                        </span>
                        <input type="password" id="confirmPasswordInput" placeholder="Confirm new password" required>
                        <button type="button" class="toggle-password" onclick="togglePasswordVisibility('confirmPasswordInput')">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" type="button" onclick="closeModal('changePasswordModal')">Cancel</button>
                    <button class="btn btn-success" type="submit" id="changePasswordBtn">Change Password</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Custom Alert Modal -->
    <div class="modal" id="customAlertModal">
        <div class="modal-content modal-sm">
            <div class="modal-header">
                <h4 id="alertTitle">Alert</h4>
                <button class="close" onclick="closeModal('customAlertModal')"><i class="fa-regular fa-circle-xmark"></i></button>
            </div>
            <div class="modal-body" id="alertMessage">
                Alert message here
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="closeModal('customAlertModal')" type="button" id="alertOkBtn">OK</button>
            </div>
        </div>
    </div>

    <!-- Custom Confirm Modal -->
    <div class="modal" id="customConfirmModal">
        <div class="modal-content modal-sm">
            <div class="modal-header">
                <h4 id="confirmTitle">Confirm</h4>
                <button class="close" onclick="closeCustomConfirm(false)"><i class="fa-regular fa-circle-xmark"></i></button>
            </div>
            <div class="modal-body" id="confirmMessage">
                Confirmation message here
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeCustomConfirm(false)" type="button">Cancel</button>
                <button class="btn btn-danger" onclick="closeCustomConfirm(true)" type="button" id="confirmYesBtn">Confirm</button>
            </div>
        </div>
    </div>

    <script src="./assets/js/api.js?v=<?php echo filemtime('./assets/js/api.js'); ?>" defer></script>
    <script src="./assets/js/crypto-utils.js?v=<?php echo filemtime('./assets/js/crypto-utils.js'); ?>" defer></script>
    <script src="./assets/js/dashboard.js?v=<?php echo filemtime('./assets/js/dashboard.js'); ?>" defer></script>
</body>

</html>