// 保守リーグ（麻雀）の TV（ゲームセンター「連コ」の 壁の 大画面。ui/jikkyoWatch.ts の 板の 上の キャンバス）。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標）。枠は bigFrame（大画面と 客の 頭）。
// - 場面（data/jikkyo/mahjong.ts の MAHJONG_SCENES）：
//   card（リーグの 札と 牌の 列）・intro（4人の 札が 右から 入る）・
//   taku（上から 見た 卓：左に 卓と 4人の 手と 河・まんなかに 局と リーチ棒、右に 4人の 点と 寄りの 手牌）・
//   yakuman（四暗刻 単騎の 手の 寄り → 合図ごとに 順番の 灯が 回る → 4拍目に ツモの 牌が 光る → 役満の 札）・
//   result（最終の 着順 → 勝利者インタビュー）。
// - 牌は 塗りの 小さな 牌（5x8。字は 数字と 簡単な 記号：風は E S W N、白は 枠、發・中は 色の 板）。凝った 絵は 卓と 役満の 2つ。
// - 動きは 名目の 時計（lt・t）、点滅・光の ゆれだけ 実際の 時計（now）。still では 点滅・ゆれ・飛びちりを 止める。
// - 字幕は 卓では 右の 下（卓の 手を かくさない）、ほかは スクリーンの 下。

import {
	MAHJONG_ART,
	MAHJONG_FINAL,
	MAHJONG_HANDS,
	MAHJONG_PLAYERS,
	MAHJONG_RANK,
	MAHJONG_TSUMO,
	type MahjongData,
} from "../data/jikkyo/mahjong";
import {
	bigFrame,
	blit,
	clamp01,
	drawCaption,
	type G,
	hash,
	makeTv,
	num,
	numW,
	person,
	type TvCtx,
	text,
} from "./jikkyoTvKit";

type C = TvCtx<MahjongData>;

const A = MAHJONG_ART;
const P = MAHJONG_PLAYERS;
const FELT = "#1d6b4c";
const FELT_HI = "#23805a";
const WOOD = "#4a2e1a";
const FACE = "#f3eedc";
const SHADE = "#c9bf9f";
const BACK = "#d9822b";
const BACK_HI = "#f0a050";
const GOLD = "#ffd25a";
const INK = { m: "#1c1c22", p: "#1f4fae", s: "#1d7a3e", z: "#20305a" } as const;
const MARK = {
	m: ["###", "#c8202a"],
	p: ["#.#", "#1f4fae"],
	s: [".#.", "#1d7a3e"],
} as const;
/** 風（東南西北）の 3x5 の 記号。 */
const WIND: readonly (readonly string[])[] = [
	["###", "#..", "##.", "#..", "###"],
	["###", "#..", "###", "..#", "###"],
	["#.#", "#.#", "#.#", "###", "#.#"],
	["#.#", "###", "###", "##.", "#.#"],
];

// ───────────────── 牌 ─────────────────

/** 表の 牌（5x8。k 倍）。 */
const tile = (g: G, x: number, y: number, code: string, k = 1): void => {
	g.fillStyle = SHADE;
	g.fillRect(x, y + 7 * k, 5 * k, k);
	g.fillStyle = FACE;
	g.fillRect(x, y, 5 * k, 7 * k);
	const s = code[0] as "m" | "p" | "s" | "z";
	const n = code.slice(1);
	if (s === "z") {
		const v = Number(n);
		if (v <= 4) blit(g, WIND[v - 1] ?? [], x + k, y + k, { "#": INK.z }, k);
		else if (v === 5) {
			g.fillStyle = "#4a7ad0";
			g.fillRect(x + k, y + k, 3 * k, k);
			g.fillRect(x + k, y + 5 * k, 3 * k, k);
			g.fillRect(x + k, y + k, k, 5 * k);
			g.fillRect(x + 3 * k, y + k, k, 5 * k);
		} else {
			g.fillStyle = v === 6 ? "#1d8a3e" : "#d0202a";
			g.fillRect(x + k, y + k, 3 * k, 5 * k);
		}
		return;
	}
	num(g, n, x + k, y + k, k, INK[s]);
	const [art, ink] = MARK[s];
	blit(g, [art], x + k, y + 6 * k, { "#": ink }, k);
};

