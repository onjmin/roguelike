// キリコの 家の パソコンの「ネット」の ページを ぜんぶ 作る（ui/net/net.ts が 開く。試験は src/sim/arcadeHome/net.ts）。
// - 板一覧 → スレ一覧（レスの 数・勢い・沈んだ スレは「過去ログ」）→ スレ。ほかに まとめ・2ch語辞典・町の 新聞・天気。
// - 並ぶ スレは 帰りの 数（env.seed）で 入れかわる（同じ 帰りなら いつも 同じ）。前の 帰りの スレは 過去ログに 沈む。
// - 中身の 出どころ：手で 書いた スレ（data/net/threads.ts）・マイクラの 文（data/saba/sabaText.ts）・
//   過去ログの世紀の 群衆と 語り（data/jikkyo/kakolog.ts）・ことばの 辞典（data/story/glossary.ts）・
//   町の お知らせ（data/village/news.ts）。本物の ネットには つながない。DOM も 保存も 使わない。

import {
	KAKOLOG_POOLS,
	KAKOLOG_SOKKI,
	KAKOLOG_THREAD,
} from "../jikkyo/kakolog";
import { DENY_WORD, fnv1a, ID_CHARS, mix32 } from "../neta/id";
import { SABA_TEXT } from "../saba/sabaText";
import { GLOSSARY, LIBRARY_FROM, TIER_FROM } from "../story/glossary";
import { seasonOf } from "../town/calendar";
import { FACILITIES } from "../village/facilities";
import { newsLine, townNews } from "../village/news";
import { ABE_PORTRAIT, PORTRAIT_PALETTE } from "./abePortrait";
import { BOARDS, type BoardId, THREADS, type ThreadDef } from "./threads";
import type { NetEnv, Node, Page, PageKind, Post, Site, Span } from "./types";

export const NET_HOME = "http://onj.2ch.local/";
export const MATOME = "http://matome.onj.local/";
export const DIC = "http://dic.onj.local/";
export const NEWS = "http://news.onj.local/";
export const TENKI = "http://tenki.onj.local/";

/** 画面に 出さない 言葉（試験と、ID・数の 引きなおしに 使う）。 */
export const NET_BANNED =
	/落ちる|落ちた|落ちない|黄色|きいろ|山吹|114514|1919|810|うんこ|うんち|オセロ|ガイジ|アスペ|チー牛|原カス|淫夢/;
/** 絵文字（スレタイの ★ は 字なので よい）。 */
export const NET_EMOJI = /\p{Emoji_Presentation}|️/u;

const WDAY = ["日", "月", "火", "水", "木", "金", "土"];

/** 種つきの 乱数。 */
const rng = (seed: number): (() => number) => {
	let s = seed >>> 0 || 1;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return mix32(s) / 2 ** 32;
	};
};

/** 出さない 数を よける（1つずつ 足す）。 */
const safeNum = (n: number): number => {
	let x = n;
	while (NET_BANNED.test(String(x))) x++;
	return x;
};

const pad = (n: number, w = 2): string => String(n).padStart(w, "0");

const dateLine = (ms: number): string => {
	const t = new Date(ms);
	return `${t.getUTCFullYear()}/${pad(t.getUTCMonth() + 1)}/${pad(t.getUTCDate())}(${WDAY[t.getUTCDay()]}) ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}.${pad(Math.floor((ms % 1000) / 10))}`;
};

/** 書きこみの ID（8字。同じ 種なら いつも 同じ。出さない 言葉が 出たら 塩を かえる）。 */
const postId = (seed: string): string => {
	for (let salt = 0; salt < 64; salt++) {
		let h = fnv1a(`${seed}:${salt}`);
		let s = "";
		for (let i = 0; i < 8; i++) {
			h = mix32(h + i);
			s += ID_CHARS[h % ID_CHARS.length];
		}
		if (!DENY_WORD.test(s) && !NET_BANNED.test(s)) return s;
	}
	return "ROMsenyo";
};

