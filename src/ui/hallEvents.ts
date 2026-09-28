// おんJ 本館の 中の スクリプト（地図と 置き場所は data/village/hall.ts、文は data/hall.ts）。
// 村の 扉を 踏むと（前で A でも）入り、出口の マットを 踏むと 入った 扉の 前へ 出る（Story.warp。暗転の 中で）。
// 中の 物は どれも 村の ほかの 入口（掲示板・仲間・B／☰ の メニュー）と 同じ 窓を 開く もう 1つの 入口：
//   壁の スレ＝冒険の記録（リプレイを 選んだら 村から 出る）・>>1 テンプレ＝あそびかた・本棚＝図鑑・
//   帳簿の 貼り紙＝ゼロの 売り上げ・実況モニター＝リプレイ 上映・殿堂の 壁＝総選挙の はり紙。
// 本館 だけの もの：
//   - 保守の 当番表：「保守」と 書きこめる（1回の 帰りに 1回まで。数を 数えるだけで 強さには 何も 効かない）。
//   - 期間限定の 告知：起きている イベント（data/objectives.ts。?event= の 下見も）を いつでも 読める。
//   - 飾り棚：持ち帰った 品を 絵で 並べる（針・はじまりの原盤は 蓄音機に ついているので 一覧だけ）。
// 扉の「！」：告知が まだ 本館で 読んでいない イベントか、飾り棚に 品が ふえた（喫茶の hasCafeNews と 同じ）。
// 書いた 数・読んだ 告知・見た 棚は 別の 保存場所（kiriko-roguelike/hall）に 残す（保存 できなくても この回は 覚えている）。

import { DUNGEON_IDS, DUNGEONS } from "../core/data/dungeons";
import { defOf } from "../core/item";
import type { DungeonId } from "../core/types";
import {
	HALL_MSG,
	MONITOR_MENU,
	ON_PHONO_TEXT,
	TOBAN_MENU,
} from "../data/hall";
import {
	eventById,
	goalText,
	objectiveFor,
	withDevEvent,
} from "../data/objectives";
import { DUNGEON_NAMES } from "../data/story";
import { VILLAGE_MSG } from "../data/town";
import {
	HALL_NAMES,
	HALL_OUT_DIR,
	type HallPlace,
	type HallTier,
	hallEntry,
	hallOutside,
	hallPalette,
	hallPlaces,
	hallRows,
	hallTierOf,
	ON_PHONO,
	shelfBoards,
	shelfSlots,
} from "../data/village/hall";
import { npc, sign } from "../data/village/helpers";
import {
	type Cell,
	VILLAGE_SPOTS,
	type VillageView,
} from "../data/village/map";
import { drawRefInCell, getImage } from "../engine/assets";
import type { EventDef, MapDef, Script, Story } from "../engine/defs";
import { loadProgress, loadRecords } from "../engine/save";
import { TILE } from "../engine/types";
import { openBook } from "./bookView";
import type { Ctx } from "./ctx";
import { el } from "./dom";
import { openHowto } from "./howto";
import { itemIcon } from "./icons";
import { type ListItem, listWindow } from "./list";
import { openRecords } from "./records";
import { senkyoOpen, senkyoScript } from "./villageMobs";
import { fill, ledgerLine } from "./villageTalk";

// ───────────────── 保存（kiriko-roguelike/hall） ─────────────────

const KEY = "kiriko-roguelike/hall";

type HallMemo = {
	/** 保守と 書いた 回数。 */
	hoshu: number;
	/** 最後に 書いた 帰り（記録の 時刻。まだ 書いていなければ -1）。 */
	hoshuAt: number;
	/** 本館で 読んだ 告知（イベントの id。読んでいなければ 空）。 */
	event: string;
	/** 飾り棚で 見た 板。 */
	shelf: DungeonId[];
};

const EMPTY: HallMemo = { hoshu: 0, hoshuAt: -1, event: "", shelf: [] };

let memo: HallMemo | null = null;

