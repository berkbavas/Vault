<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Vault Drive</title>
    <link rel="stylesheet" href="./assets/css/style.css?v=<?php echo filemtime('./assets/css/style.css'); ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
</head>

<body class="auth-page">
    <header class="auth-header">
        <div class="auth-brand">
            <div class="brand-logo">
                <i class="fa-solid fa-lock"></i>
            </div>
            <span class="brand-name">Vault Drive</span>
        </div>
    </header>

    <div class="auth-card">
        <h2>Sign in</h2>
        <p class="sub">Welcome back. Enter your credentials to continue.</p>

        <div id="alert-container"></div>

        <form id="login-form">
            <div class="form-stack">
                <div class="input-group">
                    <i class="fa-solid fa-user"></i>
                    <input type="text" id="username" name="username" placeholder="Username" required>
                </div>
                <div class="input-group">
                    <i class="fa-solid fa-lock"></i>
                    <input type="password" id="password" name="password" placeholder="Password" required>
                </div>
            </div>
            <button type="submit" class="btn-primary" style="width:100%" id="login-btn">Login</button>
        </form>

        <div class="auth-footer">
            Don't have an account? <a href="register.php">Sign up</a>
        </div>
    </div>

    <div class="auth-copyright">
        <p>&copy; 2026 Vault Drive. All rights reserved.</p>
    </div>

    <script src="./assets/js/crypto-utils.js?v=<?php echo filemtime('./assets/js/crypto-utils.js'); ?>" defer></script>
    <script src="./assets/js/api.js?v=<?php echo filemtime('./assets/js/api.js'); ?>" defer></script>
    <script src="./assets/js/login.js?v=<?php echo filemtime('./assets/js/login.js'); ?>" defer></script>
</body>

</html>