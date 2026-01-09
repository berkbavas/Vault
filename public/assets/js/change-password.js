// Change Password JavaScript

document.addEventListener('DOMContentLoaded', function() {
    API.init();
    checkAuth();
    setupEventListeners();
});

function checkAuth() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.php';
    }
}

function setupEventListeners() {
    const form = document.getElementById('changePasswordForm');
    const newPasswordInput = document.getElementById('newPassword');
    
    form.addEventListener('submit', handleSubmit);
    newPasswordInput.addEventListener('input', checkPasswordStrength);
}

function togglePassword(inputId) {
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

function checkPasswordStrength() {
    const password = document.getElementById('newPassword').value;
    const meter = document.getElementById('passwordMeterBar');
    const strengthText = document.getElementById('passwordStrength');
    
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    const percentage = (strength / 5) * 100;
    meter.style.width = percentage + '%';
    
    if (strength <= 1) {
        meter.className = 'password-meter-bar weak';
        strengthText.textContent = 'Weak password';
        strengthText.style.color = '#ef4444';
    } else if (strength <= 3) {
        meter.className = 'password-meter-bar medium';
        strengthText.textContent = 'Medium strength';
        strengthText.style.color = '#f59e0b';
    } else {
        meter.className = 'password-meter-bar strong';
        strengthText.textContent = 'Strong password';
        strengthText.style.color = '#10b981';
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const submitBtn = document.getElementById('submitBtn');
    
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        showAlert('Please fill in all fields', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showAlert('New passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 8) {
        showAlert('New password must be at least 8 characters long', 'error');
        return;
    }
    
    if (currentPassword === newPassword) {
        showAlert('New password must be different from current password', 'error');
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
        const currentClientSaltBytes = CryptoUtils.hexToBytes(currentClientSalt);
        const currentPasswordHash = await CryptoUtils.derivePasswordHash(currentPassword, currentClientSaltBytes);
        const currentPasswordHashHex = CryptoUtils.bytesToHex(currentPasswordHash);
        
        // Decrypt master key with current password to verify it works
        const currentKdfSaltBytes = CryptoUtils.hexToBytes(currentKdfSalt);
        const currentKek = await CryptoUtils.deriveKEK(currentPassword, currentKdfSaltBytes);
        let masterKey;
        try {
            masterKey = await CryptoUtils.decryptMasterKey(currentEncryptedMasterKey, currentKek);
        } catch (error) {
            throw new Error('Current password is incorrect');
        }
        
        // Generate new salts
        const newClientSalt = crypto.getRandomValues(new Uint8Array(32));
        const newKdfSalt = crypto.getRandomValues(new Uint8Array(32));
        
        // Derive new password hash
        const newPasswordHash = await CryptoUtils.derivePasswordHash(newPassword, newClientSalt);
        const newPasswordHashHex = CryptoUtils.bytesToHex(newPasswordHash);
        
        // Re-encrypt master key with new password
        const newKek = await CryptoUtils.deriveKEK(newPassword, newKdfSalt);
        const newEncryptedMasterKey = await CryptoUtils.encryptMasterKey(masterKey, newKek);
        
        // Call change password API
        const response = await API.auth.changePassword(
            currentPasswordHashHex,
            newPasswordHashHex,
            CryptoUtils.bytesToHex(newClientSalt),
            CryptoUtils.bytesToHex(newKdfSalt),
            newEncryptedMasterKey
        );
        
        if (response.success) {
            showAlert('Password changed successfully! Redirecting to login...', 'success');
            
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
        showAlert(error.message || 'Failed to change password', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-key"></i> Change Password';
    }
}

async function getClientSalt(username) {
    const response = await API.auth.getClientSalt(username);
    if (response.success) {
        return response.data.client_salt;
    }
    throw new Error('Failed to get client salt');
}

function showAlert(message, type) {
    const alert = document.getElementById('alert');
    alert.textContent = message;
    alert.className = `alert alert-${type}`;
    alert.style.display = 'block';
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}