/** 牌の 裏（上から 見た 手。w・h は 向き）。 */
const back = (g: G, x: number, y: number, w: number, h: number): void => {
	g.fillStyle = BACK;
	g.fillRect(x, y, w, h);
	g.fillStyle = BACK_HI;
	g.fillRect(x, y, w, 1);
};

/** 河の 小さな 牌（向き w・h。点の 色は 牌の 種類）。 */
const PIP = ["#c8202a", "#1f4fae", "#1d7a3e", "#20305a"] as const;
const river = (g: G, x: number, y: number, w: number, h: number, k: number) => {
	g.fillStyle = FACE;
	g.fillRect(x, y, w, h);
	g.fillStyle = PIP[Math.floor(hash(k, 3, 7) * PIP.length)] ?? PIP[0];
	g.fillRect(x + Math.floor(w / 2) - 1, y + Math.floor(h / 2) - 1, 2, 2);
};

// ───────────────── 札 ─────────────────

const drawCard = (g: G, c: C): void => {
	g.fillStyle = "#0a0a10";
	g.fillRect(0, 0, c.W, c.H);
	g.fillStyle = FELT;
	g.fillRect(0, 26, c.W, 52);
	g.fillStyle = FELT_HI;
	g.fillRect(0, 26, c.W, 1);
	text(g, A.logo, c.W / 2, 31, 12, GOLD, { outline: "#0a2a1a" });
	// 1〜9 の 牌が 1枚ずつ 立つ（おわりは 伏せる）
	const end = c.data.phase === "end";
	for (let i = 0; i < 9; i++) {
		const x = c.W / 2 - 54 + i * 12;
		const up = c.still || c.lt >= 200 + i * 150;
		if (end || !up) back(g, x, 52, 10, 16);
		else tile(g, x, 52, `${"mps"[Math.floor(i / 3)]}${(i % 9) + 1}`, 2);
	}
	text(g, c.data.card ?? A.logo, c.W / 2, 84, 8, end ? "#a8a090" : "#e8e0c8");
	if (c.data.phase === "soon" && !c.still && Math.floor(c.now / 500) % 2) {
		g.fillStyle = "#ff5040";
		g.fillRect(8, 8, 4, 4);
	}
};

// ───────────────── 選手紹介 ─────────────────

/** 胸から 上の 人（2倍）。 */
const bust = (g: G, x: number, y: number, body: string, hair: string) => {
	g.save();
	g.beginPath();
	g.rect(x, y, 14, 18);
	g.clip();
	g.translate(x + 1, y + 1);
	g.scale(2, 2);
	person(g, 0, 0, body, hair);
	g.restore();
};

const HAIR = ["#2a1a10", "#3a2a1a", "#5a3a2a", "#1a1a1a"] as const;

const drawIntro = (g: G, c: C): void => {
	g.fillStyle = "#0e1220";
	g.fillRect(0, 0, c.W, c.H);
	P.forEach((p, i) => {
		const y = 3 + i * 22;
		const k = c.still ? 0 : 1 - clamp01((c.lt - i * 500) / 400);
		const x = Math.round(k * c.W);
		g.fillStyle = "#1a2236";
		g.fillRect(x + 4, y, c.W - 8, 20);
		g.fillStyle = p.ink;
		g.fillRect(x + 4, y, 3, 20);
		g.fillStyle = "#2c3a58";
		g.fillRect(x + 7, y, 19, 20);
		bust(g, x + 9, y + 2, p.ink, HAIR[i] ?? HAIR[0]);
		text(g, p.name, x + 32, y + 1, 10, "#ffffff", { align: "left" });
		text(g, p.team, x + 32, y + 11, 8, p.ink, { align: "left" });
		text(g, A.seats[i] ?? "", x + c.W - 10, y + 6, 8, "#c8d0e0", {
			align: "right",
		});
	});
};

// ───────────────── 卓 ─────────────────