const load = (): HallMemo => {
	if (memo) return JSON.parse(JSON.stringify(memo)) as HallMemo;
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		if (raw && typeof raw === "object")
			return {
				hoshu: Number.isFinite(raw.hoshu) ? Math.max(0, raw.hoshu) : 0,
				hoshuAt: Number.isFinite(raw.hoshuAt) ? raw.hoshuAt : -1,
				event: typeof raw.event === "string" ? raw.event : "",
				shelf: Array.isArray(raw.shelf)
					? raw.shelf.filter((d: unknown) =>
							DUNGEON_IDS.includes(d as DungeonId),
						)
					: [],
			};
	} catch {
		// 読めなければ はじめから
	}
	return { ...EMPTY, shelf: [] };
};

const save = (m: HallMemo): void => {
	memo = JSON.parse(JSON.stringify(m)) as HallMemo;
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};

/** 試験用：覚えている 写しを 捨てる（localStorage から 読みなおす）。 */
export const forgetHallMemo = (): void => {
	memo = null;
};

/** いまの 帰り（いちばん 新しい 記録の 時刻。まだ もぐっていなければ 0）。 */
const returnAt = (): number => loadRecords()[0]?.at ?? 0;

/** 保守と 書いた 回数。 */
export const hoshuCount = (): number => load().hoshu;

/** この 帰りに まだ 書いていないか。 */
export const canWriteHoshu = (): boolean => load().hoshuAt !== returnAt();

// ───────────────── 告知・飾り棚 ─────────────────

/** 起きている 期間限定の イベント（?event= の 下見も）と その 目的。無ければ null。 */
const currentEvent = () => {
	const p = withDevEvent(loadProgress());
	const e = p.event ? eventById(p.event.id) : undefined;
	if (!e) return null;
	const info = objectiveFor(e.dungeon, p);
	return info.event ? { e, info } : null;
};

/** 告知の 文（窓ごと。村の 窓で 読む）。 */
export const noticeTexts = (): string[] => {
	const cur = currentEvent();
	if (!cur) return [HALL_MSG.noticeNone];
	const { e, info } = cur;
	return [
		fill(HALL_MSG.notice, { name: e.name }),
		e.news,
		fill(HALL_MSG.noticeGoal, {
			goal: goalText(e.dungeon, info.objective),
			ends: info.event?.endsIn ?? "",
		}),
	];
};

/** 飾り棚に 並べる 板（持ち帰った 順では なく 板の 順）。 */
export const trophies = (cleared: readonly DungeonId[]): DungeonId[] =>
	shelfBoards(cleared, DUNGEON_IDS);

/**
 * 扉の「！」：まだ 本館で 読んでいない 告知が ある か、飾り棚（レンガ館から）に 品が ふえた。
 * v は 描いている 村（?stage= の 下見でも 絵と 合う）。
 */
export const hasHallNews = (v: VillageView): boolean => {
	const m = load();
	const cur = currentEvent();
	if (cur && m.event !== cur.e.id) return true;
	return (
		hallTierOf(v) >= 1 && trophies(v.cleared).some((d) => !m.shelf.includes(d))
	);
};

/** 飾り棚を 見た（持ち帰った 品が ふえた「！」を 消す）。 */
export const markShelfSeen = (cleared: readonly DungeonId[]): void => {
	const m = load();
	m.shelf = [...new Set([...m.shelf, ...trophies(cleared)])];
	save(m);
};

// ───────────────── 入る・出る ─────────────────

/**
 * 村の 扉 i（0 左・1 右）を 踏んだ：村に いるあいだ 段ごとに はじめの 1回だけ 扉の 文 → 扉の 音 → 暗転 →
 * 中（同じ がわの マットの 1つ上。上を 向く）→ 明転。入った 扉は 印 hallFrom に 覚える（出る ときに 前へ もどる）。
 */
export const enterHall =
	(i: number, v: VillageView): Script =>
	async (s) => {
		const tier = hallTierOf(v);
		const seen = `hallDoor${tier}`;
		if (!s.flag(seen)) {
			s.set(seen);
			await s.narrate(VILLAGE_MSG.hall[tier]);
		}
		s.se("door");
		await s.fadeOut(250);
		s.set("hallFrom", VILLAGE_SPOTS.hallDoors[i]?.[0] ?? 0);
		const [x, y] = hallEntry(tier, i);
		await s.warp("hall", x, y, "up");
		await s.fadeIn(250);
	};

