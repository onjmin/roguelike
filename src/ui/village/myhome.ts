// キリコの 家（マイホーム）の 場面（形と 文は data/village/myhome.ts）。
// - 買う 前の 扉：不動産屋が 35年ローンを すすめる。契約すると 頭金を 払って 鍵と ベッド（財布は engine/wallet.ts）。
// - 帰るたびに 月の 返済を 引き落とし（家に 入った ときに。足りなければ 滞納）、宅配便が 1つ 届く。
// - 町の 住人（リサイクルショップ・コーポ・団地・マンション）に 話すと 1度だけ 家具を くれる。
// - リサイクルショップの レジで 家具を 買える（furnitureShop）。電話で 喫茶で 親しく なった 人を 招く（次の 帰りまで いる）。
// - 中：目の前の 床で A（スマホは キリコを タップ）→ 片づけた 家具を 絵つきの 一覧から 選んで 持つ。持っている
//   あいだは 目の前に 置く 所を うすい 絵で 見せ（置けなければ 赤い 印）、もう 1度 A で 置く。家具を 調べて 動かす・片づける。
//   収納で 家具の 一覧・壁紙・床を かえる。
// 保存は kiriko-roguelike/myhome だけ（段の 下見 ?stage=・?event= の あいだは 書かない）。強さ・道具・段には ふれない。

import { CAST } from "../../data/people/cast";
import { type Cast, MOBS } from "../../data/people/mobs";
import { devEvent } from "../../data/story/objectives";
import type { Speaker } from "../../data/story/quotes";
import { awayFriends } from "../../data/story/story";
import type { Facility } from "../../data/village/facilities";
import type { Cell } from "../../data/village/map";
import {
	FLOORINGS,
	type Flooring,
	FURNITURE,
	FURNITURE_PRICE,
	type FurnitureId,
	furnitureAt,
	furnitureSize,
	type Gift,
	GUEST_SPOTS,
	HOME_DOWN,
	HOME_GIFTS,
	HOME_MAX,
	HOME_MONTHLY,
	HOME_MSG,
	HOME_ROWS,
	HOME_VISIT,
	type HomeLayout,
	homeRows,
	LOAN_MONTHS,
	MOVE_IN_GIFT,
	type Placed,
	placeInFront,
	RESIDENT_GIFTS,
	VISIT_ANY,
	WALLPAPERS,
	type Wallpaper,
} from "../../data/village/myhome";
import { tatamiSample } from "../../data/village/tatami";
import { drawRefInCell, loadImage } from "../../engine/assets";
import type { EventDef, Script, Story } from "../../engine/defs";
import { loadProgress, loadRecords, loadTown } from "../../engine/save";
import { DIR_VEC, type Dir, TILE } from "../../engine/types";
import { spendYen, walletYen, yen } from "../../engine/wallet";
import type { Ctx } from "../ctx";
import { listWindow } from "../list";
import { cafeBonds } from "./cafe";
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
	/** 返した 月（2026-10-13 より 前の 保存は returns と 同じ）。 */
	paid: number;
	/** 払えずに たまった 月。 */
	late: number;
	/** 招いた 人（次の 帰りまで いる）。 */
	guest: Cast | null;
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
	paid: 0,
	late: 0,
	guest: null,
});

/** 招ける 人か（仲間か 住人の id）。 */
const isCast = (x: unknown): x is Cast =>
	typeof x === "string" && (x in CAST || x in MOBS);

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
				paid:
					typeof raw.paid === "number" ? count(raw.paid) : count(raw.returns),
				late: count(raw.late),
				guest: isCast(raw.guest) ? raw.guest : null,
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

/**
 * 帰りを 数える（契約の あと、前に 数えた 帰りより 新しい 帰りが あれば 1つ）。新しい 帰りなら
 * 月の 返済を 財布から 引き落とし（滞納の ぶんも まとめて。足りる だけ）、招いた 人は 帰る。
 * 返した 月数（足りずに 返せなかったら -1。新しい 帰りで なければ 0）。
 */
const syncReturns = (m: HomeMemo): number => {
	if (!m.owned) return 0;
	const at = loadRecords()[0]?.at ?? -1;
	if (at === m.returnAt) return 0;
	m.returns++;
	m.returnAt = at;
	m.guest = null;
	const due = Math.min(m.late + 1, LOAN_MONTHS - m.paid);
	if (due <= 0) return 0;
	const n = Math.min(due, Math.floor(walletYen() / HOME_MONTHLY));
	if (n > 0) spendYen(n * HOME_MONTHLY, previewing());
	m.paid += n;
	m.late = due - n;
	return n > 0 ? n : -1;
};

