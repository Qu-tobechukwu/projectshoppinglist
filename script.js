/* script.js — Eden Creates (newspaper edit)
   - Hardcoded product list from user's new list
   - Render products on index & merch pages
   - Cart management, top total, toast, prepare checkout (FormSubmit),
     save local order for later mock lookup, mock order-status demo
   - PWA install wiring
*/

// ---------- DATA: products (mapped to images 1..4) ----------
const PRODUCTS = [
  // Snack Packs (3/4 varieties listed as separate purchasable items)
  { id: 101, name: "Snack Pack — Original", price: 55, image:"assets/images/1.png", description: "Balanced mix of chocolate, sweets & chips — 7-days allowance." },
  { id: 102, name: "Snack Pack — More Chocolate", price: 60, image:"assets/images/2.png", description: "Extra chocolate for serious snacking — 7-days allowance." },
  { id: 103, name: "Snack Pack — More Sweets", price: 60, image:"assets/images/3.png", description: "Extra candy, sweet joy — 7-days allowance." },
  { id: 104, name: "Snack Pack — More Chips", price: 60, image:"assets/images/4.png", description: "Crispy-focused pack for the savory lover — 7-days allowance." },

  // Cook-Book (single item)
  { id: 201, name: "Cook-Book", price: 250, image:"assets/images/1.png", description: "A curated collection of simple nourishing recipes." },

  // Gift Boxes (3 varieties)
  { id: 301, name: "Gift Box — Sunshine (yellow)", price: 380, image:"assets/images/2.png", description: "Sunrise tones and bright treats — curated." },
  { id: 302, name: "Gift Box — Something Out of the Blue", price: 380, image:"assets/images/3.png", description: "Cool blue selection and calm delights." },
  { id: 303, name: "Gift Box — Red-iculious!", price: 380, image:"assets/images/4.png", description: "Vibrant reds and bold flavours." },

  // Doses of Encouragement (handwritten letters, boxes, subscription)
  { id: 401, name: "Random Handwritten Letter — Single", price: 45, image:"assets/images/1.png", description: "A single randomized handwritten note of encouragement." },
  { id: 402, name: "Box of 10 — Handwritten Letters", price: 380, image:"assets/images/2.png", description: "Ten curated encouragement letters." },
  { id: 403, name: "Box of 50 — Handwritten Letters", price: 1500, image:"assets/images/3.png", description: "Bulk box of fifty handwritten notes." },
  { id: 404, name: "Subscribe — Weekly 'Date in a Box'", price: 120, image:"assets/images/4.png", description: "Weekly subscription, new 'date in a box' each week." },

  // Kids & Events (birthday packs + holiday specials)
  { id: 501, name: "Snack Pack — Birthday (Kids)", price: 120, image:"assets/images/1.png", description: "Party-friendly snack pack. Add child name & age at checkout (notes)." },
  { id: 502, name: "Mother's Day — Custom Gift", price: 420, image:"assets/images/2.png", description: "Customize: message & small add-ons. Select in notes." },
  { id: 503, name: "Father's Day — Custom Gift", price: 420, image:"assets/images/3.png", description: "Personalize with message and choice of treats." },
  { id: 504, name: "Rainbow Picnic — Red", price: 160, image:"assets/images/4.png", description: "Single-colour picnic box — red theme." },
  { id: 505, name: "Rainbow Picnic — Orange", price: 160, image:"assets/images/1.png", description: "Orange themed picnic selection." },
  { id: 506, name: "Rainbow Picnic — Yellow", price: 160, image:"assets/images/2.png", description: "Yellow themed picnic selection." },
  { id: 507, name: "Rainbow Picnic — Green", price: 160, image:"assets/images/3.png", description: "Green themed picnic selection." },
  { id: 508, name: "Rainbow Picnic — Blue", price: 160, image:"assets/images/4.png", description: "Blue themed picnic selection." },
  { id: 509, name: "Rainbow Picnic — Purple", price: 160, image:"assets/images/1.png", description: "Purple themed picnic selection." },

  // Grocery TopUp — canned / grains / coffee & breakfast
  { id: 601, name: "Tuna (Canned)", price: 30, image:"assets/images/2.png", description: "Standard canned tuna." },
  { id: 602, name: "Sardines (Canned)", price: 25, image:"assets/images/3.png", description: "Tinned sardines." },
  { id: 603, name: "Tomato Paste (Canned)", price: 20, image:"assets/images/4.png", description: "Concentrated tomato paste." },
  { id: 701, name: "Rice (1kg)", price: 45, image:"assets/images/1.png", description: "White rice, 1kg." },
  { id: 702, name: "Pasta (500g)", price: 30, image:"assets/images/2.png", description: "Dried pasta, 500g." },
  { id: 703, name: "Pap (1kg)", price: 22, image:"assets/images/3.png", description: "Maize meal / pap." },
  { id: 801, name: "Coffee (250g)", price: 90, image:"assets/images/4.png", description: "Ground coffee for mornings." },
  { id: 802, name: "Oats (500g)", price: 35, image:"assets/images/1.png", description: "Rolled oats." },
  { id: 803, name: "Porridge / Weetbix alt", price: 40, image:"assets/images/2.png", description: "Porridge cereal alternative." }
];

