// モンスターの特技と対策・リプレイの試験（pnpm test）。
//
// Vite の SSR で src/sim/monsterTests.ts を読み込み（ビルドせずに TS のまま動かす）、
// 1つずつ「✓ id: 名前」か「✗ id: 名前 — 理由」を出す。1つでも失敗すれば終了コード 1。

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const server = await createServer({
	root: ROOT,
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: "custom",
	logLevel: "error",
	optimizeDeps: { noDiscovery: true, include: [] },
});

let failed = 0;
try {
	const { runMonsterTests } = await server.ssrLoadModule(
		"/src/sim/monsterTests.ts",
	);
	const { runReplayTests } = await server.ssrLoadModule(
		"/src/sim/replayTests.ts",
	);
	const { runTownTests } = await server.ssrLoadModule("/src/sim/townTests.ts");
	const { runVillageTests } = await server.ssrLoadModule(
		"/src/sim/villageTests.ts",
	);
	const { runJikkyoTests } = await server.ssrLoadModule(
		"/src/sim/jikkyoTests.ts",
	);
	const { runJikkyoProgTests } = await server.ssrLoadModule(
		"/src/sim/jikkyoProgTests.ts",
	);
	const { runCivicTests } = await server.ssrLoadModule(
		"/src/sim/civicTests.ts",
	);
	const { runCrowdTests } = await server.ssrLoadModule(
		"/src/sim/crowdTests.ts",
	);
	const { runTrolleyTests } = await server.ssrLoadModule(
		"/src/sim/trolleyTests.ts",
	);
	// 2026-10 の 5つの 寄り道（ホシュクラ・ネタスレ・部室棟・村の 名物・季節の 行事）
	const { runSabaTests } = await server.ssrLoadModule("/src/sim/sabaTests.ts");
	const { runNetaTests } = await server.ssrLoadModule("/src/sim/netaTests.ts");
	const { runArcadeTests } = await server.ssrLoadModule(
		"/src/sim/arcadeTests.ts",
	);
	const { runBushitsuTests } = await server.ssrLoadModule(
		"/src/sim/bushitsuTests.ts",
	);
	const { runFolkTests } = await server.ssrLoadModule("/src/sim/folkTests.ts");
	const { runSeasonTests } = await server.ssrLoadModule(
		"/src/sim/seasonTests.ts",
	);
	const results = [
		...runMonsterTests(),
		...runReplayTests(),
		...runTownTests(),
		...(await runVillageTests()),
		...(await runJikkyoTests()),
		...(await runJikkyoProgTests()),
		...(await runCivicTests()),
		...runCrowdTests(),
		...runTrolleyTests(),
		...(await runSabaTests()),
		...(await runNetaTests()),
		...(await runArcadeTests()),
		...(await runBushitsuTests()),
		...(await runFolkTests()),
		...(await runSeasonTests()),
	];
	for (const t of results)
		console.log(
			t.ok ? `✓ ${t.id}: ${t.name}` : `✗ ${t.id}: ${t.name} — ${t.reason}`,
		);
	failed = results.filter((t) => !t.ok).length;
	console.log(
		`\n${results.length - failed} passed, ${failed} failed (${results.length} tests)`,
	);
} catch (e) {
	console.error(e);
	failed = 1;
} finally {
	await server.close();
}
process.exit(failed ? 1 : 0);
