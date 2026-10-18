// 話の つなぎの 場面（STORY.md §4.9）。本筋の 話を 持ち帰った その 帰りに 1回だけ、話の 解決から 次の 板の 事件と
// 謎へ つなぐ（演出は ui/village/episodeHooks.ts）。どの 行も 村の 窓（全角 22字・2行）に 収める。
// 201 の 型：説明は 動きの 中で・聞く 側が つっこむ・主人公が 原因・天丼（人影の 見出し・寝言・ゼロの 数える）。
// ここの 札と 矢印の 図（CardSpec）は、語りの 説明では なく ゼロが その場で 描いて 見せる 図（台詞「図にしました！」）。
// 持ち帰りの 語りの 段の 図は 実物の 絵に かえた（STORY.md §0「図は 実物の 絵」）が、人が 自分で 描く 図は 小道具なので 残す。

import type { CardSpec } from "../../engine/sceneCard";

/** 板の 絵（public/ の 歩行グラ）。 */
const PANHEI = "sprites/panhei.png";
const KINONYAN = "sprites/kinonyan.png";

/** 第一話（パン板）→ 第二話（きのこ板）：その夜、植民地の 植民地が 仕返しに 動きだす。 */
export const KINOKO_EVE = {
	night: "その夜。広場でパン兵が、\n独立記念のパンを並べていた。",
	panheiSell: "独立記念のパンや。\n町にも卸したるで",
	rozeAsk: "パン板が独立したら、\nパン板の植民地はどうなるアル？",
	panheiBlank: "植民地？",
	kirikoAsk: "植民地の植民地ンゴ？",
	zeroDraw: "図にしました！\n5秒で！",
	zeroChain: "パン板は、おんJの植民地。\nきのこ板は、パン板の植民地です",
	zeroCut: "今日、上が独立しました。\n下は、そのままです",
	kirikoLeft: "下だけ、置いてけぼりンゴ",
	panheiForgot: "そういや、そんなんも\nおったな",
	nanjTsukkomi: "おったな、やないで",
	nanjHistory: "きのこ板はな、ずっと\n仕返しの機会を待っとったんや",
	memoryCaption: "2015年　夏",
	memoryCame: "2015年の夏。パン兵が、\nきのこ板に乗りこんできた。",
	memoryFlag: "食パンの旗が、1本立った。",
	memoryPanhei: "今日からここは、\nパン板の植民地や",
	memoryKinoko: "いつか、\n仕返ししたるからな",
	memoryPanhei2: "旗は食パンや。\n食べたらあかんで",
	memoryKinoko2: "食べてもうた",
	memoryNanj: "それから11年。\n恨みだけ、熟成しとる",
	nanjOmen: "親が独立して、子は置いてけぼりか。\nひと騒ぎ、ありそうやな",
	zeroRoute: "きのこ板からパン板への\n近道も、図にしました！",
	kirikoEmpty: "町が、空き地に\nなってるンゴ",
	rozeMap: "1時間、国民0人だったアル。\n地図に載ったアル",
	kirikoCause: "吾輩の独立の\nせいンゴ！？",
	nanjSleep: "まあ、通るだけやろ。\n寝とけ寝とけ",
	sleep: "むにゃ。\nお客、いっぱいンゴ……",
	march: "夜ふけ。港から、小さな足音が\n坂を上がってきた。",
	zeroCount: "足音、128です！\n3人しか見えません",
	kinokoStep: "店先は、ちょっとしか\n踏んでへん",
	sleep2: "むにゃ。お客、\nほんとにいっぱいンゴ……",
	morning: "翌朝。",
	/** 盛った 見出しへの つっこみ（見えたのは 3人）。 */
	kirikoHeadline: "上陸って……\n3人ンゴ",
	/** 行く 理由は キリコの ことばで（STORY.md §0「世界を 見せる」10）。 */
	kirikoGo: "パン板とけんかになる前に、\n吾輩が追いかけるンゴ",
	/** きのこ軍の 名前欄（顔は [ｷ・Д・ﾉ]。行の 頭に 付ける）。 */
	kinokoName: "きのこ軍",
	kinokoFace: "[ｷ・Д・ﾉ]",
	panheiName: "パン兵",
} as const;

