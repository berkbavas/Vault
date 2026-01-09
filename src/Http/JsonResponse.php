<?php

namespace App\Http;

class JsonResponse
{
    private $data;
    private $statusCode;
    private $headers = [];
    private $options = 0;

    public function __construct($data = null, $statusCode = 200, array $headers = [])
    {
        $this->data = $data;
        $this->statusCode = $statusCode;
        $this->headers = $headers;
    }

    /**
     * Create a success response
     */
    public static function success($data = null, $message = 'Success', $statusCode = 200)
    {
        return new static([
            'success' => true,
            'message' => $message,
            'data' => $data
        ], $statusCode);
    }

    /**
     * Create an error response
     */
    public static function error($message = 'Error', $statusCode = 400, $errors = null)
    {
        $response = [
            'success' => false,
            'message' => $message,
            'data' => null
        ];

        if ($errors !== null) {
            $response['errors'] = $errors;
        }

        return new static($response, $statusCode);
    }

    /**
     * Create a created response (201)
     */
    public static function created($data = null, $message = 'Resource created successfully')
    {
        return static::success($data, $message, 201);
    }

    /**
     * Create a no content response (204)
     */
    public static function noContent()
    {
        return new static(null, 204);
    }

    /**
     * Create a not found response (404)
     */
    public static function notFound($message = 'Resource not found')
    {
        return static::error($message, 404);
    }

    /**
     * Create an unauthorized response (401)
     */
    public static function unauthorized($message = 'Unauthorized')
    {
        return static::error($message, 401);
    }

    /**
     * Create a forbidden response (403)
     */
    public static function forbidden($message = 'Forbidden')
    {
        return static::error($message, 403);
    }

    /**
     * Create a validation error response (422)
     */
    public static function validationError($errors, $message = 'Validation failed')
    {
        return static::error($message, 422, $errors);
    }

    /**
     * Create an internal server error response (500)
     */
    public static function serverError($message = 'Internal server error')
    {
        return static::error($message, 500);
    }

    /**
     * Set the response data
     */
    public function setData($data)
    {
        $this->data = $data;
        return $this;
    }

    /**
     * Get the response data
     */
    public function getData()
    {
        return $this->data;
    }

    /**
     * Set the status code
     */
    public function setStatusCode($statusCode)
    {
        $this->statusCode = $statusCode;
        return $this;
    }

    /**
     * Get the status code
     */
    public function getStatusCode()
    {
        return $this->statusCode;
    }

    /**
     * Set a header
     */
    public function header($name, $value)
    {
        $this->headers[$name] = $value;
        return $this;
    }

    /**
     * Set multiple headers
     */
    public function withHeaders(array $headers)
    {
        $this->headers = array_merge($this->headers, $headers);
        return $this;
    }

    /**
     * Get all headers
     */
    public function getHeaders()
    {
        return $this->headers;
    }

    /**
     * Enable CORS
     */
    public function withCors($origin = '*', $methods = 'GET, POST, PUT, DELETE, OPTIONS', $headers = '*')
    {
        $this->headers['Access-Control-Allow-Origin'] = $origin;
        $this->headers['Access-Control-Allow-Methods'] = $methods;
        $this->headers['Access-Control-Allow-Headers'] = $headers;
        $this->headers['Access-Control-Allow-Credentials'] = 'true';
        return $this;
    }

    /**
     * Set JSON encoding options
     */
    public function setOptions($options)
    {
        $this->options = $options;
        return $this;
    }

    /**
     * Enable pretty print
     */
    public function prettyPrint()
    {
        $this->options |= JSON_PRETTY_PRINT;
        return $this;
    }

    /**
     * Set the response as unescaped unicode
     */
    public function unescapedUnicode()
    {
        $this->options |= JSON_UNESCAPED_UNICODE;
        return $this;
    }

    /**
     * Set the response as unescaped slashes
     */
    public function unescapedSlashes()
    {
        $this->options |= JSON_UNESCAPED_SLASHES;
        return $this;
    }

    /**
     * Send the response
     */
    public function send()
    {
        // Set status code
        http_response_code($this->statusCode);

        // Set content type
        if (!isset($this->headers['Content-Type'])) {
            $this->headers['Content-Type'] = 'application/json; charset=utf-8';
        }

        // Send headers
        foreach ($this->headers as $name => $value) {
            header("$name: $value");
        }

        // Send body
        if ($this->statusCode !== 204) {
            echo $this->toJson();
        }

        return $this;
    }

    /**
     * Convert data to JSON
     */
    public function toJson()
    {
        $json = json_encode($this->data, $this->options);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \RuntimeException('JSON encoding error: ' . json_last_error_msg());
        }

        return $json;
    }

    /**
     * Convert to array
     */
    public function toArray()
    {
        return is_array($this->data) ? $this->data : [$this->data];
    }

    /**
     * Magic method to convert to string
     */
    public function __toString()
    {
        return $this->toJson();
    }

    /**
     * Create a paginated response
     */
    public static function paginated($items, $total, $page = 1, $perPage = 15)
    {
        $totalPages = ceil($total / $perPage);

        return static::success([
            'items' => $items,
            'pagination' => [
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $page,
                'total_pages' => $totalPages,
                'from' => (($page - 1) * $perPage) + 1,
                'to' => min($page * $perPage, $total)
            ]
        ]);
    }

    /**
     * Add a meta field to the response
     */
    public function withMeta($key, $value)
    {
        if (!is_array($this->data)) {
            $this->data = ['data' => $this->data];
        }

        if (!isset($this->data['meta'])) {
            $this->data['meta'] = [];
        }

        $this->data['meta'][$key] = $value;

        return $this;
    }

    /**
     * Set a custom message
     */
    public function withMessage($message)
    {
        if (!is_array($this->data)) {
            $this->data = ['data' => $this->data];
        }

        $this->data['message'] = $message;

        return $this;
    }

    /**
     * Add timestamp to response
     */
    public function withTimestamp()
    {
        return $this->withMeta('timestamp', time());
    }

    /**
     * Create response with custom structure
     */
    public static function custom($data, $statusCode = 200)
    {
        return new static($data, $statusCode);
    }

    /**
     * Create an accepted response (202)
     */
    public static function accepted($data = null, $message = 'Request accepted for processing')
    {
        return static::success($data, $message, 202);
    }

    /**
     * Create a bad request response (400)
     */
    public static function badRequest($message = 'Bad request')
    {
        return static::error($message, 400);
    }

    /**
     * Create a conflict response (409)
     */
    public static function conflict($message = 'Conflict')
    {
        return static::error($message, 409);
    }

    /**
     * Create a too many requests response (429)
     */
    public static function tooManyRequests($message = 'Too many requests')
    {
        return static::error($message, 429);
    }
}
