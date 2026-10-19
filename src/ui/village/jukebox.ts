// キリコの 家の ラジカセ（data/village/myhome.ts の FURNITURE.records）：蓄音機で ためた 曲を かける 窓。
// 最終話（電池板）を 持ち帰って から（data/audio/music.ts の JUKEBOX_AFTER・jukeboxTracks）。
// 曲は この 窓の あいだだけ 鳴り、閉じると もとの 曲に もどる（村の 曲を プレイヤーが かえる 機能は 置かない。BGM.md）。
// - 左に その 曲の 顔（名無し2rt さんの 自作ドット絵。うんJレゼ post/1340。曲で かわる：data/audio/music.ts の songArt。
//   名無し2rt さんの 曲は 鮭、ほかは キリコ。鳴って いる あいだ キリコは 腕を 上げて 歌い、鮭は ゆれながら 拍で はねて、
//   音符が のぼる。止まって いれば キリコは 立って 息を し、鮭は じっと している）、右に 手（かける／とめる・
// - コマ送りは 曲の 拍に 合わせる（うんJレゼの MV と 同じ 決まり：キリコは 8コマで 1拍、鮭は 8コマで 1小節）。
//   拍は 鳴って いる 位置（engine/audio.ts の bgmStep。1拍＝48 ステップ）から。鳴らせない ときは MML の t から 時計で。
//   つぎへ・まえへ・くりかえし・MMLをコピー・もどる）、下に「番号：曲名」の 札（鳴って いれば ♪）。
// - MMLをコピー：その 曲の MML を クリップボードへ。dtm 独自の 所（#宣言・#end;・@@ の 歌声トラック）は 外す（data/audio/music.ts の plainMml）。
// - 十字キーの 上下で 手を えらんで A。左右で 曲を 送る。B で もどる。タップは 手の ボタン。
// - くりかえし「しない」は 1回 鳴りおわったら 次の 曲へ（箱の 並びを 順に 聞ける）。「する」は 鳴りおわったら その 曲を
//   もう 1周（前奏の ある 曲は 前奏を 飛ばす）。切りかえても 鳴って いる 位置は そのまま（鳴りおわった ときに 見る）。

import { bgm as BGM_MML } from "../../data/audio/bgm";
import {
	jukeboxTracks,
	plainMml,
	songArt,
	songBpm,
} from "../../data/audio/music";
import { JUKEBOX_MSG } from "../../data/village/myhome";
import { getImage, loadImage } from "../../engine/assets";
import { loadProgress, loadTown } from "../../engine/save";
import type { Ctx } from "../ctx";
import { el } from "../dom";
import { markOpened, onTap } from "../list";
import { tick } from "../minigames/minigameBoard";

/** 絵の 大きさ（ソース画素。CSS で 引きのばす）。 */
const W = 160;
const H = 116;
/** 床の 高さ（下から）。 */
const FLOOR = 10;
/** ドットの 倍率（64 の コマを 128 に）。 */
const SCALE = 2;
/** 1拍の ステップ（dtm。1小節＝192）。 */
const STEPS_PER_BEAT = 48;
/** コマの 中の 足もと・鮭の 下の 端（ソース画素。シートを 測った 値）。 */
const KIRIKO_FEET = 55;
const SAKE_BOTTOM = 41;
/**
 * キリコの ドット（名無し2rt さん。うんJレゼ post/1340 の「自作ドット絵」）。64x64 の 8コマ × 3段：
 * 0 立って 息を する・1 口を あけて 歌う・2 腕を 上げて 歌う。左向きの まま 描く（キリコは 左右 非対称なので 反転しない）。
 */
const KIRIKO_SHEET = "pub:sprites/jukebox_kiriko.png";
/** 鮭の ドット（同じ 投稿。64x64 の 8コマ：ゆれる）。 */
const SAKE_SHEET = "pub:sprites/jukebox_sake.png";
const CELL = 64;
const FRAMES = 8;
/** 止まって いる ときの キリコの 息の 1コマ（ms）。 */
const IDLE_MS = 400;
/** 音符が のぼり きる まで（ms）。 */
const NOTE_MS = 1400;

type Cmd = "play" | "next" | "prev" | "loop" | "copy" | "back";
const CMDS: readonly Cmd[] = ["play", "next", "prev", "loop", "copy", "back"];
/** コピーの 知らせを 札に 出す 長さ（ms）。 */
const FLASH_MS = 1800;

/** 字を クリップボードへ（navigator.clipboard が 使えなければ 隠した textarea から execCommand）。 */
const copyText = async (text: string): Promise<boolean> => {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// 許可が ない・画面が 隠れて いる：下の 手で
	}
	const ta = document.body.appendChild(el("textarea"));
	ta.value = text;
	ta.style.position = "fixed";
	ta.style.opacity = "0";
	ta.select();
	let ok = false;
	try {
		ok = document.execCommand("copy");
	} catch {
		ok = false;
	}
	ta.remove();
	return ok;
};

type Note = { x: number; at: number; glyph: string };

const fill = (t: string, v: Record<string, string | number>): string =>
	t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

