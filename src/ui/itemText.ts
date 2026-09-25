// 道具の文（一覧の名前・2行目の説明・「せつめい」の窓）。もちもの・足元・選ぶ窓で共用。
//
// 前作で「名前だけでは効果がわからない」と言われたので、どの行にも2行目の説明を出す。
// ただし未識別の種類は正体の説明を出さない（出したら識別になってしまう）。
// 名前にはプレイヤーのつけた名前も入るので、HTML に入れる文字はぜんぶ逃がす。

import { CAT_NAME, DECK } from "../core/data/items";
import { defOf, isKnownKind, isUnidentifiedCat } from "../core/item";
import type { Run } from "../core/run";
import type { Item, ItemCat } from "../core/types";

/** HTML に入れる文字を逃がす。 */
export const esc = (s: string): string =>
	s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

/** 一覧の2行目（HTML）。頭にカテゴリの札、うしろに装備中・のろいの札。 */
export const itemDesc = (run: Run, it: Item): string => {
	const d = defOf(it.kind);
	const known = isKnownKind(run.s, it.kind);
	// 装備中・のろいの札は先に出す（2行で切るとき、うしろにあると消えてしまう）
	let h = `<b class="tag">${esc(CAT_NAME[d.cat])}</b>`;
	if (run.isEquipped(it)) h += '<b class="tag equip">装備中</b>';
	if (it.known && it.cursed) h += '<b class="tag curse">のろい</b>';
	return h + esc(known ? d.desc : "まだ　正体が　わからない");
};

/** 一覧の名前（HTML）。装備中なら頭に E。 */
export const itemLabel = (run: Run, it: Item): string =>
	`${run.isEquipped(it) ? '<b class="tag equip">E</b>' : ""}${esc(run.name(it))}`;

/** 一覧の右に出す小さい数（武器・盾の素の強さ。修正値は名前の +1 のほうに出る）。 */
export const itemSub = (it: Item): string | undefined => {
	const d = defOf(it.kind);
	if (d.cat === "weapon") return `強さ${d.atk ?? 0}`;
	if (d.cat === "shield") return `強さ${d.def ?? 0}`;
	return undefined;
};

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

/** 正体のわかりかた（未識別のとき「せつめい」に出す）。 */
const HOW_TO_ID: Partial<Record<ItemCat, string>> = {
	herb: "飲むか　鑑定スレで　わかる",
	scroll: "読むか　鑑定スレで　わかる",
	staff: "振って　効き目が　見えるか、鑑定スレで　わかる",
	ring: "装備して　わかる　ものも　ある。鑑定スレなら　かならず　わかる",
};

const row = (k: string, v: string): string =>
	`<tr><td class="dim">${k}</td><td class="num">${v}</td></tr>`;

/** 「せつめい」の窓の本文（HTML）。 */
export const itemInfo = (run: Run, it: Item): string => {
	const s = run.s;
	const d = defOf(it.kind);
	const known = isKnownKind(s, it.kind);
	const out: string[] = [
		`<p><b class="tag">${esc(CAT_NAME[d.cat])}</b>${esc(known ? d.desc : `まだ　正体が　わからない。${HOW_TO_ID[d.cat] ?? ""}`)}</p>`,
	];
	const rows: string[] = [];
	if (d.cat === "weapon" || d.cat === "shield") {
		rows.push(row("強さ", String((d.cat === "weapon" ? d.atk : d.def) ?? 0)));
		rows.push(row("修正値", it.known ? signed(it.plus) : "？"));
	}
	if (d.cat === "arrow") {
		rows.push(row("強さ", String(d.atk ?? 0)));
		rows.push(row("本数", `${it.count}本`));
	}
	if (d.cat === "staff")
		rows.push(row("残り回数", it.known && known ? `${it.charges}回` : "？"));
	if (d.cat === "weapon" || d.cat === "shield" || d.cat === "ring") {
		// のろわれた品は装備した時点で知らされる（known になる）ので、
		// 装備していて known でないなら のろわれていない
		const curseKnown = it.known || run.isEquipped(it);
		rows.push(
			row(
				"のろい",
				!curseKnown
					? "？"
					: it.cursed
						? '<b class="tag curse">のろわれている</b>'
						: "なし",
			),
		);
	}
	if (run.isEquipped(it)) rows.push(row("いま", "装備中"));
	if (rows.length) out.push(`<table>${rows.join("")}</table>`);
	if (d.cat === "goal") {
		out.push('<p class="hint">投げたり　置いたり　できない</p>');
	} else if (isUnidentifiedCat(it.kind) && !known) {
		// 候補（まだ正体のわからない、同じカテゴリの種類）と山札の枚数。数えて しぼるための材料
		const cands = DECK.filter(
			(e) => defOf(e.kind).cat === d.cat && !isKnownKind(s, e.kind),
		);
		out.push(
			'<p class="dim">この　どれか</p>',
			`<table>${cands.map((e) => row(esc(defOf(e.kind).name), `全${e.count}枚`)).join("")}</table>`,
		);
	} else {
		const e = DECK.find((x) => x.kind === it.kind);
		if (e) out.push(`<p class="hint">山札に　全${e.count}枚</p>`);
	}
	return out.join("");
};
