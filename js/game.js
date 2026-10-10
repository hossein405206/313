(function(){
  'use strict';
  var canvas=document.getElementById('gameCanvas'),ctx=canvas&&canvas.getContext('2d');
  if(!canvas||!ctx)return;
  var start=document.getElementById('startGame'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best');
  var board=document.getElementById('leaderboardList'),allTimeBoard=document.getElementById('allTimeLeaderboardList');
  var playerNameEl=document.getElementById('playerName'),prize=document.getElementById('prizeText'),message=document.getElementById('gameMessage');
  var W=420,H=560,FLOOR=H-48,STEP=1/60,state='idle',raf=0,lastFrame=0,accumulator=0,score=0,member=null,weekKey='';
  var bird={x:88,y:H*.48,vy:0,r:13,wing:0},pipes=[],particles=[],worldTime=0;
  var clouds=[{x:55,y:82,s:.8},{x:305,y:128,s:.65},{x:190,y:48,s:.52}];
  var best=0,submitting=false;
  function app(){return window.KanoonApp;}
  function api(){return app()&&app().api;}
  function toast(text,error){var t=app()&&app().toast;if(t)(error?t.error:t.success)(text);}
  function faNum(n){return Number(n||0).toLocaleString('fa-IR');}
  function say(text){if(message)message.textContent=text;}
  function setButton(label,disabled){start.textContent=label;start.disabled=!!disabled;start.classList.toggle('playing',!!disabled);}
  function esc(value){return String(value==null?'':value).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}
  function memberBadgeMarkup(item){
    return item&&item.registered?'<small class="member-role-badge">عضو حلقه</small>':'<small class="member-role-badge member-role-badge--neutral">عضو نشده</small>';
  }
  function avatarMarkup(url,name){
    var initial=esc((name||'ع').charAt(0));
    return '<span class="leader-avatar"><span class="leader-avatar__fallback">'+initial+'</span>'+(url?'<img src="'+esc(url)+'" alt="" loading="lazy" onerror="this.remove()">':'')+'</span>';
  }
  function renderBoard(list){
    if(!board)return;
    board.innerHTML=list.length?list.map(function(x,i){
      var me=member&&String(x.memberId)===String(member.id);
      return '<div class="leader-row '+(x.registered?'is-registered':'is-unregistered')+(me?' me':'')+'"><span class="rank">'+(i+1).toLocaleString('fa-IR')+'</span><span class="leader-name">'+avatarMarkup(x.profileImage,x.playerName)+'<span class="leader-player-name">'+esc(x.playerName)+(me?' <small>شما</small>':'')+memberBadgeMarkup(x)+'</span></span><span class="leader-score">'+faNum(x.score)+'</span></div>';
    }).join(''):'<div class="empty"><p>هنوز رکوردی برای این هفته ثبت نشده</p></div>';
  }
  function renderAllTimeBoard(list){
    if(!allTimeBoard)return;
    allTimeBoard.innerHTML=list.length?list.map(function(x,i){
      var me=member&&String(x.memberId)===String(member.id);
      return '<div class="leader-row '+(x.registered?'is-registered':'is-unregistered')+(me?' me':'')+'"><span class="rank">'+(i+1).toLocaleString('fa-IR')+'</span><span class="leader-name">'+avatarMarkup(x.profileImage,x.playerName)+'<span class="leader-player-name">'+esc(x.playerName)+(me?' <small>شما</small>':'')+memberBadgeMarkup(x)+'</span></span><span class="leader-score">'+faNum(x.score)+'</span></div>';
    }).join(''):'<div class="empty"><p>هنوز رکورد تاریخی ثبت نشده</p></div>';
  }
  async function boot(){
    if(!app()||!app().session||!api())return setTimeout(boot,80);
    member=app().session.getMember();
    if(!member||!member.token){location.replace('login.html?return=game.html');return;}
    try{
      if(api().checkBackendVersion)await api().checkBackendVersion();
      var registration=await api().get({action:'getRingRegistration',token:member.token});
      if(!registration.registered){location.replace('ring-registration.html?required=1');return;}
    }catch(e){say(e.message||'بررسی عضویت ناموفق بود. اتصال به سرور را بررسی کن.');start.disabled=true;return;}
    playerNameEl.textContent=member.nickname||member.name||'عضو حلقه';
    best=Math.max(0,Number(member.bestScore||0));
    bestEl.textContent=faNum(best);
    await load();
    draw();
  }
  async function load(){
    try{
      var r=await api().get({action:'getGameData'});
      weekKey=String(r.weekKey||'');
      prize.textContent=r.prize||'به بیشترین رکورد هفته جایزه داده می‌شود';
      renderBoard(r.leaderboard||[]);
      renderAllTimeBoard(r.allTimeLeaderboard||[]);
      var mine=(r.allTimeLeaderboard||[]).find(function(x){return member&&String(x.memberId)===String(member.id);});
      if(mine)best=Math.max(best,Number(mine.score||0));
      best=Math.max(best,Number(member.bestScore||0));
      bestEl.textContent=faNum(best);
    }catch(e){
      say(e.message||'دریافت رکوردها ناموفق بود.');
    }
  }
  function startReady(){
    if(state==='playing'||submitting)return;
    if(raf)cancelAnimationFrame(raf);
    raf=0;lastFrame=0;accumulator=0;
    state='ready';score=0;worldTime=0;pipes=[];particles=[];
    bird={x:88,y:H*.48,vy:0,r:13,wing:0};
    scoreEl.textContent=faNum(0);
    setButton('بازی آماده است',false);
    say('عالیه! حالا روی زمین بازی لمس کن تا پرواز شروع شود.');
    draw();
  }
  function beginPlaying(){
    if(state!=='ready')return;
    state='playing';lastFrame=0;accumulator=0;
    spawnPipe(W+26);
    bird.vy=-390;bird.wing=1;
    emitFeathers();
    setButton('در حال بازی…',true);
    say('برای پرواز روی صفحه بزن یا کلید فاصله را فشار بده.');
    raf=requestAnimationFrame(loop);
  }
  function flap(){
    if(state==='ready'){beginPlaying();return;}
    if(state!=='playing')return;
    bird.vy=-390;bird.wing=1;
    emitFeathers();
  }
  function emitFeathers(){
    for(var i=0;i<5;i++)particles.push({x:bird.x-9,y:bird.y+5,vx:-35-Math.random()*85,vy:(Math.random()-.5)*65,life:.38,size:2+Math.random()*2});
  }
  function spawnPipe(x){
    var gap=157,top=75+Math.random()*245;
    top=Math.max(54,Math.min(top,FLOOR-gap-55));
    pipes.push({x:x,top:top,gap:gap,w:52,passed:false});
  }
  function update(dt){
    worldTime+=dt;
    bird.wing*=Math.pow(.08,dt);
    bird.vy=Math.min(590,bird.vy+1120*dt);
    bird.y+=bird.vy*dt;
    var speed=168;
    pipes.forEach(function(p){
      p.x-=speed*dt;
      if(!p.passed&&p.x+p.w<bird.x){
        p.passed=true;score++;scoreEl.textContent=faNum(score);
        for(var i=0;i<10;i++)particles.push({x:bird.x,y:bird.y,vx:(Math.random()-.5)*100,vy:(Math.random()-.5)*100,life:.55,size:1.5+Math.random()*2.5});
      }
    });
    pipes= pipes.filter(function(p){return p.x+p.w+14>-5;});
    if(!pipes.length||pipes[pipes.length-1].x<W-212)spawnPipe(W+26);
    particles.forEach(function(p){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});
    particles=particles.filter(function(p){return p.life>0;});
    var hit=bird.y+bird.r>FLOOR||bird.y-bird.r<0;
    pipes.forEach(function(p){
      var overlaps=bird.x+bird.r>p.x&&bird.x-bird.r<p.x+p.w;
      if(overlaps&&(bird.y-bird.r<p.top||bird.y+bird.r>p.top+p.gap))hit=true;
    });
    if(hit)finishGame();
  }
  function loop(timestamp){
    if(state!=='playing')return;
    if(!lastFrame)lastFrame=timestamp;
    var elapsed=Math.min(.05,Math.max(0,(timestamp-lastFrame)/1000));
    lastFrame=timestamp;accumulator+=elapsed;
    while(accumulator>=STEP&&state==='playing'){update(STEP);accumulator-=STEP;}
    draw();
    if(state==='playing')raf=requestAnimationFrame(loop);
  }
  function rr(x,y,w,h,r){
    var q=Math.min(r,w/2,h/2);
    ctx.beginPath();ctx.moveTo(x+q,y);ctx.arcTo(x+w,y,x+w,y+h,q);ctx.arcTo(x+w,y+h,x,y+h,q);ctx.arcTo(x,y+h,x,y,q);ctx.arcTo(x,y,x+w,y,q);ctx.closePath();
  }
  function drawCloud(x,y,s){
    ctx.fillStyle='rgba(255,255,255,.76)';ctx.beginPath();
    ctx.arc(x,y,19*s,0,Math.PI*2);ctx.arc(x+22*s,y+3*s,15*s,0,Math.PI*2);ctx.arc(x+39*s,y+1*s,11*s,0,Math.PI*2);ctx.fill();
  }
  function drawMountain(base,peak,color,offset){
    ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-30,FLOOR);ctx.lineTo(80+offset,peak);ctx.lineTo(175+offset,base-60);
    ctx.lineTo(255+offset,peak+38);ctx.lineTo(360+offset,base-42);ctx.lineTo(470,FLOOR);ctx.closePath();ctx.fill();
  }
  function drawPipe(p,topPipe){
    var x=p.x,y=topPipe?0:p.top+p.gap,h=topPipe?p.top:FLOOR-(p.top+p.gap);
    if(h<=0)return;
    var grad=ctx.createLinearGradient(x,0,x+p.w,0);
    grad.addColorStop(0,'#347e32');grad.addColorStop(.22,'#80d75e');grad.addColorStop(.55,'#57b847');grad.addColorStop(1,'#2a7330');
    ctx.fillStyle=grad;rr(x,y,p.w,h,4);ctx.fill();
    var capY=topPipe?y+h-13:y;
    var cap=ctx.createLinearGradient(x-5,0,x+p.w+5,0);
    cap.addColorStop(0,'#2d7330');cap.addColorStop(.25,'#8de06a');cap.addColorStop(.55,'#6bc94f');cap.addColorStop(1,'#2d7330');
    ctx.fillStyle=cap;rr(x-5,capY,p.w+10,13,4);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(x+8,y+2,4,Math.max(0,h-4));
  }
  function drawBird(){
    ctx.save();ctx.translate(bird.x,bird.y);
    ctx.rotate(state==='playing'?Math.max(-.45,Math.min(.75,bird.vy*.0012)):0);
    ctx.shadowColor='rgba(38,53,70,.24)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
    var body=ctx.createLinearGradient(-17,-14,15,14);body.addColorStop(0,'#ffe978');body.addColorStop(.55,'#f5c843');body.addColorStop(1,'#e5a72f');
    ctx.fillStyle=body;ctx.beginPath();ctx.ellipse(0,0,17,13,0,0,Math.PI*2);ctx.fill();
    ctx.shadowColor='transparent';ctx.fillStyle='#d89b2b';ctx.beginPath();ctx.ellipse(-5,6,10,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(8,-6,5.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#26313b';ctx.beginPath();ctx.arc(9,-6,2.2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e97b2e';ctx.beginPath();ctx.moveTo(14,-2);ctx.lineTo(28,3);ctx.lineTo(14,8);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f0b52e';ctx.beginPath();ctx.ellipse(-9,-3,9,5,-.35+bird.wing*.45,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    var sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#5bbbd0');sky.addColorStop(.52,'#9bd9dc');sky.addColorStop(1,'#f2d99b');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,225,134,.78)';ctx.beginPath();ctx.arc(344,75,31,0,Math.PI*2);ctx.fill();
    clouds.forEach(function(cloud,i){var drift=state==='playing'?worldTime*(7+i*4):0;var x=((cloud.x-drift+W+70)%(W+140))-70;drawCloud(x,cloud.y,cloud.s);});
    drawMountain(FLOOR,245,'rgba(76,151,137,.35)',-40);drawMountain(FLOOR,285,'rgba(57,124,116,.42)',60);
    pipes.forEach(function(p){drawPipe(p,true);drawPipe(p,false);});
    ctx.fillStyle='#d7c77f';ctx.fillRect(0,FLOOR,W,H-FLOOR);ctx.fillStyle='#83bf50';ctx.fillRect(0,FLOOR,W,9);
    ctx.fillStyle='#b4a466';var offset=state==='playing'?Math.floor(worldTime*95)%24:0;for(var gx=-18;gx<W;gx+=24)ctx.fillRect(gx-offset,FLOOR+14,13,4);
    particles.forEach(function(p){ctx.globalAlpha=Math.min(1,p.life*2.2);ctx.fillStyle='#fff1a5';ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
    drawBird();
    ctx.fillStyle='rgba(255,255,255,.96)';ctx.font='900 34px Vazirmatn';ctx.textAlign='center';ctx.lineWidth=6;ctx.strokeStyle='rgba(25,49,63,.28)';
    ctx.strokeText(String(score),W/2,54);ctx.fillText(String(score),W/2,54);ctx.textAlign='start';
    if(state==='idle'||state==='ready'){
      ctx.save();ctx.fillStyle='rgba(19,46,62,.43)';rr(50,231,320,86,21);ctx.fill();
      ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='800 19px Vazirmatn';ctx.fillText(state==='idle'?'آماده‌ای؟':'برای پرواز لمس کن',W/2,266);
      ctx.font='500 13px Vazirmatn';ctx.fillText(state==='idle'?'دکمه شروع را پایین بازی بزن':'با یک لمس، پرواز شروع می‌شود',W/2,293);ctx.restore();
    }
    if(state==='over'){
      ctx.save();ctx.fillStyle='rgba(19,46,62,.76)';rr(55,226,310,100,20);ctx.fill();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='900 24px Vazirmatn';ctx.fillText('پایان بازی',W/2,264);ctx.font='700 16px Vazirmatn';ctx.fillText('رکورد این دور: '+faNum(score),W/2,295);ctx.restore();
    }
  }
  function finishGame(){
    if(state!=='playing')return;
    state='over';if(raf)cancelAnimationFrame(raf);raf=0;lastFrame=0;accumulator=0;
    setButton('دوباره بازی کن',false);
    if(score>0)say('بازی تمام شد؛ در حال ذخیره رکورد '+faNum(score)+'…');
    else say('هنوز مانعی را رد نکردی؛ این دور رکوردی برای ذخیره ندارد.');
    draw();
    if(score>0)submitScore();
  }
  async function submitScore(){
    if(submitting||!member||!member.token)return;
    submitting=true;setButton('در حال ذخیره رکورد…',true);
    try{
      if(api().checkBackendVersion)await api().checkBackendVersion();
      var response=await api().post({action:'submitGameScore',token:member.token,score:score});
      renderBoard(response.leaderboard||[]);
      renderAllTimeBoard(response.allTimeLeaderboard||[]);
      var savedLifetime=Number(response.lifetimeBest||member.bestScore||0);
      best=Math.max(best,savedLifetime);
      member.bestScore=best;
      app().session.setMember(member);
      bestEl.textContent=faNum(best);
      if(response.saved){
        say('رکورد '+faNum(score)+' ثبت شد و در جدول این هفته قرار گرفت. آفرین! 💙');
      }else{
        say('رکورد این هفته قبلاً بهتر یا مساوی بوده؛ بهترین رکورد هفتگی شما '+faNum(response.score||score)+' است.');
      }
    }catch(e){
      say('رکورد ذخیره نشد: '+(e.message||'خطای ارتباط با سرور'));
      toast(e.message||'ثبت رکورد ناموفق بود',true);
    }finally{
      submitting=false;
      if(state==='over')setButton('دوباره بازی کن',false);
    }
  }
  canvas.addEventListener('pointerdown',function(e){
    e.preventDefault();
    if(state==='idle'||state==='over'){say('برای شروع، دکمه شروع بازی را پایین صفحه بزن.');return;}
    flap();
  });
  document.addEventListener('keydown',function(e){
    if(e.code!=='Space')return;
    if(e.target&&(/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)))return;
    e.preventDefault();
    if(state==='ready')beginPlaying();else if(state==='playing')flap();
  });
  start.addEventListener('click',function(){
    if(state==='idle'||state==='over')startReady();
    else if(state==='ready')say('حالا روی زمین بازی لمس کن تا پرواز شروع شود.');
  });
  scoreEl.textContent=faNum(0);bestEl.textContent=faNum(0);draw();boot();
})();