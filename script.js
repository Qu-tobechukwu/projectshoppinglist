/* script.js — Eden Creates
   - categories with nested items
   - selectable product cards (toggle select/deselect)
   - cart saved in localStorage, top total updates
   - checkout populates FormSubmit fields and saves local order
   - order-status does mock + local lookup
   - PWA install wiring (install button in header/footer)
*/

// -------------------- CONFIG (changeable) --------------------
const FORM_EMAIL = "forphoneuseemail@gmail.com"; // FormSubmit target
const CART_KEY = "eden_cart_ec_v1";
const ORDERS_KEY = "eden_orders_ec_v1";

// header/footer install button selectors to show
const INSTALL_BTN_IDS = ['#installTop','#installTop2','#installTop3','#installBottom','#installBottom2','#installBottom3'];

// -------------------- PRODUCTS (grouped by category) --------------------
const CATALOG = [
  {
    id: 'snack-packs',
    title: 'Snack Packs',
    description: 'Affordable lunches & snacks (7-day allowance).',
    items: [
      { id: 101, name: 'Snack Pack — Original', price: 55, image: 'assets/images/1.png', desc: 'Balanced mix of chocolate, sweets & chips.' },
      { id: 102, name: 'Snack Pack — More Chocolate', price: 60, image: 'assets/images/2.png', desc: 'More chocolate for the choc-hungry.' },
      { id: 103, name: 'Snack Pack — More Sweets', price: 60, image: 'assets/images/3.png', desc: 'Extra sweets for sugary joy.' },
      { id: 104, name: 'Snack Pack — More Chips', price: 60, image: 'assets/images/4.png', desc: 'Crispy, salty, satisfying.' }
    ]
  },
  {
    id: 'cook-book',
    title: 'Cook-Book',
    description: 'A curated collection of simple nourishing recipes.',
    items: [
      { id: 201, name: 'Cook-Book', price: 250, image: 'assets/images/1.png', desc: 'Beautifully printed recipes.' }
    ]
  },
  {
    id: 'gift-boxes',
    title: 'Gift Boxes',
    description: 'Three curated gift boxes with different themes.',
    items: [
      { id: 301, name: 'Gift Box — Sunshine', price: 380, image: 'assets/images/2.png', desc: 'Yellow themed delights.' },
      { id: 302, name: 'Gift Box — Something Out of the Blue', price: 380, image: 'assets/images/3.png', desc: 'Blue calm & treats.' },
      { id: 303, name: 'Gift Box — Red-iculious!', price: 380, image: 'assets/images/4.png', desc: 'Bold red picks.' }
    ]
  },
  {
    id: 'encouragement',
    title: 'Doses of Encouragement',
    description: 'Handwritten notes & subscription options.',
    items: [
      { id: 401, name: 'Random Handwritten Letter', price: 45, image: 'assets/images/1.png', desc: 'One randomized note of encouragement.' },
      { id: 402, name: 'Box of 10 — Letters', price: 380, image: 'assets/images/2.png', desc: 'Ten curated handwritten letters.' },
      { id: 403, name: 'Box of 50 — Letters', price: 1500, image: 'assets/images/3.png', desc: 'Fifty notes.' },
      { id: 404, name: 'Subscribe — Weekly "Date in a Box"', price: 120, image: 'assets/images/4.png', desc: 'Weekly subscription: a new date-in-box.' }
    ]
  },
  {
    id: 'date-in-a-box',
    title: 'Date in a Box',
    description: 'Buy once or subscribe for weekly surprises.',
    items: [
      { id: 501, name: 'Date in a Box — Single', price: 140, image: 'assets/images/1.png', desc: 'A single curated date box.' },
      { id: 502, name: 'Date in a Box — Subscription', price: 120, image: 'assets/images/2.png', desc: 'Weekly themed dates.' }
    ]
  },
  {
    id: 'kids-events',
    title: 'Kids & Events',
    description: 'Birthday packs and curated holiday gifts.',
    items: [
      { id: 601, name: 'Snack Pack Birthday Pack', price: 120, image: 'assets/images/3.png', desc: 'Party-friendly; add child name and age in notes.' },
      { id: 602, name: "Mother's Day — Custom Gift", price: 420, image: 'assets/images/2.png', desc: 'Custom message & small add-ons.' },
      { id: 603, name: "Father's Day — Custom Gift", price: 420, image: 'assets/images/4.png', desc: 'Personalise with message and selection.' }
    ]
  },
  {
    id: 'rainbow-picnic',
    title: 'Rainbow Picnic',
    description: 'Single-colour picnic boxes.',
    items: [
      { id: 701, name: 'Rainbow — Red', price: 160, image: 'assets/images/1.png', desc: 'Red themed picnic box.' },
      { id: 702, name: 'Rainbow — Orange', price: 160, image: 'assets/images/2.png', desc: 'Orange themed picnic box.' },
      { id: 703, name: 'Rainbow — Yellow', price: 160, image: 'assets/images/3.png', desc: 'Yellow themed picnic box.' },
      { id: 704, name: 'Rainbow — Green', price: 160, image: 'assets/images/4.png', desc: 'Green themed picnic box.' },
      { id: 705, name: 'Rainbow — Blue', price: 160, image: 'assets/images/1.png', desc: 'Blue themed picnic box.' },
      { id: 706, name: 'Rainbow — Purple', price: 160, image: 'assets/images/2.png', desc: 'Purple themed picnic box.' }
    ]
  },
  {
    id: 'grocery-topup',
    title: 'Grocery TopUp',
    description: 'Basics & breakfast staples.',
    items: [
      { id: 801, name: 'Tuna (Canned)', price: 30, image: 'assets/images/3.png', desc: 'Canned tuna.' },
      { id: 802, name: 'Sardines (Canned)', price: 25, image: 'assets/images/4.png', desc: 'Tinned sardines.' },
      { id: 803, name: 'Tomato Paste', price: 20, image: 'assets/images/1.png', desc: 'Tomato paste.' },
      { id: 804, name: 'Rice (1kg)', price: 45, image: 'assets/images/2.png', desc: 'White rice.' },
      { id: 805, name: 'Pasta (500g)', price: 30, image: 'assets/images/3.png', desc: 'Dried pasta.' },
      { id: 806, name: 'Pap (1kg)', price: 22, image: 'assets/images/4.png', desc: 'Maize meal.' },
      { id: 807, name: 'Coffee (250g)', price: 90, image: 'assets/images/1.png', desc: 'Ground coffee.' },
      { id: 808, name: 'Oats (500g)', price: 35, image: 'assets/images/2.png', desc: 'Rolled oats.' },
      { id: 809, name: 'Porridge / Weetbix alt', price: 40, image: 'assets/images/3.png', desc: 'Breakfast cereal alternative.' }
    ]
  }
];

