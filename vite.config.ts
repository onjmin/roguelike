import { defineConfig } from "vite";

// GitHub Pages（https://onjmin.github.io/roguelike/）ではサブパス配信になる。
export default defineConfig({
	base: process.env.GITHUB_PAGES ? "/roguelike/" : "/",
	// NO_HMR=1 で自動リロードを止める（テストプレイ中にほかの編集でページが読み直されないように）
	server: process.env.NO_HMR ? { hmr: false, watch: null } : undefined,
	build: {
		outDir: "build",
		target: "es2022",
		// @onjmin/dtm（約 800KB）は最初の音が要るときに動的 import で読む別チャンクなので警告しない
		chunkSizeWarningLimit: 1000,
	},
});
