// ホシュクラ（data/village/saba.ts の 島）の 遊び。外の 物・部屋の 物は play:"saba" で ここへ 来る
// （ui/facilities.ts の outdoorScript・buildFacility が 文を 読んだ あと sabaPlay を 呼ぶ）。
// - 鯖缶：日で かわる お知らせ 1窓（土曜の 鯖イベ・夜・朝やで・日曜・帰りごとの お知らせ）
// - 謎の 上級者：湧き潰しの 小言（帰りに 1回。n回目）
// - ブラマイ場：板（ui/sabaMine.ts）。ダイヤの 記録
// - 投票箱：段ごとの 命名投票（開票は 次の 帰り）。初期スポの 看板に 決まった 名前
// - ウーパールーパーの 水槽：帰りで かわる 1窓（引っ越しの はり紙・ぴかぴか・はり紙が ふえる）
// - アパートの 表札・102号室：表札を 書くと 入居（記録だけ）
// - 共有チェスト：中身は 見た目の 乱数（Math.random）
// - 豆腐ハウスの ベッド：夜だけ 寝られる（朝やで。その 帰りの あいだ 匠は 出ない）
// - 夜の 島で はじめて 物に ふれたら キリコの うしろに 匠（ｼｭ~ → ふりむく → なにも 起きない → 去る。帰りごとに 1回。
//   3窓の >>1 の 看板の あとには 出さない）
// 「その 帰りの あいだ」の 印は 村の 旗に 帰りの 時刻（ui/guests.ts の returnAt）を 入れて 見分ける（旗は ページを
// 閉じるまで 残るので、真偽だけだと 次の 帰りにも 残る）。
// sabaEvents は 村の 地図の 人（ui/villageEvents.ts の buildVillage）：豚レース場の 豚（うろうろ）と 匠（ふだんは いない）。
// 記録は kiriko-roguelike/saba だけ（段の 下見 ?stage=・?event= の あいだは 書かない）。強さ・道具・段には ふれない。

import { nowHour, type Today, today } from "../data/calendar";
import { devEvent } from "../data/objectives";
import {
	countReturn,
	isleMap,
	isNight,
	noticeOf,
	parseSaba,
	pendingResult,
	type SabaSave,
	takumiCell,
	takumiLeave,
	tankLine,
	townName,
	type VoteStage,
	voteResult,
} from "../data/saba";
import { TAKUMI_WALK } from "../data/sabaSheet";
import { SABA_TEXT as X } from "../data/sabaText";
import type { Facility } from "../data/village/facilities";
import { npc } from "../data/village/helpers";
import type { VillageView } from "../data/village/map";
import type { EventDef, Story } from "../engine/defs";
import { loadTown } from "../engine/save";
import type { Dir } from "../engine/types";
import type { Ctx } from "./ctx";
import { returnAt } from "./guests";
import { playMine } from "./sabaMine";
import { previewStage } from "./villageReturn";
import { fill } from "./villageTalk";

// ───────────────── 記録 ─────────────────

const KEY = "kiriko-roguelike/saba";
let memo: SabaSave | null = null;

const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

export const loadSaba = (): SabaSave => {
	if (!memo) {
		let raw: unknown = null;
		try {
			raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		} catch {}
		memo = parseSaba(raw);
	}
	return structuredClone(memo);
};

/** 書く（段の 下見の あいだは 覚えるだけ）。 */
export const saveSaba = (s: SabaSave, noSave = previewing()): void => {
	memo = structuredClone(s);
	if (noSave) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(s));
	} catch {}
};

export const forgetSabaMemo = (): void => {
	memo = null;
};

// ───────────────── いま（試験で 差しかえる） ─────────────────

export type SabaNow = {
	stage: number;
	at: number;
	hour: number;
	day: Today;
};
let nowHook: (() => Partial<SabaNow>) | null = null;
export const setSabaNow = (h: typeof nowHook): void => {
	nowHook = h;
};
const sabaNow = (): SabaNow => ({
	stage: previewStage() ?? loadTown().stage,
	at: returnAt(),
	hour: nowHour(),
	day: today(),
	...(nowHook?.() ?? {}),
});

/** 島に ふれた ときの 記録（帰りを 数える）。 */
const touch = (now: SabaNow): SabaSave => {
	const s = loadSaba();
	if (countReturn(s, now.at)) saveSaba(s);
	return s;
};

// ───────────────── 村の 地図の 人（豚・匠） ─────────────────

export const TAKUMI_ID = "saba_takumi";
export const PIG_ID = "saba_pig";
/** 匠を 見せている あいだ（村の 地図の 人の when）。 */
const TAKUMI_FLAG = "saba:takumi";
/** この 帰りに 匠が 出た（値は 帰りの 時刻）。 */
export const TAKUMI_SEEN = "saba:takumiSeen";
/** この 帰りに 豆腐ハウスで 寝た（値は 帰りの 時刻）。 */
export const ASA = "saba:asa";
/** 鯖缶の 湧き潰しの 小言は「（37回目）」から（スレでは もう 何度も 言っている）。 */
export const NAG_BASE = 36;
/** いま 描いている 村（匠の マスを 選ぶ）。 */
let lastView: VillageView | null = null;

