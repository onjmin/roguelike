// 自動プレイ（pnpm sim）。ボットに何度も潜らせて、落ちないか・どこで倒れるかを数える。
//
//   pnpm sim                 … 200回
//   pnpm sim -- --n 1000     … 回数
//   pnpm sim -- --seed abc   … 1回だけ（ログつき）
//   pnpm sim -- --quiet      … 表だけ
//
// Vite の SSR で src/core を読み込む（ビルドせずに TS のまま動かす）。
// 例外が出たら シードと スタックを出して 終了コード 1。

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name, def) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : def;
};
const N = Number(arg("n", 200));
const ONE = arg("seed", null);
const QUIET = args.includes("--quiet");
const MAX_ACTIONS = 60000;

const server = await createServer({
	root: ROOT,
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: "custom",
	logLevel: "error",
	optimizeDeps: { noDiscovery: true, include: [] },
});

let failed = false;
try {
	const { Run } = await server.ssrLoadModule("/src/core/run.ts");
	const { botCommand } = await server.ssrLoadModule("/src/sim/bot.ts");
	const { serializeRun, deserializeRun } = await server.ssrLoadModule(
		"/src/core/serial.ts",
	);
	const { LAST_DEPTH } = await server.ssrLoadModule("/src/core/balance.ts");

	const results = [];
	const seeds = ONE ? [ONE] : Array.from({ length: N }, (_, i) => `sim-${i}`);
	for (const seed of seeds) {
		let run = Run.create(seed);
		const lvAt = {};
		const turnsAt = {};
		let actions = 0;
		let lastDepth = run.s.depth;
		try {
			while (!run.s.end && actions < MAX_ACTIONS) {
				const cmd = botCommand(run);
				const ev = run.act(cmd);
				actions++;
				if (ONE && !QUIET)
					for (const e of ev) if (e.t === "msg") console.log(`[B${run.s.depth} T${run.s.turn}] ${e.text}`);
				if (run.s.depth !== lastDepth) {
					lvAt[lastDepth] = run.s.player.lv;
					turnsAt[lastDepth] = run.s.turn;
					lastDepth = run.s.depth;
				}
				// ときどき中断セーブを通す（読み直しで壊れないか）
				if (actions % 997 === 0) run = new Run(deserializeRun(serializeRun(run.s)));
			}
		} catch (e) {
			failed = true;
			console.error(`\n[例外] seed=${seed} actions=${actions} depth=${run.s.depth}`);
			console.error(e);
			if (ONE) break;
			continue;
		}
		const s = run.s;
		results.push({
			seed,
			end: s.end?.kind ?? "stuck",
			cause: s.end?.cause ?? "(行動の上限)",
			depth: s.stats.maxDepth,
			finalDepth: s.depth,
			returning: s.returning,
			lv: s.player.lv,
			turn: s.turn,
			lvAt,
			turnsAt,
			seen: s.seen.length,
			flowed: s.flowed,
			lost: s.lost.length,
			hunger: s.player.hunger,
		});
	}

	// ───── 集計 ─────
	const n = results.length;
	const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;
	const clears = results.filter((r) => r.end === "clear").length;
	const stuck = results.filter((r) => r.end === "stuck").length;
	const reached = results.filter((r) => r.depth >= LAST_DEPTH).length;
	console.log(`\n${n}回　クリア ${clears}（${pct(clears)}）　最下層まで ${reached}（${pct(reached)}）　止まった ${stuck}`);
	// 倒れた階
	const byDepth = {};
	for (const r of results) if (r.end === "dead") byDepth[r.finalDepth] = (byDepth[r.finalDepth] ?? 0) + 1;
	console.log("倒れた階:", Object.entries(byDepth).map(([d, c]) => `B${d}:${c}`).join(" "));
	// 死因
	const causes = {};
	for (const r of results) if (r.end === "dead") causes[r.cause] = (causes[r.cause] ?? 0) + 1;
	console.log("死因:");
	for (const [c, k] of Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 15))
		console.log(`  ${k}\t${c}`);
	// 階ごとのレベル・ターン（着いたとき）
	const rows = [];
	for (let d = 1; d <= LAST_DEPTH; d++) {
		const lv = results.filter((r) => r.lvAt[d] !== undefined).map((r) => r.lvAt[d]);
		const tt = results.filter((r) => r.turnsAt[d] !== undefined).map((r) => r.turnsAt[d]);
		if (!lv.length) continue;
		const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
		rows.push(`B${d}:Lv${avg(lv)}/T${avg(tt)}(${lv.length})`);
	}
	console.log("階を出たとき:", rows.join("  "));
	const avg = (k) => (results.reduce((a, r) => a + r[k], 0) / n).toFixed(1);
	console.log(`平均：見た札 ${avg("seen")}　流れた札 ${avg("flowed")}　なくなった札 ${avg("lost")}　ターン ${avg("turn")}`);
	const starved = results.filter((r) => r.cause.includes("おなか")).length;
	console.log(`飢え死に ${starved}（${pct(starved)}）`);
} finally {
	await server.close();
}
process.exit(failed ? 1 : 0);
