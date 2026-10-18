// 村の 曲（data/audio/music.ts）を 保存と 設定から 引く・広場の 蓄音機で えらぶ。

import { records, SCENE_BGM_SEC, villageBgm } from "../../data/audio/music";
import type { Story } from "../../engine/defs";
import { loadProgress, loadTown } from "../../engine/save";
import { saveSettings, settings } from "../../engine/settings";
import type { Ctx } from "../ctx";
import { type ListItem, listWindow } from "../list";

// ───────────────── 場面の 曲の 余韻 ─────────────────
// 語りの 場面の 曲（data/audio/music.ts の SCENE_BGM_SEC）は 場面が 終わっても すぐ 村の 曲に もどさず、
// 鳴りはじめから 1周 おわるまで 村で 鳴らしつづける（場面が 数窓で 終わると 曲が すぐ 切れて しまうので）。
// その あいだは villageSong が 場面の 曲を かえすので、建物に 出入りしても 曲は 続く。1周 おわったら
// 村が ひまな とき（語りの 外）に 村の 曲へ 絞って もどす（ui/village/village.ts の tickLinger）。保存は しない。

/** 鳴らして いる 場面の 曲と、鳴りはじめた 時刻（performance.now の ms）。 */
let cue: { bgm: string; at: number } | null = null;
/** 場面の あとも 鳴らして いる 場面の 曲と、村の 曲に もどす 時刻。 */
let linger: { bgm: string; until: number } | null = null;

/** 語りの 頁の 曲（null で 止める）。場面の 曲なら 鳴りはじめを 覚える。 */
export const sceneBgm = (s: Story, name: string | null): void => {
	s.bgm(name);
	cue =
		name && SCENE_BGM_SEC[name] ? { bgm: name, at: performance.now() } : null;
	if (!cue) linger = null;
};

/**
 * 場面の おわり。場面の 曲が 鳴って いれば 1周 おわるまで 余韻に して true（曲は そのまま）。
 * なければ false（呼ぶ側が 村の 曲へ もどす）。
 */
export const endScene = (): boolean => {
	const c = cue;
	cue = null;
	if (!c) return false;
	linger = { bgm: c.bgm, until: c.at + (SCENE_BGM_SEC[c.bgm] ?? 0) * 1000 };
	return true;
};

/** 余韻を やめる（村を 出る・蓄音機で 曲を えらんだ）。 */
export const clearLinger = (): void => {
	cue = null;
	linger = null;
};

/** 余韻が 1周 おわった（村の 曲へ もどす とき）。その 曲名。まだなら null。 */
export const lingerDone = (now: number): string | null =>
	linger && now >= linger.until ? linger.bgm : null;

/** いま 村で 鳴らす 曲（場面の 曲の 余韻の あいだは その 曲）。 */
export const villageSong = (): string => {
	if (linger) return linger.bgm;
	return baseSong();
};

/** 余韻を 終えて 村の 曲（ふだんの 曲）を かえす。 */
export const endLinger = (): string => {
	linger = null;
	return baseSong();
};

const baseSong = (): string =>
	villageBgm(loadTown().stage, loadProgress().cleared, settings.villageBgm);

/** 蓄音機で 曲を えらぶ（かけられる 曲が 2つ 以上 あるときだけ 聞く）。 */
export const chooseRecord = async (ctx: Ctx, s: Story): Promise<void> => {
	const list = records(loadTown().stage, loadProgress().cleared);
	if (list.length < 2) return;
	if ((await s.choose(["曲をかえる", "そのまま"], { cancel: 1 })) !== 0) return;
	await s.wait(0);
	const now = settings.villageBgm ? villageSong() : "";
	const items: ListItem[] = [
		{ label: "おまかせ（村の育ちにあわせる）", value: "" },
		...list.map((r) => ({ label: r.label, desc: r.where, value: r.bgm })),
	].map((it) => (it.value === now ? { ...it, sub: "♪" } : it));
	const v = await listWindow(ctx, "どの曲をかける？", items, {
		closeLabel: "やめる",
		start: Math.max(
			0,
			items.findIndex((it) => it.value === now),
		),
	});
	if (v === null) return;
	saveSettings({ villageBgm: v || null });
	clearLinger();
	s.bgm(villageSong());
};
