const API_URL = "http://localhost:5000/cats";
const gallery = document.getElementById("catGallery");
const modal = document.getElementById("catModal");
let editingId = null;
let catsData = [];



fetch(API_URL)
    .then(res => res.json())
    .then(cats => {
        gallery.innerHTML = "";
        cats.forEach(cat => createCard(cat));
    });


function createCard(cat) {
    const card = document.createElement("div");
    card.className = "card";


    card.innerHTML = `
<img src="${cat.IMG}" />
<div class="card-body">
<span class="tag">${cat.tag}</span>
<h3>${cat.name}</h3>
<p>${cat.description}</p>
<div class="card-actions">
<button onclick="editCat(${cat.id})">✏️ Edit</button>

<button class="danger" onclick='deleteCat(${cat.id})'>🗑 Delete</button>
</div>
</div>
`;


    gallery.appendChild(card);
}


function openEdit(id) {
    const cat = catsData.find(c => c.id === id);
    if (!cat) return;

    editingId = cat.id;
    name.value = cat.name;
    tag.value = cat.tag;
    description.value = cat.description;

    // ⚠️ File inputs cannot be pre-filled
    img.value = "";

    modal.style.display = "flex";
}

function closeModal() {
    modal.style.display = "none";
    editingId = null;
}


// Add cat



function deleteCat(id) {
    if (!confirm("Delete this cat?")) return;


    fetch(`${API_URL}/${id}`, {
        method: "DELETE"
    }).then(() => location.reload());

}
function editCat(id) {
    console.log("EDIT CLICKED, ID =", id);
}

// New function to open the modal for adding a cat
function openAddModal() {
    // Clear input fields
    name.value = "";
    tag.value = "";
    description.value = "";
    img.value = "";
    // Reset editing state
    editingId = null;
    // Show modal
    modal.style.display = "flex";
}

// Attach event listener to Add Cat button
document.getElementById('addCatBtn').addEventListener('click', openAddModal);