/** buildVillage の 人に 足す（段2 から 匠、段3 から 豚）。 */
export const sabaEvents = (v: VillageView): EventDef[] => {
	lastView = v;
	if (v.stage < 2) return [];
	const out: EventDef[] = [
		// ふだんは いない（旗の あいだだけ。takumiScene が キリコの うしろに 置く）
		npc(TAKUMI_ID, 11, 47, TAKUMI_WALK, async () => {}, {
			when: (st) => !!st.flags[TAKUMI_FLAG],
		}),
	];
	if (v.stage >= 3)
		out.push(
			// 豚レース場の 走路（12〜16, 47。柵の 外へは 出られない）。柵ごしに 話す
			npc(
				PIG_ID,
				14,
				47,
				"sa:7Cqdmq",
				async (s) => {
					for (const l of X.pig) await s.narrate(l);
					await takumiScene(s);
				},
				{ dir: "left", wander: true },
			),
		);
	return out;
};

const toward = (fx: number, fy: number, tx: number, ty: number): Dir =>
	Math.abs(tx - fx) >= Math.abs(ty - fy)
		? tx > fx
			? "right"
			: "left"
		: ty > fy
			? "down"
			: "up";

/** この 帰りに 寝たか。 */
const slept = (s: Story, now: SabaNow): boolean => s.flag(ASA) === now.at;

/**
 * 夜の 島で 帰りごとに 1回：キリコの うしろに 匠（ｼｭ~ → ふりむく → なにも 起きない → 去る）。
 * n は 島に 来た 帰りの 数（ふりむいた ときの 文が 交互に かわる）。
 */
export const takumiScene = async (
	s: Story,
	now = sabaNow(),
	n = loadSaba().n,
): Promise<void> => {
	const v = lastView;
	if (
		!v ||
		now.stage < 2 ||
		!isNight(now.hour) ||
		slept(s, now) ||
		s.flag(TAKUMI_SEEN) === now.at
	)
		return;
	const { x, y, dir } = s.state;
	const m = isleMap(v);
	const c = takumiCell(m, x, y, dir);
	// 立てる マスが ない ときは 出さない（次に ふれた ときに また さがす）
	if (!c) return;
	s.set(TAKUMI_SEEN, now.at);
	const [tx, ty] = c;
	await s.wait(0);
	s.set(TAKUMI_FLAG);
	s.show(TAKUMI_ID);
	s.place(TAKUMI_ID, tx, ty, toward(tx, ty, x, y));
	s.se("skill_warpPlayer");
	await s.narrate(X.takumi[0]);
	s.face("player", toward(x, y, tx, ty));
	await s.narrate(X.takumiTurn[n % X.takumiTurn.length]);
	await s.narrate(X.takumi[1]);
	// キリコから はなれる 向き（ふさがって いれば 左右）へ 2歩 歩いて 消える
	s.se("steal");
	const route = takumiLeave(m, x, y, tx, ty);
	if (route) await s.move(TAKUMI_ID, route);
	s.hide(TAKUMI_ID);
	s.set(TAKUMI_FLAG, false);
};

// ───────────────── 遊び ─────────────────

/** 鯖缶の お知らせ。 */
const sabakan = async (s: Story, now: SabaNow, sv: SabaSave): Promise<void> => {
	const line = noticeOf({
		n: sv.n,
		stage: now.stage,
		day: now.day,
		hour: now.hour,
		asa: slept(s, now),
	});
	await s.say("nanj", line, { name: "鯖缶" });
};

/** 謎の 上級者：湧き潰しの 小言（帰りに 1回）。 */
const nag = async (s: Story, now: SabaNow, sv: SabaSave): Promise<void> => {
	if (sv.nagAt === now.at) return;
	sv.nag += 1;
	sv.nagAt = now.at;
	saveSaba(sv);
	await s.say("nanj", fill(X.nag, { n: NAG_BASE + sv.nag }), {
		name: "謎の　上級者",
	});
};

/** ブラマイ場。 */
const mine = async (ctx: Ctx, s: Story, sv: SabaSave): Promise<void> => {
	if (sv.mine.best > 0)
		await s.narrate(fill(X.mineRecord, { n: sv.mine.best }));
	if ((await s.choose([...X.mineMenu], { cancel: 1 })) !== 0) return;
	await s.wait(0);
	const r = await playMine(ctx);
	if (!r) return;
	const after = loadSaba();
	after.mine.runs += 1;
	after.mine.total += r.dia;
	const best = r.dia > after.mine.best;
	if (best) after.mine.best = r.dia;
	saveSaba(after);
	const tail = r.dia > 0 ? fill(X.mineTail, { n: r.dia }) : X.mineTail0;
	await s.narrate(fill(X.mineAfter[r.end], { tail }));
	if (best) await s.narrate(fill(X.mineBest, { n: r.dia }));
};

