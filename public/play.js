const stage = document.getElementById("gameStage");
const gameId = Number(location.pathname.split("/").filter(Boolean).pop());
async function loadGame() {
  try {
    const response = await fetch("/api/games/" + gameId);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Game could not be loaded.");
    const game = data.game;
    document.title = game.title + " | Reborn";
    document.getElementById("gameTitle").textContent = game.title;
    document.getElementById("gameDescription").textContent = game.description;
    document.getElementById("gameCreator").textContent = "By " + game.creator;
    document.getElementById("gameGenre").textContent = game.genre;
    if (game.template === "pet-clicker") renderPetClicker();
    else if (game.template === "tower-defense") renderTowerDefense();
    else if (game.template === "blocky-obby") renderObby();
    else throw new Error("Unknown game template.");
  } catch (error) {
    stage.innerHTML = '<div class="error-screen"><h2>Game unavailable</h2><p>' + escapeText(error.message) + '</p><a href="/">Return to Reborn</a></div>';
  }
}
function escapeText(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function renderPetClicker() {
  stage.innerHTML = '<div class="mini-game"><div style="font-size:54px">🐾</div><div class="kicker">PET CLICKER</div><h2>Collect coins for your pet!</h2><p>Tap to collect coins. Buy eggs to unlock a multiplier and collect faster.</p><div class="score-boxes"><div class="score-box"><strong id="coins">0</strong><span>COINS</span></div><div class="score-box"><strong id="power">1x</strong><span>CLICK POWER</span></div><div class="score-box"><strong id="pets">0</strong><span>PETS</span></div></div><button class="game-action" id="collect">🐾 Collect Coins</button><button class="game-action alt" id="egg">🥚 Hatch Egg · 25</button><div class="game-message" id="gameMessage">Your adventure starts now!</div></div>';
  let coins = 0, power = 1, pets = 0;
  const paint = () => {
    document.getElementById("coins").textContent = coins;
    document.getElementById("power").textContent = power + "x";
    document.getElementById("pets").textContent = pets;
  };
  document.getElementById("collect").onclick = () => { coins += power; paint(); };
  document.getElementById("egg").onclick = () => {
    if (coins < 25) { document.getElementById("gameMessage").textContent = "You need 25 coins for an egg."; return; }
    coins -= 25; pets += 1; power += 1; paint();
    document.getElementById("gameMessage").textContent = "New pet hatched! Your click power increased.";
  };
}
function renderTowerDefense() {
  stage.innerHTML = '<div class="mini-game"><div style="font-size:48px">🛡️</div><div class="kicker">TOWER DEFENSE MINI</div><h2>Defend the base!</h2><p>Place towers to stop incoming enemies. Start a wave and see if your defenses hold.</p><div class="score-boxes"><div class="score-box"><strong id="cash">$250</strong><span>CASH</span></div><div class="score-box"><strong id="wave">0</strong><span>WAVE</span></div><div class="score-box"><strong id="towerCount">0</strong><span>TOWERS</span></div><div class="score-box"><strong id="base">100%</strong><span>BASE HP</span></div></div><div class="tower-board" id="towerBoard"><div class="tower-tile">🏰</div></div><div class="tower-lane" id="enemyLane"><span style="font-size:11px;color:#87949c">No enemies on the path</span></div><button class="game-action alt" id="placeTower">🏹 Place Tower · $100</button><button class="game-action" id="startWave">▶ Start Wave</button><div class="game-message" id="gameMessage">Build your defense before starting a wave.</div></div>';
  let cash=250,wave=0,towers=0,base=100,running=false,enemies=0,kills=0,timer=null;
  const paint=()=>{
    document.getElementById("cash").textContent="$"+cash;
    document.getElementById("wave").textContent=wave;
    document.getElementById("towerCount").textContent=towers;
    document.getElementById("base").textContent=base+"%";
    document.getElementById("towerBoard").innerHTML='<div class="tower-tile">🏰</div>'+Array.from({length:towers},()=>'<div class="tower-tile">🏹</div>').join("");
    document.getElementById("enemyLane").innerHTML=enemies?Array.from({length:enemies},()=>'<span class="enemy">👾</span>').join(""):'<span style="font-size:11px;color:#87949c">No enemies on the path</span>';
  };
  document.getElementById("placeTower").onclick=()=>{
    if(running)return;
    if(cash<100){document.getElementById("gameMessage").textContent="Not enough cash for a tower.";return;}
    cash-=100;towers++;paint();
    document.getElementById("gameMessage").textContent="Tower placed. Your defense is stronger.";
  };
  document.getElementById("startWave").onclick=()=>{
    if(running)return;
    running=true;wave++;enemies=5+wave*2;kills=0;paint();
    document.getElementById("gameMessage").textContent="Wave "+wave+" is coming!";
    timer=setInterval(()=>{
      if(enemies<=0){clearInterval(timer);running=false;cash+=75+wave*20;paint();document.getElementById("gameMessage").textContent="Wave cleared! Bonus cash awarded.";return;}
      if(towers>0){const damage=Math.min(enemies,towers);enemies-=damage;kills+=damage;cash+=damage*8;}
      else {base=Math.max(0,base-10);enemies--;}
      paint();
      if(base<=0){clearInterval(timer);running=false;document.getElementById("gameMessage").textContent="The base fell. Refresh to try again.";document.getElementById("startWave").disabled=true;}
    },850);
  };
}
function renderObby() {
  stage.innerHTML = '<div class="mini-game"><div style="font-size:42px">🧱</div><div class="kicker">BLOCKY OBBY</div><h2>Reach the finish!</h2><p>Move with A/D or ←/→. Jump with Space or ↑. Avoid falling between platforms.</p><div class="canvas-wrap"><canvas id="obbyCanvas" width="860" height="340"></canvas></div><div class="game-message" id="gameMessage">Ready? Reach the green finish block!</div><button class="game-action alt" id="resetObby">↻ Restart</button><div class="controls">Keyboard: A / D or Arrow Keys · Jump: Space / Up</div></div>';
  const canvas=document.getElementById("obbyCanvas"),ctx=canvas.getContext("2d");
  const platforms=[{x:0,y:290,w:150},{x:205,y:250,w:110},{x:365,y:215,w:105},{x:520,y:175,w:105},{x:680,y:225,w:180}];
  let keys={},player={x:35,y:250,vx:0,vy:0,w:24,h:34,onGround:false},won=false,last=0;
  const down=e=>{keys[e.key.toLowerCase()]=true;if([" ","arrowup","arrowleft","arrowright"].includes(e.key.toLowerCase()))e.preventDefault();};
  const up=e=>{keys[e.key.toLowerCase()]=false;};
  window.addEventListener("keydown",down);window.addEventListener("keyup",up);
  function reset(){player={x:35,y:250,vx:0,vy:0,w:24,h:34,onGround:false};won=false;document.getElementById("gameMessage").textContent="Keep moving. Reach the green finish block!";}
  document.getElementById("resetObby").onclick=reset;
  function frame(time){
    const dt=Math.min((time-last)/16.67||1,2);last=time;
    if(!won){
      const left=keys.arrowleft||keys.a,right=keys.arrowright||keys.d,jump=keys[" "]||keys.arrowup||keys.w;
      player.vx=left?-3.2:right?3.2:player.vx*.76;
      if(jump&&player.onGround){player.vy=-9.6;player.onGround=false;}
      const prevY=player.y;
      player.vy+=.48*dt;player.x+=player.vx*dt;player.y+=player.vy*dt;player.onGround=false;
      for(const p of platforms){
        if(player.vy>=0&&prevY+player.h<=p.y&&player.y+player.h>=p.y&&player.x+player.w>p.x&&player.x<p.x+p.w){
          player.y=p.y-player.h;player.vy=0;player.onGround=true;
        }
      }
      player.x=Math.max(0,Math.min(canvas.width-player.w,player.x));
      if(player.y>canvas.height+30){reset();document.getElementById("gameMessage").textContent="Oops! You fell. Try again.";}
      if(player.x>760&&player.y+player.h<=225){won=true;document.getElementById("gameMessage").textContent="🎉 Obby completed! You reached the finish!";}
    }
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#dff2fc";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#9acfe9";ctx.fillRect(0,305,canvas.width,35);
    platforms.forEach((p,i)=>{ctx.fillStyle=i===platforms.length-1?"#48ad76":"#3987ba";ctx.fillRect(p.x,p.y,p.w,14);ctx.fillStyle="#27668e";ctx.fillRect(p.x,p.y+14,p.w,8);});
    ctx.fillStyle="#f4c542";ctx.fillRect(player.x,player.y,player.w,player.h);
    ctx.fillStyle="#34495e";ctx.fillRect(player.x+5,player.y+8,4,4);ctx.fillRect(player.x+15,player.y+8,4,4);
    ctx.fillStyle="#fff";ctx.font="12px Arial";ctx.fillText("START",12,25);ctx.fillText("FINISH",780,25);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
loadGame();