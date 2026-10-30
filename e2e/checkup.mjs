// Check-up automatique d'Index dans un vrai navigateur, avec Supabase SIMULE
// (aucune lecture ni ecriture dans la vraie base ; donnees fictives).
// Resultat : checkup.txt (OK / ECHEC) + captures d'ecran pour la revue visuelle.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
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
const axe = async (page, nom) => {
  const r = await new AxeBuilder({ page }).analyze();
  const g = r.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  verif(`Accessibilite ${nom} : aucun defaut grave`, !g.length, g.map((v) => `${v.id} ${v.nodes.length} : ${v.nodes.slice(0, 3).map((x) => x.target.join(" ")).join(" ; ")}`).join(" | "));
};
const cartes = (page) => page.locator("article").count();

await step("Bibliotheque", async () => {
  const { c, page, etat } = await ctx();
  await aller(page);
  await shot(page, "01-bibliotheque");
  await shot(page, "01b-ecran", false);
  verif("Curseur dans la recherche a l'ouverture", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Rechercher une fiche"));
  await page.getByRole("button", { name: "Changer d'application" }).click(); await page.waitForTimeout(200);
  const applis = await page.getByRole("menuitem").allInnerTexts();
  verif("Selecteur : Accueil + 8 applis dans l'ordre", ["Accueil", "Access", "Check", "Format", "Index", "Linear", "Masse", "Strate", "Trame"].every((a, i) => applis[i]?.startsWith(a)), applis.map((t) => t.split(/\s/)[0]).join(", "));
  await shot(page, "02-selecteur", false);
  await page.keyboard.press("Escape");
  const pied = (await page.locator("footer").innerText()).replace(/\s+/g, " ").trim();
  verif("Pied de page", pied === "Index v2.0 · Conçu par Hugo N. · 2026 · Sauvegarde · Suggestion / bug", pied);
  verif("Plus de de « fiche au hasard » ni de tuiles", !(await page.getByLabel("Fiche au hasard").count()) && !(await page.getByText("Total fiches").count()));
  const rech = page.getByLabel("Rechercher une fiche");
  for (const [q, attendu] of [["etancheite", 2], ["hft 140", 1], ["chevilles", 3], ["24-118", 1], ["poser", 1]]) {
    await rech.fill(q); await page.waitForTimeout(250);
    const nb = await cartes(page);
    verif(`Recherche « ${q} » : ${attendu} fiche(s)`, nb === attendu, `${nb}`);
  }
  await rech.fill("");
  await page.getByRole("button", { name: /^À vérifier/ }).first().click(); await page.waitForTimeout(200);
  verif("Filtre « À vérifier » : 6 fiches", (await cartes(page)) === 6, `${await cartes(page)}`);
  await page.getByRole("button", { name: "Toutes" }).click();
  await axe(page, "bibliotheque");
  await page.getByRole("button", { name: "Ouvrir la fiche" }).first().click(); await page.waitForTimeout(500);
  await shot(page, "03-apercu-pdf", false);
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.locator("article").nth(1).getByRole("button", { name: "Comparer" }).click();
  await page.locator("article").nth(2).getByRole("button", { name: "Comparer" }).click(); await page.waitForTimeout(300);
  await shot(page, "04-comparer", false);
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.locator("footer").getByRole("button", { name: "Sauvegarde" }).click()]);
  verif("Sauvegarde JSON telechargee", /index-sauvegarde-.*\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  verif("Aucune fenetre native du navigateur", etat.natifs === 0, `${etat.natifs}`);
  // Hors ligne avec la copie locale creee ci-dessus
  etat.horsLigne = true;
  const t0 = Date.now();
  await page.reload({ waitUntil: "load" });
  const vu = await page.getByText(/copie locale du/).waitFor({ timeout: 20000 }).then(() => true, () => false);
  verif("Hors ligne : copie locale affichee", vu && (await cartes(page)) === 9, `${Date.now() - t0} ms`);
  await shot(page, "05-hors-ligne-copie", false);
  await c.close();
});

