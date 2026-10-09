// おんJ芋煮会（10月。まとめ掲示板の「中止の お知らせ」と 年に 1回の「強行開催」。STORY.md §5.75 季節の 行事）。
// 元ネタ（おんJwiki pages/595 ほか。はり紙の 返事は みな >>1 への 返事に した）：
// - 「おんj芋煮会中止のお知らせ」（2026/10/8 hayabusa livejupiter/1791448903）：>>1「なんかダルいので中止です」・>>3「金返せー！」・
//   >>7 主「寒いので中止予定です」・>>8「芋煮食べて暖まるんやで」・>>9「せっかく牛肉4kg確保したのに」・>>18「またかよ 酷すぎる」・
//   >>19 主「申し訳ございません」・>>29「強行開催します！」。
// - 「【回覧】おんJ芋煮会、WBC見たいから中止」（2023/3/22。wiki 595）→ ナイター 見たいから 中止。
// - 「おんJ芋煮会実行委員会です。」（2023/3/15。wiki 595）：総額：10万3100円・>>6 主「個別の対応はいたしかねます。ご了承ください。」・
//   >>7「結婚式かな？」。
// - 「芋煮会のレシピ！」（2026/9/21 /1789942755）の こんにゃく論争：入れる派 >>5「こんにゃく少なくね？」・>>7「なにいってんだこいつ」・
//   >>21「こんにゃくアンチは金輪際おでんとかも食うなよ」・>>25「玉こんにゃくと刺身こんにゃくでなければええんや」、
//   入れない派 >>6「いらねーもん」・>>13「こんにゃく好きなん？？」（後半は 使わない）。
// ぷゆゆと やきうの 雑談（data/mobs.ts の imoni「中止の お知らせしか 来えへん」）と つながる：お知らせは 毎年 中止、
// それでも 浜の かまどに 年に 1度 火が 入る（10月の 4回目の 帰りか 22日から）。強さ・道具・売上・町の 段には 何も 効かない。
// 保存は kiriko-roguelike/imoni だけ。

import { loadRecords } from "../engine/save";
import { nowYear, type Today, today } from "./calendar";
import type { Cell } from "./village/map";

export const IMONI = {
	board: {
		/** まとめ掲示板の メニューの 1行（10月だけ）。 */
		menu: "芋煮会の　お知らせ",
		title: "はり紙。\n『おんJ芋煮会　中止の　お知らせ』",
		/**
		 * 中止の わけと >>1 への 返事（10月の 1・2・3回目の 帰り か 1〜7・8〜14・15日〜 の 進んだ 方）。
		 * 1791448903 の >>1・>>3、2023/3/22「WBC見たいから中止」と >>9、>>7 主「寒いので中止予定です」と >>8。
		 */
		reasons: [
			"『なんか　ダルいので　中止です』\n『>>1　金返せー！』",
			"『ナイター　見たいから　中止です』\n『>>1　せっかく　牛肉　4kg　確保したのに』",
			"『寒いので　中止予定です』\n『>>1　芋煮　食べて　暖まるんやで』",
		],
		/** 2023/3/15「おんJ芋煮会実行委員会です。」の 請求（総額：10万3100円）と その >>7。 */
		invoice: "となりに　請求書。『総額：10万3100円』\n『>>1　結婚式かな？』",
		/** 強行開催（1791448903 の >>29「強行開催します！」。はり紙では >>1 への 返事）。 */
		open: "『寒いので　中止予定です』\n『>>1　強行開催します！』",
		smoke: "浜の　すみから、\nけむりが　上がっている。",
		/** 開催の あと（同じ 10月の 次の 帰りから。>>18「またかよ 酷すぎる」・>>19 主「申し訳ございません」）。 */
		doneTitle: "はり紙。\n『おんJ芋煮会（来年）　中止の　お知らせ』",
		doneReply: "『>>1　またかよ　酷すぎる』\n『>>2　申し訳　ございません』",
	},
	pot: {
		look: "浜の　すみに、石を　組んだ　かまど。\n大鍋に　木の　ふたが　してある。",
		never: "……火を　入れた　あとが　ない。",
		flyer: "ふたの　上に　ちらしが　1枚。\n『おんJ芋煮会　中止の　お知らせ』",
		soot: "かまどの　石に、すすが　ついている。",
		warm: "かまどの　石が、まだ　ぬくい。\n……芋の　においが　する。",
	},
	open: {
		first:
			"大鍋が　ぐつぐつ　いっている。\n……ちらしは、かまどに　くべてあった。",
		again: "大鍋が　ぐつぐつ　いっている。\n……今年も、ちらしが　くべてある。",
		/** 1789942755 の >>5（入れる派）・>>6（入れない派）・>>7（入れる派）。 */
		pro: "こんにゃく　少なくね？",
		anti: "いらねーもん",
		pro2: "なにいってんだ　こいつ",
		options: ["こんにゃくを　入れる", "入れない"],
		putIn: "キリコは　こんにゃくを　ちぎって、\n鍋に　入れた。",
		leaveOut: "キリコは　こんにゃくを　そっと　置いた。",
		won: "わかっとるやん",
		dish: "芋煮",
		/** [入れた, 入れない]。 */
		eat: [
			"里芋が　ほくほくで、\nこんにゃくが　よく　味を　すっている。",
			"里芋が　ほくほくで、\n牛肉の　だしが　しみている。",
		],
		/** [はじめての 年, 次の 年から]。ぷゆゆの 雑談 imoni「……いもわ？🥺」の こたえ。 */
		puyu: ["……いも、あったゆ🥺", "ことしも、いも🥺"],
		/** やきうの「あれは　中止の　お知らせしか　来えへん」の こたえ。 */
		yakiu: ["……中止や　なかったんか", "……今年も　強行か"],
		boil: "大鍋が　ぐつぐつ　いっている。",
		more: ["おかわり", "やめる"],
		refill: "おかわりした。\n……鍋は　ちっとも　へらない。",
	},
	names: {
		chair: "実行委員",
		pro: "入れる派の　名無し",
		anti: "入れない派の　名無し",
	},
	staff: {
		/** 2023/3/15 実行委員会の >>6 主「個別の対応はいたしかねます。ご了承ください。」。 */
		chair: {
			before: [
				"おんJ芋煮会、強行開催です。\n……中止の　お知らせは、見なかった　ことに",
				"個別の　対応は　いたしかねます。\nご了承ください。",
			],
			after: ["参加費は、あとで　請求します"],
		},
		/** 入れる派（1789942755 の yD2F）：>>25「玉こんにゃくと刺身こんにゃくでなければええんや」・>>21。 */
		pro: {
			before: ["こんにゃく　少なくね？"],
			in: ["玉こんにゃくと　刺身こんにゃくで\nなければ　ええんや"],
			out: ["こんにゃく　アンチは　金輪際\nおでんとかも　食うなよ"],
		},
		/** 入れない派（PDD6）：>>6「いらねーもん」・>>13 の 前半「こんにゃく好きなん？？」（後半は 使わない）。 */
		anti: {
			before: ["いらねーもん"],
			in: ["……こんにゃく　好きなん？？"],
			out: ["芋と　肉と　ねぎ。\n……それで　ええねん"],
		},
	},
} as const;

