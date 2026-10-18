// 語りが 言った 物を 地図に 描く（村の 地図。ui/village/village.ts の render。見た目だけ：保存・乱数に さわらない）。
// sceneChalk.ts（国境線）・sceneShrooms.ts（きのこ）と 同じ 型で、ほかの「文には あるのに 画面に ない」物を まとめる。
// - 場面の 物（putMark・takeMark。場面の おわりに endMarks で 消える）：
//   bathSteam … 銭湯の 屋根から 町の 上まで 広がる 湯気（第二話の つなぎ「煙突から湯気が噴きだして」）
//   seaSteam  … 港の 海から 立つ 湯気（風呂板の 語り「港の海が41.5℃になり」）
//   island    … 港に 突っこんだ 島（離島板の 語り「港が、半分島になった」。takeMark で バックして 沖へ）
//   bottles   … 招待状を つめて 流した ビン（おんたこの 語り「193本のビンにつめて、海へ流した」）
//   boats     … 首脳の 舟（おんたこの 語り「各国の首脳が、たこ焼き器をかかえて上陸してきた」）
//   bread     … パン兵が 並べた 独立記念の パン（第一話の つなぎ）
//   flag      … きのこ板に 立った 食パンの 旗（第一話の つなぎの 回想。「食べてもうた」で takeMark）
// - 町に 残る 物（生き返った 通りの 文。data/town/revival.ts の 知らせの あとから）：
//   銭湯の 並び「銭湯のえんとつから湯けむり！港の海も、まだ41.5℃！」→ 屋根の 湯気・海の 湯気
//   たこ八「鉄板に、193か国ぶんの焦げあと！」→ 鉄板の 焦げ
//   浜「浜に、島が泳いだ跡がのこってる！」→ 砂浜の 跡
//   丘の 神社「地面の下から、まだサンバ！」→ やぐら広場の 太鼓の 足もとから 立ちのぼる ♪（engine/emote.ts の 記号）

import type { SceneMark } from "../../data/story/quotes";
import type { VillageView } from "../../data/village/map";
import { drawRefInCell, getImage, loadImage } from "../../engine/assets";
import { drawEmote } from "../../engine/emote";
import { loadTown } from "../../engine/save";
import { drawWalk } from "../../engine/sprite";
import { TILE } from "../../engine/types";

export type { SceneMark };

type Cell = readonly [number, number];

/** 銭湯の 屋根の まんなか（建物は 33〜37, 26〜29。湯気は 屋根の 上はしから 立つ）。 */
export const BATH_ROOF: Cell = [35.5, 26.2];
/** たこ八の 鉄板（data/village/eateries.ts の griddle）。 */
export const GRIDDLE_AT: Cell = [25, 33];
/** 島が 突っこむ 所（桟橋 y=42 の 下の 海。港の 建物 24〜26 の 上に かかる）。 */
export const ISLAND_AT: Cell = [27.5, 44.6];
/** 首脳の 舟の 絵（RPGEN「ボート」。木の 小舟 16x16）。 */
const BOAT_ART = "sp:8HOHR4i";
/** 舟に 乗った 首脳（RPGEN の 歩行グラ：王様・マグニフィコ王・黒服男）。 */
const LEADERS = ["sa:VnfXiP", "sa:Mj7nJe", "sa:RMEetu"] as const;
/** 首脳の 舟（桟橋の 先の 両わきの 海。lead は 乗って いる 人）。 */
const BOATS: readonly { at: Cell; lead: string }[] = [
	{ at: [17.4, 49.4], lead: LEADERS[0] },
	{ at: [15.6, 50.6], lead: LEADERS[2] },
	{ at: [27.6, 50.4], lead: LEADERS[1] },
	{ at: [29.6, 48.6], lead: LEADERS[2] },
];
/** 招待状の ビン（RPGEN「ボトル」。茶色い 瓶 16x16。横に 寝かせて 浮かべる）。 */
const BOTTLE_ART = "sp:Om2cJ7y";
/** ビンを 流す 所（桟橋の 先）と、流れて いく 先（桟橋 19〜26 の 外の 海。マスの ずれ）。 */
const BOTTLE_FROM: Cell = [21, 50.6];
const BOTTLE_TO: readonly Cell[] = [
	[-5, -0.6],
	[-4, 0.3],
	[7, -0.4],
	[8.5, 0.2],
	[-7, 0],
];
/** ビンが 流れきる 長さ（ms）。 */
const BOTTLE_MS = 2600;
/** かかえた たこ焼き（品の 絵を 半分の 大きさで）。 */
const TAKOYAKI_ART = "pub:sprites/items/takoyaki.png";
/** 独立記念の パン（広場の パン兵 17,20 の 右の マス）。 */
const BREAD_AT: Cell = [18, 20];
/** 食パンの 旗（回想の パン兵が 立つ 42,18 の 左）。 */
const FLAG_AT: Cell = [41, 18];
/** 島が 泳いだ 跡（海の家 と 居酒屋の あいだの 浜。海 y=37 から 砂を えぐって 坂の 下まで。浜の 知らせで 映す 所）。 */
const TRAIL: readonly Cell[] = [
	[8, 36.75],
	[10, 36.4],
	[11.6, 36],
	[12.4, 35],
	[12.4, 33.4],
];
/** 海の 湯気を 立てる 所（桟橋の まわりの 海）。 */
const SEA_BOX = { x0: 10, x1: 40, y0: 37, y1: 51 } as const;

