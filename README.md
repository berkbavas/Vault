# Vault Drive

A zero-knowledge, client-side encrypted file storage system built with PHP and JavaScript.
Vault Drive ensures that your files are encrypted on the client-side before uploading,
meaning the server never has access to your unencrypted data or encryption keys.

##  Features

### Security

- **Zero-Knowledge Architecture**: All encryption happens client-side
- **AES-256-GCM Encryption**: Military-grade encryption for files and filenames
- **Client-Side Key Derivation**: Uses PBKDF2 with 300,000 iterations
- **Secure Password Hashing**: Multiple layers of hashing with unique salts
- **Encrypted Master Keys**: User's master encryption key is encrypted with their password

### File Management

- **Upload Files**: Secure chunked upload with progress tracking
- **Download Files**: Encrypted files are decrypted on-the-fly in the browser
- **Create Folders**: Organize your files with folder hierarchy
- **Rename Files/Folders**: Full rename support with encrypted names
- **Move Files/Folders**: Drag-and-drop file organization
- **Delete Files/Folders**: Secure deletion with multi-select support
- **Folder Navigation**: Browse through your folder structure

## Architecture

### Backend (PHP)

```
src/
├── Controllers/        # Request handlers
│   ├── AuthController.php
│   └── StorageController.php
├── Services/          # Business logic
│   ├── UserService.php
│   └── StorageService.php
├── Core/              # Core application classes
│   └── Bootstrap.php
└── Http/              # HTTP utilities
    ├── JsonResponse.php
    └── Request.php
```

### Frontend (JavaScript)

```
public/assets/js/
├── api.js            # API client
├── app.js            # Main application logic
└── crypto-utils.js   # Client-side encryption
```

### API Endpoints

```
/api/v1/user/
  - POST   /register          # Create new account
  - POST   /login             # Authenticate user
  - GET    /me                # Get user info
  - POST   /change_password   # Change password
  - GET    /get_client_salt   # Get salt for login

/api/v1/file/
  - GET    /list              # List files/folders
  - POST   /create_folder     # Create new folder
  - POST   /upload            # Upload file (simple)
  - POST   /upload_chunk      # Upload file chunk
  - POST   /finalize_upload   # Finalize chunked upload
  - GET    /download          # Download file
  - POST   /rename            # Rename file/folder
  - POST   /move              # Move file/folder
  - DELETE /delete            # Delete single item
  - POST   /delete_multiple   # Delete multiple items
```

## Installation

### Prerequisites

- PHP 8.0 or higher
- MySQL 5.7 or higher
- Apache/Nginx web server
- Modern web browser with Web Crypto API support

### Setup Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd vault-drive
   ```

2. **Configure the database**

   ```bash
   # Import the database schema
   mysql -u root -p < database_setup.sql
   ```

3. **Configure the application**

   Edit `config/app.php` with your settings:

   ```php
   'database' => [
       'host' => 'localhost',
       'database' => 'vault_drive',
       'username' => 'your_username',
       'password' => 'your_password',
   ],
   
   'app' => [
       'url' => 'http://localhost/vault-drive',
       'environment' => 'production',
       'debug' => false,
   ]
   ```

4. **Set up storage directory**

   ```bash
   # Create storage directory with proper permissions
   mkdir -p storage/uploads/temp
   chmod -R 755 storage
   ```

5. **Configure web server**

   **For Apache** (using XAMPP):
   - Place the project in `htdocs/vault-drive`
   - Access via `http://localhost/vault-drive`

   **For Nginx**:

   ```nginx
   server {
       listen 80;
       server_name vault-drive.local;
       root /path/to/vault-drive/public;
       index index.php;
       
       location / {
           try_files $uri $uri/ /index.php?$query_string;
       }
       
       location ~ \.php$ {
           fastcgi_pass unix:/var/run/php/php7.4-fpm.sock;
           fastcgi_index index.php;
           include fastcgi_params;
           fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
       }
   }
   ```

6. **Access the application**

   Open your browser and navigate to:

   ```
   http://localhost/vault-drive
   ```

## Security Model

### Encryption Flow

#### Registration

