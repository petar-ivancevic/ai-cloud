'use strict';

/* ===========================================================
   Shared helpers that were already used by the site
   (kept for local fallback, URL share, and sentiment colors)
=========================================================== */
const STOPLIST = new Set(["the","and","a","an","of","in","on","to","for","with","is","are"]);
const PROFANE = new Set(["fuck","shit","bitch","asshole","cunt","dick"]);
const STEM_MAP = new Map([
  ["excite","excited"],["exciting","excited"],["excitement","excited"],
  ["scare","scared"],["terrify","terrified"],["worry","worried"],
  ["prepare","prepared"],["un-?prepare(d)?","unprepared"]
]);

function normalizeWord(w){
  if(!w) return "";
  let s = (""+w).toLowerCase().trim().replace(/[^a-z\-]/g,"");
  if(!s || STOPLIST.has(s)) return "";
  for(const [k,v] of STEM_MAP){ if(new RegExp(`^${k}$`).test(s)){ s=v; break; } }
  return s;
}
function isAllowed(w){ return w && !PROFANE.has(w); }

const KEY = 'ai-feelings-counts.v1';
function getCounts(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch{ return {}; } }
function setCounts(obj){ localStorage.setItem(KEY, JSON.stringify(obj||{})); }
function incrementWordLocal(w){ const c=getCounts(); c[w]=(c[w]||0)+1; setCounts(c); }

function encodeCountsToURL(counts){
  const json = JSON.stringify(counts||{});
  return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
}
function decodeCountsFromURL(search){
  const params=new URLSearchParams(search.startsWith('?')?search.slice(1):search);
  const data=params.get('data'); if(!data) return null;
  try{ const json=decodeURIComponent(escape(atob(decodeURIComponent(data)))); return JSON.parse(json); }catch{return null;}
}

// Sentiment & colors (used by pills + cloud)
function sentimentOf(word){
  const pos = new Set(["excited","curious","optimistic","hopeful","prepared","confident","inspired","amazed","thrilled","fascinated","better"]);
  const neg = new Set(["scared","terrified","worried","nervous","overwhelmed","unprepared","anxious","doubtful","shitty","dumb"]);
  if(pos.has(word)) return 'positive';
  if(neg.has(word)) return 'negative';
  return 'neutral';
}
function colorFor(word){
  const s = sentimentOf(word);
  return s==='positive' ? '#86efac' : s==='negative' ? '#fca5a5' : '#93c5fd';
}

/* ===========================================================
   Supabase client (loads on demand, works on static hosting)
=========================================================== */
const SUPABASE_URL  = https://lztmtpdaczqowhmqpyzh.supabase.co;   // <- paste from Settings → API
const SUPABASE_ANON = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dG10cGRhY3pxb3dobXFweXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NDE0MTEsImV4cCI6MjA3MjAxNzQxMX0.FTFyI5HWFJaZqaXPe6EgOSvRngjfFaKpkWsGwFUQ9do;                   // <- paste from Settings → API

let sbClientPromise = null;
function initSupabase(){
  if (sbClientPromise) return sbClientPromise;
  sbClientPromise = new Promise((resolve, reject)=>{
    if (window.supabase) {
      return resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON));
    }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
    s.onload = ()=> resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON));
    s.onerror = ()=> reject(new Error('Failed to load Supabase SDK'));
    document.head.appendChild(s);
  });
  return sbClientPromise;
}

// Read the "room" from URL (?room=acme101) so you can segment workshops
function currentRoom(){
  const p = new URLSearchParams(location.search); 
  const room = (p.get('room')||'default').trim().toLowerCase();
  return room || 'default';
}

/* ===========================================================
   Submit flow used by the home page
=========================================================== */
async function submitWord(word){
  const norm = normalizeWord(word);
  if (!norm) throw new Error('Invalid');
  if (!isAllowed(norm)) throw new Error('Blocked');

  // Try Supabase first
  try{
    const sb = await initSupabase();
    const room = currentRoom();
    const { error } = await sb.from('feelings').insert({ room, word: norm });
    if (error) throw error;
  }catch(e){
    console.warn('[supabase insert failed] falling back to localStorage:', e?.message || e);
    incrementWordLocal(norm); // fallback so the UX still works offline
  }

  // Navigate to the shared cloud (keep same room)
  const url = new URL(location.origin + location.pathname.replace(/index\.html?$/i,'') + 'cloud.html');
  const r = currentRoom();
  if (r && r !== 'default') url.searchParams.set('room', r);
  location.href = url.toString();
}

/* ===========================================================
   Wire up the existing home page form + pills
=========================================================== */
(function bootstrapHome(){
  const form = document.getElementById('feeling-form');
  const input = document.getElementById('feeling-input');
  const helper = document.getElementById('helper');
  const submitBtn = document.getElementById('submit-btn');

  if (!form || !input) return; // not on the home page

  let lastSubmit = 0;
  async function handleSubmitWord(raw){
    const now = Date.now();
    if (now - lastSubmit < 600) return;
    lastSubmit = now;
    try{
      await submitWord(raw);
      submitBtn?.classList?.add('success');
      setTimeout(()=> submitBtn?.classList?.remove('success'), 500);
    }catch{
      helper.textContent = 'Please enter one clean word (letters only).';
    }
  }

  form.addEventListener('submit', (e)=>{ e.preventDefault(); handleSubmitWord(input.value); });

  // Buttons on the card
  const viewCloud = document.getElementById('view-cloud');
  if (viewCloud) viewCloud.addEventListener('click', ()=>{
    const url = new URL(location.origin + location.pathname.replace(/index\.html?$/i,'') + 'cloud.html');
    const r = currentRoom();
    if (r && r !== 'default') url.searchParams.set('room', r);
    location.href = url.toString();
  });
  const resetSession = document.getElementById('reset-session');
  if (resetSession) resetSession.addEventListener('click', ()=>{
    if (confirm('Reset local session data on this device?')) setCounts({});
  });

  // Floating pills: submit on pick
  if (typeof startPills === 'function'){
    startPills({
      container: document.getElementById('pill-layer'),
      obstacleEl: document.getElementById('prompt-card'),
      onPick: (w)=> handleSubmitWord(w)
    });
  }
})();

/* ===========================================================
   Export bits used by cloud.js (unchanged)
=========================================================== */
window.getCounts = getCounts;
window.setCounts = setCounts;
window.encodeCountsToURL = encodeCountsToURL;
window.decodeCountsFromURL = decodeCountsFromURL;
window.sentimentOf = sentimentOf;
window.colorFor = colorFor;
window.initSupabase = initSupabase;
window.currentRoom = currentRoom;
