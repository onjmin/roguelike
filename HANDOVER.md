# 引き継ぎメモ（2026-10-07 裏シナリオ「全滅の うそ」）

次に 作業する 人（Claude Code を ふくむ）への メモ。物語の 正本は [STORY.md](./STORY.md)（裏シナリオは §5.98）、遊びの 決まりは [README.md](./README.md)、絵の 仮置きは [ART_TODO.md](./ART_TODO.md)。

## 入れた もの

- **入口は 見つける（2026-10-07 作りなおし）**：小島1（`isle1`）は パン板を 持ち帰ると 開くが `quiet`（知らせない。`noteRunEnd` が news を 積まない）。全体マップでは 行くまで 建物の かわりに 小舟（`drawBuilding` の `boat`）が つき、一覧の 名前・札・フキダシ・口の 確認・向かう 題は `QUIET_SPOT`（`data/story.ts`）。行った かどうかは `Progress.intro`。小島 2・3・灯台・避難J は `hidden`（開くまで 地図にも 一覧にも 出ない）。視線誘導は `CLEAR.shallow` の 小舟の ひとこと 2つと、切れはし「板　立てたわ」（パン板）。やきうの おーぷぬの 説明は 小島1 の 持ち帰りの 語りへ 移した。
- **難しさ**：裏の 板は ぜんぶ `noCarry`（`CARRY_REFUSE` に 小舟の 文）、底の 強さは 本筋の 対より 上（`villageTests` の「裏シナリオ」で 見張る）。
- **分岐は パン板の あと**：小島1（`isle1`）が きのこ板と 並んで 開く。小島は `isle1 → isle2 → isle3` と つづき、3つ そろうと 灯台（`opunu`。`unlockAfterAll`）。跡地（`ato`。`unlockAfterAll: ["opunu"]` ＋ `unlockFlag: "romVoice"`）、避難J（`hinan`。`unlockAfterAll: ["deep", "ato"]`）。開く 条件は `core/data/dungeons.ts` の `openable`（`engine/save.ts` の `noteRunEnd`・`loadProgress` が 使う）。
- **ROM専の 声**：`noteRunEnd(dungeon, kind, seed, voice)` に 蓄音機の 中身（`RunState.voice`）が 渡る。持ち帰りで `funamushi` なら `Progress.flags` に `romVoice`。
- **灯台の 扉の パスワード**：村の 口で 灯台を 選ぶと 4択（`ui/villageEvents.ts` の `passwordScript`。文と 答えは `data/story.ts` の `LIGHTHOUSE_DOOR`。当てると `Progress.flags` の `pass`）。
- **置き手紙**：小島の 底の 品（`memo1〜3`）。持ち帰ると まとめ掲示板に 貼られる（`data/scraps.ts` の `kind: "memo"`。ほかの 切れはしより 先に 貼る：`ui/villageTalk.ts` の `pinnedScrap`）。読み返す 一覧は「乗っ取り屋の 置き手紙」。
- **灯台の 層の 復元**：`data/story.ts` の `opunuZones(取り返した 数)`（`ui/theme.ts` の `zoneFor` が 灯台だけ これで 引く）。全体マップの 小島の 下の 名前は `ISLE_NAMES`（取り返すと 元の 板名。`ui/worldMap.ts`）。
- **本館の 古い スレの 札**：`data/village/hall.ts` の `Q`（全 tier。集会所は すみの 1マスなので 背の 低い 札）。スクリプトは `ui/hallEvents.ts` の `oldestScript`：跡地が 開くと 降りられる。はじめは 原住民の **1打席**（`ui/minigames.ts` の `playBatting`）に 勝ってから、2回目からは 任意。降りる 流れは 村の 口と 同じ（`ui/villageEvents.ts` から `departTo`・`goalsNow`・`suspendedFirst` を 読む。互いに 読みあうが 呼ぶ ときだけ）。
- **跡地の 結**：`STORY.ato.ending`。`StoryPage.cue`（`roms`＝ROM専 18体が 口から 来る、`romsLeave`＝帰る）と `StoryPage.nanashi`（名無しの 1窓）を 足した。ROM専 18体は `ui/villageEvents.ts` の `buildVillage` に 旗 `ROMS` の人として 置き、`ui/villageReturn.ts` の `walkInRoms`／`walkOutRoms` が 動かす。数は `ROM_COUNT`。
- **結の あとの 変化**：`Run.create(..., rom)` → `RunState.rom`（`main.ts` の `romNow()`：`endings` に `ato`）。ROM専は 追いつめても 戦わない（`core/monster.ts`）、蓄音機の 声で 固まらず 手を 振る（`core/run.ts` の `playVoice`）、図鑑の 文が かわる（`ui/bookView.ts` の `bookText`）。リプレイにも `rom` を 残す（`SavedReplay.rom`）。本館の 札は「1000　(´・ω・｀)　見てた」。
- **開いた 知らせ**：跡地（原住民が 声を 聞く）・避難J（ヒナリーの 発表）は 住人が 話す（`ui/villageReturn.ts` の `mobNewsScript`。文は `ATO_NEWS`・`HINAN_NEWS`）。小島 1〜3・灯台は `UNLOCK_LINES`（板ごとの 行。`newsScript` は 板名の 鍵が あれば それ）。
- **第三ルート**：避難J（`hinan`）。板だけの 敵 `getter`（新しい 特技 `spam`：なぐる かわりに `addRes` で スレを 伸ばす。`core/monster.ts`）。結の **1000取り**は `playGetter`（`cue: "getter"`。`returnScene(s, a, { getter })` の 手で 遊び、負けたら `GETTER_RETRY` を 出して くり返す。試験では 手を 渡さず とばす）。
- **住人**：原住民の 節目 `opunu`（頼み）・`ato`（18 → あと ひとり）、雑談 `shima`・`rom`、喫茶の 小話「狼煙」（`noroshi`・`noroshi2`・`noroshi3`）。ヒナリーの 節目 `ato`。`Milestone` に `ato`、`ui/villageMobs.ts` の `MILESTONES` に `opunu`・`ato`。
- **敵が いくつかの 板に 出る**：`MonsterDef.board` が 並びも 取れる（`onBoard`）。乗っ取り屋は 小島 3つと 灯台。
- 小ネタ（`rom_voice`）、持ちこみ 不可の 文（`CARRY_REFUSE.ato`）、飾り棚は 置き手紙と >>1・20人目を 置かない（`ON_BOARD`・`ON_PHONO`）。
- テスト：`monsterTests`（getter・板の 並び）、`villageTests` の「裏シナリオ」5本（分岐の 形・パスワードと 層・開く 条件・跡地の 結・避難Jの 結と 1000取り・札と 節目）。

