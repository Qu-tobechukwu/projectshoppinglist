/* app.js
   Luxury Stellies front-end: reads /data/*.json, cart, multi-flavour handling,
   discounts, pagination (8 per page), merch add-to-cart, checkout flow.
   Orders are stored locally (pending) when no BACKEND_URL is set.
*/

const DATA_BASE = './data';
const FOOD_URL = `${DATA_BASE}/food.json`;
const MERCH_URL = `${DATA_BASE}/merch.json`;
const SPONSORS_URL = `${DATA_BASE}/sponsors.json`;
const ADDRESSES_URL = `${DATA_BASE}/addresses.json`;

/* If you create a backend endpoint (serverless), set it here to POST orders */
const BACKEND_URL = ""; // e.g. "https://your-server.com/orders"
const YOCO_PUBLIC_KEY = "pk_test_yoco_placeholder"; // replace when ready

/* STATE */
let food = [], merch = [], sponsors = [], addresses = [];
let cart = []; // items: {productId, itemName, type:'food'|'merch', flavour, qty, price}
const PAGE_SIZE = 8;
let currentPage = 1;

/* helpers */
const $ = id => document.getElementById(id);
const fmtR = v => Number(v || 0).toFixed(2);
function saveCart(){ localStorage.setItem('stellies_cart', JSON.stringify(cart)); }
function loadCart(){ cart = JSON.parse(localStorage.getItem('stellies_cart') || '[]'); }
function saveLast(){ localStorage.setItem('stellies_last', JSON.stringify(cart)); }
function loadLast(){ return JSON.parse(localStorage.getItem('stellies_last') || '[]'); }
function addPendingOrder(o){ const arr = JSON.parse(localStorage.getItem('stellies_pending_orders')||'[]'); arr.push(o); localStorage.setItem('stellies_pending_orders', JSON.stringify(arr)); }
function genOrderNo(){ let n = Number(localStorage.getItem('stellies_order_count')||0); n++; localStorage.setItem('stellies_order_count', n); return 'SDP-' + String(n).padStart(4,'0'); }

/* fetch */
async function fetchJson(url){ const res = await fetch(url); if(!res.ok) return []; return await res.json(); }
async function loadAll(){ [food, merch, sponsors, addresses] = await Promise.all([fetchJson(FOOD_URL), fetchJson(MERCH_URL), fetchJson(SPONSORS_URL), fetchJson(ADDRESSES_URL)]); }

/* sponsors */
function renderSponsors(){
  const col = $('sponsorCol'); if(!col) return;
  col.innerHTML = '';
  const now = new Date();
  const active = (sponsors||[]).filter(s=>{
    const startOk = !s.startDate || new Date(s.startDate) <= now;
    const endOk = !s.endDate || new Date(s.endDate) >= now;
    return startOk && endOk;
  }).slice(0,10);
  if(active.length===0){ col.innerHTML = '<div class="sponsor-box">Sponsored content</div>'; return; }
  active.forEach(ad=>{
    const div = document.createElement('div'); div.className='sponsor-box';
    if(ad.image){
      const img = document.createElement('img'); img.src = ad.image; img.style.maxWidth='100%'; img.style.maxHeight='120px';
      if(ad.link){ const a = document.createElement('a'); a.href = ad.link; a.target = '_blank'; a.appendChild(img); div.appendChild(a); }
      else div.appendChild(img);
    } else div.textContent = ad.link || 'Sponsor';
    col.appendChild(div);
  });
}

/* pagination helpers */
function pageCount(arr){ return Math.max(1, Math.ceil(arr.length / PAGE_SIZE)); }
function paged(arr, page){ return arr.slice((page-1)*PAGE_SIZE, (page-1)*PAGE_SIZE + PAGE_SIZE); }

