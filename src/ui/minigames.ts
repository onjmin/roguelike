// 裏シナリオの「急に はじまる 別ゲー」（STORY.md §5.98）。村の 窓の 上に 1枚の 板を 出して、A／タップ 1つで 遊ぶ。
// どちらも 冒険の 乱数・記録・リプレイには 触らない（村の 場面の 中だけ。見た目の 乱数は Math.random）。
//
// - 1打席（playBatting。中身は ui/batting.ts）：野球chの 跡地へ 降りる 前の 関所と、村の グラウンド。
//   打席の うしろから 見た 球場で、投手の 球を A／タップで 打つ。球種は 4つ（足の 上げ方で 見分ける）、
//   ボール・ストライクの カウントが あり、ずれの 大きさで 芯（ホームラン）・ヒット・ファウル・空振り。
//   前に とぶと 上から 見た 球場に 切りかわり、野手が 追う。グラウンドでは ホームラン競争（10球）も できる。
// - 1000取り（playGetter）：避難Jの 結。跡地の 次スレの レス番が 速く なりながら 進む。>>999 で 書きこめば 勝ち
//   （1000 は あけておく：1 の 裏の「1000は　ひとりで　取るもんやない」）。早ければ 1000ゲッターに 1000 を 取られ、
//   1000 を 過ぎても 取られる。負けたら 次スレで やりなおせる（呼ぶ側が きく）。
//
// 文字は 1行 全角22字まで。板と 押しの 道具は ui/minigameBoard.ts、色は style.css の .mgame。

import type { UiCtx } from "./list";
import { board, presses, sleep, tick } from "./minigameBoard";

export { atBat, playBatting, playDerby } from "./batting";

// ───────────────── 1000取り ─────────────────

const drawThread = (
	g: CanvasRenderingContext2D,
	n: number,
	bot: number,
	flash: string | null,
): void => {
	const W = 240;
	const H = 150;
	g.fillStyle = "#14121c";
	g.fillRect(0, 0, W, H);
	// スレの 行（下へ 流れる 書きこみ）
	g.font = "9px 'DotGothic16', monospace";
	g.textAlign = "left";
	for (let i = 0; i < 6; i++) {
		const num = n - 5 + i;
		if (num < 1) continue;
		g.fillStyle = i === 5 ? "#ffffff" : "rgba(200,200,220,0.5)";
		g.fillText(
			`${num}　名前：名無しさん　${i === 5 ? "……" : "参拝"}`,
			8,
			20 + i * 14,
		);
	}
	// いまの レス番（大きく）
	g.textAlign = "center";
	g.font = "28px 'DotGothic16', monospace";
	g.fillStyle = n >= 999 ? "#ffe060" : "#f4f2ea";
	g.fillText(String(n), W / 2, 128);
	// 1000ゲッター（右で リロードしている。1000 に 近づくと 光る）
	g.font = "10px 'DotGothic16', monospace";
	g.textAlign = "right";
	g.fillStyle = bot > 0.7 ? "#ff6a4a" : "#a0a0b0";
	g.fillText("1000ゲッター　F5", W - 6, 142);
	g.fillStyle = "#ff6a4a";
	g.fillRect(W - 6 - Math.round(60 * bot), 144, Math.round(60 * bot), 2);
	if (flash) {
		// 大きな レス番の 上に 1行（スレの 行と かぶらない 高さ。22字まで）
		g.textAlign = "center";
		g.font = "9px 'DotGothic16', monospace";
		g.fillStyle = "#ffe060";
		g.fillText(flash, W / 2, 98);
	}
};

/**
 * 1000取り。>>999 を 取れば true（1000 は あけたまま）。早すぎ・遅すぎは 1000ゲッターが 1000 を 取って false。
 * レス番は 960 から 進み、だんだん 速くなる（はじめ 0.26秒 → 990 から 0.11秒）。999 だけ 0.42秒 止まる（ここで 押す）。
 */
export const playGetter = async (ctx: UiCtx): Promise<boolean> => {
	const b = board(
		ctx,
		"跡地の　次スレ　1000取り",
		"A／タップで　>>999　を　書く",
	);
	const p = presses(ctx, b.root);
	const say = (t: string) => {
		b.note.textContent = t;
	};
	try {
		let n = 960;
		say("1000ゲッターが　リロードしている……");
		drawThread(b.g, n, 0.2, null);
		await sleep(900);
		p.take();
		say("");
		let last = await tick();
		let result: "win" | "early" | "late" | "quit" | null = null;
		for (;;) {
			const t = await tick();
			// 990 までは だんだん 速く、990 から 999 の 手前は 速いまま、999 は すこし 長く 止まる（ここで 押す）
			const interval =
				n < 990 ? 260 - ((n - 960) / 30) * 150 : n < 999 ? 110 : 420;
			if (t - last >= interval) {
				last = t;
				n++;
				if (n % 4 === 0) ctx.se("cursor");
			}
			const pr = p.take();
			if (pr === "b") {
				result = "quit";
				break;
			}
			if (pr === "a") {
				result = n === 999 ? "win" : n < 999 ? "early" : "late";
				break;
			}
			if (n >= 1000) {
				result = "late";
				break;
			}
			drawThread(b.g, n, (n - 960) / 40, null);
		}
		if (result === "quit") return false;
		if (result === "win") {
			ctx.se("decide");
			drawThread(b.g, 999, 0.9, "999　名前：蓄音キリコ");
			say("……>>999。1000は、あけておいた");
			await sleep(1400);
			drawThread(b.g, 999, 0, "1000　……まだ　だれも　書かない");
			await sleep(1200);
			return true;
		}
		ctx.se("cancel");
		drawThread(b.g, Math.max(n, 1000), 1, "1000　名前：1000ゲッター");
		say(result === "early" ? "早すぎた！　……取られた" : "……取られた");
		await sleep(1500);
		return false;
	} finally {
		p.stop();
		b.close();
	}
};
