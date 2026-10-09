// 議会中継（見るだけの 実況番組。CIVIC.md §3・ENGINE.md §4.9・§5.4）。町役場の モニター（段4〜6）・市役所の
// 中継モニター（段7）・本館の 実況モニター（段6〜の 月曜）で、議会の 日に 映る。
// - 見るだけ（interactive:false。窓を 出さない）。議長と 住人の 発言は 2行の 書きこみで 時刻どおりに 流れ、
//   あいだに 名無しの ヤジ。A は 早送り、B 1回で 閉じる（ui/jikkyoGikai.ts）。
// - 1回の 帰りに 新しい 話 1つ。全部 見たら 再放送（「この　流れ　何回目や」）。
// - 議長＝おんちゃん（越してきて いれば。いなければ 名無しの 議長で、口ぐせの ない 文）。書記＝プロト、参考人＝ロゼ。
//   やきうは 出さない。話は 出る 住人が みな 越してきて いる ときだけ 流れる。
// - 議題と 派閥は ぜんぶ 架空の 村の 話。どちらの 派にも 立たず、決着は 引き分け・住み分け・どうでもいい 結果・
//   「なお〜の 模様」。保守神社は 出さない。「保守」は 地名（保守町・保守市）だけ。
// - 1行 全角18字 × 2行（エンジンの 板）。数と 勢いは 見た目だけ（1000 に 届かない 長さ）。

import {
	type JkPools,
	type JkRules,
	type JkSeg,
	type JkTimeline,
	PIN_MS,
	PROGRAM_RULES,
} from "../../core/jikkyo";
import type { MobId } from "../mobs";

/** 話し手（議長・名無しの レス・住人・参考人の ロゼ）。 */
export type GikaiWho = "chair" | "res" | "roze" | MobId;

/** 1つの 発言。plain は 名無しの 議長の とき（おんちゃんの 口ぐせなし）。 */
export type GikaiLine = {
	readonly who: GikaiWho;
	readonly text: string;
	readonly plain?: string;
};

export type GikaiEpisode = {
	readonly id: string;
	/** 議題（村の 窓・議会だより）。 */
	readonly title: string;
	/** 見どころ（村の 窓 1つ。決着は 言わない）。 */
	readonly pitch: string;
	/** 出る 住人（みな 越してきて いる ときだけ 流す。ロゼは 仲間）。 */
	readonly cast: readonly MobId[];
	readonly lines: readonly GikaiLine[];
};

const ch = (text: string, plain: string): GikaiLine => ({
	who: "chair",
	text,
	plain,
});
const r = (text: string): GikaiLine => ({ who: "res", text });
const s = (who: MobId | "roze", text: string): GikaiLine => ({ who, text });

/** 開会（議長と 名無しの レス）。 */
export const GIKAI_OPEN: readonly GikaiLine[] = [
	ch(
		"これより　定例会を\nひらくおん。静粛に　だおん",
		"これより　定例会を\nひらきます。静粛に",
	),
	r("議会中継　はじまったで"),
	r("ROM専　集合"),
];

/** 閉会。 */
export const GIKAI_CLOSE: readonly GikaiLine[] = [
	ch(
		"これで　定例会を　閉じるおん。\n……おつかれさまだおん",
		"これで　定例会を　閉じます。\n……おつかれさまでした",
	),
	r("議会　乙"),
	r("次の　定例会も　実況　するで"),
];

/** 再放送の はじめの レス。 */
export const GIKAI_RERUN = "この　流れ　何回目や";

