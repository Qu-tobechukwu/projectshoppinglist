/* script.js - frontend logic for Stellies Delivery + Merch + Checkout
   - Loads products, merch, addresses, sponsors from APPS_SCRIPT_URL
   - Pagination: 10 items per page
   - Multi-flavour selection with qty per flavour
   - Bulk discount per product (BulkThreshold & BulkDiscountPercent)
   - Merch loaded from Merch sheet
   - Reset cart, Repeat last order (localStorage)
   - Checkout with discount breakdown, tip, and Yoco placeholder
*/

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwxP_vLG1PXl4l4_eKi_DTdK1duFwQiscXDDNqkFVcpdIuR_x212lHUp2rQJahWJKRS/exec";
const YOCO_PUBLIC_KEY = "pk_test_your_public_key_here"; // replace with your Yoco public key

/* state */
let products = [], merch = [], addresses = [], sponsors = [];
let cart = []; // { itemName, flavour, qty, price, bulkThreshold, bulkDiscountPercent, type: 'product'|'merch' }
const PAGE_SIZE = 10; // items per page for performance (you asked me to pick an appropriate number)
let currentPage = 1;

/* utilities */
function formatR(v){ return Number(v || 0).toFixed(2); }
function saveCart(){ localStorage.setItem("stellies_cart", JSON.stringify(cart)); }
function loadCart(){ cart = JSON.parse(localStorage.getItem("stellies_cart") || "[]"); }
function genOrderNumber(){ let c = Number(localStorage.getItem("stellies_order_count")||0); c++; localStorage.setItem("stellies_order_count", c); return "SDP-" + String(c).padStart(4,"0"); }
function saveLastOrder(){ localStorage.setItem("stellies_last_order", JSON.stringify(cart)); }
function loadLastOrder(){ return JSON.parse(localStorage.getItem("stellies_last_order") || "[]"); }
function clearCart(){ cart = []; saveCart(); updateTotalUI(); restoreCartUI(); localStorage.removeItem("orderList"); }

/* fetch functions */
async function fetchProducts(){ const r = await fetch(APPS_SCRIPT_URL + "?action=products"); const j = await r.json(); if(!j.success) throw new Error(j.message); products = j.products; return products; }
async function fetchMerch(){ const r = await fetch(APPS_SCRIPT_URL + "?action=merch"); const j = await r.json(); if(!j.success) throw new Error(j.message); merch = j.merch; return merch; }
async function fetchAddresses(){ const r = await fetch(APPS_SCRIPT_URL + "?action=addresses"); const j = await r.json(); if(!j.success) throw new Error(j.message); addresses = j.addresses; return addresses; }
async function fetchSponsors(){ const r = await fetch(APPS_SCRIPT_URL + "?action=sponsors"); const j = await r.json(); if(!j.success) throw new Error(j.message); sponsors = j.sponsors; return sponsors; }

/* ----------------- SPONSORS ----------------- */
async function renderSponsors(){
  const col = document.getElementById("sponsorCol"); if(!col) return;
  try{
    await fetchSponsors();
    col.innerHTML = "";
    if(!sponsors || sponsors.length === 0){ col.innerHTML = "<div class='sponsor-box'>Sponsored content</div>"; return; }
    sponsors.forEach(s=>{
      const box = document.createElement("div"); box.className = "sponsor-box";
      if(s.image){
        const img = document.createElement("img"); img.src = s.image; img.alt = s.title || "Sponsor"; img.style.maxWidth="100%";
        if(s.link){ const a=document.createElement("a"); a.href=s.link; a.target="_blank"; a.appendChild(img); box.appendChild(a); } else box.appendChild(img);
      } else {
        box.textContent = s.title || "Sponsor";
      }
      col.appendChild(box);
    });
    for(let i=sponsors.length;i<10;i++){ const empty=document.createElement('div'); empty.className='sponsor-box'; empty.style.opacity=0.35; empty.textContent='Ad slot'; col.appendChild(empty); }
  } catch(err){ col.innerHTML = "<div class='sponsor-box'>Error loading sponsors</div>"; console.error(err); }
}

/* ----------------- PRODUCTS (pagination & render) ----------------- */
function paged(items, page){ const start = (page-1)*PAGE_SIZE; return items.slice(start, start+PAGE_SIZE); }
function pageCount(items){ return Math.max(1, Math.ceil(items.length / PAGE_SIZE)); }

