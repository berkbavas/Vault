/**
 * Crypto Utilities for Client-Side Encryption
 * Provides secure encryption/decryption and key derivation
 */

const CryptoUtils = {
    // Constants
    PBKDF2_ITERATIONS_HASH: 100000,
    PBKDF2_ITERATIONS_KDF: 300000,
    SALT_SIZE: 32,
    IV_SIZE: 12,
    KEY_SIZE: 256,

    /**
     * Generate random bytes
     */
    generateRandomBytes(size) {
        return crypto.getRandomValues(new Uint8Array(size));
    },

    /**
     * Generate random salt
     */
    generateSalt() {
        return this.generateRandomBytes(this.SALT_SIZE);
    },

    /**
     * Convert ArrayBuffer to hex string
     */
    arrayBufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    /**
     * Convert hex string to ArrayBuffer
     */
    hexToArrayBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes.buffer;
    },

    /**
     * Convert ArrayBuffer to base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },

    /**
     * Convert base64 to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    },

    /**
     * Hash password with PBKDF2
     * Returns hex-encoded hash for safe transport
     */
    async hashPassword(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );

        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.PBKDF2_ITERATIONS_HASH,
                hash: 'SHA-256'
            },
            keyMaterial,
            this.KEY_SIZE
        );

        return this.arrayBufferToHex(derivedBits);
    },

    /**
     * Derive encryption key from password
     */
    async deriveKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.PBKDF2_ITERATIONS_KDF,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: this.KEY_SIZE },
            true,
            ['encrypt', 'decrypt']
        );
    },

    /**
     * Generate master key
     */
    async generateMasterKey() {
        return await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: this.KEY_SIZE },
            true,
            ['encrypt', 'decrypt']
        );
    },

    /**
     * Encrypt data with AES-GCM
     */
    async encrypt(data, key) {
        const iv = this.generateRandomBytes(this.IV_SIZE);
        const enc = new TextEncoder();
        const dataBuffer = typeof data === 'string' ? enc.encode(data) : data;

        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            dataBuffer
        );

        // Combine IV + encrypted data
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);

        return combined.buffer;
    },

    /**
     * Decrypt data with AES-GCM
     */
    async decrypt(encryptedData, key) {
        const iv = encryptedData.slice(0, this.IV_SIZE);
        const data = encryptedData.slice(this.IV_SIZE);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );

        return decrypted;
    },

    /**
     * Decrypt to string
     */
    async decryptToString(encryptedData, key) {
        const decrypted = await this.decrypt(encryptedData, key);
        const dec = new TextDecoder();
        return dec.decode(decrypted);
    },

    /**
     * Calculate SHA-256 hash
     */
    async hash(data) {
        const buffer = typeof data === 'string'
            ? new TextEncoder().encode(data)
            : data;
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return this.arrayBufferToHex(hashBuffer);
    },

    /**
     * Encrypt master key with password-derived key
     */
    async encryptMasterKey(masterKey, passwordKey) {
        const exported = await crypto.subtle.exportKey('raw', masterKey);
        const iv = this.generateRandomBytes(this.IV_SIZE);

        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            passwordKey,
            exported
        );

        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);

        return this.arrayBufferToHex(combined.buffer);
    },

    /**
     * Decrypt master key with password-derived key
     */
    async decryptMasterKey(encryptedMasterKey, passwordKey) {
        const combined = this.hexToArrayBuffer(encryptedMasterKey);
        const iv = combined.slice(0, this.IV_SIZE);
        const data = combined.slice(this.IV_SIZE);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            passwordKey,
            data
        );

        return this.arrayBufferToHex(decrypted);
    },

    async importMasterKey(masterKeyData) {
        const keyBuffer =  this.hexToArrayBuffer(masterKeyData);
        return await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'AES-GCM', length: this.KEY_SIZE },
            true,
            ['encrypt', 'decrypt']
        );
    },

    /**
     * Encrypt file data
     * @param {ArrayBuffer} fileData - File data to encrypt
     * @param {CryptoKey} masterKeyBuffer - Master key as CryptoKey
     * @returns {ArrayBuffer} Encrypted file data (IV + encrypted data)
     */
    async encryptFile(fileData, masterKey) {

        // Generate random IV
        const iv = this.generateRandomBytes(this.IV_SIZE);

        // Encrypt file data
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            masterKey,
            fileData
        );

        // Combine IV + encrypted data
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);

        return combined.buffer;
    },

    /**
     * Decrypt file data
     * @param {ArrayBuffer} encryptedData - Encrypted file data (IV + encrypted data)
     * @param {CryptoKey} masterKey - Master key as CryptoKey
     * @returns {ArrayBuffer} Decrypted file data
     */
    async decryptFile(encryptedData, masterKey) {
        // Extract IV and encrypted data
        const iv = encryptedData.slice(0, this.IV_SIZE);
        const data = encryptedData.slice(this.IV_SIZE);

        // Decrypt file data
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            masterKey,
            data
        );

        return decrypted;
    },

    async encryptFilename(filename, masterKey) {
        const enc = new TextEncoder();
        const filenameBuffer = enc.encode(filename);
        const encryptedBuffer = await this.encrypt(filenameBuffer, masterKey);
        return this.arrayBufferToBase64(encryptedBuffer);
    },

    async decryptFilename(encryptedFilenameBase64, masterKey) {
        const encryptedBuffer = this.base64ToArrayBuffer(encryptedFilenameBase64);
        const decryptedBuffer = await this.decrypt(encryptedBuffer, masterKey);
        const dec = new TextDecoder();
        return dec.decode(decryptedBuffer);
    },

    storeMasterKeyInSession(masterKey) {
        sessionStorage.setItem('masterKey', masterKey);
    },

    async getMasterKeyFromSession() {
        const masterKeyHex = sessionStorage.getItem('masterKey');
        if (!masterKeyHex) return null;
        return await this.importMasterKey(masterKeyHex);
    },

    clearMasterKeyFromSession() {
        sessionStorage.removeItem('masterKey');
    }
};