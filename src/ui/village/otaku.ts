// ヲタショップ「神降臨」の レジと ガチャ（data/village/otaku.ts。ui/village/facilities.ts の play "otaku"）。
// レジ：グッズ（家具）を 買う と キリコの 家の 収納に 届く（ui/village/myhome.ts の furnitureShop を 店の 品で）。
// ガチャ：1回 500円で アクスタ 全4種の どれか（ダブりも ある）。そろったら もう お金を とらない。
// どちらも 家を 買う 前は 買えない（飾る 所が ないので。すすめるか、ことわる だけ）。

import { FURNITURE_PRICE, type FurnitureId } from "../../data/village/myhome";
import {
	GACHA_PRICE,
	OTAKU_GACHA,
	OTAKU_GOODS,
	OTAKU_MSG,
} from "../../data/village/otaku";
import type { Story } from "../../engine/defs";
import { spendYen } from "../../engine/wallet";
import type { Ctx } from "../ctx";
import {
	type FurnShop,
	furnitureShop,
	furnName,
	loadHome,
	owns,
	previewing,
	saveHome,
} from "./myhome";
import { fill } from "./villageTalk";

const OTAKU_SHOP: FurnShop = {
	who: OTAKU_MSG.clerk,
	// 安い 順
	ids: [...OTAKU_GOODS].sort((a, b) => FURNITURE_PRICE[a] - FURNITURE_PRICE[b]),
	msg: OTAKU_MSG,
};

/**
 * ガチャを 1回 回す（家を 買って いて、まだ そろって いない とき。景品は 4種から 等しく 1つ。rand は 試験用）。
 * 出た 物（ダブりは dup）。回さなかったら null。
 */
export const spinGacha = async (
	s: Story,
	rand: () => number = Math.random,
): Promise<{ id: FurnitureId; dup: boolean } | null> => {
	const m = loadHome();
	if (!m.owned) {
		await s.narrate(OTAKU_MSG.gachaNoHome);
		return null;
	}
	if (OTAKU_GACHA.every((id) => owns(m, id))) {
		await s.narrate(OTAKU_MSG.gachaComp);
		return null;
	}
	if ((await s.choose([...OTAKU_MSG.gachaMenu], { cancel: 1 })) !== 0)
		return null;
	if (!spendYen(GACHA_PRICE, previewing())) {
		await s.narrate(OTAKU_MSG.gachaShort);
		return null;
	}
	s.se("arcCoin");
	const id =
		OTAKU_GACHA[
			Math.min(OTAKU_GACHA.length - 1, Math.floor(rand() * OTAKU_GACHA.length))
		];
	await s.narrate(OTAKU_MSG.gachaSpin);
	const m2 = loadHome();
	const dup = owns(m2, id);
	if (!dup) {
		m2.stored.push(id);
		saveHome(m2);
		s.se("item");
	}
	await s.narrate(
		fill(dup ? OTAKU_MSG.gachaDup : OTAKU_MSG.gachaGot, { name: furnName(id) }),
	);
	return { id, dup };
};

/** 店の 物（register レジ・gacha ガチャ）。 */
export const otakuPlay = async (
	ctx: Ctx,
	s: Story,
	kind: string,
): Promise<void> => {
	if (kind === "gacha") await spinGacha(s);
	else await furnitureShop(ctx, s, OTAKU_SHOP);
};