// -------------------- UTILS --------------------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmt = n => Number(n).toFixed(2);
const escapeHtml = s => s == null ? '' : String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

// -------------------- CART & ORDERS --------------------
function readCart(){ try{ return JSON.parse(localStorage.getItem(CART_KEY)) || []; }catch(e){ return []; } }
function writeCart(c){ localStorage.setItem(CART_KEY, JSON.stringify(c)); updateCartUI(); }
function readOrders(){ try{ return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; }catch(e){ return []; } }
function writeOrders(a){ localStorage.setItem(ORDERS_KEY, JSON.stringify(a)); }

// find product by id
function findProductById(id){
  for(const cat of CATALOG){
    const p = cat.items.find(x=>x.id===id);
    if(p) return p;
  }
  return null;
}

// -------------------- RENDER CATALOG (accordion) --------------------
function renderCatalog(){
  const container = $("#products");
  const listContainer = $("#productsList");
  if(container) container.innerHTML = CATALOG.map(cat => categoryHTML(cat)).join('');
  if(listContainer) listContainer.innerHTML = CATALOG.map(cat => categoryHTML(cat)).join('');
  // attach toggle listeners and item listeners
  $$(".category-toggle").forEach(btn => btn.addEventListener("click", (e) => {
    const id = btn.dataset.target;
    const panel = document.getElementById(id);
    if(!panel) return;
    const open = panel.style.display !== 'none' && panel.style.display !== '';
    panel.style.display = open ? 'none' : 'grid';
    btn.textContent = open ? 'Show' : 'Hide';
  }));
  // wire add/select clicking onto cards
  $$(".product-card").forEach(card => {
    const id = Number(card.dataset.id);
    const btn = card.querySelector(".add-btn");
    card.addEventListener("click", (ev) => {
      // ignore clicks on the button itself (handled separately)
      if(ev.target.tagName.toLowerCase() === 'button') return;
      toggleSelectItem(id);
    });
    if(btn) btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggleSelectItem(id);
    });
  });
}

