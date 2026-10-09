(function () {
  'use strict';
  var canvas = document.getElementById('snakeCanvas');
  var ctx = canvas && canvas.getContext('2d');
  if (!canvas || !ctx) return;
  var W = 420, H = 560, CELL = 20, COLS = W / CELL, ROWS = H / CELL;
  var scoreEl = document.getElementById('snakeScore');
  var bestEl = document.getElementById('snakeBest');
  var targetEl = document.getElementById('snakeTarget');
  var startBtn = document.getElementById('snakeStart');
  var bestKey = 'circleSnakeBest';
  var best = Number(localStorage.getItem(bestKey) || 0);
  var snake = [], direction = {x:1,y:0}, queued = {x:1,y:0}, food = null, score = 0, timer = null, running = false, audio = null, touchStart = null, targetIndex = 0;
  var targets = [
    {name:'دونالد ترامپ',initial:'T',skin:'#e6b58b',hair:'#e5c45a',suit:'#26364e',tie:'#c84c43'},
    {name:'بنیامین نتانیاهو',initial:'N',skin:'#e1b18c',hair:'#55473f',suit:'#25364b',tie:'#4d8a9b'},
    {name:'جفری اپستین',initial:'E',skin:'#e2b18b',hair:'#473c37',suit:'#34455a',tie:'#8e4242'},
    {name:'جو بایدن',initial:'B',skin:'#edc49e',hair:'#d9d7cc',suit:'#2b405d',tie:'#4a79a5'},
    {name:'باراک اوباما',initial:'O',skin:'#9d674a',hair:'#302c2a',suit:'#1f3147',tie:'#a84848'},
    {name:'جورج بوش',initial:'G',skin:'#e6b58d',hair:'#8c6b4c',suit:'#29384d',tie:'#577b9a'},
    {name:'بیل کلینتون',initial:'C',skin:'#e8b995',hair:'#c4b9a9',suit:'#26364d',tie:'#8d4654'},
    {name:'رونالد ریگان',initial:'R',skin:'#e8bd9b',hair:'#cfc8ba',suit:'#26364d',tie:'#b64e46'},
    {name:'ریچارد نیکسون',initial:'N',skin:'#e4b391',hair:'#403b36',suit:'#29374c',tie:'#5a6f8b'},
    {name:'جیمی کارتر',initial:'J',skin:'#e9bd9b',hair:'#d4c9b6',suit:'#26364d',tie:'#527e7c'}
  ];
  bestEl.textContent = fa(best);
  function fa(n) { return Number(n || 0).toLocaleString('fa-IR'); }
  function app() { return window.KanoonApp; }
  function randTarget() { targetIndex = Math.floor(Math.random() * targets.length); return targets[targetIndex]; }
  function spawnFood() {
    var pos, attempts = 0;
    do {
      pos = {x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)};
      attempts++;
    } while (attempts < 1000 && snake.some(function (s) { return s.x===pos.x && s.y===pos.y; }));
    pos.target = randTarget();
    return pos;
  }
  function reset() {
    snake = [{x:10,y:14},{x:9,y:14},{x:8,y:14},{x:7,y:14}];
    direction = {x:1,y:0}; queued = {x:1,y:0}; score = 0; food = spawnFood(); running = true;
    scoreEl.textContent = fa(score); targetEl.textContent = 'هدف فعلی: ' + food.target.name;
    startBtn.textContent = 'بازی در جریان است'; startBtn.classList.add('playing');
    if (timer) clearInterval(timer);
    timer = setInterval(step, 115); draw();
  }
  function setDirection(dir) {
    if (!running) return;
    var dirs = {up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
    var next = dirs[dir]; if (!next) return;
    if (next.x === -direction.x && next.y === -direction.y) return;
    queued = next;
  }
  function step() {
    if (!running) return;
    direction = queued;
    var head = {x:snake[0].x+direction.x,y:snake[0].y+direction.y};
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return endGame();
    var eating = head.x === food.x && head.y === food.y;
    var collisionBody = eating ? snake : snake.slice(0,-1);
    if (collisionBody.some(function (part) { return part.x===head.x && part.y===head.y; })) return endGame();
    snake.unshift(head);
    if (eating) {
      score++; scoreEl.textContent = fa(score); crunch();
      targetEl.textContent = 'هدف بعدی: ' + (food.target && food.target.name ? food.target.name : 'هدف جدید');
      if (score > best) { best = score; localStorage.setItem(bestKey,String(best)); bestEl.textContent = fa(best); }
      food = spawnFood();
      targetEl.textContent = 'هدف فعلی: ' + food.target.name;
    } else snake.pop();
    draw();
  }
  function endGame() {
    running = false; if (timer) clearInterval(timer); timer = null;
    startBtn.classList.remove('playing'); startBtn.textContent = 'دوباره بازی کن';
    targetEl.textContent = 'پایان بازی — امتیاز: ' + fa(score) + ' · دوباره تلاش کن';
    draw(true);
  }
  function roundRect(x,y,w,h,r) {
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  }
  function drawFace(cx,cy,target) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.arc(cx,cy+1,10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = target.suit; ctx.beginPath(); ctx.arc(cx,cy,9.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = target.skin; ctx.beginPath(); ctx.ellipse(cx,cy,6.4,7.1,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = target.hair; ctx.beginPath(); ctx.ellipse(cx,cy-4.5,7,3.6,-.12,Math.PI,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2b2827'; ctx.beginPath(); ctx.arc(cx-2.3,cy-1,0.75,0,Math.PI*2); ctx.arc(cx+2.3,cy-1,0.75,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#7c4137'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(cx-1.6,cy+3); ctx.quadraticCurveTo(cx,cy+4,cx+1.6,cy+3); ctx.stroke();
    ctx.fillStyle = target.tie; ctx.beginPath(); ctx.moveTo(cx-2,cy+7); ctx.lineTo(cx,cy+9); ctx.lineTo(cx+2,cy+7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0,0,W,H);
    var bg=ctx.createLinearGradient(0,0,W,H); bg.addColorStop(0,'#173a3b'); bg.addColorStop(1,'#102827'); ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(210,239,211,.045)'; ctx.lineWidth=1;
    for(var x=0;x<=W;x+=CELL){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(var y=0;y<=H;y+=CELL){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    if(food) drawFace(food.x*CELL+CELL/2,food.y*CELL+CELL/2,food.target);
    for(var i=snake.length-1;i>=0;i--){
      var p=snake[i], isHead=i===0, inset=isHead?1.5:2.2;
      var grad=ctx.createLinearGradient(p.x*CELL,p.y*CELL,(p.x+1)*CELL,(p.y+1)*CELL);
      grad.addColorStop(0,isHead?'#b8e77c':'#75c56b'); grad.addColorStop(1,isHead?'#7cc45b':'#3b9958');
      ctx.fillStyle=grad; roundRect(p.x*CELL+inset,p.y*CELL+inset,CELL-inset*2,CELL-inset*2,isHead?6:5); ctx.fill();
      if(isHead){
        ctx.fillStyle='#173b2c';
        if(direction.x!==0){ctx.beginPath();ctx.arc(p.x*CELL+10,p.y*CELL+6,1.7,0,Math.PI*2);ctx.arc(p.x*CELL+10,p.y*CELL+14,1.7,0,Math.PI*2);ctx.fill();}
        else{ctx.beginPath();ctx.arc(p.x*CELL+6,p.y*CELL+10,1.7,0,Math.PI*2);ctx.arc(p.x*CELL+14,p.y*CELL+10,1.7,0,Math.PI*2);ctx.fill();}
      }
    }
    if(!running && snake.length){
      ctx.fillStyle='rgba(7,17,19,.24)';ctx.fillRect(0,0,W,H);
    }
  }
  function crunch() {
    try {
      var Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audio) audio = new Audio();
      if (audio.state === 'suspended') audio.resume();
      var duration=.095, buffer=audio.createBuffer(1,Math.floor(audio.sampleRate*duration),audio.sampleRate), data=buffer.getChannelData(0);
      for(var i=0;i<data.length;i++){var fade=1-i/data.length;data[i]=(Math.random()*2-1)*fade*fade;}
      var noise=audio.createBufferSource();noise.buffer=buffer;
      var filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1750;
      var gain=audio.createGain();gain.gain.setValueAtTime(.0001,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.28,audio.currentTime+.008);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);
      noise.connect(filter);filter.connect(gain);gain.connect(audio.destination);noise.start();noise.stop(audio.currentTime+duration);
      [0,.035].forEach(function(offset,i){var osc=audio.createOscillator(),g=audio.createGain();osc.type='triangle';osc.frequency.setValueAtTime(i?680:430,audio.currentTime+offset);osc.frequency.exponentialRampToValueAtTime(i?240:170,audio.currentTime+offset+.035);g.gain.setValueAtTime(.0001,audio.currentTime+offset);g.gain.exponentialRampToValueAtTime(i?.09:.13,audio.currentTime+offset+.004);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+offset+.04);osc.connect(g);g.connect(audio.destination);osc.start(audio.currentTime+offset);osc.stop(audio.currentTime+offset+.045);});
    } catch (e) {}
  }
  startBtn.addEventListener('click',function(){if(!running)reset();});
  document.querySelectorAll('[data-dir]').forEach(function(button){button.addEventListener('click',function(){setDirection(button.getAttribute('data-dir'));});});
  document.addEventListener('keydown',function(event){
    var map={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
    var dir=map[event.code];if(dir){event.preventDefault();setDirection(dir);}
  });
  canvas.addEventListener('pointerdown',function(event){touchStart={x:event.clientX,y:event.clientY};});
  canvas.addEventListener('pointerup',function(event){
    if(!touchStart)return;var dx=event.clientX-touchStart.x,dy=event.clientY-touchStart.y;touchStart=null;
    if(Math.max(Math.abs(dx),Math.abs(dy))<12)return;
    if(Math.abs(dx)>Math.abs(dy))setDirection(dx>0?'right':'left');else setDirection(dy>0?'down':'up');
  });
  snake=[{x:10,y:14},{x:9,y:14},{x:8,y:14},{x:7,y:14}];food=spawnFood();targetEl.textContent='هدف فعلی: '+food.target.name;draw();
  if(window.CircleGameAccess)window.CircleGameAccess.ready.then(function(allowed){if(!allowed)return;draw();});
})();