/** ラジカセの 窓を 開く。閉じると もとの 曲に もどして 解決。 */
export const openJukebox = (ctx: Ctx): Promise<void> =>
	new Promise((resolve) => {
		const audio = ctx.audio;
		const list = jukeboxTracks(loadTown().stage, loadProgress().cleared);
		const prev = audio.currentBgm;
		let cur = 0;
		let sel = 0;
		let playing = false;
		let loop = false;
		/** 鳴らしの 世代（止める・送ると 進む。古い 鳴らしの 続きを 捨てる）。 */
		let token = 0;
		let closed = false;
		/** 札の 下の 行に 出す 知らせ（コピーした など。where の かわりに しばらく）。 */
		let flash: string | null = null;
		let flashToken = 0;
		/** いまの 曲の 1拍の 秒（MML の t から。鳴らせない ときの 時計用）。 */
		let secPerBeat = 0.5;
		/** 鳴って いる 位置の 見はり（止まったままなら 時計で 拍を 刻む）。 */
		let lastStep = -1;
		let lastStepAt = 0;
		let clockFrom = 0;

		const box = el("div", { class: "jukebox window" });
		box.appendChild(
			el("div", { class: "jukebox-title", text: JUKEBOX_MSG.title }),
		);
		const canvas = el("canvas", { class: "jukebox-stage" });
		canvas.width = W;
		canvas.height = H;
		box.appendChild(canvas);
		const g = canvas.getContext("2d");
		if (g) g.imageSmoothingEnabled = false;
		const menu = box.appendChild(el("div", { class: "jukebox-menu" }));
		const buttons = CMDS.map((c, i) => {
			const b = el("button", { class: "jukebox-cmd" });
			onTap(b, box, () => {
				sel = i;
				void run(c);
			});
			menu.appendChild(b);
			return b;
		});
		const bar = box.appendChild(el("div", { class: "jukebox-bar" }));

		const render = () => {
			buttons.forEach((b, i) => {
				const c = CMDS[i];
				const label =
					c === "play"
						? playing
							? JUKEBOX_MSG.stop
							: JUKEBOX_MSG.play
						: JUKEBOX_MSG[c];
				b.innerHTML = `<span>${label}</span>${
					c === "loop"
						? `<small>${loop ? JUKEBOX_MSG.loopOn : JUKEBOX_MSG.loopOff}</small>`
						: ""
				}`;
				b.classList.toggle("cur", i === sel);
			});
			const t = list[cur];
			bar.innerHTML = t
				? `${fill(JUKEBOX_MSG.track, { n: cur + 1, title: t.label })}${
						playing ? ' <span class="note">♪</span>' : ""
					}<small>${flash ?? t.where}</small>`
				: "";
		};

		// ── 鳴らす ──
		/** from は 鳴らしはじめる ステップ（0 なら 頭から。前の 曲を 絞って から）。 */
		const play = async (from = 0): Promise<void> => {
			const t = ++token;
			const track = list[cur];
			if (!track) return;
			playing = true;
			secPerBeat = 60 / songBpm(BGM_MML[track.bgm] ?? "");
			lastStep = -1;
			render();
			// 音が 出ない（ミュート・BGM 切）：絵だけ MML の 速さで 動かす（次の 曲へは 進まない）
			if (!audio.bgmEnabled) return;
			if (!from) {
				await audio.fadeBgm(120);
				if (t !== token) return;
			}
			const ended = await audio.playOnce(track.bgm, from);
			if (t !== token) return;
			if (!ended) {
				// 鳴らせない（ミュート・BGM 切）
				playing = false;
				render();
				return;
			}
			// くりかえしは 鳴りおわった ときに 見る（途中で 切りかえても 鳴って いる 位置は そのまま）
			if (loop) {
				void play(audio.loopStep(track.bgm));
				return;
			}
			cur = (cur + 1) % list.length;
			void play();
		};
		const stop = async (): Promise<void> => {
			token++;
			playing = false;
			render();
			await audio.fadeBgm(200);
		};
		const step = (d: number) => {
			if (!list.length) return;
			cur = (cur + d + list.length) % list.length;
			ctx.se("cursor");
			if (playing) void play();
			else render();
		};
		const run = async (c: Cmd): Promise<void> => {
			if (closed) return;
			if (c === "back") {
				close();
				return;
			}
			if (c === "play") {
				if (playing) await stop();
				else await play();
				return;
			}
			if (c === "loop") {
				loop = !loop;
				ctx.se("cursor");
				render();
				return;
			}
			if (c === "copy") {
				await copyMml();
				return;
			}
			step(c === "next" ? 1 : -1);
		};
		/** いまの 曲の MML を コピーして、札に 知らせる。 */
		const copyMml = async (): Promise<void> => {
			const t = list[cur];
			const mml = t && BGM_MML[t.bgm];
			if (!mml) return;
			// dtm 独自の 宣言（#名前=値・#end;）は 外して 貼れる 字に（data/audio/music.ts の plainMml）
			const ok = await copyText(plainMml(mml));
			ctx.se(ok ? "cursor" : "cancel");
			flash = ok ? JUKEBOX_MSG.copied : JUKEBOX_MSG.copyFail;
			const at = ++flashToken;
			render();
			setTimeout(() => {
				if (at !== flashToken || closed) return;
				flash = null;
				render();
			}, FLASH_MS);
		};

		// ── 絵（キリコが 歌い、鮭が はねて、音符が のぼる） ──
		let running = true;
		const notes: Note[] = [];
		let lastNote = 0;
		/** シートの 1コマを (x, y) に 描く（flip で 左右 反転）。 */
		const cell = (
			ref: string,
			col: number,
			row: number,
			x: number,
			y: number,
			flip = false,
		) => {
			const img = getImage(ref);
			if (!img || !g) return;
			const d = CELL * SCALE;
			g.save();
			if (flip) {
				g.translate(x + d, y);
				g.scale(-1, 1);
			} else g.translate(x, y);
			g.drawImage(img, col * CELL, row * CELL, CELL, CELL, 0, 0, d, d);
			g.restore();
		};
		/**
		 * いま 何拍目か（小数）。鳴って いる 位置から。位置が 1秒 動かなければ（ミュート・BGM 切）MML の 速さで 時計から。
		 */
		const beatsNow = (now: number): number => {
			const st = audio.bgmStep;
			if (st !== lastStep) {
				lastStep = st;
				lastStepAt = now;
				clockFrom = now;
			}
			if (now - lastStepAt < 1000) return st / STEPS_PER_BEAT;
			return st / STEPS_PER_BEAT + (now - clockFrom) / 1000 / secPerBeat;
		};
		const draw = (now: number) => {
			if (!g) return;
			g.clearRect(0, 0, W, H);
			// 地：暗い 紫に ほのかな 床
			g.fillStyle = "#1a1030";
			g.fillRect(0, 0, W, H);
			g.fillStyle = "#2a1c48";
			g.fillRect(0, H - FLOOR, W, FLOOR);
			const beats = playing ? beatsNow(now) : 0;
			const inBeat = beats - Math.floor(beats);
			const x = (W - CELL * SCALE) / 2;
			const floor = H - FLOOR;
			if (songArt(list[cur]?.bgm ?? "") === "sake") {
				// 鮭：8コマで 1小節（MV と 同じ）。拍ごとに はねる。止まって いれば 0コマ目で じっと
				const frame = playing ? Math.floor(beats * 2) % FRAMES : 0;
				const hop = playing ? Math.round(Math.sin(inBeat * Math.PI) * 14) : 0;
				cell(SAKE_SHEET, frame, 0, x, floor - SAKE_BOTTOM * SCALE - hop);
			} else {
				// キリコ：8コマで 1拍（MV と 同じ）。4小節に 1小節は 口だけで 歌う 段。止まって いれば ゆっくり 息
				const frame = playing
					? Math.floor(beats * FRAMES) % FRAMES
					: Math.floor(now / IDLE_MS) % FRAMES;
				const row = !playing ? 0 : Math.floor(beats / 4) % 4 === 3 ? 1 : 2;
				cell(KIRIKO_SHEET, frame, row, x, floor - KIRIKO_FEET * SCALE);
			}
			if (playing && inBeat < 0.5 && now - lastNote >= secPerBeat * 1000) {
				lastNote = now;
				notes.push({
					x: W / 2 + (Math.random() - 0.5) * 100,
					at: now,
					glyph: Math.random() < 0.5 ? "♪" : "♫",
				});
			}
			g.font = "12px 'DotGothic16', monospace";
			g.textAlign = "center";
			for (let i = notes.length - 1; i >= 0; i--) {
				const n = notes[i];
				const k = (now - n.at) / NOTE_MS;
				if (k >= 1) {
					notes.splice(i, 1);
					continue;
				}
				g.globalAlpha = 1 - k;
				g.fillStyle = "#ffe060";
				g.fillText(
					n.glyph,
					n.x + Math.sin(k * Math.PI * 2) * 4,
					H - 40 - k * 60,
				);
			}
			g.globalAlpha = 1;
		};
		const animate = async () => {
			await Promise.all([loadImage(KIRIKO_SHEET), loadImage(SAKE_SHEET)]);
			while (running) draw(await tick());
		};

		ctx.ui.appendChild(box);
		markOpened(box);
		render();
		void animate();
		const pop = ctx.input.push(
			(k, repeat) => {
				if (k === "up" || k === "down") {
					sel = (sel + (k === "up" ? CMDS.length - 1 : 1)) % CMDS.length;
					ctx.se("cursor");
					render();
				} else if (k === "left" || k === "right") {
					if (!repeat) step(k === "left" ? -1 : 1);
				} else if (k === "a") {
					if (!repeat) void run(CMDS[sel]);
				} else if (k === "b" && !repeat) close();
			},
			{ tap: null },
		);
		const close = () => {
			if (closed) return;
			closed = true;
			running = false;
			token++;
			pop();
			ctx.se("cancel");
			box.remove();
			void audio.fadeBgm(250).then(() => {
				audio.bgm(prev);
				resolve();
			});
		};
	});
