// 場面の エフェクト（語りの 頁の オチと 山場に 重ねる、ドット絵の 演出。StoryPage.fx と ダンジョンの 噴火の 救出）。
// - 1マスの ドットを 画面の PX 倍で 描いた 粗い 画（ぼかさない）を、地図の 上・窓と 立ち絵の 下に 重ねる。
// - 見た目だけ（冒険の 乱数・状態・リプレイには さわらない。ゆらぎは 自前の 乱数）。
// - 端末の「動きを へらす」（prefers-reduced-motion）では ゆれと 白い 光を やめ、粒を へらす。速さ「はやい」は 短く する。

import { publicUrl } from "./assets";
import { setSceneSlow } from "./sceneTime";
import { settings } from "./settings";

/** 場面の エフェクト。 */
export type SceneFx =
	/** 爆発（白い 光・ゆれ・ギザギザの 火の玉。字は 出さない。煙は 少し ただよって ひとりでに 晴れる）。 */
	| "boom"
	/** ぷつっと 暗転（溶かさずに 一瞬で 真っ黒。窓だけ 見える。明けも 一瞬）。 */
	| "blackout"
	/** チーン（色が 抜けて セピアの 止め絵に なる）。 */
	| "chiin"
	/** 紙吹雪（上から 降りつづける）。 */
	| "confetti"
	/** 草（下から 草が 生えて、ｗが 浮かぶ）。 */
	| "kusa"
	/** 回想（セピアと 四すみの 影。止め絵に せず 人は 動く。opt.caption で 左上に「2015年 夏」などの 札）。 */
	| "memory"
	/**
	 * スローモーション（上下に 黒い 帯・色が 少し 冷える。場面の 時間が SLOW 倍：人の 歩き・しぐさ。engine/sceneTime.ts）。
	 * 歩きだす 前に 始まる（FX_BEFORE_WALK）。
	 */
	| "slowmo"
	/**
	 * 止め絵の 決めポーズ（時間停止の 音・白い 光・集中線。人も 記号も 止まる。opt.caption で 左下に 名札）。
	 * 歩いた あと（ポーズを 決めた ところ）で 止める。
	 */
	| "freeze"
	/** 予告編（黒い 画面の まんなかに 大きな 字＝opt.caption。窓は その 下で 語る）。 */
	| "trailer"
	/** 爆発を 背に 歩く（背中の 側＝画面の 下の ほうで 爆発・上下の 帯・スロー。歩きだす 前に 始まる）。 */
	| "blast"
	/**
	 * 顔の カットイン（ツッコミ・驚きの 瞬間に、集中線の 帯に 立ち絵の 顔を 大きく 一瞬。opt.art は 立ち絵）。
	 * ひとりでに 消える（じーさんの「顔で 笑わせる」。2026-10-21）。
	 */
	| "cutin"
	/** 温められる（画面が 赤く 脈うち、まんなかから 湯気が のぼる。電子レンジの 中）。 */
	| "heat"
	/** たおれた（画面が 暗く 赤く なり、まんなかに 大きな 字＝opt.caption。すぐ 起きあがる 前の 一瞬。じーさんの「すぐ 死ぬ」）。 */
	| "ko"
	/** 豆電球（opt.track の 人の 頭の 上に ともる。暗い 町を ぼんやり 照らす）。 */
	| "bulb"
	/** 火（fxAt の マス・opt.track から 炎が 立つ。厨房の 鍋など）。 */
	| "fire"
	/**
	 * ジョジョの 引き（To Be Continued。2026-10-23 作者「寸劇に 仕込む。こりゃもう死んだなって 画面の 直前で」）。
	 * 曲が 流れだし、TBC_LEAD_MS で 画面が セピアの 止め絵に なって 左下に 矢印。TBC_HOLD_MS 見せて 消え、
	 * それから 窓（と その 行の 吹っとび）。やられる 直前の 行に 付ける。
	 */
	| "tbc";

/** 歩く 前に 始める エフェクト（スローの 中を 歩く・爆発を 背に 歩く・予告編の 黒の 上で 語る）。 */
export const FX_BEFORE_WALK: readonly SceneFx[] = [
	"slowmo",
	"blast",
	"trailer",
];

