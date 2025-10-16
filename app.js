/* app.js — Golden Grove frontend
   Mobile-first; reads /data/*.json; posts orders to Netlify function /.netlify/functions/order
*/

const DATA_PRODUCTS = '/data/products.json';
const DATA_MERCH = '/data/merch.json';
const DATA_ADS = '/data/ads.json';
const DATA_ORDERS = '/data/orders.json'; // sample admin demo
const BACKEND_FN = '/.netlify/functions/order'; // Netlify function endpoint

let store = { food: [], merch: [], sponsors: [], addresses: [] };
let cart = []; // { productId, itemName, type:'food'|'merch', flavour, qty, price }
const PAGE_SIZE = 6;
let currentPage = 1;

/* PWA install prompt */
let deferredPrompt = null;
const installBanner = document.getElementById('sw-banner');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('sw-banner');
  if (banner) banner.hidden = false;
  const footerBtn = document.getElementById('installFooter');
  if (footerBtn) footerBtn.hidden = false;
});
document.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'installPromptBtn'){ doInstall(); }
  if(e.target && e.target.id === 'dismissInstall'){ document.getElementById('sw-banner').hidden = true; }
});

async function doInstall(){
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('sw-banner').hidden = true;
  document.getElementById('installFooter').hidden = true;
}

/* helpers */
const $ = id => document.getElementById(id);
const fmt = v => Number(v||0).toFixed(2);
function saveCart(){ localStorage.setItem('gg_cart', JSON.stringify(cart)); }
function loadCart(){ cart = JSON.parse(localStorage.getItem('gg_cart') || '[]'); }
function saveLast(){ localStorage.setItem('gg_last', JSON.stringify(cart)); }
function loadLast(){ return JSON.parse(localStorage.getItem('gg_last') || '[]'); }
function addPending(o){ const arr = JSON.parse(localStorage.getItem('gg_pending')||'[]'); arr.push(o); localStorage.setItem('gg_pending', JSON.stringify(arr)); }
function genOrderNo(){ let n = Number(localStorage.getItem('gg_order_count')||0); n++; localStorage.setItem('gg_order_count', n); return 'GG-' + String(n).padStart(4,'0'); }

/* fetch JSON */
async function fetchJson(url){ try{ const r = await fetch(url); if(!r.ok) throw new Error('Fetch failed'); return await r.json(); } catch(e){ console.warn(e); return null; } }

async function loadData(){
  const [p,m,a,o] = await Promise.all([fetchJson(DATA_PRODUCTS), fetchJson(DATA_MERCH), fetchJson(DATA_ADS), fetchJson(DATA_ORDERS)]);
  store.food = p && p.food ? p.food : (p || []);
  store.merch = m || [];
  store.sponsors = a || [];
  store.addresses = (p && p.addresses) ? p.addresses : ["Irene Residence","Metanoia Residence","Wilgenhof Residence","Rooiplein Market (Pickup)"];
}

/* render sponsors: desktop column + mobile banners */
function renderSponsors(){
  const col = $('sponsorCol');
  const mobile = $('sponsorsMobile');
  if(col) col.innerHTML = '';
  if(mobile) mobile.innerHTML = '';
  const now = new Date();
  const active = (store.sponsors||[]).filter(s => (!s.startDate || new Date(s.startDate) <= now) && (!s.endDate || new Date(s.endDate) >= now)).slice(0,10);
  active.forEach(ad=>{
    if(col){
      const box = document.createElement('div'); box.className='card'; box.style.padding='10px'; box.innerHTML = `<a href="${ad.link||'#'}" target="_blank" rel="noopener"><img src="${ad.image}" style="width:100%;border-radius:8px" alt="Ad"></a>`;
      col.appendChild(box);
    }
    if(mobile){
      const b = document.createElement('div'); b.className='card'; b.style.margin='12px 0'; b.innerHTML = `<a href="${ad.link||'#'}" target="_blank" rel="noopener"><img src="${ad.image}" style="width:100%;height:120px;object-fit:cover;border-radius:8px" alt="Ad"></a>`;
      mobile.appendChild(b);
    }
  });
}

/* pagination util */
function pageCount(arr){ return Math.max(1, Math.ceil((arr||[]).length / PAGE_SIZE)); }
function paged(arr, page){ return (arr||[]).slice((page-1)*PAGE_SIZE, (page-1)*PAGE_SIZE + PAGE_SIZE); }

