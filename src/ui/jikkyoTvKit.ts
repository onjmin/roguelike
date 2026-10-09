// 束の 番組の TV を 作る 部品（ui/jikkyoWatch.ts の 板の 上の キャンバス）。映画館の TV（ui/jikkyoScenes.ts）と 同じ 形：
// 480x270 の 2倍の 下地に 240x135 の 座標で 描く（字が にじまない）。
// - makeTv：絵を 先に 読む（1秒まで 待つ）・合図／判定／完走の 札・場面の 切りかえ・字幕・会場の 枠を まとめる。
//   番組の TV は 会場の 枠（frame）と 場面（scenes：区切りの scene の 鍵 → 描く 手）だけを 書く。
//   場面は スクリーンの 左上を 0,0 に して 描く（スクリーンの 外は 切る）。
// - 枠：crtFrame（部屋の テレビ）・bigFrame（会場の 大画面と 客の 頭）・skyFrame（外。スクリーン＝画面 ぜんぶ）。
// - 場面の 進みは 名目の 時計（TvCtx.lt・t。見えない あいだ 止まる・開発の 速さにも 合う）、点滅は 実際の 時計（now）。
// - 動きを へらす 設定（still）：点滅・ゆれ・飛びちりを 止めて 止まった 絵で 見せる。読めない 絵は 塗りで 描く（止まらない）。

import type { JkCueGrade, JkEv, JkView } from "../core/jikkyo";
import { JK_PROG_TV } from "../data/jikkyo/text";
import { loadImage } from "../engine/assets";
import { blit, hash } from "./cinemaDecor";
import type { SceneTv } from "./jikkyoScenes";
import { clamp01, GRADE_INK, num, numW, person, text } from "./jikkyoScenes";

export { blit, clamp01, GRADE_INK, hash, num, numW, person, text };

export type G = CanvasRenderingContext2D;

/** 場面を 描く ための 中身。 */
export type TvCtx<D = Record<string, unknown>> = {
	/** 区切りの 頭から（名目の ms）。 */
	readonly lt: number;
	/** 番組の 頭から（名目の ms）。 */
	readonly t: number;
	/** 実際の 時計（点滅だけに 使う）。 */
	readonly now: number;
	/** 動きを へらす 設定。 */
	readonly still: boolean;
	/** 本番（再放送・録画は false）。 */
	readonly live: boolean;
	/** 区切りの data（台本の 区切りに 書いた もの）。 */
	readonly data: D;
	readonly imgs: Readonly<Record<string, HTMLImageElement | null>>;
	/** いま 開いて いる 山場の 合図の 実際の 時刻。 */
	readonly pulses: readonly number[];
	readonly v: JkView;
	readonly seg: JkView["seg"];
	/** スクリーンの 幅・高さ。 */
	readonly W: number;
	readonly H: number;
};

export type Screen = {
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
};

export type SceneFn<D = Record<string, unknown>> = (g: G, c: TvCtx<D>) => void;

export type TvSpec<D = Record<string, unknown>> = {
	/** 先に 読む 絵（鍵 → pub:sprites/… など）。 */
	readonly images?: Readonly<Record<string, string>>;
	readonly screen: Screen;
	/** 下地の 色（枠の 外）。 */
	readonly bg?: string;
	/** スクリーンの まわり（場面の あとに 描く。c の W・H は スクリーンの 大きさ、座標は 240x135）。 */
	readonly frame?: SceneFn<D>;
	/** 区切りの scene の 鍵 → 描く 手。 */
	readonly scenes: Readonly<Record<string, SceneFn<D>>>;
	/** scenes に 無い 鍵の ときに 描く 場面（既定は "card"）。 */
	readonly fallback?: string;
	/** 字幕（既定：スクリーンの 下の 黒帯）。false で 出さない、関数なら それで 描く。 */
	readonly caption?: false | ((g: G, c: TvCtx<D>, s: string) => void);
	/** 字幕を 出さない 場面。 */
	readonly noCaption?: readonly string[];
	/** 出来事（合図・判定の ほかに 番組が 見たい とき）。 */
	readonly onEv?: (ev: JkEv, now: number) => void;
};

/** 字幕の 既定（スクリーンの 下の 黒帯に 白い 字）。 */
export const drawCaption = (g: G, c: TvCtx<unknown>, s: string): void => {
	g.fillStyle = "rgba(0, 0, 0, 0.55)";
	g.fillRect(0, c.H - 13, c.W, 13);
	text(g, s, c.W / 2, c.H - 11, 8, "#ffffff");
};

/** 番組の TV（試験が 描ける 場面の 鍵を 見る ため scenes を 持つ）。 */
export type KitTv = ((
	canvas: HTMLCanvasElement,
	opt: { reduced: boolean; live: boolean },
) => SceneTv) & { readonly scenes: readonly string[] };

/** 番組の TV を 作る。 */
export const makeTv = <D = Record<string, unknown>>(spec: TvSpec<D>): KitTv =>
	Object.assign(tvOf(spec), { scenes: Object.keys(spec.scenes) });

