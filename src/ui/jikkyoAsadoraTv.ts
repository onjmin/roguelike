// 朝の　スレ小説『あげは』の TV（喫茶「保守」の 壁の テレビ。ui/jikkyoWatch.ts の 板の 上の キャンバス）。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標。場面は スクリーンの 左上が 0,0）。
// - 枠：喫茶の しま模様の 壁に 掛けた テレビと、手前の カウンター（モーニングの トーストと コーヒー）。
// - 場面（data/jikkyo/asadora.ts の ASADORA_SCENES）：札（まもなく・予告）・オープニング（村の 朝日と あげは蝶・題）・
//   本編（あげはの 揚げパンの 屋台。出来事ごとに 人と 小物）・引き（その 場面に 合図ごとに 黒い 帯が 寄り、
//   ちょうどの 拍で 2倍に 寄って セピアに 止まり「つづく」）・受け（ニュースの 人）。左上に 朝の 時計（7:14 → 7:30）。
// - 凝った 絵は 本編の 屋台と 引きの「つづく」の 2つ。人は 塗りの 小さな 人（figure・person）。
// - 動きは 名目の 時計（湯気・蝶の 道・煙・雨・行列）、点滅は 実際の 時計（蝶の はばたき・硬貨と 涙の 光）。
//   動きを へらす 設定では はばたき・光・ゆれ・雨・合図の 光を 止めて 止まった 絵で 見せる。

import {
	ASADORA_ART,
	type AsadoraData,
	type AsaEv,
} from "../data/jikkyo/asadora";
import {
	bands,
	clamp01,
	type G,
	hash,
	makeTv,
	person,
	pulseGlow,
	type Screen,
	type TvCtx,
	text,
} from "./jikkyoTvKit";

type C = TvCtx<AsadoraData>;

/** 壁の テレビの 画面（240x135 の 中）。 */
const SCREEN: Screen = { x: 36, y: 10, w: 168, h: 96 };

const INK = "#2a2020";
const SKIN = "#f2c8a0";

/** 人の 色（髪・服・前かけ・頭の 布・足）。 */
type Look = {
	readonly hair: string;
	readonly body: string;
	readonly apron?: string;
	readonly cap?: string;
	readonly legs?: string;
	/** 影（顔を 描かない）。 */
	readonly shadow?: boolean;
};
const AGEHA: Look = {
	hair: "#5a3420",
	body: "#4a7ab8",
	apron: "#fafafa",
	cap: "#f08a2a",
};
const AGEHA_PLAIN: Look = { ...AGEHA, apron: undefined };
const BAA: Look = { hair: "#d8d8d8", body: "#7a5a8a" };
const KID: Look = { hair: "#3a2a2a", body: "#e05a5a" };
const TOMO: Look = { hair: "#1e1a1a", body: "#4a9a5a" };
const OOYA: Look = { hair: "#a8a8a8", body: "#6a5040" };
const KAGE: Look = {
	hair: "#16141c",
	body: "#16141c",
	legs: "#16141c",
	shadow: true,
};
const ANNA: Look = { hair: "#2a2020", body: "#5a6070" };
const ANNA2: Look = { hair: "#6a3a2a", body: "#e07890" };

/** 人（塗り。k 倍、幅 8k・高さ 14k。x,y は 左上）。 */
const figure = (g: G, x: number, y: number, k: number, f: Look): void => {
	const r = (dx: number, dy: number, w: number, h: number, col: string) => {
		g.fillStyle = col;
		g.fillRect(x + dx * k, y + dy * k, w * k, h * k);
	};
	r(2, 1, 4, 4, f.shadow ? f.hair : SKIN);
	r(2, 0, 4, 2, f.cap ?? f.hair);
	r(1, 1, 1, 3, f.hair);
	r(6, 1, 1, 3, f.hair);
	if (!f.shadow) {
		r(3, 3, 1, 1, INK);
		r(5, 3, 1, 1, INK);
	}
	r(1, 5, 6, 6, f.body);
	r(0, 6, 1, 4, f.body);
	r(7, 6, 1, 4, f.body);
	if (f.apron) r(2, 6, 4, 5, f.apron);
	r(2, 11, 1, 3, f.legs ?? "#3a3040");
	r(5, 11, 1, 3, f.legs ?? "#3a3040");
};

