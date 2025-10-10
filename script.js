/* script.js
 - Uses your Apps Script endpoint (action=products / action=addresses)
 - Manages cart in localStorage
 - Sends POST order payload to Apps Script
 - Yoco placeholder ready
*/

// ---------- CONFIG ----------
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwxP_vLG1PXl4l4_eKi_DTdK1duFwQiscXDDNqkFVcpdIuR_x212lHUp2rQJahWJKRS/exec";
const YOCO_PUBLIC_KEY = "pk_test_your_public_key_here"; // replace when ready

// state
let products = [];
let cart = []; // { itemName, flavour, qty, price }
let addresses = [];

// ---------- Utilities ----------
function formatR(v) { return Number(v || 0).toFixed(2); }
function saveCart() { localStorage.setItem("stellies_cart", JSON.stringify(cart)); }
function loadCart() { cart = JSON.parse(localStorage.getItem("stellies_cart") || "[]"); }
function genOrderNumber() {
  let count = Number(localStorage.getItem("stellies_order_count") || 0);
  count++; localStorage.setItem("stellies_order_count", count);
  return "SDP-" + String(count).padStart(4, "0");
}

// ---------- Fetch products & addresses ----------
async function fetchProducts() {
  const res = await fetch(APPS_SCRIPT_URL + "?action=products");
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Failed to load products");
  products = json.products;
  return products;
}
async function fetchAddresses() {
  const res = await fetch(APPS_SCRIPT_URL + "?action=addresses");
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Failed to load addresses");
  addresses = json.addresses;
  return addresses;
}