/** 本文の 1行を 安価・リンク・字に 切る（anchors が false なら 安価は ただの 字：辞典の「>>123」など）。 */
export const parseLine = (line: string, anchors = true): Span[] => {
	const out: Span[] = [];
	for (const part of line.split(/(>>\d+|http:\/\/[^\s　]+)/)) {
		if (!part) continue;
		if (part.startsWith(">>") && anchors)
			out.push({ s: part, anchor: Number(part.slice(2)) });
		else if (part.startsWith("http://")) out.push({ s: part, href: part });
		else out.push({ s: part });
	}
	return out;
};

const p = (text: string, small?: true): Node => ({
	t: "p",
	spans: parseLine(text, false),
	...(small ? { small } : {}),
});
const h = (text: string): Node => ({ t: "h", text });
const link = (
	href: string,
	text: string,
	note?: string,
	kako?: true,
): Node => ({
	t: "link",
	href,
	text,
	...(note ? { note } : {}),
	...(kako ? { kako } : {}),
});
const page = (
	url: string,
	title: string,
	kind: PageKind,
	nodes: Node[],
): Page => ({
	url,
	title,
	kind,
	nodes,
});

// ── その 日だけの スレ（帰りの 数・時刻・ほかの 文から 作る） ──

const hourThread = (hour: number): ThreadDef => {
	const [title, posts] =
		hour < 5
			? [
					"深夜やけど　起きとる　やつ　おる？",
					["@眠れん", "おるで", "ワイも", ">>1　はよ　寝ろ", "@>>4　せやな"],
				]
			: hour < 11
				? [
						"朝やで",
						[
							"@おはよう",
							"おはよう",
							"朝飯　なに　食べた",
							">>3　パン",
							"@>>4　パン置き場の　やつか",
						],
					]
				: hour < 18
					? [
							"昼の　おんJ　ゆるすぎ",
							[
								"@だれも　おらん",
								"おるで",
								">>2　おったんか",
								"昼寝　したい",
								"@>>4　わかる",
							],
						]
					: [
							"【雑談】夜の　おんJ",
							[
								"@今日も　おつかれ",
								"おつかれ",
								"晩飯　なに",
								">>3　芋煮",
								"@>>4　ええな",
							],
						];
	return {
		key: `hour${Math.floor(hour / 6)}`,
		board: "livejupiter",
		title,
		posts,
	};
};

const kitakuThread = (seed: number): ThreadDef => ({
	key: "kitaku",
	board: "livejupiter",
	title: NET_BANNED.test(String(seed))
		? "キリコ　また　帰宅　記念スレ"
		: `キリコ　帰宅　${seed}回目　記念スレ`,
	posts: [
		"@また　帰ってきたで",
		"数えとる　やつ　おるんか",
		">>2　メインさんが　数えとる",
		"おかえり",
		"@>>4　おかえり",
	],
});

/** マイクラの スレ（>>1 の 決まり・鯖缶の お知らせ・土曜の 鯖イベ・湧き潰しの 小言）。 */
const sabaThreads = (env: NetEnv): ThreadDef[] => {
	const notices = SABA_TEXT.notices.filter((n) => n.from <= env.stage);
	const pick = (i: number) =>
		notices[(env.seed + i) % notices.length]?.text ?? "";
	const week = Math.floor(
		Date.UTC(env.year, env.m - 1, env.d) / (7 * 86400000),
	);
	const event = SABA_TEXT.events[week % SABA_TEXT.events.length];
	const part = safeNum(40 + env.seed);
	const out: ThreadDef[] = [
		{
			key: "saba",
			board: "mcj",
			title: `おんJで　マイクラやろうや　Part${part}`,
			posts: [
				// >>1 の 決まり（この スレの >>1 なので 頭の「【>>1】」は はずす）
				...SABA_TEXT.rules.map((r) => `@${r.replace(/^【>>1】　/, "")}`),
				"oepn　で　入れたで",
				"@>>4　サンガツ",
				`@${pick(0)}`,
				`@${SABA_TEXT.saturday.replace("{event}", event)}`,
				SABA_TEXT.nag.replace("{n}", String(safeNum(36 + env.seed))),
				"@>>8　すまん",
			],
		},
		{
			key: "seichi",
			board: "mcj",
			title: "整地スレ　その2",
			from: 3,
			posts: [
				"@整地　ヨシ！",
				"……いや、　あそこ　1マス　でっぱっとる",
				"@>>2　直さん",
				"土が　足りん。\n……あの　山　崩せば　ええやん",
				...(env.stage >= 6
					? ["@整地　してたら　1日　終わった。\n……家は　また　豆腐や"]
					: []),
			],
		},
		{
			key: "tofu",
			board: "mcj",
			title: "家が　豆腐に　なる　やつ　集まれ",
			posts: [
				"@白い　四角い　家　しか　建てられん",
				"豆腐ハウスは　様式美や",
				">>2　窓は　つけろ",
				"@>>3　つけたで。\n……海が　四角く　見える",
				`@${pick(1)}`,
			],
		},
	];
	if (env.stage >= 6)
		out.push({
			key: "tower",
			board: "mcj",
			title: "トラップタワー　だれが　作ったんや",
			posts: [
				"@朝　起きたら　建っとった",
				SABA_TEXT.joukyu[0],
				">>2　だれや",
				"@>>2　ほな　ちゃうねん",
			],
		});
	return out;
};

