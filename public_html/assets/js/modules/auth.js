/**
 * Authentication Module
 * Handles user registration, login, logout, and password management
 */

const AuthModule = {
    /**
     * Handle user login
     */
    async handleLogin(username, password) {
        if (!username || !password) {
            throw new Error('Please enter username and password');
        }

        // Get client salt
        const saltResponse = await API.auth.getClientSalt(username);
        if (!saltResponse.success) {
            throw new Error(saltResponse.message || 'Failed to get client salt');
        }

        const clientSalt = CryptoUtils.hexToArrayBuffer(saltResponse.data.client_salt);

        // Hash password for authentication
        const passwordHash = await CryptoUtils.hashPassword(password, clientSalt);

        // Login
        const loginResponse = await API.auth.login(username, passwordHash);
        if (!loginResponse.success) {
            throw new Error(loginResponse.message || 'Login failed');
        }

        // Store token
        API.setToken(loginResponse.data.token);

        const kdfSalt = CryptoUtils.hexToArrayBuffer(loginResponse.data.user.kdf_salt);
        const encryptedMasterKey = loginResponse.data.user.encrypted_master_key;

        // Derive key and decrypt master key
        const passwordKey = await CryptoUtils.deriveKey(password, kdfSalt);
        const masterKeyHex = await CryptoUtils.decryptMasterKey(encryptedMasterKey, passwordKey);
        const masterKey = await CryptoUtils.importMasterKey(masterKeyHex);

        // Store master key in session
        CryptoUtils.storeMasterKeyInSession(masterKeyHex);

        return { masterKey, user: loginResponse.data.user };
    },

    /**
     * Handle user registration
     */
    async handleRegister(username, password, confirmPassword) {
        if (!username || !password || !confirmPassword) {
            throw new Error('Please fill in all fields');
        }

        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }

        if (password.length < 4) {
            throw new Error('Password must be at least 4 characters');
        }

        // Generate salts
        const clientSalt = CryptoUtils.generateSalt();
        const kdfSalt = CryptoUtils.generateSalt();

        // Hash password
        const passwordHash = await CryptoUtils.hashPassword(password, clientSalt);

        // Generate and encrypt master key
        const masterKey = await CryptoUtils.generateMasterKey();
        const passwordKey = await CryptoUtils.deriveKey(password, kdfSalt);
        const encryptedMasterKey = await CryptoUtils.encryptMasterKey(masterKey, passwordKey);

        // Register
        const response = await API.auth.register(
            username,
            CryptoUtils.arrayBufferToHex(clientSalt),
            CryptoUtils.arrayBufferToHex(kdfSalt),
            passwordHash,
            encryptedMasterKey
        );

        if (!response.success) {
            throw new Error(response.message || 'Registration failed');
        }

        return { username };
    },

    /**
     * Handle change password
     */
    async handleChangePassword(currentPassword, newPassword, confirmNewPassword, masterKey) {
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            throw new Error('Please fill in all fields');
        }

        if (newPassword !== confirmNewPassword) {
            throw new Error('New passwords do not match');
        }

        if (newPassword.length < 4) {
            throw new Error('Password must be at least 4 characters');
        }

        // Get current user
        const userResponse = await API.auth.me();
        if (!userResponse.success) {
            throw new Error('Failed to get user info');
        }

        const user = userResponse.data;

        // Verify current password
        const clientSalt = CryptoUtils.hexToArrayBuffer(user.client_salt);
        const currentPasswordHash = await CryptoUtils.hashPassword(currentPassword, clientSalt);

        // Generate new salts
        const newClientSalt = CryptoUtils.generateSalt();
        const newKdfSalt = CryptoUtils.generateSalt();

        // Hash new password
        const newPasswordHash = await CryptoUtils.hashPassword(newPassword, newClientSalt);

        // Re-encrypt master key with new password
        const masterKeyHex = CryptoUtils.arrayBufferToHex(await crypto.subtle.exportKey('raw', masterKey));
        const newPasswordKey = await CryptoUtils.deriveKey(newPassword, newKdfSalt);
        const newEncryptedMasterKey = await CryptoUtils.encryptMasterKey(
            await CryptoUtils.importMasterKey(masterKeyHex),
            newPasswordKey
        );

        // Change password
        const response = await API.auth.changePassword(
            currentPasswordHash,
            newPasswordHash,
            CryptoUtils.arrayBufferToHex(newClientSalt),
            CryptoUtils.arrayBufferToHex(newKdfSalt),
            newEncryptedMasterKey
        );

        if (!response.success) {
            throw new Error(response.message || 'Password change failed');
        }

        return true;
    },

    /**
     * Load user info
     */
    async loadUserInfo() {
        const response = await API.auth.me();
        if (response.success) {
            return response.data;
        }
        throw new Error('Failed to load user info');
    }
};
