// 町が 育つと 建つ 施設の スクリプト（形と 文は data/village/facilities.ts）。
// 入る・出るは ほかの 建物と 同じ（扉の 文は 村に いる あいだ 1回 → 扉の 音 → 暗転 → 中 → 明転。出口の マットで 外へ）。
// 外の 物（釣り場の 竿・グラウンドの マウンド）は 調べると 文、遊べる 物は そのあと 遊ぶか 聞く。
// どれも 寄り道で、強さにも 冒険にも 何も 残さない（釣れた 物は すぐ 海に かえす）。

import { today } from "../data/calendar";
import { DRINK_BAR, FISHING, GROUND_BAT, VENDING } from "../data/facilities";
import { isVenue } from "../data/jikkyo/schedule";
import { staffLines, venueLines } from "../data/jikkyo/text";
import { awayFriends } from "../data/story";
import {
	type Facility,
	facilityEntry,
	facilityMapId,
	facilityOutside,
	facilityRoomPalette,
	facilityRoomPlaces,
	facilityRoomRows,
	facilityShadows,
	type OutdoorThing,
	outdoorId,
} from "../data/village/facilities";
import { npc, sign } from "../data/village/helpers";
import { coreShadows, type VillageView } from "../data/village/map";
import type { EventDef, MapDef, Script, Story } from "../engine/defs";
import { loadProgress } from "../engine/save";
import { TILE } from "../engine/types";
import { facilityDecor } from "./cinemaDecor";
import { assemblyEvents } from "./civic";
import type { Ctx } from "./ctx";
import { debateScript, kibenScript, minutesScript } from "./debate";
import { eatAt, keeperTalk } from "./eat";
import { staffOnceLine, watchProgram } from "./jikkyoWatch";
import { atBat, playDerby } from "./minigames";
import { fill } from "./villageTalk";

/** 調べる 物の 窓（窓ごと）。 */
const readAll = async (s: Story, lines: readonly string[]): Promise<void> => {
	for (const t of lines) await s.narrate(t);
};

/** 施設に 入る（扉の 文は 村に いる あいだ 1回）。 */
export const enterFacility =
	(f: Facility): Script =>
	async (s) => {
		const seen = `roomDoor:${facilityMapId(f)}`;
		if (f.door && !s.flag(seen)) {
			s.set(seen);
			await s.narrate(f.door);
		}
		s.se("door");
		await s.fadeOut(250);
		const e = facilityEntry(f);
		await s.warp(facilityMapId(f), e.x, e.y, e.dir);
		await s.fadeIn(250);
	};

