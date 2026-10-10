// 施設の 台の 遊び（ゲームセンター「連コ」の 筐体・カジノ「ガチャ」の 台・海の家・バー。1台に 1つずつ 別の ゲーム。
// data/village/facilities.ts の 部屋の 物）。物の 名前（room.things の 値）が そのまま ゲームの 名前で、plays は
// どれも "arcade"。ui/facilities.ts は play が "arcade" なら ui/arcade.ts の arcadePlay に 物の 名前を わたす。
// どれも 寄り道で、強さ・道具・ゴールド・売上・町の 段には 何も 効かない（記録は ハイスコアだけ）。
// カジノの 台は 店が 貸す「遊びの チップ」で 遊ぶ（お金は 賭けない。チップは 席を 立つと 返す）。

export const ARCADE_GAMES = [
	// ── ゲームセンター「連コ」
	"shooter", // 奥の 1台目：シューティング「荒らし撃退」
	"drive", // 奥の 2台目：レースゲーム「保守ドライブ」
	"breakout", // 奥の 3台目：ブロックくずし「スレ崩し」
	"mole", // 奥の 4台目：もぐらたたき「ROMたたき」
	"fighter", // 奥の 5台目：格ゲーの 対戦台「レスバトル」（乱入を 待つ 名無しの 横）
	"slot", // まんなかの 左：メダルゲーム「メダルスロット」（メダルを すった 名無しの 前）
	"runner", // まんなかの 右：ジャンプアクション「なんJラン」
	"rhythm", // 音ゲーの 台「保守ビート」
	// ── カジノ「ガチャ」
	"gacha", // 奥の スロット 10台：ガチャスロット（目押し なし。リーチ・確定の 演出）
	"highlow", // カードの 台：ハイ＆ロー（ディーラーの 横）
	"roulette", // ルーレット：赤・黒・緑に 賭ける
	// ── ほかの 施設
	"suika", // 海の家「age」の クーラーボックス：スイカ割り（目かくしで 名無しの 声を たよりに）
	"glassSlide", // バー「次スレ」の カウンターの グラス：グラス滑らせ（客の 前で 止める）
] as const;

export type ArcadeGame = (typeof ARCADE_GAMES)[number];

/** どの 施設の 物か（試験が 置き場所を 見る）。 */
export const ARCADE_HOME: Record<ArcadeGame, string> = {
	shooter: "arcade",
	drive: "arcade",
	breakout: "arcade",
	mole: "arcade",
	fighter: "arcade",
	slot: "arcade",
	runner: "arcade",
	rhythm: "arcade",
	gacha: "casino",
	highlow: "casino",
	roulette: "casino",
	suika: "umi",
	glassSlide: "bar",
};

export const isArcadeGame = (k: string | undefined): k is ArcadeGame =>
	k !== undefined && (ARCADE_GAMES as readonly string[]).includes(k);