// ---------- storage keys ----------
const CART_KEY = "eden_cart_new_v1";
const ORDERS_KEY = "eden_orders_new_v1";

// ---------- helpers ----------
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));
const formatR = n => Number(n).toFixed(2);

// ---------- render functions ----------
function renderProducts(target) {
  const container = document.querySelector(target);
  if(!container) return;
  container.innerHTML = PRODUCTS.map(p => productCard(p)).join("");
  // attach add buttons
  container.querySelectorAll(".add-btn").forEach(btn => btn.addEventListener("click", () => {
    addToCart(Number(btn.dataset.id));
  }));
}

function productCard(p){
  return `
    <div class="product-card" data-id="${p.id}">
      <img class="product-img" src="${p.image}" alt="${escapeHtml(p.name)}" onerror="this.src='assets/images/1.png'">
      <div>
        <div class="product-title">${escapeHtml(p.name)}</div>
        <div class="product-desc">${escapeHtml(p.description)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
          <div class="product-price">R ${formatR(p.price)}</div>
          <button class="add-btn" data-id="${p.id}">add</button>
        </div>
      </div>
    </div>
  `;
}

// ---------- cart logic ----------
function readCart(){
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch(e){ return []; }
}
function writeCart(cart){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartUI();
}
function addToCart(id){
  const cart = readCart();
  const item = cart.find(i => i.id === id);
  if(item) item.q += 1;
  else cart.push({ id, q:1 });
  writeCart(cart);
  showToast("Added to cart");
}
function removeFromCart(id){
  let cart = readCart();
  cart = cart.filter(i => i.id !== id);
  writeCart(cart);
  showToast("Removed from cart");
}
function updateCartUI(){
  const cart = readCart();
  const total = cart.reduce((s,it) => {
    const p = PRODUCTS.find(x => x.id === it.id);
    return s + (p ? p.price * it.q : 0);
  }, 0);
  // update header totals
  $all("#topTotal,#topTotal2,#topTotal3").forEach(el => { if(el) el.textContent = formatR(total); });
  // update checkout summary
  const sumEl = $("#checkoutSummary");
  if(sumEl){
    if(cart.length === 0){ sumEl.innerHTML = "<div class='muted'>Your cart is empty.</div>"; $("#checkoutTotal").textContent = "0.00"; return; }
    sumEl.innerHTML = cart.map(it => {
      const p = PRODUCTS.find(x => x.id === it.id) || {};
      return `<div style="display:flex;justify-content:space-between;padding:6px 0">
                <div>${escapeHtml(p.name)} × ${it.q}</div>
                <div>R ${formatR((p.price||0) * it.q)}</div>
              </div>`;
    }).join("");
    $("#checkoutTotal").textContent = formatR(total);
  }
}

// ---------- checkout (FormSubmit) ----------
function prepareCheckoutForm(){
  const form = $("#orderForm");
  if(!form) return;
  const cart = readCart();
  const items = cart.map(it => {
    const p = PRODUCTS.find(x => x.id === it.id) || {};
    return { id: it.id, name: p.name, price: p.price, qty: it.q };
  });
  const total = items.reduce((s,i) => s + i.price * i.qty, 0);
  const orderNumber = "EC-" + Date.now().toString().slice(-6);

  const numEl = $("#orderNumberInput");
  const totalEl = $("#orderTotalInput");
  const orderEl = $("#orderInput");
  if(numEl) numEl.value = orderNumber;
  if(totalEl) totalEl.value = formatR(total);
  if(orderEl) orderEl.value = JSON.stringify({ orderNumber, items, total });

  // store local copy on submit
  form.addEventListener("submit", function(){
    const orderObj = {
      orderNumber,
      items,
      total,
      name: $("#custName")?.value || "",
      email: $("#custEmail")?.value || "",
      address: $("#custAddress")?.value || "",
      notes: $("#custNotes")?.value || "",
      created: new Date().toISOString(),
      status: "Pending"
    };
    const orders = readOrders();
    orders.push(orderObj);
    writeOrders(orders);
    // clear cart
    localStorage.removeItem(CART_KEY);
  }, { once: true });
}

