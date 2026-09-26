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
	const results = [
		...runMonsterTests(),
		...runReplayTests(),
		...runTownTests(),
		...runVillageTests(),
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
