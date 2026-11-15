// Clipboard TSV is data-only; CSV downloads retain their column headers.
(()=>{const original=window.FCG.toCsv;window.FCG.toCsv=function(events,delimiter){const text=original(events,delimiter);return delimiter==='\t'?text.slice(text.indexOf('\n')+1):text;};})();
(()=>{
const video=document.getElementById('video'),transport=document.querySelector('.transport-buttons');
const back=document.createElement('button'),forward=document.createElement('button');
for(const [b,id,label,offset]of[[back,'secondBack','−5s',-5],[forward,'secondForward','+5s',5]]){b.id=id;b.type='button';b.className='icon-btn phone-second';b.textContent=label;b.setAttribute('aria-label',offset<0?'Back five seconds':'Forward five seconds');b.onclick=()=>{video.pause();video.currentTime=Math.max(0,Math.min(video.duration||0,video.currentTime+offset));};}
const seek=document.createElement('input');seek.id='phoneSeek';seek.type='range';seek.min='0';seek.max='0';seek.step='0.001';seek.value='0';seek.setAttribute('aria-label','Seek to a moment in the video');
let dragging=false;
function syncSeek(){if(Number.isFinite(video.duration)&&video.duration>0)seek.max=String(video.duration);if(!dragging)seek.value=String(video.currentTime||0);seek.setAttribute('aria-valuetext',new Date((video.currentTime||0)*1000).toISOString().slice(14,23));}
function seekFromInput(){if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.max(0,Math.min(video.duration,Number(seek.value)));}
seek.addEventListener('pointerdown',()=>{dragging=true;});seek.addEventListener('input',seekFromInput);seek.addEventListener('change',()=>{seekFromInput();dragging=false;});seek.addEventListener('pointerup',()=>{dragging=false;});seek.addEventListener('pointercancel',()=>{dragging=false;syncSeek();});seek.addEventListener('blur',()=>{dragging=false;syncSeek();});
for(const event of ['loadedmetadata','durationchange','timeupdate','emptied'])video.addEventListener(event,syncSeek);
const menu=document.createElement('details');menu.className='phone-settings';
const summary=document.createElement('summary');summary.textContent='☰';summary.setAttribute('aria-label','Settings, reviewer, export and help');
const panel=document.createElement('div');panel.className='phone-settings-panel';menu.append(summary,panel);
const note=document.createElement('p');note.id='phoneNote';note.textContent='W11 · A7 — Choose team, drill and player. Tags save on this device; export Backup JSON after tagging.';
const more=document.createElement('div');more.className='phone-frame-controls';const caption=document.createElement('span');caption.textContent='Frame stepping';more.append(caption);
const header=document.querySelector('header');const buttons=[...document.querySelector('.marker-actions').children].map(b=>[b,b.innerHTML]);
let restores=[],mounted=false,observer;
function move(node,parent){const anchor=document.createComment('phone-layout-position');node.before(anchor);restores.push(()=>anchor.replaceWith(node));parent.append(node);}
function updateTimes(){for(const [id,textId,label]of[['setStart','segStart','Start'],['setEnd','segEnd','End']]){const b=document.getElementById(id),v=document.getElementById(textId).textContent;b.textContent=label+' · '+v;b.setAttribute('aria-label','Set '+label.toLowerCase()+', selected time '+v);}}
function mount(){if(mounted)return;mounted=true;document.body.classList.add('compact-phone');move(document.querySelector('.clip-select-wrap'),header);header.append(menu);move(document.querySelector('.top-actions'),panel);panel.append(note,more);move(document.querySelector('#frameBack'),more);move(document.querySelector('#frameFwd'),more);move(document.querySelector('.help'),panel);transport.prepend(back);transport.append(forward);document.querySelector('.timeline-wrap').prepend(seek);syncSeek();updateTimes();observer=new MutationObserver(updateTimes);observer.observe(document.querySelector('.segment'),{childList:true,subtree:true});}
function unmount(){if(!mounted)return;observer.disconnect();restores.reverse().forEach(restore=>restore());restores=[];back.remove();forward.remove();seek.remove();menu.remove();buttons.forEach(([b,html])=>{b.innerHTML=html;b.removeAttribute('aria-label');});document.body.classList.remove('compact-phone');mounted=false;}
const phone=matchMedia('(max-width:700px)');function apply(){if(phone.matches)mount();else unmount();}phone.addEventListener('change',apply);apply();
})();
