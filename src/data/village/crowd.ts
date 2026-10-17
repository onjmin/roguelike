// 街の 人通り（作者の 指示「街にも 人を 配置」「人流も 表現」）。
//
// 町の 段で 人が ふえ（殺風景の 村は だれも 来ない → 都市は にぎわう）、村の 時計で 流れが かわる
// （朝は 家や 駅から 職場へ・昼は 店と 散歩・夕方は 帰り道・夜は 盛り場だけ・深夜は 無人〜都市で まばら。週末は 遊びに 出る）。
// 人は 扉・家・港の 桟橋から 出てきて、別の 扉・家・桟橋へ 歩いて 入る（消える）。掲示板・ベンチなどでは
// しばらく 立ちどまって、また 歩きだす。
// 歩くのは 歩道・広場・村の 道（車道は 横断歩道で わたる。電柱などを よける ときだけ 1歩 はみ出す）。
// 動かすのは ui/village/villageCrowd.ts（キリコも 村の 人も ふさがない）。話しかけると 1窓。強さには 効かない。

import type { TileDef } from "../../engine/defs";
import { DIR_VEC, type Dir } from "../../engine/types";
import { isRevived } from "../town/revival";
import { facilitiesAt, facilityOfDoor } from "./facilities";
import {
	type Cell,
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
	late: 0,
	morning: 1,
	day: 0.85,
	evening: 1,
	night: 0.2,
};

/**
 * 夜・深夜の 人の 割合（2026-10-15 作者「夜・深夜は 人通り 少なめ〜無人で いい。繁華街は そうでもない？」）。
 * 村・住宅街の 夜は ほとんど 出歩かず、深夜は 無人。盛り場（バー・カジノ・映画館……）の ある 都市だけ
 * 夜も 人が 出て、深夜も 少し 残る（流れは 盛り場と 家の 行き来。PERSONAS の flows）。
 */
const nightRate = (stage: number, band: "night" | "late"): number =>
	band === "night"
		? stage >= 7
			? 0.6
			: stage >= 6
				? 0.35
				: BAND_RATE.night
		: stage >= 7
			? 0.2
			: BAND_RATE.late;

/** その 段・時間帯・曜日の 人の 数（昼間は 少なくとも 1人。夜・深夜は 0人も ある）。 */
export const crowdSize = (
	stage: number,
	band: TimeBand,
	weekend: boolean,
): number => {
	const base = CROWD_BASE[Math.max(0, Math.min(CROWD_BASE.length - 1, stage))];
	if (!base) return 0;
	const dark = band === "night" || band === "late";
	const rate = dark ? nightRate(stage, band) : BAND_RATE[band];
	const n = Math.round(base * rate * (weekend ? 1.15 : 1));
	return dark ? n : Math.max(1, n);
};

// ───────────────── 行き先 ─────────────────

/**
 * 行き先の 種類。home 家・work 職場・care 病院・shop 店・food 飲食店・fun 遊び場・hall 配信会館・transit 港（無ければ 出口）・
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
	/** 立ったあと 乗って いく（消える）。 */
	board?: boolean;
	/** 施設の 扉なら その 施設（data/village/facilities.ts の id）か 町の まんなかの 扉の id。 */
	place?: string;
};

/** 施設の 扉の 行き先（data/village/facilities.ts の id。のっていない 施設には 人は 入らない）。 */
const FACILITY_KIND: Record<string, CrowdKind> = {
	umi: "food",
	go: "fun",
	konbini: "shop",
	dojo: "fun",
	pawn: "shop",
	recycle: "shop",
	arcade: "fun",
	gym: "fun",
	bar: "fun",
	ramen: "food",
	famires: "food",
	cinema: "fun",
	theater: "fun",
	casino: "fun",
	otaku: "shop",
	// 寂れた 港町の 勤め先は 銀行と 証券
	shoken: "work",
	bank: "work",
	netcafe: "fun",
	soba: "food",
	izakaya: "food",
	maid: "food",
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
/** 町の まんなかの 建物の 扉 → 生き返る 所の id（data/town/revival.ts）。 */
const CORE_DOOR_PLACE: Record<string, string> = {
	door_cafe: "cafe",
	door_music: "music",
	door_books: "library",
	door_bath: "bath",
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
 * 立ちどまる 所（町の 段の from〜until）。ランキング掲示板を 読む・神社に お参り・浜で 海を 見る・
 * 自販機で 飲む・広場の 時計の 下で 待ち合わせ・店先で 立ち話。
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
		id: "clock",
		at: [24, 23],
		face: "down",
		kind: "wait",
		from: 7,
		stay: [8 * S, 18 * S],
	},
	{
		id: "konbini",
		at: [34, 16],
		face: "up",
		kind: "rest",
		from: 4,
		stay: [4 * S, 9 * S],
	},
	{
		id: "arcade",
		at: [41, 16],
		face: "up",
		kind: "rest",
		from: 6,
		stay: [5 * S, 12 * S],
	},
];

