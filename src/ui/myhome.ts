// キリコの 家（マイホーム）の 場面（形と 文は data/village/myhome.ts）。
// - 買う 前の 扉：不動産屋が 35年ローンを すすめる。契約すると 鍵と ベッド（お金は 払わない。演出だけ）。
// - 帰るたびに 返済予定表が 1か月 進み、宅配便が 1つ 届く（家に 入った ときに 開ける）。
// - 町の 住人（リサイクルショップ・コーポ・団地・マンション）に 話すと 1度だけ 家具を くれる。
// - 中：目の前の 床で A（スマホは キリコを タップ）→ 片づけた 家具を 置く。家具を 調べて 動かす・片づける。
//   収納で 家具の 一覧・壁紙・床を かえる。
// 保存は kiriko-roguelike/myhome だけ（段の 下見 ?stage=・?event= の あいだは 書かない）。強さ・道具・段には ふれない。

import { devEvent } from "../data/objectives";
import type { Facility } from "../data/village/facilities";
import {
	FLOORINGS,
	FURNITURE,
	type FurnitureId,
	furnitureAt,
	type Gift,
	HOME_GIFTS,
	HOME_MAX,
	HOME_MSG,
	HOME_ROWS,
	type HomeLayout,
	homeRows,
	LOAN_MONTHS,
	MOVE_IN_GIFT,
	type Placed,
	placeInFront,
	RESIDENT_GIFTS,
	WALLPAPERS,
} from "../data/village/myhome";
import type { Script, Story } from "../engine/defs";
import { loadRecords } from "../engine/save";
import type { Ctx } from "./ctx";
import { listWindow } from "./list";
import { previewStage } from "./villageReturn";
import { fill } from "./villageTalk";

// ───────────────── 保存（kiriko-roguelike/myhome） ─────────────────

const KEY = "kiriko-roguelike/myhome";

export type HomeMemo = {
	v: 1;
	owned: boolean;
	/** 契約の あとの 帰りの 数（返済した 月・届いた 宅配便の もと）。 */
	returns: number;
	/** 数えた 帰り（loadRecords()[0].at。はじめは -1）。 */
	returnAt: number;
	/** 開けた 宅配便の 数（HOME_GIFTS の 頭から）。 */
	parcels: number;
	/** もらった 住人の 家具（家具の id）。 */
	resident: FurnitureId[];
	stored: FurnitureId[];
	placed: Placed[];
	wall: number;
	floor: number;
};

const EMPTY = (): HomeMemo => ({
	v: 1,
	owned: false,
	returns: 0,
	returnAt: -1,
	parcels: 0,
	resident: [],
	stored: [],
	placed: [],
	wall: 0,
	floor: 0,
});

let memo: HomeMemo | null = null;

const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

const isFurn = (x: unknown): x is FurnitureId =>
	typeof x === "string" && x in FURNITURE;
const count = (x: unknown): number =>
	typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0;
const pick = (x: unknown, n: number): number => Math.min(count(x), n - 1);

/** 読む（壊れた JSON・足りない 欄は 初期値）。 */
export const loadHome = (): HomeMemo => {
	if (memo) return structuredClone(memo);
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Record<
			string,
			unknown
		> | null;
		if (raw && raw.v === 1) {
			const ids = (x: unknown) =>
				Array.isArray(x) ? [...new Set(x.filter(isFurn))] : [];
			const placed = Array.isArray(raw.placed)
				? (raw.placed as Record<string, unknown>[])
						.filter((p) => p && isFurn(p.id))
						.map((p) => ({
							id: p.id as FurnitureId,
							x: count(p.x),
							y: count(p.y),
						}))
				: [];
			return {
				v: 1,
				owned: raw.owned === true,
				returns: count(raw.returns),
				returnAt:
					typeof raw.returnAt === "number" && Number.isFinite(raw.returnAt)
						? raw.returnAt
						: -1,
				parcels: count(raw.parcels),
				resident: ids(raw.resident),
				stored: ids(raw.stored),
				placed,
				wall: pick(raw.wall, WALLPAPERS.length),
				floor: pick(raw.floor, FLOORINGS.length),
			};
		}
	} catch {
		// 読めなければ はじめから
	}
	return EMPTY();
};

/** 書く（noSave なら この回だけ 覚える）。 */
export const saveHome = (m: HomeMemo, noSave = previewing()): void => {
	memo = structuredClone(m);
	if (noSave) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};

/** 試験用：覚えている 写しを 捨てる（localStorage から 読みなおす）。 */
export const forgetHomeMemo = (): void => {
	memo = null;
};

/** 帰りを 数える（契約の あと、前に 数えた 帰りより 新しい 帰りが あれば 1つ）。 */
const syncReturns = (m: HomeMemo): void => {
	if (!m.owned) return;
	const at = loadRecords()[0]?.at ?? -1;
	if (at === m.returnAt) return;
	m.returns++;
	m.returnAt = at;
};

/** 返済した 月（35年で 完済）。 */
export const paidMonths = (m: HomeMemo): number =>
	Math.min(LOAN_MONTHS, m.returns);

