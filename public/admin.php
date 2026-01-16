<!doctype html>
<html lang="en">

<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin Panel - Vault Drive</title>

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">

    <!-- Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />

    <link rel="stylesheet" href="./assets/css/style.css?v=<?php echo filemtime('./assets/css/style.css') ?>" />
    <link rel="stylesheet" href="./assets/css/admin.css?v=<?php echo filemtime('./assets/css/admin.css') ?>" />
    <link rel="stylesheet" href="./assets/css/animations.css?v=<?php echo filemtime('./assets/css/animations.css') ?>" />
</head>

<body>
    <!-- Loading Overlay -->
    <div id="loading-overlay" class="loading-overlay hidden">
        <div class="loading-card">
            <div class="spinner"></div>
            <div id="loading-text" class="loading-text">Loading...</div>
        </div>
    </div>

    <div class="admin-panel">
        <a href="index.php" class="back-link">
            <i class="fa-solid fa-arrow-left"></i>
            Back to Vault Drive
        </a>

        <div class="admin-header scan-effect">
            <h1><i class="fa-solid fa-shield-halved"></i> Admin Panel</h1>
            <p>Manage users, quotas, and system settings</p>
        </div>

        <div class="admin-stats">
            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-icon primary">
                        <i class="fa-solid fa-users"></i>
                    </div>
                    <div>
                        <div class="stat-label">Total Users</div>
                        <div class="stat-value" id="total-users">0</div>
                    </div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-icon success">
                        <i class="fa-solid fa-database"></i>
                    </div>
                    <div>
                        <div class="stat-label">Total Storage Used</div>
                        <div class="stat-value" id="total-storage">0 GB</div>
                    </div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-icon warning">
                        <i class="fa-solid fa-chart-line"></i>
                    </div>
                    <div>
                        <div class="stat-label">Total Quota</div>
                        <div class="stat-value" id="total-quota">0 GB</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="users-table-container">
            <div class="users-table-header">
                <h2>Users Management</h2>
                <p>Manage user accounts, quotas, and permissions</p>
            </div>

            <div id="loading-state" class="loading-state">
                <div class="spinner"></div>
                <p>Loading users...</p>
            </div>

            <div id="users-table-wrapper" style="display: none;">
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Storage Usage</th>
                            <th>Created</th>
                            <th>Last Login</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="users-table-body">
                        <!-- Users will be loaded here -->
                    </tbody>
                </table>
            </div>

            <!-- Mobile Cards View -->
            <div id="users-cards-container">
                <!-- User cards will be loaded here for mobile -->
            </div>

            <div id="empty-state" class="empty-state-admin" style="display: none;">
                <i class="fa-regular fa-users"></i>
                <h3>No users found</h3>
                <p>There are no users in the system yet.</p>
            </div>
        </div>
    </div>

    <!-- Edit Quota Modal -->
    <div id="edit-quota-modal" class="modal hidden">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Edit User Quota</h3>
                <button class="modal-close" onclick="closeEditQuotaModal()">&times;</button>
            </div>
            <form id="edit-quota-form" class="modal-body">
                <input type="hidden" id="edit-quota-user-id">
                <div class="field">
                    <label for="edit-quota-username">Username</label>
                    <input type="text" id="edit-quota-username" disabled>
                </div>
                <div class="field">
                    <label for="edit-quota-value">Storage Quota (MB)</label>
                    <input type="number" id="edit-quota-value" required placeholder="10240">
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeEditQuotaModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Update Quota</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Toasts -->
    <div id="toast-container" class="toast-container"></div>

    <script src="assets/js/crypto-utils.js?v=<?php echo filemtime('assets/js/crypto-utils.js'); ?>"></script>
    <script src="assets/js/api.js?v=<?php echo filemtime('assets/js/api.js'); ?>"></script>
    <script src="assets/js/modules/ui-helpers.js?v=<?php echo filemtime('assets/js/modules/ui-helpers.js'); ?>"></script>
    <script src="assets/js/admin.js?v=<?php echo filemtime('assets/js/admin.js'); ?>"></script>
</body>

</html>