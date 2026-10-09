// 町の 役所と 議会の 試験（pnpm test で いっしょに 動く。CIVIC.md §6・ENGINE.md §7.9）。
// C 節：施設の 置き場所（三権の 並び）。T 節：討論会の 採点と 試合（data/debate.ts）。W 節：文の 幅と 使わない 語。
// V 節：村の 入口（ui/debate.ts。板は 差しかえ）と 保存。
// 形は jikkyoTests と 同じ（Fail・ok・{ id, name, ok, reason }）。id の 頭は 節の 字。

import { Rng } from "../core/rng";
import { TOWN_STAGES } from "../core/town";
import type { Today } from "../data/calendar";
import {
	AGENDA,
	ASSEMBLY_LINES,
	type Assembly,
	agendaOf,
	assemblyMembers,
	CIVIC_BOARD,
	DAYORI,
	inSession,
	NANASHI_CHAIR,
	NOT_IN_ASSEMBLY,
	SEATS,
	YORIAI_SPOTS,
} from "../data/civic";
import {
	ACTS,
	BOARD,
	bestOf,
	CARDS,
	type Card,
	cardsFor,
	cardValue,
	DEBATE_MSG,
	type DebatePolicy,
	type DebateSt,
	debateVars,
	FALLACY,
	type FaithSide,
	fillDebate,
	HOT,
	isHot,
	isName,
	judge,
	KIBEN,
	MINUTES,
	NANASHI_LINES,
	type Nameless,
	OUTSIDE_TEXT,
	type Outcome,
	PAGE,
	PAGES,
	POSTS,
	type PolicySide,
	type PostKind,
	pagesOf,
	playDebateSim,
	type Rand,
	TOPICS,
	type Topic,
	VERDICT,
} from "../data/debate";
import { MOB_IDS, type MobId } from "../data/mobs";
import {
	FACILITIES,
	type Facility,
	facilitiesAt,
	facilityBlock,
	facilityById,
	facilityDoor,
	facilityEntry,
	facilityMats,
	facilityOutside,
	facilityRoomPalette,
	facilityRoomPlaces,
	facilityRoomRows,
} from "../data/village/facilities";
import { hallPlaces, hallRows } from "../data/village/hall";
import type { VillageView } from "../data/village/map";
import type { Story } from "../engine/defs";
import { loadProgress } from "../engine/save";
import {
	assemblyEvents,
	civicBoardMenu,
	civicBoardScript,
	yoriaiMovedLine,
} from "../ui/civic";
import type { Ctx } from "../ui/ctx";
import {
	type DebateResult,
	forgetCivicMemo,
	loadCivic,
	pageText,
	saveCivic,
	setDebateHook,
} from "../ui/debate";
import { buildFacility } from "../ui/facilities";
import { assemblyToday, guestsOf } from "../ui/guests";
import { fill } from "../ui/villageTalk";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { id: string; name: string; run: () => void | Promise<void> }[] =
	[];
const test = (id: string, name: string, run: () => void | Promise<void>) =>
	CASES.push({ id, name, run });

/** 全角=1・半角=0.5 で 数えた 幅（villageTests と 同じ）。 */
const width = (line: string): number =>
	[...line].reduce((w, ch) => w + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);

/** 行の 数と 幅。 */
const box = (where: string, text: string, cols: number, rows = 2): void => {
	const lines = text.split("\n");
	ok(lines.length <= rows, `${where}: ${lines.length} lines in "${text}"`);
	for (const l of lines)
		ok(width(l) <= cols, `${where}: "${l}" is ${width(l)} wide (> ${cols})`);
	ok(!/\{\w+\}/.test(text), `${where}: an unfilled {…} in "${text}"`);
};

/** 種つきの 乱数。 */
const seeded = (seed: string | number): Rand => {
	const r = Rng.fromSeed(`civic:${seed}`);
	return () => r.float();
};

const view = (stage: number): VillageView => ({
	stage,
	unlocked: ["shallow"],
	cleared: [],
});

const must = (id: string): Facility => {
	const f = facilityById(id);
	if (!f) throw new Fail(`no ${id}`);
	return f;
};

// ───────────────── 使わない 語（試験の 中だけに 置く） ─────────────────

/**
 * 出荷する 文に 出さない 語：実在の 政党・政治家・政治の 決まり文句・争点・実在の 宗教と 習わし（神社は
 * 背景だけで、議会・討論・番組には 出さない）・婚姻・戸籍・本籍・植民の 図・集団を 消す 言い回し・色の 派・
 * 差別語ほか（CIVIC.md §6.6）。
 */
const NG = [
	"自民",
	"立憲",
	"維新",
	"共産",
	"公明",
	"れいわ",
	"参政",
	"社民",
	"国民民主",
	"N国",
	"安倍",
	"石破",
	"岸田",
	"菅",
	"麻生",
	"蓮舫",
	"稲田",
	"高市",
	"小泉",
	"河野",
	"枝野",
	"野田",
	"玉木",
	"山本太郎",
	"百田",
	"立花",
	"橋下",
	"小池",
	"ひろゆき",
	"トランプ",
	"今村",
	"ヒトラー",
	"金正恩",
	"保守派",
	"保守党",
	"保守系",
	"革新",
	"リベラル",
	"右派",
	"左派",
	"右翼",
	"左翼",
	"与党",
	"野党",
	"政党",
	"ネトウヨ",
	"パヨク",
	"ブサヨ",
	"売国",
	"反日",
	"極左",
	"非国民",
	"政教分離",
	"靖国",
	"神社本庁",
	"日本会議",
	"天皇",
	"皇室",
	"改憲",
	"護憲",
	"9条",
	"憲法",
	"同性婚",
	"夫婦別姓",
	"参政権",
	"外国人",
	"増税",
	"消費税",
	"自衛隊",
	"死刑",
	"移民",
	"原発",
	"ワクチン",
	"領土",
	"印象操作",
	"ご飯論法",
	"丁寧に説明",
	"真摯に",
	"検討を",
	"スピード感",
	"全く問題ない",
	"指摘は当たらない",
	"セクシー",
	"2位じゃ",
	"お気持ち",
	"記憶にございません",
	"遺憾",
	"仏教",
	"神道",
	"キリスト",
	"イスラム",
	"創価",
	"統一教会",
	"幸福の科学",
	"エホバ",
	"オウム",
	"天理",
	"大川",
	"聖戦",
	"ジハード",
	"十字軍",
	"異教徒",
	"神社",
	"参道",
	"御利益",
	"おみくじ",
	"絵馬",
	"賽銭",
	"婚姻",
	"戸籍",
	"本籍",
	"同性",
	"部落",
	"在日",
	"支那",
	"シナ",
	"チョン",
	"植民地",
	"原住民",
	"侵略",
	"民よ",
	"消えろ",
	"消えるがいい",
	"滅び",
	"駆除",
	"出ていけ",
	"追放",
	"赤派",
	"青派",
	"ガイジ",
	"アスペ",
	"キチガイ",
	"池沼",
	"チンパン",
	"土人",
	"チー牛",
	"ジャップ",
	"アメカス",
	"さとる",
	"矢野",
];

