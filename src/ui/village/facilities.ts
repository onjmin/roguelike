// 町が 育つと 建つ 施設の スクリプト（形と 文は data/village/facilities.ts）。
// 入る・出るは ほかの 建物と 同じ（扉の 文は 村に いる あいだ 1回 → 入口の 音（doorSe）→ 暗転 → 中 → 明転。出口の マットで 外へ）。
// 外の 物（釣り場の 竿・グラウンドの マウンド）は 調べると 文、遊べる 物は そのあと 遊ぶか 聞く。
// どれも 寄り道で、強さにも 冒険にも 何も 残さない（釣れた 物は すぐ 海に かえす）。

import { BAT_GUIDE_TOLD, BATTING_GUIDE } from "../../data/arcade/guides";
import { staffLines, venueLines } from "../../data/jikkyo/text";
import { awayFriends } from "../../data/story/story";
import { today } from "../../data/town/calendar";
import {
	DRINK_BAR,
	DRINK_BAR_YEN,
	FISHING,
	GROUND_BAT,
	VEND_YEN,
	VENDING,
} from "../../data/town/facilities";
import {
	type Facility,
	facilityEntry,
	facilityMapId,
	facilityOutside,
	facilityRoomPalette,
	facilityRoomPlaces,
	facilityRoomRows,
	type OutdoorThing,
	outdoorId,
} from "../../data/village/facilities";
import { NETCAFE_MSG, NETCAFE_YEN } from "../../data/village/finance";
import { npc, sign } from "../../data/village/helpers";
import type { VillageView } from "../../data/village/map";
import { layRoomTatami } from "../../data/village/tatami";
import type { EventDef, MapDef, Script, Story } from "../../engine/defs";
import { loadProgress, loadTown } from "../../engine/save";
import { yen } from "../../engine/wallet";
import { arcadePlay } from "../arcade/arcade";
import { bushitsuThing } from "../bushitsu/bushitsu";
import type { Ctx } from "../ctx";
import { watchGikai } from "../jikkyo/jikkyoGikai";
import { staffOnceLine, watchProgram } from "../jikkyo/jikkyoWatch";
import { derbyBest } from "../minigames/batting";
import { debateScript, kibenScript, minutesScript } from "../minigames/debate";
import { dosukoiWindow } from "../minigames/dosukoi";
import { eatAt, keeperTalk } from "../minigames/eat";
import { imoniPlay } from "../minigames/imoni";
import { atBat, playDerby } from "../minigames/minigames";
import { playOrRecord, tellOnce } from "../minigames/playMenu";
import { netBrowse } from "../net/net";
import { isNetaPlay, netaPlay } from "../neta/neta";
import { purikura } from "../purikura/purikura";
import { sabaPlay } from "../saba/saba";
import {
	atmDesk,
	guideRack,
	shokenWindow,
	stockBoard,
	tradeTerminal,
} from "../trade/trade";
import { giftShelf } from "./bonds";
import { facilityDecor } from "./cinemaDecor";
import { assemblyEvents } from "./civic";
import { roomFindGlint, townFind } from "./finds";
import {
	enterHome,
	furnitureShop,
	guestEvent,
	homeBump,
	homeDecor,
	homeEmpty,
	homeFacility,
	homeImages,
	homeThing,
	residentGift,
} from "./myhome";
import { otakuPlay } from "./otaku";
import { payOrShort } from "./pay";
import { previewStage } from "./villageReturn";
import { fill } from "./villageTalk";

/** 調べる 物の 窓（窓ごと）。 */
const readAll = async (s: Story, lines: readonly string[]): Promise<void> => {
	for (const t of lines) await s.narrate(t);
};

/** 施設に 入る（扉の 文は 村に いる あいだ 1回）。 */
export const enterFacility = (f: Facility): Script =>
	// キリコの 家：買う 前は 不動産屋、買った あとは 入って 宅配便を 開ける（ui/village/myhome.ts）
	f.id === "myhome" ? enterHome(enterPlain(f)) : enterPlain(f);