/** 巡目（700ms ごとに 1人。ロンで 止まる）。 */
const turnOf = (c: C): number => {
	const d = c.data;
	const lt = d.ron ? Math.min(c.lt, d.ron.at) : c.lt;
	return (d.turn0 ?? 0) + Math.floor(lt / 700);
};
const discards = (turn: number, seat: number) =>
	Math.max(0, Math.min(18, Math.floor((turn - seat + 3) / 4)));

/** 席ごとの 河の 牌の 置き場（i は 何枚目）。 */
const riverAt = (seat: number, i: number): [number, number, number, number] => {
	const col = i % 6;
	const row = Math.floor(i / 6);
	if (seat === 0) return [39 + col * 5, 70 + row * 6, 4, 5];
	if (seat === 1) return [70 + row * 6, 63 - col * 5, 5, 4];
	if (seat === 2) return [63 - col * 5, 33 - row * 6, 4, 5];
	return [32 - row * 6, 39 + col * 5, 5, 4];
};

/** 席ごとの 置き場（席 0 が 下、反時計まわりに 右・上・左）：リーチの 吹き出し・番の 灯・親の 印・リーチ棒。 */
const CALL_AT = [
	[53, 76],
	[80, 48],
	[53, 20],
	[26, 48],
] as const;
const LAMP_AT = [
	[42, 64, 22, 1],
	[64, 42, 1, 22],
	[42, 41, 22, 1],
	[41, 42, 1, 22],
] as const;
const DEALER_AT = [
	[61, 61],
	[61, 43],
	[43, 43],
	[43, 61],
] as const;
const STICK_AT = [
	[45, 67, 16, 2],
	[67, 45, 2, 16],
	[45, 38, 16, 2],
	[38, 45, 2, 16],
] as const;

const declared = (d: MahjongData, seat: number, lt: number) =>
	(d.riichi ?? []).some((r) => r.seat === seat && lt >= r.at);

/** その 時の 点（リーチ棒を ひく。ロンの あとは after）。 */
const scoreOf = (d: MahjongData, seat: number, lt: number): number => {
	if (d.ron && d.after && lt >= d.ron.at) return d.after[seat] ?? 0;
	return (d.scores?.[seat] ?? 0) - (declared(d, seat, lt) ? 1000 : 0);
};

const drawTable = (g: G, c: C): void => {
	const d = c.data;
	g.fillStyle = WOOD;
	g.fillRect(4, 4, 98, 98);
	g.fillStyle = FELT;
	g.fillRect(7, 7, 92, 92);
	g.fillStyle = FELT_HI;
	g.fillRect(7, 7, 92, 1);
	// 4人の 手（伏せた 牌）
	for (let i = 0; i < 13; i++) {
		const a = 21 + i * 5;
		back(g, a, 92, 4, 5);
		back(g, 93, a, 5, 4);
		back(g, a, 9, 4, 5);
		back(g, 9, a, 5, 4);
	}
	// 河（リーチの 1枚は 横）
	const turn = turnOf(c);
	for (let s = 0; s < 4; s++) {
		const n = discards(turn, s);
		const r = (d.riichi ?? []).find((x) => x.seat === s);
		const side =
			r && c.lt >= r.at
				? r.at < 0
					? 3
					: discards((d.turn0 ?? 0) + Math.floor(r.at / 700), s)
				: -1;
		for (let i = 0; i < n; i++) {
			const [x, y, w, h] = riverAt(s, i);
			if (i === side) river(g, x, y, h, w, s * 31 + i);
			else river(g, x, y, w, h, s * 31 + i);
		}
	}
	// まんなか：局・親の 印（角の 赤）・番の 灯（黄の 線）・リーチ棒（河との あいだ）
	g.fillStyle = "#0b1410";
	g.fillRect(40, 40, 26, 26);
	text(g, d.kyoku ?? "", 53, 48, 8, "#e8e0c8");
	const [lx, ly, lw, lh] = LAMP_AT[turn % 4] ?? LAMP_AT[0];
	if (!d.ron || c.lt < d.ron.at) {
		g.fillStyle = "#ffe060";
		g.fillRect(lx, ly, lw, lh);
	}
	const [ox, oy] = DEALER_AT[d.dealer ?? 0] ?? DEALER_AT[0];
	g.fillStyle = "#e02030";
	g.fillRect(ox, oy, 2, 2);
	for (let s = 0; s < 4; s++) {
		if (!declared(d, s, c.lt)) continue;
		const [x, y, w, h] = STICK_AT[s] ?? STICK_AT[0];
		g.fillStyle = "#ffffff";
		g.fillRect(x, y, w, h);
		g.fillStyle = "#e02030";
		g.fillRect(x + (w > h ? 7 : 0), y + (w > h ? 0 : 7), 2, 2);
	}
	// リーチの 吹き出し（1.6秒）
	for (const r of d.riichi ?? []) {
		if (r.at < 0 || c.lt < r.at || c.lt > r.at + 1600) continue;
		const [x, y] = CALL_AT[r.seat] ?? CALL_AT[0];
		g.fillStyle = "#ffffff";
		g.fillRect(x - 13, y - 1, 26, 11);
		g.fillStyle = "#e02030";
		g.fillRect(x - 13, y + 10, 26, 1);
		text(g, A.riichi, x, y, 8, "#1a1a24");
	}
	// ロン（大きな 字と 白い 光）
	if (d.ron && c.lt >= d.ron.at) {
		const since = c.lt - d.ron.at;
		const a = c.still ? 0 : 1 - clamp01(since / 500);
		if (a > 0) {
			g.fillStyle = `rgba(255, 255, 255, ${(a * 0.7).toFixed(3)})`;
			g.fillRect(4, 4, 98, 98);
		}
		g.fillStyle = GOLD;
		g.fillRect(30, 38, 46, 22);
		g.fillStyle = "#4a0a0a";
		g.fillRect(31, 39, 44, 20);
		text(g, A.ron, 53, 41, 16, "#ffe060", { outline: "#000000" });
	}
};

