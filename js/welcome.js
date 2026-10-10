(function(){
  'use strict';
  var layer=document.getElementById('confettiLayer');
  var again=document.getElementById('celebrateAgain');
  if(!layer)return;
  var reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var palette=['#0f9d8b','#2563eb','#7c3aed','#d4a438','#60a5fa','#34d399','#f59e0b','#a5b4fc','#f472b6'];
  var cornerStarts=[
    {x:-1,y:-1,dx:1,dy:1},
    {x:101,y:-1,dx:-1,dy:1},
    {x:-1,y:101,dx:1,dy:-1},
    {x:101,y:101,dx:-1,dy:-1}
  ];
  function rand(min,max){return Math.random()*(max-min)+min;}
  function celebrate(){
    if(reduceMotion)return;
    var old=layer.querySelectorAll('.confetti-piece');
    Array.prototype.forEach.call(old,function(el){el.remove();});
    var total=124;
    for(var i=0;i<total;i++){
      var corner=cornerStarts[i%cornerStarts.length];
      var piece=document.createElement('span');
      var x=corner.x+rand(-2,4),y=corner.y+rand(-2,4);
      var dx=corner.dx*rand(90,Math.min(330,window.innerWidth*.82));
      var dy=corner.dy*rand(100,Math.min(440,window.innerHeight*.72));
      if(corner.y<0)dy+=rand(20,160);else dy-=rand(20,160);
      if(corner.x<0)dx+=rand(10,80);else dx-=rand(10,80);
      piece.className='confetti-piece'+(Math.random()<.24?' is-circle':Math.random()<.3?' is-ribbon':'');
      piece.style.setProperty('--start-x',x+'vw');
      piece.style.setProperty('--start-y',y+'vh');
      piece.style.setProperty('--dx',dx+'px');
      piece.style.setProperty('--dy',dy+'px');
      piece.style.setProperty('--size',rand(5,10)+'px');
      piece.style.setProperty('--color',palette[Math.floor(Math.random()*palette.length)]);
      piece.style.setProperty('--duration',rand(1.8,3.4)+'s');
      piece.style.setProperty('--delay',rand(0,.46)+'s');
      piece.style.setProperty('--spin',rand(-660,720)+'deg');
      layer.appendChild(piece);
      piece.addEventListener('animationend',function(){this.remove();},{once:true});
    }
  }
  if(again)again.addEventListener('click',celebrate);
  celebrate();
})();