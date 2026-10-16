// Builds the static site into dist/.
// With ENTERPRISE_TOKEN set, the org list is fetched live from the 3c-build
// enterprise and written back to orgs.json; without it, orgs.json is used as is.
import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";

const ENTERPRISE = process.env.ENTERPRISE_SLUG || "3c-build";
const TOKEN = process.env.ENTERPRISE_TOKEN;

const QUERY = `query($slug: String!, $after: String) {
  enterprise(slug: $slug) {
    organizations(first: 100, after: $after, orderBy: {field: LOGIN, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes { login name description url websiteUrl avatarUrl }
    }
  }
}`;

async function fetchOrgs() {
  const orgs = [];
  let after = null;
  do {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { slug: ENTERPRISE, after } }),
    });
    const body = await res.json();
    if (!res.ok || body.errors || !body.data?.enterprise) {
      throw new Error(`GitHub API error: ${JSON.stringify(body.errors ?? body)}`);
    }
    const page = body.data.enterprise.organizations;
    orgs.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return orgs;
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const site = (u) => (!u ? null : /^https?:\/\//i.test(u) ? u : `https://${u}`);
const host = (u) => u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");

function card(o) {
  const web = site(o.websiteUrl);
  return `      <li class="card">
        <a class="main" href="${esc(o.url)}">
          <img class="avatar" src="${esc(o.avatarUrl)}" alt="" width="56" height="56" loading="lazy">
          <span class="text">
            <span class="name">${esc(o.name || o.login)}</span>
            <span class="login">@${esc(o.login)}</span>
          </span>
        </a>
        ${o.description ? `<p class="desc">${esc(o.description)}</p>` : ""}
        <p class="links"><a href="${esc(o.url)}">GitHub</a>${web ? ` · <a href="${esc(web)}">${esc(host(web))}</a>` : ""}</p>
      </li>`;
}

function page(orgs, updated) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>3C BUILD · Organizations</title>
<meta name="description" content="Organizations in the 3C Build enterprise.">
<link rel="icon" href="assets/3C_Build.png">
<style>
  :root { --bg:#f6f7f8; --card:#fff; --fg:#111; --muted:#5f6670; --line:#dfe2e6; --link:#0b63ce; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0b0c0e; --card:#15171a; --fg:#eef0f2; --muted:#9aa1aa; --line:#272a2f; --link:#7ab4ff; }
  }
  @font-face { font-family: "Good Times"; src: url("assets/good-times-rg.ttf") format("truetype"); font-display: swap; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; }
  main { max-width: 960px; margin: 0 auto; padding: 48px 16px 64px; }
  header { text-align:center; margin-bottom: 40px; }
  header img { width: 160px; height: 160px; border-radius: 12px; }
  h1 { margin: 20px 0 4px; font: 400 30px/1.2 "Good Times", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: .04em; }
  header p { margin:0; color:var(--muted); }
  ul { list-style:none; margin:0; padding:0; display:grid; gap:16px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:10px; }
  .main { display:flex; align-items:center; gap:14px; color:inherit; text-decoration:none; }
  .avatar { border-radius:10px; background:var(--line); flex:none; }
  .text { display:flex; flex-direction:column; min-width:0; }
  .name { font-weight:600; font-size:17px; overflow-wrap:anywhere; }
  .main:hover .name { text-decoration: underline; }
  .login { color:var(--muted); font-size:14px; overflow-wrap:anywhere; }
  .desc { margin:0; color:var(--fg); }
  .links { margin:auto 0 0; font-size:14px; color:var(--muted); }
  a { color:var(--link); }
  footer { margin-top:40px; text-align:center; color:var(--muted); font-size:13px; }
</style>
</head>
<body>
<main>
  <header>
    <img src="assets/3C_Build.png" alt="3C Build">
    <h1>3C BUILD</h1>
    <p>${orgs.length} organization${orgs.length === 1 ? "" : "s"}</p>
  </header>
  <ul>
${orgs.map(card).join("\n")}
  </ul>
  <footer>Updated ${esc(updated)}</footer>
</main>
</body>
</html>
`;
}

let orgs;
if (TOKEN) {
  orgs = await fetchOrgs();
  await writeFile("orgs.json", JSON.stringify(orgs, null, 2) + "\n");
  console.log(`Fetched ${orgs.length} organizations from enterprise ${ENTERPRISE}`);
} else {
  orgs = JSON.parse(await readFile("orgs.json", "utf8"));
  console.log(`ENTERPRISE_TOKEN not set; using ${orgs.length} organizations from orgs.json`);
}
// Orgs listed here come first, in this order; any others follow alphabetically.
const PINNED = ["3cubed-Ventures", "Mockingbyrd-io", "EU27-data-sovereignty"].map((l) => l.toLowerCase());
const rank = (o) => {
  const i = PINNED.indexOf(o.login.toLowerCase());
  return i === -1 ? PINNED.length : i;
};
orgs.sort(
  (a, b) =>
    rank(a) - rank(b) ||
    (a.name || a.login).localeCompare(b.name || b.login, "en", { sensitivity: "base" }),
);

await rm("dist", { recursive: true, force: true });
await mkdir("dist");
await cp("assets", "dist/assets", { recursive: true });
await writeFile("dist/index.html", page(orgs, new Date().toISOString().slice(0, 10)));
await writeFile("dist/.nojekyll", "");
