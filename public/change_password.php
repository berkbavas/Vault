<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Change Password - Vault Drive</title>
    <link rel="stylesheet" href="./assets/css/style.css?v=<?php echo filemtime('./assets/css/style.css'); ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>

<body>
    <div class="auth-page">
        <div class="auth-container">
            <div class="auth-header">
                <i class="fa-solid fa-shield-halved"></i>
                <h1>Change Password</h1>
                <p>Update your password to keep your account secure</p>
            </div>

            <form id="changePasswordForm" class="auth-form">
                <!-- Current Password -->
                <div class="form-group">
                    <label for="currentPassword">Current Password</label>
                    <div class="input-group">
                        <span class="input-icon">
                            <i class="fa-solid fa-lock"></i>
                        </span>
                        <input type="password" id="currentPassword" class="form-control" placeholder="Enter current password" required>
                        <button type="button" class="toggle-password" onclick="togglePassword('currentPassword')">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </div>

                <!-- New Password -->
                <div class="form-group">
                    <label for="newPassword">New Password</label>
                    <div class="input-group">
                        <span class="input-icon">
                            <i class="fa-solid fa-key"></i>
                        </span>
                        <input type="password" id="newPassword" class="form-control" placeholder="Enter new password" required>
                        <button type="button" class="toggle-password" onclick="togglePassword('newPassword')">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                    <div class="password-meter" id="passwordMeter">
                        <div class="password-meter-bar" id="passwordMeterBar"></div>
                    </div>
                    <small class="password-hint" id="passwordStrength"></small>
                </div>

                <!-- Confirm New Password -->
                <div class="form-group">
                    <label for="confirmPassword">Confirm New Password</label>
                    <div class="input-group">
                        <span class="input-icon">
                            <i class="fa-solid fa-key"></i>
                        </span>
                        <input type="password" id="confirmPassword" class="form-control" placeholder="Confirm new password" required>
                        <button type="button" class="toggle-password" onclick="togglePassword('confirmPassword')">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </div>

                <div class="alert" id="alert" style="display: none;"></div>

                <button type="submit" class="btn btn-primary btn-block" id="submitBtn">
                    <i class="fa-solid fa-key"></i>
                    Change Password
                </button>

                <div class="auth-footer">
                    <a href="dashboard.php" class="link">
                        <i class="fa-solid fa-arrow-left"></i>
                        Back to Dashboard
                    </a>
                </div>
            </form>
        </div>
    </div>

    <script src="./assets/js/api.js?v=<?php echo filemtime('./assets/js/api.js'); ?>"></script>
    <script src="./assets/js/crypto-utils.js?v=<?php echo filemtime('./assets/js/crypto-utils.js'); ?>"></script>
    <script src="./assets/js/change-password.js?v=<?php echo filemtime('./assets/js/change-password.js'); ?>"></script>
</body>

</html>