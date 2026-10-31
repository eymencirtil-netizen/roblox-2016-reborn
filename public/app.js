const modal = document.getElementById("modal");
const form = document.getElementById("authForm");
const errorBox = document.getElementById("formError");
let mode = "register";
const $ = id => document.getElementById(id);

function openModal(nextMode) {
  mode = nextMode;
  modal.hidden = false;
  errorBox.textContent = "";
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
function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}
document.addEventListener("click", e => {
  const opener = e.target.closest("[data-open]");
  if (opener) { openModal(opener.dataset.open); return; }
  if (e.target.id === "closeModal" || e.target === modal) closeModal();
  const game = e.target.closest("[data-game]");
  if (game) toast("Oyun sunucusu henüz bağlı değil. Bu özellik sonraki sürümde açılacak.");
});
form.addEventListener("submit", async e => {
  e.preventDefault(); errorBox.textContent = "";
  const data = Object.fromEntries(new FormData(form).entries());
  const endpoint = mode === "register" ? "/api/register" : "/api/login";
  $("submitAuth").disabled = true; $("submitAuth").textContent = "Please wait…";
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Bir hata oluştu.");
    closeModal(); await loadMe(); toast(mode === "register" ? "Hesabın oluşturuldu!" : "Tekrar hoş geldin!");
  } catch (err) { errorBox.textContent = err.message; }
  finally { $("submitAuth").disabled = false; $("submitAuth").textContent = mode === "register" ? "Create account" : "Log in"; }
});
async function loadMe() {
  try {
    const r = await fetch("/api/me"); const d = await r.json(); const area = $("accountArea");
    if (d.user) {
      area.innerHTML = `<div class="user-chip"><span class="avatar-mini">${escapeHtml(d.user.username[0].toUpperCase())}</span><a href="/?user=${encodeURIComponent(d.user.username)}" style="color:white;text-decoration:none">${escapeHtml(d.user.username)}</a><button class="btn light" id="logoutBtn">Logout</button></div>`;
      $("logoutBtn").onclick = async () => { await fetch("/api/logout", { method: "POST" }); await loadMe(); toast("Çıkış yapıldı."); };
    } else area.innerHTML = '<button class="btn light" data-open="login">Login</button><button class="btn white" data-open="register">Sign Up</button>';
  } catch {}
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
fetch("/api/health").then(r => r.json()).then(() => { $("playerCount").textContent = "LIVE"; }).catch(() => { $("playerCount").textContent = "READY"; });
loadMe();