/* render products (mobile-first) */
function renderProducts(page=1){
  currentPage = page;
  const wrap = $('products'); if(!wrap) return;
  wrap.innerHTML = '';
  const list = paged(store.food, page);

  list.forEach(p=>{
    const card = document.createElement('article'); card.className='card';
    card.innerHTML = `
      <img class="card-image" src="${p.image}" alt="${p.name}" loading="lazy" />
      <div class="card-body">
        <div class="card-title">${p.name}</div>
        <div class="card-desc">${p.description||''}</div>
        <div class="card-footer">
          <div class="price">R ${fmt(p.price)}</div>
          <div class="controls"></div>
        </div>
        ${p.discountThreshold && p.discountPercent ? `<div class="muted small" style="margin-top:8px;color:var(--leaf)">Buy ${p.discountThreshold}+ & get ${p.discountPercent}% off</div>` : ''}
        <div class="flavour-list" id="flv-${p.id}" style="display:none"></div>
      </div>
    `;
    wrap.appendChild(card);

    const controls = card.querySelector('.controls');
    if(p.flavours && p.flavours.length){
      const btn = document.createElement('button'); btn.className='btn ghost'; btn.textContent='Choose flavours';
      btn.addEventListener('click', ()=> {
        const flv = card.querySelector(`#flv-${p.id}`);
        if(!flv) return;
        flv.style.display = flv.style.display === 'block' ? 'none' : 'block';
      });
      controls.appendChild(btn);
      const flvWrap = card.querySelector(`#flv-${p.id}`);
      p.flavours.forEach(f=>{
        const fr = document.createElement('div'); fr.className='flavour-row';
        fr.innerHTML = `<input type="checkbox" class="flv-cb" data-id="${p.id}" data-fl="${f}" /> <label>${f}</label> <input class="flv-qty" data-id="${p.id}" data-fl="${f}" type="number" min="0" value="0" />`;
        flvWrap.appendChild(fr);
      });
    } else {
      const qty = document.createElement('input'); qty.type='number'; qty.min=1; qty.value=1; qty.className='flv-qty';
      qty.style.width='80px';
      const chk = document.createElement('input'); chk.type='checkbox'; chk.className='simple-check'; chk.dataset.id = p.id;
      controls.appendChild(qty); controls.appendChild(chk);
      chk.addEventListener('change', ()=>{
        if(chk.checked){
          cart = cart.filter(c => !(c.productId===p.id && c.type==='food' && c.flavour===''));
          cart.push({ productId:p.id, itemName:p.name, type:'food', flavour:'', qty:Number(qty.value)||1, price:Number(p.price) });
        } else {
          cart = cart.filter(c => !(c.productId===p.id && c.type==='food' && c.flavour===''));
        }
        saveCart(); updateTotals();
      });
      qty.addEventListener('input', ()=>{
        cart = cart.map(c => (c.productId===p.id && c.type==='food' && c.flavour==='') ? {...c, qty:Number(qty.value)||1} : c);
        saveCart(); updateTotals();
      });
    }
  });

  /* flavour checkbox & qty events */
  document.querySelectorAll('.flv-cb').forEach(cb => cb.addEventListener('change', ()=>{
    const id = Number(cb.dataset.id); const fl = cb.dataset.fl; const qtyEl = document.querySelector(`.flv-qty[data-id="${id}"][data-fl="${fl}"]`);
    const q = qtyEl ? Math.max(0, Number(qtyEl.value||0)) : 1;
    const p = store.food.find(x=>x.id===id);
    if(cb.checked){
      const use = q>0? q : 1;
      cart = cart.filter(c => !(c.productId===id && c.flavour===fl && c.type==='food'));
      cart.push({ productId:id, itemName:p.name, type:'food', flavour:fl, qty:use, price:Number(p.price) });
      if(qtyEl) qtyEl.value = use;
    } else {
      cart = cart.filter(c => !(c.productId===id && c.flavour===fl && c.type==='food'));
    }
    saveCart(); updateTotals();
  }));

  document.querySelectorAll('.flv-qty[data-fl]').forEach(qel => qel.addEventListener('input', ()=>{
    const id = Number(qel.dataset.id); const fl = qel.dataset.fl; const qty = Math.max(0, Number(qel.value||0));
    const existing = cart.find(c => c.productId===id && c.flavour===fl && c.type==='food');
    if(existing){
      if(qty<=0){ cart = cart.filter(c => !(c.productId===id && c.flavour===fl && c.type==='food')); const cb=document.querySelector(`.flv-cb[data-id="${id}"][data-fl="${fl}"]`); if(cb) cb.checked=false; }
      else existing.qty = qty;
    } else {
      if(qty>0){ const p=store.food.find(x=>x.id===id); cart.push({ productId:id, itemName:p.name, type:'food', flavour:fl, qty:qty, price:Number(p.price)}); const cb=document.querySelector(`.flv-cb[data-id="${id}"][data-fl="${fl}"]`); if(cb) cb.checked=true; }
    }
    saveCart(); updateTotals();
  }));

  $('pageInfo').textContent = `Page ${currentPage} / ${pageCount(store.food)}`;
  $('prevPage').disabled = currentPage <= 1;
  $('nextPage').disabled = currentPage >= pageCount(store.food);
  restoreUI(); updateTotals();
}