/* render food cards */
function renderFood(page=1){
  currentPage = page;
  const wrap = $('products'); if(!wrap) return;
  wrap.innerHTML = '';
  const list = paged(food, page);
  list.forEach((p, idx)=>{
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `
      <img class="card-image" src="${p.image}" alt="${p.name}" loading="lazy" />
      <div class="card-body">
        <div class="card-title">${p.name}</div>
        <div class="card-desc">${p.description || ''}</div>
        <div class="card-footer">
          <div class="price">R ${fmtR(p.price)}</div>
          <div class="controls">
            ${p.flavours && p.flavours.length ? `<button class="btn ghost btn-flavours" data-id="${p.id}">Choose flavours</button>` : `<input class="qty-input" data-id="${p.id}" type="number" min="1" value="1" /> <input type="checkbox" class="simple-check" data-id="${p.id}" />` }
          </div>
        </div>
        ${p.discountThreshold && p.discountPercent ? `<div class="muted small" style="margin-top:8px;color:var(--gold)">Buy ${p.discountThreshold}+ and get ${p.discountPercent}% off</div>` : ''}
        <div class="flavour-list" id="flavours-${p.id}" style="display:none;"></div>
      </div>
    `;
    wrap.appendChild(card);

    // attach flavour rows if needed
    if(p.flavours && p.flavours.length){
      const flvWrap = card.querySelector(`#flavours-${p.id}`);
      p.flavours.forEach((f,fi)=>{
        const fr = document.createElement('div'); fr.className='flavour-row';
        fr.innerHTML = `<input type="checkbox" class="flv-checkbox" data-id="${p.id}" data-fl="${f}" /> <label>${f}</label> <input class="flv-qty" data-id="${p.id}" data-fl="${f}" type="number" min="0" value="0" />`;
        flvWrap.appendChild(fr);
      });
    }
  });

  // events
  document.querySelectorAll('.btn-flavours').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const id = Number(b.getAttribute('data-id'));
      const el = document.getElementById(`flavours-${id}`);
      if(!el) return;
      el.style.display = el.style.display === 'block' ? 'none' : 'block';
    });
  });

  document.querySelectorAll('.flv-checkbox').forEach(cb=>{
    cb.addEventListener('change', (e)=>{
      const id = Number(cb.getAttribute('data-id'));
      const fl = cb.getAttribute('data-fl');
      const p = food.find(x=>x.id===id);
      const qEl = document.querySelector(`.flv-qty[data-id="${id}"][data-fl="${fl}"]`);
      const q = Math.max(0, Number(qEl.value || 0));
      if(cb.checked){
        const use = q>0 ? q : 1;
        cart = cart.filter(c=> !(c.productId===id && c.flavour===fl && c.type==='food'));
        cart.push({ productId:id, itemName:p.name, type:'food', flavour:fl, qty:use, price:Number(p.price) });
        qEl.value = use;
      } else {
        cart = cart.filter(c=> !(c.productId===id && c.flavour===fl && c.type==='food'));
      }
      saveCart(); updateTotals();
    });
  });

  document.querySelectorAll('.flv-qty').forEach(q=>{
    q.addEventListener('input', (e)=>{
      const id = Number(q.getAttribute('data-id'));
      const fl = q.getAttribute('data-fl');
      const val = Math.max(0, Number(q.value || 0));
      const existing = cart.find(c=> c.productId===id && c.flavour===fl && c.type==='food');
      if(existing){
        if(val<=0){ existing.qty = 0; cart = cart.filter(c=> !(c.productId===id && c.flavour===fl && c.type==='food')); const cb = document.querySelector(`.flv-checkbox[data-id="${id}"][data-fl="${fl}"]`); if(cb) cb.checked=false; }
        else existing.qty = val;
      } else {
        if(val>0){
          const p = food.find(x=>x.id===id);
          cart.push({ productId:id, itemName:p.name, type:'food', flavour:fl, qty:val, price:Number(p.price) });
          const cb = document.querySelector(`.flv-checkbox[data-id="${id}"][data-fl="${fl}"]`); if(cb) cb.checked=true;
        }
      }
      saveCart(); updateTotals();
    });
  });

  document.querySelectorAll('.simple-check').forEach(ch=>{
    ch.addEventListener('change', (e)=>{
      const id = Number(ch.getAttribute('data-id'));
      const p = food.find(x=>x.id===id);
      const qtyEl = document.querySelector(`.qty-input[data-id="${id}"]`);
      if(ch.checked){
        cart = cart.filter(c=> !(c.productId===id && c.type==='food'));
        cart.push({ productId:id, itemName:p.name, type:'food', flavour:'', qty: Number(qtyEl.value)||1, price:Number(p.price) });
      } else {
        cart = cart.filter(c=> !(c.productId===id && c.type==='food'));
      }
      saveCart(); updateTotals();
    });
  });

  document.querySelectorAll('.qty-input').forEach(q=>{
    q.addEventListener('input', (e)=>{
      const id = Number(q.getAttribute('data-id'));
      cart = cart.map(c => c.productId===id && c.type==='food' && c.flavour==='' ? {...c, qty: Number(q.value)||1} : c);
      saveCart(); updateTotals();
    });
  });

  // update pagination UI
  $('pageInfo').textContent = `Page ${currentPage} / ${pageCount(food)}`;
  $('prevPage').disabled = currentPage <= 1;
  $('nextPage').disabled = currentPage >= pageCount(food);

  // restore UI state
  restoreUI();
}

