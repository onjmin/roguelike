// ナイター実況の TV（本館の 実況モニターの 別ゲー。ui/jikkyo.ts の 板の 上の キャンバス）。
// 480x270 の 2倍の 下地に 240x135 の 座標で 描く（字が にじまない）。絵は public/sprites/jikkyo.png（scripts/make-jikkyo.mjs）。
// 胴・帽子・ベルト・ズボンの 差しかえ色を 球団の 色に 置きかえ、球団 × 色ごとの 小さな キャンバスに 覚える。
// 場面：イントロ（イニングスコア）・センターカメラ（投球）・俯瞰（打球と 走者）・札（投手交代・代打・守備固め）・
// 歓喜（本塁打・サヨナラ）・CM・ラッキー7・中継終了と 速報・試合終了の スコアボード。
// 重ね物：スコアボード・アウトと 塁・LIVE・テロップ・逆転などの 箱・『スレ　完走！』。
// 場面の 進みは 名目の 時計（JkView.t。見えない あいだ 止まる・開発の 速さにも 合う）、点滅は 実際の 時計。
// 動きを へらす 設定：点滅なし（箱は 1秒 出しっぱなし）・外枠の 光りなし・花火は 止まった 絵・観客の 手ふりなし。
// 読めない ときは 四角と 字だけで 描く（止まらない）。

import type { JkEv, JkView } from "../core/jikkyo";
import {
	JK_MS,
	type JkBases,
	type JkGame,
	type JkPlay,
	type JkTeamId,
} from "../core/jikkyoYakyu";
import {
	batterTelop,
	fanColor,
	JK_TELOP,
	JK_TV,
	sokuhoOf,
	teamChar,
	type YData,
} from "../data/jikkyo/yakyu";
import { JK_TEAMS } from "../data/jikkyo/yakyuRoster";
import { JK_KEY, JK_SHEET, JK_SPR } from "../data/jikkyoSheet";
import { loadImage } from "../engine/assets";

type Spr = keyof typeof JK_SPR;
type Colors = Partial<Record<keyof typeof JK_KEY, string>>;
type Pt = readonly [number, number];

export type YakyuTv = {
	/** 絵と 字を 先に 読む（1秒まで 待つ）。 */
	load(): Promise<void>;
	onEv(ev: JkEv, now: number): void;
	draw(now: number, v: JkView): void;
};

const FONT = (px: number) => `${px}px 'DotGothic16', monospace`;
const YELLOW = "#ffe060";

