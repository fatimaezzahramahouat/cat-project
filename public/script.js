// ============ API CONFIGURATION ============
// Use relative URL for your Cloudflare Worker
const API_URL = "/cats";  // Changed from http://localhost:5000/cats
const API_BASE = ""; // Same origin

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


// Contact form submission
document.querySelector('.contact-form').addEventListener('submit', function (e) {
    e.preventDefault();
    alert('Message sent securely!');
    this.reset();
});






//REGISTER
const registerModal = document.getElementById("registerModal");
const openRegisterBtn = document.getElementById("openRegister");
const closeRegisterBtn = document.getElementById("closeRegister");

openRegisterBtn.onclick = () => registerModal.style.display = "flex";
closeRegisterBtn.onclick = () => registerModal.style.display = "none";
window.onclick = (e) => { if (e.target === registerModal) registerModal.style.display = "none"; };

// Handle form submission
const form = document.getElementById("registerForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault(); 

  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("https://cat-project.fatimaezzahramahouat.workers.dev/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json();
    alert(data.message);

    if (res.ok) {
      registerModal.style.display = "none"; // close modal
      form.reset(); // clear form
    }

  } catch (err) {
    console.error("Register error:", err);
    alert("Something went wrong.");
  }
});


//login

// Login modal open/close
const loginModal = document.getElementById("loginModal");
const openLoginBtn = document.getElementById("openlogin");
const closeLoginBtn = document.getElementById("closeLogin");

openLoginBtn.onclick = () => loginModal.style.display = "flex";
closeLoginBtn.onclick = () => loginModal.style.display = "none";
window.onclick = (e) => { if (e.target === loginModal) loginModal.style.display = "none"; };

// Handle login form
const loginForm = document.getElementById("loginForm");
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    const res = await fetch("https://cat-project.fatimaezzahramahouat.workers.dev/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    alert(data.message);

    if (res.ok) {
      loginModal.style.display = "none";
      loginForm.reset();
      console.log("Logged in user:", data.user);
    }

  } catch (err) {
    console.error("Login error:", err);
    alert("Something went wrong.");
  }
});


//dashboard modal
// ============ DASHBOARD COMPLETE CODE ============

// User Management
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let userCats = JSON.parse(localStorage.getItem('userCats')) || {};

// 1. Update Navigation
function updateNavigation() {
    const userLinks = document.getElementById('userLinks');
    const userGreeting = document.getElementById('userGreeting');
    const registerLink = document.getElementById('openRegister');
    const loginLink = document.getElementById('openlogin');
    
    if (currentUser) {
        // Show user links
        if (userLinks) userLinks.style.display = 'block';
        if (userGreeting) userGreeting.textContent = `Hi, ${currentUser.username}!`;
        
        // Hide auth links
        if (registerLink) registerLink.parentElement.style.display = 'none';
        if (loginLink) loginLink.parentElement.style.display = 'none';
    } else {
        // Hide user links
        if (userLinks) userLinks.style.display = 'none';
        
        // Show auth links
        if (registerLink) registerLink.parentElement.style.display = 'block';
        if (loginLink) loginLink.parentElement.style.display = 'block';
    }
}

// 2. Show Dashboard
function showDashboard() {
    if (!currentUser) {
        alert('Please login to access dashboard!');
        document.getElementById('openlogin').click();
        return;
    }
    
    // Hide all sections
    document.querySelectorAll('.cyber-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show dashboard
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.style.display = 'block';
        updateDashboard();
    }
}

// 3. Update Dashboard
function updateDashboard() {
    if (!currentUser) return;
    
    // Update username
    const usernameElement = document.getElementById('dashboardUsername');
    if (usernameElement) {
        usernameElement.textContent = currentUser.username;
    }
    
    // Load user's cats
    loadUserCats();
}

// 4. Load User Cats
function loadUserCats() {
    const userCatsGallery = document.getElementById('userCatsGallery');
    const noCatsMessage = document.getElementById('noCatsMessage');
    
    if (!userCatsGallery) return;
    
    // Get cats from localStorage first
    const userCatsList = userCats[currentUser.id] || [];
    
    if (userCatsList.length === 0) {
        if (noCatsMessage) noCatsMessage.style.display = 'block';
        userCatsGallery.innerHTML = '';
        return;
    }
    
    if (noCatsMessage) noCatsMessage.style.display = 'none';
    
    // Display cats
    displayFilteredCats(userCatsList);
    
    // Then fetch from API for updates
    fetch(API_URL)
        .then(res => res.json())
        .then(allCats => {
            const userCatIds = userCatsList.map(cat => cat.id);
            const updatedCats = allCats.filter(cat => userCatIds.includes(cat.id));
            
            if (updatedCats.length > 0) {
                userCats[currentUser.id] = updatedCats;
                localStorage.setItem('userCats', JSON.stringify(userCats));
                displayFilteredCats(updatedCats);
            }
        })
        .catch(err => console.log('Using local cats'));
}

