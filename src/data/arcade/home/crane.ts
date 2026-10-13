// ゲームセンター「連コ」の 台「ぷゆゆキャッチャー」（crane）の 決まり。板は ui/arcade/home/crane.ts、文は data/arcade/text.ts。
// - ガラスの 箱の 中に ぷゆゆの ぬいぐるみが 山盛り（色ちがいと、たまに 金・でかい・にじいろ）。
// - 昔ながらの 2つの ボタン：→ を 押して いる あいだ アームが 右へ（離すと 止まる）、次に ↑ を 押して いる あいだ 奥へ。
//   ↑ を 離すと（または A で）アームが おりて、つかんで、上がって、左手前の とりだし口へ 運ぶ。
// - アームは 弱い。つかむ かは ずれと 景品の 重さで 決まり、上がる とちゅう・上で ガクンと 止まる とき・運ぶ とちゅうに すべって はなれる ことが ある。
//   とりだし口の 上で すべれば そのまま とれる。
// - 5回 あそべる。点は とれた 数（個）。
// 位置は 板の 座標（x は 横の px、z は 奥行き 0 手前〜1 奥、alt は 床からの 高さ px）。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import type { Rnd } from "../logic";

export const CR = {
	/** 箱の 中の 左右（px）。 */
	left: 40,
	right: 200,
	/** 手前の 床の 行と、奥へ 1 で 上へ ずれる px。 */
	floorY: 138,
	depth: 40,
	/** アームの 休む 高さ（床から px）。 */
	ceil: 74,
	/** とりだし口（左手前）。 */
	chuteX: 76,
	chuteZ: 0.42,
	/** アームの 出発点（とりだし口の 上）。 */
	homeX: 58,
	homeZ: 0.12,
	xMax: 192,
	zMax: 0.95,
	/** 動く 速さ（px／秒・z／秒）。 */
	moveX: 36,
	moveZ: 0.42,
	down: 44,
	up: 34,
	carryX: 44,
	carryZ: 0.5,
	/** つかめる ずれ（横 px・奥行き）。景品の 大きさで のびる。 */
	reachX: 12,
	reachZ: 0.2,
	/** アームの 強さ（まっすぐ 真上で ふつうの ぷゆゆを つかむ 割合）。 */
	power: 0.75,
	/** すべり（上がる あいだ 0.3秒ごと・上で ガクン・運ぶ あいだ 0.4秒ごと）。(1 − つかみ) に かける。 */
	slipRise: 0.07,
	slipJolt: 0.3,
	slipCarry: 0.04,
	plays: 5,
	/** 押さないで いると ひとりでに 進む 秒。 */
	idle: 12,
	/** 1つの ぷゆゆの 高さ（px。でかいは 1.5倍）。 */
	h: 14,
	/** 1つの ぷゆゆの 横の 半分（px）。 */
	r: 7.5,
	/** 山の 高さの 上限（px）。 */
	pileMax: 26,
} as const;

export type CrPrizeId =
	| "puyu"
	| "puyuPink"
	| "puyuBlue"
	| "puyuGreen"
	| "puyuWhite"
	| "puyuGold"
	| "puyuBig"
	| "puyuRainbow";

export type CrPrize = {
	id: CrPrizeId;
	name: string;
	ink: string;
	/** めずらしい 景品。 */
	rare: boolean;
	/** 大きさ（1 が ふつう）。 */
	size: number;
	/** つかみやすさ（1 が ふつう。重いほど 小さい）。 */
	hold: number;
};

