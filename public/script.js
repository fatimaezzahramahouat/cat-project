// ============ API CONFIGURATION ============
const API_URL = "/cats";
const API_BASE = "";
let currentUser = null;
let authToken = null;
let editingId = null;
let catsData = [];
let currentPage = 1;
const itemsPerPage = 8;
let currentTagFilter = '';

// ============ DOM ELEMENTS ============
const gallery = document.getElementById("catGallery");
const modal = document.getElementById("catModal");
const nameInput = document.getElementById("name");
const tagInput = document.getElementById("tag");
const descriptionInput = document.getElementById("description");
const imgInput = document.getElementById("img");
const searchInput = document.getElementById("searchInput");
const tagFilter = document.getElementById("tag-filter");
const catCountElement = document.getElementById('catCount');

// ============ AUTH STATE MANAGEMENT ============
function checkAuthState() {
    const savedUser = localStorage.getItem('currentUser');
    const savedToken = localStorage.getItem('authToken');

    if (savedUser && savedToken) {
        try {
            currentUser = JSON.parse(savedUser);
            authToken = savedToken;
            updateAuthUI();
        } catch (e) {
            console.error('Error parsing saved user:', e);
            clearAuth();
        }
    }
}

function clearAuth() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    updateAuthUI();
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
                    <i class="fas fa-sign-out-alt"></i> LOGOUT
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
            loadCats();
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

    if (!username || !email || !password) {
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
    loadCats();
    showNotification('Logged out successfully', 'info');
}

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

function openAddModal() {
    if (!currentUser) {
        showNotification('Please login to add a cat', 'warning');
        showLoginModal();
        return;
    }

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

// ============ CAT FUNCTIONS WITH AUTH ============
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

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Cat added:", data);
        showNotification('✅ Cat added successfully!', 'success');
        closeModal();
        loadCats();
        fetchTags();
    } catch (err) {
        console.error('❌ Error adding cat:', err);
        showNotification(err.message || 'Failed to add cat. Please try again.', 'error');
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

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Cat updated:", data);
        showNotification('✅ Cat updated successfully!', 'success');
        closeModal();
        loadCats();
        fetchTags();
    } catch (err) {
        console.error('❌ Error updating cat:', err);
        showNotification(err.message || '❌ Failed to update cat. Please try again.', 'error');
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

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Cat deleted:", data);
        showNotification('✅ Cat deleted successfully!', 'success');
        loadCats();
        fetchTags();
    } catch (err) {
        console.error('❌ Error deleting cat:', err);
        showNotification(err.message || '❌ Failed to delete cat. Please try again.', 'error');
    }
}

function editCat(id) {
    const cat = catsData.find(c => c.id === id);
    if (!cat) {
        showNotification('Cat not found', 'error');
        return;
    }

    // Check if user can edit this cat
    if (!currentUser || (currentUser.role !== 'admin' && cat.user_id !== currentUser.id)) {
        showNotification('You cannot edit this cat', 'error');
        return;
    }

    editingId = id;

    nameInput.value = cat.name || "";
    tagInput.value = cat.tag || "";
    descriptionInput.value = cat.description || "";
    imgInput.value = cat.IMG || "";

    document.getElementById("addBtn").style.display = "none";
    document.getElementById("editBtn").style.display = "inline-block";

    modal.style.display = "flex";
}

