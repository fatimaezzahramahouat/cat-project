const API_URL = "http://localhost:5000/cats";
const gallery = document.getElementById("catGallery");
const modal = document.getElementById("catModal");
let editingId = null;
let catsData = [];

// === تعريف inputs ===
const nameInput = document.getElementById("name");
const tagInput = document.getElementById("tag");
const descriptionInput = document.getElementById("description");
const imgInput = document.getElementById("img");

// === Load Cats from API ===
function loadCats() {
    fetch(API_URL)
        .then(res => res.json())
        .then(data => {
            catsData = data;
            renderGallery(catsData);
        });
}
loadCats();

// === Open modal to add new cat ===
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

// === Add Cat (POST) ===
function addCat() {
    const cat = {
        name: nameInput.value,
        tag: tagInput.value,
        description: descriptionInput.value,
        IMG: imgInput.value
    };

    fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cat)
    })
        .then(() => {
            closeModal();
            loadCats();
        });
}

// === Update Cat (PUT) ===
function updateCat() {
    if (editingId === null) return;

    const cat = {
        name: nameInput.value,
        tag: tagInput.value,
        description: descriptionInput.value,
        IMG: imgInput.value
    };

    fetch(`${API_URL}/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cat)
    })
        .then(() => {
            closeModal();
            loadCats();
        });
}

// === Delete Cat ===
function deleteCat(id) {
    if (!confirm("Delete this cat?")) return;

    fetch(`${API_URL}/${id}`, {
        method: "DELETE"
    }).then(() => loadCats());
}

// === Edit Cat ===
function editCat(id) {
    const cat = catsData.find(c => c.id === id);
    if (!cat) return;

    editingId = id;

    nameInput.value = cat.name;
    tagInput.value = cat.tag;
    descriptionInput.value = cat.description;
    imgInput.value = cat.IMG || "";

    document.getElementById("addBtn").style.display = "none";
    document.getElementById("editBtn").style.display = "inline-block";

    modal.style.display = "flex";
}

// === Render Gallery ===
function renderGallery(cats) {
    gallery.innerHTML = "";

    cats.forEach(cat => {
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
            <img src="${cat.IMG}" alt="${cat.name}" />
            <h3>${cat.name}</h3>
            <p>${cat.description}</p>
            <span>${cat.tag}</span>
            <div class="actions">
                <button onclick="editCat(${cat.id})">Edit</button>
                <button onclick="deleteCat(${cat.id})">Delete</button>
            </div>
        `;
        gallery.appendChild(div);
    });
}

// === Save Button ===
function saveCat() {
    if (editingId === null) {
        addCat();
    } else {
        updateCat();
    }
}
const searchInput = document.getElementById("searchInput");

// Event listener لكل مرة كيتبدّل value ديال البحث
searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();

    // فلترة catsData حسب الاسم أو tag أو description
    const filteredCats = catsData.filter(cat =>
        cat.name.toLowerCase().includes(query) ||
        cat.tag.toLowerCase().includes(query) ||
        cat.description.toLowerCase().includes(query)
    );

    renderGallery(filteredCats);
});


// === Close Modal ===
function closeModal() {
    modal.style.display = "none";
    editingId = null;
}

// === Event Listener Add Cat Button ===
document.getElementById("addCatBtn").addEventListener("click", openAddModal);
