// なかよし度（2026-10-14 作者：「好感度を 見なおして。親交を 深める キャラを ふやしたり、贈り物・向こうからの
// プレゼントの イベントを 散りばめたり」）。文と 好みは data/people/bonds.ts。
// - なかよし度 ＝ 新しい話を 聞いた 数（仲間は 帰りごとの ひとこと、住人は はじめまして・節目・雑談）＋
//   喫茶（おごった 1杯で 2・聞いた 話で 1。ui/village/cafe.ts の cafeBondPoints）＋ 贈り物。
//   ♥ は BOND_STEPS で 0〜5。上がっても「なかよく　なった」とは 知らせない（2026-10-15 作者）。
// - 贈り物：おんJマートの ギフトの 棚で 1つ 買って 持ち歩き、話しかけた あとに わたせる（1人 1回の 帰りに 1つ）。
//   好み（大好き・好き・ふつう・苦手）で ふえ方が かわり、誕生日（端末の 日付）は 倍。
// - 向こうから：♥2 と ♥4 で 1つずつ 物を くれる（もらった 物。キリコの 家の 収納で 見られる）。
//   バレンタイン・クリスマス・正月（お年玉）は ♥2 から その 年に 1回。
// - なかよしの 話：♥3 と ♥5 で 1本ずつ（その 帰りの 新しい話の かわり。1回の 帰りに 1人 1本の 決まりの まま）。
// - いつもの ひとことは ♥ で かわる 人も いる（BondDef.warm。性格で かわらない 人は 書かない）。
// どれも 寄り道で、強さにも 冒険にも 何も 効かない（くれる 物は 飾りと 思い出、お年玉は 財布）。
// 保存は 別の 場所（kiriko-roguelike/bonds）。中断セーブ・記録・町には ふれない。

import { defOf } from "../../core/item";
import { STORAGE_CAP } from "../../core/town";
import {
	BIRTHDAY_MUL,
	BOND_DEFS,
	BOND_MSG,
	BOND_STEPS,
	type BondDef,
	type BondLine,
	GIFT_GOODS,
	GIFT_IDS,
	GIFT_PTS,
	type GiftId,
	type GiftTaste,
	KEEPSAKES,
	type Keepsake,
	SEASON_PRESENTS,
	type SeasonGift,
} from "../../data/people/bonds";
import { CAST } from "../../data/people/cast";
import { type Cast, MOB_IDS, MOBS, type MobId } from "../../data/people/mobs";
import { SPEAKERS, type Speaker } from "../../data/story/quotes";
import { awayFriends } from "../../data/story/story";
import { nowYear, season, today } from "../../data/town/calendar";
import { BOND_GUIDE, byHeading } from "../../data/town/guides";
import { STOCK_MSG, stockFor } from "../../data/town/stock";
import type { Script, Story } from "../../engine/defs";
import { type Cue, cueOf } from "../../engine/emote";
import {
	addFlag,
	hasFlag,
	loadProgress,
	loadRecords,
	loadTown,
	stockToStorage,
} from "../../engine/save";
import { earnYen, walletYen, yen } from "../../engine/wallet";
import type { Ctx } from "../ctx";
import { readGuide } from "../guide";
import { listWindow } from "../list";
import { cafeBondPoints, cafeBonds } from "./cafe";
import { payOrShort, previewing } from "./pay";
import {
	markMobHeard,
	metMobs,
	mobHeardNow,
	mobHooks,
	mobTalkCount,
	sayAs,
} from "./villageMobs";
import { fill, heardNow, markHeard, sulkTier, talkHooks } from "./villageTalk";

const KEY = "kiriko-roguelike/bonds";

/** ギフトの 棚で 決まりを 言った（Progress.flags）。 */
const GIFT_TOLD = "toldGift";

type BondMemo = {
	v: 1;
	/** 贈り物で ふえた ぶん。 */
	pts: Record<string, number>;
	/** 仲間の 新しい話を 聞いた 数（住人は 村の 印から 数える）。 */
	talks: Record<string, number>;
	/** 贈り物を わたした 帰り（記録の 時刻）。 */
	gave: Record<string, number>;
	/** もらった 物（Keepsake の id・季節は `season:<季節>:<年>:<人>`）。 */
	got: string[];
	/** 見た なかよしの 話（`<人>:<♥>`）。 */
	scenes: string[];
	/** 持ち歩いて いる 贈り物。 */
	carry: GiftId | null;
};