const enterPlain =
	(f: Facility): Script =>
	async (s) => {
		const seen = `roomDoor:${facilityMapId(f)}`;
		if (f.door && !s.flag(seen)) {
			s.set(seen);
			await s.narrate(f.door);
		}
		s.se(f.doorSe ?? "doorWood");
		await s.fadeOut(200);
		const e = facilityEntry(f);
		await s.warp(facilityMapId(f), e.x, e.y, e.dir);
		// 明けはじめたら もう 歩ける（明けきるまで 待たせない）
		void s.fadeIn(200);
	};

/** 出口の マット：扉の 音 → 暗転 → 村（扉の 前）→ 明転。 */
const leaveFacility =
	(f: Facility): Script =>
	async (s) => {
		s.se(f.doorSe ?? "doorWood");
		await s.fadeOut(200);
		const o = facilityOutside(f);
		await s.warp("village", o.x, o.y, o.dir);
		// 明けはじめたら もう 歩ける（明けきるまで 待たせない）
		void s.fadeIn(200);
	};

/** 釣り（竿を たらして、何かが かかる。すぐ 海に かえす）。見た目の 乱数なので Math.random。 */
const fish = async (s: Story): Promise<void> => {
	if ((await s.choose([...FISHING.menu], { cancel: 1 })) !== 0) return;
	await s.narrate(FISHING.cast);
	const pick =
		FISHING.catches[Math.floor(Math.random() * FISHING.catches.length)];
	await s.narrate(pick);
};

/** 1打席の おわり → 板を 閉じた あとの 窓（GROUND_BAT の どれか）。 */
const BAT_AFTER = {
	hr: "hr",
	hit: "hit",
	walk: "walk",
	k: "out",
	out: "popout",
} as const;

/**
 * グラウンドの 1打席か ホームラン競争（投げるのは やきう。出ていった あとは 名無し。板は ui/minigames/batting.ts）。
 * B で 板を 閉じたら 何も 言わない。
 */
const bat = async (ctx: Ctx, s: Story): Promise<void> => {
	const best = derbyBest();
	const n = await playOrRecord(
		s,
		best > 0 ? [fill(GROUND_BAT.record, { best })] : [],
		GROUND_BAT.menu,
	);
	if (n === null) return;
	// 打席の 決まり（はじめての 1回。本館の 関所と 同じ 印）
	await tellOnce(s, BAT_GUIDE_TOLD, BATTING_GUIDE);
	await s.wait(0);
	const gone = awayFriends(loadProgress().cleared).includes("nanj");
	const who = gone ? "nanashi" : "yakiu";
	const pitcher = gone ? GROUND_BAT.pitcherGone : GROUND_BAT.pitcher;
	if (n === 0) {
		const r = await atBat(ctx, { title: GROUND_BAT.title, pitcher, who });
		if (r !== "quit") await s.narrate(GROUND_BAT[BAT_AFTER[r]]);
		return;
	}
	await s.narrate(GROUND_BAT.derbyRule);
	await s.wait(0);
	const d = await playDerby(ctx, {
		title: GROUND_BAT.derbyTitle,
		pitcher,
		who,
	});
	if (!d) return;
	await s.narrate(
		fill(d.newBest ? GROUND_BAT.derbyBest : GROUND_BAT.derbyEnd, {
			n: d.hr,
			best: d.best,
		}),
	);
};

/** 自販機（1本 VEND_YEN 円。飲み物が 出る。見た目の 乱数なので Math.random）。 */
const vend = async (s: Story): Promise<void> => {
	const menu = VENDING.menu.map((x) => fill(x, { price: yen(VEND_YEN) }));
	if ((await s.choose(menu, { cancel: 1 })) !== 0) return;
	if (!(await payOrShort(s, VEND_YEN))) return;
	const drink =
		VENDING.drinks[Math.floor(Math.random() * VENDING.drinks.length)];
	await s.narrate(fill(VENDING.got, { drink }));
	await s.narrate(VENDING.drank);
};