/** 使わない 語・「保守」の 使い方（後ろが 町・市・村・地方 の とき だけ）・「アカ」（アカウントを 除く）。 */
const ngCheck = (where: string, text: string): void => {
	for (const n of NG) ok(!text.includes(n), `${where}: "${n}" in "${text}"`);
	ok(!/アカ(?!ウント)/.test(text), `${where}: アカ in "${text}"`);
	for (const m of text.matchAll(/保守(.?)/g))
		ok(
			m[1] !== undefined && "町市村地".includes(m[1]) && m[1] !== "",
			`${where}: 保守 is not a place name in "${text}"`,
		);
};

// ───────────────── C 置き場所 ─────────────────

/** 施設の 外観の マス（地図の 座標）。 */
const cellsOf = (f: Facility): Set<string> => {
	const out = new Set<string>();
	facilityBlock(f).forEach((line, dy) => {
		[...line].forEach((ch, dx) => {
			if (ch !== " ") out.add(`${f.at[0] + dx},${f.at[1] + dy}`);
		});
	});
	return out;
};

test(
	"C1",
	"三権の 並び：段4〜6 の 町役場・段7 の 市役所（議場つき）は ほかの 施設と 重ならず、扉は 東の 大通りの 北の 突きあたり (66,7)、裁判所と となり あう",
	() => {
		const th = must("townhall");
		const ch = must("cityhall");
		ok(
			th.from === 4 &&
				th.until === 7 &&
				ch.from === 7 &&
				ch.until === undefined,
			`stages townhall ${th.from}〜${th.until} cityhall ${ch.from}〜${ch.until}`,
		);
		const court = must("court");
		const courtRight = Math.max(
			...[...cellsOf(court)].map((c) => Number(c.split(",")[0])),
		);
		for (const hall of [th, ch]) {
			const d = facilityDoor(hall);
			ok(d?.[0] === 66 && d[1] === 7, `${hall.id} door ${d}`);
			const o = facilityOutside(hall);
			ok(o.x === 66 && o.y === 8, `${hall.id} outside ${o.x},${o.y}`);
			// 裁判所（段7、x53〜62）の すぐ 東
			ok(
				courtRight + 1 === hall.at[0],
				`court ends at ${courtRight}, ${hall.id} at ${hall.at[0]}`,
			);
			// 施設は FACILITIES の いちばん うしろ（外観の 字を ずらさない）
			ok(
				FACILITIES.indexOf(hall) >
					FACILITIES.findIndex((f) => f.id === "chuka"),
				`${hall.id} is not after the eateries`,
			);
		}
		for (let stage = 0; stage < TOWN_STAGES; stage++) {
			const up = facilitiesAt(stage);
			ok(
				up.includes(th) === (stage >= 4 && stage < 7) &&
					up.includes(ch) === stage >= 7,
				`stage ${stage}: halls up ${up.includes(th)} ${up.includes(ch)}`,
			);
			for (const hall of [th, ch]) {
				if (!up.includes(hall)) continue;
				const mine = cellsOf(hall);
				for (const f of up) {
					if (f === hall) continue;
					for (const c of cellsOf(f))
						ok(
							!mine.has(c),
							`stage ${stage}: ${f.id} overlaps ${hall.id} at ${c}`,
						);
					for (const [x0, y, line, until] of f.clear ?? []) {
						if (until !== undefined && stage >= until) continue;
						for (let dx = 0; dx < [...line].length; dx++)
							ok(
								!mine.has(`${x0 + dx},${y}`),
								`stage ${stage}: ${f.id} clears ground under ${hall.id}`,
							);
					}
				}
			}
		}
	},
);

// ───────────────── T 討論会の 採点 ─────────────────

const POLICY = TOPICS.filter((t) => t.mode === "policy");
const FAITH = TOPICS.filter((t) => t.mode === "faith");

/** いちばん ねうちの ある 札（同じ ねうちが 2枚 あれば null）。 */
const bestCard = (post: PostKind, cards: readonly Card[]): Card | null => {
	const vals = cards.map((c) => cardValue(post, c));
	const top = Math.max(...vals);
	return vals.filter((v) => v === top).length === 1
		? cards[vals.indexOf(top)]
		: null;
};

const BEST: DebatePolicy = (post, cards) => bestCard(post, cards) ?? cards[0];
const HONEST: DebatePolicy = (_p, cards) =>
	(["source", "concede", "plain", "through"] as const).find((c) =>
		cards.includes(c),
	) ?? cards[2];
const HOTHEAD: DebatePolicy = (_p, cards) =>
	cards.find((c) => isHot(c)) ?? cards[5];
const RANDOM: DebatePolicy = (_p, cards, _st, r) =>
	cards[Math.floor(r() * cards.length)];

/** たくさん 回す（お題・派を まわす）。 */
const many = (
	topics: readonly Topic[],
	policy: DebatePolicy,
	n: number,
	seed: string,
	log?: Parameters<typeof playDebateSim>[4],
): Record<string, number> => {
	const r = seeded(seed);
	const out: Record<string, number> = {};
	for (let i = 0; i < n; i++) {
		const t = topics[i % topics.length];
		const { outcome } = playDebateSim(
			t,
			((i >> 1) % 2) as 0 | 1,
			policy,
			r,
			log,
		);
		out[outcome] = (out[outcome] ?? 0) + 1;
	}
	return out;
};

