// 数字を 1桁ずつ 入れる 窓（灯台の 扉の パスワード。ui/villageEvents.ts）。
// - スマホ：大きな 数字の ボタン（電話の 並び 1〜9・0）を タップ。「消す」で 1桁 もどす、「決定」で 決める。
// - PC：数字キー・Backspace（消す）・Enter（決定）で そのまま 入る。矢印と A でも ボタンを 選んで 押せる。
// - B：1桁 消す（何も 入って いなければ やめる）。窓の 外の タップでは 閉じない（打ちまちがいで 閉じないように）。
// 入れた 桁は ●で なく 数字で 見せる（手紙を 見ながら 打つ 謎解き。何桁かは 見せない）。

import { el } from "./dom";
import type { UiCtx } from "./list";
import { markOpened, onTap } from "./list";
import { OPEN_WAIT_MS } from "./message";

/** ボタンの 並び（3列。「消す」「決定」は 0 の 左右）。 */
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"];
const COLS = 3;

export const pinPad = (
	ctx: UiCtx,
	title: string,
	opt: { max?: number } = {},
): Promise<string | null> =>
	new Promise((resolve) => {
		const max = opt.max ?? 8;
		const openedAt = performance.now();
		let code = "";
		let cur = 0;
		const box = el("div", { class: "menu window pinpad" });
		box.appendChild(el("div", { class: "menu-title", text: title }));
		const shown = el("div", { class: "pin-shown" });
		box.appendChild(shown);
		const grid = el("div", { class: "pin-grid" });
		const buttons = KEYS.map((k) => {
			const b = el("button", {
				class: `pin-key${k === "del" || k === "ok" ? " pin-fn" : ""}`,
				text: k === "del" ? "消す" : k === "ok" ? "決定" : k,
			});
			onTap(b, box, () => press(k));
			grid.appendChild(b);
			return b;
		});
		box.appendChild(grid);
		const close = el("button", { class: "menu-close", text: "やめる" });
		onTap(close, box, () => done(null));
		box.appendChild(close);

		const render = () => {
			shown.replaceChildren(
				...[...code].map((d) => el("span", { class: "pin-digit", text: d })),
				el("span", { class: "pin-caret" }),
			);
			buttons.forEach((b, i) => {
				b.classList.toggle("cur", i === cur);
			});
			const ok = buttons[KEYS.indexOf("ok")];
			ok.classList.toggle("disabled", !code);
		};
		const press = (k: string) => {
			if (k === "ok") {
				if (code) done(code);
				return;
			}
			if (k === "del") {
				if (!code) return;
				code = code.slice(0, -1);
				ctx.se("cancel");
			} else {
				if (code.length >= max) return;
				code += k;
				ctx.se("cursor");
			}
			render();
		};

		// PC の 数字キー（ゲームの キーの 割り当てに ない キーだけ。窓の あいだだけ 聞く）
		const onKey = (e: KeyboardEvent) => {
			if (performance.now() - openedAt < OPEN_WAIT_MS) return;
			const d = /^(?:Digit|Numpad)(\d)$/.exec(e.code)?.[1];
			if (d !== undefined) press(d);
			else if (e.code === "Backspace") press("del");
			else if (e.code === "Enter" || e.code === "NumpadEnter") press("ok");
			else return;
			e.preventDefault();
			e.stopPropagation();
		};
		window.addEventListener("keydown", onKey, { capture: true });

		ctx.ui.appendChild(box);
		markOpened(box);
		render();
		let fresh = false;
		const pop = ctx.input.push(
			(k, repeat) => {
				if (performance.now() - openedAt < OPEN_WAIT_MS) return;
				if (repeat && !fresh) return;
				if (!repeat) fresh = true;
				if (k === "up" || k === "down" || k === "left" || k === "right") {
					const rows = KEYS.length / COLS;
					const x = cur % COLS;
					const y = Math.floor(cur / COLS);
					const nx =
						k === "left"
							? (x + COLS - 1) % COLS
							: k === "right"
								? (x + 1) % COLS
								: x;
					const ny =
						k === "up"
							? (y + rows - 1) % rows
							: k === "down"
								? (y + 1) % rows
								: y;
					cur = ny * COLS + nx;
					ctx.se("cursor");
					render();
				} else if (repeat) {
					return;
				} else if (k === "a") {
					press(KEYS[cur]);
				} else if (k === "b") {
					if (code) press("del");
					else done(null);
				}
			},
			{ tap: null },
		);
		const done = (v: string | null) => {
			pop();
			window.removeEventListener("keydown", onKey, { capture: true });
			ctx.se(v === null ? "cancel" : "decide");
			box.remove();
			resolve(v);
		};
	});