/** ファミレスの ドリンクバー（1杯 DRINK_BAR_YEN 円。注いで その場で 飲む。見た目の 乱数なので Math.random）。 */
const drinkBar = async (s: Story): Promise<void> => {
	const menu = DRINK_BAR.menu.map((x) =>
		fill(x, { price: yen(DRINK_BAR_YEN) }),
	);
	if ((await s.choose(menu, { cancel: 1 })) !== 0) return;
	if (!(await payOrShort(s, DRINK_BAR_YEN))) return;
	const drink =
		DRINK_BAR.drinks[Math.floor(Math.random() * DRINK_BAR.drinks.length)];
	await s.narrate(fill(DRINK_BAR.got, { drink }));
	await s.narrate(DRINK_BAR.drank);
};

/** ネットカフェの 料金を 払った 印（村に いる あいだ）。 */
const NETCAFE_PAID = "netcafePaid";

/** ネットカフェの ブース（村に いる あいだの はじめに NETCAFE_YEN。あとは ネットと トレード）。 */
const netcafeBooth = async (ctx: Ctx, s: Story): Promise<void> => {
	if (!s.flag(NETCAFE_PAID)) {
		const price = yen(NETCAFE_YEN);
		await s.narrate(fill(NETCAFE_MSG.ask, { price }));
		const menu = NETCAFE_MSG.askMenu.map((x) => fill(x, { price }));
		if (
			(await s.choose(menu, { cancel: 1 })) !== 0 ||
			!(await payOrShort(s, NETCAFE_YEN))
		)
			return;
		s.set(NETCAFE_PAID);
		await s.narrate(NETCAFE_MSG.paid);
	}
	const n = await s.choose([...NETCAFE_MSG.menu], { cancel: 2 });
	if (n === 0) await netBrowse(ctx, s);
	else if (n === 1) await tradeTerminal(ctx, s);
};

/**
 * 外に 置く 物（地図の マス。調べると 文、遊べる 物は 遊ぶか 聞く）。見える 人（屋台の 店番）は 名前欄つきの
 * セリフで、eat なら セリフを 1つ → 品書き（ui/minigames/eat.ts）。
 */
export const outdoorScript =
	(ctx: Ctx, f: Facility, t: OutdoorThing): Script =>
	async (s) => {
		if (t.play === "eat" && t.name)
			await keeperTalk(ctx, s, f.id, t.name, t.lines);
		else {
			if (t.name)
				for (const l of t.lines) await s.say("nanj", l, { name: t.name });
			// 日で かわる 会場の 文（公園の 15日の 月食 など。data/jikkyo/text.ts）が あれば そちら
			else await readAll(s, venueLines(f.id, t.id, today()) ?? t.lines);
			// 町の 寄り道で 板を 見つける（釣り場の 竿の ビン。data/town/finds.ts）。見つけた 回は 遊ばない
			if (await townFind(s, f.id, t.id)) return;
			if (t.play === "fishing") await fish(s);
			else if (t.play === "batting") await bat(ctx, s);
			else if (t.play === "vend") await vend(s);
			else if (t.play === "eat") await eatAt(ctx, s, f.id);
			// 外で スマホの 実況（桟橋の 人力機・公園の 月食。ui/jikkyo/jikkyoWatch.ts）
			else if (t.play === "jikkyo")
				await watchProgram(ctx, s, f.id, previewStage() ?? loadTown().stage);
			// マイクラの 島の 物（ui/saba/saba.ts）
			else if (t.play === "saba") await sabaPlay(ctx, s, f, t.id, true);
			// ネタスレの 遊び（グラウンドの ランダム野球・5割の壁。ui/neta/neta.ts）
			else if (isNetaPlay(t.play)) await netaPlay(ctx, s, t.play);
			// おんJ芋煮会の 大鍋と 人（ui/minigames/imoni.ts）
			else if (t.play === "imoni") await imoniPlay(ctx, s, t);
		}
		// 見える 人は 話しおえたら もとの 向きに
		if (t.sprite) s.face(outdoorId(f, t), t.dir ?? "down");
	};