/** エフェクトに 添える 効果音（data/audio/sfx.ts。呼ぶ 側が 鳴らす）。 */
export const FX_SE: Partial<Record<SceneFx, string>> = {
	slowmo: "slowIn",
	freeze: "timeStop",
	trailer: "trailerHit",
	blast: "explosion",
	heat: "chiin",
	ko: "hitSting",
	tbc: "toBeContinued",
};

/** ジョジョの 引き：曲が 流れだしてから 止め絵に なるまで（ms。ギターが 盛りあがる ところ）。 */
const TBC_LEAD_MS = 2800;
/** ジョジョの 引き：止め絵と 矢印を 見せる 長さ（ms）。 */
const TBC_HOLD_MS = 2600;

/** スローモーションの 速さ（場面の 時間の 倍率）。 */
export const SLOW = 0.3;

export type FxRun = {
	/** 見せ場が 出おわった（この あとに 窓を 出す）。 */
	ready: Promise<void>;
	/** 残って いる 煙・粒・暗転を 消す。 */
	end(): void;
};

/** 1ドットの 大きさ（CSS px。爆発は BOOM_PX で 粗く する）。 */
const PX = 3;
const BOOM_PX = 6;

const NONE: FxRun = { ready: Promise.resolve(), end: () => {} };

const sleep = (ms: number): Promise<void> =>
	new Promise((r) => setTimeout(r, ms));

/** 見た目だけの ゆらぎ（冒険の 乱数とは べつ）。 */
const rng = (seed: number) => {
	let a = seed >>> 0;
	return (): number => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const stillMotion = (): boolean =>
	typeof window !== "undefined" &&
	!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** 縁どりした ドットの 字（DotGothic16 の 元の 16px で 描いて、拡大は にじませない）。 */
const dotWord = (
	text: string,
	fill: string,
	edge: string,
): HTMLCanvasElement => {
	const c = document.createElement("canvas");
	const size = 16;
	c.width = text.length * size + 4;
	c.height = size + 6;
	const g = c.getContext("2d");
	if (!g) return c;
	g.font = `${size}px DotGothic16, monospace`;
	g.textBaseline = "top";
	g.fillStyle = edge;
	for (const [dx, dy] of [
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1],
		[-1, -1],
		[1, 1],
		[1, -1],
		[-1, 1],
		[2, 2],
	])
		g.fillText(text, 2 + dx, 2 + dy);
	g.fillStyle = fill;
	g.fillText(text, 2, 2);
	// 半端な 色の 縁を 切って、ドットの 字に する
	const img = g.getImageData(0, 0, c.width, c.height);
	for (let i = 3; i < img.data.length; i += 4)
		img.data[i] = img.data[i] < 110 ? 0 : 255;
	g.putImageData(img, 0, 0);
	return c;
};

/** ドットの 丸（煙）。 */
const dotDisc = (
	g: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	r: number,
): void => {
	const rr = Math.max(1, Math.round(r));
	for (let y = -rr; y <= rr; y++) {
		const half = Math.round(Math.sqrt(rr * rr - y * y));
		g.fillRect(Math.round(cx) - half, Math.round(cy) + y, half * 2 + 1, 1);
	}
};

/**
 * ギザギザの 火の玉（角の 数 n、内の 半径は 外の rin 倍）。
 * 1ドットずつ 中か 外かを 決めて 横の 帯で 塗る（縁を ぼかさない）。
 */
const star = (
	g: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	r: number,
	n: number,
	rin: number,
	turn: number,
	jag: readonly number[],
): void => {
	const step = Math.PI / n;
	const tip = (i: number): number => {
		const j = ((i % (n * 2)) + n * 2) % (n * 2);
		return j % 2 === 0 ? jag[(j / 2) % jag.length] : rin;
	};
	const x0 = Math.round(cx);
	const y0 = Math.round(cy);
	const R = Math.ceil(r * Math.max(...jag, rin));
	for (let y = -R; y <= R; y++) {
		let run: number | null = null;
		for (let x = -R; x <= R + 1; x++) {
			let inside = false;
			if (x <= R) {
				const d = Math.hypot(x, y);
				const a = (Math.atan2(y, x) - turn) / step;
				const i = Math.floor(a);
				const f = a - i;
				inside = d <= r * (tip(i) * (1 - f) + tip(i + 1) * f);
			}
			if (inside && run === null) run = x;
			else if (!inside && run !== null) {
				g.fillRect(x0 + run, y0 + y, x - run, 1);
				run = null;
			}
		}
	}
};

