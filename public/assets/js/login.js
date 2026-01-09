
document.addEventListener('DOMContentLoaded', () => {
    API.init();

    const form = document.getElementById('login-form');
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const alertContainer = document.getElementById('alert-container');

    form.addEventListener('submit', (e) => onFormSubmit(e));

    async function onFormSubmit(e) {
        e.preventDefault();

        // Clear previous alerts
        alertContainer.innerHTML = '';
        const usernameValue = username.value.trim();
        const passwordValue = password.value;

        if (!usernameValue || !passwordValue) {
            showAlert('Please enter both username and password', 'error');
            return;
        }

        // Disable button and show loading
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

        try {
            // Get client salt
            const clientSaltResponse = await API.auth.getClientSalt(usernameValue);

            if (!clientSaltResponse.success) {
                throw new Error(clientSaltResponse.message || 'Failed to get salt');
            }

            const clientSalt = CryptoUtils.hexToArrayBuffer(clientSaltResponse.data.client_salt);
            const passwordHash = await CryptoUtils.hashPassword(passwordValue, clientSalt);
            const loginResponse = await API.auth.login(usernameValue, passwordHash);

            if (!loginResponse.success) {
                throw new Error(loginResponse.message || 'Login failed');
            }

            showAlert('Login successful! Redirecting...', 'success');

            // Store token
            API.setToken(loginResponse.data.token);

            const kdfSalt = CryptoUtils.hexToArrayBuffer(loginResponse.data.user.kdf_salt);

            // Derive KEK and decrypt master key
            const kek = await CryptoUtils.deriveKey(passwordValue, kdfSalt);
            const masterKey = await CryptoUtils.decryptMasterKey(
                loginResponse.data.user.encrypted_master_key,
                kek
            );

            // Store master key in session storage
            CryptoUtils.storeMasterKeyInSession(masterKey);

            // Redirect to dashboard after short delay
            setTimeout(() => {
                window.location.href = 'dashboard.php';
            }, 2000);

        } catch (error) {
            showAlert('Login failed: ' + error.message, 'error');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    }

    function showAlert(message, type) {
        const alert = document.createElement('div');
        alert.className = `alert ${type}`;
        alert.textContent = message;
        alertContainer.appendChild(alert);
    }
});