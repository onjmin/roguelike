// ゲームセンター「連コ」の 筐体の 遊び（1台に 1つずつ 別の ゲーム。data/village/facilities.ts の 部屋の 物）。
// 物の 名前（room.things の 値）が そのまま ゲームの 名前で、plays は どれも "arcade"。ui/facilities.ts は
// play が "arcade" なら ui/arcade.ts の arcadePlay に 物の 名前を わたす。
// どれも 寄り道で、強さ・道具・売上・町の 段には 何も 効かない（記録は ハイスコアだけ）。

export const ARCADE_GAMES = [
	"shooter", // 奥の 1台目：シューティング「荒らし撃退」
	"drive", // 奥の 2台目：レースゲーム「保守ドライブ」
	"breakout", // 奥の 3台目：ブロックくずし「スレ崩し」
	"mole", // 奥の 4台目：もぐらたたき「ROMたたき」
	"fighter", // 奥の 5台目：格ゲーの 対戦台「レスバトル」（乱入を 待つ 名無しの 横）
	"slot", // まんなかの 左：メダルゲーム「メダルスロット」（メダルを すった 名無しの 前）
	"runner", // まんなかの 右：ジャンプアクション「なんJラン」
	"rhythm", // 音ゲーの 台「保守ビート」
] as const;

export type ArcadeGame = (typeof ARCADE_GAMES)[number];

export const isArcadeGame = (k: string | undefined): k is ArcadeGame =>
	k !== undefined && (ARCADE_GAMES as readonly string[]).includes(k);
