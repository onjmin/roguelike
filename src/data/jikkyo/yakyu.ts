// ナイター実況（本館の 実況モニター）の 文と 組み立て。試合は core/jikkyoYakyu.ts、エンジンは core/jikkyo.ts。
// - 文の 決まり：候補レスは ボタン 1行・全角12字まで、スレの 行は 全角18字まで（{nick} は いちばん 長い 6字・{n}=999）、
//   テロップは 20字まで、村の 窓は 22字 × 2行・1窓、メニューは 12字まで。言葉の あいだは 全角スペース。
// - 合いの 決まり：◎ は 起きた ことを 名指しする 文、○ は 共通の 相づち 5つだけ、× は 別の 出来事の ◎。
//   窓が 閉じたら 名無しが ◎ を なぞる（スレが 正解を 教える）。
// - 名誉の 決まり：名前の ある 選手が 主語に なるのは ほめる 結果だけ（batCheer・pitCheer・fieldCheer・walkCheer・
//   respect・nextUp・候補の 名前つきの 形・テロップの ほめる 形）。悪い 結果の 文には 名前を 入れない。エラーに 守備位置を 出さない。
// - 使わない 語：保守・立てといた・立てたる・立てたで ほか（src/sim/jikkyoTests.ts）。実在の 人の 口ぐせも 使わない。
// - 球場の 名前・応援歌・球団の 正式名・ロゴの 字は 入れない（地名や 通称は よい）。
// 文の 中身は 設計の 下書き（scratch の texts.json）の 写し。

import {
	fillText,
	heatWeights,
	type JkFit,
	type JkOpt,
	type JkPick,
	type JkPools,
	type JkRand,
	type JkReq,
	type JkRules,
	type JkSeg,
	type JkTimeline,
} from "../../core/jikkyo";
import {
	JK_HEAT,
	JK_SHOW,
	JK_TEAM_IDS,
	type JkBases,
	type JkGame,
	type JkKind,
	type JkPlay,
	type JkTeamId,
	kindsOf,
	pickCard,
	simulateGame,
	type YSegKind,
	yakyuSegs,
} from "../../core/jikkyoYakyu";
import type { Rng } from "../../core/rng";
import { JK_TEAMS } from "./yakyuRoster";

/** 実況民の pool の 種類。 */
export type FanPool =
	| "cheer"
	| "groan"
	| "hr"
	| "k"
	| "lead"
	| "closer"
	| "cm"
	| "taunt"
	| "lurk"
	| "win"
	| "lose";

/** ○（まあまあ）：どの 見せ場でも 共通の 相づち 5つ（どの kind の ◎ にも 入れない）。 */
export const JK_OK: readonly string[] = [
	"はえ〜",
	"ほえー",
	"せやな",
	"これは",
	"見とるで",
];

/** 候補レス（kind ごとに ◎・名前つきの ◎・×）。ボタン 1行・全角12字まで（{nick} は いちばん 長い 6字）。 */
export const JK_RES: Readonly<
	Record<
		JkKind,
		{
			readonly best: readonly string[];
			readonly nick?: string;
			readonly miss: readonly string[];
		}
	>
> = {
	suretate: {
		best: [">>1　乙", "スレ立て　乙", "立て　乙"],
		miss: ["試合終了", "入ったあああ", "ゲッツーや"],
	},
	HR: {
		best: [
			"ｷﾀ━━━(ﾟ∀ﾟ)━━━!!",
			"入ったあああ",
			"でっか",
			"うおおおおお",
			"ホームランや！",
		],
		nick: "さすが　{nick}",
		miss: ["ゲッツーや", "三振や！", "刺した！", "CM　長すぎ"],
	},
	gyakuten: {
		best: ["逆転や！", "ひっくり返した！", "流れ変わったな", "ｷﾀ━━━(ﾟ∀ﾟ)━━━!!"],
		miss: ["三者凡退や", "試合終了", "守備固めや", "ゲッツーや"],
	},
	kachikoshi: {
		best: ["勝ち越しや！", "でかした！", "ええぞ！ええぞ！"],
		miss: ["追いついた！", "ゲッツーや", "CM　長すぎ", "三振や！"],
	},
	douten: {
		best: ["追いついた！", "振り出しや", "試合が　動いた", "まだ　わからんで"],
		miss: ["勝ち越しや！", "試合終了", "三者凡退や", "守備固めや"],
	},
	timely: {
		best: ["タイムリー！", "打った！", "ええぞ！ええぞ！", "点が　入った！"],
		miss: ["逆転や！", "ゲッツーや", "三振や！", "CM　長すぎ"],
	},
	run: {
		best: ["点が　入った！", "ええぞ！ええぞ！", "点を　もぎとった"],
		miss: ["三振や！", "CM　長すぎ", "守護神　来た！", "セーフ！"],
	},
	walkoff: {
		best: ["サヨナラや！", "勝ったあああ", "ｷﾀ━━━(ﾟ∀ﾟ)━━━!!", "うおおおおお"],
		nick: "{nick}　最高や",
		miss: ["CM　長すぎ", "守備固めや", "ゲッツーや", "三者凡退や"],
	},
	gameset: {
		best: ["試合終了", "乙", "ナイスゲーム", "ええ試合やった", "ほな　また"],
		miss: ["逆転や！", "走った！", "代打の　切り札！", "CM　長すぎ"],
	},
	bigK: {
		best: ["三振や！", "えぐい", "打てる　気　せえへん", "ナイスピー"],
		nick: "{nick}　えぐい",
		miss: ["入ったあああ", "走った！", "タイムリー！", "セーフ！"],
	},
	dp: {
		best: ["ゲッツーや", "ダブルプレー！", "あっ……"],
		miss: ["入ったあああ", "サヨナラや！", "タイムリー！", "押し出しかい"],
	},
	E: {
		best: ["エラーや", "ファッ！？", "なんやこれ", "何が　起きたんや", "草"],
		miss: ["ナイスプレー", "ナイスピー", "刺した！", "三者凡退や"],
	},
	fine: {
		best: ["うまい！", "なんや　いまの", "守備職人や", "ナイスプレー"],
		nick: "{nick}　うまい",
		miss: ["エラーや", "押し出しかい", "CM　長すぎ", "入ったあああ"],
	},
	laser: {
		best: ["レーザービーム！", "肩　えぐ", "刺した！", "アウトや！"],
		nick: "{nick}　肩　えぐ",
		miss: ["入ったあああ", "セーフ！", "押し出しかい", "エラーや"],
	},
	steal: {
		best: ["走った！", "はっや", "セーフ！"],
		nick: "{nick}　はっや",
		miss: ["刺した！", "ゲッツーや", "三振や！", "強肩や"],
	},
	caught: {
		best: ["刺した！", "強肩や", "ナイス送球", "アウトや！"],
		nick: "{nick}　強肩や",
		miss: ["セーフ！", "走った！", "入ったあああ", "タイムリー！"],
	},
	closer: {
		best: [
			"守護神　来た！",
			"出たな",
			"終わった……",
			"頼むで",
			"ここで　交代か",
			"勝ったな　風呂　入るわ",
		],
		nick: "{nick}　来た！",
		miss: ["入ったあああ", "代打の　切り札！", "サヨナラや！", "エラーや"],
	},
	relief: {
		best: ["ここで　交代か", "継投や", "頼むで"],
		miss: ["守護神　来た！", "入ったあああ", "ゲッツーや", "代打の　切り札！"],
	},
	pinch: {
		best: [
			"代打の　切り札！",
			"出てきたで",
			"ここで　出すか",
			"打ってくれ",
			"頼むで",
		],
		nick: "{nick}　頼むで",
		miss: ["守護神　来た！", "ゲッツーや", "試合終了", "守備固めや"],
	},
	defsub: {
		best: ["守備固めや", "逃げ切る　気やな", "堅いな", "ここで　交代か"],
		miss: ["代打の　切り札！", "ｷﾀ━━━(ﾟ∀ﾟ)━━━!!", "走った！", "押し出しかい"],
	},
	walkin: {
		best: ["押し出しかい", "1点　入ったで", "ンゴ"],
		miss: ["入ったあああ", "ナイスピー", "三振や！", "ゲッツーや"],
	},
	request: {
		best: ["くつがえった！", "リクエスト成功", "ファッ！？", "せやろな"],
		miss: ["守護神　来た！", "CM　長すぎ", "三振や！", "入ったあああ"],
	},
	chance: {
		best: ["ここで　打てや", "チャンスや", "頼む……"],
		nick: "{nick}　頼む……",
		miss: ["試合終了", "CM　長すぎ", "三者凡退や", "守備固めや"],
	},
	sansha: {
		best: ["テンポ　ええな", "はっや", "三者凡退や", "チェンジや"],
		miss: ["サヨナラや！", "エラーや", "押し出しかい", "タイムリー！"],
	},
	cm: {
		best: [
			"CM　長すぎ",
			"はよ　再開　せえ",
			"トイレ　行ってくる",
			"実況　ひと休みや",
			"お茶　入れてくる",
		],
		miss: ["入ったあああ", "守護神　来た！", "刺した！", "逆転や！"],
	},
	lucky7: {
		best: ["ラッキー7や", "風船　飛ばすで", "応援　ええな", "ええぞ！ええぞ！"],
		miss: ["試合終了", "三振や！", "ゲッツーや", "守備固めや"],
	},
	chukei: {
		best: ["ファッ！？", "中継　終わるな", "ラジオ　つけるわ", "なんやこれ"],
		miss: ["試合終了", "ナイスピー", "刺した！", "入ったあああ"],
	},
	hit: {
		best: ["ナイバッチ", "ヒットや", "打った！"],
		nick: "{nick}　ええぞ！",
		miss: ["ゲッツーや", "三振や！", "CM　長すぎ", "押し出しかい"],
	},
	out: {
		best: ["打ち取った", "アウトや！", "ナイスピー"],
		miss: ["入ったあああ", "タイムリー！", "セーフ！", "押し出しかい"],
	},
	walk: {
		best: ["フォアボールや", "よう　見た", "選んだな"],
		nick: "{nick}、よう　見た",
		miss: ["三振や！", "入ったあああ", "ゲッツーや", "刺した！"],
	},
};

