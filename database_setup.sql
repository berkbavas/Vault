-- Database setup for Vault Drive application
-- Run this in phpMyAdmin or MySQL command line

-- Create database
CREATE DATABASE IF NOT EXISTS vault_drive;
USE vault_drive;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(64) NOT NULL, -- 32 bytes in hex
    server_salt VARCHAR(64) NOT NULL, -- 32 bytes in hex
    client_salt VARCHAR(64) NOT NULL, -- 32 bytes in hex
    kdf_salt VARCHAR(64) NOT NULL, -- 32 bytes in hex
    encrypted_master_key VARCHAR(120) NOT NULL, -- 60 bytes in hex, 12 bytes IV + 32 bytes ciphertext + 16 bytes tag
    user_folder VARCHAR(255) NOT NULL,
    storage_used BIGINT DEFAULT 0,
    storage_quota BIGINT DEFAULT 10737418240, -- Default 10 GB
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL
);

-- Add indexes for better performance
CREATE INDEX idx_username ON users(username);
CREATE INDEX idx_created_at ON users(created_at);

-- Create files table for file and folder management
CREATE TABLE IF NOT EXISTS files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    parent_id INT DEFAULT NULL,
    encrypted_name VARCHAR(510) NOT NULL, -- 255 bytes in hex
    type ENUM('file', 'folder') NOT NULL DEFAULT 'file',
    path VARCHAR(500) NOT NULL,
    size BIGINT DEFAULT 0,
    original_size BIGINT DEFAULT 0,
    mime_type VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX idx_user_id ON files(user_id);
CREATE INDEX idx_parent_id ON files(parent_id);
CREATE INDEX idx_type ON files(type);

-- Display table structure
DESCRIBE users;
DESCRIBE files;