function categoryHTML(cat){
  const id = `cat-${cat.id}`;
  return `
    <div class="category-card">
      <div class="category-head">
        <div>
          <div class="category-title">${escapeHtml(cat.title)}</div>
          <div class="muted">${escapeHtml(cat.description)}</div>
        </div>
        <div>
          <button class="category-toggle" data-target="${id}">Hide</button>
        </div>
      </div>
      <div id="${id}" class="items-grid" style="margin-top:12px; display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:14px;">
        ${cat.items.map(it => productCardHTML(it)).join('')}
      </div>
    </div>
  `;
}

function productCardHTML(p){
  return `
    <div class="product-card" data-id="${p.id}" id="prod-${p.id}">
      <img class="product-img" src="${p.image}" alt="${escapeHtml(p.name)}" onerror="this.src='assets/images/1.png'">
      <div>
        <div class="product-title">${escapeHtml(p.name)}</div>
        <div class="product-desc">${escapeHtml(p.desc || p.description || '')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <div class="product-price">R ${fmt(p.price)}</div>
          <button class="add-btn" data-id="${p.id}">add</button>
        </div>
      </div>
    </div>
  `;
}

// -------------------- SELECTION / CART LOGIC --------------------
function toggleSelectItem(id){
  const cart = readCart();
  const existing = cart.find(i=>i.id === id);
  if(existing){
    // deselect: remove from cart
    const newCart = cart.filter(i=>i.id !== id);
    writeCart(newCart);
    updateCardUI(id, false);
    showToast('Removed from cart');
  } else {
    // select/add to cart
    cart.push({ id, q: 1 });
    writeCart(cart);
    updateCardUI(id, true);
    showToast('Added to cart');
  }
}

function updateCardUI(id, added){
  const card = document.getElementById(`prod-${id}`);
  if(!card) return;
  const btn = card.querySelector(".add-btn");
  if(added){
    card.classList.add("selected");
    if(btn){ btn.classList.add("added"); btn.textContent = "Added ✓"; }
  } else {
    card.classList.remove("selected");
    if(btn){ btn.classList.remove("added"); btn.textContent = "add"; }
  }
}

function syncAllCardStates(){
  const cart = readCart();
  const ids = cart.map(i=>i.id);
  // set UI for all products
  CATALOG.flatMap(c=>c.items).forEach(p => {
    const isIn = ids.includes(p.id);
    updateCardUI(p.id, isIn);
  });
}

// -------------------- CART UI --------------------
function updateCartUI(){
  const cart = readCart();
  const total = cart.reduce((s,it)=>{
    const p = findProductById(it.id);
    return s + (p ? p.price * it.q : 0);
  }, 0);
  $all("#topTotal,#topTotal2,#topTotal3").forEach(el => { if(el) el.textContent = fmt(total); });
  // checkout summary
  const sumEl = $("#checkoutSummary");
  if(sumEl){
    if(cart.length === 0){ sumEl.innerHTML = "<div class='muted'>Your cart is empty.</div>"; $("#checkoutTotal").textContent = "0.00"; return; }
    sumEl.innerHTML = cart.map(it=>{
      const p = findProductById(it.id) || {};
      return `<div style="display:flex;justify-content:space-between;padding:6px 0">
                <div>${escapeHtml(p.name || 'Item')} × ${it.q}</div>
                <div>R ${fmt((p.price||0) * it.q)}</div>
              </div>`;
    }).join('');
    $("#checkoutTotal").textContent = fmt(total);
  }
  // reflect selection outline states
  syncAllCardStates();
}

// -------------------- CHECKOUT: prepare FormSubmit fields & local save --------------------
function prepareCheckoutForm(){
  const form = $("#orderForm");
  if(!form) return;
  const cart = readCart();
  const items = cart.map(it=> {
    const p = findProductById(it.id) || {};
    return { id: it.id, name: p.name, price: p.price, qty: it.q };
  });
  const total = items.reduce((s,i)=> s + i.price * i.qty, 0);
  const orderNumber = "EC-" + Date.now().toString().slice(-7);

  // fill hidden fields
  const orderNumEl = $("#orderNumberInput");
  const totalEl = $("#orderTotalInput");
  const orderEl = $("#orderInput");
  if(orderNumEl) orderNumEl.value = orderNumber;
  if(totalEl) totalEl.value = fmt(total);
  if(orderEl) orderEl.value = JSON.stringify({ orderNumber, items, total });

  // save local copy on submit for lookup
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
    // clear cart locally
    localStorage.removeItem(CART_KEY);
  }, { once: true });
}