test(
	"T1",
	"どの 書きこみにも いちばん 良い 札が ちょうど 1つ、それは bestOf、名前を 当てると 中身より 高い",
	() => {
		const r = seeded("t1");
		for (const t of TOPICS)
			for (let i = 0; i < 400; i++)
				playDebateSim(
					t,
					(i % 2) as 0 | 1,
					RANDOM,
					r,
					(_st, post, _x, cards) => {
						const b = bestCard(post, cards);
						ok(b !== null, `${t.id} ${post}: no single best in ${cards}`);
						ok(
							b === bestOf(post),
							`${t.id} ${post}: best ${b} != ${bestOf(post)}`,
						);
					},
				);
		for (const f of FALLACY) {
			const right = cardValue(f, `name_${f}`);
			for (const c of ["source", "concede", "through"] as const)
				ok(right > cardValue(f, c), `${f}: naming is not above ${c}`);
		}
	},
);

test(
	"T2",
	"煽りに 乗ると かならず 顔真っ赤が 上がり、まっとうな「ソースは？」に ゴールを 動かすなは 減点",
	() => {
		const posts = Object.keys(POSTS) as PostKind[];
		for (const p of posts)
			for (const c of HOT)
				ok(judge(p, c)[1] >= 1, `${p} × ${c}: heat ${judge(p, c)[1]}`);
		ok(judge("ask", "name_goal")[0] < 0, "名指し on ask is not a penalty");
		ok(judge("ask", "source")[0] > 0, "source on ask is not a plus");
	},
);

test(
	"T3",
	"良スレ判定：信条への 名指しは かならず 減点・KO なし・相手の 住人は 信条と かばう 1レスだけ（煽りは 荒らし）",
	() => {
		for (const f of FALLACY)
			ok(judge("belief", `name_${f}`)[0] < 0, `name_${f} on belief`);
		const r = seeded("t3");
		const kinds = new Set<PostKind>();
		for (let i = 0; i < 2000; i++) {
			const t = FAITH[i % FAITH.length];
			const { outcome } = playDebateSim(
				t,
				(i % 2) as 0 | 1,
				i % 3 ? BEST : RANDOM,
				r,
				(_st, post) => kinds.add(post),
			);
			ok(["ryosure", "futsu", "arete"].includes(outcome), `faith ${outcome}`);
		}
		for (const k of kinds)
			ok(k === "belief" || k.startsWith("a_"), `a faith opponent writes ${k}`);
		ok(kinds.has("belief") && kinds.has("a_bait"), `faith kinds ${[...kinds]}`);
	},
);

test(
	"T4",
	"どの お題も 両方の 派で 同じ 種なら 同じ 決着（最高点が 同じ）、どちらの 派でも 最善で 勝てる",
	() => {
		for (const t of TOPICS) {
			const out: string[][] = [[], []];
			for (const us of [0, 1] as const) {
				for (let i = 0; i < 120; i++)
					out[us].push(
						playDebateSim(t, us, BEST, seeded(`t4:${t.id}:${i}`)).outcome,
					);
			}
			ok(out[0].join() === out[1].join(), `${t.id}: sides differ`);
		}
	},
);

test(
	"T5",
	"決め打ち：最善 → KO（5 ラウンド目）か 判定勝ち、中身だけ → 引き分け、煽りだけ → TKO（良スレは 良スレ・ふつう・荒れた）",
	() => {
		const koRounds = new Set<number>();
		const best = many(POLICY, BEST, 3000, "t5b", (st, post, _t, _c, c) => {
			if (post === "victory" && c === "through" && st.r === 5 && st.opp >= 2)
				koRounds.add(st.r);
		});
		ok(
			Object.keys(best).every((k) => k === "ko" || k === "win"),
			`best ${JSON.stringify(best)}`,
		);
		ok((best.ko ?? 0) / 3000 > 0.8, `best KO ${JSON.stringify(best)}`);
		ok([...koRounds].join() === "5", `KO rounds ${[...koRounds]}`);
		const honest = many(POLICY, HONEST, 2000, "t5h");
		ok(
			Object.keys(honest).join() === "draw",
			`honest ${JSON.stringify(honest)}`,
		);
		const hot = many(POLICY, HOTHEAD, 1000, "t5x");
		ok(Object.keys(hot).join() === "tko", `hothead ${JSON.stringify(hot)}`);
		const fb = many(FAITH, BEST, 1500, "t5fb");
		ok(
			Object.keys(fb).join() === "ryosure",
			`faith best ${JSON.stringify(fb)}`,
		);
		const fh = many(FAITH, HOTHEAD, 600, "t5fx");
		ok(
			Object.keys(fh).join() === "arete",
			`faith hothead ${JSON.stringify(fh)}`,
		);
		// でたらめは あまり 勝てない
		const rnd = many(POLICY, RANDOM, 3000, "t5r");
		ok(
			((rnd.ko ?? 0) + (rnd.win ?? 0)) / 3000 < 0.15,
			`random ${JSON.stringify(rnd)}`,
		);
	},
);

/** 札の 種類（名指しは ひとまとめ）。 */
const cat = (c: Card): string => (isName(c) ? "name" : isHot(c) ? "hot" : c);

test(
	"T6",
	"札の 内訳は どの 書きこみでも 同じ（名指し 2・やわらかい 3・熱い 1）、読まずに 選ぶ 上限の KO は 25% 未満",
	() => {
		const r = seeded("t6");
		for (const mode of ["policy", "faith"] as const) {
			const soft =
				mode === "faith" ? "respect,plain,through" : "concede,source,through";
			for (const p of Object.keys(POSTS) as PostKind[])
				for (let i = 0; i < 30; i++) {
					const cs = cardsFor(p, mode, r);
					ok(cs.length === 6, `${p}: ${cs.length} cards`);
					ok(
						cs.map(cat).join() === `name,name,${soft},hot`,
						`${mode} ${p}: ${cs.map(cat)}`,
					);
					ok(new Set(cs).size === 6, `${p}: the same card twice`);
				}
		}
		// 読まない 人：札の 組と 盤面（ラウンド・顔真っ赤・前の 手）だけ 見て、平均で 得な 札を 選ぶ（学習ずみの 上限）
		const sig = (cards: readonly Card[], st: DebateSt) =>
			`${st.mode}|${st.r}|${st.opp}|${st.heat}|${st.last ? cat(st.last) : "-"}|${cards.map((c) => (isName(c) ? "name" : c)).join(",")}`;
		const table = new Map<string, Map<string, [number, number]>>();
		const tr = seeded("t6train");
		for (let i = 0; i < 40000; i++)
			playDebateSim(
				POLICY[i % POLICY.length],
				(i % 2) as 0 | 1,
				(post, cards, st) => {
					const s = sig(cards, st);
					const t = table.get(s) ?? new Map<string, [number, number]>();
					table.set(s, t);
					for (const c of cards) {
						const k = isName(c) ? "name" : c;
						const e = t.get(k) ?? [0, 0];
						e[0] += cardValue(post, c);
						e[1] += 1;
						t.set(k, e);
					}
					return cards[Math.floor(tr() * cards.length)];
				},
				tr,
			);
		const blind: DebatePolicy = (_p, cards, st, rr) => {
			const t = table.get(sig(cards, st));
			let bk = "";
			let bv = -1e9;
			for (const c of cards) {
				const k = isName(c) ? "name" : c;
				const e = t?.get(k);
				const v = e ? e[0] / e[1] : -1e9;
				if (v > bv) {
					bv = v;
					bk = k;
				}
			}
			const cands = cards.filter((c) => (isName(c) ? "name" : c) === bk);
			return cands.length
				? cands[Math.floor(rr() * cands.length)]
				: cards[Math.floor(rr() * cards.length)];
		};
		const res = many(POLICY, blind, 6000, "t6eval");
		ok((res.ko ?? 0) / 6000 < 0.25, `blind ${JSON.stringify(res)}`);
	},
);

