// メッセージ窓（名前欄・1文字ずつ表示・送り）と立ち絵。rpg の ui/message.ts から移した（村で使う）。
//
// 立ち絵は data/cast.ts の portrait.src の透過 PNG を出す。ファイルが無い／読めないときは
// キャラ色のダミー（シルエット＋名前）を出す。話している側を明るく、
// もう片方を少し暗くする（左右に1人ずつ）。
//
// 描く人の手間を減らすため、次の3つは自動で調整する。
// - 向き: 絵の向き（facing。既定は右向き）と立つ側が合わないときは左右反転して、中央を向かせる。
// - 大きさ・位置: 透明な余白を切り詰め、頭のてっぺんから足もとまでの高さがどのキャラも同じになる大きさで出す。
//   頭の横の中心を測って枠の中央に合わせ、てっぺんの高さもそろえる。キャンバスの大きさ・余白・ポーズは自由
//   （横に広がる髪・腕は、外側は画面の端まで出し、内側は左右の枠のあいだの真ん中でぼかして消す）。
// - 立ち位置: いつもの側がほかの話し手でふさがっていたら、空いている側（無ければ長く話していない側）へ回す。
//
// rpg の 読み上げ（声に 文字送りを 合わせる）は このゲームには 無いので 移していない。

import { publicUrl } from "../engine/assets";
import type { Input } from "../engine/input";
import { el } from "./dom";

type Side = "left" | "right";

export type PortraitSpec = {
	/** キャラ ID（同じ人なら出しっぱなしにする判定に使う）。 */
	id: string;
	name: string;
	color: string;
	src?: string;
	/** いつも立つ側。 */
	side: Side;
	/** ふさがっていても反対側へ回らず、いつも side に立つ（そこにいる人と入れ替わる）。 */
	fixedSide?: boolean;
	/** 色を反転して出す（ほかのキャラの絵を使い回して別人に見せる）。 */
	invert?: boolean;
	/** 絵の中のキャラが向いている向き（既定 "right" = 画面の右側を見ている）。 */
	facing?: Side;
	/** 全身絵の上から何割を見せるか（既定 0.58 ＝頭〜腰。1 で全身）。 */
	crop?: number;
	/** 自動でそろえたあとの大きさの倍率（既定 1）。 */
	scale?: number;
	/** 描いた絵の右へずらす（全身の高さに対する割合。反転したときは逆へ）。 */
	offsetX?: number;
	/** 下へずらす（全身の高さに対する割合）。 */
	offsetY?: number;
};

/** 全身絵のうち、会話で見せる上半身の割合の既定値。 */
const DEFAULT_CROP = 0.58;

/** この文字を出したあとの間（1文字ぶんの何倍か。句読点で少し止める）。 */
const pauseAfter = (c: string | undefined): number =>
	c === "、" || c === "。" ? 4 : 1;

/** 読み込んで測った立ち絵。 */
type Art = {
	/** 透明な余白を切り詰めた全身絵。 */
	canvas: HTMLCanvasElement;
	/** 頭のてっぺん（canvas の上からの px。アホ毛・耳の先などの細いはみ出しは除く）。 */
	top: number;
	/** てっぺんから足もとまでの高さ（px）。どのキャラもこれが同じ大きさになるように出す。 */
	body: number;
	/** 頭の横の中心（canvas の幅に対する割合。0 が左端）。これを枠の中央に合わせる。 */
	headX: number;
};

/** これ以下の不透明度（アンチエイリアスのかすれ）は余白とみなす。 */
const ALPHA_MIN = 8;
/** 頭の中心を測る帯の高さ（てっぺんから、全身の高さの何割まで。頭の上半分ほど）。 */
const HEAD_BAND = 0.1;

/** 立ち絵を読み込み、透明な余白を切り詰めて測る（src ごとに1回だけ）。 */
const trimmed = new Map<string, Promise<Art | null>>();
/** 読み込みが終わった立ち絵（null は「無い・読めない」＝ダミー）。 */
const ready = new Map<string, Art | null>();

/**
 * 切り詰めた範囲（左上 x0,y0・幅 w・高さ h）の中で、頭のてっぺん・足もと・頭の横の中心を測る。
 * rows は画像の行ごとの不透明な画素の数。
 * - てっぺん: 上の 1/4 の行の幅の中央値（≒頭の幅）の 2 割に満たない行は、アホ毛・耳の先・ごみとして飛ばす
 * - 足もと: 下の端のごく細い行（ごみ）を飛ばす
 * - 頭の中心: てっぺんから HEAD_BAND の帯にある不透明な画素の、横の位置の中央値。
 *   帯を浅くして、下から入ってくる腕・こぶし・ツインテールの房を数えない。帯の中でも、片側に少し出た
 *   リボン・帽子の飾り・髪の房は、平均でなく中央値なので効きにくい
 */
