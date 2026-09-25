// ゲーム中のメニュー（B ボタン／☰）：もちもの・足元・山札・つよさ・ログ・地図・せってい・中断。
//
// - メニューは run を書きかえない。選んだ行動は Command にして返し、進めるのは呼び出し側（run.act）。
//   投げた道具が飛ぶ などの演出を play.ts の1か所でまとめて出せるように。
// - 窓の外をタップしたら「とじる」（listWindow がそうしている）。決定にはしない。
// - 道具の行には必ず2行目の説明を出す（名前だけでは効果がわからない、への対策）。
// - 奥の窓を閉じたら、1つ手前の窓へ カーソルの位置ごと もどる。

import { INVENTORY_MAX, LAST_DEPTH } from "../core/balance";
import { DECK } from "../core/data/items";
import { needsTarget } from "../core/effects";
import { defOf, isKeyItem, isKnownKind, isUnidentifiedCat } from "../core/item";
import type { Run } from "../core/run";
import { trapName } from "../core/traps";
import type { Command, Item, ItemCat, TrapKind } from "../core/types";
import type { Ctx } from "./ctx";
import { openDeck } from "./deckView";
import { el } from "./dom";
import { esc, itemDesc, itemInfo, itemLabel, itemSub } from "./itemText";
import { infoWindow, keepInView, type ListItem, listWindow } from "./list";
import { openStatus } from "./statusView";

export type MenuAction =
	| { kind: "command"; cmd: Command } // 呼び出し側が run.act(cmd) する
	| { kind: "map" } // 階全体の地図を出す
	| { kind: "settings" } // せってい（呼び出し側が開く）
	| { kind: "suspend" } // 中断して タイトルへ（セーブは呼び出し側）
	| { kind: "none" };

const NONE: MenuAction = { kind: "none" };
const command = (cmd: Command): MenuAction => ({ kind: "command", cmd });

/** 何も無いときの行（選べない）。空の一覧で「とじる」だけになるより わかりやすい。 */
const emptyRow = (label: string): ListItem => ({
	label,
	value: "",
	disabled: true,
});

/** 持ち物の1行（もちもの・選ぶ窓で同じ見た目）。 */
const itemRow = (run: Run, it: Item): ListItem => ({
	label: itemLabel(run, it),
	sub: itemSub(it),
	desc: itemDesc(run, it),
	value: String(it.uid),
});

/**
 * 下じきの一覧。小さいメニュー（つかう・なげる…）を開いているあいだ、さっきの一覧を
 * 後ろに見せておく（何を選んだかわかるように）。タップしたら窓の外と同じく「とじる」。
 * 見えているだけの箱だと、指が下の A ボタンなどに抜けてしまうので、タップは受けて B にする。
 */
const ghostList = (
	ctx: Ctx,
	title: string,
	rows: ListItem[],
	cur: number,
): (() => void) => {
	const box = el("div", { class: "menu window ghost" });
	if (title) box.appendChild(el("div", { class: "menu-title", html: title }));
	const els = rows.map((it, i) => {
		const b = el("div", {
			class: "menu-item",
			html: `<span>${it.label}</span>${it.sub ? `<small>${it.sub}</small>` : ""}${it.desc ? `<span class="desc">${it.desc}</span>` : ""}`,
		});
		if (it.desc) b.classList.add("has-desc");
		if (it.disabled) b.classList.add("disabled");
		if (i === cur) b.classList.add("cur");
		box.appendChild(b);
		return b;
	});
	box.addEventListener("pointerdown", (e) => {
		e.preventDefault();
		e.stopPropagation();
		ctx.input.press("b");
	});
	ctx.ui.appendChild(box);
	if (els[cur]) keepInView(box, els[cur]);
	return () => box.remove();
};

// ───────────────── メインメニュー ─────────────────

/** 足元に何があるか（メインメニューの「足元」の横に出す一言）。 */
const footHint = (run: Run): string | undefined => {
	const p = run.p;
	if (run.onStairs()) return "階段";
	if (run.itemAt(p.x, p.y)) return "道具";
	if (run.f.traps.some((t) => t.found && t.x === p.x && t.y === p.y))
		return "罠";
	return undefined;
};

const confirmSuspend = async (ctx: Ctx): Promise<boolean> =>
	(await listWindow(
		ctx,
		"中断して　タイトルへ？",
		[
			{
				label: "はい",
				desc: "ここまでを　記録する。つづきから　再開できる",
				value: "yes",
			},
			{ label: "いいえ", value: "no" },
		],
		{ cls: "main-menu" },
	)) === "yes";