/** 飾りを 重ねる。 */
const joinDecor =
	(...ds: MapDef["decor"][]): MapDef["decor"] =>
	(g, ox, oy, t) => {
		for (const d of ds) d?.(g, ox, oy, t);
	};

/** 施設の 中の 地図。曲は 村の まま。 */
export const buildFacility = (
	plain: Facility,
	v: VillageView,
	ctx: Ctx,
	/** 駅の 改札などから 出かける（村の 口と 同じ 流れ。ui/village/villageEvents.ts の departAnywhere）。 */
	depart?: Script,
): MapDef => {
	// キリコの 家は 保存の 家具・壁紙・床で 組みなおす（ui/village/myhome.ts）
	const home = plain.id === "myhome";
	const f = home ? homeFacility(plain) : plain;
	const room = f.room;
	const events: EventDef[] = facilityRoomPlaces(f).map((p) => {
		if (p.trigger === "touch")
			return {
				id: p.id,
				x: p.x,
				y: p.y,
				trigger: "touch",
				through: true,
				run: leaveFacility(f),
			};
		const kind = p.id.replace(/_\d+$/, "");
		if (home) return sign(p.id, p.x, p.y, homeThing(ctx, kind));
		return sign(p.id, p.x, p.y, async (s) => {
			const play = room?.plays?.[kind];
			// 町役場・市役所の 中継モニター：議会の 日は 議会中継（ui/jikkyo/jikkyoGikai.ts）、ほかの 日は 部屋の 文
			if (play === "gikai" && (f.id === "townhall" || f.id === "cityhall")) {
				await watchGikai(ctx, s, f.id, v, room?.lines[kind] ?? []);
				return;
			}
			// 曜日で かわる 会場の 文（映画館の 金曜は 実況上映。data/jikkyo/text.ts）が あれば そちら
			await readAll(
				s,
				venueLines(f.id, kind, today()) ?? room?.lines[kind] ?? [],
			);
			// 町の 寄り道で 板を 見つける（質屋の ケース・おんJマートの はり紙・道場の 木刀。data/town/finds.ts）
			if (await townFind(s, f.id, kind)) return;
			if (play === "depart" && depart) await depart(s);
			else if (play === "drinkbar") await drinkBar(s);
			else if (play === "eat") await eatAt(ctx, s, f.id);
			// 実況の 番組（映画館の 実況上映・カジノの 競馬 ほか。番組表は data/jikkyo/schedule.ts、板は ui/jikkyo/jikkyoWatch.ts）
			else if (play === "jikkyo") await watchProgram(ctx, s, f.id, v.stage);
			// 町の 役所の 演壇（討論会）と 見分け方の はり紙（ui/minigames/debate.ts）
			else if (play === "debate") await debateScript(ctx, s, v);
			else if (play === "kiben") await kibenScript(ctx, s);
			else if (play === "minutes") await minutesScript(ctx, s);
			// 部室棟の 遊べる 物（ui/bushitsu/bushitsu.ts）
			else if (play === "bushitsu") await bushitsuThing(ctx, s, f, kind, v);
			// マイクラの 部屋の 物（ui/saba/saba.ts）
			else if (play === "saba") await sabaPlay(ctx, s, f, kind, false);
			// ネタスレの 遊び（リバーシ・!sk 習字・ID腹筋・コンマ。ui/neta/neta.ts）
			else if (isNetaPlay(play)) await netaPlay(ctx, s, play);
			// どすこいポイントの 照会（町役場の 1番窓口・市役所の 住民課。ui/minigames/dosukoi.ts）
			else if (play === "dosukoi") await dosukoiWindow(s, f.id);
			// ゲームセンターの 筐体（物の 名前が ゲームの 名前。ui/arcade/arcade.ts）
			else if (play === "arcade") await arcadePlay(ctx, s, kind);
			// リサイクルショップの レジ：家具を 買う（ui/village/myhome.ts）
			else if (play === "furnshop") await furnitureShop(ctx, s);
			// ヲタショップの レジ・ガチャ：グッズを 買う（ui/village/otaku.ts）
			else if (play === "otaku") await otakuPlay(ctx, s, kind);
			// ゲームセンターの プリクラ：仲良く なった 人と 撮る（ui/purikura/purikura.ts）
			else if (play === "purikura") await purikura(ctx, s);
			// おんJマートの ギフトの 棚：贈り物を 買う・誕生日の こよみ（ui/village/bonds.ts）
			else if (play === "giftshop") await giftShelf(ctx, s);
			// おんJ証券（ui/trade/trade.ts）：支店の 端末＝売り買い・おんJマートの ATM＝入金・出金・
			// 支店の 窓口＝口座の 開設と 入金・出金・支店の 電光ボード＝いまの 株価
			else if (play === "trade") await tradeTerminal(ctx, s);
			else if (play === "atm") await atmDesk(s);
			else if (play === "shoken") await shokenWindow(s);
			else if (play === "stockboard") await stockBoard(s);
			// 支店の パンフ：はじめての 人への 説明
			else if (play === "tradeguide") await guideRack(s);
			// ネットカフェの ブース：払って ネットと トレード
			else if (play === "netcafe") await netcafeBooth(ctx, s);
		});
	});
	for (const who of room?.people ?? [])
		events.push(
			npc(
				who.id,
				who.at[0],
				who.at[1],
				who.walk,
				async (s) => {
					// 番組の あとに 1回だけ 言う 1行（映画館の 係員：神エイム・再上映で のびた ★）
					const once = staffOnceLine(f.id, who.id);
					const lines = once
						? [once]
						: (staffLines(f.id, who.id, today()) ?? who.lines);
					// 店番：セリフを 1つ → 品書き（ui/minigames/eat.ts）
					if (who.play === "eat")
						await keeperTalk(ctx, s, f.id, who.name, lines);
					else
						for (const l of lines) await s.say("nanj", l, { name: who.name });
					// カジノの 換金所の 受付：ひとこと → 換金所の 窓（ui/arcade/casinoChips.ts）
					if (who.play === "cashier") await arcadePlay(ctx, s, "cashier");
					// 町の 寄り道で 板を 見つける（碁会所の 常連。data/town/finds.ts）
					await townFind(s, f.id, who.id);
					// キリコの 家を 買った あとなら、1度だけ 家具を くれる 住人（ui/village/myhome.ts）
					await residentGift(s, f.id, who.id, who.name);
					s.face(who.id, who.dir);
				},
				{ dir: who.dir },
			),
		);
	// 議会の 日の 議席・役の 住人（町役場・市役所。ui/village/civic.ts）
	events.push(...assemblyEvents(f, v));
	// キリコの 家に 招いた 人（ui/village/myhome.ts）
	const guest = home ? guestEvent() : null;
	if (guest) events.push(guest);
	// 畳の 床は 1枚ずつ 敷く（横・縦の 1畳と 半畳。data/village/tatami.ts）
	const laid = layRoomTatami(facilityRoomRows(f), facilityRoomPalette(f));
	return {
		id: facilityMapId(f),
		name: f.name,
		tiles: laid.tiles,
		rows: laid.rows,
		outside: "#000",
		events,
		onTalkEmpty: home ? homeEmpty(ctx) : undefined,
		// ベッドに ぶつかるか タップしたら 寝ころぶ（ui/village/myhome.ts）
		onBumpThing: home ? homeBump(ctx) : undefined,
		// 映画館の スクリーンと 客席の スマホの 光（ui/village/cinemaDecor.ts）・キリコの 家の 持っている 家具の 下見（ui/village/myhome.ts）
		// 板を 見つける 寄り道の 光る 点（ui/village/finds.ts）
		decor: home
			? homeDecor()
			: joinDecor(facilityDecor(f, facilityRoomRows(f)), roomFindGlint(f)),
		images: home ? homeImages() : undefined,
	};
};
