// 村の 別ゲー（グラウンドの 1打席と ホームラン競争。中身は ui/minigames/batting.ts）の 入口。
// 冒険の 乱数・記録・リプレイには 触らない（村の 場面の 中だけ）。
// 文字は 1行 全角22字まで。板と 押しの 道具は ui/minigames/minigameBoard.ts、色は style.css の .mgame。

export { atBat, playDerby } from "./batting";
