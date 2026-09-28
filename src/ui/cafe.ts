// 喫茶「保守」の 中（西の 空き地。町の 段5 から。地図は data/village/rooms.ts、文は data/cafe.ts・data/cafeMobs.ts）。
// 店を 経営する 所では なく、仲間や 住人と となりに すわって 話す 場所。どれも 寄り道で、強さには 何も 効かない。
// - 扉を 踏むと 中へ。はじめに ときどき「あちらの　お客様からです」：まだ 話していない 話の ある 仲間が
//   キリコに 一杯 送ってきて、となりに すわって その 話が 始まる（1回の 帰りに 1回まで）。
// - 仲間 5人は いつもの 席（カウンター・ソファ）。話しかけると となりに すわり、話の 一覧（まだ 聞いていない 話に「！」）と
//  「一杯　おごる」。掛け合いの 話は 相手が やってくる（みんなの 話は カウンターに 集まる）。
// - マスター（台の うしろ。台の 前の 丸いすから）：「注文する」で 倉庫の 草を 1つ わたすと、くるくる まわって
//   一杯を まぜる（ポケダン 空の パッチールの カフェの ような 演出。まわる → 泡だつ → できあがりの 曲）。
//   仲間・住人に 送るなら その 席へ はこんで となりに すわる（推しへの 投げ銭）。じぶんで 飲んでも いい。
//   好みの 一杯なら 特別な 反応。おごった 回数で その 仲間の 話が ふえる（data/cafe.ts の treats）。
//   品書きは 一杯の 名前と 草、好みを 知った 一杯は だれの 好みか。
// - 住人（越してきた 子）は 帰りごとに 何人か 来ている（プロト・レンは いつも。ほかは 帰りごとに 入れかわる）。
//   話しかけると「話す」（上から 1本ずつ。1回の 帰りに 1人 1本）・「一杯　おごる」。
// 聞いた 印・おごった 回数・知った 好みは 別の 保存場所に 残す（中断セーブ・記録・町には 手を ふれない。倉庫の 草だけ へる）。

import { defOf } from "../core/item";
import type { Item } from "../core/types";
import {
	CAFE_DRINKS,
	CAFE_GREET,
	CAFE_TALKS,
	type CafeDrink,
	type CafeLine,
	type CafeTalk,
	MASTER,
	MASTER_MENU,
	MASTER_MSG,
	SEAT_MSG,
	TREAT_REACTIONS,
	TREAT_TALKS,
} from "../data/cafe";
import { CAFE_MOBS, type CafeMobTalk } from "../data/cafeMobs";
import { CAST } from "../data/cast";
import { type Cast, MOB_IDS, MOBS, type MobId } from "../data/mobs";
import { SPEAKERS, type Speaker } from "../data/quotes";
import { ROOM_MSG, ROOM_NAMES } from "../data/rooms";
import { npc, sign } from "../data/village/helpers";
import { CAFE_FROM, type Cell, type VillageView } from "../data/village/map";
import {
	CAFE_ALL_SEATS,
	CAFE_MASTER,
	CAFE_PATRON_SPOTS,
	CAFE_SEATS,
	type CafeSeat,
	type PatronSpot,
	roomPalette,
	roomPlaces,
	roomRows,
	type Spot,
} from "../data/village/rooms";
import type { EventDef, MapDef, Script, Story } from "../engine/defs";
import { loadRecords, loadTown, takeFromStorage } from "../engine/save";
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
export const cafeTalks = (stage: number, st: CafeState = load()): CafeTalk[] =>
	[...CAFE_TALKS, ...TREAT_TALKS].filter(
		(t) =>
			stage >= (t.from ?? CAFE_FROM) &&
			(st.treats[t.cast[0]] ?? 0) >= (t.treats ?? 0),
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

// ───────────────── 来ている 住人 ─────────────────

/** 小さな ハッシュ（帰りごとに 来る 子を 入れかえる。乱数は 使わない）。 */
const hash = (s: string): number => {
	let h = 2166136261;
	for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return h >>> 0;
};

/**
 * この 帰りに 来ている 住人（越してきた 子。プロト・レンは いつも。ほかは 帰りごとに 入れかわる）。
 * 並びは 席の 順（CAFE_PATRON_SPOTS）。
 */
export const cafePatrons = (stage: number, at: number): MobId[] => {
	const moved = MOB_IDS.filter((id) => stage >= MOBS[id].from);
	const always: MobId[] = moved.filter((id) => id === "proto" || id === "ren");
	const rest = moved
		.filter((id) => !always.includes(id))
		.sort((a, b) => hash(`${at}:${a}`) - hash(`${at}:${b}`));
	return [...always, ...rest].slice(0, CAFE_PATRON_SPOTS.length);
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
		const text = l.text.replaceAll("{drink}", drink);
		await (l.who ? s.say(l.who, text) : s.narrate(text));
	}
};

