<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logout - Vault Drive</title>
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
    <script>
        // Clear all session data
        sessionStorage.clear();
        localStorage.clear();
        
        // Redirect to login page
        window.location.href = 'login.php';
    </script>
</body>
</html>