// ============ LOAD CATS ============
async function loadCats() {
    console.log("🐱 Loading cats...");
    showLoading();

    try {
        // If user is logged in, get their cats, otherwise get all cats
        const url = currentUser ? '/my-cats' : '/cats';
        const headers = currentUser ? { "Authorization": `Bearer ${authToken}` } : {};

        const response = await fetch(url, { headers });
        console.log("Load cats response:", response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        catsData = Array.isArray(data) ? data : [];
        console.log(`✅ Loaded ${catsData.length} cats`);

        // Update cat count
        if (catCountElement) {
            catCountElement.textContent = catsData.length;
        }

        hideLoading();
        renderGallery(catsData);
    } catch (err) {
        console.error('❌ Error loading cats:', err);
        hideLoading();

        if (err.message.includes('401') || err.message.includes('Unauthorized')) {
            clearAuth();
            showNotification('Session expired. Please login again.', 'error');
            loadCats(); // Retry loading without auth
        } else {
            showError('Failed to load cats. ' + err.message);
        }
    }
}

// ============ FETCH TAGS ============
async function fetchTags() {
    console.log("🔄 Fetching tags from /tags...");

    try {
        const response = await fetch('/tags');
        console.log("Tags response:", response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const tags = await response.json();
        console.log("📋 Tags received:", tags);
        populateTagFilter(tags);
    } catch (err) {
        console.error('❌ Error fetching tags:', err);
        showErrorInTagFilter();
    }
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
                    <button class="btn-edit" disabled>Edit</button>
                    <button class="btn-delete" disabled>Delete</button>
                `}
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
                    <button class="btn-edit" disabled>Edit</button>
                    <button class="btn-delete" disabled>Delete</button>
                `}
            </div>
        `;
        gallery.appendChild(div);
    });
}

// ============ CONTACT FORM ============
async function handleContact(e) {
    e.preventDefault();
    const form = e.target;

    const formData = {
        name: form.querySelector('#contact-name').value,
        email: form.querySelector('#contact-email').value,
        message: form.querySelector('#contact-message').value
    };

    if (!formData.name || !formData.email || !formData.message) {
        showNotification('Please fill all fields', 'error');
        return;
    }

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

// ============ EVENT LISTENERS SETUP ============
// ============ EVENT LISTENERS SETUP ============
function setupEventListeners() {
    console.log("🔧 Setting up event listeners...");

    // Add Cat Button
    const addCatBtn = document.getElementById("addCatBtn");
    if (addCatBtn) {
        console.log("✅ Found addCatBtn");
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

    // CLOSE MODAL HANDLERS - Add these lines
    const closeLoginBtn = document.querySelector('#login-modal .modal-close');
    if (closeLoginBtn) {
        closeLoginBtn.addEventListener('click', closeLoginModal);
    }

    const closeSignupBtn = document.querySelector('#signup-modal .modal-close');
    if (closeSignupBtn) {
        closeSignupBtn.addEventListener('click', closeSignupModal);
    }

    // Close modal when clicking outside
    window.addEventListener('click', function (event) {
        if (event.target.classList.contains('cyber-modal') || event.target.classList.contains('modal')) {
            closeModal();
            closeLoginModal();
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

    // Contact form submission
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContact);
    }

    // DIRECT BUTTON CLICK HANDLERS - Add these!
    const loginBtn = document.querySelector('.login-btn');
    if (loginBtn) {
        console.log("✅ Found login button");
        loginBtn.addEventListener('click', function (e) {
            e.preventDefault();
            console.log("🔑 Login button clicked");
            showLoginModal();
        });
    } else {
        console.error("❌ Login button NOT FOUND");
    }

    const signupBtn = document.querySelector('.signup-btn');
    if (signupBtn) {
        console.log("✅ Found signup button");
        signupBtn.addEventListener('click', function (e) {
            e.preventDefault();
            console.log("📝 Signup button clicked");
            showSignupModal();
        });
    } else {
        console.error("❌ Signup button NOT FOUND");
    }

    // Navigation
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
                font-family: 'Courier New', monospace;
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

// ============ ADD AUTH STYLES ============
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
                font-size: 0.9em;
            }
            
            .logout-btn {
                background: var(--cyber-dark);
                border: 1px solid var(--neon-red);
                color: var(--neon-red);
                padding: 8px 15px;
                font-size: 0.8em;
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
                transform: none;
            }
            
            .card small {
                display: block;
                margin-top: 5px;
                color: var(--neon-blue);
                font-size: 0.8em;
                font-family: 'Courier New', monospace;
            }
            
            .no-results, .loading, .error {
                text-align: center;
                padding: 40px;
                color: var(--neon-blue);
                font-family: 'Courier New', monospace;
                font-size: 1.2em;
                grid-column: 1 / -1;
            }
            
            .card {
                transition: all 0.3s ease;
            }
            
            .card:hover {
                transform: translateY(-5px);
                box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
            }
        `;
        document.head.appendChild(style);
    }
}

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', function () {
    console.log("📄 DOM loaded, initializing Cat Gallery...");

    // Add auth styles
    addAuthStyles();

    // Check auth state first
    checkAuthState();

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
});

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