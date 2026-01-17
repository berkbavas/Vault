<?php

/**
 * Vault Drive Application Configuration
 * 
 * This file contains all application configuration settings.
 * Copy this file to create environment-specific configs.
 * 
 * Usage:
 *   $config = require 'config/app.php';
 *   $dbHost = $config['database']['host'];
 *   
 * Or with Bootstrap:
 *   $app = Bootstrap::getInstance();
 *   $dbHost = $app->getConfig('database.host');
 */


return [
    /**
     * Application Settings
     * 
     * Configure basic application information and behavior
     */
    'app' => [
        'name' => 'Vault Drive',
        'version' => '1.0.0',
        'environment' => 'development', // development, staging, production
        'url' => 'http://localhost/vault-drive',
        'timezone' => 'UTC',
        'debug' => true,
        'log_errors' => true,
        'log_path' => __DIR__ . '/../logs/app.log',
    ],

    /**
     * Database Configuration
     * 
     * Configure database connection settings
     * 
     * Example for remote database:
     * 'host' => 'db.example.com',
     * 'username' => 'vault_user',
     * 'password' => 'secure_password',
     */
    'database' => [
        'driver' => 'mysql',
        'host' => 'localhost',
        'port' => '3306',
        'database' => 'vault_drive',
        'username' => 'root',
        'password' => '',
        'charset' => 'utf8mb4',
        'collation' => 'utf8mb4_unicode_ci',
        'prefix' => '',
        'strict' => true,
        'engine' => null,
        'options' => [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_PERSISTENT => false,
        ]
    ],

    /**
     * JWT (JSON Web Token) Configuration
     * 
     * Used for API authentication
     * 
     * IMPORTANT: Change the secret in production!
     * Generate a strong secret: openssl rand -base64 32
     */
    'jwt' => [
        'secret' => 'ssCU1ZKqDMu7A3qRCZoOKE0G6q8v1Y3h5gX2Jr0p9mE=',
        'algorithm' => 'HS256',
        'expiration' => 86400, // 24 hours in seconds
        'refresh_expiration' => 604800, // 7 days in seconds
        'issuer' => 'vault-drive',
        'audience' => 'vault-drive-users',
    ],

    /**
     * Storage Configuration
     * 
     * File storage and upload settings
     * 
     * Quota examples:
     * - 100 MB: 104857600
     * - 500 MB: 524288000
     * - 1 GB: 1073741824
     * - 5 GB: 5368709120
     */
    'storage' => [
        // Default storage quota per user (bytes)
        'default_quota' => 10000000, // 10 MB

        // Upload chunk size for multipart uploads
        'chunk_size' => 1048576, // 1 MB

        // Maximum file size allowed
        'max_file_size' => 524288000, // 500 MB

        // Maximum name length for files and folders
        'max_name_length' => 255,

        // Storage directories (relative to project root)
        'upload_dir' => __DIR__ . '/../storage/uploads',
        'temp_dir' => __DIR__ . '/../storage/uploads/temp',

        // Cleanup settings
        'cleanup_orphaned_uploads' => true,
        'orphaned_upload_max_age' => 86400, // 24 hours
    ],

    /**
     * Security Configuration
     * 
     * Cryptographic and security settings
     */
    'security' => [
        // PBKDF2 settings for password hashing
        'pbkdf2_iterations' => 400000,
        'pbkdf2_algorithm' => 'sha256',
        'salt_bytes' => 32, // 256 bits
        'pbkdf2_key_length' => 32, // 256 bits

        // Session settings
        'session_lifetime' => 86400, // 24 hours
        'session_name' => 'VAULT_DRIVE_SESSION',

        // CORS settings
        'cors_enabled' => true,
        'cors_origins' => ['*'], // Restrict in production!
        'cors_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        'cors_headers' => ['Content-Type', 'Authorization'],

        // Rate limiting
        'rate_limit_enabled' => true,
        'rate_limit_requests' => 100,
        'rate_limit_period' => 3600, // per hour

        'share_token_bytes' => 64, // 128 characters in hex
    ],

    /**
     * User Configuration
     * 
     * User account and registration settings
     */
    'user' => [
        // Username requirements
        'username_min_length' => 3,
        'username_max_length' => 50,
        'username_pattern' => '/^[a-zA-Z0-9_-]+$/',

        // Account settings
        'allow_registration' => true,
    ],

    /**
     * Email Configuration
     * 
     * Email service settings for notifications
     * 
     * Example with SMTP:
     * 'driver' => 'smtp',
     * 'host' => 'smtp.gmail.com',
     * 'port' => 587,
     * 'username' => 'your-email@gmail.com',
     * 'password' => 'your-app-password',
     */
    'mail' => [
        'driver' => 'mail', // mail, smtp, sendmail
        'from' => [
            'address' => 'noreply@vault-drive.local',
            'name' => 'Vault Drive',
        ],
        'host' => 'smtp.mailtrap.io',
        'port' => 2525,
        'username' => null,
        'password' => null,
        'encryption' => 'tls', // tls, ssl, null
    ],

    /**
     * Cache Configuration
     * 
     * Caching settings for improved performance
     */
    'cache' => [
        'enabled' => false,
        'driver' => 'file', // file, redis, memcached
        'ttl' => 3600, // 1 hour default
        'prefix' => 'vault_drive_',
        'path' => __DIR__ . '/../cache',
    ],

    /**
     * Logging Configuration
     * 
     * Application logging settings
     */
    'logging' => [
        'enabled' => true,
        'level' => 'debug', // debug, info, warning, error, critical
        'path' => __DIR__ . '/../logs',
        'max_files' => 30, // Keep logs for 30 days
        'log_queries' => false, // Log all database queries
    ],

    /**
     * API Configuration
     * 
     * API-specific settings
     */
    'api' => [
        'prefix' => 'api',
        'version' => 'v1',
        'rate_limit' => [
            'enabled' => true,
            'max_requests' => 100,
            'per_minutes' => 60,
        ],
        'pagination' => [
            'default_per_page' => 15,
            'max_per_page' => 100,
        ],
    ],
];
