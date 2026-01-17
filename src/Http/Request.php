<?php

namespace App\Http;

class Request
{
    private $query = [];
    private $request = [];
    private $files = [];
    private $server = [];
    private $headers = [];
    private $cookies = [];
    private $content = null;

    public function __construct()
    {
        $this->query = $_GET ?? [];
        $this->request = $_POST ?? [];
        $this->files = $_FILES ?? [];
        $this->server = $_SERVER ?? [];
        $this->cookies = $_COOKIE ?? [];
        $this->headers = $this->parseHeaders();
    }

    /**
     * Create a new request instance from globals
     */
    public static function capture()
    {
        return new static();
    }

    /**
     * Get the request method
     */
    public function method()
    {
        return strtoupper($this->server['REQUEST_METHOD'] ?? 'GET');
    }

    /**
     * Check if the request method is a specific method
     */
    public function isMethod($method)
    {
        return $this->method() === strtoupper($method);
    }

    /**
     * Get the request URI
     */
    public function uri()
    {
        return $this->server['REQUEST_URI'] ?? '/';
    }

    /**
     * Get the request path
     */
    public function path()
    {
        $uri = $this->uri();
        $position = strpos($uri, '?');
        return $position === false ? $uri : substr($uri, 0, $position);
    }

    /**
     * Get a query string parameter
     */
    public function query($key = null, $default = null)
    {
        if ($key === null) {
            return $this->query;
        }

        return $this->query[$key] ?? $default;
    }

    /**
     * Get a POST parameter
     */
    public function post($key = null, $default = null)
    {
        if ($key === null) {
            return $this->request;
        }

        return $this->request[$key] ?? $default;
    }

    /**
     * Get an input value (from POST or GET)
     */
    public function input($key = null, $default = null)
    {
        if ($key === null) {
            return array_merge($this->query, $this->request);
        }

        return $this->request[$key] ?? $this->query[$key] ?? $default;
    }

    /**
     * Get all input data
     */
    public function all()
    {
        return array_merge($this->query, $this->request);
    }

    /**
     * Get only specific input keys
     */
    public function only($keys)
    {
        $keys = is_array($keys) ? $keys : func_get_args();
        $results = [];

        foreach ($keys as $key) {
            $results[$key] = $this->input($key);
        }

        return $results;
    }

    /**
     * Get all input except specific keys
     */
    public function except($keys)
    {
        $keys = is_array($keys) ? $keys : func_get_args();
        $results = $this->all();

        foreach ($keys as $key) {
            unset($results[$key]);
        }

        return $results;
    }