test(
	"T7",
	"ゴール動かしは ソースを 出した あとに しか 出ず、1試合で 同じ 文を くり返さない",
	() => {
		const r = seeded("t7");
		for (const t of TOPICS)
			for (const pol of [BEST, RANDOM, HONEST, HOTHEAD])
				for (let i = 0; i < 300; i++) {
					const seen = new Set<string>();
					playDebateSim(t, (i % 2) as 0 | 1, pol, r, (st, post, text) => {
						if (post === "goal")
							ok(st.last === "source", `${t.id}: goal after ${st.last}`);
						ok(!seen.has(text), `${t.id}: "${text}" twice`);
						seen.add(text);
					});
				}
	},
);

// ───────────────── W 文の 幅と 使わない 語 ─────────────────

/** 両方の 派・名無しの 組み合わせで 埋めた 書きこみ。 */
const expandedPosts = (): { where: string; text: string }[] => {
	const out: { where: string; text: string }[] = [];
	const variants: Nameless[] = [
		{ ally: false, opp: false },
		{ ally: true, opp: true },
	];
	for (const t of TOPICS)
		for (const us of [0, 1] as const)
			for (const nl of variants) {
				const v = debateVars(t, us, 89, nl);
				const kinds = (Object.keys(POSTS) as PostKind[]).filter((k) =>
					t.mode === "faith"
						? k === "belief" || k.startsWith("a_")
						: k !== "belief" && !k.startsWith("a_"),
				);
				for (const k of kinds)
					for (const p of POSTS[k])
						out.push({
							where: `${t.id}.${us}.${k}`,
							text: fillDebate(p, v),
						});
			}
	return out;
};

test(
	"W1",
	"討論の 文：板 18字×2行・カンペ 16字・ROM と 判定 19字・村の 窓 22字×2行、埋まらない {…} なし、使わない 語なし",
	() => {
		for (const p of expandedPosts()) {
			box(p.where, p.text, 18);
			ngCheck(p.where, p.text);
		}
		for (const t of TOPICS) {
			box(`${t.id}.nao`, t.nao, 18);
			box(`${t.id}.op`, fillDebate(BOARD.op, { title: t.title }), 18);
			ngCheck(`${t.id}`, `${t.title}${t.nao}`);
			for (const us of [0, 1] as const) {
				const s = t.sides[us];
				ok(!/[赤青右左白黒]/.test(s.name), `${t.id}: side name ${s.name}`);
				const v = debateVars(t, us);
				const cards: Card[] = [
					...FALLACY.map((f): Card => `name_${f}`),
					...(t.mode === "faith"
						? (["respect", "plain", "through"] as const)
						: (["concede", "source", "through"] as const)),
					...HOT,
				];
				for (const c of cards) {
					const text = fillDebate(CARDS[c], v);
					box(`${t.id}.${us}.card.${c}`, text, 16, 1);
					ngCheck(`${t.id}.card`, text);
				}
				const board: string[] =
					t.mode === "faith"
						? [
								...(s as FaithSide).belief,
								...(s as FaithSide).plain,
								(s as FaithSide).defend,
								s.flee,
							]
						: [
								(s as PolicySide).claim,
								(s as PolicySide).plain ?? "",
								(s as PolicySide).poem,
								s.flee,
							];
				for (const text of board.filter(Boolean)) {
					box(`${t.id}.${us}.board`, text, 18);
					ngCheck(`${t.id}.board`, text);
				}
				const wins: string[] =
					t.mode === "faith"
						? [(s as FaithSide).good]
						: [(s as PolicySide).sorry, (s as PolicySide).shrug];
				for (const text of wins) {
					box(`${t.id}.${us}.window`, text, 22);
					ngCheck(`${t.id}.window`, text);
				}
				for (const k of Object.keys(VERDICT) as Outcome[]) {
					const text = fillDebate(VERDICT[k], v);
					box(`verdict.${k}`, text, 19, 1);
					ngCheck("verdict", text);
				}
				// 1行の 値（藁人形・論点ずらしなど）は 改行しない
				if (t.mode === "policy")
					for (const k of [
						"fact_s",
						"extreme",
						"aside",
						"past",
						"label",
						"cut",
						"src",
						"short",
						"source",
					] as const)
						ok(
							!(s as PolicySide)[k].includes("\n"),
							`${t.id}.${us}.${k}: two lines`,
						);
			}
		}
		for (const [k, t] of Object.entries(NANASHI_LINES)) {
			box(
				`nanashi.${k}`,
				t,
				k === "sorry" || k === "shrug" || k === "good" ? 22 : 18,
			);
			ngCheck(`nanashi.${k}`, t);
		}
		for (const [k, t] of Object.entries(OUTSIDE_TEXT)) {
			box(`outside.${k}`, t, 22);
			ngCheck(`outside.${k}`, t);
		}
		for (const [k, t] of Object.entries(ACTS)) {
			box(`acts.${k}`, t, 18);
			ngCheck(`acts.${k}`, t);
		}
		for (const k of [
			"koRom",
			"tkoRom",
			"towelRom",
			"tateNige",
			"jienRom",
		] as const)
			box(`board.${k}`, BOARD[k], 18);
		box("board.quit1", BOARD.quit1, 19, 1);
		for (const t of [
			...DEBATE_MSG.intro,
			DEBATE_MSG.ally,
			DEBATE_MSG.nod,
			DEBATE_MSG.pickTopic,
			DEBATE_MSG.pickSide,
		]) {
			box("debate msg", t, 22);
			ngCheck("debate msg", t);
		}
		for (const [k, t] of Object.entries(PAGE)) {
			box(`page.${k}`, t, 22, 1);
			ngCheck(`page.${k}`, t);
		}
		for (const k of KIBEN) {
			box(`kiben ${k.label}`, k.text, 22);
			ngCheck(`kiben ${k.label}`, k.text);
			ok(width(k.label) <= 10, `kiben label ${k.label}`);
		}
		ok(KIBEN.length === 12, `kiben ${KIBEN.length}`);
		// ROM の 反応（採点が 返す 文）
		const roms = new Set<string>();
		for (const p of Object.keys(POSTS) as PostKind[])
			for (const c of Object.keys(CARDS) as Card[]) roms.add(judge(p, c)[3]);
		for (const t of roms) {
			box(`rom ${t}`, t, 19, 1);
			ngCheck("rom", t);
		}
	},
);

