// 街の 人通り（作者の 指示「街にも 人を 配置」「人流も 表現」）。
//
// 町の 段で 人が ふえ（殺風景の 村は だれも 来ない → 都市は にぎわう）、端末の 時刻で 流れが かわる
// （朝は 家や 駅から 職場へ・昼は 店と 散歩・夕方は 帰り道・夜は 盛り場・深夜は まばら。週末は 遊びに 出る）。
// 人は 扉・家・村の 出口から 出てきて、別の 扉・家・出口へ 歩いて 入る（消える）。掲示板・ベンチ・バス停などでは
// しばらく 立ちどまって、また 歩きだす（バス停・タクシー乗り場は 乗って いく）。
// 歩くのは 歩道・広場・村の 道（新市街の 車道は 横断歩道で わたる。電柱などを よける ときだけ 1歩 はみ出す）。
// 動かすのは ui/villageCrowd.ts（キリコも 村の 人も ふさがない）。話しかけると 1窓。強さには 効かない。

import type { TileDef } from "../../engine/defs";
import { DIR_VEC, type Dir } from "../../engine/types";
import { facilitiesAt, facilityOfDoor } from "./facilities";
import {
	type Cell,
	carLane,
	layoutStage,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "./map";

// ───────────────── 時間帯 ─────────────────

/** 時間帯（深夜 0〜4・朝 5〜9・昼 10〜16・夕方 17〜19・夜 20〜23 時）。 */
export type TimeBand = "late" | "morning" | "day" | "evening" | "night";

export const timeBand = (hour: number): TimeBand =>
	hour < 5
		? "late"
		: hour < 10
			? "morning"
			: hour < 17
				? "day"
				: hour < 20
					? "evening"
					: "night";

/** 町の 段ごとの 人の 数（昼の 平日。殺風景の 村 0〜1 は だれも 来ない）。 */
export const CROWD_BASE: readonly number[] = [0, 0, 2, 3, 6, 8, 13, 22];

const BAND_RATE: Record<TimeBand, number> = {
	late: 0.35,
	morning: 1,
	day: 0.85,
	evening: 1,
	night: 0.7,
};

/** その 段・時間帯・曜日の 人の 数。 */
export const crowdSize = (
	stage: number,
	band: TimeBand,
	weekend: boolean,
): number => {
	const base = CROWD_BASE[Math.max(0, Math.min(CROWD_BASE.length - 1, stage))];
	if (!base) return 0;
	// 都市の 夜は 盛り場が にぎわう
	const rate = band === "night" && stage >= 7 ? 0.9 : BAND_RATE[band];
	return Math.max(1, Math.round(base * rate * (weekend ? 1.15 : 1)));
};

// ───────────────── 行き先 ─────────────────

/**
 * 行き先の 種類。home 家・work 職場・care 病院・shop 店・food 飲食店・fun 遊び場・hall 本館・transit 駅・
 * edge 村の 出口（村の 外に 住む 人・よその 板から 来る 人）・rest 立ちどまる 所・wait 乗り物を 待つ 所。
 */
export type CrowdKind =
	| "home"
	| "work"
	| "care"
	| "shop"
	| "food"
	| "fun"
	| "hall"
	| "transit"
	| "edge"
	| "rest"
	| "wait";

export type CrowdNode = {
	id: string;
	at: Cell;
	kind: CrowdKind;
	/** 着いたら 中へ 入って 消える・ここから 出てくる（扉・家・出口）。 */
	enter: boolean;
	/** 立ちどまる 所：向き と 立つ ms。 */
	face?: Dir;
	stay?: readonly [number, number];
	/** 立ったあと 乗って いく（消える。バス停・タクシー乗り場）。 */
	board?: boolean;
};

/** 施設の 扉の 行き先（data/village/facilities.ts の id。のっていない 施設には 人は 入らない）。 */
const FACILITY_KIND: Record<string, CrowdKind> = {
	umi: "food",
	go: "fun",
	koban: "work",
	fire: "work",
	konbini: "shop",
	clinic: "care",
	dojo: "fun",
	pawn: "shop",
	recycle: "shop",
	garage: "work",
	arcade: "fun",
	gym: "fun",
	bar: "fun",
	ramen: "food",
	famires: "food",
	police: "work",
	hospital: "care",
	firestation: "work",
	court: "work",
	repair: "work",
	cinema: "fun",
	theater: "fun",
	casino: "fun",
	station: "transit",
	harbor: "work",
	soba: "food",
	gyudon: "food",
	izakaya: "food",
	sushi: "food",
	chuka: "food",
	townhall: "work",
	cityhall: "work",
};

/** 町の まんなかの 扉（小屋・倉庫・常識堂の 奥は 住人の 所なので 入らない）。 */
const CORE_DOOR_KIND: Record<string, CrowdKind> = {
	door_hall_0: "hall",
	door_hall_1: "hall",
	door_cafe: "food",
	door_music: "fun",
	door_books: "shop",
	door_bath: "fun",
};

type Spot = {
	id: string;
	at: Cell;
	face: Dir;
	kind: "rest" | "wait";
	from: number;
	until?: number;
	stay: readonly [number, number];
	board?: boolean;
};

const S = 1000;
/**
 * 立ちどまる 所（町の 段の from〜until）。まとめ掲示板を 読む・神社に お参り・浜で 海を 見る・
 * 自販機で 飲む・バス停で 待つ・広場の 時計の 下で 待ち合わせ・公園の 噴水の まわり。
 */
const SPOTS: readonly Spot[] = [
	{
		id: "board_0",
		at: [15, 22],
		face: "up",
		kind: "rest",
		from: 2,
		stay: [6 * S, 14 * S],
	},
	{
		id: "board_1",
		at: [16, 22],
		face: "up",
		kind: "rest",
		from: 4,
		stay: [6 * S, 14 * S],
	},
	{
		id: "shrine",
		at: [3, 10],
		face: "up",
		kind: "rest",
		from: 2,
		stay: [4 * S, 9 * S],
	},
	{
		id: "beach_0",
		at: [28, 34],
		face: "down",
		kind: "rest",
		from: 2,
		stay: [8 * S, 20 * S],
	},
	{
		id: "beach_1",
		at: [6, 36],
		face: "down",
		kind: "rest",
		from: 3,
		stay: [8 * S, 20 * S],
	},
	{
		id: "vend_beach",
		at: [11, 36],
		face: "up",
		kind: "rest",
		from: 2,
		stay: [3 * S, 6 * S],
	},
	{
		id: "bus_0",
		at: [30, 20],
		face: "up",
		kind: "wait",
		from: 6,
		until: 7,
		stay: [8 * S, 20 * S],
		board: true,
	},
	{
		id: "bus_1",
		at: [29, 20],
		face: "up",
		kind: "wait",
		from: 6,
		until: 7,
		stay: [8 * S, 20 * S],
		board: true,
	},
	{
		id: "vend_bus",
		at: [32, 21],
		face: "up",
		kind: "rest",
		from: 6,
		stay: [3 * S, 6 * S],
	},
	{
		id: "taxi",
		at: [33, 21],
		face: "up",
		kind: "wait",
		from: 7,
		stay: [6 * S, 14 * S],
		board: true,
	},
	{
		id: "clock",
		at: [24, 23],
		face: "down",
		kind: "wait",
		from: 7,
		stay: [8 * S, 18 * S],
	},
	{
		id: "fountain_w",
		at: [33, 15],
		face: "right",
		kind: "rest",
		from: 7,
		stay: [8 * S, 18 * S],
	},
	{
		id: "fountain_e",
		at: [37, 15],
		face: "left",
		kind: "rest",
		from: 7,
		stay: [8 * S, 18 * S],
	},
	{
		id: "fountain_n",
		at: [35, 13],
		face: "down",
		kind: "rest",
		from: 7,
		stay: [8 * S, 18 * S],
	},
	{
		id: "konbini",
		at: [45, 30],
		face: "up",
		kind: "rest",
		from: 4,
		stay: [4 * S, 9 * S],
	},
	{
		id: "arcade",
		at: [75, 30],
		face: "up",
		kind: "rest",
		from: 6,
		stay: [5 * S, 12 * S],
	},
	{
		id: "station_0",
		at: [81, 19],
		face: "down",
		kind: "wait",
		from: 7,
		stay: [6 * S, 14 * S],
	},
	{
		id: "station_1",
		at: [84, 19],
		face: "down",
		kind: "wait",
		from: 7,
		stay: [6 * S, 14 * S],
	},
];

/** その 地図の 行き先（扉・家・出口・立ちどまる 所）。 */
export const crowdNodes = (v: VillageView): CrowdNode[] => {
	const stage = layoutStage(v);
	const out: CrowdNode[] = [];
	for (const p of villagePlaces(v)) {
		if (p.trigger !== "touch") continue;
		if (p.exit) {
			out.push({ id: p.id, at: [p.x, p.y], kind: "edge", enter: true });
			continue;
		}
		const f = facilityOfDoor(p.id);
		const kind = f ? FACILITY_KIND[f.id] : CORE_DOOR_KIND[p.id];
		if (kind) out.push({ id: p.id, at: [p.x, p.y], kind, enter: true });
	}
	// 住宅街の 家（入れない 家。表札の 1つ下から 上を 向いて 入る）
	for (const f of facilitiesAt(stage)) {
		if (!f.id.startsWith("house_")) continue;
		const plate = f.outdoor?.[0]?.at;
		if (plate)
			out.push({
				id: `home_${f.id}`,
				at: [plate[0], plate[1] + 1],
				kind: "home",
				enter: true,
				face: "up",
			});
	}
	for (const s of SPOTS)
		if (stage >= s.from && (s.until === undefined || stage < s.until))
			out.push({
				id: `spot_${s.id}`,
				at: s.at,
				kind: s.kind,
				enter: false,
				face: s.face,
				stay: s.stay,
				board: s.board,
			});
	return out;
};

/** 試験用：立ちどまる 所の 一覧（段の 幅つき）。 */
export const CROWD_SPOTS = SPOTS;

// ───────────────── 歩く 道 ─────────────────

/** マスの 歩きにくさ（Infinity は 通れない）。 */
export type PedCost = (x: number, y: number) => number;

/** 町の まんなかの 車の 通る 道（住宅街から アスファルト）。歩道が あれば そちらを 歩く。 */
const ROADWAY = new Set(["ゑ", "ヴ", "ろ", "ゐ", "ら", "り", "ヰ", "ヱ"]);
const ROAD_COST = 1.8;
/** 新市街の 車道（横断歩道の ほかは まず 歩かない。歩道を ふさぐ 警報機などを よける 1歩だけ）。 */
const LANE_COST = 12;
/** 曲がる たびに 足す（同じ 長さなら まっすぐな 道を えらぶ。広場を ジグザグに 歩かない）。 */
const TURN_COST = 0.6;

/**
 * 通行人の 歩きにくさ。通れない 地形と 置物（walls）は 通れない。新市街の 車道は ほぼ 歩かない・
 * 町の まんなかの 車道は 歩けるが 遠回り あつかい。
 */
export const pedCost = (
	rows: readonly string[],
	tiles: Record<string, TileDef | undefined>,
	stage: number,
	walls: (x: number, y: number) => boolean,
): PedCost => {
	const w = Math.max(...rows.map((r) => [...r].length));
	const h = rows.length;
	const grid = rows.map((r) => [...r]);
	return (x, y) => {
		if (x < 0 || y < 0 || x >= w || y >= h) return Number.POSITIVE_INFINITY;
		const ch = grid[y][x] ?? " ";
		if (!tiles[ch]?.passable || walls(x, y)) return Number.POSITIVE_INFINITY;
		if (carLane(stage, x, y)) return LANE_COST;
		if (ROADWAY.has(ch) || (ch === "." && stage >= 6)) return ROAD_COST;
		return 1;
	};
};

const DIRS: readonly Dir[] = ["up", "right", "down", "left"];

/**
 * from から to への 道（歩きにくさの 和が いちばん 小さい。曲がるのは 少なめ）。to は 通れない マス（扉・出口）でも 着ける。
 * 道が なければ null。
 */
export const pedRoute = (
	w: number,
	h: number,
	cost: PedCost,
	[sx, sy]: Cell,
	[tx, ty]: Cell,
): Dir[] | null => {
	if (sx === tx && sy === ty) return [];
	const n = w * h * 4;
	const dist = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
	const prev = new Int32Array(n).fill(-1);
	// 小さい 順の ヒープ（[距離, 状態]）
	const heap: [number, number][] = [];
	const push = (d: number, s: number) => {
		heap.push([d, s]);
		let i = heap.length - 1;
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (heap[p][0] <= heap[i][0]) break;
			[heap[p], heap[i]] = [heap[i], heap[p]];
			i = p;
		}
	};
	const pop = (): [number, number] | undefined => {
		const top = heap[0];
		const last = heap.pop();
		if (heap.length && last) {
			heap[0] = last;
			let i = 0;
			for (;;) {
				const l = i * 2 + 1;
				const r = l + 1;
				let m = i;
				if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
				if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
				if (m === i) break;
				[heap[m], heap[i]] = [heap[i], heap[m]];
				i = m;
			}
		}
		return top;
	};
	const state = (x: number, y: number, d: number) => (y * w + x) * 4 + d;
	for (let d = 0; d < 4; d++) {
		const v = DIR_VEC[DIRS[d]];
		const nx = sx + v.dx;
		const ny = sy + v.dy;
		const goal = nx === tx && ny === ty;
		const c = goal ? 1 : cost(nx, ny);
		if (!Number.isFinite(c)) continue;
		const s = state(nx, ny, d);
		if (c < dist[s]) {
			dist[s] = c;
			push(c, s);
		}
	}
	let found = -1;
	for (let top = pop(); top; top = pop()) {
		const [d0, s] = top;
		if (d0 > dist[s]) continue;
		const cell = s >> 2;
		const x = cell % w;
		const y = (cell - x) / w;
		if (x === tx && y === ty) {
			found = s;
			break;
		}
		const din = s & 3;
		for (let d = 0; d < 4; d++) {
			// 来た 道を すぐ もどらない
			if ((d + 2) % 4 === din) continue;
			const v = DIR_VEC[DIRS[d]];
			const nx = x + v.dx;
			const ny = y + v.dy;
			const goal = nx === tx && ny === ty;
			const c = goal ? 1 : cost(nx, ny);
			if (!Number.isFinite(c)) continue;
			const nd = d0 + c + (d === din ? 0 : TURN_COST);
			const ns = state(nx, ny, d);
			if (nd < dist[ns]) {
				dist[ns] = nd;
				prev[ns] = s;
				push(nd, ns);
			}
		}
	}
	if (found < 0) return null;
	const route: Dir[] = [];
	for (let s = found; s >= 0; s = prev[s]) route.push(DIRS[s & 3]);
	return route.reverse();
};

