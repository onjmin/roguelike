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
	| "shoot"
	| "menu"
	| "stairs"
	| "sort";
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
	// Esc・Tab はメニュー（窓が開いていれば とじる）。X・I・B は フィールドでは もちもの
	Escape: "menu",
	Tab: "menu",
	Backspace: "b",
	KeyI: "b",
	Period: "wait",
	Numpad5: "wait",
	Clear: "wait",
	KeyG: "foot",
	Comma: "foot",
	KeyM: "map",
	KeyT: "throw",
	KeyQ: "shoot",
	KeyV: "stairs",
	// 持ち物の 整理（Organize。フィールドでも もちものの窓でも）
	KeyO: "sort",
};

/**
 * キーの場所の名前（KeyboardEvent.code）。code を付けない環境（一部の自動操作・古いブラウザ）では
 * key から引き直す（英字キーは KeyX の形に、記号は代表的なものだけ）。
 */
const codeOf = (e: KeyboardEvent): string => {
	if (e.code) return e.code;
	const k = e.key;
	if (/^[a-zA-Z]$/.test(k)) return `Key${k.toUpperCase()}`;
	const named: Record<string, string> = {
		" ": "Space",
		".": "Period",
		",": "Comma",
		Shift: "ShiftLeft",
		Control: "ControlLeft",
	};
	return named[k] ?? k;
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

const DIR4_TRY: readonly (readonly Dir[])[] = [
	["up"],
	["up", "right"],
	["right"],
	["down", "right"],
	["down"],
	["down", "left"],
	["left"],
	["up", "left"],
];

/**
 * 4方向で歩くマップ（村）で、8方向の入力を 試す順に並べた向き。
 * 斜めは 縦を先に、だめなら 横へ すべる（ドラクエの 斜め押し）。
 */
export const dir4Candidates = (d: Dir8): readonly Dir[] => DIR4_TRY[d];

/** 画面を これより長く押さえたら「押しっぱなしで歩く」、短ければタップ。 */
const FIELD_HOLD_MS = 220;
/** 十字キーの まん中を これより長く押さえたら 足踏み（トルネコの A＋B 押しっぱなし）。 */
const PAD_REST_MS = 350;
/** 窓が開いてから、外のタップで閉じられるようになるまで（ms）。 */
const WINDOW_TAP_GRACE_MS = 300;
/** 画面を押して これより 指が動いたら、タップではなく なぞり（CSS 画素。半マスほど）。 */
const TAP_SLOP_PX = 16;

/** 指を追い続ける（取れない環境では何もしない。処理を止めないように）。 */
const capture = (el: HTMLElement, id: number): void => {
	try {
		el.setPointerCapture(id);
	} catch {
		// 自動操作の合成イベントなど
	}
};

export class Input {
	/** キーボードで押している方向キー（code → 向き）。 */
	private keysHeld = new Map<string, Dir8>();
	/** 十字キー（画面）で押している向き。 */
	private padDir: Dir8 | null = null;
	/** 十字キーの まん中を 押さえはじめた時刻（押さえていなければ 0）。 */
	private padCenterSince = 0;
	/** 最後に方向を押し始めた時刻（同時押しの待ち合わせ用）。 */
	private dirSince = 0;
	/** 押したが まだ使っていない向き（すぐ離しても1歩は進めるように）。 */
	private pendingDir: Dir8 | null = null;
	/** 斜めの片方を離した時刻。 */
	private releasedAt = 0;
	/** 画面（マップ）を押さえている指。held は 押さえて歩くのに 使ったか。 */
	private fieldPtr: {
		id: number;
		x0: number;
		y0: number;
		x: number;
		y: number;
		t0: number;
		held: boolean;
		/** 押さえて歩く向き（決めたときの 指の位置 ax, ay）。歩いて キリコが 動いても 決めなおさない。 */
		dir?: Dir8;
		ax: number;
		ay: number;
	} | null = null;
	/**
	 * 何かを押すたびに ふえる番号（走る・自動で歩く のを、さわったら 止めるのに使う）。
	 * 指を動かしているだけ（pointermove）では ふえない。
	 */
	serial = 0;
	/** 画面を押さえて 歩けるか（地図を開いているあいだは 押さえても歩かず、離したときの タップにする）。 */
	fieldHoldEnabled = true;
	private handlers: { fn: Handler; tap: Key | null; at: number }[] = [];
	private fieldQueue: Key[] = [];
	private keyMods: Mods = { dash: false, diag: false, turn: false };
	/** 画面のボタンで入れた切り替え（ダッシュ・斜め・向き）。 */
	readonly toggles: Mods = { dash: false, diag: false, turn: false };
	/** 画面のボタンを押さえているあいだ（押しながら十字キー）。 */
	readonly heldMods: Mods = { dash: false, diag: false, turn: false };
	/** 押さえているあいだに使ったか（使ったなら、離しても切り替えにしない）。 */
	private usedWhileHeld: Mods = { dash: false, diag: false, turn: false };
	/** フィールドでのタップ（canvas の左上から数えた CSS 画素）。 */
	onFieldTap: ((x: number, y: number) => void) | null = null;
	/** 何かしら入力があったとき（オーディオのアンロック用）。 */
	onAnyInput: (() => void) | null = null;
	/** 切り替えが変わったとき（HUD の見た目用）。 */
	onModsChange: (() => void) | null = null;

	constructor() {
		window.addEventListener("keydown", (ev) => {
			const t = ev.target as HTMLElement | null;
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
			const e = {
				code: codeOf(ev),
				repeat: ev.repeat,
				preventDefault: () => ev.preventDefault(),
			};
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
				// メニューが開いているあいだの向きは、閉じたあとの1歩にしない
				if (!e.repeat && !this.handlers.length)
					this.pendingDir = this.heldDir();
				this.press(toDir4(d), e.repeat);
				return;
			}
			const key = OTHER_KEYS[e.code];
			if (!key) return;
			e.preventDefault();
			this.press(key, e.repeat);
		});
		window.addEventListener("keyup", (ev) => {
			const code = codeOf(ev);
			const mod = MOD_KEYS[code];
			if (mod) this.keyMods[mod] = false;
			const before = this.heldDir();
			this.keysHeld.delete(code);
			// 斜め（2つ押し）から片方だけ離したときは、少し待つ（両方を離すまでの間に
			// 残った向きへ1歩ずれないように）
			if (before !== null && before % 2 === 1 && this.keysHeld.size)
				this.releasedAt = performance.now();
		});
		window.addEventListener("blur", () => {
			this.keysHeld.clear();
			this.padDir = null;
			this.padCenterSince = 0;
			this.keyMods = { dash: false, diag: false, turn: false };
		});
	}

	/** 押した瞬間のキーを配る。 */
	press(key: Key, repeat = false): void {
		this.onAnyInput?.();
		if (!repeat) this.serial++;
		const top = this.handlers[this.handlers.length - 1];
		if (top) {
			// 窓の中では メニューのキーは「とじる」
			top.fn(key === "menu" ? "b" : key, repeat);
			return;
		}
		const isDir =
			key === "up" || key === "down" || key === "left" || key === "right";
		// 先に押せるのは 1つだけ（演出中の 連打を ためこむと、敵を 倒した あとも 空振りを 続けてしまう）
		if (!repeat && !isDir) this.fieldQueue = [key];
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

	/** 十字キーの まん中を 長押ししている（足踏みを 続ける）。 */
	restHeld(): boolean {
		return (
			this.padCenterSince > 0 &&
			performance.now() - this.padCenterSince >= PAD_REST_MS
		);
	}

	/** 押したが まだ使っていない向きがあるか。 */
	get pendingDirPress(): boolean {
		return this.pendingDir !== null;
	}

	/** 押したが まだ使っていない向きを取り出す（短く押して離したとき用）。 */
	takeDirPress(): Dir8 | null {
		const d = this.pendingDir;
		this.pendingDir = null;
		return d;
	}

	/**
	 * 方向を押し始めてからの ms（キーボードの同時押しを待つのに使う）。
	 * 斜めの片方を離した直後も、少しのあいだ「押し始め」とみなす。
	 */
	heldFor(): number {
		const now = performance.now();
		return Math.min(now - this.dirSince, now - this.releasedAt + 45 - 70);
	}

	/** 押しっぱなしのキーと画面の切り替えを合わせたもの。 */
	mods(): Mods {
		return {
			dash: this.keyMods.dash || this.toggles.dash || this.heldMods.dash,
			diag: this.keyMods.diag || this.toggles.diag || this.heldMods.diag,
			turn: this.keyMods.turn || this.toggles.turn || this.heldMods.turn,
		};
	}

	/**
	 * 向き変えを1回使った。押さえているあいだなら「使った」印をつけ（離しても切り替えにしない）、
	 * タップで入れた1回ぶんなら切る。
	 */
	useMod(k: keyof Mods): void {
		if (this.heldMods[k] || this.keyMods[k]) {
			this.usedWhileHeld[k] = true;
			return;
		}
		if (this.toggles[k]) this.setToggle(k, false);
	}

	setToggle(k: keyof Mods, v: boolean): void {
		this.toggles[k] = v;
		this.onModsChange?.();
	}

	/** ハンドラを積む。戻り値を呼ぶと外れる。 */
	push(handler: Handler, opt: PushOptions = {}): () => void {
		const h = {
			fn: handler,
			tap: opt.tap === undefined ? "a" : opt.tap,
			at: performance.now(),
		};
		this.handlers.push(h);
		this.fieldQueue = [];
		this.pendingDir = null;
		return () => {
			const i = this.handlers.lastIndexOf(h);
			if (i >= 0) this.handlers.splice(i, 1);
			this.pendingDir = null;
			this.fieldQueue = [];
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
			// まん中は 向きなし（長押しで 足踏み）。指で押さえやすい大きさにする
			const dead = r.width * 0.2;
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
				if (dir !== null) {
					if (!this.handlers.length) this.pendingDir = dir;
					this.press(toDir4(dir));
				}
				el.dataset.dir = dir === null ? "" : String(dir);
			}
			// まん中を 押さえている（長押しで 足踏み。見た目は まん中が だんだん光る）
			if (dir === null && !this.padCenterSince) {
				this.padCenterSince = performance.now();
				el.dataset.center = "1";
			} else if (dir !== null && this.padCenterSince) {
				this.padCenterSince = 0;
				el.dataset.center = "";
			}
		};
		el.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			this.onAnyInput?.();
			this.serial++;
			active = e.pointerId;
			capture(el, e.pointerId);
			update(e);
		});
		el.addEventListener("pointermove", (e) => {
			if (e.pointerId === active) update(e);
		});
		const end = (e: PointerEvent) => {
			if (e.pointerId !== active) return;
			active = null;
			this.padDir = null;
			this.padCenterSince = 0;
			el.dataset.dir = "";
			el.dataset.center = "";
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

	/**
	 * 押しながら使うボタン（トルネコの「ボタン＋方向」）。押さえているあいだだけ効く。
	 * 何もせずに すぐ離したら、次の1回ぶんだけ入れておく（もう一度タップで取り消し）。
	 */
	bindHold(el: HTMLElement, k: keyof Mods): void {
		let active: number | null = null;
		let downAt = 0;
		el.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.onAnyInput?.();
			active = e.pointerId;
			capture(el, e.pointerId);
			downAt = performance.now();
			this.usedWhileHeld[k] = false;
			this.heldMods[k] = true;
			this.onModsChange?.();
		});
		const end = (e: PointerEvent) => {
			if (e.pointerId !== active) return;
			active = null;
			this.heldMods[k] = false;
			if (!this.usedWhileHeld[k] && performance.now() - downAt < 400)
				this.toggles[k] = !this.toggles[k];
			this.onModsChange?.();
		};
		el.addEventListener("pointerup", end);
		el.addEventListener("pointercancel", end);
	}

	/**
	 * フィールド（canvas）のタップ。ハンドラが積まれているときは そのハンドラの tap のキー扱い
	 * （メッセージ送りは A、メニューは B）、空ならタップ移動としてフィールドへ渡す。
	 */
	bindField(el: HTMLElement): void {
		// canvas は画面の左上とはかぎらない（ブラウザのバーのぶんだけ下にずれる）ので、
		// canvas の枠を基準に数え直す
		const rel = (e: PointerEvent) => {
			const r = el.getBoundingClientRect();
			return { x: e.clientX - r.left, y: e.clientY - r.top };
		};
		el.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			this.onAnyInput?.();
			const top = this.handlers[this.handlers.length - 1];
			if (top) {
				// 窓が開いた直後のタップは数えない（歩こうとして続けて押したタップで、
				// 開いたばかりの「階段を降りますか？」などを すぐ閉じてしまわないように）
				if (top.tap && performance.now() - top.at >= WINDOW_TAP_GRACE_MS)
					this.press(top.tap);
				return;
			}
			const p = rel(e);
			this.serial++;
			this.fieldPtr = {
				id: e.pointerId,
				x0: p.x,
				y0: p.y,
				x: p.x,
				y: p.y,
				t0: performance.now(),
				held: false,
				ax: p.x,
				ay: p.y,
			};
			capture(el, e.pointerId);
		});
		el.addEventListener("pointermove", (e) => {
			if (this.fieldPtr?.id !== e.pointerId) return;
			const p = rel(e);
			this.fieldPtr.x = p.x;
			this.fieldPtr.y = p.y;
		});
		const end = (e: PointerEvent) => {
			const f = this.fieldPtr;
			if (!f || f.id !== e.pointerId) return;
			this.fieldPtr = null;
			// タップ：押して歩くのに 使っておらず（すぐ離した か、地図を開いていて 押さえても 歩かないとき）、
			// 指が ほとんど動いていない（なぞった のは タップにしない）
			const quick =
				performance.now() - f.t0 < FIELD_HOLD_MS || !this.fieldHoldEnabled;
			const still = Math.hypot(f.x - f.x0, f.y - f.y0) < TAP_SLOP_PX;
			if (!f.held && quick && still && !this.handlers.length)
				this.onFieldTap?.(f.x0, f.y0);
		};
		el.addEventListener("pointerup", end);
		el.addEventListener("pointercancel", end);
	}

	/**
	 * 画面（マップ）を押さえつづけている指の位置（canvas の左上から数えた CSS 画素）。
	 * 押してすぐは null（タップと見分けるため）。
	 */
	fieldHold(): { x: number; y: number } | null {
		const f = this.fieldPtr;
		if (!f || this.handlers.length || !this.fieldHoldEnabled) return null;
		if (performance.now() - f.t0 < FIELD_HOLD_MS) return null;
		f.held = true;
		return { x: f.x, y: f.y };
	}

	/**
	 * 押さえて歩く向き。押さえはじめに 1度だけ 決め、指を 大きく 動かしたときだけ 決めなおす
	 * （歩くたびに キリコ・カメラが 動くので、毎回 指との 角度を 取りなおすと ジグザグに 進んでしまう）。
	 * dirAt は 画面の点が キリコから どの向きか（キリコの上なら null）。
	 */
	fieldHoldDir(dirAt: (x: number, y: number) => Dir8 | null): Dir8 | null {
		const f = this.fieldPtr;
		if (!f) return null;
		if (
			f.dir === undefined ||
			Math.hypot(f.x - f.ax, f.y - f.ay) >= TAP_SLOP_PX
		) {
			f.ax = f.x;
			f.ay = f.y;
			const d = dirAt(f.x, f.y);
			// キリコの上を 押さえているあいだは 決めずに おく（指を ずらしたら その向き）
			f.dir = d ?? undefined;
			return d;
		}
		return f.dir;
	}
}
