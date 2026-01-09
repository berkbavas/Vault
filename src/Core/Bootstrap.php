<?php

namespace App\Core;

use PDO;
use Exception;

class Bootstrap
{
    private static $instance = null;
    private $config;
    private $pdo;

    private function __construct()
    {
        $this->loadConfig();
        $this->setupErrorHandling();
        $this->setupTimezone();
        $this->initDatabase();
    }

    /**
     * Get singleton instance
     */
    public static function getInstance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Load configuration
     */
    private function loadConfig()
    {
        $configPath = __DIR__ . '/../../config/app.php';
        
        if (!file_exists($configPath)) {
            throw new Exception('Configuration file not found');
        }

        $this->config = require $configPath;
    }

    /**
     * Setup error handling
     */
    private function setupErrorHandling()
    {
        if ($this->config['app']['debug']) {
            error_reporting(E_ALL);
            ini_set('display_errors', 1);
        } else {
            error_reporting(0);
            ini_set('display_errors', 0);
        }

        set_error_handler(function ($errno, $errstr, $errfile, $errline) {
            throw new \ErrorException($errstr, 0, $errno, $errfile, $errline);
        });
    }

    /**
     * Setup timezone
     */
    private function setupTimezone()
    {
        date_default_timezone_set($this->config['app']['timezone']);
    }

    /**
     * Initialize database connection
     */
    private function initDatabase()
    {
        try {
            $db = $this->config['database'];
            
            $dsn = sprintf(
                '%s:host=%s;port=%s;dbname=%s;charset=%s',
                $db['driver'],
                $db['host'],
                $db['port'],
                $db['database'],
                $db['charset']
            );

            $this->pdo = new PDO($dsn, $db['username'], $db['password'], $db['options']);
        } catch (\PDOException $e) {
            throw new Exception('Database connection failed: ' . $e->getMessage());
        }
    }

    /**
     * Get database connection
     */
    public function getDatabase()
    {
        return $this->pdo;
    }

    /**
     * Get configuration
     */
    public function getConfig($key = null, $default = null)
    {
        if ($key === null) {
            return $this->config;
        }

        // Support dot notation (e.g., 'database.host')
        $keys = explode('.', $key);
        $value = $this->config;

        foreach ($keys as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }
            $value = $value[$segment];
        }

        return $value;
    }

    /**
     * Create necessary directories
     */
    public function createDirectories()
    {
        $dirs = [
            $this->config['storage']['upload_dir'],
            $this->config['storage']['temp_dir'],
        ];

        foreach ($dirs as $dir) {
            if (!file_exists($dir)) {
                mkdir($dir, 0755, true);
            }
        }
    }

    /**
     * Initialize application
     */
    public static function init()
    {
        $app = self::getInstance();
        $app->createDirectories();
        return $app;
    }

    /**
     * Prevent cloning
     */
    private function __clone() {}

    /**
     * Prevent unserialization
     */
    public function __wakeup()
    {
        throw new Exception("Cannot unserialize singleton");
    }
}
