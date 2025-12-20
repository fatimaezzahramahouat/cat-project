// ============ API CONFIGURATION ============
const API_URL = "/cats";
const API_BASE = "";
let currentUser = null;
let authToken = null;
let editingCatId = null;

// ============ AUTH STATE MANAGEMENT ============
function checkAuthState() {
    const savedUser = localStorage.getItem('currentUser');
    const savedToken = localStorage.getItem('authToken');

    if (savedUser && savedToken) {
        currentUser = JSON.parse(savedUser);
        authToken = savedToken;
        updateAuthUI();
    }
}

function updateAuthUI() {
    const authDiv = document.querySelector('.cyber-auth');
    if (!authDiv) return;

    if (currentUser) {
        authDiv.innerHTML = `
            <div class="user-info">
                <span class="username">
                    <i class="fas fa-user-circle"></i> ${currentUser.username}
                </span>
                <button class="cyber-btn logout-btn" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        `;

        // Show add cat button
        const addCatBtn = document.getElementById("addCatBtn");
        if (addCatBtn) {
            addCatBtn.style.display = "inline-block";
        }
    } else {
        authDiv.innerHTML = `
            <button class="cyber-btn login-btn" onclick="showLoginModal()">
                <i class="fas fa-sign-in-alt"></i> LOGIN
            </button>
            <button class="cyber-btn signup-btn" onclick="showSignupModal()">
                <i class="fas fa-user-plus"></i> SIGN UP
            </button>
        `;

        // Hide add cat button if user not logged in
        const addCatBtn = document.getElementById("addCatBtn");
        if (addCatBtn) {
            addCatBtn.style.display = "none";
        }
    }
}

// ============ AUTH FUNCTIONS ============
async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const inputs = form.querySelectorAll('input');
    const email = inputs[0].value;
    const password = inputs[1].value;

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = data.user;
            authToken = data.token;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('authToken', authToken);

            showNotification(`Welcome ${data.user.username}!`, 'success');
            closeLoginModal();
            updateAuthUI();
            loadCats(); // Reload cats to show user-specific content
        } else {
            showNotification(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showNotification('Error during login', 'error');
        console.error('Login error:', error);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const form = e.target;
    const inputs = form.querySelectorAll('input');
    const username = inputs[0].value;
    const email = inputs[1].value;
    const password = inputs[2].value;
    const confirmPassword = inputs[3].value;

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    try {
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = data.user;
            authToken = data.token;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('authToken', authToken);

            showNotification('Account created successfully!', 'success');
            closeSignupModal();
            updateAuthUI();
            loadCats();
        } else {
            showNotification(data.error || 'Signup failed', 'error');
        }
    } catch (error) {
        showNotification('Error during signup', 'error');
        console.error('Signup error:', error);
    }
}

function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    updateAuthUI();
    loadCats(); // Reload cats to show public view
    showNotification('Logged out successfully', 'info');
}

// ============ UPDATED CAT FUNCTIONS WITH AUTH ============
async function addCat() {
    if (!currentUser) {
        showNotification('Please login to add a cat', 'warning');
        return;
    }

    const cat = {
        name: nameInput.value,
        tag: tagInput.value,
        description: descriptionInput.value,
        IMG: imgInput.value
    };

    if (!cat.name || !cat.name.trim()) {
        showNotification('Please enter a cat name', 'warning');
        return;
    }

    showNotification('Adding cat...', 'info');

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify(cat)
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        console.log("✅ Cat added:", data);
        showNotification('✅ Cat added successfully!', 'success');
        closeModal();
        loadCats();
        fetchTags();
    } catch (err) {
        console.error('❌ Error adding cat:', err);
        showNotification('❌ Failed to add cat. Please try again.', 'error');
    }
}