/** B ボタン／☰ のメニュー。 */
export const openMainMenu = async (ctx: Ctx, run: Run): Promise<MenuAction> => {
	let start = 0;
	for (;;) {
		const rows: ListItem[] = [
			{
				label: "もちもの",
				sub: `${run.p.items.length}/${INVENTORY_MAX}`,
				value: "items",
			},
			{ label: "足元", sub: footHint(run), value: "foot" },
			{ label: "山札", sub: `この階 のこり${run.cardsLeft()}`, value: "deck" },
			{ label: "つよさ", sub: `Lv${run.p.lv}`, value: "status" },
			{ label: "ログ", value: "log" },
			{ label: "地図", value: "map" },
			{ label: "せってい", value: "settings" },
			{ label: "中断する", value: "suspend" },
		];
		const v = await listWindow(ctx, "", rows, { cls: "main-menu", start });
		if (v === null) return NONE;
		start = Math.max(
			0,
			rows.findIndex((r) => r.value === v),
		);
		let a: MenuAction = NONE;
		switch (v) {
			case "items":
				a = await openInventory(ctx, run);
				break;
			case "foot":
				a = await openFootMenu(ctx, run);
				break;
			case "deck":
				await openDeck(ctx, run);
				break;
			case "status":
				await openStatus(ctx, run);
				break;
			case "log":
				await openLog(ctx, run);
				break;
			case "map":
				return { kind: "map" };
			case "settings":
				return { kind: "settings" };
			case "suspend":
				if (await confirmSuspend(ctx)) return { kind: "suspend" };
				break;
		}
		if (a.kind !== "none") return a;
	}
};

// ───────────────── もちもの ─────────────────

/** 「使う」の言いかた（カテゴリごと）。 */
const USE_VERB: Record<ItemCat, string> = {
	weapon: "装備する",
	shield: "装備する",
	ring: "装備する",
	herb: "飲む",
	scroll: "読む",
	staff: "振る",
	arrow: "撃つ",
	food: "食べる",
	goal: "",
};

/** 道具を選んだあとの小さいメニューの行。 */
const actionRows = (run: Run, it: Item): ListItem[] => {
	const cat = defOf(it.kind).cat;
	if (cat === "goal") return [{ label: "せつめい", value: "info" }];
	const rows: ListItem[] = [];
	if (cat === "weapon" || cat === "shield" || cat === "ring")
		rows.push(
			run.isEquipped(it)
				? { label: "外す", value: "unequip" }
				: { label: "装備する", value: "equip" },
		);
	else if (cat !== "arrow") rows.push({ label: USE_VERB[cat], value: "use" });
	rows.push({ label: cat === "arrow" ? "撃つ" : "投げる", value: "throw" });
	const p = run.p;
	const under = run.itemAt(p.x, p.y);
	// 置けない所では先に知らせる（選んでから「置けない」と言われるより親切）
	const onWard = run.f.wards.includes(run.p.y * run.f.layout.w + run.p.x);
	const blocked = under
		? "足元に　ものが　ある"
		: run.onStairs()
			? "階段の　上には　置けない"
			: onWard
				? "結界の　上には　置けない"
				: "";
	rows.push({
		label: "置く",
		value: "drop",
		disabled: !!blocked,
		desc: blocked || undefined,
	});
	if (under) rows.push({ label: "足元と交換", value: "swap" });
	// 名前をつける：文字を打たずに、候補（山札にある まだ正体のわからない種類）から選ぶ
	if (isUnidentifiedCat(it.kind) && !isKnownKind(run.s, it.kind))
		rows.push({ label: "名前をつける", value: "name" });
	rows.push({ label: "せつめい", value: "info" });
	return rows;
};