## まだ できていない こと（優先順）

1. **実機で 通した もの（2026-10-07。ブラウザの ペインで）**：全体マップの 小島と 名前・灯台の パスワードの 4択（当てると 旗 `pass`）・本館の 札 → 1打席の 板 → 三振・跡地の 持ち帰りで ROM専 18体が 口から 歩いてきて 帰る・灯台の 持ち帰りで 原住民が 歩いてくる・避難Jの 持ち帰りで 1000取り（負け → 次スレ → 999 で 勝ち）・結の あとの 札「1000　見てた」。**まだ**：小島・跡地・避難Jの 中を 自分で もぐる（ボットだけ）、別ゲーの 板（`.mgame`）を スマホの 幅で 見る、1打席で 本当に 打つ（ボットでは 打てない。ゾーンの 幅 `ZONE` は 手で 遊んで 決める）。
   進み具合を 作る ときは `localStorage["kiriko-roguelike/progress"]` に `unlocked / cleared / intro / endings / flags` を 書いて 読みなおす。帰りの 場面は `window.__village.start({ boot: false, arrival: { kind: "clear", dungeon: "ato" } })` で 村から 直接 呼べる（dev だけ）。
2. **ボットの 試走（2026-10-07、クリアまで 本筋より 重く した あと。100回）**：小島1 クリア 25%（きのこ板 45%）・小島2 9%（離島板 28%）・小島3 0%（山 B4 と B8。おんたこ B4〜6）・灯台 0%（山 B10〜11。風呂板 B12〜13）・跡地 0%（山 B7〜9。電池板 B13〜14）・避難J 0%（山 B6〜9／25階）。**ボットの 調整**：`pnpm sim -- --dungeon isle1|isle2|isle3|opunu|ato|hinan --n 100`。目安：小島1 は きのこ板 なみ、小島2 は 離島板 なみ、小島3 は おんたこ なみ、灯台は 風呂板 なみ、跡地は 電池板 なみ、避難J は その あいだ。
3. **絵**：乗っ取り屋は rpgen の FF3 シーフ（`sa:kAeK4w`）、1000ゲッターは クソアホロボット（`sa:gmLHHM`）に した（2026-10-07）。置き手紙・>>1・20人目の レスの 絵は `ui/itemArt.ts`（`scripts/make-items.mjs memo,ichi,nijuu`）。全体マップの 小島の 旗（`islet`）と 避難所の テント（`tent`）は `ui/worldMap.ts` の 矩形の ドット絵。
4. **曲**：小島 1〜3・跡地・避難J は 既存の 曲を 当てている（`BOARD_LOOKS`・`ATO_ZONES`）。新曲を 足すなら `#volume` を 測ってから。
5. **辞典**：「参拝」「原住民の 全滅」「1000ゲッター」の 項は まだ（`data/glossary.ts`）。

## 作業の 進め方で 気づいた こと

- `Record<DungeonId, …>` の 抜けは `pnpm check`（tsc）が ぜんぶ 教えてくれる。板を 足す ときは `DungeonId` → tsc → `villageTests`（語りの 幅・住人の 数・本館の 棚）の 順。
- 語りの 文に 出ていった 人の 名前（「やきう」）が 入ると、その 頁は 村に いない あいだ 落ちる（`mentionsAway`）。「やきう民」の ような 集団の 名は `keep()` で 自分を かわりに 置く。
- 本館の 中に 物を 足す とき、背の 高い 絵（16×32）は うしろ（北）から 読めない（`hasBack`）。すみに 置くなら 背の 低い 絵。通り道を ふさがないか `villageTests` の「closed room」で わかる。
- Claude Code の Bash の ヒアドキュメントは 文字列の `\n` を 改行に、`\\n` を `\n` に 変えてしまう。`\n` の 入る TS の 文を 書きかえる ときは、パッチの スクリプトを Write ツールで 置いてから `python` で 走らせる（`python -` に 流しこむと 日本語も 化ける）。
