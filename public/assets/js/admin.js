// Admin Panel JavaScript
let allUsers = [];

// Load users on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadUsers();
});

async function loadUsers() {
    try {
        showLoading('Loading users...');
        const response = await API.admin.listUsers();

        if (response.success) {
            allUsers = response.data;
            renderUsers(allUsers);
            updateStats(allUsers);
        } else {
            showToast(response.error || 'Failed to load users', 'error');
        }
    } catch (error) {
        showToast('Error loading users: ' + error.message, 'error');
        console.error('Error loading users:', error);
    } finally {
        hideLoading();
    }
}

function renderUsers(users) {
    const tableBody = document.getElementById('users-table-body');
    const cardsContainer = document.getElementById('users-cards-container');
    const loadingState = document.getElementById('loading-state');
    const tableWrapper = document.getElementById('users-table-wrapper');
    const emptyState = document.getElementById('empty-state');

    loadingState.style.display = 'none';

    if (users.length === 0) {
        tableWrapper.style.display = 'none';
        if (cardsContainer) cardsContainer.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    tableWrapper.style.display = 'block';
    emptyState.style.display = 'none';

    // Render table view
    tableBody.innerHTML = users.map(user => {
        const usedMB = (user.storage_used / (1024 * 1024)).toFixed(2);
        const quotaMB = (user.storage_quota / (1024 * 1024)).toFixed(2);
        const percentage = user.storage_quota > 0 ? (user.storage_used / user.storage_quota * 100).toFixed(1) : 0;
        const initial = user.username.charAt(0).toUpperCase();
        const createdDate = new Date(user.created_at).toLocaleDateString();
        const lastLogin = user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never';

        return `
                    <tr>
                        <td>
                            <div class="user-info">
                                <div class="user-avatar">${initial}</div>
                                <div class="user-details">
                                    <div class="user-username">${escapeHtml(user.username)}</div>
                                    <div class="user-id">ID: ${user.id}</div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span class="badge ${user.is_admin ? 'admin' : 'user'}">
                                ${user.is_admin ? '<i class="fa-solid fa-shield"></i> Admin' : '<i class="fa-solid fa-user"></i> User'}
                            </span>
                        </td>
                        <td>
                            <div class="quota-info">
                                <div class="quota-text">${usedMB} MB / ${quotaMB} MB</div>
                                <div class="quota-bar-mini">
                                    <div class="quota-bar-mini-fill" style="width: ${Math.min(percentage, 100)}%"></div>
                                </div>
                            </div>
                        </td>
                        <td>${createdDate}</td>
                        <td>${lastLogin}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn-icon" onclick="openEditQuotaModal(${user.id}, '${escapeHtml(user.username)}', ${quotaMB})" title="Edit Quota">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button class="btn-icon danger" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')" title="Delete User" ${user.is_admin ? 'disabled' : ''}>
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
    }).join('');

    // Render cards view for mobile
    if (cardsContainer) {
        cardsContainer.innerHTML = users.map(user => {
            const usedMB = (user.storage_used / (1024 * 1024)).toFixed(2);
            const quotaMB = (user.storage_quota / (1024 * 1024)).toFixed(2);
            const percentage = user.storage_quota > 0 ? (user.storage_used / user.storage_quota * 100).toFixed(1) : 0;
            const initial = user.username.charAt(0).toUpperCase();
            const createdDate = new Date(user.created_at).toLocaleDateString();
            const lastLogin = user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never';

            return `
                <div class="user-card">
                    <div class="user-card-header">
                        <div class="user-card-info">
                            <div class="user-card-avatar">${initial}</div>
                            <div class="user-card-details">
                                <div class="user-card-username">${escapeHtml(user.username)}</div>
                                <div class="user-card-id">ID: ${user.id}</div>
                            </div>
                        </div>
                        <span class="badge ${user.is_admin ? 'admin' : 'user'}">
                            ${user.is_admin ? '<i class="fa-solid fa-shield"></i> Admin' : '<i class="fa-solid fa-user"></i> User'}
                        </span>
                    </div>
                    <div class="user-card-body">
                        <div class="user-card-row">
                            <span class="user-card-label">Storage Usage</span>
                        </div>
                        <div class="user-card-quota">
                            <div class="user-card-quota-text">${usedMB} MB / ${quotaMB} MB</div>
                            <div class="user-card-quota-bar">
                                <div class="user-card-quota-fill" style="width: ${Math.min(percentage, 100)}%"></div>
                            </div>
                        </div>
                        <div class="user-card-row">
                            <span class="user-card-label">Created</span>
                            <span class="user-card-value">${createdDate}</span>
                        </div>
                        <div class="user-card-row">
                            <span class="user-card-label">Last Login</span>
                            <span class="user-card-value">${lastLogin}</span>
                        </div>
                    </div>
                    <div class="user-card-actions">
                        <button class="btn-icon" onclick="openEditQuotaModal(${user.id}, '${escapeHtml(user.username)}', ${quotaMB})">
                            <i class="fa-solid fa-pen-to-square"></i> Edit Quota
                        </button>
                        <button class="btn-icon danger" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')" ${user.is_admin ? 'disabled' : ''}>
                            <i class="fa-solid fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function updateStats(users) {
    const totalUsers = users.length;
    const totalUsed = users.reduce((sum, user) => sum + parseInt(user.storage_used), 0);
    const totalQuota = users.reduce((sum, user) => sum + parseInt(user.storage_quota), 0);

    document.getElementById('total-users').textContent = totalUsers;
    document.getElementById('total-storage').textContent = (totalUsed / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    document.getElementById('total-quota').textContent = (totalQuota / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function openEditQuotaModal(userId, username, currentQuota) {
    document.getElementById('edit-quota-user-id').value = userId;
    document.getElementById('edit-quota-username').value = username;
    document.getElementById('edit-quota-value').value = currentQuota;
    document.getElementById('edit-quota-modal').classList.remove('hidden');
}

function closeEditQuotaModal() {
    document.getElementById('edit-quota-modal').classList.add('hidden');
    document.getElementById('edit-quota-form').reset();
}

document.getElementById('edit-quota-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = parseInt(document.getElementById('edit-quota-user-id').value);
    const quotaMB = parseFloat(document.getElementById('edit-quota-value').value);
    const quotaBytes = Math.floor(quotaMB * 1024 * 1024);

    try {
        showLoading('Updating quota...');
        const response = await API.admin.updateQuota({
            user_id: userId,
            quota: quotaBytes
        });

        if (response.success) {
            showToast('Quota updated successfully', 'success');
            closeEditQuotaModal();
            await loadUsers();
        } else {
            showToast(response.error || 'Failed to update quota', 'error');
        }
    } catch (error) {
        showToast('Error updating quota: ' + error.message, 'error');
        console.error('Error updating quota:', error);
    } finally {
        hideLoading();
    }
});

async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone and will delete all their files.`)) {
        return;
    }

    try {
        showLoading('Deleting user...');
        const response = await API.admin.deleteUser(userId);

        if (response.success) {
            showToast('User deleted successfully', 'success');
            await loadUsers();
        } else {
            showToast(response.error || 'Failed to delete user', 'error');
        }
    } catch (error) {
        showToast('Error deleting user: ' + error.message, 'error');
        console.error('Error deleting user:', error);
    } finally {
        hideLoading();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(message = 'Loading...') {
    document.getElementById('loading-text').textContent = message;
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// Close modals on background click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
});