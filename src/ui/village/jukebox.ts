// キリコの 家の レコードの 箱（data/village/myhome.ts の FURNITURE.records）：蓄音機で ためた 曲を かける 窓。
// 最終話（電池板）を 持ち帰って から（data/audio/music.ts の JUKEBOX_AFTER・jukeboxTracks）。
// 曲は この 窓の あいだだけ 鳴り、閉じると もとの 曲に もどる（村の 曲を プレイヤーが かえる 機能は 置かない。BGM.md）。
// - 左に その 曲の 顔（名無し2rt さんの 自作ドット絵。うんJレゼ post/1340。曲で かわる：data/audio/music.ts の songArt。
//   名無し2rt さんの 曲は 鮭、ほかは キリコ。鳴って いる あいだ キリコは 腕を 上げて 歌い、鮭は ゆれながら 拍で はねて、
//   音符が のぼる。止まって いれば キリコは 立って 息を し、鮭は じっと している）、右に 手（かける／とめる・
//   つぎへ・まえへ・くりかえし・MMLをコピー・もどる）、下に「番号：曲名」の 札（鳴って いれば ♪）。
// - MMLをコピー：その 曲の MML（data/audio/bgm/*.mml の 字 その まま）を クリップボードへ（dtm に 貼って 聞ける）。
// - 十字キーの 上下で 手を えらんで A。左右で 曲を 送る。B で もどる。タップは 手の ボタン。
// - くりかえし「しない」は 1回 鳴りおわったら 次の 曲へ（箱の 並びを 順に 聞ける）。「する」は その 曲を ループ。

import { bgm as BGM_MML } from "../../data/audio/bgm";
import { jukeboxTracks, plainMml, songArt } from "../../data/audio/music";
import { JUKEBOX_MSG } from "../../data/village/myhome";
import { getImage, loadImage } from "../../engine/assets";
import { loadProgress, loadTown } from "../../engine/save";
import type { Ctx } from "../ctx";
import { el } from "../dom";
import { markOpened, onTap } from "../list";
import { tick } from "../minigames/minigameBoard";

/** 絵の 大きさ（ソース画素。CSS で 引きのばす）。 */
const W = 160;
const H = 100;
/** 床の 高さ（下から）。 */
const FLOOR = 12;
/**
 * キリコの ドット（名無し2rt さん。うんJレゼ post/1340 の「自作ドット絵」）。64x64 の 8コマ × 3段：
 * 0 立って 息を する・1 口を あけて 歌う・2 腕を 上げて 歌う。もとは 左向きなので、右の 手の ほうを 向くよう 左右 反転して 描く。
 */
const KIRIKO_SHEET = "pub:sprites/jukebox_kiriko.png";
/** 鮭の ドット（同じ 投稿。64x64 の 8コマ：ゆれる）。 */
const SAKE_SHEET = "pub:sprites/jukebox_sake.png";
const CELL = 64;
const FRAMES = 8;
/** 拍（ms）。はねる・足踏み・音符の 出る 間。 */
const BEAT_MS = 250;
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

/** レコードの 箱の 窓を 開く。閉じると もとの 曲に もどして 解決。 */
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
		const play = async (): Promise<void> => {
			const t = ++token;
			const track = list[cur];
			if (!track) return;
			playing = true;
			render();
			await audio.fadeBgm(120);
			if (t !== token) return;
			if (loop) {
				audio.bgm(track.bgm);
				return;
			}
			const ended = await audio.playOnce(track.bgm);
			if (t !== token) return;
			if (!ended) {
				// 鳴らせない（ミュート・BGM 切）
				playing = false;
				render();
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
				// 鳴って いる 曲は かけなおす（ループの 有無を 曲の 鳴らし方に 反映する）
				if (playing) void play();
				else render();
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
			g.save();
			if (flip) {
				g.translate(x + CELL, y);
				g.scale(-1, 1);
			} else g.translate(x, y);
			g.drawImage(img, col * CELL, row * CELL, CELL, CELL, 0, 0, CELL, CELL);
			g.restore();
		};
		const draw = (now: number) => {
			if (!g) return;
			g.clearRect(0, 0, W, H);
			// 地：暗い 紫に ほのかな 床
			g.fillStyle = "#1a1030";
			g.fillRect(0, 0, W, H);
			g.fillStyle = "#2a1c48";
			g.fillRect(0, H - FLOOR, W, FLOOR);
			const beat = (now % BEAT_MS) / BEAT_MS;
			const ground = H - FLOOR - CELL + 8;
			const x = (W - CELL) / 2;
			if (songArt(list[cur]?.bgm ?? "") === "sake") {
				// 鮭（鳴って いれば ゆれながら 拍で はねる。止まって いれば じっと）
				const frame = playing ? Math.floor(now / 120) % FRAMES : 0;
				const hop = playing ? Math.round(Math.sin(beat * Math.PI) * 12) : 0;
				cell(SAKE_SHEET, frame, 0, x, ground + 12 - hop);
			} else {
				// キリコ（鳴って いれば 腕を 上げて 歌う コマを 拍で 送り、止まって いれば ゆっくり 息）
				const frame = playing
					? Math.floor(now / BEAT_MS) % FRAMES
					: Math.floor(now / 400) % FRAMES;
				cell(KIRIKO_SHEET, frame, playing ? 2 : 0, x, ground, true);
			}
			if (playing && now - lastNote >= BEAT_MS * 2) {
				lastNote = now;
				notes.push({
					x: W / 2 + (Math.random() - 0.5) * 90,
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
					H - 40 - k * 50,
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
