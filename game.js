(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const $ = (s) => document.querySelector(s);
  const ui = {hud:$('#hud'),welcome:$('#welcome'),levelScreen:$('#levelScreen'),pause:$('#pauseScreen'),result:$('#resultScreen'),timer:$('#timer'),hp:$('#hpText'),health:$('#healthBar'),xp:$('#xpFill'),level:$('#level'),kills:$('#kills'),boss:$('#bossBar'),bossFill:$('#bossFill'),hint:$('#hint')};
  const heroes = {
    luna:{name:'LUNA',color:'#d7a8f4',hair:'#483765',dress:'#76578e',hp:100,speed:210,damage:19,rate:.76,icon:'✦'},
    sakura:{name:'SAKURA',color:'#f38cb4',hair:'#a83c66',dress:'#a54672',hp:85,speed:245,damage:15,rate:.60,icon:'✿'},
    yuki:{name:'YUKI',color:'#a9e3f2',hair:'#4e718e',dress:'#52789a',hp:125,speed:188,damage:22,rate:.86,icon:'❄'}
  };
  const upgrades = [
    {title:'Lunar Volley',icon:'☄',desc:'Cast spells 18% faster.',apply:g=>g.rate*=.82},
    {title:'Starfire',icon:'✦',desc:'Deal 25% more spell damage.',apply:g=>g.damage*=1.25},
    {title:'Witchstep',icon:'☽',desc:'Move 12% faster and evade shadows.',apply:g=>g.speed*=1.12},
    {title:'Moonwell',icon:'♡',desc:'Restore 30 health and increase max health by 10.',apply:g=>{g.maxHp+=10;g.hp=Math.min(g.maxHp,g.hp+30)}},
    {title:'Twin Comets',icon:'✧',desc:'Launch an extra magic bolt each cast.',apply:g=>g.bolts++},
    {title:'Wider Orbit',icon:'❋',desc:'Increase spell range by 20%.',apply:g=>g.range*=1.2},
    {title:'Thorned Aura',icon:'❀',desc:'Your aura deals contact damage to nearby foes.',apply:g=>g.aura+=10},
    {title:'Lucky Charm',icon:'♧',desc:'Moon shards are worth 25% more experience.',apply:g=>g.xpBonus*=1.25}
  ];
  let W=innerWidth,H=innerHeight,DPR=1,selected='luna',state='menu',last=0,keys={},touch={},game=null,acc=0,muted=true,audioCtx=null;
  const rand=(a,b)=>a+Math.random()*(b-a), clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function resize(){W=innerWidth;H=innerHeight;DPR=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(W*DPR);canvas.height=Math.floor(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}
  addEventListener('resize',resize);resize();
  function startGame(){
    const h=heroes[selected];
    game={hero:h.name,heroData:h,x:W/2,y:H/2,hp:h.hp,maxHp:h.hp,speed:h.speed,damage:h.damage,rate:h.rate,range:470,bolts:1,aura:0,xpBonus:1,xp:0,nextXp:6,level:1,kills:0,time:0,spawn:0,attack:0,enemies:[],shots:[],gems:[],particles:[],floaters:[],boss:null,hit:0,invuln:0,shake:0};
    state='playing'; ui.welcome.classList.remove('active');ui.pause.classList.remove('active');ui.result.classList.remove('active');ui.levelScreen.classList.remove('active');ui.hud.classList.add('active');ui.hint.style.display='block';ui.boss.classList.remove('active');document.querySelector('.pause-control').style.display=innerWidth>760?'none':'block';
    $('#heroName').textContent=h.name;$('#hudPortrait').textContent=h.icon;updateHud();last=performance.now();
  }
  function updateHud(){if(!game)return;ui.hp.textContent=Math.ceil(game.hp);ui.health.style.width=`${100*game.hp/game.maxHp}%`;ui.xp.style.width=`${100*game.xp/game.nextXp}%`;ui.level.textContent=game.level;ui.kills.textContent=game.kills;ui.timer.textContent=fmt(game.time)}
  function fmt(t){let n=Math.floor(t);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
  function tone(freq=520,duration=.07){if(muted)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),gain=audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audioCtx.currentTime);gain.gain.setValueAtTime(.035,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(gain);gain.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration)}catch(_){}}
  function openLevel(){state='level';ui.levelScreen.classList.add('active');const choices=[];while(choices.length<3){const u=upgrades[Math.floor(Math.random()*upgrades.length)];if(!choices.includes(u))choices.push(u)}const wrap=$('#upgradeChoices');wrap.innerHTML='';choices.forEach((u,i)=>{const b=document.createElement('button');b.className='upgrade-card';b.innerHTML=`<div class="upgrade-icon">${u.icon}</div><h3>${u.title}</h3><p>${u.desc}</p>`;b.onclick=()=>chooseUpgrade(u);wrap.appendChild(b)});game.choiceKeys=choices}
  function chooseUpgrade(u){if(state!=='level')return;u.apply(game);ui.levelScreen.classList.remove('active');state='playing';last=performance.now();updateHud()}
  function spawnEnemy(){if(!game)return;let angle=rand(0,Math.PI*2),dist=Math.max(W,H)*.62+50;let x=game.x+Math.cos(angle)*dist,y=game.y+Math.sin(angle)*dist;const elapsed=game.time;let type=Math.random()<Math.min(.4,.1+elapsed/220)?'wisp':Math.random()<.36?'bat':'shade';if(game.boss){type=Math.random()<.45?'bat':'shade'}const hp=(type==='wisp'?37:type==='bat'?20:29)*(1+elapsed/115);game.enemies.push({x,y,hp,maxHp:hp,r:type==='wisp'?16:type==='bat'?11:14,speed:(type==='bat'?90:type==='wisp'?53:68)+Math.min(30,elapsed*.12),type,hit:0,phase:rand(0,6),boss:false})}
  function spawnBoss(){if(game.boss)return;let x=game.x+(Math.random()<.5?-1:1)*Math.max(390,W*.56),y=game.y-rand(130,250);const hp=1100+game.time*2.7;game.boss={x,y,hp,maxHp:hp,r:43,speed:37,phase:0,hit:0,boss:true};game.enemies.push(game.boss);ui.boss.classList.add('active');ui.hint.innerHTML='<span>WASD</span> dodge the Hollow Queen <i>·</i> gather moon shards';}
  function fire(){if(!game)return;const candidates=game.enemies.filter(e=>Math.hypot(e.x-game.x,e.y-game.y)<game.range).sort((a,b)=>Math.hypot(a.x-game.x,a.y-game.y)-Math.hypot(b.x-game.x,b.y-game.y));if(!candidates.length)return;const target=candidates[0],base=Math.atan2(target.y-game.y,target.x-game.x);tone(720,.045);for(let n=0;n<game.bolts;n++){let angle=base+(n-(game.bolts-1)/2)*.13;game.shots.push({x:game.x+Math.cos(angle)*16,y:game.y+Math.sin(angle)*16,vx:Math.cos(angle)*480,vy:Math.sin(angle)*480,life:1.55,damage:game.damage,r:6,color:game.heroData.color})}burst(game.x,game.y,game.heroData.color,3)}
  function burst(x,y,color,num=8){for(let i=0;i<num;i++){let a=rand(0,Math.PI*2),s=rand(25,145);game.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.22,.6),max:.6,color,r:rand(1.5,4)})}}
  function dropGem(e){const xp=(e.boss?30:e.type==='wisp'?3:1)*game.xpBonus;game.gems.push({x:e.x,y:e.y,vx:rand(-20,20),vy:rand(-20,20),xp,r:e.boss?8:5,phase:rand(0,6),color:e.boss?'#ffd18e':'#c6a0ff'})}
  function damageEnemy(e,d){e.hp-=d;e.hit=.12;if(e.hp<=0){game.kills++;dropGem(e);burst(e.x,e.y,e.boss?'#ff9bbd':e.type==='wisp'?'#ffb4db':'#ae91e9',e.boss?24:7);if(e.boss){game.boss=null;ui.boss.classList.remove('active');game.hp=Math.min(game.maxHp,game.hp+25);game.floaters.push({x:game.x,y:game.y-44,text:'QUEEN BANISHED! +25 ♥',life:1.5,color:'#ffafd2'})}}}
  function update(dt){if(!game||state!=='playing')return;game.time+=dt;game.attack-=dt;game.spawn-=dt;game.invuln=Math.max(0,game.invuln-dt);game.hit=Math.max(0,game.hit-dt);game.shake=Math.max(0,game.shake-dt);
    if(game.attack<=0){fire();game.attack=game.rate}
    if(game.spawn<=0){spawnEnemy();game.spawn=Math.max(.16,.76-game.time*.0025)}
    if(game.time>58&&!game.boss&&!game.bossCalled){game.bossCalled=true;spawnBoss()}
    if(game.time>=150){endGame(true);return}
    let dx=(keys.right||keys.ArrowRight?1:0)-(keys.left||keys.ArrowLeft?1:0)+(touch.right?1:0)-(touch.left?1:0),dy=(keys.down||keys.ArrowDown?1:0)-(keys.up||keys.ArrowUp?1:0)+(touch.down?1:0)-(touch.up?1:0);let mag=Math.hypot(dx,dy);if(mag){dx/=mag;dy/=mag;game.x=clamp(game.x+dx*game.speed*dt,27,W-27);game.y=clamp(game.y+dy*game.speed*dt,80,H-35)}
    for(let i=game.enemies.length-1;i>=0;i--){const e=game.enemies[i];e.phase+=dt*4;e.hit=Math.max(0,e.hit-dt);let ex=game.x-e.x,ey=game.y-e.y,d=Math.hypot(ex,ey)||1;let speed=e.speed*(e.boss&&d<125?.72:1);e.x+=ex/d*speed*dt;e.y+=ey/d*speed*dt;if(d<e.r+15&&game.invuln<=0){game.hp-=e.boss?17:12;game.invuln=.7;game.shake=.2;tone(170,.16);burst(game.x,game.y,'#ff7baf',9);if(game.hp<=0){endGame(false);return}}if(game.aura&&d<52){e.hp-=game.aura*dt;if(e.hp<=0)damageEnemy(e,0)}if(e.hp<=0){game.enemies.splice(i,1)}}
    for(let i=game.shots.length-1;i>=0;i--){const s=game.shots[i];s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;let hit=false;for(const e of game.enemies){if(Math.hypot(e.x-s.x,e.y-s.y)<e.r+s.r){damageEnemy(e,s.damage);hit=true;burst(s.x,s.y,s.color,5);break}}if(hit||s.life<=0)game.shots.splice(i,1)}
    for(let i=game.gems.length-1;i>=0;i--){const g=game.gems[i];g.phase+=dt*4;let d=Math.hypot(game.x-g.x,game.y-g.y);if(d<115){g.x+=(game.x-g.x)/Math.max(d,1)*340*dt;g.y+=(game.y-g.y)/Math.max(d,1)*340*dt}if(d<19){game.xp+=g.xp;burst(g.x,g.y,g.color,4);game.gems.splice(i,1);if(game.xp>=game.nextXp){game.xp-=game.nextXp;game.level++;game.nextXp=Math.ceil(game.nextXp*1.35+2);updateHud();openLevel();break}}}
    for(let p=game.particles.length-1;p>=0;p--){let a=game.particles[p];a.x+=a.vx*dt;a.y+=a.vy*dt;a.vx*=.97;a.vy*=.97;a.life-=dt;if(a.life<=0)game.particles.splice(p,1)}
    for(let f=game.floaters.length-1;f>=0;f--){let a=game.floaters[f];a.y-=25*dt;a.life-=dt;if(a.life<=0)game.floaters.splice(f,1)}
    if(game.boss)ui.bossFill.style.width=`${Math.max(0,100*game.boss.hp/game.boss.maxHp)}%`;updateHud();
  }
  function endGame(won){state='result';ui.hud.classList.remove('active');ui.boss.classList.remove('active');ui.hint.style.display='none';ui.result.classList.add('active');$('#resultEyebrow').innerHTML=won?'<span></span> YOU HELD BACK THE NIGHT':'<span></span> THE NIGHT WAS TOO MUCH';$('#resultTitle').innerHTML=won?'Dawn <em>breaks.</em>':'Shadows <em>fall.</em>';$('#resultCopy').textContent=won?'The garden is quiet. The moon remembers your name.':'The coven will rise again. Every night is a new beginning.';$('#finalTime').textContent=fmt(game.time);$('#finalKills').textContent=game.kills;$('#finalLevel').textContent=game.level}
  function pause(){if(state==='playing'){state='paused';ui.pause.classList.add('active')}else if(state==='paused'){state='playing';ui.pause.classList.remove('active');last=performance.now()}}
  function rounded(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
  function drawBackground(){ctx.fillStyle='#0f0a18';ctx.fillRect(0,0,W,H);const grad=ctx.createRadialGradient(W*.5,H*.44,40,W*.5,H*.44,Math.max(W,H)*.82);grad.addColorStop(0,'#2d1638');grad.addColorStop(.42,'#1a1027');grad.addColorStop(.72,'#120d1e');grad.addColorStop(1,'#080710');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    const cameraX=game?game.x:W/2,cameraY=game?game.y:H/2;ctx.save();ctx.translate(-cameraX+W/2,-cameraY+H/2);
    ctx.strokeStyle='rgba(227,180,255,0.08)';ctx.lineWidth=1;for(let x=0;x<2000;x+=100){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,2000);ctx.stroke()}for(let y=0;y<2000;y+=100){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(2000,y);ctx.stroke()}
    for(let i=0;i<120;i++){let x=((i*197+53)%2200)-100,y=((i*317+83)%1900)-100;ctx.fillStyle=i%3?'rgba(238,185,255,0.08)':'rgba(255,211,156,0.09)';ctx.beginPath();ctx.arc(x,y,(i%3)+1.1,0,Math.PI*2);ctx.fill();if(i%9===0){ctx.strokeStyle='rgba(255,199,230,0.12)';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+5,y-9);ctx.stroke()}}
    ctx.restore();for(let i=0;i<58;i++){let x=(i*173+42)%W,y=(i*263+70)%H;ctx.fillStyle=i%2?'rgba(245,194,255,0.85)':'rgba(255,236,180,0.75)';ctx.globalAlpha=.25+Math.sin(performance.now()*.001+i)*.25;ctx.beginPath();ctx.arc(x,y,1.2+(i%3)*.5,0,7);ctx.fill()}ctx.globalAlpha=1}
  function drawWitch(x,y,hero,scale=1,blink=false){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);let c=hero||heroes.luna;let bob=Math.sin(performance.now()*.006)*2;ctx.translate(0,bob);
    // ground shadow
    ctx.fillStyle='#08071077';ctx.beginPath();ctx.ellipse(0,15,19,7,0,0,7);ctx.fill();
    // hair flowing behind
    ctx.fillStyle=c.hair;ctx.beginPath();ctx.moveTo(-12,-27);ctx.quadraticCurveTo(-27,-5,-19,16);ctx.lineTo(-8,9);ctx.lineTo(3,19);ctx.lineTo(18,9);ctx.lineTo(21,-16);ctx.closePath();ctx.fill();
    // cape / dress
    ctx.fillStyle=c.dress;ctx.beginPath();ctx.moveTo(-12,-2);ctx.quadraticCurveTo(-19,5,-21,16);ctx.lineTo(-13,13);ctx.lineTo(0,18);ctx.lineTo(17,14);ctx.lineTo(12,-5);ctx.closePath();ctx.fill();ctx.fillStyle='#dca3cd';ctx.beginPath();ctx.moveTo(-5,-1);ctx.lineTo(5,-1);ctx.lineTo(9,11);ctx.lineTo(0,14);ctx.lineTo(-8,10);ctx.closePath();ctx.fill();
    // face
    ctx.fillStyle=blink?'#d995ad':(selected==='yuki'?'#e1f4f4':'#f6d4d0');ctx.beginPath();ctx.ellipse(0,-14,12,14,0,0,7);ctx.fill();ctx.fillStyle=c.hair;ctx.beginPath();ctx.moveTo(-13,-16);ctx.quadraticCurveTo(-12,-32,1,-29);ctx.quadraticCurveTo(13,-28,13,-13);ctx.lineTo(7,-18);ctx.lineTo(3,-11);ctx.lineTo(-3,-18);ctx.lineTo(-10,-11);ctx.closePath();ctx.fill();
    // eyes + blush
    ctx.fillStyle='#31233f';ctx.beginPath();ctx.ellipse(-4,-13,1.7,2.7,0,0,7);ctx.ellipse(4,-13,1.7,2.7,0,0,7);ctx.fill();ctx.fillStyle='#ffb3c388';ctx.beginPath();ctx.ellipse(-8,-9,2,1,0,0,7);ctx.ellipse(8,-9,2,1,0,0,7);ctx.fill();
    // pointed witch hat
    ctx.fillStyle='#2d213e';ctx.beginPath();ctx.moveTo(-17,-25);ctx.lineTo(-3,-49);ctx.lineTo(4,-28);ctx.lineTo(18,-23);ctx.quadraticCurveTo(0,-19,-17,-25);ctx.fill();ctx.fillStyle=c.color;ctx.fillRect(-14,-26,28,2);
    ctx.fillStyle=c.color;ctx.font='10px serif';ctx.textAlign='center';ctx.fillText(hero===heroes.sakura?'✿':hero===heroes.yuki?'❄':'✦',0,9);
    ctx.restore()}
  function drawEnemy(e){ctx.save();ctx.translate(e.x,e.y);let float=Math.sin(e.phase)*3;ctx.translate(0,float);let col=e.type==='bat'?'#8d6bd3':e.type==='wisp'?'#e77bb7':'#7c6a96';if(e.boss)col='#d85b8f';if(e.hit>0)col='#fff3ff';
    if(e.boss){ctx.shadowColor='#ff8bb2';ctx.shadowBlur=24;ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,e.r,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#3c1b2f';ctx.beginPath();ctx.moveTo(-30,-25);ctx.lineTo(-42,-53);ctx.lineTo(-10,-34);ctx.moveTo(30,-25);ctx.lineTo(42,-53);ctx.lineTo(10,-34);ctx.fill();ctx.fillStyle='#ffd4ea';ctx.beginPath();ctx.arc(-13,-4,4,0,7);ctx.arc(13,-4,4,0,7);ctx.fill();ctx.fillStyle='#2f1226';ctx.beginPath();ctx.ellipse(0,11,8,4,0,0,7);ctx.fill();ctx.fillStyle='#ffe9f2';ctx.font='12px serif';ctx.textAlign='center';ctx.fillText('♛',0,-2)}else if(e.type==='bat'){ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-10,-18,-22,-12);ctx.lineTo(-17,2);ctx.lineTo(-9,0);ctx.lineTo(0,10);ctx.lineTo(9,0);ctx.lineTo(17,2);ctx.lineTo(22,-12);ctx.quadraticCurveTo(9,-18,0,0);ctx.fill();ctx.fillStyle='#ffd5e8';ctx.fillRect(-5,-2,2,3);ctx.fillRect(3,-2,2,3)}else{ctx.shadowColor=col;ctx.shadowBlur=e.type==='wisp'?20:0;ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,e.r,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle=e.type==='wisp'?'#fff1fb':'#e5d9ff';ctx.beginPath();ctx.arc(-5,-2,2.1,0,7);ctx.arc(5,-2,2.1,0,7);ctx.fill();ctx.fillStyle='#2d1837';ctx.beginPath();ctx.ellipse(0,6,3,2,0,0,7);ctx.fill()}
    if(e.hp<e.maxHp&&e.hp>0){ctx.fillStyle='rgba(12,7,19,0.8)';rounded(-e.r,-e.r-8,e.r*2,3,2);ctx.fillStyle=e.boss?'#ff9ab9':'#e7b5ff';ctx.fillRect(-e.r,-e.r-8,Math.max(0,e.r*2*e.hp/e.maxHp),3)}ctx.restore()}
  function draw(){drawBackground();if(!game)return;ctx.save();if(game.shake)ctx.translate(rand(-3,3),rand(-3,3));
    // magic aura
    if(game.aura){ctx.strokeStyle=`rgba(234,167,255,${.22+Math.sin(performance.now()*.006)*.08})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(game.x,game.y,48,0,7);ctx.stroke();ctx.fillStyle='#d8aaff08';ctx.fill()}
    for(const g of game.gems){ctx.save();ctx.translate(g.x,g.y+Math.sin(g.phase)*3);ctx.rotate(Math.PI/4);ctx.shadowColor=g.color;ctx.shadowBlur=12;ctx.fillStyle=g.color;ctx.fillRect(-g.r/2,-g.r/2,g.r,g.r);ctx.restore()}
    for(const e of game.enemies)drawEnemy(e);
    for(const s of game.shots){ctx.save();ctx.shadowColor=s.color;ctx.shadowBlur=18;ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,7);ctx.fill();ctx.restore()}
    for(const p of game.particles){ctx.globalAlpha=Math.max(0,p.life/.6);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill()}ctx.globalAlpha=1;
    drawWitch(game.x,game.y,game.heroData,1,game.invuln>0&&Math.floor(performance.now()/90)%2===0);
    for(const f of game.floaters){ctx.globalAlpha=Math.min(1,f.life);ctx.fillStyle=f.color;ctx.font='bold 12px DM Sans';ctx.textAlign='center';ctx.fillText(f.text,f.x,f.y)}ctx.globalAlpha=1;ctx.restore();
    // subtle vignette gameplay
  }
  function loop(now){let dt=Math.min(.04,(now-last)/1000||0);last=now;if(state==='playing')update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
  document.querySelectorAll('.character-card').forEach(b=>b.onclick=()=>{document.querySelectorAll('.character-card').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');selected=b.dataset.hero});
  $('#startBtn').onclick=startGame;$('#againBtn').onclick=()=>{ui.result.classList.remove('active');ui.welcome.classList.add('active');state='menu';game=null;ui.hud.classList.remove('active')};$('#resumeBtn').onclick=pause;$('#pauseBtn').onclick=pause;$('#restartPause').onclick=startGame;
  $('#soundBtn').onclick=()=>{muted=!muted;$('#soundBtn').textContent=muted?'♫':'♪';$('#soundBtn').style.color=muted?'':'#f5a2c6';if(!muted)tone(560,.12)};
  addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys[e.key]=true;if(e.key==='Escape'||e.key==='p'||e.key==='P')pause();if(state==='level'&&['1','2','3'].includes(e.key))chooseUpgrade(game.choiceKeys[Number(e.key)-1])});addEventListener('keyup',e=>keys[e.key]=false);
  document.querySelectorAll('.mobile-pad button').forEach(b=>{const dir=b.dataset.dir;const on=e=>{e.preventDefault();touch[dir]=true},off=e=>{e.preventDefault();touch[dir]=false};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off)});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause()});
})();
