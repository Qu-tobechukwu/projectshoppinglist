/* checkout.js
 - Loads cart from localStorage and renders the checkout summary
 - Fetches addresses from ./data/addresses.json and populates the dropdown
 - Sends order to your Google Apps Script endpoint (doPost) as JSON
 - Keeps UX airy & shows toasts (uses same .stellies-toast style from style.css)
*/

// CONFIG: your Google Apps Script/Web App URL (doPost expects JSON)
const GAS_URL = "https://script.google.com/macros/s/AKfycbwxP_vLG1PXl4l4_eKi_DTdK1duFwQiscXDDNqkFVcpdIuR_x212lHUp2rQJahWJKRS/exec";

// helpers
const $ = id => document.getElementById(id);
const fmt = v => Number(v||0).toFixed(2);

function toast(msg, timeout = 2400) {
  const t = document.createElement('div');
  t.className = 'stellies-toast';
  t.innerHTML = msg;
  document.body.appendChild(t);
  // trigger animation
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(()=> { t.classList.remove('show'); setTimeout(()=> t.remove(), 300); }, timeout);
}

// read cart
function loadCartLocal(){
  try{
    return JSON.parse(localStorage.getItem('stellies_cart') || '[]');
  } catch(e){
    return [];
  }
}

// compute totals with simple bulk discount rules if present in products data
async function computeTotalsLocal(){
  // try to get products data to find discounts/prices
  let products = [];
  try{
    const r = await fetch('./data/products.json');
    if(r.ok){
      const j = await r.json();
      products = j.food || [];
    }
  }catch(e){ products = []; }

  const cart = loadCartLocal();
  const groups = {};
  cart.forEach(item=>{
    const key = `${item.itemName}||${item.type||'food'}`;
    if(!groups[key]) groups[key] = { name:item.itemName, qty:0, unitPrice: item.price || 0, discountThreshold:0, discountPercent:0, entries:[] };
    groups[key].qty += Number(item.qty || 0);
    groups[key].entries.push(item);
    const p = products.find(x => x.id === item.productId);
    if(p){
      groups[key].unitPrice = Number(p.price || groups[key].unitPrice);
      groups[key].discountThreshold = Number(p.discountThreshold || 0);
      groups[key].discountPercent = Number(p.discountPercent || 0);
    }
  });

  let subtotal = 0, totalDiscount = 0;
  const breakdown = [];
  Object.values(groups).forEach(g=>{
    const s = g.unitPrice * g.qty;
    let final = s, discount = 0;
    if(g.discountThreshold && g.qty >= g.discountThreshold && g.discountPercent){
      final = s * (1 - g.discountPercent/100);
      discount = s - final;
    }
    subtotal += s; totalDiscount += discount;
    breakdown.push({ name: g.name, qty: g.qty, subtotal: s, discount, final });
  });

  return { subtotal, totalDiscount, final: subtotal - totalDiscount, breakdown, rawCart: cart };
}

