// 過去ログの世紀の TV（ui/jikkyoWatch.ts の 板の 上の キャンバス）。おんJ図書館の 視聴覚コーナーの テレビ
// （crtFrame。右の 壁に ヘッドホンが かかっている）。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標。場面は スクリーンの 左上が 0,0）。
// - 映像は モノクロの 古い フィルム（灰色の 塗り・粒・傷・ちらつき・四すみの 影・年の 字幕）。
//   山場で スレタイが 出た 拍から 色が もどり、いまの 保守村（ima）は 色の ついた 絵。
// - 凝った 絵は 2つ：山場（tsugi：スレ立ての 欄に スレタイを 打ち、合図ごとに「書きこむ」が 光る → 新しい スレが
//   板の いちばん 上に 色つきで 出る）と 植民地の 地図（shokumin：旗が 立ち、人の 点が 出ていって もどらない）。
// - 動きは 名目の 時計（c.lt・c.t）、粒・傷・ちらつき・点滅だけ 実際の 時計（c.now）。still では 粒を 止め、
//   傷・ちらつき・点滅・ゆれ・光を 出さない。

import {
	KAKOLOG_ART,
	KAKOLOG_EXACT,
	type KakologData,
} from "../data/jikkyo/kakolog";
import {
	bands,
	clamp01,
	crtFrame,
	type G,
	hash,
	makeTv,
	num,
	numW,
	person,
	pulseGlow,
	type SceneFn,
	type TvCtx,
	text,
} from "./jikkyoTvKit";

type Scene = SceneFn<KakologData>;
type C = TvCtx<KakologData>;

/** フィルムの 灰色（暗い → 明るい。少し あたたかい）。 */
const F = [
	"#0e0e0d",
	"#262624",
	"#3e3e3a",
	"#5a5a54",
	"#7a7a72",
	"#9e9e94",
	"#c2c2b8",
	"#e2e2d8",
] as const;

const rect = (
	g: G,
	x: number,
	y: number,
	w: number,
	h: number,
	col: string,
) => {
	g.fillStyle = col;
	g.fillRect(x, y, w, h);
};

// ───────────────── フィルム ─────────────────

/** 粒・傷・ちらつき・四すみの 影・年の 字幕（k は 粒の 濃さ 0〜1）。 */
const film = (g: G, c: C, year?: number, k = 1): void => {
	const { W, H } = c;
	const frame = c.still ? 0 : Math.floor(c.now / 70);
	const n = Math.round((c.still ? 14 : 36) * k);
	for (let i = 0; i < n; i++) {
		const x = Math.floor(hash(i, frame, 1) * W);
		const y = Math.floor(hash(i, frame, 2) * H);
		rect(
			g,
			x,
			y,
			1,
			1,
			i % 3 ? "rgba(0, 0, 0, 0.45)" : "rgba(255, 255, 240, 0.4)",
		);
	}
	if (!c.still && k > 0.2) {
		// 傷（ときどき 縦に 1本）とちらつき
		for (let s = 0; s < 2; s++) {
			const seed = Math.floor(c.now / 260) + s * 17;
			if (hash(seed, 3) > 0.55) continue;
			const x = Math.floor(hash(seed, 4) * W);
			const y0 = Math.floor(hash(seed, 5) * H * 0.5);
			rect(g, x, y0, 1, Math.floor(H * 0.5), "rgba(235, 235, 220, 0.28)");
		}
		const fl = hash(Math.floor(c.now / 90), 9) * 0.07 * k;
		rect(g, 0, 0, W, H, `rgba(0, 0, 0, ${fl.toFixed(3)})`);
	}
	// 四すみの 影（縁に 向かって 暗く）
	for (let i = 0; i < 6; i++) {
		g.fillStyle = `rgba(0, 0, 0, ${(0.22 * (1 - i / 6) * Math.max(k, 0.4)).toFixed(3)})`;
		g.fillRect(i, i, W - i * 2, 1);
		g.fillRect(i, H - 1 - i, W - i * 2, 1);
		g.fillRect(i, i, 1, H - i * 2);
		g.fillRect(W - 1 - i, i, 1, H - i * 2);
	}
	if (year !== undefined)
		text(g, `${year}年`, 8, 5, 8, F[7], { align: "left", outline: F[0] });
};

