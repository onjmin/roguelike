// 効果音。RPGEN の mp3（rpgen-search の CDN を id で直リンク）と、海外ミームの 音（pub:assets/se/meme。myinstants から
// 落とした もの。長い 音は 頭だけ 切り出して ある。出どころは README の クレジット）。
// ミームの 音は 寸劇・語りの 演出だけに 使う（2026-10-23 作者「ゲームの 効果音には 採用せず 寸劇に 多用する」）。
// 行の hit（ツッコミ）か se（Line.se・StoryPage.se）で 鳴らす。迷宮・村の しくみの 音には 使わない
// 多くは unj-reze の DQ プリセット（components/game-presets/dq.ts）と同じ素材（蓄音キリコの大冒険と共通）。
// 括弧内は RPGEN 上の素材名。
// 区分ごとに大きさの目標がある（data/audio/loudness.ts）。足したり替えたりしたら pnpm loudness で測り直す
// （測るまでは、既定の音量で 0.3 倍のまま鳴り、区切り待ちもしない）。
// 毎ターン鳴る音（足音など）は置かない（ダッシュの邪魔。鳴らすなら ui 区分＝待ちなしにする）。

import type { Emote, Hit } from "../../engine/emote";
import type { SeKind } from "./loudness";

/** 海外ミームの 音（public/assets/se/meme）。 */
const M = (name: string) => `pub:assets/se/meme/${name}.mp3`;

