// 保守村の 小さな 名物（folk）の 話し方（置き場所は data/village/folk.ts、文と 決まりは data/folk.ts）。
//   - 帰りごとに 1つ 進む 人（ひらがなニキ・なぞなぞ仮面・バルス失敗ニキ・人工無能ニキ）：その 帰りに はじめて 話すと
//     つぎの 1つ、同じ 帰りの 2回目からは みじかい 1窓。「帰り」は いちばん 新しい 記録の 時刻（ui/guests.ts の returnAt。
//     本館の 当番表と 同じ）。進み具合は kiriko-roguelike/folk（下見の あいだは 書かない。この回だけ 覚えている）。
//   - 村に いる あいだだけ 入れかわる もの（ロリード・温泉卵の 説・おどちゃん・モフちゃん）は 印（s.flag）で 数える。
//   - 草ボタンの ｗ は 押した ぶんだけ ふえる（保存。何にも 効かない）。
// どれも 寄り道で、強さ・道具・売上・町の 段には 一切 ふれない。キリコは しゃべらない（選ぶだけ）。

import { nowHour, today } from "../data/calendar";
import {
	BALUS,
	balusBeat,
	balusLvAfter,
	balusName,
	eggTheory,
	FOLK_NAMES,
	GRAVE,
	type GraveId,
	HIRA,
	hiraEntry,
	hiraForgot,
	IDEA,
	ideaAfter,
	ideaAsk,
	ideaOk,
	ideaText,
	isObon,
	kusaShown,
	MOFU,
	mofuTag,
	museumText,
	NAZO,
	nazoPick,
	nazoResult,
	ODORU,
	odoruAwake,
	RIDDLES,
	rolliLine,
} from "../data/folk";
import { movedIn } from "../data/mobs";
import { devEvent } from "../data/objectives";
import { FOLK_WALK } from "../data/village/folk";
import { npc, sign } from "../data/village/helpers";
import {
	stepOf,
	type VillagePlace,
	type VillageView,
} from "../data/village/map";
import type { EventDef, Script, Story } from "../engine/defs";
import { loadRecords } from "../engine/save";
import type { Dir } from "../engine/types";
import { returnAt } from "./guests";
import { previewStage } from "./villageReturn";

// ───────────────── 保存（kiriko-roguelike/folk） ─────────────────

const KEY = "kiriko-roguelike/folk";

export type FolkMemo = {
	v: 1;
	/** ひらがなニキ：言った 数・最後に 言った 帰り（まだ なら -1）。 */
	hira: number;
	hiraAt: number;
	/** なぞなぞ仮面：出した 問題の 数・最後に 出した 帰り・その 問題に 答えたか。 */
	nazo: number;
	nazoAt: number;
	nazoDone: boolean;
	/** バルス失敗ニキ：唱えた 回数・最後の 帰り。 */
	balus: number;
	balusAt: number;
	/** 人工無能ニキ：わたした アイディアの 数・最後に 聞かれた 帰り・その 帰りに わたしたか。 */
	idea: number;
	ideaAt: number;
	ideaDone: boolean;
	/** 草ボタンを 押した 数（9999 まで）。 */
	kusa: number;
};

const EMPTY: FolkMemo = {
	v: 1,
	hira: 0,
	hiraAt: -1,
	nazo: 0,
	nazoAt: -1,
	nazoDone: false,
	balus: 0,
	balusAt: -1,
	idea: 0,
	ideaAt: -1,
	ideaDone: false,
	kusa: 0,
};

let memo: FolkMemo | null = null;

/** 数（0 以上の 整数。こわれた 値や 大きすぎる 値は 丸める）。 */
const count = (x: unknown): number =>
	typeof x === "number" && Number.isFinite(x)
		? Math.min(99999, Math.max(0, Math.floor(x)))
		: 0;
const stamp = (x: unknown): number =>
	typeof x === "number" && Number.isFinite(x) ? x : -1;