/** 灰色の 小さな 人（塗り。体・頭の 濃さ）。 */
const gperson = (
	g: G,
	x: number,
	y: number,
	body: string,
	head: string = F[6],
) => {
	rect(g, x + 1, y, 4, 2, F[1]);
	rect(g, x + 1, y + 2, 4, 3, head);
	rect(g, x, y + 5, 6, 5, body);
	rect(g, x + 1, y + 10, 1, 2, F[0]);
	rect(g, x + 4, y + 10, 1, 2, F[0]);
};

// ───────────────── カード・OP ─────────────────

/** 題の 札（まもなく・予告・おわり。下の 字幕に 中身）。 */
const drawLogo = (g: G, c: C, a: number) => {
	const { W } = c;
	rect(g, 0, 0, W, c.H, "#121210");
	g.globalAlpha = a;
	rect(g, 30, 24, W - 60, 1, F[3]);
	rect(g, 30, 70, W - 60, 1, F[3]);
	text(g, KAKOLOG_ART.title, W / 2, 32, 16, F[7]);
	text(g, KAKOLOG_ART.sub, W / 2, 56, 8, F[5]);
	g.globalAlpha = 1;
};

const drawCard: Scene = (g, c) => {
	const fade = c.still ? 1 : clamp01(c.lt / 800);
	drawLogo(g, c, (c.data.phase === "end" ? 0.55 : 1) * fade);
	film(g, c);
};

/** フィルムの 頭の 数字（3・2・1）→ 題。 */
const LEADER = 1200;
const drawOp: Scene = (g, c) => {
	const { W, H, lt } = c;
	if (lt < LEADER * 3) {
		rect(g, 0, 0, W, H, F[5]);
		const cx = W / 2;
		const cy = H / 2 - 4;
		if (!c.still) {
			// 針の 扇（1秒で 1周）
			const a = ((lt % LEADER) / LEADER) * Math.PI * 2;
			g.fillStyle = "rgba(0, 0, 0, 0.22)";
			g.beginPath();
			g.moveTo(cx, cy);
			g.arc(cx, cy, 44, -Math.PI / 2, -Math.PI / 2 + a);
			g.closePath();
			g.fill();
		}
		g.strokeStyle = F[1];
		g.lineWidth = 1;
		for (const r of [36, 30]) {
			g.beginPath();
			g.arc(cx, cy, r, 0, Math.PI * 2);
			g.stroke();
		}
		rect(g, 0, cy, W, 1, F[2]);
		rect(g, cx, 0, 1, H, F[2]);
		const n = String(3 - Math.floor(lt / LEADER));
		num(g, n, Math.round(cx - numW(n, 6) / 2), Math.round(cy - 15), 6, F[0]);
	} else {
		const a = c.still ? 1 : clamp01((lt - LEADER * 3) / 1500);
		drawLogo(g, c, a);
	}
	film(g, c);
};

// ───────────────── 時代 ─────────────────

