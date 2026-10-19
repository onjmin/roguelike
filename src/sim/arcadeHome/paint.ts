// 画家の　キャンバス の 試験（data/paint/paint.ts。ゲームでは ないが 家の 家具なので ここで 回す）。

import {
	blankPicture,
	decodePicture,
	drawLine,
	encodePicture,
	flipPicture,
	floodFill,
	isBlank,
	PAINT_COLORS,
	PAINT_H,
	PAINT_TEXT,
	PAINT_UNDO,
	PAINT_W,
	pixelAt,
	setPixel,
	UndoStack,
} from "../../data/paint/paint";
import { type HomeGameTest, ok, seeded } from "./kit";

export const tests: HomeGameTest[] = [
	{
		name: "画家のキャンバスは 保存の 字に して もどすと 同じ 絵",
		run: () => {
			const rnd = seeded(5);
			const p = blankPicture();
			for (let i = 0; i < p.length; i++)
				p[i] = Math.floor(rnd() * PAINT_COLORS.length);
			const s = encodePicture(p);
			ok(s.length === PAINT_W * PAINT_H, `len ${s.length}`);
			const q = decodePicture(s);
			ok(
				q?.every((v, i) => v === p[i]),
				"round trip",
			);
			ok(decodePicture("xyz") === null, "bad length");
			ok(decodePicture(`${s.slice(1)}g`) === null, "bad char");
			ok(decodePicture(42) === null, "not string");
			ok(PAINT_COLORS.length === 16, `colors ${PAINT_COLORS.length}`);
		},
	},
	{
		name: "画家のキャンバスの 塗りつぶしは 線の 内がわだけ 塗る",
		run: () => {
			const p = blankPicture();
			// 2x1〜6x5 の 四角の 枠
			drawLine(p, 2, 1, 6, 1, 1);
			drawLine(p, 6, 1, 6, 5, 1);
			drawLine(p, 6, 5, 2, 5, 1);
			drawLine(p, 2, 5, 2, 1, 1);
			ok(floodFill(p, 4, 3, 3), "filled");
			ok(pixelAt(p, 3, 2) === 3 && pixelAt(p, 5, 4) === 3, "inside");
			ok(pixelAt(p, 2, 1) === 1 && pixelAt(p, 0, 0) === 0, "outside");
			let n = 0;
			for (const v of p) if (v === 3) n++;
			ok(n === 9, `count ${n}`);
			ok(!floodFill(p, 4, 3, 3), "same color is no-op");
			ok(
				floodFill(p, 0, 0, 2) && pixelAt(p, PAINT_W - 1, PAINT_H - 1) === 2,
				"outside fill",
			);
		},
	},
	{
		name: "画家のキャンバスの 線は とぎれず、左右反転で 写る",
		run: () => {
			const p = blankPicture();
			drawLine(p, 0, 0, PAINT_W - 1, PAINT_H - 1, 4);
			for (let x = 0; x < PAINT_W; x++) {
				let hit = false;
				for (let y = 0; y < PAINT_H; y++)
					if (pixelAt(p, x, y) === 4) hit = true;
				ok(hit, `gap at ${x}`);
			}
			const q = blankPicture();
			setPixel(q, 1, 2, 5);
			flipPicture(q);
			ok(pixelAt(q, PAINT_W - 2, 2) === 5 && pixelAt(q, 1, 2) === 0, "flip");
			ok(!setPixel(q, -1, 0, 5) && !setPixel(q, 0, PAINT_H, 5), "outside");
		},
	},
	{
		name: "画家のキャンバスの 元に戻すは 20手まで",
		run: () => {
			const u = new UndoStack();
			let p = blankPicture();
			for (let i = 0; i < PAINT_UNDO + 5; i++) {
				u.push(p);
				setPixel(p, i % PAINT_W, Math.floor(i / PAINT_W), 1);
			}
			ok(u.size === PAINT_UNDO, `size ${u.size}`);
			const back = u.pop();
			const at = (i: number) => [i % PAINT_W, Math.floor(i / PAINT_W)] as const;
			ok(back && pixelAt(back, ...at(PAINT_UNDO + 4)) === 0, "one step back");
			ok(back && pixelAt(back, ...at(PAINT_UNDO + 3)) === 1, "keeps older");
			// 写しなので 元の 絵を 変えても 積んだ 絵は 変わらない
			p = blankPicture();
			u.push(p);
			setPixel(p, 0, 0, 9);
			ok(u.pop()?.[0] === 0, "copy");
			while (u.pop());
			ok(u.size === 0 && u.pop() === null, "empty");
			ok(isBlank(blankPicture()), "blank");
		},
	},
	{
		name: "画家のキャンバスの 名無しの ひとことは 22字・2行まで",
		run: () => {
			const w = (s: string) =>
				[...s].reduce((n, ch) => n + (ch.charCodeAt(0) < 0x80 ? 0.5 : 1), 0);
			const all = [
				...PAINT_TEXT.comments,
				PAINT_TEXT.saved,
				PAINT_TEXT.unsaved,
				...PAINT_TEXT.quitMenu,
				...PAINT_TEXT.clearMenu,
			];
			for (const t of all) {
				const lines = t.split("\n");
				ok(lines.length <= 2, `lines ${t}`);
				for (const l of lines) ok(w(l) <= 22, `width ${l}`);
			}
		},
	},
];