/** ゼロが 描く 図①：植民地の 植民地（zeroDraw「図にしました！」の 図。残す）。step 1 で 上が 独立、2 で 下が ゆれる。 */
export const colonyCard = (step: 0 | 1 | 2): CardSpec => ({
	title: "イメージ図「植民地の植民地」",
	nodes: [
		{ label: "おんJ", sub: "2012〜", aa: "Ｊ" },
		{ label: "パン板", sub: "2014〜", sprite: PANHEI },
		{
			label: "きのこ板",
			sub: step === 2 ? "2015〜\n置いてけぼり" : "2015〜",
			sprite: KINONYAN,
			shake: step === 2,
		},
	],
	links: [
		{ label: "植民", cut: step >= 1 ? "独立" : undefined },
		{ label: "植民" },
	],
	note: "ゼロ調べ",
});

/** ゼロが 描く 図②：きのこ板から パン板への 近道（zeroRoute「近道も、図にしました！」の 1時間前の 地図。残す）。 */
export const routeCard: CardSpec = {
	title: "イメージ図「近道」",
	nodes: [
		{ label: "きのこ板", sprite: KINONYAN },
		{ label: "おんJタウン", sub: "国民0人\n（空き地）", aa: "町" },
		{ label: "パン板", sprite: PANHEI },
	],
	links: [{ label: "徒歩" }, { label: "船" }],
	note: "1時間前の地図（ゼロ調べ）",
};

const BANTOU = "sprites/ofurou.png";

/**
 * 第二話（きのこ板）→ 第三話（風呂板）：胞子を 流しに 銭湯へ 行くと 閉まって いて、湯の 温度で 町が 割れて いる。
 * 3日前の 回想で、割った のは 名無しの 書きこみ（人影の 天丼。正体は 最終話）。
 */
export const BATH_EVE = {
	// 頭の きのこは 行進が 摘みとった（story.ts の kinoko.once）。胞子だけ 髪に 残る
	night: "その夜。きのこは摘まれたのに、\n髪に胞子が残っていた。",
	sneeze: "はっくしょンゴ！",
	zeroSpore: "胞子、128個出ました！\n数えました！",
	shiyoBath: "胞子、まきちらさないで。\nお風呂、入ってきなさいよ",
	kirikoGo: "銭湯、行くンゴ！",
	shout42: "ぬるいんじゃ！",
	shout41: "熱いんじゃ！",
	name42: "湯気の中の42℃派",
	name41: "湯気の中の41℃派",
	steam: "煙突から湯気が噴きだして、\n町の上まで広がっていく。",
	kirikoSteam: "銭湯が、蒸し器に\nなってるンゴ！",
	zeroDraw: "湯温の派閥、図にしました！\n籠城3日目です！",
	zeroFaction: "41℃派12人、42℃派12人。\n中立は、0人です",
	shiyo43: "41℃も42℃も、ぬるいわよ。\nあたすは、43℃",
	// 皮肉の 型：いちばん 熱いのは 湯でなく シヨ
	kirikoMore: "ぬるいって言うほうが、\nいちばん熱いンゴ",
	zeroWhy: "けんかのはじまりも、\nログに残ってました",
	memoryCaption: "3日前",
	memoryNight: "3日前の夜。掲示板に、\n名無しの書きこみがひとつ。",
	memoryPost: "銭湯の湯、ぬるすぎて草",
	memoryPostName: "名無し",
	memorySplit: "次の朝から、町は湯の温度で\nまっぷたつになった。",
	zeroSame: "この書きこみ、見出しと\n同じ書き方です。数えました",
	nanjSame: "さあな。名無しやろ",
	kirikoWhy: "胞子が落ちるまで、\n吾輩は寝られないンゴ",
	nanjSource: "銭湯の湯は、風呂板の源泉や。\n立てこもりも、源泉のほうやろ",
	morning: "翌朝。",
} as const;

/** ゼロが 描く 図③：湯温の 派閥（zeroDraw「湯温の派閥、図にしました！」の 図。残す）。step 1 で シヨ派（43℃）が 参戦。 */
export const factionCard = (step: 0 | 1): CardSpec => ({
	title: "イメージ図「湯温戦争」",
	nodes: [
		{ label: "41℃派", sub: "12人", aa: "41" },
		{ label: "銭湯", sub: "籠城3日目", aa: "湯", shake: true },
		{ label: "42℃派", sub: "12人", sprite: BANTOU },
		...(step === 1 ? [{ label: "シヨ派", sub: "1人", aa: "43" }] : []),
	],
	links: [
		{ label: "押す" },
		{ label: "立てこもる" },
		...(step === 1 ? [{ label: "参戦" }] : []),
	],
	note: "中立 0人（ゼロ調べ）",
});