/** 2012年：古い 画面に 最初の スレが 1本（レスが ゆっくり ふえる）。 */
const drawHajime: Scene = (g, c) => {
	const { W, H } = c;
	rect(g, 0, 0, W, H, F[1]);
	// 机と 画面
	rect(g, 0, 80, W, H - 80, F[2]);
	rect(g, 28, 8, 124, 70, F[3]);
	rect(g, 32, 12, 116, 60, F[6]);
	rect(g, 32, 12, 116, 9, F[2]);
	text(g, KAKOLOG_ART.board, 36, 12, 8, F[7], { align: "left" });
	// 最初の スレ（1行目）と からの 行
	const n = String(1 + Math.floor(clamp01(c.lt / 11000) * 30));
	text(g, `1: ${KAKOLOG_ART.first}`, 36, 25, 8, F[1], { align: "left" });
	num(g, n, 144 - numW(n, 1), 28, 1, F[1]);
	for (let i = 0; i < 4; i++)
		for (let x = 36; x < 144; x += 4) rect(g, x, 42 + i * 8, 2, 1, F[4]);
	if (!c.still && Math.floor(c.now / 500) % 2) rect(g, 36, 37, 4, 1, F[1]);
	// 台の 前に 1人
	rect(g, 76, 82, 28, 3, F[4]);
	gperson(g, 152, 68, F[3]);
	film(g, c, c.data.year);
};

/** 2014年：人が あふれる。最初の スレが 1000へ。 */
const drawMatsuri: Scene = (g, c) => {
	const { W, H, lt } = c;
	rect(g, 0, 0, W, H, F[2]);
	// 上の 札（スレと レスの 数）
	rect(g, 14, 16, W - 28, 21, F[6]);
	text(g, KAKOLOG_ART.first, 20, 18, 8, F[1], { align: "left" });
	const e = clamp01(lt / 10000);
	const res = Math.min(1000, Math.floor(31 + 969 * e * e));
	const s = String(res);
	const full = res >= 1000;
	if (full) rect(g, W - 24 - numW(s, 2) - 3, 18, numW(s, 2) + 6, 17, F[0]);
	num(g, s, W - 24 - numW(s, 2), 22, 2, full ? F[7] : F[1]);
	// 人（ふえていく。跳ねる のは 実際の 時計で、still では 止まる）
	const count = Math.min(52, 3 + Math.floor(lt / 170));
	for (let i = 0; i < count; i++) {
		const row = i % 4;
		const col = Math.floor(i / 4);
		const x = 8 + ((col * 13 + Math.floor(hash(i, 1) * 7)) % (W - 16));
		const hop = !c.still && Math.sin(c.now / 180 + i * 1.3) > 0.7 ? 1 : 0;
		const y = 40 + row * 11 + Math.floor(hash(i, 2) * 3) - hop;
		gperson(g, x, y, F[3 + (i % 3)], F[5 + (i % 2)]);
	}
	film(g, c, c.data.year);
};

/** 規制の 冬：雪・暗い 家・「スレ立て　規制中」の 札の 前に 1人。 */
const drawFuyu: Scene = (g, c) => {
	const { W, H, lt } = c;
	bands(g, W, [F[2], F[3], F[3], F[4]], 0, 64);
	rect(g, 0, 64, W, H - 64, F[6]);
	// 家（屋根に 雪）
	for (const [x, w, h] of [
		[10, 30, 22],
		[46, 24, 18],
		[150, 26, 20],
	] as const) {
		rect(g, x, 64 - h, w, h, F[1]);
		for (let i = 0; i < 6; i++)
			rect(g, x - 3 + i, 64 - h - 6 + i, w + 6 - i * 2, 1, i < 2 ? F[7] : F[1]);
		rect(g, x + Math.floor(w / 2) - 2, 64 - h + 6, 4, 4, F[2]);
	}
	// 札
	rect(g, 118, 46, 2, 20, F[1]);
	rect(g, 86, 30, 66, 16, F[7]);
	rect(g, 86, 30, 66, 1, F[3]);
	text(g, KAKOLOG_ART.kisei, 119, 34, 8, F[0]);
	gperson(g, 104, 54, F[2]);
	// 雪（名目の 時計で 落ちる。still では 止まる）
	for (let i = 0; i < 44; i++) {
		const sp = 0.008 + hash(i, 3) * 0.008;
		const fall = c.still ? 0 : lt * sp;
		const x = Math.floor((hash(i, 1) * W + fall * 0.3) % W);
		const y = Math.floor((hash(i, 2) * H + fall) % H);
		rect(g, x, y, i % 4 ? 1 : 2, i % 4 ? 1 : 2, F[7]);
	}
	film(g, c);
};

