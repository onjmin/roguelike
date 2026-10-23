# 人が 確かめること（仮置きの 一覧）

Claude が 作業した 環境では 確かめられず、作者が 手もとの Windows で 見る ことの 一覧です。
済んだら 行ごと 消して ください。

## Biome を PowerShell で 動かす

Claude が 作者の PC で 使える シェルは Linux の 仮の 環境で、`node_modules` には Windows 版の Biome
（`@biomejs/cli-win32-x64`）しか 入って いないので、そこでは 動かせなかった。同じ 版（2.5.14）の Linux 版を
別に 用意して 通した。Windows の PowerShell で 動くかは まだ 見て いない。

1. ふつうに 動かす（`package.json` の スクリプト）。
   ```powershell
   pnpm lint      # biome check src
   pnpm format    # biome check src --write
   ```
2. 「この システムでは スクリプトの 実行が 無効に なって いる」と 出たら、PowerShell の 実行ポリシーが
   `pnpm.ps1`・`biome.ps1` を 止めて いる。どちらかで 回避する。
   - 自分の ユーザーだけ 許す（1回で すむ）
     ```powershell
     Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
     ```
   - 設定を 変えずに `.cmd` を 呼ぶ
     ```powershell
     pnpm.cmd lint
     .\node_modules\.bin\biome.cmd check src
     ```
3. Biome の 本体が 見つからないと 出たら、`node_modules` を 作りなおす。
   ```powershell
   pnpm install --force
   ```
4. エディタなら VS Code の Biome 拡張でも 動く（PowerShell を 通らない）。

どの 手で 動いたかを ここか README に 書いて おくと、次から 迷わない。
