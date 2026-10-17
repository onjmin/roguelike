// 場面の エフェクト（語りの 頁の オチと 山場に 重ねる、ドット絵の 演出。StoryPage.fx と ダンジョンの 噴火の 救出）。
// - 1マスの ドットを 画面の PX 倍で 描いた 粗い 画（ぼかさない）を、地図の 上・窓と 立ち絵の 下に 重ねる。
// - 見た目だけ（冒険の 乱数・状態・リプレイには さわらない。ゆらぎは 自前の 乱数）。
// - 端末の「動きを へらす」（prefers-reduced-motion）では ゆれと 白い 光を やめ、粒を へらす。速さ「はやい」は 短く する。

import { settings } from "./settings";

/** 場面の エフェクト。 */
export type SceneFx =
	/** 爆発（白い 光・ゆれ・ギザギザの 火の玉と「ドカーン」。煙は 頁の あいだ 残る）。 */
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
	| "memory";

export type FxRun = {
	/** 見せ場が 出おわった（この あとに 窓を 出す）。 */
	ready: Promise<void>;
	/** 残って いる 煙・粒・暗転を 消す。 */
	end(): void;
};

/** 1ドットの 大きさ（CSS px）。 */
const PX = 3;

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

/** ギザギザの 火の玉（角の 数 n、内の 半径は 外の rin 倍）。 */
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
	g.beginPath();
	for (let i = 0; i < n * 2; i++) {
		const a = turn + (i / (n * 2)) * Math.PI * 2;
		const rad = i % 2 === 0 ? r * jag[(i / 2) % jag.length] : r * rin;
		const x = Math.round(cx + Math.cos(a) * rad);
		const y = Math.round(cy + Math.sin(a) * rad);
		if (i === 0) g.moveTo(x, y);
		else g.lineTo(x, y);
	}
	g.closePath();
	g.fill();
};

type Layer = {
	cv: HTMLCanvasElement;
	g: CanvasRenderingContext2D;
	w: number;
	h: number;
};

const layer = (root: HTMLElement, cls: string): Layer | null => {
	const cv = document.createElement("canvas");
	cv.className = `scene-fx ${cls}`;
	root.appendChild(cv);
	// 大きさは 置いてから 測る（層いっぱいに 広がった 大きさ）
	const box = cv.getBoundingClientRect();
	const w = Math.max(1, Math.ceil(box.width / PX));
	const h = Math.max(1, Math.ceil(box.height / PX));
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
): FxRun => {
	const L = layer(root, "fx-boom");
	if (!L) return NONE;
	const r = rng(0xb00);
	const cx = L.w / 2;
	const cy = L.h * 0.42;
	const R = Math.min(L.w, L.h) * 0.36;
	const jag = Array.from({ length: 11 }, () => 0.75 + r() * 0.45);
	const word = dotWord("ドカーン", "#ffe14a", "#3a1408");
	// 煙（火の玉が はじけた あと 広がって、頁の あいだ ただよう）
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
	if (!bare && !still) {
		document.body.classList.add("shake");
		setTimeout(() => document.body.classList.remove("shake"), 420 * k);
	}
	const end = animate(L, (t, ending) => {
		const g = L.g;
		const out = ending === null ? 1 : Math.max(0, 1 - ending / fade);
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
					const x = p.x + p.vx * drift * 14;
					const y = p.y + p.vy * drift * 10;
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
		// 「ドカーン」（ぽんと 大きく 出て、少し 傾いて 残る）
		const wordEnd = hold + 500 * k;
		if (t < wordEnd) {
			const q = Math.min(1, t / pop);
			const scale = Math.max(
				1,
				Math.round((q < 1 ? 3 : 2) * (L.w > 200 ? 1.5 : 1)),
			);
			const ww = word.width * scale;
			const wh = word.height * scale;
			g.save();
			g.globalAlpha = t > hold ? Math.max(0, 1 - (t - hold) / (500 * k)) : 1;
			g.translate(Math.round(cx), Math.round(cy - R * 0.15));
			g.rotate(-0.12);
			g.drawImage(word, Math.round(-ww / 2), Math.round(-wh / 2), ww, wh);
			g.restore();
		}
		return ending === null || ending < fade;
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
	opt: { k?: number; bare?: boolean; caption?: string } = {},
): FxRun => {
	if (!root || typeof document === "undefined") return NONE;
	const k = opt.k ?? (settings.speed === "fast" ? 0.6 : 1);
	const still = stillMotion();
	switch (kind) {
		case "boom":
			return boom(root, k, still, !!opt.bare);
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
	}
};