/** 返済した 月（35年で 完済）。 */
export const paidMonths = (m: HomeMemo): number =>
	Math.min(LOAN_MONTHS, m.paid);

// ───────────────── 部屋 ─────────────────

/** 家の 中の 部屋（保存の 並び・壁紙・床から 組みなおす。買った あとは 名前も「キリコの　家」）。 */
export const homeFacility = (f: Facility): Facility => {
	const m = loadHome();
	const layout: HomeLayout = { placed: m.placed, wall: m.wall, floor: m.floor };
	const { rows, art, things } = homeRows(layout);
	// 一覧で えらんで いる あいだは その 壁紙・床で（下見。保存は しない）
	const wall = WALLPAPERS[trying?.wall ?? m.wall];
	const fl = FLOORINGS[trying?.floor ?? m.floor];
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

/** 模様替えの 一覧で カーソルが のって いる 壁紙・床（部屋を その 形で 組んで 見せる。決めるか やめると 消す）。 */
let trying: { wall?: number; floor?: number } | null = null;

/** 下見の 組みなおし（つづけて 動かしても 1つずつ）。 */
let tryChain: Promise<void> = Promise.resolve();
const showTry = (s: Story, next: typeof trying): Promise<void> => {
	tryChain = tryChain.then(async () => {
		trying = next;
		await s.rebuild();
	});
	return tryChain;
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

// ───────────────── 絵（一覧の 絵・持っている 家具の 下見） ─────────────────

/** 一覧の 行の 絵の 高さ（CSS 画素）。 */
const ICON_H = 32;

/**
 * 一覧の 行の 絵（マスごとの 絵を 並べた キャンバス。bg は 透けた 所の 色）。絵は 読めしだい 描く。
 */
const artIcon = (
	cells: readonly (readonly string[])[],
	bg?: string,
): HTMLCanvasElement => {
	const w = Math.max(...cells.map((r) => r.length));
	const h = cells.length;
	const c = document.createElement("canvas");
	c.width = w * TILE;
	c.height = h * TILE;
	const k = ICON_H / (h * TILE);
	c.className = "mon-art";
	c.style.width = `${w * TILE * k}px`;
	c.style.height = `${ICON_H}px`;
	const g = c.getContext("2d");
	if (!g) return c;
	const refs = cells.flat();
	void Promise.all(refs.map((r) => loadImage(r))).then(() => {
		g.imageSmoothingEnabled = false;
		g.clearRect(0, 0, c.width, c.height);
		if (bg) {
			g.fillStyle = bg;
			g.fillRect(0, 0, c.width, c.height);
		}
		cells.forEach((row, y) => {
			row.forEach((ref, x) => {
				drawRefInCell(g, ref, x * TILE, y * TILE, TILE, "cell");
			});
		});
	});
	return c;
};

const furnIcon = (id: FurnitureId) => artIcon(FURNITURE[id].cells);
const wallIcon = (w: Wallpaper) => artIcon([[w.up], [w.low]], w.color);
const floorIcon = (f: Flooring) =>
	artIcon(tatamiSample(f.floor) ?? [[f.floor, f.floor]], f.color);

/** 家具の 大きさ（一覧の 小さな 字）。 */
const sizeLabel = (id: FurnitureId) => {
	const { w, h } = furnitureSize(id);
	return w * h > 1 ? `${w}×${h}` : undefined;
};

/** 片づけた 家具の 一覧から 1つ 選ぶ（絵つき。なければ null）。 */
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
		m.stored.map((id) => ({
			label: furnName(id),
			sub: sizeLabel(id),
			value: id,
			icon: furnIcon(id),
		})),
		{ closeLabel: "やめる" },
	);
	return v && isFurn(v) ? v : null;
};

/** 持つ（目の前に うすい 絵で 置く 所を 見せる。A で 置く）。 */
const carry = (s: Story, id: FurnitureId): void => {
	carrying = id;
	s.toast(fill(HOME_MSG.carryHint, { name: furnName(id) }));
};

/** 目の前の マス。 */
const frontOf = (me: { x: number; y: number; dir: Dir }): Cell => [
	me.x + DIR_VEC[me.dir].dx,
	me.y + DIR_VEC[me.dir].dy,
];