async function updateCat() {
    if (editingId === null) return;

    if (!currentUser) {
        showNotification('Please login to edit cats', 'warning');
        return;
    }

    const cat = {
        name: nameInput.value,
        tag: tagInput.value,
        description: descriptionInput.value,
        IMG: imgInput.value
    };

    if (!cat.name || !cat.name.trim()) {
        showNotification('⚠️ Please enter a cat name', 'warning');
        return;
    }

    showNotification('Updating cat...', 'info');

    try {
        const response = await fetch(`${API_URL}/${editingId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify(cat)
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        console.log("✅ Cat updated:", data);
        showNotification('✅ Cat updated successfully!', 'success');
        closeModal();
        loadCats();
        fetchTags();
    } catch (err) {
        console.error('❌ Error updating cat:', err);
        showNotification('❌ Failed to update cat. Please try again.', 'error');
    }
}

async function deleteCat(id) {
    if (!currentUser) {
        showNotification('Please login to delete cats', 'warning');
        return;
    }

    if (!confirm('Are you sure you want to delete this cat?')) return;

    showNotification('Deleting cat...', 'info');

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        console.log("✅ Cat deleted:", data);
        showNotification('✅ Cat deleted successfully!', 'success');
        loadCats();
        fetchTags();
    } catch (err) {
        console.error('❌ Error deleting cat:', err);
        showNotification('❌ Failed to delete cat. Please try again.', 'error');
    }
}

// ============ UPDATED LOAD CATS WITH AUTH ============
async function loadCats() {
    console.log("🐱 Loading cats from API:", API_URL);
    showLoading();

    try {
        // If user is logged in, get their cats, otherwise get all cats
        const url = currentUser ? '/my-cats' : '/cats';
        const headers = currentUser ? { "Authorization": `Bearer ${authToken}` } : {};

        const response = await fetch(url, { headers });
        console.log("Load cats response:", response.status, response.statusText);

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        catsData = Array.isArray(data) ? data : [];
        console.log(`✅ Loaded ${catsData.length} cats`);
        hideLoading();
        renderGallery(catsData);
    } catch (err) {
        console.error('❌ Error loading cats:', err);
        hideLoading();
        showError('Failed to load cats. Please check if the Worker is running.');
    }
}

// ============ UPDATED RENDER GALLERY WITH OWNERSHIP ============
function renderGallery(cats) {
    if (!gallery) {
        console.error("❌ Gallery element not found!");
        return;
    }

    gallery.innerHTML = "";

    if (!cats || cats.length === 0) {
        gallery.innerHTML = '<div class="no-results">No cats found</div>';
        renderPagination(cats.length);
        return;
    }

    // Reset to page 1 when filtering
    currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedCats = cats.slice(startIndex, endIndex);

    paginatedCats.forEach(cat => {
        const canEdit = currentUser && (currentUser.role === 'admin' || cat.user_id === currentUser.id);

        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
            ${cat.IMG ? `<img src="${cat.IMG}" alt="${cat.name}" loading="lazy" />` : '<div class="no-image">No Image</div>'}
            <h3>${escapeHTML(cat.name) || 'Unnamed Cat'}</h3>
            <p>${escapeHTML(cat.description) || 'No description available'}</p>
            <span class="tag-badge">${escapeHTML(cat.tag) || 'No tag'}</span>
            ${cat.owner_name ? `<small>Owner: ${escapeHTML(cat.owner_name)}</small>` : ''}
            <div class="actions">
                ${canEdit ? `
                    <button onclick="editCat(${cat.id})" class="btn-edit">Edit</button>
                    <button onclick="deleteCat(${cat.id})" class="btn-delete">Delete</button>
                ` : `
                    <button onclick="editCat(${cat.id})" class="btn-edit" disabled>Edit</button>
                    <button onclick="deleteCat(${cat.id})" class="btn-delete" disabled>Delete</button>
                `}
            </div>
        `;
        gallery.appendChild(div);
    });

    renderPagination(cats.length);
}

// ============ UPDATED EVENT LISTENERS ============
function setupEventListeners() {
    // Add Cat Button
    const addCatBtn = document.getElementById("addCatBtn");
    if (addCatBtn) {
        addCatBtn.addEventListener("click", function (e) {
            if (!currentUser) {
                showNotification('Please login to add cats', 'warning');
                showLoginModal();
                return;
            }
            openAddModal();
        });
    }

    // Tag Filter Change
    if (tagFilter) {
        tagFilter.addEventListener('change', function () {
            const selectedTag = this.value;
            console.log("🎯 Tag selected:", selectedTag);
            filterCatsByTag(selectedTag);
        });
    }

    // Search Input
    setupSearch();

    // Close modal when clicking outside
    window.addEventListener('click', function (event) {
        if (event.target === modal) {
            closeModal();
        }
        const loginModal = document.getElementById('login-modal');
        const signupModal = document.getElementById('signup-modal');

        if (event.target === loginModal) {
            closeLoginModal();
        }
        if (event.target === signupModal) {
            closeSignupModal();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeModal();
            closeLoginModal();
            closeSignupModal();
        }
    });

    // Update contact form submission
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContact);
    }
}

