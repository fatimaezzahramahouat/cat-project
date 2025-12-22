// ============ AUTHENTICATION FUNCTIONS ============

let currentUser = null;

// Check login status on page load
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/me', {
            credentials: 'include' // Important: sends cookies
        });

        if (response.ok) {
            const userData = await response.json();
            currentUser = userData;
            updateUIForLoggedInUser(userData);
            return true;
        } else {
            currentUser = null;
            updateUIForLoggedOutUser();
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        currentUser = null;
        updateUIForLoggedOutUser();
        return false;
    }
}

// Update UI based on auth status
function updateUIForLoggedInUser(user) {
    // Update navigation
    const navLinks = document.querySelector('.cyber-nav-links');
    if (!navLinks) return;

    // Check if dashboard link already exists
    let dashboardLink = navLinks.querySelector('[href="#dashboard"]');

    if (!dashboardLink) {
        dashboardLink = document.createElement('li');
        dashboardLink.innerHTML = `
            <a href="#dashboard" class="cyber-nav-link">
                <i class="fas fa-user-circle"></i> DASHBOARD
            </a>
        `;
        navLinks.appendChild(dashboardLink);

        // Add dashboard section if it doesn't exist
        const mainContainer = document.querySelector('.cyber-main-container');
        if (mainContainer && !document.getElementById('dashboard')) {
            const dashboardSection = document.createElement('section');
            dashboardSection.id = 'dashboard';
            dashboardSection.className = 'cyber-section';
            dashboardSection.innerHTML = getDashboardHTML(user);
            mainContainer.appendChild(dashboardSection);
        }
    }

    // Add logout button
    let logoutButton = navLinks.querySelector('#logout-btn');
    if (!logoutButton) {
        logoutButton = document.createElement('li');
        logoutButton.id = 'logout-btn';
        logoutButton.innerHTML = `
            <a href="#" class="cyber-nav-link" onclick="logout()">
                <i class="fas fa-sign-out-alt"></i> LOGOUT
            </a>
        `;
        navLinks.appendChild(logoutButton);
    }

    // Remove login/register links if they exist
    const loginLink = navLinks.querySelector('[href="#login"]');
    const registerLink = navLinks.querySelector('[href="#register"]');
    if (loginLink) loginLink.remove();
    if (registerLink) registerLink.remove();
}

function updateUIForLoggedOutUser() {
    const navLinks = document.querySelector('.cyber-nav-links');
    if (!navLinks) return;

    // Remove dashboard link if it exists
    const dashboardLink = navLinks.querySelector('[href="#dashboard"]');
    const logoutButton = navLinks.querySelector('#logout-btn');
    if (dashboardLink) dashboardLink.remove();
    if (logoutButton) logoutButton.remove();

    // Add login/register links if they don't exist
    if (!navLinks.querySelector('[href="#login"]')) {
        const loginLink = document.createElement('li');
        loginLink.innerHTML = `
            <a href="#login" class="cyber-nav-link">
                <i class="fas fa-sign-in-alt"></i> LOGIN
            </a>
        `;
        navLinks.appendChild(loginLink);
    }

    if (!navLinks.querySelector('[href="#register"]')) {
        const registerLink = document.createElement('li');
        registerLink.innerHTML = `
            <a href="#register" class="cyber-nav-link">
                <i class="fas fa-user-plus"></i> REGISTER
            </a>
        `;
        navLinks.insertBefore(registerLink, navLinks.querySelector('[href="#contact"]'));
    }

    // Hide dashboard section if it exists
    const dashboardSection = document.getElementById('dashboard');
    if (dashboardSection) dashboardSection.style.display = 'none';
}

// Login function
async function login(email, password) {
    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('✅ Login successful!', 'success');
            await checkAuthStatus();
            navigateToDashboard();
            return true;
        } else {
            showNotification(`❌ ${data.error || 'Login failed'}`, 'error');
            return false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('❌ Network error. Please try again.', 'error');
        return false;
    }
}

