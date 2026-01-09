document.addEventListener('DOMContentLoaded', () => {
    API.init();

    const form = document.getElementById('signup-form');
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirm_password');
    const signupBtn = document.getElementById('signup-btn');
    const alertContainer = document.getElementById('alert-container');
    const passwordMeterFill = document.getElementById('password-meter-fill');
    const passwordMeterText = document.getElementById('password-meter-text');

    password.addEventListener('input', () => onPasswordInput());
    form.addEventListener('submit', (e) => onFormSubmit(e));

    async function onFormSubmit(e) {
        e.preventDefault();

        if (password.value !== confirmPassword.value) {
            showAlert('Passwords do not match', 'error');
            return;
        }

        signupBtn.disabled = true;
        alertContainer.innerHTML = '';
        const usernameValue = username.value.trim();
        const passwordValue = password.value;

        // Generate salts
        const clientSalt = CryptoUtils.generateSalt();
        const kdfSalt = CryptoUtils.generateSalt();

        // Hash password
        const passwordHash = await CryptoUtils.hashPassword(passwordValue, clientSalt);

        // Generate master key
        const masterKey = await CryptoUtils.generateMasterKey();

        // Derive KEK from password and encrypt master key
        const kek = await CryptoUtils.deriveKey(passwordValue, kdfSalt);
        const encryptedMasterKey = await CryptoUtils.encryptMasterKey(masterKey, kek);

        // Register
        const response = await API.auth.register(
            usernameValue,
            CryptoUtils.arrayBufferToHex(clientSalt),
            CryptoUtils.arrayBufferToHex(kdfSalt),
            passwordHash,
            encryptedMasterKey
        );

        if (!response.success) {
            showAlert('Registration failed: ' + response.message, 'error');
            signupBtn.disabled = false;
            signupBtn.textContent = 'Create account';
            return;
        }

        showAlert('Registration successful! Redirecting to login...', 'success');
        setTimeout(() => {
            window.location.href = 'login.php';
        }, 2000);
    }

    function onPasswordInput() {
        const strength = calculatePasswordStrength(password.value);
        updatePasswordMeter(strength);
    }

    function calculatePasswordStrength(pwd) {
        if (!pwd) {
            return { score: 0, label: ' ', width: 0 };
        }

        let score = 0;

        // Length criteria
        if (pwd.length >= 8) score += 20;
        if (pwd.length >= 12) score += 20;
        if (pwd.length >= 16) score += 10;

        // Character variety
        if (/[a-z]/.test(pwd)) score += 10;  // lowercase
        if (/[A-Z]/.test(pwd)) score += 15;  // uppercase
        if (/[0-9]/.test(pwd)) score += 15;  // numbers
        if (/[^a-zA-Z0-9]/.test(pwd)) score += 20;  // special chars

        // Determine label and color
        let label, className;
        if (score < 30) {
            label = 'Weak';
            className = 'weak';
        } else if (score < 60) {
            label = 'Fair';
            className = 'fair';
        } else if (score < 80) {
            label = 'Good';
            className = 'good';
        } else {
            label = 'Strong';
            className = 'strong';
        }

        return { score: Math.min(score, 100), label, className, width: Math.min(score, 100) };
    }

    function updatePasswordMeter(strength) {
        if (strength.score === 0) {
            passwordMeterFill.style.width = '0%';
            passwordMeterText.textContent = ' ';
            passwordMeterFill.className = 'password-meter-fill';
        } else {
            passwordMeterFill.style.width = strength.width + '%';
            passwordMeterText.textContent = strength.label;
            passwordMeterFill.className = 'password-meter-fill ' + strength.className;
        }
    }

    function showAlert(message, type) {
        const alert = document.createElement('div');
        alert.className = `alert ${type}`;
        alert.textContent = message;
        alertContainer.appendChild(alert);
    }
});