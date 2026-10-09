// おんJ芋煮会の スクリプト（文と 日の 決まりは data/imoni.ts、かまどは data/village/season.ts）。
// まとめ掲示板の はり紙（10月）・大鍋（いつでも 調べられる。強行開催の 帰りは こんにゃく論争と 芋煮）・実行委員と 名無しの
// セリフ・火と 湯気の 飾り・10月の 帰りの 数え。
// 食べても 何も 持ちこまない（満腹度・道具・強さ・記録には ふれない）。保存は kiriko-roguelike/imoni だけ。

import { nowYear, today } from "../data/calendar";
import {
	devImoniPhase,
	IMONI,
	IMONI_ART,
	IMONI_POT,
	IMONI_SCENE,
	type ImoniKon,
	type ImoniPhase,
	imoniKonNow,
	imoniPhaseNow,
	imoniReasonNow,
	imoniReturnAt,
	imoniVisit,
	loadImoni,
	saveImoni,
} from "../data/imoni";
import { awayFriends } from "../data/story";
import type { OutdoorThing } from "../data/village/facilities";
import type { Cell } from "../data/village/map";
import { cropOf, getImage } from "../engine/assets";
import type { MapDef, Story } from "../engine/defs";
import { loadProgress } from "../engine/save";
import { type Dir, TILE } from "../engine/types";
import type { Ctx } from "./ctx";
import { showDish } from "./eat";
import { sayAs } from "./villageMobs";
import { previewStage, villageView } from "./villageReturn";

/** 試験で さしかえる もの（年・帰り・段階・保存するか・やきうが いるか・一品の 板）。 */
export type ImoniEnv = {
	year: number;
	at: number;
	phase: ImoniPhase;
	noSave: boolean;
	yakiuHere: boolean;
	show: (art: string, title: string) => Promise<void>;
};

/** 下見（?stage=）と 開発の &imoni= では 保存しない。 */
const noSaveNow = (): boolean =>
	previewStage() !== null || devImoniPhase() !== null;

const liveEnv = (ctx: Ctx): ImoniEnv => ({
	year: nowYear(),
	at: imoniReturnAt(),
	phase: imoniPhaseNow(),
	noSave: noSaveNow(),
	yakiuHere: !awayFriends(loadProgress().cleared, villageView().stage).includes(
		"nanj",
	),
	show: (art, title) => showDish(ctx, art, title),
});

/**
 * 村の 地図を 組む たび（ui/villageEvents.ts の buildVillage）：10月の 帰りを 数えてから、いまの 段階を 返す
 * （同じ 帰りなら 数えない。建て直し・読みなおし・試験で ふえない）。
 */
export const imoniArrive = (): ImoniPhase => {
	const r = loadImoni();
	const next = imoniVisit(r, today(), nowYear(), imoniReturnAt());
	if (next !== r) saveImoni(next, noSaveNow());
	return imoniPhaseNow();
};

/** まとめ掲示板の メニューの 1行（10月だけ）。 */
export const imoniBoardMenu = (
	phase: ImoniPhase = imoniPhaseNow(),
): string | null => (phase === "off" ? null : IMONI.board.menu);

/** まとめ掲示板の はり紙（中止の わけと 請求書・強行開催・来年の 中止）。 */
export const imoniBoardScript = async (
	s: Story,
	phase: ImoniPhase = imoniPhaseNow(),
	reason: number = imoniReasonNow(),
): Promise<void> => {
	const b = IMONI.board;
	const pages =
		phase === "notice"
			? [b.title, b.reasons[reason] ?? b.reasons[0], b.invoice]
			: phase === "open"
				? [b.title, b.open, b.smoke]
				: phase === "done"
					? [b.doneTitle, b.doneReply]
					: [];
	for (const p of pages) await s.narrate(p);
};

const bowlArt = (kon: ImoniKon | null): string =>
	kon === "in" ? IMONI_ART.bowlKon : IMONI_ART.bowl;

