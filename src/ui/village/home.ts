// 地上（おんJタウン）の 倉庫の 一覧：帰ってきた 持ち物から あずける物を えらぶ（chooseStored）・
// 倉庫から 引き取る（openStorage）・引き取った 持ち物を 見て もどす（openBag）。引き取った 物は そのまま 出口から 持っていく。
// トルネコ1で ネネが 持ち帰った道具を売り、店が大きくなるのに あたる（会話・売り・町の 建て直しは
// 村の中。ui/village/villageReturn.ts）。町では 道具を 見てもらえるので、ここでは 本当の名前で出す。

import { saleRate } from "../../core/data/dungeons";
import { CAT_NAME } from "../../core/data/items";
import { defOf } from "../../core/item";
import { CARRY_MAX, priceOf, STORAGE_CAP } from "../../core/town";
import type { Item } from "../../core/types";
import { DUNGEON_NAMES } from "../../data/story/story";
import { TOWN_MSG } from "../../data/town/town";
import {
	depositItem,
	loadTown,
	type PendingReturn,
	reliefItem,
	sortStorage,
	stashRelief,
	type Town,
	withdrawItem,
} from "../../engine/save";

import { walletYen } from "../../engine/wallet";
import type { Ctx } from "../ctx";
import { explain } from "../explain";
import { gearPower, itemSub } from "../itemText";
import { infoWindow, type ListItem, listWindow } from "../list";
import { itemArt as itemArtEl } from "../menu";
import { esc, escBr } from "./records";
import { fill } from "./villageTalk";