/** 左上の 朝の 時計（7:mm。区切りの 中で min → to）。 */
const clock = (g: G, c: C): void => {
	const d = c.data;
	if (d.min === undefined) return;
	const p = clamp01(c.lt / Math.max(1, c.seg?.dur ?? 1));
	const m = Math.min(59, Math.floor(d.min + ((d.to ?? d.min) - d.min) * p));
	g.fillStyle = "rgba(0, 0, 0, 0.45)";
	g.fillRect(2, 2, 24, 11);
	text(g, `7:${String(m).padStart(2, "0")}`, 14, 3, 8, "#ffffff");
};

/** 光る 点（点滅は 実際の 時計。動きを へらす 設定では 光った まま）。 */
const glint = (c: C, ms: number, k = 0): boolean =>
	c.still || Math.floor(c.now / ms + k) % 2 === 0;

// ───────────────── 枠（喫茶の 壁と カウンター） ─────────────────

/** しま模様の 壁紙（x,y,w,h の 中だけ）。 */
const wall = (g: G, x: number, y: number, w: number, h: number): void => {
	if (w <= 0 || h <= 0) return;
	g.fillStyle = "#e8d8a0";
	g.fillRect(x, y, w, h);
	g.fillStyle = "#dac78a";
	for (let sx = 0; sx < 240; sx += 8) {
		const a = Math.max(x, sx);
		const b = Math.min(x + w, sx + 3);
		if (b > a) g.fillRect(a, y, b - a, h);
	}
};

const cafeFrame = (g: G, c: C): void => {
	const { x, y, w, h } = SCREEN;
	const bx = x - 5;
	const by = y - 5;
	const bw = w + 10;
	const bh = h + 10;
	wall(g, 0, 0, 240, by);
	wall(g, 0, by, bx, 135 - by);
	wall(g, bx + bw, by, 240 - bx - bw, 135 - by);
	wall(g, bx, by + bh, bw, 135 - by - bh);
	// テレビの ふち（壁掛け）と 灯（本放送は 赤）
	g.fillStyle = "#26242a";
	g.fillRect(bx, by, bw, 5);
	g.fillRect(bx, y + h, bw, 5);
	g.fillRect(bx, y, 5, h);
	g.fillRect(x + w, y, 5, h);
	g.fillStyle = "#4a4850";
	g.fillRect(bx, by, bw, 1);
	g.fillStyle = c.live ? "#ff5040" : "#606060";
	g.fillRect(x + w - 6, y + h + 2, 2, 1);
	g.fillStyle = "rgba(255, 255, 255, 0.05)";
	g.fillRect(x, y, w, 3);
	// カウンター
	g.fillStyle = "#6a4a30";
	g.fillRect(0, 118, 240, 17);
	g.fillStyle = "#8a6440";
	g.fillRect(0, 116, 240, 3);
	// モーニング：皿の トースト
	g.fillStyle = "#f4f4f4";
	g.fillRect(8, 124, 30, 3);
	g.fillStyle = "#a86a30";
	g.fillRect(13, 117, 18, 8);
	g.fillStyle = "#e0aa58";
	g.fillRect(14, 118, 16, 6);
	g.fillStyle = "#fff0a0";
	g.fillRect(19, 119, 5, 2);
	// コーヒー（湯気は 名目の 時計。動きを へらす 設定では ゆれない）
	g.fillStyle = "#f4f4f4";
	g.fillRect(210, 126, 16, 2);
	g.fillRect(213, 119, 10, 7);
	g.fillRect(223, 120, 2, 4);
	g.fillStyle = "#5a3820";
	g.fillRect(214, 119, 8, 1);
	for (let i = 0; i < 3; i++) {
		const p = c.still ? i / 3 : (c.t / 1800 + i / 3) % 1;
		const sway = c.still ? 0 : Math.round(Math.sin(c.t / 400 + i * 2));
		g.fillStyle = `rgba(250, 250, 255, ${(0.95 * (1 - p)).toFixed(3)})`;
		g.fillRect(215 + i * 3 + sway, Math.round(115 - p * 12), 1, 3);
		g.fillStyle = `rgba(160, 150, 130, ${(0.5 * (1 - p)).toFixed(3)})`;
		g.fillRect(216 + i * 3 + sway, Math.round(116 - p * 12), 1, 2);
	}
};

// ───────────────── 札（まもなく・予告） ─────────────────