/** 持っている 家具を 目の前に 置く 所（置けなければ null）。 */
const ghostAt = (
	m: HomeMemo,
	id: FurnitureId,
	me: { x: number; y: number; dir: Dir },
): Placed | null => {
	const [fx, fy] = frontOf(me);
	if ([...(HOME_ROWS[fy] ?? "")][fx] !== "." || furnitureAt(m.placed, fx, fy))
		return null;
	return placeInFront(m.placed, id, [me.x, me.y], [fx, fy]);
};

/**
 * キリコの 家の 飾り：持っている 家具を 目の前に うすく 描く（置ける 所。置けなければ 赤い 印）。
 */
export const homeDecor =
	() =>
	(
		g: CanvasRenderingContext2D,
		ox: number,
		oy: number,
		t: number,
		me?: { x: number; y: number; dir: Dir },
	): void => {
		if (!carrying || !me) return;
		const m = loadHome();
		if (!m.stored.includes(carrying)) return;
		const p = ghostAt(m, carrying, me);
		const [fx, fy] = frontOf(me);
		g.save();
		if (p) {
			g.globalAlpha = 0.5 + 0.15 * Math.sin(t / 220);
			FURNITURE[carrying].cells.forEach((row, dy) => {
				row.forEach((ref, dx) => {
					const x = (p.x + dx) * TILE - ox;
					const y = (p.y + dy) * TILE - oy;
					drawRefInCell(g, ref, x, y, TILE, "cell");
				});
			});
			const { w, h } = furnitureSize(carrying);
			g.globalAlpha = 1;
			g.strokeStyle = "rgba(255,255,255,0.85)";
			g.strokeRect(
				p.x * TILE - ox + 0.5,
				p.y * TILE - oy + 0.5,
				w * TILE - 1,
				h * TILE - 1,
			);
		} else if (fy >= 0 && fy < HOME_ROWS.length) {
			g.fillStyle = "rgba(230,40,40,0.35)";
			g.fillRect(fx * TILE - ox, fy * TILE - oy, TILE, TILE);
			g.strokeStyle = "rgba(230,40,40,0.9)";
			g.strokeRect(
				fx * TILE - ox + 0.5,
				fy * TILE - oy + 0.5,
				TILE - 1,
				TILE - 1,
			);
		}
		g.restore();
	};

/** キリコの 家で 先に 読む 絵（下見の 家具）。 */
export const homeImages = (): string[] =>
	Object.values(FURNITURE).flatMap((f) => f.cells.flat());

/**
 * 目の前が 家具の ない 床で A（ui/village/village.ts の onTalkEmpty）：持っている 家具か、片づけた 家具から 選んで 置く。
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
			// 選んだら 持つ（目の前に うすい 絵。もう 1度 A で 置く）
			const id = await chooseStored(ctx, s, HOME_MSG.emptyTitle);
			if (id) carry(s, id);
		};
	};

/** 収納：家具の 一覧（選ぶと 持つ）・壁紙・床。 */
const closet = async (ctx: Ctx, s: Story): Promise<void> => {
	// 持った まま 調べたら、持っている 家具を もどす
	if (carrying) {
		const name = furnName(carrying);
		carrying = null;
		await s.narrate(fill(HOME_MSG.returned, { name }));
		return;
	}
	await s.narrate(HOME_MSG.closet);
	const n = await s.choose([...HOME_MSG.closetMenu], { cancel: 4 });
	if (n === 3) {
		// ぜんぶ 片づける（置いた 家具を まとめて 収納へ）
		const m = loadHome();
		if (!m.placed.length) {
			await s.narrate(HOME_MSG.clearNone);
			return;
		}
		await s.narrate(HOME_MSG.clearAsk);
		if ((await s.choose([...HOME_MSG.clearMenu], { cancel: 1 })) !== 0) return;
		for (const p of m.placed) if (!m.stored.includes(p.id)) m.stored.push(p.id);
		m.placed = [];
		saveHome(m);
		s.se("put");
		await rebuildSoft(s);
		await s.narrate(HOME_MSG.cleared);
		return;
	}
	if (n === 0) {
		const id = await chooseStored(ctx, s, HOME_MSG.stored);
		if (!id) return;
		carry(s, id);
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
				icon: n === 1 ? wallIcon(w as Wallpaper) : floorIcon(w as Flooring),
			})),
			{
				closeLabel: "やめる",
				start: n === 1 ? m.wall : m.floor,
				// カーソルを 動かすと 部屋が その 壁紙・床に かわる（下見）
				onCursor: (c) => {
					void showTry(s, n === 1 ? { wall: Number(c) } : { floor: Number(c) });
				},
			},
		);
		if (v !== null) {
			if (n === 1) m.wall = Number(v);
			else m.floor = Number(v);
			saveHome(m);
		}
		// やめたら もとの 形に もどす
		await showTry(s, null);
		if (v !== null)
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
				await s.narrate(
					fill(l, {
						y: Math.floor(left / 12),
						m: left % 12,
						monthly: yen(HOME_MONTHLY),
						have: yen(walletYen()),
					}),
				);
			if (m.owned && m.late > 0)
				await s.narrate(fill(HOME_MSG.late, { n: m.late }));
			return;
		}
		if (kind === "phone") {
			if (m.owned) await phone(ctx, s);
			else await s.narrate(HOME_MSG.phone);
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
		if (n === 0) carry(s, kind);
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
	const repaid = syncReturns(m);
	const due = Math.min(HOME_GIFTS.length, m.returns);
	const gifts = HOME_GIFTS.slice(m.parcels, due);
	m.parcels = Math.max(m.parcels, due);
	// もう 持っている（買った）家具は 2つめを 置かない
	const fresh = gifts.filter((g) => !owns(m, g.id));
	for (const g of fresh) m.stored.push(g.id);
	saveHome(m);
	if (repaid > 0)
		await s.narrate(
			fill(HOME_MSG.repaid, { n: repaid, price: yen(repaid * HOME_MONTHLY) }),
		);
	else if (repaid < 0) await s.narrate(HOME_MSG.unpaid);
	if (!gifts.length) return;
	s.se("item");
	await s.narrate(HOME_MSG.parcel);
	for (const g of gifts) {
		await receive(s, g);
		if (!fresh.includes(g))
			await s.narrate(fill(HOME_MSG.already, { name: furnName(g.id) }));
	}
	if (fresh.length) await s.narrate(HOME_MSG.placeHint);
};

