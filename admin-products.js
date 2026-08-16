import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const form = document.getElementById("productForm");
const productsDiv = document.getElementById("products");

const imageFile = document.getElementById("imageFile");
const previewRow = document.getElementById("previewRow");

let editMode = false;
let editProductId = null;
let existingImages = [];
imageFile.value = "";
imageFile.addEventListener("change", () => {

    const files = Array.from(imageFile.files);

    if (files.length === 0) {
        renderPreview();
        return;
    }

    previewRow.innerHTML = "";
    files.forEach((file) => {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.width = 90;
        img.style.borderRadius = "10px";
        previewRow.appendChild(img);
    });

});

function renderPreview() {
    previewRow.innerHTML = "";
    existingImages.forEach((url) => {
        const img = document.createElement("img");
        img.src = url;
        img.width = 90;
        img.style.borderRadius = "10px";
        previewRow.appendChild(img);
    });
}

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists() || userDoc.data().isAdmin !== true) {
        alert("Access Denied");
        window.location.href = "home.html";
        return;
    }

    loadProducts();

});

async function uploadImages() {

    const files = Array.from(imageFile.files);

    if (files.length === 0) {

        if (editMode && existingImages.length > 0) {
            return existingImages;
        }

        alert("Select at least one image");
        return null;

    }

    const uploadedUrls = [];

    for (const file of files) {

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "Bestifyimg");

        const response = await fetch(
            "https://api.cloudinary.com/v1_1/rgksliph/image/upload",
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();
        uploadedUrls.push(data.secure_url);

    }

    return uploadedUrls;

}

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const imageUrls = await uploadImages();

    if (!imageUrls || imageUrls.length === 0) return;

    const productData = {

        image: imageUrls[0],
        images: imageUrls,
        productName: document.getElementById("productName").value,
        category: document.getElementById("category").value,
        mrp: document.getElementById("mrp").value ? Number(document.getElementById("mrp").value) : 0,
        price: document.getElementById("price").value,
        stock: Number(document.getElementById("stock").value),
        description: document.getElementById("description").value,
        sizes: document.getElementById("sizes").value
          ? document.getElementById("sizes").value.split(",").map(s => s.trim()).filter(Boolean)
          : [],
        colours: document.getElementById("colours").value
          ? document.getElementById("colours").value.split(",").map(s => s.trim()).filter(Boolean)
          : []

    };

    if (editMode) {

        await updateDoc(
            doc(db, "products", editProductId),
            productData
        );

        alert("Product Updated ✅");

        editMode = false;
        editProductId = null;

        form.querySelector("button").innerText = "Save Product";

    } else {

        await addDoc(
            collection(db, "products"),
            productData
        );

        alert("Product Added ✅");

    }

    form.reset();

    previewRow.innerHTML = "";
    existingImages = [];
    imageFile.value = "";

    loadProducts();

});

// Load Products
async function loadProducts() {

    const querySnapshot = await getDocs(collection(db, "products"));

    productsDiv.innerHTML = "";

    if (querySnapshot.empty) {
        productsDiv.innerHTML = "<h2>No Products Found</h2>";
        return;
    }

    querySnapshot.forEach((docSnap) => {

        const product = docSnap.data();

        productsDiv.innerHTML += `

        <div class="card">

            <img src="${product.image}" alt="${product.productName}">

            <div class="card-content">

                <h3>${product.productName}</h3>

                <p>${product.category}</p>

                <p class="price">${
                    Number(product.mrp) > Number(product.price)
                    ? `<span style="text-decoration:line-through;color:#888;">₹${product.mrp}</span> ₹${product.price} <span style="color:#2F7A4F;font-size:12px;">(Saved ₹${Number(product.mrp) - Number(product.price)})</span>`
                    : `₹${product.price}`
                }</p>

                <p class="stock-badge ${
                    (product.stock ?? 0) === 0 ? "out" :
                    (product.stock ?? 0) <= 5 ? "low" : "in"
                }">
                    ${(product.stock ?? 0) === 0 ? "Out of Stock" : `${product.stock ?? 0} in stock`}
                </p>

                <p>${product.description}</p>

                <button onclick="editProduct('${docSnap.id}')">
                    ✏️ Edit
                </button>

                <br><br>

                <button
                    style="background:red"
                    onclick="deleteProduct('${docSnap.id}')">
                    🗑️ Delete
                </button>

            </div>

        </div>

        `;

    });

}

// Delete Product
window.deleteProduct = async function(id) {

    const ok = confirm("Delete this product?");

    if (!ok) return;

    await deleteDoc(doc(db, "products", id));

    alert("Product Deleted ✅");

    loadProducts();

};

// Edit Product
window.editProduct = async function(id) {

    try {

        const productRef = doc(db, "products", id);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
            alert("Product Not Found");
            return;
        }

        const product = productSnap.data();

        existingImages = product.images && product.images.length ? product.images : (product.image ? [product.image] : []);
        imageFile.value = "";
        renderPreview();

        document.getElementById("productName").value = product.productName;
        document.getElementById("category").value = product.category;
        document.getElementById("mrp").value = product.mrp || "";
        document.getElementById("price").value = product.price;
        document.getElementById("stock").value = product.stock ?? 0;
        document.getElementById("description").value = product.description;
        document.getElementById("sizes").value = (product.sizes || []).join(", ");
        document.getElementById("colours").value = (product.colours || []).join(", ");

        editMode = true;
        editProductId = id;

        form.querySelector("button").innerText = "Update Product";

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    } catch (error) {

        alert(error.message);
        console.log(error);

    }

};
