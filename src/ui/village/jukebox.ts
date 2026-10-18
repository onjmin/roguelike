// キリコの 家の レコードの 箱（data/village/myhome.ts の FURNITURE.records）：蓄音機で ためた 曲を かける 窓。
// 最終話（電池板）を 持ち帰って から（data/audio/music.ts の JUKEBOX_AFTER・jukeboxTracks）。
// 曲は この 窓の あいだだけ 鳴り、閉じると もとの 曲に もどる（村の 曲を プレイヤーが かえる 機能は 置かない。BGM.md）。
// - 左に キリコ（歩行グラを 大きく。鳴って いる あいだ 拍で はねて、音符が のぼる）、右に 手（かける／とめる・
//   つぎへ・まえへ・くりかえし・もどる）、下に「番号：曲名」の 札（鳴って いれば ♪）。
// - 十字キーの 上下で 手を えらんで A。左右で 曲を 送る。B で もどる。タップは 手の ボタン。
// - くりかえし「しない」は 1回 鳴りおわったら 次の 曲へ（箱の 並びを 順に 聞ける）。「する」は その 曲を ループ。

import { jukeboxTracks } from "../../data/audio/music";
import { KIRIKO_WALK } from "../../data/people/cast";
import { JUKEBOX_MSG } from "../../data/village/myhome";
import { loadImage } from "../../engine/assets";
import { loadProgress, loadTown } from "../../engine/save";
import { drawWalk } from "../../engine/sprite";
import type { Ctx } from "../ctx";
import { el } from "../dom";
import { markOpened, onTap } from "../list";
import { tick } from "../minigames/minigameBoard";

/** 絵の 大きさ（ソース画素。CSS で 引きのばす）。 */
const W = 120;
const H = 96;
/** キリコの 倍率（16 マスの 何倍）。 */
const SCALE = 4;
/** 拍（ms）。はねる・足踏み・音符の 出る 間。 */
const BEAT_MS = 250;
/** 音符が のぼり きる まで（ms）。 */
const NOTE_MS = 1400;

type Cmd = "play" | "next" | "prev" | "loop" | "back";
const CMDS: readonly Cmd[] = ["play", "next", "prev", "loop", "back"];

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
					}<small>${t.where}</small>`
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
			step(c === "next" ? 1 : -1);
		};

		// ── 絵（キリコが はねる・音符が のぼる） ──
		let running = true;
		const notes: Note[] = [];
		let lastNote = 0;
		const draw = (now: number) => {
			if (!g) return;
			g.clearRect(0, 0, W, H);
			// 地：暗い 紫に ほのかな 床
			g.fillStyle = "#1a1030";
			g.fillRect(0, 0, W, H);
			g.fillStyle = "#2a1c48";
			g.fillRect(0, H - 14, W, 14);
			const beat = (now % BEAT_MS) / BEAT_MS;
			const hop = playing ? Math.round(Math.sin(beat * Math.PI) * 6) : 0;
			const frame = playing ? Math.floor(now / BEAT_MS) % 2 : 0;
			const tile = 16 * SCALE;
			drawWalk(
				g,
				KIRIKO_WALK,
				"down",
				frame,
				(W - tile) / 2,
				H - 14 - tile - hop,
				SCALE,
			);
			if (playing && now - lastNote >= BEAT_MS * 2) {
				lastNote = now;
				notes.push({
					x:
						W / 2 +
						(Math.random() < 0.5 ? -1 : 1) *
							(tile / 2 + 4 + Math.random() * 10),
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
					H - 30 - k * 60,
				);
			}
			g.globalAlpha = 1;
		};
		const animate = async () => {
			await loadImage(KIRIKO_WALK);
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
