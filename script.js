/* script.js - frontend logic (reads /data/*.json)
   BACKEND_URL: if set, orders will be POSTed to that URL as JSON.
   Otherwise fallback: create downloadable order file and save pending order to localStorage.
*/

const DATA_BASE = './data';
const PRODUCTS_URL = `${DATA_BASE}/products_stellies.json`;
const MERCH_URL = `${DATA_BASE}/products_merch.json`;
const SPONSORS_URL = `${DATA_BASE}/sponsors.json`;
const STATIC_ORDERS_URL = `${DATA_BASE}/orders.json`;

// If you have a server endpoint, put it here (e.g., netlify function or apps script URL).
// Example: const BACKEND_URL = "https://.../api/orders";
// Leave blank to use fallback download + localStorage.
const BACKEND_URL = ""; // <-- set here when you have a backend

// Page & state
let products = [], merch = [], sponsors = [];
let cart = []; // { itemName, type('product'|'merch'), flavour, qty, price, productId }
const PAGE_SIZE = 10;
let currentPage = 1;

/* ---------- utils ---------- */
function fmtR(v){ return Number(v||0).toFixed(2); }
function saveCart(){ localStorage.setItem('stellies_cart', JSON.stringify(cart)); }
function loadCart(){ cart = JSON.parse(localStorage.getItem('stellies_cart') || '[]'); }
function saveLastOrder(){ localStorage.setItem('stellies_last_order', JSON.stringify(cart)); }
function loadLastOrder(){ return JSON.parse(localStorage.getItem('stellies_last_order') || '[]'); }
function addPendingOrder(order){ const arr = JSON.parse(localStorage.getItem('stellies_pending_orders') || '[]'); arr.push(order); localStorage.setItem('stellies_pending_orders', JSON.stringify(arr)); }
function genOrderNo(){ let n = Number(localStorage.getItem('stellies_order_count')||0); n++; localStorage.setItem('stellies_order_count', n); return 'SDP-' + String(n).padStart(4, '0'); }

/* ---------- fetch data ---------- */
async function fetchJson(url){ const r = await fetch(url); if(!r.ok) return []; return await r.json(); }
async function loadAll(){ products = await fetchJson(PRODUCTS_URL); merch = await fetchJson(MERCH_URL); sponsors = await fetchJson(SPONSORS_URL); }

/* ---------- sponsors ---------- */
async function renderSponsors(){
  const col = document.getElementById('sponsorCol'); if(!col) return;
  col.innerHTML = '';
  try{
    const s = sponsors;
    if(!s || s.length===0){ col.innerHTML = '<div class="sponsor-box">Sponsored content</div>'; return; }
    const today = new Date();
    const active = s.filter(ad => {
      const startOk = !ad.startDate || new Date(ad.startDate) <= today;
      const endOk = !ad.endDate || new Date(ad.endDate) >= today;
      return startOk && endOk;
    }).sort((a,b)=> (a.priority||0)-(b.priority||0)).slice(0,10);
    active.forEach(ad=>{
      const box = document.createElement('div'); box.className = 'sponsor-box';
      if(ad.image){
        const img = document.createElement('img'); img.src = ad.image; img.alt = ad.link || 'Sponsor';
        if(ad.link){ const a = document.createElement('a'); a.href = ad.link; a.target = '_blank'; a.appendChild(img); box.appendChild(a); }
        else box.appendChild(img);
      } else {
        box.textContent = ad.link || 'Sponsor';
      }
      col.appendChild(box);
    });
    for(let i=active.length;i<10;i++){ const empty = document.createElement('div'); empty.className='sponsor-box'; empty.style.opacity=0.35; empty.textContent='Ad slot'; col.appendChild(empty); }
  } catch(err){ col.innerHTML = '<div class="sponsor-box">Error loading ads</div>'; console.error(err); }
}

/* ---------- products rendering (paged) ---------- */
function pageCount(items){ return Math.max(1, Math.ceil((items||[]).length / PAGE_SIZE)); }
function paged(items, page){ const start = (page-1)*PAGE_SIZE; return items.slice(start, start+PAGE_SIZE); }

