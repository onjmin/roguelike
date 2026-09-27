// 道具の文（一覧の名前・2行目の説明・「せつめい」の文）。もちもの・足元・選ぶ窓で共用。
//
// 前作で「名前だけでは効果がわからない」と言われたので、どの行にも2行目の説明を出す。
// ただし未識別の種類は正体の説明を出さない（出したら識別になってしまう）。
// 名前にはプレイヤーのつけた名前も入るので、HTML に入れる文字はぜんぶ逃がす。

import { CAT_NAME } from "../core/data/items";
import {
	defOf,
	isKnownKind,
	isUnidentifiedCat,
	itemHidden,
	itemTableOf,
} from "../core/item";
import type { Run } from "../core/run";
import type { Item, ItemCat } from "../core/types";

/** HTML に入れる文字を逃がす。 */
export const esc = (s: string): string =>
	s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

/** 見えない 道具（ガチャスレ）の 説明。 */
const HIDDEN_DESC =
	"何かが　ある　手ざわり。見透し草を　飲んだ　階でだけ　見えて　読める";

/** 一覧の2行目（HTML）。頭にカテゴリの札、うしろに装備中・のろいの札。 */
export const itemDesc = (run: Run, it: Item): string => {
	const d = defOf(it.kind);
	const known = isKnownKind(run.s, it.kind);
	// 装備中・のろいの札は先に出す（2行で切るとき、うしろにあると消えてしまう）
	let h = `<b class="tag">${esc(CAT_NAME[d.cat])}</b>`;
	if (run.isEquipped(it)) h += '<b class="tag equip">装備中</b>';
	if (it.known && it.cursed) h += '<b class="tag curse">のろい</b>';
	if (itemHidden(run.s, it.kind)) return h + esc(HIDDEN_DESC);
	return h + esc(known ? d.desc : "まだ　正体が　わからない");
};

/** 武器・盾で、修正値と のろいが まだ わからない（装備するか 鑑定スレで わかる）。 */
const plusUnknown = (it: Item): boolean => {
	const c = defOf(it.kind).cat;
	return (c === "weapon" || c === "shield") && !it.known;
};

/**
 * 一覧の名前（HTML）。装備中なら頭に E。
 * 修正値の わからない 武器・盾は 名前を黄色に（トルネコ1と同じ。装備するか 鑑定すると 白に もどり、+1 などが つく）。
 * 名前を つけた 未識別の 道具は 水色に（仮の 名前と 見わける。正体が わかると 白に もどる）。
 */
export const itemLabel = (run: Run, it: Item): string => {
	const name = esc(run.name(it));
	const cls = plusUnknown(it)
		? "unk"
		: isNamedKind(run, it.kind)
			? "named"
			: "";
	return `${run.isEquipped(it) ? '<b class="tag equip">E</b>' : ""}${cls ? `<span class="${cls}">${name}</span>` : name}`;
};

/** 名前を つけた まま、まだ 正体の わからない 種類。 */
const isNamedKind = (run: Run, kind: string): boolean =>
	!!run.s.ids.named[kind] && !isKnownKind(run.s, kind);

/**
 * 武器・盾の 強さ。修正値が わかっていれば 入れた値（つよさの窓と 同じ。0 より 下には しない）、
 * わからなければ 素の 強さ（unknown が true）。
 */
export const gearPower = (
	it: Item,
): { value: number; unknown: boolean } | null => {
	const d = defOf(it.kind);
	const base =
		d.cat === "weapon" ? d.atk : d.cat === "shield" ? d.def : undefined;
	if (base === undefined) return null;
	if (plusUnknown(it)) return { value: base, unknown: true };
	return { value: Math.max(0, base + it.plus), unknown: false };
};

/** 一覧の右に出す小さい数（武器・盾の強さ。修正値が わかれば 入れた値、わからなければ 素の値に ？）。 */
export const itemSub = (it: Item): string | undefined => {
	const g = gearPower(it);
	return g ? `強さ${g.value}${g.unknown ? "？" : ""}` : undefined;
};

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

