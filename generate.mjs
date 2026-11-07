// Gera um SVG animado: o drone Orbe voa pelo gráfico de commits e atira nas células.
// Uso: GITHUB_TOKEN=... GITHUB_USER=jonethon5 node drone/generate.mjs [saida.svg]
// Teste sem rede: FAKE=1 node drone/generate.mjs teste.svg

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const USER = process.env.GITHUB_USER || process.env.GITHUB_REPOSITORY_OWNER || "jonethon5";
const OUT = process.argv[2] || "dist/drone.svg";

// ---------- paleta ----------
const C = {
  bg: "#0E0E18",
  border: "#2A2A3C",
  level: ["#1A1A28", "#4A4310", "#9A8C1C", "#F5E642"],
  dead: "#14111C",
  flash1: "#FF2E88",
  flash2: "#19E3FF",
  yellow: "#F5E642",
  burnt: "#4A1038",
  text: "#8A8AA0",
  cyan: "#19E3FF",
  magenta: "#FF2E88",
  body: "#8B5CF6",
  dark: "#0A0A12",
  white: "#E6E6F0",
};

// ---------- dados ----------
async function fetchCalendar() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN não definido");
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{contributionCount weekday}}}}}}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "drone-graph" },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.contributionsCollection.contributionCalendar.weeks.map((w) =>
    w.contributionDays.map((d) => ({ count: d.contributionCount, row: d.weekday }))
  );
}

function fakeCalendar() {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 53 }, () =>
    Array.from({ length: 7 }, (_, row) => ({ count: rnd() > 0.55 ? Math.ceil(rnd() * 9) : 0, row }))
  );
}

// ---------- layout ----------
const S = 12, G = 3, STEP = S + G;
const PAD_X = 16, TOP = 44, BOTTOM = 36;

