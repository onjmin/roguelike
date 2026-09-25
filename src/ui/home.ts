// 地上に帰ってきたあと（帰還スレ・持ち帰り）：持ち物を 倉庫へ あずける／売る、町が育つ。
// トルネコ1で ネネが 持ち帰った道具を売り、店が大きくなるのに あたる。
// 町では 道具を 見てもらえるので、ここでは 本当の名前で出す。

import { defOf } from "../core/item";
import { CARRY_MAX, priceOf, STORAGE_CAP } from "../core/town";
import type { Item } from "../core/types";
import { STAGE_NAMES, STAGE_UP, TOWN_MSG } from "../data/town";
import { loadTown, settleReturn } from "../engine/save";
import type { Ctx } from "./ctx";
import { infoWindow, type ListItem, listWindow } from "./list";
import { esc, escBr, showStory, storyLine } from "./records";

/** 町での 道具の呼び名（本当の名前。修正値・本数・回数・のろい）。 */
export const townItemName = (it: Item): string => {
	const d = defOf(it.kind);
	let s = d.name;
	if ((d.cat === "weapon" || d.cat === "shield") && it.plus)
		s += it.plus > 0 ? `+${it.plus}` : `${it.plus}`;
	if (d.cat === "arrow") s += `（${it.count}本）`;
	if (d.cat === "staff") s += `［${it.charges}］`;
	if (it.cursed) s += "（のろい）";
	return s;
};

const fill = (text: string, vars: Record<string, string | number>): string =>
	text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/** 帰ってきた持ち物を 決める（おあずかりが無ければ 何もしない）。 */
export const settleHome = async (ctx: Ctx): Promise<void> => {
	const t = loadTown();
	const pend = t.pending;
	if (!pend) return;
	const cap = STORAGE_CAP[t.stage] ?? 0;
	const chosen = new Set<number>();
	if (pend.kind === "escape" && cap > 0 && pend.items.length) {
		let start = 0;
		for (;;) {
			const room = cap - t.storage.length - chosen.size;
			const rows: ListItem[] = pend.items.map((it) => ({
				label: `${chosen.has(it.uid) ? "✓　" : ""}${esc(townItemName(it))}`,
				sub: `${priceOf(it)}`,
				value: String(it.uid),
				disabled: !chosen.has(it.uid) && room <= 0,
			}));
			rows.push({ label: "これで　きめる", value: "done" });
			const v = await listWindow(
				ctx,
				`${escBr(TOWN_MSG.storePrompt.text)}<br><small>倉庫　${t.storage.length + chosen.size}／${cap}　えらばなかった　道具は　売る</small>`,
				rows,
				{ start },
			);
			if (v === "done") break;
			if (v === null) {
				// B・とじる・外のタップは 決定ではない：のこりを 売ってよいか 聞く
				const ok = await listWindow(
					ctx,
					escBr(TOWN_MSG.sellRest.text),
					[
						{ label: "はい", value: "yes" },
						{ label: "いいえ", value: "no" },
					],
					{ start: 1 },
				);
				if (ok === "yes") break;
				continue;
			}
			const uid = Number(v);
			if (chosen.has(uid)) chosen.delete(uid);
			else if (room > 0) chosen.add(uid);
			start = rows.findIndex((r) => r.value === v);
		}
	}
	// 選んでいるあいだに 別のタブで 決められていたら、ここでは 何もしない（古い町で 上書きしない）
	const cur = loadTown();
	if (JSON.stringify(cur.pending) !== JSON.stringify(pend)) return;
	const r = settleReturn(cur, [...chosen]);
	const lines = [
		storyLine(TOWN_MSG.sold.who, fill(TOWN_MSG.sold.text, { points: r.sold })),
	];
	if (r.to > r.from)
		for (const l of STAGE_UP[r.to] ?? []) lines.push(storyLine(l.who, l.text));
	await showStory(ctx, lines);
	if (r.to > r.from)
		await infoWindow(
			ctx,
			"",
			`<p>町が　「${esc(STAGE_NAMES[r.to])}」に　なった</p>${CARRY_MAX[r.to] > CARRY_MAX[r.from] ? `<p class="hint">倉庫から　過去ログの底へ　${CARRY_MAX[r.to]}つまで　持っていける</p>` : ""}`,
		);
};

/**
 * 過去ログの底へ 持っていく道具を 倉庫から選ぶ（max 個まで）。やめたら null。
 * ここでは 倉庫から 取り出さない（冒険を作る直前に main.ts が takeFromStorage で取り出して すぐ保存する。
 * 語りの途中で 閉じても 道具が消えないように）。
 */
export const pickCarry = async (
	ctx: Ctx,
	max: number,
): Promise<Item[] | null> => {
	const t = loadTown();
	if (!t.storage.length || max <= 0) return [];
	const chosen = new Set<number>();
	let start = 0;
	for (;;) {
		const rows: ListItem[] = t.storage.map((it, i) => ({
			label: `${chosen.has(i) ? "✓　" : ""}${esc(townItemName(it))}`,
			value: String(i),
			disabled: !chosen.has(i) && chosen.size >= max,
		}));
		rows.push({ label: "これで　もぐる", value: "go" });
		const v = await listWindow(
			ctx,
			`${escBr(fill(TOWN_MSG.carryPrompt.text, { n: max }))}<br><small>${chosen.size}／${max}</small>`,
			rows,
			{ start },
		);
		if (v === null) return null;
		if (v === "go") break;
		const i = Number(v);
		if (chosen.has(i)) chosen.delete(i);
		else if (chosen.size < max) chosen.add(i);
		start = i;
	}
	return [...chosen].map((i) => t.storage[i]);
};

/** 倉庫を見る（タイトルから）。 */
export const openStorage = async (ctx: Ctx): Promise<void> => {
	const t = loadTown();
	const cap = STORAGE_CAP[t.stage] ?? 0;
	const body = t.storage.length
		? `<ul class="storage">${t.storage.map((it) => `<li>${esc(townItemName(it))}</li>`).join("")}</ul>`
		: `<p class="dim">${escBr(TOWN_MSG.storageEmpty.text)}</p>`;
	await infoWindow(ctx, `倉庫　${t.storage.length}／${cap}`, body);
};