/** 村の 地図の 歩きにくさ（試験と 同じ 作り方。置物と 扉・出口は 通れない。endpoints は 着ける）。 */
export const villagePedCost = (v: VillageView): PedCost => {
	const places = villagePlaces(v);
	const walls = new Set(
		places
			.filter((p) => p.trigger === "touch" || !!p.sprite)
			.map((p) => `${p.x},${p.y}`),
	);
	return pedCost(villageRows(v), villagePalette(v), layoutStage(v), (x, y) =>
		walls.has(`${x},${y}`),
	);
};

// ───────────────── 歩く 人 ─────────────────

export type PersonaId =
	| "worker"
	| "student"
	| "local"
	| "elder"
	| "nanashi"
	| "nurse"
	| "dajare";

type Flow = readonly [from: CrowdKind, to: CrowdKind, w: number];

export type Persona = {
	id: PersonaId;
	/** 名前欄。 */
	label: string;
	/** 歩行グラ（RPGEN。下の 敵・村の 名前の ある 人と 同じ 絵は 使わない）。 */
	sprites: readonly string[];
	/** 1マス 歩く ms（この あいだで ばらける）。 */
	ms: readonly [number, number];
	/** 時間帯ごとの 出やすさ（週末は weekend を かける）。 */
	share: Record<TimeBand, number>;
	weekend: number;
	/** 時間帯ごとの 流れ（どこから どこへ）。 */
	flows: Record<TimeBand, readonly Flow[]>;
	lines: readonly string[];
	/** その 時間帯だけの ひとこと（あれば 半分は こちら）。 */
	bandLines: Partial<Record<TimeBand, readonly string[]>>;
};

