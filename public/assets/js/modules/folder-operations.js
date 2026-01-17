/**
 * Folder Operations Module
 * Handles folder creation, navigation, and hierarchical key management
 */

const FolderOperations = {
    /**
     * Create a new folder
     * Folder name is encrypted with parent key (folder's key or masterKey for root)
     */
    async createFolder(folderName, masterKey, currentFolderId, getParentKeyFn) {
        // Get parent key (master key if root, or current folder's key)
        const parentKey = await getParentKeyFn();

        // Generate new key for this folder
        const folderKey = CryptoUtils.generateItemKey();

        // Encrypt folder key with parent key
        const encryptedFolderKey = await CryptoUtils.encryptItemKey(folderKey, parentKey);

        // Encrypt folder name with parent key
        const encryptedName = await CryptoUtils.encryptFilename(folderName, parentKey);

        const response = await API.files.createFolder(encryptedName, encryptedFolderKey, currentFolderId);
        if (!response.success) {
            throw new Error(response.message || 'Folder creation failed');
        }

        return true;
    },

    /**
     * Move file/folder to a new location
     */
    async moveFile(fileId, newParentId, item, files, masterKey, folderKeyCache) {
        // If moving to the same parent, do nothing
        if (item.parent_id === newParentId) {
            throw new Error('File is already in this location');
        }

        let newEncryptedKey = null;

        // If the item has an encrypted key, we need to re-encrypt it with the new parent's key
        if (item.encrypted_key) {
            // Get the item's current key
            const itemKey = await this.getKeyForItem(item, files, masterKey, folderKeyCache);

            // Export it to raw format
            const itemKeyRaw = await crypto.subtle.exportKey('raw', itemKey);

            // Get the new parent's key
            let newParentKey;
            if (newParentId === null) {
                newParentKey = masterKey;
            } else {
                const newParentFolder = files.find(f => f.id === newParentId && f.type === 'folder');
                if (!newParentFolder) {
                    throw new Error('New parent folder not found');
                }
                newParentKey = await this.getKeyForItem(newParentFolder, files, masterKey, folderKeyCache);
            }

            // Re-encrypt with new parent key
            newEncryptedKey = await CryptoUtils.encryptItemKey(
                await CryptoUtils.importRawKey(itemKeyRaw),
                newParentKey
            );
        }

        const response = await API.files.move(fileId, newParentId, newEncryptedKey);
        if (!response.success) {
            throw new Error(response.message || 'Move failed');
        }

        return true;
    },

    /**
     * Get decrypted key for any file/folder item
     * Recursively decrypts up the hierarchy
     */
    async getKeyForItem(item, files, masterKey, folderKeyCache) {
        // Check cache first
        if (item.type === 'folder' && folderKeyCache.has(item.id)) {
            return folderKeyCache.get(item.id);
        }

        let parentKey;
        if (item.parent_id === null || item.parent_id === undefined) {
            // Root level item, use master key
            parentKey = masterKey;
        } else {
            // Get parent folder's key
            const parentFolder = files.find(f => f.id === item.parent_id);
            if (!parentFolder) {
                throw new Error('Parent folder not found');
            }
            parentKey = await this.getKeyForItem(parentFolder, files, masterKey, folderKeyCache);
        }

        // Decrypt this item's key
        const itemKeyRaw = await CryptoUtils.decryptItemKey(item.encrypted_key, parentKey);
        const itemKey = await CryptoUtils.importRawKey(itemKeyRaw);

        // Cache if it's a folder
        if (item.type === 'folder') {
            folderKeyCache.set(item.id, itemKey);
        }

        return itemKey;
    },

    /**
     * Build folder tree recursively for move dialog
     * Folder names are decrypted with their parent's key
     */
    async buildFolderTree(files, masterKey, currentFolderId, selectedFileId, folderKeyCache) {
        const folders = files.filter(f => f.type === 'folder' && f.id !== selectedFileId);
        const tree = [];

        // Add root
        tree.push({
            id: null,
            name: 'Root',
            level: 0,
            disabled: currentFolderId === null
        });

        // Recursively decrypt and build tree
        const processFolder = async (folder, level, parentKey) => {
            try {
                // Decrypt folder name with parent key
                const decryptedName = await CryptoUtils.decryptFilename(folder.encrypted_name, parentKey);
                
                // Get this folder's key for its children
                let folderKey;
                if (folderKeyCache && folderKeyCache.has(folder.id)) {
                    folderKey = folderKeyCache.get(folder.id);
                } else {
                    const folderKeyRaw = await CryptoUtils.decryptItemKey(folder.encrypted_key, parentKey);
                    folderKey = await CryptoUtils.importRawKey(folderKeyRaw);
                    if (folderKeyCache) {
                        folderKeyCache.set(folder.id, folderKey);
                    }
                }
                
                tree.push({
                    id: folder.id,
                    name: decryptedName,
                    level: level,
                    disabled: folder.id === currentFolderId
                });

                // Find children and process with this folder's key
                const children = folders.filter(f => f.parent_id === folder.id);
                for (const child of children) {
                    await processFolder(child, level + 1, folderKey);
                }
            } catch (error) {
                console.error('Error processing folder:', error);
            }
        };

        // Process root level folders (they use masterKey)
        const rootFolders = folders.filter(f => f.parent_id === null || f.parent_id === undefined);
        for (const folder of rootFolders) {
            await processFolder(folder, 1, masterKey);
        }

        return tree;
    }
};
