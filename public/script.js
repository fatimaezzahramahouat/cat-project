// ============ API CONFIGURATION ============
// Use relative URL for your Cloudflare Worker
const API_URL = "/cats";  // Changed from http://localhost:5000/cats
const API_BASE = ""; // Same origin
let currentUser = null;
let editingCatId = null;
// Authentication State

let isAuthenticated = false;
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
    console.log("🌐 API URL:", API_URL);

    // Test API connection immediately
    testAPI();

    loadCats();
    fetchTags();
    setupEventListeners();
});

// ============ TEST API CONNECTION ============
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

// ============ LOAD CATS ============
function loadCats() {
    console.log("🐱 Loading cats from API:", API_URL);
    showLoading();

    fetch(API_URL)
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

// ============ FETCH TAGS ============
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

function populateTagFilter(tags) {
    const tagFilter = document.getElementById('tag-filter');
    if (!tagFilter) {
        console.error("❌ Tag filter element not found!");
        return;
    }

    // Save current selection
    const currentSelection = tagFilter.value;

    // Clear and add default option
    tagFilter.innerHTML = '<option value="">All tags</option>';

    if (Array.isArray(tags) && tags.length > 0) {
        // Filter and sort tags
        const validTags = tags
            .filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0)
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        console.log(`✅ Adding ${validTags.length} tags to dropdown`);

        validTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.trim();
            option.textContent = tag.trim().charAt(0).toUpperCase() + tag.trim().slice(1);
            tagFilter.appendChild(option);
        });

        // Restore previous selection
        if (currentSelection && validTags.includes(currentSelection)) {
            tagFilter.value = currentSelection;
        }
    } else {
        console.warn("⚠️ No tags available");
        const noTagsOption = document.createElement('option');
        noTagsOption.value = "";
        noTagsOption.textContent = "No tags available";
        noTagsOption.disabled = true;
        tagFilter.appendChild(noTagsOption);
    }
}

function showErrorInTagFilter() {
    const tagFilter = document.getElementById('tag-filter');
    if (tagFilter) {
        tagFilter.innerHTML = '';
        const errorOption = document.createElement('option');
        errorOption.value = "";
        errorOption.textContent = "Error loading tags";
        errorOption.disabled = true;
        tagFilter.appendChild(errorOption);
    }
}

// ============ FILTER BY TAG ============
function filterCatsByTag(tag) {
    console.log(`🔍 Filtering by tag: "${tag}"`);
    currentTagFilter = tag;

    let filteredCats;

    if (!tag || tag === "") {
        filteredCats = catsData;
        console.log("🔄 Showing all cats");
    } else {
        filteredCats = catsData.filter(cat => {
            const catTag = cat.tag ? cat.tag.trim().toLowerCase() : '';
            return catTag === tag.toLowerCase();
        });
        console.log(`✅ Found ${filteredCats.length} cats with tag: "${tag}"`);
    }

    renderGallery(filteredCats);
    updateFilterIndicator(tag);
}

function updateFilterIndicator(tag) {
    const indicator = document.getElementById('filterIndicator');
    if (!indicator) return;

    if (tag && tag !== "") {
        indicator.innerHTML = `
            <span>Filtering by: <strong>${tag}</strong></span>
            <button onclick="clearFilter()" class="clear-btn">Clear Filter</button>
        `;
        indicator.style.display = 'flex';
    } else {
        indicator.style.display = 'none';
    }
}

function clearFilter() {
    const tagFilter = document.getElementById('tag-filter');
    if (tagFilter) {
        tagFilter.value = '';
        filterCatsByTag('');
    }
}

// ============ SEARCH FUNCTIONALITY ============
function setupSearch() {
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.toLowerCase();
        const tagFilter = document.getElementById('tag-filter');
        const selectedTag = tagFilter ? tagFilter.value : '';

        let filteredCats = catsData;

        // Apply tag filter first
        if (selectedTag && selectedTag !== "") {
            filteredCats = filteredCats.filter(cat => {
                const catTag = cat.tag ? cat.tag.trim().toLowerCase() : '';
                return catTag === selectedTag.toLowerCase();
            });
        }

        // Apply search filter
        if (query) {
            filteredCats = filteredCats.filter(cat =>
                (cat.name && cat.name.toLowerCase().includes(query)) ||
                (cat.tag && cat.tag.toLowerCase().includes(query)) ||
                (cat.description && cat.description.toLowerCase().includes(query))
            );
        }

        renderGallery(filteredCats);
    });
}

