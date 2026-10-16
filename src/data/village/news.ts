// 町が 育ったときの「町の お知らせ」（ui/village/villageReturn.ts の stageUp）。町の まんなか（店・小屋・倉庫・本館）は
// 仲間の ひとことで 知らせるが、新市街・浜・町の まわりに 建った 物は だまって 増えていた（作者の 指示：通知不足）。
// 段が 上がった あいだに 建った・建てかわった 建物を 地区ごとに 並べ、カメラで 1つずつ 見せる。DOM も 保存も 使わない。

import { BOOKSTORE_FROM, LIBRARY_FROM } from "../story/glossary";
import { FACILITIES, type Facility, facilityBlock } from "./facilities";
import {
	BATH_FROM,
	CAFE_FROM,
	type Cell,
	MUSIC_FROM,
	SHRINE_FROM,
} from "./map";

export type TownNews = {
	name: string;
	/** カメラを 向ける 所（建物の まんなか）。 */
	at: Cell;
	/** 地区（新市街・浜・町の まわり）。 */
	area: string;
	/** 建てかわる 前の 名前（交番 → 警察署 など）。 */
	was?: string;
};

/** 知らせない 物（車・自販機・ポスト・時計・電話ボックス・家・豆腐ハウス・芋煮の かまど など 小さな 物）。 */
const QUIET =
	/^(car_|vend_|post|phone|clock|house_|saba|imoni|pier|bochi|taxi)/;

/** 町の まわりの 建物（facilities.ts に のっていない、map.ts が 建てる 物）。 */
const AROUND: readonly {
	name: string;
	from: number;
	at: Cell;
	was?: string;
}[] = [
	{ name: "おんJ神社", from: SHRINE_FROM, at: [3, 8] },
	{ name: "音楽室「ピアノ機能」", from: MUSIC_FROM, at: [22, 26] },
	{ name: "本屋", from: BOOKSTORE_FROM, at: [4, 21] },
	{ name: "銭湯", from: BATH_FROM, at: [35, 26] },
	{ name: "喫茶「おんJ」", from: CAFE_FROM, at: [4, 16] },
	{ name: "図書館", from: LIBRARY_FROM, at: [4, 21], was: "本屋" },
];

const areaOf = ([x, y]: Cell): string =>
	x >= 40 ? (y >= 41 ? "港" : "新市街") : y >= 30 ? "浜" : "町の　まわり";

const center = (f: Facility): Cell => {
	const rows = facilityBlock(f);
	const w = Math.max(...rows.map((r) => [...r].length));
	return [f.at[0] + (w - 1) / 2, f.at[1] + (rows.length - 1) / 2];
};

/** 2つの 施設の 外観が 重なるか（建てかえ）。 */
const overlaps = (a: Facility, b: Facility): boolean => {
	const box = (f: Facility) => {
		const rows = facilityBlock(f);
		const w = Math.max(...rows.map((r) => [...r].length));
		return [f.at[0], f.at[1], f.at[0] + w - 1, f.at[1] + rows.length - 1];
	};
	const [ax0, ay0, ax1, ay1] = box(a);
	const [bx0, by0, bx1, by1] = box(b);
	return ax0 <= bx1 && bx0 <= ax1 && ay0 <= by1 && by0 <= ay1;
};

/** 地区の 並び（カメラが 行ったり 来たり しない 順）。 */
const AREA_ORDER = ["町の　まわり", "浜", "新市街", "港"];

/**
 * 段 from から to へ 上がる あいだに 建った・建てかわった 建物（地区の 順、地区の 中は 上から・左から）。
 * 前の 段で 建って 段 to までに なくなる 物は 出さない。
 */
export const townNews = (from: number, to: number): TownNews[] => {
	const out: TownNews[] = [];
	const built = (s: number, until?: number) =>
		s > from && s <= to && (until === undefined || until > to);
	for (const f of FACILITIES) {
		if (QUIET.test(f.id) || !built(f.from, f.until)) continue;
		// 建てかえ：同じ 所に あった 施設が この 段で なくなった（まえの 段で もう 建っていた ときだけ）
		const old = FACILITIES.find(
			(o) =>
				o !== f &&
				o.until === f.from &&
				o.from <= from &&
				!o.id.startsWith("house_") &&
				overlaps(o, f),
		);
		const at = center(f);
		out.push({ name: f.name, at, area: areaOf(at), was: old?.name });
	}
	for (const a of AROUND) {
		const later = AROUND.find((b) => b.was === a.name);
		if (!built(a.from, later?.from)) continue;
		// 前の 建物が まだ 無かった（段を とばした）ときは 建てかえでは なく 新しく 建った
		const prev = AROUND.find((b) => b.name === a.was);
		out.push({
			name: a.name,
			at: a.at,
			area: areaOf(a.at),
			was: prev && prev.from <= from ? prev.name : undefined,
		});
	}
	const rank = (n: TownNews) => AREA_ORDER.indexOf(n.area);
	return out.sort(
		(a, b) => rank(a) - rank(b) || a.at[1] - b.at[1] || a.at[0] - b.at[0],
	);
};

/** 一覧の 1行（建てかえは「前　→　あと」）。 */
export const newsLine = (n: TownNews): string =>
	n.was ? `・${n.was}　→　${n.name}` : `・${n.name}`;
