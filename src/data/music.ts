// 場面ごとの 曲（名前は data/bgm.ts）。階の 曲は data/story.ts の BOARD_LOOKS、ここは それ以外。
//
// ■ 村の 曲
// 保守村の 曲は 村の 育ちで かわる（段は data/town.ts の STAGE_NAMES）。建物の 中も 村の 曲の まま。
// 広場の 蓄音機で 好きな 曲に かえられる（えらんだ 曲は 設定 settings.villageBgm。端末ごと）。
// かけられるのは 村の 曲と、持ち帰った 板で 聞いた 曲（その 板の 階の 曲。ボス・祭り・持ち帰りの 曲も）。

import { DUNGEON_IDS, DUNGEONS } from "../core/data/dungeons";
import type { DungeonId } from "../core/types";
import { BOARD_LOOKS, DUNGEON_NAMES } from "./story";
import { STAGE_NAMES } from "./town";

/** 祭り（モンスターハウス）の曲。名無し155さんの アップテンポな曲（オクターブを直した版）。 */
export const HOUSE_BGM = "retro2";
/** ボスの 曲（見つけてから たおすまで）。名無し155さんの 曲（もとは 電池板で 鳴らしていた 戦闘曲っぽい 方）。 */
export const BOSS_BGM = "retro";
/** 持ち帰る 帰り道の 曲（原盤を 持ち帰る 曲。タイトルと 同じ）。 */
export const RETURN_BGM = "title";
/** 持ち帰った ときの 曲（終わりの 札）。 */
export const ENDING_BGM = "ending";

/** 村の 曲（from の 段から。町が 育つと 明るい 曲に）。 */
const VILLAGE_TIERS: readonly { from: number; bgm: string }[] = [
	// 名無し2rt さんの「？」
	{ from: 0, bgm: "town" },
	// 店が 建ってから：名無し2rt さんの「くもり空をパクったやつ」（ホ長調 116。矩形波の 主旋律）
	{ from: 5, bgm: "kumori" },
];

/** その 段の 村の 曲（蓄音機で えらんで いなければ これ）。 */
export const stageBgm = (stage: number): string => {
	let bgm = VILLAGE_TIERS[0].bgm;
	for (const t of VILLAGE_TIERS) if (stage >= t.from) bgm = t.bgm;
	return bgm;
};

/** 蓄音機で かけられる 曲の 1つ。 */
export type Disc = { bgm: string; label: string };

/**
 * 蓄音機で かけられる 曲（上から 村 → 持ち帰った 板の 順。同じ 曲は 1度だけ）。
 * stage は 町の 段、cleared は 持ち帰った 板。
 */
export const records = (
	stage: number,
	cleared: readonly DungeonId[],
): Disc[] => {
	const out: Disc[] = [];
	const add = (bgm: string, label: string) => {
		if (!out.some((r) => r.bgm === bgm)) out.push({ bgm, label });
	};
	for (const t of VILLAGE_TIERS)
		if (stage >= t.from)
			add(t.bgm, `保守村（${STAGE_NAMES[t.from] ?? ""}の　ころ）`);
	for (const d of DUNGEON_IDS) {
		if (!cleared.includes(d)) continue;
		const look = BOARD_LOOKS[d];
		if (look.zones)
			for (const z of look.zones)
				add(z.bgm, `${DUNGEON_NAMES[d].short}　${z.name}`);
		else add(look.bgm, DUNGEON_NAMES[d].short);
	}
	if (cleared.length > 0) {
		add(HOUSE_BGM, "祭り");
		if (cleared.some((d) => DUNGEONS[d].boss)) add(BOSS_BGM, "ボス");
		add(RETURN_BGM, "帰り道");
		add(ENDING_BGM, "持ち帰った　とき");
	}
	return out;
};

/** 村で 鳴らす 曲（蓄音機で えらんだ 曲が かけられる うちは それ、なければ 段の 曲）。 */
export const villageBgm = (
	stage: number,
	cleared: readonly DungeonId[],
	pick: string | null,
): string =>
	pick && records(stage, cleared).some((r) => r.bgm === pick)
		? pick
		: stageBgm(stage);