/** 右の 欄：局・4人の 点・寄りの 手牌。 */
const drawPanel = (g: G, c: C): void => {
	const d = c.data;
	g.fillStyle = "#121a26";
	g.fillRect(104, 0, c.W - 104, c.H);
	text(g, d.kyoku ?? "", 108, 3, 10, GOLD, { align: "left" });
	text(g, A.logo, c.W - 3, 5, 8, "#7a8aa0", { align: "right" });
	const dl = d.dealer ?? 0;
	P.forEach((p, s) => {
		const y = 18 + s * 12;
		g.fillStyle = s % 2 ? "#18222f" : "#1c2838";
		g.fillRect(105, y, c.W - 106, 11);
		g.fillStyle = p.ink;
		g.fillRect(105, y, 3, 11);
		const wind = (s - dl + 4) % 4;
		text(g, A.winds[wind] ?? "", 110, y + 1, 8, wind ? "#c8d0e0" : "#ff7060", {
			align: "left",
		});
		text(g, p.name, 120, y + 1, 8, d.ras === s ? "#ff9090" : "#ffffff", {
			align: "left",
		});
		if (declared(d, s, c.lt)) {
			g.fillStyle = "#ffffff";
			g.fillRect(148, y + 5, 7, 1);
			g.fillStyle = "#e02030";
			g.fillRect(151, y + 5, 1, 1);
		}
		const sc = String(scoreOf(d, s, c.lt));
		num(g, sc, c.W - 3 - numW(sc, 1), y + 3, 1, "#e8f0ff");
		// ロンの 点の 動き（3秒）
		if (d.ron && c.lt >= d.ron.at && c.lt < d.ron.at + 3000) {
			const up = s === d.ron.to;
			if (up || s === d.ron.from) {
				const v = String(d.ron.pts);
				const ink = up ? "#70e090" : "#ff7070";
				const x = 160;
				g.fillStyle = ink;
				g.fillRect(x, y + 5, 3, 1);
				if (up) g.fillRect(x + 1, y + 4, 1, 3);
				num(g, v, x + 4, y + 3, 1, ink);
			}
		} else if (d.ras === s)
			text(g, A.ras, 158, y + 1, 8, "#ff7070", { align: "left" });
	});
	// 寄りの 手牌
	const f = d.focus ?? 0;
	const fp = P[f] ?? P[0];
	g.fillStyle = fp.ink;
	g.fillRect(106, 69, 3, 8);
	text(g, fp.name, 111, 68, 8, "#ffffff", { align: "left" });
	const tag = tagOf(d, c.lt);
	if (tag) {
		const blink = !c.still && tag.blink && Math.floor(c.now / 400) % 2;
		if (!blink) {
			g.fillStyle = tag.bg;
			g.fillRect(c.W - 44, 68, 41, 10);
			text(g, tag.s, c.W - 24, 68, 8, "#ffffff");
		}
	}
	const hand = d.hand ?? [];
	const cut = d.cut && c.lt >= d.cut.at ? d.cut : null;
	const won = d.ron && c.lt >= d.ron.at;
	const cutInk = cut?.push ? "#ff3040" : "#60c0ff";
	hand.forEach((code, i) => {
		const lift = cut?.idx === i;
		tile(g, 107 + i * 6, lift ? 78 : 81, code);
		if (lift) frame(g, 106 + i * 6, 77, cutInk);
	});
	// ツモ（リーチ・テンパイで 打つ まで）・押す 牌・ロンの 牌
	const dx = 107 + 13 * 6 + 3;
	const gone =
		(d.riichi ?? []).some((r) => r.seat === f && r.at >= 0 && c.lt >= r.at) ||
		(d.tenpai?.seat === f && d.tenpai.at >= 0 && c.lt >= d.tenpai.at);
	if (!d.draw) return;
	if (won) {
		tile(g, dx, 81, d.draw);
		frame(g, dx - 1, 80, "#ffe060");
	} else if (cut?.idx === 13) {
		tile(g, dx, 78, d.draw);
		frame(g, dx - 1, 77, cutInk);
	} else if (!d.ron && !gone) tile(g, dx, 81, d.draw);
};

