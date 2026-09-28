// モンスター図鑑。会ったことのある敵の とくちょう・出る階・強さ・種族を見られる。
// 冒険をまたいで残るのは知識だけ（レベルや道具は持ちこせない）。対策を考える手がかりにする。

import { dungeonById } from "../core/data/dungeons";
import { MONSTER_LIST } from "../core/data/monsters";
import type { MonsterDef, MonsterTag } from "../core/types";
import { DUNGEON_NAMES } from "../data/story";
import { loadBook } from "../engine/save";
import type { Ctx } from "./ctx";
import { explain } from "./explain";
import { floorShort } from "./floorName";
import { esc } from "./itemText";
import { listWindow } from "./list";

const TAG_NAME: Record<MonsterTag, string> = {
	undead: "アンデッド",
	dragon: "竜",
	plant: "植物",
	doll: "人形",
	metal: "メタル",
};

/**
 * 出る階。ボスは その板の いちばん奥の 1つの 階（上りの 板は「20F」。floors は 強さなので 使わない）。
 * ほかは floors（板だけの 敵は その板の 名前を 添える）。
 */
export const floorsText = (d: MonsterDef): string =>
	d.boss && d.board
		? `${floorShort(d.board, dungeonById(d.board).floors)}（${DUNGEON_NAMES[d.board].name}の　ボス）`
		: (d.floors[0] === d.floors[1]
				? `B${d.floors[0]}`
				: `B${d.floors[0]}〜B${d.floors[1]}`) +
			(d.board ? `（${DUNGEON_NAMES[d.board].name}だけ）` : "");

/** 「せつめい」の文（メッセージ窓に 1ページずつ）。とくちょう → ひとこと → 強さ → たおした数。 */
const detail = (d: MonsterDef, kills: number): string[] => {
	const tags = (d.tags ?? []).map((t) => `【${TAG_NAME[t]}】`).join("");
	return [
		`${tags}${d.desc}`,
		d.flavor,
		`出る階　${floorsText(d)}　経験値　${d.exp}\nHP　${d.hp}　攻撃　${d.atk}　守り　${d.def}`,
		kills > 0
			? `これまでに　${kills}匹　たおした`
			: "まだ　1匹も　たおしていない",
	];
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
						sub: floorsText(d),
						desc: esc(d.desc),
						value: d.id,
					}
				: {
						label: "？？？",
						sub: floorsText(d),
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
		if (d) await explain(ctx, detail(d, book.kills[d.id] ?? 0));
	}
};