// -------------------- ORDER LOOKUP (mock + local) --------------------
function lookupOrder(value){
  const v = (value||"").toString().trim().toLowerCase();
  if(!v) return null;
  // search local saved orders
  const orders = readOrders();
  const found = orders.find(o => (o.orderNumber && o.orderNumber.toLowerCase() === v) || (o.email && o.email.toLowerCase() === v) || (o.name && o.name.toLowerCase() === v));
  if(found) return found;
  // demo fallback
  if(v.includes("@") || v.startsWith("ec-") || v.length>2){
    return {
      orderNumber: "EC-DEMO-001",
      name: "Demo Customer",
      email: "demo@example.com",
      address: "Rooiplein pickup (demo)",
      items: [{ name: "Snack Pack — Original", qty:1, price:55 }, { name: "Gift Box — Sunshine", qty:1, price:380 }],
      total: 435,
      status: "Packed (demo)"
    };
  }
  return null;
}

// -------------------- UI helpers --------------------
function showToast(msg, time=1500){
  const t = document.createElement("div");
  t.className = "toast show";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.classList.remove("show"), time-300);
  setTimeout(()=> t.remove(), time);
}

// -------------------- PWA install wiring --------------------
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  INSTALL_BTN_IDS.forEach(id => {
    const b = document.querySelector(id);
    if(b) b.style.display = 'inline-block';
  });
});
function setupInstallButtons(){
  INSTALL_BTN_IDS.forEach(id => {
    const btn = document.querySelector(id);
    if(!btn) return;
    btn.addEventListener('click', async () => {
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      btn.style.display = 'none';
    });
  });
}

// -------------------- BOOT --------------------
document.addEventListener('DOMContentLoaded', () => {
  // render catalog in both index and merch pages
  renderCatalog();
  const idxProducts = $("#products");
  const listProducts = $("#productsList");
  if(!idxProducts && listProducts) listProducts.innerHTML = CATALOG.map(cat => categoryHTML(cat)).join('');

  // update UI
  updateCartUI();
  setupInstallButtons();

  // prepare checkout hidden fields (if on checkout page)
  if($("#orderForm")) prepareCheckoutForm();

  // wire lookup form on order-status page
  const lookupForm = $("#lookupForm");
  if(lookupForm){
    lookupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $("#lookupValue").value;
      const res = lookupOrder(v);
      const out = $("#lookupResult");
      out.style.display = 'block';
      if(!res) out.innerHTML = "<div class='muted'>No order found (local/demo).</div>";
      else {
        out.innerHTML = `<h3>Order ${escapeHtml(res.orderNumber)}</h3>
          <div><strong>Name:</strong> ${escapeHtml(res.name)}</div>
          <div><strong>Email:</strong> ${escapeHtml(res.email)}</div>
          <div><strong>Address:</strong> ${escapeHtml(res.address)}</div>
          <div><strong>Items:</strong><ul>${res.items.map(i=>`<li>${escapeHtml(i.name)} × ${i.qty} — R${fmt(i.price || 0)}</li>`).join("")}</ul></div>
          <div><strong>Total:</strong> R${fmt(res.total)}</div>
          <div><strong>Status:</strong> ${escapeHtml(res.status)}</div>`;
      }
    });

    // show latest
    const showLatest = $("#showLatest");
    if(showLatest) showLatest.addEventListener("click", () => {
      const orders = readOrders();
      const out = $("#lookupResult");
      out.style.display = 'block';
      if(!orders.length){ out.innerHTML = "<div class='muted'>No previously saved local orders.</div>"; return; }
      const latest = orders[orders.length-1];
      out.innerHTML = `<h3>Order ${escapeHtml(latest.orderNumber)}</h3>
        <div><strong>Name:</strong> ${escapeHtml(latest.name)}</div>
        <div><strong>Email:</strong> ${escapeHtml(latest.email)}</div>
        <div><strong>Total:</strong> R${fmt(latest.total)}</div>
        <div><strong>Status:</strong> ${escapeHtml(latest.status)}</div>`;
    });
  }

  // keep visible totals updated periodically (in case pages navigate)
  setInterval(updateCartUI, 600);
});