/* restore controls according to cart */
function restoreUI(){
  loadCart();
  // for visible cards set checkboxes/qtys
  document.querySelectorAll('.card').forEach(card=>{
    const nameEl = card.querySelector('.card-title');
    if(!nameEl) return;
    const nm = nameEl.textContent.trim();
    cart.forEach(it=>{
      if(it.itemName === nm && it.type==='food'){
        if(it.flavour){
          const cb = Array.from(card.querySelectorAll('.flv-checkbox')).find(x=> x.getAttribute('data-fl')===it.flavour);
          const q = Array.from(card.querySelectorAll('.flv-qty')).find(x=> x.getAttribute('data-fl')===it.flavour);
          if(cb) cb.checked = true; if(q) q.value = it.qty;
        } else {
          const pchk = card.querySelector('.simple-check');
          const q = card.querySelector('.qty-input');
          if(pchk) pchk.checked = true; if(q) q.value = it.qty;
        }
      }
    });
  });

  updateTotals();
}

/* render merch */
function renderMerch(){
  const wrap = $('merchWrap'); if(!wrap) return;
  wrap.innerHTML = '';
  merch.forEach(m=>{
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <img class="card-image" src="${m.image}" alt="${m.name}" />
      <div class="card-body">
        <div class="card-title">${m.name}</div>
        <div class="card-desc">${m.description||''}</div>
        <div class="card-footer">
          <div class="price">R ${fmtR(m.price)}</div>
          <div class="controls"><button class="btn primary add-merch" data-id="${m.id}">Add to cart</button></div>
        </div>
      </div>
    `;
    wrap.appendChild(card);
  });

  document.querySelectorAll('.add-merch').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id = Number(b.getAttribute('data-id'));
      const item = merch.find(x=>x.id===id);
      cart = cart.filter(c=> !(c.productId===id && c.type==='merch'));
      cart.push({ productId:id, itemName:item.name, type:'merch', flavour:'', qty:1, price:Number(item.price) });
      saveCart(); updateTotals();
      // subtle feedback
      b.textContent = 'Added ✓'; setTimeout(()=>b.textContent='Add to cart',900);
    });
  });
}

/* totals & discounts */
function computeTotals(){
  const groups = {};
  cart.forEach(c=>{
    const key = `${c.itemName}||${c.type}`;
    if(!groups[key]) groups[key] = { name:c.itemName, type:c.type, unitPrice:c.price, qty:0, discountThreshold:0, discountPercent:0, entries:[] };
    groups[key].qty += Number(c.qty||0);
    groups[key].entries.push(c);
    if(c.type==='food'){
      const p = food.find(f=>f.id===c.productId);
      if(p){ groups[key].discountThreshold = Number(p.discountThreshold||0); groups[key].discountPercent = Number(p.discountPercent||0); groups[key].unitPrice = Number(p.price||0); }
    }
  });

  let subtotal = 0, totalDiscount = 0;
  const breakdown = [];
  Object.values(groups).forEach(g=>{
    const s = g.unitPrice * g.qty;
    let discounted = s, d=0;
    if(g.discountThreshold && g.qty >= g.discountThreshold && g.discountPercent){
      discounted = s * (1 - (g.discountPercent/100));
      d = s - discounted;
    }
    subtotal += s; totalDiscount += d;
    breakdown.push({ name:g.name, subtotal:s, discount:d, final: discounted, qty:g.qty });
  });

  const final = subtotal - totalDiscount;
  return { subtotal, totalDiscount, final, breakdown };
}

function updateTotals(){
  const t = computeTotals();
  const totalEl = $('total') || $('topTotal');
  if(totalEl) totalEl.textContent = fmtR(t.final);
  const topTotalEls = document.querySelectorAll('#topTotal,#topTotal2,#topTotal3,#topTotal4');
  topTotalEls.forEach(el=>el.textContent = fmtR(t.final));
}

/* checkout flow */
async function checkoutInit(){
  loadCart();
  const orderNo = genOrderNo();
  localStorage.setItem('orderNumber', orderNo);
  const orderList = JSON.parse(localStorage.getItem('stellies_cart') || '[]');
  const t = computeTotals();

  $('orderNumber') && ($('orderNumber').textContent = orderNo);
  const tb = $('orderTable'); if(tb){ tb.innerHTML = ''; orderList.forEach(i=>{ const tr=document.createElement('tr'); tr.innerHTML = `<td>${i.itemName}</td><td>${i.flavour||'-'}</td><td>${i.qty}</td><td>R ${fmtR(i.price * i.qty)}</td>`; tb.appendChild(tr); }); }

  $('orderSubtotal') && ($('orderSubtotal').textContent = fmtR(t.subtotal));
  $('orderDiscount') && ($('orderDiscount').textContent = fmtR(t.totalDiscount));
  $('orderTotal') && ($('orderTotal').textContent = fmtR(t.final));
  $('orderTip') && ($('orderTip').textContent = '0.00');

  // delivery options
  const sel = $('delivery');
  if(sel){
    sel.innerHTML = '';
    (addresses||[]).forEach(a=>{ const opt=document.createElement('option'); opt.value=a; opt.textContent = a; sel.appendChild(opt); });
  }

  // tip handler
  const tipEl = $('tip'); tipEl && tipEl.addEventListener('input', ()=> {
    const tip = Number(tipEl.value || 0);
    $('orderTip').textContent = fmtR(tip);
    $('orderTotal').textContent = fmtR(t.final + tip);
  });

  // pay button
  const payBtn = $('payButton');
  payBtn && payBtn.addEventListener('click', async ()=>{
    const name = ($('name')||{}).value.trim(); const phone = ($('phone')||{}).value.trim();
    const delivery = ($('delivery')||{}).value; const tip = Number(($('tip')||{}).value || 0);
    if(!name || !phone || !delivery){ alert('Please fill name, phone and delivery address'); return; }
    const finalTotal = computeTotals().final + tip;
    const payload = {
      orderNumber: orderNo,
      name, phone,
      delivery, tip,
      items: JSON.parse(localStorage.getItem('stellies_cart') || '[]'),
      total: finalTotal,
      timestamp: (new Date()).toISOString()
    };

    // if no backend: save pending and download JSON for manual processing
    if(!BACKEND_URL){
      addPendingOrder(payload);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${orderNo}.json`; a.click(); URL.revokeObjectURL(a.href);
      localStorage.setItem('finalTotal', fmtR(finalTotal)); localStorage.setItem('delivery', delivery); localStorage.setItem('orderNumber', orderNo);
      saveLast(); localStorage.removeItem('stellies_cart');
      window.location.href = 'thankyou.html';
      return;
    }

    // If BACKEND_URL is set: POST to your server (server should handle payment ideally)
    try{
      const res = await fetch(BACKEND_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      if(!res.ok) throw new Error('Backend error');
      localStorage.setItem('finalTotal', fmtR(finalTotal)); localStorage.setItem('delivery', delivery); localStorage.setItem('orderNumber', orderNo);
      localStorage.removeItem('stellies_cart');
      window.location.href = 'thankyou.html';
    } catch(err){
      alert('Failed to submit order: ' + err.message);
    }
  });

}