type Layer = {
	cv: HTMLCanvasElement;
	g: CanvasRenderingContext2D;
	w: number;
	h: number;
};

const layer = (root: HTMLElement, cls: string, px = PX): Layer | null => {
	const cv = document.createElement("canvas");
	cv.className = `scene-fx ${cls}`;
	root.appendChild(cv);
	// 大きさは 置いてから 測る（層いっぱいに 広がった 大きさ）
	const box = cv.getBoundingClientRect();
	const w = Math.max(1, Math.ceil(box.width / px));
	const h = Math.max(1, Math.ceil(box.height / px));
	cv.width = w;
	cv.height = h;
	const g = cv.getContext("2d");
	if (!g) {
		cv.remove();
		return null;
	}
	g.imageSmoothingEnabled = false;
	return { cv, g, w, h };
};

/** 毎こまの 絵（t は 始まりからの ms、ending は end() からの ms。false で おわり）。 */
type Frame = (t: number, ending: number | null) => boolean;

const animate = (L: Layer, frame: Frame): (() => void) => {
	const t0 = performance.now();
	let endAt: number | null = null;
	const tick = (now: number) => {
		if (!L.cv.isConnected) return;
		L.g.clearRect(0, 0, L.w, L.h);
		const go = frame(now - t0, endAt === null ? null : now - endAt);
		if (go) requestAnimationFrame(tick);
		else L.cv.remove();
	};
	requestAnimationFrame(tick);
	return () => {
		if (endAt === null) endAt = performance.now();
	};
};

const boom = (
	root: HTMLElement,
	k: number,
	still: boolean,
	bare: boolean,
	/** 画面の 下の ほう（港から 町へ 上がる 人の 背中の 側。爆発を 背に 歩く）。 */
	behind = false,
	/** 爆発する 所（#ui の CSS 画素。家の 上 など）。無ければ 画面の まんなか。 */
	at?: { x: number; y: number },
	/** その 所の いまの 画面の 位置（カメラが 動いたら 追う）。 */
	track?: () => { x: number; y: number } | null,
): FxRun => {
	const L = layer(root, "fx-boom", BOOM_PX);
	if (!L) return NONE;
	const r = rng(0xb00);
	const cx = at ? at.x / BOOM_PX : L.w / 2;
	const cy = at ? at.y / BOOM_PX : L.h * (behind ? 0.74 : 0.42);
	const R = Math.min(L.w, L.h) * 0.36;
	const jag = Array.from({ length: 11 }, () => 0.75 + r() * 0.45);
	// 煙（火の玉が はじけた あと 広がって、少し ただよって 晴れる）
	const puffs = Array.from({ length: still ? 12 : 22 }, () => {
		const a = r() * Math.PI * 2;
		const d = r() * R * 0.9;
		return {
			x: cx + Math.cos(a) * d,
			y: cy + Math.sin(a) * d * 0.7,
			vx: Math.cos(a) * (0.6 + r() * 1.2),
			vy: -0.3 - r() * 0.8,
			r: R * (0.14 + r() * 0.18),
			shade: r() < 0.5 ? "#f2efe8" : "#e2ded6",
		};
	});
	const smoke = document.createElement("canvas");
	smoke.width = L.w;
	smoke.height = L.h;
	const sg = smoke.getContext("2d");
	const pop = 180 * k;
	const hold = 650 * k;
	const fade = 400;
	// 煙は 火の玉の あと これだけ ただよって、clear で 晴れる（窓を 送らなくても 消える。end() は 早めるだけ）
	const linger = 1100 * k;
	const clear = 600 * k;
	if (!bare && !still) {
		document.body.classList.add("shake");
		setTimeout(() => document.body.classList.remove("shake"), 420 * k);
	}
	const frame: Frame = (t, ending) => {
		const g = L.g;
		const gone = 1 - Math.min(1, Math.max(0, t - hold - linger) / clear);
		const out = gone * (ending === null ? 1 : Math.max(0, 1 - ending / fade));
		// 白い 光（最初の 2こま）
		if (!bare && t < 90 * k) {
			g.fillStyle = still ? "rgba(255,255,255,0.35)" : "#fff";
			g.fillRect(0, 0, L.w, L.h);
			return true;
		}
		// 煙
		const smokeIn = Math.min(1, Math.max(0, (t - hold * 0.5) / (300 * k)));
		if (smokeIn > 0 && sg) {
			// 煙は 別の 板に 不透明で 描いて（重なりに 筋が 出ない）、まとめて 半透明で 重ねる。
			// 1つの 雲は 影の 丸と、左上に ずらした 明るい 丸
			const life = (t - hold * 0.5) / 1000;
			const grow = Math.min(1.6, 1 + life * 0.3);
			const drift = Math.min(life, 3);
			sg.clearRect(0, 0, L.w, L.h);
			for (const pass of [0, 1])
				for (const p of puffs) {
					const x = p.x + p.vx * drift * 7;
					const y = p.y + p.vy * drift * 5;
					const rr = p.r * grow;
					sg.fillStyle = pass === 0 ? "#9d978e" : p.shade;
					if (pass === 0) dotDisc(sg, x, y, rr);
					else dotDisc(sg, x - rr * 0.18, y - rr * 0.2, rr * 0.8);
				}
			g.globalAlpha = 0.92 * smokeIn * out;
			g.drawImage(smoke, 0, 0);
			g.globalAlpha = 1;
		}
		// 火の玉（ふくらんで、はじけて 消える）
		if (t < hold) {
			const q = Math.min(1, t / pop);
			const size = R * (0.3 + 0.7 * q) * (t > hold * 0.7 ? 1.08 : 1);
			const turn = Math.floor(t / (70 * k)) % 2 ? 0.08 : 0;
			g.fillStyle = "#c8261b";
			star(g, cx, cy, size, 11, 0.62, turn, jag);
			g.fillStyle = "#ff8a1e";
			star(g, cx, cy, size * 0.74, 11, 0.6, turn + 0.15, jag);
			g.fillStyle = "#ffe14a";
			star(g, cx, cy, size * 0.46, 9, 0.6, turn + 0.3, jag);
			g.fillStyle = "#fffbe0";
			dotDisc(g, cx, cy, size * 0.16);
		}
		return out > 0;
	};
	// 地図の 所に 出した 爆発は、カメラが 動いても その 所に 残る（煙が 家から ずれない）
	const end = animate(L, (t, ending) => {
		const p = track?.();
		if (!p) return frame(t, ending);
		L.g.save();
		L.g.translate(
			Math.round(p.x / BOOM_PX - cx),
			Math.round(p.y / BOOM_PX - cy),
		);
		const go = frame(t, ending);
		L.g.restore();
		return go;
	});
	return { ready: sleep(hold), end };
};