async function renderProducts(page = 1){
  currentPage = page;
  const container = document.getElementById("productList"); if(!container) return;
  try{
    await fetchProducts();
    container.innerHTML = "";
    // pagination selection
    const listToShow = paged(products, page);
    listToShow.forEach((p, idxRel) => {
      const idx = (page-1)*PAGE_SIZE + idxRel;
      const card = document.createElement("div"); card.className = "product-row"; card.id = `product-${idx}`;
      const leftHTML = `<div class="prod-left"><div class="checkbox-w">${p.hasFlavours ? '' : `<input type="checkbox" id="pcheck-${idx}" data-idx="${idx}" />`}</div>
        <div><div class="item-name">${p.item}</div><div class="item-meta">${p.category||''}</div><div class="small" id="summary-${idx}"></div></div></div>`;
      const discountNote = (p.bulkThreshold && p.bulkDiscountPercent) ? `<div class="discount-note">Buy ${p.bulkThreshold}+ and get ${p.bulkDiscountPercent}% off</div>` : '';
      const rightHTML = `<div class="prod-right"><div class="price">R ${formatR(p.price)}</div>
        <div class="controls">${p.hasFlavours ? `<button class="btn ghost" id="toggle-${idx}">Choose flavours</button>` : `<input id="qty-${idx}" class="qty" type="number" min="1" value="1" />`}</div>${discountNote}</div>`;
      card.innerHTML = leftHTML + rightHTML;

      // flavour list if any
      if(p.hasFlavours && p.flavours && p.flavours.length){
        const flvContainer = document.createElement("div"); flvContainer.className = "flavour-list"; flvContainer.id = `flavours-${idx}`;
        p.flavours.forEach((f, fi) => {
          const fr = document.createElement("div"); fr.className = "flavour-row";
          fr.innerHTML = `<input class="flv-checkbox" type="checkbox" id="f-${idx}-${fi}" data-idx="${idx}" data-fi="${fi}" />
            <label for="f-${idx}-${fi}" style="flex:1">${f}</label>
            <input class="flv-qty" id="fq-${idx}-${fi}" type="number" min="0" value="0" />`;
          flvContainer.appendChild(fr);

          const cb = fr.querySelector(`#f-${idx}-${fi}`);
          const q = fr.querySelector(`#fq-${idx}-${fi}`);
          cb.addEventListener("change", () => {
            const flavourName = p.flavours[fi];
            const qty = Number(q.value || 0);
            if(cb.checked){
              const useQty = qty > 0 ? qty : 1;
              cart = cart.filter(c => !(c.itemName === p.item && c.flavour === flavourName && c.type === 'product'));
              cart.push({ itemName: p.item, flavour: flavourName, qty: useQty, price: Number(p.price||0), bulkThreshold: Number(p.bulkThreshold||0), bulkDiscountPercent: Number(p.bulkDiscountPercent||0), type:'product' });
              q.value = useQty;
            } else {
              cart = cart.filter(c => !(c.itemName === p.item && c.flavour === flavourName && c.type === 'product'));
            }
            saveCart(); updateTotalUI(); updateSummary(idx);
          });

          q.addEventListener("input", () => {
            const flavourName = p.flavours[fi];
            const newQty = Math.max(0, Number(q.value || 0));
            const existing = cart.find(c => c.itemName === p.item && c.flavour === flavourName && c.type === 'product');
            if(existing){
              if(newQty <= 0){
                cb.checked = false;
                cart = cart.filter(c => !(c.itemName === p.item && c.flavour === flavourName && c.type === 'product'));
              } else existing.qty = newQty;
            } else {
              if(newQty > 0){
                cb.checked = true;
                cart.push({ itemName: p.item, flavour: flavourName, qty: newQty, price: Number(p.price||0), bulkThreshold: Number(p.bulkThreshold||0), bulkDiscountPercent: Number(p.bulkDiscountPercent||0), type:'product' });
              }
            }
            saveCart(); updateTotalUI(); updateSummary(idx);
          });
        });
        card.appendChild(flvContainer);
      }

      container.appendChild(card);

      // events for non-flavour items or toggles
      if(!p.hasFlavours){
        const pcheck = card.querySelector(`#pcheck-${idx}`);
        const qtyInput = card.querySelector(`#qty-${idx}`);
        pcheck && pcheck.addEventListener("change", () => {
          if(pcheck.checked){
            cart = cart.filter(c=> !(c.itemName===p.item && c.type==='product'));
            cart.push({ itemName: p.item, flavour: '', qty: Number(qtyInput.value)||1, price: Number(p.price||0), bulkThreshold: Number(p.bulkThreshold||0), bulkDiscountPercent: Number(p.bulkDiscountPercent||0), type:'product' });
          } else {
            cart = cart.filter(c=> !(c.itemName===p.item && c.type==='product'));
          }
          saveCart(); updateTotalUI(); updateSummary(idx);
        });
        qtyInput && qtyInput.addEventListener("input", () => {
          cart = cart.map(c=> c.itemName===p.item && c.type==='product' ? {...c, qty: Number(qtyInput.value)||1} : c);
          saveCart(); updateTotalUI(); updateSummary(idx);
        });
      } else {
        const toggle = card.querySelector(`#toggle-${idx}`), flvList = card.querySelector(`#flavours-${idx}`);
        toggle && toggle.addEventListener("click", ()=> { if(!flvList) return; flvList.style.display = flvList.style.display === "block" ? "none" : "block"; });
      }

      updateSummary(idx);
    });

    // pagination UI
    const pageInfo = document.getElementById("pageInfo");
    pageInfo.textContent = `Page ${currentPage} / ${pageCount(products)}`;
    document.getElementById("prevPage").disabled = currentPage <= 1;
    document.getElementById("nextPage").disabled = currentPage >= pageCount(products);

    restoreCartUI(); updateTotalUI();
  } catch(err){
    container.innerHTML = `<div class='small' style='color:#c22'>Could not load products.</div>`;
    console.error(err);
  }
}