test(
	"W2",
	"決着の 文：どの お題・どちらの 派・どの 決着でも 文が あり、勝った 派が 正しいとは 言わない。キリコは 書きこまず「保守」と 言わない",
	() => {
		for (const t of TOPICS)
			for (const s of t.sides) {
				const texts =
					t.mode === "faith"
						? [(s as FaithSide).good, (s as FaithSide).defend, s.flee]
						: [
								(s as PolicySide).poem,
								(s as PolicySide).sorry,
								(s as PolicySide).shrug,
								s.flee,
							];
				for (const x of texts) {
					ok(x.length > 0, `${t.id}.${s.name}: an empty ending`);
					ok(
						!x.includes("正し"),
						`${t.id}.${s.name}: "${x}" says who is right`,
					);
				}
			}
		for (const x of [
			...Object.values(OUTSIDE_TEXT),
			...Object.values(VERDICT),
			...TOPICS.map((t) => t.nao),
		])
			ok(!x.includes("正し"), `"${x}" says who is right`);
		// キリコの 地の文は うなずく だけ。「保守」も 書かない
		ok(DEBATE_MSG.nod === "キリコは　うなずいた。", "the nod changed");
		for (const x of [...DEBATE_MSG.intro, DEBATE_MSG.ally, DEBATE_MSG.nod])
			ok(!x.includes("保守"), `"${x}" has 保守`);
		ok(
			!Object.values(BOARD).some((x) => x.includes("キリコ")),
			"a board name is Kiriko",
		);
	},
);

test(
	"W3",
	"町の 役所の 文：村の 窓（22字 × 2行）に 収まり、使わない 語なし",
	() => {
		for (const f of FACILITIES.filter((x) =>
			["townhall", "cityhall", "court"].includes(x.id),
		)) {
			const texts: [string, string][] = [];
			if (f.door) texts.push([`${f.id} door`, f.door]);
			for (const [k, ls] of Object.entries(f.room?.lines ?? {}))
				for (const t of ls) texts.push([`${f.id}.${k}`, t]);
			for (const p of f.room?.people ?? []) {
				for (const t of p.lines) texts.push([`${f.id}.${p.id}`, t]);
				texts.push([`${f.id}.${p.id} name`, p.name]);
			}
			texts.push([`${f.id} name`, f.name]);
			for (const [w, t] of texts) {
				box(w, t, 22);
				ngCheck(w, t);
			}
		}
	},
);

// ───────────────── V 村の 入口 ─────────────────

/** 地の文・セリフ・選ぶ だけを 記録する 台本の 相手（選ぶ ときは picks を 順に 返す）。 */
const recorder = (picks: number[] = []) => {
	const log: string[] = [];
	const s = new Proxy({} as Story, {
		get: (_t, k) => {
			if (k === "narrate")
				return async (t: string) => {
					log.push(`narrate: ${t}`);
				};
			if (k === "say")
				return async (_w: unknown, t: string, o?: { name?: string }) => {
					log.push(`say(${o?.name ?? ""}): ${t}`);
				};
			if (k === "choose")
				return async (opts: string[]) => {
					log.push(`choose: ${opts.join("/")}`);
					return picks.shift() ?? opts.length - 1;
				};
			if (k === "then") return undefined;
			return () => undefined;
		},
	});
	return { s, log };
};

/** localStorage を 試験の あいだだけ 差しかえる。 */
const swapStorage = (): { store: Map<string, string>; restore: () => void } => {
	const store = new Map<string, string>();
	const prev = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => {
				store.set(k, v);
			},
			removeItem: (k: string) => {
				store.delete(k);
			},
		},
		configurable: true,
		writable: true,
	});
	return {
		store,
		restore: () => {
			if (prev) Object.defineProperty(globalThis, "localStorage", prev);
			else delete (globalThis as { localStorage?: unknown }).localStorage;
		},
	};
};

