// 場面ごとの 曲（名前は data/audio/bgm.ts）。階の 曲は data/story/story.ts の BOARD_LOOKS、ここは それ以外。
//
// ■ 村の 曲
// おんJタウンの 曲は 村の 育ちで かわる（段は data/town/town.ts の STAGE_NAMES）。建物の 中も 村の 曲の まま。
// 村で 鳴る 曲は プレイヤーが えらべない。寸劇の 曲は 寸劇の あいだだけ（ui/village/villageMusic.ts）。
//
// ■ 聞いた 曲
// 村の 曲と、持ち帰った 板で 聞いた 曲（その 板の 階の 曲。ボス・祭り・持ち帰りの 曲も）。音ゲーの 曲の 一覧（records）。

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
 * 騒ぎの 寸劇の 曲（パン兵の 行進 など。data/town/incidents.ts）。界隈曲（場面 専用）。
 * 寸劇の あいだだけ 鳴らし、終わったら 村の 曲に もどす（騒ぎが 続いて いても 村の 曲には しない）。
 */
export const INCIDENT_BGM = "kaiwai";

/** 村の 曲（from の 段から。町が 育つと 明るい 曲に）。 */
const VILLAGE_TIERS: readonly { from: number; bgm: string }[] = [
	// 名無し2rt さんの「？」
	{ from: 0, bgm: "town" },
	// 店が 建ってから：名無し2rt さんの「くもり空をパクったやつ」（ホ長調 116。矩形波の 主旋律）
	{ from: 5, bgm: "kumori" },
];

/** その 段の 村の 曲。 */
export const stageBgm = (stage: number): string => {
	let bgm = VILLAGE_TIERS[0].bgm;
	for (const t of VILLAGE_TIERS) if (stage >= t.from) bgm = t.bgm;
	return bgm;
};

/**
 * 曲の 正式な 題（音ゲーの 曲名）。ゲームで 鳴る 曲は みな ここに 書く。
 * 題の つけかたは ポケダン空の サントラの 型：板と 層の 曲は その 場所の 名前を ひらがなで
 * （ログの底の 層は data/story/story.ts の HIDDEN_ZONES の 名前と そろえる）、場面の 曲は
 * 短い ひとこと（「！」で 締める）。カタカナ語と 2ch の 語（dat・スレ）は そのまま。
 * スレに 貼られた ときの 題（「？」「何か」など）は data/audio/bgm.ts の import の 注に 残して ある。
 * ここに ない 曲は 聞いた 所が 曲名に なる。
 */
export const SONG_TITLES: Readonly<Record<string, string>> = {
	// 村
	town: "おんJタウン",
	kumori: "にぎやかなおんJタウン",
	kaiwai: "まちがたいへんだ！",
	// 板の 曲
	dungeon: "やきたてのめいろ",
	field2: "いおうのこうどう",
	speder2: "かそのでんしかいろ",
	deq_strata: "きんしのちそう",
	island: "みなみのはなれじま",
	fukyowa: "てっぱんのいかり",
	kouseki: "ちょうちんどおり",
	tekitou: "ボカロのひなんじょ",
	mercury: "すいせいのすいしょう",
	deq_mu: "しずんだたいりくのくうこう",
	kimchi: "まっかなかいせん",
	inferno: "やみのとう",
	// ログの底の 層
	deep1: "かこログのあさせ",
	stone: "datのせきしつ",
	deep_dat: "うもれたdat",
	field: "こけむしたスレあと",
	deep_matome: "くずれたまとめ",
	ruins: "ほしゅのはかば",
	deep2: "とうけつされたしょこ",
	deep_hakushi: "はくしのかいろう",
	deep3: "もじばけのうみ",
	deep_kisei: "きせいのおり",
	deq_volcano: "おちたさば",
	deep_koge: "こげたかいせん",
	deep5: "えんじょうのそこ",
	deep6: "1001",
	// 休み所と 集落
	yofukashi: "ろてんのげんせん",
	deq_laundry: "はつでんしょのけんがくコース",
	shallow3: "しずかなせきしつ",
	piropiro: "やぐらひろば",
	// ボス・祭り・持ち帰り
	lastboss: "たいけつ！もられたみだし",
	retro: "ボスがあらわれた！",
	retro2: "まつりだ！",
	title: "げんばんをもちかえれ！",
	ending: "またつぎスレで",
	// 場面と 実況の 曲
	kaiwai2: "あかりのさか",
	kaiwai3: "ゆおんせんそう！",
	kaiwai4: "どくりつごっこ",
	deep4: "おんJタウンしゅうりょう！？",
	sad: "あのなつのスレ",
	battle: "ななしとのたたかい",
	boss: "けっせん！",
	tense: "あらぶるスレ",
	white: "あぼーんのしろの",
	deq_sea: "みなぞこにさすひかり",
	deq_ice: "うすごおりのかいろう",
	touhoufu: "だらだらしょとう",
};

/** 聞いた 曲の 1つ（label は 曲名、where は 聞いた 所）。 */
export type Disc = { bgm: string; label: string; where: string };

/**
 * 聞いた 曲（上から 村 → 持ち帰った 板の 順。同じ 曲は 1度だけ）。
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