const byKind: Record<SeKind, Record<string, string>> = {
	/** メニューの操作音。何度も鳴るので控えめ。待たない。 */
	ui: {
		cursor: "rpgen:GklUsK", // ﾄﾞﾗｸｴｶｰｿﾙ
		decide: "rpgen:GklUsK", // ﾄﾞﾗｸｴｶｰｿﾙ
		/** キャンセル・「それはできない」。 */
		cancel: "rpgen:uZc2MS", // キャンセル
	},
	/**
	 * 感情の 記号（engine/emote.ts）の 添え音。会話の たびに 鳴るので ui より 小さく、短く、待たない。
	 * 鳴らす 間引きは engine/audio.ts の emoteSe。
	 */
	emote: {
		/** ！ おどろき・気づき。 */
		emoteBang: "rpgen:j8uwLx", // 反応音
		/** ？ ふしぎ・まよい（上がって 下がる 短い ぴぴぴ）。 */
		emoteQuestion: "rpgen:A0BsRk", // 質問
		/** ♪ ごきげん（のぼる 分散和音）。 */
		emoteNote: "rpgen:rlDCFo", // [マリオRPG]いいもの
		/** ♥ すき（ちゅっ）。 */
		emoteHeart: "rpgen:FZyGqb", // kiss
		/** 汗 あせり（しずくの ぽちゃん）。 */
		emoteSweat: "rpgen:aCOtzT", // 水音
		/** 怒 いらいら（ぶっ）。 */
		emoteAnger: "rpgen:vsXmNp", // buzz
		/** 花 しあわせ（きらきら 降りる 鈴）。 */
		emoteFlower: "rpgen:VDnXCJ", // chimes
		/** 得 得意気（きらん。上がる 音）。 */
		emoteSmug: "rpgen:sTJ89N", // 上昇
		/** 青 青ざめ（ずーん）。 */
		emotePale: "rpgen:BgVj0r", // ショック音
		/** 冷 冷や汗（しずくの ぽちゃん。汗と 同じ）。 */
		emoteCold: "rpgen:aCOtzT", // 水音
		/** 驚 ツッコミの 驚き（反応音。ふつうは hit の 音と いっしょに 鳴る）。 */
		emoteBurst: "rpgen:j8uwLx", // 反応音
	},
	/** 移動・拾う・回復。 */
	field: {
		// ── 建物の 出入り（入口の 作りで 音を かえる。建物ごとの 割りあては data/village/facilities.ts の doorSe・data/town/rooms.ts の ROOM_DOOR_SE）
		/** おんJ 本館の 扉（rpg と 同じ 素材）。 */
		door: "rpgen:8gPREU", // ﾄﾞﾗｸｴ扉
		/** 木の 扉（小屋・喫茶・バー・海の家 など）。 */
		doorWood: "rpgen:wUHfmk", // RPGEN 扉を開ける音1（木）
		/** 重い 金属の 扉（銀行・金庫 など）。 */
		doorSteel: "rpgen:HMyV1k", // RPGEN 扉を開ける音2（鉄）
		/** 自動ドア（コンビニ・映画館 など）。 */
		autoDoor: "rpgen:FVgGfX", // 自動ドア
		/** 引き戸（のれんの 店・銭湯・碁会所・道場）。 */
		slideDoor: "rpgen:xGCo1O", // [チョコレート☆]ガラララッ
		/** ワープの罠・場所がえ。 */
		warp: "rpgen:vfCmoe",
		/** 物を ガタっと 動かす（ゲームセンターの クレーン・倉庫番）。 */
		trolley: "rpgen:YnXEbT", // ガタっと動かす音
		stairs: "rpgen:gO9HUJ", // 階段
		/** 落とし穴に 落ちる。 */
		fall: "rpgen:7DJdSZ", // 落ちる
		/** 武器・盾・指輪・矢を 装備した・外した（のろわれていたら curse だけ）。 */
		equip: "rpgen:s4Y8HY", // [ツクール]装備
		/** 道具を 足もとに 置いた。 */
		put: "rpgen:kRaKfN", // [ポケ]着地
		/** 道具が こわれた（鯖の 鉱山の つるはし）。 */
		breakTool: "rpgen:0yyTSP", // 魔界村-鎧壊れる
		/** アイテム・ゴールドを拾った。 */
		item: "rpgen:gbcHf7", // ﾄﾞﾗｸｴ宝箱
		/** HP の回復・満腹度の回復。 */
		heal: "rpgen:n0UqyV", // ﾄﾞﾗｸｴ5回復
		/** 食べる（3口ぶん続けて鳴らす）。 */
		eat: "rpgen:DjrP3h", // 食べる音
		/** おなかが へってきた・ぺこぺこ・目が まわる の 知らせ。 */
		hungry: "rpgen:v9OmBl", // お腹の鳴る音
		/** 草を飲む。 */
		drink: "rpgen:QMyArQ", // 飲み音
		/** スレを読む。 */
		read: "rpgen:DkePps", // 紙をめくる音
		/** 喫茶の マスターが 一杯を まぜる（くるくる 回る あいだ）。 */
		mix: "rpgen:M7lnrK", // [マリオRPG]ドラムロール
		/** まぜた 一杯が 泡だつ。 */
		bubble: "rpgen:RSetbN", // 泡の音1
		/** グラスを 置く。 */
		glass: "rpgen:IQXvTI", // チーン
		/** 代金を 払う（店・自販機・銭湯・家・株 など。遊びの 台に 入れる ときは arcCoin）。 */
		pay: "rpgen:FM2G43", // [ツクール]売買
		/** 賭けや ガチャで 当たって コインが 返ってくる（大勝ちは victory）。 */
		payout: "rpgen:rIBCz6", // コインの音（マリオ）
		/** 相場が 跳ね上がった。 */
		rise: "rpgen:sTJ89N", // 上昇
		/** 相場が 下がった。 */
		drop: "rpgen:PLsNO9", // 下降
		/** 不意の できごと（為替の ショック）。 */
		alert: "rpgen:SmEIvE", // 発見音
		// ── ゲームセンターの 筐体（ui/arcade/arcade*.ts）
		/** メダル・コインを 入れる（どの 台も はじめに。スロットは 回す たび）。 */
		arcCoin: "rpgen:alktAh", // スロットのコイン投入音
		/** 弾を 撃つ（シューティング）。 */
		arcShot: "rpgen:95bF44", // [マリオRPG]ファイアボール
		/** 荒らし・スレの 札を くずす（シューティング・ブロックくずし）。 */
		arcBlock: "rpgen:wsdfpV", // マリオ3-ブロック
		/** 跳ぶ。 */
		arcJump: "rpgen:RJwe7P", // [ツクール]ジャンプ
		/** カードを めくる（カジノの ハイ＆ロー）。 */
		cardFlip: "rpgen:h50BUS", // マリオ3-カード
		/** グラスが 割れた（バーの グラス滑らせ）。 */
		glassBreak: "rpgen:h5RBbR", // 皿が割れる音
		// ── 語りの 効果音（data/story の StoryPage.se。村の 場面で 地の文の 前に 鳴る）
		/** 押しボタン（討論会の 追いだきの 連打）。 */
		pushButton: "rpgen:dwe4PP", // スイッチの音？
		/** 間の ぬけた オチ（討論会で 全員 のぼせて 浮く）。 */
		chiin: "rpgen:Wb0Nzr", // ち～ん(笑)
		/** 草が 生える（後日談の「草が　生えた」を 音に する）。 */
		kusa: "rpgen:1oU7sv", // [Minecraft]草1
		/** 鉛筆で 書く（怪文書・遺影）。 */
		pencil: "rpgen:ZDkMVz", // writing_pencil
		// 映画の 演出（engine/sceneFx.ts の FX_SE）
		/** スローモーションに 入る。 */
		slowIn: "rpgen:SKcIq6", // 予告中
		/** 止め絵の 決めポーズ（時が 止まる）。 */
		timeStop: "rpgen:eOS6BV", // [DIO]時間停止SE
		/** 予告編の 字が 出る（どーん）。 */
		trailerHit: "rpgen:YMkEEw", // 予告大
		/** 時間が すこし とぶ（「1時間後。」の 頁。スポンジ・ボブの 札と いっしょに。engine/laterCard.ts）。 */
		fewMomentsLater: M("few-moments-later"), // A Few Moments Later
	},
	/** 戦闘の音（罠の炎・電撃も）。 */
	battle: {
		/** モンスターハウスに入った。 */
		encounter: "rpgen:qm03Mw", // [ﾄﾞﾗｸｴ6]エンカウント
		attackStart: "rpgen:n0fqek", // ﾄﾞﾗｸｴ攻撃時
		/** プレイヤーの攻撃が当たった。 */
		attack: "rpgen:7JKd21", // ﾄﾞﾗｸｴ攻撃
		enemyAttack: "rpgen:Ln5pje", // [ﾄﾞﾗｸｴ]敵攻撃時
		/** プレイヤーが攻撃を受けた。 */
		damage: "rpgen:bC3ZP1", // [ﾄﾞﾗｸｴ]敵攻撃（被弾）
		miss: "rpgen:AeNs0l", // ﾄﾞﾗｸｴﾐｽ
		/** 杖を振る・スレを読む。 */
		spell: "rpgen:wGCfnC", // ﾄﾞﾗｸｴ呪文
		/** 敵をたおした。 */
		enemyDown: "rpgen:DApPoE", // 撃破音
		// ── ツッコミの 音（engine/emote.ts の Hit。行に hit を 書くと 窓の 前に 鳴る。BGM の 上に 聞こえる 大きさ）
		/** ぺしっ（軽く はたく。例え・皮肉・寄り添い）。 */
		hitSlap: "rpgen:Qy7A0i", // 拍子木
		/** デデドン（青ざめる 受け手・ガーン）。 */
		hitSting: "rpgen:LR6pVk", // デデドン！
		/** 逃げる・吹き飛ばす。 */
		flee: "rpgen:FTCG4H", // 逃走
		/** 道具を 盗まれた（盗んだ 敵が 逃げていく）。 */
		steal: "rpgen:cAauAI", // 何かが逃げる
		fire: "rpgen:HyTVhK",
		shock: "rpgen:usF2l8",
		/** トラばさみに はさまれた（ネ申マイクの 当たる 音とは 別に。同じだと 抜けた あとも 鳴って 聞こえる）。 */
		bearTrap: "rpgen:Q1CAWo", // 噛みつく音
		// ── キリコに かかる 悪い 状態（トルネコ1のように 音でも わかるように）
		/** 眠った（眠りガスの罠・眠り草・眠りの呪文）。 */
		sleep: "rpgen:Adwsg4", // [ツクール]催眠
		/** のろわれた装備を 身につけた・外せない。 */
		curse: "rpgen:WiZ0AR", // [ツクール]デバフ
		/** のろいが とけた（のろい解きスレ・ほかの スレで のろいが 消えた）。 */
		uncurse: "rpgen:FMcGao", // [ツクール]聖2
		/** 延命スレで 板が 錆びなくなった。 */
		rustproof: "rpgen:jVuw6M", // [ツクール]バフ
		/** 腹筋スレで 武器が ＋1（武器が きたえられた。作者の 指示：専用の 音）。 */
		whet: "rpgen:pMekYY", // [Minecraft]金床修繕
		/** 耐久スレで 板が ＋1（板が かたく なった）。 */
		temper: "rpgen:VocXum", // FF 盾ガード
		/** トリップ（指輪）を 装備した（作者の 指示：専用の 音。外すときは ふつうの 装備の 音）。 */
		tripOn: "rpgen:3c5WT6", // FF 魔法効果
		/** 目つぶし・混乱・ちから／最大HP・レベルが 下がった・板が 錆びた。 */
		debuff: "rpgen:NQtzgI", // [ツクール]麻痺
		/** アイテムを投げる。 */
		throw: "rpgen:3JcWxQ", // 爆弾を投げる（unj-reze の onj-reze プリセット）
		// ── キリコの攻撃（武器ごと。data/items.ts の sound）。当たったら hit_*、空振り・はずれたら swing_*
		// （トルネコ1と同じく、はずれは 振った音だけ）。頭の無音は とばして鳴らす（engine/audio.ts）
		swing_fist: "rpgen:BQhjMK", // 空振り
		swing_blade: "rpgen:hFhBTQ", // 剣を振るう音
		swing_blunt: "rpgen:Cz7Sg7", // バールを振る
		hit_fist: "rpgen:7rPdXL", // [マリオRPG]パンチ
		hit_club: "rpgen:M7xnmE", // [マリオRPG]ハンマー
		hit_copper: "rpgen:7JKd21", // ﾄﾞﾗｸｴ攻撃
		hit_puyusword: "rpgen:KVa5St", // ビーム斬撃2（ぷゆゆソード）
		hit_steel: "rpgen:mLgxu0", // ドルアーガ/攻撃
		hit_bat: "rpgen:sne8yX", // 金属バット
		hit_wyrm: "rpgen:mLHxrK", // ドルアーガ/斬る
		hit_star: "rpgen:eIw6qU", // FF 剣攻撃
		hit_mic: "rpgen:mL4xt3", // サイクロップス/謎の金属音
		// ── 敵の攻撃。当たったら damage、はずれたら enemyMiss（キリコの はずれ・空振りとは 別の音）
		enemyMiss: "rpgen:DUvPmQ", // ミス
		// ── 敵の 特技（なぐる 代わりに 出す。core/monster.ts の useSkill。鳴り終わってから 効き目）
		/** にょっす牛の 冷笑（ちから−1）。 */
		skill_poison: "rpgen:2RJYrq", // [ツクール]ブザー・ブブー
		/** 忍法帖エラー（レベル−1）。 */
		skill_drainLv: "rpgen:h9iBuH", // XP致命的なエラー
		/** 文字化け（最大HP／最大ちから−）。 */
		skill_drainMax: "rpgen:2QAYI6", // ホラー電子音
		/** 風吹けば名無し（ワープさせる）。 */
		skill_warpPlayer: "rpgen:Ye4E4T", // [ツクール]風系
		/** 論破厨・パン兵長・祭りの親分マシー（2マス 吹きとばす）。 */
		skill_knockback: "rpgen:W7Z0Eh", // 倒れる/ぶつかる音
		/** 削除人（装備を はがす ほか）。 */
		skill_purge: "rpgen:miex8X", // ﾄﾞﾗｸｴ冒険の書が消えた
		/** 粘着アンチ（装備を のろう）。 */
		skill_curse: "rpgen:86GRZP", // 桃/呪い
		/** 解音ゼロの 機体が 止まった（バトンタッチの はじめ。ui/dungeon/play.ts の batonScene）。 */
		batonDown: "rpgen:0JNThb", // [ポケ]PC終了
		/** 解音ゼロの 次の 機体が 起動した（バトンタッチ）。 */
		batonUp: "rpgen:0JDT7S", // [ポケ]PC起動
		/** 筐体の 自機が やられた・ぶつかった（シューティング）。 */
		arcCrash: "rpgen:YHEG4T", // 自機爆発音1
	},
	/**
	 * 寸劇の 海外ミームの 音（行の hit・meme。engine/emote.ts）。会話の 上で 何度も 鳴るので、戦いの 音より
	 * 小さく する（2026-10-23 作者「うるさい」）。SE_AFTER の 音は 台詞が 出きってから 鳴る。
	 */
	meme: {
		/** ドゥーン（言いきった ひとことの 直後・とんでもない 一文の あと）。 */
		hitBoom: M("vine-boom"), // VINE BOOM
		/** ブラ…（あきれる。力の ぬけた 一言）。 */
		hitBruh: M("bruh"), // BRUH
		/** ハァ？（わけが わからない 聞きかえし）。 */
		hitHuh: M("huh-cat"), // Huh Cat
		/** キュッ（話の 腰を 折る・待った）。 */
		hitScratch: M("record-scratch"), // Record scratch
		/** ボーン（重い オチ）。 */
		hitBong: M("taco-bell"), // Taco Bell Bong
		/** ダン・ダン・ダーン（とんでもない 真相）。 */
		hitDun: M("dun-dun-dun"), // dun dun dunnn
		/** 大げさな「オーマイガー」（やらかしに 気づいた）。 */
		memeOmg: M("omg"), // ooohhh my goood
		/** 絶叫「ファーーー」（やらかした 瞬間）。 */
		memeFahhh: M("fahhh"), // FAHHHH
		/** 「アァァァーッ」（落ちる・飛ばされる・逃げる）。 */
		memeAughhh: M("aughhh"), // AUGHHHHH
		/** 「ウッ」（Roblox。やられた・ぶつかった）。 */
		memeOof: M("oof"), // ROBLOX oof
		/** マイクラの ダメージ音（小さく 痛い）。 */
		memeHurt: M("mc-hurt"), // Minecraft Hurt
		/** 「えっ！？」（不意を つかれる）。 */
		memeShocked: M("shocked"), // Shocked sound
		/** アニメ声の「わぁ〜お」（感心・ありがたみの ない 驚き）。 */
		memeWow: M("anime-wow"), // Anime Wow
		/** 「イッピー！」（ささやかな 喜び）。 */
		memeYippee: M("yippee"), // yippee
		/** 「ノープ」（きっぱり 断る・こばむ）。 */
		memeNope: M("nope"), // nope.avi
		/** 「出ていけ！」（追いだす）。 */
		memeGetOut: M("get-out"), // Tuco: GET OUT
		/** 「ヒーヒー！」（いたずら・してやったり）。 */
		memeHeeHee: M("hee-hee"), // Michael Jackson Hee Hee
		/** Windows XP の エラー音（話が 通じない・頭が 止まる）。 */
		memeError: M("xp-error"), // Windows XP Error
		/** 社会信用 −999 の サイレン（大失点）。 */
		memeSocialCredit: M("social-credit"), // -999 Social Credit Siren
		/** Apple Pay の 支払い音（お金が 動く）。 */
		memePay: M("apple-pay"), // Apple Pay
		/** 「チーン」（できあがり・ひらめき）。 */
		memeDing: M("ding"), // ding
		/** いびき（寝る・寝てる）。 */
		memeSnore: M("snore"), // Snore mimimimimimi
		/** 役職発表（低く した。SE_RATE。正体・役目が 明かされる）。 */
		memeReveal: M("among-us"), // Among Us role reveal
		/** 子どもたちの「イェーイ」（歓声）。 */
		memeYay: M("kids-yay"), // Kids saying yay
		/** 「ハレルヤ〜」（救われた・ありがたい）。 */
		memeHallelujah: M("hallelujah"), // Hallelujah
		/** 棺桶ダンス（おしまい・お葬式）。 */
		memeCoffin: M("coffin-dance"), // Coffin Dance
		/** 宇宙へ 飛んでいく（スケールが 宇宙まで 行った）。 */
		memeGalaxy: M("galaxy"), // Galaxy meme
		/** Windows XP の 終了音（止まる・寝落ち・閉店）。 */
		memeShutdown: M("xp-shutdown"), // Windows XP shutdown
	},
	/** いちばん目立たせる音。 */
	impact: {
		critical: "rpgen:3xdWAT", // [ﾄﾞﾗｸｴ3]会心の一撃
		/** 地雷・爆発。 */
		explosion: "rpgen:HydVaH",
	},
	/** 短い曲（ファンファーレ）。 */
	jingle: {
		/** モンスターハウスを片づけた など。 */
		victory: "rpgen:tSHy6V", // ﾄﾞﾗｸｴ戦闘終了
		/** キリコの レベルが 上がった（迷宮だけ。ほかの 節目には 下の 音を 使う）。 */
		levelup: "rpgen:JrcaUb", // ﾄﾞﾗｸｴﾚﾍﾞﾙｱｯﾌﾟ
		/** 町が 1段 育った・通りが よみがえった。 */
		townUp: "rpgen:j9vwuH", // 桃/昇段
		/** 仲間が 加わった。 */
		join: "rpgen:CvnSzp", // 桃/ファンファーレ
		/** 大事な 物を 受けとった（家の 鍵・クレーンの レア景品）。 */
		keyItem: "rpgen:b0CZFw", // [ポケ]アイテム取得
		/** 大物を とった（釣り堀）。 */
		caught: "rpgen:yxcrTx", // [ポケ]捕獲成功
		/** 遊びの 面・局を 越えた・やりとげた（次の 波・解けた・ライバルを ぬいた・腹筋 おわり）。 */
		clear: "rpgen:ocdl2r", // [マリオ64]スコア達成
		/** 当たり・正解（言葉を 見つけた・ジャスト・レーン）。 */
		correct: "rpgen:WOh0Q7", // [ポケ]クイズo
		/** 波に のった（連勝・コンボ・フィーバー・役）。 */
		combo: "rpgen:9UiF46", // 桃/絶好調
		/** できあがりの 合図（プリクラの シート）。 */
		chime: "rpgen:th6yCr", // [ツクール]チャイム・ピンポン
		/** ホームラン（花火と いっしょに）。 */
		cracker: "rpgen:JDSaUd", // クラッカー
		/** 力尽きた。 */
		wipeout: "rpgen:rEaCCP", // [ﾄﾞﾗｸｴ]全滅
		/** ジョジョの 引き（寸劇の 場面エフェクト "tbc"。engine/sceneFx.ts。曲は 止め絵が 消える ころに 終わる）。 */
		toBeContinued: M("to-be-continued"), // To be Continued (jojo)
		/** 中断（セーブ）。 */
		save: "rpgen:jVOw87", // [自然癒]セーブ
		/** 新しい階に着いた（システム音らしいチャイム）。 */
		chapter: "rpgen:thHyyN", // [ツクール]チャイム2
		/** 喫茶の 一杯が できあがった。 */
		served: "rpgen:wMSfsJ", // [ポケダン]レベルアップ
		/** 筐体の ゲームが はじまる（READY の あと）。 */
		arcStart: "rpgen:2GAYAx", // 魔界村-スタート
		/** 筐体の ハイスコアを こえた。 */
		arcBest: "rpgen:VvhXOb", // [マリオ]1UP
		/** 道具の なかまを はじめて 拾った ときの 手ほどき（村の スレの 書きこみ。BGM を 止めて 鳴らす）。 */
		guide: "rpgen:PhBNN2", // [マリオRPG]情報
	},
};

