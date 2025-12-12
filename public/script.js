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
function addCat() {
    const cat = {
        name: name.value,
        tag: tag.value,
        description: description.value,
        img: img.value
    };


    fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cat)
    })
        .then(() => location.reload());
}


function deleteCat(id) {
    if (!confirm("Delete this cat?")) return;


    fetch(`${API_URL}/${id}`, {
        method: "DELETE"
    }).then(() => location.reload());

} function editCat(id) {
    console.log("EDIT CLICKED, ID =", id);
}