/** その 家具を 持っているか（収納か 部屋）。 */
const owns = (m: HomeMemo, id: FurnitureId): boolean =>
	m.stored.includes(id) || m.placed.some((p) => p.id === id);

// ───────────────── 買う（リサイクルショップの レジ） ─────────────────

/**
 * リサイクルショップの レジ（ui/village/facilities.ts の play "furnshop"）：まだ 持って いない 家具を
 * 絵つきの 一覧から 選んで 買う。家を 買う 前は すすめるだけ。
 */
export const furnitureShop = async (ctx: Ctx, s: Story): Promise<void> => {
	const who = { name: "店主" };
	if (!loadHome().owned) {
		await s.say("nanj", HOME_MSG.shopNoHome, who);
		return;
	}
	await s.say("nanj", HOME_MSG.shop, who);
	let start = 0;
	for (;;) {
		const m = loadHome();
		const ids = (Object.keys(FURNITURE) as FurnitureId[]).filter(
			(id) => !owns(m, id),
		);
		if (!ids.length) {
			await s.say("nanj", HOME_MSG.shopEmpty, who);
			return;
		}
		const have = walletYen();
		await s.wait(0);
		const v = await listWindow(
			ctx,
			`${HOME_MSG.shopTitle}<br><small>手もと　${yen(have)}</small>`,
			ids.map((id) => ({
				label: furnName(id),
				sub: yen(FURNITURE_PRICE[id]),
				value: id,
				icon: furnIcon(id),
				disabled: FURNITURE_PRICE[id] > have,
			})),
			{ closeLabel: "やめる", start },
		);
		if (!v || !isFurn(v)) return;
		start = Math.max(0, ids.indexOf(v));
		const price = FURNITURE_PRICE[v];
		await s.narrate(
			fill(HOME_MSG.shopAsk, { name: furnName(v), price: yen(price) }),
		);
		if ((await s.choose([...HOME_MSG.shopMenu], { cancel: 1 })) !== 0) continue;
		if (!spendYen(price, previewing())) {
			await s.say("nanj", fill(HOME_MSG.shopShort, { price: yen(price) }), who);
			continue;
		}
		const m2 = loadHome();
		if (!owns(m2, v)) m2.stored.push(v);
		saveHome(m2);
		s.se("item");
		await s.narrate(fill(HOME_MSG.bought, { name: furnName(v) }));
	}
};

// ───────────────── 招く（電話） ─────────────────

/** 招ける 人の 名前。 */
const castName = (w: Cast): string =>
	w in CAST ? CAST[w as Speaker].name : MOBS[w as Exclude<Cast, Speaker>].name;