/** from から to を 向く 向き（たて・よこの 大きい方）。 */
const faceToward = (from: { x: number; y: number }, [x, y]: Cell): Dir => {
	const dx = x - from.x;
	const dy = y - from.y;
	return Math.abs(dx) >= Math.abs(dy)
		? dx < 0
			? "left"
			: "right"
		: dy < 0
			? "up"
			: "down";
};

/** 大鍋（ふだんは ふた。10月は ちらし。開催の 帰りは こんにゃく論争 → 芋煮 → ぷゆゆと やきう）。 */
export const imoniPot = async (s: Story, env: ImoniEnv): Promise<void> => {
	const r = loadImoni();
	const o = IMONI.open;
	const N = IMONI.names;
	if (env.phase !== "open") {
		await s.narrate(IMONI.pot.look);
		await s.narrate(
			env.phase === "notice"
				? IMONI.pot.flyer
				: env.phase === "done"
					? IMONI.pot.warm
					: r.ever
						? IMONI.pot.soot
						: IMONI.pot.never,
		);
		return;
	}
	// 同じ 帰りに もう 食べた：おかわり
	if (r.held === env.year) {
		await s.narrate(o.boil);
		if ((await s.choose([...o.more], { cancel: 1 })) !== 0) return;
		await s.wait(0);
		await env.show(bowlArt(r.kon), o.dish);
		s.se("eat");
		await s.narrate(o.refill);
		return;
	}
	const first = !r.ever;
	await s.narrate(first ? o.first : o.again);
	await s.say("nanj", o.pro, { name: N.pro });
	await s.say("nanj", o.anti, { name: N.anti });
	await s.say("nanj", o.pro2, { name: N.pro });
	// 論争は 決めるまで 終わらない（B では ぬけない）
	const kon: ImoniKon = (await s.choose([...o.options])) === 0 ? "in" : "out";
	if (kon === "in") {
		s.se("bubble");
		await s.narrate(o.putIn);
	} else await s.narrate(o.leaveOut);
	await s.say("nanj", o.won, { name: kon === "in" ? N.pro : N.anti });
	// 食べる 前に 書く（板の 途中で 閉じても 今年は 来た ことに。10月の 帰りの 数は そのまま）
	saveImoni(
		{ ...r, held: env.year, heldAt: env.at, kon, ever: true },
		env.noSave,
	);
	await s.wait(0);
	await env.show(bowlArt(kon), o.dish);
	s.se("eat");
	await s.narrate(o.eat[kon === "in" ? 0 : 1]);
	// ぷゆゆ（と やきう）が かけてくる。終わったら 暗転して 建て直し、みんな 持ち場へ（deathScene と 同じ）。
	// 住人は もう よけないので、(2,35) で 読んだ キリコは 鍋・入れる派・岩・ぷゆゆに かこまれて 出られなく なる
	try {
		await s.goto("mob_puyu", IMONI_SCENE.puyu[0], IMONI_SCENE.puyu[1], {
			speed: 1.6,
		});
		s.face("mob_puyu", "player");
		s.face("player", faceToward(s.state, IMONI_SCENE.puyu));
		await sayAs(s, "puyu", o.puyu[first ? 0 : 1]);
		if (env.yakiuHere) {
			await s.goto("nanj", IMONI_SCENE.yakiu[0], IMONI_SCENE.yakiu[1]);
			s.face("nanj", "player");
			await s.say("nanj", o.yakiu[first ? 0 : 1]);
		}
	} finally {
		await s.fadeOut(300);
		await s.rebuild();
		await s.fadeIn(300);
	}
};

/** 実行委員と 名無し（食べる 前と、こんにゃくの 決着の あと）。 */
export const imoniStaff = async (
	s: Story,
	t: Pick<OutdoorThing, "id" | "name">,
	env: Pick<ImoniEnv, "year">,
): Promise<void> => {
	const r = loadImoni();
	const ate = r.held === env.year;
	const st = IMONI.staff;
	let lines: readonly string[];
	if (t.id === "chair") lines = ate ? st.chair.after : st.chair.before;
	else if (t.id === "pro")
		lines = !ate ? st.pro.before : r.kon === "in" ? st.pro.in : st.pro.out;
	else
		lines = !ate ? st.anti.before : r.kon === "out" ? st.anti.out : st.anti.in;
	for (const l of lines) await s.say("nanj", l, { name: t.name ?? "" });
};