const tvOf =
	<D>(spec: TvSpec<D>) =>
	(
		canvas: HTMLCanvasElement,
		opt: { reduced: boolean; live: boolean },
	): SceneTv => {
		canvas.width = 480;
		canvas.height = 270;
		const g0 = canvas.getContext("2d");
		if (!g0) throw new Error("canvas");
		const g = g0;
		const imgs: Record<string, HTMLImageElement | null> = {};
		let pulses: number[] = [];
		let grade: { g: JkCueGrade; at: number } | null = null;
		let kanso: { at: number } | null = null;
		/** 終わった あと（結果カードの あいだ）は 最後の 場面の まま。 */
		let lastSeg: JkView["seg"] = null;
		const still = opt.reduced;
		const sc = spec.screen;
		return {
			load: async () => {
				const keys = Object.keys(spec.images ?? {});
				await Promise.race([
					Promise.all(
						keys.map(async (k) => {
							imgs[k] = await loadImage(spec.images?.[k] ?? "").catch(
								() => null,
							);
						}),
					),
					new Promise((r) => setTimeout(r, 1000)),
				]);
			},
			onEv: (ev, now) => {
				if (ev.t === "open") pulses = [];
				if (ev.t === "pulse") pulses.push(now);
				if (ev.t === "grade") grade = { g: ev.grade, at: now };
				if (ev.t === "kanso") kanso = { at: now };
				spec.onEv?.(ev, now);
			},
			draw: (now, v) => {
				g.setTransform(2, 0, 0, 2, 0, 0);
				g.imageSmoothingEnabled = false;
				g.fillStyle = spec.bg ?? "#120c10";
				g.fillRect(0, 0, 240, 135);
				const seg = v.seg ?? lastSeg;
				lastSeg = seg;
				const c: TvCtx<D> = {
					lt: Math.max(0, v.t - (seg?.start ?? 0)),
					t: v.t,
					now,
					still,
					live: opt.live,
					data: (seg?.data ?? {}) as D,
					imgs,
					pulses,
					v,
					seg,
					W: sc.w,
					H: sc.h,
				};
				const key = seg?.scene ?? "";
				const scene =
					spec.scenes[key] ??
					spec.scenes[spec.fallback ?? "card"] ??
					Object.values(spec.scenes)[0];
				g.save();
				g.translate(sc.x, sc.y);
				g.beginPath();
				g.rect(0, 0, sc.w, sc.h);
				g.clip();
				scene?.(g, c);
				const cap = seg?.caption;
				if (cap && spec.caption !== false && !spec.noCaption?.includes(key))
					(spec.caption ?? drawCaption)(g, c, cap);
				g.restore();
				spec.frame?.(g, c);
				// 山場の 判定・完走の 札
				if (grade && now - grade.at < 1800)
					text(g, JK_PROG_TV.grade[grade.g], 236, 10, 10, GRADE_INK[grade.g], {
						align: "right",
						outline: "#000000",
					});
				if (kanso && now - kanso.at < 2200)
					text(g, JK_PROG_TV.kansoTv, 120, 10, 10, "#ffe060", {
						outline: "#000000",
					});
			},
		};
	};

// ───────────────── 枠 ─────────────────

/** 部屋の テレビ（木の 台・灰色の ふち・つまみ）。 */
export const crtFrame = {
	screen: { x: 30, y: 8, w: 180, h: 104 } as Screen,
	draw: (g: G, c: TvCtx<unknown>): void => {
		const { x, y, w, h } = crtFrame.screen;
		// 壁と 台
		g.fillStyle = "#2a2018";
		g.fillRect(0, 0, x - 6, 135);
		g.fillRect(x + w + 6, 0, 240 - (x + w + 6), 135);
		g.fillStyle = "#5a3e26";
		g.fillRect(0, 124, 240, 11);
		g.fillStyle = "#7a5634";
		g.fillRect(0, 124, 240, 2);
		// ふち
		g.fillStyle = "#3c3a40";
		g.fillRect(x - 6, y - 6, w + 12, 6);
		g.fillRect(x - 6, y + h, w + 12, 14);
		g.fillRect(x - 6, y, 6, h);
		g.fillRect(x + w, y, 6, h);
		g.fillStyle = "#5a5862";
		g.fillRect(x - 6, y - 6, w + 12, 1);
		// つまみと スピーカー
		g.fillStyle = "#1c1c20";
		for (let i = 0; i < 8; i++) g.fillRect(x + 4 + i * 4, y + h + 5, 2, 6);
		g.fillStyle = "#c8c0a8";
		g.fillRect(x + w - 22, y + h + 4, 6, 6);
		g.fillRect(x + w - 12, y + h + 4, 6, 6);
		// 電源の 灯（本番は 赤く 点く）
		g.fillStyle = c.live ? "#ff5040" : "#606060";
		g.fillRect(x + w / 2 - 1, y + h + 6, 2, 2);
		// ガラスの 照り
		g.fillStyle = "rgba(255, 255, 255, 0.06)";
		g.fillRect(x, y, w, 3);
	},
};