const measure = (
	data: Uint8ClampedArray,
	stride: number,
	rows: Uint32Array,
	x0: number,
	y0: number,
	w: number,
	h: number,
): Omit<Art, "canvas"> => {
	const upper = [
		...rows.subarray(y0, y0 + Math.max(1, Math.round(h / 4))),
	].sort((a, b) => a - b);
	const headW = upper[upper.length >> 1];
	let top = 0;
	while (top < h - 1 && rows[y0 + top] < Math.max(2, headW * 0.2)) top++;
	let bottom = h - 1;
	while (bottom > top && rows[y0 + bottom] < Math.max(2, headW * 0.02))
		bottom--;
	const body = bottom - top + 1;
	const cols = new Uint32Array(w);
	const band = top + Math.max(1, Math.round(body * HEAD_BAND));
	let total = 0;
	for (let y = top; y < band; y++) {
		for (let x = 0; x < w; x++) {
			if (data[((y0 + y) * stride + x0 + x) * 4 + 3] > ALPHA_MIN) {
				cols[x]++;
				total++;
			}
		}
	}
	// 列ごとの数を左から足して、半分に届く位置（列の中は割合で割り振る）
	let headX = 0.5;
	let acc = 0;
	for (let x = 0; total && x < w; x++) {
		if (acc + cols[x] >= total / 2) {
			headX = (x + (total / 2 - acc) / cols[x]) / w;
			break;
		}
		acc += cols[x];
	}
	return { top, body, headX };
};

const loadTrimmed = (src: string): Promise<Art | null> => {
	let p = trimmed.get(src);
	if (p) return p;
	p = new Promise<Art | null>((resolve) => {
		const img = new Image();
		img.onload = () => {
			const w = img.naturalWidth;
			const h = img.naturalHeight;
			const work = document.createElement("canvas");
			work.width = w;
			work.height = h;
			const ctx = work.getContext("2d", { willReadFrequently: true });
			if (!ctx || !w || !h) {
				resolve(null);
				return;
			}
			ctx.drawImage(img, 0, 0);
			let top = h;
			let left = w;
			let right = -1;
			let bottom = -1;
			let data: Uint8ClampedArray | null = null;
			/** 行ごとの不透明な画素の数。 */
			const rows = new Uint32Array(h);
			try {
				data = ctx.getImageData(0, 0, w, h).data;
				for (let y = 0; y < h; y++) {
					for (let x = 0; x < w; x++) {
						if (data[(y * w + x) * 4 + 3] > ALPHA_MIN) {
							rows[y]++;
							if (x < left) left = x;
							if (x > right) right = x;
						}
					}
					if (rows[y]) {
						if (y < top) top = y;
						bottom = y;
					}
				}
			} catch {
				// 読めない（別オリジン等）ときは切り詰めも測りもせずに使う
				data = null;
				left = 0;
				top = 0;
				right = w - 1;
				bottom = h - 1;
			}
			if (right < left || bottom < top) {
				resolve(null); // 全部透明
				return;
			}
			const out = document.createElement("canvas");
			out.width = right - left + 1;
			out.height = bottom - top + 1;
			out
				.getContext("2d")
				?.drawImage(
					work,
					left,
					top,
					out.width,
					out.height,
					0,
					0,
					out.width,
					out.height,
				);
			resolve({
				canvas: out,
				...(data
					? measure(data, w, rows, left, top, out.width, out.height)
					: { top: 0, body: out.height, headX: 0.5 }),
			});
		};
		img.onerror = () => resolve(null);
		img.src = publicUrl(src);
	});
	p.then((c) => ready.set(src, c));
	trimmed.set(src, p);
	return p;
};

export type MessageParams = {
	name?: string;
	color?: string;
	text: string;
	portrait?: PortraitSpec | null;
};

class PortraitSlot {
	readonly root: HTMLDivElement;
	readonly side: Side;
	private current: string | null = null;
	/** 最後にこの枠で話した時刻（どちらの枠を空けるかの判断用）。 */
	lastSpoke = 0;

	constructor(parent: HTMLElement, side: Side) {
		this.side = side;
		this.root = el("div", { class: `portrait ${side}` });
		parent.appendChild(this.root);
	}

	get id(): string | null {
		return this.current;
	}

