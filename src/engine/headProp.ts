// 頭に のせる 物（文で「頭に きのこが 生えている」と 言う 人の 頭に、本当に ドット絵で 出す）。
// - 村・施設の 中の 人（engine/field.ts の Actor.prop）と、地図の 上に 生える きのこ（ui/village/sceneShrooms.ts）。
// - 絵は engine/emote.ts の 記号と 同じ 作り（# が 色、o が 差し色、s が 柄。まわりを 1px の 縁で かこむ）。
// - 胞子：かさの 上から 粒が ふわっと 舞いあがって ひろがり、消える（Actor.puffSpores）。

/** 頭に のせる 物。 */
export type HeadProp =
	/** 赤い かさに 白い 点の きのこ（きのこ板）。 */
	"kinoko";

type Glyph = readonly string[];

/** きのこ（大：頭の 上・小：地図の 上で 群れる ぶん）。 */
const KINOKO: { big: Glyph; small: Glyph } = {
	big: ["..###..", ".##o##.", "#o####o", "#######", "..sss..", "..sss.."],
	small: [".###.", "#o##o", "#####", ".sss.", ".sss."],
};

const CAP = "#d8382c";
const SPOT = "#fff4e0";
const STEM = "#f0e2c0";
const EDGE = "#3a1408";

/** 1本の きのこを 描く（x は 絵の 左、bottom は 柄の 下はし。h は 0〜1 の 伸びぐあい。下から 生える）。 */
export const drawShroom = (
	ctx: CanvasRenderingContext2D,
	x: number,
	bottom: number,
	big: boolean,
	h = 1,
): void => {
	const g = big ? KINOKO.big : KINOKO.small;
	const rows = Math.max(1, Math.ceil(g.length * h));
	const y0 = bottom - rows;
	const at = (r: number, c: number): boolean => {
		const line = g[g.length - rows + r];
		return !!line && c >= 0 && c < line.length && line[c] !== ".";
	};
	// 縁（となりに 絵の ある 空きの 画素）
	ctx.fillStyle = EDGE;
	for (let r = -1; r <= rows; r++)
		for (let c = -1; c <= g[0].length; c++) {
			if (at(r, c)) continue;
			if (at(r - 1, c) || at(r + 1, c) || at(r, c - 1) || at(r, c + 1))
				ctx.fillRect(x + c, y0 + r, 1, 1);
		}
	for (let r = 0; r < rows; r++) {
		const line = g[g.length - rows + r];
		for (let c = 0; c < line.length; c++) {
			const ch = line[c];
			if (ch === ".") continue;
			ctx.fillStyle = ch === "o" ? SPOT : ch === "s" ? STEM : CAP;
			ctx.fillRect(x + c, y0 + r, 1, 1);
		}
	}
};

/** 胞子の 長さ（ms）。 */
export const SPORE_MS = 1800;

/** 胞子の 粒（出る 向きと 速さ。毎回 同じ 散りかた）。 */
const SPORES = Array.from({ length: 14 }, (_, i) => {
	const a = -Math.PI / 2 + ((i % 7) - 3) * 0.42 + (i >= 7 ? 0.21 : 0);
	const v = 9 + ((i * 37) % 9);
	return {
		vx: Math.cos(a) * v,
		vy: Math.sin(a) * v,
		at: (i * 53) % 260,
		big: i % 3 === 0,
		color: i % 2 ? "#f6e9a8" : "#e9f2c8",
	};
});

/** 胞子が ふわっと 出る（cx, cy は かさの 上の まんなか。t は ふきだしてからの 時間）。 */
const drawSpores = (
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	t: number,
): void => {
	for (const p of SPORES) {
		const k = (t - p.at) / (SPORE_MS - 260);
		if (k <= 0 || k >= 1) continue;
		// はじめ 勢いよく 出て、ゆっくり ただよう（すこし 横に ゆれる）
		const d = 1 - (1 - k) * (1 - k);
		const x = Math.round(cx + p.vx * d + Math.sin(k * 9 + p.at) * 1.2);
		const y = Math.round(cy + p.vy * d - k * 4);
		ctx.globalAlpha = Math.min(1, k * 8, (1 - k) * 2.5);
		ctx.fillStyle = EDGE;
		ctx.fillRect(x + 1, y + 1, 1, 1);
		ctx.fillStyle = p.color;
		ctx.fillRect(x, y, p.big ? 2 : 1, p.big ? 2 : 1);
	}
	ctx.globalAlpha = 1;
};

/**
 * 頭の 上に 物を 描く（px, py は キャラの マスの 左上の 画素）。puff は 胞子を ふいてからの 時間（無ければ null）。
 */
export const drawHeadProp = (
	ctx: CanvasRenderingContext2D,
	prop: HeadProp,
	px: number,
	py: number,
	puff: number | null,
): void => {
	ctx.save();
	if (prop === "kinoko") {
		// ふくと かさが 1px 縮んで もどる
		const squash = puff !== null && puff < 160 ? 1 : 0;
		drawShroom(ctx, px + 5, py + 1 + squash, true);
		if (puff !== null && puff < SPORE_MS) drawSpores(ctx, px + 8, py - 5, puff);
	}
	ctx.restore();
};