// ============ RENDER GALLERY ============
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
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
            ${cat.IMG ? `<img src="${cat.IMG}" alt="${cat.name}" loading="lazy" />` : '<div class="no-image">No Image</div>'}
            <h3>${escapeHTML(cat.name) || 'Unnamed Cat'}</h3>
            <p>${escapeHTML(cat.description) || 'No description available'}</p>
            <span class="tag-badge">${escapeHTML(cat.tag) || 'No tag'}</span>
            <div class="actions">
                <button onclick="editCat(${cat.id})" class="btn-edit">Edit</button>
                <button onclick="deleteCat(${cat.id})" class="btn-delete">Delete</button>
            </div>
        `;
        gallery.appendChild(div);
    });

    renderPagination(cats.length);
}

// ============ PAGINATION ============
function renderPagination(totalItems) {
    const paginationContainer = document.getElementById("pagination");
    if (!paginationContainer) return;

    paginationContainer.innerHTML = "";

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.innerText = i;
        btn.className = i === currentPage ? "active" : "";
        btn.onclick = () => {
            currentPage = i;
            // Get current filtered cats
            const tagFilter = document.getElementById('tag-filter');
            const selectedTag = tagFilter ? tagFilter.value : '';
            const searchQuery = searchInput ? searchInput.value.toLowerCase() : '';

            let filteredCats = catsData;

            if (selectedTag && selectedTag !== "") {
                filteredCats = filteredCats.filter(cat => {
                    const catTag = cat.tag ? cat.tag.trim().toLowerCase() : '';
                    return catTag === selectedTag.toLowerCase();
                });
            }

            if (searchQuery) {
                filteredCats = filteredCats.filter(cat =>
                    (cat.name && cat.name.toLowerCase().includes(searchQuery)) ||
                    (cat.tag && cat.tag.toLowerCase().includes(searchQuery)) ||
                    (cat.description && cat.description.toLowerCase().includes(searchQuery))
                );
            }

            renderGalleryForPage(filteredCats);
        };
        paginationContainer.appendChild(btn);
    }
}

function renderGalleryForPage(cats) {
    if (!gallery) return;

    gallery.innerHTML = "";

    if (!cats || cats.length === 0) {
        gallery.innerHTML = '<div class="no-results">No cats found</div>';
        return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedCats = cats.slice(startIndex, endIndex);

    paginatedCats.forEach(cat => {
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
            ${cat.IMG ? `<img src="${cat.IMG}" alt="${cat.name}" loading="lazy" />` : '<div class="no-image">No Image</div>'}
            <h3>${escapeHTML(cat.name) || 'Unnamed Cat'}</h3>
            <p>${escapeHTML(cat.description) || 'No description available'}</p>
            <span class="tag-badge">${escapeHTML(cat.tag) || 'No tag'}</span>
            <div class="actions">
                <button onclick="editCat(${cat.id})" class="btn-edit">Edit</button>
                <button onclick="deleteCat(${cat.id})" class="btn-delete">Delete</button>
            </div>
        `;
        gallery.appendChild(div);
    });
}

// ============ MODAL FUNCTIONS ============
function openAddModal() {
    nameInput.value = "";
    tagInput.value = "";
    descriptionInput.value = "";
    imgInput.value = "";
    editingId = null;

    document.getElementById("addBtn").style.display = "inline-block";
    document.getElementById("editBtn").style.display = "none";

    modal.style.display = "flex";
}

function closeModal() {
    modal.style.display = "none";
    editingId = null;
}

function addCat() {
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

    showNotification('Adding cat...', 'info');

    fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cat)
    })
        .then(res => {
            console.log("Add cat response:", res.status);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            console.log("✅ Cat added:", data);
            showNotification('✅ Cat added successfully!', 'success');
            closeModal();
            loadCats();
            fetchTags(); // Refresh tags after adding new cat
        })
        .catch(err => {
            console.error('❌ Error adding cat:', err);
            showNotification('❌ Failed to add cat. Please try again.', 'error');
        });
}

function editCat(id) {
    const cat = catsData.find(c => c.id === id);
    if (!cat) {
        showNotification('Cat not found', 'error');
        return;
    }

    editingId = id;

    nameInput.value = cat.name;
    tagInput.value = cat.tag;
    descriptionInput.value = cat.description;
    imgInput.value = cat.IMG || "";

    document.getElementById("addBtn").style.display = "none";
    document.getElementById("editBtn").style.display = "inline-block";

    modal.style.display = "flex";
}