const castWalk = (w: Cast): string =>
	w in CAST
		? CAST[w as Speaker].walk
		: MOBS[w as Exclude<Cast, Speaker>].sprite;

/** 電話：喫茶で 親しく なった 人を 招く（村に いない 人は 出ない）。来ている 人は 帰って もらえる。 */
const phone = async (ctx: Ctx, s: Story): Promise<void> => {
	const m = loadHome();
	if (m.guest) {
		const name = castName(m.guest);
		await s.narrate(fill(HOME_MSG.phoneHere, { name }));
		if ((await s.choose([...HOME_MSG.phoneMenu], { cancel: 1 })) !== 0) return;
		m.guest = null;
		saveHome(m);
		await rebuildSoft(s);
		await s.narrate(fill(HOME_MSG.phoneBye, { name }));
		return;
	}
	const away = awayFriends(loadProgress().cleared, loadTown().stage);
	const list = cafeBonds().filter((w) => !away.includes(w as Speaker));
	if (!list.length) {
		await s.narrate(HOME_MSG.phoneNone);
		return;
	}
	await s.narrate(HOME_MSG.phone);
	await s.wait(0);
	const v = await listWindow(
		ctx,
		HOME_MSG.phoneTitle,
		list.map((w) => ({ label: castName(w), value: w })),
		{ closeLabel: "やめる" },
	);
	if (!v || !isCast(v)) return;
	await s.narrate(fill(HOME_MSG.phoneCall, { name: castName(v) }));
	const m2 = loadHome();
	m2.guest = v;
	saveHome(m2);
	s.se("doorWood");
	await rebuildSoft(s);
};

/** 招いた 人（キリコの 家の 中。話すと 家に ついての ひとこと）。 */
export const guestEvent = (): EventDef | null => {
	const m = loadHome();
	const w = m.guest;
	// 新しい 帰りの あとは もう 帰っている（家に 入った とき syncReturns が 消す）
	if (!m.owned || !w || m.returnAt !== (loadRecords()[0]?.at ?? -1))
		return null;
	const spot = GUEST_SPOTS.find(([x, y]) => !furnitureAt(m.placed, x, y));
	if (!spot) return null;
	const name = castName(w);
	const lines = HOME_VISIT[w] ?? VISIT_ANY;
	return {
		id: "home_guest",
		x: spot[0],
		y: spot[1],
		sprite: castWalk(w),
		dir: "down",
		trigger: "talk",
		run: async (s) => {
			s.face("home_guest", "player");
			// 置いた 家具の 数で ひとこと（少ない・ふつう・多い）
			const k = m.placed.length < 3 ? 0 : m.placed.length < 8 ? 1 : 2;
			const say = w in CAST ? (w as Speaker) : "nanj";
			await s.say(say, lines[Math.min(k, lines.length - 1)], { name });
		},
	};
};

/**
 * 町の 住人の ひとことの あと（ui/village/facilities.ts）：家を 買って いて、まだ もらって いなければ 家具を くれる。
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
	const agent = { name: "不動産屋" };
	for (const l of HOME_MSG.forSale) await s.narrate(l);
	for (const l of HOME_MSG.agent)
		await s.say("nanj", fill(l, { monthly: yen(HOME_MONTHLY) }), agent);
	await s.say("nanj", fill(HOME_MSG.down, { price: yen(HOME_DOWN) }), agent);
	const n = await s.choose([...HOME_MSG.ask], { cancel: 1 });
	if (n !== 0) {
		await s.say("nanj", HOME_MSG.declined, agent);
		return false;
	}
	if (!spendYen(HOME_DOWN, previewing())) {
		await s.say(
			"nanj",
			fill(HOME_MSG.downShort, { have: yen(walletYen()) }),
			agent,
		);
		return false;
	}
	s.se("arcCoin");
	await s.narrate(fill(HOME_MSG.paid, { price: yen(HOME_DOWN) }));
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
	m.paid = 0;
	m.late = 0;
	if (!m.stored.includes(MOVE_IN_GIFT.id))
		m.stored = [...m.stored, MOVE_IN_GIFT.id];
	saveHome(m);
	await s.say("nanj", HOME_MSG.welcome, { name: "不動産屋" });
	await receive(s, MOVE_IN_GIFT);
	return true;
};

/**
 * 扉を 踏んだ（ui/village/facilities.ts の enterFacility から）。買う 前は 不動産屋（やめたら 1歩 もどる）、
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