// ============ CONTACT FORM HANDLER ============
async function handleContact(e) {
    e.preventDefault();
    const form = e.target;

    const formData = {
        name: form.querySelector('input[type="text"]').value,
        email: form.querySelector('input[type="email"]').value,
        message: form.querySelector('textarea').value
    };

    try {
        const response = await fetch('/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Message sent successfully!', 'success');
            form.reset();
        } else {
            showNotification(data.error || 'Failed to send message', 'error');
        }
    } catch (error) {
        showNotification('Error sending message', 'error');
        console.error('Contact error:', error);
    }
}

// ============ UPDATED INITIALIZATION ============
document.addEventListener('DOMContentLoaded', function () {
    console.log("📄 DOM loaded, initializing Cat Gallery...");

    // Check auth state first
    checkAuthState();

    // Test API connection
    testAPI();

    // Load cats and tags
    loadCats();
    fetchTags();

    // Setup event listeners
    setupEventListeners();

    // Start typing animation
    const title = document.querySelector('.terminal-header h1');
    if (title) {
        const text = title.textContent;
        title.textContent = '';
        let i = 0;
        const typing = setInterval(() => {
            if (i < text.length) {
                title.textContent += text.charAt(i);
                i++;
            } else {
                clearInterval(typing);
            }
        }, 50);
    }

    // Navigation between sections
    document.querySelectorAll('.cyber-nav-link').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);

            // Update active nav link
            document.querySelectorAll('.cyber-nav-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            // Show target section
            document.querySelectorAll('.cyber-section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(targetId).classList.add('active');
        });
    });
});

// ============ MODAL FUNCTIONS ============
function showLoginModal() {
    document.getElementById('login-modal').style.display = 'flex';
}

function showSignupModal() {
    document.getElementById('signup-modal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
    const form = document.querySelector('#login-modal .auth-form');
    if (form) form.reset();
}

function closeSignupModal() {
    document.getElementById('signup-modal').style.display = 'none';
    const form = document.querySelector('#signup-modal .auth-form');
    if (form) form.reset();
}

// ============ UPDATE CAT COUNT ============
function updateCatCount(count) {
    const catCountElement = document.getElementById('catCount');
    if (catCountElement) {
        catCountElement.textContent = count;
    }
}

// ============ TEST API CONNECTION (UPDATED) ============
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
            console.log("Total cats:", data.length);
            updateCatCount(data.length);
        })
        .catch(err => {
            console.error('❌ API connection failed:', err);
            showNotification('⚠️ Cannot connect to API. Make sure the Worker is deployed.', 'error');
        });
}

// ============ ADD CSS FOR USER INTERFACE ============
function addAuthStyles() {
    if (!document.querySelector('#auth-styles')) {
        const style = document.createElement('style');
        style.id = 'auth-styles';
        style.textContent = `
            .user-info {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            
            .username {
                color: var(--neon-green);
                font-family: 'Courier New', monospace;
                font-weight: bold;
            }
            
            .logout-btn {
                background: var(--cyber-dark);
                border: 1px solid var(--neon-red);
                color: var(--neon-red);
            }
            
            .logout-btn:hover {
                background: var(--neon-red);
                color: white;
                box-shadow: 0 0 15px var(--neon-red);
            }
            
            .actions button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .actions button:disabled:hover {
                background: var(--cyber-dark);
                color: #666;
                box-shadow: none;
            }
            
            .card small {
                display: block;
                margin-top: 5px;
                color: var(--neon-blue);
                font-size: 0.8em;
            }
        `;
        document.head.appendChild(style);
    }
}

// Add styles on load
addAuthStyles();

// ============ GLOBAL FUNCTIONS ============
window.debugApp = debugApp;
window.clearFilter = clearFilter;
window.editCat = editCat;
window.deleteCat = deleteCat;
window.openAddModal = openAddModal;
window.closeModal = closeModal;
window.addCat = addCat;
window.updateCat = updateCat;
window.filterCatsByTag = filterCatsByTag;
window.showLoginModal = showLoginModal;
window.showSignupModal = showSignupModal;
window.closeLoginModal = closeLoginModal;
window.closeSignupModal = closeSignupModal;
window.logout = logout;

console.log("🐱 Cat Gallery with Auth Script Loaded");