/* update small summary under product */
function updateSummary(idx){
  const p = products[idx];
  const summaryEl = document.getElementById(`summary-${idx}`);
  if(!summaryEl) return;
  const entries = cart.filter(c => c.itemName === p.item && c.type === 'product');
  if(!entries.length){ summaryEl.textContent = ""; return; }
  if(p.hasFlavours){ const totalQty = entries.reduce((a,b)=>a + (b.qty||0),0); summaryEl.textContent = `${entries.length} flavour(s) • ${totalQty} total`; }
  else summaryEl.textContent = `${entries[0].qty} selected`;
}

/* restore cart UI */
function restoreCartUI(){
  loadCart();
  // clear UI first
  products.forEach((p, i) => {
    const idx = i;
    const pcheck = document.getElementById(`pcheck-${idx}`);
    const qty = document.getElementById(`qty-${idx}`);
    if(pcheck) pcheck.checked = false;
    if(qty) qty.value = 1;
    const flvEls = document.querySelectorAll(`#flavours-${idx} .flavour-row`);
    flvEls && flvEls.forEach(row => {
      const ch = row.querySelector('.flv-checkbox');
      const q = row.querySelector('.flv-qty');
      if(ch) ch.checked = false;
      if(q) q.value = 0;
    });
  });

  cart.forEach(item => {
    if(item.type === 'product'){
      const idx = products.findIndex(p => p.item === item.itemName);
      if(idx < 0) return;
      if(item.flavour){
        const p = products[idx];
        const fi = (p.flavours || []).findIndex(f => f === item.flavour);
        if(fi >= 0){
          const cb = document.getElementById(`f-${idx}-${fi}`);
          const q = document.getElementById(`fq-${idx}-${fi}`);
          if(cb) cb.checked = true;
          if(q) q.value = item.qty;
        }
      } else {
        const cb = document.getElementById(`pcheck-${idx}`);
        const q = document.getElementById(`qty-${idx}`);
        if(cb) cb.checked = true;
        if(q) q.value = item.qty;
      }
    }
    // merch items will be restored in merch rendering
  });

  // if cart has merch items, update merch UI once merch loaded
  if(document.getElementById('merchList')) renderMerch();
}

/* ----------------- MERCH ----------------- */
async function renderMerch(){
  const container = document.getElementById('merchList'); if(!container) return;
  try{
    await fetchMerch();
    container.innerHTML = "";
    merch.forEach((m, i) => {
      const card = document.createElement('div'); card.className='merch-card';
      card.innerHTML = `<img class="merch-img" src="${m.image || 'logo.png'}" alt="${m.item}" />
        <div style="flex:1">
          <div style="font-weight:800">${m.item}</div>
          <div class="small">${m.description || ''}</div>
          <div style="margin-top:8px; font-weight:800">R ${formatR(m.price)}</div>
          <div style="margin-top:8px"><button class="btn" id="addMerch-${i}">Add to cart</button></div>
        </div>`;
      container.appendChild(card);
      const btn = card.querySelector(`#addMerch-${i}`);
      btn.addEventListener('click', ()=>{
        cart = cart.filter(c => !(c.itemName === m.item && c.type === 'merch'));
        cart.push({ itemName: m.item, flavour: '', qty: 1, price: Number(m.price||0), type:'merch', image: m.image });
        saveCart(); updateTotalUI();
        alert(`${m.item} added to cart`);
      });
    });
  } catch(err){
    container.innerHTML = `<div class='small' style='color:#c22'>Could not load merch.</div>`;
    console.error(err);
  }
}

