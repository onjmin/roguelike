// 自動プレイ（pnpm sim）。ボットに何度も潜らせて、落ちないか・どこで倒れるかを数える。
//
//   pnpm sim                 … 200回
//   pnpm sim -- --n 1000     … 回数
//   pnpm sim -- --seed abc   … 1回だけ（ログつき）
//   pnpm sim -- --quiet      … 表だけ
//   pnpm sim -- --dungeon shallow … ダンジョン（shallow / main / deep / kinoko / tropical / konamono / festival / hidden / opunu。既定は main）
//   pnpm sim -- --objective boss  … 目的（fetch / boss。既定は そのダンジョンの 既定。boss の ない 板は fetch）
//   pnpm sim -- --reach           … 目的に たどりつくまで 倒れない（底の つり合いを 見る。下の REACH）
//   pnpm sim -- --reach --lag 3   … --reach で 足す レベルを「その階の 強さ − 3」までに（既定は 下の LAG）
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
// 倒れないモード：HP と満腹度を補って、深い階・帰り道まで通す（落ちないかの検査用）
const GOD = args.includes("--god");
// 目的まで 倒れないモード：目的に たどりつくまで（fetch は 品を 拾うまで・boss は ボスを 見るまで）HP と
// 満腹度を 補い、レベルも「その階の 強さ − LAG」までは 足す（底まで 来られる プレイヤーの 目安）。そこからは ふつう。
// ボットが 自力では 底まで 行けない 板で、底の つり合い（帰り道・ボスとの 戦い）を 見る
const REACH = args.includes("--reach");
// どのダンジョンで遊ばせるか（shallow / main / deep ほか）
const DUNGEON = arg("dungeon", "main");
// 目的（fetch / boss）。無ければ その板の 既定
const OBJECTIVE = arg("objective", null);
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
	const { botCommand, DEFAULT_BOT } =
		await server.ssrLoadModule("/src/sim/bot.ts");
	// 倒れないモードは 深い階・帰り道まで通したいので 帰還スレで もどらない
	const noEscape = { ...DEFAULT_BOT, escape: false };
	const botOpts = GOD ? noEscape : DEFAULT_BOT;
	const { serializeRun, deserializeRun } = await server.ssrLoadModule(
		"/src/core/serial.ts",
	);
	const { dungeonById } = await server.ssrLoadModule(
		"/src/core/data/dungeons.ts",
	);
	const { EXP_AT } = await server.ssrLoadModule("/src/core/balance.ts");
	const LAST_DEPTH = dungeonById(DUNGEON).floors;
	if (dungeonById(DUNGEON).id !== DUNGEON) {
		console.error(`知らないダンジョン: ${DUNGEON}`);
		process.exit(1);
	}
	if (OBJECTIVE !== null && OBJECTIVE !== "fetch" && OBJECTIVE !== "boss") {
		console.error(`知らない目的: ${OBJECTIVE}`);
		process.exit(1);
	}
	// ボスの いない 板を boss に しても Run.create は 持ち帰りに するので、表の 見出しが うそに なる
	if (OBJECTIVE === "boss" && !dungeonById(DUNGEON).boss) {
		console.error(
			`${DUNGEON} には ボスが いない（--objective boss は 使えない）`,
		);
		process.exit(1);
	}
	const objective = OBJECTIVE ?? dungeonById(DUNGEON).objective;
	// --reach で 足す レベル：その階の 強さ − LAG まで。ボットが 自力で もぐると、ふつうの 板は 強さ − 2 くらいで
	// ついていく（おんたこ B8 Lv6.9・お祭り B10 Lv9.8・風呂板 B11 Lv10.0）。過疎の 板（sparse）は 敵も 経験値も
	// 少なく、だんだん 離れて いく（離島 B12 で Lv8.0・強さ 12）ので 5 に する（底の 15F で Lv10 ほど）。
	// 数字は 板の 階数を 縮める（2026-09-30）前に 測った もの。LAG は そのまま 使っている
	const LAG = Number(arg("lag", dungeonById(DUNGEON).sparse ? 5 : 2));

	const results = [];
	const seeds = ONE ? [ONE] : Array.from({ length: N }, (_, i) => `sim-${i}`);
	for (const seed of seeds) {
		// いちばん底に 着いたとき（レベル・HP・ターン）と、ボスを 見た ターン
		let bottomAt = null;
		let bossSeenAt = null;
		let run = null;
		// 倒れないか（--god は ずっと、--reach は 目的に たどりつくまで）
		const guarded = () =>
			GOD || (REACH && !run?.s.returning && bossSeenAt === null);
		// 倒れないモード：HP が 0 になる前に満タンにする
		const godify = (r) => {
			if (!GOD && !REACH) return r;
			const orig = r.hurtPlayer.bind(r);
			r.hurtPlayer = (amount, cause) => {
				if (guarded() && r.s.player.hp - amount <= 0) {
					r.s.player.hp = r.s.player.maxHp;
					return false;
				}
				return orig(amount, cause);
			};
			return r;
		};
		run = godify(Run.create(seed, DUNGEON, [], objective));
		const lvAt = {};
		const turnsAt = {};
		let actions = 0;
		let lastDepth = run.s.depth;
		try {
			while (!run.s.end && actions < MAX_ACTIONS) {
				const cmd = botCommand(run, guarded() ? noEscape : botOpts);
				const ev = run.act(cmd);
				actions++;
				if (guarded() && !run.s.end) {
					const p = run.s.player;
					if (p.hunger < 400) p.hunger = 2000;
					if (GOD && p.lv < run.s.depth + 3) run.gainExp(200 * run.s.depth);
					const want = Math.max(1, run.levelAt(run.s.depth) - LAG);
					if (REACH && p.lv < want) run.gainExp(EXP_AT[want - 1] - p.exp);
				}
				if (ONE && !QUIET)
					for (const e of ev)
						if (e.t === "msg")
							console.log(`[B${run.s.depth} T${run.s.turn}] ${e.text}`);
				if (run.s.depth !== lastDepth) {
					lvAt[lastDepth] = run.s.player.lv;
					turnsAt[lastDepth] = run.s.turn;
					lastDepth = run.s.depth;
				}
				if (!bottomAt && run.s.depth >= LAST_DEPTH) {
					const p = run.s.player;
					bottomAt = { lv: p.lv, maxHp: p.maxHp, turn: run.s.turn };
				}
				if (bossSeenAt === null && ev.some((e) => e.t === "boss"))
					bossSeenAt = run.s.turn;
				// ときどき中断セーブを通す（読み直しで壊れないか）
				if (actions % 997 === 0)
					run = godify(new Run(deserializeRun(serializeRun(run.s))));
			}
		} catch (e) {
			failed = true;
			console.error(
				`\n[例外] seed=${seed} actions=${actions} depth=${run.s.depth}`,
			);
			console.error(e);
			if (ONE) break;
			continue;
		}
		const s = run.s;
		const boss = s.floor.boss !== undefined ? run.boss : null;
		results.push({
			bottomAt,
			bossSeenAt,
			bossHp: boss ? `${boss.hp}/${boss.maxHp}` : null,
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
			hunger: s.player.hunger,
		});
	}

	// ───── 集計 ─────
	const n = results.length;
	const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;
	const clears = results.filter((r) => r.end === "clear").length;
	const escapes = results.filter((r) => r.end === "escape").length;
	const stuck = results.filter((r) => r.end === "stuck").length;
	const reached = results.filter((r) => r.depth >= LAST_DEPTH).length;
	console.log(
		`\n${n}回（${objective}${REACH ? `・目的まで 倒れない・強さ − ${LAG}` : ""}）　クリア ${clears}（${pct(clears)}）　最下層まで ${reached}（${pct(reached)}）　止まった ${stuck}${escapes ? `　帰還 ${escapes}（${pct(escapes)}）` : ""}`,
	);
	// いちばん底に 着いた 冒険の うち：fetch は 入口まで 帰れた・boss は ボスに 勝った 割合
	{
		const got = results.filter((r) => r.depth >= LAST_DEPTH);
		const won = got.filter((r) => r.end === "clear").length;
		const rate = got.length ? ((won / got.length) * 100).toFixed(1) : "-";
		const kinds = {};
		for (const r of got)
			if (r.end !== "clear") {
				const k = `${r.end}:${r.cause}`;
				kinds[k] = (kinds[k] ?? 0) + 1;
			}
		const avgOf = (a, f) =>
			a.length ? (a.reduce((x, r) => x + f(r), 0) / a.length).toFixed(1) : "-";
		console.log(
			`最下層から ${objective === "boss" ? "ボスに勝った" : "帰れた"}: ${won}/${got.length}（${rate}%）　着いたとき Lv${avgOf(got, (r) => r.bottomAt?.lv ?? 0)} 最大HP${avgOf(got, (r) => r.bottomAt?.maxHp ?? 0)}`,
		);
		if (objective === "boss") {
			const fights = got.filter((r) => r.bossSeenAt !== null);
			console.log(
				`  ボスを 見た ${fights.length}　見てから 終わるまで 平均 ${avgOf(fights, (r) => r.turn - r.bossSeenAt)}ターン　着いてから 見るまで ${avgOf(fights, (r) => r.bossSeenAt - (r.bottomAt?.turn ?? 0))}ターン`,
			);
		}
		for (const [k, c] of Object.entries(kinds).sort((a, b) => b[1] - a[1]))
			console.log(`  ${c}	${k}`);
		const left = got.filter((r) => r.bossHp).map((r) => r.bossHp);
		if (left.length) console.log(`  負けたときの ボスの HP: ${left.join(" ")}`);
	}
	// 倒れた階
	const byDepth = {};
	for (const r of results)
		if (r.end === "dead")
			byDepth[r.finalDepth] = (byDepth[r.finalDepth] ?? 0) + 1;
	console.log(
		"倒れた階:",
		Object.entries(byDepth)
			.map(([d, c]) => `B${d}:${c}`)
			.join(" "),
	);
	// 死因
	const causes = {};
	for (const r of results)
		if (r.end === "dead") causes[r.cause] = (causes[r.cause] ?? 0) + 1;
	console.log("死因:");
	for (const [c, k] of Object.entries(causes)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 15))
		console.log(`  ${k}\t${c}`);
	// 階ごとのレベル・ターン（着いたとき）
	const rows = [];
	for (let d = 1; d <= LAST_DEPTH; d++) {
		const lv = results
			.filter((r) => r.lvAt[d] !== undefined)
			.map((r) => r.lvAt[d]);
		const tt = results
			.filter((r) => r.turnsAt[d] !== undefined)
			.map((r) => r.turnsAt[d]);
		if (!lv.length) continue;
		const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
		rows.push(`B${d}:Lv${avg(lv)}/T${avg(tt)}(${lv.length})`);
	}
	console.log("階を出たとき:", rows.join("  "));
	const stuckList = results.filter((r) => r.end === "stuck");
	if (stuckList.length)
		console.log(
			"止まった:",
			stuckList
				.slice(0, 8)
				.map((r) => `${r.seed}(B${r.finalDepth}${r.returning ? "↑" : ""})`)
				.join(" "),
		);
	const avg = (k) => (results.reduce((a, r) => a + r[k], 0) / n).toFixed(1);
	console.log(`平均：見た道具 ${avg("seen")}　ターン ${avg("turn")}`);
	const starved = results.filter((r) => r.cause.includes("おなか")).length;
	console.log(`飢え死に ${starved}（${pct(starved)}）`);
} finally {
	await server.close();
}
process.exit(failed ? 1 : 0);
