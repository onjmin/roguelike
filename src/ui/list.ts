// 縦に並ぶ選択ウィンドウ（rpg の menu.ts の listWindow を、ゲーム本体に頼らない形にしたもの）。
//
// - 窓の外をタップしたら「とじる」（決定ではない）。
// - はみ出して巻き取れる一覧は、指をほとんど動かさずに離したときに決まる。
// - 2行目に説明（desc）を出せる（名前だけでは効果がわからない、への対策）。

import type { Input } from "../engine/input";
import { el } from "./dom";

export type UiCtx = {
	ui: HTMLElement;
	input: Input;
	se: (name: string) => void;
};

export type ListItem = {
	label: string;
	sub?: string;
	/** 2行目の小さい説明（HTML）。 */
	desc?: string;
	value: string;
	disabled?: boolean;
};

/** 指でなぞって巻き取れるか（はみ出していて、しかも overflow で巻き取る箱か）。 */
const canScroll = (s: HTMLElement): boolean => {
	if (s.scrollHeight <= s.clientHeight + 1) return false;
	const o = getComputedStyle(s).overflowY;
	return o === "auto" || o === "scroll";
};

/**
 * タップで決める。ふつうは押した瞬間に決まるが、はみ出して巻き取れる一覧では、
 * 指でなぞって巻き取れるよう、ほとんど動かさずに離したときに決める。
 */
export const onTap = (
	b: HTMLElement,
	scroller: HTMLElement,
	fn: () => void,
): void => {
	let from: { id: number; y: number } | null = null;
	b.addEventListener("pointerdown", (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (canScroll(scroller)) from = { id: e.pointerId, y: e.clientY };
		else fn();
	});
	b.addEventListener("pointerup", (e) => {
		if (!from || from.id !== e.pointerId) return;
		const moved = Math.abs(e.clientY - from.y);
		from = null;
		if (moved < 10) fn();
	});
	b.addEventListener("pointercancel", () => {
		from = null;
	});
	b.addEventListener("pointerleave", () => {
		from = null;
	});
};

/** 巻き取れる一覧で、カーソルの行が見えるところまで巻き取る（十字キー・キーボード用）。 */
export const keepInView = (scroller: HTMLElement, b: HTMLElement): void => {
	const r = b.getBoundingClientRect();
	const s = scroller.getBoundingClientRect();
	if (r.top < s.top) scroller.scrollTop -= s.top - r.top;
	else if (r.bottom > s.bottom) scroller.scrollTop += r.bottom - s.bottom;
};

/** 縦に並ぶ選択ウィンドウ。B・とじる・外のタップで null。 */
export const listWindow = (
	ctx: UiCtx,
	title: string,
	items: ListItem[],
	opt: { cls?: string; start?: number; closeLabel?: string } = {},
): Promise<string | null> =>
	new Promise((resolve) => {
		const box = el("div", { class: `menu window ${opt.cls ?? ""}` });
		if (title) box.appendChild(el("div", { class: "menu-title", html: title }));
		let cur = Math.min(items.length - 1, Math.max(0, opt.start ?? 0));
		// 選べない行から始めない（最初の A が空振りしないように）
		if (items[cur]?.disabled) {
			const firstOk = items.findIndex((i) => !i.disabled);
			if (firstOk >= 0) cur = firstOk;
		}
		const buttons = items.map((it) => {
			const b = el("button", {
				class: "menu-item",
				html: `<span>${it.label}</span>${it.sub ? `<small>${it.sub}</small>` : ""}${it.desc ? `<span class="desc">${it.desc}</span>` : ""}`,
			});
			if (it.disabled) b.classList.add("disabled");
			if (it.desc) b.classList.add("has-desc");
			onTap(b, box, () => {
				if (!it.disabled) done(it.value);
			});
			box.appendChild(b);
			return b;
		});
		const close = el("button", {
			class: "menu-close",
			text: opt.closeLabel ?? "とじる",
		});
		onTap(close, box, () => done(null));
		box.appendChild(close);
		const render = () =>
			buttons.forEach((b, i) => {
				b.classList.toggle("cur", i === cur);
				if (i === cur) {
					if (i === 0) box.scrollTop = 0;
					else keepInView(box, b);
				}
			});
		ctx.ui.appendChild(box);
		render();
		const pop = ctx.input.push(
			(k, repeat) => {
				if (k === "up" || k === "down") {
					if (!items.length) return;
					// 選べない行は とばす（ぜんぶ選べないときは そのまま動く）
					const step = k === "up" ? -1 : 1;
					let next = cur;
					for (let n = 0; n < items.length; n++) {
						next = (next + step + items.length) % items.length;
						if (!items[next].disabled) break;
					}
					cur = next;
					ctx.se("cursor");
					render();
				} else if (repeat) {
					// 押しっぱなしの自動くり返しでは 決めない・閉じない（次の窓まで決まってしまうので）
					return;
				} else if (k === "a" && items[cur] && !items[cur].disabled) {
					done(items[cur].value);
				} else if (k === "b") {
					done(null);
				}
			},
			{ tap: "b" },
		);
		const done = (v: string | null) => {
			pop();
			ctx.se(v === null ? "cancel" : "decide");
			box.remove();
			resolve(v);
		};
	});

/**
 * 見るだけの窓（本文は HTML）。A/B・とじる・外のタップで閉じる。上下で巻き取る。
 */
export const infoWindow = (
	ctx: UiCtx,
	title: string,
	html: string,
	opt: { cls?: string } = {},
): Promise<void> =>
	new Promise((resolve) => {
		const box = el("div", { class: `menu window info ${opt.cls ?? ""}` });
		if (title) box.appendChild(el("div", { class: "menu-title", html: title }));
		box.appendChild(el("div", { class: "info-body", html }));
		const close = el("button", { class: "menu-close", text: "とじる" });
		onTap(close, box, () => done());
		box.appendChild(close);
		ctx.ui.appendChild(box);
		const pop = ctx.input.push(
			(k, repeat) => {
				if ((k === "a" || k === "b") && !repeat) done();
				else if (k === "up" || k === "down")
					box.scrollBy({ top: k === "up" ? -48 : 48 });
			},
			{ tap: "b" },
		);
		const done = () => {
			pop();
			ctx.se("cancel");
			box.remove();
			resolve();
		};
	});
