(() => {
'use strict';
const $ = id => document.getElementById(id);
let module = window.ANATOMY_MODULES[0], organs = module.organs;
let byId = new Map(organs.map(o => [o.id, o]));
const visited = new Set();
let selected = null, mode = 'explore', quiz = null;
const svgNS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, parent) { const el=document.createElementNS(svgNS,tag); for(const [k,v] of Object.entries(attrs)) el.setAttribute(k,v); parent.append(el); return el; }
function render(){
$('regions').replaceChildren();$('map-labels').replaceChildren();$('organ-list').replaceChildren();
$('body-map').setAttribute('viewBox',module.viewBox);
$('view-caption').textContent=module.caption;
$('map-title').textContent=`Interaktivní mapa lidských orgánů – ${module.viewName}`;
$('system').replaceChildren(new Option('Všechny soustavy','all'));
[...new Set(organs.map(o=>o.system))].forEach(id=>$('system').add(new Option(window.ANATOMY_SYSTEMS[id],id)));
$('body-map').querySelector('image').setAttribute('href',module.image);
organs.forEach((o,i) => {
 const group=svg('g',{class:'organ','data-organ':o.id,tabindex:0,role:'button','aria-label':o.name,'aria-pressed':'false'},$('regions'));
 o.paths.forEach(d=>svg('path',{d,class:'hit'},group));
 group.addEventListener('click',()=>choose(o.id));
 group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(o.id);}});
 const [x,y]=o.label, [ax,ay]=o.anchor, width=o.name.length>11?235:200;
 const label=svg('g',{class:'label','data-organ':o.id,'aria-hidden':'true'},$('map-labels'));
 const edge=x<512?x+width:x;
 svg('path',{d:`M${edge} ${y+23} L${x<512?edge+22:edge-22} ${y+23} L${ax} ${ay}`},label);
 svg('circle',{cx:ax,cy:ay,r:4},label);
 svg('rect',{x,y,width,height:46,rx:10},label);
 svg('text',{x:x+12,y:y+31},label).textContent=o.name;
 label.addEventListener('click',()=>choose(o.id));
 const b=document.createElement('button'); b.dataset.organ=o.id;b.setAttribute('aria-pressed','false');
 const n=document.createElement('span');n.className='num';n.textContent=String(i+1).padStart(2,'0');b.append(n,document.createTextNode(o.name));
 b.addEventListener('click',()=>choose(o.id));$('organ-list').append(b);
});
}
function clearStates(){document.querySelectorAll('.organ,.label').forEach(el=>el.classList.remove('active','correct','wrong','filtered'));}
function mark(id,cls){document.querySelectorAll(`[data-organ="${id}"]`).forEach(el=>el.classList.add(cls));}
function select(id){selected=id;document.querySelectorAll('[data-organ]').forEach(el=>{el.classList.toggle('active',el.dataset.organ===id);if(el.hasAttribute('aria-pressed'))el.setAttribute('aria-pressed',String(el.dataset.organ===id));});}
function detail(id){const o=byId.get(id);$('detail').innerHTML=`<p class="eyebrow">${window.ANATOMY_SYSTEMS[o.system]}</p><h3>${o.name}</h3><p class="small"><i>${o.latin}</i></p><p class="lead">${o.lead}</p><dl><dt>Kde ho najdeš</dt><dd>${o.location}</dd><dt>Co dělá</dt><dd>${o.function}</dd><dt>S čím spolupracuje</dt><dd>${o.connection}</dd></dl><div class="remember"><strong>Zapamatuj si</strong><br>${o.remember}</div>`;}
function choose(id){
 if(mode==='quiz') {answer(id);return;}
 select(id);visited.add(id);detail(id);$('explored').textContent=`Prozkoumáno ${organs.filter(o=>visited.has(o.id)).length} z ${organs.length} struktur v tomto pohledu`;
}
function labels(){ $('body-map').classList.toggle('labels-hidden',mode==='quiz'||!$('labels').checked); }
function filter(){document.querySelectorAll('.organ').forEach(el=>el.classList.toggle('filtered',$('system').value!=='all'&&byId.get(el.dataset.organ).system===$('system').value));}
$('system').addEventListener('change',filter);$('labels').addEventListener('change',labels);
$('zoom').addEventListener('click',()=>{const active=$('viewport').classList.toggle('zoomed');$('zoom').setAttribute('aria-pressed',String(active));$('zoom').textContent=active?'Zmenšit':'Zvětšit';});
function setMode(next){mode=next;clearStates();$('explore-mode').setAttribute('aria-pressed',String(mode==='explore'));$('quiz-mode').setAttribute('aria-pressed',String(mode==='quiz'));$('quiz-panel').hidden=mode!=='quiz';$('detail').hidden=mode==='quiz';$('system').disabled=mode==='quiz';$('labels').disabled=mode==='quiz';labels();if(mode==='quiz')start();else{quiz=null;enableChoices(true);select(selected||organs[0].id);detail(selected||organs[0].id);filter();}}
function shuffled(values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function enableChoices(enabled){document.querySelectorAll('#organ-list button').forEach(b=>b.disabled=!enabled);document.querySelectorAll('.organ').forEach(g=>{g.setAttribute('aria-disabled',String(!enabled));g.setAttribute('tabindex',enabled?'0':'-1');});}
function start(){quiz={order:shuffled(organs.map(o=>o.id)),index:0,score:0,answered:false};$('restart').hidden=true;$('quiz-help').hidden=false;question();}
function question(){clearStates();document.querySelectorAll('[aria-pressed][data-organ]').forEach(el=>el.setAttribute('aria-pressed','false'));enableChoices(true);quiz.answered=false;$('feedback').textContent='';$('feedback').removeAttribute('data-state');$('next').hidden=true;$('detail').hidden=true;$('question').textContent=`Najdi: ${byId.get(quiz.order[quiz.index]).name}`;$('quiz-count').textContent=`Otázka ${quiz.index+1} / ${quiz.order.length}`;$('quiz-score').textContent=`Správně ${quiz.score}`;$('progress').max=quiz.order.length;$('progress').value=quiz.index;document.querySelectorAll('.organ').forEach((g,i)=>g.setAttribute('aria-label',`Oblast ${i+1}`));}
function answer(id){if(!quiz||quiz.answered)return;quiz.answered=true;const correct=quiz.order[quiz.index],ok=id===correct;if(ok)quiz.score++;clearStates();mark(correct,'correct');if(!ok)mark(id,'wrong');enableChoices(false);$('feedback').dataset.state=ok?'correct':'wrong';$('feedback').textContent=ok?`Správně. ${byId.get(correct).lead}`:`To je ${byId.get(id).name.toLocaleLowerCase('cs')}. Hledaný orgán (${byId.get(correct).name.toLocaleLowerCase('cs')}) je zvýrazněný zeleně.`;$('quiz-score').textContent=`Správně ${quiz.score}`;$('progress').value=quiz.index+1;$('next').textContent=quiz.index===quiz.order.length-1?'Zobrazit výsledek':'Další otázka →';$('next').hidden=false;detail(correct);$('detail').hidden=false;}
$('next').addEventListener('click',()=>{if(!quiz||!quiz.answered)return;quiz.index++;if(quiz.index===quiz.order.length){$('question').textContent=`Hotovo! ${quiz.score} z ${quiz.order.length}`;$('quiz-count').textContent='Kvíz dokončen';$('quiz-help').hidden=true;$('feedback').textContent=quiz.score===quiz.order.length?'Výborně, poznáš všechny orgány v tomto atlasu.':'V režimu Prozkoumat si můžeš orgány znovu projít a pak kvíz zopakovat.';$('feedback').removeAttribute('data-state');$('next').hidden=true;$('restart').hidden=false;}else question();$('question').focus();});
$('restart').addEventListener('click',()=>{start();$('question').focus();});
$('explore-mode').addEventListener('click',()=>{setMode('explore');document.querySelectorAll('.organ').forEach(g=>g.setAttribute('aria-label',byId.get(g.dataset.organ).name));});
$('quiz-mode').addEventListener('click',()=>{setMode('quiz');$('question').focus();});
function changeView(index){
 if(module===window.ANATOMY_MODULES[index])return;
 module=window.ANATOMY_MODULES[index];organs=module.organs;byId=new Map(organs.map(o=>[o.id,o]));
 selected=byId.has(selected)?selected:organs[0].id;
 render();
 $('view-front').setAttribute('aria-pressed',String(index===0));$('view-back').setAttribute('aria-pressed',String(index===1));
 $('viewport').scrollTo({top:0,left:0,behavior:'instant'});
 setMode(mode);
 if(mode==='explore')choose(selected);
 else $('explored').textContent=`Prozkoumáno ${organs.filter(o=>visited.has(o.id)).length} z ${organs.length} struktur v tomto pohledu`;
}
$('view-front').addEventListener('click',()=>changeView(0));
$('view-back').addEventListener('click',()=>changeView(1));
render();choose('srdce');
})();
