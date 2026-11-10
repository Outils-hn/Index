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
  // Fournisseurs d'Access (meme base) : « Würth » doit retrouver « Würth », pas Ejot
  const access_fournisseurs = [{ id: "acc-sika", nom: "Sika" }, { id: "acc-wurth", nom: "WÜRTH" }, { id: "acc-isover", nom: "Isover" }];
  return { categories, suppliers, projects, products, access_fournisseurs, product_projects: [{ product_id: products[0].id, project_id: projects[0].id }] };
}

async function ctx({ gros = false, connecte = false, dark = false, valide = true, admin = true, largeur = 1440 } = {}) {
  const c = await browser.newContext({ viewport: { width: largeur, height: largeur < 600 ? 800 : 900 }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  if (dark) await c.addInitScript(() => localStorage.setItem("theme", "dark"));
  const db = donnees({ gros });
  const etat = { horsLigne: false, natifs: 0, ecritures: [], concepteur: true };
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
      if (m[2] === "is_concepteur") return route.fulfill({ json: valide && admin && etat.concepteur });
      if (m[2] === "set_account_admin") { etat.ecritures.push("rpc set_account_admin"); return route.fulfill({ status: 204, body: "" }); }
      if (m[2] === "list_accounts") return route.fulfill({ json: [
        { id: USER.id, email: etat.concepteur ? USER.email : null, display_name: "Test Audit", approved: true, is_admin: true, role: etat.concepteur ? "concepteur" : "administrateur", created_at: now },
        { id: uid(), email: etat.concepteur ? "collegue@bureau.ch" : null, display_name: "Collègue Validé", approved: true, is_admin: false, role: "dessinateur", created_at: now },
        { id: uid(), email: etat.concepteur ? "nouveau@bureau.ch" : null, display_name: "Nouveau Collègue", approved: false, is_admin: false, role: "dessinateur", created_at: now },
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
let triInitial = "";
const aller = async (page, chemin = "") => { await page.goto(BASE + chemin, { waitUntil: "networkidle" }); await page.waitForTimeout(600); const t = page.getByLabel("Trier"); if (await t.count()) { triInitial = await t.inputValue(); await t.selectOption("defaut"); await page.waitForTimeout(200); } };
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
  verif("Selecteur : Accueil + 10 applis dans l'ordre", ["Accueil", "Rechercher", "Access", "Check", "Format", "Index", "Joint", "Linear", "Masse", "Membrane", "Strate", "Trame"].every((a, i) => applis[i]?.startsWith(a)), applis.map((t) => t.split(/\s/)[0]).join(", "));
  await shot(page, "02-selecteur", false);
  await page.keyboard.press("Escape");
  const pied = (await page.locator("footer").innerText()).replace(/\s+/g, " ").trim();
  verif("Pied de page", pied === "Index v2.35 · Conçu par Hugo N. · 2026 · Sauvegarde · Suggestion / bug", pied);
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
  await page.getByLabel("Trier").selectOption("famille"); await page.waitForTimeout(200);
  verif("Tri par défaut « Par famille » : une section colorée par famille, aucune carte perdue", triInitial === "famille" && (await page.locator("section[aria-label] > div:first-child > h2.famille").count()) > 1 && (await page.locator("section[aria-label] article").count()) === (await page.locator("article").count()), `initial ${triInitial} · h2.famille ${await page.locator("section[aria-label] > div:first-child > h2.famille").count()} · cartes ${await page.locator("article").count()}`);
  await page.getByLabel("Trier").selectOption("defaut"); await page.waitForTimeout(200);
  verif("Vue « Toutes » : chaque carte a le nom de sa famille en couleur", (await page.locator("article .famille[style*='--fam-l']").count()) === (await page.locator("article").count()) && (await page.locator("article").count()) > 0);
  await page.getByLabel("Trier").selectOption("fournisseur"); await page.waitForTimeout(300);
  const titres = await page.locator("section[aria-label] > div:first-child > h2").allInnerTexts();
  verif("Tri « Par fournisseur » : une section par fournisseur, dans l'ordre alphabétique", titres.length > 1 && JSON.stringify(titres.filter((t) => t !== "Sans fournisseur")) === JSON.stringify([...titres.filter((t) => t !== "Sans fournisseur")].sort((x, y) => x.localeCompare(y, "fr", { sensitivity: "base" }))), titres.join(" | "));
  verif("Tri « Par fournisseur » : toutes les cartes restent affichées", (await page.locator("section[aria-label] article").count()) === (await page.locator("article").count()));
  await axe(page, "bibliotheque-par-fournisseur");
  await page.getByLabel("Trier").selectOption("defaut"); await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Ouvrir la fiche" }).first().click(); await page.waitForTimeout(500);
  await shot(page, "03-apercu-pdf", false);
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.locator("article").nth(1).getByRole("button", { name: "Comparer" }).click();
  await page.locator("article").nth(2).getByRole("button", { name: "Comparer" }).click(); await page.waitForTimeout(300);
  await shot(page, "04-comparer", false);
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 1500 }).catch(() => null), page.locator("footer").getByRole("button", { name: "Sauvegarde" }).click()]);
  await page.waitForTimeout(300);
  verif("Sans compte : pas de sauvegarde JSON, message « compte requis »", !dl && await page.getByText("Fichier JSON : compte requis").first().isVisible());
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

await step("Telephone", async () => {
  const { c, page } = await ctx({ largeur: 390 });
  await aller(page);
  await shot(page, "07-telephone");
  const m = await page.evaluate(() => ({
    debord: document.documentElement.scrollWidth - window.innerWidth,
    large: [...document.querySelectorAll("body *")].filter((x) => x.getBoundingClientRect().right > window.innerWidth + 1 && x.offsetParent).slice(0, 4).map((x) => `${x.tagName}.${String(x.className).slice(0, 40)}`),
    petits: [...document.querySelectorAll("main button, main a, header button, header a")].filter((x) => x.offsetParent && x.getBoundingClientRect().height > 0 && (x.getBoundingClientRect().height < 36 || x.getBoundingClientRect().width < 36)).map((x) => (x.getAttribute("aria-label") || x.textContent || "").trim().slice(0, 25)),
  }));
  verif("Telephone : aucun debordement horizontal", m.debord <= 0, `${m.debord} px ${m.large.join(" ; ")}`);
  verif("Telephone : cibles tactiles assez grandes", m.petits.length === 0, m.petits.slice(0, 6).join(", "));
  const r = await new AxeBuilder({ page }).analyze();
  verif("Accessibilite telephone : aucun defaut", !r.violations.length, r.violations.map((v) => `${v.id} (${v.impact}) ${v.nodes.length} : ${v.nodes.slice(0, 2).map((x) => x.target.join(" ")).join(" ; ")}`).join(" | "));
  await page.evaluate(() => { document.activeElement?.blur(); document.body.setAttribute("tabindex", "-1"); document.body.focus(); });
  await page.keyboard.press("Tab");
  verif("Lien d'evitement « Aller a la recherche » au premier Tab", await page.evaluate(() => document.activeElement?.textContent === "Aller à la recherche"));
  await page.locator("article").first().getByRole("button", { name: /Plus d.actions/ }).click(); await page.getByRole("menuitem", { name: "Copier le lien" }).click(); await page.waitForTimeout(300);
  verif("Copie du lien d'une fiche", await page.getByText("Lien copié").isVisible());
  await page.locator("article").first().getByRole("button", { name: /vérifiée le/ }).click();
  verif("Explication de la mention de fraicheur", await page.getByText("vérifiée il y a moins de 12 mois").first().isVisible());
  await c.close();
});

await step("Telephone : fenetres avec noms longs", async () => {
  const { c, page, db } = await ctx({ largeur: 390, connecte: true });
  const LONG = "Mastic polyuréthane monocomposant haute performance pour joints de façade rideau et vitrages structurels collés";
  db.products.forEach((p, i) => { if (i < 3) { p.name = `${LONG} ${i}`; p.supplier = "Fabrique Suisse de Produits Chimiques pour la Construction SA"; p.pdf_filename = `${LONG.replace(/ /g, "_")}.pdf`; p.pdf_path = "fiches/x.pdf"; p.verified_at = old(30); } });
  await aller(page);
  const fenetre = async (nom, sel = "[role=dialog],[role=alertdialog]") => {
    await page.waitForTimeout(600);
    const r = await page.evaluate((sel) => {
      const d = document.querySelector(sel);
      if (!d) return null;
      const b = d.getBoundingClientRect();
      const hors = [...d.querySelectorAll("*")].filter((e) => { const x = e.getBoundingClientRect(); return x.width > 0 && (x.right > b.right + 1 || x.left < b.left - 1); }).slice(0, 4).map((e) => `${e.tagName}.${String(e.className).slice(0, 40)}`);
      return { sw: d.scrollWidth - d.clientWidth, hors, page: document.documentElement.scrollWidth - window.innerWidth, large: [...document.querySelectorAll("body *")].filter((x) => x.getBoundingClientRect().right > window.innerWidth + 1 && x.offsetParent && !d.contains(x)).slice(0, 4).map((x) => `${x.tagName}.${String(x.className).slice(0, 50)}`) };
    }, sel);
    verif(`Telephone : fenetre « ${nom} » sans debordement`, !!r && r.sw <= 0 && r.hors.length === 0 && r.page <= 0, r ? `${r.sw} px ; ${r.hors.join(", ")} ; page ${r.page} ${r.large.join(" ; ")}` : "fenetre introuvable");
    await shot(page, `16-${nom.replace(/\W+/g, "-")}`, false);
  };
  await page.getByRole("button", { name: "Ouvrir la fiche" }).first().click();
  await fenetre("Apercu PDF");
  await page.keyboard.press("Escape"); await page.waitForTimeout(500);
  await page.locator("article").nth(0).getByRole("button", { name: "Comparer" }).click();
  await page.locator("article").nth(1).getByRole("button", { name: "Comparer" }).click(); await page.waitForTimeout(400);
  await shot(page, "16-barre-comparer", false);
  const barre = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  verif("Telephone : barre de comparaison avec noms longs sans debordement de page", barre <= 0, `${barre} px`);
  const cmp = page.getByRole("button", { name: /^Comparer \(?\d|Voir la comparaison|Comparer les/ }).first();
  if (await cmp.count()) { await cmp.click(); await fenetre("Comparaison"); await page.keyboard.press("Escape"); await page.waitForTimeout(500); }
  await page.getByRole("button", { name: /Fiches à relire du mois/ }).click();
  await fenetre("Fiches a relire");
  await page.keyboard.press("Escape"); await page.waitForTimeout(500);
  await aller(page);
  await page.getByRole("button", { name: new RegExp("^Plus d.actions pour " + LONG.slice(0, 20)) }).first().click(); await page.getByRole("menuitem", { name: "Mettre à la corbeille" }).click();
  await fenetre("Supprimer fiche nom long");
  await c.close();
});

await step("Telephone : fenetre Ajouter une fiche", async () => {
  const { c, page } = await ctx({ largeur: 390, connecte: true });
  await aller(page);
  await page.getByRole("button", { name: "Ajouter une fiche" }).click(); await page.waitForTimeout(700);
  await shot(page, "17-ajout-telephone", false);
  const o = await page.evaluate(() => { const d = document.querySelector("[role=dialog]"); return { sw: d.scrollWidth - d.clientWidth, page: document.documentElement.scrollWidth - innerWidth }; });
  verif("Telephone : fenetre Ajouter une fiche sans debordement", o.sw <= 0 && o.page <= 0, `${o.sw} px ; page ${o.page}`);
  await c.close();
});

await step("Telephone : Mon compte accessible", async () => {
  const { c, page } = await ctx({ largeur: 390, connecte: true });
  await aller(page);
  const b = page.locator('header button[title^="Mon compte"]');
  verif("Telephone : l'adresse du bandeau est visible et ouvre Mon compte", await b.isVisible());
  await b.click(); await page.waitForTimeout(400);
  verif("Telephone : la fenetre Mon compte s'ouvre", await page.getByLabel("Nouvelle adresse email").isVisible());
  await c.close();
});

await step("Tri, rappel et lecteur PDF (2.7)", async () => {
  const { c, page } = await ctx({ connecte: true });
  await aller(page);
  const titres = async () => (await page.locator("article h2").allInnerTexts()).map((t) => t.trim());
  // Rappel mensuel
  const rappel = page.getByRole("status").filter({ hasText: "à relire ce mois-ci" });
  verif("Rappel : bandeau « à relire ce mois-ci » affiché", await rappel.isVisible(), await rappel.innerText().catch(() => "absent"));
  await shot(page, "18-rappel", false);
  await rappel.getByRole("button", { name: "Relire maintenant" }).click(); await page.waitForTimeout(400);
  verif("Rappel : « Relire maintenant » ouvre les fiches à relire", await page.getByRole("dialog").getByText("Fiches à relire du mois").isVisible());
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  await rappel.getByRole("button", { name: "Plus tard" }).click(); await page.waitForTimeout(200);
  verif("Rappel : « Plus tard » le masque", (await rappel.count()) === 0);
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(500);
  verif("Rappel : reste masqué après rechargement (jusqu'au mois suivant)", (await page.getByText("à relire ce mois-ci").count()) === 0);
  // Tri
  const tri = page.getByLabel("Trier");
  await tri.selectOption("nom"); await page.waitForTimeout(300);
  const noms = await titres();
  const attendu = [...noms].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base", numeric: true }));
  verif("Tri « Nom » : ordre alphabétique", JSON.stringify(noms) === JSON.stringify(attendu), noms.slice(0, 3).join(" | "));
  await tri.selectOption("anciens"); await page.waitForTimeout(300);
  const vieux = ["ISORESIST 1000 031 F", "Profilé de départ alu", "Bande butyle"];
  verif("Tri « Vérifiées il y a le plus longtemps » : une fiche de 30 mois en tête", vieux.includes((await titres())[0]), (await titres()).slice(0, 2).join(" | "));
  await tri.selectOption("recents"); await page.waitForTimeout(300);
  const recents = ["Sikaflex-11 FC+", "Ejot SDK2", "Mastic MS 40"];
  verif("Tri « Vérifiées le plus récemment » : une fiche du jour en tête", recents.includes((await titres())[0]), (await titres()).slice(0, 2).join(" | "));
  await tri.selectOption("defaut");
  // Lecteur PDF : precedent / suivant
  await page.getByRole("button", { name: "Ouvrir la fiche" }).first().click(); await page.waitForTimeout(700);
  const d = page.getByRole("dialog");
  const pos = async () => ((await d.innerText()).match(/(\d+) \/ (\d+)/) ?? [])[0] ?? "";
  const p1 = await pos();
  verif("Lecteur : position « 1 / n » affichée", /^1 \/ \d+$/.test(p1), p1);
  await d.getByRole("button", { name: "Fiche suivante" }).click(); await page.waitForTimeout(500);
  verif("Lecteur : « suivante » passe à la fiche 2", /^2 \//.test(await pos()), await pos());
  await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(500);
  verif("Lecteur : flèche gauche revient à la fiche 1", /^1 \//.test(await pos()), await pos());
  verif("Lecteur : lien « nouvel onglet » présent", (await d.getByRole("link", { name: /Nouvel onglet|Ouvrir/ }).count()) > 0);
  await shot(page, "19-lecteur", false);
  await c.close();
  // Telephone : lecteur sans debordement
  const cm = await ctx({ connecte: true, largeur: 390 });
  await aller(cm.page);
  await cm.page.getByRole("button", { name: "Ouvrir la fiche" }).first().click(); await cm.page.waitForTimeout(700);
  const mm = await cm.page.evaluate(() => { const d = document.querySelector("[role=dialog]"); const b = d.getBoundingClientRect(); return { sw: d.scrollWidth - d.clientWidth, hors: [...d.querySelectorAll("*")].filter((e) => { const x = e.getBoundingClientRect(); return x.width > 0 && (x.right > b.right + 1 || x.left < b.left - 1); }).slice(0, 3).map((e) => `${e.tagName}.${String(e.className).slice(0, 30)}`), page: document.documentElement.scrollWidth - innerWidth }; });
  verif("Telephone : lecteur PDF sans débordement", mm.sw <= 0 && mm.hors.length === 0 && mm.page <= 0, `${mm.sw} px ; ${mm.hors.join(", ")}`);
  await shot(cm.page, "20-lecteur-telephone", false);
  await cm.c.close();
});

await step("Lien fournisseur vers Access (2.8)", async () => {
  const { c, page } = await ctx();
  await aller(page);
  const carteSika = page.locator("article", { hasText: "Sikaflex-11 FC+" });
  const lienSika = carteSika.getByRole("link", { name: /Sika/ });
  verif("Fournisseur « Sika » : lien vers Access", (await lienSika.count()) === 1 && /\/Access\/\?fournisseur=acc-sika$/.test((await lienSika.getAttribute("href")) ?? ""), (await lienSika.getAttribute("href").catch(() => "")) ?? "");
  verif("Lien Access : s'ouvre dans un nouvel onglet", (await lienSika.getAttribute("target")) === "_blank");
  const carteWurth = page.locator("article", { hasText: "Membrane EPDM" });
  verif("« Würth » retrouve « WÜRTH » (accents et majuscules)", (await carteWurth.getByRole("link", { name: /Würth/ }).count()) === 1);
  const carteEjot = page.locator("article", { hasText: "Ejot SDK2" });
  verif("Fournisseur absent d'Access (Ejot) : simple texte, pas de lien", (await carteEjot.getByRole("link", { name: /Ejot/ }).count()) === 0 && (await carteEjot.getByText("Ejot", { exact: true }).count()) === 1);
  await shot(page, "21-lien-access", false);
  await c.close();
  // Hors connexion : la copie locale des fournisseurs Access garde le lien
  const h = await ctx();
  await aller(h.page);
  h.etat.horsLigne = true;
  await h.page.reload({ waitUntil: "load" });
  await h.page.getByText(/copie locale du/).waitFor({ timeout: 20000 }).catch(() => {});
  await h.page.waitForTimeout(1500);
  verif("Hors ligne : le lien Access reste grâce à la copie locale", (await h.page.locator("article", { hasText: "Sikaflex-11 FC+" }).getByRole("link", { name: /Sika/ }).count()) === 1, `articles ${await h.page.locator("article").count()} ; liens fournisseur ${await h.page.locator("article a[href*=fournisseur]").count()} ; ${(await h.page.locator("article").first().innerText().catch(() => "?")).replace(/\s+/g, " ").slice(0, 120)}`);
  await h.c.close();
});

await step("Crayon : modifier une fiche depuis la bibliotheque (2.9)", async () => {
  // Visiteur : aucun crayon
  const v = await ctx();
  await aller(v.page);
  verif("Visiteur : pas de crayon de modification", (await v.page.getByRole("button", { name: /^Modifier / }).count()) === 0);
  await v.c.close();
  // Compte valide : crayon sur chaque carte, on reste sur la bibliotheque
  const { c, page, etat } = await ctx({ connecte: true });
  await aller(page);
  await page.getByLabel("Rechercher une fiche").fill("sikaflex"); await page.waitForTimeout(400);
  const crayon = page.getByRole("button", { name: "Modifier Sikaflex-11 FC+" });
  verif("Compte valide : crayon sur la carte", (await crayon.count()) === 1);
  await crayon.click(); await page.waitForTimeout(700);
  const d = page.getByRole("dialog");
  verif("Le crayon ouvre « Modifier la fiche » par-dessus la bibliotheque", (await d.getByText("Modifier la fiche").isVisible()) && /\/$|\/\?/.test(page.url().replace(/#.*/, "")) && !page.url().includes("admin"), page.url());
  verif("La fenetre est pre-remplie avec la fiche", (await d.locator("#edit-name").inputValue()) === "Sikaflex-11 FC+");
  await shot(page, "22-crayon-fenetre", false);
  await d.locator("#edit-name").fill("Sikaflex-11 FC+ (corrigé)");
  await d.getByRole("button", { name: "Enregistrer les modifications" }).click(); await page.waitForTimeout(1200);
  verif("Enregistrement envoye a la base", etat.ecritures.includes("PATCH products"), etat.ecritures.join(", "));
  verif("Fenetre refermee, recherche conservee", (await page.getByRole("dialog").count()) === 0 && (await page.getByLabel("Rechercher une fiche").inputValue()) === "sikaflex");
  verif("La carte affiche le nouveau nom", (await page.locator("article h2", { hasText: "(corrigé)" }).count()) === 1);
  await c.close();
  // Telephone : crayon assez grand, fenetre sans debordement avec un nom tres long
  const m = await ctx({ connecte: true, largeur: 390 });
  m.db.products[0].name = "Mastic polyuréthane monocomposant haute performance pour joints de façade rideau et vitrages structurels collés";
  await aller(m.page);
  const cr = m.page.getByRole("button", { name: /^Modifier Mastic polyuréthane/ });
  const bb = await cr.boundingBox();
  verif("Telephone : crayon d'au moins 36 px", !!bb && bb.width >= 36 && bb.height >= 36, bb ? `${Math.round(bb.width)}x${Math.round(bb.height)}` : "absent");
  await cr.click(); await m.page.waitForTimeout(800);
  const o = await m.page.evaluate(() => { const d = document.querySelector("[role=dialog]"); const b = d.getBoundingClientRect(); return { sw: d.scrollWidth - d.clientWidth, hors: [...d.querySelectorAll("*")].filter((e) => { const x = e.getBoundingClientRect(); return x.width > 0 && (x.right > b.right + 1 || x.left < b.left - 1) && !e.closest("[data-radix-select-viewport]"); }).slice(0, 3).map((e) => `${e.tagName}.${String(e.className).slice(0, 30)}`), page: document.documentElement.scrollWidth - innerWidth }; });
  verif("Telephone : fenetre de modification sans debordement", o.sw <= 0 && o.hors.length === 0 && o.page <= 0, `${o.sw} px ; ${o.hors.join(", ")} ; page ${o.page}`);
  await shot(m.page, "23-crayon-telephone", false);
  await m.c.close();
});

await step("Crayon dans le lecteur PDF (2.10)", async () => {
  const { c, page, etat } = await ctx({ connecte: true });
  await aller(page);
  await page.getByLabel("Rechercher une fiche").fill("cheville"); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Ouvrir la fiche" }).first().click(); await page.waitForTimeout(800);
  const lecteur = page.getByRole("dialog");
  const crayon = lecteur.getByRole("button", { name: /^Modifier la fiche / });
  verif("Lecteur : crayon present pour un compte valide", (await crayon.count()) === 1);
  await crayon.click(); await page.waitForTimeout(800);
  verif("Le crayon ouvre « Modifier la fiche » par-dessus le PDF", (await page.getByText("Modifier la fiche", { exact: true }).isVisible()) && (await page.getByRole("dialog").count()) === 2);
  await page.locator("#edit-name").fill("Sikaflex-11 FC+ v2");
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click(); await page.waitForTimeout(1200);
  verif("Enregistrement envoye, le PDF reste ouvert", etat.ecritures.includes("PATCH products") && (await page.getByRole("dialog").count()) === 1);
  verif("Le titre du lecteur est mis a jour", (await page.getByRole("dialog").getByRole("heading", { name: /v2/ }).count()) === 1);
  await c.close();
  const v = await ctx();
  await aller(v.page);
  await v.page.getByLabel("Rechercher une fiche").fill("cheville"); await v.page.waitForTimeout(400);
  await v.page.getByRole("button", { name: "Ouvrir la fiche" }).first().click(); await v.page.waitForTimeout(800);
  verif("Visiteur : pas de crayon dans le lecteur", (await v.page.getByRole("dialog").getByRole("button", { name: /^Modifier la fiche / }).count()) === 0);
  await v.c.close();
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

await step("Bibliotheque : ajout, corbeille", async () => {
  const { c, page, etat } = await ctx({ connecte: true });
  await aller(page);
  await shot(page, "07-bibliotheque-compte");
  await axe(page, "bibliotheque-compte");
  verif("Onglets : Bibliotheque et Listes, plus d'Administration", (await page.getByRole("link", { name: "Listes" }).count()) === 1 && (await page.getByRole("link", { name: "Administration" }).count()) === 0);
  await page.getByRole("button", { name: "Ajouter une fiche" }).click(); await page.waitForTimeout(600);
  verif("Ajouter une fiche : fenetre ouverte sur la bibliotheque", await page.getByRole("dialog").getByText("Enregistrer le produit").isVisible());
  await shot(page, "07b-ajout", false);
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Plus d'actions pour Sikaflex-11 FC+" }).click();
  { const [pop] = await Promise.all([page.waitForEvent("popup"), page.getByRole("menuitem", { name: "Noter dans Check" }).click()]);
    const u = decodeURIComponent(pop.url());
    verif("Noter dans Check : ouvre Check avec le produit, le fournisseur et le lien de la fiche", u.startsWith("https://outils-hn.github.io/Check/?noter=") && u.includes("Sikaflex-11 FC+") && u.includes("?fiche="));
    await pop.close().catch(() => {}); }
  await page.getByRole("button", { name: "Plus d'actions pour Sikaflex-11 FC+" }).click(); await page.getByRole("menuitem", { name: "Mettre à la corbeille" }).click(); await page.waitForTimeout(300);
  const fen = page.getByRole("alertdialog");
  verif("Supprimer : fenetre Épure", await fen.getByText(/corbeille/).first().isVisible());
  await shot(page, "08-supprimer", false);
  await fen.getByRole("button", { name: "Mettre à la corbeille" }).click(); await page.waitForTimeout(800);
  verif("Fiche mise a la corbeille (pas supprimee)", etat.ecritures.includes("PATCH products") && !etat.ecritures.includes("DELETE products") && !etat.ecritures.some((e) => e.startsWith("storage")), etat.ecritures.join(", "));
  await page.getByRole("button", { name: /^Corbeille/ }).click(); await page.waitForTimeout(500);
  verif("Corbeille affichee avec Restaurer", await page.getByRole("button", { name: "Restaurer" }).first().isVisible());
  await shot(page, "09-corbeille", false);
  await page.getByRole("button", { name: "Restaurer" }).first().click(); await page.waitForTimeout(800);
  verif("Restauration", !(await page.getByRole("button", { name: "Restaurer" }).count()));
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  verif("Aucune fenetre native (bibliotheque)", etat.natifs === 0, `${etat.natifs}`);
  await aller(page, "admin");
  verif("Ancienne adresse /admin : redirige vers la bibliotheque", !page.url().includes("admin"), page.url());
  await aller(page, "config");
  await shot(page, "10-config");
  await axe(page, "config");
  verif("Listes : nombre de fiches affiché sur chaque ligne", (await page.getByText(/^\d+ fiches?$/).count()) > 0);
  await page.getByRole("button", { name: /^Supprimer Sika/ }).first().click();
  verif("Listes : la confirmation de suppression indique le nombre de fiches", await page.getByRole("alertdialog").getByText(/fiches? (utilisent|utilise) cette valeur/).isVisible());
  await page.getByRole("button", { name: "Annuler" }).click();
  verif("Configuration : plus de section Comptes ni Historique, lien vers le Tableau de bord de l'Accueil",
    !(await page.getByRole("heading", { name: "Comptes" }).count()) && !(await page.getByRole("heading", { name: "Historique" }).count())
    && (await page.getByRole("link", { name: /Tableau de bord/ }).getAttribute("href")) === "https://outils-hn.github.io/#tableau");
  const [dlJ] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }).catch(() => null), page.locator("footer").getByRole("button", { name: "Sauvegarde" }).click()]);
  verif("Avec compte : sauvegarde JSON telechargee", !!dlJ && /index-sauvegarde-.*\.json$/.test(dlJ.suggestedFilename()), dlJ?.suggestedFilename() ?? "");
  await page.locator('header button[title^="Mon compte"]').click(); await page.waitForTimeout(300);
  await page.getByLabel("Nouvelle adresse email").fill("nouvelle@exemple.ch");
  await page.getByRole("button", { name: "Changer l'adresse" }).click(); await page.waitForTimeout(500);
  verif("Mon compte : changement d'email demandé, confirmation par lien", await page.getByText("Un email de confirmation a été envoyé").isVisible());
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
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
  await aller(page, "config");
  verif("Compte non validé : écran d'attente sur les Listes", await page.getByText("Compte en attente de validation").first().isVisible());
  await shot(page, "12-compte-en-attente", false);
  await aller(page);
  verif("Compte non validé : pas d'ajout ni de corbeille", !(await page.getByRole("button", { name: "Ajouter une fiche" }).count()) && !(await page.getByRole("button", { name: /^Mettre .* à la corbeille/ }).count()));
  verif("Compte non validé : pas de bouton « Vérifiée » sur les fiches", !(await page.getByRole("button", { name: "Vérifiée", exact: true }).count()));
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
