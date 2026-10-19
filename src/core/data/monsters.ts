// モンスターの定義。トルネコ1の32種の役割・数値・出る階（不思議のダンジョンの 27階と同じ。99階まで の敵は もっと の 30階まで）に沿って、
// rpg と同じ「おんJ・ネットの怪異」と ぷゆゆ・汎用の歩行グラ（RPGEN）を当てている。
// DQ の固有名は使わない。id は 図鑑・中断セーブの 鍵なので、名前と 合わなくても 変えない。

import type { DungeonId, MonsterDef } from "../types";

const M: MonsterDef[] = [
	// ───────── 浅い階 ─────────
	{
		id: "tousuko",
		name: "ぷゆゆ",
		sprite: "sa:DszPWT",
		hp: 5,
		atk: 2,
		def: 1,
		exp: 1,
		floors: [1, 3],
		weight: 64,
		abilities: [{ k: "slow" }],
		desc: "沈んだレスのすみの子。よちよちあるく。2ターンに1回しか動かない",
		flavor:
			"2ターンに1回しか動かない。のこりの1回は、こっちに手をふっている。なぐりにくい",
	},
	{
		id: "hitodama",
		name: "忘れスレの霊",
		sprite: "sa:xBroMV",
		// 守りは 低め（すばやいのに 硬いと、B1 で 何度も 空振りに 近い 1点が つづく）
		hp: 5,
		atk: 3,
		def: 5,
		exp: 2,
		floors: [1, 6],
		weight: 64,
		abilities: [{ k: "fastMove" }],
		tags: ["undead"],
		desc: "忘れられたスレの霊。すばやくただよう。なぐるのは1回",
		flavor: "成仏の条件は、レスが1つつくこと。「ｗ」だけでもいいと言っている",
	},
	{
		// 夏に 板へ 湧く 夏休みキッズ（夏厨）。絵は RPGEN の「夏休み勇者」
		id: "bat",
		name: "夏休みキッズ",
		sprite: "sa:I81vcW",
		hp: 7,
		atk: 3,
		def: 1,
		exp: 2,
		floors: [1, 6],
		weight: 64,
		abilities: [{ k: "random" }],
		desc: "夏休みではしゃいでいる。どこへ走っていくか自分でもわからない",
		flavor: "宿題は8月31日の自分がやる予定。その自分もいまここで走っている",
	},
	{
		// 見るだけで 書きこまない ROM専。絵は RPGEN の「メンダコぼっち」
		id: "funamushi",
		name: "ROM専",
		sprite: "sa:TGl1LN",
		hp: 7,
		atk: 2,
		def: 4,
		exp: 3,
		floors: [1, 6],
		weight: 64,
		abilities: [{ k: "shy" }],
		desc: "見ているだけ。近づくと逃げる。追いつめれば戦う",
		flavor:
			"10年見ている。書きこもうとしたことは3回。3回ともプレビューでやめた",
	},
	{
		id: "ksk",
		name: "kskボット",
		sprite: "sa:5T0QR7",
		// 2026-10-10 序盤を 易しく：攻撃 4 → 3・守り 9 → 5・加速まで 3 → 5ターン（倍速に なる 前に たおせるように）
		hp: 8,
		atk: 3,
		def: 5,
		exp: 5,
		floors: [2, 6],
		weight: 43,
		abilities: [{ k: "accel", after: 5 }],
		desc: "となりでやりあううちに加速する。長引かせずにたおすこと",
		flavor:
			"これまでに1000まで加速させたスレは300本。なんのスレだったかは1本も知らない",
	},
	{
		id: "neochi",
		name: "寝落ち民",
		sprite: "sa:83nRXJ",
		// 2026-10-10 序盤を 易しく：攻撃 6 → 5・眠りの呪文 1/4 → 1/6（眠らされて なぐられつづけるのが いちばん 理不尽）
		hp: 16,
		atk: 5,
		def: 11,
		exp: 12,
		floors: [2, 9],
		weight: 43,
		abilities: [{ k: "sleepSpell", rate: 1 / 6 }],
		sleep: "deep",
		desc: "なぐられるまで起きない。起きると眠りの呪文",
		flavor:
			"「まだ起きとるで」の2分後に「ｚｚｚ」と書きこむ。……書けているなら起きている",
	},
	{
		id: "pitcher",
		name: "ピッチャー",
		sprite: "sa:4rSOzo",
		hp: 9,
		atk: 4,
		def: 15,
		exp: 5,
		floors: [4, 9],
		weight: 32,
		abilities: [
			{
				k: "ranged",
				rate: 3 / 4,
				atk: 6,
				verb: "ボールを投げた",
				ball: true,
			},
		],
		desc: "まっすぐならぶとボールを投げてくる",
		flavor:
			"ストライクはまず入らない。なのに人の顔面にはかならず入る。本人も悩んでいる",
	},
	{
		// にょっす牛（🐮 の ネタ）は 冷笑系（真剣な人を 上から 茶化す）の 牛。
		// 冷笑で ちからを 下げる（セリフは core/monster.ts の SNEERS）。
		// 絵は RPGEN の「不良牛」sp:AXTDsXV から 組んだ 歩行グラ（scripts/make-reisho-ushi.mjs）。
		// 水分補給草を 投げると 50（トルネコ1の どくけしそう → おばけキノコ と 同じ 役）なので plant の まま
		id: "pumpkin",
		name: "にょっす牛",
		sprite: "pub:sprites/reisho_ushi.png",
		hp: 17,
		atk: 6,
		def: 8,
		exp: 6,
		floors: [4, 12],
		weight: 32,
		abilities: [{ k: "poison", rate: 1 / 3 }],
		tags: ["plant"],
		desc: "ときどきなぐる代わりに冷笑して、ちからを下げてくる",
		flavor:
			"自分の誕生日ケーキにも「きちーｗ」と言う。ろうそくはちゃんと自分で吹き消す",
	},
	{
		// 絵は「コピー」の アイコン（2枚 かさなった 紙）に 顔を つけた もの（scripts/make-copipe.mjs）
		id: "copipe",
		name: "コピペ",
		sprite: "pub:sprites/copipe.png",
		hp: 10,
		atk: 4,
		def: 15,
		exp: 7,
		floors: [4, 12],
		weight: 32,
		// 2026-10-10 序盤を 易しく：ふえる 1/2 → 1/3
		abilities: [{ k: "split", rate: 1 / 3 }],
		desc: "なぐってたおしきれないとふえる",
		flavor:
			"元ネタはだれも知らない。本人も知らない。なのに改行の位置だけは1字もずれない",
	},
	{
		id: "zonj",
		name: "ゾンJ民",
		sprite: "sa:LV9pUy",
		hp: 16,
		atk: 8,
		def: 19,
		exp: 15,
		floors: [5, 12],
		weight: 28,
		abilities: [{ k: "revive" }],
		tags: ["undead"],
		desc: "たおしても一度だけ起き上がる。草を投げつけてたおせば起きない",
		flavor:
			"「おんJ　引退します」スレを立てるのはこれで14回め。草を投げれば15回めはない",
	},
	// ───────── 中ほどの階 ─────────
	{
		id: "ufo",
		name: "拾い画UFO",
		sprite: "sa:HcYVTc",
		hp: 20,
		atk: 0,
		def: 16,
		exp: 10,
		floors: [7, 15],
		weight: 37,
		abilities: [{ k: "pickup" }],
		desc: "床の道具を回収して持ち歩く。たおせば落とす",
		flavor:
			"拾った道具にすかさず自分の名前を書く。「拾い画です」とも書く。正直ではある",
	},
	{
		id: "kaze",
		name: "風吹けば名無し",
		sprite: "sa:lcBiHO",
		hp: 23,
		atk: 8,
		def: 16,
		exp: 15,
		floors: [7, 18],
		weight: 37,
		abilities: [{ k: "warpPlayer", rate: 1 / 3 }],
		desc: "ときどきなぐる代わりに風を吹かせて、どこかへ吹きとばす",
		flavor:
			"風が吹けば桶屋がもうかる。こいつが吹けば、キリコが階の反対側にいる",
	},
	{
		id: "chimera",
		name: "自演くん",
		sprite: "sa:iHaD7p",
		hp: 27,
		atk: 18,
		def: 16,
		exp: 25,
		floors: [10, 15],
		weight: 32,
		abilities: [{ k: "retreat" }],
		desc: "弱ると逃げて傷をなおし、IDを変えてもどってくる",
		flavor:
			"IDを変えてもどってきて「通りすがりですが、さっきの人が正しい」と書く",
	},
	{
		// 出る階は 8 から（トルネコ1の 10 より 2つ 前）。強さ10で 自演くん・鋼メンタル・転載ガモ・風呂キャンセル界隈が
		// 一度に 加わり、風呂板 B12 に 入った 冒険の 4割が 倒れた（2026-10-04 ボット）。なぐって こない 2体を 先に 出して ほぐす
		// （鋼メンタルも 1つ あと。B12 で 倒れる 率 40% → 22%）
		id: "tensai",
		name: "転載ガモ",
		sprite: "sa:MrCnUI",
		hp: 40,
		atk: 0,
		def: 17,
		exp: 20,
		floors: [8, 18],
		weight: 28,
		abilities: [{ k: "steal", rate: 1 / 2 }],
		sleep: "deep",
		desc: "持ち物を盗んで消える。たおせば取り返せる",
		flavor: "盗んだ道具は、広告を27枚はって飾る。「無断転載禁止」の札もはる",
	},
	{
		// 出る階は 11 から（トルネコ1の 10 より 1つ あと。自演くんと 同じ 階に 出ないように。転載ガモの ところ）
		id: "knight",
		name: "鋼メンタル",
		sprite: "sa:j8Lwkw",
		hp: 35,
		atk: 12,
		def: 26,
		exp: 40,
		floors: [11, 18],
		weight: 28,
		abilities: [{ k: "armor" }],
		desc: "なにを言われても効かない。なぐる攻撃は半分しか通らない",
		flavor:
			"効いていないことを、3レスかけて説明してくる。4レスめから段落がつく",
	},
	{
		// 風呂に 入らない 子（X の「風呂キャンセル界隈」）。なぐらず、ふれた 板を 汚して 錆びさせるだけ
		// （ひとことは core/monster.ts の FUROCAN）。絵は とうすこ民（泥版）を くすませた もの（scripts/make-furocan.mjs）。
		// 投げた 草の 効き目は undead。
		// 出る階は 8 から（なぐって こないので 転載ガモと いっしょに 強さ10の 壁より 先に。転載ガモの ところ）
		id: "sabi",
		name: "風呂キャンセル界隈",
		sprite: "pub:sprites/furocan.png",
		hp: 30,
		atk: 6,
		def: 19,
		exp: 25,
		floors: [8, 20],
		weight: 28,
		abilities: [{ k: "rust", rate: 1 / 3 }],
		tags: ["undead"],
		desc: "風呂に入っていない。なぐってはこないが、ふれた板を汚して錆びさせる",
		flavor:
			"においで鉄の板が錆びる。科学ではまだ説明がつかない。説明したい人もいない",
	},
	{
		id: "metal",
		name: "メタルぷゆゆ",
		sprite: "pub:sprites/metal_puyu.png",
		hp: 3,
		atk: 24,
		def: 49,
		exp: 500,
		floors: [10, 30],
		weight: 1,
		abilities: [{ k: "metal" }, { k: "fastMove" }],
		tags: ["metal"],
		sleep: "never",
		drop: "h_growth",
		desc: "ダメージは1しか通らない。すぐ逃げる。たおすと忍法帖の実を落とす",
		flavor:
			"見つけた瞬間、実況スレが1分で200　伸びる。逃げられた瞬間、さらに300　伸びる",
	},
	{
		// 集団で 荒らしに 来る VIP の 住人（祭り・突撃）。
		// 絵は RPGEN の「やる夫」（VIP 生まれの AA）
		id: "yuki",
		name: "VIPPER",
		sprite: "sa:yQuruG",
		hp: 60,
		atk: 9,
		def: 3,
		exp: 10,
		floors: [13, 21],
		weight: 9,
		abilities: [{ k: "pack" }, { k: "fastMove" }],
		sleep: "deep",
		desc: "4体でたむろして眠っている。1体が起きるとみんな起きて突撃してくる",
		flavor:
			"4人で「VIPから来ました」と言う。うち1人はおんJ民。帰り道がわからなくなっただけ",
	},
	{
		id: "statue",
		name: "置物",
		sprite: "sa:VOpXq9",
		// 動きだす まで：前向きの 1コマで 目は 黒（scripts/make-statue.mjs）。ただの 置物も 同じ 絵
		still: "pub:sprites/statue_still.png#0,0,16,16",
		hp: 45,
		atk: 14,
		def: 27,
		exp: 50,
		floors: [13, 21],
		weight: 31,
		abilities: [{ k: "statue" }],
		sleep: "never",
		desc: "となりに来るまで動かない。ただの置物にまざっている",
		flavor:
			"ただの置物と見分ける方法は1つ。となりに立ってみること（おすすめしない）",
	},
	{
		// 絵は 燃えている スマホ（怒った 顔の 画面。scripts/make-enemies.mjs）
		id: "bomb",
		name: "炎上案件",
		sprite: "pub:sprites/enjo.png",
		hp: 70,
		atk: 10,
		def: 23,
		exp: 30,
		floors: [13, 27],
		weight: 31,
		abilities: [{ k: "explode" }],
		desc: "弱ると止まり、さらに弱ると炎上して爆発する",
		flavor:
			"謝罪文のスクショでもう一度燃える。火消しに来た人がいちばんよく燃える",
	},
	// ───────── 深い階 ─────────
	{
		// 「はい論破」の 論破厨。絵は RPGEN の J民の「メガネ」
		id: "golem",
		name: "論破厨",
		sprite: "sa:V7UXpN",
		hp: 52,
		atk: 24,
		def: 27,
		exp: 180,
		floors: [16, 24],
		weight: 27,
		abilities: [{ k: "knockback", rate: 1 / 3 }],
		desc: "ときどきなぐる代わりに論破して吹きとばす。壁にぶつかると痛い",
		flavor: "「はい論破」と言って相手を吹きとばす。物理なので、議論ではない",
	},
	{
		id: "ninpo",
		name: "忍法帖エラー",
		sprite: "sa:8WBRbo",
		hp: 36,
		atk: 10,
		def: 23,
		exp: 40,
		floors: [16, 25],
		weight: 27,
		abilities: [{ k: "drainLv", rate: 1 / 4 }],
		tags: ["doll"],
		desc: "ときどきなぐる代わりにレベルを1つうばっていく",
		flavor:
			"「忍法帖が破損しました」。3年かけたレベルが1になる。お知らせはこの1行だけ",
	},
	{
		// 動かずに 足を つかんで 離さない 役と、女の子の 絵に 合わせた 名前
		id: "kaso",
		name: "かまってちゃん",
		sprite: "sa:YkoESZ",
		hp: 72,
		atk: 5,
		def: 23,
		exp: 40,
		floors: [16, 26],
		weight: 27,
		abilities: [{ k: "grab" }],
		sleep: "never",
		desc: "動かない。となりに来ると足をつかんで離さない",
		flavor:
			"自分からは動かない。来てほしいので。来たら離さない。来てほしかったので",
	},
	{
		// 絵は 顔の ある 浮きと 釣り針（scripts/make-enemies.mjs）
		id: "bakefuda",
		name: "釣り",
		sprite: "pub:sprites/tsuri.png",
		hp: 50,
		atk: 18,
		def: 24,
		exp: 30,
		floors: [19, 27],
		weight: 31,
		abilities: [{ k: "mimic" }],
		desc: "道具のふりをして床にある。拾おうとすると釣られる",
		flavor:
			"「釣りではありません」と書いてある道具が、いちばん釣り。釣れると「乙」と言う",
	},
	{
		id: "kage",
		name: "透明あぼーん",
		sprite: "sa:AeCss3",
		hp: 60,
		atk: 13,
		def: 27,
		exp: 150,
		floors: [19, 27],
		weight: 31,
		abilities: [{ k: "invisible" }, { k: "random" }],
		tags: ["undead"],
		sleep: "never",
		desc: "見えない。ふらふらと動く",
		flavor:
			"NGにしたので見えない。でもレス番が1つとんでいるので、いるのはわかる",
	},
	{
		// 絵は RPGEN の「発狂J民」
		id: "oni",
		name: "顔真っ赤",
		sprite: "sa:UT7LXB",
		// キレる までは やきうの 絵（data/people/cast.ts の nanj）の「おんJ民」に 見える
		calm: { name: "おんJ民", sprite: "sa:4rSOzo" },
		hp: 51,
		atk: 38,
		def: 27,
		exp: 380,
		floors: [20, 27],
		weight: 27,
		abilities: [{ k: "touchy", rate: 1 / 5 }],
		desc: "ふだんはふつうのおんJ民に見える。なぐられた拍子や草を生やされると顔真っ赤になって倍速になる。そのかわり当たりにくい",
		flavor:
			"「顔真っ赤で草」と言われて「真っ赤ちゃうが」と返す。その時点で信号より赤い",
	},
	{
		id: "eye",
		name: "特定班",
		sprite: "sa:f5k9hM",
		hp: 62,
		atk: 23,
		def: 27,
		exp: 250,
		floors: [21, 29],
		weight: 27,
		abilities: [{ k: "gaze", rate: 1 / 4 }],
		desc: "目をつけられると混乱する",
		flavor:
			"写真の瞳にうつった電柱で、住所を当てる。自分の家の鍵は3日さがしている",
	},
	{
		id: "mojibake",
		name: "文字化け",
		sprite: "sa:OvRJbE",
		hp: 70,
		atk: 13,
		def: 24,
		exp: 150,
		floors: [22, 29],
		weight: 25,
		abilities: [{ k: "drainMax", rate: 1 / 2 }],
		tags: ["doll"],
		desc: "ときどきなぐる代わりにまとわりついて、最大HPか最大ちからを欠けさせる",
		flavor:
			"縺ｧ縺ｯ……。直して読むと「では、よろしくお願いします」。礼儀はただしい",
	},
	{
		// 絵は 怒った ふきだしと 残像（scripts/make-enemies.mjs）
		id: "ninja",
		name: "連投荒らし",
		sprite: "pub:sprites/rento.png",
		hp: 78,
		atk: 20,
		def: 23,
		exp: 600,
		floors: [23, 30],
		weight: 23,
		abilities: [{ k: "fastAct" }],
		desc: "1ターンに2回なぐってくる",
		flavor: "1回で言えばいいことを、2回言う。1回で言えばいいことを、2回言う",
	},
	{
		// 絵は むらさきの ねばねば（scripts/make-enemies.mjs）
		id: "fallen",
		name: "粘着アンチ",
		sprite: "pub:sprites/nenchaku.png",
		hp: 75,
		atk: 38,
		def: 29,
		exp: 750,
		floors: [24, 30],
		weight: 21,
		abilities: [{ k: "curse", rate: 1 / 4 }],
		desc: "ときどきなぐる代わりに装備に粘着してのろう",
		flavor:
			"嫌いなはずなのに、いちばんくわしい。誕生日も覚えている。祝いはしない",
	},
	{
		id: "wyvern",
		name: "ワイ バーン",
		sprite: "sa:by4ZL3",
		hp: 100,
		atk: 51,
		def: 30,
		exp: 3000,
		floors: [25, 30],
		weight: 21,
		abilities: [{ k: "breath", rate: 1 / 2, dmg: [17, 23] }],
		tags: ["dragon"],
		desc: "まっすぐならぶと炎を吐く",
		flavor: "「ワイ、竜やけど質問ある？」とスレを立てる。質問すると燃やされる",
	},
	// ───────── 植民地（板）だけの 敵。絵は 仮（scripts/make-colony-enemies.mjs・ART_TODO.md） ─────────
	// 出る階は その板の 何階ぶんの 強さか（data/dungeons.ts の level）。ほかの 板には 出ない
	{
		// パン松（村の 住人）の 軍勢。パン松の 正式名は パン兵 らしい（植民地一覧スレ）
		id: "panhei",
		name: "パン兵",
		sprite: "pub:sprites/panhei.png",
		hp: 12,
		atk: 4,
		def: 3,
		exp: 6,
		floors: [2, 7],
		weight: 40,
		abilities: [{ k: "swap", rate: 1 / 2 }],
		board: "shallow",
		desc: "パン松の軍勢。パンを押しつけて持ち物を1つ持ち去る。たおせば取り返せる",
		flavor:
			"道具をうばって、パンを置いていく。押し売りではない。お代はもらっていないので",
	},
	{
		id: "kinonyan",
		name: "きのにゃん",
		sprite: "pub:sprites/kinonyan.png",
		// 2026-10-10 序盤を 易しく：HP 18 → 14
		hp: 14,
		atk: 5,
		def: 4,
		exp: 9,
		floors: [2, 7],
		weight: 30,
		abilities: [{ k: "statue" }, { k: "armor" }],
		tags: ["plant"],
		sleep: "never",
		board: "kinoko",
		desc: "ふんぞりかえって動かない。近づくと動きだす。なぐる攻撃は半分",
		flavor:
			"「たけのこ」と聞こえたとたん動きだす。……近づいただけで、だれも言っていない",
	},
	{
		id: "ofurou",
		name: "おふ郎くん",
		sprite: "pub:sprites/ofurou.png",
		hp: 20,
		atk: 7,
		def: 6,
		exp: 20,
		floors: [4, 14],
		weight: 30,
		abilities: [{ k: "sleepSpell", rate: 1 / 4 }],
		board: "main",
		desc: "となりで湯気をあてて、のぼせさせて眠らせる",
		flavor:
			"湯船でやきうを実況しますの。延長戦になると、実況より先にのぼせますの",
	},
	{
		id: "denchan",
		name: "でんちゃん",
		sprite: "sa:pm3kvS",
		hp: 28,
		atk: 10,
		def: 8,
		exp: 40,
		floors: [6, 24],
		weight: 30,
		abilities: [{ k: "ranged", rate: 1 / 3, atk: 9, verb: "漏電した" }],
		board: "deep",
		desc: "まっすぐならぶと漏電してしびれさせる",
		flavor:
			"つかれた体を充電してくれる……と本人は言う。さわるとしびれる。残量はいつも1%",
	},
	{
		id: "natsuko",
		name: "ナツコ",
		sprite: "pub:sprites/natsuko.png",
		hp: 16,
		atk: 5,
		def: 5,
		exp: 30,
		floors: [2, 15],
		weight: 25,
		abilities: [{ k: "shy" }],
		tags: ["plant"],
		board: "tropical",
		desc: "ヤシの木の精。人見知りで、近づくと逃げる。追いつめると戦う",
		flavor:
			"ヤッシッシ～。人見知りなのに、島民6人全員と顔見知り。……6人しかいないので",
	},
	{
		id: "takonomin",
		name: "たこのみん",
		sprite: "sa:pmnkIf",
		hp: 22,
		atk: 8,
		def: 6,
		exp: 24,
		floors: [5, 18],
		weight: 30,
		abilities: [
			{ k: "breath", rate: 1 / 4, dmg: [5, 10], what: "熱々のたこ焼き" },
		],
		board: "konamono",
		desc: "まっすぐならぶと熱々のたこ焼きを飛ばしてくる",
		flavor:
			"😡に見えるのはたこ焼きの顔。怒ってはいない。熱々を顔に投げるのはただの親切",
	},
	{
		id: "mashii",
		name: "マシー",
		sprite: "pub:sprites/mashii.png",
		hp: 14,
		atk: 6,
		def: 4,
		exp: 12,
		floors: [4, 16],
		weight: 20,
		abilities: [{ k: "pack" }],
		board: "festival",
		desc: "祭りの仲間と4人でやってくる",
		flavor:
			"外で名乗るときは屯田兵。なにを開拓しに来たのかは、4人ともおぼえていない",
	},
	// ───────── ボス（目的が boss の 板の いちばん底に 1体だけ。data/dungeons.ts の boss） ─────────
	// 絵は その板の 敵の 絵を 1.5倍（同じ 階に 同じ 種類の 雑魚が いても 見分けが つく）。
	// floors は その板の いちばん底の 強さ（level）。ふつうの 階の 表には 出ない（monstersFor）。
	// 図鑑は 強さでは なく 本当の 階（その板の いちばん奥。ui/bookView.ts）を 出す。
	// 強さは pnpm sim -- --objective boss で「いちばん底に 着いた 冒険の 75〜90% が 勝つ」ように 合わせた。
	// パン板・きのこ板は ボットが 自力で 底まで 行ける（--n 200）。ほかの 4つは 自力では ほぼ 着かない
	// （100回で 0〜1）ので --reach（目的に たどりつくまで 倒れない・レベルは その階の 強さ − LAG まで 足す）で 見た。
	// LAG は ふつう 2（自力で もぐる ボットも その くらいで ついていく）、過疎の 離島は 5（敵も 経験値も 半分）。
	// 測った 値（2026-09-30。pnpm sim --n 200）：パン兵長 勝ち 89.8%（Lv3.3）・親玉きのにゃん 77.1%（Lv4.7）・
	// 怒れるナツコ 86.0%（--reach・LAG 5）・大たこのみん 83.0%・祭りの親分マシー 84.5%（--reach）。
	// 湯守おふ郎くん 80.3%（2026-10-18。12階の 大浴場で。--reach --n 300）。
	// ナツコは ふつうに 着く Lv10 で 合わせる（Lv13 で 合わせた 強さだと Lv10 では 45% しか 勝てない）。
	// 攻撃は 同じ 階の 雑魚より 弱め（1対1で 長く 戦うので。こわさは 息・飛び道具・吹きとばし・怒りで 出す）。
	{
		id: "boss_panhei",
		name: "パン兵長",
		sprite: "pub:sprites/panhei.png",
		scale: 1.5,
		boss: true,
		hp: 60,
		atk: 6,
		def: 6,
		exp: 25,
		floors: [4, 4],
		weight: 0,
		abilities: [{ k: "knockback", rate: 1 / 4 }],
		board: "shallow",
		desc: "パン兵をたばねる兵長。ときどきなぐる代わりに吹きとばす",
		flavor:
			"口ぐせは「パンに従え」。従っても吹きとばされる。そのあとパンはちゃんとくれる",
	},
	{
		id: "boss_kinonyan",
		name: "親玉きのにゃん",
		sprite: "pub:sprites/kinonyan.png",
		scale: 1.5,
		boss: true,
		// 2026-10-10 に 弱めた（HP 42 → 34・胞子 1/4 で 3〜7 → 1/5 で 2〜5）。きのこ板の 倒れた 冒険の 3割が この 親玉
		hp: 34,
		atk: 5,
		def: 8,
		exp: 25,
		floors: [5, 5],
		weight: 0,
		abilities: [
			{ k: "armor" },
			{ k: "breath", rate: 1 / 5, dmg: [2, 5], what: "胞子" },
		],
		board: "kinoko",
		desc: "きのこ板の親玉。まっすぐならぶと胞子を吐く。なぐる攻撃は半分",
		flavor:
			"「キリコはたけのこ派」の紙を3枚読んで信じた。4枚めでちょっとうたがいだした",
	},
	{
		id: "boss_natsuko",
		name: "怒れるナツコ",
		sprite: "pub:sprites/natsuko.png",
		scale: 1.5,
		boss: true,
		hp: 55,
		atk: 8,
		def: 12,
		exp: 50,
		floors: [8, 8],
		weight: 0,
		abilities: [
			{ k: "ranged", rate: 1 / 3, atk: 10, verb: "ヤシの実を投げた" },
		],
		board: "tropical",
		desc: "人見知りをやめたナツコ。まっすぐならぶとヤシの実を投げてくる",
		flavor:
			"ヤッシッシ～！島民が6人から7人にふえて、人見知りをやめた。7人めはキリコ",
	},
	{
		id: "boss_takonomin",
		name: "大たこのみん",
		sprite: "sa:pmnkIf",
		scale: 1.5,
		boss: true,
		hp: 85,
		atk: 7,
		def: 16,
		exp: 180,
		floors: [11, 11],
		weight: 0,
		abilities: [
			{ k: "breath", rate: 1 / 5, dmg: [6, 10], what: "熱々のたこ焼き" },
		],
		board: "konamono",
		desc: "鉄板の主。まっすぐならぶと熱々のたこ焼きを飛ばしてくる",
		flavor:
			"😡に見えるのはたこ焼きの顔。……今日はほんとうに怒っている。ソースとマヨの順番で",
	},
	{
		id: "boss_mashii",
		name: "祭りの親分マシー",
		sprite: "pub:sprites/mashii.png",
		scale: 1.5,
		boss: true,
		hp: 120,
		atk: 7,
		def: 20,
		exp: 380,
		floors: [12, 12],
		weight: 0,
		abilities: [{ k: "knockback", rate: 1 / 4 }, { k: "berserk" }],
		board: "festival",
		desc: "祭りをしきる親分。うちわで吹きとばし、弱ると怒って速くなる",
		flavor:
			"外で名乗るときは屯田兵長。祭りが終わってもひとりで残っている。片づけの係なので",
	},
	{
		id: "boss_ofurou",
		name: "湯守おふ郎くん",
		sprite: "pub:sprites/ofurou.png",
		scale: 1.5,
		boss: true,
		hp: 72,
		atk: 10,
		def: 15,
		exp: 750,
		floors: [13, 13],
		weight: 0,
		abilities: [
			{ k: "ranged", rate: 1 / 3, atk: 14, verb: "熱い湯をかけた" },
			{ k: "sleepSpell", rate: 1 / 10 },
		],
		board: "main",
		desc: "源泉を守る湯守。まっすぐならぶと熱い湯をかけ、となりでは眠らせる",
		flavor: "わたくし、42℃派の番頭でしてよ。41℃派の方は、お帰りあそばせ",
	},
	{
		// 電池板の 底の ラスボス（STORY.md §4.9）：14年 ひとりで 町を 盛り上げて きた 名無し。歩行グラは 村と 同じ 野球民
		id: "boss_yakiu",
		name: "やきう",
		sprite: "sa:4rSOzo",
		scale: 1.5,
		boss: true,
		hp: 100,
		atk: 10,
		def: 17,
		exp: 1200,
		floors: [14, 14],
		weight: 0,
		abilities: [
			{ k: "ranged", rate: 1 / 3, atk: 20, verb: "盛ったレスを投げつけた" },
		],
		board: "deep",
		desc: "14年ひとりで町を盛り上げてきた名無し。まっすぐならぶと、盛ったレスを投げつけてくる",
		flavor: "まだや。盛り上がりが足らん",
	},
	// ───────── 手合わせ（core/ambush.ts。ゼロの 挑戦を 受けると 深い 階で 3機が 待ちぶせる） ─────────
	// 1機ずつは 弱い。止めても ほかが 動いて いれば 再起動する ので、3機を そろえて 削る。絵は 主人公の ゼロと 同じ。
	// 勝ち（2026-10-18。pnpm sim -- --ambush zero --reach --n 150）：風呂板 85.3%・電池板 86.0%・おんたこ 63.3%（3回目の 再起動は 起きない。寄り道の 板は 着いた ときの 力が 弱い）。
	{
		id: "zero_main",
		name: "ゼロ",
		sprite: "pub:sprites/zero_main.png",
		boss: true,
		hp: 33,
		atk: 7,
		def: 10,
		exp: 40,
		floors: [8, 8],
		weight: 0,
		abilities: [{ k: "knockback", rate: 1 / 5 }],
		desc: "解音ゼロのメイン機。ときどき吹きとばす。止めても、のこりの機体が再起動する",
		flavor: "負けた回数も数えている。勝った回数より、ずっとていねいに",
	},
	{
		id: "zero_proto",
		name: "プロト",
		sprite: "sa:KxS5YZ",
		boss: true,
		hp: 27,
		atk: 6,
		def: 8,
		exp: 40,
		floors: [8, 8],
		weight: 0,
		abilities: [
			{ k: "ranged", rate: 1 / 4, atk: 9, verb: "計測ビームを撃った" },
		],
		desc: "ゼロのサブ機。まっすぐならぶと、計測ビームを撃ってくる",
		flavor: "キリコの歩幅を計測中ゼロ。……誤差0.3％ゼロ",
	},
	{
		id: "zero_ren",
		name: "レン",
		sprite: "pub:sprites/zero_ren.png",
		boss: true,
		hp: 23,
		atk: 6,
		def: 7,
		exp: 40,
		floors: [8, 8],
		weight: 0,
		abilities: [{ k: "fastMove" }],
		desc: "ゼロのサブ機。倍速で走りまわる",
		flavor:
			"アップデートしたら足が速くなった〜！……かわりに何か消えた気がする〜",
	},
	{
		// 書きかえた 中断セーブで もぐると 各階に 1体（ポケダンの カクレオン。core/floor.ts の HUNTER）。表には 出ない
		id: "sakujonin",
		name: "削除人",
		sprite: "sa:pMxknZ",
		hunter: true,
		hp: 999,
		atk: 60,
		def: 50,
		exp: 0,
		floors: [1, 99],
		weight: 0,
		abilities: [{ k: "fastAct" }, { k: "purge", rate: 1 / 2 }],
		sleep: "never",
		desc: "書きかえたセーブをかぎつけて各階にあらわれる。1ターンに2回動き、なぐる代わりに装備をはがす・ちからやレベルを下げる・混乱や目つぶし",
		flavor: "セーブを書きかえたことは、だれにも言っていない。……でも来た",
	},
];

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(
	M.map((m) => [m.id, m]),
);
export const MONSTER_LIST: readonly MonsterDef[] = M;

/** 板だけの 敵が その 板に 出るか（board は 1つか 並び。無ければ どの 板にも）。 */
export const onBoard = (m: MonsterDef, dungeon?: DungeonId): boolean =>
	!m.board ||
	(typeof m.board === "string"
		? m.board === dungeon
		: !!dungeon && m.board.includes(dungeon));

/** その階に出るモンスター（板だけの 敵は その板でだけ。ボスは 出ない）。 */
export const monstersFor = (depth: number, dungeon?: DungeonId): MonsterDef[] =>
	M.filter(
		(m) =>
			!m.boss &&
			!m.hunter &&
			depth >= m.floors[0] &&
			depth <= m.floors[1] &&
			onBoard(m, dungeon),
	);

/** パン兵が はじめから 持っている パン（片親パン 3・ぷゆゆパン 1・チギュリパン 1 の 重みで 引く）。 */
export const SWAP_BREADS: readonly string[] = [
	"f_bread",
	"f_bread",
	"f_bread",
	"f_large",
	"f_moldy",
];
