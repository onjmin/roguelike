// 敵の いない 階（名所の 階・いちばん底の 集落。core/data/dungeons.ts の rests・settlement）に 着いた ときの 寸劇。
// 村の 窓で 掛け合い、そこに 立って いる 人（folk）が 走り、カメラが 向く（演出は ui/dungeon/play.ts の restSkit）。
// - 1つの 所に 2〜3本。着く たびに まだ 見て いない ものを 1本（ぜんぶ 見たら 出ない。ui/dungeon/restSkit.ts）。
// - 見た目だけ：人は 走っても 寸劇の おわりに 元の 所へ もどる（冒険の 状態・乱数には 触らない。リプレイでは 出さない）。
// - 下りだけ（帰り道では 出さない）。主人公が キリコで ない ときは 出さない（キリコの 返事が 筋）。
// - 1本は 窓 4〜7枚。1行 全角22字・2行まで。{hero} は 主人公の 名前。
// - 導入（2026-10-18 作者「ロゼ・シヨ・ゼロも ライバルだけど 導入なしに 唐突に 表れる」）：はじめて 会う 人は、
//   先回りして 何かを して いる 現場で 名乗る（説明は 動きの 中で。STORY.md §0「世界を 見せる ときは キャラを 動かす」）。
// - ツッコミは 1行で、型を まぜる（STORY.md「ツッコミの 着眼点と 型」：例え・嘆き・皮肉・ノリ・寄り添い・執着）。
// - 文に 出てきた 物は 実物の 絵（data/story/pictures.ts）で 見せる。

import type { Hit } from "../../engine/emote";
import type { AnyCard } from "../../engine/sceneCard";
import { propPicture } from "./pictures";

/** 走る 1人。who は folk の 番（地図の 1〜9 → 0〜8）か キリコ。to は 地図の マス・キリコの となり・元の 所。 */
export type RestWalk = {
	who: number | "kiriko";
	to: readonly [number, number] | "kiriko" | "home";
};

/** 寸劇の 1歩：先に 走り・カメラ・絵・音、それから 窓（text が なければ 動きだけ）。 */
export type RestStep = {
	/** 話す 人：folk の 番・キリコ。省けば 地の文。 */
	who?: number | "kiriko";
	text?: string;
	/** 窓の 前に 走らせる（ならべた 分は 同時）。 */
	go?: readonly RestWalk[];
	/** 窓の 前に カメラを 向ける（folk の 番・マス。null で 主人公に もどす）。 */
	look?: number | readonly [number, number] | null;
	/** 窓の 前に 出す 絵（null で しまう。寸劇の おわりにも しまう）。 */
	card?: AnyCard | null;
	/** 窓の 前に 鳴らす 効果音（data/audio/sfx.ts）。 */
	se?: string;
	/** 窓の 前に おく 間（ms。見せ場の ツッコミの 前に。engine/emote.ts の Cue.pause と 同じ）。 */
	pause?: number;
	/** ツッコミの 音（engine/emote.ts の Hit。窓の 前に 鳴る）。 */
	hit?: Hit;
};

export type RestSkit = {
	key: string;
	/** 所の 名前（RestFloor.name・SettlementSpec.name）。 */
	place: string;
	steps: readonly RestStep[];
};

const BASE = "pub:assets/rpg-reze/Base.png";
/** Base.png の (c, r) マスから w×h マス（core/data/places.ts の b と 同じ）。 */
const b = (c: number, r: number, w = 1, h = 1): string =>
	`${BASE}#${c * 16},${r * 16},${w * 16},${h * 16}`;

/** 発電所の 見学者の ための 画面（places.ts の M）。 */
const TOUR_SIGN = b(0, 485, 2, 2);
/** 古い 石像（places.ts の G）。 */
const STATUE = b(5, 285, 1, 2);

const n = (
	text: string,
	more: Omit<RestStep, "text" | "who"> = {},
): RestStep => ({
	text,
	...more,
});
const say = (
	who: number | "kiriko",
	text: string,
	more: Omit<RestStep, "text" | "who"> = {},
): RestStep => ({ who, text, ...more });
const k = (text: string, more: Omit<RestStep, "text" | "who"> = {}): RestStep =>
	say("kiriko", text, more);