/** 出口の マット：扉の 音 → 暗転 → 村（扉の 前）→ 明転。 */
const leaveFacility =
	(f: Facility): Script =>
	async (s) => {
		s.se("door");
		await s.fadeOut(250);
		const o = facilityOutside(f);
		await s.warp("village", o.x, o.y, o.dir);
		await s.fadeIn(250);
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
 * グラウンドの 1打席か ホームラン競争（投げるのは やきう。出ていった あとは 名無し。板は ui/batting.ts）。
 * B で 板を 閉じたら 何も 言わない。
 */
const bat = async (ctx: Ctx, s: Story): Promise<void> => {
	const n = await s.choose([...GROUND_BAT.menu], { cancel: 2 });
	if (n === 2) return;
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

/** 自販機（飲み物が 出る。見た目の 乱数なので Math.random）。 */
const vend = async (s: Story): Promise<void> => {
	if ((await s.choose([...VENDING.menu], { cancel: 1 })) !== 0) return;
	const drink =
		VENDING.drinks[Math.floor(Math.random() * VENDING.drinks.length)];
	await s.narrate(fill(VENDING.got, { drink }));
	await s.narrate(VENDING.drank);
};

/** ファミレスの ドリンクバー（1杯 注いで その場で 飲む。見た目の 乱数なので Math.random）。 */
const drinkBar = async (s: Story): Promise<void> => {
	if ((await s.choose([...DRINK_BAR.menu], { cancel: 1 })) !== 0) return;
	const drink =
		DRINK_BAR.drinks[Math.floor(Math.random() * DRINK_BAR.drinks.length)];
	await s.narrate(fill(DRINK_BAR.got, { drink }));
	await s.narrate(DRINK_BAR.drank);
};

/**
 * 外に 置く 物（地図の マス。調べると 文、遊べる 物は 遊ぶか 聞く）。見える 人（屋台の 店番）は 名前欄つきの
 * セリフで、eat なら セリフを 1つ → 品書き（ui/eat.ts）。
 */
export const outdoorScript =
	(ctx: Ctx, f: Facility, t: OutdoorThing): Script =>
	async (s) => {
		if (t.play === "eat" && t.name)
			await keeperTalk(ctx, s, f.id, t.name, t.lines);
		else {
			if (t.name)
				for (const l of t.lines) await s.say("nanj", l, { name: t.name });
			else await readAll(s, t.lines);
			if (t.play === "fishing") await fish(s);
			else if (t.play === "batting") await bat(ctx, s);
			else if (t.play === "vend") await vend(s);
			else if (t.play === "eat") await eatAt(ctx, s, f.id);
		}
		// 見える 人は 話しおえたら もとの 向きに
		if (t.sprite) s.face(outdoorId(f, t), t.dir ?? "down");
	};

/**
 * 建物の 影（村の 地図の 飾り。右がわの 地面に 斜めの 影。キャラの 上にも 重なるので、影に 入ると 少し 暗く 見える）。
 * 施設の 家と、住宅街からは 町の 中心の 建物（data/village/map.ts の coreShadows）。
 */
export const shadowDecor = (stage: number): MapDef["decor"] => {
	const list = [...facilityShadows(stage), ...coreShadows(stage)];
	if (!list.length) return undefined;
	const T = TILE;
	return (g, ox, oy) => {
		g.save();
		g.fillStyle = "rgba(10, 16, 30, 0.22)";
		for (const s of list) {
			const x = s.x * T - ox;
			const top = s.top * T - oy;
			const bottom = s.bottom * T - oy;
			g.beginPath();
			g.moveTo(x, top);
			g.lineTo(x + 10, top + 10);
			g.lineTo(x + 10, bottom + 4);
			g.lineTo(x, bottom);
			g.closePath();
			g.fill();
		}
		g.restore();
	};
};

/** 施設の 中の 地図。曲は 村の まま。 */
export const buildFacility = (
	f: Facility,
	v: VillageView,
	ctx: Ctx,
	/** 駅の 改札などから 出かける（村の 口と 同じ 流れ。ui/villageEvents.ts の departAnywhere）。 */
	depart?: Script,
): MapDef => {
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
		return sign(p.id, p.x, p.y, async (s) => {
			// 曜日で かわる 会場の 文（映画館の 金曜は 実況上映。data/jikkyo/text.ts）が あれば そちら
			await readAll(
				s,
				venueLines(f.id, kind, today()) ?? room?.lines[kind] ?? [],
			);
			const play = room?.plays?.[kind];
			if (play === "depart" && depart) await depart(s);
			else if (play === "drinkbar") await drinkBar(s);
			else if (play === "eat") await eatAt(ctx, s, f.id);
			// 実況の 番組（映画館の 実況上映。ui/jikkyoWatch.ts）
			else if (play === "jikkyo" && isVenue(f.id))
				await watchProgram(ctx, s, f.id, v.stage);
			// 町の 役所の 演壇（討論会）と 見分け方の はり紙（ui/debate.ts）
			else if (play === "debate") await debateScript(ctx, s, v);
			else if (play === "kiben") await kibenScript(ctx, s);
			else if (play === "minutes") await minutesScript(ctx, s);
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
					// 店番：セリフを 1つ → 品書き（ui/eat.ts）
					if (who.play === "eat")
						await keeperTalk(ctx, s, f.id, who.name, lines);
					else
						for (const l of lines) await s.say("nanj", l, { name: who.name });
					s.face(who.id, who.dir);
				},
				{ dir: who.dir },
			),
		);
	// 議会の 日の 議席・役の 住人（町役場・市役所。ui/civic.ts）
	events.push(...assemblyEvents(f, v));
	return {
		id: facilityMapId(f),
		name: f.name,
		tiles: facilityRoomPalette(f),
		rows: facilityRoomRows(f),
		outside: "#000",
		events,
		// 映画館の スクリーンと 客席の スマホの 光（ui/cinemaDecor.ts。ほかの 施設は 無し）
		decor: facilityDecor(f, facilityRoomRows(f)),
	};
};