const blackout = (root: HTMLElement): FxRun => {
	const L = layer(root, "fx-blackout");
	if (!L) return NONE;
	L.g.fillStyle = "#000";
	L.g.fillRect(0, 0, L.w, L.h);
	return { ready: sleep(500), end: () => L.cv.remove() };
};

const chiin = (root: HTMLElement, k: number): FxRun => {
	const d = document.createElement("div");
	d.className = "scene-fx fx-chiin";
	root.appendChild(d);
	void d.offsetWidth;
	d.classList.add("on");
	return {
		ready: sleep(300 * k),
		end: () => {
			d.classList.remove("on");
			setTimeout(() => d.remove(), 300);
		},
	};
};

const memory = (root: HTMLElement, k: number, caption?: string): FxRun => {
	const d = document.createElement("div");
	d.className = "scene-fx fx-memory";
	if (caption) {
		const c = document.createElement("span");
		c.className = "fx-memory-caption";
		c.textContent = caption;
		d.appendChild(c);
	}
	root.appendChild(d);
	void d.offsetWidth;
	d.classList.add("on");
	return {
		ready: sleep(500 * k),
		end: () => {
			d.classList.remove("on");
			setTimeout(() => d.remove(), 500);
		},
	};
};

const CONFETTI = [
	"#ff5a5a",
	"#ffd23f",
	"#4ad06a",
	"#4aa8ff",
	"#c070ff",
	"#ffffff",
];

