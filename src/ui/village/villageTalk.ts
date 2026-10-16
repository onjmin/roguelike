// 地上の ひとこと：タイトル（起動の札）の ひとこと、村で 仲間に 話しかけたときの ひとこと（1回の 帰りに
// 1人 1つの 新しい話と、そのあとの 決まった ひとこと）、ヒナリーの 帳簿、ダンジョンの ひとことの説明（口・立て札）。
// ひとことは 前の冒険の結果と 町の段から、仲間の セリフの たまり（data/story/story.ts・data/town/town.ts・data/story/quotes.ts）を引く。

import { DUNGEON_IDS, dungeonById } from "../../core/data/dungeons";
import { nextTier, subsText, TOWN_STAGES } from "../../core/town";
import type { DungeonId } from "../../core/types";
import {
	pickQuote,
	type Quote,
	type QuoteContext,
	SPEAKERS,
	type Speaker,
} from "../../data/story/quotes";
import {
	awayFriends,
	CLEAR,
	DUNGEON_NAMES,
	FIRST_SHALLOW,
	mentionsAway,
	SHALLOW_DEATH,
	zankiLine,
} from "../../data/story/story";
import { nowHour } from "../../data/town/calendar";
import { TAMPER_LEDGER, TAMPER_TALK, tamperTier } from "../../data/town/tamper";
import {
	BAND_IDLE,
	ESCAPE_QUOTES,
	TITLE_TOWN_QUOTES,
	VILLAGE_IDLE,
	VILLAGE_MSG,
	ZERO_VOICELESS,
} from "../../data/town/town";
import { timeBand } from "../../data/village/crowd";
import { type Cue, cueOf } from "../../engine/emote";
import {
	loadProgress,
	loadRecords,
	loadTown,
	runStats,
} from "../../engine/save";
import { settings } from "../../engine/settings";
import { disappointed } from "../../engine/tamper";

/**
 * セーブを 書きかえた あと、仲間が がっかり している 段（data/town/tamper.ts。していなければ null）。
 * そのあいだ 話しかけた ときの ひとこと・起動の札・たおれた ときの ひとこと・帳簿が かわる。
 */
export const sulkTier = (): number | null => {
	const n = disappointed(runStats().runs);
	return n ? tamperTier(n) : null;
};

/** がっかり している 仲間の ひとこと（村に いる 人から seed で 1人）。 */
const sulkQuote = (tier: number, seed: number): Quote | null => {
	const here = (Object.keys(TAMPER_TALK) as Speaker[]).filter(
		(w) => !away_().includes(w),
	);
	const who = here[seed % Math.max(1, here.length)];
	return who ? { who, text: TAMPER_TALK[who][tier] ?? "" } : null;
};

/**
 * ダンジョンの ひとことの説明（口・立て札の 2行目。階の数は 1行目の 名前の 横に 出す）。
 * 村の窓に 収まるよう 1行（全角22字まで）。
 */
export const DUNGEON_DESC = Object.fromEntries(
	DUNGEON_IDS.map((d) => [d, DUNGEON_NAMES[d].rules[1]]),
) as Record<DungeonId, string>;

/** いちばん新しい記録から、ひとことの手がかりを作る。 */
const quoteContext = (): QuoteContext => {
	const last = loadRecords()[0];
	if (!last) return null;
	const st = runStats();
	return {
		kind: last.kind,
		// 持ち帰ったときの depth は地上の手前（1）なので、いちばん深い階を渡す
		depth: last.kind === "clear" ? last.maxDepth : last.depth,
		cause: last.cause,
		runs: st.runs,
		// 本編の たまり（「また 行ってきたんか」）なので、本編を 持ち帰った回数だけ（ちょっと・もっと は 数えない）
		clears: loadRecords().filter(
			(r) => r.kind === "clear" && (r.dungeon ?? "main") === "main",
		).length,
		ratio:
			(last.kind === "clear" ? last.maxDepth : last.depth) /
			dungeonById(last.dungeon).floors,
		up: !!dungeonById(last.dungeon).up,
	};
};