/** 出口の マット：扉の 音 → 暗転 → 入った 扉の 前（外。下を 向く）→ 明転。 */
export const leaveHall: Script = async (s) => {
	s.se("door");
	await s.fadeOut(250);
	const [x, y] = hallOutside(s.flag("hallFrom"));
	await s.warp("village", x, y, HALL_OUT_DIR);
	await s.fadeIn(250);
};

// ───────────────── 中の 物 ─────────────────

/** メッセージ窓を 隠す（一覧の 窓を 出す 前に）。 */
const hideMsg = (s: Story) => s.wait(0);

/** 冒険の記録。リプレイを 選んだら 村を 出る（出るなら true）。 */
const records = async (ctx: Ctx, s: Story): Promise<boolean> => {
	await hideMsg(s);
	const replay = await openRecords(ctx);
	if (!replay) return false;
	s.exit({ kind: "replay", replay });
	return true;
};

/** 保守の 当番表：この 帰りに まだなら「保守」と 書ける。 */
export const tobanScript =
	(tier: HallTier): Script =>
	async (s) => {
		await s.narrate(HALL_MSG.toban[tier]);
		if (!canWriteHoshu()) {
			await s.narrate(fill(HALL_MSG.tobanAgain, { n: hoshuCount() }));
			return;
		}
		const n = await s.choose([...TOBAN_MENU], { cancel: 1 });
		if (n !== 0) return;
		const m = load();
		m.hoshu += 1;
		m.hoshuAt = returnAt();
		save(m);
		s.se("read");
		await s.narrate(fill(HALL_MSG.tobanDone, { n: m.hoshu }));
	};

/** 期間限定の 告知（読んだら 扉の「！」は 消える）。 */
export const noticeScript: Script = async (s) => {
	for (const t of noticeTexts()) await s.narrate(t);
	const cur = currentEvent();
	if (cur) {
		const m = load();
		m.event = cur.e.id;
		save(m);
	}
};

/** 品の 絵（一覧の 行の 左。16px を 2倍）。 */
const itemArt = (ref: string): HTMLCanvasElement => {
	const c = el("canvas", { class: "mon-art" });
	c.width = TILE;
	c.height = TILE;
	c.style.width = `${TILE * 2}px`;
	c.style.height = `${TILE * 2}px`;
	const g = c.getContext("2d");
	const draw = () => {
		if (!g || !getImage(ref)) return false;
		g.clearRect(0, 0, TILE, TILE);
		return drawRefInCell(g, ref, 0, 0);
	};
	// 読み込み中なら 少し あとで もう一度
	if (!draw()) setTimeout(draw, 400);
	return c;
};

/** 飾り棚の 一覧の 行（持ち帰った 板の 順。蓄音機の 品は「蓄音機に　ついている」）。 */
export const shelfRows = (
	cleared: readonly DungeonId[],
): { d: DungeonId; name: string; board: string; desc: string }[] =>
	DUNGEON_IDS.filter((d) => cleared.includes(d)).map((d) => {
		const item = defOf(DUNGEONS[d].goal);
		return {
			d,
			name: item.name,
			board: DUNGEON_NAMES[d].name,
			desc: ON_PHONO.includes(d) ? ON_PHONO_TEXT : item.flavor,
		};
	});

/** 飾り棚：持ち帰った 品の 一覧（名前・板・品の ひとこと）。見たら 扉の「！」は 消える。 */
const shelfScript =
	(ctx: Ctx): Script =>
	async (s) => {
		const cleared = loadProgress().cleared;
		const rows = shelfRows(cleared);
		markShelfSeen(cleared);
		if (!rows.length) {
			await s.narrate(HALL_MSG.shelfEmpty);
			return;
		}
		await s.narrate(HALL_MSG.shelf);
		await hideMsg(s);
		const items: ListItem[] = rows.map((r) => ({
			label: r.name,
			sub: r.board,
			desc: r.desc,
			value: r.d,
			icon: itemArt(itemIcon(DUNGEONS[r.d].goal)),
		}));
		await listWindow(ctx, "飾り棚", items, { closeLabel: "とじる" });
	};