/** 実況民（球団ごと）。cheer・groan・hr・k・lead・closer・cm・taunt・lurk・win・lose。スレの 行は 全角18字まで。 */
export const JK_FANS: Readonly<
	Record<JkTeamId, Readonly<Record<FanPool, readonly string[]>>>
> = {
	tora: {
		cheer: [
			"ええぞ！　虎や！",
			"虎の　時間や！",
			"甲子園が　揺れとる",
			"虎の　夜や！",
			"これが　連覇の　虎や",
			"今日も　ええ　風が　吹いとる",
		],
		groan: [
			"今日は　あかん日や",
			"ため息　出るわ",
			"まだ　終わってへん",
			"なんでや、虎……",
		],
		hr: ["甲子園　大爆発や！", "虎の　一発や！"],
		k: ["虎の　投手陣は　ほんまもんや", "えぐい　球　投げよる"],
		lead: ["虎が　前に　出たで！", "ひっくり返したった！"],
		closer: ["守護神　出たら　安心や"],
		cm: ["風船　ふくらましとこ"],
		taunt: ["連覇の　虎に　勝てるんか？", "虎の　ほうが　声　でかいで"],
		lurk: ["どっちも　がんばれや", "虎の　試合　ないから　来たで"],
		win: ["虎の　勝ちや！　連覇の　力や", "ええ　夜や、乾杯や"],
		lose: ["負けたけど　CSが　本番や", "切りかえや、明日や"],
	},
	g: {
		cheer: [
			"兎、ええぞ！",
			"ここから　兎の　時間や",
			"ドームが　わいとる",
			"これが　兎の　底力や",
			"兎の　夜や！",
			"まだまだ　いけるで、兎",
		],
		groan: [
			"あかんて……",
			"なんで　そこで……",
			"今日は　ついとらん",
			"まだ　いける、まだ",
		],
		hr: ["でかいの　出た！", "兎の　一発や！"],
		k: ["打たせへんで", "ええ　球　投げとる"],
		lead: ["兎が　前に　出たで！", "これで　ひっくり返したわ"],
		closer: ["守護神、頼んだで"],
		cm: ["兎の　攻撃　まだか"],
		taunt: ["CSで　待っとるで", "震えて　眠れ"],
		lurk: ["どっちも　負けろ", "CSの　相手　見に　来た"],
		win: ["兎の　勝ちや！　CSも　いける", "勝った！　ええ　試合や"],
		lose: ["切りかえや、切りかえ", "CSで　返す"],
	},
	ryu: {
		cheer: [
			"竜、やるやんけ！",
			"名古屋の　夜や",
			"ええぞ、竜！",
			"今日は　いける　気が　する",
			"竜の　意地や",
			"来年が　楽しみや",
		],
		groan: [
			"いつもの　やつや……",
			"知っとった",
			"慣れとる、慣れとる",
			"あかん……竜……",
		],
		hr: ["竜の　一発や！", "でっか！　届いたで"],
		k: ["竜の　投手は　ほんまもんや", "投手は　ええねん、投手は"],
		lead: ["竜が　前に　出たで！", "ひっくり返した！　ほんまか！"],
		closer: ["守護神、頼むで……"],
		cm: ["名古屋めし　食べとこ"],
		taunt: ["最下位　なめたら　あかんで", "竜の　投手陣は　強いで"],
		lurk: ["来年の　話を　しようや", "竜は　もう　オフや"],
		win: ["勝ったで！　久々や！", "来年に　つながる　勝ちや"],
		lose: ["来年は　来年の　風が　吹く", "知っとる、知っとる"],
	},
	koi: {
		cheer: [
			"ええのう！",
			"鯉の　意地じゃ",
			"それでこそ　鯉じゃ",
			"赤い　夜じゃ",
			"ええぞ、ええぞ　鯉！",
			"まだまだ　これからじゃ",
		],
		groan: ["なんでじゃ……", "たいぎいのう", "あかんのう……", "まあ、次じゃ"],
		hr: ["入ったけえ！", "鯉の　一発じゃ！"],
		k: ["ええ球　投げるのう", "打たせんけえ"],
		lead: ["前に　出たけえ！", "ひっくり返したけえ！"],
		closer: ["守護神じゃ、任せたで"],
		cm: ["スクワットの　準備じゃ"],
		taunt: ["虎も　兎も　うるさいのう", "鯉を　なめたら　いけんで"],
		lurk: ["ワシらは　来年じゃ", "よその　試合も　見るんじゃ"],
		win: ["勝ったけえ、ええんじゃ", "ええ　夜じゃのう"],
		lose: ["来年　見とれよ", "まあ、来年じゃ"],
	},
	tsubame: {
		cheer: [
			"傘　ふるで！",
			"神宮の　夜や",
			"燕、ええぞ！",
			"燕の　時間や",
			"まだ　これからや、燕",
			"ええ　流れや、燕",
		],
		groan: [
			"傘　しまうわ……",
			"あちゃー",
			"なんでや、燕……",
			"まだ　傘は　しまわん",
		],
		hr: ["傘が　足りん！", "燕の　一発や！"],
		k: ["燕の　投手、ええやん", "ナイスピー、燕"],
		lead: ["燕が　前に　出たで！", "ひっくり返した！　傘や！"],
		closer: ["守護神、頼むで"],
		cm: ["傘の　手入れ　しとこ"],
		taunt: ["燕を　なめたら　あかん", "神宮の　夜は　長いで"],
		lurk: ["燕は　オフの　準備や", "どっちも　ええ試合　せえよ"],
		win: ["勝った！　傘の　夜や", "燕の　勝ちや！"],
		lose: ["また　神宮で　会おうや", "来年は　燕の　年や"],
	},
	hoshi: {
		cheer: [
			"ハマの　夜や！",
			"下剋上　見せたる",
			"星、ええぞ！",
			"ハマの　風が　吹いとる",
			"星の　時間や",
			"いけるで、星！",
		],
		groan: ["あっ……", "なんでや……", "まだ　ある、まだ", "ため息　出るわ……"],
		hr: ["ハマの　一発や！", "星が　飛んだで！"],
		k: ["ナイスピー、星！", "打たせへんで、星"],
		lead: ["星が　前に　出たで！", "ひっくり返したった！　星や"],
		closer: ["守護神、頼んだで　星"],
		cm: ["星の　攻撃　まだか"],
		taunt: ["CSで　会おうや", "下剋上の　準備は　できとる"],
		lurk: ["CSの　相手　見に　来た", "星は　CSに　出るで"],
		win: ["勝った！　CSも　この勢いや", "ハマの　夜は　最高や"],
		lose: ["CSで　取りかえす", "切りかえや、CSや"],
	},
	taka: {
		cheer: [
			"強すぎて　すまんな",
			"鷹の　時間や",
			"これが　3連覇の　鷹や",
			"鷹、ええやん",
			"余裕や、余裕",
			"ドームが　鷹色や",
		],
		groan: [
			"まあ　優勝　しとるし",
			"珍しいな……",
			"たまには　ある",
			"まだ　余裕や",
		],
		hr: ["鷹の　一発や！", "でっか！　さすが　鷹"],
		k: ["鷹の　投手陣は　えぐいで", "打てる　わけ　ないやろ"],
		lead: ["鷹が　前に　出たで！", "当然の　展開や"],
		closer: ["守護神　出たら　終わりや"],
		cm: ["風船　用意しとこ"],
		taunt: ["3連覇の　壁は　高いで", "鷹に　勝てるんか？"],
		lurk: ["パスレ、だれも　おらんのや", "セの　試合も　見たるわ"],
		win: ["3連覇の　貫禄や", "今日も　鷹の　勝ちや"],
		lose: ["CSが　本番やから", "今日は　ゆずったる"],
	},
	kou: {
		cheer: [
			"北の　大地から　ええぞ！",
			"公、ええやん！",
			"北の　夜や！",
			"公の　時間や",
			"いけるで、公！",
			"北の　風が　吹いとる",
		],
		groan: [
			"なんでや、公……",
			"あかん……",
			"まだ　終わってへんで",
			"しゃあない、次や",
		],
		hr: ["北の　一発や！", "公の　大砲や！"],
		k: ["公の　投手、ええやん", "打たせへんで、公"],
		lead: ["公が　前に　出たで！", "ひっくり返したった！　公や"],
		closer: ["守護神、頼むで　公"],
		cm: ["公の　攻撃　まだか"],
		taunt: ["CS　なめんなよ", "北の　風は　冷たいで"],
		lurk: ["CS、楽しみや", "公は　CSに　出るで"],
		win: ["勝った！　CS　いけるで", "北の　夜は　最高や"],
		lose: ["切りかえて　CSや", "次は　勝つ"],
	},
	kamome: {
		cheer: [
			"マリンの　風が　吹いとる！",
			"幕張の　夜や",
			"鴎、ええぞ！",
			"海風が　味方や",
			"鴎の　時間や",
			"いけるで、鴎！",
		],
		groan: [
			"風　強すぎやろ……",
			"あかん、鴎……",
			"まあ、風の　せいや",
			"なんでや、鴎……",
		],
		hr: ["海風に　乗ったで！", "鴎の　一発や！"],
		k: ["ナイスピー、鴎！", "打たせへんで、鴎"],
		lead: ["鴎が　前に　出たで！", "ひっくり返したった！　鴎や"],
		closer: ["守護神、頼むで　鴎"],
		cm: ["海風、強なってきた"],
		taunt: ["海風を　なめたら　あかん", "幕張の　夜は　長いで"],
		lurk: ["来年は　鴎の　年や", "鴎は　オフの　準備や"],
		win: ["勝った！　幕張の　夜や", "鴎の　勝ちや！"],
		lose: ["しゃあない、来年や", "次は　勝つで、鴎"],
	},
	ori: {
		cheer: [
			"檻、ええぞ！",
			"大阪の　夜や",
			"檻の　時間や",
			"ええ　流れや、檻",
			"まだまだ　いけるで",
			"檻の　意地や",
		],
		groan: [
			"あかん、檻……",
			"なんでや、檻……",
			"ため息　出るわ、檻",
			"しゃあない、檻",
		],
		hr: ["檻の　一発や！", "でっか！　入ったで"],
		k: ["ええ球　投げとる", "打たせへんで、檻"],
		lead: ["檻が　前に　出たで！", "ひっくり返したった！　檻や"],
		closer: ["守護神、頼むで　檻"],
		cm: ["檻の　攻撃　まだか"],
		taunt: ["檻を　なめたら　あかんで", "大阪の　夜は　熱いで"],
		lurk: ["来年は　檻の　年や", "檻は　オフの　準備や"],
		win: ["勝った！　ええ　夜や", "檻の　勝ちや！"],
		lose: ["しゃあない、来年や　檻", "次は　勝つで、檻"],
	},
	neko: {
		cheer: [
			"所沢の　夜や！",
			"猫、ええやん",
			"猫の　時間や",
			"ええ　流れや、猫",
			"いけるで、猫！",
			"2位の　意地や",
		],
		groan: ["ンゴ……", "なんでや、猫……", "あかん、猫……", "まだ　いける、猫"],
		hr: ["所沢の　一発や！", "猫の　大砲や！"],
		k: ["猫の　投手陣、えぐいで", "打たせへんで、猫"],
		lead: ["猫が　前に　出たで！", "ひっくり返したった！　猫や"],
		closer: ["守護神、頼むで　猫"],
		cm: ["猫の　攻撃　まだか"],
		taunt: ["2位の　意地　見せたる", "CSで　決着や"],
		lurk: ["CS、待っとるで", "猫は　CSに　出るで"],
		win: ["勝った！　CS　いただきや", "猫の　勝ちや！"],
		lose: ["CSで　本気　出す", "切りかえや、猫"],
	},
	washi: {
		cheer: [
			"杜の　都から　ええぞ！",
			"鷲、ええやん！",
			"鷲の　時間や",
			"ええ　流れや、鷲",
			"いけるで、鷲！",
			"杜の　夜や",
		],
		groan: [
			"まあ　慣れとる……",
			"あかん、鷲……",
			"なんでや、鷲……",
			"しゃあない、鷲",
		],
		hr: ["鷲の　一発や！", "杜の　都まで　届いたで"],
		k: ["ええ球　投げとるで、鷲", "打たせへんで、鷲"],
		lead: ["鷲が　前に　出たで！", "ひっくり返したった！　鷲や"],
		closer: ["守護神、頼むで　鷲"],
		cm: ["牛たん　焼いとこ"],
		taunt: ["鷲を　なめたら　あかん", "杜の　夜は　冷えるで"],
		lurk: ["来年は　鷲の　年や", "鷲は　オフの　準備や"],
		win: ["久々の　勝ちや！", "鷲の　勝ちや！"],
		lose: ["牛たん　食って　寝る", "次は　勝つで、鷲"],
	},
};

