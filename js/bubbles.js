'use strict';

/**
 * Floating sentiment pills with:
 *  - gentle constant motion (wander) so they never stop
 *  - pairwise separation (no overlap)
 *  - bounce off the prompt card (AABB)
 *  - click/pointer/keyboard -> onPick(word)
 *
 * Usage:
 *   startPills({
 *     container: document.getElementById('pill-layer'),
 *     obstacleEl: document.getElementById('prompt-card'),
 *     onPick: (word) => { /* navigate to cloud.html */ /* }
 *   });
 */
function startPills(opts){
  const container = opts && opts.container;
  const obstacleEl = opts && opts.obstacleEl;
  const onPick = (opts && opts.onPick) || function(){};
  if (!container || !obstacleEl) {
    console.warn('[bubbles] Missing container or obstacle element');
    return;
  }

  // Ensure the pill layer gets pointer events and has positioning.
  const cs = getComputedStyle(container);
  if (cs.position === 'static') container.style.position = 'absolute';
  container.style.pointerEvents = 'auto';

  // Sentiment suggestions
  const suggestions = [
    'excited','curious','optimistic','overwhelmed','unprepared','skeptical','scared',
    'hopeful','confident','inspired','amazed','thrilled','uncertain','enthusiastic',
    'cautious','doubtful','nervous','worried','prepared','fascinated'
  ];

  // Helpers for container size
  const W = () => container.clientWidth;
  const H = () => container.clientHeight;

  // Build pills (DOM + physics state)
  const pills = [];
  for (let i=0;i<suggestions.length;i++){
    const word = suggestions[i];

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pill';
    el.dataset.sent = (typeof sentimentOf === 'function') ? sentimentOf(word) : 'neutral';
    el.textContent = word;
    el.setAttribute('aria-label', `Choose ${word}`);
    el.tabIndex = 0;
    el.style.pointerEvents = 'auto';
    container.appendChild(el);

    // Provisional size; measure after paint.
    const pill = {
      id: i,
      el, word,
      x: Math.random() * Math.max(1, W()-160),
      y: Math.random() * Math.max(1, H()-60),
      vx: (Math.random()*0.8 - 0.4),
      vy: (Math.random()*0.8 - 0.4),
      w: 120, h: 36, r: 36,
      phase: Math.random()*Math.PI*2,   // for wander
      speedBias: 0.8 + Math.random()*0.6
    };
    pills.push(pill);

    // Submit immediately on interaction
    const fire = () => { try { onPick(word); } catch(e) { console.error(e); } };
    el.addEventListener('click', (e)=>{ e.stopPropagation(); fire(); });
    el.addEventListener('pointerdown', (e)=>{ e.stopPropagation(); fire(); });
    el.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fire(); } });

    // Measure actual size for accurate radius
    requestAnimationFrame(()=>{
      const r = el.getBoundingClientRect();
      pill.w = r.width;
      pill.h = r.height;
      pill.r = Math.max(pill.w, pill.h) / 2 + 12; // add margin
    });
  }

  // ---- Physics tuning ----
  const MAX_V       = 0.95;  // velocity clamp
  const FRICTION    = 0.996; // slight damping each frame
  const PUSH        = 0.060; // pairwise separation strength
  const PAD         = 14;    // padding around card
  const MIN_SPEED   = 0.10;  // if speed falls below this, give it a nudge
  const TARGET_SPEED= 0.28;  // keep them wandering around this magnitude
  const DRIFT       = 0.010; // time-based wander accel (very small)

  let t = 0;                 // virtual time for wander
  let last = performance.now();

  function step(){
    const now = performance.now();
    const dt = Math.min(50, now - last) / 16.6667; // normalize to ~frames
    last = now;
    t += 0.015 * dt;

    const obs = obstacleEl.getBoundingClientRect();
    const cbox = container.getBoundingClientRect();
    const ox = obs.left - cbox.left, oy = obs.top - cbox.top, ow = obs.width, oh = obs.height;

    // Pairwise separation (circle approximation)
    for (let i=0;i<pills.length;i++){
      for (let j=i+1;j<pills.length;j++){
        const a = pills[i], b = pills[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d  = Math.hypot(dx,dy) || 0.0001;
        const min = (a.r + b.r);
        if (d < min){
          const nx = dx/d, ny = dy/d;
          const overlap = (min - d) * 0.5;

          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;

          a.vx -= nx * PUSH; a.vy -= ny * PUSH;
          b.vx += nx * PUSH; b.vy += ny * PUSH;
        }
      }
    }

    // Integrate + wander + collisions
    for (const p of pills){
      // Gentle wander injects perpetual motion (varies per-pill via phase/id)
      const wiggleX = Math.sin(t*0.9 + p.phase + p.id*0.37) * DRIFT * p.speedBias;
      const wiggleY = Math.cos(t*0.8 + p.phase + p.id*0.29) * DRIFT * p.speedBias;
      p.vx += wiggleX;
      p.vy += wiggleY;

      // Light damping so they don't accelerate forever
      p.vx *= FRICTION;
      p.vy *= FRICTION;

      // Maintain a minimum cruising speed
      const sp = Math.hypot(p.vx, p.vy);
      if (sp < MIN_SPEED){
        // Nudge toward a random direction near the wander vector
        p.vx += (Math.random()*2-1) * (TARGET_SPEED*0.12);
        p.vy += (Math.random()*2-1) * (TARGET_SPEED*0.12);
      }

      // Clamp to a sensible maximum
      const sp2 = Math.hypot(p.vx, p.vy);
      if (sp2 > MAX_V){
        p.vx = (p.vx / sp2) * MAX_V;
        p.vy = (p.vy / sp2) * MAX_V;
      }

      // Integrate position
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Container walls
      if (p.x < p.r){ p.x = p.r; p.vx = Math.abs(p.vx); }
      if (p.y < p.r){ p.y = p.r; p.vy = Math.abs(p.vy); }
      const rw = W() - p.r, rh = H() - p.r;
      if (p.x > rw){ p.x = rw; p.vx = -Math.abs(p.vx); }
      if (p.y > rh){ p.y = rh; p.vy = -Math.abs(p.vy); }

      // Card bounce (AABB with padding)
      if (p.x > ox-PAD && p.x < ox+ow+PAD && p.y > oy-PAD && p.y < oy+oh+PAD){
        const left   = p.x - (ox-PAD);
        const right  = (ox+ow+PAD) - p.x;
        const top    = p.y - (oy-PAD);
        const bottom = (oy+oh+PAD) - p.y;
        const m = Math.min(left,right,top,bottom);
        if (m === left)   { p.x = ox-PAD;     p.vx = -Math.abs(p.vx)||-0.45; }
        else if (m===right){ p.x = ox+ow+PAD; p.vx =  Math.abs(p.vx)|| 0.45; }
        else if (m===top) { p.y = oy-PAD;     p.vy = -Math.abs(p.vy)||-0.45; }
        else              { p.y = oy+oh+PAD;  p.vy =  Math.abs(p.vy)|| 0.45; }
      }

      // Draw
      p.el.style.transform = `translate(${p.x - p.w/2}px, ${p.y - p.h/2}px)`;
    }

    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  // Keep pills in bounds after resizes
  let resizeTO;
  window.addEventListener('resize', ()=>{
    clearTimeout(resizeTO);
    resizeTO = setTimeout(()=>{
      for (const p of pills){
        p.x = Math.min(p.x, Math.max(p.r, W()-p.r));
        p.y = Math.min(p.y, Math.max(p.r, H()-p.r));
      }
    }, 80);
  });
}