const confetti = (root: HTMLElement, still: boolean): FxRun => {
	const L = layer(root, "fx-confetti");
	if (!L) return NONE;
	const r = rng(0xc0f);
	const n = still ? 50 : 160;
	const bits = Array.from({ length: n }, () => ({
		x: r() * L.w,
		// 最初の 波は 画面の 上に 並べて、すこしずつ 降りて くる
		y: -r() * L.h * 0.6,
		v: 30 + r() * 30,
		sway: r() * Math.PI * 2,
		color: CONFETTI[Math.floor(r() * CONFETTI.length)],
		flip: r() * 400,
	}));
	let last = 0;
	const end = animate(L, (t, ending) => {
		const dt = Math.min(0.05, (t - last) / 1000);
		last = t;
		let live = 0;
		for (const b of bits) {
			b.y += b.v * dt * (still ? 0.6 : 1);
			if (b.y > L.h + 2) {
				if (ending !== null) continue;
				b.y = -3;
				b.x = r() * L.w;
			}
			live++;
			const x = Math.round(b.x + Math.sin(t / 380 + b.sway) * 3);
			const wide = Math.floor((t + b.flip) / 160) % 2 === 0;
			L.g.fillStyle = b.color;
			L.g.fillRect(x, Math.round(b.y), wide ? 3 : 1, wide ? 2 : 3);
		}
		return ending === null || live > 0;
	});
	return { ready: Promise.resolve(), end };
};

/** 草の 株（下が 根もと。# が 濃い 緑、o が 明るい 緑）。 */
const TUFTS: readonly (readonly string[])[] = [
	["o...o", "#..o#", ".#.#.", ".###."],
	["..o..", "o.#.o", "#.#.#", ".###."],
	["o..", "#.o", "##."],
	["...o", "o.#.", ".##.", "###."],
];

const kusa = (root: HTMLElement, k: number, still: boolean): FxRun => {
	const L = layer(root, "fx-kusa");
	if (!L) return NONE;
	const r = rng(0x575);
	// 画面じゅうに ぽこぽこ 生える 草（下ほど 大きい）。ｗは 草の 株から 浮かぶ
	const tufts = Array.from({ length: Math.ceil((L.w * L.h) / 700) }, () => {
		const y = Math.floor(L.h * (0.08 + r() * 0.92));
		return {
			x: Math.floor(r() * L.w),
			y,
			scale: y > L.h * 0.6 ? 3 : 2,
			shape: TUFTS[Math.floor(r() * TUFTS.length)],
			at: r() * 1100 * k,
		};
	});
	const ws = Array.from({ length: still ? 6 : 18 }, (_, i) => {
		const s = tufts[(i * 7) % tufts.length];
		return { x: s.x, y: s.y - 6, at: s.at + 200 * k, rise: 8 + r() * 10 };
	});
	const w = dotWord("ｗ", "#7be36a", "#123a10");
	const fade = 450;
	const end = animate(L, (t, ending) => {
		const g = L.g;
		g.globalAlpha = ending === null ? 1 : Math.max(0, 1 - ending / fade);
		for (const s of tufts) {
			const q = Math.min(1, Math.max(0, (t - s.at) / (220 * k)));
			if (q <= 0) continue;
			const scale = s.scale;
			const rows = Math.ceil(s.shape.length * q);
			const base = s.y;
			for (let y = 0; y < rows; y++) {
				const line = s.shape[s.shape.length - 1 - y];
				for (let x = 0; x < line.length; x++) {
					const c = line[x];
					if (c === ".") continue;
					g.fillStyle = c === "o" ? "#8fe36a" : "#2f9a3a";
					g.fillRect(s.x + x * scale, base - (y + 1) * scale, scale, scale);
				}
			}
		}
		for (const p of ws) {
			const life = (t - p.at) / 1000;
			if (life < 0 || life > 2.2) continue;
			g.save();
			g.globalAlpha *= Math.min(1, 2.2 - life);
			g.drawImage(
				w,
				Math.round(p.x),
				Math.round(p.y - w.height - life * p.rise * 3),
			);
			g.restore();
		}
		g.globalAlpha = 1;
		return ending === null || ending < fade;
	});
	return { ready: sleep(400 * k), end };
};

/** 上下の 黒い 帯と 冷えた 色（スロー・爆発を 背に）。場面の 時間を SLOW 倍に して、end で もどす。 */
const slowmo = (root: HTMLElement, k: number): FxRun => {
	const d = document.createElement("div");
	d.className = "scene-fx fx-slowmo";
	root.appendChild(d);
	void d.offsetWidth;
	d.classList.add("on");
	setSceneSlow(SLOW);
	return {
		ready: sleep(350 * k),
		end: () => {
			setSceneSlow(1);
			d.classList.remove("on");
			setTimeout(() => d.remove(), 350);
		},
	};
};

