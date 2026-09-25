// 画面（canvas）の大きさと拡大率を管理する。
//
// ドット絵をにじませないため、1ソース画素 = 整数個のデバイス画素 で描く。
// canvas は「見えている箱」（viewport.ts。ブラウザのバーの裏は除く）全体を覆い、
// その短辺に 14 マス前後（スマホは 11 マス前後）が入る拡大率を選ぶ（ローグライクは部屋を見渡したいので rpg より広め。
// スマホは 画面が小さいので、1マスを 大きくする）。
// 描画側はソース画素の座標系（setTransform 済み）でそのまま描けばよい。

import { TILE } from "./types";
import { onViewportChange, viewport } from "./viewport";

/** 画面の短辺に入れたいマス数の目安（スマホは 1マスを 大きく。短辺が PHONE_CSS 未満ならスマホ）。 */
const TILES_ON_SHORT_SIDE = 14;
const TILES_ON_SHORT_SIDE_PHONE = 11;
const PHONE_CSS = 600;

export class Screen {
	readonly canvas: HTMLCanvasElement;
	readonly ctx: CanvasRenderingContext2D;
	/** 1ソース画素あたりのデバイス画素数（整数）。 */
	scale = 2;
	/** 画面に見えているソース画素数。 */
	width = 0;
	height = 0;
	/** 1マスの CSS 画素数（タップ位置の換算用）。 */
	tileCss = 32;
	private dpr = 1;

	constructor(parent: HTMLElement) {
		this.canvas = document.createElement("canvas");
		this.canvas.id = "screen";
		parent.appendChild(this.canvas);
		const ctx = this.canvas.getContext("2d", { alpha: false });
		if (!ctx) throw new Error("canvas 2D が使えません");
		this.ctx = ctx;
		this.resize();
		onViewportChange(() => this.resize());
	}

	resize(): void {
		const cssW = viewport.w || window.innerWidth;
		const cssH = viewport.h || window.innerHeight;
		this.dpr = window.devicePixelRatio || 1;
		const devW = Math.round(cssW * this.dpr);
		const devH = Math.round(cssH * this.dpr);
		const short = Math.min(devW, devH);
		const tiles =
			Math.min(cssW, cssH) < PHONE_CSS
				? TILES_ON_SHORT_SIDE_PHONE
				: TILES_ON_SHORT_SIDE;
		// 四捨五入で選ぶ（切り捨てだと 320px 幅の 2倍画面で 1マスが 16px と小さくなりすぎる）
		this.scale = Math.max(1, Math.round(short / (TILE * tiles)));
		this.canvas.width = devW;
		this.canvas.height = devH;
		this.canvas.style.width = `${devW / this.dpr}px`;
		this.canvas.style.height = `${devH / this.dpr}px`;
		this.width = Math.ceil(devW / this.scale);
		this.height = Math.ceil(devH / this.scale);
		this.tileCss = (TILE * this.scale) / this.dpr;
		this.ctx.imageSmoothingEnabled = false;
	}

	/** ソース画素座標で描くための変換を設定する。 */
	begin(): CanvasRenderingContext2D {
		const { ctx } = this;
		ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
		ctx.imageSmoothingEnabled = false;
		return ctx;
	}

	/** canvas の左上から数えた CSS 画素 → ソース画素。 */
	cssToSource(x: number, y: number): { x: number; y: number } {
		const f = this.dpr / this.scale;
		return { x: x * f, y: y * f };
	}

	/** デバイス画素にスナップしたソース座標（スクロールのにじみ防止）。 */
	snap(v: number): number {
		return Math.round(v * this.scale) / this.scale;
	}
}