test(
	"V1",
	"演壇：はじめては 事務局の 3窓 → 唐揚げ → 派 → 味方 → うなずく → 板 → 1窓。2回目からは お題 → 派 → 板 → 1窓。書く 保存は civic だけ",
	async () => {
		const th = must("townhall");
		const { store, restore } = swapStorage();
		forgetCivicMemo();
		// 進みの 保存は はじめて 読んだ ときに 形を 決めて 書かれる（engine/save.ts）。討論の 前の 写しと くらべる
		loadProgress();
		const before = new Map(store);
		const seen: {
			v: { topic: string; us: number; ally: string; opp: string } | null;
		} = { v: null };
		let fake: DebateResult = { outcome: "draw", jien: false };
		setDebateHook(async (topic, us, who) => {
			seen.v = { topic: topic.id, us, ally: who.ally.name, opp: who.opp.name };
			return fake;
		});
		try {
			const events = buildFacility(th, view(4), {} as Ctx).events ?? [];
			const podium = events.find((e) => e.id === "podium_0");
			ok(podium?.run, "no podium");
			const a = recorder([0]);
			await podium?.run?.(a.s);
			const lines = a.log;
			const room = th.room?.lines.podium ?? [];
			const want = [
				...room.map((l) => `narrate: ${l}`),
				...DEBATE_MSG.intro.map((l) => `say(${DEBATE_MSG.staff}): ${l}`),
				`narrate: ${DEBATE_MSG.pickSide}`,
				`choose: かける派/かけない派/${DEBATE_MSG.quit}`,
				`say(かける派の　名無し): ${DEBATE_MSG.ally}`,
				`narrate: ${DEBATE_MSG.nod}`,
				`narrate: ${OUTSIDE_TEXT.draw}`,
			];
			ok(lines.join("\n") === want.join("\n"), `first:\n${lines.join("\n")}`);
			const g1 = seen.v;
			ok(
				g1?.topic === "karaage" &&
					g1.us === 0 &&
					g1.opp === "かけない派の　名無し",
				`first board ${JSON.stringify(g1)}`,
			);
			ok(loadCivic().debate.tutored, "not tutored after the first");
			// 2回目：お題（湯温）→ 派（42℃派）→ 板 → 負けた 味方の 1窓（段4 は ジェイトルマンが まだ → 名無し）
			fake = { outcome: "lose", jien: false };
			const b = recorder([1, 1]);
			await podium?.run?.(b.s);
			ok(
				b.log.filter((l) => l.startsWith("choose")).length === 2,
				`menus ${b.log}`,
			);
			ok(
				!b.log.some((l) => DEBATE_MSG.intro.some((x) => l.includes(x))),
				"intro twice",
			);
			const after = b.log.at(-1) ?? "";
			ok(
				after === `say(42℃派の　名無し): ${NANASHI_LINES.shrug}`,
				`after: ${after}`,
			);
			const g2 = seen.v;
			ok(
				g2?.topic === "yuon" && g2.us === 1 && g2.opp === "ンゴ姉",
				`second ${JSON.stringify(g2)}`,
			);
			// やめる
			const c = recorder([TOPICS.length]);
			seen.v = null;
			await podium?.run?.(c.s);
			ok(seen.v === null, "played after quitting");
			// 書いた 保存は civic だけ（ほかの 鍵は 討論の 前の まま）
			const changed = [...store.keys()].filter(
				(k) => before.get(k) !== store.get(k),
			);
			ok(changed.join() === "kiriko-roguelike/civic", `saves ${changed}`);
			// はり紙：見分け方（一覧は DOM なので 文だけ）
			const kiben = events.find((e) => e.id === "kiben_0");
			ok(kiben, "no kiben");
		} finally {
			setDebateHook(null);
			forgetCivicMemo();
			restore();
		}
	},
);

test(
	"V2",
	"議事録：お題 × 決着の 30ページ（中身 7・良スレ 3）、試合で 号が 書かれ（自演は 中身の お題だけ）、まだの 号は 白紙。町役場・市役所・裁判所で 読める",
	async () => {
		ok(PAGES.length === 30, `pages ${PAGES.length}`);
		ok(
			new Set(PAGES.map((p) => p.key)).size === 30 &&
				PAGES.every((p, i) => p.n === i + 1),
			"page keys or numbers",
		);
		for (const t of TOPICS)
			ok(
				PAGES.filter((p) => p.topic === t.id).length ===
					(t.mode === "policy" ? 7 : 3),
				`${t.id}: pages`,
			);
		const yuon = TOPICS.find((t) => t.id === "yuon");
		const rom = TOPICS.find((t) => t.id === "rom");
		if (!yuon || !rom) throw new Fail("no topics");
		ok(
			pagesOf(yuon, "ko", true).join() === "yuon:ko,yuon:jien",
			`${pagesOf(yuon, "ko", true)}`,
		);
		ok(pagesOf(rom, "arete", true).join() === "rom:arete", "faith jien");
		ok(pagesOf(rom, "towel", false).length === 0, "faith towel is a page");
		// 1ページの 窓（白紙と 書かれた 号）
		for (const p of PAGES) {
			const blank = pageText(p.n, []);
			const done = pageText(p.n, [p.key]);
			box(`page ${p.n} blank`, blank, 22);
			box(`page ${p.n}`, done, 22);
			ngCheck(`page ${p.n}`, done);
			ok(blank.includes("白紙") && !done.includes("白紙"), `page ${p.n}`);
		}
		box(
			"minutes title",
			fillDebate(MINUTES.title, { n: "30", all: "30" }),
			22,
			1,
		);
		// 演壇の 試合で 号が 書かれる
		const { restore } = swapStorage();
		forgetCivicMemo();
		setDebateHook(async () => ({ outcome: "ko", jien: true }));
		try {
			const m = loadCivic();
			m.debate.tutored = true;
			saveCivic(m, false);
			const ch = must("cityhall");
			const events = buildFacility(ch, view(7), {} as Ctx).events ?? [];
			const r = recorder([1, 0]);
			await events.find((e) => e.id === "podium_0")?.run?.(r.s);
			ok(
				loadCivic().debate.pages.sort().join() === "yuon:jien,yuon:ko",
				`pages ${loadCivic().debate.pages}`,
			);
		} finally {
			setDebateHook(null);
			forgetCivicMemo();
			restore();
		}
		// 議事録を 読める 所
		const reads: string[] = [];
		for (const f of FACILITIES)
			for (const [k, v] of Object.entries(f.room?.plays ?? {}))
				if (v === "minutes") reads.push(`${f.id}.${k}`);
		ok(
			reads.sort().join() === "cityhall.minutes,court.cases,townhall.minutes",
			`minutes ${reads}`,
		);
	},
);

// ───────────────── 議会の 日と 人の 出入り ─────────────────

/** 部屋の 歩ける マス（人の いる マスは 通れない）と 話せるか。 */
const survey = (
	rows: readonly string[],
	tiles: Record<string, { passable?: boolean; counter?: boolean }>,
	people: readonly { x: number; y: number }[],
	start: { x: number; y: number },
) => {
	const tile = (x: number, y: number) => tiles[[...(rows[y] ?? "")][x] ?? ""];
	const occ = new Set(people.map((p) => `${p.x},${p.y}`));
	const seen = new Set<string>([`${start.x},${start.y}`]);
	const q: [number, number][] = [[start.x, start.y]];
	const D = [
		[0, -1],
		[1, 0],
		[0, 1],
		[-1, 0],
	] as const;
	while (q.length) {
		const [x, y] = q.shift() as [number, number];
		for (const [dx, dy] of D) {
			const k = `${x + dx},${y + dy}`;
			if (seen.has(k) || occ.has(k) || !tile(x + dx, y + dy)?.passable)
				continue;
			seen.add(k);
			q.push([x + dx, y + dy]);
		}
	}
	const reach = (x: number, y: number) => seen.has(`${x},${y}`);
	const talk = (x: number, y: number) =>
		D.some(
			([dx, dy]) =>
				reach(x + dx, y + dy) ||
				(!!tile(x + dx, y + dy)?.counter && reach(x + 2 * dx, y + 2 * dy)),
		);
	return { reach, talk };
};

