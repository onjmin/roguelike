// 感情の 記号（頭の 右上に ドット絵が フェードイン・アウトする。作者「フキダシ より、右上に ビックリマークや
// ハテナ、♪が フェードイン・アウト する ほうが らしい」「記号は 少し 傾けた ドット絵」「記号に よって
// フェードイン・アウトの 時間も かえる」「眠りは ダンジョンの ものを 流用」「体から オーラ みたいに 花を 出す」）。
// - 村・施設の 中の 人（engine/field.ts の Actor.emote）と、会話の 1行（SayOptions.emote。話す 人の 頭に）。
// - 眠りの Z は ダンジョンの 眠った キャラと 同じ 絵（drawSleepZ。ui/dungeon/render.ts も これを 使う）。

/** 感情の 記号。 */
export type Emote =
	/** おどろき・気づき・はりきり（ぱっと 出て すぐ 消える）。 */
	| "!"
	/** ふしぎ・まよい（ゆっくり 出て ゆれる）。 */
	| "?"
	/** ごきげん・鼻歌（ふわふわ 浮いて 右へ 流れる）。 */
	| "♪"
	/** だまる・あきれ・考えこむ（点が 1つずつ ふえる）。 */
	| "…"
	/** ねむい・ねている（ダンジョンの 眠りの Z）。 */
	| "z"
	/** すき・うれしい（どきどき 脈うつ）。 */
	| "♥"
	/** あせり・気まずい（しずくが たれる）。 */
	| "汗"
	/** いらいら・おこる（青すじが ぴくぴく）。 */
	| "怒"
	/** しあわせ・ほっこり（体の まわりから 花が ふわっと 舞う。オーラ）。 */
	| "花"
	/** 得意気・ドヤ（きらんと 光る 4つ星。2026-10-19 作者「表情を ふやす」）。 */
	| "得"
	/** 青ざめ（額に 青い たて線が 3本 垂れる）。 */
	| "青"
	/** 冷や汗（青い たて線と しずくが 2つ。あせりの 汗より 深刻）。 */
	| "冷"
	/** ツッコミの 驚き（ギザギザの ふきだしに「!!」。大声で 突く 行）。 */
	| "驚";

export const EMOTES: readonly Emote[] = [
	"!",
	"?",
	"♪",
	"…",
	"z",
	"♥",
	"汗",
	"怒",
	"花",
	"得",
	"青",
	"冷",
	"驚",
];

/** 記号の ドット絵（小・大。# が 色、o が 差し色）。ダンジョンの 眠りの Z と 同じく、右下に 1px の 影。 */
type Glyph = readonly string[];
type Look = {
	small: Glyph;
	big: Glyph;
	color: string;
	accent?: string;
	/** 上ほど 右へ ずらして 少し 傾ける。 */
	tilt?: boolean;
};