/** 植民地の 地図：おんJの 島から 4つの 板へ。旗が 立ち（hata）、人の 点が 出ていって もどらない（chiru）。 */
const ISLES = [
	[30, 36],
	[150, 36],
	[30, 74],
	[150, 74],
] as const;
const HOME = [90, 55] as const;
const drawShokumin: Scene = (g, c) => {
	const { W, H, lt } = c;
	const chiru = c.data.phase === "chiru";
	rect(g, 0, 0, W, H, F[1]);
	for (let y = 6; y < H; y += 9)
		for (let x = (y * 7) % 11; x < W; x += 22) rect(g, x, y, 5, 1, F[2]);
	// 道（点線）
	for (const [ix, iy] of ISLES)
		for (let k = 2; k < 18; k++) {
			const p = k / 20;
			rect(
				g,
				Math.round(HOME[0] + (ix - HOME[0]) * p),
				Math.round(HOME[1] + (iy - HOME[1]) * p),
				1,
				1,
				F[3],
			);
		}
	// 板の 島と 名前
	KAKOLOG_ART.boards.forEach((name, i) => {
		const [ix, iy] = ISLES[i];
		rect(g, ix - 14, iy - 6, 28, 12, F[3]);
		rect(g, ix - 12, iy - 7, 24, 1, F[4]);
		text(g, name, ix, iy + (iy < HOME[1] ? -20 : 7), 8, F[6]);
		// 旗（hata は 1枚ずつ 立つ。chiru では もう 立っている）
		const up = chiru || c.still || lt >= 1500 + i * 1400;
		if (up) {
			rect(g, ix + 6, iy - 12, 1, 9, F[6]);
			rect(g, ix + 7, iy - 12, 5, 2, F[7]);
			rect(g, ix + 7, iy - 10, 3, 1, F[7]);
		}
	});
	// おんJの 島（chiru では 少しずつ 暗く なる）
	const dim = chiru ? clamp01(lt / 9000) : 0;
	rect(g, HOME[0] - 18, HOME[1] - 8, 36, 16, dim > 0.5 ? F[3] : F[4]);
	rect(g, HOME[0] - 16, HOME[1] - 9, 32, 1, F[5]);
	text(g, KAKOLOG_ART.board, HOME[0], HOME[1] - 5, 8, chiru ? F[6] : F[7]);
	if (!chiru && (c.still || lt >= 600))
		text(g, KAKOLOG_ART.sengen, HOME[0], 2, 8, F[7], { outline: F[0] });
	// 人の 点（hata：行って もどる。chiru：出ていって 島の 向こうへ 消える）
	for (let i = 0; i < 16; i++) {
		const [ix, iy] = ISLES[i % 4];
		let p: number;
		if (chiru) p = clamp01((lt - hash(i, 7) * 6000) / 3500) * 1.8;
		else {
			const w = (lt / 3200 + hash(i, 7)) % 1;
			p = (w < 0.5 ? w * 2 : 2 - w * 2) * 0.9;
		}
		if (c.still) p = chiru ? 1.8 : 0.45;
		const x = Math.round(HOME[0] + (ix - HOME[0]) * p);
		const y = Math.round(HOME[1] + (iy - HOME[1]) * p);
		if (x < 0 || x >= W || y < 0 || y >= H) continue;
		rect(g, x, y, 2, 2, F[7]);
	}
	film(g, c, c.data.year);
};

