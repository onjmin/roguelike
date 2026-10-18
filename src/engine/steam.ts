// ドット絵の 湯気（銭湯の 煙突・浴室の もや（ui/minigames/bath.ts）と、ダンジョンの 湯だまり（ui/dungeon/render.ts））。

/** もやの 濃さ（ドット絵らしく 3段だけ）。 */
const STEAM_LEVELS = [0.18, 0.32, 0.5] as const;

/** 湯気の コマ（ミリ秒。なめらかに 動かさず、ドットアニメの ように 1コマずつ 送る）。 */
const STEAM_FRAME = 160;
export const frameOf = (t: number): number =>
	Math.floor(t / STEAM_FRAME) * STEAM_FRAME;

/**
 * もや 1つ（a は 0→1 の 進み。立ちのぼりながら ふくらんで、ゆれて、消える）。
 * ドット絵の もやに する：1画素の 四角で まるく 埋め、ふちは 市松に 間引く。濃さは 3段。
 */
export const puff = (
	g: CanvasRenderingContext2D,
	x: number,
	y: number,
	a: number,
	phase: number,
	o: { rise: number; size: number; alpha: number },
): void => {
	const cx = Math.round(x + Math.sin(a * Math.PI * 2 + phase * 6) * 2 * a);
	const cy = Math.round(y - a * o.rise);
	const r = 1 + Math.round(a * o.size);
	const al = Math.sin(a * Math.PI) * o.alpha;
	const level = [...STEAM_LEVELS].reverse().find((l) => l <= al);
	if (!level) return;
	g.fillStyle = `rgba(255,255,255,${level})`;
	for (let dy = -r; dy <= r; dy++)
		for (let dx = -r; dx <= r; dx++) {
			const d = dx * dx + dy * dy;
			if (d > r * r + r * 0.6) continue;
			// ふちの 輪は 1つおき（消えぎわは 中も 間引く）
			const edge = d > (r - 1) * (r - 1);
			if ((edge || level === STEAM_LEVELS[0]) && (cx + dx + cy + dy) & 1)
				continue;
			g.fillRect(cx + dx, cy + dy, 1, 1);
		}
};
