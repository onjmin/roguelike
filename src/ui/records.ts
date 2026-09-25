// 冒険の記録：倒れた・持ち帰ったときの全画面の札（showRunEnd）と、タイトルから見る過去の記録（openRecords）。
// 1ページずつタップで送る語りの札（showStory。はじめての前口上・持ち帰ったあと）もここに置く。

import { DECK } from "../core/data/items";
import { itemName } from "../core/item";
import type { RunState } from "../core/types";
import { ENDING, SPEAKERS } from "../data/quotes";
import {
	addRecord,
	clearRun,
	loadRecords,
	type RunRecord,
	recordFromRun,
	runStats,
} from "../engine/save";
import { sleep } from "../engine/types";
import type { Ctx } from "./ctx";
import { el, nextFrame } from "./dom";
import { infoWindow } from "./list";

/** 山札の枚数（毎回同じ）。 */
const DECK_TOTAL = DECK.reduce((a, e) => a + e.count, 0);

/** HTML に埋めこむ文字の逃がし。 */
export const esc = (s: string): string =>
	s.replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			] ?? c,
	);

/**
 * 全画面の札を、タップ（指をほとんど動かさずに離す）か A/B で閉じるまで待つ。rpg の waitClose と同じ。
 * delay の間は閉じない（死んだ瞬間の連打で読まずに閉じてしまわないように）。
 * scroller があれば、上下キーで巻き取る（指でなぞる巻き取りはタップと見分ける）。
 */
const waitClose = (
	ctx: Ctx,
	box: HTMLElement,
	delay: number,
	scroller?: HTMLElement,
): Promise<void> =>
	new Promise<void>((resolve) => {
		let ready = false;
		let done = false;
		const timer = setTimeout(() => {
			ready = true;
		}, delay);
		let start: { x: number; y: number } | null = null;
		const finish = () => {
			if (!ready || done) return;
			done = true;
			clearTimeout(timer);
			pop();
			box.removeEventListener("pointerdown", down);
			box.removeEventListener("pointerup", up);
			resolve();
		};
		const down = (e: PointerEvent) => {
			ctx.input.onAnyInput?.();
			start = { x: e.clientX, y: e.clientY };
		};
		const up = (e: PointerEvent) => {
			if (!start) return;
			const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
			start = null;
			if (moved < 10) finish();
		};
		box.addEventListener("pointerdown", down);
		box.addEventListener("pointerup", up);
		// キーの押しっぱなし（自動くり返し）では閉じない
		const pop = ctx.input.push(
			(k, repeat) => {
				if (k === "a" || k === "b") {
					if (!repeat) finish();
				} else if (scroller && (k === "up" || k === "down"))
					scroller.scrollBy({ top: k === "up" ? -48 : 48 });
			},
			{ tap: null },
		);
	});

/**
 * 語りの札。1つが1ページ（HTML）で、タップで次へ送る。
 * 黒い全画面に文字だけを出す（はじめての前口上・原盤を持ち帰ったあと）。
 */
export const showStory = async (
	ctx: Ctx,
	pages: string[],
	opt: {
		/** 黒い幕が画面を覆いきったとき（下の画面を差しかえるなら ここで）。 */
		onCovered?: () => void;
	} = {},
): Promise<void> => {
	if (!pages.length) {
		opt.onCovered?.();
		return;
	}
	const text = el("div", { class: "story-text" });
	const box = el("div", { class: "story" }, [
		text,
		el("div", { class: "story-tap", text: "タップで　つぎへ" }),
	]);
	ctx.ui.appendChild(box);
	await nextFrame();
	box.classList.add("shown");
	if (opt.onCovered) {
		// .story の opacity のトランジション（0.5s）が終わるまで待つ
		await sleep(500);
		opt.onCovered();
	}
	for (const html of pages) {
		text.innerHTML = html;
		await nextFrame();
		text.classList.add("shown");
		await waitClose(ctx, box, 450);
		text.classList.remove("shown");
		await sleep(250);
	}
	box.classList.remove("shown");
	await sleep(500);
	box.remove();
};

/** 文字を逃がして、\n を改行にする（セリフは2行に分けて書かれている）。 */
export const escBr = (s: string): string => esc(s).replace(/\n/g, "<br>");

/** 語りの1ページ（話し手がいれば、色つきの名前を上に出して「」でくくる）。 */
const storyLine = (who: keyof typeof SPEAKERS | null, text: string): string => {
	if (!who) return escBr(text);
	const sp = SPEAKERS[who];
	return `<b class="story-name" style="--char:${sp.color}">${esc(sp.name)}</b>「${escBr(text)}」`;
};

