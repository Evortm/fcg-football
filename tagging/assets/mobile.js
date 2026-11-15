// Clipboard TSV is data-only; CSV downloads retain their column headers.
(()=>{const original=window.FCG.toCsv;window.FCG.toCsv=function(events,delimiter){const text=original(events,delimiter);return delimiter==='\t'?text.slice(text.indexOf('\n')+1):text;};})();
(()=>{
const menu=document.createElement('details');menu.className='phone-settings';
const summary=document.createElement('summary');summary.textContent='☰';summary.setAttribute('aria-label','Settings, reviewer, export and help');
const panel=document.createElement('div');panel.className='phone-settings-panel';menu.append(summary,panel);
const note=document.createElement('p');note.id='phoneNote';note.textContent='W11 · A7 — Choose team, drill and player. Tags save on this device; export Backup JSON after tagging.';
const more=document.createElement('div');more.className='phone-frame-controls';const caption=document.createElement('span');caption.textContent='Frame stepping';more.append(caption);
const header=document.querySelector('header');const buttons=[...document.querySelector('.marker-actions').children].map(b=>[b,b.innerHTML]);
let restores=[],mounted=false,observer;
function move(node,parent){const anchor=document.createComment('phone-layout-position');node.before(anchor);restores.push(()=>anchor.replaceWith(node));parent.append(node);}
function updateTimes(){for(const [id,textId,label]of[['setStart','segStart','Start'],['setEnd','segEnd','End']]){const b=document.getElementById(id),v=document.getElementById(textId).textContent;b.textContent=label+' · '+v;b.setAttribute('aria-label','Set '+label.toLowerCase()+', selected time '+v);}}
function mount(){if(mounted)return;mounted=true;document.body.classList.add('compact-phone');move(document.querySelector('.clip-select-wrap'),header);header.append(menu);move(document.querySelector('.top-actions'),panel);panel.append(note,more);move(document.querySelector('#frameBack'),more);move(document.querySelector('#frameFwd'),more);move(document.querySelector('.help'),panel);updateTimes();observer=new MutationObserver(updateTimes);observer.observe(document.querySelector('.segment'),{childList:true,subtree:true});}
function unmount(){if(!mounted)return;observer.disconnect();restores.reverse().forEach(restore=>restore());restores=[];menu.remove();buttons.forEach(([b,html])=>{b.innerHTML=html;b.removeAttribute('aria-label');});document.body.classList.remove('compact-phone');mounted=false;}
const phone=matchMedia('(max-width:700px)');function apply(){if(phone.matches)mount();else unmount();}phone.addEventListener('change',apply);apply();
})();

// Touch gestures: vertical swipes scroll; taps/horizontal drags seek.
(()=>{
const timeline=document.getElementById('timeline'),video=document.getElementById('video');let gesture=null;
function seek(x){const r=timeline.getBoundingClientRect(),duration=Number.isFinite(video.duration)?video.duration:0;if(r.width&&duration)video.currentTime=Math.max(0,Math.min(duration,(x-r.left)/r.width*duration));}
timeline.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;e.stopImmediatePropagation();gesture={id:e.pointerId,x:e.clientX,y:e.clientY,mode:'tap'};},true);
timeline.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'||!gesture||gesture.id!==e.pointerId)return;e.stopImmediatePropagation();const dx=Math.abs(e.clientX-gesture.x),dy=Math.abs(e.clientY-gesture.y);if(gesture.mode==='tap'&&Math.max(dx,dy)>8)gesture.mode=dx>dy?'seek':'scroll';if(gesture.mode==='seek')seek(e.clientX);},true);
timeline.addEventListener('pointerup',e=>{if(e.pointerType!=='touch'||!gesture||gesture.id!==e.pointerId)return;e.stopImmediatePropagation();if(gesture.mode!=='scroll')seek(e.clientX);gesture=null;},true);
timeline.addEventListener('pointercancel',e=>{if(gesture&&gesture.id===e.pointerId)gesture=null;},true);
})();
