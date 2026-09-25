// 入力（キーボード・画面上の十字キー/ボタン・タップ）をまとめる。rpg の input.ts を8方向にしたもの。
//
// - 方向は「押しっぱなし」を持つ（フィールドの移動はポーリングで読む）。
//   キーボードは押している方向キーを足し合わせるので、↑と→を同時に押せば右上になる。
// - A/B などの「押した瞬間」は、ハンドラのスタック最上段に配る。
//   メッセージ窓・選択肢・メニューがハンドラを積み、閉じたら外す。
//   スタックが空のときはフィールド用キューに入る。

import type { Dir8 } from "../core/geom";
import type { Dir } from "./types";

/** 窓（メニュー）が受けるキー。斜めは窓では使わない。 */
export type Key =
	| Dir
	| "a"
	| "b"
	| "wait"
	| "foot"
	| "map"
	| "throw"
	| "stairs";
type Handler = (key: Key, repeat: boolean) => void;
/**
 * ハンドラを積むときの設定。
 * - tap: 窓の外（フィールド）をタップしたときに押したことにするキー（既定 "a"＝メッセージ送り）。
 *   メニュー・選択肢は "b"（とじる）。null なら何もしない
 */
export type PushOptions = { tap?: Key | null };

/** 方向キー → 向き（0=上 から時計回り）。 */
const DIR_KEYS: Record<string, Dir8> = {
	ArrowUp: 0,
	ArrowRight: 2,
	ArrowDown: 4,
	ArrowLeft: 6,
	KeyW: 0,
	KeyD: 2,
	KeyS: 4,
	KeyA: 6,
	// vi キー
	KeyK: 0,
	KeyL: 2,
	KeyJ: 4,
	KeyH: 6,
	KeyU: 1,
	KeyN: 3,
	KeyB: 5,
	KeyY: 7,
	// テンキー
	Numpad8: 0,
	Numpad9: 1,
	Numpad6: 2,
	Numpad3: 3,
	Numpad2: 4,
	Numpad1: 5,
	Numpad4: 6,
	Numpad7: 7,
	// NumLock を切ったテンキー
	PageUp: 1,
	PageDown: 3,
	End: 5,
	Home: 7,
};

const OTHER_KEYS: Record<string, Key> = {
	KeyZ: "a",
	Enter: "a",
	NumpadEnter: "a",
	Space: "a",
	KeyX: "b",
	Escape: "b",
	Backspace: "b",
	KeyI: "b",
	Period: "wait",
	Numpad5: "wait",
	Clear: "wait",
	KeyG: "foot",
	Comma: "foot",
	KeyM: "map",
	KeyT: "throw",
	KeyV: "stairs",
};

/** 押しっぱなしで意味が変わるキー（トルネコのボタンの組み合わせの代わり）。 */
const MOD_KEYS: Record<string, keyof Mods> = {
	ShiftLeft: "dash",
	ShiftRight: "dash",
	KeyR: "diag",
	KeyF: "turn",
	ControlLeft: "turn",
};

export type Mods = {
	/** ダッシュ（何かあるまで走る）。 */
	dash: boolean;
	/** 斜めにしか動かない。 */
	diag: boolean;
	/** 向きだけ変える（動かない）。 */
	turn: boolean;
};

const VEC: readonly [number, number][] = [
	[0, -1],
	[1, -1],
	[1, 0],
	[1, 1],
	[0, 1],
	[-1, 1],
	[-1, 0],
	[-1, -1],
];

const dirFromVec = (dx: number, dy: number): Dir8 | null => {
	const sx = Math.sign(dx);
	const sy = Math.sign(dy);
	if (!sx && !sy) return null;
	return VEC.findIndex(([x, y]) => x === sx && y === sy) as Dir8;
};

/** 窓に配るときの4方向（斜めは縦を優先）。 */
const toDir4 = (d: Dir8): Dir =>
	d === 0 || d === 1 || d === 7
		? "up"
		: d === 3 || d === 4 || d === 5
			? "down"
			: d === 2
				? "right"
				: "left";

export class Input {
	/** キーボードで押している方向キー（code → 向き）。 */
	private keysHeld = new Map<string, Dir8>();
	/** 十字キー（画面）で押している向き。 */
	private padDir: Dir8 | null = null;
	/** 最後に方向を押し始めた時刻（同時押しの待ち合わせ用）。 */
	private dirSince = 0;
	private handlers: { fn: Handler; tap: Key | null }[] = [];
	private fieldQueue: Key[] = [];
	private keyMods: Mods = { dash: false, diag: false, turn: false };
	/** 画面のボタンで入れた切り替え（ダッシュ・斜め・向き）。 */
	readonly toggles: Mods = { dash: false, diag: false, turn: false };
	/** フィールドでのタップ（canvas の左上から数えた CSS 画素）。 */
	onFieldTap: ((x: number, y: number) => void) | null = null;
	/** 何かしら入力があったとき（オーディオのアンロック用）。 */
	onAnyInput: (() => void) | null = null;
	/** 切り替えが変わったとき（HUD の見た目用）。 */
	onModsChange: (() => void) | null = null;