/** 小さな 屋台（予告・受けの モニター）。 */
const miniStall = (g: G, x: number, y: number): void => {
	for (let i = 0; i < 5; i++) {
		g.fillStyle = i % 2 ? "#fafafa" : "#f08a2a";
		g.fillRect(x + i * 6, y, 6, 5);
	}
	g.fillStyle = "#7a5030";
	g.fillRect(x + 1, y + 5, 1, 9);
	g.fillRect(x + 28, y + 5, 1, 9);
	g.fillStyle = "#a0703c";
	g.fillRect(x, y + 13, 30, 8);
	g.fillStyle = "#e0a050";
	g.fillRect(x + 6, y + 11, 4, 2);
	g.fillRect(x + 12, y + 11, 4, 2);
	person(g, x + 12, y + 3, "#4a7ab8", "#f08a2a");
};

const drawCard = (g: G, c: C): void => {
	const d = c.data;
	const { W, H } = c;
	if (d.phase === "preview") {
		bands(
			g,
			W,
			d.rain
				? ["#525c68", "#5e6874", "#6a7480", "#76808a"]
				: ["#7ac4ec", "#98d2f0", "#b8e0f4", "#e8eedc"],
			0,
			H,
		);
		if (!d.rain) {
			g.fillStyle = "#fff0a0";
			g.fillRect(140, 10, 12, 12);
		}
		g.fillStyle = d.rain ? "#7a7458" : "#d8c08a";
		g.fillRect(0, 70, W, H - 70);
		miniStall(g, 116, 50);
		if (d.rain) {
			g.fillStyle = "rgba(210, 220, 240, 0.6)";
			for (let i = 0; i < 24; i++) {
				const rx = Math.floor(hash(i, 1) * W);
				const fall = c.still ? 0 : c.lt * 0.09;
				const ry = Math.floor((hash(i, 2) * H + fall) % H);
				g.fillRect(rx, ry, 1, 4);
			}
		}
		g.fillStyle = "#c02838";
		g.fillRect(8, 18, 40, 12);
		text(g, ASADORA_ART.yokoku, 28, 20, 8, "#ffffff");
		text(g, d.card ?? "", 56, 38, 12, "#ffffff", { outline: "#2a2040" });
	} else {
		// まもなく：明けの 空と 朝日
		bands(g, W, ["#2a3a6a", "#4a5a8a", "#8a7a9a", "#d8a088", "#f4c890"], 0, H);
		const rise = c.still ? 1 : clamp01(c.lt / 5000);
		g.fillStyle = "#ffe0a0";
		g.beginPath();
		g.arc(W / 2, H - 14 - Math.round(rise * 6), 12, Math.PI, 0);
		g.fill();
		g.fillStyle = "#3a2a3a";
		g.fillRect(0, H - 14, W, 14);
		text(g, ASADORA_ART.show, W / 2, 20, 8, "#ffffff");
		text(g, ASADORA_ART.title, W / 2, 34, 12, "#ffffff", {
			outline: "#2a2040",
		});
	}
	clock(g, c);
};

// ───────────────── オープニング ─────────────────

/** あげは蝶（黄色い 羽に 黒い すじ。open で 羽を ひらく）。 */
const butterfly = (g: G, x: number, y: number, open: boolean): void => {
	const w = open ? 5 : 2;
	g.fillStyle = "#f8d040";
	g.fillRect(x - w, y - 3, w, 4);
	g.fillRect(x + 1, y - 3, w, 4);
	g.fillRect(x - w + 1, y + 1, w - 1, 3);
	g.fillRect(x + 1, y + 1, w - 1, 3);
	g.fillStyle = INK;
	g.fillRect(x, y - 2, 1, 6);
	g.fillRect(x - w, y - 3, 1, 4);
	g.fillRect(x + w, y - 3, 1, 4);
	if (open) {
		g.fillStyle = "#4a7ad8";
		g.fillRect(x - 2, y + 2, 1, 1);
		g.fillRect(x + 2, y + 2, 1, 1);
	}
};

/** 村の 屋根の 影（下の 帯）。 */
const roofs = (g: G, W: number, H: number, ink: string): void => {
	g.fillStyle = ink;
	g.fillRect(0, H - 12, W, 12);
	for (let i = 0; i < 9; i++) {
		const rx = i * 20 + Math.floor(hash(i, 9) * 8);
		const rh = 6 + Math.floor(hash(i, 8) * 8);
		for (let s = 0; s < 5; s++)
			g.fillRect(rx + s, H - 12 - rh + 5 - s, 16 - s * 2, 1);
		g.fillRect(rx, H - 12 - rh + 5, 16, rh - 5);
	}
};