// Register function
async function register(username, email, password) {
    try {
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('✅ Registration successful! Please login.', 'success');
            navigateToLogin();
            return true;
        } else {
            showNotification(`❌ ${data.error || 'Registration failed'}`, 'error');
            return false;
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('❌ Network error. Please try again.', 'error');
        return false;
    }
}

// Logout function
async function logout() {
    try {
        const response = await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            currentUser = null;
            updateUIForLoggedOutUser();
            showNotification('✅ Logged out successfully', 'success');
            navigateToHome();
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Navigation functions
function navigateToDashboard() {
    const dashboardLink = document.querySelector('[href="#dashboard"]');
    if (dashboardLink) dashboardLink.click();
}

function navigateToLogin() {
    const loginLink = document.querySelector('[href="#login"]');
    if (loginLink) loginLink.click();
}

function navigateToHome() {
    const homeLink = document.querySelector('[href="#home"]');
    if (homeLink) homeLink.click();
}

// ============ DASHBOARD HTML TEMPLATE ============

function getDashboardHTML(user) {
    return `
        <div class="terminal-header">
            <h1><i class="fas fa-user-circle"></i> USER DASHBOARD</h1>
            <p>Welcome back, <span class="username-highlight">${user.username}</span>!</p>
            <div class="terminal-status">
                <span class="status-dot online"></span>
                USER: ${user.role.toUpperCase()}
            </div>
        </div>

        <div class="dashboard-grid">
            <!-- User Info Card -->
            <div class="dashboard-card">
                <div class="card-header">
                    <i class="fas fa-user"></i>
                    <h3>PROFILE INFO</h3>
                </div>
                <div class="card-content">
                    <div class="info-item">
                        <span class="info-label">Username:</span>
                        <span class="info-value">${user.username}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Email:</span>
                        <span class="info-value">${user.email}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Role:</span>
                        <span class="info-value">${user.role}</span>
                    </div>
                </div>
            </div>

            <!-- My Cats Card -->
            <div class="dashboard-card">
                <div class="card-header">
                    <i class="fas fa-cat"></i>
                    <h3>MY CATS</h3>
                </div>
                <div class="card-content">
                    <div id="myCatsContainer" class="my-cats-container">
                        <!-- Cats will be loaded here -->
                        <div class="loading">Loading your cats...</div>
                    </div>
                </div>
            </div>

            <!-- Quick Actions Card -->
            <div class="dashboard-card">
                <div class="card-header">
                    <i class="fas fa-bolt"></i>
                    <h3>QUICK ACTIONS</h3>
                </div>
                <div class="card-content">
                    <button onclick="openAddModal()" class="cyber-btn primary full-width">
                        <i class="fas fa-plus"></i> ADD NEW CAT
                    </button>
                    <button onclick="refreshMyCats()" class="cyber-btn secondary full-width">
                        <i class="fas fa-sync"></i> REFRESH MY CATS
                    </button>
                    <button onclick="logout()" class="cyber-btn danger full-width">
                        <i class="fas fa-sign-out-alt"></i> LOGOUT
                    </button>
                </div>
            </div>
        </div>

        <!-- My Cats Table -->
        <div class="dashboard-table">
            <h3><i class="fas fa-list"></i> MY CATS DETAILS</h3>
            <div id="myCatsTable">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Tag</th>
                            <th>Description</th>
                            <th>Image</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="myCatsTableBody">
                        <!-- Dynamic content -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Load user's cats
async function loadMyCats() {
    try {
        const response = await fetch('/api/my-cats', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load your cats');
        }

        const cats = await response.json();
        renderMyCats(cats);
        return cats;
    } catch (error) {
        console.error('Error loading my cats:', error);
        document.getElementById('myCatsContainer').innerHTML =
            '<div class="error">Failed to load your cats</div>';
        return [];
    }
}

function renderMyCats(cats) {
    const container = document.getElementById('myCatsContainer');
    const tableBody = document.getElementById('myCatsTableBody');

    if (!container) return;

    if (!cats || cats.length === 0) {
        container.innerHTML = '<div class="no-data">No cats yet. Add your first cat!</div>';
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">No cats found</td></tr>';
        return;
    }

    // Update summary card
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-box">
                <div class="stat-number">${cats.length}</div>
                <div class="stat-label">Total Cats</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${new Set(cats.map(c => c.tag)).size}</div>
                <div class="stat-label">Unique Tags</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${cats.filter(c => c.IMG).length}</div>
                <div class="stat-label">With Images</div>
            </div>
        </div>
    `;

    // Update table if it exists
    if (tableBody) {
        tableBody.innerHTML = cats.map(cat => `
            <tr>
                <td>${cat.id}</td>
                <td>${escapeHTML(cat.name)}</td>
                <td><span class="tag-badge">${escapeHTML(cat.tag) || 'No tag'}</span></td>
                <td>${escapeHTML(cat.description?.substring(0, 50)) || ''}${cat.description?.length > 50 ? '...' : ''}</td>
                <td>${cat.IMG ? '✅' : '❌'}</td>
                <td>${new Date(cat.created_at).toLocaleDateString()}</td>
                <td>
                    <button onclick="editCat(${cat.id})" class="btn-edit small">Edit</button>
                    <button onclick="deleteCat(${cat.id})" class="btn-delete small">Delete</button>
                </td>
            </tr>
        `).join('');
    }
}

function refreshMyCats() {
    showNotification('Refreshing your cats...', 'info');
    loadMyCats().then(() => {
        showNotification('✅ Your cats refreshed!', 'success');
    });
}

// ============ UPDATE EXISTING FUNCTIONS ============

// Modify your existing editCat function to check ownership
async function editCat(id) {
    // First check if user is logged in
    if (!currentUser) {
        showNotification('⚠️ Please login to edit cats', 'warning');
        navigateToLogin();
        return;
    }

    // Check ownership before allowing edit
    try {
        const response = await fetch(`/cats/${id}`, {
            credentials: 'include'
        });

        if (response.ok) {
            const cat = await response.json();
            // The backend already checks ownership, but we can add extra UI feedback
            openEditModal(id);
        } else {
            showNotification('❌ You can only edit your own cats', 'error');
        }
    } catch (error) {
        console.error('Error checking cat ownership:', error);
    }
}

// Update your existing deleteCat function
async function deleteCat(id) {
    if (!currentUser) {
        showNotification('⚠️ Please login to delete cats', 'warning');
        navigateToLogin();
        return;
    }

    if (!confirm('Are you sure you want to delete this cat?')) return;

    try {
        const response = await fetch(`/cats/${id}`, {
            method: "DELETE",
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('✅ Cat deleted successfully!', 'success');
            loadCats();
            loadMyCats(); // Refresh dashboard
            fetchTags();
        } else {
            showNotification(`❌ ${data.error || 'Failed to delete cat'}`, 'error');
        }
    } catch (err) {
        console.error('❌ Error deleting cat:', err);
        showNotification('❌ Failed to delete cat. Please try again.', 'error');
    }
}

// ============ INITIALIZATION ============

// Update your existing initialization
document.addEventListener('DOMContentLoaded', function () {
    console.log("📄 DOM loaded, initializing Cat Gallery...");

    // Test API connection
    testAPI();

    // Check auth status first
    checkAuthStatus().then(isAuthenticated => {
        console.log("🔐 Auth status:", isAuthenticated ? "Logged in" : "Not logged in");

        // Then load data
        loadCats();
        fetchTags();
    });

    setupEventListeners();

    // Setup navigation for new sections
    setupAuthNavigation();
});

function setupAuthNavigation() {
    // Handle navigation to login/register/dashboard sections
    document.addEventListener('click', function (e) {
        const link = e.target.closest('a[href^="#"]');
        if (!link) return;

        const targetId = link.getAttribute('href').substring(1);

        if (targetId === 'login' || targetId === 'register' || targetId === 'dashboard') {
            e.preventDefault();

            // Show/hide sections
            document.querySelectorAll('.cyber-section').forEach(section => {
                section.classList.remove('active');
            });

            // Create section if it doesn't exist
            let section = document.getElementById(targetId);
            if (!section) {
                section = createAuthSection(targetId);
                document.querySelector('.cyber-main-container').appendChild(section);
            }

            section.classList.add('active');

            // Update active nav link
            document.querySelectorAll('.cyber-nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        }
    });
}

function createAuthSection(type) {
    const section = document.createElement('section');
    section.id = type;
    section.className = 'cyber-section';

    if (type === 'login') {
        section.innerHTML = getLoginHTML();
    } else if (type === 'register') {
        section.innerHTML = getRegisterHTML();
    }

    return section;
}

function getLoginHTML() {
    return `
        <div class="terminal-header">
            <h1><i class="fas fa-sign-in-alt"></i> LOGIN</h1>
            <p>Access your Cat Gallery account</p>
        </div>

        <div class="auth-container">
            <form id="loginForm" class="auth-form">
                <div class="form-group">
                    <label for="login-email"><i class="fas fa-envelope"></i> EMAIL</label>
                    <input type="email" id="login-email" class="cyber-input" placeholder="ENTER YOUR EMAIL" required />
                </div>

                <div class="form-group">
                    <label for="login-password"><i class="fas fa-lock"></i> PASSWORD</label>
                    <input type="password" id="login-password" class="cyber-input" placeholder="ENTER YOUR PASSWORD" required />
                </div>

                <button type="submit" class="cyber-btn primary full-width">
                    <i class="fas fa-sign-in-alt"></i> LOGIN
                </button>

                <div class="auth-links">
                    <p>Don't have an account? <a href="#register" class="cyber-link">Register here</a></p>
                </div>
            </form>
        </div>
    `;
}

function getRegisterHTML() {
    return `
        <div class="terminal-header">
            <h1><i class="fas fa-user-plus"></i> REGISTER</h1>
            <p>Create your Cat Gallery account</p>
        </div>

        <div class="auth-container">
            <form id="registerForm" class="auth-form">
                <div class="form-group">
                    <label for="register-username"><i class="fas fa-user"></i> USERNAME</label>
                    <input type="text" id="register-username" class="cyber-input" placeholder="CHOOSE A USERNAME" required />
                </div>

                <div class="form-group">
                    <label for="register-email"><i class="fas fa-envelope"></i> EMAIL</label>
                    <input type="email" id="register-email" class="cyber-input" placeholder="ENTER YOUR EMAIL" required />
                </div>

                <div class="form-group">
                    <label for="register-password"><i class="fas fa-lock"></i> PASSWORD</label>
                    <input type="password" id="register-password" class="cyber-input" placeholder="CREATE A PASSWORD" required minlength="6" />
                </div>

                <div class="form-group">
                    <label for="register-confirm"><i class="fas fa-lock"></i> CONFIRM PASSWORD</label>
                    <input type="password" id="register-confirm" class="cyber-input" placeholder="CONFIRM PASSWORD" required minlength="6" />
                </div>

                <button type="submit" class="cyber-btn primary full-width">
                    <i class="fas fa-user-plus"></i> REGISTER
                </button>

                <div class="auth-links">
                    <p>Already have an account? <a href="#login" class="cyber-link">Login here</a></p>
                </div>
            </form>
        </div>
    `;
}

// Add form event listeners
function setupAuthForms() {
    // Login form
    document.addEventListener('submit', function (e) {
        if (e.target.id === 'loginForm') {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            login(email, password);
        }

        if (e.target.id === 'registerForm') {
            e.preventDefault();
            const username = document.getElementById('register-username').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm').value;

            if (password !== confirmPassword) {
                showNotification('❌ Passwords do not match', 'error');
                return;
            }

            if (password.length < 6) {
                showNotification('❌ Password must be at least 6 characters', 'error');
                return;
            }

            register(username, email, password);
        }
    });
}

// Add this to your setupEventListeners function
function setupEventListeners() {
    // ... your existing code ...
    setupAuthForms();
}

// Make functions globally available
window.login = login;
window.logout = logout;
window.register = register;
window.refreshMyCats = refreshMyCats;