/** 議題 8話（並びは はじめて 見る 順）。 */
export const GIKAI_EPISODES: readonly GikaiEpisode[] = [
	{
		id: "yane",
		title: "おんJの　屋根の　色",
		pitch:
			"見どころ：おんJの　屋根の　色。\nきつね色派と　水色派が　ぶつかる。",
		cast: ["panmatsu", "nichie", "yayapoji"],
		lines: [
			ch(
				"議題1、おんJの　屋根の　色。\nきつね色か　水色か　だおん",
				"議題1、おんJの　屋根の　色。\nきつね色か　水色か　です",
			),
			s("panmatsu", "きつね色だ。焼きたての\nパンに　いちばん　近い　色だ"),
			r("＼屋根で　パンを　焼く　気かー！／"),
			s("nichie", "水色だニィ。\n日曜日の　空の　色だニィ"),
			r("月曜の　空は　何色なんや"),
			s("nichie", "……灰色だニィ"),
			r("屋根　ピンク派　おって　草"),
			ch(
				"採決。きつね色　4、水色　4。\n可否同数だおん",
				"採決。きつね色　4、水色　4。\n可否同数です",
			),
			s("yayapoji", "引き分けだ。\n……いい　引き分けだ"),
			r("なお　屋根は　灰色の　まま\nの　模様"),
		],
	},
	{
		id: "toban",
		title: "当番表の　欄",
		pitch:
			"見どころ：当番表の　欄を　ふやすか。\n書記の　プロトが　ソースを　出す。",
		cast: ["asakonro", "proto"],
		lines: [
			ch(
				"議題2、当番表の　欄を\nふやすか　どうか　だおん",
				"議題2、当番表の　欄を\nふやすか　どうか　です",
			),
			s("asakonro", "ふやすもん！　火も　スレも\n絶やしちゃ　だめだもん"),
			r("＼当番表　だれも\n見とらんやろー！／"),
			s("proto", "当番表の　閲覧数、\n先週は　2回ゼロ"),
			r("ソース　あるの　強い"),
			r("その　2回、両方　プロトやろ"),
			ch(
				"賛成多数で　可決だおん。\n当番表の　紙が　1枚　ふえるおん",
				"賛成多数で　可決です。\n当番表の　紙が　1枚　ふえます",
			),
			r("すごい　一体感を　感じる"),
			r("紙が　ふえた　だけで　草"),
		],
	},
	{
		id: "mabo",
		title: "麻婆豆腐の　辛さ",
		pitch: "見どころ：麻婆豆腐の　辛さ条例。\n参考人は　ロゼ。",
		cast: ["onsu"],
		lines: [
			ch(
				"議題3、麻婆豆腐の　辛さ\n条例。参考人を　よぶおん",
				"議題3、麻婆豆腐の　辛さ\n条例。参考人を　よびます",
			),
			s("roze", "辛さは　ロゼが　決めるアル。\n条例より　鍋が　先アル"),
			r("＼辛さを　数字で　言えー！／"),
			s("roze", "辛さ　3アル。……ロゼの\n3は、ふつうの　人の　8アル"),
			r("単位が　ロゼで　草"),
			s("onsu", "辛すぎて　人が　来ないのは、\nおんSだけで　十分なのぉ！"),
			r("自虐で　草"),
			ch(
				"辛さは『ロゼ』で　はかる\nことに　決まったおん",
				"辛さは『ロゼ』で　はかる\nことに　決まりました",
			),
			r("なお　1ロゼの　定義は\n未定の　模様"),
		],
	},
	{
		id: "yuon",
		title: "銭湯の　湯温",
		pitch: "見どころ：銭湯の　湯温。\n41℃派と　42℃派の　言い合い。",
		cast: ["ngoane", "jtleman"],
		lines: [
			ch(
				"議題4、銭湯の　湯温。\n42℃か　41℃か　だおん",
				"議題4、銭湯の　湯温。\n42℃か　41℃か　です",
			),
			s("ngoane", "41℃が　いいンゴねぇ……\nフェリスちゃんが　のぼせるンゴ"),
			s("jtleman", "42℃こそ　紳士の　湯だ。\n……名犬Jは　入らないがね"),
			r("＼湯守の　日誌を　出せー！／"),
			r("日誌　出たで"),
			r("その　日誌の　ソースは？"),
			r("ゴール　動かすな"),
			r("エアプ　おる？\n入ってから　言え"),
			ch(
				"あいだを　とって、\n41.5℃に　するおん",
				"あいだを　とって、\n41.5℃に　します",
			),
			r("なお　番台の　温度計は\n43℃だった　模様"),
		],
	},
	{
		id: "nichiyo",
		title: "毎日　日曜日",
		pitch: "見どころ：『毎日　日曜日』条例。\n……月曜は　どうなる。",
		cast: ["nichie", "ren"],
		lines: [
			ch(
				"議題5、にぃちぇ議員の\n『毎日　日曜日』条例だおん",
				"議題5、にぃちぇ議員の\n『毎日　日曜日』条例です",
			),
			s("nichie", "毎日を　日曜日に　するニィ！\n月曜日は　もう　来ないニィ！"),
			r("＼月曜は　どこへ　行くんやー！／"),
			s("ren", "毎日　日曜日だと、アップ\nデートの　日が　ないかな〜？"),
			s("nichie", "深淵を　のぞくとき……深淵も\n日曜日を　まっているニィ"),
			r("答弁に　なってなくて　草"),
			ch(
				"反対多数で　否決だおん。\n……あしたは　ふつうに　来るおん",
				"反対多数で　否決です。\n……あしたは　ふつうに　来ます",
			),
			r("なお　次の　日は　月曜日\nだった　模様"),
		],
	},
	{
		id: "agesage",
		title: "ageか　sageか",
		pitch: "見どころ：まとめ掲示板の　書きこみは\nageか　sageか。",
		cast: ["onsu", "jtleman", "miaumiau"],
		lines: [
			ch(
				"議題6、まとめ掲示板の\n書きこみは、ageか　sageか",
				"議題6、まとめ掲示板の\n書きこみは、ageか　sageか",
			),
			s("onsu", "ageないと　だれも　来ないの！\n……来なくても　平気だけど"),
			s(
				"jtleman",
				"sage　進行こそ　大人の　作法だ。\n庭は　静かな　ほうが　いい",
			),
			s("miaumiau", "全部　age　して\nスレを　伸ばすぷ！"),
			r("age派　おる？"),
			r("sage派　集合"),
			r("また　この　話か"),
			ch(
				"age派の　スレと　sage派の\nスレを、べつに　立てるおん",
				"age派の　スレと　sage派の\nスレを、べつに　立てます",
			),
			r("住み分けで　平和に　なって　草"),
			r("なお　どっちの　スレも\n同じ　メンバーの　模様"),
		],
	},
	{
		id: "kiriban",
		title: "キリ番の　請願",
		pitch: "見どころ：キリ番派と　ゆずる派の\n請願。",
		cast: ["ren", "aru"],
		lines: [
			ch(
				"議題7、キリ番派と　ゆずる派\nから、請願だおん",
				"議題7、キリ番派と　ゆずる派\nから、請願です",
			),
			s("ren", "キリ番を　踏んだ　人に\n記念品を　出して　ほしいの〜！"),
			s("aru", "キリ番は、ゆずり合う\nものだと　思います！"),
			r("スクショ　なきゃ　ノーカンやぞ"),
			ch(
				"信じる　ものは　人それぞれ。\n次の　議題に　いくおん",
				"信じる　ものは　人それぞれ。\n次の　議題に　いきます",
			),
			r("急に　平和で　草"),
			r("なお　この　レスが\n>>777だった　模様"),
		],
	},
	{
		id: "rom",
		title: "ROM専の　席",
		pitch: "見どころ：傍聴席に　ROM専の　席を\nつくるか。",
		cast: ["mujje", "proto"],
		lines: [
			ch(
				"議題8、傍聴席に　ROM専の\n席を　つくるか　だおん",
				"議題8、傍聴席に　ROM専の\n席を　つくるか　です",
			),
			r("ROM専って　ほんまに　おるんか？"),
			r("おるで"),
			r("おるで"),
			r("書いとる　時点で　ROMちゃうやろ"),
			s("mujje", "……ホゲェ"),
			s("proto", "傍聴席の　ROM専、\n数えきれないゼロ"),
			ch(
				"見てる　人の　席も\n要るおん。可決だおん",
				"見てる　人の　席も\n要ります。可決です",
			),
			r("すごい　一体感を　感じる"),
		],
	},
];

