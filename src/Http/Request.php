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
     * Validate input data
     */
    public function validate($rules)
    {
        $errors = [];

        foreach ($rules as $field => $fieldRules) {
            $value = $this->input($field);
            $rulesArray = is_string($fieldRules) ? explode('|', $fieldRules) : $fieldRules;

            foreach ($rulesArray as $rule) {
                if ($rule === 'required' && empty($value)) {
                    $errors[$field][] = "$field is required";
                }

                if ($rule === 'email' && !empty($value) && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $errors[$field][] = "$field must be a valid email";
                }

                if (strpos($rule, 'min:') === 0) {
                    $min = (int)substr($rule, 4);
                    if (is_string($value) && !empty($value) && strlen($value) < $min) {
                        $errors[$field][] = "$field must be at least $min characters";
                    }
                }

                if (strpos($rule, 'max:') === 0) {
                    $max = (int)substr($rule, 4);
                    if (is_string($value) && !empty($value) && strlen($value) > $max) {
                        $errors[$field][] = "$field must not exceed $max characters";
                    }
                }

                if ($rule === 'numeric' && !empty($value) && !is_numeric($value)) {
                    $errors[$field][] = "$field must be numeric";
                }
            }
        }

        return $errors;
    }

    /**
     * Validate JSON input data
     */
    public function validateJson(array $rules): array
    {
        // 1) Ensure request is JSON and decodable (adjust if your Request class already decodes)
        $payload = $this->json(); // Get entire JSON payload as associative array

        $errors = [];

        if (!is_array($payload)) {
            $errors["general"] = 'Invalid JSON payload.';
        }
        

        // 2) Apply rules: currently supports: "required"
        foreach ($rules as $field => $ruleString) {
            $ruleString = (string)$ruleString;

            // Split like "required|string|min:3|max:50"
            $ruleParts = array_filter(array_map('trim', explode('|', $ruleString)));

            $exists = array_key_exists($field, $payload);
            $value  = $exists ? $payload[$field] : null;

            // nullable
            if (in_array('nullable', $ruleParts, true) && (!$exists || $value === null)) {
                continue; // Skip other validations if nullable and not present
            }

            // required
            if (in_array('required', $ruleParts, true)) {
                if (!$exists) {
                    $errors[$field][] = 'This field is required.';
                    continue;
                }

                // Treat empty string / whitespace as missing for required fields
                if (is_string($value) && trim($value) === '') {
                    $errors[$field][] = 'This field is required.';
                    continue;
                }

                // If someone sends null
                if ($value === null) {
                    $errors[$field][] = 'This field is required.';
                    continue;
                }
            }

            // array
            if (in_array('array', $ruleParts, true) && $exists && !is_array($value)) {
                $errors[$field][] = 'This field must be an array.';
                continue;
            }

            // alpha_num
            if (in_array('alpha_num', $ruleParts, true) && $exists && !preg_match('/^[a-zA-Z0-9]+$/', $value)) {
                $errors[$field][] = 'This field must be alphanumeric.';
                continue;
            }

            // integer
            if (in_array('integer', $ruleParts, true) && $exists && !is_int($value)) {
                $errors[$field][] = 'This field must be an integer.';
                continue;
            }

            // numeric
            if (in_array('numeric', $ruleParts, true) && $exists && !is_numeric($value)) {
                $errors[$field][] = 'This field must be numeric.';
                continue;
            }



            // string
            if (in_array('string', $ruleParts, true) && $exists && !is_string($value)) {
                $errors[$field][] = 'This field must be a string.';
                continue;
            }

            // min:N
            foreach ($ruleParts as $part) {
                if (strpos($part, 'min:') === 0) {
                    $min = (int)substr($part, 4);
                    if ($exists && is_string($value) && strlen($value) < $min) {
                        $errors[$field][] = "This field must be at least $min characters.";
                        continue;
                    }
                }
            }

            // max:N
            foreach ($ruleParts as $part) {
                if (strpos($part, 'max:') === 0) {
                    $max = (int)substr($part, 4);
                    if ($exists && is_string($value) && strlen($value) > $max) {
                        $errors[$field][] = "This field must not exceed $max characters.";
                        continue;
                    }
                }
            }
        }

        return $errors;
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