const LOOKS: Record<Exclude<Emote, "z" | "…" | "花">, Look> = {
	// ! と ? は はじめから 傾けて 描く（右上へ 倒れた 太い 線と 点）
	"!": {
		small: [".#", ".#", "#.", "..", "#."],
		big: ["..##", "..##", ".##.", ".##.", ".#..", "....", "##..", "##.."],
		color: "#ff6a4a",
	},
	"?": {
		small: ["..##.", ".#..#", "...#.", "..#..", ".....", ".#..."],
		big: [
			"..####.",
			".##..##",
			".....##",
			"....##.",
			"...##..",
			"..##...",
			".......",
			".##....",
			".##....",
		],
		color: "#ffe066",
	},
	"♪": {
		small: [".#.", ".##", ".#.", "##.", "##."],
		big: ["..#..", "..##.", "..#.#", "..#..", "###..", "###..", ".#..."],
		color: "#8ad0ff",
		tilt: true,
	},
	"♥": {
		small: ["##.##", "#o###", ".###.", "..#.."],
		big: [".##.##.", "#o#####", "#######", ".#####.", "..###..", "...#..."],
		color: "#ff6a9a",
		accent: "#ffd0e0",
	},
	汗: {
		small: [".#.", "###", "#o#", ".#."],
		big: ["..#.", ".##.", "#o##", "####", ".##."],
		color: "#8ad0ff",
		accent: "#f0faff",
	},
	怒: {
		small: [".#.#.", "##.##", ".....", "##.##", ".#.#."],
		big: [".#...#.", "##...##", ".......", ".......", "##...##", ".#...#."],
		color: "#ff4a4a",
	},
	// きらんと 光る 4つ星（まんなかが 白）
	得: {
		small: ["..#..", ".###.", "##o##", ".###.", "..#.."],
		big: [
			"...#...",
			"...#...",
			"..###..",
			"###o###",
			"..###..",
			"...#...",
			"...#...",
		],
		color: "#ffe066",
		accent: "#ffffff",
	},
	// 額から 垂れる 青い たて線 3本（長さが ちがう）
	青: {
		small: ["#.#.#", "#.#.#", "#.#.#", "..#.#", "..#.."],
		big: ["#..#..#", "#..#..#", "#..#..#", "#..#..#", "...#..#", "...#..."],
		color: "#4a6cff",
	},
	// 青い たて線 2本と しずく（右）
	冷: {
		small: ["#.#..", "#.#.#", "#.###", "..#o#", "...#."],
		big: ["#.#....", "#.#..#.", "#.#.##.", "#...#o#", "....###", ".....#."],
		color: "#8ad0ff",
		accent: "#f0faff",
	},
	// ギザギザの ふきだし（白）に 赤い「!!」
	驚: {
		small: ["#.#.#", ".###.", "#o#o#", ".###.", "#.#.#"],
		big: [
			"#.#.#.#",
			".#####.",
			"##o#o##",
			".#o#o#.",
			"##o#o##",
			".#####.",
			"#.#.#.#",
		],
		color: "#fff6e8",
		accent: "#ff4a3c",
	},
};

const PETAL: Look = {
	small: [".#.", "#o#", ".#."],
	big: [".#.#.", "##o##", ".###.", "..#.."],
	color: "#ff9ac8",
	accent: "#ffe060",
};
const DOT: Look = { small: ["#"], big: ["##", "##"], color: "#ffffff" };

const SHADOW = "#1a2440";

/** 1つの 絵を 描く（影 → 本体。tilt なら 上ほど 右へ）。x, y は 絵の 左下。 */
const drawGlyph = (
	ctx: CanvasRenderingContext2D,
	look: Look,
	g: Glyph,
	x: number,
	bottom: number,
): void => {
	const h = g.length;
	const shift = (r: number) => (look.tilt ? Math.floor((h - 1 - r) / 3) : 0);
	const y0 = bottom - h;
	ctx.fillStyle = SHADOW;
	for (let r = 0; r < h; r++)
		for (let c = 0; c < g[r].length; c++)
			if (g[r][c] !== ".") ctx.fillRect(x + c + shift(r) + 1, y0 + r + 1, 1, 1);
	for (let r = 0; r < h; r++)
		for (let c = 0; c < g[r].length; c++) {
			const ch = g[r][c];
			if (ch === ".") continue;
			ctx.fillStyle = ch === "o" ? (look.accent ?? look.color) : look.color;
			ctx.fillRect(x + c + shift(r), y0 + r, 1, 1);
		}
};

/**
 * 記号ごとの 動き（period で 1めぐり。n 個が ずれて 出る。k は 0〜1 の 進み、上るほど 大きく、消えていく）。
 * 会話の 1行では once（終わりに 近づくと うすれる）。
 */
type Motion = {
	period: number;
	n: number;
	/** k の ときの 位置（頭の 右上 から の ずれ）。 */
	at: (k: number, i: number) => readonly [number, number];
	/** 大きい 絵に かわる k。 */
	grow: number;
	/** k の ときの 見えぐあい。 */
	alpha: (k: number) => number;
};

const ease = (k: number) => Math.min(1, k * 5, (1 - k) * 3);

