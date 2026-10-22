// !skスレの サイコロの ドット絵（ui/dungeon/play.ts の skRoll が 回す）。
// - 304×112 の 粗い 画を 整数倍で 拡大して 描く（ぼかさない）。字は DotGothic16 の 元の 16px を しきいで 切って ドットに。
// - 左上で サイコロが はねながら 転がり、下の 4×2 の 目の 盤を 明かりが 回る。止まった 目は 赤白に 点滅して 火花が 散る。
// - 見た目だけ（冒険の 乱数には さわらない。火花の ゆらぎは 自前の 乱数）。

const W = 304;
const H = 112;
const CELL_W = 70;
const CELL_H = 28;
const GAP = 4;
const GRID_X = 6;
const GRID_Y = 44;
const FONT = "DotGothic16, monospace";

export type SkFace = { short: string; long: string; color: string };

export type SkFx = {
	/** 明かりを その 目に（die：サイコロの 目も 変える）。 */
	light(face: number): void;
	/** 止まった（点滅・火花・上に 長い 名前）。 */
	land(face: number): void;
	end(): void;
};

/** 縁どりの ない ドットの 字（しきいで 切る）。 */
const dotText = (
	g: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	fill: string,
	align: "left" | "center" = "left",
): void => {
	const c = document.createElement("canvas");
	c.width = text.length * 16 + 4;
	c.height = 20;
	const t = c.getContext("2d");
	if (!t) return;
	t.font = `16px ${FONT}`;
	t.textBaseline = "top";
	t.fillStyle = fill;
	t.fillText(text, 0, 1);
	const w = Math.ceil(t.measureText(text).width);
	const img = t.getImageData(0, 0, c.width, c.height);
	for (let i = 3; i < img.data.length; i += 4)
		img.data[i] = img.data[i] < 110 ? 0 : 255;
	t.putImageData(img, 0, 0);
	g.drawImage(c, align === "center" ? Math.round(x - w / 2) : x, y);
};

/** サイコロの 目の 点（3×3 の どこに 打つか）。 */
const PIPS: Record<number, readonly [number, number][]> = {
	1: [[1, 1]],
	2: [
		[0, 0],
		[2, 2],
	],
	3: [
		[0, 0],
		[1, 1],
		[2, 2],
	],
	4: [
		[0, 0],
		[2, 0],
		[0, 2],
		[2, 2],
	],
	5: [
		[0, 0],
		[2, 0],
		[1, 1],
		[0, 2],
		[2, 2],
	],
	6: [
		[0, 0],
		[2, 0],
		[0, 1],
		[2, 1],
		[0, 2],
		[2, 2],
	],
};

const drawDie = (
	g: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	pip: number,
	tilt: number,
): void => {
	g.save();
	g.translate(cx, cy);
	g.rotate(tilt);
	g.fillStyle = "#000";
	g.fillRect(-13, -13, 26, 26);
	g.fillStyle = "#f4f0e6";
	g.fillRect(-12, -12, 24, 24);
	g.fillStyle = "#c8c0b0";
	g.fillRect(-12, 9, 24, 3);
	g.fillRect(9, -12, 3, 24);
	g.fillStyle = pip === 1 ? "#d02020" : "#202020";
	for (const [px, py] of PIPS[pip]) {
		const s = pip === 1 ? 6 : 4;
		g.fillRect(
			-9 + px * 7 + (4 - s) / 2 + 1,
			-9 + py * 7 + (4 - s) / 2 + 1,
			s,
			s,
		);
	}
	g.restore();
};

/** 目の 盤の 並び（4×2。上の 段は 左から、下の 段は 右から：明かりが 時計回りに 回る）。 */
const GRID: readonly number[] = [0, 1, 2, 3, 7, 6, 5, 4];

const cellAt = (face: number): [number, number] => {
	const k = GRID.indexOf(face);
	return [
		GRID_X + (k % 4) * (CELL_W + GAP),
		GRID_Y + Math.floor(k / 4) * (CELL_H + GAP),
	];
};

type Spark = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	c: string;
	life: number;
};

