// 喫茶「保守」の 中（西の 空き地。町の 段5 から。地図は data/village/rooms.ts、文は data/cafe.ts・data/cafeMobs.ts）。
// 店を 経営する 所では なく、仲間や 住人と となりに すわって 話す 場所。どれも 寄り道で、強さには 何も 効かない。
// - 扉を 踏むと 中へ。はじめに ときどき「あちらの　お客様からです」：まだ 話していない 話の ある 仲間が
//   キリコに 一杯 送ってきて、となりに すわって その 話が 始まる（1回の 帰りに 1回まで）。
// - 客は 冒険から 帰るたびに 抽選（cafeLayout。帰りの 時刻から 決まるので、同じ 帰りの あいだは 同じ）。
//   仲間は 2〜4人（ときどき 5人 ぜんぶ）が 席に すわっている。となりが 空いていれば 話しかけて
//   となりに すわり、話の 一覧（まだ 聞いていない 話に「！」）と「一杯　おごる」。
//   となりに だれか（仲間か 住人）が いれば 話しこんでいて、そばで 聞ける。
//   掛け合いの 話は 店に いる 相手だけが やってくる（みんなの 話は 5人 そろった 帰りだけ。カウンターに 集まる）。
// - 名無しだけの 席も ある（2人の 席は 掛け合い、ひとりの 席は ひとこと）。
// - マスター（台の うしろ。台の 前の 丸いすから）：「注文する」で 倉庫の 草を 1つ わたすと、くるくる まわって
//   一杯を まぜる（ポケダン 空の パッチールの カフェの ような 演出。まわる → 泡だつ → できあがりの 曲）。
//   仲間・住人に 送るなら その 席へ はこんで となりに すわる（推しへの 投げ銭）。じぶんで 飲んでも いい。
//   好みの 一杯なら 特別な 反応。おごった 回数で その 仲間の 話が ふえる（data/cafe.ts の treats）。
//   品書きは 一杯の 名前と 草、好みを 知った 一杯は だれの 好みか。
// - 住人（越してきた 子）も 帰りごとに 何人か 来ている（抽選）。話しかけると「話す」
//   （上から 1本ずつ。1回の 帰りに 1人 1本）・「一杯　おごる」。
// 聞いた 印・おごった 回数・知った 好みは 別の 保存場所に 残す（中断セーブ・記録・町には 手を ふれない。倉庫の 草だけ へる）。

import { defOf } from "../core/item";
import type { DungeonId, Item } from "../core/types";
import {
	CAFE_DRINKS,
	CAFE_GREET,
	CAFE_TALKS,
	type CafeDrink,
	type CafeLine,
	type CafeTalk,
	CHAT_MSG,
	MASTER,
	MASTER_MENU,
	MASTER_MSG,
	NANASHI_CAFE,
	SEAT_MSG,
	TREAT_REACTIONS,
	TREAT_TALKS,
} from "../data/cafe";
import { CAFE_MOBS, type CafeMobTalk } from "../data/cafeMobs";
import { CAST } from "../data/cast";
import { type Cast, MOB_IDS, MOBS, type MobId } from "../data/mobs";
import { SPEAKERS, type Speaker } from "../data/quotes";
import { ROOM_MSG, ROOM_NAMES } from "../data/rooms";
import { playPage } from "../data/story";
import { NANASHI_WALK } from "../data/village/hall";
import { npc, sign } from "../data/village/helpers";
import { CAFE_FROM, type Cell, type VillageView } from "../data/village/map";
import {
	CAFE_ALL_SEATS,
	CAFE_MASTER,
	CAFE_PATRON_SPOTS,
	CAFE_SLOTS,
	type CafeSeat,
	type PatronSpot,
	roomPalette,
	roomPlaces,
	roomRows,
	type Spot,
} from "../data/village/rooms";
import type { EventDef, MapDef, Script, Story } from "../engine/defs";
import {
	loadProgress,
	loadRecords,
	loadTown,
	takeFromStorage,
} from "../engine/save";
import type { Dir } from "../engine/types";
import { TILE } from "../engine/types";
import type { Ctx } from "./ctx";
import { type ListItem, listWindow } from "./list";
import { enterRoom, leaveRoom } from "./rooms";
import { play as playMob, sayAs } from "./villageMobs";
import { villageView } from "./villageReturn";
import { fill } from "./villageTalk";

const KEY = "kiriko-roguelike/cafe";

export type CafeState = {
	heard: string[];
	/** 仲間ごとの おごった 回数。 */
	treats: Partial<Record<Speaker, number>>;
	/** 「あちらの　お客様から」を 出した 帰り（記録の 時刻）。 */
	sentAt: number;
	/** 好みを 知った 一杯（草の 種類）。 */
	found?: string[];
	/** 住人の 店での 話（`<id>:<key>`）。 */
	mobSeen?: string[];
	/** 住人の 店での 話を 聞いた 帰り。 */
	mobHeard?: Partial<Record<MobId, number>>;
	/** まぜた 杯の 数（4杯に 1杯 マスターの 目が まわる）。 */
	mixed?: number;
};

let memo: CafeState | null = null;

const strings = (v: unknown): string[] =>
	Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const load = (): CafeState => {
	if (memo) return JSON.parse(JSON.stringify(memo)) as CafeState;
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		// 前の 形（聞いた id の 配列）も 読む
		if (Array.isArray(raw))
			return { heard: strings(raw), treats: {}, sentAt: 0 };
		if (raw && typeof raw === "object")
			return {
				heard: strings(raw.heard),
				treats: raw.treats && typeof raw.treats === "object" ? raw.treats : {},
				sentAt: typeof raw.sentAt === "number" ? raw.sentAt : 0,
				found: strings(raw.found),
				mobSeen: strings(raw.mobSeen),
				mobHeard:
					raw.mobHeard && typeof raw.mobHeard === "object" ? raw.mobHeard : {},
				mixed: typeof raw.mixed === "number" ? raw.mixed : 0,
			};
	} catch {
		// 読めなければ はじめから
	}
	return { heard: [], treats: {}, sentAt: 0 };
};

