// 地上（保守村）の 倉庫の 一覧：帰ってきた 持ち物から あずける物を えらぶ（chooseStored）・
// 過去ログの底へ 持っていく物を えらぶ（pickCarry）・倉庫を 見る（openStorage）。
// トルネコ1で ネネが 持ち帰った道具を売り、店が大きくなるのに あたる（会話・売り・町の 建て直しは
// 村の中。ui/villageReturn.ts）。町では 道具を 見てもらえるので、ここでは 本当の名前で出す。

import { defOf } from "../core/item";
import { priceOf, STORAGE_CAP } from "../core/town";
import type { Item } from "../core/types";
import { TOWN_MSG } from "../data/town";
import { loadTown, type PendingReturn, type Town } from "../engine/save";
import type { Ctx } from "./ctx";
import { infoWindow, type ListItem, listWindow } from "./list";
import { esc, escBr } from "./records";
import { fill } from "./villageTalk";

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

/**
 * 帰ってきた持ち物から 倉庫に あずける道具を えらぶ（uid。ここでは 保存しない。決めるのは 呼ぶ側の settleReturn）。
 * B・とじる・外のタップは 決定ではない：のこりを 売ってよいか 聞いて（confirmSell。ロゼが 村の窓で きく）、
 * はい なら そこで 決める。prompt は 一覧の 題（HTML。シヨが 先に 村の窓で 言うので 短い題）。
 */
export const chooseStored = async (
	ctx: Ctx,
	t: Town,
	pend: PendingReturn,
	opt: { prompt: string; confirmSell: () => Promise<boolean> },
): Promise<number[]> => {
	const cap = STORAGE_CAP[t.stage] ?? 0;
	const chosen = new Set<number>();
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
			`${opt.prompt}<br><small>倉庫　${t.storage.length + chosen.size}／${cap}　えらばなかった　道具は　売る</small>`,
			rows,
			{ start },
		);
		if (v === "done") break;
		if (v === null) {
			if (await opt.confirmSell()) break;
			continue;
		}
		const uid = Number(v);
		if (chosen.has(uid)) chosen.delete(uid);
		else if (room > 0) chosen.add(uid);
		start = rows.findIndex((r) => r.value === v);
	}
	return [...chosen];
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

/** 倉庫を見る（村の シヨ・メニューから）。 */
export const openStorage = async (ctx: Ctx): Promise<void> => {
	const t = loadTown();
	const cap = STORAGE_CAP[t.stage] ?? 0;
	const body = t.storage.length
		? `<ul class="storage">${t.storage.map((it) => `<li>${esc(townItemName(it))}</li>`).join("")}</ul>`
		: `<p class="dim">${escBr(TOWN_MSG.storageEmpty.text)}</p>`;
	await infoWindow(ctx, `倉庫　${t.storage.length}／${cap}`, body);
};