export type ImoniPhase = "off" | "notice" | "open" | "done";
export type ImoniKon = "in" | "out";
export type ImoniRec = {
	v: 1;
	/** 開催に 来た（食べた）年。0 は まだ。 */
	held: number;
	/** その とき の 帰り（記録の 時刻）。同じ 帰りの あいだは まだ 開催中（おかわり）。 */
	heldAt: number;
	/** その 年の こんにゃくの 決着。 */
	kon: ImoniKon | null;
	/** 一度でも 開かれた（かまどに すす）。 */
	ever: boolean;
	/** 10月の 帰りを 数えた 年・回数・さいごに 数えた 帰り。 */
	octYear: number;
	octN: number;
	octAt: number;
};
export const IMONI_OPEN_DAY = 22;
/** 10月の 4回目の 帰りから 強行開催（1〜3回目は 中止の はり紙。わけが 回ごとに かわる）。 */
export const IMONI_OPEN_RETURN = 4;
export const imoniWeek = (d: number): number =>
	Math.min(2, Math.max(0, Math.floor((d - 1) / 7))); // 1-7→0, 8-14→1, 15-31→2
/** 10月の 帰りを 数える（同じ 帰り・10月 いがいは r を そのまま 返す）。 */
export const imoniVisit = (
	r: ImoniRec,
	t: Today,
	year: number,
	at: number,
): ImoniRec => {
	if (t.m !== 10) return r;
	if (r.octYear !== year) return { ...r, octYear: year, octN: 1, octAt: at };
	if (r.octAt === at) return r;
	return { ...r, octN: r.octN + 1, octAt: at };
};
export const imoniReturns = (r: ImoniRec, year: number): number =>
	r.octYear === year ? r.octN : 0;
export const imoniPhase = (
	t: Today,
	year: number,
	r: ImoniRec,
	at: number,
): ImoniPhase => {
	if (t.m !== 10) return "off";
	if (r.held === year) return r.heldAt === at ? "open" : "done";
	return t.d >= IMONI_OPEN_DAY || imoniReturns(r, year) >= IMONI_OPEN_RETURN
		? "open"
		: "notice";
};
/** はり紙の 中止の わけ（週か、10月の 帰りの 回数の 進んだ 方。0〜2）。 */
export const imoniReason = (t: Today, year: number, r: ImoniRec): number =>
	Math.min(2, Math.max(imoniWeek(t.d), imoniReturns(r, year) - 1));