/** 過去ログの世紀の 再放送の 実況スレ（群衆の 文と 語りを そのまま）。 */
const kakologThread = (env: NetEnv): ThreadDef => {
	const at = (xs: readonly string[], i: number) =>
		xs[(env.seed + i) % xs.length];
	return {
		key: "kakolog",
		board: "jikkyo",
		title: KAKOLOG_THREAD.rerun.replace(
			"{n}",
			String(safeNum(10 + (env.seed % 20))),
		),
		posts: [
			`@${at(KAKOLOG_POOLS.wait, 0)}`,
			at(KAKOLOG_POOLS.wait, 3),
			at(KAKOLOG_POOLS.op, 1),
			KAKOLOG_SOKKI.hajime,
			at(KAKOLOG_POOLS.hajime, 2),
			at(KAKOLOG_POOLS.hajime, 5),
			KAKOLOG_SOKKI.chiru,
			KAKOLOG_SOKKI.after,
			KAKOLOG_THREAD.crossFresh,
			`@${KAKOLOG_THREAD.thanks}`,
		],
	};
};

// ── 並べる ──

type Shown = {
	def: ThreadDef;
	url: string;
	posts: Post[];
	kako: boolean;
	ikioi: number;
};

const boardUrl = (b: BoardId) => `${NET_HOME}${b}/`;

const builtAt = (need: string | undefined): number =>
	need === undefined ? 0 : (FACILITIES.find((f) => f.id === need)?.from ?? 99);

const opens = (env: NetEnv, t: ThreadDef): boolean =>
	(t.from ?? 0) <= env.stage && builtAt(t.need) <= env.stage;

/** 帰り seed に 並ぶ スレ（入れかわる ぶん）。 */
const dayPick = (
	pool: readonly ThreadDef[],
	board: BoardId,
	seed: number,
	n: number,
): ThreadDef[] => {
	const r = rng(fnv1a(`${board}:${seed}`));
	const xs = [...pool];
	for (let i = xs.length - 1; i > 0; i--) {
		const j = Math.floor(r() * (i + 1));
		[xs[i], xs[j]] = [xs[j], xs[i]];
	}
	return xs.slice(0, n);
};

const makeThread = (
	env: NetEnv,
	def: ThreadDef,
	kako: boolean,
	used: Set<number>,
): Shown => {
	const board = BOARDS.find((b) => b.id === def.board) ?? BOARDS[0];
	const r = rng(fnv1a(`${def.board}:${def.key}:${env.seed}:${kako ? 1 : 0}`));
	const now =
		Date.UTC(env.year, env.m - 1, env.d, env.hour) +
		((env.seed * 7) % 60) * 60000;
	const age = kako ? 86400 * (2 + r() * 5) : 600 + r() * 30000;
	let dat = safeNum(Math.floor(now / 1000 - age));
	while (used.has(dat)) dat = safeNum(dat + 1);
	used.add(dat);
	const step = (age * 1000) / (def.posts.length + 1);
	const opId = postId(`${def.key}:${dat}:op`);
	let t = dat * 1000;
	const posts = def.posts.map((raw, i): Post => {
		const op = raw.startsWith("@");
		const body = op ? raw.slice(1) : raw;
		if (i > 0) t += Math.floor(step * (0.2 + r() * 1.2));
		return {
			no: i + 1,
			name: board.nanashi,
			date: dateLine(t + Math.floor(r() * 1000)),
			id: i === 0 || op ? opId : postId(`${def.key}:${dat}:${i}`),
			lines: body.split("\n").map((l) => parseLine(l)),
		};
	});
	return {
		def,
		url: `${NET_HOME}test/read.cgi/${def.board}/${dat}/`,
		posts,
		kako,
		ikioi: safeNum(Math.max(1, Math.round((def.posts.length * 86400) / age))),
	};
};