/** 牌の まわりの 枠（7x10）。 */
const frame = (g: G, x: number, y: number, ink: string): void => {
	g.fillStyle = ink;
	g.fillRect(x, y, 7, 1);
	g.fillRect(x, y + 9, 7, 1);
	g.fillRect(x, y, 1, 10);
	g.fillRect(x + 6, y, 1, 10);
};

/** 寄りの 手の 札（リーチ・テンパイ・ダマ・無スジ・現物）。 */
const tagOf = (
	d: MahjongData,
	lt: number,
): { s: string; bg: string; blink: boolean } | null => {
	const f = d.focus ?? 0;
	if (d.cut && lt >= d.cut.at)
		return d.cut.push
			? { s: A.danger, bg: "#c02030", blink: true }
			: { s: A.safe, bg: "#2a70b0", blink: false };
	if (declared(d, f, lt)) return { s: A.riichi, bg: "#c02030", blink: false };
	// 東1局の 親は ダマ、南場の ラス目は テンパイ（どちらも 曲げない）
	if (d.tenpai?.seat === f && lt >= d.tenpai.at)
		return {
			s: d.phase === "nan" ? A.tenpai : A.dama,
			bg: d.phase === "nan" ? "#2a8a50" : "#6a5a20",
			blink: d.tenpai.at >= 0,
		};
	return null;
};

const drawTaku = (g: G, c: C): void => {
	g.fillStyle = "#0c1018";
	g.fillRect(0, 0, c.W, c.H);
	drawTable(g, c);
	drawPanel(g, c);
};

// ───────────────── 役満（山場） ─────────────────

const LAMPS = [0, 1, 2, 3] as const;