/** 議席と 役を ぜんぶ 埋めた 顔ぶれ（越してきた 子の 中から。足りなければ ある だけ）。 */
const fullAssembly = (
	room: "townhall" | "cityhall",
	chair: boolean,
): Assembly => {
	const others = MOB_IDS.filter(
		(id) =>
			!NOT_IN_ASSEMBLY.includes(id) && !["onchan", "proto", "aru"].includes(id),
	);
	return {
		session: true,
		chair: room === "cityhall" && chair ? "onchan" : null,
		clerk: room === "cityhall" ? "proto" : null,
		camera: room === "cityhall" ? "aru" : null,
		seats: others.slice(0, SEATS[room].length),
	};
};

test(
	"C2",
	"満席：町役場（議席 3）・市役所（議席 8・役 3、名無しの 議長も）を 埋めても 物・人・演壇・窓口・出口に 届く",
	() => {
		for (const [id, stage] of [
			["townhall", 4],
			["cityhall", 7],
		] as const)
			for (const chair of [true, false]) {
				const f = must(id);
				const a = fullAssembly(id, chair);
				const evs = assemblyEvents(f, view(stage), a);
				ok(
					evs.length >= SEATS[id].length,
					`${id}: ${evs.length} assembly people`,
				);
				const rows = facilityRoomRows(f);
				const tiles = facilityRoomPalette(f);
				const staff = (f.room?.people ?? []).map((p) => ({
					id: p.id,
					x: p.at[0],
					y: p.at[1],
				}));
				const people = [
					...staff,
					...evs.map((e) => ({ id: e.id, x: e.x, y: e.y })),
				];
				ok(
					new Set(people.map((p) => `${p.x},${p.y}`)).size === people.length,
					`${id}: two people share a cell`,
				);
				for (const p of people)
					ok(
						tiles[[...rows[p.y]][p.x]]?.passable,
						`${id}: ${p.id} stands on a wall`,
					);
				const s = survey(rows, tiles, people, facilityEntry(f));
				for (const [mx, my] of facilityMats(f))
					ok(s.reach(mx, my), `${id}: the mat (${mx},${my})`);
				for (const p of facilityRoomPlaces(f))
					if (p.trigger === "talk")
						ok(
							s.talk(p.x, p.y),
							`${id} (chair ${chair}): cannot reach ${p.id}`,
						);
				for (const p of people)
					ok(
						s.talk(p.x, p.y),
						`${id} (chair ${chair}): cannot talk to ${p.id}`,
					);
				// 名無しの 議長は おんちゃんが 来ない 市役所の 議会の 日だけ
				ok(
					evs.some((e) => e.id === "asm_chair") ===
						(id === "cityhall" && !chair),
					`${id}: nanashi chair ${chair}`,
				);
				// 議会の ない 日は だれも いない
				ok(
					assemblyEvents(f, view(stage), { ...a, session: false }).length === 0,
					`${id}: people on a day off`,
				);
			}
		// 寄り合いの 立つ 所（集会所・レンガ館）は 床で、本館の 人と 重ならない
		for (const tier of [0, 1] as const) {
			const rows = hallRows(tier);
			const stage = tier === 0 ? 2 : 3;
			const places = hallPlaces(view(stage));
			for (const sp of YORIAI_SPOTS[tier]) {
				ok(
					[...rows[sp.y]][sp.x] === ".",
					`hall ${tier}: (${sp.x},${sp.y}) is not floor`,
				);
				ok(
					!places.some((p) => p.x === sp.x && p.y === sp.y),
					`hall ${tier}: (${sp.x},${sp.y}) is taken`,
				);
			}
		}
	},
);

/** 帰りの 時刻の 見本（golden の 並びと 同じ）。 */
const GOLDEN_AT = (stage: number, k: number) => k * 7919 + stage * 104729;
/**
 * 議会を 足す 前の guestsOf の 写し（段2〜7 × 帰り 12。FNV-1a の 36進）。議会の ない 日は この まま
 * （CIVIC.md §4：議会の ない 日の 顔ぶれを かえない）。
 */
const GOLDEN =
	"2bgqvi x6hzau 1g2h8jv 2bgqvi 1ray4d9 1n2bi7n 1ray4d9 1g2h8jv 1ray4d9 1ray4d9 wfwvxx 1ray4d9 1d5bhtk 1cy9ry0 bikjdx 7n4hgt ts7e8t 1ehc9pq 29lb5x 11f4x1c 1g2h8jv 1g7l9f2 10p37i5 1mul367 1bilb46 1m78g58 10ifemn s751vv av24c4 1j6pxje 2fres6 vw9sz9 ffqx95 oqf7k2 u5bwvf 4srw84 11p1c0s bxxamb 1u24i0k 1ecshjo 1j1gpkw owvufi 1tk2sr wyh5n1 fwnifh 1z10hsd 4for6h 1w5lb7i 3387x2 qjvxot 18wcw2z vnk7xg 14uci9j ojgaid 1butdqi 18omgx8 fwizji 1q5r2lt 19nry0t 1btbveu 1da8dyr j0hwd2 15bj0v3 jtk5ha 1prg5dy 1fqqj8d e8xwkc gp0vqm nycw9k 9m421p qyvd1z 14upkub".split(
		" ",
	);
