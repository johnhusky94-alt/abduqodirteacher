window.HY=(function(){'use strict';
var parts=null,inp=null,box=null,P=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
function split(a){a=String(a||'').trim();return a&&!/\s/.test(a)&&/[A-Za-z]-[A-Za-z]/.test(a)?a.split('-'):null}
function segs(){var v=P.get.call(inp),s=[''],c=0,n=parts.length;for(var i=0;i<v.length;i++){var ch=v[i];
 if(ch==='-'||/\s/.test(ch)){if(s[c].length&&c<n-1){c++;s[c]=''}continue}
 if(s[c].length>=parts[c].length&&c<n-1){c++;s[c]=''}s[c]+=ch}return{s:s,c:c}}
function draw(){if(!box)return;if(!parts){box.hidden=true;inp.classList.remove('hyhid');return}
 var g=segs(),a=g.c;if(g.s[a].length>=parts[a].length&&a<parts.length-1)a++;var f=document.activeElement===inp&&!inp.disabled;
 box.hidden=false;inp.classList.add('hyhid');box.classList.toggle('off',inp.disabled);
 box.innerHTML=parts.map(function(p,i){return(i?'<span class="hyd">-</span>':'')+'<span class="hyc'+(f&&i===a?' on':'')+'" style="min-width:'+(p.length+1)+'ch">'+esc(g.s[i]||'')+'</span>'}).join('')}
function fix(e){if(!parts||e.target!==inp)return;var g=segs(),out=g.s.join('-');if(out!==P.get.call(inp))P.set.call(inp,out);try{inp.setSelectionRange(out.length,out.length)}catch(_){}draw()}
function bind(){inp=document.getElementById('inp');if(!inp||box)return!!inp;
 box=document.createElement('div');box.className='hybox';box.hidden=true;box.setAttribute('aria-hidden','true');inp.parentNode.insertBefore(box,inp);
 inp.parentNode.style.position='relative';
 var cs=getComputedStyle(inp);box.style.setProperty('--hybg',cs.backgroundColor);box.style.setProperty('--hyfg',cs.color);box.style.setProperty('--hyfs',cs.fontSize);box.style.setProperty('--hyr',cs.borderRadius);
 Object.defineProperty(inp,'value',{configurable:true,get:function(){return P.get.call(inp)},set:function(v){P.set.call(inp,v);draw()}});
 box.addEventListener('pointerdown',function(e){e.preventDefault();if(!inp.disabled)inp.focus()});
 inp.addEventListener('focus',draw);inp.addEventListener('blur',draw);
 new MutationObserver(draw).observe(inp,{attributes:true,attributeFilter:['disabled']});return true}
/* capture: the boxes tidy the value before any game listener reads it */
document.addEventListener('input',fix,true);
return{set:function(ans){if(!bind())return;parts=split(ans);draw()},parts:split}})();
