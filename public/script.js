// ============ API CONFIGURATION ============
// Use relative URL for your Cloudflare Worker
const API_URL = "/cats";  // Changed from http://localhost:5000/cats
const API_BASE = ""; // Same origin
let currentUser = null;
let editingCatId = null;
// Authentication State
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';


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
// ===== AUTHENTICATION SYSTEM FOR CLOUDFLARE WORKER =====
class CloudflareAuthSystem {
    constructor() {
        // Your Cloudflare Worker URL
        this.API_URL = 'https://your-worker-name.your-account.workers.dev/api';
        this.currentUser = null;
        this.isAuthenticated = false;
        this.token = localStorage.getItem('catgallery_token');

        this.init();
    }

    async init() {
        if (this.token) {
            await this.verifyToken();
        }
        this.setupEventListeners();
        this.updateUI();
    }

    // Save token
    saveToken(token) {
        this.token = token;
        localStorage.setItem('catgallery_token', token);
    }

    // Remove token
    removeToken() {
        this.token = null;
        localStorage.removeItem('catgallery_token');
    }

    // Get authorization headers
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    // Verify token with backend
    async verifyToken() {
        try {
            const response = await fetch(`${this.API_URL}/auth/verify`, {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.isAuthenticated = true;
                return true;
            } else {
                this.removeToken();
                return false;
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    }

    // Handle registration
    async handleRegister(e) {
        e.preventDefault();

        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm').value;

        // Validation
        if (!username || !email || !password || !confirmPassword) {
            this.showError('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters');
            return;
        }

        try {
            const response = await fetch(`${this.API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.saveToken(data.token);
                this.currentUser = data.user;
                this.isAuthenticated = true;

                this.showNotification('Account created successfully!');
                this.closeModal('signup-modal');
                this.updateUI();
                this.showDashboard();

                document.getElementById('signup-form').reset();
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        }
    }

    // Handle login
    async handleLogin(e) {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        try {
            const response = await fetch(`${this.API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.saveToken(data.token);
                this.currentUser = data.user;
                this.isAuthenticated = true;

                this.showNotification('Login successful!');
                this.closeModal('login-modal');
                this.updateUI();
                this.showDashboard();

                document.getElementById('login-form').reset();
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        }
    }

    // Handle logout
    async handleLogout() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.removeToken();

        this.updateUI();
        this.showHome();
        this.showNotification('Logged out successfully');
    }

    // Get user dashboard
    async getUserDashboard() {
        try {
            const response = await fetch(`${this.API_URL}/users/me`, {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                return await response.json();
            } else {
                if (response.status === 401) {
                    this.handleLogout();
                }
                return null;
            }
        } catch (error) {
            console.error('Failed to fetch dashboard:', error);
            return null;
        }
    }

    // Get admin dashboard
    async getAdminDashboard() {
        try {
            const response = await fetch(`${this.API_URL}/admin/stats`, {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                const stats = await response.json();

                // Get users list
                const usersResponse = await fetch(`${this.API_URL}/admin/users`, {
                    headers: this.getAuthHeaders()
                });

                if (usersResponse.ok) {
                    const users = await usersResponse.json();
                    return { ...stats, ...users };
                }
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch admin dashboard:', error);
            return null;
        }
    }

    // Add a cat
    async addCat(catData) {
        try {
            const response = await fetch(`${this.API_URL}/cats`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(catData)
            });

            if (response.ok) {
                return await response.json();
            } else {
                if (response.status === 401) {
                    this.handleLogout();
                }
                return null;
            }
        } catch (error) {
            console.error('Failed to add cat:', error);
            return null;
        }
    }

    // Get all cats
    async getAllCats() {
        try {
            const response = await fetch(`${this.API_URL}/cats`);

            if (response.ok) {
                return await response.json();
            }
            return [];
        } catch (error) {
            console.error('Failed to fetch cats:', error);
            return [];
        }
    }

    // Update UI based on auth state
    updateUI() {
        const authContainer = document.getElementById('auth-container');
        const dashboardLink = document.getElementById('dashboard-link');
        const adminLinks = document.getElementById('admin-links');

        if (this.isAuthenticated && this.currentUser) {
            // Show user info
            authContainer.innerHTML = `
                <div class="user-info">
                    <div class="user-avatar" onclick="auth.showDashboard()" title="Dashboard">
                        ${this.currentUser.avatar || '😺'}
                    </div>
                    <div class="user-details">
                        <span class="user-name">${this.currentUser.username}</span>
                        <span class="user-role">${this.currentUser.role.toUpperCase()}</span>
                    </div>
                    <button class="cyber-btn logout-btn" onclick="auth.handleLogout()">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            `;

            // Show dashboard link
            if (dashboardLink) dashboardLink.style.display = 'block';

            // Show admin links if user is admin
            if (this.currentUser.role === 'admin' && adminLinks) {
                adminLinks.style.display = 'flex';
            }

        } else {
            // Show login/signup buttons
            authContainer.innerHTML = `
                <a href="#login" class="cyber-btn login-btn" onclick="auth.showLoginModal()">
                    <i class="fas fa-sign-in-alt"></i> LOGIN
                </a>
                <a href="#signup" class="cyber-btn signup-btn" onclick="auth.showSignupModal()">
                    <i class="fas fa-user-plus"></i> SIGN UP
                </a>
            `;

            // Hide dashboard link
            if (dashboardLink) dashboardLink.style.display = 'none';

            // Hide admin links
            if (adminLinks) adminLinks.style.display = 'none';
        }
    }

    // Show user dashboard
    async showUserDashboard() {
        const data = await this.getUserDashboard();

        if (!data) {
            this.showError('Failed to load dashboard');
            return;
        }

        const dashboardContent = `
            <div class="dashboard-grid">
                <!-- Profile Card -->
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
                                <span class="info-label">MEMBER SINCE:</span>
                                <span class="info-value">${new Date(data.user.joined).toLocaleDateString()}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">ROLE:</span>
                                <span class="info-value">${data.user.role.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Stats Card -->
                <div class="dashboard-card">
                    <div class="card-header">
                        <i class="fas fa-chart-bar"></i>
                        <h3>MY STATS</h3>
                    </div>
                    <div class="card-content">
                        <div class="stats-grid">
                            <div class="stat-item">
                                <i class="fas fa-cat"></i>
                                <span class="stat-value">${data.stats.totalCats}</span>
                                <span class="stat-label">CATS POSTED</span>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-heart"></i>
                                <span class="stat-value">${data.stats.totalLikes}</span>
                                <span class="stat-label">TOTAL LIKES</span>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-eye"></i>
                                <span class="stat-value">${data.user.profileViews}</span>
                                <span class="stat-label">PROFILE VIEWS</span>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-star"></i>
                                <span class="stat-value">${data.stats.averageLikes}</span>
                                <span class="stat-label">AVG LIKES</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- My Cats Card -->
                <div class="dashboard-card">
                    <div class="card-header">
                        <i class="fas fa-images"></i>
                        <h3>MY RECENT CATS</h3>
                    </div>
                    <div class="card-content">
                        ${data.recentCats.length > 0 ? `
                            <div class="mini-gallery">
                                ${data.recentCats.slice(0, 6).map(cat => `
                                    <div class="mini-cat-card" onclick="showCatDetails('${cat.id}')">
                                        <img src="${cat.img}" alt="${cat.name}" 
                                             onerror="this.src='https://placekitten.com/200/200'">
                                        <div class="mini-cat-info">${cat.name}</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div class="empty-state">
                                <i class="fas fa-cat"></i>
                                <p>No cats posted yet</p>
                                <button onclick="showCatModal()" class="cyber-btn small">
                                    Add Your First Cat
                                </button>
                            </div>
                        `}
                    </div>
                </div>
                
                <!-- Activity Card -->
                <div class="dashboard-card">
                    <div class="card-header">
                        <i class="fas fa-history"></i>
                        <h3>RECENT ACTIVITY</h3>
                    </div>
                    <div class="card-content">
                        <div class="activity-feed">
                            ${data.activities.length > 0 ?
                data.activities.map(activity => `
                                    <div class="activity-item">
                                        <span>${activity.action}</span>
                                        <time>${new Date(activity.timestamp).toLocaleString()}</time>
                                    </div>
                                `).join('') :
                '<div class="empty-state">No recent activity</div>'
            }
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Quick Actions -->
            <div class="quick-actions">
                <h3><i class="fas fa-bolt"></i> QUICK ACTIONS</h3>
                <div class="action-buttons">
                    <button onclick="showCatModal()" class="cyber-btn primary">
                        <i class="fas fa-plus"></i> ADD NEW CAT
                    </button>
                    <button onclick="auth.showEditProfile()" class="cyber-btn">
                        <i class="fas fa-edit"></i> EDIT PROFILE
                    </button>
                </div>
            </div>
        `;

        document.getElementById('dashboard-content').innerHTML = dashboardContent;
        this.showSection('dashboard');
    }

    // Show admin dashboard
    async showAdminDashboard() {
        const data = await this.getAdminDashboard();

        if (!data) {
            this.showError('Failed to load admin dashboard');
            return;
        }

        const adminContent = `
            <div class="admin-grid">
                <!-- Stats Overview -->
                <div class="admin-stats-grid">
                    <div class="admin-stat-card">
                        <i class="fas fa-users"></i>
                        <div class="stat-info">
                            <h3>${data.stats.totalUsers}</h3>
                            <p>TOTAL USERS</p>
                        </div>
                    </div>
                    <div class="admin-stat-card">
                        <i class="fas fa-cat"></i>
                        <div class="stat-info">
                            <h3>${data.stats.totalCats}</h3>
                            <p>TOTAL CATS</p>
                        </div>
                    </div>
                    <div class="admin-stat-card">
                        <i class="fas fa-heart"></i>
                        <div class="stat-info">
                            <h3>${data.stats.totalLikes}</h3>
                            <p>TOTAL LIKES</p>
                        </div>
                    </div>
                    <div class="admin-stat-card">
                        <i class="fas fa-chart-line"></i>
                        <div class="stat-info">
                            <h3>${data.stats.activeUsers}</h3>
                            <p>ACTIVE USERS</p>
                        </div>
                    </div>
                </div>
                
                <!-- Recent Users -->
                <div class="admin-card">
                    <div class="card-header">
                        <i class="fas fa-user-plus"></i>
                        <h3>RECENT USERS</h3>
                    </div>
                    <div class="card-content">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>USERNAME</th>
                                    <th>EMAIL</th>
                                    <th>JOINED</th>
                                    <th>STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.users.slice(0, 5).map(user => `
                                    <tr>
                                        <td>${user.username}</td>
                                        <td>${user.email}</td>
                                        <td>${new Date(user.joined).toLocaleDateString()}</td>
                                        <td><span class="status-badge ${user.status}">${user.status.toUpperCase()}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- System Actions -->
                <div class="admin-card">
                    <div class="card-header">
                        <i class="fas fa-cogs"></i>
                        <h3>SYSTEM ACTIONS</h3>
                    </div>
                    <div class="card-content">
                        <div class="system-actions">
                            <button onclick="auth.showUsersManagement()" class="cyber-btn primary">
                                <i class="fas fa-users-cog"></i> MANAGE USERS
                            </button>
                            <button onclick="auth.showAllCatsManagement()" class="cyber-btn">
                                <i class="fas fa-cat"></i> MANAGE CATS
                            </button>
                            <button onclick="auth.exportData()" class="cyber-btn">
                                <i class="fas fa-download"></i> EXPORT DATA
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('admin-dashboard-content').innerHTML = adminContent;
        this.showSection('admin-dashboard');
    }

    // Show dashboard based on user role
    async showDashboard() {
        if (!this.isAuthenticated) {
            this.showLoginModal();
            return;
        }

        if (this.currentUser.role === 'admin') {
            await this.showAdminDashboard();
        } else {
            await this.showUserDashboard();
        }
    }

    // Show section helper
    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.cyber-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show requested section
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('active');
        }

        // Update navigation
        this.updateActiveNav(sectionId);
    }

    // Update active navigation
    updateActiveNav(activeSection) {
        document.querySelectorAll('.cyber-nav-link').forEach(link => {
            link.classList.remove('active');
        });

        const activeLink = document.querySelector(`.cyber-nav-link[href="#${activeSection}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    // Show login modal
    showLoginModal() {
        this.closeAllModals();
        document.getElementById('login-modal').style.display = 'flex';
        document.getElementById('login-email').focus();
    }

    // Show signup modal
    showSignupModal() {
        this.closeAllModals();
        document.getElementById('signup-modal').style.display = 'flex';
        document.getElementById('signup-username').focus();
    }

    // Close modal
    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    // Close all modals
    closeAllModals() {
        document.querySelectorAll('.cyber-modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    // Show home section
    showHome() {
        this.showSection('home');
    }

    // Show error message
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'cyber-notification error';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.classList.add('fade-out');
            setTimeout(() => errorDiv.remove(), 300);
        }, 3000);
    }

    // Show notification
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'cyber-notification success';
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Setup event listeners
    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Signup form
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAllModals();
            });
        });
    }
}

// Initialize the auth system
const auth = new CloudflareAuthSystem();

// Make it globally available
window.auth = auth;

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