/** 進み具合（読めなければ はじめから。数は 0 以上の 整数に、帰りは 数で なければ -1 に）。 */
export const loadFolk = (): FolkMemo => {
	if (memo) return structuredClone(memo);
	try {
		const o = JSON.parse(localStorage.getItem(KEY) ?? "null") as Record<
			string,
			unknown
		> | null;
		if (o && typeof o === "object")
			return {
				v: 1,
				hira: count(o.hira),
				hiraAt: stamp(o.hiraAt),
				nazo: count(o.nazo),
				nazoAt: stamp(o.nazoAt),
				nazoDone: o.nazoDone === true,
				balus: count(o.balus),
				balusAt: stamp(o.balusAt),
				idea: count(o.idea),
				ideaAt: stamp(o.ideaAt),
				ideaDone: o.ideaDone === true,
				kusa: Math.min(count(o.kusa), 9999),
			};
	} catch {
		// 読めなければ はじめから
	}
	return structuredClone(EMPTY);
};

/** 開発用の 下見（?stage=・?event=）の あいだ（保存は 書きかえない）。 */
const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

export const saveFolk = (m: FolkMemo): void => {
	memo = structuredClone(m);
	if (previewing()) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};

/** 試験用：覚えている 写しを 捨てる（localStorage から 読みなおす）。 */
export const forgetFolkMemo = (): void => {
	memo = null;
};

// ───────────────── 道具 ─────────────────

const say = (s: Story, name: string, text: string): Promise<void> =>
	s.say("nanj", text, { name });

/** 村に いる あいだの 数（印。村を 出ると 0 に もどる）。 */
const tick = (s: Story, key: string): number => {
	const k = Number(s.flag(key) ?? 0) || 0;
	s.set(key, k + 1);
	return k;
};

const fill = (t: string, v: Record<string, string>): string =>
	t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");

/** at より あとに 帰った 回数（記録の 数。いまの 帰りも 数える）。 */
const returnsSince = (at: number): number =>
	loadRecords().filter((r) => r.at > at).length;

// ───────────────── 帰りごとに 1つ 進む 人 ─────────────────

/** ひらがなニキ（西の 空き地）。話さずに 帰りを 飛ばすと「また 忘れたンゴ……」。 */
export const hiraScript =
	(id: string, dir: Dir): Script =>
	async (s) => {
		const m = loadFolk();
		const at = returnAt();
		const name = FOLK_NAMES.hira;
		if (m.hiraAt === at) {
			await say(s, name, HIRA.again);
		} else {
			const entry = hiraEntry(m.hira);
			if (m.hiraAt === -1) await say(s, name, HIRA.intro);
			else if (entry.length < 3) {
				const forgot = hiraForgot(returnsSince(m.hiraAt) - 1, m.hira);
				if (forgot) await say(s, name, forgot);
			}
			for (const l of entry) await say(s, name, l);
			m.hira += 1;
			m.hiraAt = at;
			saveFolk(m);
		}
		s.face(id, dir);
	};

/** なぞなぞ仮面（広場の 南東の すみ）。答えるまで 同じ 帰りは 同じ 問題。 */
export const nazoScript =
	(id: string, dir: Dir): Script =>
	async (s) => {
		const m = loadFolk();
		const at = returnAt();
		const name = FOLK_NAMES.nazo;
		if (m.nazoAt !== at) {
			const first = m.nazoAt === -1;
			m.nazoAt = at;
			m.nazoDone = false;
			m.nazo += 1;
			saveFolk(m);
			if (first) await say(s, name, NAZO.intro);
			else if ((m.nazo - 1) % RIDDLES.length === 0)
				await say(s, name, NAZO.rerun);
		}
		if (m.nazoDone) {
			await say(s, name, NAZO.again);
			s.face(id, dir);
			return;
		}
		const r = RIDDLES[(m.nazo - 1) % RIDDLES.length];
		await say(s, name, r.q);
		const k = await s.choose([...r.options, NAZO.quit], {
			cancel: r.options.length,
		});
		const pick = nazoPick(r, k);
		if (pick === "right") s.se("critical");
		else if (pick !== "quit") s.se("miss");
		for (const l of nazoResult(r, k)) await say(s, name, l);
		if (pick !== "quit") {
			const after = loadFolk();
			after.nazoDone = true;
			saveFolk(after);
		}
		s.face(id, dir);
	};