// 5. Display Filtered Cats
function displayFilteredCats(cats) {
    const userCatsGallery = document.getElementById('userCatsGallery');
    const dashboardSearch = document.getElementById('dashboardSearchInput');
    const dashboardTagFilter = document.getElementById('dashboardTagFilter');
    
    if (!userCatsGallery) return;
    
    // Apply filters
    let filteredCats = [...cats];
    
    // Search filter
    if (dashboardSearch && dashboardSearch.value) {
        const query = dashboardSearch.value.toLowerCase();
        filteredCats = filteredCats.filter(cat => 
            (cat.name && cat.name.toLowerCase().includes(query)) ||
            (cat.tag && cat.tag.toLowerCase().includes(query)) ||
            (cat.description && cat.description.toLowerCase().includes(query))
        );
    }
    
    // Tag filter
    if (dashboardTagFilter && dashboardTagFilter.value) {
        const tag = dashboardTagFilter.value.toLowerCase();
        filteredCats = filteredCats.filter(cat => 
            cat.tag && cat.tag.toLowerCase() === tag
        );
    }
    
    // Update tag dropdown
    updateTagDropdown(cats);
    
    // Clear and display
    userCatsGallery.innerHTML = '';
    
    if (filteredCats.length === 0) {
        userCatsGallery.innerHTML = '<div class="no-results">No cats found</div>';
        return;
    }
    
    filteredCats.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            ${cat.IMG ? `<img src="${cat.IMG}" alt="${cat.name}" loading="lazy" />` : '<div class="no-image">No Image</div>'}
            <h3>${escapeHTML(cat.name) || 'Unnamed Cat'}</h3>
            <p>${escapeHTML(cat.description) || 'No description'}</p>
            <span class="tag-badge">${escapeHTML(cat.tag) || 'No tag'}</span>
            <div class="actions">
                <button onclick="editUserCat(${cat.id})" class="btn-edit">Edit</button>
                <button onclick="deleteUserCat(${cat.id})" class="btn-delete">Delete</button>
            </div>
        `;
        userCatsGallery.appendChild(card);
    });
}

// 6. Update Tag Dropdown
function updateTagDropdown(cats) {
    const tagFilter = document.getElementById('dashboardTagFilter');
    if (!tagFilter) return;
    
    const tags = [...new Set(cats
        .filter(cat => cat.tag && cat.tag.trim())
        .map(cat => cat.tag.trim().toLowerCase())
    )].sort();
    
    const currentValue = tagFilter.value;
    
    tagFilter.innerHTML = '<option value="">ALL TAGS</option>';
    tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
        tagFilter.appendChild(option);
    });
    
    if (currentValue && tags.includes(currentValue.toLowerCase())) {
        tagFilter.value = currentValue;
    }
}

// 7. Edit User Cat
function editUserCat(catId) {
    console.log("Editing cat:", catId);
    
    // Find cat
    let cat = null;
    
    // Check user's collection
    if (currentUser && userCats[currentUser.id]) {
        cat = userCats[currentUser.id].find(c => c.id == catId);
    }
    
    // Check global data
    if (!cat) {
        cat = catsData.find(c => c.id == catId);
    }
    
    if (!cat) {
        alert('Cat not found!');
        return;
    }
    
    // Fill modal
    editingId = catId;
    document.getElementById('name').value = cat.name || '';
    document.getElementById('tag').value = cat.tag || '';
    document.getElementById('description').value = cat.description || '';
    document.getElementById('img').value = cat.IMG || '';
    
    // Show edit button
    document.getElementById('addBtn').style.display = 'none';
    document.getElementById('editBtn').style.display = 'inline-block';
    
    // Show modal
    modal.style.display = 'flex';
}

// 8. Delete User Cat
function deleteUserCat(catId) {
    if (!confirm('Delete this cat?')) return;
    
    fetch(`${API_URL}/${catId}`, {
        method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
        // Remove from user collection
        if (currentUser && userCats[currentUser.id]) {
            userCats[currentUser.id] = userCats[currentUser.id].filter(c => c.id != catId);
            localStorage.setItem('userCats', JSON.stringify(userCats));
        }
        
        // Remove from global data
        catsData = catsData.filter(c => c.id != catId);
        
        // Refresh
        if (window.location.hash === '#dashboard') {
            loadUserCats();
        } else {
            loadCats();
        }
        
        fetchTags();
        
        alert('Cat deleted!');
    })
    .catch(err => {
        console.error('Delete error:', err);
        alert('Error deleting cat');
    });
}

// 9. Update User Cat
function updateUserCat() {
    if (!editingId) {
        alert('No cat selected!');
        return;
    }
    
    const cat = {
        name: document.getElementById('name').value,
        tag: document.getElementById('tag').value,
        description: document.getElementById('description').value,
        IMG: document.getElementById('img').value
    };
    
    if (!cat.name) {
        alert('Please enter a name');
        return;
    }
    
    fetch(`${API_URL}/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cat)
    })
    .then(res => res.json())
    .then(data => {
        // Update user collection
        if (currentUser && userCats[currentUser.id]) {
            const index = userCats[currentUser.id].findIndex(c => c.id == editingId);
            if (index !== -1) {
                userCats[currentUser.id][index] = { ...userCats[currentUser.id][index], ...cat };
                localStorage.setItem('userCats', JSON.stringify(userCats));
            }
        }
        
        // Update global data
        const globalIndex = catsData.findIndex(c => c.id == editingId);
        if (globalIndex !== -1) {
            catsData[globalIndex] = { ...catsData[globalIndex], ...cat };
        }
        
        closeModal();
        
        // Refresh
        if (window.location.hash === '#dashboard') {
            loadUserCats();
        } else {
            loadCats();
        }
        
        fetchTags();
        
        alert('Cat updated!');
    })
    .catch(err => {
        console.error('Update error:', err);
        alert('Error updating cat');
    });
}

