/* script.js
 - Loads products & addresses from your Apps Script endpoint
 - Manages cart in localStorage
 - Posts orders to Apps Script
 - Yoco placeholder ready
*/

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwxP_vLG1PXl4l4_eKi_DTdK1duFwQiscXDDNqkFVcpdIuR_x212lHUp2rQJahWJKRS/exec";
const YOCO_PUBLIC_KEY = "pk_test_your_public_key_here"; // replace when ready

let products = [];
let addresses = [];
let cart = [];

// helpers
function formatR(v){ return Number(v||0).toFixed(2); }
function saveCart(){ localStorage.setItem("stellies_cart", JSON.stringify(cart)); }
function loadCart(){ cart = JSON.parse(localStorage.getItem("stellies_cart") || "[]"); }
function genOrderNumber(){
  let count = Number(localStorage.getItem("stellies_order_count") || 0); count++; localStorage.setItem("stellies_order_count", count);
  return "SDP-" + String(count).padStart(4,"0");
}

// FETCH products
async function fetchProducts(){
  const res = await fetch(APPS_SCRIPT_URL + "?action=products");
  const json = await res.json();
  if(!json.success) throw new Error(json.message||"No products");
  products = json.products;
  return products;
}

// FETCH addresses
async function fetchAddresses(){
  const res = await fetch(APPS_SCRIPT_URL + "?action=addresses");
  const json = await res.json();
  if(!json.success) throw new Error(json.message||"No addresses");
  addresses = json.addresses;
  return addresses;
}

/* ---------- RENDER PRODUCTS (index.html) ---------- */
async function renderProducts(){
  const container = document.getElementById("productList");
  if(!container) return;
  container.innerHTML = "<div class='small'>Loading items…</div>";

  try{
    await fetchProducts();
    container.innerHTML = "";
    products.forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = "product-row";
      row.innerHTML = `
        <div class="prod-left">
          <div class="checkbox-w"><input type="checkbox" id="p${idx}" data-idx="${idx}" /></div>
          <div>
            <div class="item-name">${p.item}</div>
            <div class="item-meta">${p.category || ""}</div>
          </div>
        </div>
        <div class="prod-right">
          ${p.hasFlavours ? `<select id="flavour-${idx}"><option value="">Choose</option>${p.flavours.map(f=>`<option>${f}</option>`).join('')}</select>` : `<div style="height:34px"></div>`}
          <div class="controls">
            <input id="qty-${idx}" class="qty" type="number" min="1" value="1" />
            <div class="price">R ${formatR(p.price)}</div>
          </div>
        </div>
      `;
      container.appendChild(row);

      const checkbox = row.querySelector(`#p${idx}`);
      const qtyInput = row.querySelector(`#qty-${idx}`);
      const flavourSelect = row.querySelector(`#flavour-${idx}`);

      checkbox.addEventListener("change", () => {
        const product = products[idx];
        if (checkbox.checked) {
          const item = {
            itemName: product.item,
            flavour: flavourSelect ? flavourSelect.value : "",
            qty: Number(qtyInput.value) || 1,
            price: Number(product.price) || 0
          };
          cart = cart.filter(c => c.itemName !== item.itemName);
          cart.push(item);
        } else {
          cart = cart.filter(c => c.itemName !== product.item);
        }
        saveCart(); updateTotalUI();
      });

      qtyInput.addEventListener("input", () => {
        if (checkbox.checked) {
          cart = cart.map(c => c.itemName === products[idx].item ? {...c, qty: Number(qtyInput.value)||1} : c);
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
  }catch(err){
    container.innerHTML = `<div class="small" style="color:#c22">Could not load products. Check Apps Script URL.</div>`;
    console.error(err);
  }
}

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

function updateTotalUI(){
  const totalEl = document.getElementById("total");
  const sum = cart.reduce((acc,c)=> acc + (c.price*c.qty), 0);
  if (totalEl) totalEl.textContent = formatR(sum);
}

/* ---------- Button handlers ---------- */
document.addEventListener("click", (e) => {
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
  } else if (e.target && e.target.id === "viewOrder") {
    window.location.href = "checkout.html";
  } else if (e.target && e.target.id === "editButton") {
    window.location.href = "index.html";
  }
});

/* ---------- Checkout init ---------- */
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
    orderList.forEach(i=> {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${i.itemName}</td><td>${i.flavour || "-"}</td><td>${i.qty}</td><td>R ${formatR(i.price*i.qty)}</td>`;
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
  function updateFinal(){ const tip = Number(tipInput.value || 0); finalTotalEl.textContent = formatR(subtotal + tip); }
  if (tipInput) tipInput.addEventListener("input", updateFinal);
  updateFinal();

  // pay button
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

    // save locally
    localStorage.setItem("customerName", name);
    localStorage.setItem("customerPhone", phone);
    localStorage.setItem("delivery", delivery);
    localStorage.setItem("tip", tip);
    localStorage.setItem("finalTotal", formatR(finalTotal));

    // If Yoco not configured, skip payment (testing)
    if (typeof window.YocoSDK === "undefined" || YOCO_PUBLIC_KEY === "pk_test_your_public_key_here") {
      try {
        await postOrder({ orderNumber: orderNumberNow, name, phone, email, delivery, tip, notes, items: orderListNow, total: finalTotal, paymentToken: "" });
        window.location.href = "thankyou.html";
      } catch (err) {
        alert("Failed to save order: " + err.message);
      }
      return;
    }

    // Yoco flow
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

/* ---------- Post order ---------- */
async function postOrder(payload){
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Failed to save order");
  localStorage.removeItem("stellies_cart");
  return json;
}

/* ---------- On DOM load ---------- */
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