/** 実況モニター：ナイターと 実況スレ。リプレイ 上映（冒険の記録と 同じ 窓）。 */
const monitorScript =
	(ctx: Ctx): Script =>
	async (s) => {
		for (const t of HALL_MSG.monitor) await s.narrate(t);
		const n = await s.choose([...MONITOR_MENU], { cancel: 1 });
		if (n === 0) await records(ctx, s);
	};

/** 殿堂の 壁（総選挙の はり紙が 出ていれば それも）。 */
const dendoScript: Script = async (s) => {
	if (senkyoOpen()) await senkyoScript(s);
	else await s.narrate(HALL_MSG.dendo);
};

/** 名無し・野次馬（名前欄は やきうの 色。話し終えたら もとの 向きへ）。 */
const nanashiScript =
	(p: HallPlace, lines: readonly string[]): Script =>
	async (s) => {
		const name = p.id.startsWith("yaji_") ? "野次馬" : "名無し";
		for (const l of lines) await s.say("nanj", l, { name });
		if (p.dir) s.face(p.id, p.dir);
	};

/** 名無し・野次馬の 台詞。 */
const peopleLines = (id: string): readonly string[] => {
	if (id === "nanashi_toban") return HALL_MSG.toban_nanashi;
	const n = Number(id.split("_")[1]) || 0;
	if (id.startsWith("yaji_"))
		return HALL_MSG.yaji[n % HALL_MSG.yaji.length] ?? [];
	return HALL_MSG.watch[n % HALL_MSG.watch.length] ?? [];
};

/** 置き場所に スクリプトを 付けて イベントに する。 */
const eventFor = (ctx: Ctx, p: HallPlace, tier: HallTier): EventDef => {
	const at = { id: p.id, x: p.x, y: p.y };
	const kind = p.id.replace(/_\d+$/, "");
	if (p.trigger === "touch")
		return { ...at, trigger: "touch", through: true, run: leaveHall };
	if (p.sprite)
		return npc(p.id, p.x, p.y, p.sprite, nanashiScript(p, peopleLines(p.id)), {
			dir: p.dir,
		});
	switch (kind) {
		case "board":
			return sign(p.id, p.x, p.y, async (s) => {
				await s.narrate(HALL_MSG.board);
				await records(ctx, s);
			});
		case "toban":
			return sign(p.id, p.x, p.y, tobanScript(tier));
		case "template":
			return sign(p.id, p.x, p.y, async (s) => {
				await s.narrate(HALL_MSG.template);
				await hideMsg(s);
				await openHowto(ctx);
			});
		case "notice":
			return sign(p.id, p.x, p.y, noticeScript);
		case "book":
			return sign(p.id, p.x, p.y, async (s) => {
				await s.narrate(HALL_MSG.book);
				await hideMsg(s);
				await openBook(ctx);
			});
		case "shelf":
			return sign(p.id, p.x, p.y, shelfScript(ctx));
		case "ledger":
			return sign(p.id, p.x, p.y, async (s) => {
				await s.narrate(HALL_MSG.ledger);
				await s.narrate(ledgerLine());
			});
		case "monitor":
			return sign(p.id, p.x, p.y, monitorScript(ctx));
		case "dendo":
			return sign(p.id, p.x, p.y, dendoScript);
		case "chair":
			return sign(p.id, p.x, p.y, HALL_MSG.chair);
		default:
			return { ...at, trigger: p.trigger };
	}
};

/** 飾り棚の 色（枠・奥・棚板・棚板の 影）。 */
const SHELF_INK = {
	frame: "#5a3620",
	back: "#2e1c10",
	plank: "#b07a45",
	shade: "#7a4e2a",
};

/**
 * 飾り棚（木の 枠と 段ごとの 棚板。壁の C c の マスに かける）と、持ち帰った 品（上の 段から 左 → 右。
 * 品の 絵は 棚板に のせる）。同梱の チップに 飾り棚が 無いので 塗って 描く。
 */