const empty = (): BondMemo => ({
	v: 1,
	pts: {},
	talks: {},
	gave: {},
	got: [],
	scenes: [],
	carry: null,
});

let memo: BondMemo | null = null;

const nums = (v: unknown): Record<string, number> => {
	const out: Record<string, number> = {};
	if (v && typeof v === "object")
		for (const [k, n] of Object.entries(v))
			if (typeof n === "number" && Number.isFinite(n)) out[k] = n;
	return out;
};
const strs = (v: unknown): string[] =>
	Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export const loadBonds = (): BondMemo => {
	if (memo) return JSON.parse(JSON.stringify(memo)) as BondMemo;
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		if (raw && typeof raw === "object" && raw.v === 1)
			return {
				v: 1,
				pts: nums(raw.pts),
				talks: nums(raw.talks),
				gave: nums(raw.gave),
				got: strs(raw.got),
				scenes: strs(raw.scenes),
				carry: GIFT_IDS.includes(raw.carry) ? raw.carry : null,
			};
	} catch {
		// 読めなければ はじめから
	}
	return empty();
};

const saveBonds = (m: BondMemo): void => {
	memo = JSON.parse(JSON.stringify(m)) as BondMemo;
	if (previewing()) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {
		// 保存できなくても この 回は 覚えている
	}
};

/** 試験用：覚えている 写しを 捨てる。 */
export const forgetBondsMemo = (): void => {
	memo = null;
};

const isMob = (w: string): w is MobId => (MOB_IDS as string[]).includes(w);
const isCast = (w: string): w is Cast => w in SPEAKERS || isMob(w);

/** いまの 帰り（いちばん 新しい 記録の 時刻）。 */
const returnAt = (): number => loadRecords()[0]?.at ?? 0;

// ───────────────── なかよし度 ─────────────────

/** なかよし度（点）。 */
export const bondPoints = (w: Cast, m: BondMemo = loadBonds()): number =>
	(m.pts[w] ?? 0) +
	(isMob(w) ? mobTalkCount(w) : (m.talks[w] ?? 0)) +
	cafeBondPoints(w);

/** ♥ の 数（0〜5）。 */
export const bondLevel = (w: Cast, m: BondMemo = loadBonds()): number => {
	const p = bondPoints(w, m);
	return BOND_STEPS.filter((n) => p >= n).length;
};

/** ♥ の 列（♥♥♡♡♡）。 */
export const heartsOf = (n: number): string =>
	"♥".repeat(n) + "♡".repeat(BOND_STEPS.length - n);

const nameOf = (w: Cast): string =>
	isMob(w) ? MOBS[w].name : CAST[w as Speaker].name;

/** 村に いない 仲間（まだ 来ていない）。 */
const away = (): Speaker[] =>
	awayFriends(loadProgress().cleared, loadTown().stage);

/** いま 村で 会える 人（村に いる 仲間と、会った 住人）。 */
export const knownCast = (): Cast[] => {
	const gone = away();
	return [
		...(Object.keys(SPEAKERS) as Speaker[]).filter((w) => !gone.includes(w)),
		...metMobs(),
	];
};

/**
 * 親しく なった 人（キリコの 家に 招ける・プリクラに いっしょに 写る）：喫茶で 親しく なった 人
 * （ui/village/cafe.ts の cafeBonds）と、♥ が min 以上の 人。
 */
export const bondCast = (min: number): Cast[] => {
	const m = loadBonds();
	const out = new Set<Cast>(cafeBonds());
	for (const w of knownCast()) if (bondLevel(w, m) >= min) out.add(w);
	return [...out];
};

/** 今日が 誕生日か。 */
const birthday = (def: BondDef): boolean => {
	const t = today();
	return def.birthday[0] === t.m && def.birthday[1] === t.d;
};

/** 好み。 */
export const tasteOf = (w: Cast, g: GiftId): GiftTaste => {
	const def = BOND_DEFS[w];
	if (def.love.includes(g)) return "love";
	const tags = GIFT_GOODS[g].tags;
	if (def.hate?.some((t) => tags.includes(t))) return "hate";
	if (def.like.some((t) => tags.includes(t))) return "like";
	return "normal";
};

// ───────────────── 話す ─────────────────