const save = (st: CafeState): void => {
	memo = JSON.parse(JSON.stringify(st)) as CafeState;
	try {
		localStorage.setItem(KEY, JSON.stringify(st));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};

/** 試験用：覚えている 写しを 捨てる。 */
export const forgetCafeMemo = (): void => {
	memo = null;
};

/** いまの 帰り（いちばん 新しい 記録の 時刻）。 */
const returnAt = (): number => loadRecords()[0]?.at ?? 0;

/** いまの 町の 段（開発用の 下見 ?stage= も）。 */
const stageNow = (): number => villageView().stage;

/** いまの 町・おごった 回数で 聞ける 話。 */
export const cafeTalks = (
	stage: number,
	st: CafeState = load(),
	cleared: readonly DungeonId[] = loadProgress().cleared,
): CafeTalk[] =>
	[...CAFE_TALKS, ...TREAT_TALKS].filter(
		(t) =>
			stage >= (t.from ?? CAFE_FROM) &&
			(st.treats[t.cast[0]] ?? 0) >= (t.treats ?? 0) &&
			(!t.after || cleared.includes(t.after)),
	);

/** その 仲間が 出る 話（掛け合い・みんなの 話も）。 */
export const talksWith = (
	who: Speaker,
	stage: number,
	st: CafeState = load(),
): CafeTalk[] => cafeTalks(stage, st).filter((t) => t.cast.includes(who));

/** まだ 聞いていない 話が あるか（扉の 上の「！」）。 */
export const hasCafeNews = (): boolean => {
	const st = load();
	return cafeTalks(stageNow(), st).some((t) => !st.heard.includes(t.id));
};

/** 倉庫に ある 一杯に できる 草。 */
const drinkHerbs = (): Item[] =>
	loadTown().storage.filter((it) => !!CAFE_DRINKS[it.kind]);

// ───────────────── 席の 抽選（帰りごとに） ─────────────────

/** 小さな ハッシュ（帰りの 時刻から 抽選の 種を 作る）。 */
const hash = (s: string): number => {
	let h = 2166136261;
	for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return h >>> 0;
};

/** 種から 決まる 乱数（mulberry32）。同じ 帰りの あいだは 同じ 席に なる。 */
const rng = (seed: number) => {
	let a = seed >>> 0;
	return (): number => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** 仲間の 席（CAFE_SLOTS の 番号）。partner が いれば となりで 話しこんでいる（talk は その 話）。 */
export type CafeFriend = {
	who: Speaker;
	slot: number;
	partner?: Cast;
	/** 話しこんでいる 話（仲間どうしは CAFE_TALKS の id、住人とは その 子の 店での 話の key）。 */
	talk?: string;
};

/** この 帰りの 客。 */
export type CafeLayout = {
	friends: CafeFriend[];
	/** 来ている 住人（CAFE_PATRON_SPOTS の 番号）。 */
	patrons: { id: MobId; spot: number }[];
	/** 名無しの 席（pair なら 丸テーブルに 2人。line は NANASHI_CAFE の 番号）。 */
	nanashi: { spot: number; pair: boolean; line: number }[];
};

/** 名無しが 2人で すわれる 席（丸テーブルの 両がわ）。 */
const NANASHI_TABLES = [0, 1];

/**
 * この 帰りの 客を 抽選する。仲間は 2〜4人（ときどき 5人）。仲間どうしで 話せる 話が あれば 半分くらい
 * 話しこんでいる。となりが 空いた 仲間は かならず 1人 いる。住人は 1〜3人、名無しの 席も ときどき。
 * pairTalk は 2人で 話せる 話（無ければ undefined）、mobTalk は 住人が その 仲間と 話せる 店での 話。
 */
export const cafeLayout = (
	stage: number,
	at: number,
	o: {
		pairTalk: (a: Speaker, b: Speaker) => string | undefined;
		mobTalk: (id: MobId, who: Speaker) => string | undefined;
	},
): CafeLayout => {
	const rnd = rng(hash(`cafe:${at}`));
	const shuffle = <T>(xs: readonly T[]): T[] => {
		const a = [...xs];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(rnd() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	};
	const all = Object.keys(SPEAKERS) as Speaker[];
	const n = rnd() < 0.12 ? all.length : 2 + Math.floor(rnd() * 3);
	const present = shuffle(all).slice(0, n);
	const slots = shuffle(CAFE_SLOTS.map((_, i) => i));
	const friends: CafeFriend[] = [];
	const seated = new Set<Speaker>();
	for (const who of present) {
		if (seated.has(who)) continue;
		seated.add(who);
		const f: CafeFriend = { who, slot: slots[friends.length] };
		if (rnd() < 0.45) {
			const mate = present.find((p) => !seated.has(p) && o.pairTalk(who, p));
			if (mate) {
				seated.add(mate);
				f.partner = mate;
				f.talk = o.pairTalk(who, mate);
			}
		}
		friends.push(f);
	}
	// となりが 空いた 仲間を かならず 1人（すわって 話せるように）
	if (!friends.some((f) => !f.partner)) {
		const f = friends[friends.length - 1];
		const mate = f.partner as Speaker;
		f.partner = undefined;
		f.talk = undefined;
		friends.push({ who: mate, slot: slots[friends.length] });
	}
	const moved = shuffle(MOB_IDS.filter((id) => stage >= MOBS[id].from));
	const busy = new Set<MobId>();
	for (const f of friends) {
		const free = friends.filter((x) => !x.partner).length;
		if (f.partner || free <= 1 || rnd() >= 0.3) continue;
		const r = moved.find((id) => !busy.has(id) && o.mobTalk(id, f.who));
		if (!r) continue;
		busy.add(r);
		f.partner = r;
		f.talk = o.mobTalk(r, f.who);
	}
	const nanashi: CafeLayout["nanashi"] = [];
	if (rnd() < 0.6)
		nanashi.push({
			spot: NANASHI_TABLES[Math.floor(rnd() * NANASHI_TABLES.length)],
			pair: true,
			line: Math.floor(rnd() * NANASHI_CAFE.pair.length),
		});
	const spots = shuffle(CAFE_PATRON_SPOTS.map((_, i) => i)).filter(
		(i) => !nanashi.some((x) => x.spot === i),
	);
	const guests = moved.filter((id) => !busy.has(id));
	const count = Math.min(
		guests.length,
		spots.length,
		1 + Math.floor(rnd() * 3),
	);
	const patrons = guests
		.slice(0, count)
		.map((id, k) => ({ id, spot: spots[k] }));
	const rest = spots.slice(count);
	if (rest.length && rnd() < 0.5)
		nanashi.push({
			spot: rest[0],
			pair: false,
			line: Math.floor(rnd() * NANASHI_CAFE.solo.length),
		});
	return { friends, patrons, nanashi };
};

/** 店に いる 仲間・住人（掛け合いの 相手が 来られるか）。 */
const presentOf = (l: CafeLayout): Set<Cast> => {
	const out = new Set<Cast>();
	for (const f of l.friends) {
		out.add(f.who);
		if (f.partner) out.add(f.partner);
	}
	for (const p of l.patrons) out.add(p.id);
	return out;
};

/** 住人の 店での 次の 話（with は その人が 店に いるときだけ）。 */
const nextMobTalk = (
	id: MobId,
	st: CafeState,
	here: (w: Cast) => boolean,
): CafeMobTalk | null =>
	CAFE_MOBS[id].talks.find(
		(t) =>
			!(st.mobSeen ?? []).includes(`${id}:${t.key}`) &&
			(!t.with || here(t.with)),
	) ?? null;

// ───────────────── 演出（一杯を まぜる）と 酒棚 ─────────────────

type Fx = { kind: "mix" | "done"; t0: number; color: string };
let fx: Fx | null = null;

const now = (): number =>
	typeof performance === "undefined" ? 0 : performance.now();

/** 酒棚（壁の 下段の b。棚板 2段に 瓶）。 */
const BOTTLE_INK = ["#3a7a3a", "#8a3a2a", "#c8a040", "#4a6ab0", "#d8d8c8"];

const bottleDecor = (
	rows: readonly string[],
): ((g: CanvasRenderingContext2D, ox: number, oy: number) => void) => {
	const cells: Cell[] = [];
	rows.forEach((r, y) => {
		[...r].forEach((ch, x) => {
			if (ch === "b") cells.push([x, y]);
		});
	});
	return (g, ox, oy) => {
		for (const [cx, cy] of cells) {
			const px = cx * TILE - ox;
			const py = cy * TILE - oy;
			g.fillStyle = "#3a2414";
			g.fillRect(px, py + 1, TILE, TILE - 2);
			for (const shelf of [0, 1]) {
				const base = py + 7 + shelf * 7;
				g.fillStyle = "#a0703a";
				g.fillRect(px, base, TILE, 1);
				for (let i = 0; i < 4; i++) {
					const k = (cx * 7 + shelf * 3 + i * 5) % BOTTLE_INK.length;
					const h = 3 + ((cx + i + shelf) % 3);
					g.fillStyle = BOTTLE_INK[k];
					g.fillRect(px + 1 + i * 4, base - h, 2, h);
					g.fillRect(px + 1 + i * 4, base - h - 1, 1, 1);
				}
			}
		}
	};
};

/** まぜる 渦・泡・できあがりの きらきらと グラス（マスターの まわり。台の 上に グラス）。 */
const mixDecor = (g: CanvasRenderingContext2D, ox: number, oy: number) => {
	const f = fx;
	if (!f) return;
	const dt = now() - f.t0;
	const cx = CAFE_MASTER[0] * TILE + 8 - ox;
	const cy = CAFE_MASTER[1] * TILE + 4 - oy;
	if (f.kind === "mix") {
		// まわる 色の 粒（だんだん 速く。尾を ひく）と、のぼる 泡
		const spin = (dt / 1000) ** 1.6 * 9;
		for (let i = 0; i < 8; i++) {
			for (let k = 2; k >= 0; k--) {
				const a = spin - k * 0.35 + (i * Math.PI) / 4;
				const r = 12 + Math.sin(dt / 180 + i) * 2;
				g.globalAlpha = 1 - k * 0.35;
				g.fillStyle = i % 2 ? f.color : "#ffffff";
				const size = k === 0 ? 3 : 2;
				g.fillRect(
					Math.round(cx + Math.cos(a) * r) - 1,
					Math.round(cy + Math.sin(a) * r * 0.6) - 1,
					size,
					size,
				);
			}
		}
		g.globalAlpha = 1;
		for (let i = 0; i < 6; i++) {
			const life = (dt / 700 + i / 6) % 1;
			g.fillStyle = i % 2 ? f.color : "rgba(255,255,255,0.9)";
			g.fillRect(
				Math.round(cx - 8 + i * 3 + Math.sin(dt / 150 + i) * 1.5),
				Math.round(cy + 10 - life * 20),
				2,
				2,
			);
		}
		return;
	}
	// できあがり：白く 光って、十字の きらきらが 広がる。台の 上に グラス
	if (dt < 320) {
		g.fillStyle = `rgba(255,255,255,${0.6 * (1 - dt / 320)})`;
		g.fillRect(0, 0, g.canvas.width, g.canvas.height);
	}
	const star = (x: number, y: number, c: string) => {
		g.fillStyle = c;
		g.fillRect(x - 1, y, 3, 1);
		g.fillRect(x, y - 1, 1, 3);
	};
	if (dt < 1100) {
		const r = 5 + (dt / 1100) * 22;
		for (let i = 0; i < 10; i++) {
			const a = (i * Math.PI) / 5 + dt / 900;
			star(
				Math.round(cx + Math.cos(a) * r),
				Math.round(cy + 8 + Math.sin(a) * r * 0.7),
				i % 2 ? "#fff6a0" : "#ffffff",
			);
		}
	}
	// グラス（まわりで ときどき 光る）
	const gx = CAFE_MASTER[0] * TILE + 4 - ox;
	const gy = (CAFE_MASTER[1] + 1) * TILE - 7 - oy;
	g.fillStyle = "#ffffff";
	g.fillRect(gx, gy, 8, 11);
	g.fillStyle = f.color;
	g.fillRect(gx + 1, gy + 3, 6, 7);
	g.fillStyle = "rgba(255,255,255,0.75)";
	g.fillRect(gx + 1, gy + 1, 1, 3);
	if (Math.floor(dt / 350) % 2 === 0) star(gx + 9, gy, "#fff6a0");
};

// ───────────────── 話す ─────────────────

const sayMaster = (s: Story, text: string): Promise<void> =>
	s.say(null, text, {
		name: MASTER.name,
		color: MASTER.color,
		noPortrait: true,
	});

const playLines = async (
	s: Story,
	lines: readonly CafeLine[],
	drink = "",
): Promise<void> => {
	for (const l of lines) {
		await playPage(s, { ...l, text: l.text.replaceAll("{drink}", drink) });
	}
};

/** 住人・仲間の イベント id（村と 同じ。住人は mob_<id>）。 */
const actorId = (w: Cast): string =>
	(MOB_IDS as string[]).includes(w) ? `mob_${w}` : w;

/** a から b を 向く 向き。 */
const dirTo = (
	a: readonly [number, number],
	b: readonly [number, number],
): Dir =>
	b[0] > a[0] ? "right" : b[0] < a[0] ? "left" : b[1] > a[1] ? "down" : "up";

/** この 帰りの 店（抽選した 客と、その 人の いつもの 所）。 */
type Visit = {
	layout: CafeLayout;
	present: Set<Cast>;
	/** イベント id → いつもの 所。 */
	homes: Map<string, { x: number; y: number; dir: Dir }>;
};

/** いつもの 所へ もどす。 */
const goHome = (s: Story, v: Visit, w: Cast): void => {
	const id = actorId(w);
	const h = v.homes.get(id);
	if (h) s.place(id, h.x, h.y, h.dir);
};

/** 暗転の 中で すわる・立つ（キリコと 動いた 人を 置きなおす）。 */
const blink = async (s: Story, put: () => void): Promise<void> => {
	await s.fadeOut(180);
	put();
	await s.fadeIn(180);
};

/** 話を 1つ 聞く（掛け合いの 相手は やってくる。聞いた 印を つける）。すわって いる 前提。 */
const hear = async (
	s: Story,
	v: Visit,
	talk: CafeTalk,
	f: CafeFriend,
): Promise<void> => {
	const others = talk.cast.filter((w) => w !== f.who);
	const seat = CAFE_SLOTS[f.slot];
	if (talk.cast.length >= 3) {
		// みんなの 話：カウンターに 集まる
		await s.narrate(SEAT_MSG.all);
		await blink(s, () => {
			for (const w of talk.cast) {
				const [x, y] = CAFE_ALL_SEATS[w];
				s.place(w, x, y, "up");
			}
			const [kx, ky] = CAFE_ALL_SEATS.kiriko;
			s.place("player", kx, ky, "up");
		});
	} else
		for (const w of others) {
			await s.narrate(fill(SEAT_MSG.join, { name: SPEAKERS[w].name }));
			s.place(w, seat.guest[0], seat.guest[1], seat.guestDir);
		}
	await playLines(s, talk.lines);
	const st = load();
	if (!st.heard.includes(talk.id)) st.heard.push(talk.id);
	save(st);
	if (talk.cast.length >= 3) {
		await blink(s, () => {
			for (const w of talk.cast) goHome(s, v, w);
			sitAt(s, f);
		});
	} else for (const w of others) goHome(s, v, w);
};

/** キリコを 仲間の となりの 席に（向きは 話す 向き）。 */
const sitAt = (s: Story, f: CafeFriend): void => {
	const seat = CAFE_SLOTS[f.slot];
	s.place("player", seat.kiriko[0], seat.kiriko[1], seat.talk[1]);
	s.place(f.who, seat.at[0], seat.at[1], seat.talk[0]);
};

const sitDown = async (s: Story, f: CafeFriend): Promise<void> => {
	await blink(s, () => sitAt(s, f));
	await s.narrate(fill(SEAT_MSG.sit, { name: SPEAKERS[f.who].name }));
};

const standUp = async (
	s: Story,
	v: Visit,
	stand: Spot,
	who?: Speaker,
): Promise<void> => {
	await blink(s, () => {
		s.place("player", stand.x, stand.y, stand.dir);
		if (who) goHome(s, v, who);
	});
};

/**
 * マスターが 一杯を まぜる（パッチールの カフェの ように）：草を わたす → まわる（渦と 泡）→ しゃかしゃか →
 * （4杯に 1杯 目が まわる）→ 白く 光って できあがりの 曲 →「おまちどう」。カメラは マスターを 見る。
 */
export const mixScene = async (
	s: Story,
	herb: Item,
	drink: CafeDrink,
): Promise<void> => {
	const st = load();
	const n = (st.mixed ?? 0) + 1;
	st.mixed = n;
	save(st);
	const herbName = defOf(herb.kind).name;
	await s.narrate(`キリコは　${herbName}を　わたした。`);
	await s.look(CAFE_MASTER);
	await sayMaster(s, fill(MASTER_MSG.take, { herb: herbName }));
	await s.narrate(MASTER_MSG.spin);
	await s.wait(0);
	fx = { kind: "mix", t0: now(), color: drink.color };
	s.se("mix");
	await s.move("master", "LDRULDRULDRULDRULDRU");
	s.se("bubble");
	await s.narrate(MASTER_MSG.shake);
	if (n % 4 === 0) {
		await s.wait(0);
		await s.move("master", "LwRwLw");
		await sayMaster(s, MASTER_MSG.dizzy);
	}
	await s.wait(0);
	s.face("master", "down");
	fx = { kind: "done", t0: now(), color: drink.color };
	s.se("glass");
	s.se("served");
	await sayMaster(s, fill(MASTER_MSG.done, { drink: drink.name }));
	fx = null;
	await s.look(null);
};

/** 草を 選ぶ（無ければ null）。 */
const pickHerb = async (ctx: Ctx, s: Story): Promise<Item | null> => {
	const herbs = drinkHerbs();
	if (!herbs.length) {
		await sayMaster(s, MASTER_MSG.noHerb);
		return null;
	}
	await s.wait(0);
	const v = await listWindow(
		ctx,
		"どの　草で　まぜてもらう？",
		herbs.map(
			(it, i): ListItem => ({
				label: defOf(it.kind).name,
				sub: CAFE_DRINKS[it.kind]?.name ?? "",
				value: String(i),
			}),
		),
		{ closeLabel: "やめる" },
	);
	if (v === null) return null;
	const herb = herbs[Number(v)];
	if (!herb || !takeFromStorage([herb]).length) return null;
	return herb;
};

/** 仲間が 一杯を 受け取る（すわって いる 前提）。回数・好み を 残す。 */
const reactTreat = async (
	s: Story,
	who: Speaker,
	herb: Item,
	drink: CafeDrink,
): Promise<void> => {
	const st = load();
	const before = cafeTalks(stageNow(), st).length;
	const n = (st.treats[who] ?? 0) + 1;
	st.treats[who] = n;
	const fav = drink.who === who;
	if (fav && !(st.found ?? []).includes(herb.kind))
		st.found = [...(st.found ?? []), herb.kind];
	save(st);
	s.se("drink");
	const reactions = TREAT_REACTIONS[who];
	await playLines(
		s,
		fav ? drink.lines : reactions[(n - 1) % reactions.length],
		drink.name,
	);
	if (cafeTalks(stageNow()).length > before)
		await s.narrate(fill(SEAT_MSG.more, { name: SPEAKERS[who].name }));
};

/** となりに すわって いる 仲間に 一杯（草を 選ぶ → まぜる → はこぶ → 反応）。 */
const treatSeated = async (ctx: Ctx, s: Story, who: Speaker): Promise<void> => {
	const herb = await pickHerb(ctx, s);
	const drink = herb && CAFE_DRINKS[herb.kind];
	if (!herb || !drink) return;
	await mixScene(s, herb, drink);
	await s.narrate(
		`マスターが　${SPEAKERS[who].name}の　前に　置いた。\n「あちらの　お客様からです」`,
	);
	await reactTreat(s, who, herb, drink);
};

/** その 仲間と 聞ける 話（相手が みんな 店に いる もの）。 */
const talksHere = (
	v: Visit,
	who: Speaker,
	st: CafeState = load(),
): CafeTalk[] =>
	talksWith(who, stageNow(), st).filter((t) =>
		t.cast.every((w) => v.present.has(w)),
	);

/** 仲間の となりの 席で（話の 一覧と「一杯　おごる」。とじたら 席を 立つ）。 */
const seatMenu = async (
	ctx: Ctx,
	s: Story,
	v: Visit,
	f: CafeFriend,
): Promise<void> => {
	let start = 0;
	for (;;) {
		await s.wait(0);
		const st = load();
		const talks = talksHere(v, f.who, st);
		const herbs = drinkHerbs().length;
		const rows: ListItem[] = [
			{
				label: "一杯　おごる",
				sub: herbs ? `草 ${herbs}` : "",
				desc: herbs
					? "倉庫の　草で　まぜてもらって、送る"
					: "倉庫に　草が　ない",
				value: "__treat",
				disabled: !herbs,
			},
			...talks.map((t) => ({
				label: `${st.heard.includes(t.id) ? "" : "！"}${t.title}`,
				sub: t.cast.map((w) => SPEAKERS[w].name).join("・"),
				value: t.id,
			})),
		];
		const pick = await listWindow(
			ctx,
			`${SPEAKERS[f.who].name}の　となり`,
			rows,
			{ start, closeLabel: SEAT_MSG.leave },
		);
		if (!pick) return;
		start = Math.max(
			0,
			rows.findIndex((r) => r.value === pick),
		);
		await s.wait(0);
		if (pick === "__treat") {
			await treatSeated(ctx, s, f.who);
			continue;
		}
		const talk = talks.find((t) => t.id === pick);
		if (talk) await hear(s, v, talk, f);
	}
};

/** 名前（仲間か 住人）。 */
const nameOf = (w: Cast): string =>
	(MOB_IDS as string[]).includes(w)
		? MOBS[w as MobId].name
		: SPEAKERS[w as Speaker].name;

/** 話しこんでいる 2人：そばに 立って 聞く（仲間どうしは その 話、住人とは その 子の 店での 話）。 */
const chatScript =
	(v: Visit, f: CafeFriend): Script =>
	async (s) => {
		const partner = f.partner;
		if (!partner) return;
		await s.narrate(
			fill(CHAT_MSG.busy, { a: nameOf(f.who), b: nameOf(partner) }),
		);
		const n = await s.choose([CHAT_MSG.listen, CHAT_MSG.leave], { cancel: 1 });
		goHome(s, v, f.who);
		goHome(s, v, partner);
		if (n !== 0) return;
		const seat = CAFE_SLOTS[f.slot];
		await blink(s, () =>
			s.place("player", seat.guest[0], seat.guest[1], seat.guestDir),
		);
		const st = load();
		if ((MOB_IDS as string[]).includes(partner)) {
			const id = partner as MobId;
			const talk = CAFE_MOBS[id].talks.find((t) => t.key === f.talk);
			if (!talk) return;
			await playMob(s, id, talk.lines);
			const key = `${id}:${talk.key}`;
			if (!(st.mobSeen ?? []).includes(key))
				st.mobSeen = [...(st.mobSeen ?? []), key];
		} else {
			const talk = CAFE_TALKS.find((t) => t.id === f.talk);
			if (!talk) return;
			await playLines(s, talk.lines);
			if (!st.heard.includes(talk.id)) st.heard.push(talk.id);
		}
		save(st);
		goHome(s, v, f.who);
		goHome(s, v, partner);
	};

/** あいさつ（帰りごとに どれか 1つ。人ごとに ずらす）。 */
const greetOf = (who: Speaker): string => {
	const lines = CAFE_GREET[who];
	return lines[hash(`${returnAt()}:${who}`) % lines.length] ?? lines[0];
};

/** 仲間に 話しかけた（となりが 空いていれば あいさつ → すわる → 席の 一覧 → 立つ。話しこんでいれば そばで 聞く）。 */
const companionScript =
	(ctx: Ctx, v: Visit, f: CafeFriend): Script =>
	async (s) => {
		if (f.partner) {
			await chatScript(v, f)(s);
			return;
		}
		await s.say(f.who, greetOf(f.who));
		const n = await s.choose(["となりに　すわる", "やめる"], { cancel: 1 });
		if (n !== 0) {
			goHome(s, v, f.who);
			return;
		}
		await sitDown(s, f);
		await seatMenu(ctx, s, v, f);
		await standUp(s, v, CAFE_SLOTS[f.slot].stand, f.who);
	};

// ───────────────── 住人 ─────────────────

/** 住人の 店での 1本（となりに すわる。相手が いれば 来る）。 */
const mobTalk = async (
	s: Story,
	v: Visit,
	id: MobId,
	spot: PatronSpot,
): Promise<void> => {
	const st = load();
	const at = returnAt();
	const heardNow = st.mobHeard?.[id] === at;
	const here = (w: Cast) => v.present.has(w);
	const talk = heardNow ? null : nextMobTalk(id, st, here);
	const me = actorId(id);
	await blink(s, () => {
		s.place("player", spot.kiriko[0], spot.kiriko[1], spot.kdir);
		s.face(me, spot.dir);
	});
	if (!talk) {
		await sayAs(s, id, CAFE_MOBS[id].idle);
	} else {
		st.mobSeen = [...(st.mobSeen ?? []), `${id}:${talk.key}`];
		st.mobHeard = { ...(st.mobHeard ?? {}), [id]: at };
		save(st);
		const partner = talk.with;
		if (partner) {
			await s.narrate(fill(SEAT_MSG.join, { name: nameOf(partner) }));
			s.place(actorId(partner), spot.guest[0], spot.guest[1], spot.guestDir);
		}
		await playMob(s, id, talk.lines);
		if (partner) goHome(s, v, partner);
	}
	await standUp(s, v, spot.stand);
	s.face(me, spot.dir);
};

/** 住人に 一杯（草 → まぜる → はこぶ → ひとこと）。 */
const treatMob = async (
	ctx: Ctx,
	s: Story,
	v: Visit,
	id: MobId,
	spot: PatronSpot,
): Promise<void> => {
	const herb = await pickHerb(ctx, s);
	const drink = herb && CAFE_DRINKS[herb.kind];
	if (!herb || !drink) return;
	await mixScene(s, herb, drink);
	await s.narrate(fill(MASTER_MSG.carry, { name: MOBS[id].name }));
	await blink(s, () => {
		s.place("player", spot.kiriko[0], spot.kiriko[1], spot.kdir);
		s.face(actorId(id), spot.dir);
	});
	s.se("drink");
	await sayAs(s, id, fill(CAFE_MOBS[id].treat, { drink: drink.name }));
	await standUp(s, v, spot.stand);
};

const patronScript =
	(ctx: Ctx, v: Visit, id: MobId, spot: PatronSpot): Script =>
	async (s) => {
		await sayAs(s, id, CAFE_MOBS[id].hello);
		const n = await s.choose(["話す", "一杯　おごる", "やめる"], {
			cancel: 2,
		});
		if (n === 0) await mobTalk(s, v, id, spot);
		else if (n === 1) await treatMob(ctx, s, v, id, spot);
		s.face(actorId(id), spot.dir);
	};

/** 住人の 頭の 上の「！」（まだ 聞いていない 店の 話が あって、この 帰りは まだ）。 */
const hasMobCafeNews = (v: Visit, id: MobId): boolean => {
	const st = load();
	if (st.mobHeard?.[id] === returnAt()) return false;
	return nextMobTalk(id, st, (w) => v.present.has(w)) !== null;
};

// ───────────────── 名無しの 席 ─────────────────

/** 名無し（名前欄は やきうの 色で「名無し」）。 */
const sayNanashi = (s: Story, text: string): Promise<void> =>
	s.say("nanj", text, { name: "名無し" });

/** 名無しの 席：2人なら 掛け合い、ひとりなら ひとこと。話し終えたら もとの 向き。 */
const nanashiScript =
	(v: Visit, seat: CafeLayout["nanashi"][number], ids: string[]): Script =>
	async (s) => {
		const lines = seat.pair
			? (NANASHI_CAFE.pair[seat.line] ?? NANASHI_CAFE.pair[0])
			: [NANASHI_CAFE.solo[seat.line] ?? NANASHI_CAFE.solo[0]];
		for (const l of lines) await sayNanashi(s, l);
		for (const id of ids) {
			const h = v.homes.get(id);
			if (h) s.face(id, h.dir);
		}
	};

// ───────────────── マスター ─────────────────

/** 品書き（一杯の 名前・草・知った 好み）。 */
const menuScript = async (ctx: Ctx, s: Story): Promise<void> => {
	await s.wait(0);
	const found = load().found ?? [];
	await listWindow(
		ctx,
		"品書き",
		Object.entries(CAFE_DRINKS).map(
			([kind, d]): ListItem => ({
				label: d.name,
				sub: defOf(kind).name,
				desc: found.includes(kind)
					? fill(SEAT_MSG.known, { name: SPEAKERS[d.who].name })
					: SEAT_MSG.unknown,
				value: kind,
			}),
		),
		{ closeLabel: "とじる" },
	);
};

/**
 * 注文：だれに（店に いる 仲間・住人・じぶん）→ 草 → まぜる → はこぶ。となりが 空いた 仲間なら キリコも
 * となりに すわる（話しこんでいる 仲間には はこぶ だけ）。
 */
const orderScript = async (
	ctx: Ctx,
	s: Story,
	v: Visit,
	back: Spot,
): Promise<void> => {
	await s.wait(0);
	const st = load();
	const friends = (Object.keys(SPEAKERS) as Speaker[]).filter((w) =>
		v.present.has(w),
	);
	const rows: ListItem[] = [
		...friends.map((w) => ({
			label: SPEAKERS[w].name,
			sub: st.treats[w] ? `${st.treats[w]}杯` : "",
			value: w,
		})),
		...v.layout.patrons.map((p) => ({
			label: MOBS[p.id].name,
			value: `mob:${p.id}`,
		})),
		{ label: "キリコ", sub: "じぶんで　飲む", value: "__self" },
	];
	const pick = await listWindow(ctx, "だれに　出す？", rows, {
		closeLabel: "やめる",
	});
	if (!pick) return;
	if (pick.startsWith("mob:")) {
		const p = v.layout.patrons.find((x) => `mob:${x.id}` === pick);
		const spot = p && CAFE_PATRON_SPOTS[p.spot];
		if (p && spot) await treatMob(ctx, s, v, p.id, spot);
		return;
	}
	const herb = await pickHerb(ctx, s);
	const drink = herb && CAFE_DRINKS[herb.kind];
	if (!herb || !drink) return;
	await mixScene(s, herb, drink);
	if (pick === "__self") {
		s.se("drink");
		await s.narrate(fill(MASTER_MSG.self, { drink: drink.name }));
		await s.narrate(drink.taste);
		return;
	}
	const who = pick as Speaker;
	const f = v.layout.friends.find((x) => x.who === who && !x.partner);
	if (!f) {
		// 話しこんでいる ところへ はこぶ だけ
		await s.narrate(
			`マスターが　${SPEAKERS[who].name}の　前に　置いた。\n「あちらの　お客様からです」`,
		);
		await reactTreat(s, who, herb, drink);
		return;
	}
	await s.narrate(fill(MASTER_MSG.carry, { name: SPEAKERS[who].name }));
	await blink(s, () => sitAt(s, f));
	await reactTreat(s, who, herb, drink);
	await standUp(s, v, back, who);
};

const masterScript =
	(ctx: Ctx, v: Visit): Script =>
	async (s) => {
		await sayMaster(s, MASTER_MSG.hello);
		const n = await s.choose([...MASTER_MENU], { cancel: 2 });
		const back: Spot = { x: s.state.x, y: s.state.y, dir: "up" };
		if (n === 0) await orderScript(ctx, s, v, back);
		else if (n === 1) await menuScript(ctx, s);
		s.face("master", "down");
	};

// ───────────────── 入る ─────────────────

/** いま 描いている 店（buildCafe が 入れる。「あちらの　お客様から」が 見る）。 */
let visit: Visit | null = null;

/**
 * 入った ときの「あちらの　お客様から」（まだ 聞いていない 話の ある、となりが 空いた 仲間から。
 * 相手も 店に いる 話だけ。1回の 帰りに 1回）。
 */
export const incoming = async (s: Story): Promise<void> => {
	const v = visit;
	if (!v) return;
	const st = load();
	const at = returnAt();
	if (st.sentAt === at) return;
	const free = v.layout.friends.filter((f) => !f.partner);
	const talk = cafeTalks(stageNow(), st).find(
		(t) =>
			!st.heard.includes(t.id) &&
			t.cast.length < 3 &&
			t.cast.every((w) => v.present.has(w)) &&
			free.some((f) => f.who === t.cast[0]),
	);
	const f = talk && free.find((x) => x.who === talk.cast[0]);
	if (!talk || !f) return;
	st.sentAt = at;
	save(st);
	await sayMaster(s, "あちらの　お客様からです");
	s.se("glass");
	await s.narrate(`${SPEAKERS[f.who].name}が　グラスを　かかげた。`);
	const back: Spot = { x: s.state.x, y: s.state.y, dir: s.state.dir };
	await sitDown(s, f);
	await hear(s, v, talk, f);
	await standUp(s, v, back, f.who);
};

/** 扉を 踏んだ：中へ → 「あちらの　お客様から」。 */
export const enterCafe: Script = async (s) => {
	await enterRoom("cafe")(s);
	await incoming(s);
};

/** 2人で 話せる 話（この 帰りの 抽選 用。まだ 聞いていない 話を 先に）。 */
const pairTalkOf =
	(stage: number, st: CafeState) =>
	(a: Speaker, b: Speaker): string | undefined => {
		const both = cafeTalks(stage, st).filter(
			(t) => t.cast.length === 2 && t.cast.includes(a) && t.cast.includes(b),
		);
		return (both.find((t) => !st.heard.includes(t.id)) ?? both[0])?.id;
	};

/** 住人が その 仲間と 話せる 店での 話（まだ 見ていない 話を 先に）。 */
const mobTalkOf =
	(st: CafeState) =>
	(id: MobId, who: Speaker): string | undefined => {
		const withIt = CAFE_MOBS[id].talks.filter((t) => t.with === who);
		return (
			withIt.find((t) => !(st.mobSeen ?? []).includes(`${id}:${t.key}`)) ??
			withIt[0]
		)?.key;
	};

/** 喫茶の 中の 地図（マスター・抽選した 客・名無しの 席）。曲は 村の まま。 */
export const buildCafe = (view: VillageView, ctx: Ctx): MapDef => {
	const rows = roomRows("cafe");
	const st = load();
	const layout = cafeLayout(view.stage, returnAt(), {
		pairTalk: pairTalkOf(view.stage, st),
		mobTalk: mobTalkOf(st),
	});
	const v: Visit = { layout, present: presentOf(layout), homes: new Map() };
	visit = v;
	const home = (id: string, at: readonly [number, number], dir: Dir) =>
		v.homes.set(id, { x: at[0], y: at[1], dir });
	const events: EventDef[] = roomPlaces("cafe").map((p) => {
		if (p.trigger === "touch")
			return {
				id: p.id,
				x: p.x,
				y: p.y,
				trigger: "touch",
				through: true,
				run: leaveRoom("cafe"),
			};
		const kind = p.id.replace(/_\d+$/, "");
		return sign(p.id, p.x, p.y, async (s) => {
			for (const t of cafeThing(kind)) await s.narrate(t);
			if (kind === "menu") await menuScript(ctx, s);
		});
	});
	const [mx, my] = CAFE_MASTER;
	events.push(
		npc("master", mx, my, MASTER.sprite, masterScript(ctx, v), {
			dir: "down",
		}),
	);
	for (const f of layout.friends) {
		const seat: CafeSeat = CAFE_SLOTS[f.slot];
		// 話しこんでいる 2人は 顔を 見あわせる
		const dir = f.partner ? dirTo(seat.at, seat.kiriko) : seat.dir;
		home(f.who, seat.at, dir);
		const run = companionScript(ctx, v, f);
		events.push({
			...npc(f.who, seat.at[0], seat.at[1], CAST[f.who].walk, run, {
				who: f.who,
				dir,
			}),
			notice: () => {
				const s2 = load();
				if (f.partner)
					return (MOB_IDS as string[]).includes(f.partner)
						? !(s2.mobSeen ?? []).includes(`${f.partner}:${f.talk}`)
						: !!f.talk && !s2.heard.includes(f.talk);
				return talksHere(v, f.who, s2).some((t) => !s2.heard.includes(t.id));
			},
		});
		const partner = f.partner;
		if (!partner) continue;
		const pid = actorId(partner);
		const pdir = dirTo(seat.kiriko, seat.at);
		home(partner, seat.kiriko, pdir);
		const sprite = (MOB_IDS as string[]).includes(partner)
			? MOBS[partner as MobId].sprite
			: CAST[partner as Speaker].walk;
		events.push(
			npc(pid, seat.kiriko[0], seat.kiriko[1], sprite, chatScript(v, f), {
				dir: pdir,
			}),
		);
	}
	for (const p of layout.patrons) {
		const spot = CAFE_PATRON_SPOTS[p.spot];
		if (!spot) continue;
		const me = actorId(p.id);
		home(me, spot.at, spot.dir);
		events.push({
			...npc(
				me,
				spot.at[0],
				spot.at[1],
				MOBS[p.id].sprite,
				patronScript(ctx, v, p.id, spot),
				{ dir: spot.dir },
			),
			notice: () => hasMobCafeNews(v, p.id),
		});
	}
	layout.nanashi.forEach((seat, i) => {
		const spot = CAFE_PATRON_SPOTS[seat.spot];
		if (!spot) return;
		const cells: [readonly [number, number], Dir][] = [[spot.at, spot.dir]];
		if (seat.pair) cells.push([spot.kiriko, spot.kdir]);
		const ids = cells.map((_, k) => `nanashi_${i}_${k}`);
		const run = nanashiScript(v, seat, ids);
		cells.forEach(([at, dir], k) => {
			home(ids[k], at, dir);
			events.push(
				npc(
					ids[k],
					at[0],
					at[1],
					NANASHI_WALK[(i * 2 + k) % NANASHI_WALK.length],
					run,
					{
						dir,
					},
				),
			);
		});
	});
	const shelf = bottleDecor(rows);
	return {
		id: "cafe",
		name: ROOM_NAMES.cafe,
		tiles: roomPalette("cafe", view.stage),
		rows,
		outside: "#000",
		events,
		decor: (g, ox, oy) => {
			shelf(g, ox, oy);
			mixDecor(g, ox, oy);
		},
	};
};

/** 喫茶の 調べる 物の 文。 */
const cafeThing = (kind: string): readonly string[] =>
	(ROOM_MSG.cafe as Record<string, readonly string[]>)[kind] ?? [];