async function renderProducts(page=1){
  currentPage = page;
  const container = document.getElementById('productList'); if(!container) return;
  container.innerHTML = '';
  try{
    const list = paged(products, page);
    list.forEach((p, relIdx) => {
      const idx = (page-1)*PAGE_SIZE + relIdx;
      const card = document.createElement('div'); card.className = 'product-row'; card.id = `product-${idx}`;
      const left = document.createElement('div'); left.className = 'prod-left';
      left.innerHTML = `<div class="checkbox-w">${p.flavours && p.flavours.length? '': `<input type="checkbox" id="pcheck-${idx}" data-id="${p.id}" />`}</div>
        <div><div class="item-name">${p.name}</div><div class="item-meta">${p.description||''}</div><div class="small" id="summary-${idx}"></div></div>`;
      const discountNote = (p.discountThreshold && p.discountPercent) ? `<div class="discount-note">Buy ${p.discountThreshold}+ and get ${p.discountPercent}% off</div>` : '';
      const right = document.createElement('div'); right.className = 'prod-right';
      right.innerHTML = `<div class="price">R ${fmtR(p.price)}</div>
        <div class="controls">${p.flavours && p.flavours.length ? `<button class="btn ghost" id="toggle-${idx}">Choose flavours</button>` : `<input id="qty-${idx}" class="qty" type="number" min="1" value="1" />`}</div>${discountNote}`;
      card.appendChild(left); card.appendChild(right);

      // flavour list
      if(p.flavours && p.flavours.length){
        const flvCon = document.createElement('div'); flvCon.className = 'flavour-list'; flvCon.id = `flavours-${idx}`;
        p.flavours.forEach((f, fi) => {
          const fr = document.createElement('div'); fr.className = 'flavour-row';
          fr.innerHTML = `<input class="flv-checkbox" type="checkbox" id="f-${idx}-${fi}" /> <label for="f-${idx}-${fi}" style="flex:1">${f}</label> <input class="flv-qty" id="fq-${idx}-${fi}" type="number" min="0" value="0" />`;
          flvCon.appendChild(fr);

          // events
          fr.querySelector(`#f-${idx}-${fi}`).addEventListener('change', (ev) => {
            const cb = ev.target; const qEl = fr.querySelector(`#fq-${idx}-${fi}`);
            const qty = Number(qEl.value || 0);
            if(cb.checked){
              const use = qty>0?qty:1;
              cart = cart.filter(c => !(c.productId===p.id && c.flavour===f && c.type==='product'));
              cart.push({ productId: p.id, itemName: p.name, type:'product', flavour: f, qty: use, price: Number(p.price) });
              qEl.value = use;
            } else {
              cart = cart.filter(c => !(c.productId===p.id && c.flavour===f && c.type==='product'));
            }
            saveCart(); updateTotalUI(); updateSummary(idx, p);
          });
          fr.querySelector(`#fq-${idx}-${fi}`).addEventListener('input', (ev) => {
            const q = Math.max(0, Number(ev.target.value || 0));
            const existing = cart.find(c => c.productId===p.id && c.flavour===f && c.type==='product');
            if(existing){
              if(q<=0){ fr.querySelector(`#f-${idx}-${fi}`).checked = false; cart = cart.filter(c => !(c.productId===p.id && c.flavour===f && c.type==='product')); }
              else existing.qty = q;
            } else {
              if(q>0){ fr.querySelector(`#f-${idx}-${fi}`).checked = true; cart.push({ productId: p.id, itemName: p.name, type:'product', flavour: f, qty: q, price: Number(p.price) }); }
            }
            saveCart(); updateTotalUI(); updateSummary(idx, p);
          });
        });
        card.appendChild(flvCon);
      }

      container.appendChild(card);

      // events for non-flavours
      if(!(p.flavours && p.flavours.length)){
        const chk = card.querySelector(`#pcheck-${idx}`);
        const qel = card.querySelector(`#qty-${idx}`);
        chk && chk.addEventListener('change', ()=> {
          if(chk.checked){
            cart = cart.filter(c=> !(c.productId===p.id && c.type==='product'));
            cart.push({ productId: p.id, itemName: p.name, type:'product', flavour:'', qty: Number(qel.value)||1, price: Number(p.price) });
          } else cart = cart.filter(c=> !(c.productId===p.id && c.type==='product'));
          saveCart(); updateTotalUI(); updateSummary(idx, p);
        });
        qel && qel.addEventListener('input', ()=> {
          cart = cart.map(c => c.productId===p.id && c.type==='product' ? {...c, qty: Number(qel.value)||1} : c);
          saveCart(); updateTotalUI(); updateSummary(idx, p);
        });
      } else {
        const toggle = card.querySelector(`#toggle-${idx}`);
        const flvList = card.querySelector(`#flavours-${idx}`);
        toggle && toggle.addEventListener('click', ()=> { if(!flvList) return; flvList.style.display = flvList.style.display === 'block' ? 'none' : 'block'; });
      }
      updateSummary(idx, p);
    });

    // pagination UI
    document.getElementById('pageInfo').textContent = `Page ${currentPage} / ${pageCount(products)}`;
    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage >= pageCount(products);
    restoreCartUI(); updateTotalUI();
  } catch(err){ container.innerHTML = '<div class="small">Failed to load products</div>'; console.error(err); }
}

