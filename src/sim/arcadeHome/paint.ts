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
	PAINT_SIZE,
	PAINT_TEXT,
	PAINT_UNDO,
	pixelAt,
	setPixel,
	UndoStack,
} from "../../data/paint/paint";
import { type HomeGameTest, ok, seeded } from "./kit";

export const tests: HomeGameTest[] = [
	{
		name: "画家の　キャンバスは 保存の 字に して もどすと 同じ 絵",
		run: () => {
			const rnd = seeded(5);
			const p = blankPicture();
			for (let i = 0; i < p.length; i++)
				p[i] = Math.floor(rnd() * PAINT_COLORS.length);
			const s = encodePicture(p);
			ok(s.length === PAINT_SIZE * PAINT_SIZE, `len ${s.length}`);
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
		name: "画家の　キャンバスの 塗りつぶしは 線の 内がわだけ 塗る",
		run: () => {
			const p = blankPicture();
			// 4x4〜10x10 の 四角の 枠
			drawLine(p, 4, 4, 10, 4, 1);
			drawLine(p, 10, 4, 10, 10, 1);
			drawLine(p, 10, 10, 4, 10, 1);
			drawLine(p, 4, 10, 4, 4, 1);
			ok(floodFill(p, 7, 7, 3), "filled");
			ok(pixelAt(p, 5, 5) === 3 && pixelAt(p, 9, 9) === 3, "inside");
			ok(pixelAt(p, 4, 4) === 1 && pixelAt(p, 0, 0) === 0, "outside");
			let n = 0;
			for (const v of p) if (v === 3) n++;
			ok(n === 25, `count ${n}`);
			ok(!floodFill(p, 7, 7, 3), "same color is no-op");
			ok(floodFill(p, 0, 0, 2) && pixelAt(p, 31, 31) === 2, "outside fill");
		},
	},
	{
		name: "画家の　キャンバスの 線は とぎれず、左右反転で 写る",
		run: () => {
			const p = blankPicture();
			drawLine(p, 0, 0, 31, 7, 4);
			for (let x = 0; x < PAINT_SIZE; x++) {
				let hit = false;
				for (let y = 0; y < 8; y++) if (pixelAt(p, x, y) === 4) hit = true;
				ok(hit, `gap at ${x}`);
			}
			const q = blankPicture();
			setPixel(q, 1, 2, 5);
			flipPicture(q);
			ok(pixelAt(q, PAINT_SIZE - 2, 2) === 5 && pixelAt(q, 1, 2) === 0, "flip");
			ok(!setPixel(q, -1, 0, 5) && !setPixel(q, 0, PAINT_SIZE, 5), "outside");
		},
	},
	{
		name: "画家の　キャンバスの 元に戻すは 20手まで",
		run: () => {
			const u = new UndoStack();
			let p = blankPicture();
			for (let i = 0; i < PAINT_UNDO + 5; i++) {
				u.push(p);
				setPixel(p, i % PAINT_SIZE, 0, 1);
			}
			ok(u.size === PAINT_UNDO, `size ${u.size}`);
			const back = u.pop();
			ok(back && pixelAt(back, PAINT_UNDO + 4, 0) === 0, "one step back");
			ok(back && pixelAt(back, PAINT_UNDO + 3, 0) === 1, "keeps older");
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
		name: "画家の　キャンバスの 名無しの ひとことは 22字・2行まで",
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