/** どの 球団でも 使う 形（{team} は 1字）。 */
export const JK_FAN_ANY: Readonly<
	Record<"cheer" | "groan", readonly string[]>
> = {
	cheer: [
		"{team}、ええぞ！",
		"いけるで、{team}！",
		"{team}の　流れや",
		"これは　いける",
		"ええぞ、ええぞ",
	],
	groan: ["なんでや……", "あかん……", "しゃあない、次や", "まだ　終わってへん"],
};

/** カードどうしの 軽口（先に 使う。チーム単位。「a>b」は a の 実況民が b に）。 */
export const JK_TAUNTS: Readonly<Record<string, string>> = {
	"g>tora": "虎さん、CSで　待っとるで",
	"tora>g": "最後に　笑うのは　虎や",
	"kou>neko": "猫とは　CSで　決着や",
	"neko>kou": "公とは　CSで　決着や",
	"koi>tora": "虎も　兎も　うるさいのう",
	"koi>g": "虎も　兎も　うるさいのう",
	"ryu>tora": "虎、たまには　負けてや",
	"taka>*": "3連覇の　壁は　高いで",
};

/** 選手名の 形（ほめるだけ）。soft は 名前の ない 自軍への 声、nanashiHero は 名無しの 活躍。 */
export const JK_GENERIC: Readonly<
	Record<
		| "batCheer"
		| "pitCheer"
		| "fieldCheer"
		| "walkCheer"
		| "respect"
		| "nextUp"
		| "soft"
		| "nanashiHero",
		readonly string[]
	>