const HEADS = [12, 36, 60, 84, 108, 132, 156, 180, 204, 228] as const;

/** 会場の 大画面（電光の ふちと 客の 頭。本番は 客の スマホが 多く 光る、洪水では みんな）。 */
export const bigFrame = {
	screen: { x: 16, y: 6, w: 208, h: 106 } as Screen,
	draw: (g: G, c: TvCtx<unknown>): void => {
		const { x, y, w, h } = bigFrame.screen;
		g.fillStyle = "#0a0a12";
		g.fillRect(0, 0, 240, y - 2);
		g.fillRect(0, 0, x - 2, 135);
		g.fillRect(x + w + 2, 0, 240 - (x + w + 2), 135);
		// 電光の ふち（流れる 点）
		const off = c.still ? 0 : Math.floor(c.now / 120) % 6;
		g.fillStyle = "#2a2a40";
		g.fillRect(x - 2, y - 2, w + 4, 2);
		g.fillRect(x - 2, y + h, w + 4, 2);
		g.fillStyle = "#ffd25a";
		for (let i = -off; i < w + 4; i += 6) {
			g.fillRect(x - 2 + i, y - 2, 2, 2);
			g.fillRect(x + w + 2 - i - 2, y + h, 2, 2);
		}
		HEADS.forEach((hx, i) => {
			const hy = 126 + (i % 2) * 3;
			g.fillStyle = "#08070a";
			g.beginPath();
			g.arc(hx, hy, 9, Math.PI, 0);
			g.fill();
			g.fillRect(hx - 13, hy, 26, 135 - hy);
			const lit = c.v.flood || hash(i, 31) < (c.live ? 0.5 : 0.2);
			if (!lit) return;
			g.globalAlpha = c.still
				? 0.9
				: 0.6 + 0.4 * Math.sin(c.now / 1100 + i * 1.7);
			g.fillStyle = "rgba(120, 190, 255, 0.25)";
			g.fillRect(hx + 3, hy - 4, 8, 5);
			g.fillStyle = "#eaf6ff";
			g.fillRect(hx + 5, hy - 2, 3, 2);
			g.globalAlpha = 1;
		});
	},
};

/** 外（スクリーンが 画面 ぜんぶ。四すみを 少し 暗く する だけ）。 */
export const skyFrame = {
	screen: { x: 0, y: 0, w: 240, h: 135 } as Screen,
	draw: (g: G): void => {
		g.fillStyle = "rgba(0, 0, 0, 0.25)";
		g.fillRect(0, 0, 240, 2);
		g.fillRect(0, 133, 240, 2);
		g.fillRect(0, 0, 2, 135);
		g.fillRect(238, 0, 2, 135);
	},
};

// ───────────────── 場面の 部品 ─────────────────

/** 番組の 札（黒い 地に 題。data.card が あれば その 文）。 */
export const cardScene =
	(
		title: string,
		ink = "#ffffff",
		bg = "#0a0a10",
	): SceneFn<{ card?: string }> =>
	(g, c) => {
		g.fillStyle = bg;
		g.fillRect(0, 0, c.W, c.H);
		const s = c.data.card ?? title;
		const a = c.still ? 1 : clamp01(c.lt / 600);
		g.globalAlpha = a;
		text(g, s, c.W / 2, c.H / 2 - 6, 12, ink);
		g.globalAlpha = 1;
	};

/** 歩行グラの 1コマ（16x16。向きの 行：上 0・右 1・下 2・左 3）。読めなければ 塗りの 人。 */
export const walker = (
	g: G,
	img: HTMLImageElement | null | undefined,
	row: number,
	frame: number,
	x: number,
	y: number,
	k = 1,
	fallback = "#2a3a5a",
): void => {
	if (img) {
		g.drawImage(img, frame * 16, row * 16, 16, 16, x, y, 16 * k, 16 * k);
		return;
	}
	g.fillStyle = fallback;
	g.fillRect(x + 4 * k, y + 3 * k, 8 * k, 12 * k);
};

/** 上から 下への 帯（色の 並び。スクリーン 幅）。 */
export const bands = (
	g: G,
	w: number,
	cols: readonly string[],
	y0: number,
	h: number,
): void => {
	const b = h / cols.length;
	cols.forEach((col, i) => {
		g.fillStyle = col;
		g.fillRect(0, Math.floor(y0 + i * b), w, Math.ceil(b) + 1);
	});
};

/** 合図の 光（山場の 合図ごとに 白く 光って 消える。0〜1）。 */
export const pulseGlow = (c: TvCtx<unknown>, ms = 260): number => {
	if (c.still) return 0;
	const last = c.pulses[c.pulses.length - 1];
	return last === undefined ? 0 : clamp01(1 - (c.now - last) / ms);
};
