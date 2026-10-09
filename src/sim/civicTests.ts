// 町の 役所と 議会の 試験（pnpm test で いっしょに 動く。CIVIC.md §6・ENGINE.md §7.9）。
// C 節：施設の 置き場所（三権の 並び）。T 節：討論会の 採点と 試合（data/debate.ts）。W 節：文の 幅と 使わない 語。
// V 節：村の 入口（ui/debate.ts。板は 差しかえ）と 保存。
// 形は jikkyoTests と 同じ（Fail・ok・{ id, name, ok, reason }）。id の 頭は 節の 字。

import { Rng } from "../core/rng";
import { TOWN_STAGES } from "../core/town";
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
	NANASHI_LINES,
	type Nameless,
	OUTSIDE_TEXT,
	type Outcome,
	PAGE,
	POSTS,
	type PolicySide,
	type PostKind,
	playDebateSim,
	type Rand,
	TOPICS,
	type Topic,
	VERDICT,
} from "../data/debate";
import {
	FACILITIES,
	type Facility,
	facilitiesAt,
	facilityBlock,
	facilityById,
	facilityDoor,
	facilityOutside,
} from "../data/village/facilities";
import type { VillageView } from "../data/village/map";
import type { Story } from "../engine/defs";
import type { Ctx } from "../ui/ctx";
import {
	type DebateResult,
	forgetCivicMemo,
	loadCivic,
	setDebateHook,
} from "../ui/debate";
import { buildFacility } from "../ui/facilities";
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
	"三権の 並び：段4〜6 の 町役場は ほかの 施設と 重ならず、扉は 東の 大通りの 北の 突きあたり (66,7)、裁判所と となり あう",
	() => {
		const th = must("townhall");
		ok(
			th.from === 4 && th.until === 7,
			`townhall stages ${th.from}〜${th.until}`,
		);
		const d = facilityDoor(th);
		ok(d?.[0] === 66 && d[1] === 7, `townhall door ${d}`);
		const o = facilityOutside(th);
		ok(o.x === 66 && o.y === 8, `townhall outside ${o.x},${o.y}`);
		for (let stage = 0; stage < TOWN_STAGES; stage++) {
			const up = facilitiesAt(stage);
			ok(
				up.includes(th) === (stage >= 4 && stage < 7),
				`stage ${stage}: townhall up ${up.includes(th)}`,
			);
			if (!up.includes(th)) continue;
			const mine = cellsOf(th);
			for (const f of up) {
				if (f === th) continue;
				for (const c of cellsOf(f))
					ok(
						!mine.has(c),
						`stage ${stage}: ${f.id} overlaps the townhall at ${c}`,
					);
				for (const [x0, y, line, until] of f.clear ?? []) {
					if (until !== undefined && stage >= until) continue;
					for (let dx = 0; dx < [...line].length; dx++)
						ok(
							!mine.has(`${x0 + dx},${y}`),
							`stage ${stage}: ${f.id} clears ground under the townhall`,
						);
				}
			}
		}
		// 裁判所（段7、x53〜62）の すぐ 東
		const court = must("court");
		const courtRight = Math.max(
			...[...cellsOf(court)].map((c) => Number(c.split(",")[0])),
		);
		ok(
			courtRight + 1 === th.at[0],
			`court ends at ${courtRight}, townhall at ${th.at[0]}`,
		);
		// 施設は FACILITIES の いちばん うしろ（外観の 字を ずらさない）
		ok(
			FACILITIES.indexOf(th) > FACILITIES.findIndex((f) => f.id === "chuka"),
			"townhall is not after the eateries",
		);
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
		for (const f of FACILITIES.filter((x) => ["townhall"].includes(x.id))) {
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
			// 書いた 保存は civic だけ
			ok(
				[...store.keys()].join() === "kiriko-roguelike/civic",
				`saves ${[...store.keys()]}`,
			);
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