/* restore UI */
function restoreUI(){
  loadCart();
  document.querySelectorAll('.card').forEach(card=>{
    const title = card.querySelector('.card-title'); if(!title) return;
    const nm = title.textContent.trim();
    cart.forEach(it=>{
      if(it.itemName === nm && it.type==='food'){
        if(it.flavour){
          const cb = Array.from(card.querySelectorAll('.flv-cb')).find(x=>x.dataset.fl === it.flavour);
          const q = Array.from(card.querySelectorAll('.flv-qty')).find(x=>x.dataset.fl === it.flavour);
          if(cb) cb.checked=true; if(q) q.value = it.qty;
        } else {
          const pchk = card.querySelector('.simple-check'); const q=card.querySelector('.flv-qty');
          if(pchk) pchk.checked=true; if(q) q.value = it.qty;
        }
      }
    });
  });
}

/* merch rendering */
function renderMerch(){
  const wrap = $('merchWrap'); if(!wrap) return;
  wrap.innerHTML = '';
  store.merch.forEach(m=>{
    const card = document.createElement('article'); card.className='card';
    card.innerHTML = `<img class="card-image" src="${m.image}" alt="${m.name}" loading="lazy" /><div class="card-body"><div class="card-title">${m.name}</div><div class="card-desc">${m.description||''}</div><div class="card-footer"><div class="price">R ${fmt(m.price)}</div><div class="controls"><button class="btn primary add-merch" data-id="${m.id}">Add to cart</button></div></div></div>`;
    wrap.appendChild(card);
  });
  document.querySelectorAll('.add-merch').forEach(b=>b.addEventListener('click', ()=>{
    const id = Number(b.dataset.id); const item = store.merch.find(x=>x.id===id);
    cart = cart.filter(c => !(c.productId===id && c.type==='merch')); cart.push({ productId:id, itemName:item.name, type:'merch', flavour:'', qty:1, price:Number(item.price) });
    saveCart(); updateTotals(); b.textContent='Added ✓'; setTimeout(()=>b.textContent='Add to cart',900);
  }));
}

/* totals & discounts */
function computeTotals(){
  const groups = {};
  cart.forEach(c => {
    const key = `${c.itemName}||${c.type}`;
    if(!groups[key]) groups[key] = { name:c.itemName, type:c.type, unitPrice:c.price, qty:0, discountThreshold:0, discountPercent:0, entries:[] };
    groups[key].qty += Number(c.qty || 0);
    groups[key].entries.push(c);
    if(c.type==='food'){
      const p = store.food.find(f => f.id === c.productId);
      if(p){ groups[key].discountThreshold = Number(p.discountThreshold||0); groups[key].discountPercent = Number(p.discountPercent||0); groups[key].unitPrice = Number(p.price||0); }
    }
  });

  let subtotal=0, totalDiscount=0;
  const breakdown=[];
  Object.values(groups).forEach(g=>{
    const s = g.unitPrice * g.qty;
    let discounted = s, d=0;
    if(g.discountThreshold && g.qty >= g.discountThreshold && g.discountPercent){
      discounted = s * (1 - g.discountPercent/100);
      d = s - discounted;
    }
    subtotal += s; totalDiscount += d;
    breakdown.push({name:g.name, qty:g.qty, subtotal:s, discount:d, final:discounted});
  });
  return {subtotal, totalDiscount, final: subtotal - totalDiscount, breakdown};
}

function updateTotals(){
  const t = computeTotals();
  if($('total')) $('total').textContent = fmt(t.final);
  const tops = document.querySelectorAll('#topTotal,#topTotalM,#topTotalC');
  tops.forEach(el => el.textContent = fmt(t.final));
}