function updateCat() {
    if (editingId === null) return;

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

    fetch(`${API_URL}/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cat)
    })
        .then(res => {
            console.log("Update cat response:", res.status);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            console.log("✅ Cat updated:", data);
            showNotification('✅ Cat updated successfully!', 'success');
            closeModal();
            loadCats();
            fetchTags(); // Refresh tags after updating
        })
        .catch(err => {
            console.error('❌ Error updating cat:', err);
            showNotification('❌ Failed to update cat. Please try again.', 'error');
        });
}

function deleteCat(id) {
    if (!confirm('Are you sure you want to delete this cat?')) return;

    showNotification('Deleting cat...', 'info');

    fetch(`${API_URL}/${id}`, {
        method: "DELETE"
    })
        .then(res => {
            console.log("Delete cat response:", res.status);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            console.log("✅ Cat deleted:", data);
            showNotification('✅ Cat deleted successfully!', 'success');
            loadCats();
            fetchTags(); // Refresh tags after deletion
        })
        .catch(err => {
            console.error('❌ Error deleting cat:', err);
            showNotification('❌ Failed to delete cat. Please try again.', 'error');
        });
}

// ============ EVENT LISTENERS SETUP ============
function setupEventListeners() {
    // Add Cat Button
    const addCatBtn = document.getElementById("addCatBtn");
    if (addCatBtn) {
        addCatBtn.addEventListener("click", openAddModal);
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
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    });
}

// ============ UTILITY FUNCTIONS ============
function showError(message) {
    if (gallery) {
        gallery.innerHTML = `<div class="error">${message}</div>`;
    }
    console.error("❌ Error:", message);
}

function showLoading() {
    if (gallery) {
        gallery.innerHTML = '<div class="loading">Loading cats...</div>';
    }
}

function hideLoading() {
    // Loading state is removed when renderGallery is called
}

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

function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Debug function
function debugApp() {
    console.log("=== 🐛 DEBUG INFO ===");
    console.log("API URL:", API_URL);
    console.log("Cats data:", catsData);
    console.log("Cats count:", catsData.length);
    console.log("Current tag filter:", currentTagFilter);
    console.log("Current page:", currentPage);

    // Test API
    fetch(API_URL)
        .then(res => console.log("Current API status:", res.status))
        .catch(err => console.log("API error:", err.message));
}

//auth    
//  // Navigation between sections
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

// Login/Signup buttons
document.querySelector('.login-btn').addEventListener('click', function (e) {
    e.preventDefault();
    document.getElementById('login-modal').style.display = 'flex';
});

document.querySelector('.signup-btn').addEventListener('click', function (e) {
    e.preventDefault();
    document.getElementById('signup-modal').style.display = 'flex';
});

// Close modals
function closeLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
}

function closeSignupModal() {
    document.getElementById('signup-modal').style.display = 'none';
}

// Contact form submission
document.querySelector('.contact-form').addEventListener('submit', function (e) {
    e.preventDefault();
    alert('Message sent securely!');
    this.reset();
});

// Auth forms
document.querySelectorAll('.auth-form').forEach(form => {
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        alert('Authentication successful!');
        closeLoginModal();
        closeSignupModal();
    });
});

// Update cat count
function updateCatCount(count) {
    document.getElementById('catCount').textContent = count;
}

// Initialize with home section active
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('home').classList.add('active');

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
});

//login page

// ============ SIGNUP FORM HANDLER ============
async function handleSignup(e) {
    e.preventDefault();
    console.log("📝 Handling signup...");

    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

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
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('authToken', authToken);

            showNotification('✅ Account created successfully!', 'success');
            closeSignupModal();

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
// Signup form submission
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
}

// Signup button click
const signupBtn = document.querySelector('.signup-btn');
if (signupBtn) {
    signupBtn.addEventListener('click', function (e) {
        e.preventDefault();
        console.log("📝 Signup button clicked");
        showSignupModal();
    });
}
// Show signup modal
function showSignupModal() {
    console.log("🔄 Showing signup modal");
    closeAllModals();
    document.getElementById('signup-modal').style.display = 'flex';
}

// Close signup modal
function closeSignupModal() {
    document.getElementById('signup-modal').style.display = 'none';
    const form = document.getElementById('signup-form');
    if (form) form.reset();
}

// Close all modals
function closeAllModals() {
    closeModal();
    closeLoginModal();
    closeSignupModal();
}

//authhhhh


// Mock User Database (In production, use backend API)
const mockUsers = [
    {
        id: 1,
        username: 'admin',
        email: 'admin@cattey.com',
        password: 'password123',
        joined: '2024-01-01',
        role: 'admin',
        cats: []
    }
];

// Initialize authentication
function initAuth() {
    // Check if user is logged in from localStorage
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        isAuthenticated = true;
        updateUIForAuth();
    }

    // Setup event listeners
    setupAuthListeners();
}

// Setup authentication event listeners
function setupAuthListeners() {
    // Login form submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Signup form submit
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Login/Signup modal triggers
    document.querySelectorAll('[href="#login"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginModal();
        });
    });

    document.querySelectorAll('[href="#signup"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            showSignupModal();
        });
    });
}

// Handle Login
function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorElement = document.getElementById('login-error');

    // Clear previous errors
    errorElement.style.display = 'none';

    // Validate input
    if (!email || !password) {
        showError(errorElement, 'Please fill in all fields');
        return;
    }

    // Find user (mock authentication)
    const user = mockUsers.find(u => u.email === email && u.password === password);

    if (!user) {
        showError(errorElement, 'Invalid email or password');
        return;
    }

    // Login successful
    currentUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        joined: user.joined
    };

    isAuthenticated = true;

    // Save to localStorage
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    // Update UI
    updateUIForAuth();

    // Close modal and show dashboard
    closeModal('login-modal');
    showDashboard();

    // Clear form
    document.getElementById('login-form').reset();
}

// Handle Signup
function handleSignup(e) {
    e.preventDefault();

    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;
    const errorElement = document.getElementById('signup-error');

    // Clear previous errors
    errorElement.style.display = 'none';

    // Validate input
    if (!username || !email || !password || !confirmPassword) {
        showError(errorElement, 'Please fill in all fields');
        return;
    }

    if (password !== confirmPassword) {
        showError(errorElement, 'Passwords do not match');
        return;
    }

    if (password.length < 6) {
        showError(errorElement, 'Password must be at least 6 characters');
        return;
    }

    // Check if user exists
    const userExists = mockUsers.some(u => u.email === email);
    if (userExists) {
        showError(errorElement, 'Email already registered');
        return;
    }

    // Create new user (mock registration)
    const newUser = {
        id: mockUsers.length + 1,
        username: username,
        email: email,
        password: password,
        joined: new Date().toISOString().split('T')[0],
        role: 'user',
        cats: []
    };

    mockUsers.push(newUser);

    // Auto login after signup
    currentUser = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        joined: newUser.joined
    };

    isAuthenticated = true;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    // Update UI
    updateUIForAuth();

    // Close modal and show dashboard
    closeModal('signup-modal');
    showDashboard();

    // Clear form
    document.getElementById('signup-form').reset();
}

// Handle Logout
function handleLogout() {
    currentUser = null;
    isAuthenticated = false;
    localStorage.removeItem('currentUser');
    updateUIForAuth();
    showHome(); // Go back to home
}

// Update UI based on authentication state
function updateUIForAuth() {
    const authButtons = document.querySelector('.cyber-auth');
    const navLinks = document.querySelector('.cyber-nav-links');

    if (isAuthenticated && currentUser) {
        // Replace auth buttons with user info
        authButtons.innerHTML = `
            <div class="user-info">
                <div class="user-avatar">
                    <i class="fas fa-user"></i>
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

        // Add dashboard link to navigation
        const dashboardLink = document.createElement('li');
        dashboardLink.innerHTML = `
            <a href="#dashboard" class="cyber-nav-link" onclick="showDashboard()">
                <i class="fas fa-dashboard"></i> DASHBOARD
            </a>
        `;
        navLinks.appendChild(dashboardLink);

        // Update dashboard display
        updateDashboard();
    } else {
        // Show login/signup buttons
        authButtons.innerHTML = `
            <a href="#login" class="cyber-btn login-btn" onclick="showLoginModal()">
                <i class="fas fa-sign-in-alt"></i> LOGIN
            </a>
            <a href="#signup" class="cyber-btn signup-btn" onclick="showSignupModal()">
                <i class="fas fa-user-plus"></i> SIGN UP
            </a>
        `;

        // Remove dashboard link
        const dashboardLink = navLinks.querySelector('a[href="#dashboard"]');
        if (dashboardLink) {
            dashboardLink.parentElement.remove();
        }
    }
}

