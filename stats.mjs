// Painel de estatísticas cyberpunk (SVG) gerado com a API do GitHub.
// Uso: GITHUB_TOKEN=... GITHUB_USER=jonethon5 node stats.mjs dist/estatisticas.svg
// Teste sem rede: FAKE=1 node stats.mjs teste.svg
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const USER = process.env.GITHUB_USER || process.env.GITHUB_REPOSITORY_OWNER || "jonethon5";
const OUT = process.argv[2] || "dist/estatisticas.svg";
const Y = "#F5E642", CY = "#19E3FF", MG = "#FF2E88", PU = "#8B5CF6", GR = "#3DFF8A", DIM = "#8A8AA0";
const F = "font-family=\"'Courier New',Courier,monospace\"";

async function fetchData() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN não definido");
  const query = `query($login:String!){user(login:$login){
    name
    contributionsCollection{totalCommitContributions totalPullRequestContributions
      contributionCalendar{totalContributions weeks{contributionDays{contributionCount date}}}}
    repositories(ownerAffiliations:OWNER,isFork:false,first:100){totalCount nodes{stargazerCount languages(first:6,orderBy:{field:SIZE,direction:DESC}){edges{size node{name}}}}}
  }}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "stats-card" },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  const u = json.data.user, cc = u.contributionsCollection;
  const days = cc.contributionCalendar.weeks.flatMap((w) => w.contributionDays).map((d) => ({ count: d.contributionCount, date: d.date }));
  const langs = {};
  let stars = 0;
  for (const r of u.repositories.nodes) {
    stars += r.stargazerCount;
    for (const e of r.languages.edges) langs[e.node.name] = (langs[e.node.name] || 0) + e.size;
  }
  return { commits: cc.totalCommitContributions, prs: cc.totalPullRequestContributions, total: cc.contributionCalendar.totalContributions, repos: u.repositories.totalCount, stars, days, langs };
}

function fake() {
  let s = 5; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const end = new Date(); const days = [];
  for (let i = 364; i >= 0; i--) { const d = new Date(end); d.setUTCDate(end.getUTCDate() - i); days.push({ count: r() > 0.7 ? Math.ceil(r() * 8) : 0, date: d.toISOString().slice(0, 10) }); }
  return { commits: 126, prs: 14, total: days.reduce((a, b) => a + b.count, 0), repos: 28, stars: 2, days, langs: { TypeScript: 49900, JavaScript: 18700, HTML: 16700, CSS: 4900 } };
}

const data = process.env.FAKE ? fake() : await fetchData();
const counts = data.days.map((d) => d.count);

// ---- sequências ----
let best = 0, run = 0;
for (const c of counts) { run = c > 0 ? run + 1 : 0; best = Math.max(best, run); }
let cur = 0, i0 = counts.length - 1;
if (counts[i0] === 0) i0--;
for (; i0 >= 0 && counts[i0] > 0; i0--) cur++;

// ---- meses (últimos 12) ----
const months = [];
{
  const now = new Date(data.days[data.days.length - 1].date + "T00:00:00Z");
  for (let m = 11; m >= 0; m--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1));
    months.push({ key: d.toISOString().slice(0, 7), label: "JFMAMJJASOND"[d.getUTCMonth()], v: 0 });
  }
  for (const d of data.days) { const mo = months.find((x) => x.key === d.date.slice(0, 7)); if (mo) mo.v += d.count; }
}
const activeMonths = months.filter((m) => m.v > 0).length;
const sum30 = counts.slice(-30).reduce((a, b) => a + b, 0);

// ---- nível e XP (regra: contribuições + PRs×5 + repositórios×5 + estrelas×10) ----
const xp = data.total + data.prs * 5 + data.repos * 5 + data.stars * 10;
const level = Math.floor(Math.sqrt(xp / 3)) + 1;
const lo = 3 * (level - 1) ** 2, hi = 3 * level ** 2;
const xpPct = Math.max(0, Math.min(1, (xp - lo) / (hi - lo)));

// ---- metas dos anéis ----
const nextGoal = (v, list) => list.find((x) => x > v) || Math.ceil((v + 1) / 100) * 100;
const gC = nextGoal(data.commits, [10, 25, 50, 100, 200, 300, 500, 1000, 2000]);
const gP = nextGoal(data.prs, [1, 5, 10, 25, 50, 100, 250]);
const gS = nextGoal(cur, [3, 7, 14, 30, 60, 100, 365]);

// ---- linguagens ----
const langTotal = Object.values(data.langs).reduce((a, b) => a + b, 0);
const langs = Object.entries(data.langs).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, sz], i) => [n.length > 11 ? n.slice(0, 10) + "…" : n, langTotal ? +((sz / langTotal) * 100).toFixed(1) : 0, [CY, Y, MG, PU][i]]);

// ---- conquistas (só números reais) ----
const ach = [];
if (best >= 2) ach.push([`Sequência de ${best} dias`, GR]);
if (data.prs >= 1) ach.push([`${data.prs} pull request${data.prs > 1 ? "s" : ""}`, CY]);
if (data.repos >= 1) ach.push([`${data.repos} repositório${data.repos > 1 ? "s" : ""}`, MG]);
if (data.commits >= 1) ach.push([`${data.commits} commits no ano`, Y]);
if (data.stars >= 1 && ach.length < 4) ach.push([`${data.stars} estrela${data.stars > 1 ? "s" : ""}`, PU]);
const achievements = ach.slice(0, 4);

// ---- SVG ----
let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const num = (n) => Number(n).toLocaleString("pt-BR");
const T = (x, y, t, sz, c, a, w, extra = "") => `<text x="${x}" y="${y}" ${F} font-size="${sz}" fill="${c}"${a ? ` text-anchor="${a}"` : ""}${w ? ' font-weight="700"' : ""} ${extra}>${esc(t)}</text>`;
const D = "8s";
function dec(x, y, fin, sz, c, a = "start") {
  let o = "";
  [[0, 0.03], [0.03, 0.06], [0.06, 0.09]].forEach((w) => {
    const f = String(fin).replace(/[0-9]/g, () => Math.floor(rnd() * 10));
    o += `<text x="${x}" y="${y}" ${F} font-size="${sz}" fill="${c}" font-weight="700" text-anchor="${a}" opacity="0">${esc(f)}<animate attributeName="opacity" calcMode="discrete" keyTimes="0;${w[0]};${w[1]};1" values="0;1;0;0" dur="${D}" repeatCount="indefinite"/></text>`;
  });
  return o + `<text x="${x}" y="${y}" ${F} font-size="${sz}" fill="${c}" font-weight="700" text-anchor="${a}" opacity="0">${esc(fin)}<animate attributeName="opacity" calcMode="discrete" keyTimes="0;0.09;1" values="0;1;1" dur="${D}" repeatCount="indefinite"/></text>`;
}
function ring(cx, cy, R, v, goal, c, lab, d) {
  const C = 2 * Math.PI * R, p = Math.min(1, v / goal), e = (C * (1 - p)).toFixed(1), Cs = C.toFixed(1);
  return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#1B1B2E" stroke-width="7"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${c}" stroke-width="7" stroke-dasharray="${Cs}" stroke-dashoffset="${Cs}" transform="rotate(-90 ${cx} ${cy})"><animate attributeName="stroke-dashoffset" values="${Cs};${Cs};${e};${e};${Cs}" keyTimes="0;0.04;0.28;0.92;1" dur="${D}" begin="${d}s" repeatCount="indefinite"/></circle>` +
    dec(cx, cy + 5, String(v), 15, c, "middle") + T(cx, cy + R + 16, lab, 9, DIM, "middle") + T(cx, cy + R + 28, `META ${goal}`, 8, "#5A5A78", "middle");
}
let a = "";
a += `<defs><pattern id="haz" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="${Y}"/><rect x="4" width="4" height="8" fill="#0A0A12"/></pattern></defs>`;
a += `<path d="M14 0H666L680 14V306L666 320H14L0 306V14Z" fill="#0E0E18" stroke="#2A2A3C"/>`;
a += `<path d="M14 0H666L680 14" fill="none" stroke="${Y}" stroke-width="3"/>`;
[[10, 12, 1, 1], [670, 12, -1, 1], [10, 308, 1, -1], [670, 308, -1, -1]].forEach((k) => { a += `<path d="M${k[0]} ${k[1] + k[3] * 14}V${k[1]}H${k[0] + k[2] * 14}" fill="none" stroke="${Y}" stroke-width="2"/>`; });
const G = "0;0.78;0.79;0.81;0.83;0.85;1";
const ghost = (c, v, b) => `<text x="24" y="36" ${F} font-size="13" fill="${c}" font-weight="700" letter-spacing="2" opacity="0">// STATUS DO DESENVOLVEDOR<animate attributeName="opacity" calcMode="discrete" keyTimes="${G}" values="0;0;1;1;1;0;0" dur="5s" begin="${b}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" calcMode="discrete" keyTimes="${G}" values="0 0;0 0;${v};0 0" dur="5s" begin="${b}s" repeatCount="indefinite"/></text>`;
a += ghost(CY, "-3 0;3 0;-2 1;2 0;0 0", 0) + ghost(MG, "3 0;-3 0;2 -1;-2 0;0 0", 0.05);
a += T(24, 36, "// STATUS DO DESENVOLVEDOR", 13, Y, 0, 1, 'letter-spacing="2"');
a += `<rect x="24" y="42" width="120" height="4" fill="url(#haz)"/>`;
a += `<circle cx="360" cy="32" r="3" fill="${GR}"><animate attributeName="opacity" values="1;.2;1" dur="1.4s" repeatCount="indefinite"/></circle>` + T(368, 36, "SYS.ONLINE", 10, GR);
a += T(656, 36, `ID:JC-0001 · @${USER}`, 10, DIM, "end");
// ficha
a += `<rect x="24" y="58" width="86" height="86" fill="#12121C" stroke="${Y}" stroke-width="2"/>` + T(67, 80, "NÍVEL", 10, DIM, "middle") + dec(67, 126, String(level), 38, Y, "middle");
a += T(124, 70, "JONETHON COUTINHO", 13, "#E6E6F0", 0, 1) + T(124, 88, "CLASSE: NODE.JS · BACKEND", 10, CY);
const bw = Math.round(196 * xpPct);
a += `<rect x="124" y="102" width="196" height="10" fill="#1B1B2E"/><rect x="124" y="102" width="0" height="10" fill="${MG}"><animate attributeName="width" values="0;0;${bw};${bw};0" keyTimes="0;0.04;0.28;0.92;1" dur="${D}" repeatCount="indefinite"/></rect>`;
a += `<rect x="124" y="102" width="30" height="10" fill="#fff" opacity="0"><animate attributeName="x" values="124;124;${124 + Math.max(0, bw - 30)};${124 + Math.max(0, bw - 30)}" keyTimes="0;0.3;0.5;1" dur="${D}" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0;.25;0;0" keyTimes="0;0.3;0.35;0.5;1" dur="${D}" repeatCount="indefinite"/></rect>`;
a += T(124, 128, `XP ${num(xp)} / ${num(hi)}`, 10, DIM);
a += ring(58, 200, 30, data.commits, gC, Y, "COMMITS", 0) + ring(142, 200, 30, data.prs, gP, CY, "PRs", 0.15) + ring(226, 200, 30, cur, gS, GR, "SEQUÊNCIA", 0.3);
a += T(24, 276, `REPOS ${data.repos} · ESTRELAS ${data.stars} · MAIOR SEQ. ${best}d`, 9, DIM);
a += T(24, 291, `MESES ATIVOS ${activeMonths} · ATIVIDADE 30D ${sum30}`, 9, DIM);
a += `<rect x="24" y="300" width="60" height="4" fill="url(#haz)"/>`;
a += `<line x1="274" y1="52" x2="274" y2="300" stroke="#2A2A3C"/><line x1="494" y1="52" x2="494" y2="300" stroke="#2A2A3C"/>`;
a += T(290, 70, "// ATIVIDADE POR MÊS", 10, CY);
const mx = Math.max(1, ...months.map((m) => m.v));
months.forEach((m, i) => {
  const h = m.v === 0 ? 2 : Math.max(4, Math.round((m.v / mx) * 120)), x = 290 + i * 17, c = m.v === 0 ? "#2A2A3C" : m.v / mx > 0.66 ? Y : m.v / mx > 0.3 ? CY : MG;
  a += `<rect x="${x}" y="${254 - h}" width="12" height="${h}" fill="${c}"><animate attributeName="height" values="2;2;${h};${h};2" keyTimes="0;0.04;0.24;0.92;1" dur="${D}" begin="${(i * 0.05).toFixed(2)}s" repeatCount="indefinite"/><animate attributeName="y" values="252;252;${254 - h};${254 - h};252" keyTimes="0;0.04;0.24;0.92;1" dur="${D}" begin="${(i * 0.05).toFixed(2)}s" repeatCount="indefinite"/></rect>` + T(x + 6, 270, m.label, 9, DIM, "middle");
});
a += `<line x1="290" y1="254" x2="482" y2="254" stroke="#2A2A3C"/>`;
a += T(510, 70, "// LINGUAGENS", 10, MG);
const C2 = 2 * Math.PI * 24, C2s = C2.toFixed(1);
a += `<circle cx="530" cy="122" r="24" fill="none" stroke="#1B1B2E" stroke-width="12"/>`;
let ox = 0;
langs.forEach((l, i) => { const len = ((C2 * l[1]) / 100).toFixed(1); a += `<circle cx="530" cy="122" r="24" fill="none" stroke="${l[2]}" stroke-width="12" stroke-dasharray="0 ${C2s}" transform="rotate(${(-90 + ox * 3.6).toFixed(1)} 530 122)"><animate attributeName="stroke-dasharray" values="0 ${C2s};0 ${C2s};${len} ${C2s};${len} ${C2s};0 ${C2s}" keyTimes="0;0.04;0.28;0.92;1" dur="${D}" begin="${(i * 0.15).toFixed(2)}s" repeatCount="indefinite"/></circle>`; ox += l[1]; });
langs.forEach((l, i) => { a += `<rect x="566" y="${100 + i * 16}" width="7" height="7" fill="${l[2]}"/>` + T(577, 107 + i * 16, l[0], 9, "#E6E6F0") + T(664, 107 + i * 16, `${l[1]}%`, 9, l[2], "end", 1); });
if (!langs.length) a += T(510, 110, "sem dados ainda", 10, DIM);
a += T(510, 182, "// CONQUISTAS", 10, Y);
achievements.forEach((q, i) => { const y = 192 + i * 26; a += `<rect x="510" y="${y}" width="146" height="20" fill="#12121C" stroke="${q[1]}" stroke-opacity=".6"/>` + T(520, y + 14, q[0].length > 22 ? q[0].slice(0, 21) + "…" : q[0], 10, q[1], 0, 1); });
a += `<rect x="0" y="0" width="680" height="2" fill="${CY}" opacity=".16"><animate attributeName="y" values="-4;322" dur="7s" repeatCount="indefinite"/></rect>`;
a += T(656, 313, `XP = contribuições + PRs×5 + repos×5 + estrelas×10`, 7, "#4A4A66", "end");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="824" height="388" viewBox="0 0 680 320" role="img" aria-label="Estatísticas do GitHub: nível ${level}, ${data.commits} commits, ${data.prs} pull requests, sequência atual de ${cur} dias">${a}</svg>`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log("ok", OUT, "nivel", level, "xp", xp, "/", hi, `${(svg.length / 1024).toFixed(0)}KB`);