    /**
     * Check if input key exists
     */
    public function has($key)
    {
        $keys = is_array($key) ? $key : func_get_args();

        foreach ($keys as $value) {
            if (!array_key_exists($value, $this->all())) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if input key exists and is not empty
     */
    public function filled($key)
    {
        $keys = is_array($key) ? $key : func_get_args();

        foreach ($keys as $value) {
            if (empty($this->input($value))) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get uploaded file
     */
    public function file($key)
    {
        if (!isset($this->files[$key])) {
            return null;
        }

        $file = $this->files[$key];

        if ($file['error'] !== UPLOAD_ERR_OK) {
            return null;
        }

        return $file;
    }

    /**
     * Check if file was uploaded
     */
    public function hasFile($key)
    {
        return $this->file($key) !== null;
    }

    /**
     * Get all uploaded files
     */
    public function files()
    {
        return $this->files;
    }

    /**
     * Get a header value
     */
    public function header($key, $default = null)
    {
        $key = strtolower($key);
        return $this->headers[$key] ?? $default;
    }

    /**
     * Get all headers
     */
    public function headers()
    {
        return $this->headers;
    }

    /**
     * Get bearer token from authorization header
     */
    public function bearerToken()
    {
        $authorization = $this->header('Authorization');

        if ($authorization && preg_match('/^Bearer\s+(\S+)$/i', $authorization, $matches)) {
            return $matches[1];
        }

        return null;
    }

    /**
     * Get the client IP address
     */
    public function ip()
    {
        if (!empty($this->server['HTTP_CLIENT_IP'])) {
            return $this->server['HTTP_CLIENT_IP'];
        }

        if (!empty($this->server['HTTP_X_FORWARDED_FOR'])) {
            return $this->server['HTTP_X_FORWARDED_FOR'];
        }

        return $this->server['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    /**
     * Get the user agent
     */
    public function userAgent()
    {
        return $this->server['HTTP_USER_AGENT'] ?? '';
    }

    /**
     * Check if the request is an AJAX request
     */
    public function ajax()
    {
        return $this->header('X-Requested-With') === 'XMLHttpRequest';
    }

    /**
     * Check if the request expects JSON
     */
    public function expectsJson()
    {
        $acceptable = $this->header('Accept', '');
        return strpos($acceptable, 'application/json') !== false;
    }

    /**
     * Check if the request is JSON
     */
    public function isJson()
    {
        $contentType = $this->header('Content-Type', '');
        return strpos($contentType, 'application/json') !== false;
    }

    /**
     * Get JSON input data
     */
    public function json($key = null, $default = null)
    {
        if ($this->content === null) {
            $this->content = json_decode(file_get_contents('php://input'), true) ?? [];
        }

        if ($key === null) {
            return $this->content;
        }

        return $this->content[$key] ?? $default;
    }

    /**
     * Get a cookie value
     */
    public function cookie($key = null, $default = null)
    {
        if ($key === null) {
            return $this->cookies;
        }

        return $this->cookies[$key] ?? $default;
    }

    /**
     * Check if request is secure (HTTPS)
     */
    public function secure()
    {
        return !empty($this->server['HTTPS']) && $this->server['HTTPS'] !== 'off';
    }

    /**
     * Get the request scheme
     */
    public function scheme()
    {
        return $this->secure() ? 'https' : 'http';
    }

    /**
     * Get the host
     */
    public function host()
    {
        return $this->server['HTTP_HOST'] ?? $this->server['SERVER_NAME'] ?? 'localhost';
    }

    /**
     * Get the full URL
     */
    public function url()
    {
        return $this->scheme() . '://' . $this->host() . $this->uri();
    }

    /**
     * Get the full URL without query string
     */
    public function fullUrl()
    {
        return $this->scheme() . '://' . $this->host() . $this->path();
    }

    /**
     * Get server parameter
     */
    public function server($key = null, $default = null)
    {
        if ($key === null) {
            return $this->server;
        }

        return $this->server[$key] ?? $default;
    }

    /**
     * Parse headers from $_SERVER
     */
    private function parseHeaders()
    {
        $headers = [];

        foreach ($this->server as $key => $value) {
            if (strpos($key, 'HTTP_') === 0) {
                $headerKey = strtolower(str_replace('_', '-', substr($key, 5)));
                $headers[$headerKey] = $value;
            } elseif (in_array($key, ['CONTENT_TYPE', 'CONTENT_LENGTH'])) {
                $headerKey = strtolower(str_replace('_', '-', $key));
                $headers[$headerKey] = $value;
            }
        }

        // Handle Authorization header passed via Apache/Nginx
        if (!isset($headers['authorization'])) {
            if (isset($this->server['HTTP_AUTHORIZATION'])) {
                $headers['authorization'] = $this->server['HTTP_AUTHORIZATION'];
            } elseif (isset($this->server['REDIRECT_HTTP_AUTHORIZATION'])) {
                $headers['authorization'] = $this->server['REDIRECT_HTTP_AUTHORIZATION'];
            } elseif (isset($this->server['PHP_AUTH_USER'])) {
                $headers['authorization'] = 'Basic ' . base64_encode(
                    $this->server['PHP_AUTH_USER'] . ':' . ($this->server['PHP_AUTH_PW'] ?? '')
                );
            }
        }

        return $headers;
    }

    /**
     * Validate input data (from POST/GET)
     */
    public function validate(array $rules): array
    {
        return $this->validateData($this->all(), $rules);
    }

    /**
     * Validate JSON input data
     */
    public function validateJson(array $rules): array
    {
        $payload = $this->json();
        
        if (!is_array($payload)) {
            return ['general' => ['Invalid JSON payload.']];
        }

        return $this->validateData($payload, $rules);
    }

    /**
     * Core validation logic for both validate and validateJson
     */
    private function validateData(array $data, array $rules): array
    {
        $errors = [];

        foreach ($rules as $field => $fieldRules) {
            $ruleParts = $this->parseRules($fieldRules);
            $exists = array_key_exists($field, $data);
            $value = $exists ? $data[$field] : null;

            // Skip validation if nullable and field is not present or is null
            if (in_array('nullable', $ruleParts, true) && (!$exists || $value === null)) {
                continue;
            }

            $fieldErrors = $this->validateField($field, $value, $exists, $ruleParts);
            
            if (!empty($fieldErrors)) {
                $errors[$field] = $fieldErrors;
            }
        }

        return $errors;
    }

    /**
     * Parse rules string or array into normalized array
     */
    private function parseRules($rules): array
    {
        if (is_array($rules)) {
            return $rules;
        }

        return array_filter(array_map('trim', explode('|', (string)$rules)));
    }

    /**
     * Validate a single field against its rules
     */
    private function validateField(string $field, $value, bool $exists, array $rules): array
    {
        $errors = [];

        foreach ($rules as $rule) {
            $error = $this->applyRule($field, $value, $exists, $rule);
            
            if ($error !== null) {
                $errors[] = $error;
                
                // Stop on required failure to avoid cascading errors
                if ($rule === 'required') {
                    break;
                }
            }
        }

        return $errors;
    }

    /**
     * Apply a single validation rule and return error message or null
     */
    private function applyRule(string $field, $value, bool $exists, string $rule): ?string
    {
        // Handle parameterized rules (min:N, max:N)
        if (strpos($rule, ':') !== false) {
            [$ruleName, $param] = explode(':', $rule, 2);
            return $this->applyParameterizedRule($field, $value, $exists, $ruleName, $param);
        }

        // Handle simple rules
        return match ($rule) {
            'required' => $this->validateRequired($value, $exists),
            'email' => $this->validateEmail($value, $exists),
            'numeric' => $this->validateNumeric($value, $exists),
            'integer' => $this->validateInteger($value, $exists),
            'string' => $this->validateString($value, $exists),
            'array' => $this->validateArray($value, $exists),
            'alpha_num' => $this->validateAlphaNum($value, $exists),
            'alpha_num_dash' => $this->validateAlphaNumDash($value, $exists),
            'hex' => $this->validateHex($value, $exists),
            'boolean' => $this->validateBoolean($value, $exists),
            default => null, // Unknown rules are ignored (nullable, etc.)
        };
    }

    /**
     * Apply parameterized validation rules
     */
    private function applyParameterizedRule(string $field, $value, bool $exists, string $ruleName, string $param): ?string
    {
        if (!$exists || $value === null) {
            return null;
        }

        return match ($ruleName) {
            'min' => $this->validateMin($value, (int)$param),
            'max' => $this->validateMax($value, (int)$param),
            default => null,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Individual Rule Validators
    // ─────────────────────────────────────────────────────────────────────────

    private function validateRequired($value, bool $exists): ?string
    {
        if (!$exists || $value === null) {
            return 'This field is required.';
        }

        if (is_string($value) && trim($value) === '') {
            return 'This field is required.';
        }

        return null;
    }

    private function validateEmail($value, bool $exists): ?string
    {
        if (!$exists || $value === null || $value === '') {
            return null;
        }

        return filter_var($value, FILTER_VALIDATE_EMAIL) ? null : 'This field must be a valid email.';
    }

    private function validateNumeric($value, bool $exists): ?string
    {
        if (!$exists || $value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? null : 'This field must be numeric.';
    }

    private function validateInteger($value, bool $exists): ?string
    {
        if (!$exists || $value === null) {
            return null;
        }

        return is_int($value) ? null : 'This field must be an integer.';
    }

    private function validateString($value, bool $exists): ?string
    {
        if (!$exists || $value === null) {
            return null;
        }

        return is_string($value) ? null : 'This field must be a string.';
    }

    private function validateArray($value, bool $exists): ?string
    {
        if (!$exists || $value === null) {
            return null;
        }

        return is_array($value) ? null : 'This field must be an array.';
    }

    private function validateBoolean($value, bool $exists): ?string
    {
        if (!$exists || $value === null) {
            return null;
        }

        return is_bool($value) ? null : 'This field must be a boolean.';
    }

    private function validateAlphaNum($value, bool $exists): ?string
    {
        if (!$exists || $value === null || $value === '') {
            return null;
        }

        return preg_match('/^[a-zA-Z0-9]+$/', $value) ? null : 'This field must be alphanumeric.';
    }

    private function validateAlphaNumDash($value, bool $exists): ?string
    {
        if (!$exists || $value === null || $value === '') {
            return null;
        }

        return preg_match('/^[a-zA-Z0-9_-]+$/', $value) 
            ? null 
            : 'This field may only contain letters, numbers, dashes, and underscores.';
    }

    private function validateHex($value, bool $exists): ?string
    {
        if (!$exists || $value === null || $value === '') {
            return null;
        }

        return (is_string($value) && ctype_xdigit($value)) 
            ? null 
            : 'This field must be a valid hexadecimal string.';
    }

    private function validateMin($value, int $min): ?string
    {
        if (is_string($value) && strlen($value) < $min) {
            return "This field must be at least $min characters.";
        }

        if (is_array($value) && count($value) < $min) {
            return "This field must have at least $min items.";
        }

        if (is_numeric($value) && $value < $min) {
            return "This field must be at least $min.";
        }

        return null;
    }

    private function validateMax($value, int $max): ?string
    {
        if (is_string($value) && strlen($value) > $max) {
            return "This field must not exceed $max characters.";
        }

        if (is_array($value) && count($value) > $max) {
            return "This field must not have more than $max items.";
        }

        if (is_numeric($value) && $value > $max) {
            return "This field must not exceed $max.";
        }

        return null;
    }

    public function validateFile()
    {
        $errors = [];

        if (!isset($_FILES['file'])) {
            $errors['file'][] = 'No file uploaded.';
            return $errors;
        }

        $file = $_FILES['file'];

        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errors['file'][] = 'File upload error code: ' . $file['error'];
            return $errors;
        }

        return $errors;
    }

    public function validateChunk()
    {
        $errors = [];

        if (!isset($_FILES['chunk'])) {
            $errors['chunk'][] = 'No chunk uploaded.';
            return $errors;
        }

        $chunk = $_FILES['chunk'];

        if ($chunk['error'] !== UPLOAD_ERR_OK) {
            $errors['chunk'][] = 'Chunk upload error code: ' . $chunk['error'];
            return $errors;
        }

        return $errors;
    }

    /**
     * Check if request is GET
     */
    public function isGet()
    {
        return $this->isMethod('GET');
    }

    /**
     * Check if request is POST
     */
    public function isPost()
    {
        return $this->isMethod('POST');
    }

    /**
     * Check if request is PUT
     */
    public function isPut()
    {
        return $this->isMethod('PUT');
    }

    /**
     * Check if request is DELETE
     */
    public function isDelete()
    {
        return $this->isMethod('DELETE');
    }

    /**
     * Check if request is PATCH
     */
    public function isPatch()
    {
        return $this->isMethod('PATCH');
    }

    /**
     * Magic method to get input as property
     */
    public function __get($key)
    {
        return $this->input($key);
    }

    /**
     * Magic method to check if input exists
     */
    public function __isset($key)
    {
        return $this->has($key);
    }
}