/** ヤジ（名無し。1回の 中継で 同じ ヤジは 1回まで）。 */
export const GIKAI_YAJI: readonly string[] = [
	"議長　寝とるやんけ",
	"今北産業",
	"議事録　はよ",
	"カメラ　ぶれとるで",
	"傍聴席　ROM専　だらけで　草",
	"休憩　長すぎて　草",
	"中継　見とるの　ワイら　だけや",
	"＼議長ー！／",
	"＼答えに　なってないぞー！／",
	"質疑が　押して　草",
	"次の　議題　はよ",
	"定期",
];

/**
 * 中継する 議会（題の 議会の 名前）。本館の 月曜は その 段の 議会（段6 は 町議会、段7 から 市議会。
 * ui/jikkyoGikai.ts の hallGikai）。
 */
export type GikaiPlace = "townhall" | "cityhall";

/** 番組の 字（スレタイ・ヘッダー・ヒント・村の 窓）。 */
export const GIKAI_TEXT = {
	title: {
		townhall: "【議会中継】保守町議会　定例会",
		cityhall: "【議会中継】保守市議会　定例会",
	},
	label: "中継",
	chair: "議長",
	at1000: "1000なら　議長　昼寝",
	hint: "A　早送り　B　とじる",
	fast: "早送り　×3",
	normal: "ふつうの　速さ",
	/** 村の 窓（モニター → 2窓 → 見る？）。{title} は 議題。 */
	on: "議会の　中継モニター。\n『{title}』を　中継している。",
	onRerun: "議会の　中継モニター。\n『{title}』の　再放送。",
	/** 本館の 実況モニターの 月曜（議会中継が はじめの チャンネル）。 */
	hallOn: "実況モニター。\n今日は　月曜。議会中継が　映っている。",
	menu: ["見る", "チャンネルを　かえる", "やめる"],
	menuSimple: ["見る", "やめる"],
	/** 本館：ナイターは 録画（チャンネルを かえた 先）。 */
	record: "ピッ。……ナイターの　録画に　なった。",
	seat: "キリコは　中継を　見た。",
	closed: "……中継が　おわった。",
} as const;

