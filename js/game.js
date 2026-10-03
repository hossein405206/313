(function(){'use strict';
var canvas=document.getElementById('gameCanvas'),ctx=canvas&&canvas.getContext('2d');if(!canvas)return;
var start=document.getElementById('startGame'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best'),nameBox=document.getElementById('nameBox'),prize=document.getElementById('prizeText'),board=document.getElementById('leaderboardList');
var W=420,H=560,bird,pipes,score,running,raf,last,submitted=false,best=Number(localStorage.getItem('flappyBest')||0);
bestEl.textContent=best.toLocaleString('fa-IR');
function api(){return window.KanoonApp&&window.KanoonApp.api}
function load(){if(!api())return;api().get({action:'getGameData'}).then(function(r){prize.textContent=r.prize||'به بیشترین رکورد هفته جایزه داده می شود';renderBoard(r.leaderboard||[])}).catch(function(){});}
function renderBoard(list){board.innerHTML=list.length?list.map(function(x,i){return '<div class="leader-row"><span class="rank">'+(i+1).toLocaleString('fa-IR')+'</span><span class="leader-name">'+esc(x.playerName)+'</span><span class="leader-score">'+Number(x.score).toLocaleString('fa-IR')+'</span></div>'}).join(''):'<div class="empty"><p>هنوز رکوردی ثبت نشده</p></div>'}
function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function reset(){bird={x:82,y:H/2,vy:0,r:14};pipes=[];score=0;running=true;submitted=false;nameBox.classList.add('hidden');last=performance.now();start.textContent='در حال بازی...';spawn();raf=requestAnimationFrame(loop)}
function spawn(){pipes.push({x:W+30,gap:145,top:70+Math.random()*250,passed:false})}
function flap(){if(!running)return;bird.vy=-6.8}
function draw(){
ctx.clearRect(0,0,W,H);
var sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#70c5ce');sky.addColorStop(.72,'#b7e3d0');sky.addColorStop(1,'#ded28b');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
ctx.fillStyle='rgba(255,255,255,.55)';[[55,80,1],[300,120,.8],[190,45,.65]].forEach(function(c){ctx.beginPath();ctx.arc(c[0],c[1],18*c[2],0,Math.PI*2);ctx.arc(c[0]+20*c[2],c[1]+3,15*c[2],0,Math.PI*2);ctx.arc(c[0]+36*c[2],c[1],12*c[2],0,Math.PI*2);ctx.fill()});
pipes.forEach(function(p){drawPipe(p.x,0,48,p.top,true);drawPipe(p.x,p.top+p.gap,48,H-(p.top+p.gap),false)});
ctx.fillStyle='#ded895';ctx.fillRect(0,H-46,W,46);ctx.fillStyle='#9acb55';ctx.fillRect(0,H-46,W,8);ctx.fillStyle='#b7a766';for(var gx=0;gx<W;gx+=18)ctx.fillRect(gx,H-35,10,4);
ctx.save();ctx.translate(bird.x,bird.y);ctx.rotate(Math.max(-.45,Math.min(1,bird.vy*.045)));
ctx.fillStyle='#f5c842';ctx.beginPath();ctx.ellipse(0,0,17,13,0,0,Math.PI*2);ctx.fill();
ctx.fillStyle='#e3a92f';ctx.beginPath();ctx.ellipse(-5,5,10,5,0,0,Math.PI*2);ctx.fill();
ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(8,-6,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#222';ctx.beginPath();ctx.arc(9,-6,2,0,Math.PI*2);ctx.fill();
ctx.fillStyle='#e77d32';ctx.beginPath();ctx.moveTo(15,-1);ctx.lineTo(28,4);ctx.lineTo(15,8);ctx.closePath();ctx.fill();ctx.restore();
ctx.fillStyle='#fff';ctx.font='900 34px Vazirmatn';ctx.textAlign='center';ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=4;ctx.strokeText(String(score),W/2,52);ctx.fillText(String(score),W/2,52);ctx.textAlign='start';
}
function drawPipe(x,y,w,h,top){if(h<=0)return;ctx.fillStyle='#59b43d';ctx.fillRect(x,y,w,h);ctx.fillStyle='#8edc61';ctx.fillRect(x+5,y,9,h);ctx.fillStyle='#3b8f31';ctx.fillRect(x+w-7,y,7,h);ctx.fillStyle='#68c94a';var capY=top?y+h-12:y;ctx.fillRect(x-5,capY,w+10,12);ctx.fillStyle='#3b8f31';ctx.fillRect(x+w-2,capY,w>0?7:0,12)}
function loop(t){if(!running)return;var dt=Math.min(32,t-last);last=t;bird.vy+=.36*(dt/16);bird.y+=bird.vy*(dt/16);pipes.forEach(function(p){p.x-=2.8*(dt/16);if(!p.passed&&p.x+48<bird.x){p.passed=true;score++;scoreEl.textContent=score.toLocaleString('fa-IR');}});if(pipes.length&&pipes[0].x<-70)pipes.shift();if(!pipes.length||pipes[pipes.length-1].x<W-185)spawn();var hit=bird.y+bird.r>H-38||bird.y-bird.r<0;pipes.forEach(function(p){if(bird.x+bird.r>p.x&&bird.x-bird.r<p.x+48&&(bird.y-bird.r<p.top||bird.y+bird.r>p.top+p.gap))hit=true});draw();if(hit){end();return}raf=requestAnimationFrame(loop)}
function end(){running=false;cancelAnimationFrame(raf);if(score>best){best=score;localStorage.setItem('flappyBest',best);bestEl.textContent=best.toLocaleString('fa-IR')}start.textContent='دوباره بازی کن';if(score>0)nameBox.classList.remove('hidden')}
function submit(){var n=(document.getElementById('playerName').value||'').trim();if(!n||!api()){return}api().post({action:'submitGameScore',playerName:n,score:score}).then(function(r){renderBoard(r.leaderboard||[]);nameBox.classList.add('hidden');window.KanoonApp.toast.success('رکورد ثبت شد ✓')}).catch(function(e){window.KanoonApp.toast.error(e.message||'خطا در ثبت رکورد')})}
canvas.addEventListener('pointerdown',flap);document.addEventListener('keydown',function(e){if(e.code==='Space'){e.preventDefault();flap()}});start.addEventListener('click',function(){if(!running)reset()});document.getElementById('submitScore').addEventListener('click',submit);draw();load();
})();