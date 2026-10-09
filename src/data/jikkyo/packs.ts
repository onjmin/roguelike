// 束の 番組の 一覧（あとから 足した 番組。data/jikkyo/pack.ts）。番組表（schedule.ts）・会場の 文（text.ts）・
// 台本の 一覧（index.ts）・試験（src/sim/jikkyoProgTests.ts）が 読む。並びは 会場で 選ぶ ときの 順。

import { ASADORA_PACK } from "./asadora";
import { EKIDEN_PACK } from "./ekiden";
import { F1_PACK } from "./f1";
import { GESSHOKU_PACK } from "./gesshoku";
import { GOGO_PACK } from "./gogo";
import { KAKOLOG_PACK } from "./kakolog";
import { KEIBA_PACK } from "./keiba";
import { KOSHIEN_PACK } from "./koshien";
import { MAHJONG_PACK } from "./mahjong";
import { MANZAI_PACK } from "./manzai";
import { OYATSU_PACK } from "./oyatsu";
import type { JkPack } from "./pack";
import { SHINSAKU_PACK } from "./shinsaku";
import { SUMO_PACK } from "./sumo";
import { TORIJIN_PACK } from "./torijin";

export const PACKS: readonly JkPack[] = [
	SUMO_PACK,
	KEIBA_PACK,
	SHINSAKU_PACK,
	MANZAI_PACK,
	KOSHIEN_PACK,
	EKIDEN_PACK,
	TORIJIN_PACK,
	GESSHOKU_PACK,
	ASADORA_PACK,
	OYATSU_PACK,
	MAHJONG_PACK,
	F1_PACK,
	GOGO_PACK,
	KAKOLOG_PACK,
];

/** 番組の id → 束。 */
export const packOf = (id: string): JkPack | undefined =>
	PACKS.find((p) => p.script.id === id);