// Update Dashboard
function updateDashboard() {
    if (!currentUser) return;

    // Update user info
    document.getElementById('username-display').textContent = currentUser.username;
    document.getElementById('dashboard-username').textContent = currentUser.username;
    document.getElementById('dashboard-email').textContent = currentUser.email;
    document.getElementById('dashboard-joined').textContent = currentUser.joined;

    // Count user's cats (filter by owner)
    const userCats = cats.filter(cat => cat.ownerId === currentUser.id);
    document.getElementById('my-cats-count').textContent = userCats.length;

    // Display user's cats
    const myCatsGallery = document.getElementById('my-cats-gallery');
    myCatsGallery.innerHTML = '';

    userCats.slice(0, 6).forEach(cat => {
        const catElement = document.createElement('div');
        catElement.className = 'mini-cat-card';
        catElement.innerHTML = `
            <img src="${cat.img}" alt="${cat.name}" onerror="this.src='https://placekitten.com/200/200'">
        `;
        catElement.onclick = () => showCatDetails(cat.id);
        myCatsGallery.appendChild(catElement);
    });

    // Update activity feed
    updateActivityFeed();
}

// Update Activity Feed
function updateActivityFeed() {
    const activityFeed = document.getElementById('activity-feed');
    if (!activityFeed) return;

    const activities = [
        { action: 'Logged in to dashboard', time: 'Just now' },
        { action: 'Added new cat: "Whiskers"', time: '2 hours ago' },
        { action: 'Updated profile information', time: '1 day ago' },
        { action: 'Liked 5 cat photos', time: '2 days ago' }
    ];

    activityFeed.innerHTML = activities.map(activity => `
        <div class="activity-item">
            ${activity.action}
            <time>${activity.time}</time>
        </div>
    `).join('');
}

