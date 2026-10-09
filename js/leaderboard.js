(function(){
'use strict';
function boot(){
  if(!window.KanoonApp||!window.KanoonApp.api){setTimeout(boot,60);return}
  var app=window.KanoonApp, podium=document.getElementById('podium'),list=document.getElementById('rankingList'),loading=document.getElementById('podiumLoading'),member=app.session.getMember();
  app.api.get({action:'getGameData'}).then(function(data){
    var rows=(data.allTimeLeaderboard||[]).slice(0,10);
    loading.style.display='none';
    if(!rows.length){
      podium.innerHTML='<div class="ranking-empty"><span>🏆</span><strong>هنوز رکورد تاریخی ثبت نشده</strong><p>اولین نفری باش که وارد جدول قهرمانان می‌شود</p></div>';
      list.innerHTML='';
      return;
    }
    renderPodium(rows,member);
    renderList(rows,member);
  }).catch(function(err){
    loading.textContent=err.message||'دریافت رتبه‌بندی ناموفق بود';
    loading.classList.add('error');
  });
}
function renderPodium(rows,member){
  var order=[1,0,2];
  document.getElementById('podium').innerHTML=order.filter(function(i){return rows[i]}).map(function(i){
    var x=rows[i],rank=i+1,me=member&&x.memberId===member.id;
    return '<div class="podium-item rank-'+rank+(me?' is-me':'')+'">'+
      '<div class="podium-medal">'+(rank===1?'🥇':rank===2?'🥈':'🥉')+'</div>'+
      '<div class="podium-avatar">'+avatarMarkup(x.profileImage,x.playerName)+'</div>'+
      '<strong class="podium-name">'+esc(x.playerName)+(me?'<small>شما</small>':'')+'</strong>'+
      '<b class="podium-score">'+Number(x.score||0).toLocaleString('fa-IR')+'</b>'+
      '<span class="podium-rank">رتبه '+rank.toLocaleString('fa-IR')+'</span>'+
      '</div>';
  }).join('');
}
function renderList(rows,member){
  document.getElementById('rankingList').innerHTML=rows.map(function(x,i){
    var rank=i+1,me=member&&x.memberId===member.id;
    return '<div class="ranking-row rank-'+rank+(me?' is-me':'')+'">'+
      '<div class="ranking-position">'+(rank<=3?(rank===1?'🥇':rank===2?'🥈':'🥉'):rank.toLocaleString('fa-IR'))+'</div>'+
      '<div class="ranking-avatar">'+avatarMarkup(x.profileImage,x.playerName)+'</div>'+
      '<div class="ranking-name"><strong>'+esc(x.playerName)+'</strong>'+(me?'<small>رکورد شما</small>':'')+'</div>'+
      '<div class="ranking-score"><strong>'+Number(x.score||0).toLocaleString('fa-IR')+'</strong><small>رکورد</small></div>'+
      '</div>';
  }).join('');
}
function avatarMarkup(url,name){
  var initial=esc((name||'ع').charAt(0));
  return '<span class="ranking-avatar__fallback">'+initial+'</span>'+(url?'<img src="'+esc(url)+'" alt="" loading="lazy" onerror="this.remove()">':'');
}
function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();