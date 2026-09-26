# 描いてほしい絵（仮置きの一覧）

作者が あとで 描く絵の 一覧です。どれも いまは 仮の絵か ダミーで 動いていて、
同じ パスに ファイルを 置く（上書きする）だけで 差し替わります（コードは さわらなくて いい）。

## 立ち絵（`public/portraits/`）

形式は いまの `roze.png`・`feris.png` と 同じ：**1024×1024 の 透過 PNG、右を 向いた 全身**。
話すと 画面の 右に 立ち、上から 6割ほど（頭〜腰）が 見えます。
ファイルが 無いあいだは 名前と「立ち絵（仮）」の ダミーが 出ます。

| だれ | ファイル | いま | 見た目の メモ |
|---|---|---|---|
| 革命シヨ（倉庫番） | `portraits/shiyo.png` | 仮の 絵（右下に「仮」） | 16歳・金髪ポニテ（赤い 髪ゴム）・猫耳カチューシャ・丸眼鏡・赤い目・紺の メイド服に 白エプロン。気が強い ツンデレ |
| 解音ゼロ（帳簿・記録） | `portraits/zero.png` | 仮の 絵（右下に「仮」） | 束音ロゼの 反転：うすい 金髪ロング・青い 耳の パーツ（アンドロイド）・水色の 目・白い 着物に 青い 帯・紺の 袴 |
| にぃちぇ | `portraits/nichie.png` | ファイル無し（ダミー） | 日曜日を 待っている 子（歩行グラ `sprites/minors_nichie.png`） |
| パン松 | `portraits/panmatsu.png` | ファイル無し（ダミー） | パン板から 来た 食パン（六枚切り） |
| ンゴ姉 | `portraits/ngoane.png` | ファイル無し（ダミー） | 歩行グラ `sprites/minors_ngoane.png` |
| おんすちゃん | `portraits/onsu.png` | ファイル無し（ダミー） | 歩行グラ `sprites/minors_onsu.png` |
| おんちゃん | `portraits/onchan.png` | ファイル無し（ダミー） | 殿堂入り。歩行グラは RPGEN の `sa:oLrlUq` |
| ヤヤポジ | `portraits/yayapoji.png` | ファイル無し（ダミー） | 歩行グラ `sprites/minors_yayapoji.png` |

- おんJ民・ぷゆゆは 立ち絵なしが 正しい形なので、ここには 入れていません。
- キリコ・ロゼ・フェリスは 描いてあります。
- 絵の 大きさや 位置が 合わないときは `src/data/cast.ts`（仲間）の `scale`、マイナーズは `src/data/mobs.ts` の `portrait` で パスを 変えられます。

## 歩行グラ（`public/sprites/`。描きなおしたければ）

形式：**32×64 の 透過 PNG、16×16 の マス、横に 2コマ × 縦に 4方向（上＝背中・右・下＝正面・左）**。足は いちばん下の 行。

| だれ | ファイル | いま |
|---|---|---|
| 革命シヨ | `sprites/shiyo.png` | Claude が 描いた 仮（`scripts/make-cast.mjs`） |
| 解音ゼロ | `sprites/zero.png` | Claude が 描いた 仮（`scripts/make-cast.mjs`） |
| メタルぷゆゆ（敵） | `sprites/metal_puyu.png` | RPGEN「PIEN」を 銀色に ぬった もの（`scripts/make-metal-puyu.mjs`） |

- 手で 描いた ファイルに 差し替えたら、上の スクリプトを 流すと 上書きされるので 流さないこと（または スクリプトから その子を 消す）。
- ぷゆゆ（村・1階の 敵）は RPGEN「PIEN」`sa:DszPWT` を そのまま 使っています。

## 道具の 絵（あれば）

- 片親パン・ぷゆゆパン・チギュリパン は 「食べもの」の 絵 1枚（`sprites/items/food.png`。山型の 食パン）を 共用しています。
  ぷゆゆパン だけ 専用の 絵に したいときは、絵と あわせて 道具ごとに 絵を 分ける 手直しが 要ります（言ってください）。
