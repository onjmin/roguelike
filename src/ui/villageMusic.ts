// 村の 曲（data/music.ts）を 保存と 設定から 引く・広場の 蓄音機で えらぶ。

import { records, villageBgm } from "../data/music";
import type { Story } from "../engine/defs";
import { loadProgress, loadTown } from "../engine/save";
import { saveSettings, settings } from "../engine/settings";
import type { Ctx } from "./ctx";
import { type ListItem, listWindow } from "./list";

/** いま 村で 鳴らす 曲。 */
export const villageSong = (): string =>
	villageBgm(loadTown().stage, loadProgress().cleared, settings.villageBgm);

/** 蓄音機で 曲を えらぶ（かけられる 曲が 2つ 以上 あるときだけ 聞く）。 */
export const chooseRecord = async (ctx: Ctx, s: Story): Promise<void> => {
	const list = records(loadTown().stage, loadProgress().cleared);
	if (list.length < 2) return;
	if ((await s.choose(["曲を　かえる", "そのまま"], { cancel: 1 })) !== 0)
		return;
	await s.wait(0);
	const now = settings.villageBgm ? villageSong() : "";
	const items: ListItem[] = [
		{ label: "おまかせ（村の　育ちに　あわせる）", value: "" },
		...list.map((r) => ({ label: r.label, value: r.bgm })),
	].map((it) => (it.value === now ? { ...it, sub: "♪" } : it));
	const v = await listWindow(ctx, "どの　曲を　かける？", items, {
		closeLabel: "やめる",
		start: Math.max(
			0,
			items.findIndex((it) => it.value === now),
		),
	});
	if (v === null) return;
	saveSettings({ villageBgm: v || null });
	s.bgm(villageSong());
};
