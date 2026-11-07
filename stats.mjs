// Gera o painel de estatísticas (SVG) a partir da API do GitHub.
// Uso: GITHUB_TOKEN=... GITHUB_USER=jonethon5 node drone/stats.mjs dist/estatisticas.svg
// Teste sem rede: FAKE=1 node drone/stats.mjs teste.svg
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const USER = process.env.GITHUB_USER || process.env.GITHUB_REPOSITORY_OWNER || "jonethon5";
const OUT = process.argv[2] || "dist/estatisticas.svg";
const Y = "#F5E642", CY = "#19E3FF", MG = "#FF2E88", PU = "#8B5CF6", GR = "#3DFF8A";
const M = "'Courier New',Courier,monospace";

async function fetchData() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN não definido");
  const query = `query($login:String!){user(login:$login){
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
  const days = cc.contributionCalendar.weeks.flatMap(w => w.contributionDays).map(d => d.contributionCount);
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
  const days = Array.from({ length: 365 }, () => (r() > 0.4 ? Math.ceil(r() * 8) : 0));
  return { commits: 187, prs: 12, total: days.reduce((a, b) => a + b, 0), repos: 9, stars: 3, days, langs: { TypeScript: 52000, JavaScript: 41000, PLpgSQL: 8000, Dockerfile: 2000, HTML: 1500 } };
}

function streaks(days) {
  let best = 0, run = 0;
  for (const d of days) { run = d > 0 ? run + 1 : 0; best = Math.max(best, run); }
  let cur = 0, i = days.length - 1;
  if (days[i] === 0) i--; // hoje ainda pode não ter commit
  for (; i >= 0 && days[i] > 0; i--) cur++;
  return { cur, best };
}

const data = process.env.FAKE ? fake() : await fetchData();
const { cur, best } = streaks(data.days);
const last30 = data.days.slice(-30);
const max30 = Math.max(1, ...last30);
const sum30 = last30.reduce((a, b) => a + b, 0);
const langTotal = Object.values(data.langs).reduce((a, b) => a + b, 0);
const langs = Object.entries(data.langs).sort((a, b) => b[1] - a[1]).slice(0, 4);
const palette = [CY, Y, MG, PU];

const W = 824, H = 262;
const tile = (x, y, v, label, col, i) => `
<rect x="${x}" y="${y}" width="140" height="74" fill="#12121C" stroke="#2A2A3C"/>
<rect x="${x}" y="${y}" width="3" height="74" fill="${col}"/>
<text x="${x + 16}" y="${y + 40}" font-family="${M}" font-size="28" font-weight="700" fill="${col}">${v}<animate attributeName="opacity" values="0;1;1" keyTimes="0;0.06;1" dur="6s" begin="${i * 0.15}s" repeatCount="indefinite"/></text>
<text x="${x + 16}" y="${y + 60}" font-family="${M}" font-size="10" letter-spacing="1" fill="#8A8AA0">${label}</text>`;

// gráfico 30 dias
const CX = 346, CB = 218, CH = 110, BW = 6, BG = 2.6;
let bars = "";
last30.forEach((v, i) => {
  const h = v === 0 ? 2 : Math.max(5, Math.round((v / max30) * CH));
  const x = CX + i * (BW + BG), col = v === 0 ? "#2A2A3C" : v / max30 > .66 ? Y : v / max30 > .33 ? CY : MG;
  bars += `<rect x="${x}" width="${BW}" fill="${col}" y="${CB - 2}" height="2"><animate attributeName="y" values="${CB - 2};${CB - 2};${CB - h};${CB - h};${CB - 2}" keyTimes="0;0.02;0.14;0.9;1" dur="8s" begin="${(i * 0.03).toFixed(2)}s" repeatCount="indefinite"/><animate attributeName="height" values="2;2;${h};${h};2" keyTimes="0;0.02;0.14;0.9;1" dur="8s" begin="${(i * 0.03).toFixed(2)}s" repeatCount="indefinite"/></rect>`;
});
const cw = 30 * (BW + BG) - BG;

// linguagens
const LX = 640, LW = 168;
let lg = "";
langs.forEach(([n, sz], i) => {
  const pct = langTotal ? (sz / langTotal) * 100 : 0, y = 82 + i * 38, w = Math.max(3, Math.round((LW * pct) / 100)), col = palette[i];
  lg += `<text x="${LX}" y="${y}" font-family="${M}" font-size="12" fill="#E6E6F0">${n.length > 14 ? n.slice(0, 13) + "…" : n}</text>
