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

/**
 * 出かけられる 所（バス停・駅）が 建った ときの ひとこと（知らせの あと、カメラを 向けて）。
 * 調べて はじめて わかるのでは なく、建った ときに 言う。
 */
const DEPART_AT: Readonly<Record<string, string>> = {
	bus: "バス停からも、植民地へ　出かけられる。",
	station: "駅からも、植民地へ　出かけられる。",
};

/** 段 from から to へ 上がる あいだに 建った 出かけられる 所。 */
export const departNews = (
	from: number,
	to: number,
): { at: Cell; text: string }[] =>
	FACILITIES.filter(
		(f) =>
			DEPART_AT[f.id] &&
			f.from > from &&
			f.from <= to &&
			(f.until === undefined || f.until > to),
	).map((f) => ({ at: center(f), text: DEPART_AT[f.id] }));

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

/** 地区の 見出し（はじめの 窓の 1行目）。 */
export const NEWS_HEAD = "{area}に　新しい　建物：";

/** 1つの 地区で 名前を 出す 数（1段で 建つ 数の いちばん 多い 段に 合わせる。段を とばした ときに 窓が 続きすぎない）。あふれた 分は NEWS_MORE。 */
export const NEWS_MAX = 20;
export const NEWS_MORE = "……ほかにも　{n}軒。";

/** 知らせの 窓（1つずつ カメラを 向ける 所と 文）。地区ごとに 見出し＋名前、あとは 名前 2つずつ。 */
export const newsPages = (
	news: readonly TownNews[],
): { at: Cell; text: string }[] => {
	const out: { at: Cell; text: string }[] = [];
	for (const area of AREA_ORDER) {
		const here = news.filter((n) => n.area === area);
		if (!here.length) continue;
		const shown = here.slice(0, NEWS_MAX);
		const lines = [NEWS_HEAD.replace("{area}", area), ...shown.map(newsLine)];
		const ats = [shown[0].at, ...shown.map((n) => n.at)];
		const more = here.length - shown.length;
		if (more > 0) {
			lines.push(NEWS_MORE.replace("{n}", String(more)));
			ats.push(shown[shown.length - 1].at);
		}
		for (let i = 0; i < lines.length; i += 2)
			out.push({ at: ats[i], text: lines.slice(i, i + 2).join("\n") });
	}
	return out;
};