/** 島が 寄る・帰る 長さ（ms）。 */
const ISLAND_IN_MS = 700;
const ISLAND_OUT_MS = 1600;
const BOAT_IN_MS = 1100;

/** 見た目だけの ゆらぎ（毎回 同じ 並び）。 */
const rng = (seed: number) => {
	let a = seed >>> 0 || 1;
	return (): number => {
		a ^= a << 13;
		a ^= a >>> 17;
		a ^= a << 5;
		return (a >>> 0) / 4294967296;
	};
};

/** 丘の やぐら広場の 太鼓の 足もと（太鼓は 13,6。data/village/map.ts の YAGURA_PLAZA）。サンバは ここから 立ちのぼる。 */
const DRUM_FOOT: Cell = [13, 7];

/** 場面の 物（出した 時刻・しまいはじめた 時刻）。 */
const scene = new Map<SceneMark, { at: number; gone: number | null }>();
/** 町に 残る 物。 */
let town = { steam: false, scorch: false, trail: false, samba: false };
/** 湯気の 立つ 海の マス。 */
let seaCells: Cell[] = [];

/** 村の 地図を 組みなおした（村の 外なら null）。町に 残る 物を 決めなおす。sea は 海の マスか。 */
export const setMarksTown = (
	v: VillageView | null,
	sea: (x: number, y: number) => boolean = () => false,
): void => {
	const revived = v ? loadTown().revived : [];
	town = {
		steam: !!v?.cleared.includes("main") && revived.includes("bath"),
		scorch: !!v?.cleared.includes("konamono") && revived.includes("tako"),
		trail: !!v?.cleared.includes("tropical") && revived.includes("beach"),
		samba: !!v?.cleared.includes("festival") && revived.includes("shrine"),
	};
	const r = rng(0x41_5);
	seaCells = [];
	if (!v) return;
	for (let y = SEA_BOX.y0; y <= SEA_BOX.y1; y++)
		for (let x = SEA_BOX.x0; x <= SEA_BOX.x1; x++)
			if (sea(x, y) && r() < 0.22) seaCells.push([x, y]);
};

/** 場面に 物を 出す（もう 出て いれば そのまま）。 */
export const putMark = (m: SceneMark): void => {
	// 舟と 首脳の 絵を 先に 読む（読めるまでは 描かない。画面の ない 試験では 読まない）
	if (m === "boats" && typeof Image !== "undefined")
		for (const r of [BOAT_ART, TAKOYAKI_ART, ...LEADERS]) void loadImage(r);
	if (m === "bottles" && typeof Image !== "undefined")
		void loadImage(BOTTLE_ART);
	const now = scene.get(m);
	if (!now || now.gone !== null)
		scene.set(m, { at: performance.now(), gone: null });
};

/** 場面の 物を しまう（島は 沖へ バック、ほかは すぐ）。 */
export const takeMark = (m: SceneMark): void => {
	const now = scene.get(m);
	if (!now) return;
	if (m === "island") now.gone = performance.now();
	else scene.delete(m);
};

/** 場面が おわった（場面の 物を ぜんぶ 消す。町に 残る 物は そのまま）。 */
export const endMarks = (): void => {
	scene.clear();
};

/** いま 出て いる 場面の 物（試験用）。 */
export const marksShown = (): SceneMark[] => [...scene.keys()];

// ───────────────── 描く ─────────────────

const px = (c: Cell, ox: number, oy: number): [number, number] => [
	c[0] * TILE + TILE / 2 - ox,
	c[1] * TILE + TILE / 2 - oy,
];