/** 止め絵：白い 光 → 色の 濃い 止め絵に 集中線、左下に 名札。人も 記号も 止まる。 */
const freeze = (root: HTMLElement, k: number, caption?: string): FxRun => {
	const d = document.createElement("div");
	d.className = "scene-fx fx-freeze";
	const lines = document.createElement("div");
	lines.className = "fx-freeze-lines";
	d.appendChild(lines);
	if (caption) {
		const c = document.createElement("span");
		c.className = "fx-freeze-caption";
		c.textContent = caption;
		d.appendChild(c);
	}
	root.appendChild(d);
	void d.offsetWidth;
	d.classList.add("on");
	setSceneSlow(0);
	return {
		ready: sleep(450 * k),
		end: () => {
			setSceneSlow(1);
			d.remove();
		},
	};
};

/** 予告編：黒い 画面の まんなかに 大きな 字。 */
const trailer = (root: HTMLElement, k: number, caption?: string): FxRun => {
	const d = document.createElement("div");
	d.className = "scene-fx fx-trailer";
	const c = document.createElement("span");
	c.className = "fx-trailer-caption";
	c.textContent = caption ?? "";
	d.appendChild(c);
	root.appendChild(d);
	void d.offsetWidth;
	d.classList.add("on");
	return {
		ready: sleep(900 * k),
		end: () => {
			d.classList.remove("on");
			setTimeout(() => d.remove(), 400);
		},
	};
};

/** 爆発を 背に：上の ほうで 爆発（白い 光なし）と スローの 帯。爆発を 待たずに 歩きだす。 */
const blast = (root: HTMLElement, k: number, still: boolean): FxRun => {
	const s = slowmo(root, k);
	const b = boom(root, k, still, true, true);
	return {
		ready: s.ready,
		end: () => {
			b.end();
			s.end();
		},
	};
};

/** 顔の カットイン：集中線の 帯が 右から 入り、立ち絵の 顔を 大きく。ひとりでに 消える。 */
const cutin = (root: HTMLElement, k: number, art?: string): FxRun => {
	const d = document.createElement("div");
	d.className = "scene-fx fx-cutin";
	const band = document.createElement("div");
	band.className = "fx-cutin-band";
	if (art) {
		const img = document.createElement("img");
		img.className = "fx-cutin-face";
		img.src = publicUrl(art);
		band.appendChild(img);
	}
	// 驚きの 印（立ち絵は ふだんの 顔なので、帯に 大きな「！！」を 重ねる）
	const mark = document.createElement("span");
	mark.className = "fx-cutin-mark";
	mark.textContent = "！！";
	band.appendChild(mark);
	d.appendChild(band);
	root.appendChild(d);
	void d.offsetWidth;
	d.classList.add("on");
	const gone = window.setTimeout(() => d.remove(), 900 * k);
	return {
		ready: sleep(380 * k),
		end: () => {
			window.clearTimeout(gone);
			d.remove();
		},
	};
};

/** 温められる：画面が 赤く 脈うち、まんなか（キリコ）から 湯気が のぼる。 */
const heat = (
	root: HTMLElement,
	k: number,
	still: boolean,
	/** 温められる 人の 画面の 位置（#ui の CSS 画素。湯気は ここから）。無ければ 画面の まんなか。 */
	track?: () => { x: number; y: number } | null,
): FxRun => {
	const L = layer(root, "fx-heat");
	if (!L) return NONE;
	const r = rng(0x4ea7);
	const at = () => {
		const p = track?.();
		return p ? { x: p.x / PX, y: p.y / PX } : { x: L.w / 2, y: L.h * 0.45 };
	};
	const puffs = Array.from({ length: still ? 6 : 16 }, () => ({
		x: (r() - 0.5) * 12,
		at: r() * 900,
		r: 3 + r() * 4,
		sway: r() * Math.PI * 2,
	}));
	const fade = 400;
	const end = animate(L, (t, ending) => {
		const g = L.g;
		const out = ending === null ? 1 : Math.max(0, 1 - ending / fade);
		// 電子レンジの 中：赤い 光が 脈うつ
		const pulse = 0.18 + 0.12 * Math.sin(t / 90);
		g.fillStyle = `rgba(255,80,20,${pulse * out})`;
		g.fillRect(0, 0, L.w, L.h);
		g.fillStyle = `rgba(255,255,255,${0.8 * out})`;
		const o = at();
		for (const p of puffs) {
			const life = ((t - p.at) % 1100) / 1100;
			if (t < p.at) continue;
			const y = o.y - 6 - life * 40;
			const x = o.x + p.x + Math.sin(life * 6 + p.sway) * 4;
			g.globalAlpha = (1 - life) * out;
			dotDisc(g, x, y, p.r * (0.6 + life));
		}
		g.globalAlpha = 1;
		return ending === null || ending < fade;
	});
	return { ready: sleep(500 * k), end };
};