const MOTIONS: Record<Exclude<Emote, "z" | "…" | "花">, Motion> = {
	// ぱっと 大きく 出て はねて、少し いて 消える（1つ）
	"!": {
		period: 1400,
		n: 1,
		grow: 0.06,
		at: (k) => [0, k < 0.12 ? -3 : k < 0.2 ? -1 : -2],
		alpha: (k) => (k < 0.75 ? Math.min(1, k * 14) : Math.max(0, (1 - k) * 4)),
	},
	// ゆっくり 出て 左右に ゆれながら 少し 上る（1つ）
	"?": {
		period: 2200,
		n: 1,
		grow: 0.25,
		at: (k) => [Math.round(Math.sin(k * Math.PI * 3)), -Math.round(k * 4)],
		alpha: (k) => Math.min(1, k * 3, (1 - k) * 3),
	},
	// 2つが 右上へ ふわふわ 流れる（眠りの Z と 同じ 作り）
	"♪": {
		period: 1500,
		n: 2,
		grow: 0.5,
		at: (k) => [
			Math.round(k * 6 + Math.sin(k * Math.PI * 4)),
			-Math.round(k * 9),
		],
		alpha: ease,
	},
	// 2つが 上へ のぼり、大きく なる
	"♥": {
		period: 1700,
		n: 2,
		grow: 0.45,
		at: (k, i) => [
			Math.round((i ? 3 : -1) + Math.sin(k * Math.PI * 2)),
			-Math.round(k * 10),
		],
		alpha: ease,
	},
	// こめかみから しずくが たれる（1つ）
	汗: {
		period: 1200,
		n: 1,
		grow: 0.3,
		at: (k) => [3, Math.round(k * 3) + 4],
		alpha: (k) => Math.min(1, k * 6, (1 - k) * 2.5),
	},
	// 青すじが ぴくぴく（大小を すばやく 入れかえる）
	怒: {
		period: 1300,
		n: 1,
		grow: 2,
		at: () => [0, -1],
		alpha: (k) => Math.min(1, k * 10, (1 - k) * 4),
	},
	// きらん（ぱっと 大きく 出て、またたき ながら 少し 上る）
	得: {
		period: 1400,
		n: 1,
		grow: 0.08,
		at: (k) => [2, -2 - Math.round(k * 2)],
		alpha: (k) =>
			Math.min(1, k * 12, (1 - k) * 4) *
			(Math.floor(k * 10) % 3 === 2 ? 0.5 : 1),
	},
	// 額に 垂れて、ゆっくり 下へ（頭の まんなかの 上）
	青: {
		period: 1600,
		n: 1,
		grow: 0.25,
		at: (k) => [-7, 4 + Math.round(k * 2)],
		alpha: (k) => Math.min(1, k * 8, (1 - k) * 3),
	},
	// こめかみから 2つ、続けて たれる
	冷: {
		period: 1100,
		n: 2,
		grow: 0.3,
		at: (k, i) => [3 + i, Math.round(k * 3) + 4],
		alpha: (k) => Math.min(1, k * 6, (1 - k) * 2.5),
	},
	// ぱっと 出て、左右に ふるえて、少し いて 消える
	驚: {
		period: 1300,
		n: 1,
		grow: 0,
		at: (k) => [k < 0.35 ? (Math.floor(k * 30) % 2 ? 1 : -1) : 0, -3],
		alpha: (k) => (k < 0.75 ? Math.min(1, k * 14) : Math.max(0, (1 - k) * 4)),
	},
};

/** 1回の 長さ（会話の 1行で 出しきる 長さの 目安）。 */
export const emoteLength = (e: Emote): number =>
	e === "z" ? 1400 : e === "花" ? 1800 : e === "…" ? 1800 : MOTIONS[e].period;

/** 眠りの Z（ドット。文字だと 小さく にじんで 見えないので 画素で 描く）。小 4×4・大 5×5。 */
const Z_SMALL = ["####", "..#.", ".#..", "####"];
const Z_BIG = ["#####", "...#.", "..#..", ".#...", "#####"];

