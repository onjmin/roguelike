// 施設の 台の 遊び（ゲームセンター「連コ」の 筐体・カジノ「ガチャ」の 台・海の家・バー。1台に 1つずつ 別の ゲーム。
// data/village/facilities.ts の 部屋の 物）。物の 名前（room.things の 値）が そのまま ゲームの 名前で、plays は
// どれも "arcade"。ui/village/facilities.ts は play が "arcade" なら ui/arcade/arcade.ts の arcadePlay に 物の 名前を わたす。
// どれも 寄り道で、強さ・道具・ゴールド・売上・町の 段には 何も 効かない（記録は ハイスコアだけ）。
// カジノの 台は 店が 貸す「遊びの チップ」で 遊ぶ（お金は 賭けない。チップは 席を 立つと 返す）。

export const ARCADE_GAMES = [
	// ── ゲームセンター「連コ」
	"shooter", // 奥の 1台目：シューティング「荒らし撃退」
	"drive", // 奥の 2台目：レースゲーム「おんJドライブ」
	"breakout", // 奥の 3台目：ブロックくずし「スレ崩し」
	"mole", // 奥の 4台目：もぐらたたき「ROMたたき」
	"fighter", // 奥の 5台目：格ゲーの 対戦台「レスバトル」（乱入を 待つ 名無しの 横）
	"slot", // まんなかの 左：メダルゲーム「メダルスロット」（メダルを すった 名無しの 前）
	"runner", // まんなかの 右：ジャンプアクション「なんJラン」
	"rhythm", // 音ゲーの 台「おんJビート」
	// ── カジノ「ガチャ」
	"gacha", // 奥の スロット 10台：ガチャスロット（目押し なし。リーチ・確定の 演出）
	"highlow", // カードの 台：ハイ＆ロー（ディーラーの 横）
	"roulette", // ルーレット：赤・黒・緑に 賭ける
	// ── ほかの 施設
	"suika", // 海の家「age」の クーラーボックス：スイカ割り（目かくしで 名無しの 声を たよりに）
	"glassSlide", // バー「次スレ」の カウンターの グラス：グラス滑らせ（客の 前で 止める）
	// ── キリコの 家の 家具（ちょっとした できごとで もらう。data/village/myhome.ts の EVENT_GIFTS）
	"platform", // 横スクロールの 筐体：スーパーキリコ
	"bomber", // ボンバーの ゲーム機：荒らし爆破
	// ── キリコの 家の 家具（リサイクルショップで 買う。1つの 家具に 1つの ゲーム。2026-10-13）
	"snake", // 赤い 筐体：安価スネーク（>>を つないで 伸びる）
	"stack", // 青い 筐体：スレ積み（落ちものパズル）
	"crossing", // 緑の 筐体：道路わたり（車を よけて 向こう岸へ）
	"gomoku", // 碁盤：五目並べ（名無しと 打つ）
	"hasami", // 将棋盤：はさみ将棋（名無しと 指す）
	"mines", // ノートパソコン：地雷スレ（マインスイーパー）
	"grass", // デスクトップの パソコン：大草原2048（草を あわせて 育てる）
	"taiko", // 太鼓：おんJ太鼓（BGMの 譜面に あわせて たたく）
	"simon", // ターンテーブル：音おぼえ（光った 順を まねる）
	"pong", // ブラウン管と ゲーム機：ピンポン（名無しと 打ちあう）
	"kurohige", // 樽：イッチ危機一髪（剣を 刺して イッチを 飛ばさない）
	"kingyo", // バケツ：金魚すくい（ポイが 破れる 前に）
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
	platform: "myhome",
	bomber: "myhome",
	snake: "myhome",
	stack: "myhome",
	crossing: "myhome",
	gomoku: "myhome",
	hasami: "myhome",
	mines: "myhome",
	grass: "myhome",
	taiko: "myhome",
	simon: "myhome",
	pong: "myhome",
	kurohige: "myhome",
	kingyo: "myhome",
};

export const isArcadeGame = (k: string | undefined): k is ArcadeGame =>
	k !== undefined && (ARCADE_GAMES as readonly string[]).includes(k);