/** 名無し（おんJ民。本館の 名無しと 同じ 絵）。 */
const NANASHI_WALKS = ["sa:xjuotB", "sa:qPN3cT", "sa:C2hS8U", "sa:VaBXqn"];

export const PERSONAS: readonly Persona[] = [
	{
		id: "worker",
		label: "会社員",
		// RPGEN「サラリーマン1・2」
		sprites: ["sa:Rn1eai", "sa:dID4NE"],
		ms: [190, 230],
		share: { late: 0.5, morning: 3, day: 1.2, evening: 3, night: 1.2 },
		weekend: 0.3,
		flows: {
			morning: [
				["home", "work", 3],
				["transit", "work", 2],
				["home", "transit", 2],
				["home", "wait", 1],
			],
			day: [
				["work", "food", 2],
				["food", "work", 2],
				["work", "shop", 1],
				["shop", "work", 1],
				["work", "work", 1],
			],
			evening: [
				["work", "home", 3],
				["work", "transit", 2],
				["work", "food", 1],
				["work", "wait", 1],
				["work", "fun", 1],
			],
			night: [
				["food", "home", 2],
				["fun", "home", 2],
				["transit", "home", 1],
				["work", "home", 1],
				["work", "fun", 1],
			],
			late: [
				["fun", "home", 2],
				["work", "home", 1],
				["transit", "home", 1],
			],
		},
		lines: [
			"定時で　帰るンゴ。\n……今日こそは",
			"保守　お疲れさん。\nワイは　会社の　保守や",
			"昼休みに　スレ　見るのが\nいちばんの　楽しみなんや",
			"会議が　長すぎて\n実況　見逃したわ",
			"有給？　ああ、\nそんなのも　あったな",
			"この町、だいぶ　ひらけたな。\n通うのが　楽に　なったわ",
		],
		bandLines: {
			morning: ["遅刻や！　遅刻やで！", "おはようやで。\n……眠いンゴ"],
			evening: ["やっと　終わった……\n帰って　実況や"],
			night: ["一杯　ひっかけて\n帰るで", "明日も　仕事か……\n草も　生えん"],
			late: ["こんな　時間まで\n残業や。草も　生えん"],
		},
	},
	{
		id: "student",
		label: "学生",
		// RPGEN「男の子・女の子（ポケモンRS）」「男の子2・女の子2」「優しい少年」
		sprites: ["sa:XW7bn0", "sa:zBfcrg", "sa:0JtTLF", "sa:CliSpf", "sa:mLHxrK"],
		ms: [170, 210],
		share: { late: 0, morning: 1.5, day: 0.6, evening: 1.5, night: 0.3 },
		weekend: 3,
		flows: {
			morning: [
				["home", "transit", 2],
				["home", "wait", 1],
				["home", "edge", 2],
			],
			day: [
				["home", "fun", 2],
				["fun", "home", 1],
				["home", "rest", 2],
				["edge", "fun", 1],
				["shop", "fun", 1],
				["home", "food", 1],
			],
			evening: [
				["fun", "home", 2],
				["edge", "home", 2],
				["transit", "home", 1],
				["shop", "home", 1],
			],
			night: [
				["fun", "home", 2],
				["food", "home", 1],
			],
			late: [],
		},
		lines: [
			"宿題？　スレ　見てたら\n終わらなかった",
			"ゲーセンで　連コインして\nお小遣い　なくなった",
			"おんJって　知ってる？\n親には　ないしょやで",
			"この前　1000　とったで！\n……うそやけど",
			"お姉ちゃん、\nその　蓄音機　なに？",
			"放課後は　グラウンドで\n野球するんや",
		],
		bandLines: {
			morning: ["やばい、遅刻や！"],
			evening: ["暗く　なる前に\n帰らんと　怒られる"],
			night: ["塾の　帰りなんや。\n……つかれた"],
		},
	},
	{
		id: "local",
		label: "住人",
		// RPGEN「通行人」「女村人」「青年ブラウン」「赤い少女」
		sprites: ["sa:y9WrTy", "sa:gb0HD8", "sa:RH1eyq", "sa:jkswZA"],
		ms: [200, 250],
		share: { late: 0.3, morning: 1, day: 2.5, evening: 1.5, night: 0.8 },
		weekend: 1.3,
		flows: {
			morning: [
				["home", "shop", 1],
				["home", "rest", 2],
				["home", "hall", 1],
			],
			day: [
				["home", "shop", 3],
				["shop", "home", 3],
				["home", "food", 1],
				["home", "rest", 1],
				["home", "care", 1],
				["home", "hall", 1],
			],
			evening: [
				["shop", "home", 2],
				["home", "shop", 1],
				["home", "food", 1],
			],
			night: [
				["home", "food", 1],
				["food", "home", 1],
				["home", "rest", 1],
			],
			late: [["food", "home", 1]],
		},
		lines: [
			"今日は　なにを\n作ろうかしら",
			"最近、店が　ふえて\nにぎやかに　なったわね",
			"からあげには　レモン？\n……うちは　かけない派よ",
			"散歩や。\n……保守は　健康にも　ええで",
			"この村、むかしは\nだれも　おらんかったんやて",
			"特売、まにあうかな",
			"遠くへ　行くなら\nトロッコが　早いで",
		],
		bandLines: {
			night: ["夜風が　気持ちええなあ"],
			late: ["眠れなくてな。\n……ちょっと　歩いとる"],
		},
	},
	{
		id: "elder",
		label: "おばあさん",
		// RPGEN「婆さん」
		sprites: ["sa:fUn9JD"],
		ms: [260, 320],
		share: { late: 0, morning: 1.5, day: 1.5, evening: 0.5, night: 0.1 },
		weekend: 1,
		flows: {
			morning: [
				["home", "rest", 3],
				["home", "care", 2],
			],
			day: [
				["home", "rest", 2],
				["care", "home", 2],
				["home", "hall", 1],
				["home", "shop", 1],
			],
			evening: [
				["care", "home", 1],
				["shop", "home", 1],
			],
			night: [["home", "rest", 1]],
			late: [],
		},
		lines: [
			"わたしの　若いころはね、\nみんな　2ch　だったのよ",
			"孫が　おんJに\n入りびたってるの。……わたしもよ",
			"ゆっくり　歩くのも\nいいものよ",
			"人が　ふえたわねえ。\n……保守した　かいが　あったわ",
		],
		bandLines: {
			morning: ["朝の　散歩は\n欠かせないのよ"],
		},
	},
	{
		id: "nanashi",
		label: "名無し",
		sprites: NANASHI_WALKS,
		ms: [180, 230],
		share: { late: 2, morning: 1, day: 1.2, evening: 1.2, night: 2 },
		weekend: 1.2,
		flows: {
			morning: [
				["edge", "hall", 2],
				["hall", "edge", 1],
				["edge", "rest", 1],
			],
			day: [
				["edge", "hall", 2],
				["hall", "edge", 2],
				["transit", "hall", 1],
				["hall", "fun", 1],
				["hall", "rest", 1],
				["fun", "hall", 1],
				["food", "hall", 1],
			],
			evening: [
				["edge", "hall", 2],
				["transit", "hall", 2],
				["hall", "food", 1],
				["hall", "rest", 1],
			],
			night: [
				["edge", "hall", 3],
				["transit", "hall", 1],
				["hall", "fun", 1],
				["fun", "hall", 1],
				["hall", "food", 1],
			],
			late: [
				["hall", "edge", 2],
				["edge", "hall", 1],
				["hall", "food", 1],
			],
		},
		lines: [
			"本館で　実況　見てくるわ",
			"ワイ、名無し。\n名前は　まだ　ない",
			"スレ立て　代行　まだかいな",
			"保守。\n……言うてみた　だけや",
			"なんか　ここ、\n居心地　ええな",
			"ワイも　この村に\n住もうかな",
			"トロッコ　乗ったか？\n速すぎて　草",
		],
		bandLines: {
			night: ["実況は　夜が\n本番やで"],
			late: ["深夜の　スレは\nなんか　落ちつくんや"],
		},
	},
	{
		id: "nurse",
		label: "看護師",
		// RPGEN「ナース」
		sprites: ["sa:Ksa5dI"],
		ms: [180, 220],
		share: { late: 0.3, morning: 0.4, day: 0.3, evening: 0.4, night: 0.3 },
		weekend: 1,
		flows: {
			morning: [
				["home", "care", 2],
				["care", "home", 1],
				["transit", "care", 1],
			],
			day: [
				["care", "food", 1],
				["food", "care", 1],
			],
			evening: [
				["care", "home", 2],
				["care", "transit", 1],
			],
			night: [["home", "care", 1]],
			late: [["care", "home", 1]],
		},
		lines: [
			"体には　気をつけてね。\n無理は　禁物よ",
			"病院では　お静かに。\n……実況は　ほどほどに",
		],
		bandLines: {
			morning: ["夜勤明けなの。\n……おやすみなさい"],
		},
	},
	{
		// ダジャレニキ（おんJwiki pages/59 の 型「そうそう〇〇……って それは ××やないかーい！ｗｗ」。だじゃれは 新しく 書いた）。
		// たまに しか 歩いていない（data/folk.ts の 名物の ひとり）
		id: "dajare",
		label: "ダジャレニキ",
		// RPGEN「父」（ほかの 人・敵・店番と かぶらない。src/sim/folkTests.ts の F10）
		sprites: ["sa:2GAYAx"],
		ms: [200, 240],
		share: { late: 0.1, morning: 0.2, day: 0.5, evening: 0.4, night: 0.3 },
		weekend: 1.2,
		flows: {
			morning: [
				["edge", "hall", 1],
				["home", "rest", 1],
			],
			day: [
				["home", "rest", 2],
				["edge", "hall", 1],
				["hall", "food", 1],
				["food", "home", 1],
			],
			evening: [
				["hall", "food", 1],
				["edge", "rest", 1],
				["fun", "home", 1],
			],
			night: [
				["hall", "fun", 1],
				["food", "home", 1],
				["edge", "hall", 1],
			],
			late: [["hall", "edge", 1]],
		},
		lines: [
			"そうそう　安価……\nって　それは　あんかけやないかーい！ｗｗ",
			"そうそう　トロッコの　乗り場……\nって　トロと　海苔巻きやないかーい！ｗｗ",
			"そうそう　まとめ掲示板……\nって　それは　まとめ買いやないかーい！ｗｗ",
			"そうそう　キリ番　ゲット……\nって　キリンの　ゲップやないかーい！ｗｗ",
			"そうそう　海の家の　かき氷……\nって　それは　牡蠣ごおりやないかーい！ｗｗ",
		],
		bandLines: {
			night: [
				"そうそう　夜ふかし……\nって　それは　ふかしいもやないかーい！ｗｗ",
			],
		},
	},
];

