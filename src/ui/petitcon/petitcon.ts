// キリコの 家の パソコンの BASIC（プチコン ふう）。家の パソコンを 調べて「BASIC」（ui/village/myhome.ts）。
// - 書く 窓：DOM の textarea（板では 字を 打てない。スマホの キーボードも 出る）と
//   「RUN」「保存」「読みこむ」「見本」「とじる」。Ctrl+Enter でも RUN。
//   textarea の 中の キーは ゲームの 入力に わたらない（engine/input.ts は INPUT・TEXTAREA の keydown を 見ない）。
// - 動かす 板：board() + crisp（240x150）。1こまに 文を STEPS_PER_FRAME まで（data/petitcon/vm.ts）。
//   B を 2回（板の 外の タップも B）か「STOP」で とめる。スマホでは 板の 下の ◀▲▼▶ A で BUTTON() を 押す。
// - 保存：localStorage の kiriko-roguelike/basic に 5つ と 書きかけ（見るだけの 起動では 書かない）。

import { BASIC_GUIDE } from "../../data/petitcon/guide";
import { BASIC_SAMPLES } from "../../data/petitcon/samples";
import {
	CELL,
	COLS,
	PALETTE,
	ROWS,
	SCR_H,
	SCR_W,
	type Screen,
	TEXT_TOP,
} from "../../data/petitcon/screen";
import {
	type Host,
	load,
	type RunResult,
	STEPS_PER_FRAME,
} from "../../data/petitcon/vm";
import { devEvent } from "../../data/story/objectives";
import type { Story } from "../../engine/defs";
import type { Ctx } from "../ctx";
import { el } from "../dom";
import { markOpened, onTap } from "../list";
import { board, tick } from "../minigames/minigameBoard";
import { crisp, type G, twoB, txt } from "../neta/netaBoard";
import { uiIcon } from "../uiIcon";
import { previewStage } from "../village/villageReturn";

const KEY = "kiriko-roguelike/basic";
const SLOTS = 5;

const T = {
	title: "BASIC",
	run: "RUN",
	save: "保存",
	load: "読みこむ",
	sample: "見本",
	close: "とじる",
	back: "もどる",
	stop: "STOP",
	hint: "Bを2回かSTOPでとめる",
	hintPc: "Ctrl+EnterでもRUN",
	empty: "（空き）",
	saveWhere: "どこに保存する？",
	loadWhich: "どれを読みこむ？",
	sampleWhich: "どれを読みこむ？（書きかけは消える）",
	saved: (n: number) => `${n}番に保存した`,
	loaded: (n: number) => `${n}番を読みこんだ`,
	sampleLoaded: (s: string) => `見本「${s}」を読みこんだ`,
	noSlot: "保存したものがない",
	quit1: "もう1回Bでとめる",
	end: "おわり（AかBでもどる）",
	stopped: "とめた",
	errBack: "（AかBでもどる）",
	refAll: "命令の一覧",
	refBack: "一覧へ",
	ref: [
		"PRINT LOCATE x,y COLOR 前,後 CLS",
		"GCLS PSET LINE BOX CIRCLE PUYU x,y",
		"WAIT n VSYNC BEEP 0〜7 NOTE 60",
		"IF THEN ELSE FOR NEXT WHILE WEND",
		"GOTO GOSUB RETURN @ラベル DIM END",
		"BUTTON()：1上 2下 4左 8右 16A",
		"RND INT ABS SIN COS SQR LEN MID$",
		"STR$ VAL CHR$ ASC MAX MIN PI()",
	],
} as const;

/** BEEP の 番号 → 効果音（data/audio/sfx.ts）。 */
const BEEPS = [
	"cursor",
	"decide",
	"arcCoin",
	"arcJump",
	"arcCrash",
	"explosion",
	"item",
	"victory",
] as const;

// ───────── 保存 ─────────

type Store = { slots: string[]; draft: string };

const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