/* summary under card */
function updateSummary(idx, product){
  const el = document.getElementById(`summary-${idx}`);
  if(!el) return;
  const entries = cart.filter(c => c.productId===product.id && c.type==='product');
  if(entries.length===0){ el.textContent = ''; return; }
  const totalQty = entries.reduce((a,b)=>a+(b.qty||0),0);
  el.textContent = `${entries.length} flavour(s) • ${totalQty} total`;
}

/* restore UI from cart */
function restoreCartUI(){
  loadCart();
  // mark checkboxes/qtys
  products.forEach((p, idx) => {
    const baseIdx = idx; // careful: index mapped to current page? We keep simple - we'll try to set matching controls if they exist
    // reset visible inputs
    const flvRows = document.querySelectorAll(`#flavours-${baseIdx} .flavour-row`);
    flvRows && flvRows.forEach(r => {
      const cb = r.querySelector('.flv-checkbox'); const q = r.querySelector('.flv-qty');
      cb && (cb.checked = false); q && (q.value = 0);
    });
    const pcheck = document.getElementById(`pcheck-${baseIdx}`); if(pcheck) pcheck.checked = false;
    const qty = document.getElementById(`qty-${baseIdx}`); if(qty) qty.value = 1;
  });

  cart.forEach(item => {
    if(item.type==='product'){
      // try to find controls in current DOM (might be on other page)
      const allProducts = document.querySelectorAll('.product-row');
      allProducts.forEach(row => {
        if(row && row.querySelector('.item-name') && row.querySelector('.item-name').textContent === item.itemName){
          // find matching flavour or qty
          if(item.flavour){
            const cb = Array.from(row.querySelectorAll('.flv-checkbox')).find(cb => cb.nextSibling && cb.nextSibling.textContent && cb.nextSibling.textContent.trim() === item.flavour);
            const q = cb ? cb.parentElement.querySelector('.flv-qty') : null;
            if(cb) cb.checked = true;
            if(q) q.value = item.qty;
          } else {
            const pcheck = row.querySelector('.checkbox-w input[type="checkbox"]');
            const q = row.querySelector('.qty');
            if(pcheck) pcheck.checked = true;
            if(q) q.value = item.qty;
          }
        }
      });
    }
  });
}

/* ---------- merch ---------- */
async function renderMerch(){
  const el = document.getElementById('merchList'); if(!el) return;
  try{
    merch.forEach((m,i) => {
      const card = document.createElement('div'); card.className = 'merch-card';
      card.innerHTML = `<img class="merch-img" src="${m.image||'logo.png'}" alt="${m.name}" />
        <div style="flex:1">
          <div style="font-weight:800">${m.name}</div>
          <div class="small">${m.description||''}</div>
          <div style="margin-top:8px;font-weight:800">R ${fmtR(m.price)}</div>
          <div style="margin-top:8px"><button class="btn add-merch" data-id="${m.id}">Add to cart</button></div>
        </div>`;
      el.appendChild(card);
    });
    document.querySelectorAll('.add-merch').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        const m = merch.find(x => x.id===id);
        if(!m) return;
        cart = cart.filter(c => !(c.type==='merch' && c.productId===m.id));
        cart.push({ productId: m.id, itemName: m.name, type: 'merch', flavour:'', qty:1, price: Number(m.price) });
        saveCart(); updateTotalUI();
        alert(`${m.name} added to cart`);
      });
    });
  } catch(err){ el.innerHTML = '<div class="small">Failed to load merch</div>'; console.error(err); }
}