/** 湯気の 粒（x, y から 上へ。rise px 昇って 消える。n 粒・幅 w）。 */
const steam = (
	g: CanvasRenderingContext2D,
	x: number,
	y: number,
	t: number,
	o: {
		n: number;
		rise: number;
		w: number;
		size: number;
		seed: number;
		/** 粒の 色（r, g, b。省けば 白い 湯気）。 */
		rgb?: string;
	},
): void => {
	for (let i = 0; i < o.n; i++) {
		const k = (t / 1700 + i / o.n + o.seed * 0.37) % 1;
		const sway = Math.sin(k * 5 + i * 1.7 + o.seed) * (2 + k * o.w * 0.4);
		const dx = ((i * 7 + o.seed * 3) % o.w) - o.w / 2 + sway;
		const r = o.size * (0.6 + k);
		g.fillStyle = `rgba(${o.rgb ?? "255, 255, 255"}, ${(0.5 * (1 - k)).toFixed(3)})`;
		g.beginPath();
		g.arc(x + dx, y - k * o.rise, r, 0, Math.PI * 2);
		g.fill();
	}
};

/** 鉄板の 焦げ（柱の 右の 絵の 下の 鉄板：マスの 左上から 1〜12, 9〜12 px。まっ黒な しみと 焦げた 玉）。 */
const scorch = (g: CanvasRenderingContext2D, ox: number, oy: number): void => {
	const x = GRIDDLE_AT[0] * TILE - ox;
	const y = GRIDDLE_AT[1] * TILE - oy;
	g.save();
	g.fillStyle = "rgba(16, 8, 2, 0.9)";
	g.fillRect(x + 1, y + 9, 12, 3);
	for (const dx of [2.5, 6, 9.5]) {
		g.fillStyle = "#2a1408";
		g.beginPath();
		g.arc(x + dx, y + 10, 1.4, 0, Math.PI * 2);
		g.fill();
	}
	g.restore();
};

/** 島が 泳いだ 跡（砂を えぐった 帯と 両はしの 盛り上がり）。 */
const trail = (g: CanvasRenderingContext2D, ox: number, oy: number): void => {
	const pts = TRAIL.map((c) => px(c, ox, oy));
	const path = () => {
		g.beginPath();
		pts.forEach(([x, y], i) => {
			if (i === 0) g.moveTo(x, y);
			else g.lineTo(x, y);
		});
	};
	g.save();
	g.lineCap = "round";
	g.lineJoin = "round";
	g.strokeStyle = "rgba(170, 130, 70, 0.4)";
	g.lineWidth = 12;
	path();
	g.stroke();
	// 島の 底が こすった 筋
	g.strokeStyle = "rgba(120, 85, 40, 0.45)";
	g.lineWidth = 1;
	for (const off of [-3, 0, 3]) {
		g.beginPath();
		pts.forEach(([x, y], i) => {
			if (i === 0) g.moveTo(x + off, y);
			else g.lineTo(x + off, y);
		});
		g.stroke();
	}
	g.restore();
};

/** ドットの 楕円（1px の 横の 帯で 塗る。x, y は 整数の 中心）。 */
const dotOval = (
	g: CanvasRenderingContext2D,
	x: number,
	y: number,
	rx: number,
	ry: number,
): void => {
	for (let dy = -ry; dy <= ry; dy++) {
		const half = Math.round(rx * Math.sqrt(1 - (dy / (ry + 0.5)) ** 2));
		g.fillRect(x - half, y + dy, half * 2 + 1, 1);
	}
};

/** ヤシの 木の ドット絵（下の まんなかが 根もと。G 濃い 葉・g 明るい 葉・t 幹・T 幹の 影・c 実）。 */
const PALM: readonly string[] = [
	"..........ggg............",
	".....gggggGGGggggg.......",
	"...ggGGGGGGgGGGGGGgg.....",
	"..gGGGGg..gGGg..gGGGGg...",
	".gGGg....gGcGGg....gGGg..",
	"gGG.....gGccc.Gg.....gGg.",
	"GG.....gG..tT..Gg......Gg",
	"G......G...tT...G.......G",
	"...........TT............",
	"............tT...........",
	"............TT...........",
	"............tT...........",
	"............TT...........",
	"...........tT............",
	"...........TT............",
	"...........tT............",
	"...........TT............",
	"..........ttTT...........",
];
/** 幹の 根もとの 列（PALM の 最後の 行）。 */
const PALM_FOOT = 11;
const PALM_INK: Record<string, string> = {
	G: "#2f7d32",
	g: "#5aa83c",
	t: "#9a6a34",
	T: "#5e3c1a",
	c: "#6b4a22",
};