const threadPage = (s: Shown): Page => {
	const board = BOARDS.find((b) => b.id === s.def.board) ?? BOARDS[0];
	return page(s.url, s.def.title, "thread", [
		p(
			s.kako
				? "このスレッドは　過去ログ倉庫に　沈んでいます。　書きこみは　できません。"
				: "見るだけの　ネット（書きこみは　できません）。",
			true,
		),
		h(`${s.def.title}（${s.posts.length}）`),
		...s.posts.map((post): Node => ({ t: "post", post })),
		{ t: "hr" },
		link(boardUrl(board.id), `${board.title}に　もどる`),
		link(NET_HOME, "板一覧"),
	]);
};

// ── ほかの サイト ──

const matomePages = (top: readonly Shown[]): Page[] => {
	const art = (s: Shown) => `${MATOME}archives/${s.url.split("/").at(-2)}.html`;
	const pages = top.map((s) =>
		page(art(s), s.def.title, "matome", [
			h(s.def.title),
			p(`カテゴリ：おんJ　　コメント（0）`, true),
			...s.posts.map((post): Node => ({ t: "post", post })),
			{ t: "hr" },
			link(s.url, "元スレ"),
			link(MATOME, "まとめの　トップへ"),
		]),
	);
	pages.unshift(
		page(MATOME, "ほしゅ速報", "matome", [
			h("ほしゅ速報"),
			p("おんJタウンの　スレを　まとめる　ブログ（管理人も　おんJ民）。", true),
			h("新着の　記事"),
			...top.map((s) => link(art(s), s.def.title, `${s.posts.length}レス`)),
			{ t: "hr" },
			link(NET_HOME, "おんJへ　行く"),
		]),
	);
	return pages;
};

const TIER_NAME = ["基本の　ことば", "板の　ことば", "深い　ネタ"];

const dicPages = (env: NetEnv): Page[] => {
	const words = GLOSSARY.filter(
		(w) => !w.secret && !w.board && TIER_FROM[w.tier] <= env.stage,
	);
	const url = (id: string) => `${DIC}word/${id}.html`;
	const index: Node[] = [
		h("2ch語辞典"),
		p(
			"おんJの　ことばを　あつめた　辞典。　町が　育つと　ページが　ふえる。",
			true,
		),
	];
	for (const tier of [0, 1, 2] as const) {
		const here = words.filter((w) => w.tier === tier);
		if (!here.length) continue;
		index.push(h(TIER_NAME[tier]), ...here.map((w) => link(url(w.id), w.word)));
	}
	if (env.stage < LIBRARY_FROM)
		index.push(p("……つづきは　図書館が　建ってから。", true));
	index.push({ t: "hr" }, link(NET_HOME, "おんJへ　行く"));
	return [
		page(DIC, "2ch語辞典", "dic", index),
		...words.map((w) =>
			page(url(w.id), `${w.word} - 2ch語辞典`, "dic", [
				h(w.word),
				...w.desc.split("\n\n").map((para) => p(para.replace(/\n/g, ""))),
				{ t: "hr" },
				link(DIC, "辞典の　目次"),
			]),
		),
	];
};

