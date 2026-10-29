// Audit utilisateur d'Index (branche audit/parcours, jamais fusionnee).
// Supabase est SIMULE pour le parcours (donnees fictives). Seul controle reel, en lecture :
// les reglages publics d'inscription (/auth/v1/settings) et la lisibilite publique des tables.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.APP_URL ?? "http://127.0.0.1:8080/";
const OUT = (process.argv[2] ?? "audit") + "/audit";
const REF = process.env.SB_REF;
mkdirSync(OUT, { recursive: true });
const notes = [];
const note = (k, v) => notes.push(`${k} : ${typeof v === "string" ? v : JSON.stringify(v)}`);
const browser = await chromium.launch();
const now = new Date().toISOString();
const old = (m) => new Date(Date.now() - m * 30.44 * 864e5).toISOString();
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const USER = { id: uid(), email: "test@bureau.ch", aud: "authenticated", role: "authenticated", user_metadata: { first_name: "Test", last_name: "Audit" }, app_metadata: {}, created_at: now };
const CATS = ["Colles & Mastics", "Fixations & Chevilles", "Membranes & Étanchéité", "Profilés & Accessoires", "Isolants"];

function donnees({ gros = false } = {}) {
  const categories = CATS.map((name) => ({ id: uid(), name, icon: null }));
  const suppliers = ["Sika", "HFT", "Isover", "Ejot", "Würth"].map((name) => ({ id: uid(), name }));
  const projects = [{ id: uid(), numero: "24-118", nom: "Résidence Les Tilleuls" }, { id: uid(), numero: "25-007", nom: "Collège Nord" }];
  const products = [];
  const nb = gros ? 400 : 9;
  for (let i = 0; i < nb; i++) products.push({
    id: uid(), name: ["Sikaflex-11 FC+", "Cheville HFT 8x140", "ISORESIST 1000 031 F", "Ejot SDK2", "Membrane EPDM 1,2 mm", "Profilé de départ alu", "Mastic MS 40", "Spirale Drall-Fix", "Bande butyle"][i % 9] + (gros ? ` #${i}` : ""),
    supplier: suppliers[i % 5].name, category: CATS[i % 5], tags: ["extérieur", i % 2 ? "polyuréthane" : "inox"],
    pdf_path: i % 3 ? `fiches/p${i}.pdf` : null, pdf_filename: i % 3 ? `p${i}.pdf` : null, url: i % 2 ? "https://example.com/produit" : null,
    note: i === 2 ? "Ne pas poser sous 5 °C." : null, updated_at: [now, old(14), old(30)][i % 3], created_at: now, created_by: USER.id,
  });
  const product_projects = [{ product_id: products[0].id, project_id: projects[0].id }];
  return { categories, suppliers, projects, products, product_projects };
}

