// Check-up automatique d'Index dans un vrai navigateur, avec Supabase SIMULE
// (aucune lecture ni ecriture dans la vraie base ; donnees fictives).
// Resultat : checkup.txt (OK / ECHEC) + captures d'ecran pour la revue visuelle.
import { chromium } from "playwright";
import { mesures, axe as axeLib, tabsJusqua, focusVisible, note, tenter, ecrire } from "./audit-lib.mjs";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.APP_URL ?? "http://127.0.0.1:8080/";
const OUT = process.argv[2] ?? "captures";
const REF = process.env.SB_REF ?? "test";
mkdirSync(OUT, { recursive: true });
const lignes = [];
const verif = (nom, ok, detail = "") => lignes.push(`${ok ? "OK    " : "ECHEC "} ${nom}${detail ? ` (${detail})` : ""}`);
const browser = await chromium.launch();
const now = new Date().toISOString();
const old = (m) => new Date(Date.now() - m * 30.44 * 864e5).toISOString();
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const USER = { id: uid(), email: "test@bureau.ch", aud: "authenticated", role: "authenticated", user_metadata: {}, app_metadata: {}, created_at: now };
const CATS = ["Colles & Mastics", "Fixations & Chevilles", "Membranes & Étanchéité", "Profilés & Accessoires", "Isolants"];

function donnees({ gros = false } = {}) {
  const categories = CATS.map((name) => ({ id: uid(), name, icon: null }));
  const suppliers = ["Sika", "HFT", "Isover", "Ejot", "Würth"].map((name) => ({ id: uid(), name }));
  const projects = [{ id: uid(), numero: "24-118", nom: "Résidence Les Tilleuls" }];
  const noms = ["Sikaflex-11 FC+", "Cheville HFT 8x140", "ISORESIST 1000 031 F", "Ejot SDK2", "Membrane EPDM 1,2 mm", "Profilé de départ alu", "Mastic MS 40", "Spirale Drall-Fix", "Bande butyle"];
  const cats = [0, 1, 4, 1, 2, 3, 0, 1, 2];
  const fourn = [0, 1, 2, 3, 4, 0, 0, 1, 0];
  const products = [];
  const nb = gros ? 400 : 9;
  for (let i = 0; i < nb; i++) products.push({
    id: uid(), name: noms[i % 9] + (gros ? ` #${i}` : ""), supplier: suppliers[fourn[i % 9]].name, category: CATS[cats[i % 9]], tags: ["extérieur"],
    pdf_path: i % 3 ? `fiches/p${i}.pdf` : null, pdf_filename: i % 3 ? `p${i}.pdf` : null, url: i % 2 ? "https://example.com/produit" : null,
    note: i === 2 ? "Ne pas poser sous 5 °C." : null, updated_at: now, verified_at: [now, old(14), old(30)][i % 3], deleted_at: null, created_at: now, created_by: USER.id,
  });
  return { categories, suppliers, projects, products, product_projects: [{ product_id: products[0].id, project_id: projects[0].id }] };
}