/**
 * たおれて もどったとき 歩いてくる 仲間の ひとこと（前の冒険が たおれ で なければ null）。
 * パン板なら ときどき パン板の たまり、ほかは 深さ・たおれ方・「次スレ」の たまり（pickQuote）。
 */
export const deathQuote = (seed: number): Quote | null => {
	const last = loadRecords()[0];
	if (last?.kind !== "dead") return null;
	const sulk = sulkTier();
	if (sulk !== null) return sulkQuote(sulk, seed);
	const away = away_();
	const mute = adventurer();
	const here = SHALLOW_DEATH.filter(
		(x) =>
			!away.includes(x.who) &&
			!mute.includes(x.who) &&
			!mentionsAway(x.text, away),
	);
	if ((last.dungeon ?? "main") === "shallow" && seed % 2 === 0 && here.length)
		return here[seed % here.length] ?? null;
	return pickQuote(quoteContext(), seed, undefined, away, mute, bandNow());
};

/** いまの 時間帯（村の 時計。村の 色・人通りと 同じ）。時間帯つきの 台詞を えらぶ。 */
const bandNow = () => timeBand(nowHour());

/** 村に いない 仲間（まだ 来ていない）。 */
const away_ = (): Speaker[] =>
	awayFriends(loadProgress().cleared, loadTown().stage);

/**
 * 前の 冒険に 出た 仲間（ロゼ・ゼロ。キリコなら 空）。帰って きた 本人が 自分に「おかえり」・
 * ねぎらいを 言うのは おかしいので、前の 冒険への ひとことを しゃべらせない（作者の 指示）。
 */
const adventurer = (): Speaker[] => {
	const h = loadRecords()[0]?.hero;
	return h ? [h] : [];
};

/**
 * 起動の札の ひとこと。ちょっと・もっと の たまり（data/story/story.ts）を先に見て、
 * 無ければ 本編の たまり（data/story/quotes.ts の pickQuote）。
 */
export const titleQuote = (seed: number): Quote | null => {
	const sulk = sulkTier();
	if (sulk !== null) return sulkQuote(sulk, seed);
	const last = loadRecords()[0];
	const away = away_();
	const mute = adventurer();
	const pick = (all: readonly Quote[], salt: number) => {
		const pool = all.filter(
			(x) =>
				!away.includes(x.who) &&
				!mute.includes(x.who) &&
				!mentionsAway(x.text, away),
		);
		return pool.length ? pool[(seed * 31 + salt) % pool.length] : null;
	};
	if (!last) return pick(FIRST_SHALLOW, 1);
	const d = last.dungeon ?? "main";
	if (last.kind === "escape") return pick(ESCAPE_QUOTES, 4);
	// ときどき 町の様子の ひとこと（屋台が出てから）
	const stage = loadTown().stage;
	if (stage >= 1 && seed % 3 === 0)
		return pick(TITLE_TOWN_QUOTES[stage] ?? [], 5);
	if (last.kind === "clear" && d !== "main") return pick(CLEAR[d], 2);
	if (last.kind === "dead" && d === "shallow" && seed % 2 === 0)
		return pick(SHALLOW_DEATH, 3);
	return pickQuote(quoteContext(), seed, undefined, away, mute, bandNow());
};

// ───────────────── 村で 話しかけたとき ─────────────────
// 1回の 帰りに 1人 1つだけ、前の冒険への 新しい ひとこと。聞いたら、次に 帰ってくるまで
// 短い 決まった ひとこと（その段の 町の様子。無い人は 役目の ひとこと）。
// 「帰り」は いちばん新しい 冒険の記録（終わった時刻）で 見分ける。聞いたかどうかは 村の 印として
// 別の 保存場所に 残す（中断セーブ・記録・町には 手を ふれない。保存できなくても この回は 覚えている）。

const HEARD_KEY = "kiriko-roguelike/village";

/** 仲間ごとに、聞いた ひとことの 帰り（記録の 終わった時刻。記録が 無ければ 0）。 */
type Heard = Partial<Record<Speaker, number>>;