> = {
	batCheer: [
		"{nick}　ええぞ！",
		"さすが　{nick}や",
		"{nick}、持っとるなあ",
		"{nick}　最高や",
		"やっぱり　{nick}や",
	],
	pitCheer: ["{nick}　ナイスピー", "{nick}、えぐいて", "{nick}の　球、えぐい"],
	fieldCheer: ["{nick}、うまい！", "{nick}の　守備、最高や"],
	walkCheer: ["{nick}、よう　見た", "ええ　選球眼や"],
	respect: [
		"敵ながら　{nick}　えぐい",
		"{nick}は　しゃあない",
		"{nick}、ええ　選手や",
	],
	nextUp: ["次は　{nick}や、頼むで", "{nick}、頼んだで"],
	soft: ["しゃあない、切りかえや", "次や、次"],
	nanashiHero: ["名無し　やるやんけ", "だれや　いまの", "名無し　強すぎ"],
};

/** 名無しの 雑談（40）。 */
export const JK_NANASHI: readonly string[] = [
	"草",
	"はえ〜",
	"せやな",
	"ンゴ",
	"これは",
	"今北産業",
	"実況　はっや",
	"スレ　速すぎて　草",
	"どっちが　勝っとるん？",
	"ラジオ組、遅れとる",
	"ワイ、仕事中",
	"見とるで",
	"ええ試合や",
	"投手戦やな",
	"打撃戦やな",
	"うおおおお",
	"なんやこれ",
	"風呂　あがったで",
	"いま　何回？",
	"中継　ありがたい",
	"画質　ええな",
	"麦茶　うまい",
	"明日も　仕事や",
	"実況　ええな",
	"ナイター　最高や",
	"テレビ組、おるか？",
	"晩飯　食いながら　見とる",
	"照明　きれいやな",
	"外野、満員やな",
	"ここから　見るで",
	"スレ　伸びとるな",
	"接戦やな",
	"ええ　夜や",
	"おっ",
	"まだ　わからんな",
	"ひと息　ついた",
	"ワイも　見とる",
	"応援　ええな",
	"スタンド　熱いな",
	"ナイターは　ええのう",
];

/** キリコの レスへの アンカー返信（◎ 2〜4・○ 1・× 1〜2）。 */
export const JK_REPLIES: Readonly<Record<JkFit, readonly string[]>> = {
	best: [
		">>{n}　それな",
		">>{n}　わかる",
		">>{n}　草",
		">>{n}　はやい",
		">>{n}　ほんまそれ",
		">>{n}　実況　うまい",
	],
	ok: [">>{n}　せやな", ">>{n}　まあな", ">>{n}　おう"],
	miss: [
		">>{n}　なに　言うとんねん",
		">>{n}　どこ　見とるんや",
		">>{n}　別の　試合か？",
		">>{n}　ちゃうやろ",
	],
};

/** スレの 決まり文句。 */
export const JK_THREAD = {
	title: "【実況】{home}－{away}　Part{n}",
	get1000: "1000なら　{team}　日本一",
	over: "このスレッドは　1000を　超えました。",
	next: "次スレ→　Part{m}",
	took999: "前スレ999、わかっとるな",
} as const;

/** テロップ（キャンバス。全角20字まで）。 */
export const JK_TELOP = {
	batter: "{order}番　{nick}",
	batterN: "{order}番　名無し",
	pitcher: "ピッチャー　{nick}",
	K: ["空振り三振！", "見逃し三振"],
	BB: "フォアボール",
	"1B": "{dir}前　ヒット",
	"2B": "{dir}へ　ツーベース",
	"3B": "スリーベース！",
	HR: "{nick}、{dir}へ　ホームラン！",
	HRN: "{dir}へ　ホームラン！",
	grandslam: "満塁ホームラン！",
	GO: "{pos}ゴロ",
	GOrun: "{pos}ゴロ、1点",
	FO: "{pos}フライ",
	dp: "ゲッツー！",
	sacfly: "犠牲フライ",
	E: "エラー！",
	Erun: "エラー！　1点",
	fine: "{nick}、好捕！",
	laser: "{nick}の　好返球！　本塁アウト",
	steal: "{nick}、盗塁成功！",
	caught: "{nick}が　刺した！",
	closer: "守護神　{nick}　登場",
	relief: "ピッチャー交代　{nick}",
	reliefN: "ピッチャー交代",
	pinch: "代打　{nick}",
	pinchN: "代打　名無し",
	defsub: "守備固め　{nick}",
	walkin: "押し出し",
	request: "リクエスト……判定　くつがえる",
	chance: "チャンス！　{outs}　{bases}",
	sansha: "三者凡退",
	cm: "CM",
	lucky7: "ラッキー7",
	chukei: "中継は　ここまで",
	sokuho: "速報：{team}の　勝ち　{h}-{a}",
	sokuhoDraw: "速報：引き分け　{h}-{a}",
	walkoff: "サヨナラ！　{team}の　勝ち",
	gameset: "試合終了　{home}{h}-{a}{away}",
	intro: "ナイター中継　7回表から",
	pre: "6回まで　{home}{h}-{a}{away}",
	gyakuten: "逆転！",
	kachikoshi: "勝ち越し！",
	douten: "同点！",
	kanso: "スレ　完走！",
} as const;

/** 村の 窓（全角22字 × 2行・1窓。キリコは しゃべらない）。 */
export const JIKKYO_MSG = {
	card: "今日の　カードは　{home}　対　{away}。\n6回まで　{home}{h}-{a}{away}。",
	channel: "ピッ。……別の　試合に　なった。",
	howto: "見せ場で　書きこむと、スレが　伸びる。\n1000まで　埋めたら　完走だ。",
	kanso: "スレは　1000まで　埋まった。\n……次スレが　流れはじめた。",
	stopped: "スレは　{n}で　止まった。\n……試合は　終わった。",
} as const;

/** 本館の 実況モニターの メニュー。 */
export const JIKKYO_MENU = [
	"実況する",
	"チャンネルを　かえる",
	"見るだけ",
	"やめる",
] as const;

/** 本館の 実況民の 試合後の 1窓（win・lose・other。nanashi_0 は kanso・stopped）。『立てといた』は 使わない。 */
export const JIKKYO_AFTER: Readonly<
	Record<string, Readonly<Record<string, string>>>