const fnv = (s: string): string => {
	let h = 0x811c9dc5;
	for (const ch of s) {
		h ^= ch.charCodeAt(0);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h.toString(36);
};

test(
	"C3",
	"議会の 日：月曜は かならず・ほかは 帰りの 種で 約3割、同じ 帰りなら 同じ。議会の ない 日の 顔ぶれは もとの まま、議席と 施設に 二重に いない、原住民は 来ない、議長は おんちゃんか 名無し",
	() => {
		const day = (w: number): Today => ({ m: 10, d: 9, w });
		let n = 0;
		let on = 0;
		for (let at = 1; at <= 3000; at++) {
			ok(inSession(day(1), at * 977), `Monday ${at} is not a session`);
			// 同じ 帰りなら 同じ（曜日が ちがっても 月曜 以外は 帰りの 種だけ）
			ok(
				inSession(day(3), at * 977) === inSession(day(5), at * 977),
				"not stable",
			);
			n++;
			if (inSession(day(3), at * 977)) on++;
		}
		ok(on / n > 0.25 && on / n < 0.35, `other days ${(on / n).toFixed(3)}`);
		// 議会の ない 日の 顔ぶれ（golden）
		const v6 = (stage: number): VillageView => ({
			stage,
			unlocked: ["shallow"],
			cleared: ["shallow", "main"],
		});
		let i = 0;
		let checked = 0;
		for (const stage of [2, 3, 4, 5, 6, 7])
			for (let k = 1; k <= 12; k++, i++) {
				const at = GOLDEN_AT(stage, k);
				if (inSession(day(3), at)) continue;
				checked++;
				ok(
					fnv(JSON.stringify(guestsOf(v6(stage), at, day(3)))) === GOLDEN[i],
					`stage ${stage} at ${at}: the lineup changed on a day off`,
				);
			}
		ok(checked > 30, `golden checked ${checked}`);
		// 議会の 日：二重に いない・原住民なし・議長は おんちゃんか 名無し・席の 数まで
		for (const stage of [2, 3, 4, 5, 6, 7])
			for (let at = 1; at <= 400; at++) {
				const v: VillageView = {
					stage,
					unlocked: ["shallow"],
					cleared: ["shallow", "main", "deep", "opunu"],
				};
				const a = assemblyToday(v, at * 131, day(1));
				const room =
					stage >= 7 ? "cityhall" : stage >= 4 ? "townhall" : "yoriai";
				ok(a.session, `stage ${stage}: Monday without a session`);
				const members = assemblyMembers(a);
				ok(
					!members.includes("shobon"),
					`stage ${stage}: shobon in the assembly`,
				);
				ok(new Set(members).size === members.length, "a member twice");
				ok(a.chair === null || a.chair === "onchan", `chair ${a.chair}`);
				if (room === "yoriai")
					ok(
						a.seats.length >= 1 && a.seats.length <= 2 && !a.chair,
						`yoriai ${a.seats}`,
					);
				else
					ok(
						a.seats.length <= SEATS[room].length,
						`${room}: ${a.seats.length} seats`,
					);
				if (room !== "cityhall")
					ok(!a.chair && !a.clerk && !a.camera, `${room}: roles`);
				const g = guestsOf(v, at * 131, day(1));
				for (const id of members)
					ok(
						!g.music.includes(id) &&
							!g.books.includes(id) &&
							!g.bath.includes(id),
						`stage ${stage}: ${id} is also in a room`,
					);
				ok(
					!members.includes(g.stage as MobId),
					"the singer is in the assembly",
				);
			}
		// 段1 は 議会なし
		ok(!assemblyToday(view(1), 5, day(1)).session, "a session at stage 1");
	},
);

test(
	"V3",
	"まとめ掲示板：段2〜3 は 寄り合いの はり紙（はじめてだけ 前置き → 議題 → 結果）、段4 から 議会だより。段4〜5 の 告知に 町役場へ うつった はり紙",
	async () => {
		ok(civicBoardMenu(1) === null, "stage 1 menu");
		ok(civicBoardMenu(2) === CIVIC_BOARD.yoriaiMenu, "stage 2 menu");
		ok(civicBoardMenu(3) === CIVIC_BOARD.yoriaiMenu, "stage 3 menu");
		ok(civicBoardMenu(4) === CIVIC_BOARD.dayoriMenu, "stage 4 menu");
		ok(civicBoardMenu(7) === CIVIC_BOARD.dayoriMenu, "stage 7 menu");
		const { store, restore } = swapStorage();
		forgetCivicMemo();
		try {
			const a = recorder();
			await civicBoardScript(a.s, 2, 1234);
			const ag = agendaOf(2, 1234);
			ok(
				a.log.join("\n") ===
					[CIVIC_BOARD.soukai, ag.notice, ag.result]
						.map((t) => `narrate: ${t}`)
						.join("\n"),
				`first:\n${a.log.join("\n")}`,
			);
			const b = recorder();
			await civicBoardScript(b.s, 3, 1234);
			ok(b.log.length === 2, `second: ${b.log}`);
			const c = recorder();
			await civicBoardScript(c.s, 5, 99);
			ok(
				c.log.length === 1 && c.log[0].startsWith("narrate: 議会だより。"),
				`dayori ${c.log}`,
			);
			ok([...store.keys()].join() === "kiriko-roguelike/civic", "saves");
			// 議題は 段3 から 屋根の 色も
			const seen2 = new Set<string>();
			const seen3 = new Set<string>();
			for (let at = 0; at < 200; at++) {
				seen2.add(agendaOf(2, at).id);
				seen3.add(agendaOf(3, at).id);
			}
			ok([...seen2].sort().join() === "isu,karaage", `stage 2 ${[...seen2]}`);
			ok([...seen3].length === 3, `stage 3 ${[...seen3]}`);
		} finally {
			forgetCivicMemo();
			restore();
		}
		ok(yoriaiMovedLine(3) === null && yoriaiMovedLine(6) === null, "moved");
		ok(
			yoriaiMovedLine(4) === CIVIC_BOARD.moved &&
				yoriaiMovedLine(5) === CIVIC_BOARD.moved,
			"moved 4-5",
		);
	},
);

test(
	"W4",
	"議会の 日・寄り合い・議会だよりの 文：村の 窓（22字 × 2行）に 収まり、使わない 語なし",
	() => {
		const texts: [string, string][] = [
			...Object.entries(ASSEMBLY_LINES).map(([k, t]): [string, string] => [
				`assembly.${k}`,
				t ?? "",
			]),
			["nanashi chair", NANASHI_CHAIR.line],
			...AGENDA.flatMap((a): [string, string][] => [
				[`agenda.${a.id}`, a.notice],
				[`agenda.${a.id} result`, a.result],
			]),
			...DAYORI.map((d): [string, string] => [
				`dayori ${d.title}`,
				fill(CIVIC_BOARD.dayori, { ...d }),
			]),
			["soukai", CIVIC_BOARD.soukai],
			["moved", CIVIC_BOARD.moved],
		];
		for (const [w, t] of texts) {
			box(w, t, 22);
			ngCheck(w, t);
		}
		ok(!("shobon" in ASSEMBLY_LINES), "shobon has an assembly line");
		for (const m of [CIVIC_BOARD.yoriaiMenu, CIVIC_BOARD.dayoriMenu])
			ok(width(m) <= 10, `menu ${m}`);
	},
);

export const runCivicTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: `civic ${c.id}`, name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: `civic ${c.id}`,
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			});
		}
	}
	return out;
};