// ───────────────── 部屋 ─────────────────

/** 家の 中の 部屋（保存の 並び・壁紙・床から 組みなおす。買った あとは 名前も「キリコの　家」）。 */
export const homeFacility = (f: Facility): Facility => {
	const m = loadHome();
	const layout: HomeLayout = { placed: m.placed, wall: m.wall, floor: m.floor };
	const { rows, art, things } = homeRows(layout);
	const wall = WALLPAPERS[m.wall];
	const fl = FLOORINGS[m.floor];
	const room = f.room;
	if (!room) return f;
	return {
		...f,
		name: m.owned ? "キリコの　家" : f.name,
		room: {
			...room,
			look: {
				floor: fl.floor,
				floorColor: fl.color,
				up: wall.up,
				low: wall.low,
				wallColor: wall.color,
			},
			rows,
			tiles: (k) => ({
				...room.tiles?.(k),
				...Object.fromEntries(
					Object.entries(art).map(([ch, ref]) => [ch, k.on(ref)]),
				),
			}),
			things,
		},
	};
};

/** 持っている（動かして いる）家具。家の 外へ 出ても 収納に 入っている（ここは 次に 置く 物の 印）。 */
let carrying: FurnitureId | null = null;

const rebuildSoft = async (s: Story): Promise<void> => {
	await s.fadeOut(120);
	await s.rebuild();
	await s.fadeIn(120);
};

const furnName = (id: FurnitureId) => FURNITURE[id].name;

/** 置く：目の前の マスに。置けたら true。 */
const placeHere = async (
	s: Story,
	id: FurnitureId,
	front: readonly [number, number],
): Promise<boolean> => {
	const m = loadHome();
	if (m.placed.length >= HOME_MAX) {
		await s.narrate(HOME_MSG.full);
		return false;
	}
	const p = placeInFront(
		m.placed,
		id,
		[s.state.x, s.state.y],
		[front[0], front[1]],
	);
	if (!p) {
		await s.narrate(HOME_MSG.cannot);
		return false;
	}
	m.placed = [...m.placed, p];
	m.stored = m.stored.filter((x) => x !== id);
	saveHome(m);
	if (carrying === id) carrying = null;
	s.se("put");
	await rebuildSoft(s);
	return true;
};

/** 片づけた 家具の 一覧から 1つ 選ぶ（なければ null）。 */
const chooseStored = async (
	ctx: Ctx,
	s: Story,
	title: string,
): Promise<FurnitureId | null> => {
	const m = loadHome();
	if (!m.stored.length) {
		await s.narrate(HOME_MSG.none);
		return null;
	}
	await s.wait(0);
	const v = await listWindow(
		ctx,
		title,
		m.stored.map((id) => ({ label: furnName(id), value: id })),
		{ closeLabel: "やめる" },
	);
	return v && isFurn(v) ? v : null;
};

/**
 * 目の前が 家具の ない 床で A（ui/village.ts の onTalkEmpty）：持っている 家具か、片づけた 家具から 選んで 置く。
 * 床で なければ null（何も しない）。
 */
export const homeEmpty =
	(ctx: Ctx) =>
	(x: number, y: number): Script | null => {
		if ([...(HOME_ROWS[y] ?? "")][x] !== ".") return null;
		const m = loadHome();
		if (!m.owned || furnitureAt(m.placed, x, y)) return null;
		if (carrying && !m.stored.includes(carrying)) carrying = null;
		if (!carrying && !m.stored.length) return null;
		return async (s) => {
			if (carrying) {
				await placeHere(s, carrying, [x, y]);
				return;
			}
			const id = await chooseStored(ctx, s, HOME_MSG.emptyTitle);
			if (id) await placeHere(s, id, [x, y]);
		};
	};

/** 収納：家具の 一覧（選ぶと 持つ）・壁紙・床。 */
const closet = async (ctx: Ctx, s: Story): Promise<void> => {
	await s.narrate(HOME_MSG.closet);
	const n = await s.choose([...HOME_MSG.closetMenu], { cancel: 3 });
	if (n === 0) {
		const id = await chooseStored(ctx, s, HOME_MSG.stored);
		if (!id) return;
		carrying = id;
		await s.narrate(fill(HOME_MSG.picked, { name: furnName(id) }));
		return;
	}
	if (n === 1 || n === 2) {
		const m = loadHome();
		const list = n === 1 ? WALLPAPERS : FLOORINGS;
		await s.wait(0);
		const v = await listWindow(
			ctx,
			n === 1 ? HOME_MSG.wallTitle : HOME_MSG.floorTitle,
			list.map((w, i) => ({
				label: w.name,
				value: String(i),
				sub: i === (n === 1 ? m.wall : m.floor) ? "いま" : undefined,
			})),
			{ closeLabel: "やめる", start: n === 1 ? m.wall : m.floor },
		);
		if (v === null) return;
		if (n === 1) m.wall = Number(v);
		else m.floor = Number(v);
		saveHome(m);
		await rebuildSoft(s);
		await s.narrate(fill(HOME_MSG.changed, { name: list[Number(v)].name }));
	}
};