/** 外の 物の 遊び imoni（ui/facilities.ts の outdoorScript から）。 */
export const imoniPlay = (
	ctx: Ctx,
	s: Story,
	t: OutdoorThing,
	env: ImoniEnv = liveEnv(ctx),
): Promise<void> => (t.id === "pot" ? imoniPot(s, env) : imoniStaff(s, t, env));

// ───────────────── 火と 湯気（開催の 帰りの 村の 地図だけ） ─────────────────

const FLAME = ["#e85818", "#ff9828", "#ffd660"] as const;

/** かまどの 口の 火（3本。110ms ごとに 高さが かわる）。x, y は 鍋の 絵の 左上（画面の 画素）。 */
const flames = (
	g: CanvasRenderingContext2D,
	x: number,
	y: number,
	t: number,
): void => {
	const f = Math.floor(t / 110);
	for (let i = 0; i < 3; i++) {
		const h = 2 + ((f + i * 2) % 3) + (i === 1 ? 1 : 0);
		for (let k = 0; k < h; k++) {
			g.fillStyle = k < 2 ? FLAME[0] : k < h - 1 ? FLAME[1] : FLAME[2];
			g.fillRect(x + 13 + i * 2, y + 29 - k, 2, 1);
		}
	}
};

/** 鍋の 湯気（3つ。ふちは 市松に 間引く。ui/bath.ts の もやと 同じ 見え方）。 */
const steam = (
	g: CanvasRenderingContext2D,
	x: number,
	y: number,
	t: number,
): void => {
	for (let i = 0; i < 3; i++) {
		const a = (t / 2600 + i / 3) % 1;
		const cx = Math.round(x + 10 + i * 6 + Math.sin(a * 6 + i) * 2);
		const cy = Math.round(y + 8 - a * 26);
		const r = 1 + Math.round(a * 3);
		g.fillStyle = `rgba(245,245,245,${(Math.sin(a * Math.PI) * 0.55).toFixed(2)})`;
		for (let dy = -r; dy <= r; dy++)
			for (let dx = -r; dx <= r; dx++) {
				const d = dx * dx + dy * dy;
				if (d <= r * r && (d < (r - 1) * (r - 1) || ((dx + dy) & 1) === 0))
					g.fillRect(cx + dx, cy + dy, 1, 1);
			}
	}
};

/**
 * 開催の 帰りだけ：ふたを とった 芋煮・かまどの 火・湯気（ui/villageEvents.ts の buildVillage の decor）。
 * 絵は 外観の マス（同じ season.png）と いっしょに 先読み 済み。ここでは 読みこまない（node の 試験には Image が ない）。
 * 鍋の 絵（こんにゃく 入りか）は 組む ときに 決める（食べた あとの 建て直しで かわる）。
 */
export const imoniDecor = (
	phase: ImoniPhase,
	kon: ImoniKon | null = imoniKonNow(),
): MapDef["decor"] => {
	if (phase !== "open") return undefined;
	const ref = kon === "in" ? IMONI_ART.litKon : IMONI_ART.lit;
	const crop = cropOf(ref);
	const px = IMONI_POT[0] * TILE;
	const py = IMONI_POT[1] * TILE;
	return (g, ox, oy, t) => {
		const x = px - ox;
		const y = py - oy;
		const img = getImage(ref);
		if (img && crop)
			g.drawImage(
				img,
				crop.sx,
				crop.sy,
				crop.sw,
				crop.sh,
				x,
				y,
				crop.sw,
				crop.sh,
			);
		flames(g, x, y, t);
		steam(g, x, y, t);
	};
};
