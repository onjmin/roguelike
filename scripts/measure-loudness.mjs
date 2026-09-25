// 効果音の大きさ（ラウドネス）を測り、src/data/loudness.ts の SE_LOUDNESS を書き換える（pnpm loudness）。
//
// - data/sfx.ts の効果音（rpgen:<id>）を、ゲームと同じ URL（engine/assets.ts の soundUrl）から取ってくる。
//   取ったファイルは node_modules/.cache/loudness/ に置き、次からはそれを使う（--fresh で取り直す）。
// - ffmpeg でゲームで鳴るときと同じ形（48 kHz・ステレオ。モノラルは L=R）にして、
//   ebur128（EBU R128 / ITU-R BS.1770）で M-max と true peak を測る。
//   M は 400 ms、S は 3 s たまるまで出ないので、末尾に 3 秒の無音を足して測る。
// - L = M-max ＋ 10·log10(400 / 有音 ms)。有音 ms は M-max の窓の中で音が鳴っている時間
//   （10 ms ごとに、大きいほうのチャンネルの RMS が -50 dBFS を超えるか。200〜400 に丸める）。
// - 補正 dB = 区分の目標（data/loudness.ts の SE_TARGET、区分は data/sfx.ts）− L。
//   効果音の音量 100 で true peak が上限を超えない・範囲（SE_DB_RANGE）に収まるように抑える。
// - 鳴り始め・鳴り終わり = 有音（上と同じ -50 dBFS）の最初と最後の 10 ms。
// - 待つ ms = K 特性（BS.1770）のエネルギーの累計が SE_WAIT.share（85 %）に届く 10 ms の終わり。
//   上限は SE_WAIT.maxMs（jingle は jingleMaxMs）、ui は 0（data/loudness.ts の ■ waitMs）。
//
// 使い方: pnpm loudness [--fresh] [--cache <dir>] [--dry-run]
//   --fresh    キャッシュがあっても取り直す
//   --cache    mp3 を置く場所
//   --dry-run  表を出すだけで loudness.ts は書き換えない
// ffmpeg と ffprobe が PATH に要る。

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/data/loudness.ts");
const BEGIN = "// <loudness:se>";
const END = "// </loudness:se>";
const RATE = 48000;
const PAD_SEC = 3;
const HOP = RATE / 100; // 有音を調べる区切り（10 ms）
const ACTIVE_DBFS = -50;

const args = process.argv.slice(2);
const option = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
};
const fresh = args.includes("--fresh");
const dryRun = args.includes("--dry-run");
const cacheDir = resolve(
	option("--cache") ?? join(ROOT, "node_modules/.cache/loudness"),
);

const run = (cmd, argv, binary = false) => {
	const r = spawnSync(cmd, argv, {
		encoding: binary ? "buffer" : "utf8",
		maxBuffer: 1 << 30,
	});
	if (r.error)
		throw new Error(
			`${cmd} を実行できません（PATH に要る）: ${r.error.message}`,
		);
	if (r.status !== 0)
		throw new Error(`${cmd} が失敗しました: ${String(r.stderr).slice(-500)}`);
	return r;
};

const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const log10 = Math.log10;

// ───────── データを読む（Vite の SSR で TS を読む） ─────────

const server = await createServer({
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: "custom",
	logLevel: "error",
	optimizeDeps: { noDiscovery: true, include: [] },
});
let sfx;
let sfxKind;
let conf;
let soundUrl;
try {
	({ sfx, sfxKind } = await server.ssrLoadModule("/src/data/sfx.ts"));
	conf = await server.ssrLoadModule("/src/data/loudness.ts");
	({ soundUrl } = await server.ssrLoadModule("/src/engine/assets.ts"));
} finally {
	await server.close();
}
const { REF_VOLUME, SE_TARGET, SE_DB_RANGE, SE_PEAK_CEILING, SE_WAIT } = conf;

// ───────── 測る ─────────

const ffmpegVersion =
	/ffmpeg version (\S+?)(?:-|\s)/.exec(
		run("ffmpeg", ["-version"]).stdout,
	)?.[1] ?? "?";

const channelsOf = (file) => {
	const { stdout } = run("ffprobe", [
		"-v",
		"error",
		"-select_streams",
		"a:0",
		"-show_entries",
		"stream=channels",
		"-of",
		"json",
		file,
	]);
	const ch = JSON.parse(stdout).streams?.[0]?.channels;
	if (!Number.isInteger(ch))
		throw new Error(`${file}: チャンネル数が読めません`);
	return ch;
};

/** ゲームで鳴るときと同じ形（48 kHz・ステレオ）にするフィルタ。 */
const asPlayed = (channels) =>
	channels === 1
		? `aresample=${RATE},pan=stereo|c0=c0|c1=c0`
		: `aresample=${RATE},aformat=channel_layouts=stereo`;