	set(p: PortraitSpec): void {
		if (this.current === p.id) return;
		this.current = p.id;
		const dummy = () => {
			const d = el("div", { class: "portrait-dummy" }, [
				el("div", { class: "silhouette" }),
				el("div", { class: "label", text: `${p.name}\n立ち絵（仮）` }),
			]);
			d.style.setProperty("--char", p.color);
			this.root.replaceChildren(d);
		};
		const show = (art: Art | null) => {
			if (!art) {
				dummy();
				return;
			}
			// 全身絵の上の方（てっぺん〜全身の crop 割）だけを切り出して大きく見せる。
			// 切り口はメッセージ窓の裏に隠れ、下端は CSS でぼかす。
			// 大きさと位置は CSS で決める（全身の高さをそろえ、頭の中心を枠の中央に、切り口を枠の下端に）。
			const { canvas, top, body } = art;
			const crop = Math.min(1, Math.max(0.2, p.crop ?? DEFAULT_CROP));
			const cut = Math.max(1, Math.round(top + body * crop));
			const view = el("canvas", { class: "portrait-img" });
			view.width = canvas.width;
			view.height = cut;
			view.getContext("2d")?.drawImage(canvas, 0, 0);
			view.classList.toggle("cropped", crop < 1);
			// 立つ側から見て中央を向くように（左の枠は右向き、右の枠は左向き）
			const want: Side = this.side === "left" ? "right" : "left";
			const flip = (p.facing ?? "right") !== want;
			view.classList.toggle("flip", flip);
			view.classList.toggle("invert", !!p.invert);
			// 枠の中央に来る点（頭の中心）。反転するときは鏡に映した位置
			const hx = art.headX - ((p.offsetX ?? 0) * body) / canvas.width;
			const s = view.style;
			s.setProperty("--crop", String(crop));
			s.setProperty("--cut", String(cut / body));
			s.setProperty("--hx", String(flip ? 1 - hx : hx));
			// ぼかしは見せる上半身の下 18%
			s.setProperty("--fade-at", `${(1 - (0.18 * body * crop) / cut) * 100}%`);
			s.setProperty("--scale", String(p.scale ?? 1));
			s.setProperty("--dy", String(p.offsetY ?? 0));
			// 枠より広い絵は、出してよい範囲（.portrait-art）の内側の端でぼかして消す
			this.root.replaceChildren(el("div", { class: "portrait-art" }, [view]));
		};
		if (!p.src) {
			dummy();
		} else if (ready.has(p.src)) {
			show(ready.get(p.src) ?? null);
		} else {
			// 初めての絵は読み込みを待つ（一瞬ダミーが見えないように、その間は空けておく）
			this.root.replaceChildren();
			const id = p.id;
			void loadTrimmed(p.src).then((art) => {
				if (this.current === id) show(art);
			});
		}
		this.root.classList.add("shown");
	}

	dim(on: boolean): void {
		this.root.classList.toggle("dim", on);
	}

	clear(): void {
		this.current = null;
		this.lastSpoke = 0;
		this.root.classList.remove("shown", "dim");
		this.root.replaceChildren();
	}
}

export class MessageWindow {
	private win: HTMLDivElement;
	private nameEl: HTMLDivElement;
	private textEl: HTMLDivElement;
	private nextEl: HTMLDivElement;
	private left: PortraitSlot;
	private right: PortraitSlot;
	private input: Input;
	/** 1文字あたりの ms（0 で一瞬）。 */
	msPerChar: () => number;
	/** 効果音の区切りまで待つ（GameAudio.seSettled）。 */
	private settled: () => Promise<void>;
	/** show のたびに増える（前の文の区切り待ちが、次の文の ▼ を出さないように）。 */
	private showToken = 0;

