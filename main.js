const scriptURL = "https://script.google.com/macros/s/AKfycbwxP_vLG1PXl4l4_eKi_DTdK1duFwQiscXDDNqkFVcpdIuR_x212lHUp2rQJahWJKRS/exec";

// Load menu from Google Sheet
async function loadMenu() {
  const res = await fetch(scriptURL + "?type=menu");
  const data = await res.json();
  const menuContainer = document.getElementById("menu-items");

  data.forEach(item => {
    const div = document.createElement("div");
    div.className = "menu-item";
    div.innerHTML = `
      <h3>${item.Item}</h3>
      <p class="price">R${item.Price}</p>
      <button onclick="addToCart('${item.Item}', ${item.Price})">Add</button>
    `;
    menuContainer.appendChild(div);
  });
}

// Add item to localStorage cart
function addToCart(item, price) {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart.push({ item, price });
  localStorage.setItem("cart", JSON.stringify(cart));
  alert(`${item} added to cart`);
}

// Load checkout summary
function loadCheckout() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const list = document.getElementById("order-list");
  const totalElem = document.getElementById("order-total");
  let total = 0;

  cart.forEach(entry => {
    const li = document.createElement("li");
    li.textContent = `${entry.item} — R${entry.price}`;
    list.appendChild(li);
    total += entry.price;
  });
  totalElem.textContent = `R${total}`;
  loadAddresses();
}

// Load delivery addresses from Sheet
async function loadAddresses() {
  const res = await fetch(scriptURL + "?type=addresses");
  const data = await res.json();
  const dropdown = document.getElementById("delivery-address");

  data.forEach(row => {
    const opt = document.createElement("option");
    opt.value = row.Address;
    opt.textContent = row.Address;
    dropdown.appendChild(opt);
  });
}

// Submit order to Google Sheet
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("menu-items")) loadMenu();
  if (document.getElementById("order-list")) loadCheckout();

  const form = document.getElementById("checkout-form");
  if (form) {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const order = {
        name: document.getElementById("customer-name").value,
        phone: document.getElementById("customer-phone").value,
        address: document.getElementById("delivery-address").value,
        tip: document.getElementById("tip").value || "0",
        notes: document.getElementById("notes").value || "",
        cart: JSON.parse(localStorage.getItem("cart")),
      };

      const res = await fetch(scriptURL, {
        method: "POST",
        body: JSON.stringify(order),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        localStorage.removeItem("cart");
        window.location.href = "thankyou.html";
      } else {
        alert("Something went wrong. Please try again.");
      }
    });
  }
});