/** 景品の 一覧（家具に する ときは id で ひく）。 */
export const CR_PRIZES: readonly CrPrize[] = [
	{
		id: "puyu",
		name: "ぷゆゆの　ぬいぐるみ",
		ink: "#f0c838",
		rare: false,
		size: 1,
		hold: 1,
	},
	{
		id: "puyuPink",
		name: "ももいろ　ぷゆゆ",
		ink: "#f08cb4",
		rare: false,
		size: 1,
		hold: 1,
	},
	{
		id: "puyuBlue",
		name: "みずいろ　ぷゆゆ",
		ink: "#7cc8f0",
		rare: false,
		size: 1,
		hold: 1,
	},
	{
		id: "puyuGreen",
		name: "みどりの　ぷゆゆ",
		ink: "#8cd878",
		rare: false,
		size: 1,
		hold: 1,
	},
	{
		id: "puyuWhite",
		name: "しろい　ぷゆゆ",
		ink: "#f4f0e8",
		rare: false,
		size: 1,
		hold: 1,
	},
	{
		id: "puyuGold",
		name: "金の　ぷゆゆ",
		ink: "#d8a020",
		rare: true,
		size: 1,
		hold: 0.55,
	},
	{
		id: "puyuBig",
		name: "でかい　ぷゆゆ",
		ink: "#f0c838",
		rare: true,
		size: 1.5,
		hold: 0.6,
	},
	{
		id: "puyuRainbow",
		name: "にじいろ　ぷゆゆ",
		ink: "#e070e0",
		rare: true,
		size: 1,
		hold: 0.75,
	},
];

export const crPrize = (id: CrPrizeId): CrPrize =>
	CR_PRIZES.find((p) => p.id === id) ?? (CR_PRIZES[0] as CrPrize);

/** 板の 字。 */
export const CR_TEXT = {
	right: "→を　押して　いる　あいだ　右へ",
	up: "↑を　押して　いる　あいだ　奥へ",
	miss: "つかめなかった",
	slip: "あっ　すべった……",
	win: "{name}　ゲット！",
	lucky: "とりだし口に　ころがった！",
	plays: "のこり",
	chute: "とりだし口",
	got: "{n}個　とれた",
	note: "タップ：押して　いる　あいだ　アームが　動く",
} as const;

export type CrItem = {
	id: CrPrizeId;
	x: number;
	z: number;
	alt: number;
	/** つかまれて いる。 */
	held: boolean;
};

export type CrPhase =
	| "right"
	| "up"
	| "open"
	| "down"
	| "grab"
	| "rise"
	| "carry"
	| "release"
	| "reset";

export type CrState = {
	t: number;
	phase: CrPhase;
	/** いまの 段の 秒。 */
	pt: number;
	/** その 段で もう 動かした。 */
	moved: boolean;
	x: number;
	z: number;
	/** アームの 先の 高さ（床から px）。 */
	alt: number;
	/** アームの ひらき（0 とじ〜1 ひらき）。 */
	open: number;
	/** おりる 先の 高さ。 */
	stopAlt: number;
	items: CrItem[];
	/** つかんで いる 景品の 番号（−1 なし）と つかみの 強さ。 */
	hold: number;
	grip: number;
	/** すべりを 見る までの 秒。 */
	slipT: number;
	/** のこりの 回数（いまの 回を ふくむ）。 */
	plays: number;
	won: CrPrizeId[];
	over: boolean;
};

export type CrInput = { right: boolean; up: boolean; drop: boolean };

export type CrEvent =
	| "move"
	| "stop"
	| "open"
	| "land"
	| "grab"
	| "miss"
	| "slip"
	| "win"
	| "lucky"
	| "next"
	| "over";

const clamp = (v: number, a: number, b: number): number =>
	Math.max(a, Math.min(b, v));

export const crSize = (it: CrItem): number => crPrize(it.id).size;
/** 景品の 高さ（px）。 */
export const crHeight = (it: CrItem): number => CR.h * crSize(it);

/** 下から 順に 積みなおす（下の ものが ぬけたら 上が おりる）。 */
export const crSettle = (items: CrItem[]): void => {
	const order = items
		.map((it, i) => [it, i] as const)
		.filter(([it]) => !it.held)
		.sort((a, b) => a[0].alt - b[0].alt || a[1] - b[1]);
	const placed: CrItem[] = [];
	for (const [it] of order) {
		let alt = 0;
		for (const o of placed) {
			const rx = CR.r * (crSize(it) + crSize(o)) * 0.8;
			if (Math.abs(o.x - it.x) < rx && Math.abs(o.z - it.z) < 0.22)
				alt = Math.max(alt, o.alt + crHeight(o) * 0.7);
		}
		// 高く なりすぎない（上の ものは めりこむ）
		it.alt = Math.min(alt, CR.pileMax);
		placed.push(it);
	}
};