/* events and pagination */
document.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'nextPage'){ if(currentPage < pageCount(food)){ currentPage++; renderFood(currentPage); window.scrollTo({top:0,behavior:'smooth'}); } }
  if(e.target && e.target.id === 'prevPage'){ if(currentPage > 1){ currentPage--; renderFood(currentPage); window.scrollTo({top:0,behavior:'smooth'}); } }
  if(e.target && e.target.id === 'resetCart'){ if(confirm('Clear cart?')){ cart=[]; saveCart(); updateTotals(); restoreUI(); } }
  if(e.target && e.target.id === 'repeatOrder'){ const last = loadLast(); if(!last || last.length===0){ alert('No saved order'); return; } cart = last; saveCart(); updateTotals(); restoreUI(); alert('Previous order restored'); }
  if(e.target && e.target.id === 'finishBtn'){ if(cart.length===0){ alert('Pick something first'); return; } window.location.href='checkout.html'; }
  if(e.target && e.target.id === 'refreshProducts'){ renderFood(currentPage); renderSponsors(); }
  if(e.target && e.target.id === 'viewOrder'){ window.location.href='checkout.html'; }
  if(e.target && e.target.classList && e.target.classList.contains('add-merch')){}
});

/* initialisation */
document.addEventListener('DOMContentLoaded', async ()=>{
  await loadAll();
  loadCart();
  renderFood(currentPage);
  renderMerch();
  renderSponsors();
  updateTotals();

  // checkout page init if present
  if(document.getElementById('orderTable')) checkoutInit();
});
