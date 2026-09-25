// 縦に並ぶ選択ウィンドウ（rpg の menu.ts の listWindow を、ゲーム本体に頼らない形にしたもの）。
//
// - 窓の外をタップしたら「とじる」（決定ではない）。
// - はみ出して巻き取れる一覧は、指をほとんど動かさずに離したときに決まる。
// - 2行目に説明（desc）を出せる（名前だけでは効果がわからない、への対策）。
// - 画面の高さに入りきらない一覧は ページに分ける（◀ ▶・左右キーで めくる。上下で はしを こえると 次のページ）。

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

/**
 * 窓に入りきらない行を ページに分ける（行の番号の並びを ページごとに返す。入りきれば 1ページ）。
 * 窓を 画面に置いてから呼ぶ。pager（ページの表示）は 高さに入れて はかるので、先に 窓に入れておく。
 */
export const paginate = (
	box: HTMLElement,
	rows: readonly HTMLElement[],
	pager: HTMLElement,
): number[][] => {
	const all = rows.map((_, i) => i);
	for (const r of rows) r.style.display = "";
	pager.style.display = "none";
	if (rows.length < 2 || box.scrollHeight <= box.clientHeight + 1) return [all];
	pager.style.display = "";
	// 行の高さ（次の行までの間。すき間も入れる）と、行でない物（題・ページ・とじる）の高さ
	const first = rows[0];
	const last = rows[rows.length - 1];
	const pitch = rows.map((r, i) =>
		i < rows.length - 1 ? rows[i + 1].offsetTop - r.offsetTop : r.offsetHeight,
	);
	const rowsH = last.offsetTop + last.offsetHeight - first.offsetTop;
	const avail = box.clientHeight - (box.scrollHeight - rowsH) - 2;
	const pages: number[][] = [];
	let page: number[] = [];
	let h = 0;
	pitch.forEach((ph, i) => {
		if (page.length && h + ph > avail) {
			pages.push(page);
			page = [];
			h = 0;
		}
		page.push(i);
		h += ph;
	});
	if (page.length) pages.push(page);
	return pages;
};

/** ページの表示（◀ 1／3 ▶）。ボタンを押すと onFlip(-1 / +1)。 */
const makePager = (onFlip: ((d: -1 | 1) => void) | null): HTMLElement => {
	const label = el("span", { class: "menu-pager-label" });
	if (!onFlip) return el("div", { class: "menu-pager" }, [label]);
	const prev = el("button", { class: "menu-pager-btn", text: "◀" });
	const next = el("button", { class: "menu-pager-btn", text: "▶" });
	for (const [b, d] of [
		[prev, -1],
		[next, 1],
	] as const)
		b.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			onFlip(d);
		});
	return el("div", { class: "menu-pager" }, [prev, label, next]);
};

/** ページ pages[p] の行だけ見せる。 */
const showPage = (
	rows: readonly HTMLElement[],
	pages: number[][],
	p: number,
	pager: HTMLElement,
): void => {
	const on = new Set(pages[p] ?? []);
	rows.forEach((r, i) => {
		r.style.display = on.has(i) ? "" : "none";
	});
	const label = pager.querySelector(".menu-pager-label");
	if (label) label.textContent = `${p + 1}／${pages.length}`;
};

/**
 * 縦に並ぶ選択ウィンドウ。B・とじる・外のタップで null。
 * actions は とじるの横に並べるボタン（もちものの「整理」など）。押すと その value で閉じる。
 * header は 題の下・行の上に出す 見るだけの HTML（メインメニューの つよさ）。
 * cols が 2 なら 行を 2 列に並べる（トルネコ1のメニューのように。上下で 段、左右で 列を動く）。
 */
export const listWindow = (
	ctx: UiCtx,
	title: string,
	items: ListItem[],
	opt: {
		cls?: string;
		start?: number;
		closeLabel?: string;
		actions?: { label: string; value: string }[];
		header?: string;
		cols?: number;
	} = {},
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
		if (opt.header)
			box.appendChild(el("div", { class: "menu-header", html: opt.header }));
		const cols = Math.max(1, opt.cols ?? 1);
		const rowsBox =
			cols > 1
				? box.appendChild(el("div", { class: `menu-grid cols-${cols}` }))
				: box;
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
			rowsBox.appendChild(b);
			return b;
		});
		const pager = makePager((d) => flip(d));
		box.appendChild(pager);
		const close = el("button", {
			class: "menu-close",
			text: opt.closeLabel ?? "とじる",
		});
		onTap(close, box, () => done(null));
		if (opt.actions?.length) {
			const foot = el("div", { class: "menu-foot" });
			for (const a of opt.actions) {
				const b = el("button", {
					class: "menu-close menu-action",
					text: a.label,
				});
				onTap(b, box, () => done(a.value));
				foot.appendChild(b);
			}
			foot.appendChild(close);
			box.appendChild(foot);
		} else box.appendChild(close);
		let pages: number[][] = [items.map((_, i) => i)];
		const pageOf = (i: number) =>
			Math.max(
				0,
				pages.findIndex((pg) => pg.includes(i)),
			);
		let shownPage = -1;
		const render = () => {
			const p = pageOf(cur);
			if (pages.length > 1 && p !== shownPage) {
				showPage(buttons, pages, p, pager);
				shownPage = p;
			}
			buttons.forEach((b, i) => {
				b.classList.toggle("cur", i === cur);
				if (i === cur) {
					if (i === 0 || pages.length > 1) box.scrollTop = 0;
					else keepInView(box, b);
				}
			});
		};
		/** となりのページへ（同じ段の行に。選べない行は とばす）。 */
		const flip = (d: -1 | 1) => {
			if (pages.length < 2) return;
			const p = pageOf(cur);
			const np = (p + d + pages.length) % pages.length;
			const row = pages[p].indexOf(cur);
			const target = pages[np];
			let pick = target[Math.min(row, target.length - 1)];
			if (items[pick]?.disabled)
				pick = target.find((i) => !items[i].disabled) ?? pick;
			cur = pick;
			ctx.se("cursor");
			render();
		};
		ctx.ui.appendChild(box);
		pages = paginate(box, buttons, pager);
		render();
		const pop = ctx.input.push(
			(k, repeat) => {
				if (
					k === "up" ||
					k === "down" ||
					(cols > 1 && (k === "left" || k === "right"))
				) {
					if (!items.length) return;
					// 選べない行は とばす（ぜんぶ選べないときは そのまま動く）。2列なら 上下は 段を、左右は 列を動く
					const step =
						(k === "up" || k === "left" ? -1 : 1) *
						(k === "up" || k === "down" ? cols : 1);
					let next = cur;
					for (let n = 0; n < items.length; n++) {
						next = (next + step + items.length) % items.length;
						if (!items[next].disabled) break;
					}
					cur = next;
					ctx.se("cursor");
					render();
				} else if (k === "left" || k === "right") {
					flip(k === "left" ? -1 : 1);
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