/** 港に 突っこんだ 島（ドット絵。白い 波・砂・草・ヤシの 木）。k は 寄りぐあい（0 は 沖・1 は 港）。 */
const island = (
	g: CanvasRenderingContext2D,
	ox: number,
	oy: number,
	k: number,
	t: number,
): void => {
	// 地図の ドットに そろえる（場所は 整数の px で 決めてから カメラを 引く）
	const cx = Math.round(ISLAND_AT[0] * TILE + TILE / 2 + (1 - k) * 120) - ox;
	const cy = Math.round(ISLAND_AT[1] * TILE + TILE / 2) - oy;
	g.save();
	g.globalAlpha = Math.min(1, k * 1.5);
	// 白い 波（ふちが 2こまで ふくらむ）
	const surf = Math.floor(t / 220) % 2;
	g.fillStyle = "#ffffff";
	dotOval(g, cx, cy + 2, 46 + surf * 2, 26);
	g.fillStyle = "#cfeaf2";
	dotOval(g, cx, cy + 3, 43, 23);
	// 砂（下に 影の 縁）
	g.fillStyle = "#b8955a";
	dotOval(g, cx, cy + 1, 42, 22);
	g.fillStyle = "#e8cf8e";
	dotOval(g, cx, cy - 1, 41, 20);
	g.fillStyle = "#f6e3b0";
	dotOval(g, cx - 10, cy - 8, 20, 8);
	// 草（下に 濃い 縁、上に 光）
	g.fillStyle = "#33722a";
	dotOval(g, cx - 6, cy - 2, 22, 11);
	g.fillStyle = "#4f9a3c";
	dotOval(g, cx - 6, cy - 4, 21, 9);
	g.fillStyle = "#73bf52";
	dotOval(g, cx - 12, cy - 8, 9, 3);
	// ヤシの 木（根もとが 草の 右はし）
	const bx = cx + 8 - PALM_FOOT;
	const by = cy + 2 - PALM.length;
	PALM.forEach((row, y) => {
		for (let x = 0; x < row.length; x++) {
			const ink = PALM_INK[row[x]];
			if (!ink) continue;
			g.fillStyle = ink;
			g.fillRect(bx + x, by + y, 1, 1);
		}
	});
	g.restore();
};

/** 首脳の 舟（ドットの 小舟に 首脳が 立ち、たこ焼きを かかえて 南から 寄って くる）。 */
const boats = (
	g: CanvasRenderingContext2D,
	ox: number,
	oy: number,
	since: number,
	t: number,
): void => {
	const tako = getImage(TAKOYAKI_ART);
	BOATS.forEach((b, i) => {
		const k = Math.max(0, Math.min(1, (since - i * 220) / BOAT_IN_MS));
		if (k <= 0) return;
		const x = Math.round(b.at[0] * TILE - ox);
		const y = Math.round(
			b.at[1] * TILE - oy + (1 - k) * 40 + Math.sin(t / 300 + i),
		);
		// 人は 舟の 上に 立つ（足もとは 舟が かくす）。こぐ あいだは 足踏み
		drawWalk(g, b.lead, "up", k < 1 ? Math.floor(t / 250) % 2 : 0, x, y - 7);
		if (tako) g.drawImage(tako, x + 8, y + 1, 8, 8);
		drawRefInCell(g, BOAT_ART, x, y);
	});
};

/** 流した ビン（桟橋の 先から 1本ずつ 沖へ 流れて、波に ゆれる）。 */
const bottles = (
	g: CanvasRenderingContext2D,
	ox: number,
	oy: number,
	since: number,
	t: number,
): void => {
	const img = getImage(BOTTLE_ART);
	if (!img) return;
	BOTTLE_TO.forEach((d, i) => {
		const k = Math.max(0, Math.min(1, (since - i * 300) / BOTTLE_MS));
		if (k <= 0) return;
		// 流れは はじめ 速く、だんだん ゆっくり
		const e = 1 - (1 - k) * (1 - k);
		const x = (BOTTLE_FROM[0] + d[0] * e) * TILE - ox;
		const y =
			(BOTTLE_FROM[1] + d[1] * e) * TILE - oy + Math.sin(t / 260 + i * 1.3);
		g.save();
		g.translate(Math.round(x + TILE / 2), Math.round(y + TILE / 2));
		g.rotate(i % 2 ? Math.PI / 2 : -Math.PI / 2);
		g.drawImage(img, -TILE / 2, -TILE / 2);
		g.restore();
	});
};

