/* script.js — Eden Creates (story mode)
   - Collapsible categories (default closed)
   - Select / deselect items with visual highlight + persistence
   - Toast notifications
   - PWA install button wiring (header/footer)
   - Works across all pages that include the markup above
*/

// ---- CONFIG ----
const SELECTIONS_KEY = 'eden_selections_v1';
const INSTALL_BTN_IDS = ['#installTop','#installTop2','#installTop3','#installTop4','#installTop5','#installTop6','#installBottom','#installBottom2','#installBottom3','#installBottom4','#installBottom5','#installBottom6'];

// ---- HELPERS ----
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const saveSelections = (arr) => localStorage.setItem(SELECTIONS_KEY, JSON.stringify(arr || []));
const readSelections = () => { try{ return JSON.parse(localStorage.getItem(SELECTIONS_KEY)) || []; }catch(e){ return []; } };
const fmt = (n) => Number(n).toFixed(2);

// ---- COLLAPSIBLES: default closed ----
function initCollapsibles(){
  // all .category-toggle control panels with id in data-target
  $$('.category-toggle').forEach(btn=>{
    const target = btn.dataset.target;
    const panel = document.getElementById(target);
    if(!panel) return;
    // start collapsed
    panel.classList.add('collapse');
    btn.textContent = 'Show';
    btn.addEventListener('click', ()=>{
      const isClosed = panel.classList.contains('collapse');
      if(isClosed){
        panel.classList.remove('collapse');
        btn.textContent = 'Hide';
      } else {
        panel.classList.add('collapse');
        btn.textContent = 'Show';
      }
    });
  });
}

// ---- SELECT / DESELECT items ----
function initSelectableCards(){
  // on pages: product-card elements with data-id and .add-btn inside
  $$('.product-card').forEach(card=>{
    const id = card.dataset.id;
    const btn = card.querySelector('.add-btn');
    // restore state if selected
    const selections = readSelections();
    if(selections.includes(id)){
      card.classList.add('selected');
      if(btn){ btn.classList.add('added'); btn.textContent = 'Selected ✓'; }
    }
    // click on card toggles selection (ignore clicks on links/buttons inside)
    card.addEventListener('click', (e)=>{
      if(e.target.tagName.toLowerCase() === 'button' || e.target.tagName.toLowerCase() === 'a') return;
      toggleSelection(id, card, btn);
    });
    if(btn){
      btn.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        toggleSelection(id, card, btn);
      });
    }
  });
}

function toggleSelection(id, cardEl, btnEl){
  const selections = readSelections();
  const idx = selections.indexOf(id);
  if(idx === -1){
    // add
    selections.push(id);
    saveSelections(selections);
    cardEl.classList.add('selected');
    if(btnEl){ btnEl.classList.add('added'); btnEl.textContent = 'Selected ✓'; }
    showToast('Selected');
  } else {
    // remove
    selections.splice(idx,1);
    saveSelections(selections);
    cardEl.classList.remove('selected');
    if(btnEl){ btnEl.classList.remove('added'); btnEl.textContent = 'select'; }
    showToast('Removed');
  }
  // optional: dispatch event for other parts of the app
  window.dispatchEvent(new CustomEvent('selections:changed', { detail: readSelections() }));
}

// ---- TOAST ----
function showToast(msg, time=1200){
  const t = document.createElement('div');
  t.className = 'toast show';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.classList.remove('show'), time-200);
  setTimeout(()=> t.remove(), time);
}

// ---- PWA INSTALL BUTTONS ----
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  INSTALL_BTN_IDS.forEach(id=>{
    const b = document.querySelector(id);
    if(b) b.style.display = 'inline-block';
  });
});
function setupInstallButtons(){
  INSTALL_BTN_IDS.forEach(id=>{
    const btn = document.querySelector(id);
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

// ---- small UI helpers (for dev/testing) ----
function exposeSelectionsCount(){
  // handy: show count in console when changed
  window.addEventListener('selections:changed', (e) => {
    console.info('Selections:', e.detail);
  });
}

// ---- BOOT ----
document.addEventListener('DOMContentLoaded', () => {
  initCollapsibles();
  initSelectableCards();
  setupInstallButtons();
  exposeSelectionsCount();
});
