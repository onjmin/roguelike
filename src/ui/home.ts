// 地上（保守村）の 倉庫の 一覧：帰ってきた 持ち物から あずける物を えらぶ（chooseStored）・
// 倉庫から 引き取る（openStorage）・引き取った 持ち物を 見て もどす（openBag）。引き取った 物は そのまま 出口から 持っていく。
// トルネコ1で ネネが 持ち帰った道具を売り、店が大きくなるのに あたる（会話・売り・町の 建て直しは
// 村の中。ui/villageReturn.ts）。町では 道具を 見てもらえるので、ここでは 本当の名前で出す。

import { defOf } from "../core/item";
import { CARRY_MAX, priceOf, STORAGE_CAP } from "../core/town";
import type { Item } from "../core/types";
import { DUNGEON_NAMES } from "../data/story";
import { TOWN_MSG } from "../data/town";
import {
	depositItem,
	loadTown,
	type PendingReturn,
	type Town,
	withdrawItem,
} from "../engine/save";
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
 * 倉庫（村の シヨから）：えらぶと 引き取って 村の 持ち物へ（次の 冒険に 持っていく。段で CARRY_MAX 個まで）。
 * 引き取った 物は 村の メニューの「持ち物」で 見て、倉庫へ もどせる（openBag）。
 */
export const openStorage = async (ctx: Ctx): Promise<void> => {
	let start = 0;
	for (;;) {
		const t = loadTown();
		const cap = STORAGE_CAP[t.stage] ?? 0;
		const max = CARRY_MAX[t.stage] ?? 0;
		if (!t.storage.length) {
			await infoWindow(
				ctx,
				`倉庫　0／${cap}`,
				`<p class="dim">${escBr(TOWN_MSG.storageEmpty.text)}</p>`,
			);
			return;
		}
		const full = t.bag.length >= max;
		const rows: ListItem[] = t.storage.map((it, i) => ({
			label: esc(townItemName(it)),
			value: String(i),
			disabled: full,
		}));
		const v = await listWindow(
			ctx,
			`倉庫　${t.storage.length}／${cap}<br><small>えらぶと　引き取る　持ち物　${t.bag.length}／${max}${full ? `<br>${escBr(fill(TOWN_MSG.bagFull.text, { n: max }))}` : ""}</small>`,
			rows,
			{ start },
		);
		if (v === null) return;
		start = Math.max(0, Math.min(Number(v), t.storage.length - 2));
		if (withdrawItem(Number(v))) ctx.se("decide");
	}
};

/** 村の 持ち物（倉庫から 引き取った 物）：えらぶと 倉庫へ もどす。 */
export const openBag = async (ctx: Ctx): Promise<void> => {
	let start = 0;
	for (;;) {
		const t = loadTown();
		const max = CARRY_MAX[t.stage] ?? 0;
		// ぷゆゆの お弁当（倉庫の 道具とは べつ。数に 入らない）
		const lunch = t.lunch
			? `<br><small>ぷゆゆパン（ぷゆゆの　お弁当）も　持っていく</small>`
			: "";
		if (!t.bag.length) {
			// 倉庫が ひらく 前の 段は 引き取れないので 数も シヨの 小言も 出さない
			await infoWindow(
				ctx,
				max > 0 ? `持ち物　0／${max}` : "持ち物",
				t.lunch
					? `<p>ぷゆゆパン（ぷゆゆの　お弁当）</p>`
					: `<p class="dim">${max > 0 ? escBr(TOWN_MSG.bagEmpty.text) : "なにも　持っていない"}</p>`,
			);
			return;
		}
		const rows: ListItem[] = t.bag.map((it, i) => ({
			label: esc(townItemName(it)),
			value: String(i),
		}));
		const v = await listWindow(
			ctx,
			`持ち物　${t.bag.length}／${max}<br><small>このまま　出口から　出れば　持っていく。えらぶと　倉庫へ　もどす</small>${lunch}`,
			rows,
			{ start },
		);
		if (v === null) return;
		start = Math.max(0, Math.min(Number(v), t.bag.length - 2));
		depositItem(Number(v));
		ctx.se("decide");
	}
};

/**
 * ゼロの 帳簿（村の ゼロから）：帰りごとの 売り上げの 棒グラフ（新しい 12回。段が 上がった 帰りは 色が ちがう）と、
 * 合計・前回・平均、次の 段までの すすみ。売り上げの 記録は 帰って 精算した ときから（engine/save.ts の Town.sales）。
 */
export const openSales = async (ctx: Ctx): Promise<void> => {
	const t = loadTown();
	const recent = t.sales.slice(-12);
	const last = t.sales[t.sales.length - 1];
	const avg = t.sales.length
		? Math.round(t.sales.reduce((a, s) => a + s.points, 0) / t.sales.length)
		: 0;
	const kpi = (label: string, v: string) =>
		`<div class="sales-kpi"><small>${label}</small><b>${v}</b></div>`;
	const max = Math.max(1, ...recent.map((s) => s.points));
	const bars = recent.length
		? `<div class="sales-chart">${recent
				.map(
					(s) =>
						`<div class="sales-col"><span class="sales-val">${s.points}</span>` +
						`<i class="sales-bar${s.up ? " up" : ""}" style="height:${Math.max(2, Math.round((s.points / max) * 100))}%"></i>` +
						`<small>${esc(DUNGEON_NAMES[s.dungeon].short)}</small></div>`,
				)
				.join(
					"",
				)}</div><small class="sales-legend">金の　棒は　町の　段が　上がった　帰り</small>`
		: `<p class="dim">${escBr(TOWN_MSG.salesEmpty.text)}</p>`;
	const html =
		`<div class="sales-kpis">${kpi("合計", `${t.points}円`)}${kpi("前回", last ? `${last.points}円` : "—")}${kpi("平均", t.sales.length ? `${avg}円` : "—")}</div>` +
		bars;
	await infoWindow(ctx, `売り上げ`, html, {
		cls: "sales-window",
	});
};