async function ctx({ gros = false, connecte = false, horsLigne = false, mobile = false } = {}) {
  const c = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, acceptDownloads: true });
  const db = donnees({ gros });
  const ecritures = [];
  if (connecte) {
    const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER.id, exp, role: "authenticated", aud: "authenticated", email: USER.email })}.sig`;
    const session = { access_token: jwt, refresh_token: "r", token_type: "bearer", expires_in: 86400, expires_at: exp, user: USER };
    await c.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify(session)]);
  }
  await c.route(/supabase\.co/, async (route) => {
    if (horsLigne) return route.abort();
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith("/auth/v1/user")) return route.fulfill({ json: USER });
    if (url.pathname.startsWith("/auth/v1/")) return route.fulfill({ json: {} });
    if (url.pathname.startsWith("/storage/v1/object/public/")) return route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4\n%%EOF" });
    if (url.pathname.startsWith("/storage/v1/")) { ecritures.push("storage " + req.method()); return route.fulfill({ json: { Key: "x", path: "fiches/x.pdf" } }); }
    const m = url.pathname.match(/\/rest\/v1\/(rpc\/)?([a-z_]+)/);
    if (!m) return route.fulfill({ json: {} });
    if (m[1]) return route.fulfill({ json: m[2] === "get_public_profiles" ? [{ id: USER.id, display_name: "Test Audit", first_name: "Test", last_name: "Audit" }] : [] });
    if (req.method() === "GET") {
      let rows = db[m[2]] ?? [];
      if (m[2] === "product_projects") rows = rows.map((r) => ({ product_id: r.product_id, projects: db.projects.find((p) => p.id === r.project_id) }));
      const single = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
      return route.fulfill({ json: single ? rows[0] ?? null : rows });
    }
    ecritures.push(`${req.method()} ${m[2]}`);
    const body = req.postDataJSON?.() ?? null;
    if (req.method() === "POST" && body && !Array.isArray(body)) { const row = { id: uid(), ...body, updated_at: now, created_at: now }; db[m[2]]?.push(row); return route.fulfill({ json: (req.headers()["accept"] ?? "").includes("vnd.pgrst.object") ? row : [row] }); }
    if (req.method() === "DELETE") { const id = url.searchParams.get("id")?.replace("eq.", ""); if (id && db[m[2]]) db[m[2]] = db[m[2]].filter((r) => r.id !== id); }
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await c.newPage();
  page.on("pageerror", (e) => note("ERREUR JS", e.message.slice(0, 200)));
  page.on("console", (msg) => { if (msg.type() === "error" && !/favicon|fonts/i.test(msg.text())) note("console", msg.text().slice(0, 160)); });
  page.on("dialog", (d) => { note("dialogue natif", `${d.type()} « ${d.message().replace(/\n/g, " ")} »`); d.accept(); });
  return { c, page, ecritures };
}
const shot = (page, f, full = true) => page.screenshot({ path: `${OUT}/${f}.png`, fullPage: full });
const step = async (nom, fn) => { try { await fn(); } catch (e) { note(`ECHEC ${nom}`, e.message.split("\n")[0].slice(0, 200)); } };
const aller = async (page, chemin = "") => { await page.goto(BASE + chemin, { waitUntil: "networkidle" }); await page.waitForTimeout(700); };
const axe = async (page, nom) => { const r = await new AxeBuilder({ page }).analyze(); note(`axe ${nom}`, r.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`)); };

// Controle reel, en lecture seule
await step("reglages Supabase reels", async () => {
  const key = process.env.SB_KEY;
  const s = await fetch(`https://${REF}.supabase.co/auth/v1/settings`, { headers: { apikey: key } }).then((r) => r.json());
  note("REEL inscription ouverte a tous", !s.disable_signup);
  note("REEL confirmation email automatique", s.mailer_autoconfirm);
  for (const t of ["projects", "products", "profiles"]) {
    const r = await fetch(`https://${REF}.supabase.co/rest/v1/${t}?select=id&limit=1`, { headers: { apikey: key, Prefer: "count=exact" } });
    note(`REEL table ${t} lisible sans compte`, `${r.status} ${r.headers.get("content-range") ?? ""}`);
  }
});

