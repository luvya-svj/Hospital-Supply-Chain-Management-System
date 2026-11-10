// Authentication Page Controller

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('btn-login-submit');
  const errorBox = document.getElementById('login-error');

  // Check if user is already authenticated
  try {
    const authStatus = await API.get('/api/auth/me');
    if (authStatus && authStatus.authenticated) {
      window.location.href = '/index.html';
      return;
    }
  } catch (err) {
    // Not logged in, stay on login page
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    errorBox.innerText = '';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Please enter both email and password.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = 'Signing in...';

    try {
      const result = await API.post('/api/auth/login', { email, password });
      if (result && result.user) {
        window.location.href = '/index.html';
      }
    } catch (err) {
      showError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Sign In';
    }
  };

  function showError(msg) {
    errorBox.innerText = msg;
    errorBox.style.display = 'block';
  }
});