/**
 * 眠っている キャラの 頭の 上に Z を 2つ、右上へ ふわふわ 上らせる（上るほど 大きく、消えていく）。
 * x, y は キャラの マスの 左上（画素）。alpha は キャラの 見えぐあい。
 */
export function drawSleepZ(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	time: number,
	alpha: number,
): void {
	const PERIOD = 1400;
	for (let n = 0; n < 2; n++) {
		const k = (time / PERIOD + n / 2) % 1;
		const glyph = k < 0.5 ? Z_SMALL : Z_BIG;
		const zx = Math.round(x + 9 + k * 5);
		const zy = Math.round(y + 1 - k * 9);
		ctx.globalAlpha = alpha * Math.min(1, k * 5, (1 - k) * 3);
		for (let row = 0; row < glyph.length; row++)
			for (let col = 0; col < glyph[row].length; col++) {
				if (glyph[row][col] !== "#") continue;
				// 縁どり（床や 壁の 上でも 見えるように）→ 本体
				ctx.fillStyle = "#1a2440";
				ctx.fillRect(zx + col + 1, zy + row + 1, 1, 1);
			}
		ctx.fillStyle = "#cfe8ff";
		for (let row = 0; row < glyph.length; row++)
			for (let col = 0; col < glyph[row].length; col++)
				if (glyph[row][col] === "#") ctx.fillRect(zx + col, zy + row, 1, 1);
	}
	ctx.globalAlpha = alpha;
}

/** 体の まわりから 花びらが ふわっと 舞いあがる（4枚が ずれて 出る。オーラ）。 */
const drawFlowers = (
	ctx: CanvasRenderingContext2D,
	px: number,
	py: number,
	t: number,
	fade: number,
): void => {
	const PERIOD = 1800;
	// 体の まわりの 出る 所（左右の 腰・肩の あたり）
	const spots = [
		[-3, 14],
		[14, 12],
		[0, 7],
		[12, 5],
	];
	spots.forEach(([sx, sy], i) => {
		const k = (t / PERIOD + i / spots.length) % 1;
		const a = ease(k) * fade;
		if (a <= 0) return;
		const side = sx < 6 ? -1 : 1;
		ctx.globalAlpha = a;
		drawGlyph(
			ctx,
			PETAL,
			k < 0.4 ? PETAL.small : PETAL.big,
			Math.round(px + sx + side * k * 3),
			Math.round(py + sy - k * 10),
		);
	});
	ctx.globalAlpha = 1;
};

/**
 * 頭の 右上に 記号を 描く（px, py は キャラの マスの 左上の 画素。t は 出てからの 時間）。
 * loop なら くりかえす（招いた 人の 過ごし方）、でなければ 1めぐりで うすれて 消える（会話の 1行）。
 */
export const drawEmote = (
	ctx: CanvasRenderingContext2D,
	e: Emote,
	px: number,
	py: number,
	t: number,
	loop: boolean,
): void => {
	const len = emoteLength(e);
	// 会話の 1行：1めぐり（ふえる 記号は 2めぐり）で 終わり、終わりぎわは うすれる
	const span =
		e === "♪" || e === "♥" || e === "z" || e === "花" ? len * 2 : len;
	if (!loop && t >= span) return;
	const fade = loop ? 1 : Math.min(1, (span - t) / 400);
	ctx.save();
	if (e === "z") {
		drawSleepZ(ctx, px, py, t, fade);
	} else if (e === "花") {
		drawFlowers(ctx, px, py, t, fade);
	} else if (e === "…") {
		// 点が 1つずつ ふえて、少し いて 消える
		const k = (t % len) / len;
		const n = Math.min(3, 1 + Math.floor(k * 4.5));
		ctx.globalAlpha = Math.min(1, (1 - k) * 5) * fade;
		for (let i = 0; i < n; i++)
			drawGlyph(ctx, DOT, DOT.big, px + 9 + i * 3, py + 1);
	} else {
		const m = MOTIONS[e];
		const look = LOOKS[e];
		for (let i = 0; i < m.n; i++) {
			const k = (t / m.period + i / m.n) % 1;
			// 1つずつ 出る 記号は 1めぐりめの はじめから（2つめは 半分 おくれて）
			if (!loop && t < (i / m.n) * m.period) continue;
			const a = m.alpha(k) * fade;
			if (a <= 0) continue;
			const big = e === "怒" ? Math.floor(t / 140) % 2 === 0 : k >= m.grow;
			const g = big ? look.big : look.small;
			const [dx, dy] = m.at(k, i);
			ctx.globalAlpha = a;
			// 汗は 頭の 右の 横、ほかは 頭の 右上（絵の 左下が 頭の 右はしの 少し 上）
			drawGlyph(ctx, look, g, px + 10 + dx, (e === "汗" ? py : py + 1) + dy);
		}
	}
	ctx.restore();
};

