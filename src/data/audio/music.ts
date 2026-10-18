// 場面ごとの 曲（名前は data/audio/bgm.ts）。階の 曲は data/story/story.ts の BOARD_LOOKS、ここは それ以外。
//
// ■ 村の 曲
// おんJタウンの 曲は 村の 育ちで かわる（段は data/town/town.ts の STAGE_NAMES）。建物の 中も 村の 曲の まま。
// 広場の 蓄音機で 好きな 曲に かえられる（えらんだ 曲は 設定 settings.villageBgm。端末ごと）。
// 町に 騒ぎが ある あいだは えらんだ 曲より 騒ぎの 曲（INCIDENT_BGM）。
// かけられるのは 村の 曲と、持ち帰った 板で 聞いた 曲（その 板の 階の 曲。ボス・祭り・持ち帰りの 曲も）。

import { DUNGEON_IDS, DUNGEONS } from "../../core/data/dungeons";
import type { DungeonId } from "../../core/types";
import { BOARD_LOOKS, DUNGEON_NAMES } from "../story/story";
import { STAGE_NAMES } from "../town/town";

/** 祭り（モンスターハウス）の曲。名無し155さんの アップテンポな曲（オクターブを直した版）。 */
export const HOUSE_BGM = "retro2";
/** ボスの 曲（見つけてから たおすまで）。名無し155さんの 曲（もとは 電池板で 鳴らしていた 戦闘曲っぽい 方）。 */
export const BOSS_BGM = "retro";
/** 持ち帰る 帰り道の 曲（原盤を 持ち帰る 曲。タイトルと 同じ）。 */
export const RETURN_BGM = "title";
/** 持ち帰った ときの 曲（終わりの 札）。 */
export const ENDING_BGM = "ending";
/**
 * 町に 騒ぎが ある あいだの 村の 曲（data/town/incidents.ts。パン兵の 占領・きのこ軍の 行進 など）。
 * 片づくと いつもの 村の 曲（蓄音機で えらんだ 曲）に もどる。騒ぎの あいだは 蓄音機で えらんだ 曲より こちら。界隈曲（場面 専用）。
 */
export const INCIDENT_BGM = "kaiwai";

/**
 * 村の 語りで 鳴らす 場面の 曲と、その 1周の 長さ（秒）。場面が 短くても、場面の あとも 村で
 * 1周 おわるまで 鳴らしつづけ、それから 村の 曲へ もどす（ui/village/villageMusic.ts の 余韻）。
 * 長さは MML の いちばん 遅い 音の 終わり（dtm の parseMML。4分音符＝48 ステップ）を テンポで 割った 値。
 */
export const SCENE_BGM_SEC: Readonly<Record<string, number>> = {
	yofukashi: 91,
	deep4: 38,
	sad: 129,
	kaiwai2: 132,
	kaiwai3: 119,
	kaiwai4: 89,
	deep6: 55,
	deep1: 45,
};

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

/**
 * 曲の 正式な 題（蓄音機の 曲名）。ゲームで 鳴る 曲は みな ここに 書く。
 * スレに 貼られた ときの 題（「？」「何か」など）は data/audio/bgm.ts の import の 注に 残して ある。
 * ここに ない 曲は 蓄音機で 聞いた 所が 曲名に なる。
 */