/** 過去ログ：スレの 列が 下へ 沈んで 暗く なる。年の 字幕が 進む。 */
const drawKakolog: Scene = (g, c) => {
	const { W, H, lt } = c;
	bands(g, W, [F[2], F[2], F[1], F[1], F[0], F[0]], 0, H);
	// いちばん 上に 最初の スレ。列ごと ゆっくり 沈み、深い ほど 暗い
	const rows = [KAKOLOG_ART.first, ...KAKOLOG_ART.sunk];
	const off = lt * 0.005;
	rows.forEach((t, i) => {
		const y = Math.round(18 + i * 11 + off);
		if (y > H) return;
		const a = 1 - clamp01((y - 30) / 60);
		if (a <= 0) return;
		g.globalAlpha = a;
		const first = t === KAKOLOG_ART.first;
		rect(g, 16, y, W - 32, 9, first ? F[5] : F[4]);
		text(g, t, 20, y, 8, F[0], { align: "left" });
		num(g, "1000", W - 20 - numW("1000", 1), y + 2, 1, F[1]);
		g.globalAlpha = 1;
	});
	const year = 2016 + Math.floor(clamp01(lt / 10000) * 9);
	film(g, c, year);
};

// ───────────────── 山場（次スレ） ─────────────────

/** 板の 一覧（新しい スレが いちばん 上に 色つきで 出る。since は ちょうどからの ms）。 */
const drawBoard = (g: G, c: C, since: number) => {
	const { W, H } = c;
	const warm = c.still ? 1 : clamp01(since / 2500);
	rect(g, 0, 0, W, H, F[1]);
	g.globalAlpha = warm;
	rect(g, 0, 0, W, H, "#1c2438");
	g.globalAlpha = 1;
	rect(g, 14, 6, W - 28, 80, warm > 0.5 ? "#e8e4d4" : F[6]);
	rect(g, 14, 6, W - 28, 9, warm > 0.5 ? "#3a5a8a" : F[2]);
	text(g, KAKOLOG_ART.board, 18, 6, 8, F[7], { align: "left" });
	// 色の 光（新しい 行の まわり）
	if (!c.still) {
		const a = 0.35 * (1 - clamp01(since / 4000));
		rect(g, 14, 16, W - 28, 15, `rgba(255, 220, 140, ${a.toFixed(3)})`);
	}
	rect(g, 16, 18, W - 32, 11, "#f2c868");
	text(g, `1: ${KAKOLOG_ART.next}`, 19, 19, 8, "#3a2410", { align: "left" });
	const res = String(1 + Math.floor(clamp01(since / 9000) * 219));
	num(g, res, W - 19 - numW(res, 1), 21, 1, "#3a2410");
	// その 下に 沈んだ スレ（灰色の まま）
	KAKOLOG_ART.sunk.slice(0, 4).forEach((t, i) => {
		const y = 33 + i * 12;
		rect(g, 16, y, W - 32, 10, F[5]);
		text(g, `${i + 2}: ${t}`, 19, y + 1, 8, F[2], { align: "left" });
	});
	film(g, c, undefined, 1 - warm);
};