/** ebur128 の M（100 ms ごと。t はその 400 ms 窓の終わり）と true peak。 */
const ebur128 = (file, channels) => {
	const { stderr } = run("ffmpeg", [
		"-hide_banner",
		"-nostats",
		"-i",
		file,
		"-af",
		`${asPlayed(channels)},apad=pad_dur=${PAD_SEC},ebur128=peak=true:framelog=info`,
		"-f",
		"null",
		"-",
	]);
	const frames = [];
	for (const m of stderr.matchAll(
		/t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+|-?inf|nan)/g,
	)) {
		const M = Number(m[2]);
		if (Number.isFinite(M)) frames.push({ t: Number(m[1]), M });
	}
	const peak = /True peak:\s*[\r\n]+\s*Peak:\s*(-?[\d.]+|-inf)/.exec(stderr);
	if (!frames.length || !peak)
		throw new Error(`${file}: ebur128 の出力が読めません`);
	return { frames, truePeak: peak[1] === "-inf" ? -120 : Number(peak[1]) };
};

/** BS.1770 の K 特性（48 kHz の係数。[b0, b1, b2, a1, a2] の2段）。 */
const K_FILTER = [
	[
		1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241,
		0.73248077421585,
	],
	[1, -2, 1, -1.99004745483398, 0.99007225036621],
];

/** 1チャンネルに K 特性をかける（その場で書き換える）。 */
const kWeight = (x) => {
	for (const [b0, b1, b2, a1, a2] of K_FILTER) {
		let x1 = 0;
		let x2 = 0;
		let y1 = 0;
		let y2 = 0;
		for (let i = 0; i < x.length; i++) {
			const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
			x2 = x1;
			x1 = x[i];
			y2 = y1;
			y1 = y;
			x[i] = y;
		}
	}
};

/**
 * 10 ms ごとに音が鳴っているか（大きいほうのチャンネルの RMS が ACTIVE_DBFS を超えるか）と、
 * 鳴り始め・鳴り終わり・本体の終わり（K 特性のエネルギーの累計が SE_WAIT.share に届く所）。
 */
const activity = (file, channels) => {
	const { stdout } = run(
		"ffmpeg",
		[
			"-hide_banner",
			"-v",
			"error",
			"-i",
			file,
			"-af",
			asPlayed(channels),
			"-f",
			"f32le",
			"-",
		],
		true,
	);
	const pcm = new Float32Array(
		stdout.buffer,
		stdout.byteOffset,
		Math.floor(stdout.byteLength / 4),
	);
	const n = Math.floor(pcm.length / 2);
	const limit = 10 ** (ACTIVE_DBFS / 10); // 平均二乗の閾値
	const kl = new Float64Array(n);
	const kr = new Float64Array(n);
	for (let j = 0; j < n; j++) {
		kl[j] = pcm[2 * j];
		kr[j] = pcm[2 * j + 1];
	}
	kWeight(kl);
	kWeight(kr);
	const active = [];
	const energy = []; // K 特性の平均二乗（左右の和。BS.1770 と同じ重み）
	for (let i = 0; i + HOP <= n; i += HOP) {
		let l = 0;
		let r = 0;
		let k = 0;
		for (let j = i; j < i + HOP; j++) {
			l += pcm[2 * j] ** 2;
			r += pcm[2 * j + 1] ** 2;
			k += kl[j] ** 2 + kr[j] ** 2;
		}
		active.push(Math.max(l, r) / HOP > limit);
		energy.push(k / HOP);
	}
	const first = active.indexOf(true);
	const last = active.lastIndexOf(true);
	const total = energy.reduce((a, b) => a + b, 0);
	let sum = 0;
	let body = energy.length - 1;
	for (let k = 0; k < energy.length; k++) {
		sum += energy[k];
		if (sum >= total * SE_WAIT.share) {
			body = k;
			break;
		}
	}
	return {
		active,
		sec: n / RATE,
		startMs: Math.max(0, first) * 10,
		endMs: (last + 1) * 10,
		bodyMs: (body + 1) * 10,
	};
};

const measure = (file) => {
	const channels = channelsOf(file);
	const { frames, truePeak } = ebur128(file, channels);
	const best = frames.reduce((a, b) => (b.M > a.M ? b : a));
	const { active, sec, startMs, endMs, bodyMs } = activity(file, channels);
	// M-max の窓 [t-0.4, t) の中の有音
	const from = Math.round((best.t - 0.4) * 100);
	const to = Math.round(best.t * 100);
	let activeMs = 0;
	for (let k = Math.max(0, from); k < Math.min(active.length, to); k++)
		if (active[k]) activeMs += 10;
	const shortFix = 10 * log10(400 / Math.min(400, Math.max(200, activeMs)));
	return {
		channels,
		sec,
		mMax: best.M,
		activeMs,
		lufs: best.M + shortFix,
		truePeak,
		startMs,
		endMs,
		bodyMs,
	};
};

const fetchSound = async (id) => {
	const file = join(cacheDir, `${id}.mp3`);
	if (!fresh && existsSync(file)) return file;
	const res = await fetch(soundUrl(id));
	if (!res.ok) throw new Error(`${id}: ${res.status} ${soundUrl(id)}`);
	writeFileSync(file, Buffer.from(await res.arrayBuffer()));
	return file;
};