> = {
	tora: {
		win: "見たか？　{star}や。\n……連覇の　虎は　強いで",
		lose: "負けは　負けや。\n……CSで　取りかえすで",
		other: "さっきの　試合、見とったで。\n……実況、はやかったな",
	},
	tora2: {
		win: "{star}、ええ　仕事したなあ。\n……今夜は　よう　眠れるわ",
		lose: "……チーム打率の　話は　すな。\nええな",
		other: "虎の　試合ちゃうけど、\n実況は　実況や",
	},
	g: {
		win: "{star}が　決めたな。\n虎さん、見とったか？",
		lose: "……CSで　返すで。\n震えて　眠れ",
		other: "兎の　試合ちゃうんか。\n……まあ、見とったけど",
	},
	ryu: {
		win: "勝ったで！　{star}や！\n……来年の　風が　もう　吹いとる",
		lose: "知っとる。\n……来年は　来年や",
		other: "竜は　もう　シーズン　終わっとる。\n……せやから　ここで　見とる",
	},
	koi: {
		win: "{star}、ええのう！\n……来年は　見とれよ",
		lose: "……なんでじゃ。\nまあ、来年じゃ",
		other: "よその　試合も、\n実況は　ええもんじゃのう",
	},
	taka: {
		win: "{star}や。\n3連覇の　チームは　ちゃうやろ",
		lose: "……CSが　本番や。\n言うとくけど",
		other: "パの　試合も　見てや。\n……パスレ、だれも　おらんのや",
	},
	hoshi: {
		win: "{star}、ええぞ！\n下剋上の　準備は　できとる",
		lose: "CSで　取りかえす。\n……ハマの　夜は　長いで",
		other: "よその　試合も、\n見とったら　熱く　なるな",
	},
	nanashi_0: {
		kanso: "完走　乙。\n……Part{m}も　もう　流れとるで",
		stopped: "1000まで　いかんかったな。\n……ま、次の　試合も　あるで",
	},
};

/** 結果カード（22字まで）。 */
export const JK_RESULT = {
	score: "試合終了　{home} {h}-{a} {away}",
	kanso: "完走！　Part{n}→{m}",
	stopped: "{res}レスで　止まった",
	ikioi: "最高の　勢い　{ikioi}",
	combo: "最高コンボ　{c}連続",
	fits: "◎{x}　○{y}　×{z}　見送り{w}",
	best: "自己ベスト　{best}レス",
	"new": "NEW!",
} as const;

/** ノート。 */
export const JK_FEEDBACK = {
	best: "◎　的確！　+{g}",
	ok: "○　まあまあ　+{g}",
	miss: "×　スベった　+{g}",
	fast: "神速",
	late: "見送り……",
	rom: "様子を　見ている……",
	quit: "もう一度　Bで　やめる",
	tutor: "合う　レスを、はやく　書く",
	combo: "{c}連続",
	ghost: "ベスト　{best}",
} as const;

// ───────────────── 試合と カード ─────────────────

/** 球団の 1字。 */
export const teamChar = (id: JkTeamId): string => JK_TEAMS[id].char;

/** 1字 → 球団（本館の 実況民の 札から）。 */
export const teamByChar = (c: string): JkTeamId | null =>
	JK_TEAM_IDS.find((id) => JK_TEAMS[id].char === c) ?? null;

/** 今日の カード（同じ リーグ 85%・交流戦 15%）。 */
export const yakyuCard = (rng: Rng): { home: JkTeamId; away: JkTeamId } =>
	pickCard(rng, JK_TEAMS);

/** 試合（同じ 種なら 同じ 試合）。 */
export const yakyuGame = (
	seed: string,
	home: JkTeamId,
	away: JkTeamId,
): JkGame => simulateGame(seed, home, away, JK_TEAMS);

// ───────────────── 候補レス ─────────────────

const uniq = <T>(a: readonly T[]): T[] => [...new Set(a)];

/** 見せ場の 主語（候補の 名前つきの 形・respect に 入る 名前）。 */
export const subjectOf = (top: JkKind, play?: JkPlay): string | null => {
	if (!play) return null;
	switch (top) {
		case "HR":
		case "walkoff":
		case "hit":
		case "chance":
		case "pinch":
		case "walk":
		case "steal":
			return play.b ?? null;
		case "bigK":
		case "closer":
			return play.p ?? null;
		case "fine":
		case "laser":
		case "caught":
			return play.f ?? null;
		default:
			return null;
	}
};

/** 文の 合い（当てはまる kind の どれかの ◎ なら ◎、共通の 相づちなら ○、ほかは ×）。nick は 名前つきの ◎ を 埋める 名前。 */
export const fitOf = (
	text: string,
	kinds: readonly JkKind[],
	nick?: string | null,
): JkFit => {
	for (const k of kinds) {
		const r = JK_RES[k];
		if (r.best.includes(text)) return "best";
		if (nick && r.nick && fillText(r.nick, { nick }) === text) return "best";
	}
	return JK_OK.includes(text) ? "ok" : "miss";
};

/** 同じ 中継で 使った 候補（◎ は 回し、× は 直近 3つ・○ は 直近 2つの 窓で 使った ものを よける）。 */
export type JkUsed = {
	readonly best: Set<string>;
	readonly miss: string[];
	readonly ok: string[];
};

export const freshUsed = (): JkUsed => ({ best: new Set(), miss: [], ok: [] });

const pickOne = <T>(a: readonly T[], rand: JkRand): T =>
	a[Math.floor(rand() * a.length)];

/**
 * 候補レス 3つ（◎・○・× 1つずつ、3つとも ちがう 文、並びは ランダム）。
 * ◎：40% で 名前つきの 形（top に あって 主語に 名前が ある とき）、ほかは 70% で top の ◎・30% で 当てはまる kind ぜんぶの ◎。
 * ×：当てはまる kind の × から、当てはまる kind の どれかの ◎ でも ある 文を のぞいて 選ぶ。
 */
export const candidates = (
	kinds: readonly JkKind[],
	top: JkKind,
	subject: string | null,
	rand: JkRand,
	used: JkUsed,
): JkOpt[] => {
	const fresh = (a: readonly string[]) => {
		const f = a.filter((s) => !used.best.has(s));
		return f.length ? f : a;
	};
	const bestPool = uniq(kinds.flatMap((k) => JK_RES[k].best));
	const topPool = JK_RES[top]?.best ?? bestPool;
	const nickForm = JK_RES[top]?.nick;
	const b =
		nickForm && subject && rand() < 0.4
			? fillText(nickForm, { nick: subject })
			: pickOne(fresh(rand() < 0.7 ? topPool : bestPool), rand);
	used.best.add(b);
	const okFresh = JK_OK.filter((s) => !used.ok.includes(s));
	const o = pickOne(okFresh.length ? okFresh : JK_OK, rand);
	used.ok.push(o);
	while (used.ok.length > 2) used.ok.shift();
	const isBest = (s: string) => kinds.some((k) => JK_RES[k].best.includes(s));
	let missPool = uniq(kinds.flatMap((k) => JK_RES[k].miss)).filter(
		(s) => !isBest(s),
	);
	if (!missPool.length)
		missPool = uniq(Object.values(JK_RES).flatMap((r) => r.miss)).filter(
			(s) => !isBest(s),
		);
	const recent = new Set(used.miss);
	const mf = missPool.filter((s) => !recent.has(s));
	const m = pickOne(mf.length ? mf : missPool, rand);
	used.miss.push(m);
	while (used.miss.length > 3) used.miss.shift();
	const opts: JkOpt[] = [
		{ text: b, fit: "best" },
		{ text: o, fit: "ok" },
		{ text: m, fit: "miss" },
	];
	for (let i = opts.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[opts[i], opts[j]] = [opts[j], opts[i]];
	}
	return opts;
};

// ───────────────── 実況民の 行 ─────────────────

/** 打つ 側が 得を する 種類（ほかは 守る 側）。 */
const GOOD_FOR_BAT: ReadonlySet<JkKind> = new Set([
	"HR",
	"hit",
	"timely",
	"run",
	"walk",
	"walkin",
	"steal",
	"request",
	"gyakuten",
	"kachikoshi",
	"douten",
	"walkoff",
	"E",
	"pinch",
	"chance",
]);