// 10. Add Cat (Dashboard version)
function addCatDashboard() {
    const name = document.getElementById('name').value;
    const tag = document.getElementById('tag').value;
    const description = document.getElementById('description').value;
    const img = document.getElementById('img').value;
    
    if (!name || !img) {
        alert('Please enter name and image URL');
        return;
    }
    
    const cat = {
        name: name,
        tag: tag,
        description: description,
        IMG: img
    };
    
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cat)
    })
    .then(res => res.json())
    .then(data => {
        // Add to user collection
        const newCat = { ...cat, id: data.id };
        if (!userCats[currentUser.id]) {
            userCats[currentUser.id] = [];
        }
        userCats[currentUser.id].push(newCat);
        localStorage.setItem('userCats', JSON.stringify(userCats));
        
        // Add to global data
        catsData.push(newCat);
        
        closeModal();
        loadUserCats();
        fetchTags();
        
        alert('Cat added!');
    })
    .catch(err => {
        console.error('Add error:', err);
        alert('Error adding cat');
    });
}

// 11. Handle Login Success
function handleLoginSuccess(userData) {
    currentUser = userData.user;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Update nav
    updateNavigation();
    
    // Close login modal
    loginModal.style.display = 'none';
    document.getElementById('loginForm').reset();
    
    // Show dashboard
    showDashboard();
    
    alert(`Welcome ${currentUser.username}!`);
}

// 12. Logout
function logoutUser() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    
    updateNavigation();
    
    // Show home
    document.querySelectorAll('.cyber-section').forEach(s => s.style.display = 'none');
    document.getElementById('home').style.display = 'block';
    
    alert('Logged out!');
}

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', function() {
    // Update nav
    updateNavigation();
    
    // Setup dashboard link
    document.querySelectorAll('a[href="#dashboard"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            showDashboard();
        });
    });
    
    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logoutUser();
        });
    }
    
    // Override add cat function for dashboard
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
        // Save original
        const originalAddCat = addBtn.onclick;
        
        // Check if we're in dashboard
        addBtn.onclick = function() {
            const dashboard = document.getElementById('dashboard');
            if (dashboard && dashboard.style.display !== 'none') {
                // In dashboard, use dashboard version
                addCatDashboard();
            } else {
                // In home, use original
                if (typeof originalAddCat === 'function') {
                    originalAddCat();
                } else {
                    addCat();
                }
            }
        };
    }
    
    // Override edit button for dashboard
    const editBtn = document.getElementById('editBtn');
    if (editBtn) {
        editBtn.onclick = updateUserCat;
    }
    
    // Override login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            fetch('https://cat-project.fatimaezzahramahouat.workers.dev/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    handleLoginSuccess(data);
                } else {
                    alert(data.message || 'Login failed');
                }
            })
            .catch(err => {
                console.error('Login error:', err);
                alert('Login error');
            });
        });
    }
    
    // Setup dashboard search
    const dashboardSearch = document.getElementById('dashboardSearchInput');
    if (dashboardSearch) {
        dashboardSearch.addEventListener('input', function() {
            loadUserCats();
        });
    }
    
    // Setup dashboard tag filter
    const dashboardTagFilter = document.getElementById('dashboardTagFilter');
    if (dashboardTagFilter) {
        dashboardTagFilter.addEventListener('change', function() {
            loadUserCats();
        });
    }
    
    // Setup dashboard add button
    const addUserCatBtn = document.getElementById('addUserCatBtn');
    if (addUserCatBtn) {
        addUserCatBtn.addEventListener('click', function() {
            openAddModal();
        });
    }
});

// Make functions global
window.editUserCat = editUserCat;
window.deleteUserCat = deleteUserCat;
window.updateUserCat = updateUserCat;
window.showDashboard = showDashboard;
window.logoutUser = logoutUser;








// Close all modals
function closeAllModals() {
    closeModal();

}


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