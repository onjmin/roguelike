// BGM（MML）。蓄音キリコの大冒険（rpg）の曲をそのまま使っている（ラウドネスの表も rpg での実測）。
// 前奏（@0 が r1r1r1r1 で始まる4小節）のある曲は、2周目から前奏を飛ばしてループする（engine/audio.ts の hasIntro）。
// 歌入りの曲も playMML / studio.play では歌詞行（@@n）が除かれ、インストとして鳴る。
//
// ■ 大きさ（ラウドネス。data/loudness.ts）
// 曲ごとの大きさは MML の #volume=（曲全体の音量。dtm では振幅に比例）でそろえてある。
// 目標は、既定の BGM 音量（40）で I = -23 LUFS（sad・ending は静かな曲なので -24）。
// 測り方: 高音質（studio.play）で1ループを最終出力から録って I（ゲート付きの平均）を測る
// （BS.1770。既定の 40 では setVolume = #volume × 0.2）。
// 直し方: 新しい #volume = 今の #volume × 10^((目標 − 測った I) / 20) を整数に丸める。
// 曲を足したり書き換えたりしたら、測って同じ式で直す。#volume= 以外は変えない。
//
// | 曲       | 測った I | #volume | 直した後 |
// |----------|----------|---------|----------|
// | title    | -21.8    | 17 → 15 | -22.9    |
// | town     | -26.3    | 21 → 31 | -22.9    |
// | field    | -22.2    | 19 → 17 | -23.2    |
// | field2   | -18.6    | 28 → 17 | -22.9    |
// | dungeon  | -21.0    | 24 → 19 | -23.1    |
// | battle   | -22.3    | 19 → 17 | -23.2    |
// | boss     | -30.1    | 10 → 23 | -22.8    |
// | tense    | -30.1    | 15 → 34 | -23.0    |
// | lastboss | -17.1    | 50 → 25 | -23.1    |
// | sad      | -24.9    | 26 → 29 | -24.0    |
// | ending   | -23.6    | 18 → 17 | -24.1    |
// （2026-09 測定。「直した後」は比例から出した値。勝利のジングル＝title の 21〜24 小節は M-max -21.2）
//
// 足した曲は pnpm dev の /dev/bgm.html（dev/bgm-measure.ts。ゲームと同じ形で1周鳴らして I を出す）で測った。
// この測り方では dungeon が -23.7 と出る（上の表より 0.6 低い）ので、足した曲は dungeon と同じ値にそろえた。
// 大きい #volume では dtm のリミッタで つぶれて比例しない（retro は 50 で -14.0、16 で -27.9）。測り直して決めること。
// | 曲       | 測った I          | #volume | 直した後 |
// |----------|-------------------|---------|----------|
// | retro    | -14.0（50）/-27.9（16）| 50 → 26 | -23.6    |
// | retro2   | -12.9（50）/-28.1（14）| 50 → 23 | -23.7    |
// 軽量モード（内蔵シンセ）は音色が違うので少しずれる。
// BGM の音量を 100 にすると +8 dB で、dungeon・field2 はピークが 0 dBFS 前後になり dtm のリミッタがかかる。

import battle from "./bgm/battle.mml?raw"; // b5ed6f97d24d49a4「ゲームっぽい」
import boss from "./bgm/boss.mml?raw"; // 028dced82045410e「歌抜いたら戦闘曲っぽい？」
import dungeon from "./bgm/dungeon.mml?raw"; // 5c8b9ca2c4514e10
import ending from "./bgm/ending.mml?raw"; // b312cbafed564277「変ト長調 (G♭) デュエット」
import field from "./bgm/field.mml?raw"; // 164e63f5f56643c2「何か」
import field2 from "./bgm/field2.mml?raw"; // 789ecdd88cb049f8「？」
import lastboss from "./bgm/lastboss.mml?raw"; // e2aae8c7641b40ab「短調バイオリン」
// うんｊレゼ の 名無し155 の曲（使ってよい曲として もらったもの）
import retro from "./bgm/retro.mml?raw"; // post/1316 の >>9 30b7932c9e1a4102「今回はメロディ手で書いたわ。正直こっちのが好き」
import retro2 from "./bgm/retro2.mml?raw"; // post/4891 a91d232600e24c6a「修正版。オクターブ計算ミスってメロディがガタガタやったの直した」
import sad from "./bgm/sad.mml?raw"; // 155deb066bc94429「イ短調（Aマイナー）」
import tense from "./bgm/tense.mml?raw"; // 1d9e7eed2db44ce7「荒ぶるメロディライン」
import title from "./bgm/title.mml?raw"; // 6c5cd6e3edc4433b「ゲーム音楽っぽい何か」
import town from "./bgm/town.mml?raw"; // 2826c0b1ce744003「？」

export const bgm: Record<string, string> = {
	title,
	town,
	field,
	field2,
	dungeon,
	battle,
	boss,
	sad,
	tense,
	lastboss,
	ending,
	retro,
	retro2,
};