export const crStart = (rnd: Rnd): CrState => {
	const items: CrItem[] = [];
	const ids: CrPrizeId[] = [];
	for (let i = 0; i < 13; i++)
		ids.push((CR_PRIZES[Math.floor(rnd() * 5)] as CrPrize).id);
	ids.push("puyuGold", "puyuBig", "puyuRainbow");
	// まぜる（めずらしい ものが どこに 来るか）
	for (let i = ids.length - 1; i > 0; i--) {
		const k = Math.floor(rnd() * (i + 1));
		[ids[i], ids[k]] = [ids[k] as CrPrizeId, ids[i] as CrPrizeId];
	}
	for (const [i, id] of ids.entries()) {
		items.push({
			id,
			x: CR.chuteX + 12 + rnd() * (CR.xMax - CR.chuteX - 12),
			z: 0.08 + rnd() * 0.84,
			// 置いた 順に 積む（あとの ものほど 上）
			alt: i,
			held: false,
		});
	}
	crSettle(items);
	return {
		t: 0,
		phase: "right",
		pt: 0,
		moved: false,
		x: CR.homeX,
		z: CR.homeZ,
		alt: CR.ceil,
		open: 0,
		stopAlt: 0,
		items,
		hold: -1,
		grip: 0,
		slipT: 0,
		plays: CR.plays,
		won: [],
		over: false,
	};
};

export const crScore = (s: CrState): number => s.won.length;

/** アームの 真下で いちばん 上の 景品（つかめる ずれの 中）。 */
export const crUnder = (s: CrState): number => {
	let best = -1;
	let top = -1;
	s.items.forEach((it, i) => {
		if (it.held) return;
		const k = crSize(it);
		if (
			Math.abs(it.x - s.x) < CR.reachX * k &&
			Math.abs(it.z - s.z) < CR.reachZ * k &&
			it.alt + crHeight(it) > top
		) {
			top = it.alt + crHeight(it);
			best = i;
		}
	});
	return best;
};

const go = (s: CrState, p: CrPhase): void => {
	s.phase = p;
	s.pt = 0;
	s.moved = false;
};

/** つかんで いる ものを 落とす（とりだし口の 上なら とれる）。 */
const drop = (s: CrState, ev: CrEvent[], lucky: boolean): void => {
	const it = s.items[s.hold];
	s.hold = -1;
	if (!it) return;
	it.held = false;
	if (s.x < CR.chuteX && s.z < CR.chuteZ) {
		s.won.push(it.id);
		s.items = s.items.filter((o) => o !== it);
		ev.push(lucky ? "lucky" : "win");
	} else {
		it.x = clamp(s.x, CR.chuteX + 6, CR.xMax);
		it.z = clamp(s.z, 0.05, CR.zMax);
		it.alt = 99;
		ev.push("slip");
	}
	crSettle(s.items);
};