/** その 人の 声で 1窓（仲間は 名前欄と 立ち絵、住人は sayAs）。 */
const speak = (
	s: Story,
	w: Cast,
	text: string,
	cue: Cue = {},
): Promise<void> =>
	isMob(w) ? sayAs(s, w, text, cue) : s.say(w as Speaker, text, cue);

const playLines = async (
	s: Story,
	w: Cast,
	lines: readonly BondLine[],
): Promise<void> => {
	for (const l of lines)
		if (l.who === "me") await speak(s, w, l.text, cueOf(l));
		else if (l.who === "kiriko") await s.kiriko(l.text, "voice", cueOf(l));
		else await s.narrate(l.text);
};

/** まだ 見て いない、♥ が 足りた なかよしの 話（♥3・♥5）。 */
const dueScene = (
	w: Cast,
	m: BondMemo,
): { key: string; lines: readonly BondLine[] } | null => {
	const def = BOND_DEFS[w];
	const lv = bondLevel(w, m);
	for (const [i, need] of [3, 5].entries()) {
		const lines = def.scenes?.[i];
		const key = `${w}:${need}`;
		if (lines && lv >= need && !m.scenes.includes(key)) return { key, lines };
	}
	return null;
};

/** この 帰りに もう 新しい話を 聞いたか。 */
const heardThisReturn = (w: Cast): boolean =>
	isMob(w) ? mobHeardNow(w) : heardNow(w as Speaker);

/** 贈り物を わたす（持っていて、この 帰りに まだ わたして いなければ 聞く）。 */
const offerGift = async (s: Story, w: Cast): Promise<void> => {
	const m = loadBonds();
	const g = m.carry;
	if (!g) return;
	// もう この 帰りに わたした 人には わたせない（だまって 終わると 持っている 物が 消えたように 見えた）
	if (m.gave[w] === returnAt()) {
		await s.narrate(fill(BOND_MSG.gaveAlready, { name: nameOf(w) }));
		return;
	}
	const name = GIFT_GOODS[g].name;
	await s.narrate(fill(BOND_MSG.offer, { gift: name, name: nameOf(w) }));
	if ((await s.choose([...BOND_MSG.offerMenu], { cancel: 1 })) !== 0) return;
	const def = BOND_DEFS[w];
	const taste = tasteOf(w, g);
	const bday = birthday(def);
	m.carry = null;
	m.gave[w] = returnAt();
	m.pts[w] = (m.pts[w] ?? 0) + GIFT_PTS[taste] * (bday ? BIRTHDAY_MUL : 1);
	saveBonds(m);
	s.se("item");
	await s.narrate(fill(BOND_MSG.handed, { gift: name, name: nameOf(w) }));
	await speak(s, w, def.react[taste], TASTE_CUE[taste]);
	// ♥ が 上がっても 知らせない（作者「仲良くなったとしても『なかよくなった』は 通知しない方が いい」。
	// 好みの ひとことで 伝わる。♥ は 本館の 名簿などで 見える）
	if (bday) await speak(s, w, def.react.bday, { emote: "花" });
};

/** 贈り物の 好みの ひとことに つける 感情の 記号（ふつうは なし）。 */
const TASTE_CUE: Record<GiftTaste, Cue> = {
	love: { emote: "♥", gesture: "hop" },
	like: { emote: "♪" },
	normal: {},
	hate: { emote: "汗" },
};

/** ♥2・♥4 で くれる 物（まだ もらって いない 1つ）。 */
const givePresent = async (s: Story, w: Cast): Promise<boolean> => {
	const m = loadBonds();
	const lv = bondLevel(w, m);
	const list = KEEPSAKES[w] ?? [];
	for (const [i, need] of [2, 4].entries()) {
		const k = list[i];
		if (!k || lv < need || m.got.includes(k.id)) continue;
		m.got.push(k.id);
		saveBonds(m);
		await speak(s, w, k.say);
		s.se("item");
		await s.narrate(fill(BOND_MSG.got, { gift: k.name }));
		return true;
	}
	return false;
};