export const REST_SKITS: readonly RestSkit[] = [
	// ───────────── パン板の 底：パン王国の 城下町（人：0 パン王・1 ロゼ・2,3 パン兵・4 ゼロ・5 プロト・6 レン） ─────────────
	// ロゼと ゼロの 導入：先回りの 現場。ロゼは 王に 説教の 途中、ゼロは 3機で パン兵を 数えて いる
	{
		key: "castle_rivals",
		place: "パン王国の城下町",
		steps: [
			// 王の 前で 説教して いる ロゼ（カメラは 王）
			say(1, "……だから、独立は書類アル！\n旗を立てるのは、そのあとアル！", {
				go: [{ who: 1, to: [16, 5] }],
				look: 1,
			}),
			say(0, "もう3時間や……\nパン、かたくなってまう……", { look: 0 }),
			// ロゼが {hero} に 気づいて 走って くる
			say(1, "おそいアル。わたしは束音ロゼ。\n3時間前に着いて、説教中アル", {
				go: [{ who: 1, to: "kiriko" }],
				look: null,
			}),
			k("だれに名乗ってるンゴ？"),
			say(1, "おんJ生まれの声どうし、\n先輩が名乗ってやったアル。常識アル"),
			// ゼロが 数えながら 走って くる。つづいて サブ機の プロト（訂正）・レン（観客）
			say(4, "パン兵、31人！32人！\n……あ、{hero}さんを数えました！", {
				go: [{ who: 4, to: "kiriko" }],
				se: "decide",
			}),
			say(5, "32人目は、パン兵では\nないゼロ。31人に訂正ゼロ", {
				go: [{ who: 5, to: "kiriko" }],
			}),
			say(6, "レンも数えたよ〜！31人！\n観客は、{hero}で1人目♪", {
				go: [{ who: 6, to: "kiriko" }],
			}),
			say(4, "解音ゼロです！3機で、\n{hero}さんの蓄音機を数えに来ました！"),
			k("パン兵を数えに\n来たんじゃないンゴ？"),
			say(4, "パン兵は、ついでです！", {
				go: [
					{ who: 4, to: "home" },
					{ who: 5, to: "home" },
					{ who: 6, to: "home" },
					{ who: 1, to: "home" },
				],
			}),
			// ロゼが 王の 前に もどって くる
			say(0, "ロゼはん、もどってきた……\n説教、まだ続くんか……", { look: 0 }),
		],
	},
	{
		key: "castle_sale",
		place: "パン王国の城下町",
		steps: [
			n("独立記念セール、2日目。"),
			say(2, "全品、パン1個につき\nパン1個や！", {
				go: [{ who: 2, to: "kiriko" }],
			}),
			k("……定価ンゴ", { pause: 500, hit: "slap" }),
			say(3, "独立したら、値段も\n独立するんや！", {
				go: [{ who: 3, to: "kiriko" }],
			}),
			say(1, "値段が独立しても、\n常識は独立しないアル！", {
				go: [{ who: 1, to: "kiriko" }],
			}),
			say(0, "ワイの国の常識は、\nワイが決める！……パンや！", { look: 0 }),
			k("国の常識が、パン1個ンゴ", {
				look: null,
				go: [
					{ who: 1, to: "home" },
					{ who: 2, to: "home" },
					{ who: 3, to: "home" },
				],
			}),
		],
	},
	{
		key: "castle_anthem",
		place: "パン王国の城下町",
		steps: [
			n("城の前で、パン兵が\n国歌の練習をしていた。", { look: [17, 5] }),
			say(2, "パンがーよーはー♪", {
				go: [
					{ who: 2, to: [16, 6] },
					{ who: 3, to: [18, 6] },
				],
			}),
			say(3, "ちよーにー、やちよーにー♪\n……歌詞、パンから変わってへん"),
			say(0, "2番からパンや。\n『食パーンのー』や", { look: 0 }),
			say(4, "歌詞のパン、数えました！\n1番は0、2番は1です！", {
				go: [{ who: 4, to: "kiriko" }],
				look: null,
			}),
			k("ほぼ君が代ンゴ", { hit: "slap" }),
			say(1, "独立した国の国歌は、\n3時間の説教アル。わたしが歌うアル", {
				go: [{ who: 1, to: [17, 6] }],
			}),
			say(2, "逃げろー！", {
				go: [
					{ who: 2, to: "home" },
					{ who: 3, to: "home" },
					{ who: 4, to: "home" },
					{ who: 1, to: "home" },
				],
			}),
		],
	},

	// ───────────── 風呂板 7階：露天の 源泉（人：0 シヨ） ─────────────
	{
		key: "spring_thermometers",
		place: "露天の源泉",
		steps: [
			say(0, "温度計5本、ぜんぶ\nちがう数字なのよ！", { look: 0 }),
			say(0, "41.3、41.6、41.5、42.0。\n……5本目は、湯に落としたわ", {
				go: [{ who: 0, to: "kiriko" }],
				look: null,
			}),
			k("平均、41.5ンゴ"),
			say(0, "勝手に平均しないで！\n……41.5℃なら、入ってあげる"),
			// 湯だまりへ 走って、足だけ つける
			n("シヨは湯に足だけつけて、\n6本目の温度計を落とした。", {
				go: [{ who: 0, to: [7, 9] }],
				se: "bubble",
			}),
			// 暴力系ヒロイン：言う より 先に 手が 出る
			say(0, "べ、べつに入ってないわよ！\n足だけよ！", {
				hit: "punch",
				go: [{ who: 0, to: "home" }],
			}),
		],
	},
	{
		key: "spring_barrel",
		place: "露天の源泉",
		steps: [
			n("東の大桶から、\nごぼごぼと音がした。", { look: [24, 5] }),
			k("日本一の大桶ンゴ！\n吾輩も入るンゴ！", {
				go: [{ who: "kiriko", to: [22, 6] }],
				look: null,
			}),
			n("桶のふちまで、\n3メートルあった。"),
			say(0, "はしご、ないわよ。\n3時間前に、確かめたわ", {
				go: [{ who: 0, to: "kiriko" }],
			}),
			k("3時間前から、\n入りたかったンゴ？"),
			say(0, "ち、ちがうわよ！\n温度を測りたかっただけ！", {
				go: [
					{ who: 0, to: "home" },
					{ who: "kiriko", to: "home" },
				],
			}),
		],
	},

	// ───────────── 電池板 8階：発電所の 見学コース（人：0 電池ニキ・1 フェリス） ─────────────
	{
		key: "plant_visitors",
		place: "発電所の見学コース",
		steps: [
			// 案内板の 実物（見学者 0人）
			n("入口の案内板に、\n「本日の見学者　0人」。", {
				look: [5, 9],
				card: propPicture(TOUR_SIGN, "見学コースの案内板", {
					text: "本日の見学者\n0人",
				}),
			}),
			say(0, "見学者1人目、入場や！\n数字、書きかえるで", {
				go: [{ who: 0, to: [6, 10] }],
				look: null,
				se: "pencil",
				card: propPicture(TOUR_SIGN, "見学コースの案内板", {
					text: "本日の見学者\n1人",
				}),
			}),
			say(1, "私が先〜！1人目は私〜！", { look: 1 }),
			say(0, "柵の上は、0.5人や", {
				look: null,
				card: propPicture(TOUR_SIGN, "見学コースの案内板", {
					text: "本日の見学者\n1.5人",
				}),
			}),
			k("半分、燃えてるンゴ", { hit: "slap" }),
			say(0, "燃えとる分は、\n切り捨てや", {
				card: propPicture(TOUR_SIGN, "見学コースの案内板", {
					text: "本日の見学者\n1人（0.5は切り捨て）",
				}),
				go: [{ who: 0, to: "home" }],
			}),
			say(1, "ひど〜い！", { card: null }),
		],
	},
	{
		key: "plant_bills",
		place: "発電所の見学コース",
		steps: [
			say(0, "この電気、どこへ行っとる\nと思う？", {
				go: [{ who: 0, to: "kiriko" }],
			}),
			k("町ンゴ？"),
			say(0, "せや。人がおらんでも、\nずっと町へ送っとった"),
			say(0, "請求書も、ずっと送っとった。\nぜんぶ、宛先不明でもどってきた"),
			k("返送料のほうが\n高いンゴ"),
			say(1, "私宛てのは、\n燃やしちゃった〜！", { look: 1 }),
			say(0, "お前のは、燃えるゴミや！", {
				look: null,
				go: [{ who: 0, to: "home" }],
			}),
		],
	},

	// ───────────── 離島板の 底：山の 上の 集落（人：0 長・1,2 島民） ─────────────
	{
		key: "hamlet_count",
		place: "山の上の集落",
		steps: [
			n("集落では、人数を\n数えなおしていた。"),
			say(1, "1、2、……", { go: [{ who: 1, to: "kiriko" }] }),
			say(2, "3、4、……", { go: [{ who: 2, to: "kiriko" }] }),
			say(0, "……7人や。1人多い", { look: 0 }),
			k("吾輩ンゴ", { look: null }),
			say(0, "ほな6人や。……あれ、5人か？"),
			say(1, "長、自分を数えてへん"),
			say(0, "総島民6人！\n大事なことやから、毎回言う", {
				go: [
					{ who: 1, to: "home" },
					{ who: 2, to: "home" },
				],
			}),
		],
	},
	{
		key: "hamlet_tree",
		place: "山の上の集落",
		steps: [
			n("御神木のしめ縄が、\nヤシの葉でできていた。", { look: [10, 2] }),
			say(2, "しめ縄は、去年の台風で\n飛んでいってな", {
				go: [{ who: 2, to: [12, 4] }],
			}),
			say(1, "ヤシの葉なら、\nいくらでもある", {
				go: [{ who: 1, to: [8, 4] }],
			}),
			say(0, "御利益は半分。\nヤシの実は、3倍とれる", {
				go: [{ who: 0, to: [10, 4] }],
			}),
			k("差し引き、プラスンゴ", { look: null }),
			say(0, "島では、それを豊作と呼ぶ", {
				go: [
					{ who: 0, to: "home" },
					{ who: 1, to: "home" },
					{ who: 2, to: "home" },
				],
			}),
		],
	},

	// ───────────── おんたこの 底：最上階の たこパ会場（人：0 粉もん奉行・1,2 たこ民） ─────────────
	{
		key: "rooftop_invites",
		place: "最上階のたこパ会場",
		steps: [
			n("屋上は、たこパ会場だった。\n鉄板が、9台。", { look: [14, 4] }),
			say(1, "招待状128通、来たのは\n{hero}1人や😡", {
				go: [{ who: 1, to: "kiriko" }],
				look: null,
			}),
			say(2, "127人ぶんのタコ、\n余っとる😡", {
				go: [{ who: 2, to: "kiriko" }],
			}),
			k("😡が、宣戦布告に\n見えたンゴ"),
			say(0, "😡はタコの顔や！\nなんでみんな怒っとる思うねん😡", { look: 0 }),
			say(1, "怒ってへん😡"),
			say(2, "怒ってへん😡"),
			k("顔で損してるンゴ", {
				hit: "slap",
				look: null,
				go: [
					{ who: 1, to: "home" },
					{ who: 2, to: "home" },
				],
			}),
		],
	},
	{
		key: "rooftop_aonori",
		place: "最上階のたこパ会場",
		steps: [
			say(2, "青のり、かけ放題や😡", { go: [{ who: 2, to: "kiriko" }] }),
			say(1, "ソースも、かけ放題や😡", { go: [{ who: 1, to: "kiriko" }] }),
			n("{hero}の頭に、青のりと\nソースがかかった。", { se: "bubble" }),
			k("吾輩は、たこ焼き\nじゃないンゴ！"),
			say(0, "かけ放題は、かける側の\n自由やで😡", { look: 0 }),
			k("この板、客に\n青のりをかけるンゴ", {
				look: null,
				go: [
					{ who: 1, to: "home" },
					{ who: 2, to: "home" },
				],
			}),
		],
	},

	// ───────────── お祭りの 底：やぐら広場（人：0 親分・1,2 夜店の 人） ─────────────
	{
		key: "yagura_goldfish",
		place: "やぐら広場",
		steps: [
			say(1, "金魚すくい、\n金魚が逃げてもうた", {
				go: [{ who: 1, to: "kiriko" }],
			}),
			say(2, "ラムネの中に\n泳いどったで", { go: [{ who: 2, to: "kiriko" }] }),
			k("ラムネ、飲めないンゴ"),
			say(2, "金魚入りは、100円増しや"),
			say(0, "太鼓が止まらんのに、\n金魚の話するな！", { look: 0 }),
			say(1, "太鼓、親分がたたいとるんや"),
			say(0, "ワイか！", {
				pause: 500,
				hit: "whack",
				look: null,
				go: [
					{ who: 1, to: "home" },
					{ who: 2, to: "home" },
				],
			}),
		],
	},
	{
		key: "yagura_dance",
		place: "やぐら広場",
		steps: [
			n("ちょうちんの輪の中で、\n夜店の人が踊っていた。", {
				go: [
					{ who: 1, to: [6, 4] },
					{ who: 2, to: [21, 4] },
				],
			}),
			say(1, "客がおらんから、\n自分らで踊っとる", {
				go: [
					{ who: 1, to: [6, 8] },
					{ who: 2, to: [21, 8] },
				],
			}),
			say(2, "輪に、2人や"),
			k("吾輩が、3人目ンゴ！", { go: [{ who: "kiriko", to: [14, 8] }] }),
			say(0, "やぐらの上から見ると、\n3人は、点や", { look: 0 }),
			say(2, "点でも、踊るんや", {
				look: null,
				go: [
					{ who: 1, to: "home" },
					{ who: 2, to: "home" },
					{ who: "kiriko", to: "home" },
				],
			}),
		],
	},

	// ───────────── 過去ログの底 20・40・60・80階：静かな 石室（人は いない） ─────────────
	{
		key: "stone_hoshu",
		place: "静かな石室",
		steps: [
			n("巨大な水晶が、\nゆっくり光っていた。", { look: [11.5, 4.5] }),
			k("……だれも、おらんンゴ"),
			n("石像が1つ。台座に、\n「保守」と彫ってあった。", {
				look: [2, 3],
				card: propPicture(STATUE, "古い石像", { text: "保守" }),
			}),
			k("石になっても、\n保守してるンゴ", { card: null, look: null }),
		],
	},
	{
		key: "stone_nurupo",
		place: "静かな石室",
		steps: [
			n("水晶の中に、古い書きこみが\n閉じこめられていた。", {
				look: [11.5, 4.5],
				card: propPicture("sp:vjVm0U", "巨大な水晶", { text: "ぬるぽ" }),
			}),
			k("……ガッ", { se: "hit_fist" }),
			n("水晶が、すこしゆれた。", { card: null }),
			k("20年前のぬるぽでも、\n体が勝手に動くンゴ", { look: null }),
		],
	},
	{
		key: "stone_1get",
		place: "静かな石室",
		steps: [
			n("奥の石像の台座に、\n「1」と彫ってあった。", {
				look: [23, 3],
				card: propPicture(STATUE, "古い石像", { text: "1" }),
			}),
			k("1ゲットンゴ？"),
			n("2005年の1ゲットだった。\n2は、まだ来ていない。"),
			k("20年、2を待ってるンゴ", { card: null, look: null }),
		],
	},
];

/** 所の 名前で 寸劇を 引く（並びの 順。見て いない ものを 1本 えらぶのは ui/dungeon/restSkit.ts）。 */
export const restSkitsAt = (place: string): RestSkit[] =>
	REST_SKITS.filter((sk) => sk.place === place);