const drawYakuman = (g: G, c: C): void => {
	const d = c.data;
	const since = c.t - (d.exact ?? Number.POSITIVE_INFINITY);
	const done = d.phase === "boom" || since >= 0;
	g.fillStyle = "#0a0c14";
	g.fillRect(0, 0, c.W, c.H);
	g.fillStyle = FELT;
	g.fillRect(0, 36, c.W, 34);
	g.fillStyle = FELT_HI;
	g.fillRect(0, 36, c.W, 1);
	// 打ち手の 札（親）
	const me = P[3];
	g.fillStyle = me.ink;
	g.fillRect(6, 6, 3, 20);
	text(g, me.name, 13, 5, 10, "#ffffff", { align: "left" });
	text(g, me.team, 13, 17, 8, me.ink, { align: "left" });
	g.fillStyle = "#c02030";
	g.fillRect(48, 6, 12, 11);
	text(g, A.oya, 54, 7, 8, "#ffffff");
	// 順番の 灯（南家・西家・北家が 打って、4つめで 親の ツモ）
	LAMPS.forEach((s, i) => {
		const x = c.W - 80 + i * 19;
		const lit =
			s === 3 ? done : d.phase !== "tenpai" && (done || c.pulses.length > i);
		g.fillStyle = lit ? (s === 3 ? GOLD : "#ffe060") : "#2a3048";
		g.fillRect(x, 6, 16, 14);
		const p = P[s] ?? P[0];
		g.fillStyle = p.ink;
		g.fillRect(x, 20, 16, 2);
		text(
			g,
			A.winds[(s + 1) % 4] ?? "",
			x + 8,
			9,
			8,
			lit ? "#1a1a24" : "#8890a8",
		);
	});
	// 手（四暗刻 単騎。2倍の 牌）
	const hand = MAHJONG_HANDS.suuankou;
	// ツモの あと 手が 左から 順に 1度 はねる（手を 倒す かわり）
	const bounce = (i: number) =>
		done && !c.still
			? -Math.round(4 * Math.sin(clamp01((since - i * 40) / 300) * Math.PI))
			: 0;
	hand.forEach((code, i) => {
		tile(g, 19 + i * 12, 44 + bounce(i), code, 2);
	});
	// ツモの 牌（合図ごとに 下りて、ちょうどで 表）
	const tx = 19 + 13 * 12 + 4;
	if (done) {
		tile(g, tx, 44 + bounce(13), MAHJONG_TSUMO, 2);
		g.fillStyle = GOLD;
		g.fillRect(tx - 2, 42, 14, 1);
		g.fillRect(tx - 2, 61, 14, 1);
		g.fillRect(tx - 2, 42, 1, 20);
		g.fillRect(tx + 11, 42, 1, 20);
	} else if (d.phase === "cue") {
		const y = 24 + Math.min(3, c.pulses.length) * 5;
		back(g, tx, y, 10, 16);
		const lit = c.pulses.some((p) => c.now - p >= 0 && c.now - p < 220);
		if (lit && !c.still) {
			g.fillStyle = "rgba(255, 240, 160, 0.6)";
			g.fillRect(tx - 1, y - 1, 12, 18);
		}
	} else {
		const on = c.still || Math.floor(c.now / 500) % 2 === 0;
		if (on) text(g, A.tenpai, tx + 5, 26, 8, "#70e090");
	}
	if (!done) return;
	// ツモ → 役満の 札（白い 光、金の 粒）
	const a = c.still ? 0 : 1 - clamp01(since / 900);
	if (a > 0) {
		g.fillStyle = `rgba(255, 250, 220, ${(a * 0.85).toFixed(3)})`;
		g.fillRect(0, 0, c.W, c.H);
	}
	text(g, A.tsumo, c.W / 2, 22, 16, GOLD, { outline: "#4a2a00" });
	if (d.phase !== "boom" || c.lt < 1200) return;
	g.fillStyle = "#1a0a0a";
	g.fillRect(14, 72, c.W - 28, 20);
	g.fillStyle = GOLD;
	g.fillRect(14, 72, c.W - 28, 1);
	g.fillRect(14, 91, c.W - 28, 1);
	g.fillStyle = "#c02030";
	g.fillRect(20, 74, 34, 16);
	text(g, A.yakuman, 37, 76, 12, "#ffffff");
	text(g, A.hand, 122, 78, 8, GOLD);
	if (c.still) return;
	const k = Math.floor(c.now / 120);
	g.fillStyle = "#fff4b0";
	for (let i = 0; i < 10; i++) {
		if (hash(i, k, 9) > 0.6) continue;
		g.fillRect(
			Math.floor(hash(i, k, 10) * c.W),
			Math.floor(hash(i, k, 11) * 70),
			1,
			1,
		);
	}
};