/** 豆電球：人の 頭の 上に 小さな 電球が ともり、まわりが ぼんやり 明るい。カメラが 動いたら 追う。 */
const bulb = (
	root: HTMLElement,
	still: boolean,
	/** 電球を 灯す 人の 画面の 位置（#ui の CSS 画素）。無ければ 画面の まんなか。 */
	track?: () => { x: number; y: number } | null,
): FxRun => {
	const L = layer(root, "fx-bulb");
	if (!L) return NONE;
	const at = () => {
		const p = track?.();
		return p ? { x: p.x / PX, y: p.y / PX } : { x: L.w / 2, y: L.h * 0.45 };
	};
	const fade = 250;
	const end = animate(L, (t, ending) => {
		const g = L.g;
		const out = ending === null ? 1 : Math.max(0, 1 - ending / fade);
		// ともる 瞬間に 2度 またたいて から 落ちつく（止まった 絵の 設定では またたかない）
		const on = still || t > 360 || Math.floor(t / 90) % 2 === 1 ? 1 : 0.25;
		const o = at();
		const x = Math.round(o.x);
		const y = Math.round(o.y) - 13;
		// まわりの 明かり（暗い 町に ぼんやり）
		const flick = still ? 1 : 0.9 + 0.1 * Math.sin(t / 70);
		for (const [r, a] of [
			[16, 0.1],
			[10, 0.16],
			[6, 0.24],
		] as const) {
			g.fillStyle = `rgba(255,230,140,${a * on * flick * out})`;
			dotDisc(g, x, y, r);
		}
		// ガラスの 玉と 口金
		g.globalAlpha = out;
		g.fillStyle = on === 1 ? "#fff6c0" : "#a8a088";
		dotDisc(g, x, y, 3);
		g.fillStyle = on === 1 ? "#ffd84a" : "#80785c";
		g.fillRect(x - 1, y - 1, 2, 2);
		g.fillStyle = "#8a8a92";
		g.fillRect(x - 2, y + 3, 4, 2);
		g.fillStyle = "#5a5a62";
		g.fillRect(x - 1, y + 5, 2, 1);
		g.globalAlpha = 1;
		return ending === null || ending < fade;
	});
	return { ready: sleep(450), end };
};

/** 火：マス（鍋・コンロ）から 炎が ゆらゆら 立つ。カメラが 動いたら 追う。 */
const fire = (
	root: HTMLElement,
	still: boolean,
	track?: () => { x: number; y: number } | null,
): FxRun => {
	const L = layer(root, "fx-fire");
	if (!L) return NONE;
	const r = rng(0xf13e);
	const tongues = Array.from({ length: 7 }, (_, i) => ({
		x: (i - 3) * 2.2,
		h: 6 + r() * 6,
		ph: r() * Math.PI * 2,
	}));
	const fade = 300;
	const end = animate(L, (t, ending) => {
		const g = L.g;
		const out = ending === null ? 1 : Math.max(0, 1 - ending / fade);
		const p = track?.();
		const o = p ? { x: p.x / PX, y: p.y / PX } : { x: L.w / 2, y: L.h * 0.45 };
		// 燃え上がる（はじめの 300ms で 背が のびる）
		const grow = Math.min(1, t / 300);
		g.globalAlpha = out;
		for (const q of tongues) {
			const sway = still ? 0 : Math.sin(t / 80 + q.ph) * 1.5;
			const h = q.h * grow * (still ? 1 : 0.8 + 0.2 * Math.sin(t / 60 + q.ph));
			for (let k = 0; k < h; k++) {
				const w = Math.max(1, Math.round((1 - k / h) * 3));
				g.fillStyle =
					k < h * 0.35 ? "#fff2a0" : k < h * 0.7 ? "#ffa030" : "#e84020";
				g.fillRect(
					Math.round(o.x + q.x + sway * (k / h)) - Math.floor(w / 2),
					Math.round(o.y + 4 - k),
					w,
					1,
				);
			}
		}
		g.globalAlpha = 1;
		return ending === null || ending < fade;
	});
	return { ready: sleep(350), end };
};