/** 終わり方の1行（倒れた階と理由・持ち帰ったなら いちばん深い階）。 */
const endLine = (
	r: Pick<RunRecord, "kind" | "depth" | "maxDepth" | "cause" | "returning">,
): string =>
	r.kind === "clear"
		? `B${r.maxDepth}から　地上へ　もどった`
		: `${r.returning ? "帰り道の　" : ""}B${r.depth}で　${r.cause}`;

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 記録の日時（今年なら年を省く）。 */
const dateLabel = (at: number): string => {
	const d = new Date(at);
	const md = `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
	return d.getFullYear() === new Date().getFullYear()
		? md
		: `${d.getFullYear()}/${md}`;
};

/**
 * 倒れた・持ち帰ったあとの「冒険の記録」の札（全画面）。
 * 記録を足して中断セーブを消すのは、札を出す前にやる（見ている間にタブを閉じても残るように）。
 * 持ち帰ったときは、先に ENDING の語りを流す。
 */
export const showRunEnd = async (ctx: Ctx, s: RunState): Promise<void> => {
	const rec = recordFromRun(s);
	const clear = rec.kind === "clear";
	addRecord(rec);
	clearRun();
	ctx.audio.bgm(clear ? "ending" : "sad");
	const nth = runStats().runs;

	const p = s.player;
	const equipped = new Set([p.weapon, p.shield, p.ring]);
	const grid = (pairs: [string, string][]) =>
		el(
			"div",
			{ class: "runend-grid" },
			pairs.flatMap(([k, v]) => [
				el("span", { text: k }),
				el("b", { text: v }),
			]),
		);
	const items = el(
		"div",
		{ class: "runend-items" },
		p.items.length
			? p.items.map((it) =>
					el("span", {
						html: `${equipped.has(it.uid) ? '<i class="runend-eq">E</i>' : ""}${esc(itemName(s, it))}`,
					}),
				)
			: [el("span", { class: "runend-none", text: "なし" })],
	);
	const card = el("div", { class: `matome-card runend ${rec.kind}` }, [
		el("div", { class: "matome-head", text: "冒険の記録" }),
		el("div", {
			class: "runend-headline",
			text: clear ? "原盤を　持ち帰った" : "たおれた",
		}),
		el("p", { class: "matome-line runend-cause", text: endLine(rec) }),
		el("p", { class: "runend-nth", text: `${nth}回目の　冒険` }),
		el("div", { class: "matome-sec" }, [
			el("div", { class: "matome-title", text: "きろく" }),
			grid([
				["レベル", String(rec.lv)],
				["ターン", String(rec.turn)],
				["倒した数", String(rec.kills)],
				["最深", `B${rec.maxDepth}`],
			]),
		]),
		el("div", { class: "matome-sec" }, [
			el("div", { class: "matome-title", text: "山札" }),
			grid([
				["見た札", `${rec.seen}／${DECK_TOTAL}`],
				["流れた札", String(rec.flowed)],
			]),
		]),
		el("div", { class: "matome-sec" }, [
			el("div", {
				class: "matome-title",
				text: `持ち物（${p.items.length}）`,
			}),
			items,
		]),
	]);
	const box = el("div", { class: "matome" }, [
		card,
		el("div", { class: "matome-tap", text: "タップで　タイトルへ" }),
	]);
	ctx.ui.appendChild(box);
	if (clear) {
		// 持ち帰ったときは、語りが画面を覆ったら その下に札を置いておく（語りが消えると
		// そのまま札が見える。語りのあとに札を出すと、そのすき間に下の画面がちらつく）
		await showStory(
			ctx,
			ENDING.map((l) => storyLine(l.who, l.text)),
			{ onCovered: () => box.classList.add("instant", "shown") },
		);
		box.classList.remove("instant");
	} else {
		await nextFrame();
		box.classList.add("shown");
	}
	await waitClose(ctx, box, 800, box);
	ctx.se("decide");
	box.classList.remove("shown");
	await sleep(600);
	box.remove();
};

/** タイトルの「冒険の記録」：通算と、これまでの冒険（新しい順）。 */
export const openRecords = async (ctx: Ctx): Promise<void> => {
	const list = loadRecords();
	const st = runStats();
	const total = `<div class="rec-total">${[
		["もぐった", `${st.runs}回`],
		["持ち帰った", `${st.clears}回`],
		["いちばん深い", st.best ? `B${st.best}` : "―"],
	]
		.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`)
		.join("")}</div>`;
	const rows = list.length
		? list
				.map(
					(r) =>
						`<div class="rec ${r.kind}"><div class="rec-top"><span class="rec-kind">${r.kind === "clear" ? "持ち帰った" : "たおれた"}</span><span class="rec-date">${dateLabel(r.at)}</span></div><div class="rec-cause">${esc(endLine(r))}</div><div class="rec-sub">Lv${r.lv}　${r.turn}ターン　倒した数${r.kills}　見た札${r.seen}</div></div>`,
				)
				.join("")
		: `<p class="dim">まだ　記録が　ありません。<br>まずは　もぐって　みよう。</p>`;
	const note =
		list.length && st.runs > list.length
			? `<p class="hint">記録は　新しい　${list.length}回ぶんだけ　のこる</p>`
			: "";
	await infoWindow(ctx, "冒険の記録", total + rows + note, {
		cls: "records",
	});
};
