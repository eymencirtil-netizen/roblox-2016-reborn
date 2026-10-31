const modal = document.getElementById("modal");
const form = document.getElementById("authForm");
const errorBox = document.getElementById("formError");
let mode = "register";
let currentUser = null;
let shopItems = [];
let ownedItemIds = [];
const $ = id => document.getElementById(id);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}
function openModal(nextMode) {
  mode = nextMode; modal.hidden = false; errorBox.textContent = "";
  $("modalTitle").textContent = mode === "register" ? "Create your account" : "Welcome back";
  $("modalSub").textContent = mode === "register" ? "Your adventure starts here." : "Log in to your Reborn account.";
  $("usernameWrap").hidden = mode !== "register";
  $("emailWrap").hidden = mode !== "register";
  $("loginWrap").hidden = mode !== "login";
  form.elements.username.required = mode === "register";
  form.elements.email.required = mode === "register";
  form.elements.login.required = mode === "login";
  form.elements.password.autocomplete = mode === "register" ? "new-password" : "current-password";
  $("submitAuth").textContent = mode === "register" ? "Create account" : "Log in";
  $("switchMode").innerHTML = mode === "register"
    ? 'Already have an account? <button type="button" data-open="login">Log in</button>'
    : 'New to Reborn? <button type="button" data-open="register">Create an account</button>';
  modal.querySelector("input:not([type=hidden]):not([disabled])").focus();
}
function closeModal() { modal.hidden = true; form.reset(); errorBox.textContent = ""; }

function openOfficialGame(name) {
  const games = {
    "Brookhaven RP": { id: "4924922222", description: "Roleplay, homes, vehicles and a big city." },
    "Adopt Me!": { id: "920587237", description: "Raise pets, build a home and play with friends." },
    "Blox Fruits": { id: "2753915549", description: "Explore islands, fight enemies and level up." },
    "Piggy": { id: "4623386862", description: "Survive story chapters and escape." },
    "BedWars": { id: "6872265039", description: "Defend your bed and battle other teams." },
    "Royale High": { id: "735030788", description: "Fashion, roleplay and magical school worlds." },
    "MeepCity": { id: "370731277", description: "A social hangout with homes and pets." },
    "Tower of Hell": { id: "1962086868", description: "Climb a challenging obstacle course." },
    "Murder Mystery 2": { id: "142823291", description: "Find the murderer and survive the round." },
    "Pet Simulator X": { id: "6284583030", description: "Collect pets, hatch eggs and explore worlds." },
    "Tower Defense Simulator": { id: "3260590327", description: "Place towers and stop waves of enemies." },
    "All Star Tower Defense": { id: "4996049426", description: "Build a team and defend against enemy waves." }
  };
  const game = games[name];
  if (!game) return;
  $("gameModalTitle").textContent = name;
  $("gameModalDescription").textContent = game.description;
  $("gameModalIcon").textContent = name.includes("Pet") ? "🐾" : name.includes("Tower") ? "🛡️" : "🎮";
  $("gameLaunchNote").textContent = "Bu, Roblox'taki orijinal deneyimdir. Açmak için Roblox masaüstü uygulaması kurulu ve hesabın açık olmalı.";
  $("launchGameButton").href = "roblox://placeId=" + game.id;
  $("launchGameButton").textContent = "▶ Roblox uygulamasında aç";
  $("gameWebFallback").href = "https://www.roblox.com/games/start?placeId=" + game.id;
  $("gameWebFallback").textContent = "Oyun sayfası / uygulamayı aç";
  $("gameModal").hidden = false;
}
function closeGameModal() { $("gameModal").hidden = true; }
document.addEventListener("click", event => {
  const opener = event.target.closest("[data-open]");
  if (opener) { openModal(opener.dataset.open); return; }
  if (event.target.id === "closeModal" || event.target === modal) closeModal();
  if (event.target.id === "closeGameModal" || event.target === $("gameModal")) closeGameModal();
  const rebornGame = event.target.closest("[data-reborn-game]");
  if (rebornGame) { window.location.href = "/play/" + encodeURIComponent(rebornGame.dataset.rebornGame); return; }
  const officialGame = event.target.closest("[data-game]");
  if (officialGame) { openOfficialGame(officialGame.dataset.game); return; }
  const buy = event.target.closest("[data-buy]");
  if (buy) buyItem(buy.dataset.buy);
  const equip = event.target.closest("[data-equip]");
  if (equip) equipItem(equip.dataset.equip);
});