/** 感情の 記号ごとの 添え音（emote 区分の 名前）。「…」と 眠りの「z」は 音を 足さない（だまる・ねむる 記号）。 */
export const EMOTE_SE: Partial<Record<Emote, string>> = {
	"!": "emoteBang",
	"?": "emoteQuestion",
	"♪": "emoteNote",
	"♥": "emoteHeart",
	汗: "emoteSweat",
	怒: "emoteAnger",
	花: "emoteFlower",
	得: "emoteSmug",
	青: "emotePale",
	冷: "emoteCold",
	驚: "emoteBurst",
};

/**
 * ツッコミの 音（engine/emote.ts の Hit → 効果音の 名前）。whack・punch・zukko は 戦いの 音の 使いまわし
 * （ハンマー・げんこつ・落ちる）。
 */
export const HIT_SE: Record<Hit, string> = {
	slap: "hitSlap",
	whack: "hit_club",
	punch: "hit_fist",
	sting: "hitSting",
	zukko: "fall",
	boom: "hitBoom",
	bruh: "hitBruh",
	huh: "hitHuh",
	scratch: "hitScratch",
	bong: "hitBong",
	dun: "hitDun",
};

/**
 * 台詞が 出きってから 鳴らす 反応の 音（ui/village/village.ts の beatAndHit）。言った ことへの 反応なので、
 * 窓の 前に 鳴らすと ボケより 先に 聞こえて しまう（2026-10-23 作者「使い方が ところどころ 間違えている」）。
 */
export const SE_AFTER: ReadonlySet<string> = new Set([
	"hitBoom",
	"hitBruh",
	"hitHuh",
	"hitBong",
	"memeWow",
	"memeYay",
	"memeCoffin",
	"memeSocialCredit",
]);

/** 高さを かえて 鳴らす 音（再生の 速さの 倍率。1 より 小さいと 低く・ゆっくり）。 */
export const SE_RATE: Record<string, number> = {
	memeReveal: 0.85,
};

export const sfx: Record<string, string> = Object.fromEntries(
	Object.values(byKind).flatMap((g) => Object.entries(g)),
);

/** 効果音の区分（pnpm loudness が目標を引くのに使う）。 */
export const sfxKind: Record<string, SeKind> = Object.fromEntries(
	Object.entries(byKind).flatMap(([kind, g]) =>
		Object.keys(g).map((name) => [name, kind as SeKind]),
	),
);