// render order table & totals
async function renderOrder(){
  const table = $('orderTable');
  const orderNumberEl = $('orderNumber');
  if(!table || !orderNumberEl) return;
  const orderNo = localStorage.getItem('orderNumber') || ('EC-' + String(Date.now()).slice(-6));
  orderNumberEl.textContent = orderNo;

  const t = await computeTotalsLocal();
  const list = t.rawCart || [];

  table.innerHTML = '';
  if(!list.length){
    table.innerHTML = `<tr><td colspan="4" class="muted">Your cart is empty</td></tr>`;
  } else {
    list.forEach(i=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(i.itemName)}</td><td>${escapeHtml(i.flavour || '-')}</td><td>${i.qty}</td><td>R ${fmt(i.price * i.qty)}</td>`;
      table.appendChild(tr);
    });
  }

  $('orderSubtotal').textContent = fmt(t.subtotal);
  $('orderDiscount').textContent = fmt(t.totalDiscount);
  $('orderTotal').textContent = fmt(t.final);
}

// simple escape
function escapeHtml(s){ if(!s && s !== 0) return ''; return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// load addresses and populate dropdown
async function loadAddresses(){
  const sel = $('delivery');
  if(!sel) return;
  sel.innerHTML = `<option>Loading addresses…</option>`;
  try{
    const res = await fetch('./data/addresses.json');
    if(!res.ok) throw new Error('Failed to load addresses');
    const j = await res.json();
    const addresses = j.addresses || [];
    sel.innerHTML = '';
    if(addresses.length === 0){
      sel.innerHTML = `<option value="">No addresses available</option>`;
    } else {
      addresses.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        sel.appendChild(opt);
      });
    }
  } catch(err){
    console.error(err);
    sel.innerHTML = `<option value="">Error loading addresses</option>`;
  }
}

// submit order to Google Apps Script
async function submitOrderToSheet(payload){
  // Google Apps Script expects POST (doPost) with JSON body
  try{
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await res.json();
    return j;
  } catch(err){
    console.error(err);
    throw err;
  }
}

// on load: render & wire buttons
document.addEventListener('DOMContentLoaded', async ()=>{
  await renderOrder();
  await loadAddresses();

  // show totals in header pill
  const totals = await computeTotalsLocal();
  const tops = document.querySelectorAll('#topTotalC,#topTotal,#topTotalM');
  tops.forEach(el => el.textContent = fmt(totals.final));

  // wire edit order
  $('editButton') && $('editButton').addEventListener('click', ()=> {
    window.location.href = './index.html';
  });

  // wire pay/place order
  $('payButton') && $('payButton').addEventListener('click', async (evt) => {
    evt.preventDefault();
    const name = ($('name')||{}).value.trim();
    const email = ($('email')||{}).value.trim();
    const delivery = ($('delivery')||{}).value;
    const notes = ($('notes')||{}).value.trim();
    if(!name || !email || !delivery){
      alert('Please fill Name, Email and choose a delivery address.');
      return;
    }
    const t = await computeTotalsLocal();
    const finalTotal = t.final;
    const orderNumber = localStorage.getItem('orderNumber') || ('EC-' + String(Date.now()).slice(-6));

    const payload = {
      orderNumber: orderNumber,
      name: name,
      phone: "",                // optional (left empty)
      email: email,
      delivery: delivery,
      tip: 0,
      notes: notes,
      items: t.rawCart.map(i => ({ itemName: i.itemName, flavour: i.flavour || "", qty: i.qty, price: i.price })),
      total: finalTotal,
      timestamp: new Date().toISOString(),
      paymentToken: ""
    };

    // UX
    $('payButton').disabled = true;
    $('payButton').textContent = 'Placing...';

    try{
      const resp = await submitOrderToSheet(payload);
      // expect success:true from your doPost
      if(resp && resp.success){
        localStorage.setItem('orderNumber', orderNumber);
        localStorage.setItem('finalTotal', fmt(finalTotal));
        localStorage.setItem('delivery', delivery);
        // clear cart
        localStorage.removeItem('stellies_cart');
        toast('Order placed — thank you! ✨', 2000);
        setTimeout(()=> window.location.href = './thankyou.html', 900);
        return;
      } else {
        // fallback: save pending
        addPendingLocal(payload);
        toast('Saved offline — will submit when online', 2400);
        setTimeout(()=> window.location.href = './thankyou.html', 900);
      }
    } catch(err){
      console.error(err);
      addPendingLocal(payload);
      toast('Saved offline — will submit when online', 2400);
      setTimeout(()=> window.location.href = './thankyou.html', 900);
    } finally {
      $('payButton').disabled = false;
      $('payButton').textContent = 'Place Order';
    }
  });
});

// store pending locally
function addPendingLocal(payload){
  try{
    const arr = JSON.parse(localStorage.getItem('stellies_pending_orders') || '[]');
    arr.push(payload);
    localStorage.setItem('stellies_pending_orders', JSON.stringify(arr));
  } catch(e){ console.error(e); }
}