/** 名前の 入る 形（ほめる 形だけ。試験③ が これだけを 許す）。 */
export const PRAISE_POOLS: ReadonlySet<string> = new Set([
	"gen:batCheer",
	"gen:pitCheer",
	"gen:fieldCheer",
	"gen:walkCheer",
	"gen:respect",
	"gen:nextUp",
]);

const fan = (id: JkTeamId) => `fan:${id}`;
const pool = (id: JkTeamId, p: FanPool) => `fan:${id}:${p}`;

/** 得を した 側の 名前の 形（名前が なければ チームの 行）。 */
const praise = (
	play: JkPlay,
	ks: ReadonlySet<JkKind>,
	side: JkTeamId,
): JkReq => {
	const team: JkReq = { who: fan(side), pool: pool(side, "cheer") };
	const named = (form: string, nick: string | null | undefined): JkReq =>
		nick ? { who: fan(side), pool: `gen:${form}`, fill: { nick } } : team;
	if (ks.has("E") || ks.has("request") || ks.has("dp") || ks.has("sansha"))
		return team;
	if (ks.has("fine") || ks.has("laser") || ks.has("caught") || ks.has("defsub"))
		return named("fieldCheer", play.f);
	if (ks.has("walk") || ks.has("walkin")) return named("walkCheer", play.b);
	if (
		ks.has("HR") ||
		ks.has("hit") ||
		ks.has("timely") ||
		ks.has("walkoff") ||
		ks.has("steal") ||
		ks.has("pinch") ||
		ks.has("chance")
	) {
		if (play.b) return named("batCheer", play.b);
		const success = ks.has("HR") || ks.has("hit") || ks.has("timely");
		return success ? { who: fan(side), pool: "gen:nanashiHero" } : team;
	}
	if (ks.has("bigK") || ks.has("out") || ks.has("closer") || ks.has("relief"))
		return named("pitCheer", play.p);
	return team;
};

/** 得を した 側の チームの 行（本塁打 hr・自軍投手の 三振 k・リードが かわれば lead・守護神 closer・ほかは cheer）。 */
const teamGood = (ks: ReadonlySet<JkKind>, side: JkTeamId): JkReq => {
	const p: FanPool = ks.has("HR")
		? "hr"
		: ks.has("bigK")
			? "k"
			: ks.has("gyakuten") || ks.has("kachikoshi") || ks.has("walkoff")
				? "lead"
				: ks.has("closer")
					? "closer"
					: "cheer";
	return { who: fan(side), pool: pool(side, p) };
};

/**
 * 1つの 出来事への 実況民の 行（n 行の 頼み）。得を した 側 50%（チームの 行か 名前の 形）、損を した 側 25%
 * （groan 50%・相手の 名前の ある 主語への respect 30%・次の 打者への nextUp 20%。名前が なければ soft）、名無し 25%。
 * CM・ラッキー7 は 両軍の cm 行、試合終了は 勝った 側の win 2〜3・負けた 側の lose 1・名無しの「乙」「ええ試合や」。
 */
export const fanReqs = (
	play: JkPlay,
	game: Pick<JkGame, "home" | "away" | "final">,
	rand: JkRand,
	n: number,
): JkReq[] => {
	const out: JkReq[] = [];
	const bat = play.top ? game.away : game.home;
	const fld = play.top ? game.home : game.away;
	const ks = kindsOf(play);
	const nanashi: JkReq = { who: "nanashi", pool: "nanashi" };
	if (play.kind === "cm" || play.kind === "lucky7") {
		out.push({ who: fan(game.home), pool: pool(game.home, "cm") });
		out.push({ who: fan(game.away), pool: pool(game.away, "cm") });
		while (out.length < n) {
			const side = rand() < 0.5 ? game.home : game.away;
			out.push(
				rand() < 0.7 ? { who: fan(side), pool: pool(side, "cheer") } : nanashi,
			);
		}
		return out.slice(0, Math.max(n, 2));
	}
	if (play.kind === "gameset") {
		const [a, h] = game.final;
		const win = h > a ? game.home : a > h ? game.away : null;
		const lose =
			win === game.home ? game.away : win === game.away ? game.home : null;
		if (win && lose) {
			const k = 2 + Math.floor(rand() * 2);
			for (let i = 0; i < k; i++)
				out.push({ who: fan(win), pool: pool(win, "win") });
			out.push({ who: fan(lose), pool: pool(lose, "lose") });
		} else {
			out.push({ who: fan(game.home), pool: pool(game.home, "groan") });
			out.push({ who: fan(game.away), pool: pool(game.away, "groan") });
		}
		out.push({ who: "nanashi", pool: "end" }, { who: "nanashi", pool: "end" });
		return out;
	}
	if (play.kind === "sansha") {
		// 3人で 終わった：守った 側の 声と 攻めた 側の ため息
		for (let i = 0; i < n; i++) {
			const x = rand();
			out.push(
				x < 0.5
					? { who: fan(fld), pool: pool(fld, "cheer") }
					: x < 0.75
						? { who: fan(bat), pool: pool(bat, "groan") }
						: nanashi,
			);
		}
		return out;
	}
	const good = [...ks].some((k) => GOOD_FOR_BAT.has(k)) ? bat : fld;
	const bad = good === bat ? fld : bat;
	const top = [...ks].sort()[0];
	const subject =
		[...ks].map((k) => subjectOf(k, play)).find((s): s is string => !!s) ??
		(top ? subjectOf(top, play) : null);
	for (let i = 0; i < n; i++) {
		const x = rand();
		if (x < 0.5)
			out.push(rand() < 0.5 ? teamGood(ks, good) : praise(play, ks, good));
		else if (x < 0.75) {
			const y = rand();
			if (y < 0.5 || ks.has("E"))
				out.push({ who: fan(bad), pool: pool(bad, "groan") });
			else if (y < 0.8 && subject)
				out.push({
					who: fan(bad),
					pool: "gen:respect",
					fill: { nick: subject },
				});
			else if (bad === bat && play.next)
				out.push({
					who: fan(bad),
					pool: "gen:nextUp",
					fill: { nick: play.next },
				});
			else out.push({ who: fan(bad), pool: "gen:soft" });
		} else out.push(nanashi);
	}
	return out;
};

/** 窓の あいだの すぐの 反応（チームの cheer／groan だけ。2行）。 */
const quickReqs = (play: JkPlay, game: JkGame): JkReq[] => {
	const ks = kindsOf(play);
	const bat = play.top ? game.away : game.home;
	const fld = play.top ? game.home : game.away;
	if (play.kind === "cm" || play.kind === "lucky7" || play.kind === "gameset")
		return [
			{ who: fan(game.home), pool: pool(game.home, "cheer") },
			{ who: fan(game.away), pool: pool(game.away, "cheer") },
		];
	const good = [...ks].some((k) => GOOD_FOR_BAT.has(k)) ? bat : fld;
	const bad = good === bat ? fld : bat;
	return [
		{ who: fan(good), pool: pool(good, "cheer") },
		{ who: fan(bad), pool: pool(bad, "groan") },
	];
};

// ───────────────── テロップ ─────────────────

const POS_WORD: Readonly<Record<string, string>> = {
	捕: "キャッチャー",
	一: "ファースト",
	二: "セカンド",
	三: "サード",
	遊: "ショート",
	左: "レフト",
	中: "センター",
	右: "ライト",
};

const OUTS_WORD = ["ノーアウト", "ワンアウト", "ツーアウト"];

const basesWord = (b: JkBases | undefined): string => {
	const on = [0, 1, 2].filter((i) => b?.[i]);
	if (on.length === 3) return "満塁";
	if (!on.length) return "ランナーなし";
	return `${on.map((i) => "一二三"[i]).join("・")}塁`;
};

/** 打席の 札（『4番　ドカン』）。 */
export const batterTelop = (play: JkPlay): string =>
	play.b
		? fillText(JK_TELOP.batter, {
				order: String(play.order ?? 1),
				nick: play.b,
			})
		: fillText(JK_TELOP.batterN, { order: String(play.order ?? 1) });