/** 未識別の種類に名前をつける（候補から選ぶ）。キャンセルなら null。 */
const pickName = async (
	ctx: Ctx,
	run: Run,
	kind: string,
): Promise<MenuAction | null> => {
	const cat = defOf(kind).cat;
	const cands = DECK.filter(
		(e) => defOf(e.kind).cat === cat && !isKnownKind(run.s, e.kind),
	);
	const named = run.s.ids.named[kind];
	const rows: ListItem[] = cands.map((e) => {
		const d = defOf(e.kind);
		return {
			label: esc(d.name),
			sub: `全${e.count}枚`,
			desc: esc(d.desc),
			value: e.kind,
		};
	});
	rows.push({
		label: "名前を　消す",
		value: "",
		disabled: !named,
	});
	const cur = named ? cands.findIndex((e) => defOf(e.kind).name === named) : 0;
	const v = await listWindow(ctx, "なんと　よぶ？", rows, {
		start: Math.max(0, cur),
	});
	if (v === null) return null;
	return command({ c: "name", kind, text: v ? defOf(v).name : "" });
};

/** 道具を選んだあとの小さいメニュー。閉じたら none（もちもの一覧へもどる）。 */
const itemActions = async (
	ctx: Ctx,
	run: Run,
	it: Item,
	backdrop: () => () => void,
): Promise<MenuAction> => {
	let start = 0;
	for (;;) {
		const rows = actionRows(run, it);
		const hide = backdrop();
		const v = await listWindow(ctx, esc(run.name(it)), rows, {
			cls: "sub-menu",
			start,
		});
		hide();
		if (v === null) return NONE;
		start = Math.max(
			0,
			rows.findIndex((r) => r.value === v),
		);
		switch (v) {
			case "equip":
				return command({ c: "equip", item: it.uid });
			case "unequip":
				return command({ c: "unequip", item: it.uid });
			case "use": {
				// 相手を選ぶ巻物（鑑定・充填・糧変え）。聞かれること自体で種類がしぼれるのはトルネコと同じ
				const need = needsTarget(it);
				if (!need) return command({ c: "use", item: it.uid });
				// 正体のわからないうちは、どの巻物でも同じ一覧（杖だけ出すと 充填だと ばれるので）。
				// 杖でない物に 充填を使えば、読んだうえで何も起きない
				const staffOnly = need === "staff" && isKnownKind(run.s, it.kind);
				const target = await pickItem(
					ctx,
					run,
					"どれに　つかう？",
					(x) =>
						x.uid !== it.uid &&
						!isKeyItem(x.kind) &&
						(!staffOnly || defOf(x.kind).cat === "staff"),
				);
				// キャンセルなら読まずに もどる（巻物は減らない）
				if (target !== null) return command({ c: "use", item: it.uid, target });
				break;
			}
			case "throw":
				return command({ c: "throw", item: it.uid });
			case "drop":
				return command({ c: "drop", item: it.uid });
			case "swap":
				return command({ c: "swap", item: it.uid });
			case "name": {
				const a = await pickName(ctx, run, it.kind);
				if (a) return a;
				break;
			}
			case "info":
				await infoWindow(ctx, esc(run.name(it)), itemInfo(run, it));
				break;
		}
	}
};

/** もちもの。 */
export const openInventory = async (
	ctx: Ctx,
	run: Run,
): Promise<MenuAction> => {
	let start = 0;
	for (;;) {
		const items = run.p.items;
		const title = `もちもの　${items.length}/${INVENTORY_MAX}`;
		const rows = items.length
			? items.map((it) => itemRow(run, it))
			: [emptyRow("何も　持っていない")];
		const v = await listWindow(ctx, title, rows, { start });
		if (v === null || v === "") return NONE;
		const idx = rows.findIndex((r) => r.value === v);
		start = Math.max(0, idx);
		const it = run.findItem(Number(v));
		if (!it) continue;
		const a = await itemActions(ctx, run, it, () =>
			ghostList(ctx, title, rows, idx),
		);
		if (a.kind !== "none") return a;
	}
};

/** 持ち物から1つ選ぶ。選んだ道具の uid、キャンセルなら null。title は文字（HTML ではない）。 */
export const pickItem = async (
	ctx: Ctx,
	run: Run,
	title: string,
	filter: (it: Item) => boolean,
): Promise<number | null> => {
	const list = run.p.items.filter(filter);
	const rows = list.length
		? list.map((it) => itemRow(run, it))
		: [emptyRow("えらべる　ものが　ない")];
	const v = await listWindow(ctx, esc(title), rows);
	if (v === null || v === "") return null;
	return Number(v);
};

// ───────────────── 足元 ─────────────────

