// 音楽室の ピアノ（data/piano.ts）。プレイヤーが 1オクターブ（12音）の 鍵盤を 自由に 弾く 窓。
// - 鍵盤を タップ（押した 瞬間に 鳴る）。十字キーの 左右で 鍵盤を えらび A で 弾く、上下で オクターブ。
// - ガイド：劇中の 曲の 主旋律の 次の 音の 鍵盤が 光る（オクターブも その 音に 合わせて 動く）。
//   光った 鍵盤を 押すと 次へ。ほかの 鍵盤も 鳴る（進まない）。最後まで 弾くと「おしまい」。
// 曲は 自動では 鳴らない（押した 音だけ）。B・やめる で 閉じる。

import { isBlack, KEY_NAMES, octaveOf, PIANO_OCTAVES } from "../data/piano";
import type { Ctx } from "./ctx";
import { el } from "./dom";
import { markOpened, onTap } from "./list";

export type PianoResult = { finished: boolean; played: number };

/** 白鍵の 並び（ドから シまで。半音の 番号）と、黒鍵の 左の 白鍵。 */
const WHITES = [0, 2, 4, 5, 7, 9, 11];
const BLACK_AFTER: Record<number, number> = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };

/**
 * ピアノの 窓を 開く。guide を 渡すと その 主旋律（MIDI 番号の 列）の ガイドつき。
 * 閉じたら 最後まで 弾いたか・弾いた 音の 数。
 */
export const openPiano = (
	ctx: Ctx,
	opt: { title: string; guide?: readonly number[] } = { title: "ピアノ" },
): Promise<PianoResult> =>
	new Promise((resolve) => {
		const guide = opt.guide ?? [];
		let step = 0;
		let played = 0;
		let base: number =
			guide.length > 0 ? octaveOf(guide[0]) : PIANO_OCTAVES.start;
		let cur = 0;
		const box = el("div", { class: "menu window piano" });
		box.appendChild(el("div", { class: "menu-title", text: opt.title }));
		const info = box.appendChild(el("div", { class: "piano-info" }));
		const kb = box.appendChild(el("div", { class: "piano-keys" }));
		const keys: HTMLElement[] = [];
		for (let k = 0; k < 12; k++) {
			const black = isBlack(k);
			const b = el("button", {
				class: `piano-key ${black ? "black" : "white"}`,
				text: black ? "" : KEY_NAMES[k],
			});
			if (black)
				b.style.left = `calc(${(BLACK_AFTER[k] + 1) * (100 / 7)}% - 4.5%)`;
			else b.style.left = `${WHITES.indexOf(k) * (100 / 7)}%`;
			b.addEventListener("pointerdown", (e) => {
				e.preventDefault();
				e.stopPropagation();
				cur = k;
				press(k);
			});
			kb.appendChild(b);
			keys[k] = b;
		}
		const row = box.appendChild(el("div", { class: "piano-octave" }));
		const down = el("button", { class: "menu-close", text: "◀ 低く" });
		const label = el("span", { class: "piano-oct-label" });
		const up = el("button", { class: "menu-close", text: "高く ▶" });
		row.append(down, label, up);
		onTap(down, box, () => shift(-12));
		onTap(up, box, () => shift(12));
		const close = el("button", { class: "menu-close", text: "やめる" });
		onTap(close, box, () => done());
		box.appendChild(close);

		const nextMidi = (): number | undefined => guide[step];
		const render = () => {
			const n = nextMidi();
			if (n !== undefined && octaveOf(n) !== base) base = octaveOf(n);
			label.textContent = `オクターブ ${base / 12 - 1}`;
			keys.forEach((b, k) => {
				b.classList.toggle("cur", k === cur);
				b.classList.toggle("next", n !== undefined && base + k === n);
			});
			if (!guide.length) info.textContent = "すきに　弾いて　みよう";
			else if (step >= guide.length) info.textContent = "♪　おしまい";
			else
				info.textContent = `光る　鍵盤を　押そう　${step + 1} / ${guide.length}`;
		};
		const shift = (d: number) => {
			const n = base + d;
			if (n < PIANO_OCTAVES.min || n > PIANO_OCTAVES.max) return;
			base = n;
			// ガイドの 途中は 次の 音の オクターブに もどる（見本の 高さと ずれないように）
			render();
		};
		const press = (k: number) => {
			const midi = base + k;
			void ctx.audio.pianoNote(midi);
			played++;
			const b = keys[k];
			b.classList.remove("hit");
			void b.offsetWidth;
			b.classList.add("hit");
			if (nextMidi() === midi) step++;
			render();
		};
		ctx.ui.appendChild(box);
		markOpened(box);
		render();
		const pop = ctx.input.push(
			(k, repeat) => {
				if (k === "left" || k === "right") {
					cur = (cur + (k === "left" ? 11 : 1)) % 12;
					render();
				} else if (k === "up" || k === "down") {
					if (!repeat) shift(k === "up" ? 12 : -12);
				} else if (k === "a") {
					if (!repeat) press(cur);
				} else if (k === "b" && !repeat) done();
			},
			{ tap: null },
		);
		const done = () => {
			pop();
			ctx.se("cancel");
			box.remove();
			resolve({ finished: guide.length > 0 && step >= guide.length, played });
		};
	});