const drawOp = (g: G, c: C): void => {
	const d = c.data;
	const { W, H } = c;
	const lt = c.lt;
	bands(g, W, ["#f4b080", "#f8c890", "#fcdca8", "#fdeccc", "#fef6e4"], 0, H);
	const sun = c.still ? 1 : clamp01(lt / 6000);
	g.fillStyle = "#fff4c0";
	g.beginPath();
	g.arc(146, Math.round(H - 14 - sun * 22), 10, 0, Math.PI * 2);
	g.fill();
	roofs(g, W, H, "#7a5a4a");
	// 蝶が 画面を よぎる（道は 名目の 時計、はばたきは 実際の 時計）
	const bx = c.still ? 22 : Math.round(-10 + clamp01(lt / 9000) * (W + 20));
	const by = c.still ? 64 : Math.round(62 + Math.sin(lt / 500) * 6);
	butterfly(g, bx, by, glint(c, 140));
	const a = c.still ? 1 : clamp01((lt - 1200) / 800);
	g.globalAlpha = a;
	text(g, ASADORA_ART.show, W / 2, 12, 8, "#7a3a20");
	text(g, ASADORA_ART.title, W / 2, 24, 16, "#ffffff", { outline: "#a0482a" });
	text(
		g,
		`${d.ep ?? ""}${d.sub ? `「${d.sub}」` : ""}`,
		W / 2,
		46,
		8,
		"#7a3a20",
	);
	g.globalAlpha = c.still ? 1 : clamp01((lt - 5000) / 800);
	text(g, ASADORA_ART.author, W / 2, 58, 8, "#7a3a20");
	g.globalAlpha = 1;
	clock(g, c);
};

// ───────────────── 本編（あげはの 屋台） ─────────────────

/** 揚げパンが こげて いる 出来事。 */
const burnt = (ev: AsaEv): boolean => ev === "koge" || ev === "tomo";