const loadStore = (): Store => {
	const st: Store = { slots: new Array(SLOTS).fill(""), draft: "" };
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as unknown;
		if (raw && typeof raw === "object") {
			const r = raw as { slots?: unknown; draft?: unknown };
			if (Array.isArray(r.slots))
				for (let i = 0; i < SLOTS; i++)
					st.slots[i] = typeof r.slots[i] === "string" ? r.slots[i] : "";
			if (typeof r.draft === "string") st.draft = r.draft;
		}
	} catch {
		// 読めなければ 空から
	}
	return st;
};

const saveStore = (st: Store): void => {
	if (previewing()) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(st));
	} catch {
		// 保存できなくても この回は 覚えている
	}
};

/** 保存した ものの 名前（1行目の REM か、はじめの 字）。 */
const slotName = (code: string): string => {
	const first = code.split("\n").find((l) => l.trim() !== "") ?? "";
	const s = first
		.trim()
		.replace(/^\d+\s*/, "")
		.replace(/^(REM|')\s*/i, "");
	return s === "" ? T.empty : [...s].slice(0, 16).join("");
};

// ───────── 書く 窓 ─────────

type EditState = {
	code: string;
	caret: number;
	note: string;
	errLine: number | null;
};

/** エラーの 行（BASIC の 行番号か 何行目か）→ textarea の 何行目か。 */
const errRow = (code: string, line: number): number => {
	const ls = code.split("\n");
	const i = ls.findIndex((l) => new RegExp(`^\\s*${line}(\\D|$)`).test(l));
	if (i >= 0) return i;
	return Math.max(0, Math.min(ls.length - 1, line - 1));
};

const coarse = (): boolean =>
	matchMedia?.("(pointer: coarse)").matches ?? false;

const editor = (ctx: Ctx, st: Store, es: EditState): Promise<"run" | "close"> =>
	new Promise((resolve) => {
		const box = el("div", { class: "menu window petitcon" });
		const note = el("div", { class: "petitcon-note", text: es.note });
		const area = el("textarea", { class: "petitcon-code" });
		area.value = es.code;
		area.spellcheck = false;
		area.wrap = "off";
		area.setAttribute("autocapitalize", "off");
		area.setAttribute("autocomplete", "off");
		area.setAttribute("autocorrect", "off");
		const pick = el("div", { class: "petitcon-pick" });
		pick.hidden = true;
		const btn = (
			label: string,
			fn: () => void,
			cls = "",
		): HTMLButtonElement => {
			const b = el("button", {
				class: `menu-close menu-action ${cls}`,
				text: label,
			});
			onTap(b, box, fn);
			return b;
		};
		const say = (s: string) => {
			note.textContent = s;
		};
		const done = (r: "run" | "close") => {
			es.code = area.value;
			es.caret = area.selectionStart;
			es.note = "";
			es.errLine = null;
			st.draft = area.value;
			saveStore(st);
			pop();
			box.remove();
			resolve(r);
		};
		/** 選ぶ 欄（保存の 番・見本）。 */
		const openPick = (
			head: string,
			items: { label: string; fn: () => void; dim?: boolean }[],
			foot: readonly string[] = [],
		) => {
			pick.replaceChildren(
				el("div", { class: "petitcon-pick-head", text: head }),
			);
			for (const it of items) {
				const b = btn(it.label, () => {
					closePick();
					it.fn();
				});
				if (it.dim) b.classList.add("dim");
				pick.appendChild(b);
			}
			if (foot.length)
				pick.appendChild(
					el(
						"div",
						{ class: "petitcon-ref" },
						foot.map((s) => el("div", { text: s })),
					),
				);
			pick.appendChild(btn(T.back, () => closePick()));
			pick.hidden = false;
			area.hidden = true;
			bar.hidden = true;
		};
		const closePick = () => {
			pick.hidden = true;
			area.hidden = false;
			bar.hidden = false;
		};
		/** 命令の 一覧：題を えらぶ → その 題の 命令（行ごと）。「一覧へ」で 題に もどる。 */
		const openRef = (): void =>
			openPick(
				T.refAll,
				BASIC_GUIDE.topics.map((t, i) => ({
					label: t,
					fn: () => {
						ctx.se("decide");
						openPick(
							t,
							[{ label: T.refBack, fn: () => openRef() }],
							(BASIC_GUIDE.pages[i] ?? []).flatMap((p) => p.split("\n")),
						);
					},
				})),
			);
		const bar = el("div", { class: "menu-foot petitcon-bar" }, [
			btn(T.run, () => {
				ctx.se("decide");
				done("run");
			}),
			btn(T.save, () => {
				ctx.se("cursor");
				openPick(
					T.saveWhere,
					st.slots.map((c, i) => ({
						label: `${i + 1}　${slotName(c)}`,
						dim: c === "",
						fn: () => {
							st.slots[i] = area.value;
							st.draft = area.value;
							saveStore(st);
							ctx.se("item");
							say(T.saved(i + 1));
						},
					})),
				);
			}),
			btn(T.load, () => {
				if (st.slots.every((c) => c === "")) {
					ctx.se("cancel");
					say(T.noSlot);
					return;
				}
				ctx.se("cursor");
				openPick(
					T.loadWhich,
					st.slots.flatMap((c, i) =>
						c === ""
							? []
							: [
									{
										label: `${i + 1}　${slotName(c)}`,
										fn: () => {
											area.value = c;
											ctx.se("decide");
											say(T.loaded(i + 1));
										},
									},
								],
					),
				);
			}),
			btn(T.sample, () => {
				ctx.se("cursor");
				openPick(
					T.sampleWhich,
					[
						// 命令の 一覧（題ごと。data/petitcon/guide.ts）
						{
							label: T.refAll,
							fn: () => {
								ctx.se("decide");
								openRef();
							},
						},
						...BASIC_SAMPLES.map((s) => ({
							label: s.name,
							fn: () => {
								area.value = s.code;
								ctx.se("decide");
								say(T.sampleLoaded(s.name));
							},
						})),
					],
					T.ref,
				);
			}),
			btn(T.close, () => {
				ctx.se("cancel");
				done("close");
			}),
		]);
		area.addEventListener("keydown", (e) => {
			e.stopPropagation();
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				ctx.se("decide");
				done("run");
				return;
			}
			if (e.key === "Tab") {
				e.preventDefault();
				area.setRangeText(" ", area.selectionStart, area.selectionEnd, "end");
			}
		});
		box.append(
			el("div", { class: "menu-title", text: T.title }),
			area,
			pick,
			note,
			bar,
		);
		if (!coarse())
			box.append(el("div", { class: "petitcon-hint", text: T.hintPc }));
		ctx.ui.appendChild(box);
		markOpened(box);
		// 窓の 外の タップでは 閉じない（書きかけを うっかり 閉じないように）。B は 選ぶ 欄を 閉じる
		const pop = ctx.input.push(
			(k, repeat) => {
				if (repeat) return;
				if (k === "b" && !pick.hidden) {
					ctx.se("cancel");
					closePick();
				}
			},
			{ tap: null },
		);
		// まちがえた 行を 選んで おく（スマホは キーボードが 出るので focus しない）
		const row = es.errLine;
		if (row !== null) {
			const ls = area.value.split("\n");
			let at = 0;
			for (let i = 0; i < row; i++) at += ls[i].length + 1;
			area.setSelectionRange(at, at + (ls[row]?.length ?? 0));
			area.scrollTop = Math.max(0, row * 20 - 40);
			if (!coarse()) area.focus();
		} else {
			area.setSelectionRange(es.caret, es.caret);
			if (!coarse()) area.focus();
		}
	});

// ───────── 動かす 板 ─────────

/** 色の 番号 → RGBA（ImageData に 書く）。 */
const RGB = PALETTE.map((h) => [
	Number.parseInt(h.slice(1, 3), 16),
	Number.parseInt(h.slice(3, 5), 16),
	Number.parseInt(h.slice(5, 7), 16),
]);

const draw = (
	g: G,
	off: HTMLCanvasElement,
	img: ImageData,
	scr: Screen,
): void => {
	const d = img.data;
	const px = scr.px;
	for (let i = 0; i < px.length; i++) {
		const c = RGB[px[i]] ?? RGB[0];
		d[i * 4] = c[0];
		d[i * 4 + 1] = c[1];
		d[i * 4 + 2] = c[2];
		d[i * 4 + 3] = 255;
	}
	off.getContext("2d")?.putImageData(img, 0, 0);
	g.drawImage(off, 0, 0, SCR_W, SCR_H);
	for (let y = 0; y < ROWS; y++)
		for (let x = 0; x < COLS; x++) {
			const i = y * COLS + x;
			const c = scr.ch[i];
			const bg = scr.bg[i];
			if (bg !== 0) {
				g.fillStyle = PALETTE[bg];
				g.fillRect(x * CELL, TEXT_TOP + y * CELL, CELL, CELL);
			}
			if (c !== " ")
				txt(
					g,
					c,
					x * CELL + CELL / 2,
					TEXT_TOP + y * CELL,
					CELL,
					PALETTE[scr.fg[i]],
					"center",
				);
		}
	scr.dirty = false;
};

const DIR_BITS: Record<number, number> = {
	0: 1,
	1: 1 | 8,
	2: 8,
	3: 2 | 8,
	4: 2,
	5: 2 | 4,
	6: 4,
	7: 1 | 4,
};

const A_CODES = new Set(["KeyZ", "Enter", "NumpadEnter", "Space"]);

/** 動かす（まちがいなら その 結果。とめたら null）。 */
const runProgram = async (
	ctx: Ctx,
	code: string,
): Promise<RunResult | null> => {
	const b = board(ctx, T.title, T.hint);
	b.root.classList.add("petitcon-run");
	const g = crisp(b);
	const off = el("canvas");
	off.width = SCR_W;
	off.height = SCR_H;
	const img = new ImageData(SCR_W, SCR_H);
	const say = (s: string) => {
		b.note.textContent = s;
	};

	// ─ 入力 ─
	let padBits = 0;
	let kbA = false;
	let canvasA = false;
	let aPulse = 0;
	let stopReq = false;
	const keys: string[] = [];
	const bq: number[] = [];
	const anyQ: number[] = [];
	const pop = ctx.input.push(
		(k, repeat) => {
			const now = performance.now();
			if (k === "a") {
				aPulse = now + 150;
				if (!repeat) anyQ.push(now);
			}
			if (k === "b" && !repeat) {
				bq.push(now);
				anyQ.push(now);
			}
		},
		{ tap: "b" },
	);
	const onKeyDown = (e: KeyboardEvent) => {
		if (A_CODES.has(e.code)) kbA = true;
		if (e.key.length === 1 && keys.length < 16) keys.push(e.key);
	};
	const onKeyUp = (e: KeyboardEvent) => {
		if (A_CODES.has(e.code)) kbA = false;
	};
	const onUp = () => {
		canvasA = false;
	};
	const onCanvasDown = (e: PointerEvent) => {
		e.preventDefault();
		canvasA = true;
		anyQ.push(performance.now());
	};
	window.addEventListener("keydown", onKeyDown);
	window.addEventListener("keyup", onKeyUp);
	window.addEventListener("pointerup", onUp);
	window.addEventListener("pointercancel", onUp);
	b.canvas.addEventListener("pointerdown", onCanvasDown);
	const padBtn = (label: string, bit: number): HTMLButtonElement => {
		const btn = el("button", { class: "petitcon-key", html: label });
		const on = (e: PointerEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (bit === 0) {
				stopReq = true;
				return;
			}
			padBits |= bit;
			if (bit === 16) anyQ.push(performance.now());
		};
		const offB = () => {
			padBits &= ~bit;
		};
		btn.addEventListener("pointerdown", on);
		btn.addEventListener("pointerup", offB);
		btn.addEventListener("pointercancel", offB);
		btn.addEventListener("pointerleave", offB);
		return btn;
	};
	b.root.insertBefore(
		el("div", { class: "petitcon-pad" }, [
			padBtn(uiIcon("left"), 4),
			padBtn(uiIcon("up"), 1),
			padBtn(uiIcon("down"), 2),
			padBtn(uiIcon("right"), 8),
			padBtn("A", 16),
			padBtn(T.stop, 0),
		]),
		b.note.nextSibling,
	);
	let pianoReady = false;
	if (/\bNOTE\b/i.test(code))
		void ctx.audio.preparePiano().then(() => {
			pianoReady = true;
		});
	const host: Host = {
		button: () => {
			const d = ctx.input.heldDir();
			let bits = padBits | (d === null ? 0 : (DIR_BITS[d] ?? 0));
			if (kbA || canvasA || performance.now() < aPulse) bits |= 16;
			return bits;
		},
		inkey: () => keys.shift() ?? "",
		beep: (n) => ctx.se(BEEPS[n] ?? BEEPS[0]),
		note: (m, sec) => {
			if (pianoReady) ctx.audio.pianoNote(m, sec);
		},
		rnd: Math.random,
	};

	/** A・B・タップを 待つ（おわった あと）。 */
	const waitAny = async () => {
		anyQ.length = 0;
		for (;;) {
			await tick();
			if (anyQ.length || stopReq) return;
		}
	};

	try {
		const got = load(code, host);
		if (!("vm" in got)) {
			ctx.se("miss");
			say(got.text);
			b.root.querySelector(".mgame-hint")?.replaceChildren(T.errBack);
			await waitAny();
			return got;
		}
		const vm = got.vm;
		const quit = twoB();
		draw(g, off, img, vm.scr);
		let last = performance.now();
		let acc = 1;
		let wait = 0;
		let res: RunResult = { k: "yield" };
		for (;;) {
			const now = await tick();
			for (const at of bq.splice(0)) {
				if (quit.press(at)) stopReq = true;
				else say(T.quit1);
			}
			if (quit.lapsed(now)) say("");
			if (stopReq) {
				ctx.se("cancel");
				return null;
			}
			acc = Math.min(4, acc + (now - last) / (1000 / 60));
			last = now;
			while (acc >= 1) {
				acc--;
				vm.tick();
				if (wait > 0) {
					wait--;
					continue;
				}
				res = vm.run(STEPS_PER_FRAME);
				if (res.k === "wait") wait = res.frames - 1;
				if (res.k === "end" || res.k === "error") break;
			}
			if (vm.scr.dirty) draw(g, off, img, vm.scr);
			if (res.k === "end" || res.k === "error") break;
		}
		draw(g, off, img, vm.scr);
		if (res.k === "error") {
			ctx.se("miss");
			say(res.text);
			b.root.querySelector(".mgame-hint")?.replaceChildren(T.errBack);
		} else say(T.end);
		anyQ.length = 0;
		bq.length = 0;
		stopReq = false;
		await waitAny();
		return res;
	} finally {
		pop();
		window.removeEventListener("keydown", onKeyDown);
		window.removeEventListener("keyup", onKeyUp);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		b.close();
	}
};

/** パソコンで BASIC（書く 窓 ⇄ 動かす 板。とじるまで くり返す）。 */
export const petitcon = async (ctx: Ctx, _s: Story): Promise<void> => {
	const st = loadStore();
	const es: EditState = {
		code: st.draft || BASIC_SAMPLES[0].code,
		caret: 0,
		note: "",
		errLine: null,
	};
	for (;;) {
		const act = await editor(ctx, st, es);
		if (act === "close") return;
		const r = await runProgram(ctx, es.code);
		if (r?.k === "error") {
			es.note = r.text;
			es.errLine = errRow(es.code, r.line);
		}
	}
};
