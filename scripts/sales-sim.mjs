// 1回の 冒険で 平均 何円 売れるかを ボットで 数える（node scripts/sales-sim.mjs）。
// 町の 段・小段の 刻み（core/town.ts の STAGE_POINTS・TOWN_STEPS）を 決める ための 目安。
//
//   node scripts/sales-sim.mjs            … 本筋 4板と 寄り道 4板を 各 200回
//   node scripts/sales-sim.mjs --n 500    … 回数
//
// 帰ってきた（持ち帰り・帰還スレ）ときの 持ち物を ぜんぶ 売った 値（目的の 品は 売らない。engine/save.ts の
// addPendingReturn と 同じ）。倒れたら 0。倉庫に あずける 分は 考えない（ぜんぶ 売った ときの 上限）。

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const i = args.indexOf("--n");
const N = i >= 0 ? Number(args[i + 1]) : 200;
const MAX_ACTIONS = 60000;

const server = await createServer({
	root: ROOT,
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: "custom",
	logLevel: "error",
	optimizeDeps: { noDiscovery: true, include: [] },
});
try {
	const { Run } = await server.ssrLoadModule("/src/core/run.ts");
	const { botCommand, DEFAULT_BOT } =
		await server.ssrLoadModule("/src/sim/bot.ts");
	const { priceOf } = await server.ssrLoadModule("/src/core/town.ts");
	const { defOf } = await server.ssrLoadModule("/src/core/item.ts");
	const { DUNGEON_IDS } = await server.ssrLoadModule(
		"/src/core/data/dungeons.ts",
	);
	const pct = (a) => {
		const s = [...a].sort((x, y) => x - y);
		return (p) => s[Math.min(s.length - 1, Math.floor((s.length * p) / 100))];
	};
	console.log("板\t帰れた\t平均(全体)\t平均(帰れた回)\t中央値(帰れた回)\t90%");
	for (const d of DUNGEON_IDS) {
		const all = [];
		const back = [];
		for (let k = 0; k < N; k++) {
			const run = Run.create(`sales-${d}-${k}`, d);
			let n = 0;
			while (!run.s.end && n++ < MAX_ACTIONS)
				run.act(botCommand(run, DEFAULT_BOT));
			const end = run.s.end?.kind;
			const sold =
				end === "clear" || end === "escape"
					? run.s.player.items
							.filter((it) => defOf(it.kind).cat !== "goal")
							.reduce((a, it) => a + priceOf(it), 0)
					: 0;
			all.push(sold);
			if (end === "clear" || end === "escape") back.push(sold);
		}
		const avg = (a) =>
			a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
		const p = pct(back.length ? back : [0]);
		console.log(
			`${d}\t${back.length}/${N}\t${avg(all)}\t${avg(back)}\t${p(50)}\t${p(90)}`,
		);
	}
} finally {
	await server.close();
}