/** たおれた：画面が 暗く 赤く なり、まんなかに 大きな 字。 */
const ko = (root: HTMLElement, k: number, caption?: string): FxRun => {
	const d = document.createElement("div");
	d.className = "scene-fx fx-ko";
	const c = document.createElement("span");
	c.className = "fx-ko-caption";
	c.textContent = caption ?? "";
	d.appendChild(c);
	root.appendChild(d);
	void d.offsetWidth;
	d.classList.add("on");
	return {
		ready: sleep(500 * k),
		end: () => {
			d.classList.remove("on");
			setTimeout(() => d.remove(), 250);
		},
	};
};

/** 画面の 上の 層（#ui。画面の ない シミュレーションでは null）。 */
export const fxRoot = (): HTMLElement | null =>
	typeof document === "undefined" ? null : document.getElementById("ui");

/**
 * 場面の エフェクトを 出す（root は 画面の 上の 層 #ui）。ready を 待ってから 窓を 出し、頁が おわったら end()。
 * 画面の ない ところ（シミュレーション）では 何も しない。
 */
export const startFx = (
	root: HTMLElement | null,
	kind: SceneFx,
	opt: {
		k?: number;
		bare?: boolean;
		caption?: string;
		art?: string;
		at?: { x: number; y: number };
		/** at の いまの 位置（カメラが 動いたら 追う。爆発・温め）。 */
		track?: () => { x: number; y: number } | null;
	} = {},
): FxRun => {
	if (!root || typeof document === "undefined") return NONE;
	const k = opt.k ?? (settings.speed === "fast" ? 0.6 : 1);
	const still = stillMotion();
	switch (kind) {
		case "cutin":
			return cutin(root, k, opt.art);
		case "heat":
			return heat(root, k, still, opt.track);
		case "ko":
			return ko(root, k, opt.caption);
		case "bulb":
			return bulb(root, still, opt.track);
		case "fire":
			return fire(root, still, opt.track);
		case "boom":
			return boom(
				root,
				k,
				still,
				!!opt.bare,
				false,
				opt.at ?? opt.track?.() ?? undefined,
				opt.track,
			);
		case "blackout":
			return blackout(root);
		case "chiin":
			return chiin(root, k);
		case "confetti":
			return confetti(root, still);
		case "kusa":
			return kusa(root, k, still);
		case "memory":
			return memory(root, k, opt.caption);
		case "slowmo":
			return slowmo(root, k);
		case "freeze":
			return freeze(root, k, opt.caption);
		case "trailer":
			return trailer(root, k, opt.caption);
		case "blast":
			return blast(root, k, still);
		case "tbc":
			return tbc(root);
	}
};

/** ジョジョの 引き（"tbc"）。止め絵は その 時の 画面（#screen）の 写し。 */
const tbc = (root: HTMLElement): FxRun => {
	const d = document.createElement("div");
	d.className = "tbc";
	let gone = false;
	const end = () => {
		gone = true;
		d.remove();
	};
	const ready = (async () => {
		await sleep(TBC_LEAD_MS);
		if (gone) return;
		const src = document.getElementById("screen");
		const snap = document.createElement("canvas");
		if (src instanceof HTMLCanvasElement) {
			snap.width = src.width;
			snap.height = src.height;
			snap.getContext("2d")?.drawImage(src, 0, 0);
		}
		const arrow = document.createElement("div");
		arrow.className = "tbc-arrow";
		const label = document.createElement("span");
		label.textContent = "To Be Continued";
		arrow.appendChild(label);
		d.append(snap, arrow);
		root.appendChild(d);
		void d.offsetWidth;
		d.classList.add("shown");
		await sleep(TBC_HOLD_MS);
		d.classList.add("leaving");
		await sleep(300);
		d.remove();
	})();
	return { ready, end };
};