function build(weeks) {
  const cols = weeks.length;
  const W = PAD_X * 2 + cols * STEP - G;
  const gridH = 7 * STEP - G;
  const H = TOP + gridH + BOTTOM;

  const max = Math.max(1, ...weeks.flat().map((d) => d.count));
  const cells = [];
  weeks.forEach((days, c) =>
    days.forEach((d) => {
      const ratio = d.count / max;
      const level = d.count === 0 ? 0 : ratio < 0.34 ? 1 : ratio < 0.67 ? 2 : 3;
      cells.push({ c, r: d.row, level, x: PAD_X + c * STEP, y: TOP + d.row * STEP });
    })
  );

  // PRNG determinístico (o SVG é sempre igual para os mesmos dados)
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---------- simulação do voo ----------
  const targets = cells.filter((c) => c.level > 0);
  const n = Math.max(1, targets.length);
  const shot = Math.min(0.85, 45 / n); // segundos por alvo (loop de no máx. ~70 s)
  const start = 1.2;

  let pos = { x: PAD_X + 30, y: TOP + gridH / 2 };
  const remaining = targets.slice();
  const order = [];
  const flight = [{ t: 0, x: pos.x, y: pos.y }];
  let t = start;
  flight.push({ t, x: pos.x, y: pos.y });

  while (remaining.length) {
    // alvo próximo, com um pouco de aleatoriedade
    let bi = 0, bd = Infinity;
    remaining.forEach((c, i) => {
      const d = Math.hypot(c.x - pos.x, c.y - pos.y) + rnd() * 70;
      if (d < bd) { bd = d; bi = i; }
    });
    const tg = remaining.splice(bi, 1)[0];
    const side = pos.x < tg.x ? -1 : 1;
    const hx = Math.max(PAD_X + 20, Math.min(W - PAD_X - 20, tg.x + S / 2 + side * (36 + rnd() * 26)));
    const hy = Math.max(TOP - 14, Math.min(TOP + gridH + 14, tg.y + S / 2 - 18 + rnd() * 12));
    const move = shot * 0.6, fire = shot * 0.4;
    const tArrive = t + move;
    flight.push({ t: tArrive, x: hx, y: hy });
    const tShoot = tArrive + fire * 0.15;
    const tHit = tShoot + Math.min(0.28, fire * 0.7);
    flight.push({ t: t + shot, x: hx, y: hy });
    order.push({ tg, from: { x: hx, y: hy }, tShoot, tHit });
    pos = { x: hx, y: hy };
    t += shot;
  }
  const end = t + 2.5; // pausa antes de reiniciar
  const T = end + 1.0;
  flight.push({ t: end - 0.8, x: pos.x, y: pos.y });
  flight.push({ t: T, x: PAD_X + 30, y: TOP + gridH / 2 });

  const k = (sec) => Math.min(1, Math.max(0, sec / T)).toFixed(5);
  const f1 = (v) => (Math.round(v * 10) / 10).toString();

  // ---------- SVG ----------
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Drone voando pelo gráfico de commits e atirando nas contribuições">`);
  out.push(`<title>Drone invadindo o gráfico de commits</title>`);
  out.push(`<rect width="${W}" height="${H}" rx="6" fill="${C.bg}" stroke="${C.border}"/>`);
  out.push(`<text x="${PAD_X}" y="26" font-family="monospace" font-size="12" fill="${C.cyan}" letter-spacing="1">// RASTREADOR DE COMMITS</text>`);
  out.push(`<text x="${W - PAD_X}" y="26" font-family="monospace" font-size="12" fill="${C.text}" text-anchor="end">DRONE-01 @${USER}</text>`);

  // células
  const byKey = new Map(order.map((o) => [`${o.tg.c},${o.tg.r}`, o]));
  for (const cell of cells) {
    const o = byKey.get(`${cell.c},${cell.r}`);
    const base = C.level[cell.level];
    if (!o) {
      out.push(`<rect x="${cell.x}" y="${cell.y}" width="${S}" height="${S}" rx="2" fill="${base}"/>`);
      continue;
    }
    const h = o.tHit;
    const kt = [0, h, h + 0.06, h + 0.12, h + 0.2, h + 0.3, h + 0.6, end - 0.4, end, T].map(k).join(";");
    const vals = [base, base, C.white, C.flash1, C.yellow, C.flash2, C.burnt, C.burnt, base, base].join(";");
    out.push(`<rect x="${cell.x}" y="${cell.y}" width="${S}" height="${S}" rx="2" fill="${base}"><animate attributeName="fill" calcMode="discrete" dur="${f1(T)}s" repeatCount="indefinite" keyTimes="${kt}" values="${vals}"/></rect>`);
    const cx = cell.x + S / 2, cy = cell.y + S / 2;
    const D = f1(T) + "s";
    // dois anéis de choque
    const ek = [0, h - 0.001, h, h + 0.4, T].map(k).join(";");
    out.push(`<circle cx="${cx}" cy="${cy}" r="2" fill="none" stroke="${C.yellow}" stroke-width="2" opacity="0"><animate attributeName="r" dur="${D}" repeatCount="indefinite" keyTimes="${ek}" values="2;2;2;19;19"/><animate attributeName="opacity" dur="${D}" repeatCount="indefinite" keyTimes="${ek}" values="0;0;1;0;0"/></circle>`);
    const ek2 = [0, h + 0.05, h + 0.06, h + 0.5, T].map(k).join(";");
    out.push(`<circle cx="${cx}" cy="${cy}" r="2" fill="none" stroke="${C.magenta}" stroke-width="1.5" opacity="0"><animate attributeName="r" dur="${D}" repeatCount="indefinite" keyTimes="${ek2}" values="2;2;2;26;26"/><animate attributeName="opacity" dur="${D}" repeatCount="indefinite" keyTimes="${ek2}" values="0;0;1;0;0"/></circle>`);
    // faíscas voando
    const pc = [C.yellow, C.magenta, C.white, C.cyan, C.yellow, C.magenta];
    for (let p = 0; p < 6; p++) {
      const an = (p / 6) * Math.PI * 2 + rnd() * 0.8, ds = 12 + rnd() * 14;
      const dx = f1(Math.cos(an) * ds), dy = f1(Math.sin(an) * ds);
      const pk = [0, h - 0.001, h, h + 0.5, T].map(k).join(";");
      out.push(`<rect x="${f1(cx - 1.2)}" y="${f1(cy - 1.2)}" width="2.4" height="2.4" fill="${pc[p]}" opacity="0"><animateTransform attributeName="transform" type="translate" dur="${D}" repeatCount="indefinite" keyTimes="${pk}" values="0 0;0 0;0 0;${dx} ${dy};${dx} ${dy}"/><animate attributeName="opacity" dur="${D}" repeatCount="indefinite" keyTimes="${pk}" values="0;0;1;0;0"/></rect>`);
    }
  }

  // tiros
  for (const o of order) {
    const ax = o.from.x, ay = o.from.y, bx = o.tg.x + S / 2, by = o.tg.y + S / 2;
    const ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    const kt = [0, o.tShoot, o.tShoot + 0.001, o.tHit, o.tHit + 0.001, T].map(k).join(";");
    out.push(`<g opacity="0"><animate attributeName="opacity" dur="${f1(T)}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt}" values="0;0;1;1;0;0"/><g transform="translate(${f1(ax)} ${f1(ay)}) rotate(${f1(ang)})"><animateTransform attributeName="transform" type="translate" additive="sum" dur="${f1(T)}s" repeatCount="indefinite" keyTimes="${[0, o.tShoot, o.tHit, T].map(k).join(";")}" values="0 0;0 0;${f1(Math.hypot(bx - ax, by - ay))} 0;${f1(Math.hypot(bx - ax, by - ay))} 0"/><rect x="-7" y="-1.5" width="14" height="3" fill="${C.magenta}"/><rect x="-2" y="-0.8" width="6" height="1.6" fill="${C.white}"/></g></g>`);
  }

  // drone de câmera (desenho vetorial, escala 0.15)
  const kts = flight.map((p) => k(p.t)).join(";");
  const vls = flight.map((p) => `${f1(p.x)} ${f1(p.y)}`).join(";");
  const splines = flight.slice(1).map(() => "0.45 0 0.55 1").join(";");
  const K = "#0A0A12";
  out.push(`<g><animateTransform attributeName="transform" type="translate" dur="${f1(T)}s" repeatCount="indefinite" calcMode="spline" keyTimes="${kts}" keySplines="${splines}" values="${vls}"/>`);
  out.push(`<g transform="scale(0.15)"><animateTransform attributeName="transform" type="translate" additive="sum" dur="2.4s" repeatCount="indefinite" values="0 -10;0 10;0 -10"/>
<path d="M-205 -10h130v22h-110z M205 -10h-130v22h110z" fill="${C.yellow}" stroke="${K}" stroke-width="7"/>
<rect x="-215" y="-34" width="24" height="26" rx="5" fill="${C.cyan}" stroke="${K}" stroke-width="6"/><rect x="191" y="-34" width="24" height="26" rx="5" fill="${C.cyan}" stroke="${K}" stroke-width="6"/>
<ellipse cx="-203" cy="-38" rx="48" ry="6" fill="${C.cyan}" stroke="${K}" stroke-width="5"><animate attributeName="rx" values="48;8;48" dur="0.16s" repeatCount="indefinite"/></ellipse>
<ellipse cx="203" cy="-38" rx="48" ry="6" fill="${C.cyan}" stroke="${K}" stroke-width="5"><animate attributeName="rx" values="8;48;8" dur="0.16s" repeatCount="indefinite"/></ellipse>
<rect x="-34" y="-50" width="68" height="20" rx="4" fill="${C.magenta}" stroke="${K}" stroke-width="6"/>
<path d="M-56 56l-30 18M56 56l30 18" stroke="${C.yellow}" stroke-width="8" stroke-linecap="round"/>
<circle cx="-92" cy="82" r="24" fill="${C.yellow}" stroke="${K}" stroke-width="6"/><circle cx="-92" cy="82" r="8" fill="${K}"/><circle cx="-92" cy="82" r="4" fill="${C.magenta}"><animate attributeName="opacity" values="1;.2;1" dur="1s" repeatCount="indefinite"/></circle>
<circle cx="92" cy="82" r="24" fill="${C.yellow}" stroke="${K}" stroke-width="6"/><circle cx="92" cy="82" r="8" fill="${K}"/><circle cx="92" cy="82" r="4" fill="${C.cyan}"><animate attributeName="opacity" values=".2;1;.2" dur="1s" repeatCount="indefinite"/></circle>
<path d="M-26 56h52l-8 42h-36z" fill="#2A2A4A" stroke="${K}" stroke-width="6"/>
<circle cx="0" cy="0" r="62" fill="${C.yellow}" stroke="${K}" stroke-width="7"/><circle cx="0" cy="0" r="44" fill="#E0C92A"/>
<circle cx="0" cy="0" r="38" fill="${K}" stroke="${C.cyan}" stroke-width="7"/><circle cx="0" cy="0" r="26" fill="#1B1B36"/>
<circle cx="-8" cy="-9" r="8" fill="${C.white}" opacity=".85"/><circle cx="8" cy="9" r="4" fill="${C.cyan}"><animate attributeName="opacity" values="1;.3;1" dur="1.6s" repeatCount="indefinite"/></circle>
</g></g>`);

  out.push(`</svg>`);
  return { svg: out.join("\n"), stats: { cols, targets: targets.length, loop: T } };
}

const weeks = process.env.FAKE ? fakeCalendar() : await fetchCalendar();
const { svg, stats } = build(weeks);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(`OK ${OUT} | semanas=${stats.cols} alvos=${stats.targets} loop=${stats.loop.toFixed(1)}s tamanho=${(svg.length / 1024).toFixed(0)}KB`);