// Show Dashboard
function showDashboard() {
    if (!isAuthenticated) {
        showLoginModal();
        return;
    }

    // Hide all sections
    document.querySelectorAll('.cyber-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show dashboard
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.classList.add('active');
        updateDashboard();
    }

    // Update navigation
    document.querySelectorAll('.cyber-nav-link').forEach(link => {
        link.classList.remove('active');
    });
}

// Show Login Modal
function showLoginModal() {
    closeAllModals();
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('login-email').focus();
}

// Show Signup Modal
function showSignupModal() {
    closeAllModals();
    document.getElementById('signup-modal').style.display = 'flex';
    document.getElementById('signup-username').focus();
}

// Show Error Message
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

// Update your existing closeModal function
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function closeAllModals() {
    document.querySelectorAll('.cyber-modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// Update your existing cat adding function to include owner
function addCat() {
    if (!isAuthenticated) {
        showLoginModal();
        return;
    }

    const name = document.getElementById('name').value;
    const tag = document.getElementById('tag').value;
    const img = document.getElementById('img').value;
    const description = document.getElementById('description').value;

    if (!name || !img) {
        alert('Please fill in at least name and image URL');
        return;
    }

    const newCat = {
        id: cats.length + 1,
        name: name,
        tag: tag.toLowerCase(),
        img: img || 'https://placekitten.com/400/300',
        description: description,
        likes: 0,
        ownerId: currentUser.id,
        ownerName: currentUser.username,
        date: new Date().toISOString().split('T')[0]
    };

    cats.unshift(newCat);

    // Close modal and update display
    closeCatModal();
    displayCats();
    updateDashboard(); // Refresh dashboard

    // Clear form
    document.getElementById('name').value = '';
    document.getElementById('tag').value = '';
    document.getElementById('img').value = '';
    document.getElementById('description').value = '';
}

// Initialize authentication when page loads
document.addEventListener('DOMContentLoaded', function () {
    initAuth();

    // Add dashboard link to navigation if authenticated
    if (isAuthenticated) {
        updateUIForAuth();
    }
});
// In your existing navigation code, add:
document.addEventListener('DOMContentLoaded', function () {
    // ... existing navigation code ...

    // Add dashboard navigation
    document.querySelectorAll('a[href="#dashboard"]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showDashboard();
        });
    });

    // Initialize auth
    initAuth();
});
// Make debug function available globally
window.debugApp = debugApp;
window.clearFilter = clearFilter;
window.editCat = editCat;
window.deleteCat = deleteCat;
window.openAddModal = openAddModal;
window.closeModal = closeModal;
window.addCat = addCat;
window.updateCat = updateCat;
window.filterCatsByTag = filterCatsByTag;

// Initialize debug
console.log("🐱 Cat Gallery Script Loaded");
console.log("🌐 API Endpoint:", API_URL);