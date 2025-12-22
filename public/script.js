// ============ API CONFIGURATION ============
// Base URL for API calls
const API_BASE = ''; // Same origin since Cloudflare Worker handles routing
let currentUser = null;
let editingCatId = null;
let isAuthenticated = false;
let authToken = null;

// ============ DOM ELEMENTS ============
const gallery = document.getElementById("catGallery");
const modal = document.getElementById("catModal");
let editingId = null;
let catsData = [];
let currentPage = 1;
const itemsPerPage = 8;
let currentTagFilter = '';

// DOM elements
const nameInput = document.getElementById("name");
const tagInput = document.getElementById("tag");
const descriptionInput = document.getElementById("description");
const imgInput = document.getElementById("img");
const searchInput = document.getElementById("searchInput");
const tagFilter = document.getElementById("tag-filter");

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', function () {
    console.log("📄 DOM loaded, initializing Cat Gallery...");

    // Check if user is logged in
    checkAuthStatus();

    // Load cats
    loadCats();
    fetchTags();
    setupEventListeners();

    // Setup auth event listeners
    setupAuthEventListeners();
});

// ============ AUTHENTICATION FUNCTIONS ============

function checkAuthStatus() {
    const savedUser = localStorage.getItem('currentUser');
    const savedToken = localStorage.getItem('authToken');

    if (savedUser && savedToken) {
        currentUser = JSON.parse(savedUser);
        authToken = savedToken;
        isAuthenticated = true;
        updateAuthUI();
    }
}

function updateAuthUI() {
    const authContainer = document.querySelector('.cyber-auth');
    const dashboardLink = document.getElementById('dashboard-link');

    if (!authContainer) return;

    if (isAuthenticated && currentUser) {
        // Show user info
        authContainer.innerHTML = `
            <div class="user-info">
                <div class="user-avatar" onclick="showDashboard()" title="Dashboard">
                    ${currentUser.avatar || '😺'}
                </div>
                <div class="user-details">
                    <span class="user-name">${currentUser.username}</span>
                    <span class="user-role">${currentUser.role.toUpperCase()}</span>
                </div>
                <button class="cyber-btn logout-btn" onclick="handleLogout()">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        `;

        // Show dashboard link
        if (dashboardLink) {
            dashboardLink.style.display = 'block';
            dashboardLink.onclick = (e) => {
                e.preventDefault();
                showDashboard();
            };
        }

    } else {
        // Show login/signup buttons
        authContainer.innerHTML = `
            <a href="#login" class="cyber-btn login-btn" onclick="showLoginModal()">
                <i class="fas fa-sign-in-alt"></i> LOGIN
            </a>
            <a href="#signup" class="cyber-btn signup-btn" onclick="showSignupModal()">
                <i class="fas fa-user-plus"></i> SIGN UP
            </a>
        `;

        // Hide dashboard link
        if (dashboardLink) dashboardLink.style.display = 'none';
    }
}

// ============ MODAL FUNCTIONS ============
function showLoginModal() {
    closeAllModals();
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('login-email')?.focus();
}

function showSignupModal() {
    closeAllModals();
    document.getElementById('signup-modal').style.display = 'flex';
    document.getElementById('signup-username')?.focus();
}