/** 前の版の 仲間の id（倉庫番 teto → shiyo、帳簿 rei → zero）。 */
const OLD_SPEAKERS: Readonly<Record<string, Speaker>> = {
	teto: "shiyo",
	rei: "zero",
};

/** 保存できないときの この回の 写し。 */
let heardMemo: Heard = {};

const loadHeard = (): Heard => {
	try {
		const raw = localStorage.getItem(HEARD_KEY);
		if (raw) {
			const o = JSON.parse(raw) as { heard?: unknown };
			const out: Heard = {};
			if (o?.heard && typeof o.heard === "object")
				for (const [key, v] of Object.entries(o.heard)) {
					// 前の版の 仲間（テト・レイ）は 役目を 継いだ シヨ・ゼロ として 読む
					const k = OLD_SPEAKERS[key] ?? key;
					if (k in SPEAKERS && typeof v === "number") out[k as Speaker] = v;
				}
			return out;
		}
	} catch {
		// 読めなければ この回の 写し
	}
	return { ...heardMemo };
};

const saveHeard = (h: Heard): void => {
	heardMemo = { ...h };
	try {
		localStorage.setItem(HEARD_KEY, JSON.stringify({ heard: h }));
	} catch {
		// 保存できなくても 遊べる（この回は 写しで 覚えている）
	}
};

/** 試験用：この回の 写しを 忘れる。 */
export const forgetHeardMemo = (): void => {
	heardMemo = {};
};

/** いまの 帰り（いちばん新しい 冒険の記録の 終わった時刻。まだ無ければ 0）。 */
const returnAt = (): number => loadRecords()[0]?.at ?? 0;

/**
 * 前の冒険への その人の ひとこと（無ければ null）。帰りごとに 決まる（同じ帰りの あいだは 同じ）。
 * ちょっと・もっと の たまり（data/story/story.ts）と 帰還スレの たまりを 先に見て、無ければ 本編の たまり
 * （data/story/quotes.ts。死因・深さ）。
 */
const reaction = (who: Speaker): Quote | null => {
	if (adventurer().includes(who)) return null;
	const last = loadRecords()[0];
	const seed = (last?.at ?? 0) % 9973;
	const mine = (pool: readonly Quote[]) => {
		const p = pool.filter((x) => x.who === who);
		return p.length ? p[seed % p.length] : null;
	};
	if (!last) return mine(FIRST_SHALLOW);
	const d = last.dungeon ?? "main";
	if (last.kind === "escape") return mine(ESCAPE_QUOTES);
	if (last.kind === "clear" && d !== "main") return mine(CLEAR[d]);
	if (last.kind === "dead" && d === "shallow" && seed % 2 === 0)
		return (
			mine(SHALLOW_DEATH) ??
			pickQuote(quoteContext(), seed, who, [], [], bandNow())
		);
	return pickQuote(quoteContext(), seed, who, [], [], bandNow());
};

/**
 * なかよし度（ui/village/bonds.ts）が 差しこむ 口。idle は 親しく なった 仲間の 決まった ひとこと（無ければ null）、
 * news は 新しい話を 聞いた（なかよし度が 1 ふえる）。bonds.ts が 読みこまれた とき 差しかえる。
 */
export const talkHooks: {
	idle: (who: Speaker) => string | null;
	news: (who: Speaker) => void;
} = { idle: () => null, news: () => {} };

/** この 帰りに もう 新しい話を 聞いたか。 */
export const heardNow = (who: Speaker): boolean =>
	loadHeard()[who] === returnAt();

/** この 帰りの 新しい話を 聞いた ことに する（なかよし度の 話を 聞いた とき）。 */
export const markHeard = (who: Speaker): void => {
	const h = loadHeard();
	h[who] = returnAt();
	saveHeard(h);
};

/** 決まった ひとことを 言った 回数（時間帯の ひとことと 交互に する。ページを 閉じれば 消える）。 */
const idleCount = new Map<Speaker, number>();

/** その人の 決まった ひとこと（新しい話を 聞いたあと）。 */
/** 話しかけた ときの ひとこと（文と、話す 人の 感情の 記号・体の 動き）。 */
export type TalkLine = { text: string } & Cue;

