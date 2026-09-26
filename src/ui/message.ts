// メッセージ窓（名前欄・1文字ずつ表示・送り）と立ち絵。rpg の ui/message.ts をそのまま移した（村で使う）。
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
// 読み上げがあるときは、名前と立ち絵はすぐ出し、文字送りは声が鳴り始めるまで待たせる
// （VOICE_WAIT_MAX_MS を過ぎたら待たずに出し始める。そのときは終わりの文字（VOICE_HOLD_TAIL）を
// 声が聞こえるまで出さずに残し、声より先に出きらないようにする。合成の遅い roze は、セッションの
// 最初のほうで声の頭が数秒遅れることがある）。
// 声と揃えるのは出だしだけ。そのあとは設定の文字送りの速さを守り、声が長ければ少し遅くするだけ
// （設定の VOICE_PACE_MAX＝2倍まで）。声は1文字あたり設定よりずっと遅いので、短いセリフは声の
// 終わりごろに出きるが、ふつうの長さのセリフは声の半分ほどで出きる（読む速さはプレイヤーの設定が先）。
// 声の終わりの見込みは、合成待ちで声が後ろへずれたり止まったりすると延びる（SpeechStart.endAt）。
// 読み上げが OFF のとき（GameAudio.speak が started を返さないとき）は待たずにすぐ出し始める。

import { publicUrl } from "../engine/assets";
import type { Input } from "../engine/input";
import { el } from "./dom";

/**
 * 読み上げの鳴り始め（rpg の engine/audio.ts の SpeechStart と同じ形）。
 * このゲームには読み上げが無いので 使わないが、rpg と同じ窓のまま 移せるように残す。
 */
type SpeechStart = {
	startTime: number;
	/** 声の頭が聞こえる時刻（performance.now の時計）。 */
	at: number;
	durationSec: number;
	/** 声が鳴り終わる時刻（合成が遅れると延びる）。 */
	endAt: () => number;
};

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

/**
 * 声の鳴り始めを待って文字送りを止めておくいちばん長い時間（ms）。roze（貯め 0.4 秒）は
 * 開き直した直後の数行で声の頭が 1.2〜1.6 秒になるので、それを待てる長さにする。
 */
const VOICE_WAIT_MAX_MS = 1500;
/**
 * 声より先に文字送りを始めたとき（{@link VOICE_WAIT_MAX_MS} を過ぎた）、声が聞こえるまで
 * 出さずに残しておく終わりの文字の割合（1文字以上）。
 */
const VOICE_HOLD_TAIL = 0.25;
/** 終わりの文字を声まで残しておくいちばん長い時間（窓を出してからの ms）。 */
const VOICE_HOLD_MAX_MS = 5000;
/** 声に合わせて文字送りを遅くするときの上限（設定の1文字あたりの ms の何倍まで）。 */
const VOICE_PACE_MAX = 2;

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
	/** 表示と同時に呼ばれる（読み上げ開始。GameAudio.speak の戻り値をそのまま返せる）。 */
	onShow?: () => ShowHook | undefined;
};