<text x="${LX + LW}" y="${y}" text-anchor="end" font-family="${M}" font-size="12" font-weight="700" fill="${col}">${pct.toFixed(1)}%</text>
<rect x="${LX}" y="${y + 7}" width="${LW}" height="7" fill="#171726"/>
<rect x="${LX}" y="${y + 7}" height="7" fill="${col}" width="0"><animate attributeName="width" values="0;0;${w};${w};0" keyTimes="0;0.03;0.2;0.92;1" dur="8s" begin="${i * 0.2}s" repeatCount="indefinite"/></rect>`;
});
if (!langs.length) lg = `<text x="${LX}" y="90" font-family="${M}" font-size="12" fill="#8A8AA0">sem dados ainda</text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Estatísticas do GitHub: ${data.commits} commits, ${data.prs} pull requests, ${data.stars} estrelas, sequência atual de ${cur} dias">
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" fill="#0E0E18" stroke="#2A2A3C"/>
<rect width="${W}" height="4" fill="${Y}"/>
<text x="20" y="32" font-family="${M}" font-size="14" font-weight="700" letter-spacing="2" fill="${Y}">// ESTATÍSTICAS</text>
<text x="${W - 20}" y="32" text-anchor="end" font-family="${M}" font-size="11" fill="#8A8AA0">ÚLTIMOS 12 MESES · CONTRIBUIÇÕES PÚBLICAS · @${USER}</text>
${tile(20, 54, data.commits, "COMMITS", Y, 0)}${tile(172, 54, data.prs, "PULL REQUESTS", CY, 1)}
${tile(20, 138, data.stars, "ESTRELAS", MG, 2)}${tile(172, 138, `${cur}d`, "SEQUÊNCIA ATUAL", GR, 3)}
<text x="20" y="236" font-family="${M}" font-size="11" fill="#8A8AA0">MAIOR SEQUÊNCIA <tspan fill="#E6E6F0" font-weight="700">${best}d</tspan>   ·   REPOS <tspan fill="#E6E6F0" font-weight="700">${data.repos}</tspan></text>
<line x1="330" y1="54" x2="330" y2="240" stroke="#2A2A3C"/>
<text x="${CX}" y="64" font-family="${M}" font-size="11" letter-spacing="1" fill="${CY}">COMMITS · 30 DIAS</text>
<text x="${CX + cw}" y="64" text-anchor="end" font-family="${M}" font-size="11" fill="#E6E6F0">${sum30} no total</text>
<line x1="${CX}" y1="${CB}" x2="${CX + cw}" y2="${CB}" stroke="#2A2A3C"/>
<line x1="${CX}" y1="${CB - CH}" x2="${CX + cw}" y2="${CB - CH}" stroke="#2A2A3C" stroke-dasharray="2 4"/>
<text x="${CX}" y="${CB + 16}" font-family="${M}" font-size="10" fill="#8A8AA0">30 dias atrás</text>
<text x="${CX + cw}" y="${CB + 16}" text-anchor="end" font-family="${M}" font-size="10" fill="#8A8AA0">hoje</text>
${bars}
<line x1="618" y1="54" x2="618" y2="240" stroke="#2A2A3C"/>
<text x="${LX}" y="64" font-family="${M}" font-size="11" letter-spacing="1" fill="${MG}">LINGUAGENS</text>
${lg}
</svg>`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log("ok", OUT);
