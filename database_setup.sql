-- ============================================================================
-- Vault Drive - Database Setup Script
-- ============================================================================
-- Zero-knowledge encrypted cloud storage application
-- Run this script in phpMyAdmin or MySQL command line
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Database Creation
-- ----------------------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS vault_drive
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE vault_drive;

-- ----------------------------------------------------------------------------
-- Users Table
-- ----------------------------------------------------------------------------
-- Stores user accounts with zero-knowledge encryption keys
-- All sensitive data is client-side encrypted before storage

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    
    -- Authentication (all values are hex-encoded)
    password_hash VARCHAR(64) NOT NULL,              -- SHA-256 hash (32 bytes = 64 hex chars)
    server_salt VARCHAR(64) NOT NULL,                -- Server-side salt (32 bytes)
    client_salt VARCHAR(64) NOT NULL,                -- Client-side salt (32 bytes)
    kdf_salt VARCHAR(64) NOT NULL,                   -- Key derivation salt (32 bytes)
    
    -- Encryption
    encrypted_master_key VARCHAR(120) NOT NULL,      -- AES-GCM encrypted (12B IV + 32B cipher + 16B tag = 60 bytes)
    
    -- Storage
    user_folder VARCHAR(255) NOT NULL,               -- Unique folder name for user files
    storage_used BIGINT UNSIGNED DEFAULT 0,          -- Current storage usage in bytes
    storage_quota BIGINT UNSIGNED DEFAULT 10737418240, -- Storage limit (default: 10 GB)
    
    -- Permissions
    is_admin TINYINT(1) UNSIGNED DEFAULT 0,          -- 1 = admin, 0 = regular user
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL,
    
    -- Constraints
    UNIQUE KEY uk_username (username),
    
    -- Validation
    CONSTRAINT chk_storage_used CHECK (storage_used >= 0),
    CONSTRAINT chk_storage_quota CHECK (storage_quota > 0),
    CONSTRAINT chk_is_admin CHECK (is_admin IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Files Table
-- ----------------------------------------------------------------------------
-- Stores encrypted file/folder metadata with hierarchical structure
-- File contents are stored on disk, only metadata is in database

CREATE TABLE IF NOT EXISTS files (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    parent_id INT UNSIGNED DEFAULT NULL,             -- NULL = root level
    
    -- File metadata (encrypted)
    encrypted_name VARCHAR(510) NOT NULL,            -- Hex-encoded encrypted filename (255 bytes)
    encrypted_key VARCHAR(120) NOT NULL,             -- AES-GCM encrypted file key (60 bytes)
    
    -- File properties
    type ENUM('file', 'folder') NOT NULL DEFAULT 'file',
    path VARCHAR(500) NOT NULL,                      -- Relative path within user folder
    size BIGINT UNSIGNED DEFAULT 0,                  -- Encrypted file size in bytes
    original_size BIGINT UNSIGNED DEFAULT 0,         -- Original file size before encryption
    mime_type VARCHAR(255) DEFAULT NULL,             -- MIME type (NULL for folders)
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT fk_files_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_files_parent FOREIGN KEY (parent_id) 
        REFERENCES files(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Indexes
    INDEX idx_files_user_id (user_id),
    INDEX idx_files_parent_id (parent_id),
    INDEX idx_files_type (type),
    INDEX idx_files_user_parent (user_id, parent_id), -- Composite for folder listings
    INDEX idx_files_path (path(255))                  -- Prefix index for path lookups
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- File Shares Table
-- ----------------------------------------------------------------------------
-- Stores share links for encrypted file sharing

CREATE TABLE IF NOT EXISTS file_shares (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id INT UNSIGNED NOT NULL,
    
    -- Share access
    token VARCHAR(128) NOT NULL,                     -- Unique share token (URL-safe)
    encrypted_key VARCHAR(120) NOT NULL,             -- Re-encrypted file key for sharing
    
    -- Expiration
    expires_at TIMESTAMP NULL DEFAULT NULL,          -- NULL = never expires
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE KEY uk_share_token (token),
    
    -- Foreign keys
    CONSTRAINT fk_shares_file FOREIGN KEY (file_id) 
        REFERENCES files(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Indexes
    INDEX idx_shares_file_id (file_id),
    INDEX idx_shares_expires (expires_at)            -- For cleanup of expired shares
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Verification
-- ----------------------------------------------------------------------------

SELECT 'Database setup completed successfully!' AS status;

-- Show table structures
DESCRIBE users;
DESCRIBE files;
DESCRIBE file_shares;