1. User enters username and password
2. Client generates:
   - Client Salt (random 32 bytes)
   - KDF Salt (random 32 bytes)
   - Master Key (random 32 bytes)
3. Password is hashed with Client Salt using PBKDF2 (100,000 iterations)
4. Hashed password is hashed again with Server Salt for storage
5. Key Encryption Key (KEK) is derived from password using KDF Salt (300,000 iterations)
6. Master Key is encrypted with KEK using AES-256-GCM
7. Encrypted Master Key and all salts are stored on server

#### Login

1. Client requests Client Salt from server
2. Password is hashed with Client Salt
3. Hashed password is sent to server
4. Server hashes again with Server Salt and verifies
5. Client derives KEK from password and KDF Salt
6. Client decrypts Master Key with KEK
7. Master Key is stored in memory for session

#### File Encryption

1. File is read in the browser
2. Random IV (12 bytes) is generated
3. File is encrypted with Master Key using AES-256-GCM
4. Encrypted file = IV + Ciphertext + Auth Tag
5. Filename is also encrypted with Master Key
6. Encrypted file is uploaded to server

#### File Decryption

1. Encrypted file is downloaded from server
2. IV, ciphertext, and auth tag are extracted
3. File is decrypted with Master Key using AES-256-GCM
4. Decrypted file is provided to user via download
5. Filename is decrypted for display

## Database Schema

### Users Table

```sql
- id                    : Primary key
- username              : Unique username
- password_hash         : Double-hashed password (hex)
- server_salt           : Salt for server-side hashing (hex)
- client_salt           : Salt for client-side hashing (hex)
- kdf_salt              : Salt for key derivation (hex)
- encrypted_master_key  : Encrypted master key (hex)
- user_folder           : Physical folder name on server
- storage_used          : Bytes used
- storage_quota         : Bytes allowed
- created_at            : Account creation timestamp
- updated_at            : Last update timestamp
- last_login_at         : Last login timestamp
```

### Files Table

```sql
- id                : Primary key
- user_id           : Foreign key to users
- parent_id         : Foreign key to parent folder (null for root)
- encrypted_name    : Encrypted filename (hex)
- type              : 'file' or 'folder'
- path              : Physical path on server
- size              : Encrypted file size (bytes)
- original_size     : Original file size before encryption (bytes)
- mime_type         : MIME type
- created_at        : Creation timestamp
- updated_at        : Last update timestamp
```

## Technology Stack

### Backend

- **PHP 8.0+**: Server-side scripting
- **MySQL**: Database storage
- **Apache/Nginx**: Web server

### Frontend

- **JavaScript**: No frameworks, pure JS
- **Web Crypto API**: Browser-native encryption
- **HTML5**: Modern markup
- **CSS3**: Responsive styling

### Security Libraries

- **PBKDF2**: Password-based key derivation
- **AES-256-GCM**: Authenticated encryption
- **SHA-256**: Cryptographic hashing

## ⚠️ Important Security Notes

1. **Password Recovery**: Since this is a zero-knowledge system, **passwords cannot be recovered**. If you lose your password, your files are permanently inaccessible.

2. **Browser Storage**: The decrypted master key is stored in browser memory during your session. Always log out when done.

3. **HTTPS Required**: In production, **always use HTTPS** to prevent man-in-the-middle attacks.

4. **Secure Passwords**: Use strong, unique passwords with at least 12 characters.

5. **Session Security**: The authentication token is stored in sessionStorage.
Clear browser data if using a shared computer.

6. **Server Trust**: While the server can't read your files, it can:
   - Delete your encrypted files
   - See file sizes and upload times
   - See folder structure (encrypted names)
   - Track storage usage

## Development

### Project Structure

```
vault-drive/
├── config/            # Configuration files
├── public/            # Public web root
│   ├── assets/        # CSS, JS, images
│   ├── api/           # API endpoints
│   └── index.php      # Main entry point
├── src/               # Application source code
├── storage/           # File storage
│   └── uploads/       # User uploads
├── autoload.php       # PSR-4 autoloader
├── database_setup.sql # Database schema
└── README.md          # This file
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