export const SONG_TITLES: Readonly<Record<string, string>> = {
	// 村
	town: "おんJタウンの朝",
	kumori: "くもりのち商店街",
	kaiwai: "町内で騒ぎ",
	// 板の 曲
	dungeon: "焼きたての迷路",
	field2: "源泉の通り道",
	speder2: "過疎の回路",
	deq_laundry: "見学者ゼロ人",
	deq_strata: "ずれる菌床",
	island: "島に着いたらサビ",
	fukyowa: "鉄板の不協和音",
	kouseki: "提灯ダンス",
	piropiro: "ﾋﾟﾛﾋﾟﾛ夜店",
	tekitou: "歌詞は適当",
	mercury: "水星の名無し",
	deq_mu: "沈んだ大陸の空港",
	kimchi: "赤い回線",
	inferno: "†闇の塔†",
	// ログの底の 層
	deep1: "掘りかけの穴",
	stone: "石室の足音",
	deep_dat: "掘っても掘っても",
	field: "苔とスレ跡",
	deep_matome: "まとめの砂嵐",
	ruins: "ページをめくる音",
	deep2: "凍った書庫",
	deep_hakushi: "白紙に落ちる水滴",
	deep3: "文字化けの波",
	deep_kisei: "書けない檻",
	deq_volcano: "鯖の熱暴走",
	deep_koge: "焦げたにおい",
	deep5: "名無しの荒野",
	deep6: "つづきの原盤",
	shallow3: "ハープの雪",
	// 休み所・ボス・祭り・持ち帰り
	yofukashi: "湯けむりと星",
	lastboss: "見出しを盛るな",
	retro: "手書きの決戦",
	retro2: "祭り会場はここですか",
	title: "原盤を持ち帰れ",
	ending: "ほな、また次スレで",
	// 場面と 実況の 曲
	kaiwai2: "明かりの坂",
	kaiwai3: "湯温戦争",
	kaiwai4: "独立ごっこ",
	deep4: "しゅうりょうのお知らせ",
	sad: "あの夏のスレ",
	battle: "名無しの小競り合い",
	boss: "歌のない決戦",
	tense: "荒ぶるスレ",
	white: "あぼーんの白野",
	deq_sea: "水底にさす光",
	deq_ice: "薄氷の回廊",
	touhoufu: "だらだら弾幕",
};

/** 蓄音機で かけられる 曲の 1つ（label は 曲名、where は 聞いた 所）。 */
export type Disc = { bgm: string; label: string; where: string };

/**
 * 蓄音機で かけられる 曲（上から 村 → 持ち帰った 板の 順。同じ 曲は 1度だけ）。
 * stage は 町の 段、cleared は 持ち帰った 板。
 */
export const records = (
	stage: number,
	cleared: readonly DungeonId[],
): Disc[] => {
	const out: Disc[] = [];
	const add = (bgm: string, where: string) => {
		if (!out.some((r) => r.bgm === bgm))
			out.push({ bgm, label: SONG_TITLES[bgm] ?? where, where });
	};
	for (const t of VILLAGE_TIERS)
		if (stage >= t.from)
			add(t.bgm, `おんJタウン（${STAGE_NAMES[t.from] ?? ""}のころ）`);
	for (const d of DUNGEON_IDS) {
		if (!cleared.includes(d)) continue;
		const look = BOARD_LOOKS[d];
		if (look.zones)
			for (const z of look.zones)
				add(z.bgm, `${DUNGEON_NAMES[d].short}　${z.name}`);
		else add(look.bgm, DUNGEON_NAMES[d].short);
		for (const r of DUNGEONS[d].rests ?? [])
			if (r.bgm) add(r.bgm, `${DUNGEON_NAMES[d].short}　${r.name}`);
		const boss = DUNGEONS[d].boss?.bgm;
		if (boss) add(boss, `${DUNGEON_NAMES[d].short}　ボス`);
	}
	if (cleared.length > 0) {
		add(HOUSE_BGM, "祭り");
		if (cleared.some((d) => DUNGEONS[d].boss)) add(BOSS_BGM, "ボス");
		add(RETURN_BGM, "帰り道");
		add(ENDING_BGM, "持ち帰ったとき");
	}
	return out;
};

/** 村で 鳴らす 曲（騒ぎの あいだは 騒ぎの 曲。ほかは 蓄音機で えらんだ 曲が かけられる うちは それ、なければ 段の 曲）。 */
export const villageBgm = (
	stage: number,
	cleared: readonly DungeonId[],
	pick: string | null,
	incident = false,
): string =>
	incident
		? INCIDENT_BGM
		: pick && records(stage, cleared).some((r) => r.bgm === pick)
			? pick
			: stageBgm(stage);