/** 見るだけの 番組の 決まり（窓も 当番も ない。数と 勢いは 見た目だけ）。 */
const GIKAI_RULES = (title: string): JkRules => ({
	goal: 0.3,
	idle: PROGRAM_RULES.idle,
	post: 0,
	boost: 0,
	comboMin: 10,
	comboDen: 0,
	fit: PROGRAM_RULES.fit,
	speed: PROGRAM_RULES.speed,
	reveal: PROGRAM_RULES.reveal,
	wave: PROGRAM_RULES.wave,
	watchHold: PROGRAM_RULES.watchHold,
	windowMode: "overlay",
	interactive: false,
	hold: 998,
	roll: {
		at1000: () => ({ who: "nanashi", text: GIKAI_TEXT.at1000 }),
		title: () => title,
		label: () => GIKAI_TEXT.label,
		gap: { best: 0, ok: 0, miss: 0, none: 0 },
		flow: 2500,
	},
	display: {
		perRes: 0.1,
		min: 0.35,
		max: 0.7,
		burst: 0.7,
		burstReduced: 0.7,
	},
	writer: { recent: 6, caps: { nanashi: 1 }, repeatOk: [] },
	quitNote: "",
});

/** 区切りの 中身（TV が 読む：話し手と 議題）。 */
export type GikaiData = {
	readonly who: GikaiWho;
	readonly ep: string;
	readonly title: string;
};

/** 書きこみの 間（2行は 長め）。 */
const stepOf = (l: GikaiLine): number => (l.text.includes("\n") ? 3000 : 1900);
/** 頭の 間（>>1 の スレタイ の あと）・終わりの 間。 */
const LEAD = 1500;
const TAIL = 2500;

/** 話し手の 鍵（エンジンの who。住人は cast:、ロゼも cast:）。 */
export const gikaiWhoKey = (w: GikaiWho): string =>
	w === "chair" ? "chair" : w === "res" ? "nanashi" : `cast:${w}`;