export const personaById = (id: PersonaId): Persona =>
	PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];

// ───────────────── 流れを 選ぶ ─────────────────

export type Trip = { persona: Persona; from: CrowdNode; to: CrowdNode };

/** 行き先の 種類に 合う 所（家・駅が 無い 段は 村の 出口：外に 住む 人・外から 来る 人）。 */
const nodesOf = (nodes: readonly CrowdNode[], kind: CrowdKind): CrowdNode[] => {
	const hit = nodes.filter((n) => n.kind === kind);
	if (hit.length || (kind !== "home" && kind !== "transit")) return hit;
	return nodes.filter((n) => n.kind === "edge");
};

const pickW = <T>(
	rng: () => number,
	xs: readonly (readonly [T, number])[],
): T | null => {
	const total = xs.reduce((s, [, w]) => s + w, 0);
	if (total <= 0) return null;
	let r = rng() * total;
	for (const [x, w] of xs) {
		r -= w;
		if (r < 0) return x;
	}
	return xs[xs.length - 1][0];
};

const pick = <T>(rng: () => number, xs: readonly T[]): T =>
	xs[Math.floor(rng() * xs.length) % xs.length];

/** その 人が その 時間帯に 歩ける 流れ（出る 所は 扉・家・出口だけ。行き先は 立ちどまる 所も）。 */
const flowsFor = (
	p: Persona,
	band: TimeBand,
	nodes: readonly CrowdNode[],
): Flow[] =>
	p.flows[band].filter(
		([a, b]) =>
			nodesOf(nodes, a).some((n) => n.enter) && nodesOf(nodes, b).length > 0,
	);