/** 季節の プレゼント（♥2 から。その 年に 1人 1回。正月は お年玉）。 */
const seasonPresent = async (s: Story, w: Cast): Promise<boolean> => {
	const sea = season();
	if (!sea) return false;
	const p: SeasonGift | undefined = SEASON_PRESENTS[sea];
	if (!p) return false;
	const m = loadBonds();
	if (bondLevel(w, m) < 2) return false;
	const key = `season:${sea}:${nowYear()}:${w}`;
	if (m.got.includes(key)) return false;
	m.got.push(key);
	saveBonds(m);
	const line = BOND_DEFS[w].season?.[sea];
	if (line) await speak(s, w, line);
	s.se("item");
	if (p.yen) {
		if (!previewing()) earnYen(p.yen);
		await s.narrate(fill(p.got, { name: nameOf(w), price: yen(p.yen) }));
	} else await s.narrate(fill(p.got, { name: nameOf(w) }));
	return true;
};

/**
 * 話しかけた ときを なかよし度で つつむ（ui/village/villageEvents.ts）。
 * 前：♥3・♥5 の なかよしの 話が あって、この 帰りの 新しい話が まだなら そちら（ふだんの 話は 出さない）。
 * 後：贈り物を わたす → 季節の プレゼント → ♥2・♥4 の 物（1回の 話しかけに どれか 1つ）。
 * セーブを 書きかえて 仲間が がっかり している あいだは 何も しない。
 */
export const withBond =
	(w: Cast, inner: Script): Script =>
	async (s) => {
		const sulking = sulkTier() !== null;
		const m = loadBonds();
		// 新しい話を 聞いて ♥ が 上がっても「なかよく　なった」とは 知らせない（作者：通知しない 方が いい）
		const scene = sulking ? null : dueScene(w, m);
		if (scene && !heardThisReturn(w)) {
			m.scenes.push(scene.key);
			saveBonds(m);
			if (isMob(w)) markMobHeard(w);
			else markHeard(w as Speaker);
			await playLines(s, w, scene.lines);
		} else await inner(s);
		if (sulking) return;
		await offerGift(s, w);
		if (await seasonPresent(s, w)) return;
		await givePresent(s, w);
	};

// ───────────────── いつもの ひとこと（♥ で かわる） ─────────────────

/**
 * ♥ で かわる いつもの ひとこと（BondDef.warm の [♥2〜3, ♥4〜5]）。仲間は 町の 段の ひとことも あるので、
 * 帰りの 1回おきに だけ 出す（住人は いつも）。
 */
const warmLine = (w: Cast, everyOther: boolean): string | null => {
	const warm = BOND_DEFS[w].warm;
	if (!warm) return null;
	const lv = bondLevel(w);
	const line = lv >= 4 ? warm[1] : lv >= 2 ? warm[0] : null;
	if (!line) return null;
	if (everyOther && (returnAt() % 9973) % 2 === 0) return null;
	return line;
};

talkHooks.idle = (who) => warmLine(who, true);
talkHooks.news = (who) => {
	const m = loadBonds();
	m.talks[who] = (m.talks[who] ?? 0) + 1;
	saveBonds(m);
};
mobHooks.idle = (id) => warmLine(id, false);

// ───────────────── ギフトの 棚（おんJマート） ─────────────────

/** ギフトの 棚（data/village/facilities.ts の konbini。play "giftshop"）。 */
export const giftShelf = async (ctx: Ctx, s: Story): Promise<void> => {
	// なかよし度と 贈り物の 決まりを はじめの 1回だけ
	if (!hasFlag(GIFT_TOLD)) {
		for (const p of BOND_MSG.shelfHelp) await s.narrate(p);
		if (!previewing()) addFlag(GIFT_TOLD);
	}
	const n = await s.choose([...BOND_MSG.shelfMenu], { cancel: 4 });
	// 今日の 入荷（町の お金を 潜る 準備に。data/town/stock.ts）
	if (n === 0) await buyStock(s);
	else if (n === 1) await buyGift(ctx, s);
	else if (n === 2) await bondBook(ctx, s);
	// なかよし度の しくみ（いつでも 読める。data/town/guides.ts。あそびかたの「町の　しくみ」と 同じ）
	else if (n === 3) await readGuide(s, byHeading(BOND_GUIDE));
};