/**
 * 1話の 時間割（開会 → 再放送の 1レス → 議題 → 閉会）。発言は 目立つ 書きこみ（議長は スレの 上に 止める）、
 * 区切りの あいだは ヤジ。onchan は 議長が おんちゃんか（名無しの 議長は plain の 文）。
 */
export const gikaiProgram = (
	ep: GikaiEpisode,
	o: { onchan: boolean; rerun: boolean; place: GikaiPlace },
): { tl: JkTimeline; rules: JkRules; pools: JkPools } => {
	const lines: GikaiLine[] = [
		...GIKAI_OPEN,
		...(o.rerun ? [r(GIKAI_RERUN)] : []),
		...ep.lines,
		...GIKAI_CLOSE,
	];
	const segs: JkSeg[] = [];
	let at = LEAD;
	segs.push({
		start: 0,
		dur: LEAD,
		w: 0.5,
		// 開会の 前は ヤジなし（はじめの 書きこみは 議長の 開会）
		filler: [],
		data: { who: "res", ep: ep.id, title: ep.title } satisfies GikaiData,
	});
	lines.forEach((l, i) => {
		const dur = i === lines.length - 1 ? TAIL : stepOf(l);
		const text = l.who === "chair" && !o.onchan ? (l.plain ?? l.text) : l.text;
		segs.push({
			start: at,
			dur,
			w: dur / 2000,
			posts: [
				{
					at: 0,
					who: gikaiWhoKey(l.who),
					text,
					...(l.who === "chair" ? { pin: PIN_MS } : {}),
				},
			],
			filler: [{ who: "nanashi", pool: "yaji", p: 1 }],
			data: { who: l.who, ep: ep.id, title: ep.title } satisfies GikaiData,
		});
		at += dur;
	});
	return {
		tl: { segs, overlays: [], total: at, P: 0 },
		rules: GIKAI_RULES(GIKAI_TEXT.title[o.place]),
		pools: { yaji: GIKAI_YAJI, nanashi: GIKAI_YAJI },
	};
};

/** 話が 流せるか（出る 住人が みな 越してきて いる）。 */
export const gikaiAvailable = (
	ep: GikaiEpisode,
	moved: readonly MobId[],
): boolean => ep.cast.every((id) => moved.includes(id));

/** 見た 話の 記録（kiriko-roguelike/jikkyo の gikai。ui/jikkyoGikai.ts）。 */
export type GikaiMemo = {
	readonly seen: readonly string[];
	/** いちばん 新しく 見た 帰りと、その 帰りの 話（再放送か）。 */
	readonly at: number;
	readonly ep?: string;
	readonly rerun?: boolean;
};

/**
 * この 帰りの 話（同じ 帰りなら 同じ。新しい 帰りは まだ 見て いない 話を 1つ、全部 見たら 再放送）。
 * moved は 越してきた 住人（出る 住人が そろって いる 話だけ）。流せる 話が なければ null。
 */
export const gikaiEpisodeFor = (
	memo: GikaiMemo,
	at: number,
	moved: readonly MobId[],
): { ep: GikaiEpisode; rerun: boolean } | null => {
	const list = GIKAI_EPISODES.filter((e) => gikaiAvailable(e, moved));
	if (!list.length) return null;
	const same = memo.at === at ? list.find((e) => e.id === memo.ep) : undefined;
	if (same) return { ep: same, rerun: memo.rerun === true };
	const fresh = list.find((e) => !memo.seen.includes(e.id));
	if (fresh) return { ep: fresh, rerun: false };
	const k = Math.abs(Math.floor(at)) % list.length;
	return { ep: list[k] ?? list[0], rerun: true };
};

/** 見た 印（見た 話を 足して、この 帰りの 話を 覚える）。 */
export const gikaiWatched = (
	memo: GikaiMemo,
	at: number,
	ep: GikaiEpisode,
	rerun: boolean,
): GikaiMemo => ({
	seen: memo.seen.includes(ep.id) ? [...memo.seen] : [...memo.seen, ep.id],
	at,
	ep: ep.id,
	rerun,
});