mkdirSync(cacheDir, { recursive: true });
const byId = new Map();
const rows = [];
let failed = 0;
for (const [name, ref] of Object.entries(sfx)) {
	if (!ref.startsWith("rpgen:")) {
		console.warn(`${name}: RPGEN の素材ではないので測りません（${ref}）`);
		continue;
	}
	const id = ref.slice(6);
	const kind = sfxKind[name];
	const target = SE_TARGET[kind];
	if (target === undefined) {
		console.error(`${name}: 区分 "${kind}" の目標がありません`);
		failed++;
		continue;
	}
	try {
		if (!byId.has(id)) byId.set(id, measure(await fetchSound(id)));
	} catch (e) {
		console.error(`${name}: ${e.message}`);
		failed++;
		continue;
	}
	const m = byId.get(id);
	const lufs = round(m.lufs);
	const peak = round(m.truePeak);
	// 効果音の音量 100 での true peak ≤ 上限
	const peakMax = SE_PEAK_CEILING - peak - 20 * log10(100 / REF_VOLUME.se);
	let db = target - lufs;
	const notes = [];
	if (db > peakMax) {
		db = Math.floor(peakMax * 10) / 10; // 丸めで上限を超えないよう切り下げ
		notes.push("ピーク上限");
	}
	if (db < SE_DB_RANGE.min || db > SE_DB_RANGE.max) {
		db = Math.min(SE_DB_RANGE.max, Math.max(SE_DB_RANGE.min, db));
		notes.push("補正の範囲の端");
	}
	db = round(db) || 0; // -0 を 0 に
	// 音の本体が鳴り終わるまで待つ（メニューの音は待たない。長い音は上限で打ち切る）
	const waitMs =
		kind === "ui"
			? 0
			: Math.min(
					kind === "jingle" ? SE_WAIT.jingleMaxMs : SE_WAIT.maxMs,
					m.bodyMs,
				);
	rows.push({
		name,
		id,
		kind,
		lufs,
		peak,
		db,
		gain: round(10 ** (db / 20), 3),
		result: round(lufs + db),
		waitMs,
		notes,
		m,
	});
}

// ───────── 書き出す ─────────

console.log(
	"名前          区分    秒    ch  M-max 有音ms  L      TP     補正dB  倍率   既定での L  始ms  終ms 本体ms 待つms",
);
for (const r of rows)
	console.log(
		[
			r.name.padEnd(13),
			r.kind.padEnd(7),
			r.m.sec.toFixed(2).padStart(5),
			String(r.m.channels).padStart(3),
			r.m.mMax.toFixed(1).padStart(6),
			String(r.m.activeMs).padStart(5),
			r.lufs.toFixed(1).padStart(6),
			r.peak.toFixed(1).padStart(6),
			r.db.toFixed(1).padStart(7),
			r.gain.toFixed(3).padStart(7),
			r.result.toFixed(1).padStart(7),
			String(r.m.startMs).padStart(8),
			String(r.m.endMs).padStart(5),
			String(r.m.bodyMs).padStart(6),
			String(r.waitMs).padStart(6),
			r.notes.join("・"),
		].join(" "),
	);

if (failed) {
	console.error(
		`${failed} 個の効果音を測れませんでした。loudness.ts は書き換えません。`,
	);
	process.exit(1);
}
if (dryRun) process.exit(0);

const date = new Date().toISOString().slice(0, 10);
const lines = [
	`${BEGIN} ここから下は pnpm loudness（scripts/measure-loudness.mjs）が書き換える。手で直さない。`,
	"/**",
	` * 効果音ごとの実測と補正（${date}、ffmpeg ${ffmpegVersion} の ebur128）。`,
	" * [素材 id, L, true peak, 補正 dB, 倍率, 鳴り始め ms, 鳴り終わり ms, 待つ ms]。",
	" * 行末は「区分 → 既定の設定での L」。",
	" */",
	"export const SE_LOUDNESS: Record<string, SeLoudness> = {",
	...rows.map(
		(r) =>
			`\t${r.name}: ["${r.id}", ${r.lufs}, ${r.peak}, ${r.db}, ${r.gain}, ${r.m.startMs}, ${r.m.endMs}, ${r.waitMs}], // ${r.kind} → ${r.result.toFixed(1)}${r.notes.length ? `（${r.notes.join("・")}）` : ""}`,
	),
	"};",
	END,
];
const src = readFileSync(OUT, "utf8");
const a = src.indexOf(BEGIN);
const b = src.indexOf(END);
if (a < 0 || b < a) {
	console.error(`${OUT} に ${BEGIN} 〜 ${END} がありません`);
	process.exit(1);
}
writeFileSync(
	OUT,
	`${src.slice(0, a)}${lines.join("\n")}${src.slice(b + END.length)}`,
);
console.log(`${rows.length} 個の効果音を ${OUT} に書きました。`);