/** 町での 道具の呼び名（本当の名前。修正値・本数・回数・のろい）。 */
export const townItemName = (it: Item): string => {
	const d = defOf(it.kind);
	let s = d.name;
	if ((d.cat === "weapon" || d.cat === "shield") && it.plus)
		s += it.plus > 0 ? `+${it.plus}` : `${it.plus}`;
	if (d.cat === "arrow") s += `（${it.count}球）`;
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
			sub: `${Math.round(priceOf(it) * saleRate(pend.dungeon))}`,
			value: String(it.uid),
			disabled: !chosen.has(it.uid) && room <= 0,
		}));
		rows.push({ label: "これできめる", value: "done" });
		const v = await listWindow(
			ctx,
			`${opt.prompt}<br><small>倉庫　${t.storage.length + chosen.size}／${cap}えらばなかった道具は売る</small>`,
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
 * 倉庫（倉庫の 中の 棚・シヨの 受付から）：「引き出す」「預ける」を えらぶ。
 * 引き出す＝倉庫から 村の 持ち物へ（次の 冒険に 持っていく。段で CARRY_MAX 個まで）。
 * 預ける＝村の 持ち物（と もらった ぷゆゆソード）を 倉庫へ。
 */
export const openStorage = async (ctx: Ctx): Promise<void> => {
	let start = 0;
	for (;;) {
		const t = loadTown();
		const cap = STORAGE_CAP[t.stage] ?? 0;
		const canPut = t.bag.length > 0 || !!t.relief;
		const rows: ListItem[] = [
			{
				label: "引き出す",
				value: "take",
				sub: `${t.storage.length}／${cap}`,
				disabled: !t.storage.length,
			},
			{
				label: "預ける",
				value: "put",
				sub: `${t.bag.length + (t.relief ? 1 : 0)}`,
				disabled: !canPut,
			},
		];
		if (!t.storage.length && !canPut) {
			await infoWindow(
				ctx,
				`倉庫0／${cap}`,
				`<p class="dim">${escBr(TOWN_MSG.storageEmpty.text)}</p>`,
			);
			return;
		}
		const v = await listWindow(ctx, `倉庫　${t.storage.length}／${cap}`, rows, {
			start,
		});
		if (v === null) return;
		start = rows.findIndex((r) => r.value === v);
		if (v === "take") await takeFromStorage(ctx);
		else if (v === "put") await putIntoStorage(ctx);
	}
};

/** 倉庫から 引き出す（えらぶと 村の 持ち物へ。「整理」で 並べなおす）。 */
const takeFromStorage = async (ctx: Ctx): Promise<void> => {
	let start = 0;
	for (;;) {
		const t = loadTown();
		const cap = STORAGE_CAP[t.stage] ?? 0;
		const max = CARRY_MAX[t.stage] ?? 0;
		if (!t.storage.length) return;
		const full = t.bag.length >= max;
		const rows: ListItem[] = t.storage.map((it, i) => ({
			label: esc(townItemName(it)),
			value: String(i),
			sub: itemSub(it),
			icon: itemArtEl(it.kind),
			disabled: full,
		}));
		const v = await listWindow(
			ctx,
			`倉庫　${t.storage.length}／${cap}<br><small>えらぶと引き出す持ち物　${t.bag.length}／${max}${full ? `<br>${escBr(fill(TOWN_MSG.bagFull.text, { n: max }))}` : ""}</small>`,
			rows,
			{
				start,
				// 整理：持ち物の 整理と 同じ 分類の 順に 並べなおす（engine/save.ts の sortStorage）
				actions:
					t.storage.length > 1
						? [{ label: "整理", value: "sort", key: "sort", keyHint: "C" }]
						: [],
			},
		);
		if (v === null) return;
		if (v === "sort") {
			if (sortStorage()) ctx.se("decide");
			start = 0;
			continue;
		}
		start = Math.max(0, Math.min(Number(v), t.storage.length - 2));
		if (withdrawItem(Number(v))) ctx.se("decide");
	}
};

/** 倉庫へ 預ける（村の 持ち物と、もらった ぷゆゆソード。ぷゆゆソードは 倉庫に 空きが あるとき）。 */
const putIntoStorage = async (ctx: Ctx): Promise<void> => {
	let start = 0;
	for (;;) {
		const t = loadTown();
		const cap = STORAGE_CAP[t.stage] ?? 0;
		const rows: ListItem[] = [
			...t.bag.map((it, i) => ({
				label: esc(townItemName(it)),
				value: String(i),
				sub: itemSub(it),
				icon: itemArtEl(it.kind),
			})),
			...(t.relief
				? [
						{
							label: `${esc(townItemName(reliefItem()))}<small>（ぷゆゆから）</small>`,
							value: "relief",
							icon: itemArtEl(reliefItem().kind),
							disabled: t.storage.length >= cap,
						},
					]
				: []),
		];
		if (!rows.length) return;
		const v = await listWindow(
			ctx,
			`倉庫　${t.storage.length}／${cap}<br><small>えらぶと預ける</small>`,
			rows,
			{ start },
		);
		if (v === null) return;
		if (v === "relief") {
			if (stashRelief()) ctx.se("decide");
			continue;
		}
		start = Math.max(0, Math.min(Number(v), t.bag.length - 2));
		depositItem(Number(v));
		ctx.se("decide");
	}
};

/** 村の 持ち物の 1行（ダンジョンの もちものと 同じ 見た目：絵・名前・強さ・説明）。 */
const bagRow = (it: Item, value: string, note = ""): ListItem => ({
	label: `${esc(townItemName(it))}${note}`,
	sub: itemSub(it),
	desc: defOf(it.kind).desc,
	icon: itemArtEl(it.kind),
	value,
});

/** 村の 持ち物の「せつめい」（正体は わかって いる。分類・説明・ひとこと・強さ。1ページずつ 送る）。 */
const bagInfo = (it: Item): string[] => {
	const d = defOf(it.kind);
	const pages = [`【${CAT_NAME[d.cat]}】${d.desc}`, d.flavor];
	const stats: string[] = [];
	const g = gearPower(it);
	if (g)
		stats.push(
			`強さ　${g.value}　修正値　${it.plus > 0 ? `+${it.plus}` : it.plus}`,
		);
	if (d.cat === "staff") stats.push(`残り回数　${it.charges}回`);
	if (d.cat === "arrow") stats.push(`強さ　${d.atk ?? 0}　${it.count}球`);
	if (it.cursed) stats.push("のろわれている");
	if (stats.length) pages.push(stats.join("\n"));
	return pages;
};

/**
 * 村の 持ち物（村の メニュー「持ち物」）：次の 冒険に 持っていく 道具を、ダンジョンの もちものと 似た 一覧で 見る
 * （倉庫から 引き出した 物・ぷゆゆの お弁当・もらった ぷゆゆソード）。えらぶと せつめい。ここからは 預けない（倉庫で）。
 */
export const openBag = async (ctx: Ctx): Promise<void> => {
	let start = 0;
	for (;;) {
		const t = loadTown();
		const max = CARRY_MAX[t.stage] ?? 0;
		// ぷゆゆの お弁当（ぷゆゆパン。冒険の はじめの 持ち物と 同じ 種類）
		const lunch: Item = { ...reliefItem(), kind: "f_large" };
		const items: { it: Item; note: string }[] = [
			...t.bag.map((it) => ({ it, note: "" })),
			...(t.relief
				? [{ it: reliefItem(), note: "<small>（ぷゆゆから）</small>" }]
				: []),
			...(t.lunch
				? [{ it: lunch, note: "<small>（ぷゆゆのお弁当）</small>" }]
				: []),
		];
		const title = `持ち物${max > 0 ? `　${t.bag.length}／${max}` : ""}<br><small>このまま出口から出れば持っていく</small>`;
		if (!items.length) {
			await infoWindow(
				ctx,
				max > 0 ? `持ち物0／${max}` : "持ち物",
				`<p class="dim">${max > 0 ? escBr(TOWN_MSG.bagEmpty.text) : "なにも持っていない"}</p>`,
			);
			return;
		}
		const rows = items.map((x, i) => bagRow(x.it, String(i), x.note));
		const v = await listWindow(ctx, title, rows, { start });
		if (v === null) return;
		start = Number(v);
		const got = items[Number(v)];
		if (got) await explain(ctx, bagInfo(got.it));
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
				)}</div><small class="sales-legend">金の棒は町の段が上がった帰り</small>`
		: `<p class="dim">${escBr(TOWN_MSG.salesEmpty.text)}</p>`;
	const html =
		`<div class="sales-kpis">${kpi("合計", `${t.points}円`)}${kpi("手もと", `${walletYen()}円`)}${kpi("前回", last ? `${last.points}円` : "—")}${kpi("平均", t.sales.length ? `${avg}円` : "—")}</div>` +
		bars;
	await infoWindow(ctx, `売り上げ`, html, {
		cls: "sales-window",
	});
};
