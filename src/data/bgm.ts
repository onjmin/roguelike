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
// | shallow3 | -31.9（20）        | 20 → 51 | -23.8    |
// | deep1    | -25.4（20）        | 20 → 24 | （比例） |
// | deep2    | -32.1（20）        | 20 → 53 | -23.7    |
// | deep3    | -29.4（20）        | 20 → 39 | -23.7    |
// | deep4    | -29.0（20）        | 20 → 37 | -23.7    |
// | deep5    | -26.1（20）        | 20 → 26 | （比例） |
// | deep6    | -26.0（20）        | 20 → 26 | （比例） |
// 軽量モード（内蔵シンセ）は音色が違うので少しずれる。
// BGM の音量を 100 にすると +8 dB で、dungeon・field2 はピークが 0 dBFS 前後になり dtm のリミッタがかかる。

import battle from "./bgm/battle.mml?raw"; // b5ed6f97d24d49a4「ゲームっぽい」
import boss from "./bgm/boss.mml?raw"; // 028dced82045410e「歌抜いたら戦闘曲っぽい？」
// 層ごとの曲（2026-09。作曲エージェントが dtm の手書き譜面 docs/handscore.md で書き、hand-compile で MML にした。
// 24小節の A/B/A' で、最後は 属和音か sus4 で 頭へ戻る。譜面は dtm/tmp/handscore/kiriko-<名前>.json）
import deep1 from "./bgm/deep1.mml?raw"; // もっと B1〜6 掘りかけの穴：ハ短調 128・retro_game・8beat（掘る動機の行進）
import deep2 from "./bgm/deep2.mml?raw"; // もっと B7〜12 保守の墓場：ト短調 90・orchestra（ライン・クリシェ、打楽器なし）
import deep3 from "./bgm/deep3.mml?raw"; // もっと B13〜18 文字化けの海：ニ・ドリア／変ロ・リディア 104・ambient_cloud・bossa
import deep4 from "./bgm/deep4.mml?raw"; // もっと B19〜24 落ちた鯖：ニ短調 150・cyber_punk・16beat
import deep5 from "./bgm/deep5.mml?raw"; // もっと B25〜29 名無しの荒野：ロ短調 140・rock・8beat
import deep6 from "./bgm/deep6.mml?raw"; // もっと B30 つづきの原盤：ニ短調→ニ長調 104・retro_game・4beat
import dungeon from "./bgm/dungeon.mml?raw"; // 5c8b9ca2c4514e10
import ending from "./bgm/ending.mml?raw"; // b312cbafed564277「変ト長調 (G♭) デュエット」
import field from "./bgm/field.mml?raw"; // 164e63f5f56643c2「何か」
import field2 from "./bgm/field2.mml?raw"; // 789ecdd88cb049f8「？」
import lastboss from "./bgm/lastboss.mml?raw"; // e2aae8c7641b40ab「短調バイオリン」
// うんｊレゼ の 名無し155 の曲（使ってよい曲として もらったもの）
import retro from "./bgm/retro.mml?raw"; // post/1316 の >>9 30b7932c9e1a4102「今回はメロディ手で書いたわ。正直こっちのが好き」
import retro2 from "./bgm/retro2.mml?raw"; // post/4891 a91d232600e24c6a「修正版。オクターブ計算ミスってメロディがガタガタやったの直した」
import sad from "./bgm/sad.mml?raw"; // 155deb066bc94429「イ短調（Aマイナー）」
import shallow3 from "./bgm/shallow3.mml?raw"; // ちょっと B9〜10 過去ログ倉庫：ホ短調 112・fantasy_rpg（ハープの雪、打楽器なし）
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
	shallow3,
	deep1,
	deep2,
	deep3,
	deep4,
	deep5,
	deep6,
};
