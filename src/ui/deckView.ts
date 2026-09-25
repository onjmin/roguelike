// 山札の表（この冒険で出る道具の、中身の決まった束）。
//
// トランプの「デッキリスト」のように、何が何枚あるかは いつでも見られる。
// 見た枚数を数えれば、未識別の名前の正体を しぼれる（値段識別の代わりの「数え識別」。
// たとえば【悲報】を4枚見たなら、全2枚の種類ではない）。
//
// 伏せるもの：
// - どの仮の名前が どの種類か（出したら識別になってしまう）。
// - 未識別の種類ごとの「見た」枚数（種類ごとに数えると、正体がばれる）。
//   代わりに、見た札を「見えている名前」ごとに数えて出す。

import { CAT_NAME } from "../core/data/items";
import { defOf, isKnownKind } from "../core/item";
import type { Run } from "../core/run";
import { type ItemCat, UNIDENTIFIED_CATS } from "../core/types";
import type { Ctx } from "./ctx";
import { esc } from "./itemText";
import { infoWindow } from "./list";

/** 表の並び（目的の品は山札に入らない）。 */
const CATS: readonly ItemCat[] = [
	"weapon",
	"shield",
	"ring",
	"herb",
	"scroll",
	"staff",
	"arrow",
	"food",
];

const deckHtml = (run: Run): string => {
	const s = run.s;
	const deck = run.dungeon.deck;
	const total = deck.reduce((n, e) => n + e.count, 0);
	const dealt = Object.keys(s.cardKind).length;
	// 見た札を種類ごとに。数えるのは配ったときの種類（糧変えで種類が変わっても、札は札）
	const seenBy = new Map<string, number>();
	let seenCards = 0;
	for (const uid of s.seen) {
		const k = s.cardKind[uid];
		if (!k) continue; // 山札の札ではない（分けて飛ばした矢など）
		seenCards++;
		seenBy.set(k, (seenBy.get(k) ?? 0) + 1);
	}

	const out: string[] = [
		`<p>山札　全${total}枚<br>配った　${dealt}　／　見た　${seenCards}<br>流れた　${s.flowed}　／　なくなった　${s.lost.length}<br>この階の　のこり　${run.cardsLeft()}</p>`,
	];
	const rows: string[] = [];
	for (const cat of CATS) {
		const entries = deck.filter((e) => defOf(e.kind).cat === cat);
		if (!entries.length) continue;
		const catTotal = entries.reduce((n, e) => n + e.count, 0);
		rows.push(
			`<tr><th>${esc(CAT_NAME[cat])}</th><th class="num">全${catTotal}</th><th class="num">見た</th></tr>`,
		);
		for (const e of entries) {
			const name = esc(defOf(e.kind).name);
			if (isKnownKind(s, e.kind)) {
				const n = seenBy.get(e.kind) ?? 0;
				// ぜんぶ見た種類は、もう山札に のこっていない
				const cls = n >= e.count ? ' class="gone"' : "";
				rows.push(
					`<tr><td${cls}>${name}</td><td class="num">${e.count}</td><td class="num">${n}</td></tr>`,
				);
			} else {
				// 種類の名前と枚数は公開（デッキリスト）。見た枚数は伏せる
				rows.push(
					`<tr><td class="dim">${name}</td><td class="num">${e.count}</td><td class="num dim">−</td></tr>`,
				);
			}
		}
		if (!UNIDENTIFIED_CATS.includes(cat)) continue;
		// 正体のわからない札を、仮の名前ごとに数える（名前をつけていたら うしろに添える。
		// つけた名前でまとめると、同じ名前をつけた2種類が1行になって 数えられなくなる）
		const groups = new Map<string, number>();
		for (const [k, n] of seenBy) {
			if (defOf(k).cat !== cat || isKnownKind(s, k)) continue;
			const fake = s.ids.fake[k] ?? defOf(k).name;
			const named = s.ids.named[k];
			const shown = named ? `${fake}（${named}？）` : fake;
			groups.set(shown, (groups.get(shown) ?? 0) + n);
		}
		if (!groups.size) continue;
		rows.push(
			'<tr><td class="sub-head" colspan="3">正体の　わからない　札</td></tr>',
		);
		for (const [shown, n] of [...groups].sort((a, b) => b[1] - a[1]))
			rows.push(
				`<tr><td>${esc(shown)}</td><td></td><td class="num">${n}</td></tr>`,
			);
	}
	out.push(`<table>${rows.join("")}</table>`);
	out.push(
		'<p class="hint">山札の　中身は　毎回　同じ。数えれば　正体が　しぼれる</p>',
		'<p class="hint">うすい　名前は　まだ　正体の　わからない　種類。線の　ある　ものは　もう　山札に　のこっていない。流れた＝見ないまま　階を　はなれた　札</p>',
	);
	return out.join("");
};

/** 山札の表。 */
export const openDeck = (ctx: Ctx, run: Run): Promise<void> =>
	infoWindow(ctx, "山札", deckHtml(run), { cls: "deck-view" });
