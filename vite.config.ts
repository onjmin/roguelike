import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "vite";

/**
 * ゲームの中身（src/core）の版：ファイルの中身から作る短い指紋。
 * リプレイに残し、見返すときに今の版とちがえば「ずれるかもしれない」と出す
 * （見た目だけの更新では変わらない）。
 */
const coreVersion = (): string => {
	const dir = join(import.meta.dirname, "src/core");
	const files: string[] = [];
	const walk = (d: string) => {
		for (const e of readdirSync(d, { withFileTypes: true }))
			if (e.isDirectory()) walk(join(d, e.name));
			else if (e.name.endsWith(".ts")) files.push(join(d, e.name));
	};
	walk(dir);
	const h = createHash("sha1");
	for (const f of files.sort()) {
		h.update(f.slice(dir.length).replaceAll("\\", "/"));
		// 改行コードの違い（Windows と Actions）で変わらないように
		h.update(readFileSync(f, "utf8").replaceAll("\r\n", "\n"));
	}
	return h.digest("hex").slice(0, 8);
};

// GitHub Pages（https://onjmin.github.io/roguelike/）ではサブパス配信になる。
export default defineConfig({
	base: process.env.GITHUB_PAGES ? "/roguelike/" : "/",
	plugins: [
		{
			// 開発中に src/core を直したら 設定を読み直す（__CORE_VERSION__ を今の中身に合わせる）
			name: "core-version-restart",
			apply: "serve",
			configureServer(server) {
				const dir = `${join(import.meta.dirname, "src/core").replaceAll("\\", "/")}/`;
				const onFile = (f: string) => {
					if (f.replaceAll("\\", "/").startsWith(dir) && f.endsWith(".ts"))
						void server.restart();
				};
				server.watcher
					.on("change", onFile)
					.on("add", onFile)
					.on("unlink", onFile);
			},
		},
	],
	define: { __CORE_VERSION__: JSON.stringify(coreVersion()) },
	// NO_HMR=1 で自動リロードを止める（テストプレイ中にほかの編集でページが読み直されないように）
	server: process.env.NO_HMR ? { hmr: false, watch: null } : undefined,
	build: {
		outDir: "build",
		target: "es2022",
		// @onjmin/dtm（約 800KB）は最初の音が要るときに動的 import で読む別チャンクなので警告しない
		chunkSizeWarningLimit: 1000,
	},
});
