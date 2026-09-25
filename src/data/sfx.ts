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
		/** ワープの罠・場所がえ。 */
		warp: "rpgen:vfCmoe",
		stairs: "rpgen:gO9HUJ", // 階段
		/** アイテム・ゴールドを拾った。 */
		item: "rpgen:gbcHf7", // ﾄﾞﾗｸｴ宝箱
		/** HP の回復・満腹度の回復。 */
		heal: "rpgen:n0UqyV", // ﾄﾞﾗｸｴ5回復
		/** 食べる（3口ぶん続けて鳴らす）。 */
		eat: "rpgen:DjrP3h", // 食べる音
		/** 草を飲む。 */
		drink: "rpgen:QMyArQ", // 飲み音
		/** 巻物を読む。 */
		read: "rpgen:DkePps", // 紙をめくる音
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
		/** 杖を振る・巻物を読む。 */
		spell: "rpgen:wGCfnC", // ﾄﾞﾗｸｴ呪文
		/** 敵をたおした。 */
		enemyDown: "rpgen:DApPoE", // 撃破音
		/** 逃げる・吹き飛ばす。 */
		flee: "rpgen:FTCG4H", // 逃走
		fire: "rpgen:HyTVhK",
		shock: "rpgen:usF2l8",
		/** アイテムを投げる。 */
		throw: "rpgen:3JcWxQ", // 爆弾を投げる（unj-reze の onj-reze プリセット）
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