await step("visiteur", async () => {
  const { c, page } = await ctx();
  const t0 = Date.now(); await aller(page); note("Chargement (ms)", Date.now() - t0);
  note("Titre onglet", await page.title());
  await shot(page, "I01-bibliotheque");
  await shot(page, "I01b-ecran", false);
  await axe(page, "bibliotheque");
  await page.getByPlaceholder(/Rechercher un produit/).fill("sika"); await page.waitForTimeout(300);
  note("Recherche « sika »", (await page.locator("article").count()) + " carte(s)");
  await page.getByPlaceholder(/Rechercher un produit/).fill("24-118"); await page.waitForTimeout(300);
  note("Recherche numero de chantier « 24-118 »", (await page.locator("article").count()) + " carte(s)");
  await page.getByPlaceholder(/Rechercher un produit/).fill("étanchéité"); await page.waitForTimeout(300);
  note("Recherche « étanchéité » (categorie)", (await page.locator("article").count()) + " carte(s)");
  await page.getByPlaceholder(/Rechercher un produit/).fill("etancheite"); await page.waitForTimeout(300);
  note("Recherche sans accents « etancheite »", (await page.locator("article").count()) + " carte(s)");
  await page.getByPlaceholder(/Rechercher un produit/).fill("ejot sdk"); await page.waitForTimeout(300);
  note("Recherche 2 mots « ejot sdk »", (await page.locator("article").count()) + " carte(s)");
  await page.getByPlaceholder(/Rechercher un produit/).fill("");
  await page.getByRole("button", { name: "Ouvrir la fiche" }).first().click(); await page.waitForTimeout(600);
  await shot(page, "I02-lecteur-pdf", false);
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.locator("article").nth(0).getByText("Comparer").click(); await page.locator("article").nth(1).getByText("Comparer").click(); await page.waitForTimeout(300);
  await shot(page, "I03-comparer-barre", false);
  const cmp = page.getByRole("button", { name: /Comparer \(|Comparer les/ });
  if (await cmp.count()) { await cmp.first().click(); await page.waitForTimeout(500); await shot(page, "I04-comparaison", false); await page.keyboard.press("Escape"); }
  note("Texte barre comparaison", (await page.locator("body").innerText()).match(/\d+ (produit|fiche)s? sélectionn[^\n]*/)?.[0] ?? "?");
  let k = 0; await aller(page);
  for (; k < 60; k++) { await page.keyboard.press("Tab"); if (/Ouvrir la fiche/.test(await page.evaluate(() => document.activeElement?.textContent ?? ""))) break; }
  note("Tabulations jusqu'a la 1re fiche", k + 1);
  await c.close();
});

await step("connexion", async () => {
  const { c, page } = await ctx();
  await aller(page, "auth");
  await shot(page, "I05-connexion", false);
  await axe(page, "connexion");
  await c.close();
});

await step("administration", async () => {
  const { c, page, ecritures } = await ctx({ connecte: true });
  await aller(page, "admin");
  note("URL admin", page.url());
  await shot(page, "I06-admin");
  await axe(page, "admin");
  // Ajout sans rien : messages ?
  const ajout = page.getByRole("button", { name: /Ajouter le produit|Ajouter|Enregistrer/ }).first();
  await ajout.click(); await page.waitForTimeout(400);
  note("Ajout formulaire vide", (await page.locator("[data-sonner-toast]").allInnerTexts()).join(" | ") || "aucun message");
  await page.getByLabel("Nom du produit *").fill("Produit audit");
  await ajout.click(); await page.waitForTimeout(400);
  note("Ajout avec seulement le nom", (await page.locator("[data-sonner-toast]").allInnerTexts()).join(" | ") || "aucun message");
  // Suppression
  const del = page.getByRole("button", { name: /Supprimer/ }).first();
  if (await del.count()) { await del.click(); await page.waitForTimeout(600); }
  note("Ecritures", ecritures.join(", "));
  await aller(page, "config");
  await shot(page, "I07-config");
  await axe(page, "config");
  await c.close();
});

await step("gros volume", async () => {
  const { c, page } = await ctx({ gros: true });
  const t0 = Date.now(); await aller(page); note("Chargement 400 fiches (ms)", Date.now() - t0);
  const champ = page.getByPlaceholder(/Rechercher un produit/);
  const lat = [];
  for (const ch of ["s", "i", "k"]) { await champ.focus(); const t = await page.evaluate(() => performance.now()); await page.keyboard.type(ch); lat.push(await page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => r(performance.now() - t))), t)); }
  note("400 fiches : latence par frappe (ms)", lat.map(Math.round));
  note("Hauteur page 400 fiches (px)", await page.evaluate(() => document.body.scrollHeight));
  await c.close();
});

await step("hors ligne", async () => {
  const { c, page } = await ctx({ horsLigne: true });
  await aller(page); await page.waitForTimeout(6000);
  note("Hors ligne", (await page.locator("main").innerText()).slice(0, 200).replace(/\s+/g, " "));
  await shot(page, "I08-hors-ligne", false);
  await c.close();
});

await step("sombre", async () => {
  const { c, page } = await ctx();
  await aller(page);
  const t = page.getByRole("button", { name: /thème|theme|sombre|clair/i }).first();
  if (await t.count()) { await t.click(); await page.waitForTimeout(300); }
  await shot(page, "I09-sombre", false);
  await c.close();
});

await browser.close();
writeFileSync(`${OUT}/notes.txt`, notes.join("\n"));
console.log(notes.join("\n"));