// ───────────────── 体の 動き ─────────────────
// 作者「ぴょんぴょん 跳ねるとか、震えるとか、ほかにも 色々な 感情表現を」。記号と いっしょにも 使える。

/** 体の 動き（描く 位置と 向きだけ。立つ マスは かわらない）。 */
export type Gesture =
	/** ぴょんぴょん 跳ねる（うれしい・はしゃぐ）。 */
	| "hop"
	/** ぶるぶる 震える（こわい・寒い・くやしい）。 */
	| "shiver"
	/** びくっと する（おどろく。1回 跳ねあがって すとんと）。 */
	| "startle"
	/** うなずく（2回 こくこく）。 */
	| "nod"
	/** 首を 横に ふる（いやいや。左右を 向く）。 */
	| "shake"
	/** くるっと 1回 まわる（ごきげん・おどけ）。 */
	| "spin"
	/** がっくり（少し 沈んで そのまま）。 */
	| "slump";

export const GESTURES: readonly Gesture[] = [
	"hop",
	"shiver",
	"startle",
	"nod",
	"shake",
	"spin",
	"slump",
];

type Facing = "up" | "right" | "down" | "left";

/** 1回の 長さ（ms。loop なら くりかえし）。 */
const GESTURE_MS: Record<Gesture, number> = {
	hop: 700,
	shiver: 900,
	startle: 450,
	nod: 700,
	shake: 900,
	spin: 600,
	slump: 600,
};

/**
 * 動きの その 時の ずれ（画素）と 向き（null は もとの 向き）。t は はじめてからの 時間。
 * loop で なければ 1回で 終わる（slump は 終わっても 沈んだ まま）。
 */
export const gestureAt = (
	g: Gesture,
	t: number,
	loop: boolean,
	dir: Facing,
): { dx: number; dy: number; dir: Facing | null } => {
	const len = GESTURE_MS[g];
	if (!loop && t >= len) return { dx: 0, dy: g === "slump" ? 2 : 0, dir: null };
	// くりかえす ときは 間を おく（跳ねつづけない）
	const k = loop ? (t % (len * 2.5)) / len : t / len;
	if (k >= 1) return { dx: 0, dy: g === "slump" ? 2 : 0, dir: null };
	switch (g) {
		case "hop": {
			// 2回 跳ねる（高さ 4px・2px）
			const h = k < 0.55 ? 4 : 2;
			const p = k < 0.55 ? k / 0.55 : (k - 0.55) / 0.45;
			return { dx: 0, dy: -Math.round(Math.sin(p * Math.PI) * h), dir: null };
		}
		case "shiver":
			return { dx: Math.floor(t / 45) % 2 === 0 ? -1 : 1, dy: 0, dir: null };
		case "startle":
			return {
				dx: 0,
				dy: -Math.round(Math.sin(Math.min(1, k * 1.6) * Math.PI) * 3),
				dir: null,
			};
		case "nod":
			return { dx: 0, dy: Math.floor(k * 4) % 2 === 1 ? 1 : 0, dir: "down" };
		case "shake": {
			const side: Facing[] =
				dir === "up" || dir === "down" ? ["left", "right"] : ["up", "down"];
			return { dx: 0, dy: 0, dir: side[Math.floor(k * 4) % 2] };
		}
		case "spin": {
			const order: Facing[] = ["down", "left", "up", "right"];
			const at = order.indexOf(dir);
			return { dx: 0, dy: 0, dir: order[(at + Math.floor(k * 4)) % 4] };
		}
		case "slump":
			return { dx: 0, dy: Math.round(k * 2), dir: null };
	}
};

