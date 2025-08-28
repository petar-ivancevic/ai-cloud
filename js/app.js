/* =============================
= js/app.js
============================== */
// Basic stoplist & profanity (lightweight placeholder)
const STOPLIST = new Set(["the","and","a","an","of","in","on","to","for","with","is","are"]);
const PROFANE = new Set(["fuck","shit","bitch","asshole","cunt","dick","shitty"]);
const STEM_MAP = new Map([["excite","excited"],["exciting","excited"],["excitement","excited"],["scare","scared"],["terrify","terrified"],["worry","worried"],["prepare","prepared"],["un-?prepare(d)?","unprepared"]]);
function normalizeWord(w){ if(!w) return ""; let s=(""+w).toLowerCase().trim(); s=s.replace(/[^a-z\-]/g,""); if(!s||STOPLIST.has(s)) return ""; for(const [k,v] of STEM_MAP){ if(new RegExp(`^${k}$`).test(s)){ s=v; break; } } return s; }
function isAllowed(w){ return w && !PROFANE.has(w); }
const KEY = 'ai-feelings-counts.v1';
function getCounts(){ try{ return JSON.parse(localStorage.getItem(KEY) || '{}'); }catch{ return {}; } }
function setCounts(obj){ localStorage.setItem(KEY, JSON.stringify(obj||{})); }
function incrementWord(w){ const counts = getCounts(); counts[w] = (counts[w]||0)+1; setCounts(counts); }
function encodeCountsToURL(counts){ const json = JSON.stringify(counts||{}); return encodeURIComponent(btoa(unescape(encodeURIComponent(json)))); }
function decodeCountsFromURL(search){ const params=new URLSearchParams(search.startsWith('?')?search.slice(1):search); const data=params.get('data'); if(!data) return null; try{ const json=decodeURIComponent(escape(atob(decodeURIComponent(data)))); return JSON.parse(json);}catch{return null;} }
function sentimentOf(word){ const pos = new Set(["excited","curious","optimistic","hopeful","prepared","confident","inspired","amazed","thrilled","fascinated"]); const neg = new Set(["scared","terrified","worried","nervous","overwhelmed","unprepared","anxious","doubtful"]); if(pos.has(word)) return 'positive'; if(neg.has(word)) return 'negative'; return 'neutral'; }
function colorFor(word){ const s=sentimentOf(word); return s==='positive'? '#86efac' : s==='negative'? '#fca5a5' : '#93c5fd'; }