/* checkout flow */
async function checkoutInit(){
  loadCart();
  const orderNo = genOrderNo();
  localStorage.setItem('orderNumber', orderNo);
  const orderList = JSON.parse(localStorage.getItem('gg_cart') || '[]');
  const totals = computeTotals();

  if($('orderNumber')) $('orderNumber').textContent = orderNo;
  const table = $('orderTable'); if(table){ table.innerHTML=''; orderList.forEach(i=>{ const tr=document.createElement('tr'); tr.innerHTML = `<td>${i.itemName}</td><td>${i.flavour||'-'}</td><td>${i.qty}</td><td>R ${fmt(i.price * i.qty)}</td>`; table.appendChild(tr); }); }

  if($('orderSubtotal')) $('orderSubtotal').textContent = fmt(totals.subtotal);
  if($('orderDiscount')) $('orderDiscount').textContent = fmt(totals.totalDiscount);
  if($('orderTotal')) $('orderTotal').textContent = fmt(totals.final);
  if($('orderTip')) $('orderTip').textContent = '0.00';

  // addresses
  const sel = $('delivery');
  if(sel){ sel.innerHTML = ''; (store.addresses||[]).forEach(a => { const opt=document.createElement('option'); opt.value=a; opt.textContent=a; sel.appendChild(opt); }); }

  const tipEl = $('tip');
  tipEl && tipEl.addEventListener('input', ()=> {
    const tip = Number(tipEl.value || 0);
    if($('orderTip')) $('orderTip').textContent = fmt(tip);
    if($('orderTotal')) $('orderTotal').textContent = fmt(totals.final + tip);
  });

  const payBtn = $('payButton');
  payBtn && payBtn.addEventListener('click', async ()=>{
    const name = ($('name')||{}).value.trim(); const phone = ($('phone')||{}).value.trim();
    const email = ($('email')||{}).value.trim(); const delivery = ($('delivery')||{}).value; const tip = Number(($('tip')||{}).value || 0);
    if(!name || !phone || !delivery){ alert('Please fill in name, phone and delivery address'); return; }
    const finalTotal = computeTotals().final + tip;
    const payload = {
      orderNumber: orderNo,
      name, phone, email, delivery, tip, notes: ($('notes')||{}).value || '',
      items: orderList, total: finalTotal, timestamp: (new Date()).toISOString()
    };

    // POST to backend function
    try{
      const res = await fetch(BACKEND_FN, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const j = await res.json();
      if(!j.success) throw new Error(j.message || 'Backend failed');
      localStorage.setItem('finalTotal', fmt(finalTotal)); localStorage.setItem('delivery', delivery); localStorage.setItem('orderNumber', orderNo);
      saveLast(); localStorage.removeItem('gg_cart');
      window.location.href = 'thankyou.html';
    } catch(err){
      console.error(err);
      addPending(payload);
      const blob = new Blob([JSON.stringify(payload,null,2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${orderNo}.json`; a.click(); URL.revokeObjectURL(a.href);
      localStorage.setItem('finalTotal', fmt(finalTotal)); localStorage.setItem('delivery', delivery); localStorage.setItem('orderNumber', orderNo);
      saveLast(); localStorage.removeItem('gg_cart');
      window.location.href = 'thankyou.html';
    }
  });
}

/* event bindings */
document.addEventListener('click', e=>{
  if(e.target && e.target.id === 'nextPage'){ if(currentPage < pageCount(store.food)){ currentPage++; renderProducts(currentPage); window.scrollTo({top:0,behavior:'smooth'}); } }
  if(e.target && e.target.id === 'prevPage'){ if(currentPage > 1){ currentPage--; renderProducts(currentPage); window.scrollTo({top:0,behavior:'smooth'}); } }
  if(e.target && e.target.id === 'resetCart'){ if(confirm('Clear your cart?')){ cart=[]; saveCart(); updateTotals(); renderProducts(currentPage); } }
  if(e.target && e.target.id === 'repeatOrder'){ const last = loadLast(); if(!last || last.length===0){ alert('No previous order saved'); return; } cart = last; saveCart(); updateTotals(); renderProducts(currentPage); alert('Previous order restored'); }
  if(e.target && e.target.id === 'finishBtn'){ loadCart(); if(cart.length===0){ alert('Please choose something first'); return; } window.location.href = 'checkout.html'; }
  if(e.target && e.target.classList && e.target.classList.contains('add-to-cart')) {
    // support direct add-to-cart (if used elsewhere)
    const pid = Number(e.target.dataset.id);
    const p = store.food.find(x=>x.id===pid);
    if(p){ cart.push({ productId:p.id, itemName:p.name, type:'food', flavour:'', qty:1, price:p.price }); saveCart(); updateTotals(); }
  }
});

/* init */
document.addEventListener('DOMContentLoaded', async ()=>{
  await loadData();
  loadCart();
  renderProducts(currentPage);
  renderMerch();
  renderSponsors();
  updateTotals();
  if(document.getElementById('orderTable')) checkoutInit();
});