/** 今年の こんにゃく（まだ 食べて いなければ null。飾りの 鍋の 絵）。 */
export const imoniKon = (r: ImoniRec, year: number): ImoniKon | null =>
	r.held === year ? r.kon : null;

/** 浜の すみの かまど（2x2 の 左上）・大鍋を 調べる マス・開催の 人・場面で 呼ぶ マス（地図の 座標）。 */
export const IMONI_POT: Cell = [0, 35];
export const IMONI_POT_THING: Cell = [1, 35];
export const IMONI_STAFF = {
	chair: [0, 34] as Cell,
	pro: [3, 35] as Cell,
	anti: [3, 36] as Cell,
} as const;
export const IMONI_SCENE = {
	puyu: [2, 34] as Cell,
	yakiu: [3, 34] as Cell,
} as const;

const IMG = "pub:sprites/season.png";
/** 絵（scripts/make-season.mjs）。 */
export const IMONI_ART = {
	pot: [
		`${IMG}#0,0,16,16`,
		`${IMG}#16,0,16,16`,
		`${IMG}#0,16,16,16`,
		`${IMG}#16,16,16,16`,
	],
	lit: `${IMG}#32,0,32,32`,
	litKon: `${IMG}#64,0,32,32`,
	bowl: `${IMG}#96,0,16,16`,
	bowlKon: `${IMG}#112,0,16,16`,
} as const;

const KEY = "kiriko-roguelike/imoni";
let memo: ImoniRec | null = null;
export const emptyImoni = (): ImoniRec => ({
	v: 1,
	held: 0,
	heldAt: -1,
	kon: null,
	ever: false,
	octYear: 0,
	octN: 0,
	octAt: -1,
});
const int = (x: unknown, d: number): number =>
	typeof x === "number" && Number.isInteger(x) && x >= -1 ? x : d;
/** 読む（壊れた JSON・足りない 欄は 初期値）。 */
export const loadImoni = (): ImoniRec => {
	if (memo) return { ...memo };
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		if (raw && typeof raw === "object" && raw.v === 1)
			memo = {
				v: 1,
				held: int(raw.held, 0),
				heldAt: int(raw.heldAt, -1),
				kon: raw.kon === "in" || raw.kon === "out" ? raw.kon : null,
				ever: raw.ever === true,
				octYear: int(raw.octYear, 0),
				octN: int(raw.octN, 0),
				octAt: int(raw.octAt, -1),
			};
	} catch {
		// 読めなければ 初期値
	}
	memo ??= emptyImoni();
	return { ...memo };
};
/** 書く（?stage= の 下見・&imoni= では 覚える だけ）。 */
export const saveImoni = (r: ImoniRec, noSave: boolean): void => {
	memo = { ...r };
	if (noSave) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(r));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};
/** 試験用：覚えている 写しを 捨てる。 */
export const forgetImoniMemo = (): void => {
	memo = null;
};
/** いまの 帰り（記録の 時刻。ui/guests.ts の returnAt と 同じ。data は ui を 読めないので ここにも）。 */
export const imoniReturnAt = (): number => loadRecords()[0]?.at ?? 0;
/** 試験用：段階を 決め打ちする（ui/villageMobs.ts の tipDice と 同じ 作り。null で ふだん）。 */
export const imoniForce: { phase: ImoniPhase | null } = { phase: null };
/** 開発用：&imoni=off|notice|open|done（pnpm dev か ?debug）。 */
export const devImoniPhase = (): ImoniPhase | null => {
	if (typeof location === "undefined") return null;
	const q = new URLSearchParams(location.search);
	if (!import.meta.env.DEV && !q.has("debug")) return null;
	const p = q.get("imoni");
	return p === "off" || p === "notice" || p === "open" || p === "done"
		? p
		: null;
};
/** いまの 段階。 */
export const imoniPhaseNow = (): ImoniPhase =>
	imoniForce.phase ??
	devImoniPhase() ??
	imoniPhase(today(), nowYear(), loadImoni(), imoniReturnAt());
/** いまの はり紙の 中止の わけ。 */
export const imoniReasonNow = (): number =>
	imoniReason(today(), nowYear(), loadImoni());
/** 今年の こんにゃく（飾りの 鍋）。 */
export const imoniKonNow = (): ImoniKon | null =>
	imoniKon(loadImoni(), nowYear());
/** 実行委員と 名無しが 浜に 出ている（村の 地図の when。開催の 帰りだけ）。 */
export const imoniShown = (): boolean => imoniPhaseNow() === "open";