// ───────────────── 最終結果・インタビュー ─────────────────

const drawResult = (g: G, c: C): void => {
	g.fillStyle = "#0e1424";
	g.fillRect(0, 0, c.W, c.H);
	if (c.data.phase === "iv") {
		drawIv(g, c);
		return;
	}
	text(g, A.result, c.W / 2, 3, 10, GOLD);
	MAHJONG_RANK.forEach((s, r) => {
		const y = 18 + r * 21;
		if (!c.still && c.lt < (3 - r) * 700) return;
		const p = P[s] ?? P[0];
		g.fillStyle = r === 0 ? "#3a2e10" : "#182238";
		g.fillRect(6, y, c.W - 12, 19);
		if (r === 0) {
			g.fillStyle = GOLD;
			g.fillRect(6, y, c.W - 12, 1);
			g.fillRect(6, y + 18, c.W - 12, 1);
		}
		text(g, A.ranks[r] ?? "", 20, y + 5, 8, r === 0 ? GOLD : "#c8d0e0");
		g.fillStyle = p.ink;
		g.fillRect(34, y + 2, 3, 15);
		text(g, p.name, 41, y + 1, 8, "#ffffff", { align: "left" });
		text(g, p.team, 41, y + 10, 8, p.ink, { align: "left" });
		const sc = String(MAHJONG_FINAL[s] ?? 0);
		num(g, sc, c.W - 12 - numW(sc, 2), y + 5, 2, r === 0 ? GOLD : "#e8f0ff");
	});
};

const drawIv = (g: G, c: C): void => {
	// 後ろの 幕（牌の 柄）
	for (let y = 0; y < c.H; y += 12)
		for (let x = (y / 12) % 2 ? 6 : 0; x < c.W; x += 12) {
			g.fillStyle = "#16203a";
			g.fillRect(x, y, 5, 7);
		}
	text(g, A.iv, c.W / 2, 3, 8, GOLD, { outline: "#0e1424" });
	const me = P[3];
	g.save();
	g.translate(78, 44);
	g.scale(4, 4);
	person(g, 0, 0, me.ink, HAIR[3]);
	g.restore();
	g.save();
	g.translate(122, 60);
	g.scale(3, 3);
	person(g, 0, 0, "#3a3a4a", HAIR[1]);
	g.restore();
	// マイク
	g.fillStyle = "#8a8a98";
	g.fillRect(108, 68, 12, 2);
	g.fillStyle = "#2a2a30";
	g.fillRect(104, 66, 5, 5);
	// 名前の 札
	g.fillStyle = "#101820";
	g.fillRect(40, 92, 70, 12);
	g.fillStyle = me.ink;
	g.fillRect(40, 92, 3, 12);
	text(g, me.name, 46, 94, 8, "#ffffff", { align: "left" });
	text(g, me.team, 66, 94, 8, me.ink, { align: "left" });
	if (c.still || c.lt >= 1500) {
		g.fillStyle = "#ffffff";
		g.fillRect(16, 18, 74, 14);
		g.fillRect(70, 32, 4, 4);
		text(g, A.say, 53, 21, 8, "#1a1a24");
	}
};

// ───────────────── TV ─────────────────

export const mahjongTv = makeTv<MahjongData>({
	screen: bigFrame.screen,
	frame: bigFrame.draw,
	scenes: {
		card: drawCard,
		intro: drawIntro,
		taku: drawTaku,
		yakuman: drawYakuman,
		result: drawResult,
	},
	noCaption: ["card"],
	// 卓は 右の 欄の 下（卓の 手を かくさない）
	caption: (g, c, s) => {
		if (c.seg?.scene !== "taku") {
			drawCaption(g, c, s);
			return;
		}
		g.fillStyle = "rgba(0, 0, 0, 0.6)";
		g.fillRect(104, c.H - 13, c.W - 104, 13);
		text(g, s, 104 + (c.W - 104) / 2, c.H - 11, 8, "#ffffff");
	},
});
