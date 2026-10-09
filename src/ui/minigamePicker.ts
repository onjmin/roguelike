// 別ゲーの 選ぶ 部品（縦に 並ぶ 2〜6 の ボタン）。実況（ui/jikkyo.ts）が 使い、あとで 討論の カンペも 使う。
// - ↑↓ で カーソル（端で まわる）、A で カーソルの ボタン、edges なら ← で いちばん 上・→ で いちばん 下、
//   digits なら 数字の 1〜3（ev.code の Digit1〜3 だけ。テンキーは 向きに なって いるので 拾わない）、タップは その ボタン。
// - 開いて 250ms は タップも キーも 数えない（前の 窓の 連打で 決めて しまわない。ui/list.ts の markOpened・justOpened）。
// - 窓の 外の タップは 何も しない（ctx.input.push の tap: null。板の pointerdown を A に しない）。
// - B は いつでも onB（開いて いなくても。やめる の 2回押しは 呼ぶ 側）。
// - at は 押した 時刻（performance.now）。答えの 速さは 描画の 時刻では なく 押した 時刻で はかる。

import { el } from "./dom";
import { justOpened, markOpened, onTap, type UiCtx } from "./list";

export type PickerMark = "best" | "ok" | "miss";

export type Picker = {
	/** ボタンの 文を 入れかえて 受付を 開く（カーソルは 3つなら まんなか、ほかは 上から）。 */
	setLabels(labels: readonly string[], start?: number): void;
	/** 答え合わせ：どの ボタンにも 記号と 色、選んだ ボタンに 白い 枠。受付は 閉じる。 */
	mark(fits: readonly (PickerMark | null)[], chosen: number | null): void;
	/** 受付を 閉じる（ボタンは 残す）。 */
	close(): void;
	cur(): number;
	/** 受付中か。 */
	active(): boolean;
	stop(): void;
};

const MARK: Record<PickerMark, string> = { best: "◎", ok: "○", miss: "×" };

export const picker = (
	ctx: UiCtx,
	host: HTMLElement,
	o: {
		labels?: readonly string[];
		start?: number;
		digits?: boolean;
		edges?: boolean;
		/** ボタンの 並びの アクセシブルな 名前。 */
		aria?: string;
		onPick: (i: number, at: number) => void;
		onB?: (at: number) => void;
	},
): Picker => {
	let buttons: HTMLButtonElement[] = [];
	let cur = 0;
	let open = false;
	host.setAttribute("role", "group");
	if (o.aria) host.setAttribute("aria-label", o.aria);
	const paint = () =>
		buttons.forEach((b, i) => {
			b.classList.toggle("cur", open && i === cur);
		});
	const pick = (i: number, at: number) => {
		if (!open || justOpened(host) || i < 0 || i >= buttons.length) return;
		open = false;
		cur = i;
		paint();
		o.onPick(i, at);
	};
	const setLabels = (labels: readonly string[], start?: number) => {
		host.replaceChildren();
		buttons = labels.map((label, i) => {
			const b = el("button", { class: "jk-pick" }) as HTMLButtonElement;
			b.type = "button";
			b.append(
				el("span", { class: "jk-mark", text: "" }),
				document.createTextNode(label),
			);
			onTap(b, host, () => pick(i, performance.now()));
			return b;
		});
		host.append(...buttons);
		cur = start ?? (labels.length === 3 ? 1 : 0);
		open = true;
		markOpened(host);
		paint();
	};
	const pop = ctx.input.push(
		(k, repeat) => {
			const at = performance.now();
			if (k === "b" || k === "menu") {
				if (!repeat) o.onB?.(at);
				return;
			}
			if (!open || !buttons.length) return;
			const n = buttons.length;
			if (k === "up" || k === "down") {
				if (justOpened(host)) return;
				cur = (cur + (k === "up" ? n - 1 : 1)) % n;
				ctx.se("cursor");
				paint();
				return;
			}
			if (repeat) return;
			if (k === "a") pick(cur, at);
			else if (o.edges && k === "left") pick(0, at);
			else if (o.edges && k === "right") pick(n - 1, at);
		},
		{ tap: null },
	);
	const onKey = (e: KeyboardEvent) => {
		if (!o.digits || e.repeat) return;
		const m = /^Digit([1-9])$/.exec(e.code);
		if (!m) return;
		pick(Number(m[1]) - 1, performance.now());
	};
	window.addEventListener("keydown", onKey);
	if (o.labels) setLabels(o.labels, o.start);
	return {
		setLabels,
		mark: (fits, chosen) => {
			open = false;
			buttons.forEach((b, i) => {
				const f = fits[i];
				const span = b.querySelector(".jk-mark");
				if (span) span.textContent = f ? MARK[f] : "";
				b.classList.remove("fit-best", "fit-ok", "fit-miss");
				if (f) b.classList.add(`fit-${f}`);
				b.classList.toggle("chosen", i === chosen);
			});
			paint();
		},
		close: () => {
			open = false;
			paint();
		},
		cur: () => cur,
		active: () => open,
		stop: () => {
			pop();
			window.removeEventListener("keydown", onKey);
		},
	};
};
