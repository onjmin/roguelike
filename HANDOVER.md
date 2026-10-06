# 引き継ぎメモ（2026-10-06 裏ルート「おーぷぬの 消せない板」）

次に 作業する 人（Claude Code を ふくむ）への メモ。物語の 正本は [STORY.md](./STORY.md)（裏ルートは §5.98）、遊びの 決まりは [README.md](./README.md)、絵の 仮置きは [ART_TODO.md](./ART_TODO.md)。

## 入れた もの

- **ルート分岐**：風呂板（main）を 持ち帰ると、電池板（deep）と「のんびり諸島」（`opunu`）が いっしょに 開く（`unlockAfter: "main"` が 2つ）。どちらを 先に 行っても よい。
- **新ダンジョン `opunu`**（`src/core/data/dungeons.ts`）：灯台を 上る 24階・fetch・底の 強さ 27・ぜんぶ 未識別・持ちこみ 可・帰還スレ なし・忍法帖の実が 床に 出る（`OPUNU_ITEMS`）。層は `src/data/story.ts` の `OPUNU_ZONES`（4層。曲は 既存の deq_sea・deq_laundry・tense）。全体マップは 南西の 島「open」の 灯台（`src/data/worldMap.ts`・`ui/worldMap.ts` の `lighthouse`）。
- **板だけの 敵「乗っ取り屋」**（`hijacker`）：steal に `verb`／`quip` を 足した（`core/types.ts`・`core/monster.ts`）。「乗っ取った！」「パスワード、弱すぎ」。
- **新キャラ「原住民」**（`src/data/mobs.ts` の `shobon`）：町の 段では なく 板を 持ち帰ると 来る 住人（`MobDef.after`。`movedIn()` で 数える）。はじめての 持ち帰りの 語りの 中で 村の 口から 歩いてくる（`ui/villageReturn.ts` の `walkInMob`・旗 `NEWCOMER`）。家は 西の 空き地 (7,21)。喫茶の 話は `cafeMobs.ts`。
- **語りの 仕組み**：`StoryPage.mob`（住人が 話す 頁）と `StoryPage.needCleared`（その 板を 持ち帰って いる ときだけ 出る 頁）。電池板の 山場に 原住民の 2枚を この 形で 足した。`endingFor` は かわりの 頁（instead）の ある 人が いなくても 短い 語りに 落とさない ように 変えた。
- 辞典（おーぷぬ・原住民）、切れはし（「板　立てたわ」）、小ネタ、本館の 飾り棚を 7枠に、テスト（`monsterTests` の hijacker・`villageTests` の 裏ルート）。

## まだ できていない こと（優先順）

1. **`pnpm lint`**：作業した 環境に biome が 入らなかった。prettier（tab・80桁・trailing comma。既存ファイルで biome と 差分ゼロを 確認）で 整形しただけ。必ず 一度 走らせる。
2. **実機で 一度 通す**：`pnpm dev` で 風呂板クリア → 二択の 知らせ（やきうの おーぷぬの 話・ゼロの 灯台）→ 灯台 → 持ち帰りの 語りで 原住民が 歩いてくる → 西の 空き地に 立つ、まで。灯台の 絵と 原住民の スプライトは ヘッドレスで 描けるのを 確かめた だけ。
3. **新曲（うんｊレゼ post/1318 の MML）**：取れなかったので 未使用。`src/data/bgm/` に 置き、`OPUNU_ZONES` の どれかの `bgm` に 当てる。`#volume=` は `/dev/bgm.html`（`dev/bgm-measure.ts`）で 1周 鳴らして 測り、`data/bgm.ts` の 表に 行を 足す（目標 I = -23 LUFS）。
4. **絵**：原住民は rpgen の「原住民（きうりアーマー）」（`sa:nabqyI`）、乗っ取り屋は 0Chiaki（`sa:iYWD4w`）に 差しかえ済み。ショボン本人の 歩行グラは 見つからなかった。目的の 品 `items/aisatsu.png` は RECORD の 空色（`ui/itemArt.ts`）。
5. **3作目（walksim）の 対**：済み。窓の 場面（`street.ts` の `mado`）に 板主の「ゆっくり 打つ 音」を 足した。
6. **ボットの 調整**：100回で 倒れる 階の 山は 風呂板と 同じ B11〜13（`pnpm sim -- --dungeon opunu`）。電池板より やさしい つもり。気に なれば `ramp(24, 27, 1.5)` と `houses` を いじる。

## 作業の 進め方で 気づいた こと

- `Record<DungeonId, …>` の 抜けは `pnpm check`（tsc）が ぜんぶ 教えてくれる。板を 足す ときは `DungeonId` → tsc → `villageTests`（語りの 幅・住人の 数・本館の 棚）の 順。
- 住人を 板で 来させる ときは `from: 0` ＋ `after`。`villageTests` の 「move in one by one」は `after` の 子を 別に 数える。
- `vite` が 無い 環境では、`src/sim/*.ts` を bun で 直接 読んで テストを 回せる（`?raw` は onResolve/onLoad の 小さな プラグインで 読む）。