const newsPage = (env: NetEnv, top: Shown | undefined): Page => {
	const nodes: Node[] = [
		h("おんJタウン　新聞"),
		p(`${env.m}月${env.d}日（${WDAY[env.w]}）　町の　段　${env.stage}`, true),
	];
	if (top)
		nodes.push(
			h("今日の　話題"),
			link(top.url, top.def.title, `勢い　${top.ikioi}`),
		);
	nodes.push(h("町に　建った　もの"));
	const news = townNews(0, env.stage);
	if (!news.length)
		nodes.push(p("まだ　なにも　建っていない。　……これから　です。"));
	for (const area of [...new Set(news.map((n) => n.area))]) {
		nodes.push(p(`【${area}】`));
		for (const n of news.filter((x) => x.area === area))
			nodes.push(p(newsLine(n)));
	}
	nodes.push(
		{ t: "hr" },
		link(TENKI, "天気を　見る"),
		link(NET_HOME, "おんJへ　行く"),
	);
	return page(NEWS, "おんJタウン　新聞", "news", nodes);
};

const SKY = [
	"晴れ",
	"晴れ",
	"くもり",
	"晴れ　のち　くもり",
	"くもり　ときどき　雨",
	"雨",
] as const;
/** 月ごとの 最高気温の めやす（1月〜12月）。 */
const TEMP = [9, 10, 14, 19, 24, 27, 31, 32, 28, 22, 17, 12];
const SEASON_LINE: Record<string, string> = {
	newyear: "お正月。　神社は　初詣の　人で　にぎわう　でしょう。",
	valentine: "バレンタイン。　……町は　いつもどおり　でしょう。",
	april: "エイプリルフール。　この　予報も　うそ　かも　しれません。",
	tanabata: "七夕。　夜は　天の川が　見える　でしょう。",
	halloween: "ハロウィン。　夜は　仮装の　人で　にぎわう　でしょう。",
	xmas: "クリスマス。　広場が　あかるく　なる　でしょう。",
	omisoka: "大晦日。　年越しの　実況スレが　伸びる　でしょう。",
};

const tenkiPage = (env: NetEnv): Page => {
	const nodes: Node[] = [
		h("おんJタウンの　天気"),
		p("町の　中だけの　予報です（当たらなくても　怒らないで）。", true),
	];
	const base = Date.UTC(env.year, env.m - 1, env.d);
	for (let i = 0; i < 3; i++) {
		const t = new Date(base + i * 86400000);
		const m = t.getUTCMonth() + 1;
		const d = t.getUTCDate();
		const r = rng(fnv1a(`tenki:${t.getUTCFullYear()}:${m}:${d}`));
		let sky: string = SKY[Math.floor(r() * SKY.length)];
		if ((m === 12 || m <= 2) && sky === "雨") sky = "雪";
		const hi = TEMP[m - 1] + Math.floor(r() * 5) - 2;
		const rain =
			sky.includes("雨") || sky === "雪"
				? 60 + Math.floor(r() * 4) * 10
				: Math.floor(r() * 4) * 10;
		nodes.push(
			h(
				`${["今日", "明日", "あさって"][i]}　　${m}月${d}日（${WDAY[t.getUTCDay()]}）`,
			),
			p(`${sky}　　最高　${hi}度　　最低　${hi - 7}度　　降水確率　${rain}％`),
		);
		const s = seasonOf(m, d);
		if (s && SEASON_LINE[s]) nodes.push(p(SEASON_LINE[s], true));
	}
	nodes.push(
		p(
			env.hour >= 18 || env.hour < 5
				? "夜の　ひとこと：釣り場は　夜も　あいて　います。"
				: "昼の　ひとこと：グラウンドは　やきうが　使って　います。",
			true,
		),
		{ t: "hr" },
		link(NEWS, "新聞を　見る"),
		link(NET_HOME, "おんJへ　行く"),
	);
	return page(TENKI, "おんJタウンの　天気", "tenki", nodes);
};

// ── お気に入り：とても 軽い ことで 知られる 90年代の ホームページの 見た目の パロディ ──
// 実在の 人の 名前を 出すのは この ページの 題だけ（作者の 指示。試験 src/sim/arcadeHome/net.ts が 見る）。
// 本人の ことば・日記・経歴は 作らない（目次は どれも「準備中」へ）。写真の かわりに 敬意を こめた 小さな ドット絵
// （data/net/abePortrait.ts。作者の 指示。絵の ファイルは 使わない）。
// 落ちは 表示の 速さ（下の 帯が「0.01秒で　表示されました」）。