// ---------- orders saved locally ----------
function readOrders(){
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; } catch(e){ return []; }
}
function writeOrders(arr){
  localStorage.setItem(ORDERS_KEY, JSON.stringify(arr));
}

// ---------- order lookup (mock + local) ----------
function lookup(value){
  const v = (value||"").toString().trim().toLowerCase();
  if(!v) return null;
  // first try local saved orders
  const orders = readOrders();
  const found = orders.find(o => (o.orderNumber && o.orderNumber.toLowerCase() === v) || (o.email && o.email.toLowerCase() === v));
  if(found) return found;
  // fallback: return a mock demo result if value looks like email or short id
  if(v.includes("@") || v.startsWith("ec-") || v.length > 3){
    // demo fake item
    return {
      orderNumber: "EC-DEMO-001",
      name: "Demo Customer",
      email: "demo@example.com",
      address: "Rooiplein pickup",
      items: [
        { name: "Snack Pack — Original", qty: 1, price: 55 },
        { name: "The Columnist Tote", qty: 1, price: 250 }
      ],
      total: 305,
      status: "Packed (demo)"
    };
  }
  return null;
}

// ---------- small helpers ----------
function escapeHtml(s){ if(s==null) return ""; return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function showToast(msg, time=1500){
  const t = document.createElement("div");
  t.className = "toast show";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.classList.remove("show"), time-300);
  setTimeout(()=> t.remove(), time);
}

// ---------- PWA install wiring ----------
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $all('#installTop,#installTop2,#installTop3,#installBottom,#installBottom2,#installBottom3').forEach(b => { if(b) b.style.display = 'inline-block'; });
});
function setupInstallButtons(){
  $all('#installTop,#installTop2,#installTop3,#installBottom,#installBottom2,#installBottom3').forEach(btn=>{
    if(!btn) return;
    btn.addEventListener('click', async ()=>{
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      btn.style.display = 'none';
    });
  });
}

// ---------- boot sequence ----------
document.addEventListener('DOMContentLoaded', () => {
  // render products
  renderProducts("#products");
  renderProducts("#productsList");

  // update cart UI & install wiring
  updateCartUI();
  setupInstallButtons();

  // prepare checkout form fields
  if($("#orderForm")) prepareCheckoutForm();

  // wire order-status lookup form
  const lookupForm = $("#lookupForm");
  if(lookupForm){
    lookupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $("#lookupValue").value;
      const res = lookup(v);
      const out = $("#lookupResult");
      out.style.display = 'block';
      if(!res) out.innerHTML = "<div class='muted'>No order found (local/demo).</div>";
      else {
        if(res.items){
          out.innerHTML = `<h3>Order ${escapeHtml(res.orderNumber)}</h3>
            <div><strong>Name:</strong> ${escapeHtml(res.name)}</div>
            <div><strong>Email:</strong> ${escapeHtml(res.email)}</div>
            <div><strong>Address:</strong> ${escapeHtml(res.address)}</div>
            <div><strong>Items:</strong><ul>${res.items.map(i=>`<li>${escapeHtml(i.name)} × ${i.qty} — R${formatR(i.price || 0)}</li>`).join("")}</ul></div>
            <div><strong>Total:</strong> R${formatR(res.total)}</div>
            <div><strong>Status:</strong> ${escapeHtml(res.status || 'Pending')}</div>`;
        } else {
          out.innerHTML = `<pre>${JSON.stringify(res, null, 2)}</pre>`;
        }
      }
    });

    const showLatest = $("#showLatest");
    if(showLatest){
      showLatest.addEventListener("click", () => {
        const orders = readOrders();
        const out = $("#lookupResult");
        out.style.display = 'block';
        if(!orders.length){ out.innerHTML = "<div class='muted'>No previous local orders.</div>"; return; }
        const latest = orders[orders.length - 1];
        out.innerHTML = `<h3>Order ${escapeHtml(latest.orderNumber)}</h3>
          <div><strong>Name:</strong> ${escapeHtml(latest.name)}</div>
          <div><strong>Email:</strong> ${escapeHtml(latest.email)}</div>
          <div><strong>Total:</strong> R${formatR(latest.total)}</div>
          <div><strong>Status:</strong> ${escapeHtml(latest.status)}</div>`;
      });
    }
  }
});