const shelfDecor = (
	tier: HallTier,
	cleared: readonly DungeonId[],
): MapDef["decor"] => {
	const slots: Cell[] = shelfSlots(tier);
	if (!slots.length) return undefined;
	const refs = trophies(cleared).map((d) => itemIcon(DUNGEONS[d].goal));
	const xs = slots.map(([x]) => x);
	const ys = slots.map(([, y]) => y);
	const x0 = Math.min(...xs);
	const y0 = Math.min(...ys);
	const w = (Math.max(...xs) + 1 - x0) * TILE;
	const rows = Math.max(...ys) + 1 - y0;
	return (g, ox, oy) => {
		const px = x0 * TILE - ox;
		const py = y0 * TILE - oy;
		g.fillStyle = SHELF_INK.frame;
		g.fillRect(px + 1, py + 1, w - 2, rows * TILE - 1);
		g.fillStyle = SHELF_INK.back;
		g.fillRect(px + 3, py + 3, w - 6, rows * TILE - 5);
		for (let r = 1; r <= rows; r++) {
			const y = py + r * TILE;
			g.fillStyle = SHELF_INK.plank;
			g.fillRect(px + 2, y - 3, w - 4, 2);
			g.fillStyle = SHELF_INK.shade;
			g.fillRect(px + 2, y - 1, w - 4, 1);
		}
		// 品は 棚板に のせる（棚の 外へは はみ出させない）
		g.save();
		g.beginPath();
		g.rect(px + 1, py + 1, w - 2, rows * TILE - 1);
		g.clip();
		refs.forEach((ref, i) => {
			const c = slots[i];
			if (c) drawRefInCell(g, ref, c[0] * TILE - ox, c[1] * TILE - oy - 2);
		});
		g.restore();
	};
};

/**
 * 実況モニターの 画面（ナイターの 中継と、右から 左へ 流れる 実況の 書きこみ）。壁の M の マスに かかる
 * 大きな 画面の 絵（Base.png の 0,485 の 2×2）の ガラスの ところだけ 描く。本館の 段で なければ 無い。
 */
const monitorDecor = (rows: readonly string[]): MapDef["decor"] => {
	const my = rows.findIndex((r) => r.includes("M"));
	if (my < 0) return undefined;
	const mx = [...rows[my]].indexOf("M");
	// 32px の 絵を マスの 下端に そろえて 描くので、絵の 上端は 1マス 上。ガラスは 絵の (4, 7) から 24×15
	const x0 = mx * TILE + 4;
	const y0 = (my + 1) * TILE - 32 + 7;
	const W = 24;
	const H = 15;
	return (g, ox, oy, t) => {
		const x = x0 - ox;
		const y = y0 - oy;
		g.save();
		g.beginPath();
		g.rect(x, y, W, H);
		g.clip();
		// 夜の 球場（空・照明・芝・内野）
		g.fillStyle = "#10241a";
		g.fillRect(x, y, W, H);
		g.fillStyle = "#fff6c0";
		g.fillRect(x + 2, y + 1, 2, 1);
		g.fillRect(x + W - 4, y + 1, 2, 1);
		g.fillStyle = "#2f6e35";
		g.fillRect(x, y + 9, W, H - 9);
		g.fillStyle = "#c9a36a";
		g.fillRect(x + 10, y + 11, 4, 2);
		// 実況の 書きこみ（3段。速さと 長さを かえて 流す）
		for (let i = 0; i < 3; i++) {
			const len = [7, 4, 6][i];
			const span = W + len + 9;
			const lx = x + W - ((t * (0.012 + i * 0.005) + i * 17) % span);
			g.fillStyle = i === 1 ? "#ffe060" : "#ffffff";
			g.fillRect(Math.round(lx), y + 2 + i * 3, len, 1);
		}
		g.restore();
	};
};

/** おんJ 本館の 中の 地図（本館の 段は 描いている 村の 段から）。曲は 村の まま。 */
export const buildHall = (v: VillageView, ctx: Ctx): MapDef => {
	const tier = hallTierOf(v);
	const rows = hallRows(tier);
	const decor = [shelfDecor(tier, v.cleared), monitorDecor(rows)].filter(
		(d) => !!d,
	);
	return {
		id: "hall",
		name: HALL_NAMES[tier] ?? HALL_NAMES[0],
		tiles: hallPalette(tier),
		rows,
		outside: "#000",
		events: hallPlaces(v).map((p) => eventFor(ctx, p, tier)),
		decor: decor.length
			? (g, ox, oy, t) => {
					for (const d of decor) d(g, ox, oy, t);
				}
			: undefined,
	};
};
