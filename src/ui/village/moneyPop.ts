// お金の 出入りを キリコの 頭の 上に 出す（2026-10-15 作者：「金銭の 授受が 発生したら プレイヤーの 上部に
// プラスか マイナスかの 金額の フェードイン・アウトを 出したい」）。
// 財布（engine/wallet.ts）が 動く たびに 1つ。ふわっと 出て 少し 上がって 消える。続けて 動いたら 上に 積む。

import { TILE } from "../../engine/types";
import { onWalletChange } from "../../engine/wallet";

/** 出て いる 長さ（ms）。はじめの FADE_IN で 出て、おわりの FADE_OUT で 消える。 */
const LIFE = 1600;
const FADE_IN = 200;
const FADE_OUT = 500;
/** 上がる 高さ（px）。 */
const RISE = 8;
/** 同時に 出す 数（それより 多ければ 古い 方から 消す）。 */
const MAX = 3;

const PLUS = "#ffe066";
const MINUS = "#ff8a8a";

type Pop = { d: number; t: number };

export class MoneyPops {
	private pops: Pop[] = [];
	private now = 0;

	constructor() {
		onWalletChange((d) => {
			this.pops.push({ d, t: this.now });
			if (this.pops.length > MAX) this.pops.shift();
		});
	}

	/** 頭の 上に 描く（px, py は キリコの マスの 左上。画面の 画素）。time は 村の 時計（ms）。 */
	draw(
		g: CanvasRenderingContext2D,
		px: number,
		py: number,
		time: number,
	): void {
		this.now = time;
		this.pops = this.pops.filter((p) => time - p.t < LIFE);
		if (!this.pops.length) return;
		g.save();
		g.font = "8px 'DotGothic16', monospace";
		g.textAlign = "center";
		g.textBaseline = "bottom";
		const n = this.pops.length;
		for (const [i, p] of this.pops.entries()) {
			const a = time - p.t;
			const alpha = Math.min(1, a / FADE_IN, (LIFE - a) / FADE_OUT);
			const x = Math.round(px + TILE / 2);
			const y = Math.round(py - 2 - (RISE * a) / LIFE - (n - 1 - i) * 9);
			const text = `${p.d > 0 ? "+" : "−"}${Math.abs(p.d).toLocaleString("ja-JP")}円`;
			g.globalAlpha = Math.max(0, alpha);
			g.fillStyle = "rgba(0,0,0,0.75)";
			g.fillText(text, x + 1, y + 1);
			g.fillStyle = p.d > 0 ? PLUS : MINUS;
			g.fillText(text, x, y);
		}
		g.restore();
	}
}