/** 色を 明るく（ビジターの ズボン）。 */
const lighten = (hex: string, k = 0.35): string => {
	const c = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
	return `#${c
		.map((v) =>
			Math.round(v + (255 - v) * k)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
};

const rgbOf = (hex: string): [number, number, number] => [
	Number.parseInt(hex.slice(1, 3), 16),
	Number.parseInt(hex.slice(3, 5), 16),
	Number.parseInt(hex.slice(5, 7), 16),
];

// 俯瞰の 位置（SPEC の 座標）
const HOME: Pt = [120, 124];
const BASES: readonly Pt[] = [
	[164, 100],
	[120, 78],
	[76, 100],
];
const FIELD: Readonly<Record<string, Pt>> = {
	投: [120, 96],
	捕: [120, 130],
	一: [160, 94],
	二: [140, 82],
	遊: [100, 82],
	三: [80, 94],
	左: [64, 52],
	中: [120, 40],
	右: [176, 52],
};
const DIR_X = { レフト: 0, センター: 1, ライト: 2 } as const;
const SHALLOW: readonly Pt[] = [
	[76, 64],
	[120, 56],
	[164, 64],
];
const DEEP: readonly Pt[] = [
	[52, 40],
	[120, 32],
	[188, 40],
];
const CORNER: readonly Pt[] = [
	[24, 46],
	[120, 30],
	[216, 46],
];
const OVER: readonly Pt[] = [
	[40, 10],
	[120, 6],
	[200, 10],
];

const IN_PLAY = new Set([
	"1B",
	"2B",
	"3B",
	"HR",
	"E",
	"GO",
	"FO",
	"dp",
	"sacfly",
	"fine",
	"laser",
	"request",
]);
const CARD = new Set([
	"closer",
	"relief",
	"reliefN",
	"pinch",
	"pinchN",
	"defsub",
]);

/** 投球の 時間割（ms）：セット 0〜250・足を 上げる 〜500・はなして 本塁まで。 */
const RELEASE = 500;
const flightOf = (velo = 3) => 420 + (5 - velo) * 90;

/** 決め打ちの 乱数（観客の 並び）。 */
const lcg = (seed: string) => {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++)
		h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
	return () => {
		h = (Math.imul(h, 1103515245) + 12345) | 0;
		return ((h >>> 0) % 100000) / 100000;
	};
};

export const yakyuTv = (
	canvas: HTMLCanvasElement,
	game: JkGame,
	opt: { reduced: boolean },
): YakyuTv => {
	canvas.width = 480;
	canvas.height = 270;
	const g0 = canvas.getContext("2d");
	if (!g0) throw new Error("canvas");
	const g = g0;
	let img: HTMLImageElement | null = null;
	const cache = new Map<string, HTMLCanvasElement>();
	const fans = fanColor(game.home, game.away);
	const fanOf = (id: JkTeamId) => (id === game.home ? fans.home : fans.away);
	const uniOf = (id: JkTeamId): Colors => {
		const c = JK_TEAMS[id].colors;
		return id === game.home
			? { body: c.body, cap: c.cap, trim: c.trim, pants: "#f4f2ea" }
			: { body: c.away, cap: c.cap, trim: c.trim, pants: lighten(c.away) };
	};
	// 観客の 並び（スタンドの 行ごとに 60%）
	const rnd = lcg(game.seed);
	const crowdAt = (rows: readonly number[]) =>
		rows.flatMap((y) =>
			Array.from({ length: 15 }, (_, i) => i).flatMap((i) =>
				rnd() < 0.6 ? [{ x: i * 16, y }] : [],
			),
		);
	const crowdPitch = crowdAt([10, 18, 26]);
	const crowdField = crowdAt([0, 8, 16]);
	const crowdJoy = crowdAt([
		0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 128,
	]);
	const balloons = Array.from({ length: 14 }, () => ({
		x: Math.floor(rnd() * 232) + 4,
		d: rnd() * 0.5,
		home: rnd() < 0.5,
	}));
	const sparks = Array.from({ length: 5 }, () => ({
		x: 20 + Math.floor(rnd() * 200),
		y: 8 + Math.floor(rnd() * 50),
		d: rnd(),
	}));

	// 場面の 状態
	let sceneAt = 0;
	let data: YData | null = null;
	let openAt = -1e9;
	let kansoAt = -1e9;

	/** 絵の 1枚（差しかえ色つき。球団 × 色ごとに 覚える）。 */
	const sheet = (spr: Spr, colors?: Colors): CanvasImageSource | null => {
		if (!img) return null;
		const key = `${spr}|${colors ? JSON.stringify(colors) : ""}`;
		const hit = cache.get(key);
		if (hit) return hit;
		const s = JK_SPR[spr];
		const cv = document.createElement("canvas");
		cv.width = s.w * s.n;
		cv.height = s.h;
		const c = cv.getContext("2d", { willReadFrequently: true });
		if (!c) return null;
		c.drawImage(img, s.x, s.y, s.w * s.n, s.h, 0, 0, s.w * s.n, s.h);
		if (colors) {
			const d = c.getImageData(0, 0, cv.width, cv.height);
			const swaps = (Object.keys(JK_KEY) as (keyof typeof JK_KEY)[]).flatMap(
				(k) => {
					const to = colors[k];
					return to ? [{ from: JK_KEY[k], to: rgbOf(to) }] : [];
				},
			);
			for (let i = 0; i < d.data.length; i += 4) {
				if (d.data[i + 3] === 0) continue;
				for (const sw of swaps)
					if (
						d.data[i] === sw.from[0] &&
						d.data[i + 1] === sw.from[1] &&
						d.data[i + 2] === sw.from[2]
					) {
						d.data[i] = sw.to[0];
						d.data[i + 1] = sw.to[1];
						d.data[i + 2] = sw.to[2];
						break;
					}
			}
			c.putImageData(d, 0, 0);
		}
		cache.set(key, cv);
		return cv;
	};

	/** 絵を 置く（k は コマ、flip は 左右反転、scale は 倍）。 */
	const put = (
		spr: Spr,
		k: number,
		x: number,
		y: number,
		colors?: Colors,
		flip = false,
		scale = 1,
	): void => {
		const s = JK_SPR[spr];
		const src = sheet(spr, colors);
		const w = s.w * scale;
		const h = s.h * scale;
		if (!src) {
			g.fillStyle = colors?.body ?? "#888";
			g.fillRect(Math.round(x), Math.round(y), w, h);
			return;
		}
		const fx = Math.round(x);
		const fy = Math.round(y);
		if (flip) {
			g.save();
			g.translate(fx + w, fy);
			g.scale(-1, 1);
			g.drawImage(src, (k % s.n) * s.w, 0, s.w, s.h, 0, 0, w, h);
			g.restore();
		} else g.drawImage(src, (k % s.n) * s.w, 0, s.w, s.h, fx, fy, w, h);
	};

	const text = (
		s: string,
		x: number,
		y: number,
		color = "#ffffff",
		px = 10,
		align: CanvasTextAlign = "left",
	) => {
		g.font = FONT(px);
		g.textAlign = align;
		g.textBaseline = "alphabetic";
		g.fillStyle = color;
		g.fillText(s, x, y);
	};

	const digits = (n: number, x: number, y: number, yellow = false, pad = 1) => {
		const s = String(n).padStart(pad, " ");
		[...s].forEach((ch, i) => {
			if (ch === " ") return;
			put(yellow ? "digitY" : "digitW", Number(ch), x + i * 6, y);
		});
	};

	const hot = (): boolean => {
		if (!data) return false;
		const k = data.play?.kind;
		return (
			data.kind === "window" ||
			data.kind === "joy" ||
			k === "lucky7" ||
			k === "HR" ||
			(data.play?.runs ?? 0) > 0
		);
	};

	const crowd = (
		cells: readonly { x: number; y: number }[],
		now: number,
		dy = 0,
	) => {
		const wave = !opt.reduced && hot() ? Math.floor(now / 300) % 2 : 0;
		for (const c of cells) {
			const home = c.x >= 120;
			put("crowd", wave, c.x, c.y + dy, { body: home ? fans.home : fans.away });
		}
	};

	// ───────────────── 場面 ─────────────────

	const batSide = (d: YData): JkTeamId => (d.top ? game.away : game.home);
	const fldSide = (d: YData): JkTeamId => (d.top ? game.home : game.away);

	/** センターカメラ。pitch は 投球の 進み（null は 止まって いる）。 */
	const center = (
		d: YData,
		now: number,
		p: { t: number; play: JkPlay } | null,
	) => {
		put("bgPitch", 0, 0, 0);
		crowd(crowdPitch, now);
		put("umpire", 0, 114, 46);
		const fld = uniOf(fldSide(d));
		put("catcher", 0, 114, 56, fld);
		const left = p?.play.bats === "左";
		const bat = uniOf(batSide(d));
		let swing = 0;
		let ball: { x: number; y: number; r: number } | null = null;
		let pf = 0;
		if (p) {
			const fl = flightOf(p.play.velo);
			const arrive = RELEASE + fl;
			pf = p.t < 250 ? 0 : p.t < RELEASE ? 1 : 2;
			const k = p.play.kind;
			const swings = (k === "K" && !p.play.look) || IN_PLAY.has(k);
			if (swings && p.t >= arrive - 60) swing = 1;
			if (p.t >= RELEASE && p.t < arrive) {
				const f = (p.t - RELEASE) / fl;
				let x = 122 + (120 - 122) * f;
				let y = 110 + (62 - 110) * f;
				const late = Math.max(0, (f - 0.75) / 0.25);
				const side = left ? -1 : 1;
				switch (p.play.pitch) {
					case "フォーク":
					case "スプリット":
					case "チェンジアップ":
						y += 6 * late;
						break;
					case "カーブ":
					case "ナックルカーブ":
						y += -6 * Math.sin(f * Math.PI) + 10 * late;
						break;
					case "スライダー":
					case "カット":
						x += 6 * late * side;
						break;
					case "ツーシーム":
					case "シンカー":
						x -= 4 * late * side;
						break;
				}
				ball = { x, y, r: f < 0.4 ? 4 : f < 0.75 ? 3 : 2 };
			}
		}
		put("batter", swing, left ? 127 : 101, 48, bat, left);
		if (ball) {
			const spr = ball.r === 4 ? "ball4" : ball.r === 3 ? "ball3" : "ball2";
			put(spr, 0, ball.x - ball.r / 2, ball.y - ball.r / 2);
		}
		put("pitcher", pf, 112, 108, fld);
	};

	/** 俯瞰（f は 打球の 進み 0〜1）。 */
	const overhead = (d: YData, play: JkPlay, f: number, now: number) => {
		put("bgField", 0, 0, 0);
		crowd(crowdField, now);
		const fld = uniOf(fldSide(d));
		const bat = uniOf(batSide(d));
		const k = play.kind;
		const di = DIR_X[play.dir ?? "センター"];
		const posPt = FIELD[play.pos ?? "二"] ?? FIELD.二;
		const target: Pt =
			k === "HR"
				? OVER[di]
				: k === "3B"
					? CORNER[di]
					: k === "2B"
						? DEEP[di]
						: k === "1B" || k === "laser"
							? k === "laser"
								? (FIELD[play.pos ?? "中"] ?? SHALLOW[di])
								: SHALLOW[di]
							: posPt;
		const fly =
			k === "FO" ||
			k === "sacfly" ||
			k === "HR" ||
			k === "2B" ||
			k === "3B" ||
			k === "fine" ||
			k === "laser";
		const bf = Math.min(1, f / 0.7);
		const bx = HOME[0] + (target[0] - HOME[0]) * bf;
		const by = HOME[1] + (target[1] - HOME[1]) * bf;
		const lift = fly ? Math.sin(bf * Math.PI) * (k === "HR" ? 40 : 24) : 0;
		// 野手（いちばん 近い 1人が 打球へ）
		const near = Object.entries(FIELD).reduce((a, b) =>
			Math.hypot(b[1][0] - target[0], b[1][1] - target[1]) <
			Math.hypot(a[1][0] - target[0], a[1][1] - target[1])
				? b
				: a,
		)[0];
		for (const [pos, pt] of Object.entries(FIELD)) {
			let [x, y] = pt;
			if (pos === near && k !== "HR") {
				x += (target[0] - x) * Math.min(1, f * 1.2);
				y += (target[1] - y) * Math.min(1, f * 1.2);
			}
			put(
				"fielder",
				pos === near && f < 1 ? Math.floor(now / 150) % 2 : 0,
				x - 3,
				y - 8,
				fld,
			);
		}
		// 走者（塁の 進みは だいたいで 見せる）
		const adv = k === "HR" ? 4 : k === "3B" ? 3 : k === "2B" ? 2 : 1;
		const path = (from: number, to: number, q: number): Pt => {
			const pts: Pt[] = [HOME, ...BASES, HOME];
			const u = from + (to - from) * q;
			const i = Math.min(3, Math.floor(u));
			const r = u - i;
			const a = pts[i];
			const b = pts[i + 1];
			return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r];
		};
		const before = play.before ?? [false, false, false];
		const runners: { from: number; to: number }[] = [];
		before.forEach((on, i) => {
			if (on) runners.push({ from: i + 1, to: Math.min(4, i + 1 + adv) });
		});
		if (
			k !== "GO" &&
			k !== "FO" &&
			k !== "dp" &&
			k !== "fine" &&
			k !== "request"
		)
			runners.push({ from: 0, to: Math.min(4, adv) });
		const q = Math.min(1, f * 1.1);
		for (const r of runners) {
			if (r.to >= 4 && q >= 1) continue;
			const [x, y] = path(r.from, r.to, q);
			put("runner", Math.floor(now / 120) % 2, x - 3, y - 8, bat);
		}
		// 打球と 影
		if (!(k === "HR" && bf >= 1)) {
			put("shadow", 0, bx - 2, by - 1);
			put(fly ? "ball3" : "ball2", 0, bx - 1, by - 1 - lift);
		}
	};

	const card = (play: JkPlay, d: YData) => {
		const side =
			play.kind === "pinch" || play.kind === "pinchN" ? batSide(d) : fldSide(d);
		const cap = JK_TEAMS[side].colors.cap;
		const grad = g.createLinearGradient(0, 0, 240, 135);
		grad.addColorStop(0, cap);
		grad.addColorStop(1, "#0a0a14");
		g.fillStyle = grad;
		g.fillRect(0, 0, 240, 135);
		const batter = play.kind === "pinch" || play.kind === "pinchN";
		put(
			batter ? "bustBatter" : "bustPitcher",
			0,
			20,
			40,
			uniOf(side),
			false,
			2,
		);
		const words = (d.telop ?? "").split("　");
		const l1 = words[0] ?? "";
		const l2 = words.slice(1).join("　") || "名無し";
		text(l1, 84, 66, "#ffffff", 12);
		text(l2, 84, 84, YELLOW, 12);
	};

	const joy = (d: YData, now: number) => {
		g.fillStyle = "#10241a";
		g.fillRect(0, 0, 240, 135);
		const side = batSide(d);
		for (const c of crowdJoy)
			put("crowd", opt.reduced ? 0 : Math.floor(now / 300) % 2, c.x, c.y, {
				body: fanOf(side),
			});
		for (const s of sparks) {
			const k = opt.reduced ? 0 : Math.floor(now / 250 + s.d * 4) % 2;
			put("fireworks", k, s.x, s.y);
		}
		put(
			"joy",
			opt.reduced ? 0 : Math.floor(now / 300) % 2,
			108,
			88,
			uniOf(side),
		);
	};

	const cm = () => {
		if (img) {
			const s = JK_SPR.cm;
			g.drawImage(img, s.x, s.y, s.w, s.h, 0, 0, 240, 135);
		} else {
			g.fillStyle = "#202030";
			g.fillRect(0, 0, 240, 135);
		}
		g.fillStyle = "rgba(0,0,0,0.6)";
		g.fillRect(96, 54, 48, 22);
		text(JK_TELOP.cm, 120, 70, "#ffffff", 12, "center");
	};

	const lucky7 = (d: YData, now: number, segT: number) => {
		center(d, now, null);
		for (const b of balloons) {
			const f = (segT / 1500 + b.d) % 1.4;
			const y = 135 - f * 140;
			put("balloon", Math.floor(now / 200 + b.x) % 3, b.x, y, {
				body: b.home ? fans.home : fans.away,
			});
		}
	};

	const lineTable = (y0: number, upTo: number, full: boolean) => {
		const [la, lh] = full ? game.line : game.pre.line;
		const cols = Math.max(9, full ? Math.max(la.length, lh.length) : 9);
		const cw = cols > 9 ? 12 : 14;
		const x0 = 120 - ((cols + 1) * cw + 18) / 2;
		g.fillStyle = "rgba(0,0,0,0.55)";
		g.fillRect(x0 - 4, y0 - 2, (cols + 1) * cw + 26, 34);
		g.strokeStyle = "rgba(255,255,255,0.25)";
		g.strokeRect(x0 - 3.5, y0 - 1.5, (cols + 1) * cw + 25, 33);
		for (let i = 0; i < cols; i++)
			digits(i + 1, x0 + 18 + i * cw + (i + 1 >= 10 ? 1 : 4), y0, false);
		text(JK_TV.total, x0 + 18 + cols * cw + 2, y0 + 8, "#ffffff");
		const rows: [JkTeamId, readonly number[]][] = [
			[game.away, la],
			[game.home, lh],
		];
		rows.forEach(([id, ln], r) => {
			const y = y0 + 11 + r * 11;
			g.fillStyle = fanOf(id);
			g.fillRect(x0, y, 3, 8);
			text(teamChar(id), x0 + 5, y + 8);
			for (let i = 0; i < Math.min(upTo, ln.length); i++)
				digits(ln[i] ?? 0, x0 + 18 + i * cw + 4, y + 1, false);
			const tot = ln.slice(0, upTo).reduce((s, x) => s + x, 0);
			digits(tot, x0 + 18 + cols * cw + 1, y + 1, true, 2);
		});
	};

	const intro = () => {
		g.fillStyle = "#10241a";
		g.fillRect(0, 0, 240, 135);
		g.fillStyle = "#fff6c0";
		for (const x of [20, 60, 180, 220]) g.fillRect(x - 1, 4, 3, 2);
		text(JK_TV.title, 120, 30, "#ffffff", 12, "center");
		lineTable(48, 6, false);
	};

	const finalCard = () => {
		g.fillStyle = "#0a1410";
		g.fillRect(0, 0, 240, 135);
		text(fillTelop(JK_TELOP.gameset), 120, 34, YELLOW, 12, "center");
		lineTable(52, 99, true);
	};

	const fillTelop = (s: string) => {
		const [a, h] = game.final;
		return s
			.replace("{home}", teamChar(game.home))
			.replace("{away}", teamChar(game.away))
			.replace("{h}", String(h))
			.replace("{a}", String(a));
	};

	const chukei = (since: number) => {
		g.fillStyle = "#000000";
		g.fillRect(0, 0, 240, 135);
		if (since < 1200) text(JK_TELOP.chukei, 120, 72, "#ffffff", 12, "center");
		else sokuho();
	};

	const sokuho = () => {
		g.fillStyle = "#0a1030";
		g.fillRect(0, 0, 240, 135);
		g.fillStyle = "#c81e1e";
		g.fillRect(0, 40, 240, 18);
		text(sokuhoOf(game), 120, 53, "#ffffff", 12, "center");
		lineTable(70, 99, true);
	};

	const halfCard = (d: YData) => {
		g.fillStyle = "rgba(8,10,20,0.78)";
		g.fillRect(40, 50, 160, 28);
		g.fillStyle = fanOf(batSide(d));
		g.fillRect(40, 50, 160, 2);
		const s = JK_TV.half
			.replace("{inn}", String(d.inn))
			.replace("{tb}", d.top ? JK_TV.top : JK_TV.bottom);
		text(`${s}　${teamChar(batSide(d))}`, 120, 69, "#ffffff", 12, "center");
	};

	// ───────────────── 重ね物 ─────────────────

	const scoreboard = (d: YData, score: readonly [number, number]) => {
		g.fillStyle = "rgba(0,0,0,0.62)";
		g.fillRect(2, 2, 66, 22);
		g.strokeStyle = "rgba(255,255,255,0.25)";
		g.strokeRect(2.5, 2.5, 65, 21);
		const rows: [JkTeamId, number, number][] = [
			[game.away, score[0], 4],
			[game.home, score[1], 13],
		];
		for (const [id, s, y] of rows) {
			g.fillStyle = fanOf(id);
			g.fillRect(4, y, 3, 8);
			text(teamChar(id), 9, y + 8);
			const lead = s > (id === game.home ? score[0] : score[1]);
			digits(s, 24, y + 1, lead, 2);
		}
		digits(d.inn, 46, 9, false, 2);
		put(d.top ? "topMark" : "botMark", 0, 58, 10);
	};

	const outsBases = (outs: number, bases: JkBases) => {
		g.fillStyle = "rgba(0,0,0,0.62)";
		g.fillRect(180, 2, 58, 22);
		g.strokeStyle = "rgba(255,255,255,0.25)";
		g.strokeRect(180.5, 2.5, 57, 21);
		const at: Pt[] = [
			[192, 10],
			[188, 6],
			[184, 10],
		];
		at.forEach(([x, y], i) => {
			put(bases[i] ? "baseOn" : "baseEmpty", 0, x, y);
		});
		put("outText", 0, 202, 7);
		put(outs >= 1 ? "lampOn" : "lampOff", 0, 215, 7);
		put(outs >= 2 ? "lampOn" : "lampOff", 0, 222, 7);
	};

	const telop = (s: string, color: string, side: JkTeamId) => {
		g.fillStyle = "rgba(8,10,20,0.8)";
		g.fillRect(0, 120, 240, 15);
		g.fillStyle = fanOf(side);
		g.fillRect(0, 120, 240, 2);
		text(s, 7, 131, color);
	};

	const bigBox = (word: string, since: number) => {
		const on = opt.reduced
			? since < 1000
			: since < 1000 && Math.floor(since / 250) % 2 === 0;
		if (!on) return;
		g.fillStyle = YELLOW;
		g.fillRect(84, 96, 72, 16);
		text(word, 120, 108, "#1a1a1a", 12, "center");
	};

	const bezel = (now: number) => {
		g.fillStyle = "#2a2a30";
		g.fillRect(0, 0, 240, 1);
		g.fillRect(0, 134, 240, 1);
		g.fillRect(0, 0, 1, 135);
		g.fillRect(239, 0, 1, 135);
		if (img) {
			put("gloss", 0, 1, 1);
			put("gloss", 0, 233, 1, undefined, true);
		}
		if (!opt.reduced && now - openAt < 300) {
			g.strokeStyle = YELLOW;
			g.lineWidth = 2;
			g.strokeRect(1, 1, 238, 133);
			g.lineWidth = 1;
		}
		if (now - kansoAt < 2000) {
			g.fillStyle = YELLOW;
			g.fillRect(154, 36, 82, 14);
			text(JK_TELOP.kanso, 195, 47, "#1a1a1a", 10, "center");
		}
	};

	// ───────────────── 1コマ ─────────────────

	const prevOf = (play: JkPlay): readonly [number, number] => {
		const r = play.runs ?? 0;
		return play.top
			? [play.score[0] - r, play.score[1]]
			: [play.score[0], play.score[1] - r];
	};

	const draw = (now: number, v: JkView) => {
		g.setTransform(2, 0, 0, 2, 0, 0);
		g.imageSmoothingEnabled = false;
		const d = (v.seg?.data as YData | undefined) ?? data;
		if (!d) {
			g.fillStyle = "#10241a";
			g.fillRect(0, 0, 240, 135);
			bezel(now);
			return;
		}
		const segT = v.seg ? Math.max(0, v.t - v.seg.start) : 0;
		const dur = v.seg?.dur ?? 1;
		const since = now - sceneAt;
		const play = d.play;
		let score = d.score;
		let outs = d.outs;
		let bases = d.bases;
		let tel: { s: string; c: string } | null = null;
		let overlays = true;
		const kind = play?.kind;
		if (
			d.kind === "intro" ||
			(d.kind === "window" && d.winTop === "suretate")
		) {
			intro();
			overlays = false;
			tel = { s: JK_TELOP.intro, c: "#ffffff" };
		} else if (d.kind === "start") {
			center(d, now, null);
			const [a, h] = game.pre.score;
			const pre = JK_TELOP.pre
				.replace("{home}", teamChar(game.home))
				.replace("{away}", teamChar(game.away))
				.replace("{h}", String(h))
				.replace("{a}", String(a));
			tel = { s: segT < 800 ? pre : JK_TELOP.intro, c: "#ffffff" };
		} else if (d.kind === "half") {
			center(d, now, null);
			halfCard(d);
		} else if (d.kind === "change") {
			center(d, now, null);
		} else if (d.kind === "chukei" || d.winTop === "chukei") {
			// 中継終了の 窓は もう 速報の 札
			chukei(d.kind === "chukei" ? since : 9999);
			overlays = false;
		} else if (d.kind === "flood") {
			if (d.cut) sokuho();
			else finalCard();
			overlays = false;
		} else if (d.kind === "joy") {
			joy(d, now);
			tel = { s: d.telop ?? "", c: YELLOW };
		} else if (play && kind === "gameset") {
			if (d.cut) sokuho();
			else finalCard();
			overlays = false;
		} else if (play && kind === "cm") {
			cm();
			overlays = false;
		} else if (play && kind === "lucky7") {
			lucky7(d, now, d.kind === "window" ? since : segT);
			tel = { s: d.telop ?? "", c: YELLOW };
		} else if (play && CARD.has(kind ?? "")) {
			card(play, d);
		} else if (play && d.kind === "window") {
			if (d.winTop === "HR" || d.winTop === "walkoff") joy(d, now);
			else if (IN_PLAY.has(play.kind)) overhead(d, play, 1, now);
			else if (play.kind === "steal" || play.kind === "caught")
				overhead(
					d,
					{
						...play,
						kind: "1B",
						before: [true, false, false],
						dir: "センター",
					},
					1,
					now,
				);
			else center(d, now, { t: 9999, play });
			tel = { s: d.telop ?? "", c: YELLOW };
		} else if (play?.pa) {
			const fast = dur <= JK_MS.fast;
			const arrive = RELEASE + flightOf(play.velo);
			const done = fast ? segT >= 300 : segT >= arrive;
			if (!done) {
				score = prevOf(play);
				outs = play.outsBefore ?? outs;
				bases = play.before ?? bases;
			}
			if (fast) center(d, now, null);
			else if (IN_PLAY.has(play.kind) && segT >= arrive + 200) {
				const f = Math.min(
					1,
					(segT - arrive - 200) / Math.max(400, dur - arrive - 400),
				);
				if (play.kind === "HR" && f >= 0.7) joy(d, now);
				else overhead(d, play, f, now);
			} else center(d, now, { t: segT, play });
			tel = done
				? { s: d.telop ?? "", c: YELLOW }
				: { s: batterTelop(play), c: "#ffffff" };
		} else if (play && (kind === "steal" || kind === "caught")) {
			const fake: JkPlay = {
				...play,
				kind: "1B",
				before: [true, false, false],
				dir: "センター",
			};
			overhead(d, fake, Math.min(1, segT / dur), now);
			if (segT < dur * 0.8) {
				outs = play.outsBefore ?? outs;
				bases = play.before ?? bases;
			}
			tel = segT >= dur * 0.6 ? { s: d.telop ?? "", c: YELLOW } : null;
		} else {
			center(d, now, null);
			tel = d.telop ? { s: d.telop, c: YELLOW } : null;
		}
		if (overlays) {
			scoreboard(d, score);
			outsBases(outs, bases);
			put("live", 0, 216, 26);
		}
		if (tel?.s) telop(tel.s, tel.c, batSide(d));
		if (d.kind === "window" && play?.lc) {
			const word = JK_TELOP[play.lc];
			bigBox(word, since);
		}
		bezel(now);
	};

	return {
		load: async () => {
			const fonts = document.fonts?.load(FONT(10)).catch(() => []);
			const wait = new Promise((r) => setTimeout(r, 1000));
			const [im] = await Promise.all([
				loadImage(JK_SHEET),
				Promise.race([fonts, wait]),
			]);
			img = im;
		},
		onEv: (ev, now) => {
			if (ev.t === "scene") {
				sceneAt = now;
				data = (ev.seg.data as YData | undefined) ?? data;
			}
			if (ev.t === "open") openAt = now;
			if (ev.t === "kanso") kansoAt = now;
		},
		draw,
	};
};