/** バルス失敗ニキ（本館の すみ。ui/hallEvents.ts から）。 */
export const balusScript =
	(id: string, dir: Dir): Script =>
	async (s) => {
		const m = loadFolk();
		const at = returnAt();
		if (m.balusAt === at) {
			const lv = balusLvAfter(balusBeat(Math.max(0, m.balus - 1)));
			await s.say("nanj", BALUS.again, { name: balusName(lv) });
		} else {
			const b = balusBeat(m.balus);
			for (const l of b.lines) {
				if (l.sys) {
					s.se("miss");
					await s.narrate(l.text);
				} else await s.say("nanj", l.text, { name: balusName(b.lv) });
			}
			m.balus += 1;
			m.balusAt = at;
			saveFolk(m);
		}
		s.face(id, dir);
	};

/** 人工無能ニキの いる 所（図書館の 読書の 机の 左の いす。上を 向く）。 */
export const IDEA_AT = { x: 9, y: 7, dir: "up" as Dir };

/** 人工無能ニキ（図書館。アイディアを 1つ もらうと「なるほど」など。10個で 構想 10年）。 */
export const ideaScript =
	(id: string, dir: Dir): Script =>
	async (s) => {
		const m = loadFolk();
		const at = returnAt();
		const name = FOLK_NAMES.idea;
		if (m.ideaAt !== at) {
			const first = m.ideaAt === -1;
			m.ideaAt = at;
			m.ideaDone = false;
			saveFolk(m);
			if (first) await say(s, name, IDEA.intro);
		}
		if (m.ideaDone) {
			await say(s, name, IDEA.again);
			s.face(id, dir);
			return;
		}
		await say(s, name, ideaText(m.idea));
		const options = ideaAsk(m.idea).options;
		const k = await s.choose([...options, IDEA.quit], {
			cancel: options.length,
		});
		if (k < 0 || k >= options.length) {
			await say(s, name, IDEA.no);
			s.face(id, dir);
			return;
		}
		await say(s, name, ideaOk(m.idea));
		const after = loadFolk();
		after.idea += 1;
		after.ideaDone = true;
		saveFolk(after);
		const more = ideaAfter(after.idea);
		if (more) await say(s, name, more);
		s.face(id, dir);
	};

/** 図書館の 人工無能ニキ（ui/rooms.ts の booksPeople が 図書館に 足す）。 */
export const ideaNpc = (): EventDef =>
	npc(
		"folk_idea",
		IDEA_AT.x,
		IDEA_AT.y,
		FOLK_WALK.idea,
		ideaScript("folk_idea", IDEA_AT.dir),
		{ dir: IDEA_AT.dir },
	);

// ───────────────── 村に いる あいだ 入れかわる もの ─────────────────

/** おどちゃん（夜の 池の 南。はじめは 地の文と 口ぐせ、2回目からは 1窓ずつ）。 */
export const odoruScript =
	(id: string, dir: Dir): Script =>
	async (s) => {
		const k = tick(s, "folk:odoru");
		if (k === 0) {
			await s.narrate(ODORU.first);
			await say(s, FOLK_NAMES.odoru, ODORU.main);
		} else
			await say(s, FOLK_NAMES.odoru, ODORU.more[(k - 1) % ODORU.more.length]);
		s.face(id, dir);
	};

/** 原住民が 越してきて いるか（data/mobs.ts の after: "opunu"）。 */
const ownerHere = (v: VillageView): boolean =>
	movedIn(stepOf(v), v.cleared).includes("shobon");

/** モフちゃん（地の文だけ。札の 版は 町の 段 + 1）。 */
export const mofuScript =
	(id: string, dir: Dir, v: VillageView): Script =>
	async (s) => {
		const k = tick(s, "folk:mofu");
		if (k === 0) {
			await s.narrate(mofuTag(v.stage));
			if (ownerHere(v)) await s.narrate(MOFU.owner);
		} else await s.narrate(MOFU.more[(k - 1) % MOFU.more.length]);
		s.face(id, dir);
	};