/** 住人・仲間の イベント id（村と 同じ。住人は mob_<id>）。 */
const actorId = (w: Cast): string =>
	(MOB_IDS as string[]).includes(w) ? `mob_${w}` : w;

/** 仲間の いつもの 席へ もどす。 */
const reseat = (s: Story, who: Speaker): void => {
	const seat = CAFE_SEATS[who];
	s.place(who, seat.at[0], seat.at[1], seat.dir);
};

/** 暗転の 中で すわる・立つ（キリコと 動いた 人を 置きなおす）。 */
const blink = async (s: Story, put: () => void): Promise<void> => {
	await s.fadeOut(180);
	put();
	await s.fadeIn(180);
};

/** 話を 1つ 聞く（掛け合いの 相手は やってくる。聞いた 印を つける）。すわって いる 前提。 */
const hear = async (s: Story, talk: CafeTalk, host: Speaker): Promise<void> => {
	const others = talk.cast.filter((w) => w !== host);
	if (talk.cast.length >= 3) {
		// みんなの 話：カウンターに 集まる
		await s.narrate(SEAT_MSG.all);
		await blink(s, () => {
			for (const w of Object.keys(CAFE_SEATS) as Speaker[]) {
				const [x, y] = CAFE_ALL_SEATS[w];
				s.place(w, x, y, "up");
			}
			const [kx, ky] = CAFE_ALL_SEATS.kiriko;
			s.place("player", kx, ky, "up");
		});
	} else
		for (const w of others) {
			const seat = CAFE_SEATS[host];
			await s.narrate(fill(SEAT_MSG.join, { name: SPEAKERS[w].name }));
			s.place(w, seat.guest[0], seat.guest[1], seat.guestDir);
		}
	await playLines(s, talk.lines);
	const st = load();
	if (!st.heard.includes(talk.id)) st.heard.push(talk.id);
	save(st);
	if (talk.cast.length >= 3) {
		await blink(s, () => {
			for (const w of Object.keys(CAFE_SEATS) as Speaker[]) reseat(s, w);
			sitAt(s, host);
		});
	} else for (const w of others) reseat(s, w);
};

/** キリコを 仲間の となりの 席に（向きは 話す 向き）。 */
const sitAt = (s: Story, who: Speaker): void => {
	const seat = CAFE_SEATS[who];
	s.place("player", seat.kiriko[0], seat.kiriko[1], seat.talk[1]);
	s.place(who, seat.at[0], seat.at[1], seat.talk[0]);
};

const sitDown = async (s: Story, who: Speaker): Promise<void> => {
	await blink(s, () => sitAt(s, who));
	await s.narrate(fill(SEAT_MSG.sit, { name: SPEAKERS[who].name }));
};