	constructor() {
		window.addEventListener("keydown", (e) => {
			const t = e.target as HTMLElement | null;
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
			const mod = MOD_KEYS[e.code];
			if (mod) {
				this.keyMods[mod] = true;
				e.preventDefault();
				return;
			}
			const d = DIR_KEYS[e.code];
			if (d !== undefined) {
				e.preventDefault();
				if (!this.keysHeld.size && this.padDir === null)
					this.dirSince = performance.now();
				this.keysHeld.set(e.code, d);
				this.press(toDir4(d), e.repeat);
				return;
			}
			const key = OTHER_KEYS[e.code];
			if (!key) return;
			e.preventDefault();
			this.press(key, e.repeat);
		});
		window.addEventListener("keyup", (e) => {
			const mod = MOD_KEYS[e.code];
			if (mod) this.keyMods[mod] = false;
			this.keysHeld.delete(e.code);
		});
		window.addEventListener("blur", () => {
			this.keysHeld.clear();
			this.padDir = null;
			this.keyMods = { dash: false, diag: false, turn: false };
		});
	}

	/** 押した瞬間のキーを配る。 */
	press(key: Key, repeat = false): void {
		this.onAnyInput?.();
		const top = this.handlers[this.handlers.length - 1];
		if (top) {
			top.fn(key, repeat);
			return;
		}
		const isDir =
			key === "up" || key === "down" || key === "left" || key === "right";
		if (!repeat && !isDir) this.fieldQueue.push(key);
	}

	/**
	 * いま押されている向き。画面の十字キーが優先。キーボードは押している方向キーを足し合わせる
	 * （↑と→で右上。逆向きどうしは打ち消す）。
	 */
	heldDir(): Dir8 | null {
		if (this.padDir !== null) return this.padDir;
		let dx = 0;
		let dy = 0;
		for (const d of this.keysHeld.values()) {
			dx += VEC[d][0];
			dy += VEC[d][1];
		}
		return dirFromVec(dx, dy);
	}

	/** 方向を押し始めてからの ms（キーボードの同時押しを待つのに使う）。 */
	heldFor(): number {
		return performance.now() - this.dirSince;
	}

	/** 押しっぱなしのキーと画面の切り替えを合わせたもの。 */
	mods(): Mods {
		return {
			dash: this.keyMods.dash || this.toggles.dash,
			diag: this.keyMods.diag || this.toggles.diag,
			turn: this.keyMods.turn || this.toggles.turn,
		};
	}

	setToggle(k: keyof Mods, v: boolean): void {
		this.toggles[k] = v;
		this.onModsChange?.();
	}

	/** ハンドラを積む。戻り値を呼ぶと外れる。 */
	push(handler: Handler, opt: PushOptions = {}): () => void {
		const h = { fn: handler, tap: opt.tap === undefined ? "a" : opt.tap };
		this.handlers.push(h);
		this.fieldQueue = [];
		return () => {
			const i = this.handlers.lastIndexOf(h);
			if (i >= 0) this.handlers.splice(i, 1);
		};
	}

	get busy(): boolean {
		return this.handlers.length > 0;
	}

	/** フィールド用キューから1つ取り出す。 */
	takeField(): Key | undefined {
		return this.fieldQueue.shift();
	}

	clearField(): void {
		this.fieldQueue = [];
	}

	/** 画面上の十字キー（1つの要素。中心からの角度で8方向を決める）。 */
	bindPad(el: HTMLElement): void {
		let active: number | null = null;
		const update = (e: PointerEvent) => {
			const r = el.getBoundingClientRect();
			const dx = e.clientX - (r.left + r.width / 2);
			const dy = e.clientY - (r.top + r.height / 2);
			const dead = r.width * 0.12;
			let dir: Dir8 | null = null;
			if (Math.hypot(dx, dy) > dead) {
				// 上を 0 にして時計回りに 45° ずつ
				const a = Math.atan2(dx, -dy);
				dir = ((Math.round(a / (Math.PI / 4)) + 8) % 8) as Dir8;
			}
			if (dir !== this.padDir) {
				if (this.padDir === null && dir !== null)
					this.dirSince = performance.now();
				this.padDir = dir;
				if (dir !== null) this.press(toDir4(dir));
				el.dataset.dir = dir === null ? "" : String(dir);
			}
		};
		el.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			active = e.pointerId;
			el.setPointerCapture(e.pointerId);
			update(e);
		});
		el.addEventListener("pointermove", (e) => {
			if (e.pointerId === active) update(e);
		});
		const end = (e: PointerEvent) => {
			if (e.pointerId !== active) return;
			active = null;
			this.padDir = null;
			el.dataset.dir = "";
		};
		el.addEventListener("pointerup", end);
		el.addEventListener("pointercancel", end);
	}

	/** 画面上のボタン（A/B・小さいボタン）。 */
	bindButton(el: HTMLElement, key: Key): void {
		el.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			el.classList.add("down");
			this.press(key);
		});
		const up = () => el.classList.remove("down");
		el.addEventListener("pointerup", up);
		el.addEventListener("pointercancel", up);
		el.addEventListener("pointerleave", up);
	}

	/** 画面上の切り替えボタン（押すたびに ON/OFF）。 */
	bindToggle(el: HTMLElement, k: keyof Mods): void {
		el.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.onAnyInput?.();
			this.setToggle(k, !this.toggles[k]);
		});
	}

	/**
	 * フィールド（canvas）のタップ。ハンドラが積まれているときは そのハンドラの tap のキー扱い
	 * （メッセージ送りは A、メニューは B）、空ならタップ移動としてフィールドへ渡す。
	 */
	bindField(el: HTMLElement): void {
		el.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			this.onAnyInput?.();
			const top = this.handlers[this.handlers.length - 1];
			if (top) {
				if (top.tap) this.press(top.tap);
				return;
			}
			// canvas は画面の左上とはかぎらない（ブラウザのバーのぶんだけ下にずれる）ので、
			// canvas の枠を基準に数え直す
			const r = el.getBoundingClientRect();
			this.onFieldTap?.(e.clientX - r.left, e.clientY - r.top);
		});
	}
}