/** 罠の一言（足元の罠を選んだとき）。 */
const TRAP_DESC: Record<TrapKind, string> = {
	bear: "足を　はさまれて　しばらく　動けない",
	acid: "盾が　錆びて　弱くなる",
	sleep: "眠ってしまう",
	trip: "転んで　持ち物を　1つ　落とす",
	mine: "爆発して　HPが　半分になる。まわりの　道具も　燃える",
	arrow: "矢が　飛んでくる",
	dart: "毒矢が　飛んでくる。ちからが　下がる",
	warp: "この階の　どこかへ　飛ばされる",
	pit: "下の階へ　落ちる",
};

/** 拾えるか（持ち物の枠。矢は同じ種類の束にまとまるので、いっぱいでも拾える）。 */
const canPickUp = (run: Run, it: Item): boolean =>
	run.p.items.length < INVENTORY_MAX ||
	(defOf(it.kind).cat === "arrow" &&
		run.p.items.some((i) => i.kind === it.kind));

/** 足元のメニュー（足元ボタン・自分のマスのタップ）。 */
export const openFootMenu = async (ctx: Ctx, run: Run): Promise<MenuAction> => {
	let start = 0;
	for (;;) {
		const p = run.p;
		const s = run.s;
		const fi = run.itemAt(p.x, p.y);
		const trap = run.f.traps.find((t) => t.found && t.x === p.x && t.y === p.y);
		const stairs = run.onStairs();
		const rows: ListItem[] = [];
		if (fi) {
			// 床の道具は、持ち物に入れてからでないと使えない（core がそうしている）
			const ok = canPickUp(run, fi.item);
			rows.push({
				label: "ひろう",
				desc: ok ? itemDesc(run, fi.item) : "持ち物が　いっぱい",
				value: "pickup",
				disabled: !ok,
			});
			rows.push({
				label: "持ち物と　交換",
				value: "swap",
				disabled: !p.items.some((x) => !isKeyItem(x.kind)),
			});
			rows.push({ label: "せつめい", value: "info" });
		}
		if (stairs) {
			const deepest = !s.returning && s.depth >= LAST_DEPTH;
			rows.push({
				label: s.returning ? "上る" : "降りる",
				desc: s.returning
					? s.depth <= 1
						? "地上へ　もどる"
						: `${s.depth - 1}階へ`
					: deepest
						? "これより　下へは　行けない"
						: `${s.depth + 1}階へ`,
				value: "stairs",
				disabled: deepest,
			});
		}
		if (trap)
			rows.push({
				label: esc(trapName(trap)),
				desc: TRAP_DESC[trap.kind],
				value: "trap",
			});
		if (!rows.length) {
			await infoWindow(ctx, "足元", "<p>足元には　何もない</p>");
			return NONE;
		}
		const title = fi ? esc(run.name(fi.item)) : stairs ? "階段" : "足元";
		const v = await listWindow(ctx, title, rows, { start });
		if (v === null) return NONE;
		start = Math.max(
			0,
			rows.findIndex((r) => r.value === v),
		);
		switch (v) {
			case "pickup":
				return command({ c: "pickup" });
			case "stairs":
				return command({ c: "stairs" });
			case "swap": {
				const uid = await pickItem(
					ctx,
					run,
					"どれと　交換する？",
					(x) => !isKeyItem(x.kind),
				);
				if (uid !== null) return command({ c: "swap", item: uid });
				break;
			}
			case "info":
				if (fi)
					await infoWindow(ctx, esc(run.name(fi.item)), itemInfo(run, fi.item));
				break;
			case "trap":
				if (trap)
					await infoWindow(
						ctx,
						esc(trapName(trap)),
						`<p>${TRAP_DESC[trap.kind]}</p>`,
					);
				break;
		}
	}
};

// ───────────────── ログ ─────────────────

/** これまでのメッセージ（新しいものが下。開いたときは いちばん下を見せる）。 */
export const openLog = async (ctx: Ctx, run: Run): Promise<void> => {
	const lines = run.s.log.slice(-120);
	const html = lines.length
		? lines.map((l) => `<p class="log-row">${esc(l)}</p>`).join("")
		: '<p class="dim">まだ　何も　ない</p>';
	const shown = infoWindow(ctx, "ログ", html, { cls: "log-view" });
	// infoWindow は呼んだ時点で窓を置いているので、ここで いちばん下まで巻き取れる
	const boxes = ctx.ui.querySelectorAll<HTMLElement>(".menu.log-view");
	const box = boxes[boxes.length - 1];
	if (box) box.scrollTop = box.scrollHeight;
	await shown;
};
