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
     * Encrypt file in chunks to reduce memory usage
     * Format: [mainIV(12)] + [chunkSize(4) + chunkIV(12) + encryptedData] + ...
     * @param {File} file - File object to encrypt
     * @param {CryptoKey} masterKey - Master key
     * @param {Function} progressCallback - Progress callback (bytesProcessed, totalBytes)
     * @returns {Promise<Blob>}
     */
    async encryptFileInChunks(file, masterKey, progressCallback = null) {
        const READ_CHUNK_SIZE = 64 * 1024 * 1024; // 64MB read chunks to save memory
        const mainIv = this.generateRandomBytes(this.IV_SIZE);
        const encryptedParts = [mainIv];
        
        let offset = 0;
        const totalSize = file.size;

        while (offset < totalSize) {
            // Read chunk from file
            const end = Math.min(offset + READ_CHUNK_SIZE, totalSize);
            const chunk = file.slice(offset, end);
            const chunkData = await chunk.arrayBuffer();
            
            // Encrypt this chunk with unique IV
            const chunkIv = this.generateRandomBytes(this.IV_SIZE);
            const encryptedChunk = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: chunkIv },
                masterKey,
                chunkData
            );
            
            // Store: chunkSize(4 bytes) + chunkIV(12 bytes) + encrypted data
            const sizeBytes = new Uint32Array([encryptedChunk.byteLength]);
            encryptedParts.push(new Uint8Array(sizeBytes.buffer));
            encryptedParts.push(chunkIv);
            encryptedParts.push(new Uint8Array(encryptedChunk));
            
            offset = end;
            
            if (progressCallback) {
                progressCallback(offset, totalSize);
            }
            
            // Allow browser to breathe
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        return new Blob(encryptedParts);
    },

    /**
     * Decrypt file in chunks to reduce memory usage
     * @param {Blob} encryptedBlob - Encrypted file blob
     * @param {CryptoKey} masterKey - Master key
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<ArrayBuffer>}
     */
    async decryptFileInChunks(encryptedBlob, masterKey, progressCallback = null) {
        // Skip the main IV (first 12 bytes)
        let offset = this.IV_SIZE;
        const decryptedChunks = [];
        const totalSize = encryptedBlob.size;
        
        while (offset < totalSize) {
            // Read chunk size (4 bytes)
            const sizeBlob = encryptedBlob.slice(offset, offset + 4);
            if (sizeBlob.size < 4) break;
            
            const sizeBuffer = await sizeBlob.arrayBuffer();
            const chunkSize = new Uint32Array(sizeBuffer)[0];
            offset += 4;
            
            // Read chunk IV (12 bytes)
            const chunkIvBlob = encryptedBlob.slice(offset, offset + this.IV_SIZE);
            const chunkIv = new Uint8Array(await chunkIvBlob.arrayBuffer());
            offset += this.IV_SIZE;
            
            // Read encrypted chunk data
            const encChunkBlob = encryptedBlob.slice(offset, offset + chunkSize);
            const chunkData = await encChunkBlob.arrayBuffer();
            
            // Decrypt chunk
            const decryptedChunk = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: chunkIv },
                masterKey,
                chunkData
            );
            
            decryptedChunks.push(new Uint8Array(decryptedChunk));
            offset += chunkSize;
            
            if (progressCallback) {
                const processed = offset - this.IV_SIZE;
                progressCallback(processed, totalSize - this.IV_SIZE);
            }
            
            // Allow browser to breathe
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        // Combine all decrypted chunks
        const totalLength = decryptedChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let position = 0;
        for (const chunk of decryptedChunks) {
            result.set(chunk, position);
            position += chunk.length;
        }
        
        return result.buffer;
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
        return this.arrayBufferToHex(encryptedBuffer);
    },

    async decryptFilename(encryptedFilenameHex, masterKey) {
        const encryptedBuffer = this.hexToArrayBuffer(encryptedFilenameHex);
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
    },

    /**
     * ========================================
     * HIERARCHICAL KEY MANAGEMENT
     * ========================================
     */

    /**
     * Generate a random encryption key for a file or folder (32 bytes)
     * @returns {ArrayBuffer} Random 32-byte key
     */
    generateItemKey() {
        return this.generateRandomBytes(32);
    },

    /**
     * Encrypt an item's key with a parent key (master key or parent folder key)
     * Uses AES-256-GCM
     * @param {ArrayBuffer} itemKey - The key to encrypt (32 bytes)
     * @param {CryptoKey} parentKey - The parent key to encrypt with
     * @returns {string} Hex string (IV + ciphertext + tag)
     */
    async encryptItemKey(itemKey, parentKey) {
        const iv = this.generateRandomBytes(this.IV_SIZE);
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            parentKey,
            itemKey
        );

        // Combine IV + ciphertext (which includes auth tag)
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);

        return this.arrayBufferToHex(combined.buffer);
    },

    /**
     * Decrypt an item's key with a parent key
     * @param {string} encryptedKeyHex - Hex string (IV + ciphertext + tag)
     * @param {CryptoKey} parentKey - The parent key to decrypt with
     * @returns {ArrayBuffer} Decrypted key (32 bytes)
     */
    async decryptItemKey(encryptedKeyHex, parentKey) {
        const encryptedData = this.hexToArrayBuffer(encryptedKeyHex);
        
        // Extract IV and ciphertext
        const iv = encryptedData.slice(0, this.IV_SIZE);
        const ciphertext = encryptedData.slice(this.IV_SIZE);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            parentKey,
            ciphertext
        );

        return decrypted;
    },

    /**
     * Import raw key bytes as a CryptoKey
     * @param {ArrayBuffer} rawKey - Raw key bytes
     * @returns {CryptoKey} Imported crypto key
     */
    async importRawKey(rawKey) {
        return await crypto.subtle.importKey(
            'raw',
            rawKey,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );
    },

    /**
     * Re-encrypt an item's key with a new parent key
     * Used when moving items between folders
     * @param {string} encryptedKeyHex - Current encrypted key (hex)
     * @param {CryptoKey} oldParentKey - Current parent key
     * @param {CryptoKey} newParentKey - New parent key
     * @returns {string} Re-encrypted key (hex)
     */
    async reencryptItemKey(encryptedKeyHex, oldParentKey, newParentKey) {
        // Decrypt with old parent key
        const itemKey = await this.decryptItemKey(encryptedKeyHex, oldParentKey);
        
        // Re-encrypt with new parent key
        return await this.encryptItemKey(itemKey, newParentKey);
    }
};