/**
 * 次に 出てくる 人と 道すじ（どこから 出て どこへ 行くか）。歩ける 流れが 1つも なければ null。
 * 出る 所と 行き先は ちがう 所。
 */
export const pickTrip = (
	rng: () => number,
	nodes: readonly CrowdNode[],
	band: TimeBand,
	weekend: boolean,
): Trip | null => {
	const people = PERSONAS.map(
		(p) =>
			[
				p,
				flowsFor(p, band, nodes).length
					? p.share[band] * (weekend ? p.weekend : 1)
					: 0,
			] as const,
	);
	const persona = pickW(rng, people);
	if (!persona) return null;
	const flow = pickW(
		rng,
		flowsFor(persona, band, nodes).map((f) => [f, f[2]] as const),
	);
	if (!flow) return null;
	const from = pick(
		rng,
		nodesOf(nodes, flow[0]).filter((n) => n.enter),
	);
	const tos = nodesOf(nodes, flow[1]).filter((n) => n.id !== from.id);
	if (!tos.length) return null;
	return { persona, from, to: pick(rng, tos) };
};

/** 立ちどまった あとの 行き先（その 人の いまの 時間帯の 流れの 行き先から。無ければ 出口）。 */
export const pickNext = (
	rng: () => number,
	nodes: readonly CrowdNode[],
	persona: Persona,
	band: TimeBand,
	here: CrowdNode,
): CrowdNode | null => {
	const kinds = flowsFor(persona, band, nodes)
		.map(([, b, w]) => [b, w] as const)
		.filter(([b]) => b !== "rest" && b !== "wait");
	const kind = pickW(rng, kinds) ?? "edge";
	const tos = nodesOf(nodes, kind).filter((n) => n.id !== here.id && n.enter);
	const any = nodes.filter((n) => n.enter && n.id !== here.id);
	return tos.length ? pick(rng, tos) : any.length ? pick(rng, any) : null;
};

/** 話しかけた ときの ひとこと（その 時間帯の ひとことが あれば 半分は そちら）。 */
export const crowdLine = (
	rng: () => number,
	p: Persona,
	band: TimeBand,
): string => {
	const extra = p.bandLines[band];
	return extra?.length && rng() < 0.5 ? pick(rng, extra) : pick(rng, p.lines);
};
