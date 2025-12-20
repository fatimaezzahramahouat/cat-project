// ============ API CONFIGURATION ============
const API_URL = "/cats";
let currentUser = null;
let authToken = null;
let editingId = null;
let catsData = [];
let currentPage = 1;
const itemsPerPage = 8;

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
const addCatBtn = document.getElementById("addCatBtn");

// ============ AUTH STATE MANAGEMENT ============
function checkAuthState() {
    const savedUser = localStorage.getItem('currentUser');
    const savedToken = localStorage.getItem('authToken');

    if (savedUser && savedToken) {
        try {
            currentUser = JSON.parse(savedUser);
            authToken = savedToken;
            updateAuthUI();
            showDashboard();
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
    hideDashboard();
    loadCats(); // Reload public cats
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
                <button class="cyber-btn logout-btn">
                    <i class="fas fa-sign-out-alt"></i> LOGOUT
                </button>
            </div>
        `;

        // Show add cat button
        if (addCatBtn) {
            addCatBtn.style.display = "inline-block";
        }

        // Add dashboard to navigation
        addDashboardToNav();

    } else {
        authDiv.innerHTML = `
            <button class="cyber-btn login-btn">
                <i class="fas fa-sign-in-alt"></i> LOGIN
            </button>
            <button class="cyber-btn signup-btn">
                <i class="fas fa-user-plus"></i> SIGN UP
            </button>
        `;

        // Hide add cat button
        if (addCatBtn) {
            addCatBtn.style.display = "none";
        }

        // Remove dashboard from navigation
        removeDashboardFromNav();
    }
}

function addDashboardToNav() {
    const navLinks = document.querySelector('.cyber-nav-links');
    if (!navLinks) return;

    // Check if dashboard link already exists
    if (document.querySelector('a[href="#dashboard"]')) return;

    // Create dashboard link
    const dashboardLi = document.createElement('li');
    dashboardLi.innerHTML = `
        <a href="#dashboard" class="cyber-nav-link">
            <i class="fas fa-tachometer-alt"></i> DASHBOARD
        </a>
    `;

    // Add it after Contact link
    navLinks.appendChild(dashboardLi);

    // Add click event
    dashboardLi.querySelector('a').addEventListener('click', function (e) {
        e.preventDefault();
        navigateToDashboard();
    });
}

function removeDashboardFromNav() {
    const dashboardLink = document.querySelector('a[href="#dashboard"]');
    if (dashboardLink && dashboardLink.parentElement) {
        dashboardLink.parentElement.remove();
    }
}

// ============ DASHBOARD FUNCTIONS ============
function showDashboard() {
    if (!currentUser) return;

    // Hide all sections
    document.querySelectorAll('.cyber-section').forEach(section => {
        section.style.display = 'none';
    });

    // Show dashboard
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.style.display = 'block';
        dashboard.classList.add('active');

        // Update dashboard info
        updateDashboardInfo();

        // Load user's cats
        loadMyCats();

        // Load public cats preview
        loadPublicCatsPreview();
    }
}

function hideDashboard() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.style.display = 'none';
        dashboard.classList.remove('active');
    }

    // Show home section
    const home = document.getElementById('home');
    if (home) {
        home.style.display = 'block';
        home.classList.add('active');
    }
}

function navigateToDashboard() {
    if (!currentUser) {
        showNotification('Please login to access dashboard', 'error');
        showLoginModal();
        return;
    }

    showDashboard();
    updateNavigation('dashboard');
}

function navigateToHome() {
    hideDashboard();

    const home = document.getElementById('home');
    if (home) {
        home.style.display = 'block';
        home.classList.add('active');
        updateNavigation('home');
        loadCats();
    }
}

function updateDashboardInfo() {
    if (!currentUser) return;

    const usernameSpan = document.getElementById('dashboard-username');
    const memberSinceSpan = document.getElementById('member-since');
    const userRoleSpan = document.getElementById('user-role');

    if (usernameSpan) usernameSpan.textContent = currentUser.username;
    if (userRoleSpan) userRoleSpan.textContent = currentUser.role || 'User';

    if (memberSinceSpan) {
        if (currentUser.created_at) {
            const date = new Date(currentUser.created_at);
            memberSinceSpan.textContent = date.toLocaleDateString();
        } else {
            memberSinceSpan.textContent = 'Today';
        }
    }
}

async function loadMyCats() {
    if (!currentUser) return;

    const myCatsContainer = document.getElementById('myCatsContainer');
    const myCatCount = document.getElementById('my-cat-count');

    if (!myCatsContainer) return;

    try {
        const response = await fetch('/my-cats', {
            headers: { "Authorization": `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load your cats');

        const myCats = await response.json();

        // Update count
        if (myCatCount) {
            myCatCount.textContent = myCats.length;
        }

        // Display user's cats
        if (myCats.length === 0) {
            myCatsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-cat fa-3x"></i>
                    <h3>No cats yet!</h3>
                    <p>You haven't added any cats to your collection.</p>
                    <button class="cyber-btn primary" onclick="openAddModal()">
                        <i class="fas fa-plus"></i> ADD YOUR FIRST CAT
                    </button>
                </div>
            `;
        } else {
            myCatsContainer.innerHTML = myCats.map(cat => `
                <div class="my-cat-card">
                    ${cat.IMG ? `<img src="${cat.IMG}" alt="${cat.name}" class="cat-thumb">` : '<div class="no-image">No Image</div>'}
                    <div class="cat-info">
                        <h4>${escapeHTML(cat.name)}</h4>
                        <span class="cat-tag">${escapeHTML(cat.tag) || 'No tag'}</span>
                        <div class="cat-actions">
                            <button class="btn-small" onclick="editCat(${cat.id})">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn-small delete" onclick="deleteCat(${cat.id})">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading user cats:', error);
        myCatsContainer.innerHTML = '<div class="error">Error loading your cats</div>';
    }
}

async function loadPublicCatsPreview() {
    const publicCatsPreview = document.getElementById('publicCatsPreview');
    if (!publicCatsPreview) return;

    try {
        const response = await fetch('/cats');
        if (!response.ok) throw new Error('Failed to load public cats');

        const publicCats = await response.json();

        // Show only first 4 cats for preview
        const previewCats = publicCats.slice(0, 4);

        publicCatsPreview.innerHTML = previewCats.map(cat => `
            <div class="preview-card">
                ${cat.IMG ? `<img src="${cat.IMG}" alt="${cat.name}">` : '<div class="no-image">No Image</div>'}
                <h4>${escapeHTML(cat.name)}</h4>
                <span class="preview-tag">${escapeHTML(cat.tag) || 'No tag'}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading public cats preview:', error);
        publicCatsPreview.innerHTML = '<div class="error">Error loading cats</div>';
    }
}

// ============ AUTH FUNCTIONS ============
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showNotification('Please enter email and password', 'error');
        return;
    }

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
            showDashboard();
            loadMyCats();
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
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

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
            showDashboard();
            loadMyCats();
        } else {
            showNotification(data.error || 'Signup failed', 'error');
        }
    } catch (error) {
        showNotification('Error during signup', 'error');
        console.error('Signup error:', error);
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        clearAuth();
        showNotification('Logged out successfully', 'info');
        navigateToHome();
    }
}

// ============ MODAL FUNCTIONS ============
function showLoginModal() {
    closeAllModals();
    document.getElementById('login-modal').style.display = 'flex';
}

function showSignupModal() {
    closeAllModals();
    document.getElementById('signup-modal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('login-form').reset();
}

function closeSignupModal() {
    document.getElementById('signup-modal').style.display = 'none';
    document.getElementById('signup-form').reset();
}

function openAddModal() {
    if (!currentUser) {
        showNotification('Please login to add a cat', 'warning');
        showLoginModal();
        return;
    }

    editingId = null;
    nameInput.value = "";
    tagInput.value = "";
    descriptionInput.value = "";
    imgInput.value = "";

    document.getElementById("modal-title").textContent = "ADD NEW CAT";
    document.getElementById("addBtn").style.display = "inline-block";
    document.getElementById("editBtn").style.display = "none";

    modal.style.display = "flex";
}

function closeModal() {
    modal.style.display = "none";
    editingId = null;
}

function closeAllModals() {
    closeModal();
    closeLoginModal();
    closeSignupModal();
}

// ============ CAT FUNCTIONS ============
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
        showNotification('✅ Cat added successfully!', 'success');
        closeModal();

        // Refresh data
        if (document.getElementById('dashboard').style.display === 'block') {
            loadMyCats();
        } else {
            loadCats();
        }
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

        showNotification('✅ Cat updated successfully!', 'success');
        closeModal();

        // Refresh data
        if (document.getElementById('dashboard').style.display === 'block') {
            loadMyCats();
        } else {
            loadCats();
        }
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

        showNotification('✅ Cat deleted successfully!', 'success');

        // Refresh data
        if (document.getElementById('dashboard').style.display === 'block') {
            loadMyCats();
        } else {
            loadCats();
        }
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

    document.getElementById("modal-title").textContent = "EDIT CAT";
    document.getElementById("addBtn").style.display = "none";
    document.getElementById("editBtn").style.display = "inline-block";

    modal.style.display = "flex";
}

// ============ LOAD CATS ============
async function loadCats() {
    console.log("🐱 Loading cats...");
    showLoading();

    try {
        const response = await fetch('/cats');
        console.log("Load cats response:", response.status);

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
        showError('Failed to load cats. ' + err.message);
    }
}

// ============ FETCH TAGS ============
async function fetchTags() {
    try {
        const response = await fetch('/tags');
        if (!response.ok) throw new Error('Failed to fetch tags');

        const tags = await response.json();
        populateTagFilter(tags);
    } catch (err) {
        console.error('❌ Error fetching tags:', err);
        showErrorInTagFilter();
    }
}

function populateTagFilter(tags) {
    const tagFilter = document.getElementById('tag-filter');
    if (!tagFilter) return;

    // Save current selection
    const currentSelection = tagFilter.value;

    // Clear and add default option
    tagFilter.innerHTML = '<option value="">All tags</option>';

    if (Array.isArray(tags) && tags.length > 0) {
        const validTags = tags
            .filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0)
            .sort((a, b) => a.localeCompare(b));

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
    }
}

function showErrorInTagFilter() {
    const tagFilter = document.getElementById('tag-filter');
    if (tagFilter) {
        tagFilter.innerHTML = '<option value="">Error loading tags</option>';
    }
}

// ============ FILTER & SEARCH ============
function filterCatsByTag(tag) {
    let filteredCats = catsData;

    if (tag && tag !== "") {
        filteredCats = catsData.filter(cat => {
            const catTag = cat.tag ? cat.tag.trim().toLowerCase() : '';
            return catTag === tag.toLowerCase();
        });
    }

    renderGallery(filteredCats);
}

function setupSearch() {
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.toLowerCase();
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
    if (!gallery) return;

    gallery.innerHTML = "";

    if (!cats || cats.length === 0) {
        gallery.innerHTML = '<div class="no-results">No cats found</div>';
        renderPagination(cats.length);
        return;
    }

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
function setupEventListeners() {
    console.log("🔧 Setting up event listeners...");

    // Add Cat Button
    if (addCatBtn) {
        addCatBtn.addEventListener("click", openAddModal);
    }

    // Tag Filter
    if (tagFilter) {
        tagFilter.addEventListener('change', function () {
            filterCatsByTag(this.value);
        });
    }

    // Search
    setupSearch();

    // Close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Close modal on outside click
    window.addEventListener('click', function (event) {
        if (event.target.classList.contains('cyber-modal') ||
            event.target.classList.contains('modal')) {
            closeAllModals();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeAllModals();
        }
    });

    // Contact form
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContact);
    }

    // Auth forms
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    // Auth buttons
    document.addEventListener('click', function (e) {
        if (e.target.closest('.login-btn')) {
            e.preventDefault();
            showLoginModal();
        }
        if (e.target.closest('.signup-btn')) {
            e.preventDefault();
            showSignupModal();
        }
        if (e.target.closest('.logout-btn')) {
            e.preventDefault();
            logout();
        }
    });

    // Cat modal buttons
    document.getElementById('addBtn').addEventListener('click', addCat);
    document.getElementById('editBtn').addEventListener('click', updateCat);
    document.querySelector('#catModal .cancel').addEventListener('click', closeModal);

    // Switch between login/signup modals
    document.querySelectorAll('.switch-to-signup').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            closeLoginModal();
            showSignupModal();
        });
    });

    document.querySelectorAll('.switch-to-login').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            closeSignupModal();
            showLoginModal();
        });
    });

    // Navigation
    document.querySelectorAll('.cyber-nav-link').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            navigateToSection(targetId);
        });
    });
}

function navigateToSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.cyber-section').forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });

    // Show target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');

        // Update navigation links
        document.querySelectorAll('.cyber-nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${sectionId}`) {
                link.classList.add('active');
            }
        });

        // Special handling for home section
        if (sectionId === 'home') {
            loadCats();
        }
    }
}

function updateNavigation(activeSection) {
    document.querySelectorAll('.cyber-nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${activeSection}`) {
            link.classList.add('active');
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
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;

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

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', function () {
    console.log("📄 DOM loaded, initializing Cat Gallery...");

    // Check auth state
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
window.loadMyCats = loadMyCats;
window.navigateToHome = navigateToHome;
window.navigateToDashboard = navigateToDashboard;

console.log("🐱 Cat Gallery Script Loaded");