/** 屋台の 場面（lt は 出来事の 進み。引きでは 止めた 値）。 */
const stallScene = (g: G, c: C, ev: AsaEv, lt: number): void => {
	const { W, H } = c;
	// 空と 遠くの 山・家
	bands(g, W, ["#8ccaf0", "#a6d6f2", "#c2e2f4", "#dceef4"], 0, 48);
	g.fillStyle = "#9ac48a";
	g.fillRect(0, 38, W, 10);
	for (let i = 0; i < 6; i++) {
		const hx = 6 + i * 28 + Math.floor(hash(i, 4) * 10);
		g.fillStyle = "#f4ecdc";
		g.fillRect(hx, 36, 10, 6);
		g.fillStyle = ["#c05a4a", "#5a7ab0", "#8a6a4a"][i % 3];
		g.fillRect(hx - 1, 33, 12, 3);
	}
	// 道
	g.fillStyle = "#d8c08a";
	g.fillRect(0, 48, W, H - 48);
	g.fillStyle = "#c8ae78";
	g.fillRect(0, 48, W, 2);
	// 屋台の 柱・ひさし・看板
	g.fillStyle = "#7a5030";
	g.fillRect(54, 16, 2, 34);
	g.fillRect(118, 16, 2, 34);
	for (let i = 0; i < 10; i++) {
		g.fillStyle = i % 2 ? "#fafafa" : "#f08a2a";
		g.fillRect(48 + i * 8, 12, 8, 8);
		g.fillRect(49 + i * 8, 20, 6, 2);
	}
	g.fillStyle = "#7a5030";
	g.fillRect(64, 2, 46, 10);
	g.fillStyle = "#f6ecd0";
	g.fillRect(65, 3, 44, 8);
	if (ev !== "kanban") text(g, ASADORA_ART.sign, 87, 3, 8, "#7a3a20");
	// 前に 出る 出来事（看板・前かけ）の ほかは あげはは 台の うしろ
	const front = ev === "kanban" || ev === "maekake";
	if (!front) figure(g, 76, 24, 2, AGEHA);
	// 台と 揚げパン・鍋
	g.fillStyle = "#c08850";
	g.fillRect(50, 48, 74, 3);
	g.fillStyle = "#a0703c";
	g.fillRect(52, 51, 70, 15);
	g.fillStyle = "#8a5c30";
	for (let px = 60; px < 122; px += 10) g.fillRect(px, 51, 1, 15);
	for (let i = 0; i < 4; i++) {
		g.fillStyle = burnt(ev) ? "#3a2a20" : "#e0a050";
		g.fillRect(58 + i * 8, 45, 6, 3);
		g.fillStyle = burnt(ev) ? "#4a3a2a" : "#f0c070";
		g.fillRect(59 + i * 8, 45, 4, 1);
	}
	g.fillStyle = "#505058";
	g.fillRect(100, 40, 12, 8);
	g.fillStyle = "#707078";
	g.fillRect(99, 40, 14, 1);
	switch (ev) {
		case "kanban": {
			// 地面の 看板に 1字ずつ 書く
			const n = Math.min(4, Math.floor(lt / 2500) + 1);
			g.fillStyle = "#7a5030";
			g.fillRect(12, 54, 36, 14);
			g.fillStyle = "#f6ecd0";
			g.fillRect(13, 55, 34, 12);
			text(g, ASADORA_ART.sign.slice(0, n), 14, 57, 8, "#7a3a20", {
				align: "left",
			});
			figure(g, 50, 42, 2, AGEHA);
			g.fillStyle = "#7a5030";
			g.fillRect(46, 56, 4, 1);
			g.fillStyle = INK;
			g.fillRect(44, 56, 2, 1);
			break;
		}
		case "maekake": {
			// ばあちゃんが 古い 前かけを わたす（半分で あげはが 着る）
			const given = lt > 6000;
			figure(g, 16, 42, 2, BAA);
			figure(g, 48, 42, 2, given ? AGEHA : AGEHA_PLAIN);
			if (!given) {
				g.fillStyle = "#e8d8b8";
				g.fillRect(32, 54, 8, 8);
				g.fillStyle = "#f08a2a";
				g.fillRect(34, 58, 4, 2);
			}
			break;
		}
		case "kyaku": {
			// 小さな 子が 硬貨を さしだす
			figure(g, 64, 58, 1, KID);
			g.fillStyle = KID.body;
			g.fillRect(71, 59, 1, 4);
			if (glint(c, 300)) {
				g.fillStyle = "#ffe060";
				g.fillRect(71, 57, 2, 2);
			}
			break;
		}
		case "koin": {
			// はじめての お金を 柱に かざる・涙が 光る
			g.fillStyle = "#c09040";
			g.fillRect(122, 24, 10, 10);
			g.fillStyle = "#f6ecd0";
			g.fillRect(123, 25, 8, 8);
			g.fillStyle = "#e8c040";
			g.fillRect(125, 27, 4, 4);
			g.fillStyle = glint(c, 420) ? "#8ad0ff" : "#5aa0e0";
			g.fillRect(82, 32, 1, 2);
			break;
		}
		case "koge": {
			// 鍋から 黒い 煙（名目の 時計で のぼる）
			for (let i = 0; i < 3; i++) {
				const p = c.still ? i / 3 : (lt / 1500 + i / 3) % 1;
				g.fillStyle = `rgba(60, 56, 60, ${(0.8 * (1 - p)).toFixed(3)})`;
				g.fillRect(
					102 + Math.round(Math.sin(p * 6 + i) * 3),
					Math.round(34 - p * 28),
					8,
					5,
				);
			}
			break;
		}
		case "tomo": {
			// 幼なじみが こげた パンを ほおばる
			figure(g, 30, 42, 2, TOMO);
			g.fillStyle = "#3a2a20";
			g.fillRect(36, 52, 5, 3);
			break;
		}
		case "kage":
			// 知らない 人の 影
			figure(g, 138, 40, 2, KAGE);
			g.fillRect(136, 40, 20, 2);
			break;
		case "tegami":
			// 大家さんの 手紙
			figure(g, 16, 42, 2, OOYA);
			g.fillStyle = "#ffffff";
			g.fillRect(32, 54, 9, 6);
			g.fillStyle = "#c02838";
			g.fillRect(36, 56, 2, 2);
			break;
		case "retsu": {
			// 道に 行列が のびる
			const n = c.still ? 5 : Math.min(5, 1 + Math.floor(lt / 1500));
			const cols = ["#5a7ab0", "#c05a4a", "#6a9a4a", "#8a5a8a", "#c0a040"];
			for (let i = 0; i < n; i++)
				person(g, 128 + i * 8, 54 + (i % 2), cols[i], "#2a2020");
			break;
		}
	}
};

