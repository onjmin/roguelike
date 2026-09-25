// 追いかけの計測（node scripts/chase.mjs）。敵に追われたとき どれだけ撒けるかを、本物の階で数える。
//
//   node scripts/chase.mjs                  … 各場面 300 階
//   node scripts/chase.mjs --n 1000         … 階の数
//   node scripts/chase.mjs --only A,E       … 場面をしぼる（id の頭：A B C D E Q、A-fast など）
//   node scripts/chase.mjs --trace 2        … 場面ごとに 手番ごとの記録を 2つ出す（はじめ・また見つけた・撒けた…）
//   node scripts/chase.mjs --trace 3 --trace-ids A,E  … 記録を出す場面を id そのもので しぼる
//   node scripts/chase.mjs --json out.json  … 数字を JSON でも書き出す（直す前後の比べ用）
//   node scripts/chase.mjs --sight 30       … 見え方の対称性を 30 階で調べる（0 で しない）
//   node scripts/chase.mjs --whatif refresh … 計測の側で「敵の番のあと 見えていれば lastSeen を更新」をまねる
//   node scripts/chase.mjs --whatif trail   … refresh ＋「lastSeen に着いたら キリコの足あとの次のマスへ」をまねる
//                                             （どちらも src/core は変えない。直したら どれだけ変わるかの目安）
//
// Vite の SSR で src/sim/chase.ts を読み込む（ビルドせずに TS のまま動かす）。
// シードが決まっているので、同じ引数なら 毎回同じ数字になる。

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name, def) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : def;
};
const N = Number(arg("n", 300));
const PREFIX = arg("prefix", "c");
const TRACE = Number(arg("trace", 0));
const ONLY = arg("only", null)?.split(",");
const JSON_OUT = arg("json", null);
const TRACE_IDS = arg("trace-ids", null)?.split(",");
const WHATIF = arg("whatif", "none");
const SIGHT = Number(arg("sight", 30));

const server = await createServer({
	root: ROOT,
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: "custom",
	logLevel: "error",
	optimizeDeps: { noDiscovery: true, include: [] },
});

let failed = false;
try {
	const { runChase, summarize, sightSymmetry } =
		await server.ssrLoadModule("/src/sim/chase.ts");
	const t0 = Date.now();
	const results = runChase(
		{ n: N, prefix: PREFIX, trace: TRACE, whatIf: WHATIF },
		ONLY,
	);
	const rows = results.map(summarize);

	const pct = (x) => `${(x * 100).toFixed(0)}%`;
	const f1 = (x) => (x === null ? "-" : Number(x).toFixed(1));
	const cols = [
		["id", 11, (r) => r.id],
		["kind", 9, (r) => r.kind],
		["n", 4, (r) => r.n],
		["lost", 5, (r) => pct(r.lost)],
		["lostAt~", 7, (r) => f1(r.lostAtMed)],
		["reacq", 6, (r) => pct(r.reacq)],
		["escaped", 7, (r) => pct(r.escaped)],
		["far>6", 6, (r) => pct(r.far6)],
		["adj@end", 7, (r) => pct(r.adjEnd)],
		["<=2@end", 7, (r) => pct(r.within2End)],
		["chase/wander", 12, (r) => `${f1(r.chaseAvg)}/${f1(r.wanderAvg)}`],
		["reach/block", 11, (r) => `${pct(r.reached)}/${pct(r.blocked)}`],
		["wAway", 6, (r) => pct(r.wanderAway)],
		["adjBlind", 8, (r) => pct(r.adjBlind)],
		["turns~", 6, (r) => f1(r.turnsMed)],
	];
	const line = (cells) => cells.join(" ");
	console.log(
		`\nchase harness  floors/scenario=${N} prefix=${PREFIX}${WHATIF !== "none" ? `  WHAT-IF=${WHATIF} (harness emulation, not the real AI)` : ""}  (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`,
	);
	console.log(line(cols.map(([h, w]) => String(h).padEnd(w))));
	for (const r of rows)
		console.log(line(cols.map(([, w, f]) => String(f(r)).padEnd(w))));
	console.log(`
  lost      = monster cleared lastSeen / started wandering at least once
  lostAt~   = median turn of the first loss (turn 1 = player's first step away)
  reacq     = of the lost trials, fraction that saw the player again later
  escaped   = at the end: not tracking (lastSeen=null) and more than 2 tiles away
  far>6     = at the end: not tracking and more than 6 tiles away (scenario E's "lost" metric)
  adj@end / <=2@end = Chebyshev distance to the player when the trial ended
  chase/wander = mean turns spent approaching (attack/chase/toLastSeen) vs wandering (lost/wander)
  reach/block = how lastSeen was cleared: monster stood on it / path to it blocked
  wAway     = on the loss turn, the wander step increased the path distance to the player
  adjBlind  = turns that ended with the monster adjacent, where its next act did NOT see the player`);

	const extras = results.filter((r) => Object.keys(r.extra).length);
	if (extras.length) {
		console.log("\nextra counts:");
		for (const r of extras)
			console.log(
				`  ${r.id.padEnd(11)} ${Object.entries(r.extra)
					.map(([k, v]) => `${k}=${v}`)
					.join("  ")}`,
			);
	}
	// 見失った場所
	console.log(
		"\nwhere the first loss happened (monster tile: r=room e=entrance c=corridor) / where it re-acquired:",
	);
	for (const r of results) {
		const lt = {};
		const rt = {};
		for (const o of r.outcomes) {
			if (o.lostTile) lt[o.lostTile] = (lt[o.lostTile] ?? 0) + 1;
			if (o.reacqTile) rt[o.reacqTile] = (rt[o.reacqTile] ?? 0) + 1;
		}
		const fmt = (m) =>
			Object.entries(m)
				.map(([k, v]) => `${k}:${v}`)
				.join(" ") || "-";
		console.log(
			`  ${r.id.padEnd(11)} lost@ ${fmt(lt).padEnd(18)} reacq@ ${fmt(rt)}`,
		);
	}

	if (SIGHT > 0) {
		const s = sightSymmetry(SIGHT, PREFIX);
		console.log(
			`\nsight symmetry over ${SIGHT} floors: ${s.asym} of ${s.pairs} ordered tile pairs see one way only (${((s.asym / s.pairs) * 100).toFixed(3)}%)`,
		);
		for (const [k, v] of Object.entries(s.kinds).sort((a, b) => b[1] - a[1]))
			console.log(`  seer→seen ${k}: ${v}`);
	}

	if (TRACE > 0)
		for (const r of results)
			for (const t of TRACE_IDS && !TRACE_IDS.includes(r.id) ? [] : r.traces) {
				console.log(`\n[trace ${r.id}] ${t[0]}`);
				for (const l of t.slice(1)) console.log(l);
			}

	if (JSON_OUT) {
		writeFileSync(
			JSON_OUT,
			JSON.stringify(
				{
					n: N,
					prefix: PREFIX,
					whatIf: WHATIF,
					rows,
					setups: Object.fromEntries(results.map((r) => [r.id, r.setup])),
					extra: Object.fromEntries(results.map((r) => [r.id, r.extra])),
				},
				null,
				2,
			),
		);
		console.log(`\nwrote ${JSON_OUT}`);
	}
} catch (e) {
	console.error(e);
	failed = true;
} finally {
	await server.close();
}
process.exit(failed ? 1 : 0);