/** 独立記念の パン（地面に 3つ）。 */
const bread = (g: CanvasRenderingContext2D, ox: number, oy: number): void => {
	const [x, y] = px(BREAD_AT, ox, oy);
	g.save();
	g.fillStyle = "#8a5a2a";
	g.fillRect(x - 8, y + 3, 16, 2);
	for (const dx of [-5, 0, 5]) {
		g.fillStyle = "#d89a4a";
		g.beginPath();
		g.ellipse(x + dx, y + 1, 3, 2.4, 0, 0, Math.PI * 2);
		g.fill();
		g.strokeStyle = "#8a5a2a";
		g.lineWidth = 0.8;
		g.beginPath();
		g.moveTo(x + dx - 1.5, y);
		g.lineTo(x + dx + 1.5, y);
		g.stroke();
	}
	g.restore();
};

/** 食パンの 旗（棒と 食パンの 形の 布）。 */
const flag = (g: CanvasRenderingContext2D, ox: number, oy: number): void => {
	const [x, y] = px(FLAG_AT, ox, oy);
	g.save();
	g.fillStyle = "#cfcfcf";
	g.fillRect(x, y - 16, 1, 22);
	g.fillStyle = "#b8742e";
	g.fillRect(x + 1, y - 16, 10, 9);
	g.fillStyle = "#f6e6c0";
	g.fillRect(x + 2, y - 15, 8, 7);
	g.restore();
};

/** 地面に 置く 物（人の 下。ox, oy は カメラ）。 */
export const drawMarksBelow = (
	g: CanvasRenderingContext2D,
	ox: number,
	oy: number,
): void => {
	const now = performance.now();
	if (town.trail) trail(g, ox, oy);
	if (town.scorch) scorch(g, ox, oy);
	const isl = scene.get("island");
	if (isl) {
		const k =
			isl.gone !== null
				? 1 - (now - isl.gone) / ISLAND_OUT_MS
				: Math.min(1, (now - isl.at) / ISLAND_IN_MS);
		if (k <= 0) scene.delete("island");
		else island(g, ox, oy, k, now);
	}
	const bt = scene.get("bottles");
	if (bt) bottles(g, ox, oy, now - bt.at, now);
	const b = scene.get("boats");
	if (b) boats(g, ox, oy, now - b.at, now);
	if (scene.has("bread")) bread(g, ox, oy);
	if (scene.has("flag")) flag(g, ox, oy);
};

/** 立ちのぼる 物（湯気。屋根と 人の 上）。 */
export const drawMarksAbove = (
	g: CanvasRenderingContext2D,
	ox: number,
	oy: number,
): void => {
	const now = performance.now();
	const bath = scene.get("bathSteam");
	if (bath || town.steam) {
		const [x, y] = px(BATH_ROOF, ox, oy);
		// 場面の 湯気は 町の 上まで（太く 高く）、町に 残る 湯気は 屋根の 上だけ
		if (bath)
			steam(g, x, y, now, { n: 26, rise: 120, w: 60, size: 6, seed: 1 });
		else steam(g, x, y, now, { n: 8, rise: 34, w: 16, size: 3, seed: 1 });
	}
	// 地面の 下の サンバ（お祭りの 語りの あと ずっと）：太鼓の 足もとから ♪ が 立ちのぼる
	if (town.samba)
		drawEmote(
			g,
			"♪",
			DRUM_FOOT[0] * TILE - 6 - ox,
			DRUM_FOOT[1] * TILE + 2 - oy,
			now,
			true,
		);
	// 焦げた 鉄板から 細い 煙（鉄板の 絵が もともと 黒いので、焦げは 煙で 見せる）
	if (town.scorch) {
		const x = GRIDDLE_AT[0] * TILE + 7 - ox;
		const y = GRIDDLE_AT[1] * TILE + 9 - oy;
		steam(g, x, y, now, {
			n: 6,
			rise: 26,
			w: 8,
			size: 2,
			seed: 3,
			rgb: "70, 64, 60",
		});
	}
	const sea = scene.has("seaSteam");
	if (sea || town.steam) {
		const vw = g.canvas.width;
		const vh = g.canvas.height;
		seaCells.forEach((c, i) => {
			const [x, y] = px(c, ox, oy);
			if (x < -20 || y < -40 || x > vw + 20 || y > vh + 20) return;
			if (!sea && i % 3) return;
			steam(g, x, y, now, {
				n: sea ? 3 : 2,
				rise: sea ? 22 : 12,
				w: 10,
				size: sea ? 3 : 2,
				seed: i,
			});
		});
	}
};
