// 番組の TV の 一覧（番組の id → TV）。ui/jikkyoWatch.ts が 読む。
// 映画館の『空飛ぶ鯖』は ui/jikkyoScenes.ts、劇場の 紅白は ui/jikkyoKohakuTv.ts、あとから 足した 番組は ui/jikkyo<Id>Tv.ts。

import { asadoraTv } from "./jikkyoAsadoraTv";
import { ekidenTv } from "./jikkyoEkidenTv";
import { f1Tv } from "./jikkyoF1Tv";
import { gesshokuTv } from "./jikkyoGesshokuTv";
import { gogoTv } from "./jikkyoGogoTv";
import { kakologTv } from "./jikkyoKakologTv";
import { keibaTv } from "./jikkyoKeibaTv";
import { kohakuTv } from "./jikkyoKohakuTv";
import { koshienTv } from "./jikkyoKoshienTv";
import { mahjongTv } from "./jikkyoMahjongTv";
import { manzaiTv } from "./jikkyoManzaiTv";
import { oyatsuTv } from "./jikkyoOyatsuTv";
import { type SceneTv, soraTv } from "./jikkyoScenes";
import { shinsakuTv } from "./jikkyoShinsakuTv";
import { sumoTv } from "./jikkyoSumoTv";
import { torijinTv } from "./jikkyoTorijinTv";

export type TvFactory = (
	canvas: HTMLCanvasElement,
	opt: { reduced: boolean; live: boolean },
) => SceneTv;

export const PROGRAM_TVS: Readonly<Record<string, TvFactory>> = {
	sora: soraTv,
	kohaku: kohakuTv,
	sumo: sumoTv,
	keiba: keibaTv,
	shinsaku: shinsakuTv,
	manzai: manzaiTv,
	koshien: koshienTv,
	ekiden: ekidenTv,
	torijin: torijinTv,
	gesshoku: gesshokuTv,
	asadora: asadoraTv,
	oyatsu: oyatsuTv,
	mahjong: mahjongTv,
	f1: f1Tv,
	gogo: gogoTv,
	kakolog: kakologTv,
};