/** その 地図の 行き先（扉・家・出口・立ちどまる 所）。 */
export const crowdNodes = (v: VillageView): CrowdNode[] => {
	const stage = layoutStage(v);
	// まだ 生き返って いない 所（シャッター）には 人が 出入りしない・立ちどまらない（data/town/revival.ts）
	const open = (place: string) => isRevived(place, v.cleared);
	const out: CrowdNode[] = [];
	for (const p of villagePlaces(v)) {
		if (p.trigger !== "touch") continue;
		if (p.exit) {
			out.push({ id: p.id, at: [p.x, p.y], kind: "edge", enter: true });
			continue;
		}
		const f = facilityOfDoor(p.id);
		const kind = f ? FACILITY_KIND[f.id] : CORE_DOOR_KIND[p.id];
		if (kind && open(f?.id ?? CORE_DOOR_PLACE[p.id] ?? p.id))
			out.push({
				id: p.id,
				at: [p.x, p.y],
				kind,
				enter: true,
				place: f?.id ?? p.id,
			});
	}
	// 住宅街の 家（入れない 家。表札の 1つ下から 上を 向いて 入る）
	for (const f of facilitiesAt(stage)) {
		if (!f.id.startsWith("house_") || !open(f.id)) continue;
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
		if (
			stage >= s.from &&
			(s.until === undefined || stage < s.until) &&
			open(s.id)
		)
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
/** 曲がる たびに 足す（同じ 長さなら まっすぐな 道を えらぶ。広場を ジグザグに 歩かない）。 */
const TURN_COST = 0.6;

/**
 * 通行人の 歩きにくさ。通れない 地形と 置物（walls）は 通れない。車道は ほぼ 歩かない・
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
	// 地形は 変わらないので 先に ぜんぶ 測っておく（道さがしで 何万回も 引く。町で 歩くと カクついた）
	const table = new Float64Array(w * h);
	rows.forEach((r, y) => {
		const row = [...r];
		for (let x = 0; x < w; x++) {
			const ch = row[x] ?? " ";
			table[y * w + x] =
				!tiles[ch]?.passable || walls(x, y)
					? Number.POSITIVE_INFINITY
					: ROADWAY.has(ch) || (ch === "." && stage >= 6)
						? ROAD_COST
						: 1;
		}
	});
	return (x, y) =>
		x < 0 || y < 0 || x >= w || y >= h
			? Number.POSITIVE_INFINITY
			: table[y * w + x];
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
	// 小さい 順の ヒープ（距離と 状態を 別の 型つき 配列に。組を 作らない ので 速い）
	let cap = 1024;
	let hd = new Float64Array(cap);
	let hs = new Int32Array(cap);
	let size = 0;
	const push = (d: number, s: number) => {
		if (size === cap) {
			cap *= 2;
			const nd = new Float64Array(cap);
			const ns = new Int32Array(cap);
			nd.set(hd);
			ns.set(hs);
			hd = nd;
			hs = ns;
		}
		let i = size++;
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (hd[p] <= d) break;
			hd[i] = hd[p];
			hs[i] = hs[p];
			i = p;
		}
		hd[i] = d;
		hs[i] = s;
	};
	/** いちばん 小さい 状態を 取り出す（距離は popD に）。空なら -1。 */
	let popD = 0;
	const pop = (): number => {
		if (!size) return -1;
		const top = hs[0];
		popD = hd[0];
		size--;
		if (size) {
			const d = hd[size];
			const s = hs[size];
			let i = 0;
			for (;;) {
				const l = i * 2 + 1;
				if (l >= size) break;
				const r = l + 1;
				const m = r < size && hd[r] < hd[l] ? r : l;
				if (hd[m] >= d) break;
				hd[i] = hd[m];
				hs[i] = hs[m];
				i = m;
			}
			hd[i] = d;
			hs[i] = s;
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
	for (let s = pop(); s >= 0; s = pop()) {
		const d0 = popD;
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
	| "dajare";

type Flow = readonly [from: CrowdKind, to: CrowdKind, w: number];

export type Persona = {
	id: PersonaId;
	/** 名前欄。 */
	label: string;
	/** 歩行グラ（RPGEN。下の 敵・村の 名前の ある 人と 同じ 絵は 使わない）。 */
	sprites: readonly string[];
	/**
	 * 1マス 歩く ms（この あいだで ばらける。2026-10-13 作者：「歩く 速度を それぞれ 別々に」。
	 * 人ごとに さらに PACE を かける：せかせか・ふつう・のんびり）。
	 */
	ms: readonly [number, number];
	/**
	 * よく 出入りする 所（2026-10-13 作者：「スプライトに よって 出てくる・入る 建物に 偏りを」。
	 * 店員なら その 店まわり）。その 種類の 行き先・出る 所を 選ぶ とき、ここの 施設を HAUNT_W 倍 選びやすい。
	 */
	haunts?: Partial<Record<CrowdKind, readonly string[]>>;
	/** 時間帯ごとの 出やすさ（週末は weekend を かける）。 */
	share: Record<TimeBand, number>;
	weekend: number;
	/** 時間帯ごとの 流れ（どこから どこへ）。 */
	flows: Record<TimeBand, readonly Flow[]>;
	lines: readonly string[];
	/** その 時間帯だけの ひとこと（あれば 半分は こちら）。 */
	bandLines: Partial<Record<TimeBand, readonly string[]>>;
};

/** 名無し（おんJ民。配信会館の 名無しと 同じ 絵）。 */
const NANASHI_WALKS = ["sa:xjuotB", "sa:qPN3cT", "sa:C2hS8U", "sa:VaBXqn"];

export const PERSONAS: readonly Persona[] = [
	{
		id: "worker",
		label: "会社員",
		// RPGEN「サラリーマン1・2」
		sprites: ["sa:Rn1eai", "sa:dID4NE"],
		ms: [170, 220],
		haunts: {
			work: ["bank", "shoken"],
			food: ["soba", "izakaya", "ramen"],
			fun: ["bar"],
		},
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
			"配信　お疲れさん。\nワイは　会社の　保守や",
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
		ms: [150, 210],
		haunts: {
			fun: ["arcade", "go", "dojo", "cinema", "gym", "door_music"],
			food: ["famires", "ramen", "door_cafe"],
			shop: ["konbini", "door_books", "otaku"],
		},
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
		ms: [190, 260],
		haunts: {
			shop: ["konbini", "recycle", "pawn"],
			food: ["umi", "famires", "izakaya"],
		},
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
			"この村、むかしは\nやきうと　原住民だけやったんやて",
			"特売、まにあうかな",
			"港の　船、\nまた　だれか　来たんかな",
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
		ms: [280, 360],
		haunts: {
			fun: ["door_bath", "go"],
			shop: ["pawn", "door_books"],
		},
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
			"人が　ふえたわねえ。\n……配信って、にぎやかね",
		],
		bandLines: {
			morning: ["朝の　散歩は\n欠かせないのよ"],
		},
	},
	{
		id: "nanashi",
		label: "名無し",
		sprites: NANASHI_WALKS,
		ms: [160, 240],
		haunts: {
			fun: ["arcade", "casino", "door_music", "cinema", "netcafe"],
			food: ["door_cafe", "ramen", "maid"],
		},
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
			"配信会館で　実況　見てくるわ",
			"ワイ、名無し。\n名前は　まだ　ない",
			"スレ立て　代行　まだかいな",
			"保守。\n……言うてみた　だけや",
			"なんか　ここ、\n居心地　ええな",
			"ワイも　この村に\n住もうかな",
			"坂、きっついな。\n山の　神社まで　行くんか？",
		],
		bandLines: {
			night: ["実況は　夜が\n本番やで"],
			late: ["深夜の　スレは\nなんか　落ちつくんや"],
		},
	},
	{
		// ダジャレニキ（おんJwiki pages/59 の 型「そうそう〇〇……って それは ××やないかーい！ｗｗ」。だじゃれは 新しく 書いた）。
		// たまに しか 歩いていない（data/people/folk.ts の 名物の ひとり）
		id: "dajare",
		label: "ダジャレニキ",
		// RPGEN「父」（ほかの 人・敵・店番と かぶらない。src/sim/folkTests.ts の F10）
		sprites: ["sa:2GAYAx"],
		ms: [200, 270],
		haunts: { fun: ["theater", "bar"], food: ["izakaya", "soba"] },
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
			"そうそう　桟橋の　船……\nって　それは　舟盛りやないかーい！ｗｗ",
			"そうそう　投げ銭……\nって　それは　お賽銭やないかーい！ｗｗ",
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

/** よく 出入りする 所を 選ぶ 重み（ほかの 所は 1）。 */
export const HAUNT_W = 6;

/** 人ごとの 歩く 速さの くせ（ms に かける。せかせか・ふつう・のんびり）。 */
export const PACE: readonly number[] = [0.75, 1, 1, 1.3];

/** その 人が その 種類の 所を 選ぶ（よく 出入りする 所は 重く）。 */
const pickNode = (
	rng: () => number,
	p: Persona,
	kind: CrowdKind,
	xs: readonly CrowdNode[],
): CrowdNode => {
	const likes = p.haunts?.[kind] ?? [];
	return (
		pickW(
			rng,
			xs.map((n) => [n, likes.includes(n.place ?? "") ? HAUNT_W : 1] as const),
		) ?? pick(rng, xs)
	);
};

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
	p.flows[band].filter(([a, b]) => {
		// 出る 所と ちがう 行き先が いる（出口が 1つなら 出口から 出口へは 歩かない）
		const tos = nodesOf(nodes, b);
		return nodesOf(nodes, a).some(
			(n) => n.enter && tos.some((t) => t.id !== n.id),
		);
	});

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
	const from = pickNode(
		rng,
		persona,
		flow[0],
		nodesOf(nodes, flow[0]).filter(
			(n) => n.enter && nodesOf(nodes, flow[1]).some((t) => t.id !== n.id),
		),
	);
	const tos = nodesOf(nodes, flow[1]).filter((n) => n.id !== from.id);
	if (!tos.length) return null;
	return { persona, from, to: pickNode(rng, persona, flow[1], tos) };
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
	return tos.length
		? pickNode(rng, persona, kind, tos)
		: any.length
			? pick(rng, any)
			: null;
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
