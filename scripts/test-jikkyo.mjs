// 束の 実況番組（data/jikkyo/packs.ts）の 試験だけを 回す（src/sim/jikkyoProgTests.ts）。
// node scripts/test-jikkyo.mjs sumo keiba … で その 番組だけ（JK_ONLY と 同じ）。番組を 作る あいだの 速い 確かめ用。
// pnpm test は これも 含めて ぜんぶ 回す。

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ids = process.argv.slice(2);
if (ids.length) process.env.JK_ONLY = ids.join(",");

const server = await createServer({
	root: ROOT,
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: "custom",
	logLevel: "error",
	optimizeDeps: { noDiscovery: true, include: [] },
});

let failed = 0;
try {
	const { runJikkyoProgTests } = await server.ssrLoadModule(
		"/src/sim/jikkyoProgTests.ts",
	);
	const results = await runJikkyoProgTests();
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