// ───────────────── 機能の 墓場 ─────────────────

const readAll = async (s: Story, lines: readonly string[]): Promise<void> => {
	for (const t of lines) await s.narrate(t);
};

/** 草ボタン（押すと ｗ が ふえる。10回目で きうり。やめるまで 何回でも 押せる）。 */
const kusaScript: Script = async (s) => {
	const m = loadFolk();
	await s.narrate(
		m.kusa > 0 ? fill(GRAVE.kusaNow, { w: kusaShown(m.kusa) }) : GRAVE.kusa,
	);
	while ((await s.choose([...GRAVE.kusaMenu], { cancel: 1 })) === 0) {
		s.se("decide");
		const after = loadFolk();
		after.kusa = Math.min(after.kusa + 1, 9999);
		saveFolk(after);
		await s.narrate(
			after.kusa === 10
				? GRAVE.kusaTen
				: fill(GRAVE.kusaPush, { w: kusaShown(after.kusa) }),
		);
	}
};

/** 墓（id は data/village/folk.ts の GRAVES）。 */
export const graveScript =
	(g: GraveId): Script =>
	async (s) => {
		const t = today();
		if (g === "rolli") {
			await s.narrate(rolliLine(tick(s, "folk:rolli")));
			return;
		}
		if (g === "kusa") {
			await kusaScript(s);
			return;
		}
		await readAll(s, GRAVE[g]);
		if (g === "tag" && isObon(t.m, t.d)) await s.narrate(GRAVE.tagObon);
	};

/** 供養碑（お盆だけ 1窓 ふえる）。 */
export const monumentScript: Script = async (s) => {
	await readAll(s, GRAVE.monument);
	const t = today();
	if (isObon(t.m, t.d)) await s.narrate(GRAVE.obon);
};

// ───────────────── 部屋の すみ（ui/rooms.ts から） ─────────────────

/** 銭湯の 温泉卵の メモ（はり紙の 窓の あと。村に いる あいだ 調べる たびに つぎの 説）。 */
export const eggScript: Script = async (s) => {
	await s.narrate(eggTheory(tick(s, "folk:egg")));
};

/** 図書館の 1レス博物館（はり紙の 窓の あと。ケースごとに 帰りで 展示が かわる）。 */
export const museumScript =
	(placeId: string): Script =>
	async (s) => {
		const n = Number(placeId.replace(/^\D+_/, "")) || 0;
		await s.narrate(museumText(returnAt(), Math.floor(n / 2)));
	};

// ───────────────── 村の イベント（ui/villageEvents.ts の eventFor から） ─────────────────

const GRAVE_IDS: readonly GraveId[] = [
	"tag",
	"rolli",
	"kusa",
	"gps",
	"balus",
	"danmaku",
	"iine",
	"okpic",
];

/** folk_ で はじまる 置き場所に 話し方を つける。 */
export const folkEvent = (p: VillagePlace, v: VillageView): EventDef => {
	const dir = p.dir ?? "down";
	const sprite = p.sprite ?? "";
	switch (p.id) {
		case "folk_hira":
			return npc(p.id, p.x, p.y, sprite, hiraScript(p.id, dir), { dir });
		case "folk_nazo":
			return npc(p.id, p.x, p.y, sprite, nazoScript(p.id, dir), { dir });
		case "folk_mofu":
			return npc(p.id, p.x, p.y, sprite, mofuScript(p.id, dir, v), { dir });
		case "folk_odoru":
			// 夜（20〜4時。開発中は &hour=）だけ 見える。昼は その マスも 通れる
			return npc(p.id, p.x, p.y, sprite, odoruScript(p.id, dir), {
				dir,
				wander: p.wander,
				when: () => odoruAwake(nowHour()),
			});
		case "folk_monument":
			return sign(p.id, p.x, p.y, monumentScript);
	}
	const g = p.id.replace(/^folk_grave_/, "") as GraveId;
	if (GRAVE_IDS.includes(g)) return sign(p.id, p.x, p.y, graveScript(g));
	return { id: p.id, x: p.x, y: p.y, trigger: p.trigger };
};
