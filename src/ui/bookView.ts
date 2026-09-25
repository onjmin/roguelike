// モンスター図鑑。会ったことのある敵の とくちょう・出る階・強さ・種族を見られる。
// 冒険をまたいで残るのは知識だけ（レベルや道具は持ちこせない）。対策を考える手がかりにする。

import { MONSTER_LIST } from "../core/data/monsters";
import type { MonsterDef, MonsterTag } from "../core/types";
import { loadBook } from "../engine/save";
import type { Ctx } from "./ctx";
import { esc } from "./itemText";
import { infoWindow, listWindow } from "./list";

const TAG_NAME: Record<MonsterTag, string> = {
	undead: "アンデッド",
	dragon: "竜",
	plant: "植物",
	doll: "人形",
	metal: "メタル",
};

const floors = (d: MonsterDef): string =>
	d.floors[0] === d.floors[1]
		? `B${d.floors[0]}`
		: `B${d.floors[0]}〜B${d.floors[1]}`;

const detail = (d: MonsterDef, kills: number): string => {
	const tags = (d.tags ?? [])
		.map((t) => `<b class="tag">${TAG_NAME[t]}</b>`)
		.join("");
	return [
		`<p>${tags}${esc(d.desc)}</p>`,
		"<table>",
		`<tr><td>出る階</td><td class="num">${floors(d)}</td></tr>`,
		`<tr><td>HP</td><td class="num">${d.hp}</td></tr>`,
		`<tr><td>攻撃</td><td class="num">${d.atk}</td></tr>`,
		`<tr><td>守り</td><td class="num">${d.def}</td></tr>`,
		`<tr><td>経験値</td><td class="num">${d.exp}</td></tr>`,
		`<tr><td>たおした数</td><td class="num">${kills}</td></tr>`,
		"</table>",
	].join("");
};

/** 図鑑を開く（閉じるまで）。 */
export const openBook = async (ctx: Ctx): Promise<void> => {
	let start = 0;
	for (;;) {
		const book = loadBook();
		const seen = new Set(book.seen);
		const rows = MONSTER_LIST.map((d) =>
			seen.has(d.id)
				? {
						label: esc(d.name),
						sub: floors(d),
						desc: esc(d.desc),
						value: d.id,
					}
				: {
						label: "？？？",
						sub: floors(d),
						desc: "まだ　会ったことが　ない",
						value: d.id,
						disabled: true,
					},
		);
		const v = await listWindow(
			ctx,
			`モンスター図鑑　${seen.size}/${MONSTER_LIST.length}`,
			rows,
			{ start },
		);
		if (v === null) return;
		start = Math.max(
			0,
			rows.findIndex((r) => r.value === v),
		);
		const d = MONSTER_LIST.find((m) => m.id === v);
		if (d) await infoWindow(ctx, esc(d.name), detail(d, book.kills[d.id] ?? 0));
	}
};