/** 正体のわかりかた（未識別のとき「せつめい」に出す）。 */
const HOW_TO_ID: Partial<Record<ItemCat, string>> = {
	herb: "飲むか　有識者スレで　わかる",
	scroll: "読むか　有識者スレで　わかる",
	staff: "振って　効き目が　見えるか、有識者スレで　わかる",
	ring: "装備して　わかる　ものも　ある。有識者スレなら　かならず　わかる",
};

/** 候補の名前を 1ページに いくつまで 並べるか（スマホの 縦持ちでも メッセージ窓の 3行に 収まるように）。 */
const CANDS_PER_PAGE = 10;

/**
 * 「せつめい」の文。メッセージ窓に 1ページずつ 送って 出す（トルネコ1と同じ。一度に 全部 並べない）。
 * 説明 → ひとこと → 強さなどの 数字 → 注意 → 候補 の 順。
 */
export const itemInfo = (run: Run, it: Item): string[] => {
	const s = run.s;
	const d = defOf(it.kind);
	const known = isKnownKind(s, it.kind);
	if (itemHidden(s, it.kind)) return [`【${CAT_NAME[d.cat]}】${HIDDEN_DESC}`];
	const pages: string[] = [
		known
			? `【${CAT_NAME[d.cat]}】${d.desc}`
			: `【${CAT_NAME[d.cat]}】まだ　正体が　わからない。${HOW_TO_ID[d.cat] ?? ""}`,
	];
	// ひとこと（正体が わかっている ときだけ。未識別で 出すと 識別に なってしまう）
	if (known) pages.push(d.flavor);
	const rows: string[] = [];
	const g = gearPower(it);
	if (g) {
		// 修正値が わかれば 入れた 強さ（素の 強さは かっこで）
		const base = (d.cat === "weapon" ? d.atk : d.def) ?? 0;
		rows.push(
			`強さ　${
				g.unknown || it.plus === 0
					? `${g.value}`
					: `${g.value}（${base}${signed(it.plus)}）`
			}　修正値　${it.known ? signed(it.plus) : "？"}`,
		);
	}
	if (d.cat === "arrow") rows.push(`強さ　${d.atk ?? 0}　${it.count}本`);
	if (d.cat === "staff")
		rows.push(`残り回数　${it.known && known ? `${it.charges}回` : "？"}`);
	if (d.cat === "weapon" || d.cat === "shield" || d.cat === "ring") {
		// のろわれた品は装備した時点で知らされる（known になる）ので、
		// 装備していて known でないなら のろわれていない
		const curseKnown = it.known || run.isEquipped(it);
		rows.push(
			`のろい　${!curseKnown ? "？" : it.cursed ? "のろわれている" : "なし"}`,
		);
	}
	if (run.isEquipped(it)) rows.push("いま　装備中");
	if (rows.length) pages.push(rows.join("\n"));
	if (plusUnknown(it))
		pages.push(
			"修正値と　のろいは、装備するか　有識者スレで　わかる（−1なら　のろわれていて　外せない）",
		);
	if (d.cat === "goal") {
		pages.push("投げたり　置いたり　できない");
	} else if (isUnidentifiedCat(it.kind) && !known) {
		// 候補（このダンジョンで出る、まだ正体のわからない 同じカテゴリの種類）
		const cands = itemTableOf(s)
			.filter((e) => defOf(e.kind).cat === d.cat && !isKnownKind(s, e.kind))
			.map((e) => defOf(e.kind).name);
		for (let i = 0; i < cands.length; i += CANDS_PER_PAGE)
			pages.push(
				`${i === 0 ? "この　どれか" : "……または"}\n${cands.slice(i, i + CANDS_PER_PAGE).join("・")}`,
			);
	}
	return pages;
};