const creatorForm = document.getElementById("creatorForm");
if (creatorForm) {
  creatorForm.addEventListener("submit", async event => {
    event.preventDefault();
    const message = $("creatorMessage");
    if (!currentUser) { message.textContent = "Oyun yayınlamak için önce giriş yap."; openModal("login"); return; }
    const submit = creatorForm.querySelector("button[type=submit]");
    submit.disabled = true; submit.textContent = "Publishing…"; message.textContent = "";
    const payload = Object.fromEntries(new FormData(creatorForm).entries());
    try {
      const response = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Oyun yayınlanamadı.");
      creatorForm.reset();
      message.textContent = "Oyunun yayınlandı! Community Creations bölümünde görünüyor.";
      await loadCommunityGames();
      toast("Oyun Reborn kataloğunda yayınlandı!");
    } catch (error) { message.textContent = error.message; }
    finally { submit.disabled = false; submit.textContent = "Publish experience"; }
  });
}

async function loadCommunityGames() {
  const grid = $("communityGamesGrid");
  if (!grid) return;
  try {
    const response = await fetch("/api/games");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Oyunlar yüklenemedi.");
    if (!data.games.length) {
      grid.innerHTML = '<div class="community-empty">Henüz topluluk oyunu yok. İlk oyunu sen yayınla!</div>';
      return;
    }
    const icons = { "pet-clicker": "🐾", "blocky-obby": "🧱", "tower-defense": "🛡️" };
    const classes = { "pet-clicker": "art-petsim", "blocky-obby": "art-tower", "tower-defense": "art-tds" };
    grid.innerHTML = data.games.map(game =>
      '<article class="classic-game-card" data-title="' + escapeHtml(game.title) + '">' +
      '<div class="classic-game-art ' + (classes[game.template] || "art-blox") + '">' + (icons[game.template] || "🎮") + '</div>' +
      '<div class="classic-game-text"><h3>' + escapeHtml(game.title) + '</h3><p>' + escapeHtml(game.genre) + ' · by ' + escapeHtml(game.creator) + '</p>' +
      '<button data-reborn-game="' + Number(game.id) + '">▶ Play in Reborn</button></div></article>'
    ).join("");
  } catch (error) {
    grid.innerHTML = '<div class="community-empty">Community catalog unavailable. ' + escapeHtml(error.message) + '</div>';
  }
}

function filterGames() {
  const input = $("gameSearch");
  if (!input) return;
  const term = input.value.trim().toLowerCase();
  document.querySelectorAll(".classic-game-card").forEach(card => {
    const text = (card.dataset.title || card.textContent).toLowerCase();
    card.style.display = !term || text.includes(term) ? "" : "none";
  });
}
$("searchButton")?.addEventListener("click", filterGames);
$("gameSearch")?.addEventListener("input", filterGames);

form.addEventListener("submit", async event => {
  event.preventDefault(); errorBox.textContent = "";
  const data = Object.fromEntries(new FormData(form).entries());
  const endpoint = mode === "register" ? "/api/register" : "/api/login";
  $("submitAuth").disabled = true; $("submitAuth").textContent = "Please wait…";
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Bir hata oluştu.");
    closeModal(); await loadMe(); await loadShop();
    toast(mode === "register" ? "Hesabın oluşturuldu! 500 ReBux hesabına eklendi." : "Tekrar hoş geldin!");
  } catch (error) { errorBox.textContent = error.message; }
  finally { $("submitAuth").disabled = false; $("submitAuth").textContent = mode === "register" ? "Create account" : "Log in"; }
});