function closeAllModals() {
    const modals = document.querySelectorAll('.cyber-modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// ============ API CALLS ============

async function handleSignup(e) {
    e.preventDefault();
    console.log("📝 Handling signup...");

    const username = document.getElementById('signup-username')?.value;
    const email = document.getElementById('signup-email')?.value;
    const password = document.getElementById('signup-password')?.value;
    const confirmPassword = document.getElementById('signup-confirm')?.value;

    // Validation
    if (!username || !email || !password || !confirmPassword) {
        showNotification('All fields are required', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
    submitBtn.disabled = true;

    try {
        console.log("📤 Sending signup request...");

        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username.trim(),
                email: email.trim(),
                password: password
            })
        });

        const data = await response.json();
        console.log("📥 Signup response:", data);

        if (response.ok) {
            // Save user to localStorage
            currentUser = data.user;
            authToken = data.token;
            isAuthenticated = true;

            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('authToken', authToken);

            showNotification('✅ Account created successfully!', 'success');
            closeAllModals();

            // Update UI
            updateAuthUI();

            // Show dashboard
            showDashboard();

        } else {
            showNotification(data.error || 'Signup failed', 'error');
        }
    } catch (error) {
        console.error('❌ Signup error:', error);
        showNotification('Error during signup. Please try again.', 'error');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email')?.value;
    const password = document.getElementById('login-password')?.value;

    if (!email || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email.trim(),
                password: password
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Save user to localStorage
            currentUser = data.user;
            authToken = data.token;
            isAuthenticated = true;

            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('authToken', authToken);

            showNotification('✅ Login successful!', 'success');
            closeAllModals();

            // Update UI
            updateAuthUI();

            // Show dashboard
            showDashboard();

        } else {
            showNotification(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        showNotification('Error during login. Please try again.', 'error');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function handleLogout() {
    currentUser = null;
    authToken = null;
    isAuthenticated = false;

    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');

    updateAuthUI();
    showHome();
    showNotification('✅ Logged out successfully', 'success');
}

// ============ DASHBOARD FUNCTIONS ============

async function showDashboard() {
    if (!isAuthenticated) {
        showLoginModal();
        return;
    }

    try {
        const response = await fetch('/users/me', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayUserDashboard(data);
        } else {
            showNotification('Failed to load dashboard', 'error');
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        showNotification('Error loading dashboard', 'error');
    }
}

function displayUserDashboard(data) {
    const dashboardSection = document.getElementById('dashboard');
    const dashboardContent = document.getElementById('dashboard-content');

    if (!dashboardSection || !dashboardContent) return;

    // Hide all sections
    document.querySelectorAll('.cyber-section').forEach(section => {
        section.classList.remove('active');
    });

    // Update dashboard content based on user role
    if (currentUser.role === 'admin') {
        dashboardContent.innerHTML = createAdminDashboardHTML(data);
    } else {
        dashboardContent.innerHTML = createUserDashboardHTML(data);
    }

    // Show dashboard section
    dashboardSection.classList.add('active');

    // Update navigation
    updateActiveNav('dashboard');
}

function createUserDashboardHTML(data) {
    return `
        <div class="dashboard-grid">
            <div class="dashboard-card">
                <div class="card-header">
                    <i class="fas fa-user-circle"></i>
                    <h3>MY PROFILE</h3>
                </div>
                <div class="card-content">
                    <div class="profile-info">
                        <div class="info-row">
                            <span class="info-label">USERNAME:</span>
                            <span class="info-value">${data.user.username}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">EMAIL:</span>
                            <span class="info-value">${data.user.email}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">JOINED:</span>
                            <span class="info-value">${new Date(data.user.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="dashboard-card">
                <div class="card-header">
                    <i class="fas fa-cat"></i>
                    <h3>MY STATS</h3>
                </div>
                <div class="card-content">
                    <div class="stats-grid">
                        <div class="stat-item">
                            <i class="fas fa-images"></i>
                            <span class="stat-value">${data.stats.totalCats}</span>
                            <span class="stat-label">CATS POSTED</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-heart"></i>
                            <span class="stat-value">${data.stats.totalLikes}</span>
                            <span class="stat-label">TOTAL LIKES</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createAdminDashboardHTML(data) {
    return `
        <div class="admin-grid">
            <div class="admin-stats-grid">
                <div class="admin-stat-card">
                    <i class="fas fa-users"></i>
                    <div class="stat-info">
                        <h3>${data.stats?.totalUsers || 0}</h3>
                        <p>TOTAL USERS</p>
                    </div>
                </div>
                <div class="admin-stat-card">
                    <i class="fas fa-cat"></i>
                    <div class="stat-info">
                        <h3>${data.stats?.totalCats || 0}</h3>
                        <p>TOTAL CATS</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function updateActiveNav(sectionId) {
    document.querySelectorAll('.cyber-nav-link').forEach(link => {
        link.classList.remove('active');
    });

    const activeLink = document.querySelector(`.cyber-nav-link[href="#${sectionId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

function showHome() {
    document.querySelectorAll('.cyber-section').forEach(section => {
        section.classList.remove('active');
    });

    const homeSection = document.getElementById('home');
    if (homeSection) {
        homeSection.classList.add('active');
        updateActiveNav('home');
    }
}

// ============ SETUP EVENT LISTENERS ============

function setupAuthEventListeners() {
    // Signup form
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Login/Signup buttons
    document.addEventListener('click', function (e) {
        if (e.target.closest('.login-btn')) {
            e.preventDefault();
            showLoginModal();
        }

        if (e.target.closest('.signup-btn')) {
            e.preventDefault();
            showSignupModal();
        }
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
}

// ============ EXISTING CAT GALLERY FUNCTIONS (KEEP THESE) ============

function testAPI() {
    console.log("🔌 Testing API connection...");
    fetch('/cats')
        .then(res => {
            console.log("API Response status:", res.status);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            console.log("✅ API connection successful!");
            console.log("First cat:", data[0]);
        })
        .catch(err => {
            console.error('❌ API connection failed:', err);
            showNotification('⚠️ Cannot connect to API. Make sure the Worker is deployed.', 'error');
        });
}

function loadCats() {
    console.log("🐱 Loading cats from API...");
    showLoading();

    fetch('/cats')
        .then(res => {
            console.log("Load cats response:", res.status, res.statusText);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            catsData = Array.isArray(data) ? data : [];
            console.log(`✅ Loaded ${catsData.length} cats`);
            hideLoading();
            renderGallery(catsData);
        })
        .catch(err => {
            console.error('❌ Error loading cats:', err);
            hideLoading();
            showError('Failed to load cats. Please check if the Worker is running.');
        });
}

function fetchTags() {
    console.log("🔄 Fetching tags from /tags...");

    fetch('/tags')
        .then(res => {
            console.log("Tags response:", res.status);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(tags => {
            console.log("📋 Tags received:", tags);
            populateTagFilter(tags);
        })
        .catch(err => {
            console.error('❌ Error fetching tags:', err);
            showErrorInTagFilter();
        });
}

// ... Keep all your existing cat gallery functions ...
// (addCat, editCat, deleteCat, renderGallery, etc.)

// ============ UTILITY FUNCTIONS ============

function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;

    // Add CSS if not already present
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                z-index: 1000;
                display: flex;
                justify-content: space-between;
                align-items: center;
                min-width: 300px;
                max-width: 500px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                animation: slideIn 0.3s ease;
            }
            .notification-info { background: #3498db; }
            .notification-success { background: #2ecc71; }
            .notification-warning { background: #f39c12; }
            .notification-error { background: #e74c3c; }
            .notification button {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                margin-left: 15px;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// ============ MAKE FUNCTIONS GLOBALLY AVAILABLE ============
window.showLoginModal = showLoginModal;
window.showSignupModal = showSignupModal;
window.closeLoginModal = closeAllModals;
window.closeSignupModal = closeAllModals;
window.handleLogout = handleLogout;
window.showDashboard = showDashboard;
window.showHome = showHome;

// Your existing global functions
window.debugApp = debugApp;
window.clearFilter = clearFilter;
window.editCat = editCat;
window.deleteCat = deleteCat;
window.openAddModal = openAddModal;
window.closeModal = closeModal;
window.addCat = addCat;
window.updateCat = updateCat;
window.filterCatsByTag = filterCatsByTag;

console.log("🐱 Cat Gallery Script Loaded with Authentication");