const drawTsugi: Scene = (g, c) => {
	const { W, H } = c;
	const exact = c.data.exact ?? KAKOLOG_EXACT;
	const since = c.t - exact;
	if (c.data.phase === "title" || since >= 0) {
		drawBoard(g, c, Math.max(0, since));
		// 書きこんだ 瞬間の 白い 光
		const a = c.still ? 0 : 1 - clamp01(since / 900);
		if (a > 0) rect(g, 0, 0, W, H, `rgba(255, 255, 250, ${a.toFixed(3)})`);
		return;
	}
	if (c.data.phase === "pre") {
		// だれも いない 夜の 部屋に 画面が 1つ。前に 名無しの 背中
		rect(g, 0, 0, W, H, F[0]);
		const glow = c.still ? 0.5 : 0.4 + 0.15 * Math.sin(c.now / 700);
		g.fillStyle = `rgba(226, 226, 216, ${(glow * 0.25).toFixed(3)})`;
		g.fillRect(40, 4, 100, 82);
		rect(g, 54, 12, 72, 46, F[3]);
		rect(g, 57, 15, 66, 40, F[5]);
		rect(g, 57, 15, 66, 6, F[2]);
		for (let i = 0; i < 4; i++)
			rect(g, 60, 25 + i * 7, 36 - (i % 2) * 10, 2, F[4]);
		rect(g, 84, 58, 12, 6, F[2]);
		// 背中（頭と 肩）
		rect(g, 82, 66, 16, 12, F[1]);
		rect(g, 70, 76, 40, 16, F[1]);
		film(g, c);
		return;
	}
	// 合図：スレ立ての 欄に スレタイを 打つ。合図ごとに「書きこむ」が 光る
	rect(g, 0, 0, W, H, F[1]);
	rect(g, 14, 8, W - 28, 74, F[6]);
	text(g, KAKOLOG_ART.form, 20, 11, 8, F[2], { align: "left" });
	rect(g, 20, 24, W - 40, 15, F[3]);
	rect(g, 21, 25, W - 42, 13, F[7]);
	const start = c.seg?.start ?? exact - 4000;
	const p = clamp01((c.t - start) / Math.max(1, exact - 500 - start));
	const full = KAKOLOG_ART.next;
	const typed = [...full].slice(0, Math.ceil(p * [...full].length)).join("");
	text(g, typed, 24, 27, 8, F[0], { align: "left" });
	// 打った 字の 幅（全角 8・半角 4）の 右に 縦棒
	const tw = [...typed].reduce(
		(w, ch) => w + (/[\x20-\x7e]/.test(ch) ? 4 : 8),
		0,
	);
	if (c.still || Math.floor(c.now / 400) % 2 === 0)
		rect(g, 25 + tw, 27, 1, 10, F[0]);
	// 書きこむ（合図で 光る）
	const lit = pulseGlow(c, 320);
	const bx = W - 70;
	rect(g, bx, 46, 50, 16, F[2]);
	rect(g, bx + 1, 47, 48, 14, lit > 0 ? F[7] : F[4]);
	if (lit > 0) {
		g.fillStyle = `rgba(255, 240, 200, ${(lit * 0.5).toFixed(3)})`;
		g.fillRect(bx - 4, 42, 58, 24);
	}
	text(g, KAKOLOG_ART.submit, bx + 25, 50, 8, F[0]);
	// 合図の 点（3つ）
	for (let i = 0; i < 3; i++)
		rect(g, 30 + i * 12, 52, 6, 6, i < c.pulses.length ? F[7] : F[3]);
	film(g, c, undefined, 0.6);
};

// ───────────────── いま・ED ─────────────────