// ---------- Render product list on index.html ----------
async function renderProducts() {
  const container = document.getElementById("productList");
  if (!container) return;
  container.innerHTML = "<div class='small'>Loading items…</div>";

  try {
    await fetchProducts();
    container.innerHTML = "";
    products.forEach((p, idx) => {
      const div = document.createElement("div");
      div.className = "product";
      div.innerHTML = `
        <div class="checkbox"><input type="checkbox" id="p${idx}" data-idx="${idx}" /></div>
        <div class="name">${p.item}</div>
        <div class="controls">
          ${p.hasFlavours ? `<select id="flavour-${idx}"><option value="">Choose</option>${p.flavours.map(f=>`<option>${f}</option>`).join('')}</select>` : `<span class="small">No flavour</span>`}
          <input id="qty-${idx}" type="number" min="1" value="1" />
          <div style="min-width:70px; text-align:right; font-weight:700;">R ${formatR(p.price)}</div>
        </div>
      `;
      container.appendChild(div);

      const checkbox = div.querySelector(`#p${idx}`);
      const qtyInput = div.querySelector(`#qty-${idx}`);
      const flavourSelect = div.querySelector(`#flavour-${idx}`);

      // restore existing if in cart
      checkbox.addEventListener("change", () => {
        const product = products[idx];
        if (checkbox.checked) {
          const item = {
            itemName: product.item,
            flavour: flavourSelect ? flavourSelect.value : "",
            qty: Number(qtyInput.value) || 1,
            price: Number(product.price) || 0
          };
          // replace if exists
          cart = cart.filter(c => c.itemName !== item.itemName);
          cart.push(item);
        } else {
          cart = cart.filter(c => c.itemName !== product.item);
        }
        saveCart();
        updateTotalUI();
      });

      qtyInput.addEventListener("input", () => {
        if (checkbox.checked) {
          cart = cart.map(c => c.itemName === products[idx].item ? {...c, qty: Number(qtyInput.value) || 1} : c);
          saveCart(); updateTotalUI();
        }
      });

      if (flavourSelect) {
        flavourSelect.addEventListener("change", () => {
          if (checkbox.checked) {
            cart = cart.map(c => c.itemName === products[idx].item ? {...c, flavour: flavourSelect.value} : c);
            saveCart();
          }
        });
      }
    });

    // restore UI from cart
    restoreCartUI();
    updateTotalUI();
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="small" style="color:#c22">Could not load products. Check Apps Script URL and deployments.</div>`;
  }
}

// restore checkboxes/values from cart
function restoreCartUI(){
  loadCart();
  cart.forEach(item => {
    const idx = products.findIndex(p => p.item === item.itemName);
    if (idx >= 0) {
      const cb = document.getElementById(`p${idx}`);
      const q = document.getElementById(`qty-${idx}`);
      const f = document.getElementById(`flavour-${idx}`);
      if (cb) cb.checked = true;
      if (q) q.value = item.qty;
      if (f && item.flavour) f.value = item.flavour;
    }
  });
}

// ---------- Totals ----------
function updateTotalUI() {
  const totalEl = document.getElementById("total");
  const sum = cart.reduce((acc,c)=> acc + (Number(c.price) * Number(c.qty)), 0);
  if (totalEl) totalEl.textContent = formatR(sum);
}

// ---------- Finish button behavior ----------
document.addEventListener("click", function(e){
  if (e.target && e.target.id === "finishBtn") {
    loadCart();
    if (cart.length === 0) { alert("Please select at least one item."); return; }
    const orderNumber = genOrderNumber();
    const subtotal = cart.reduce((a,c)=> a + (c.price*c.qty), 0);
    localStorage.setItem("orderNumber", orderNumber);
    localStorage.setItem("orderList", JSON.stringify(cart));
    localStorage.setItem("orderSubtotal", formatR(subtotal));
    window.location.href = "checkout.html";
  } else if (e.target && e.target.id === "refreshProducts") {
    renderProducts();
  } else if (e.target && e.target.id === "editButton") {
    window.location.href = "index.html";
  }
});

// ---------- Checkout page init ----------
async function checkoutInit(){
  loadCart();
  const orderNumber = localStorage.getItem("orderNumber") || genOrderNumber();
  const orderList = JSON.parse(localStorage.getItem("orderList") || "[]");
  const subtotal = Number(localStorage.getItem("orderSubtotal") || orderList.reduce((a,c)=> a + c.price*c.qty, 0));

  const orderNumEl = document.getElementById("orderNumber");
  if (orderNumEl) orderNumEl.textContent = orderNumber;

  const orderTable = document.getElementById("orderTable");
  if (orderTable) {
    orderTable.innerHTML = "";
    orderList.forEach(i => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${i.itemName}</td><td>${i.flavour || "-"}</td><td>${i.qty}</td><td>${formatR(i.price * i.qty)}</td>`;
      orderTable.appendChild(row);
    });
  }
  const orderSubtotalEl = document.getElementById("orderSubtotal");
  if (orderSubtotalEl) orderSubtotalEl.textContent = formatR(subtotal);

  // load addresses
  try {
    const res = await fetch(APPS_SCRIPT_URL + "?action=addresses");
    const json = await res.json();
    if (json.success) {
      addresses = json.addresses;
      const sel = document.getElementById("delivery");
      sel.innerHTML = "";
      addresses.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a;
        opt.textContent = a;
        sel.appendChild(opt);
      });
    } else throw new Error(json.message || "No addresses");
  } catch (err) {
    console.error("addresses error", err);
  }

  // tip handling
  const tipInput = document.getElementById("tip");
  const finalTotalEl = document.getElementById("finalTotal");
  function updateFinal() {
    const tip = Number(tipInput.value || 0);
    finalTotalEl.textContent = formatR(subtotal + tip);
  }
  if (tipInput) tipInput.addEventListener("input", updateFinal);
  updateFinal();

  // Pay button
  const payBtn = document.getElementById("payButton");
  if (!payBtn) return;
  payBtn.addEventListener("click", async () => {
    const name = (document.getElementById("name")||{}).value.trim();
    const phone = (document.getElementById("phone")||{}).value.trim();
    const email = (document.getElementById("email")||{}).value.trim();
    const delivery = (document.getElementById("delivery")||{}).value;
    const tip = Number((document.getElementById("tip")||{}).value || 0);
    const notes = (document.getElementById("notes")||{}).value || "";
    const finalTotal = subtotal + tip;
    const orderNumberNow = orderNumber;
    const orderListNow = orderList;

    if (!name || !phone || !delivery) { alert("Please fill name, phone and delivery address."); return; }

    // Save locally
    localStorage.setItem("customerName", name);
    localStorage.setItem("customerPhone", phone);
    localStorage.setItem("delivery", delivery);
    localStorage.setItem("tip", tip);
    localStorage.setItem("finalTotal", formatR(finalTotal));

    // If Yoco SDK not loaded or no public key, skip payment step (testing)
    if (typeof window.YocoSDK === "undefined" || YOCO_PUBLIC_KEY === "pk_test_your_public_key_here") {
      // Post order without payment token
      try {
        await postOrder({ orderNumber: orderNumberNow, name, phone, email, delivery, tip, notes, items: orderListNow, total: finalTotal, paymentToken: "" });
        window.location.href = "thankyou.html";
      } catch (err) {
        alert("Failed to save order: " + err.message);
      }
      return;
    }

    // Yoco payment flow
    const yoco = new window.YocoSDK({ publicKey: YOCO_PUBLIC_KEY });
    yoco.showPopup({
      amountInCents: Math.round(finalTotal * 100),
      currency: "ZAR",
      name: "Stellies Dinner Packs Order",
      description: `Order ${orderNumberNow}`,
      callback: async function(result) {
        if (result.error) {
          alert("Payment failed: " + result.error.message);
        } else {
          const token = result.id || "";
          try {
            await postOrder({ orderNumber: orderNumberNow, name, phone, email, delivery, tip, notes, items: orderListNow, total: finalTotal, paymentToken: token });
            window.location.href = "thankyou.html";
          } catch (err) {
            alert("Failed to save order after payment: " + err.message);
          }
        }
      }
    });
  });
}

// ---------- Post order to Apps Script ----------
async function postOrder(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Failed to save order");
  // clear cart
  localStorage.removeItem("stellies_cart");
  return json;
}

// ---------- On DOM ready: initialize appropriate page ----------
document.addEventListener("DOMContentLoaded", async () => {
  if (document.getElementById("productList")) {
    loadCart();
    await renderProducts();
  }
  if (document.getElementById("orderTable")) {
    await checkoutInit();
    const editBtn = document.getElementById("editButton");
    if (editBtn) editBtn.addEventListener("click", () => window.location.href = "index.html");
  }
});