await step("Fiches a relire du mois", async () => {
  const { c, page, etat } = await ctx({ connecte: true });
  await aller(page);
  await page.getByRole("button", { name: /Fiches à relire du mois/ }).click(); await page.waitForTimeout(300);
  const d = page.getByRole("dialog");
  const n = await d.getByRole("button", { name: "Toujours valable" }).count();
  verif("Fiches à relire : 5 fiches proposées, les plus anciennes", n === 5 && /il y a 2 ans/.test(await d.innerText()), `${n}`);
  await shot(page, "15-fiches-a-relire", false);
  await d.getByRole("button", { name: "Toujours valable" }).first().click(); await page.waitForTimeout(600);
  verif("« Toujours valable » enregistre la vérification", etat.ecritures.includes("PATCH products"));
  await c.close();
});

await step("Lien vers une fiche", async () => {
  const { c, page, db } = await ctx();
  const f = db.products[1];
  await aller(page, `?fiche=${f.id}`);
  verif("Lien ?fiche= : seule la fiche demandée, PDF ouvert", (await page.locator("article").count()) === 1 && (await page.getByText("Fiche ouverte depuis une autre appli.").isVisible()) && (await page.getByRole("dialog").isVisible()));
  await shot(page, "14-lien-fiche", false);
  await aller(page, "?fiche=inconnue");
  verif("Lien vers une fiche disparue : message clair", await page.getByText(/n'existe plus dans Index/).isVisible());
  await page.getByRole("button", { name: "Voir toutes les fiches" }).click(); await page.waitForTimeout(400);
  verif("« Voir toutes les fiches » revient à la bibliothèque", (await page.locator("article").count()) === 9);
  await aller(page, "?q=chevilles");
  verif("Lien ?q= : recherche pré-remplie (3 fiches)", (await page.getByLabel("Rechercher une fiche").inputValue()) === "chevilles" && (await cartes(page)) === 3, `${await cartes(page)}`);
  await c.close();
});

await step("Hors ligne sans copie", async () => {
  const { c, page, etat } = await ctx();
  etat.horsLigne = true;
  await page.goto(BASE, { waitUntil: "load" });
  const vu = await page.getByText("Base de données injoignable").waitFor({ timeout: 20000 }).then(() => true, () => false);
  verif("Hors ligne sans copie : message et Réessayer", vu && (await page.getByRole("button", { name: "Réessayer" }).isVisible()));
  await c.close();
});

await step("Connexion", async () => {
  const { c, page } = await ctx();
  await aller(page, "auth");
  await shot(page, "06-connexion", false);
  await page.getByRole("tab", { name: "Créer un compte" }).click(); await page.waitForTimeout(200);
  verif("Inscription : prénom, nom, email, mot de passe", (await page.getByLabel("Prénom").isVisible()) && (await page.getByLabel("Nom", { exact: true }).isVisible()));
  await shot(page, "06b-inscription", false);
  await page.getByRole("tab", { name: "Connexion" }).click();
  await page.getByRole("button", { name: "Mot de passe oublié ?" }).click();
  await page.getByLabel("Email").fill("test@bureau.ch");
  await page.getByRole("button", { name: "Envoyer le lien" }).click(); await page.waitForTimeout(600);
  verif("Mot de passe oublié : lien envoyé", /lien vient d'être envoyé/.test((await page.locator("[data-sonner-toast]").allInnerTexts()).join(" ")));
  await aller(page, "nouveau-mot-de-passe"); await page.waitForTimeout(4500);
  verif("Page nouveau mot de passe sans lien : message clair", await page.getByText(/n'est plus valable/).isVisible());
  await shot(page, "06c-nouveau-mdp", false);
  await axe(page, "connexion");
  await c.close();
});

await step("Administration", async () => {
  const { c, page, etat } = await ctx({ connecte: true });
  await aller(page, "admin");
  await shot(page, "07-admin");
  await axe(page, "admin");
  await page.getByRole("button", { name: "Supprimer Sikaflex-11 FC+" }).click(); await page.waitForTimeout(300);
  const fen = page.getByRole("alertdialog");
  verif("Supprimer : fenetre Épure", await fen.getByText(/à la corbeille/).first().isVisible());
  await shot(page, "08-supprimer", false);
  await fen.getByRole("button", { name: "Mettre à la corbeille" }).click(); await page.waitForTimeout(800);
  verif("Fiche mise a la corbeille (pas supprimee)", etat.ecritures.includes("PATCH products") && !etat.ecritures.includes("DELETE products") && !etat.ecritures.some((e) => e.startsWith("storage")), etat.ecritures.join(", "));
  verif("Corbeille affichee avec Restaurer", await page.getByRole("button", { name: "Restaurer" }).isVisible());
  await shot(page, "09-corbeille");
  await page.getByRole("button", { name: "Restaurer" }).click(); await page.waitForTimeout(800);
  verif("Restauration", !(await page.getByRole("button", { name: "Restaurer" }).count()));
  verif("Aucune fenetre native (admin)", etat.natifs === 0, `${etat.natifs}`);
  await aller(page, "config");
  await shot(page, "10-config");
  await axe(page, "config");
  verif("Comptes : 1 en attente avec bouton Valider", (await page.getByText("1 en attente").isVisible()) && (await page.getByRole("button", { name: "Valider" }).isVisible()));
  await page.getByRole("button", { name: "Valider" }).click(); await page.waitForTimeout(500);
  verif("Validation d'un compte", etat.ecritures.includes("rpc set_account_approved"));
  await page.getByRole("button", { name: "Nommer admin" }).click(); await page.waitForTimeout(300);
  await page.getByRole("alertdialog").getByRole("button", { name: "Nommer administrateur" }).click(); await page.waitForTimeout(500);
  verif("Nommer un administrateur", etat.ecritures.includes("rpc set_account_admin"));
  await shot(page, "13-comptes", false);
  await c.close();
});

await step("Compte valide non administrateur", async () => {
  const { c, page } = await ctx({ connecte: true, admin: false });
  await aller(page, "config");
  verif("Non-admin : Configuration sans la section Comptes", (await page.getByText("Fournisseurs").first().isVisible()) && !(await page.getByRole("heading", { name: "Comptes" }).count()));
  await c.close();
});

await step("Compte en attente", async () => {
  const { c, page } = await ctx({ connecte: true, valide: false });
  await aller(page, "admin");
  verif("Compte non validé : écran d'attente, pas d'administration", (await page.getByText("Compte en attente de validation").first().isVisible()) && !(await page.getByRole("link", { name: "Administration" }).count()));
  await shot(page, "12-compte-en-attente", false);
  await aller(page);
  verif("Compte non validé : pas de bouton « Vérifiée » sur les fiches", !(await page.getByRole("button", { name: "Vérifiée" }).count()));
  await c.close();
});

await step("Gros volume", async () => {
  const { c, page } = await ctx({ gros: true });
  await aller(page);
  const champ = page.getByLabel("Rechercher une fiche");
  const lat = [];
  for (const ch of ["s", "i", "k"]) { await champ.focus(); const t = await page.evaluate(() => performance.now()); await page.keyboard.type(ch); lat.push(await page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => r(performance.now() - t))), t)); }
  verif("400 fiches : saisie fluide (< 300 ms par frappe)", Math.max(...lat) < 300, lat.map(Math.round).join(" / ") + " ms");
  await c.close();
});

await step("Mode sombre", async () => {
  const { c, page } = await ctx({ dark: true });
  await aller(page);
  verif("Mode sombre retenu", await page.evaluate(() => document.documentElement.classList.contains("dark")));
  await shot(page, "11-sombre", false);
  await c.close();
});

await browser.close();
writeFileSync(`${OUT}/checkup.txt`, lignes.join("\n") + "\n");
console.log(lignes.join("\n"));