async function ctx({ gros = false, connecte = false, dark = false, valide = true, admin = true } = {}) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  if (dark) await c.addInitScript(() => localStorage.setItem("theme", "dark"));
  const db = donnees({ gros });
  const etat = { horsLigne: false, natifs: 0, ecritures: [] };
  if (connecte) {
    const exp = Math.floor(Date.now() / 1000) + 86400;
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER.id, exp, role: "authenticated", aud: "authenticated", email: USER.email })}.sig`;
    const session = { access_token: jwt, refresh_token: "r", token_type: "bearer", expires_in: 86400, expires_at: exp, user: USER };
    await c.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify(session)]);
  }
  await c.route(/supabase\.co/, async (route) => {
    if (etat.horsLigne) return route.abort();
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith("/auth/v1/user")) return route.fulfill({ json: USER });
    if (url.pathname.startsWith("/auth/v1/")) return route.fulfill({ json: {} });
    if (url.pathname.startsWith("/storage/v1/object/public/")) return route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4\n%%EOF" });
    if (url.pathname.startsWith("/storage/v1/")) { etat.ecritures.push("storage " + req.method()); return route.fulfill({ json: [{}] }); }
    const m = url.pathname.match(/\/rest\/v1\/(rpc\/)?([a-z_]+)/);
    if (!m) return route.fulfill({ json: {} });
    if (m[1]) {
      if (m[2] === "is_approved") return route.fulfill({ json: valide });
      if (m[2] === "is_admin") return route.fulfill({ json: valide && admin });
      if (m[2] === "set_account_admin") { etat.ecritures.push("rpc set_account_admin"); return route.fulfill({ status: 204, body: "" }); }
      if (m[2] === "list_accounts") return route.fulfill({ json: [
        { id: USER.id, email: USER.email, display_name: "Test Audit", approved: true, is_admin: true, created_at: now },
        { id: uid(), email: "collegue@bureau.ch", display_name: "Collègue Validé", approved: true, is_admin: false, created_at: now },
        { id: uid(), email: "nouveau@bureau.ch", display_name: "Nouveau Collègue", approved: false, is_admin: false, created_at: now },
      ] });
      if (m[2] === "set_account_approved") { etat.ecritures.push("rpc set_account_approved"); return route.fulfill({ status: 204, body: "" }); }
      return route.fulfill({ json: [] });
    }
    const t = m[2];
    if (req.method() === "GET") {
      let rows = db[t] ?? [];
      if (t === "product_projects") rows = rows.map((r) => ({ ...r, projects: db.projects.find((p) => p.id === r.project_id) }));
      return route.fulfill({ json: (req.headers()["accept"] ?? "").includes("vnd.pgrst.object") ? rows[0] ?? null : rows });
    }
    etat.ecritures.push(`${req.method()} ${t}`);
    const id = url.searchParams.get("id")?.replace("eq.", "");
    if (req.method() === "PATCH" && id) db[t] = (db[t] ?? []).map((r) => (r.id === id ? { ...r, ...req.postDataJSON() } : r));
    if (req.method() === "DELETE" && id) db[t] = (db[t] ?? []).filter((r) => r.id !== id);
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await c.newPage();
  page.on("pageerror", (e) => verif("Aucune erreur JavaScript", false, e.message.slice(0, 150)));
  page.on("dialog", (d) => { etat.natifs++; d.accept(); });
  return { c, page, etat, db };
}
const aller = async (page, chemin = "") => { await page.goto(BASE + chemin, { waitUntil: "networkidle" }); await page.waitForTimeout(600); };
const shot = (page, f, full = true) => page.screenshot({ path: `${OUT}/${f}.png`, fullPage: full });
const step = async (nom, fn) => { try { await fn(); } catch (e) { verif(nom, false, e.message.split("\n")[0].slice(0, 180)); } };
const cartes = (page) => page.locator("article").count();

// ---------- Audit UX ----------
const txt = async (p, sel = "body") => (await p.locator(sel).first().innerText().catch(() => "")).replace(/\s+/g, " ");
const ouvrirIndex = async (opts, chemin = "", dims) => { const x = await ctx(opts); if (dims) await x.page.setViewportSize(dims); const t0 = Date.now(); await aller(x.page, chemin); x.page._chargement = Date.now() - t0; return x; };

await step("visiteur", async () => { const { page } = await ouvrirIndex({}); await shot(page, "01-visiteur"); await mesures(page, "visiteur"); await axeLib(page, "visiteur"); note("visiteur:texte", (await txt(page)).slice(0, 600)); note("focus", await focusVisible(page)); note("tabs-jusqu-a-recherche", await tabsJusqua(page, () => /recherch/i.test(document.activeElement?.getAttribute("aria-label") || ""), 40)); });
await step("connecte", async () => {
  const { page, etat } = await ouvrirIndex({ connecte: true });
  await shot(page, "02-connecte"); await mesures(page, "connecte"); await axeLib(page, "connecte"); note("connecte:texte", (await txt(page)).slice(0, 700));
  note("boutons", (await page.getByRole("button").allInnerTexts()).map((s) => s.trim()).filter(Boolean).slice(0, 50).join(" | "));
  const r = page.getByLabel("Rechercher une fiche");
  for (const [nom, v] of [["accent", "silikon"], ["partiel", "chev"], ["rien", "zzzzzz"], ["balise", "<b>x</b>"], ["long", "a".repeat(400)], ["espaces", "   "], ["reference", "8x140"]]) { await r.fill(v); await page.waitForTimeout(400); note(`recherche:${nom}`, { fiches: await cartes(page), texte: (await txt(page, "main")).slice(-200) }); await shot(page, `03-recherche-${nom}`, false); }
  await r.fill("");
  await page.locator("article").first().click().catch(() => {}); await page.waitForTimeout(400); await shot(page, "04-fiche", false);
  note("fiche:texte", (await txt(page, "article")).slice(0, 500));
});
await step("volume", async () => { const { page } = await ouvrirIndex({ gros: true, connecte: true }); await shot(page, "05-volume-400", false); note("volume:400-fiches", { chargement_ms: page._chargement, cartes: await cartes(page) }); const t = Date.now(); await page.getByLabel("Rechercher une fiche").fill("cheville 17"); await page.waitForTimeout(300); note("volume:recherche-ms", Date.now() - t); await mesures(page, "volume"); });
await step("hors-ligne", async () => { const { page, etat } = await ouvrirIndex({ connecte: true }); etat.horsLigne = true; await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1200); await shot(page, "06-hors-ligne", false); note("hors-ligne:texte", (await txt(page)).slice(0, 400)); });
await step("auth", async () => { const { page } = await ouvrirIndex({}, "auth"); await shot(page, "07-auth", false); await mesures(page, "auth"); await axeLib(page, "auth"); await page.getByRole("button", { name: /Se connecter|Connexion/ }).last().click().catch(() => {}); await page.waitForTimeout(500); note("auth:vide", (await txt(page)).slice(0, 400)); await shot(page, "07b-auth-vide", false); });
await step("admin-config", async () => { for (const ch of ["admin", "config"]) { const { page } = await ouvrirIndex({ connecte: true }, ch); await shot(page, `08-${ch}`); note(`${ch}:texte`, (await txt(page)).slice(0, 500)); await axeLib(page, ch); } });
for (const [nom, w, h] of [["mobile", 390, 844], ["tablette", 768, 1024]]) await step(nom, async () => { const { page } = await ouvrirIndex({ connecte: true }, "", { width: w, height: h }); await shot(page, `09-${nom}`); await mesures(page, nom); });
await step("sombre", async () => { const { page } = await ouvrirIndex({ connecte: true, dark: true }); await shot(page, "10-sombre", false); await axeLib(page, "sombre"); });
ecrire(); writeFileSync(`${OUT}/checkup-lignes.txt`, lignes.join("\n")); await browser.close();