/* ---------- totals & discounts ---------- */
function computeTotals(){
  // group by itemName+type
  const groups = {};
  cart.forEach(c => {
    const key = `${c.itemName}||${c.type}`;
    if(!groups[key]) groups[key] = { itemName: c.itemName, type: c.type, unitPrice: c.price, totalQty:0, discountThreshold:0, discountPercent:0, items: [] };
    groups[key].totalQty += Number(c.qty || 0);
    groups[key].items.push(c);
    // try to pick discount info from products list (only for type product)
    if(c.type === 'product'){
      const p = products.find(pp => pp.id === c.productId);
      if(p){ groups[key].discountThreshold = Number(p.discountThreshold||0); groups[key].discountPercent = Number(p.discountPercent||0); groups[key].unitPrice = Number(p.price||0); }
    }
  });

  let subtotal = 0, totalDiscount = 0;
  const productTotals = [];
  Object.values(groups).forEach(g => {
    const s = g.unitPrice * g.totalQty;
    let discounted = s;
    let dAmt = 0;
    if(g.discountThreshold && g.totalQty >= g.discountThreshold && g.discountPercent){
      discounted = s * (1 - g.discountPercent/100);
      dAmt = s - discounted;
    }
    subtotal += s;
    totalDiscount += dAmt;
    productTotals.push({ name: g.itemName, unitPrice: g.unitPrice, totalQty: g.totalQty, subtotal: s, discountAmount: dAmt, discounted: discounted });
  });
  return { subtotal, totalDiscount, finalTotal: subtotal - totalDiscount, productTotals };
}

function updateTotalUI(){
  const t = computeTotals();
  const totalEl = document.getElementById('total');
  if(totalEl) totalEl.textContent = fmtR(t.finalTotal);
}

/* ---------- finish/checkout ---------- */
document.addEventListener('click', (e) => {
  if(e.target && e.target.id === 'finishBtn'){
    loadCart();
    if(cart.length === 0){ alert('Please select at least one item.'); return; }
    const orderNo = genOrderNo();
    localStorage.setItem('orderNumber', orderNo);
    localStorage.setItem('orderList', JSON.stringify(cart));
    saveLastOrder();
    window.location.href = 'checkout.html';
  } else if(e.target && e.target.id === 'prevPage'){ if(currentPage>1){ currentPage--; renderProducts(currentPage); } }
  else if(e.target && e.target.id === 'nextPage'){ if(currentPage < pageCount(products)){ currentPage++; renderProducts(currentPage); } }
  else if(e.target && e.target.id === 'resetCart'){ if(confirm('Clear your cart?')){ cart=[]; saveCart(); updateTotalUI(); restoreCartUI(); } }
  else if(e.target && e.target.id === 'repeatOrder'){ const last = loadLastOrder(); if(!last || last.length===0){ alert('No previous order found'); return; } cart = last; saveCart(); updateTotalUI(); restoreCartUI(); alert('Last order reloaded'); }
  else if(e.target && e.target.id === 'viewOrder'){ window.location.href = 'checkout.html'; }
  else if(e.target && e.target.classList.contains('add-merch')){ /* handled in renderMerch */ }
  else if(e.target && e.target.id === 'refreshProducts'){ renderProducts(currentPage); renderSponsors(); }
  else if(e.target && e.target.id === 'editButton'){ window.location.href = 'index.html'; }
});