/* ----------------- CALCULATIONS & DISCOUNTS ----------------- */
function calculateTotalsWithDiscounts(){
  const groups = {};
  cart.forEach(c => {
    const key = c.itemName + '||' + (c.type||'product');
    if(!groups[key]) groups[key] = { itemName: c.itemName, unitPrice: c.price, totalQty: 0, discountThreshold: c.bulkThreshold||0, discountPercent: c.bulkDiscountPercent||0, type: c.type || 'product', entries: [] };
    groups[key].totalQty += Number(c.qty || 0);
    groups[key].entries.push(c);
  });

  const result = { productTotals: [], subtotal:0, totalDiscount:0, finalTotal:0 };
  Object.keys(groups).forEach(k => {
    const g = groups[k];
    const subtotal = g.unitPrice * g.totalQty;
    let discounted = subtotal;
    let discountAmount = 0;
    if(g.discountThreshold && g.totalQty >= g.discountThreshold && g.discountPercent){
      discounted = subtotal * (1 - (g.discountPercent/100));
      discountAmount = subtotal - discounted;
    }
    result.productTotals.push({ name: g.itemName, unitPrice: g.unitPrice, totalQty: g.totalQty, subtotal, discountAmount, discounted, type: g.type });
    result.subtotal += subtotal;
    result.totalDiscount += discountAmount;
    result.finalTotal += discounted;
  });

  return result;
}

/* ----------------- UI totals ----------------- */
function updateTotalUI(){
  const totalEl = document.getElementById("total");
  const totals = calculateTotalsWithDiscounts();
  if(totalEl) totalEl.textContent = formatR(totals.finalTotal);
}

/* ----------------- Finish / Checkout flow ----------------- */
document.addEventListener('click', (e) => {
  if(e.target && e.target.id === 'finishBtn'){
    loadCart();
    if(cart.length === 0){ alert('Please select at least one item.'); return; }
    // only include items currently in cart (deselected ones are removed immediately)
    const orderNumber = genOrderNumber();
    localStorage.setItem('orderNumber', orderNumber);
    localStorage.setItem('orderList', JSON.stringify(cart));
    const totals = calculateTotalsWithDiscounts();
    localStorage.setItem('orderSubtotal', formatR(totals.finalTotal));
    saveLastOrder(); // remember for repeat
    window.location.href = 'checkout.html';
  } else if(e.target && e.target.id === 'resetCart'){
    if(confirm('Clear your cart?')){ clearCart(); saveLastOrder(); }
  } else if(e.target && e.target.id === 'repeatOrder'){
    const last = loadLastOrder();
    if(!last || last.length === 0){ alert('No previous order found'); return; }
    cart = last; saveCart(); restoreCartUI(); updateTotalUI(); alert('Last order reloaded into cart');
  } else if(e.target && e.target.id === 'refreshProducts'){
    renderProducts(currentPage); renderSponsors();
  } else if(e.target && e.target.id === 'prevPage'){
    if(currentPage > 1){ currentPage--; renderProducts(currentPage); }
  } else if(e.target && e.target.id === 'nextPage'){
    if(currentPage < pageCount(products)){ currentPage++; renderProducts(currentPage); }
  } else if(e.target && e.target.id === 'viewOrder'){
    window.location.href = 'checkout.html';
  } else if(e.target && e.target.id === 'editButton'){
    window.location.href = 'index.html';
  }
});

/* POST order helper */
async function postOrder(payload){
  const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  const json = await res.json();
  if(!json.success) throw new Error(json.message || 'Failed to save order');
  // clear stellies_cart but keep last_order for repeat
  localStorage.removeItem('stellies_cart');
  return json;
}