const drawMise = (g: G, c: C): void => {
	stallScene(g, c, c.data.ev ?? "kanban", c.lt);
	clock(g, c);
};

// ───────────────── 引き（つづく） ─────────────────

/** 寄る ところ（引きの 出来事ごと）。 */
const FOCUS: Partial<Record<AsaEv, readonly [number, number]>> = {
	kage: [146, 46],
	tegami: [36, 50],
	retsu: [146, 60],
};

const drawTsuzuku = (g: G, c: C): void => {
	const d = c.data;
	const { W, H } = c;
	const ev = d.ev ?? "kage";
	const exact = d.exact ?? Number.POSITIVE_INFINITY;
	const beat = d.beat ?? 800;
	const done = d.phase === "after" || c.t >= exact;
	if (done) {
		// ちょうどの 拍：2倍に 寄って 止まる（にじまない 整数の 倍）
		const [fx, fy] = FOCUS[ev] ?? [W / 2, H / 2];
		const tx = Math.round(Math.max(-W, Math.min(0, W / 2 - 2 * fx)));
		const ty = Math.round(Math.max(-H, Math.min(0, H / 2 - 2 * fy)));
		g.save();
		g.translate(tx, ty);
		g.scale(2, 2);
		stallScene(g, c, ev, 99999);
		g.restore();
		g.fillStyle = "rgba(120, 78, 30, 0.42)";
		g.fillRect(0, 0, W, H);
	} else {
		stallScene(g, c, ev, 99999);
		g.fillStyle = `rgba(20, 16, 24, ${(0.25 * clamp01(c.lt / 3000)).toFixed(3)})`;
		g.fillRect(0, 0, W, H);
	}
	// 合図ごとに 黒い 帯が 寄る（名目の 時計で 数える）
	const n = done
		? 3
		: d.phase === "cue"
			? Math.max(
					0,
					Math.min(3, Math.floor((c.t - (exact - 3 * beat)) / beat) + 1),
				)
			: 0;
	g.fillStyle = "#000000";
	g.fillRect(0, 0, W, n * 6);
	g.fillRect(0, H - n * 6, W, n * 6);
	const glow = pulseGlow(c);
	if (glow > 0 && !done) {
		g.fillStyle = `rgba(255, 255, 255, ${(0.4 * glow).toFixed(3)})`;
		g.fillRect(0, 0, W, H);
	}
	if (done)
		text(g, ASADORA_ART.tsuzuku, W - 8, H - 16, 12, "#ffffff", {
			align: "right",
			outline: "#5a3a1a",
		});
	clock(g, c);
};

// ───────────────── 受け（ニュースの 人） ─────────────────

const drawNews = (g: G, c: C): void => {
	const d = c.data;
	const { W, H } = c;
	bands(g, W, ["#1e3a6a", "#24427a", "#2a4a84", "#30528e"], 0, H);
	// うしろの モニター（いまの ドラマ）
	g.fillStyle = "#101820";
	g.fillRect(104, 10, 52, 36);
	g.fillStyle = "#b8e0f4";
	g.fillRect(106, 12, 48, 32);
	g.fillStyle = "#d8c08a";
	g.fillRect(106, 36, 48, 8);
	miniStall(g, 115, 18);
	// ふたりの ニュースの 人
	figure(g, 26, 30, 2, ANNA);
	figure(g, 62, 30, 2, ANNA2);
	if (d.face === 1) {
		// 涙を ふく ハンカチ
		g.fillStyle = ANNA.body;
		g.fillRect(38, 39, 2, 6);
		g.fillStyle = "#ffffff";
		g.fillRect(35, 35, 5, 4);
	} else if (d.face === 2) {
		// 揚げパンを 手に
		g.fillStyle = "#e0a050";
		g.fillRect(40, 44, 6, 3);
	} else {
		g.fillStyle = INK;
		g.fillRect(32, 40, 4, 1);
	}
	// 机
	g.fillStyle = "#e8e8f0";
	g.fillRect(0, 56, W, 4);
	g.fillStyle = "#c8ccd8";
	g.fillRect(0, 60, W, H - 60);
	text(g, ASADORA_ART.news, 52, 63, 8, "#2a4a84");
	clock(g, c);
};

export const asadoraTv = makeTv<AsadoraData>({
	screen: SCREEN,
	frame: cafeFrame,
	scenes: {
		card: drawCard,
		op: drawOp,
		mise: drawMise,
		tsuzuku: drawTsuzuku,
		news: drawNews,
	},
});
