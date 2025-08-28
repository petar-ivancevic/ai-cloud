'use strict';

/**
 * Word cloud renderer
 * - respects min font size for readability
 * - shows hover tooltip with exact counts
 * - applies sentiment colors consistently (uses global colorFor() if available)
 *
 * Dependencies provided by app.js:
 *   getCounts(), setCounts(), encodeCountsToURL(), decodeCountsFromURL()
 *   sentimentOf(), colorFor()  (if colorFor is missing we provide a fallback)
 */

function bootCloud(){
  const container = document.getElementById('cloud');
  const announce  = document.getElementById('announce');
  const sumEl     = document.getElementById('summary');

  // ---- config knobs ----
  const MIN_FS   = 16;   // minimum font size (px)
  const MAX_FS   = 90;   // max font size (px)
  const PADDING  = 4;    // min pixel spacing between placed words
  const SPIRAL_D = 1.9;  // spiral step
  const ROTATE   = 0;    // 0 keeps all words horizontal for readability

  // Fallback color map if global colorFor() not present
  const fallbackColorFor = (word)=>{
    try{
      if (typeof colorFor === 'function') return colorFor(word);
    }catch(_){}
    const pos = new Set(['excited','curious','optimistic','hopeful','prepared','confident','inspired','amazed','thrilled','fascinated','better','then']);
    const neg = new Set(['scared','terrified','worried','nervous','overwhelmed','unprepared','anxious','doubtful','shitty','dumb']);
    return pos.has(word) ? '#86efac' : (neg.has(word) ? '#fca5a5' : '#93c5fd');
  };

  // Data helpers
  function getData(){
    const fromUrl = (typeof decodeCountsFromURL === 'function') ? decodeCountsFromURL(window.location.search) : null;
    return fromUrl || (typeof getCounts === 'function' ? getCounts() : {});
  }
  function toWords(counts){
    const entries = Object.entries(counts||{}).filter(([w,c])=>c>0);
    entries.sort((a,b)=>b[1]-a[1]);
    const total = entries.reduce((s,[,c])=>s+c,0);
    sumEl.textContent = entries.length
      ? `Total submissions: ${total}. Top: ${entries.slice(0,3).map(([w,c])=>`${w} (${c})`).join(', ')}`
      : 'No submissions yet.';
    return entries.map(([text,count])=>({text,count}));
  }

  // Simple canvas measure to compute text dimensions
  const measureCtx = document.createElement('canvas').getContext('2d');
  function measure(text, size, family='Inter'){
    measureCtx.font = `700 ${size}px ${family}`;
    const w = measureCtx.measureText(text).width;
    const h = size * 1.15;
    return {w, h};
  }

  // Collision helpers
  function overlaps(a,b){
    return !(a.x+a.w < b.x - PADDING ||
             b.x+b.w < a.x - PADDING ||
             a.y+a.h < b.y - PADDING ||
             b.y+b.h < a.y - PADDING);
  }

  // Lightweight spiral placer (no external deps)
  function placeWords(words){
    container.innerHTML = '';
    container.style.position = 'relative';

    const W = container.clientWidth;
    const H = container.clientHeight;
    if (W < 40 || H < 40) return;

    const maxCount = Math.max(...words.map(w=>w.count));
    const boxes = [];

    // Pre-create a tooltip
    const tip = document.createElement('div');
    tip.style.position = 'fixed';
    tip.style.pointerEvents = 'none';
    tip.style.zIndex = '9999';
    tip.style.padding = '4px 8px';
    tip.style.background = 'rgba(0,0,0,.75)';
    tip.style.color = '#fff';
    tip.style.font = '600 12px Inter, system-ui, sans-serif';
    tip.style.borderRadius = '8px';
    tip.style.boxShadow = '0 4px 14px rgba(0,0,0,.35)';
    tip.style.opacity = '0';
    tip.style.transition = 'opacity .12s ease';
    document.body.appendChild(tip);

    function showTip(txt, e){
      tip.textContent = txt;
      tip.style.opacity = '1';
      const x = (e.clientX || 0) + 10, y = (e.clientY || 0) + 12;
      tip.style.transform = `translate(${x}px, ${y}px)`;
    }
    function hideTip(){ tip.style.opacity = '0'; }

    // Try to place each word
    for (const d of words){
      // frequency → font size mapping with floor
      const size = Math.max(
        MIN_FS,
        Math.min(MAX_FS, 16 + (MAX_FS-16) * (Math.log(d.count+1)/Math.log(maxCount+1)))
      );
      const {w,h} = measure(d.text, size);

      // spiral from center
      let angle = 0, radius = 0, placedBox = null, tries = 0;
      while (tries < 1400){
        const x = W/2 + Math.cos(angle)*radius - w/2;
        const y = H/2 + Math.sin(angle)*radius - h/2;
        const box = {x, y, w, h};
        if (x>0 && y>0 && x+w<W && y+h<H && boxes.every(b=>!overlaps(box,b))){
          placedBox = box; break;
        }
        angle += 0.25;
        radius += SPIRAL_D;
        tries++;
      }
      if (!placedBox) continue;
      boxes.push(placedBox);

      // draw
      const span = document.createElement('span');
      span.textContent = d.text;
      span.style.position = 'absolute';
      span.style.left = `${placedBox.x}px`;
      span.style.top = `${placedBox.y}px`;
      span.style.fontFamily = 'Inter, system-ui, sans-serif';
      span.style.fontWeight = '700';
      span.style.fontSize = `${size}px`;
      span.style.lineHeight = '1';
      span.style.color = fallbackColorFor(d.text);
      if (ROTATE) span.style.transform = `rotate(${ROTATE}deg)`;
      span.setAttribute('aria-label', `${d.text}: ${d.count}`);
      span.title = `${d.text}: ${d.count}`;

      span.addEventListener('mouseenter', (e)=> showTip(`${d.text}: ${d.count}`, e));
      span.addEventListener('mousemove', (e)=> showTip(`${d.text}: ${d.count}`, e));
      span.addEventListener('mouseleave', hideTip);

      container.appendChild(span);
    }
  }

  function render(){
    const counts = getData();
    const words  = toWords(counts);
    if (!words.length){
      container.innerHTML = '<p class="muted" style="padding:12px">No data yet. Add a word to see the cloud.</p>';
      return;
    }
    placeWords(words);
  }

  // Wire buttons
  const addBtn = document.getElementById('add-another');
  const shareBtn = document.getElementById('share-link');
  const dlBtn  = document.getElementById('download-png');
  const resetBtn = document.getElementById('reset');

  if (addBtn) addBtn.addEventListener('click', ()=> location.href='index.html');
  if (shareBtn) shareBtn.addEventListener('click', ()=>{
    const url = new URL(location.href);
    url.search = '?data=' + (typeof encodeCountsToURL==='function'
      ? encodeCountsToURL(getData())
      : encodeURIComponent(JSON.stringify(getData())));
    navigator.clipboard.writeText(url.toString());
    if (announce) announce.textContent = 'Shareable link copied.';
  });
  if (dlBtn) dlBtn.addEventListener('click', async ()=>{
    if (!window.html2canvas){
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      await new Promise(r=>{ s.onload=r; document.head.appendChild(s); });
    }
    const canvas = await html2canvas(container);
    const a=document.createElement('a');
    a.href=canvas.toDataURL('image/png');
    a.download='word-cloud.png';
    a.click();
  });
  if (resetBtn) resetBtn.addEventListener('click', ()=>{
    if (confirm('Reset this session’s data on this device?')){
      if (typeof setCounts==='function') setCounts({});
      render();
    }
  });

  render();
  window.addEventListener('resize', ()=> render());
}
