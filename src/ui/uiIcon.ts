// ボタンの しるし（音・再生・一時停止・矢印）の ドット絵。
// ユニコードの 絵文字や 記号（🔊・▶ など）は 機種で 形も 色も ばらばらに 出るので、画像に して そろえる。
// 色は currentColor（ボタンの 字の 色）。1ドットを px（既定 2px）で 描く。

const DOTS = {
	sound: [
		"....#.......",
		"...##....#..",
		"..###..#..#.",
		"#####...#..#",
		"#####.#.#..#",
		"#####.#.#..#",
		"#####...#..#",
		"..###..#..#.",
		"...##....#..",
		"....#.......",
	],
	mute: [
		"....#.......",
		"...##.......",
		"..###.......",
		"#####..#...#",
		"#####...#.#.",
		"#####....#..",
		"#####...#.#.",
		"..###..#...#",
		"...##.......",
		"....#.......",
	],
	play: ["#...", "##..", "###.", "####", "###.", "##..", "#..."],
	pause: ["##.##", "##.##", "##.##", "##.##", "##.##", "##.##", "##.##"],
	left: ["...#", "..##", ".###", "####", ".###", "..##", "...#"],
	right: ["#...", "##..", "###.", "####", "###.", "##..", "#..."],
	up: ["...#...", "..###..", ".#####.", "#######"],
	down: ["#######", ".#####.", "..###..", "...#..."],
} as const;

export type UiIconName = keyof typeof DOTS;

/** ドットの 列を 横に つながった 長方形の パスに する。 */
const pathOf = (rows: readonly string[]): string => {
	let d = "";
	rows.forEach((row, y) => {
		for (let x = 0; x < row.length; ) {
			if (row[x] !== "#") {
				x++;
				continue;
			}
			let w = 0;
			while (row[x + w] === "#") w++;
			d += `M${x} ${y}h${w}v1h-${w}z`;
			x += w;
		}
	});
	return d;
};

/** しるしの SVG（innerHTML に 入れる）。 */
export const uiIcon = (name: UiIconName, px = 2): string => {
	const rows = DOTS[name];
	const w = rows[0].length;
	const h = rows.length;
	return `<svg class="ui-ico" width="${w * px}" height="${h * px}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="${pathOf(rows)}"/></svg>`;
};