/** プレーの テロップ（全角20字まで。悪い 結果には 名前を 入れない。エラーに 守備位置を 出さない）。 */
export const telopOf = (
	play: JkPlay,
	game: Pick<JkGame, "home" | "away" | "final">,
): string => {
	const T = JK_TELOP;
	const f = fillText;
	const dir = play.dir ?? "センター";
	const pos = POS_WORD[play.pos ?? ""] ?? "セカンド";
	const H = teamChar(game.home);
	const A = teamChar(game.away);
	switch (play.kind) {
		case "K":
			return play.look ? T.K[1] : T.K[0];
		case "BB":
			return T.BB;
		case "walkin":
			return T.walkin;
		case "1B":
			return f(T["1B"], { dir });
		case "2B":
			return f(T["2B"], { dir });
		case "3B":
			return T["3B"];
		case "HR":
			if ((play.rbi ?? 1) >= 4) return T.grandslam;
			return play.b ? f(T.HR, { nick: play.b, dir }) : f(T.HRN, { dir });
		case "GO":
			return (play.runs ?? 0) > 0 ? f(T.GOrun, { pos }) : f(T.GO, { pos });
		case "FO":
			return f(T.FO, { pos });
		case "sacfly":
			return T.sacfly;
		case "dp":
			return T.dp;
		case "E":
			return (play.runs ?? 0) > 0 ? T.Erun : T.E;
		case "fine":
			return f(T.fine, { nick: play.f ?? "名無し" });
		case "laser":
			return f(T.laser, { nick: play.f ?? "名無し" });
		case "request":
			return T.request;
		case "steal":
			return play.b ? f(T.steal, { nick: play.b }) : T.request;
		case "caught":
			return play.f ? f(T.caught, { nick: play.f }) : T.dp;
		case "closer":
			return f(T.closer, { nick: play.p ?? "名無し" });
		case "relief":
			return play.p ? f(T.relief, { nick: play.p }) : T.reliefN;
		case "reliefN":
			return T.reliefN;
		case "pinch":
			return play.b ? f(T.pinch, { nick: play.b }) : T.pinchN;
		case "pinchN":
			return T.pinchN;
		case "defsub":
			return f(T.defsub, { nick: play.f ?? "名無し" });
		case "chance":
			return f(T.chance, {
				outs: OUTS_WORD[play.outs] ?? OUTS_WORD[0],
				bases: basesWord(play.bases),
			});
		case "sansha":
			return T.sansha;
		case "cm":
			return T.cm;
		case "lucky7":
			return T.lucky7;
		case "walkoff":
			return f(T.walkoff, { team: H });
		case "gameset": {
			const [a, h] = game.final;
			return f(T.gameset, { home: H, away: A, h: String(h), a: String(a) });
		}
	}
};

/** 中継終了の 速報（12回まで だまって シムした 結果）。 */
export const sokuhoOf = (
	game: Pick<JkGame, "home" | "away" | "final" | "winner">,
): string => {
	const [a, h] = game.final;
	return game.winner
		? fillText(JK_TELOP.sokuho, {
				team: teamChar(game.winner),
				h: String(h),
				a: String(a),
			})
		: fillText(JK_TELOP.sokuhoDraw, { h: String(h), a: String(a) });
};

// ───────────────── 色 ─────────────────

const lab = (hex: string): [number, number, number] => {
	const c = [1, 3, 5]
		.map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
	const [r, g, b] = c;
	const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
	const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
	const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
	const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
	return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};