export const ABE = "http://abe.onj.local/";
const ABE_JUNBI = `${ABE}junbi.html`;
export const ABE_TITLE = "阿部寛のホームページ";
const ABE_FAST = "0.01秒で　表示されました";
const ABE_MENU = [
	"プロフィール",
	"写真集",
	"ドラマ",
	"映画",
	"CM",
	"舞台",
	"書籍",
	"リンク",
];

const abePages = (): Page[] => [
	{
		...page(ABE, ABE_TITLE, "abe", [
			h(ABE_TITLE),
			{
				t: "photo",
				text: "写真",
				pixels: ABE_PORTRAIT,
				palette: PORTRAIT_PALETTE,
			},
			{
				t: "grid",
				items: ABE_MENU.map((text) => ({ href: ABE_JUNBI, text })),
			},
			{ t: "hr" },
			link(ABE_JUNBI, "更新履歴"),
			p("この　ページは　町の　ネットの　中だけの　パロディです。", true),
			link(NET_HOME, "おんJへ　もどる"),
		]),
		status: ABE_FAST,
	},
	{
		...page(ABE_JUNBI, "ただいま　準備中です", "abe", [
			h("ただいま　準備中です"),
			p("この　ページは　まだ　ありません。"),
			{ t: "hr" },
			link(ABE, "トップへ　もどる"),
			link(NET_HOME, "おんJへ　もどる"),
		]),
		status: ABE_FAST,
	},
];

/** 見つからない ページ（試験で 出ないことを 見る。ui は 念のため これを 出す）。 */
export const notFound = (url: string): Page =>
	tightPage(
		page(url, "404 Not Found", "none", [
			h("404 Not Found"),
			p("ページが　見つかりません。　……沈んだ　かも　しれません。"),
			link(NET_HOME, "おんJへ　もどる"),
		]),
	);

/**
 * ネットの 字は 詰めて 書く（2026-10-16 作者：「おんJブラウザで 見れる 文章は いちいち スペースを 挟まなくて いい」）。
 * 文は ゲームの 窓と 同じ 分かち書きで 書いて おき（マイクラの 文など 窓と 同じ 物も ある）、ページに 出す ときに
 * 全角の あきを 消す。英数どうしの あいだは 半角の あき、2つ 続く あき（天気の 欄の 区切り）は 1つ 残す。
 */
export const tight = (s: string): string =>
	s
		.replace(/([!-~])　(?=[!-~])/g, "$1 ")
		.replace(/　+/g, (m) => (m.length >= 2 ? "　" : ""));

/**
 * 行頭の 安価・リンクの すぐ あとの あきは 半角で 残す（「>>1 はよ寝ろ」）。文の 途中の 安価は 詰める（「>>1の辞典」）。
 */
const tightSpans = (xs: readonly Span[]): Span[] =>
	xs.map((x, i) => {
		const head = xs.slice(0, i);
		const after =
			i > 0 && head.every((y) => "anchor" in y || "href" in y || !y.s.trim());
		const s = after && x.s.startsWith("　") ? ` ${x.s.slice(1)}` : x.s;
		return { ...x, s: tight(s) };
	});

const tightNode = (n: Node): Node => {
	if (n.t === "h") return { ...n, text: tight(n.text) };
	if (n.t === "p") return { ...n, spans: tightSpans(n.spans) };
	if (n.t === "link")
		return {
			...n,
			text: tight(n.text),
			...(n.note ? { note: tight(n.note) } : {}),
		};
	if (n.t === "grid")
		return { ...n, items: n.items.map((x) => ({ ...x, text: tight(x.text) })) };
	if (n.t === "post")
		return {
			...n,
			post: {
				...n.post,
				name: tight(n.post.name),
				lines: n.post.lines.map(tightSpans),
			},
		};
	return n;
};

const tightPage = (pg: Page): Page => ({
	...pg,
	title: tight(pg.title),
	...(pg.status ? { status: tight(pg.status) } : {}),
	nodes: pg.nodes.map(tightNode),
});

