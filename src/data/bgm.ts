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
// トラックごとの 設定（#t0comp= など）を 書いていない 曲も、前の 曲の 設定を 引きつがずに 既定で 鳴る（dtm 2.1.27 から。
// それまでは 前の 曲の コンプが 残って、足した 曲が 3 dB ほど 大きく なっていた）。
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
// | stone    | -29.8（20）        | 20 → 40 | -23.9    |
// | ruins    | -29.6（20）        | 20 → 39 | -23.9    |
// | white    | -28.7（20）        | 20 → 36 | -23.5    |
// | deep_dat     | -31.8（20）    | 20 → 51 | -23.7    |
// | deep_matome  | -31.3（20）    | 20 → 48 | -23.7    |
// | deep_hakushi | -30.9（20）    | 20 → 46 | -23.7    |
// | deep_kisei   | -32.5（20）    | 20 → 55 | -23.7    |
// | deep_koge    | -33.4（20）    | 20 → 61 | -23.8    |
// | deq_sea      | -33.9（20）    | 20 → 65 | -23.7    |
// | deq_volcano  | -33.2（20）    | 20 → 60 | -23.7    |
// | deq_strata   | -32.3（20）    | 20 → 54 | -23.6    |
// | deq_laundry  | -32.1（20）    | 20 → 53 | -23.7    |
// | deq_ice      | -34.9（20）    | 20 → 73 | -23.7    |
// （deq_* は 元の 譜面が #volume=80。20 に して 測り、直した 値で 測り直した）
// | kumori       | -21.4（23）    | 23 → 18 | -23.5    |
// | fukyowa      | -25.7（15）    | 15 → 19 | -23.5    |
// | kouseki      | -22.8（20）    | 50 → 18 | -23.7    |
// | speder2      | -19.7（20）    | 50 → 13 | -23.4    |
// | island       | -27.7（10）    | 10 → 14 | -24.7    |
// （2026-10。kouseki・speder2 は 元の 譜面が #volume=50 なので 20 に して 測った。island は dtm 2.1.32 で 測った。
// island は 高い 音域の ビブラフォン・チェレスタが ずっと 鳴って 耳に 刺さるので、ほかより 1 dB 小さく した）
// dtm 2.1.29 から studio.play でも #reverb= などの 全体の 残響と #drumfont= が 鳴る（それまでは 無視されていた）。
// 上げた ときに 全曲 測り直したが、どれも 目標から ±0.8 以内（boss +0.8・lastboss +0.6・ending +0.5、ほかは ±0.5）なので 直していない。
// 軽量モード（内蔵シンセ）は音色が違うので少しずれる。
// BGM の音量を 100 にすると +8 dB で、dungeon・field2 はピークが 0 dBFS 前後になり dtm のリミッタがかかる。

