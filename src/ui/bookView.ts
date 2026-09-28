// モンスター図鑑。会ったことのある敵の とくちょう・出る階・強さ・種族を見られる。
// 冒険をまたいで残るのは知識だけ（レベルや道具は持ちこせない）。対策を考える手がかりにする。
// 一覧の 行の 左に 足踏みする 絵（まだ 会っていない 敵は 黒い 影）、「せつめい」では 窓の 上に 大きく 出す。

import { dungeonById } from "../core/data/dungeons";
import { MONSTER_LIST } from "../core/data/monsters";
import type { MonsterDef, MonsterTag } from "../core/types";
import { DUNGEON_NAMES } from "../data/story";
import { loadBook } from "../engine/save";
import type { Ctx } from "./ctx";
import { el } from "./dom";
import { explain } from "./explain";
import { floorShort } from "./floorName";
import { esc } from "./itemText";
import { listWindow } from "./list";
import { animateArts, monsterArt } from "./monsterArt";

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

/** 一覧の 絵の 大きさ（2倍）。 */
const ROW_PX = 32;
/** 「せつめい」の 絵の 大きさ（3倍。ボスは 階と 同じく scale 倍して 整数倍に まるめる）。 */
const detailPx = (d: MonsterDef): number => 16 * Math.round(3 * (d.scale ?? 1));

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
		const arts = MONSTER_LIST.map((d) =>
			monsterArt(d, { px: ROW_PX, shadow: !seen.has(d.id) }),
		);
		const rows = MONSTER_LIST.map((d, i) =>
			seen.has(d.id)
				? {
						label: esc(d.name),
						sub: floorsText(d),
						desc: esc(d.desc),
						value: d.id,
						icon: arts[i].canvas,
					}
				: {
						label: "？？？",
						sub: floorsText(d),
						desc: "まだ　会ったことが　ない",
						value: d.id,
						disabled: true,
						icon: arts[i].canvas,
					},
		);
		const stopRows = animateArts(arts);
		const v = await listWindow(
			ctx,
			`モンスター図鑑　${seen.size}/${MONSTER_LIST.length}`,
			rows,
			{ start },
		);
		stopRows();
		if (v === null) return;
		start = Math.max(
			0,
			rows.findIndex((r) => r.value === v),
		);
		const d = MONSTER_LIST.find((m) => m.id === v);
		if (!d) continue;
		// 窓の 上に 大きな 絵と 名前（ドラクエの 図鑑のように）
		const art = monsterArt(d, { px: detailPx(d) });
		const card = el("div", { class: "book-card window" }, [
			art.canvas,
			el("div", { class: "book-card-name", text: d.name }),
		]);
		const stop = animateArts([art]);
		await explain(ctx, detail(d, book.kills[d.id] ?? 0), { art: card });
		stop();
	}
};