/** ぜんぶの ページ（同じ env なら いつも 同じ）。 */
export const buildSite = (env: NetEnv): Site => {
	const pages = new Map<string, Page>();
	const add = (pg: Page) => pages.set(pg.url, tightPage(pg));
	const used = new Set<number>();
	const boards = BOARDS.filter((b) => b.from <= env.stage);
	const pinned: ThreadDef[] = [
		...(env.seed > 0 ? [kitakuThread(env.seed)] : []),
		hourThread(env.hour),
		...(env.stage >= 2 ? sabaThreads(env) : []),
		...(env.stage >= LIBRARY_FROM ? [kakologThread(env)] : []),
	].filter((t) => opens(env, t));
	let hot: Shown[] = [];
	for (const b of boards) {
		const pool = THREADS.filter((t) => t.board === b.id && opens(env, t));
		const pin = pinned.filter((t) => t.board === b.id);
		const n = Math.max(0, b.live - pin.length);
		const live = dayPick(pool, b.id, env.seed, n);
		const kakoDefs = dayPick(pool, b.id, env.seed - 1, b.live)
			.filter((t) => !live.includes(t))
			.slice(0, 4);
		const shownLive = [
			...pin.map((t) => makeThread(env, t, false, used)),
			...live
				.map((t) => makeThread(env, t, false, used))
				.sort((x, y) => y.ikioi - x.ikioi),
		];
		const shownKako = kakoDefs.map((t) => makeThread(env, t, true, used));
		for (const s of [...shownLive, ...shownKako]) add(threadPage(s));
		if (b.id === "livejupiter")
			hot = [...shownLive].sort((x, y) => y.ikioi - x.ikioi).slice(0, 4);
		const nodes: Node[] = [
			h(b.title),
			p(b.head, true),
			...shownLive.map((s, i) =>
				link(
					s.url,
					`${i + 1}: ${s.def.title}（${s.posts.length}）`,
					`勢い　${s.ikioi}`,
				),
			),
		];
		if (shownKako.length)
			nodes.push(
				{ t: "hr" },
				h("過去ログ"),
				...shownKako.map((s) =>
					link(s.url, `${s.def.title}（${s.posts.length}）`, "過去ログ", true),
				),
			);
		nodes.push({ t: "hr" }, link(NET_HOME, "板一覧に　もどる"));
		add(page(boardUrl(b.id), b.title, "board", nodes));
	}
	for (const pg of [
		...matomePages(hot),
		...dicPages(env),
		newsPage(env, hot[0]),
		tenkiPage(env),
		...abePages(),
	])
		add(pg);
	add(
		page(NET_HOME, "おんJ　掲示板", "portal", [
			h("板一覧"),
			...boards.map((b) => link(boardUrl(b.id), b.title)),
			h("ほかの　サイト"),
			link(MATOME, "ほしゅ速報（まとめ）"),
			link(DIC, "2ch語辞典"),
			link(NEWS, "おんJタウン　新聞"),
			link(TENKI, "おんJタウンの　天気"),
			h("お気に入り"),
			link(ABE, ABE_TITLE),
			{ t: "hr" },
			p("このパソコンは　町の　中の　ネットだけに　つながっています。", true),
		]),
	);
	return { home: NET_HOME, pages };
};

/** ページに 出る 字（試験用）。 */
export const pageText = (pg: Page): string[] => {
	const out = [pg.url, pg.title, pg.status ?? ""];
	const spans = (xs: readonly Span[]) => xs.map((x) => x.s).join("");
	for (const n of pg.nodes) {
		if (n.t === "h") out.push(n.text);
		else if (n.t === "p") out.push(spans(n.spans));
		else if (n.t === "link") out.push(n.text, n.note ?? "", n.href);
		else if (n.t === "post")
			out.push(
				`${n.post.no} ${n.post.name} ${n.post.date} ID:${n.post.id}`,
				...n.post.lines.map(spans),
			);
		else if (n.t === "grid")
			out.push(...n.items.flatMap((x) => [x.text, x.href]));
		else if (n.t === "photo") out.push(n.text);
	}
	return out;
};
