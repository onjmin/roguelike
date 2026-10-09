// どすこいポイント（data/dosukoi.ts）：建物に その 帰りに はじめて 入ったら 地名の 札の あとに 札、
// 町役場の 1番窓口・市役所の 住民課で 照会（facilities.ts の plays: dosukoi）。何にも 使えない。

import { nowYear, type Today, today } from "../data/calendar";
import {
	DOSUKOI,
	DOSUKOI_SHOW_MAX,
	DOSUKOI_TOAST_MS,
	dosukoiStep,
	isLapseDay,
	isWabiDay,
	loadDosukoi,
	saveDosukoi,
} from "../data/dosukoi";
import type { Story } from "../engine/defs";
import { returnAt } from "./guests";
import { previewStage } from "./villageReturn";
import { fill } from "./villageTalk";

/**
 * 村 いがいの 地図へ 移った（ui/village.ts の warp）。その 帰りの はじめてなら、地名の 札が 消えた あとに
 * どすこいの 札。current は いまの 地図（村が 止まって いれば null）。もう 別の 地図・冒険なら 出さない（点は 入る）。
 */
export const dosukoiEnter = (
	toast: (text: string) => void,
	current: () => string | null,
): void => {
	const { rec, toast: text } = dosukoiStep(
		loadDosukoi(),
		today(),
		nowYear(),
		returnAt(),
	);
	if (!text) return;
	saveDosukoi(rec, previewStage() !== null);
	const map = current();
	setTimeout(() => {
		if (map !== null && current() === map) toast(text);
	}, DOSUKOI_TOAST_MS);
};

/** 町役場の 1番窓口・市役所の 住民課（調べた 文の あと。8/5 は 失効の 知らせ）。 */
export const dosukoiWindow = async (
	s: Story,
	facilityId: string,
	t: Today = today(),
	year: number = nowYear(),
): Promise<void> => {
	const r = loadDosukoi();
	if (r.pts <= 0 && !isLapseDay(t)) return;
	if ((await s.choose([...DOSUKOI.options], { cancel: 1 })) !== 0) return;
	const where = facilityId === "cityhall" ? "住民課" : "窓口";
	if (isLapseDay(t)) {
		for (const l of DOSUKOI.lapse) await s.narrate(fill(l, { where }));
		await s.say("nanj", DOSUKOI.back, { name: where });
		return;
	}
	await s.narrate(
		fill(DOSUKOI.balance, { where, n: Math.min(DOSUKOI_SHOW_MAX, r.pts) }),
	);
	await s.say(
		"nanj",
		isWabiDay(t) && r.wabi === year ? DOSUKOI.wabiNote : DOSUKOI.shrug,
		{ name: where },
	);
};