/** 1こま 進める。 */
export const crStep = (
	s: CrState,
	dt: number,
	ip: CrInput,
	rnd: Rnd,
): CrEvent[] => {
	const ev: CrEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	s.pt += dt;
	switch (s.phase) {
		case "right": {
			if (ip.right && s.x < CR.xMax) {
				if (!s.moved) ev.push("move");
				s.moved = true;
				s.x = Math.min(CR.xMax, s.x + CR.moveX * dt);
			} else if (s.moved || s.x >= CR.xMax || s.pt > CR.idle) {
				ev.push("stop");
				go(s, "up");
			}
			break;
		}
		case "up": {
			if (ip.up && s.z < CR.zMax && !ip.drop) {
				if (!s.moved) ev.push("move");
				s.moved = true;
				s.z = Math.min(CR.zMax, s.z + CR.moveZ * dt);
			} else if (s.moved || ip.drop || s.z >= CR.zMax || s.pt > CR.idle) {
				ev.push("stop", "open");
				go(s, "open");
			}
			break;
		}
		case "open": {
			s.open = Math.min(1, s.open + dt * 2.5);
			if (s.open >= 1) {
				const u = crUnder(s);
				const it = s.items[u];
				// ぬいぐるみに 少し 沈む
				s.stopAlt = it ? Math.max(0, it.alt + crHeight(it) - 3) : 0;
				go(s, "down");
			}
			break;
		}
		case "down": {
			s.alt -= CR.down * dt;
			if (s.alt <= s.stopAlt) {
				s.alt = s.stopAlt;
				ev.push("land");
				go(s, "grab");
			}
			break;
		}
		case "grab": {
			s.open = Math.max(0, s.open - dt * 2);
			if (s.open > 0) break;
			const u = crUnder(s);
			const it = s.items[u];
			if (it) {
				const P = crPrize(it.id);
				const fx = Math.abs(it.x - s.x) / (CR.reachX * P.size);
				const fz = Math.abs(it.z - s.z) / (CR.reachZ * P.size);
				const p = CR.power * P.hold * (1 - 0.6 * fx * fx) * (1 - 0.6 * fz * fz);
				if (rnd() < p) {
					s.hold = u;
					s.grip = p;
					it.held = true;
					ev.push("grab");
					crSettle(s.items);
				} else {
					// つつかれて 少し ずれる
					it.x = clamp(it.x + (it.x >= s.x ? 3 : -3), CR.chuteX + 6, CR.xMax);
					ev.push("miss");
					crSettle(s.items);
				}
			} else ev.push("miss");
			s.slipT = 0.3;
			go(s, "rise");
			break;
		}
		case "rise": {
			s.alt = Math.min(CR.ceil, s.alt + CR.up * dt);
			if (s.hold >= 0) {
				s.slipT -= dt;
				if (s.slipT <= 0) {
					s.slipT = 0.3;
					if (rnd() < (1 - s.grip) * CR.slipRise) drop(s, ev, true);
				}
			}
			if (s.alt >= CR.ceil) {
				// 上で ガクンと 止まる
				if (s.hold >= 0 && rnd() < (1 - s.grip) * CR.slipJolt)
					drop(s, ev, true);
				s.slipT = 0.4;
				go(s, "carry");
			}
			break;
		}
		case "carry": {
			s.x += clamp(CR.homeX - s.x, -CR.carryX * dt, CR.carryX * dt);
			s.z += clamp(CR.homeZ - s.z, -CR.carryZ * dt, CR.carryZ * dt);
			if (s.hold >= 0) {
				s.slipT -= dt;
				if (s.slipT <= 0) {
					s.slipT = 0.4;
					if (rnd() < (1 - s.grip) * CR.slipCarry) drop(s, ev, true);
				}
			}
			if (Math.abs(s.x - CR.homeX) < 0.01 && Math.abs(s.z - CR.homeZ) < 0.001) {
				s.x = CR.homeX;
				s.z = CR.homeZ;
				go(s, "release");
			}
			break;
		}
		case "release": {
			s.open = Math.min(1, s.open + dt * 2.5);
			if (s.open >= 1) {
				if (s.hold >= 0) drop(s, ev, false);
				go(s, "reset");
			}
			break;
		}
		case "reset": {
			s.open = Math.max(0, s.open - dt * 2.5);
			if (s.pt < 0.8) break;
			s.plays--;
			if (s.plays <= 0 || !s.items.length) {
				s.over = true;
				ev.push("over");
			} else {
				ev.push("next");
				go(s, "right");
			}
			break;
		}
	}
	// つかんで いる ものは アームと 動く
	const h = s.items[s.hold];
	if (h) {
		h.x = s.x;
		h.z = s.z;
		h.alt = Math.max(0, s.alt - crHeight(h) + 3);
	}
	return ev;
};
