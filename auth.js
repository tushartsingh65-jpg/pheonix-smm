const API_BASE = 'http://localhost:3000/api';

let currentUser = null;
let authToken = null;

function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('pheonix_token', token);
  } else {
    localStorage.removeItem('pheonix_token');
  }
}

function getAuthToken() {
  return authToken || localStorage.getItem('pheonix_token');
}

async function register(name, email, password) {
  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Registration failed');
    }

    currentUser = data.user;
    setAuthToken(data.token);
    return { success: true, user: data.user, token: data.token };
  } catch (error) {
    console.error('Register error:', error);
    return { success: false, message: error.message };
  }
}

async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Login failed');
    }

    currentUser = data.user;
    setAuthToken(data.token);
    return { success: true, user: data.user, token: data.token };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: error.message };
  }
}

async function getCurrentUser() {
  try {
    const token = getAuthToken();
    if (!token) return null;

    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (data.success) {
      currentUser = data.user;
      return data.user;
    }

    setAuthToken(null);
    return null;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

function logout() {
  currentUser = null;
  setAuthToken(null);
  localStorage.removeItem('pheonix_wallet');
  localStorage.removeItem('pheonix_orders');
}

function isAuthenticated() {
  return !!getAuthToken() && !!currentUser;
}

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

function getUser() {
  return currentUser;
}

function getWallet() {
  return currentUser ? currentUser.wallet : 0;
}