/**
 * ツッコミの 音（2026-10-19 作者「ツッコミにも 専用の 効果音を。種類に よって 複数」）。行に hit を 書くと、
 * 窓の 前に その 音が 鳴り、突かれた 人（ふつうは キリコ。話す 人が キリコなら 話しかけた 相手）が びくっと する。
 * 音は data/audio/sfx.ts の HIT_SE。STORY.md「ツッコミの 着眼点と 型」の 型と 合わせる：
 * - slap  … ぺしっ（拍子木）。例え・皮肉・寄り添いの 軽い 一言
 * - whack … すぱーん（ハリセン）。大声の 言い直し・嘆き
 * - punch … どすっ（げんこつ）。暴力系（シヨ・ロゼが 手を 出す）
 * - sting … デデドン。青ざめる 受け手・ガーン
 * - zukko … ずこーっ。ボケに 力負けして 全員 こける
 * 海外ミームの 音（2026-10-23 作者が 選んだ もの）：
 * - boom    … ドゥーン（Vine boom）。とんでもない 一文・言いきった 直後
 * - bruh    … ブラ…。力の ぬけた あきれ
 * - huh     … ハァ？（猫）。わけが わからない ときの 聞きかえし
 * - scratch … レコードの 針とび。話の 腰を 折る・待った
 * - bong    … ボーン（Taco Bell）。重い オチ
 * - dun     … ダン・ダン・ダーン。とんでもない 真相
 */
export type Hit =
	| "slap"
	| "whack"
	| "punch"
	| "sting"
	| "zukko"
	| "boom"
	| "bruh"
	| "huh"
	| "scratch"
	| "bong"
	| "dun";

export const HITS: readonly Hit[] = [
	"slap",
	"whack",
	"punch",
	"sting",
	"zukko",
	"boom",
	"bruh",
	"huh",
	"scratch",
	"bong",
	"dun",
];

/**
 * 会話の 1行に そえる 感情（記号と 体の 動き。data の Line・StoryPage に 書く）。
 * pause は 窓の 前に おく 間（ms。前の 窓を 閉じて 黙る。2026-10-19 作者「いちばん 見せたい ツッコミに wait を」）。
 * hit は ツッコミの 音（上の Hit）。
 */
export type Cue = {
	emote?: Emote;
	gesture?: Gesture;
	pause?: number;
	hit?: Hit;
	/**
	 * 海外ミームの 音（data/audio/sfx.ts の meme〜。2026-10-23 作者「寸劇に 多用する」）。窓の 前に、hit と 同じ 時に 鳴る。
	 * ツッコミで ない ところ（地の文・ボケ・やらかしの 瞬間）に 添える。ツッコミの 音は hit の boom・bruh など。
	 */
	meme?: string;
	/**
	 * 畳みかけ（ms）：字を 一度に 出し、押さなくても この ms で 次の 窓へ 送る（201 の 速さ。ボケの 連打）。
	 * 2026-10-21 作者「201 や でんじゃらすじーさんの 面白さ」。
	 */
	auto?: number;
};

/** 行から 感情だけ 取りだす（Story.say の opt に わたす。無ければ 空。どの 形の 行でも 受ける）。 */
export const cueOf = (line: object): Cue => {
	const c = line as Cue;
	return {
		...(c.emote ? { emote: c.emote } : {}),
		...(c.gesture ? { gesture: c.gesture } : {}),
		...(c.pause ? { pause: c.pause } : {}),
		...(c.hit ? { hit: c.hit } : {}),
		...(c.meme ? { meme: c.meme } : {}),
		...(c.auto ? { auto: c.auto } : {}),
	};
};