const idleLine = (who: Speaker, o: { gate?: boolean }): TalkLine => {
	// 口の前で 見張っている間は 見張りの ひとこと
	if (who === "nanj" && o.gate) return { text: VILLAGE_IDLE.gate };
	// 時間帯の ひとこと（昼の ほか。いつもの ひとことと 交互：data/town/town.ts の BAND_IDLE）
	const n = (idleCount.get(who) ?? 0) + 1;
	idleCount.set(who, n);
	// 寄り道「残機」（STORY.md §5）：きのこ板の あとは やきうの 頭の 上の 数を 3回に 1回 言う
	if (who === "nanj" && n % 3 === 0) {
		const z = zankiLine(loadProgress().cleared);
		if (z) return { text: z };
	}
	const band = bandNow();
	const timed = band === "day" ? undefined : BAND_IDLE[who][band];
	if (timed && n % 2 === 1) return { text: timed };
	const warm = talkHooks.idle(who);
	if (warm) return { text: warm };
	const stage = loadTown().stage;
	const town = (TITLE_TOWN_QUOTES[stage] ?? []).find((x) => x.who === who);
	if (town) return { text: town.text, ...cueOf(town) };
	// ボイスを オンに しても、ゼロだけは 声が 出ない（音源が まだ 無い）
	if (who === "zero" && settings.voice)
		return {
			text: ZERO_VOICELESS[(returnAt() % 9973) % ZERO_VOICELESS.length] ?? "",
		};
	return { text: VILLAGE_IDLE[who] };
};

/** まだ 聞いていない 新しい ひとことが あるか。 */
export const hasNews = (who: Speaker): boolean =>
	sulkTier() === null &&
	loadHeard()[who] !== returnAt() &&
	reaction(who) !== null;

/**
 * 話しかけたときの ひとこと。新しい話が あれば それ（聞いたと 覚える）、無ければ 決まった ひとこと。
 * gate は やきうが 本編の口の前で 見張っているとき。
 */
export const talkQuote = (
	who: Speaker,
	o: { gate?: boolean } = {},
): TalkLine => {
	// がっかり している あいだは 新しい話も しない（聞いたことにも しない。あとで 聞ける）
	const sulk = sulkTier();
	if (sulk !== null)
		return { text: TAMPER_TALK[who][sulk] ?? VILLAGE_IDLE[who] };
	const at = returnAt();
	const heard = loadHeard();
	if (heard[who] !== at) {
		const news = reaction(who);
		heard[who] = at;
		saveHeard(heard);
		if (news) {
			talkHooks.news(who);
			return { text: news.text, ...cueOf(news) };
		}
	}
	return idleLine(who, o);
};

/** talkQuote の 文だけ。 */
export const talkLine = (who: Speaker, o: { gate?: boolean } = {}): string =>
	talkQuote(who, o).text;

/** 文の {name} を 埋める。 */
export const fill = (
	text: string,
	vars: Record<string, string | number>,
): string =>
	text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/** ヒナリーの 帳簿：登録者数と、次の 店が 何人で 開くか（TOWN.md §0.4）。 */
export const ledgerLine = (): string => {
	const t = loadTown();
	const sulk = sulkTier();
	if (sulk !== null)
		return fill(TAMPER_LEDGER[sulk] ?? "", { points: t.points });
	if (t.stage >= TOWN_STAGES - 1)
		return fill(VILLAGE_MSG.ledgerMax, { subs: subsText(t.subs) });
	if (t.subs <= 0) return VILLAGE_MSG.ledgerNone;
	const next = nextTier(t.subs);
	// 登録者は 届いて いるが、いちばん上の 段は 電池板を 持ち帰って から（core/town.ts の stageOfSubs）
	if (next === null)
		return fill(VILLAGE_MSG.ledgerTop, { subs: subsText(t.subs) });
	return fill(VILLAGE_MSG.ledger, {
		subs: subsText(t.subs),
		next: subsText(next),
	});
};