async function loadMe() {
  try {
    const response = await fetch("/api/me"); const data = await response.json(); currentUser = data.user;
    const area = $("accountArea");
    if (currentUser) {
      area.innerHTML = '<div class="user-chip"><span class="avatar-mini">' + escapeHtml(currentUser.username[0].toUpperCase()) + '</span><span>' + escapeHtml(currentUser.username) + '</span><button class="btn light" id="logoutBtn">Logout</button></div>';
      $("logoutBtn").onclick = async () => {
        await fetch("/api/logout", { method: "POST" }); currentUser = null; await loadMe(); await loadShop(); toast("Çıkış yapıldı.");
      };
    } else {
      area.innerHTML = '<button class="btn light" data-open="login">Login</button><button class="btn white" data-open="register">Sign Up</button>';
    }
    const sideUser = $("sideUser");
    if (sideUser) sideUser.innerHTML = '<div class="side-avatar">' + escapeHtml(currentUser ? currentUser.username[0].toUpperCase() : "?") + '</div><div><strong>' + escapeHtml(currentUser ? currentUser.username : "Guest") + '</strong><span>' + (currentUser ? "Reborn player" : "Welcome to Reborn") + '</span></div>';
    updateAvatar();
  } catch {}
}

async function loadShop() {
  try {
    const response = await fetch("/api/shop"); const data = await response.json();
    shopItems = data.items || []; ownedItemIds = data.ownedItemIds || [];
    if (data.user) currentUser = data.user;
    $("shopBalance").textContent = currentUser ? Number(currentUser.rebuxBalance).toLocaleString() + " ReBux" : "Sign in to see your ReBux";
    $("avatarBalance").textContent = currentUser ? Number(currentUser.rebuxBalance).toLocaleString() + " ReBux" : "500 ReBux on signup";
    renderShop(); updateAvatar();
  } catch {
    $("shopGrid").innerHTML = '<div class="shop-loading">Catalog could not be loaded. Restart the server and refresh.</div>';
  }
}
function renderShop() {
  $("shopGrid").innerHTML = shopItems.map(item => {
    const owned = ownedItemIds.includes(item.id);
    const equipped = currentUser && currentUser.avatarItemId === item.id;
    let action;
    if (equipped) action = '<button class="item-action" disabled>Equipped</button>';
    else if (owned) action = '<button class="item-action" data-equip="' + escapeHtml(item.id) + '">Equip</button>';
    else if (currentUser) action = '<button class="item-action" data-buy="' + escapeHtml(item.id) + '">Buy</button>';
    else action = '<button class="item-action" data-open="register">Join</button>';
    const price = Number(item.price) === 0 ? "FREE" : Number(item.price).toLocaleString() + " ReBux";
    return '<article class="shop-item"><div class="item-art" style="background:' + escapeHtml(item.color) + '20">' + escapeHtml(item.icon) + '</div><div class="item-kind">' + escapeHtml(item.kind) + '</div><h3>' + escapeHtml(item.name) + '</h3><p>' + escapeHtml(item.description) + '</p><div class="item-footer"><span class="item-price">' + price + '</span>' + action + '</div></article>';
  }).join("");
}
async function buyItem(itemId) {
  if (!currentUser) return openModal("login");
  try {
    const response = await fetch("/api/shop/buy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Purchase failed.");
    toast(data.message); await loadMe(); await loadShop();
  } catch (error) { toast(error.message); }
}
async function equipItem(itemId) {
  try {
    const response = await fetch("/api/avatar/equip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not equip item.");
    await loadMe(); await loadShop(); toast("Avatar item equipped!");
  } catch (error) { toast(error.message); }
}
function updateAvatar() {
  const name = currentUser ? currentUser.username : "Guest Avatar";
  $("avatarName").textContent = name;
  const item = shopItems.find(entry => currentUser && entry.id === currentUser.avatarItemId);
  $("avatarPreview").querySelector(".avatar-head").textContent = item ? item.icon : "🙂";
  $("avatarPreview").querySelector(".avatar-body").style.background = item ? item.color : "#2589d8";
}
fetch("/api/stats").then(response => response.json()).then(data => {
  $("playerCount").textContent = Number(data.registeredUsers || 0).toLocaleString();
}).catch(() => { $("playerCount").textContent = "—"; });
loadMe().then(loadShop);
loadCommunityGames();