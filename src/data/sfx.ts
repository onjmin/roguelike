// 効果音。RPGEN の mp3（rpgen-search の CDN を id で直リンク）。
// 多くは unj-reze の DQ プリセット（components/game-presets/dq.ts）と同じ素材（蓄音キリコの大冒険と共通）。
// 括弧内は RPGEN 上の素材名。
// 区分ごとに大きさの目標がある（data/loudness.ts）。足したり替えたりしたら pnpm loudness で測り直す
// （測るまでは、既定の音量で 0.3 倍のまま鳴り、区切り待ちもしない）。
// 毎ターン鳴る音（足音など）は置かない（ダッシュの邪魔。鳴らすなら ui 区分＝待ちなしにする）。

import type { SeKind } from "./loudness";

const byKind: Record<SeKind, Record<string, string>> = {
	/** メニューの操作音。何度も鳴るので控えめ。待たない。 */
	ui: {
		cursor: "rpgen:GklUsK", // ﾄﾞﾗｸｴｶｰｿﾙ
		decide: "rpgen:GklUsK", // ﾄﾞﾗｸｴｶｰｿﾙ
		/** キャンセル・「それはできない」。 */
		cancel: "rpgen:uZc2MS", // キャンセル
	},
	/** 移動・拾う・回復。 */
	field: {
		/** 扉を あける（村の おんJ 本館に 入る・出る。rpg と 同じ 素材）。 */
		door: "rpgen:8gPREU", // ﾄﾞﾗｸｴ扉
		/** ワープの罠・場所がえ。 */
		warp: "rpgen:vfCmoe",
		stairs: "rpgen:gO9HUJ", // 階段
		/** 落とし穴に 落ちる。 */
		fall: "rpgen:7DJdSZ", // 落ちる
		/** アイテム・ゴールドを拾った。 */
		item: "rpgen:gbcHf7", // ﾄﾞﾗｸｴ宝箱
		/** HP の回復・満腹度の回復。 */
		heal: "rpgen:n0UqyV", // ﾄﾞﾗｸｴ5回復
		/** 食べる（3口ぶん続けて鳴らす）。 */
		eat: "rpgen:DjrP3h", // 食べる音
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
		levelup: "rpgen:JrcaUb", // ﾄﾞﾗｸｴﾚﾍﾞﾙｱｯﾌﾟ
		/** 力尽きた。 */
		wipeout: "rpgen:rEaCCP", // [ﾄﾞﾗｸｴ]全滅
		/** 中断（セーブ）。 */
		save: "rpgen:jVOw87", // [自然癒]セーブ
		/** 新しい階に着いた（システム音らしいチャイム）。 */
		chapter: "rpgen:thHyyN", // [ツクール]チャイム2
		/** 喫茶の 一杯が できあがった。 */
		served: "rpgen:wMSfsJ", // [ポケダン]レベルアップ
	},
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