/** いまの 保守村（色の ついた 絵：空・海・浜・家・歩く 人）。 */
const ROOFS = ["#c05040", "#4a6a9a", "#c08a30", "#5a8a5a"] as const;
const drawIma: Scene = (g, c) => {
	const { W, H, lt } = c;
	bands(g, W, ["#78b4e4", "#90c4ec", "#acd4f0", "#c8e2f4"], 0, 44);
	g.fillStyle = "#fff2c0";
	g.beginPath();
	g.arc(150, 16, 7, 0, Math.PI * 2);
	g.fill();
	bands(g, W, ["#3a78b4", "#4a88c0", "#5a98cc"], 44, 14);
	for (let i = 0; i < 10; i++) {
		const x = Math.floor((hash(i, 1) * W + (c.still ? 0 : lt * 0.004)) % W);
		rect(g, x, 47 + (i % 3) * 4, 4, 1, "#cfe6f6");
	}
	rect(g, 0, 58, W, 10, "#78a858");
	rect(g, 0, 68, W, H - 68, "#e6d6a6");
	// 家
	for (let i = 0; i < 4; i++) {
		const x = 14 + i * 30 + (i > 1 ? 34 : 0);
		rect(g, x, 52, 20, 12, "#ece4d2");
		for (let k = 0; k < 5; k++)
			rect(g, x - 2 + k, 47 + k, 24 - k * 2, 1, ROOFS[i]);
		rect(g, x + 8, 57, 4, 7, "#7a5634");
	}
	// 村の 札
	rect(g, 84, 60, 2, 12, "#7a5634");
	rect(g, 68, 50, 34, 11, "#f4ecd8");
	text(g, KAKOLOG_ART.village, 85, 51, 8, "#5a3a1a");
	// 浜を 歩く 人（名目の 時計）
	const walkers = [
		["#c04040", "#3a2a1a"],
		["#4060c0", "#1a1a1a"],
		["#40a060", "#6a4a2a"],
		["#e0a030", "#2a2a2a"],
		["#8a50b0", "#3a2a1a"],
	] as const;
	walkers.forEach(([body, hair], i) => {
		const dir = i % 2 ? -1 : 1;
		const base = hash(i, 4) * W;
		const x = Math.floor(
			(((base + (c.still ? 0 : lt * 0.006 * dir)) % W) + W) % W,
		);
		person(g, x, 72 + (i % 3) * 5, body, hair);
	});
	// 四すみだけ 少し 暗く（フィルムでは ない）
	for (let i = 0; i < 3; i++) {
		g.fillStyle = `rgba(0, 0, 0, ${(0.12 * (1 - i / 3)).toFixed(3)})`;
		g.fillRect(i, i, W - i * 2, 1);
		g.fillRect(i, H - 1 - i, W - i * 2, 1);
		g.fillRect(i, i, 1, H - i * 2);
		g.fillRect(W - 1 - i, i, 1, H - i * 2);
	}
};

/** スタッフロール（下から 上へ。still では 止めて ならべる）。 */
const drawEd: Scene = (g, c) => {
	const { W, H, lt } = c;
	rect(g, 0, 0, W, H, "#0c0c10");
	const lines = KAKOLOG_ART.staff;
	const top = c.still ? 14 : Math.round(H + 4 - lt * 0.011);
	lines.forEach((s, i) => {
		const y = top + i * 16;
		if (y < -10 || y > H) return;
		text(g, s, W / 2, y, 8, "#e8e8e0");
	});
	const end = top + lines.length * 16 + 10;
	if (end < H - 12)
		text(g, KAKOLOG_ART.title, W / 2, Math.max(36, end), 12, F[6]);
};

// ───────────────── 枠（部屋の テレビ ＋ 壁の ヘッドホン） ─────────────────

const frame = (g: G, c: TvCtx<unknown>): void => {
	crtFrame.draw(g, c);
	// ヘッドホン（右の 壁の フックに かかっている。コードは テレビへ）
	const x = 220;
	rect(g, x + 6, 22, 3, 2, "#8a7a5a");
	g.strokeStyle = "#1c1c20";
	g.lineWidth = 2;
	g.beginPath();
	g.arc(x + 7, 36, 7, Math.PI, 0);
	g.stroke();
	rect(g, x - 2, 34, 4, 8, "#1c1c20");
	rect(g, x + 12, 34, 4, 8, "#1c1c20");
	rect(g, x - 1, 35, 1, 6, "#4a4a52");
	rect(g, x + 13, 35, 1, 6, "#4a4a52");
	for (let y = 42; y < 104; y += 2)
		rect(g, x + 14 - Math.floor((y - 42) / 10), y, 1, 1, "#1c1c20");
};

export const kakologTv = makeTv<KakologData>({
	screen: crtFrame.screen,
	frame,
	scenes: {
		card: drawCard,
		op: drawOp,
		hajime: drawHajime,
		matsuri: drawMatsuri,
		fuyu: drawFuyu,
		shokumin: drawShokumin,
		kakolog: drawKakolog,
		tsugi: drawTsugi,
		ima: drawIma,
		ed: drawEd,
	},
});