/** {@link MessageParams.onShow} の戻り値。 */
export type ShowHook = {
	/** 送ったときに呼ばれる（読み上げ停止）。 */
	stop?: () => void;
	/**
	 * 声が鳴り始める時刻が決まったら解決する（鳴らないなら null）。あれば文字送りを
	 * 声の頭まで待たせ（VOICE_WAIT_MAX_MS まで。先に出し始めたら終わりの文字を声の頭まで残す）、
	 * 声の長さへ寄せる。無ければすぐ出し始める（読み上げ OFF・読めない本文）。
	 */
	started?: Promise<SpeechStart | null>;
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
		const hook = p.onShow?.();
		const stop = hook?.stop;
		const token = ++this.showToken;
		const shownAt = performance.now();
		return new Promise((resolve) => {
			let shown = 0;
			let timer = 0;
			/** 文が出きった。 */
			let done = false;
			/** 効果音の区切りまで鳴った（送れる）。 */
			let ready = false;
			/** 文字送りを始めた（声の頭を待ち終えた）。 */
			let typing = false;
			/**
			 * 声が鳴り終わる時刻（performance.now の時計）を返す。分かれば文字送りをこれに寄せる。
			 * 合成が遅れて声の後ろがずれると延びるので、毎回読む。
			 */
			let voiceEnd: (() => number) | null = null;
			const voice = hook?.started;
			/** 声の頭が聞こえる時刻（performance.now の時計）。分かるまでは Infinity、鳴らないなら 0。 */
			let voiceAt = voice ? Number.POSITIVE_INFINITY : 0;
			/** 声より先に出し始めたとき、声が聞こえるまで残しておく終わりの文字の数。 */
			const tail = Math.max(1, Math.ceil(chars.length * VOICE_HOLD_TAIL));
			/** 終わりの文字を残して、声の頭を待っている。 */
			let holding = false;
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
			/**
			 * 次の文字までの ms。声の長さが分かっていれば、残りの文字が声の終わりごろに
			 * 出きる速さへ寄せる（設定より速くはせず、設定の VOICE_PACE_MAX 倍より遅くもしない。
			 * 声は1文字あたり設定よりずっと遅いことが多く、ふつうは上限に当たって声より先に出きる）。
			 */
			const stepMs = (ms: number): number => {
				let per = ms;
				if (voiceEnd !== null) {
					let rest = 0;
					for (let i = shown - 1; i < chars.length - 1; i++)
						rest += pauseAfter(chars[i]);
					const left = voiceEnd() - performance.now();
					if (rest > 0 && left > 0)
						per = Math.min(ms * VOICE_PACE_MAX, Math.max(ms, left / rest));
				}
				return per * pauseAfter(chars[shown - 1]);
			};
			const tick = () => {
				const ms = this.msPerChar();
				if (ms <= 0) {
					finish();
					return;
				}
				// 声より先に出し始めていたら、声が聞こえるまで終わりの文字を残して止める
				// （短いセリフが声より先に出きらないように）。窓を出してから VOICE_HOLD_MAX_MS で諦める
				const now = performance.now();
				const until = Math.min(voiceAt, shownAt + VOICE_HOLD_MAX_MS);
				holding = shown >= chars.length - tail && until > now;
				if (holding) {
					timer = window.setTimeout(tick, until - now);
					return;
				}
				shown++;
				this.textEl.textContent = chars.slice(0, shown).join("");
				if (shown >= chars.length) finish();
				else timer = window.setTimeout(tick, stepMs(ms));
			};
			const startTyping = () => {
				if (typing || done || token !== this.showToken) return;
				typing = true;
				window.clearTimeout(timer);
				tick();
			};
			if (!voice) {
				startTyping();
			} else {
				// 声の頭まで文字送りを待たせる（名前と立ち絵はもう出ている）。待たせすぎない
				timer = window.setTimeout(startTyping, VOICE_WAIT_MAX_MS);
				void voice.then((cue) => {
					if (done || token !== this.showToken) return;
					voiceAt = cue ? cue.at : 0;
					if (cue) voiceEnd = cue.endAt;
					if (typing) {
						// 待ちきれずに出し始めていたら、残りの文字を声の長さに合わせる。
						// 終わりの文字を残して止めていたら、声の頭から続ける（鳴らないなら今すぐ）
						if (holding) {
							window.clearTimeout(timer);
							tick();
						}
						return;
					}
					if (!cue) {
						startTyping(); // 声は鳴らない
						return;
					}
					window.clearTimeout(timer);
					const at = Math.min(cue.at, shownAt + VOICE_WAIT_MAX_MS);
					timer = window.setTimeout(
						startTyping,
						Math.max(0, at - performance.now()),
					);
				});
			}
			const pop = this.input.push((key, repeat) => {
				if (repeat || (key !== "a" && key !== "b")) return;
				if (!done) {
					finish(); // 文字送りの飛ばしはいつでも効く
					return;
				}
				if (!ready) return; // 区切りまでは押しても送らない
				pop();
				stop?.();
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