const standUp = async (s: Story, stand: Spot, who?: Speaker): Promise<void> => {
	await blink(s, () => {
		s.place("player", stand.x, stand.y, stand.dir);
		if (who) reseat(s, who);
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

/** 仲間の となりの 席で（話の 一覧と「一杯　おごる」。とじたら 席を 立つ）。 */
const seatMenu = async (ctx: Ctx, s: Story, who: Speaker): Promise<void> => {
	let start = 0;
	for (;;) {
		await s.wait(0);
		const st = load();
		const talks = talksWith(who, stageNow(), st);
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
		const v = await listWindow(ctx, `${SPEAKERS[who].name}の　となり`, rows, {
			start,
			closeLabel: SEAT_MSG.leave,
		});
		if (!v) return;
		start = Math.max(
			0,
			rows.findIndex((r) => r.value === v),
		);
		await s.wait(0);
		if (v === "__treat") {
			await treatSeated(ctx, s, who);
			continue;
		}
		const talk = talks.find((t) => t.id === v);
		if (talk) await hear(s, talk, who);
	}
};

/** 仲間に 話しかけた（いつもの ひとこと → となりに すわる → 席の 一覧 → 立つ）。 */
const companionScript =
	(ctx: Ctx, who: Speaker): Script =>
	async (s) => {
		await s.say(who, CAFE_GREET[who]);
		const n = await s.choose(["となりに　すわる", "やめる"], { cancel: 1 });
		if (n !== 0) {
			reseat(s, who);
			return;
		}
		await sitDown(s, who);
		await seatMenu(ctx, s, who);
		await standUp(s, CAFE_SEATS[who].stand, who);
	};

// ───────────────── 住人 ─────────────────

/** 住人を いつもの 所へ もどす（掛け合いで 呼ばれた あと）。buildCafe が 入れる。 */
const placeHome = new Map<string, (s: Story) => void>();

/** 住人の 店での 1本（となりに すわる。相手が いれば 来る）。 */
const mobTalk = async (
	s: Story,
	id: MobId,
	spot: PatronSpot,
	here: (w: Cast) => boolean,
): Promise<void> => {
	const st = load();
	const at = returnAt();
	const heardNow = st.mobHeard?.[id] === at;
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
			const name = (MOB_IDS as string[]).includes(partner)
				? MOBS[partner as MobId].name
				: SPEAKERS[partner as Speaker].name;
			await s.narrate(fill(SEAT_MSG.join, { name }));
			s.place(actorId(partner), spot.guest[0], spot.guest[1], spot.guestDir);
		}
		await playMob(s, id, talk.lines);
		if (partner) {
			if ((MOB_IDS as string[]).includes(partner)) placeHome.get(partner)?.(s);
			else reseat(s, partner as Speaker);
		}
	}
	await standUp(s, spot.stand);
	s.face(me, spot.dir);
};

/** 住人に 一杯（草 → まぜる → はこぶ → ひとこと）。 */
const treatMob = async (
	ctx: Ctx,
	s: Story,
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
	await standUp(s, spot.stand);
};

const patronScript =
	(ctx: Ctx, id: MobId, spot: PatronSpot, here: (w: Cast) => boolean): Script =>
	async (s) => {
		await sayAs(s, id, CAFE_MOBS[id].hello);
		const n = await s.choose(["話す", "一杯　おごる", "やめる"], {
			cancel: 2,
		});
		if (n === 0) await mobTalk(s, id, spot, here);
		else if (n === 1) await treatMob(ctx, s, id, spot);
		s.face(actorId(id), spot.dir);
	};

/** 住人の 頭の 上の「！」（まだ 聞いていない 店の 話が あって、この 帰りは まだ）。 */
const hasMobCafeNews = (id: MobId, here: (w: Cast) => boolean): boolean => {
	const st = load();
	if (st.mobHeard?.[id] === returnAt()) return false;
	return nextMobTalk(id, st, here) !== null;
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

/** 注文：だれに（仲間・来ている 住人・じぶん）→ 草 → まぜる → はこんで となりに すわる。 */
const orderScript = async (
	ctx: Ctx,
	s: Story,
	patrons: readonly MobId[],
	back: Spot,
): Promise<void> => {
	await s.wait(0);
	const st = load();
	const rows: ListItem[] = [
		...(Object.keys(SPEAKERS) as Speaker[]).map((w) => ({
			label: SPEAKERS[w].name,
			sub: st.treats[w] ? `${st.treats[w]}杯` : "",
			value: w,
		})),
		...patrons.map((id) => ({ label: MOBS[id].name, value: `mob:${id}` })),
		{ label: "キリコ", sub: "じぶんで　飲む", value: "__self" },
	];
	const v = await listWindow(ctx, "だれに　出す？", rows, {
		closeLabel: "やめる",
	});
	if (!v) return;
	if (v.startsWith("mob:")) {
		const id = v.slice(4) as MobId;
		const i = patrons.indexOf(id);
		const spot = CAFE_PATRON_SPOTS[i];
		if (spot) await treatMob(ctx, s, id, spot);
		return;
	}
	const herb = await pickHerb(ctx, s);
	const drink = herb && CAFE_DRINKS[herb.kind];
	if (!herb || !drink) return;
	await mixScene(s, herb, drink);
	if (v === "__self") {
		s.se("drink");
		await s.narrate(fill(MASTER_MSG.self, { drink: drink.name }));
		await s.narrate(drink.taste);
		return;
	}
	const who = v as Speaker;
	await s.narrate(fill(MASTER_MSG.carry, { name: SPEAKERS[who].name }));
	await blink(s, () => sitAt(s, who));
	await reactTreat(s, who, herb, drink);
	await standUp(s, back, who);
};

const masterScript =
	(ctx: Ctx, patrons: readonly MobId[]): Script =>
	async (s) => {
		await sayMaster(s, MASTER_MSG.hello);
		const n = await s.choose([...MASTER_MENU], { cancel: 2 });
		const back: Spot = { x: s.state.x, y: s.state.y, dir: "up" };
		if (n === 0) await orderScript(ctx, s, patrons, back);
		else if (n === 1) await menuScript(ctx, s);
		s.face("master", "down");
	};

// ───────────────── 入る ─────────────────

/** 入った ときの「あちらの　お客様から」（まだ 聞いていない 話の ある 仲間から。1回の 帰りに 1回）。 */
export const incoming = async (s: Story): Promise<void> => {
	const st = load();
	const at = returnAt();
	if (st.sentAt === at) return;
	const talk = cafeTalks(stageNow(), st).find(
		(t) => !st.heard.includes(t.id) && t.cast.length < 3,
	);
	if (!talk) return;
	st.sentAt = at;
	save(st);
	const from = talk.cast[0];
	await sayMaster(s, "あちらの　お客様からです");
	s.se("glass");
	await s.narrate(`${SPEAKERS[from].name}が　グラスを　かかげた。`);
	const back: Spot = { x: s.state.x, y: s.state.y, dir: s.state.dir };
	await sitDown(s, from);
	await hear(s, talk, from);
	await standUp(s, back, from);
};

/** 扉を 踏んだ：中へ → 「あちらの　お客様から」。 */
export const enterCafe: Script = async (s) => {
	await enterRoom("cafe")(s);
	await incoming(s);
};

/** 喫茶の 中の 地図（マスター・仲間の 席・来ている 住人）。曲は 村の まま。 */
export const buildCafe = (v: VillageView, ctx: Ctx): MapDef => {
	const rows = roomRows("cafe");
	const patrons = cafePatrons(v.stage, returnAt());
	const here = (w: Cast): boolean =>
		(MOB_IDS as string[]).includes(w) ? patrons.includes(w as MobId) : true;
	placeHome.clear();
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
		npc("master", mx, my, MASTER.sprite, masterScript(ctx, patrons), {
			dir: "down",
		}),
	);
	for (const who of Object.keys(CAFE_SEATS) as Speaker[]) {
		const seat: CafeSeat = CAFE_SEATS[who];
		events.push({
			...npc(
				who,
				seat.at[0],
				seat.at[1],
				CAST[who].walk,
				companionScript(ctx, who),
				{
					who,
					dir: seat.dir,
				},
			),
			notice: () => {
				const st = load();
				return talksWith(who, stageNow(), st).some(
					(t) => !st.heard.includes(t.id),
				);
			},
		});
	}
	patrons.forEach((id, i) => {
		const spot = CAFE_PATRON_SPOTS[i];
		if (!spot) return;
		const me = actorId(id);
		placeHome.set(id, (s) => s.place(me, spot.at[0], spot.at[1], spot.dir));
		events.push({
			...npc(
				me,
				spot.at[0],
				spot.at[1],
				MOBS[id].sprite,
				patronScript(ctx, id, spot, here),
				{
					dir: spot.dir,
				},
			),
			notice: () => hasMobCafeNews(id, here),
		});
	});
	const shelf = bottleDecor(rows);
	return {
		id: "cafe",
		name: ROOM_NAMES.cafe,
		tiles: roomPalette("cafe", v.stage),
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