/** 今日の 入荷を 買う（帰りごとに 1品。買った 物は 倉庫へ）。 */
const buyStock = async (s: Story): Promise<void> => {
	const at = loadRecords().length;
	const t = loadTown();
	if ((STORAGE_CAP[t.stage] ?? 0) <= 0) {
		await s.narrate(STOCK_MSG.noStorage);
		return;
	}
	if (t.stockAt === at) {
		await s.narrate(STOCK_MSG.soldOut);
		return;
	}
	const e = stockFor(at);
	const item = defOf(e.kind).name;
	await s.narrate(fill(STOCK_MSG.offer, { item, price: yen(e.price) }));
	if ((await s.choose([...STOCK_MSG.menu], { cancel: 1 })) !== 0) return;
	if (t.storage.length >= (STORAGE_CAP[t.stage] ?? 0)) {
		await s.narrate(STOCK_MSG.full);
		return;
	}
	if (!(await payOrShort(s, e.price))) return;
	stockToStorage(e.kind, at);
	await s.narrate(fill(STOCK_MSG.bought, { item }));
};

const buyGift = async (ctx: Ctx, s: Story): Promise<void> => {
	const held = loadBonds().carry;
	if (held) {
		await s.narrate(fill(BOND_MSG.holding, { gift: GIFT_GOODS[held].name }));
		return;
	}
	const have = walletYen();
	await s.wait(0);
	const v = await listWindow(
		ctx,
		`${BOND_MSG.shelfTitle}<br><small>手もと　${yen(have)}</small>`,
		GIFT_IDS.map((g) => ({
			label: GIFT_GOODS[g].name,
			sub: yen(GIFT_GOODS[g].price),
			desc: GIFT_GOODS[g].note,
			value: g,
			disabled: GIFT_GOODS[g].price > have,
		})),
		{ closeLabel: "やめる" },
	);
	if (!v || !(GIFT_IDS as string[]).includes(v)) return;
	const g = v as GiftId;
	if (!(await payOrShort(s, GIFT_GOODS[g].price))) return;
	const m = loadBonds();
	m.carry = g;
	saveBonds(m);
	await s.narrate(fill(BOND_MSG.wrapped, { gift: GIFT_GOODS[g].name }));
};

/** 誕生日の こよみ：会える 人の ♥ と 誕生日（今日 誕生日の 人は 先頭）。 */
const bondBook = async (ctx: Ctx, s: Story): Promise<void> => {
	const m = loadBonds();
	const list = knownCast();
	const t = today();
	const order = (w: Cast) => {
		const [bm, bd] = BOND_DEFS[w].birthday;
		return birthday(BOND_DEFS[w])
			? -1
			: (bm * 32 + bd - (t.m * 32 + t.d) + 13 * 32) % (13 * 32);
	};
	list.sort((a, b) => order(a) - order(b));
	await s.wait(0);
	await listWindow(
		ctx,
		BOND_MSG.bookTitle,
		list.map((w) => {
			const [bm, bd] = BOND_DEFS[w].birthday;
			return {
				label: nameOf(w),
				sub: heartsOf(bondLevel(w, m)),
				desc: birthday(BOND_DEFS[w])
					? BOND_MSG.bookToday
					: fill(BOND_MSG.bookDay, { m: bm, d: bd }),
				value: w,
			};
		}),
		{ closeLabel: "とじる" },
	);
};

// ───────────────── もらった 物（キリコの 家の 収納） ─────────────────

/** もらった 物の 一覧（選ぶと 説明）。 */
export const keepsakeList = async (ctx: Ctx, s: Story): Promise<void> => {
	const m = loadBonds();
	const all: { w: Cast; k: Keepsake }[] = [];
	for (const w of Object.keys(KEEPSAKES) as Cast[])
		for (const k of KEEPSAKES[w] ?? [])
			if (m.got.includes(k.id)) all.push({ w, k });
	if (!all.length) {
		await s.narrate(BOND_MSG.noKeepsake);
		return;
	}
	await s.wait(0);
	const v = await listWindow(
		ctx,
		fill(BOND_MSG.keepsakeTitle, { n: all.length }),
		all.map(({ w, k }) => ({
			label: k.name,
			sub: fill(BOND_MSG.keepsakeFrom, { name: nameOf(w) }),
			value: k.id,
		})),
		{ closeLabel: "とじる" },
	);
	const hit = all.find((x) => x.k.id === v);
	if (hit) await s.narrate(hit.k.desc);
};

/** 一覧の 値が 人か（試験・電話）。 */
export const castOf = (v: string): Cast | null => (isCast(v) ? v : null);