/* ---------- order submit ---------- */
async function submitOrderToBackend(payload){
  const res = await fetch(BACKEND_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if(!res.ok) throw new Error('Backend responded ' + res.status);
  return await res.json();
}

async function checkoutInit(){
  loadCart();
  const orderNumber = localStorage.getItem('orderNumber') || genOrderNo();
  const orderList = JSON.parse(localStorage.getItem('orderList') || '[]');
  const totals = computeTotals();

  document.getElementById('orderNumber').textContent = orderNumber;
  const orderTable = document.getElementById('orderTable'); orderTable.innerHTML = '';
  orderList.forEach(i => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i.itemName}</td><td>${i.flavour || '-'}</td><td>${i.qty}</td><td>R ${fmtR(i.price * i.qty)}</td>`;
    orderTable.appendChild(tr);
  });

  document.getElementById('orderSubtotal').textContent = fmtR(totals.subtotal);
  const bd = document.getElementById('discountBreakdown');
  let bdText = '';
  totals.productTotals.forEach(pt => { if(pt.discountAmount > 0) bdText += `${pt.name}: -R ${fmtR(pt.discountAmount)} (bulk discount)\n`; });
  bd.textContent = totals.totalDiscount>0 ? `Total savings: R ${fmtR(totals.totalDiscount)}\n\n${bdText}` : 'No bulk discounts applied.';
  document.getElementById('orderFinal').textContent = fmtR(totals.finalTotal);
  document.getElementById('checkoutTip').textContent = '0.00';

  // addresses list
  try{
    const addresses = await fetchJson(`${DATA_BASE}/addresses.json`).catch(()=>[]);
    const sel = document.getElementById('delivery'); if(sel){ sel.innerHTML = ''; (addresses||[]).forEach(a => { const opt=document.createElement('option'); opt.value=a; opt.textContent=a; sel.appendChild(opt); }); }
  } catch(err){ console.error('addresses', err); }

  const tipInput = document.getElementById('tip');
  tipInput && tipInput.addEventListener('input', ()=> {
    const tip = Number(tipInput.value || 0);
    const final = totals.finalTotal + tip;
    document.getElementById('orderFinal').textContent = fmtR(final);
    document.getElementById('checkoutTip').textContent = fmtR(tip);
  });

  const payBtn = document.getElementById('payButton');
  payBtn && payBtn.addEventListener('click', async () => {
    const name = (document.getElementById('name')||{}).value.trim();
    const phone = (document.getElementById('phone')||{}).value.trim();
    const email = (document.getElementById('email')||{}).value.trim();
    const delivery = (document.getElementById('delivery')||{}).value;
    const tip = Number((document.getElementById('tip')||{}).value || 0);
    const notes = (document.getElementById('notes')||{}).value || '';
    const totalsNow = computeTotals();
    const finalTotal = totalsNow.finalTotal + tip;

    if(!name || !phone || !delivery){ alert('Please fill name, phone and delivery address.'); return; }

    // build order payload
    const payload = {
      orderNumber,
      name,
      phone,
      email,
      delivery,
      tip,
      notes,
      items: orderList.map(i => ({ productId: i.productId, itemName: i.itemName, flavour: i.flavour, qty: i.qty, unitPrice: i.price, type: i.type })),
      total: finalTotal,
      timestamp: (new Date()).toISOString()
    };

    // If no backend configured: save pending order locally + create download
    if(!BACKEND_URL){
      addPendingOrder(payload);
      // create download so you can manually add to server or email it
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${orderNumber}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // store final totals for thankyou page
      localStorage.setItem('finalTotal', fmtR(finalTotal));
      localStorage.setItem('delivery', delivery);
      localStorage.setItem('orderNumber', orderNumber);

      // clear cart (keep last order stored)
      saveLastOrder();
      localStorage.removeItem('stellies_cart');
      window.location.href = 'thankyou.html';
      return;
    }

    // If backend exists: POST and redirect to thankyou after success
    try{
      // Yoco placeholder: if you want to integrate Yoco, run payment here first and obtain token
      // For now we skip payment and post directly
      const res = await submitOrderToBackend(payload);
      // backend should respond with success and order number
      localStorage.setItem('finalTotal', fmtR(finalTotal));
      localStorage.setItem('delivery', delivery);
      localStorage.setItem('orderNumber', orderNumber);
      localStorage.removeItem('stellies_cart');
      window.location.href = 'thankyou.html';
    } catch(err){
      alert('Failed to submit order: ' + err.message);
      console.error(err);
    }
  });
}

/* ---------- DOM init ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();
  loadCart();
  // index page
  if(document.getElementById('productList')){ renderProducts(currentPage); renderSponsors(); }
  // merch page
  if(document.getElementById('merchList')){ renderMerch(); renderSponsors(); }
  // checkout page
  if(document.getElementById('orderTable')){ checkoutInit(); }
});