export const startSk = (
	ui: HTMLElement,
	faces: readonly SkFace[],
	off: (face: number) => boolean,
): SkFx => {
	const cv = document.createElement("canvas");
	cv.className = "sk-fx";
	cv.width = W;
	cv.height = H;
	const scale = Math.max(1, Math.floor(Math.min(ui.clientWidth - 16, 640) / W));
	cv.style.width = `${W * scale}px`;
	cv.style.height = `${H * scale}px`;
	ui.appendChild(cv);
	const g = cv.getContext("2d");
	let lit = -1;
	let pip = 1;
	let landed = -1;
	let landT = 0;
	let hopT = performance.now();
	let sparks: Spark[] = [];
	let seed = 0x5eed;
	const rnd = (): number => {
		seed = (seed * 1103515245 + 12345) >>> 0;
		return seed / 4294967296;
	};
	let raf = 0;
	const frame = (now: number): void => {
		raf = requestAnimationFrame(frame);
		if (!g) return;
		g.imageSmoothingEnabled = false;
		// 窓（黒地に 白の 二重の 枠）
		g.fillStyle = "#000";
		g.fillRect(0, 0, W, H);
		g.fillStyle = "#fff";
		g.fillRect(1, 1, W - 2, 2);
		g.fillRect(1, H - 3, W - 2, 2);
		g.fillRect(1, 1, 2, H - 2);
		g.fillRect(W - 3, 1, 2, H - 2);
		// サイコロ：回って いる あいだは はねて 傾く。止まったら まっすぐ 座る
		const since = now - hopT;
		const bounce = landed < 0 ? Math.abs(Math.sin(since / 70)) * 6 : 0;
		const tilt =
			landed < 0 ? (((Math.floor(since / 60) % 4) - 1.5) * Math.PI) / 16 : 0;
		drawDie(g, 22, 22 - Math.round(bounce), pip, tilt);
		// 上の 行は レスの「!sk」、下の 行は 転がって いる あいだ「……」、止まったら 出た 目（黄と 白で 点滅）
		dotText(g, "!sk", 42, 4, "#ff4040");
		dotText(g, "サイコロが転がった", 78, 4, "#aaa");
		if (landed < 0)
			dotText(
				g,
				"……".slice(0, 1 + (Math.floor(since / 200) % 2)),
				42,
				22,
				"#fff",
			);
		else {
			const blink = Math.floor((now - landT) / 120) % 2 === 0;
			dotText(
				g,
				`→${faces[landed].long}！`,
				42,
				22,
				blink ? "#ffe14d" : "#fff",
			);
		}
		// 目の 盤
		for (let f = 0; f < 8; f++) {
			const [x, y] = cellAt(f);
			const isOff = off(f);
			const hit = f === landed;
			const on = f === lit;
			const flash = hit && Math.floor((now - landT) / 90) % 2 === 0;
			g.fillStyle = isOff
				? "#333"
				: hit
					? flash
						? "#fff"
						: "#e02818"
					: on
						? "#ffe14d"
						: "#fff";
			g.fillRect(x, y, CELL_W, CELL_H);
			g.fillStyle = isOff ? "#222" : hit ? "#900" : on ? "#b07000" : "#888";
			g.fillRect(x, y + CELL_H - 2, CELL_W, 2);
			g.fillRect(x + CELL_W - 2, y, 2, CELL_H);
			const ink = isOff ? "#666" : hit ? (flash ? "#e02818" : "#fff") : "#000";
			dotText(
				g,
				isOff ? "――" : faces[f].short,
				x + CELL_W / 2,
				y + 5,
				ink,
				"center",
			);
		}
		// 火花（止まった 目から 四方へ 飛んで 落ちる）
		sparks = sparks.filter((s) => s.life > 0);
		for (const s of sparks) {
			s.x += s.vx;
			s.y += s.vy;
			s.vy += 0.18;
			s.life--;
			g.fillStyle = s.c;
			g.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
		}
	};
	raf = requestAnimationFrame(frame);
	return {
		light(face) {
			lit = face;
			pip = 1 + ((pip + 1 + Math.floor(rnd() * 4)) % 6);
			hopT = performance.now();
		},
		land(face) {
			landed = face;
			lit = -1;
			pip = (face % 6) + 1;
			landT = performance.now();
			const [x, y] = cellAt(face);
			const cols = ["#ffe14d", "#fff", "#ff5040", faces[face].color];
			for (let i = 0; i < 36; i++) {
				const a = rnd() * Math.PI * 2;
				const v = 1 + rnd() * 2.5;
				sparks.push({
					x: x + CELL_W / 2,
					y: y + CELL_H / 2,
					vx: Math.cos(a) * v,
					vy: Math.sin(a) * v - 1.5,
					c: cols[i % cols.length],
					life: 24 + Math.floor(rnd() * 16),
				});
			}
		},
		end() {
			cancelAnimationFrame(raf);
			cv.remove();
		},
	};
};