/** 部屋の 物を 調べた（返済予定表・収納・家具）。 */
export const homeThing =
	(ctx: Ctx, kind: string): Script =>
	async (s) => {
		const m = loadHome();
		if (kind === "loan") {
			const left = LOAN_MONTHS - paidMonths(m);
			const lines = m.owned && left > 0 ? HOME_MSG.loan : HOME_MSG.loanDone;
			for (const l of lines)
				await s.narrate(fill(l, { y: Math.floor(left / 12), m: left % 12 }));
			return;
		}
		if (kind === "closet") {
			if (m.owned) await closet(ctx, s);
			else await s.narrate(HOME_MSG.closet);
			return;
		}
		if (!isFurn(kind)) return;
		await s.narrate(FURNITURE[kind].line);
		if (!m.owned) return;
		const n = await s.choose([...HOME_MSG.thingMenu], { cancel: 2 });
		if (n === 2) return;
		m.placed = m.placed.filter((p) => p.id !== kind);
		if (!m.stored.includes(kind)) m.stored = [...m.stored, kind];
		saveHome(m);
		if (n === 0) carrying = kind;
		await rebuildSoft(s);
		await s.narrate(
			fill(n === 0 ? HOME_MSG.picked : HOME_MSG.putAway, {
				name: furnName(kind),
			}),
		);
	};

// ───────────────── もらう ─────────────────

const receive = async (s: Story, g: Gift): Promise<void> => {
	await s.narrate(fill(HOME_MSG.from, { from: g.from, name: furnName(g.id) }));
	await s.narrate(g.note);
};

/** 家に 入った ときの 宅配便（契約の あとの 帰りの 数だけ。まとめて 開ける）。 */
const openParcels = async (s: Story): Promise<void> => {
	const m = loadHome();
	syncReturns(m);
	const due = Math.min(HOME_GIFTS.length, m.returns);
	const gifts = HOME_GIFTS.slice(m.parcels, due);
	m.parcels = Math.max(m.parcels, due);
	for (const g of gifts) if (!m.stored.includes(g.id)) m.stored.push(g.id);
	saveHome(m);
	if (!gifts.length) return;
	s.se("item");
	await s.narrate(HOME_MSG.parcel);
	for (const g of gifts) await receive(s, g);
	await s.narrate(HOME_MSG.placeHint);
};

/**
 * 町の 住人の ひとことの あと（ui/facilities.ts）：家を 買って いて、まだ もらって いなければ 家具を くれる。
 */
export const residentGift = async (
	s: Story,
	facility: string,
	person: string,
	name: string,
): Promise<void> => {
	const g = RESIDENT_GIFTS.find(
		(r) => r.facility === facility && r.person === person,
	);
	if (!g) return;
	const m = loadHome();
	if (!m.owned || m.resident.includes(g.id)) return;
	await s.say("nanj", g.note, { name });
	m.resident = [...m.resident, g.id];
	if (!m.stored.includes(g.id) && !m.placed.some((p) => p.id === g.id))
		m.stored = [...m.stored, g.id];
	saveHome(m);
	s.se("item");
	await s.narrate(fill(HOME_MSG.gotFrom, { name: furnName(g.id) }));
};

// ───────────────── 扉 ─────────────────

/** 買う：不動産屋の すすめ → 契約 → 鍵と ベッド。買わなければ false。 */
const buy = async (s: Story): Promise<boolean> => {
	for (const l of HOME_MSG.forSale) await s.narrate(l);
	for (const l of HOME_MSG.agent) await s.say("nanj", l, { name: "不動産屋" });
	const n = await s.choose([...HOME_MSG.ask], { cancel: 1 });
	if (n !== 0) {
		await s.say("nanj", HOME_MSG.declined, { name: "不動産屋" });
		return false;
	}
	for (const [i, l] of HOME_MSG.contract.entries())
		if (i === 1) await s.say("nanj", l, { name: "不動産屋" });
		else await s.narrate(l);
	s.se("levelup");
	await s.narrate(HOME_MSG.keys);
	const m = loadHome();
	m.owned = true;
	m.returns = 0;
	m.returnAt = loadRecords()[0]?.at ?? -1;
	m.parcels = 0;
	if (!m.stored.includes(MOVE_IN_GIFT.id))
		m.stored = [...m.stored, MOVE_IN_GIFT.id];
	saveHome(m);
	await s.say("nanj", HOME_MSG.welcome, { name: "不動産屋" });
	await receive(s, MOVE_IN_GIFT);
	return true;
};

/**
 * 扉を 踏んだ（ui/facilities.ts の enterFacility から）。買う 前は 不動産屋（やめたら 1歩 もどる）、
 * 買った あとは ふつうに 入って、宅配便を 開ける。
 */
export const enterHome =
	(enter: Script): Script =>
	async (s) => {
		if (!loadHome().owned && !(await buy(s))) {
			await s.move("player", "d");
			return;
		}
		await enter(s);
		await openParcels(s);
	};