/** 投票箱（開票の 知らせ → いまの 名前 → まだ なら 投票）。 */
const vote = async (s: Story, now: SabaNow, sv: SabaSave): Promise<void> => {
	const cur = Math.min(now.stage, 7);
	const done = pendingResult(sv, cur, now.at);
	if (done !== null) {
		const rec = sv.votes[String(done)] ?? { pick: -1, at: -1, told: false };
		const r = voteResult(rec.pick);
		const names = X.cands[done as VoteStage];
		// 古い 段の 開票も まとめて 知らせた ことに
		for (let st = 3; st <= done; st++) {
			const v = sv.votes[String(st)];
			sv.votes[String(st)] = v
				? { ...v, told: true }
				: { pick: -1, at: -1, told: true };
		}
		saveSaba(sv);
		await s.narrate(
			r.runoff
				? fill(X.voteRunoff, { name: names[r.win] })
				: fill(X.voteResult, { name: names[r.win], other: names[r.other] }),
		);
	} else await s.narrate(fill(X.voteName, { name: townName(sv, cur, now.at) }));
	if (cur < 3) return;
	const rec = sv.votes[String(cur)];
	if (rec && rec.pick >= 0) {
		if (rec.at === now.at) await s.narrate(X.voteWait);
		return;
	}
	const cands = X.cands[cur as VoteStage];
	const pick = await s.choose([...cands, X.voteStop], { cancel: cands.length });
	if (pick < 0 || pick >= cands.length) return;
	sv.votes[String(cur)] = { pick, at: now.at, told: false };
	saveSaba(sv);
	s.se("read");
	await s.narrate(X.voteDone);
};

/**
 * 豆腐ハウスの ベッド（朝やで）。鯖民の「誰や 寝てないのは」→ キリコが もぐる → 暗転（文は 出さない。
 * 暗転の 幕は 窓より 上に 重なる）→ 明けて 鯖缶の「朝やで」。
 */
const bed = async (s: Story, now: SabaNow): Promise<void> => {
	if (!isNight(now.hour)) {
		await s.narrate(X.bedDay);
		return;
	}
	if (slept(s, now)) {
		await s.narrate(X.bedMorning);
		return;
	}
	if ((await s.choose([...X.bedMenu], { cancel: 1 })) !== 0) return;
	await s.say("nanj", X.bedWho, { name: "鯖民" });
	await s.narrate(X.bedSleep);
	s.se("sleep");
	await s.fadeOut(400);
	await s.wait(700);
	s.set(ASA, now.at);
	s.se("chapter");
	await s.fadeIn(400);
	await s.say("nanj", X.bedAsa, { name: "鯖缶" });
};

/** 102号室（表札を 書けば 入居）。 */
const room102 = async (s: Story, sv: SabaSave): Promise<void> => {
	if (sv.apart) {
		await s.narrate(X.room102In);
		return;
	}
	await s.narrate(X.room102Empty);
	if ((await s.choose([...X.room102Menu], { cancel: 1 })) !== 0) return;
	sv.apart = true;
	saveSaba(sv);
	s.se("read");
	await s.narrate(X.room102Write);
};

/**
 * play:"saba" の 物（id は 物の id。outdoor は 島の 外の 物＝夜の 匠が 出る 所）。文（lines）は 呼ぶ 前に 読んである。
 */
export const sabaPlay = async (
	ctx: Ctx,
	s: Story,
	_f: Facility,
	id: string,
	outdoor: boolean,
): Promise<void> => {
	const now = sabaNow();
	const sv = touch(now);
	switch (id) {
		case "sabakan":
			await sabakan(s, now, sv);
			break;
		case "joukyu":
			await nag(s, now, sv);
			break;
		case "mine":
			await mine(ctx, s, sv);
			return; // 板の あとに 匠は 出さない
		case "vote":
			await vote(s, now, sv);
			break;
		case "town":
			await s.narrate(
				fill(X.townSign, {
					name: townName(sv, Math.min(now.stage, 7), now.at),
				}),
			);
			break;
		case "tank": {
			const l = tankLine(sv.n);
			if (l) await s.narrate(l);
			break;
		}
		case "plate":
			await s.narrate(sv.apart ? X.plateKiriko : X.plateEmpty);
			break;
		case "room102":
			await room102(s, sv);
			break;
		case "chest":
			s.se("item");
			await s.narrate(
				fill(X.chestGot, {
					item: X.chestItems[Math.floor(Math.random() * X.chestItems.length)],
				}),
			);
			break;
		case "bed":
			await bed(s, now);
			break;
	}
	// >>1 の 看板（3窓）の あとには 出さない
	if (outdoor && id !== "rules") await takumiScene(s, now, sv.n);
};