/** 2つの 色の ΔE76。 */
export const deltaE = (a: string, b: string): number => {
	const [p, q] = [lab(a), lab(b)];
	return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

/** 名無しの 札の 色。 */
export const NANASHI_COLOR = "#6a6a78";

/** ホームと ビジターの ファン色（近すぎたら ビジターは alt）。 */
export const fanColor = (
	home: JkTeamId,
	away: JkTeamId,
): { home: string; away: string } => {
	const h = JK_TEAMS[home].colors;
	const a = JK_TEAMS[away].colors;
	return { home: h.fan, away: deltaE(h.fan, a.fan) < 30 ? a.alt : a.fan };
};

// ───────────────── pool ─────────────────

const FAN_POOLS: readonly FanPool[] = [
	"cheer",
	"groan",
	"hr",
	"k",
	"lead",
	"closer",
	"cm",
	"taunt",
	"lurk",
	"win",
	"lose",
];

const buildPools = (): JkPools => {
	const p: Record<string, readonly string[]> = {
		nanashi: JK_NANASHI,
		end: ["乙", "ええ試合や"],
	};
	for (const fit of ["best", "ok", "miss"] as const)
		p[`reply:${fit}`] = JK_REPLIES[fit];
	for (const [k, v] of Object.entries(JK_GENERIC)) p[`gen:${k}`] = v;
	for (const id of JK_TEAM_IDS) {
		const team = teamChar(id);
		const f = JK_FANS[id];
		for (const k of FAN_POOLS) p[pool(id, k)] = f[k];
		p[pool(id, "cheer")] = [
			...f.cheer,
			...JK_FAN_ANY.cheer.map((s) => fillText(s, { team })),
		];
		p[pool(id, "groan")] = [
			...f.groan,
			...JK_FAN_ANY.groan.map((s) => fillText(s, { team })),
		];
		p[`lurk:${id}`] = [...f.lurk, ...f.taunt];
		for (const other of JK_TEAM_IDS) {
			if (other === id) continue;
			const m = JK_TAUNTS[`${id}>${other}`] ?? JK_TAUNTS[`${id}>*`];
			p[`card:${id}>${other}`] = m ? uniq([m, ...f.taunt]) : f.taunt;
		}
	}
	return p;
};

/** ナイター実況の pool（「fan:tora:cheer」「gen:batCheer」「reply:best」「card:g>tora」「lurk:koi」など）。 */
export const YAKYU_POOLS: JkPools = buildPools();

// ───────────────── 時間割 ─────────────────

/** 区切りの 中身（TV と 1000 の 行が 読む）。score は [ビジター, ホーム]。 */
export type YData = {
	readonly kind: YSegKind;
	readonly play?: JkPlay;
	readonly inn: number;
	readonly top: boolean;
	readonly score: readonly [number, number];
	readonly outs: number;
	readonly bases: JkBases;
	/** 窓の いちばんの 種類（窓の 区切りだけ）。 */
	readonly winTop?: JkKind;
	readonly telop?: string;
	/** 中継終了の あと（速報の 札）。 */
	readonly cut?: boolean;
};

const REPLIES = {
	best: { pool: "reply:best", n: [2, 4] },
	ok: { pool: "reply:ok", n: [1, 1] },
	miss: { pool: "reply:miss", n: [1, 2] },
} as const;

/** 窓を 出した 見せ場の 行の 数。 */
const heldCount = (heat: number) => Math.min(8, 2 + Math.round(heat * 4));

/**
 * 試合 → 実況の 時間割。熱の 曲線で 区切りの 群衆の 重みを 決め、窓には 候補 3つ・閉じた あとの 行、
 * 窓の ない 出来事には 反応、どの 区切りにも ふだんの 流れ（名無し 60%・よその 球団 15%・カードの 軽口 10%・両軍の cheer 15%）。
 * rand は 候補・行の 頼みを 決める（UI は Math.random、試験は 種つき）。
 */
export const yakyuTimeline = (game: JkGame, rand: JkRand): JkTimeline => {
	const ys = yakyuSegs(game);
	const w = heatWeights(ys.segs, JK_SHOW.HEAT_GAIN, JK_SHOW.HEAT_HALF);
	const used = freshUsed();
	const others = JK_TEAM_IDS.filter(
		(id) => id !== game.home && id !== game.away,
	);
	const lurkers: JkTeamId[] = [
		others.includes("tora") ? "tora" : pickOne(others, rand),
	];
	while (lurkers.length < 2) {
		const x = pickOne(others, rand);
		if (!lurkers.includes(x)) lurkers.push(x);
	}
	const filler = [
		{ who: "nanashi", pool: "nanashi", p: 0.6 },
		{ who: fan(lurkers[0]), pool: `lurk:${lurkers[0]}`, p: 0.075 },
		{ who: fan(lurkers[1]), pool: `lurk:${lurkers[1]}`, p: 0.075 },
		{ who: fan(game.home), pool: `card:${game.home}>${game.away}`, p: 0.05 },
		{ who: fan(game.away), pool: `card:${game.away}>${game.home}`, p: 0.05 },
		{ who: fan(game.home), pool: pool(game.home, "cheer"), p: 0.075 },
		{ who: fan(game.away), pool: pool(game.away, "cheer"), p: 0.075 },
	];
	let score: readonly [number, number] = game.pre.score;
	let outs = 0;
	let bases: JkBases = [false, false, false];
	let inn = 7;
	let top = true;
	let cut = false;
	const segs: JkSeg[] = ys.segs.map((s, i) => {
		if (s.kind === "half" && s.half) {
			inn = s.half.inn;
			top = s.half.top;
			outs = 0;
			bases = [false, false, false];
		}
		if (s.kind === "chukei") cut = true;
		const play = s.play;
		if (play && s.kind !== "window") {
			score = play.score;
			if (
				play.kind !== "cm" &&
				play.kind !== "lucky7" &&
				play.kind !== "gameset"
			) {
				outs = play.outs;
				bases = play.bases ?? bases;
			}
			inn = play.kind === "gameset" ? inn : play.inn;
			top = play.kind === "gameset" ? top : play.top;
		}
		if (play?.kind === "gameset") score = game.final;
		const data: YData = {
			kind: s.kind,
			play,
			inn,
			top,
			score,
			outs,
			bases,
			winTop: s.prompt?.top,
			telop: play ? telopOf(play, game) : undefined,
			cut,
		};
		const base = {
			start: s.start,
			dur: s.dur,
			w: w[i],
			scene: s.kind,
			data,
			filler,
		};
		if (s.prompt) {
			const pr = s.prompt;
			const subject = subjectOf(pr.top, pr.play);
			const opts = candidates(pr.kinds, pr.top, subject, rand, used);
			const alt = uniq(pr.kinds.flatMap((k) => JK_RES[k].best));
			const win: JkPick = {
				type: "pick",
				id: `w${i}`,
				opts,
				open: 4000,
				weight: pr.practice ? 0 : 1,
				...(pr.practice ? { practice: 10 } : {}),
				after: { replies: REPLIES, echo: { who: "nanashi", n: [1, 2], alt } },
				quick: pr.play ? quickReqs(pr.play, game) : [],
				held: pr.play ? fanReqs(pr.play, game, rand, heldCount(s.heat)) : [],
				meta: { kinds: pr.kinds, top: pr.top, subject },
			};
			return { ...base, win };
		}
		if (play && s.kind === "play") {
			const ks = [...kindsOf(play)];
			const minor = ks.every((k) => k === "hit" || k === "out" || k === "walk");
			const heat = JK_HEAT[ks.length ? ks[0] : "minor"] ?? 0.08;
			const n =
				!ks.length && !["cm", "lucky7", "gameset"].includes(play.kind)
					? 0
					: minor
						? rand() < 0.5
							? 1
							: 0
						: 1 + Math.round(Math.max(heat, s.heat) * 2);
			return n ? { ...base, react: fanReqs(play, game, rand, n) } : base;
		}
		return base;
	});
	return { segs, overlays: [], total: ys.total, P: ys.P };
};

// ───────────────── 決まり ─────────────────

/** 試合の 決まり（スレタイ・1000 の 行は 球団の 1字）。 */
export const yakyuRules = (
	game: Pick<JkGame, "home" | "away" | "final">,
): JkRules => {
	const H = teamChar(game.home);
	const A = teamChar(game.away);
	return {
		goal: 1,
		idle: 0.6,
		post: 0.44,
		boost: 0.8,
		comboMin: 3,
		comboDen: 0.3,
		fit: { best: 1, ok: 0.5, miss: 0.15 },
		speed: [
			[1000, 1],
			[2000, 0.85],
			[4000, 0.7],
		],
		reveal: 800,
		wave: 800,
		watchHold: 1500,
		windowMode: "blocking",
		interactive: true,
		hold: 998,
		roll: {
			// 1000 は 勝って いる 側の 実況民（同点なら ホーム）
			at1000: (v) => {
				const sc = (v.seg?.data as YData | undefined)?.score ?? game.final;
				const lead = sc[0] > sc[1] ? game.away : game.home;
				return {
					who: fan(lead),
					text: fillText(JK_THREAD.get1000, { team: teamChar(lead) }),
				};
			},
			title: (n) =>
				fillText(JK_THREAD.title, { home: H, away: A, n: String(n) }),
			label: (n) => `Part${n}`,
			next: (n) => fillText(JK_THREAD.next, { m: String(n) }),
			took999: JK_THREAD.took999,
			gap: { best: 0, ok: 0, miss: 0, none: 0 },
			flow: 2500,
		},
		display: { perRes: 0.3, min: 0.8, max: 6, burst: 12, burstReduced: 4 },
		writer: { recent: 12, caps: { fan: 3, nanashi: 4 }, repeatOk: [] },
		quitNote: JK_FEEDBACK.quit,
	};
};

/** 札の 字と 色（スレの 名札）。 */
export const yakyuWho = (
	game: Pick<JkGame, "home" | "away">,
): ((who: string) => { char: string; color: string }) => {
	const c = fanColor(game.home, game.away);
	return (who) => {
		if (who === "me") return { char: "★", color: "#ffe060" };
		if (who.startsWith("fan:")) {
			const id = who.slice(4) as JkTeamId;
			const color =
				id === game.home
					? c.home
					: id === game.away
						? c.away
						: JK_TEAMS[id]?.colors.fan;
			return { char: teamChar(id), color: color ?? NANASHI_COLOR };
		}
		if (who === "sys") return { char: "", color: "#ff6a4a" };
		return { char: "名", color: NANASHI_COLOR };
	};
};

/** 試験の 帯（SPEC の 最終の 値。5000試合の シムから）。 */
export const YAKYU_BANDS = {
	kami: { kanso: [1, 1] },
	jouzu: { kanso: [0.95, 1] },
	shoshin: { kanso: [0.75, 1] },
	random: { kanso: [0, 0.3] },
	miru: { kanso: [0, 0], res: [560, 720] },
	/** 初心者の 完走率の P の 帯ごとの 差の 上限。 */
	pSpread: 0.1,
} as const;

/** TV と 板の 小さな 字（テロップ・メニューの ほか）。 */
export const JK_TV = {
	/** 板の 題（{home}・{away} は 球団の 1字）。 */
	board: "ナイター実況　{home}－{away}",
	/** ヒント。 */
	hint: "↑↓　えらぶ　A　書きこむ　B　やめる",
	/** 見るだけの ヒント。 */
	hintWatch: "B　とじる",
	/** 候補の 引き出しの アクセシブルな 名前。 */
	picks: "書きこむ　レスを　えらぶ",
	/** ヘッダー（{no} は いまの スレの レス番、{ikioi} は カンマ区切り）。 */
	res: "レス　{no}／1000",
	ikioi: "勢い　{ikioi}",
	/** イントロの 題・イニングスコアの 計。 */
	title: "ナイター中継",
	total: "計",
	/** 半イニングの 札。 */
	half: "{inn}回{tb}",
	top: "表",
	bottom: "裏",
	change: "チェンジ",
	/** 結果カードの ボタン。 */
	close: "とじる",
} as const;