/* ----------------- Checkout init ----------------- */
async function checkoutInit(){
  loadCart();
  const orderNumber = localStorage.getItem('orderNumber') || genOrderNumber();
  const orderList = JSON.parse(localStorage.getItem('orderList') || '[]');
  const totals = calculateTotalsWithDiscounts();

  document.getElementById('orderNumber').textContent = orderNumber;
  const orderTable = document.getElementById('orderTable'); orderTable.innerHTML = '';
  orderList.forEach(i => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i.itemName}</td><td>${i.flavour || '-'}</td><td>${i.qty}</td><td>R ${formatR(i.price * i.qty)}</td>`;
    orderTable.appendChild(tr);
  });

  document.getElementById('orderSubtotal').textContent = formatR(totals.subtotal);
  // discount breakdown
  const bd = document.getElementById('discountBreakdown');
  let bdText = '';
  totals.productTotals.forEach(pt => {
    if(pt.discountAmount > 0) bdText += `${pt.name}: -R ${formatR(pt.discountAmount)} (${pt.totalQty} items, ${pt.discounted < pt.subtotal ? pt.discounted : pt.subtotal})\n`;
  });
  bdText = (totals.totalDiscount > 0) ? `Total savings: R ${formatR(totals.totalDiscount)}\n\n${bdText}` : 'No bulk discounts applied.';
  bd.textContent = bdText;
  document.getElementById('orderFinal').textContent = formatR(totals.finalTotal);
  document.getElementById('checkoutTip').textContent = formatR(0);

  // addresses
  try{ await fetchAddresses(); const sel = document.getElementById('delivery'); sel.innerHTML = ''; addresses.forEach(a => { const opt = document.createElement('option'); opt.value = a; opt.textContent = a; sel.appendChild(opt); }); } catch(err){ console.error(err); }

  // tip handling
  const tipInput = document.getElementById('tip'); tipInput && tipInput.addEventListener('input', ()=> {
    const tip = Number(tipInput.value || 0);
    const final = totals.finalTotal + tip;
    document.getElementById('orderFinal').textContent = formatR(final);
    document.getElementById('checkoutTip').textContent = formatR(tip);
  });

  // pay button
  const payBtn = document.getElementById('payButton');
  payBtn && payBtn.addEventListener('click', async () => {
    const name = (document.getElementById('name')||{}).value.trim(); const phone = (document.getElementById('phone')||{}).value.trim();
    const email = (document.getElementById('email')||{}).value.trim(); const delivery = (document.getElementById('delivery')||{}).value;
    const tip = Number((document.getElementById('tip')||{}).value || 0);
    const notes = (document.getElementById('notes')||{}).value || '';
    const finalTotal = totals.finalTotal + tip;
    if(!name || !phone || !delivery){ alert('Please fill name, phone and delivery address.'); return; }

    // Save local details
    localStorage.setItem('customerName', name); localStorage.setItem('customerPhone', phone); localStorage.setItem('delivery', delivery); localStorage.setItem('tip', tip); localStorage.setItem('finalTotal', formatR(finalTotal));

    // If Yoco not configured, post order without payment token (testing)
    if(typeof window.YocoSDK === 'undefined' || YOCO_PUBLIC_KEY === 'pk_test_your_public_key_here'){
      try{
        const postPayload = { orderNumber, name, phone, email, delivery, tip, notes, items: orderList, total: finalTotal, paymentToken: '' };
        await postOrder(postPayload);
        window.location.href = 'thankyou.html';
      } catch(err){
        alert('Failed to save order: ' + err.message);
      }
      return;
    }

    // Yoco payment flow
    const yoco = new window.YocoSDK({ publicKey: YOCO_PUBLIC_KEY });
    yoco.showPopup({
      amountInCents: Math.round(finalTotal * 100),
      currency: 'ZAR',
      name: 'Stellies Dinner Packs Order',
      description: `Order ${orderNumber}`,
      callback: async function(result){
        if(result.error){ alert('Payment failed: ' + result.error.message); }
        else {
          const token = result.id || '';
          try{
            const postPayload = { orderNumber, name, phone, email, delivery, tip, notes, items: orderList, total: finalTotal, paymentToken: token };
            await postOrder(postPayload);
            window.location.href = 'thankyou.html';
          } catch(err){
            alert('Failed to save after payment: ' + err.message);
          }
        }
      }
    });
  });
}

/* ----------------- DOM init ----------------- */
document.addEventListener('DOMContentLoaded', async () => {
  // index page
  if(document.getElementById('productList')){ loadCart(); await renderProducts(currentPage); renderSponsors(); }
  // merch page
  if(document.getElementById('merchList')){ loadCart(); await renderMerch(); renderSponsors(); }
  // checkout page
  if(document.getElementById('orderTable')){ await checkoutInit(); }
});
