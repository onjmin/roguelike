// 冒険の記録：倒れた・持ち帰ったときの全画面の札（showRunEnd）と、村で見る過去の記録（openRecords。
// まとめ掲示板・ゼロ・村のメニューから）。
// 1ページずつタップで送る語りの札（showStory。はじめての前口上）もここに置く。

import { dungeonById } from "../core/data/dungeons";
import { defOf, itemName } from "../core/item";
import type { DungeonId, RunState } from "../core/types";
import { ENDING_BGM } from "../data/music";
import { BOSS_HOME, DUNGEON_NAMES } from "../data/story";
import {
	addRecord,
	clearRun,
	loadRecords,
	loadReplays,
	REPLAYS_KEEP,
	type RunRecord,
	recordFromRun,
	replayMatches,
	runStats,
	type SavedReplay,
} from "../engine/save";
import { sleep } from "../engine/types";
import type { Ctx } from "./ctx";
import { el, nextFrame } from "./dom";
import { floorShort } from "./floorName";
import { infoWindow, listWindow } from "./list";
import { importWindow, shareWindow } from "./share";
import { villageSong } from "./villageMusic";

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
 * 黒い全画面に文字だけを出す（はじめての前口上）。
 */
export const showStory = async (ctx: Ctx, pages: string[]): Promise<void> => {
	if (!pages.length) return;
	const text = el("div", { class: "story-text" });
	const box = el("div", { class: "story" }, [
		text,
		el("div", { class: "story-tap", text: "タップで　つぎへ" }),
	]);
	ctx.ui.appendChild(box);
	await nextFrame();
	box.classList.add("shown");
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

/**
 * ボスを たおして 帰った ひとこと（「（品）ごと、〜　帰った」。品を 持ち帰った ことも わかるように）。
 * 冒険の記録の 札・リプレイの 終わり・記録の 見出し・もらった リプレイの 見出し。
 */
export const bossHomeLine = (d: DungeonId): string =>
	`${defOf(dungeonById(d).goal).name}ごと、${BOSS_HOME[d] ?? "入口へ　帰った"}`;

/** ボスを たおして 帰った 冒険か（記録・リプレイ）。 */
export const isBossClear = (r: {
	kind: RunRecord["kind"];
	objective?: RunRecord["objective"];
}): boolean => r.kind === "clear" && r.objective === "boss";

/**
 * 終わり方の1行（倒れた階と理由・持ち帰ったなら いちばん深い階・ボスを たおしたなら その 階と ボス。
 * ボスの 冒険の 終わりの 理由は「〇〇を　たおした」。どう 帰ったかは 見出しの 2行目：recordHead）。
 */
export const endLine = (
	r: Pick<
		RunRecord,
		| "kind"
		| "depth"
		| "maxDepth"
		| "cause"
		| "returning"
		| "dungeon"
		| "objective"
	>,
): string =>
	`${DUNGEON_NAMES[r.dungeon ?? "main"].short}　${
		isBossClear(r)
			? `${floorShort(r.dungeon, r.depth)}で　${r.cause}`
			: r.kind === "clear"
				? `${floorShort(r.dungeon, r.maxDepth)}から　地上へ　もどった`
				: r.kind === "escape"
					? `${floorShort(r.dungeon, r.depth)}から　帰還スレで　もどった`
					: `${r.returning ? "帰り道の　" : ""}${floorShort(r.dungeon, r.depth)}で　${r.cause}`
	}`;

/**
 * 記録を 開いたときの 見出し（HTML）：終わり方の 1行、ボスなら 品ごと どう 帰ったか、日時・レベル・ターン。
 * 一覧の 行は 1行の まま（「持ち帰った」の 札で 品を 持ち帰った ことは わかる。帰り方は 開くと 出る）。
 */
export const recordHead = (
	r: Parameters<typeof endLine>[0] & Pick<RunRecord, "at" | "lv" | "turn">,
): string =>
	`${esc(endLine(r))}<br><small>${
		isBossClear(r) ? `${esc(bossHomeLine(r.dungeon ?? "main"))}<br>` : ""
	}${dateLabel(r.at)}　Lv${r.lv}　${r.turn}ターン</small>`;

/** 記録の一覧の 終わり方の札。 */
const KIND_LABEL: Record<RunRecord["kind"], string> = {
	clear: "持ち帰った",
	escape: "帰ってきた",
	dead: "たおれた",
};

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
 * 倒れた・持ち帰ったあとの「冒険の記録」の札（全画面。トルネコ1の 冒険の記録の 画面）。
 * 記録を足して中断セーブを消すのは、札を出す前にやる（見ている間にタブを閉じても残るように）。
 * 持ち帰りの 語りと 開いた知らせは、札を 閉じたあと 村の中で 仲間が 話す（ui/villageReturn.ts）。
 */
export const showRunEnd = async (ctx: Ctx, s: RunState): Promise<void> => {
	const rec = recordFromRun(s);
	const clear = rec.kind === "clear";
	const boss = rec.objective === "boss";
	const escaped = rec.kind === "escape";
	addRecord(rec);
	clearRun();
	ctx.audio.bgm(clear ? ENDING_BGM : escaped ? villageSong() : "sad");
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
			// ボス：見出しは「〇〇を　たおした」（終わりの 理由）、下の 行で 品ごと どう 帰ったか
			text:
				clear && boss
					? rec.cause
					: clear
						? `${defOf(dungeonById(s.dungeon).goal).name}を　持ち帰った`
						: escaped
							? "地上へ　もどった"
							: "たおれた",
		}),
		el("p", {
			class: "matome-line runend-cause",
			text:
				clear && boss
					? `${DUNGEON_NAMES[s.dungeon].short}　${bossHomeLine(s.dungeon)}`
					: endLine(rec),
		}),
		el("p", { class: "runend-nth", text: `${nth}回目の　冒険` }),
		el("div", { class: "matome-sec" }, [
			el("div", { class: "matome-title", text: "きろく" }),
			grid([
				["レベル", String(rec.lv)],
				["ターン", String(rec.turn)],
				["倒した数", String(rec.kills)],
				["いちばん　遠く", floorShort(rec.dungeon, rec.maxDepth)],
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
		el("div", { class: "matome-tap", text: "タップで　地上へ" }),
	]);
	ctx.ui.appendChild(box);
	await nextFrame();
	box.classList.add("shown");
	await waitClose(ctx, box, 800, box);
	ctx.se("decide");
	box.classList.remove("shown");
	await sleep(600);
	box.remove();
};

/**
 * 「冒険の記録」（村の まとめ掲示板・本館の 壁の スレから）：通算と、これまでの冒険（新しい順）。
 * replay（本館の 映写機の「リプレイ上映」）の ときだけ、冒険を選ぶと 残っていれば「リプレイを見る」
 * 「リプレイを わたす」。見るなら そのリプレイを返す。「読み込む」で 人から もらった リプレイも 見られる。
 * 記録だけの ときは 選んでも 見出しだけ（リプレイは 本館で）。
 */
export const openRecords = async (
	ctx: Ctx,
	opt: { replay?: boolean } = {},
): Promise<SavedReplay | null> => {
	const title = opt.replay ? "リプレイ上映" : "冒険の記録";
	const cls = opt.replay ? "records film" : "records";
	const list = loadRecords();
	const st = runStats();
	const total = `<div class="rec-total">${[
		["もぐった", `${st.runs}回`],
		["持ち帰った", `${st.clears}回`],
		["いちばん遠く", st.best ? `${st.best}階` : "―"],
	]
		.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`)
		.join("")}</div>`;
	// もらった リプレイを 読み込む（ui/share.ts）。記録が 無くても できる
	const importAction = opt.replay
		? [{ label: "読み込む", value: "import" }]
		: [];
	if (!list.length) {
		for (;;) {
			const v = await listWindow(
				ctx,
				`${title}${total}<p class="dim">まだ　記録が　ありません。<br>まずは　もぐって　みよう。</p>`,
				[],
				{ cls, actions: importAction },
			);
			if (v !== "import") return null;
			const got = await importWindow(ctx);
			if (got) return got;
		}
	}
	const replays = loadReplays();
	const replayOf = (r: RunRecord) => replays.find((p) => replayMatches(p, r));
	// 残す数がいっぱいのとき、それより古い記録のリプレイは押し出されている
	const oldestKept =
		replays.length >= REPLAYS_KEEP
			? Math.min(...replays.map((x) => x.at))
			: Number.NEGATIVE_INFINITY;
	const note =
		st.runs > list.length
			? `<p class="hint">記録は　新しい　${list.length}回ぶんだけ　のこる</p>`
			: "";
	let start = 0;
	for (;;) {
		const rows = list.map((r, i) => ({
			label: `<b class="rec-kind ${r.kind}">${KIND_LABEL[r.kind]}</b>　${esc(endLine(r))}`,
			sub: opt.replay && replayOf(r) ? "▶" : "",
			desc: `${dateLabel(r.at)}　Lv${r.lv}　${r.turn}ターン　倒した数${r.kills}`,
			value: String(i),
		}));
		const v = await listWindow(ctx, `${title}${total}${note}`, rows, {
			cls,
			start,
			actions: importAction,
		});
		if (v === null) return null;
		if (v === "import") {
			const got = await importWindow(ctx);
			if (got) return got;
			continue;
		}
		start = Number(v);
		const r = list[start];
		const rp = replayOf(r);
		const head = recordHead(r);
		if (!opt.replay) {
			await infoWindow(
				ctx,
				"",
				`<p>${head}</p>${rp ? `<p class="dim">リプレイは　本館の　映写機で　見られる</p>` : ""}`,
			);
			continue;
		}
		if (!rp) {
			await infoWindow(
				ctx,
				"",
				`<p>${head}</p><p class="dim">この冒険の　リプレイは　のこっていない${r.at < oldestKept ? `<br>（リプレイは　新しい　${REPLAYS_KEEP}回ぶんだけ　のこる）` : ""}</p>`,
			);
			continue;
		}
		for (;;) {
			const pick = await listWindow(ctx, head, [
				{ label: "リプレイを　見る", value: "play" },
				{ label: "リプレイを　わたす", value: "share" },
			]);
			if (pick === "play") return rp;
			if (pick !== "share") break;
			await shareWindow(ctx, rp);
		}
	}
};