	constructor(
		root: HTMLElement,
		input: Input,
		msPerChar: () => number,
		settled: () => Promise<void> = () => Promise.resolve(),
	) {
		this.input = input;
		this.msPerChar = msPerChar;
		this.settled = settled;
		const layer = el("div", { class: "portrait-layer" });
		root.appendChild(layer);
		this.left = new PortraitSlot(layer, "left");
		this.right = new PortraitSlot(layer, "right");
		this.nameEl = el("div", { class: "msg-name" });
		this.textEl = el("div", { class: "msg-text" });
		this.nextEl = el("div", { class: "msg-next", text: "▼" });
		this.win = el("div", { class: "msg window" }, [
			this.nameEl,
			this.textEl,
			this.nextEl,
		]);
		this.win.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			input.press("a");
		});
		root.appendChild(this.win);
	}

	get visible(): boolean {
		return this.win.classList.contains("shown");
	}

	/**
	 * どちらの枠に立たせるか。すでに出ていればその枠。いつもの側が空いていればそこ。
	 * ふさがっていれば反対側が空いているとき反対側、両方ふさがっていれば長く話していない方と入れ替える。
	 */
	private pickSlot(p: PortraitSpec): PortraitSlot {
		if (this.left.id === p.id) return this.left;
		if (this.right.id === p.id) return this.right;
		const home = p.side === "left" ? this.left : this.right;
		const away = home === this.left ? this.right : this.left;
		if (!home.id || p.fixedSide) return home;
		if (!away.id) return away;
		return home.lastSpoke <= away.lastSpoke ? home : away;
	}

	show(p: MessageParams): Promise<void> {
		this.win.classList.add("shown");
		this.nameEl.textContent = p.name ?? "";
		this.nameEl.style.display = p.name ? "" : "none";
		this.nameEl.style.setProperty("--char", p.color ?? "#fff");
		this.win.classList.toggle("narration", !p.name);
		if (p.portrait) {
			const slot = this.pickSlot(p.portrait);
			const other = slot === this.left ? this.right : this.left;
			slot.set(p.portrait);
			slot.lastSpoke = performance.now();
			slot.dim(false);
			other.dim(true);
		} else {
			this.left.dim(true);
			this.right.dim(true);
		}
		const chars = [...p.text];
		this.textEl.textContent = "";
		this.nextEl.classList.remove("shown");
		const token = ++this.showToken;
		return new Promise((resolve) => {
			let shown = 0;
			let timer = 0;
			/** 文が出きった。 */
			let done = false;
			/** 効果音の区切りまで鳴った（送れる）。 */
			let ready = false;
			const finish = () => {
				if (done) return;
				done = true;
				window.clearTimeout(timer);
				this.textEl.textContent = p.text;
				// 鳴らしたばかりの効果音の本体が鳴り終わってから ▼ を出して送れるようにする
				// （すぐ送ると次の効果音が畳みかけて重なる）
				void this.settled().then(() => {
					if (token !== this.showToken) return;
					ready = true;
					this.nextEl.classList.add("shown");
				});
			};
			const tick = () => {
				const ms = this.msPerChar();
				if (ms <= 0) {
					finish();
					return;
				}
				shown++;
				this.textEl.textContent = chars.slice(0, shown).join("");
				if (shown >= chars.length) finish();
				else timer = window.setTimeout(tick, ms * pauseAfter(chars[shown - 1]));
			};
			tick();
			const pop = this.input.push((key, repeat) => {
				if (repeat || (key !== "a" && key !== "b")) return;
				if (!done) {
					finish(); // 文字送りの飛ばしはいつでも効く
					return;
				}
				if (!ready) return; // 区切りまでは押しても送らない
				pop();
				resolve();
			});
		});
	}

	/** 窓と立ち絵を片付ける（スクリプト終了時）。 */
	close(): void {
		this.win.classList.remove("shown");
		this.left.clear();
		this.right.clear();
	}
}

/** 選択肢。 */
export class ChoiceWindow {
	private root: HTMLElement;
	private input: Input;
	/** 効果音の区切り待ちの最中か（GameAudio.seHeld）。 */
	private held: () => boolean;

	constructor(
		root: HTMLElement,
		input: Input,
		held: () => boolean = () => false,
	) {
		this.root = root;
		this.input = input;
		this.held = held;
	}

	choose(
		options: string[],
		cancel?: number,
		se?: (name: string) => void,
		start = 0,
	): Promise<number> {
		const box = el("div", { class: "choice window" });
		let cur = start;
		const items = options.map((label, i) => {
			const b = el("button", { class: "choice-item", text: label });
			b.addEventListener("pointerdown", (e) => {
				e.preventDefault();
				e.stopPropagation();
				// 区切り待ちの間は、押した項目にカーソルを合わせるだけ（もう一度押すと決まる）
				if (this.held()) {
					if (cur !== i) {
						cur = i;
						se?.("cursor");
						render();
					}
					return;
				}
				pick(i);
			});
			box.appendChild(b);
			return b;
		});
		const render = () =>
			items.forEach((b, i) => {
				b.classList.toggle("cur", i === cur);
			});
		render();
		this.root.appendChild(box);
		let pop: () => void = () => {};
		let resolveFn: (n: number) => void = () => {};
		const pick = (i: number) => {
			// 前の効果音の本体が鳴り終わるまでは決めない（カーソルは動かせる）
			if (this.held()) return;
			se?.("decide");
			pop();
			box.remove();
			resolveFn(i);
		};
		return new Promise((resolve) => {
			resolveFn = resolve;
			pop = this.input.push(
				(key) => {
					if (key === "up" || key === "left") {
						cur = (cur + options.length - 1) % options.length;
						se?.("cursor");
						render();
					} else if (key === "down" || key === "right") {
						cur = (cur + 1) % options.length;
						se?.("cursor");
						render();
					} else if (key === "a") {
						pick(cur);
					} else if (key === "b" && cancel !== undefined) {
						pick(cancel);
					}
				},
				{ tap: cancel === undefined ? null : "b" },
			);
		});
	}
}