import battle from "./bgm/battle.mml?raw"; // b5ed6f97d24d49a4「ゲームっぽい」
import boss from "./bgm/boss.mml?raw"; // 028dced82045410e「歌抜いたら戦闘曲っぽい？」
// もっと の 層を トルネコ1の 刻み（11層）に 細かくしたときに 足した 5曲（2026-09。同じ 手書き譜面。譜面は dtm/tmp/handscore/kiriko-deep-<名前>.json）
import deep_dat from "./bgm/deep_dat.mml?raw"; // もっと B3〜4 埋もれた dat：ヘ短調 116・piano・8beat（掘る 連打の 動機）
import deep_hakushi from "./bgm/deep_hakushi.mml?raw"; // もっと B10〜12 白紙の回廊：嬰ハ短調 88・acoustic（打楽器なし。水滴の 副旋律）
import deep_kisei from "./bgm/deep_kisei.mml?raw"; // もっと B16〜18 規制の檻：嬰ト短調 120・japanese_wa・8beat（都節の 半音）
import deep_koge from "./bgm/deep_koge.mml?raw"; // もっと B22〜24 焦げた回線：ホ短調 144・orchestra・16beat
import deep_matome from "./bgm/deep_matome.mml?raw"; // もっと B5〜6 崩れたまとめ：変ロ短調 108・arabic_exotic・shuffle（増2度）
// 層ごとの曲（2026-09。作曲エージェントが dtm の手書き譜面 docs/handscore.md で書き、hand-compile で MML にした。
// 24小節の A/B/A' で、最後は 属和音か sus4 で 頭へ戻る。譜面は dtm/tmp/handscore/kiriko-<名前>.json）
import deep1 from "./bgm/deep1.mml?raw"; // もっと B1〜2 掘りかけの穴：ハ短調 128・retro_game・8beat（掘る動機の行進）
import deep2 from "./bgm/deep2.mml?raw"; // もっと B7〜9 保守の墓場：ト短調 90・orchestra（ライン・クリシェ、打楽器なし）
import deep3 from "./bgm/deep3.mml?raw"; // もっと B13〜15 文字化けの海：ニ・ドリア／変ロ・リディア 104・ambient_cloud・bossa
import deep4 from "./bgm/deep4.mml?raw"; // もっと B19〜21 落ちた鯖：ニ短調 150・cyber_punk・16beat
import deep5 from "./bgm/deep5.mml?raw"; // もっと B25〜29 名無しの荒野：ロ短調 140・rock・8beat
import deep6 from "./bgm/deep6.mml?raw"; // もっと B30 つづきの原盤：ニ短調→ニ長調 104・retro_game・4beat
// Dequivsia 系の 試作 v2（2026-09。作曲エージェントの 試作。ループは 曲全体＝前奏なし。音色を 替えた v3 を 作っているので、1曲 1ファイルで 差し替えやすく してある）
import deq_ice from "./bgm/deq_ice.mml?raw"; // 薄氷の回廊（氷系）：ホ短調 100・ambient_cloud（ベースの 3+3+2 オスティナート・チェレスタの 点・ビブラフォンの 旋律。中盤に 借用の F）
import deq_laundry from "./bgm/deq_laundry.mml?raw"; // 乾燥機がまわるあいだ（夜のコインランドリー系）：ハ短調 70・ambient_cloud（電子ピアノの 3+3+2 の 刻みが 乾燥機の 回転。C の 持続の 上で sus2→m7→sus4→madd9）
import deq_sea from "./bgm/deq_sea.mml?raw"; // 水底にさす光（海の底系）：ニ・ミクソリディア 126・ambient_cloud（Dsus2 と Csus2 を 2小節ずつ 揺らす。チェレスタの 積み5度・ビブラフォンの 疎な 旋律）
import deq_strata from "./bgm/deq_strata.mml?raw"; // ずれる地層（断層系）：イの 空5度 100・ambient_cloud（和音・低音・動機が 半音／全音ずつ 平行移動。中盤は 低音が 8分 ずれる。ハープ・チェロ・ビブラフォン）
import deq_volcano from "./bgm/deq_volcano.mml?raw"; // 活火山の底（活火山系）：ホ・フリギア 132（半分の ノリ）・ambient_cloud（低音が F→E→D を 2小節周期で 下りつづける。4小節ごとに 脈動の 細かさが 変わる）
import dungeon from "./bgm/dungeon.mml?raw"; // 5c8b9ca2c4514e10
import ending from "./bgm/ending.mml?raw"; // b312cbafed564277「変ト長調 (G♭) デュエット」
import field from "./bgm/field.mml?raw"; // 164e63f5f56643c2「何か」
import field2 from "./bgm/field2.mml?raw"; // 789ecdd88cb049f8「？」
// post/1318（AI作曲スレ）の 名無し2rt さんの 4曲（2026-10。title・town などと 同じ 人）。
// 保守村（段5 から。data/music.ts）＝kumori、電池板＝speder2（もとは deq_laundry）、おんたこ＝fukyowa（もとは deq_volcano）、
// お祭り会場＝kouseki（もとは deep_kisei の 使いまわし）
// 離島板＝island（もとは deq_sea。2026-10-05 の 5曲目。dtm 2.1.32 の 音色 ep_celesta を 使うので dtm を 上げた）
import fukyowa from "./bgm/fukyowa.mml?raw"; // 6367「Aメロ不協和音Bメロで終止させる典型的な構成」：ヘ短調 132・バイオリンと 矩形波の 16分の 分散和音
import island from "./bgm/island.mml?raw"; // 6395「ゲームで流れてたらテンション上がりそうなサビ」：ニ長調 131・ビブラフォン・チェレスタ・エレピ（前奏 12 小節）
import kouseki from "./bgm/kouseki.mml?raw"; // 6371「鉱石風respect」：変ニ長調 145・synth_pop・dance（シンセブラスの 主旋律）
import kumori from "./bgm/kumori.mml?raw"; // 6365「くもり空をパクったやつ」：ホ長調 116・retro_game（矩形波の 主旋律・クラビネットの 裏打ち）
import lastboss from "./bgm/lastboss.mml?raw"; // e2aae8c7641b40ab「短調バイオリン」
import retro from "./bgm/retro.mml?raw"; // post/1316 の >>9 30b7932c9e1a4102「今回はメロディ手で書いたわ。正直こっちのが好き」
import retro2 from "./bgm/retro2.mml?raw"; // post/4891 a91d232600e24c6a「修正版。オクターブ計算ミスってメロディがガタガタやったの直した」
// うんｊレゼ の 名無し155 の曲（使ってよい曲として もらったもの）。アップテンポなので 序盤ではなく、
// retro2 は 祭り（モンスターハウス）で 鳴らす。retro は 戦闘曲っぽいので ボス戦で 鳴らす（もとは 電池板）
// 本編の 層を トルネコ1の 刻みに 細かくしたときに 足した 3曲（2026-09。deep と 同じ 手書き譜面。譜面は dtm/tmp/handscore/kiriko-main-<名前>.json）
import ruins from "./bgm/ruins.mml?raw"; // 本編 B7〜9・ちょっと B7〜9 朽ちたまとめ跡：嬰ヘ短調 94・jazz_night・4beat（ページを めくる 動機）
import sad from "./bgm/sad.mml?raw"; // 155deb066bc94429「イ短調（Aマイナー）」
import shallow3 from "./bgm/shallow3.mml?raw"; // ちょっと B10 過去ログ倉庫：ホ短調 112・fantasy_rpg（ハープの雪、打楽器なし）
import speder2 from "./bgm/speder2.mml?raw"; // 6375「Speder2リスペクト」：嬰ハ短調 110・retro_game・dance（ビブラフォン・エレピ・オルゴール）
import stone from "./bgm/stone.mml?raw"; // 本編 B3〜4・ちょっと B3〜4 dat の石室：イ短調 104・acoustic・shuffle（足音の 動機）
import tense from "./bgm/tense.mml?raw"; // 1d9e7eed2db44ce7「荒ぶるメロディライン」
import title from "./bgm/title.mml?raw"; // 6c5cd6e3edc4433b「ゲーム音楽っぽい何か」
import town from "./bgm/town.mml?raw"; // 2826c0b1ce744003「？」
import white from "./bgm/white.mml?raw"; // 本編 B16〜17 あぼーんの白野：変ホ短調 130・synth_pop・dance

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
	stone,
	ruins,
	white,
	deep1,
	deep2,
	deep3,
	deep4,
	deep5,
	deep6,
	deep_dat,
	deep_matome,
	deep_hakushi,
	deep_kisei,
	deep_koge,
	deq_sea,
	deq_volcano,
	deq_strata,
	deq_laundry,
	deq_ice,
	kumori,
	fukyowa,
	kouseki,
	speder2,
	island,
};
