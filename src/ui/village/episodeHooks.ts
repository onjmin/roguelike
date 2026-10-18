// 話の つなぎの 場面（data/story/hooks.ts の 文を 演じる）。本筋の 話を 持ち帰った その 帰りに 1回だけ、
// 開く 知らせ（newsScript）と 見出し（villageEvents.ts の freshHeadlineScript）の 前に 流す。
// 立ち話で 終わらせない：人が 歩いて 集まる・イメージ図（engine/sceneCard.ts）・回想（sceneFx の memory）・
// 夜の 行進を カメラで 追う・見出しを 貼る 人影（いちばん 最初の 村の 天丼）。

import { holdShiyoShift } from "../../data/people/shiyoShift";
import {
	BATH_EVE,
	colonyCard,
	factionCard,
	KINOKO_EVE,
	routeCard,
} from "../../data/story/hooks";
import { DUNGEON_NAMES } from "../../data/story/story";
import { BOARD_NEWS, HEADLINES } from "../../data/town/headlines";
import {
	INCIDENTS,
	incidentPlaceId,
	VISITORS,
} from "../../data/town/incidents";
import { VILLAGE_SPOTS } from "../../data/village/map";
import type { Story } from "../../engine/defs";
import {
	addFlag,
	doneProgressNews,
	hasFlag,
	loadProgress,
} from "../../engine/save";
import { showCard } from "../../engine/sceneCard";
import { fxRoot, startFx } from "../../engine/sceneFx";
import { endMarks, putMark, takeMark } from "./sceneMarks";
import { setSceneSky } from "./sceneSky";
import { villageSong } from "./villageMusic";
import { villageView, visitScript } from "./villageReturn";
import { fill } from "./villageTalk";

type Cell = readonly [number, number];

const EVE_FLAG = "eve_kinoko";

/** 見出しを 貼りに くる 人影（いちばん 最初の 村と 同じ 来客の 人。ui/village/villageOpening.ts）。 */
const POSTER = "visitor";

/** パン板を はじめて 持ち帰った 帰り（きのこ板が 開く 知らせが まだ 残って いる）。 */
export const kinokoEveDue = (): boolean => {
	const p = loadProgress();
	return (
		!hasFlag(EVE_FLAG) &&
		!p.cleared.includes("kinoko") &&
		p.news.some((n) => n.dungeon === "kinoko")
	);
};

const T = KINOKO_EVE;

/** きのこ軍の 3人（騒ぎの 人）と、広場の パン兵（ご近所）。 */
const kinokoArmy = () =>
	(INCIDENTS.find((i) => i.dungeon === "kinoko")?.people ?? []).map((p) => ({
		id: incidentPlaceId(p),
		at: p.at,
		dir: p.dir,
	}));
const panhei = () => {
	const p = VISITORS.find((v) => v.dungeon === "shallow");
	return p ? { id: incidentPlaceId(p), at: p.at, dir: p.dir } : null;
};

/** 仲間でない 人の 1窓（名前欄だけ。立ち絵なし）。 */
const as = (
	s: Story,
	name: string,
	text: string,
	emote?: "!" | "?" | "汗" | "怒" | "…",
) => s.say("nanj", text, { name, noPortrait: true, emote });

const kinoko = (s: Story, text: string, emote?: "怒" | "汗") =>
	as(s, T.kinokoName, `${T.kinokoFace}${text}`, emote);

/** 第一話 → 第二話：その夜の 広場・イメージ図・2015年の 回想・近道の 図・夜の 行進・人影の 見出し。 */
export const kinokoEveScript = async (s: Story): Promise<void> => {
	addFlag(EVE_FLAG);
	const root = fxRoot();
	const army = kinokoArmy();
	const pan = panhei();
	const [bx, by] = VILLAGE_SPOTS.boot;
	const nanjHome = VILLAGE_SPOTS.nanj(villageView());
	const homes: Record<"roze" | "zero" | "nanj", Cell> = {
		roze: VILLAGE_SPOTS.roze,
		zero: VILLAGE_SPOTS.zero,
		nanj: nanjHome,
	};

	// ── その夜の 広場（ふだん → ある日。パン兵は 店を 出し、行進の 人は まだ いない）
	await s.fadeBgm(400);
	await s.fadeOut(500);
	// きのこ板が 開いた 知らせは この 場面が 引きうける（村を 建て直して 行進の 人を 地図に 出す。
	// 見出し・はぐれた 名無し・「もぐれる」は 翌朝に ここで 見せる）
	const news = loadProgress().news.find((n) => n.dungeon === "kinoko");
	if (news) doneProgressNews(news);
	// 夜に してから 建て直す（村の 時計も 夜。通りの 人も 夜の 数）
	setSceneSky("night");
	await s.rebuild();
	for (const k of army) s.hide(k.id);
	s.place("player", bx, by, "left");
	for (const [w, c] of Object.entries(homes)) s.place(w, c[0], c[1], "down");
	await s.fadeIn(500);
	s.bgm("yofukashi");
	if (pan) await s.look(pan.id);
	await s.narrate(T.night);
	if (pan) {
		s.face(pan.id, "right");
		s.face("player", "left");
		// 地の文の「パンを並べていた」：パン兵の 前に 独立記念の パン（ui/village/sceneMarks.ts。翌朝まで）
		putMark("bread");
		s.se("put");
		await as(s, T.panheiName, T.panheiSell);
	}
	await s.look(null);
	// ロゼが パンを 買いに 来て、食べながら きく（説明の 間も だれかが 動いて いる）
	await s.goto("roze", bx - 1, by + 1, { speed: 1.6, avoid: true });
	s.face("roze", "up");
	s.se("eat");
	await s.say("roze", T.rozeAsk, { emote: "?" });
	if (pan) await as(s, T.panheiName, T.panheiBlank, "汗");
	s.face("player", "down");
	await s.kiriko(T.kirikoAsk, "voice", { emote: "?" });
	// ゼロが かけて くる → イメージ図
	await s.goto("zero", bx + 1, by + 1, { speed: 2.4, avoid: true });
	s.face("zero", "player");
	await s.say("zero", T.zeroDraw, { emote: "!" });
	const card = showCard(root, colonyCard(0));
	s.se("cardFlip");
	await s.say("zero", T.zeroChain);
	card.update(colonyCard(1));
	s.se("hit_fist");
	await s.say("zero", T.zeroCut);
	card.update(colonyCard(2));
	await s.kiriko(T.kirikoLeft, "voice");
	if (pan) await as(s, T.panheiName, T.panheiForgot, "汗");
	card.end();
	// やきうが 家から 来て つっこみ、昔の 話（知らない 新入りに 古参が 話す）
	await s.goto("nanj", bx, by - 2, { speed: 1.8, avoid: true });
	s.face("nanj", "down");
	s.face("player", "up");
	await s.say("nanj", T.nanjTsukkomi, { emote: "驚", hit: "slap" });
	await s.say("nanj", T.nanjHistory, { emote: "…" });

	// ── 回想：2015年の 夏、きのこ板に 食パンの 旗（人は 動く。立ち絵を しまって 町を 見せる）
	await s.wait(0);
	await s.fadeBgm(300);
	const lead = army[1] ?? army[0];
	const memo = startFx(root, "memory", { caption: T.memoryCaption });
	s.bgm("sad");
	for (const k of army) {
		s.show(k.id);
		s.place(k.id, k.at[0], k.at[1], "down");
	}
	if (lead && pan) s.place(pan.id, lead.at[0], lead.at[1] + 4, "up");
	if (lead) await s.look([lead.at[0], lead.at[1] + 1]);
	await memo.ready;
	if (lead && pan) {
		await s.narrate(T.memoryCame);
		await s.goto(pan.id, lead.at[0], lead.at[1] + 1, { speed: 1.2 });
		s.face(pan.id, "up");
		s.se("put");
		putMark("flag");
		await s.narrate(T.memoryFlag);
		await as(s, T.panheiName, T.memoryPanhei);
		await kinoko(s, T.memoryKinoko, "怒");
		await as(s, T.panheiName, T.memoryPanhei2);
		s.se("eat");
		takeMark("flag");
		await kinoko(s, T.memoryKinoko2, "汗");
	}
	// 回想の 語りは 声だけ（立ち絵で 回想の 町を 隠さない）
	await s.say("nanj", T.memoryNanj, { emote: "…", noPortrait: true });
	await s.fadeOut(400);
	memo.end();
	for (const k of army) s.hide(k.id);
	if (pan) s.place(pan.id, pan.at[0], pan.at[1], pan.dir);
	await s.look(null, { instant: true });
	s.bgm("yofukashi");
	await s.fadeIn(400);

	// ── いまに もどって：前ぶれと、近道の 図（町が 空き地に 見えた わけ＝キリコの 独立ごっこ）
	await s.say("nanj", T.nanjOmen, { emote: "…" });
	s.face("zero", "player");
	await s.say("zero", T.zeroRoute, { emote: "!" });
	const route = showCard(root, routeCard);
	s.se("cardFlip");
	await s.kiriko(T.kirikoEmpty, "voice", { emote: "?" });
	await s.say("roze", T.rozeMap, { emote: "汗" });
	await s.kiriko(T.kirikoCause, "voice", { emote: "!" });
	route.end();
	await s.say("nanj", T.nanjSleep);

	// ── 夜ふけ：みんな 家へ。キリコは 蓄音機の 前で 寝る（いちばん 最初の 村の 寝言の 天丼）
	await s.wait(0);
	await s.fadeBgm(600);
	await s.fadeOut(600);
	setSceneSky("dark");
	for (const [w, c] of Object.entries(homes)) s.place(w, c[0], c[1], "down");
	s.place("player", bx, by, "down");
	await s.fadeIn(600);
	await s.kiriko(T.sleep, "voice");

	// 港から 行進が 坂を 上がって 商店街へ（カメラは 先頭を 追う）。桟橋は 1列なので 先頭（町に いちばん 近い 人）から
	// 歩きだし、うしろの 人は 前の 人の 道を そのまま 歩く（前の 人を よける 道（avoid）は 1列の 桟橋では 見つからず、
	// 2人が 桟橋に 残って 港を ふさいだ）。道が なかった 人も 持ち場に 立たせる
	const [ex, ey] = VILLAGE_SPOTS.exit;
	army.forEach((k, i) => {
		s.show(k.id);
		s.place(k.id, ex, ey - 2 - i, "up");
	});
	await s.look([ex, ey - 3]);
	s.bgm("kaiwai");
	await s.narrate(T.march);
	const head = army[army.length - 1];
	if (head) void s.look(head.id);
	await Promise.all(
		army.map(async (k, i) => {
			await s.wait((army.length - 1 - i) * 350);
			await s.goto(k.id, k.at[0], k.at[1], { speed: 1.4 });
			s.place(k.id, k.at[0], k.at[1], k.dir);
		}),
	);
	await s.say("zero", T.zeroCount, { emote: "!" });
	if (head) {
		s.face(head.id, "up");
		s.se("hit_club");
		await kinoko(s, T.kinokoStep);
		s.face(head.id, head.dir);
	}

	// 人影が やきうの 家の 前から 来て、掲示板に 見出しを 貼って 走り去る（天丼）
	const [ox, oy] = VILLAGE_SPOTS.board[1] ?? VILLAGE_SPOTS.board[0];
	await s.wait(0);
	await s.look([ox, oy + 1]);
	s.set(POSTER);
	s.show(POSTER);
	s.place(POSTER, nanjHome[0], nanjHome[1] + 1);
	await s.goto(POSTER, ox, oy + 1, { speed: 1.8, avoid: true });
	s.face(POSTER, "up");
	s.se("put");
	await s.wait(300);
	await s.goto(POSTER, nanjHome[0], nanjHome[1] + 1, {
		speed: 2.2,
		avoid: true,
	});
	s.set(POSTER, false);
	s.hide(POSTER);
	await s.look(null);
	await s.kiriko(T.sleep2, "voice");

	// ── 翌朝：盛った 見出しを 読んで つっこみ、自分で 追うと 決める → はぐれた 1人 →「もぐれる」
	await s.fadeBgm(400);
	await s.fadeOut(700);
	setSceneSky("morning");
	endMarks();
	s.place("player", ox, oy + 1, "up");
	await s.fadeIn(500);
	await s.narrate(T.morning);
	s.bgm(villageSong());
	await s.look([ox, oy]);
	s.se("read");
	await s.narrate(fill(BOARD_NEWS.fresh, { line: HEADLINES.kinoko ?? "" }));
	await s.kiriko(T.kirikoHeadline, "voice", { emote: "冷" });
	await s.look(null);
	await s.kiriko(T.kirikoGo, "voice");
	await visitScript(s, "kinoko");
	s.se("chapter");
	await s.narrate(`「${DUNGEON_NAMES.kinoko.name}」に\nもぐれるようになった`);
	// 朝の 時計で 村に もどる
	setSceneSky(null);
};

// ───────────────── 第二話 → 第三話 ─────────────────

const BATH_FLAG = "eve_main";

/** きのこ板を はじめて 持ち帰った 帰り（風呂板が 開く 知らせが まだ 残って いる。救いで 開いた ときは 出さない）。 */
export const bathEveDue = (): boolean => {
	const p = loadProgress();
	return (
		!hasFlag(BATH_FLAG) &&
		p.cleared.includes("kinoko") &&
		!p.cleared.includes("main") &&
		p.news.some((n) => n.dungeon === "main" && n.reason === "clear")
	);
};

/**
 * 第二話 → 第三話：胞子を 流しに 銭湯へ 歩く → 閉まって 怒鳴り声・湯気が 町を おおう → 湯温戦争の 図（シヨ派が ふえる）
 * → 3日前の 回想（人影の 書きこみ）→「さあな。名無しやろ」→ 源泉は 風呂板。見出しと 開く 知らせは この あと。
 */
export const bathEveScript = async (s: Story): Promise<void> => {
	addFlag(BATH_FLAG);
	const B = BATH_EVE;
	const root = fxRoot();
	const [bx, by] = VILLAGE_SPOTS.boot;
	const [hx, hy] = VILLAGE_SPOTS.bath;
	const nanjHome = VILLAGE_SPOTS.nanj(villageView());
	const homes: Record<"shiyo" | "zero" | "nanj", Cell> = {
		shiyo: VILLAGE_SPOTS.shiyo,
		zero: VILLAGE_SPOTS.zero,
		nanj: nanjHome,
	};

	// ── その夜：くしゃみで 胞子（主人公が 町を よごす）
	await s.wait(0);
	await s.fadeBgm(400);
	await s.fadeOut(500);
	// メイド喫茶の シフトの 夜でも、この 場面の あいだは シヨを 村に 立たせる（翌朝 もとに もどす）
	holdShiyoShift(true);
	setSceneSky("night");
	await s.rebuild();
	s.place("player", bx, by, "down");
	for (const [w, c] of Object.entries(homes)) s.place(w, c[0], c[1], "down");
	await s.fadeIn(500);
	s.bgm("yofukashi");
	await s.narrate(B.night);
	s.se("bubble");
	// 髪に 残った 胞子を くしゃみで ふく（地の文の「髪に胞子が残っていた」）
	s.spores("player");
	await s.kiriko(B.sneeze, "voice", { emote: "!", gesture: "hop" });
	await s.goto("zero", bx + 1, by, { speed: 2.4, avoid: true });
	s.face("zero", "player");
	await s.say("zero", B.zeroSpore, { emote: "!" });
	await s.goto("shiyo", bx - 1, by, { speed: 1.6, avoid: true });
	s.face("shiyo", "player");
	await s.say("shiyo", B.shiyoBath, {
		emote: "汗",
	});
	await s.kiriko(B.kirikoGo, "voice", { gesture: "hop" });

	// ── 銭湯まで 歩く（カメラは キリコ）。閉まって いて、中から 怒鳴り声 → 湯気が 町を おおう
	await s.wait(0);
	await Promise.all([
		s.goto("player", hx, hy + 1, { speed: 1.4, avoid: true }),
		s
			.wait(300)
			.then(() => s.goto("zero", hx + 1, hy + 2, { speed: 1.4, avoid: true })),
		s
			.wait(500)
			.then(() => s.goto("shiyo", hx - 1, hy + 2, { speed: 1.4, avoid: true })),
	]);
	s.face("player", "up");
	s.face("zero", "up");
	s.face("shiyo", "up");
	const shut = INCIDENTS.find((i) => i.dungeon === "main")?.shut?.bath;
	if (shut) await s.narrate(shut);
	s.se("bubble");
	await as(s, B.name42, B.shout42, "怒");
	s.se("bubble");
	await as(s, B.name41, B.shout41, "怒");
	await s.wait(0);
	await s.look([hx, hy - 3]);
	// 屋根から 町の 上まで 広がる 湯気（ui/village/sceneMarks.ts。翌朝まで）
	putMark("bathSteam");
	s.se("bubble");
	s.se("drink");
	await s.narrate(B.steam);
	await s.look(null);
	await s.kiriko(B.kirikoSteam, "voice", { emote: "!" });

	// ── イメージ図：湯温戦争（シヨが 43℃派で 参戦して 派閥が ふえる）
	s.face("zero", "player");
	await s.say("zero", B.zeroDraw, { emote: "!" });
	const card = showCard(root, factionCard(0));
	s.se("cardFlip");
	await s.say("zero", B.zeroFaction);
	card.update(factionCard(1));
	s.se("hit_fist");
	await s.say("shiyo", B.shiyo43, { emote: "花" });
	await s.kiriko(B.kirikoMore, "voice", { hit: "slap" });
	card.end();
	await s.say("zero", B.zeroWhy);

	// ── 回想：3日前の 夜、人影が 掲示板に 書きこむ（いちばん 最初の 村・第一話の 夜と 同じ 型）
	await s.wait(0);
	await s.fadeBgm(300);
	const memo = startFx(root, "memory", { caption: B.memoryCaption });
	s.bgm("sad");
	const [ox, oy] = VILLAGE_SPOTS.board[1] ?? VILLAGE_SPOTS.board[0];
	await s.look([ox, oy + 1]);
	await memo.ready;
	await s.narrate(B.memoryNight);
	s.set(POSTER);
	s.show(POSTER);
	s.place(POSTER, nanjHome[0], nanjHome[1] + 1);
	await s.goto(POSTER, ox, oy + 1, { speed: 1.8, avoid: true });
	s.face(POSTER, "up");
	s.se("pencil");
	await as(s, B.memoryPostName, B.memoryPost);
	await s.goto(POSTER, nanjHome[0], nanjHome[1] + 1, {
		speed: 2.2,
		avoid: true,
	});
	s.set(POSTER, false);
	s.hide(POSTER);
	await s.look([hx, hy]);
	s.se("pushButton");
	await s.narrate(B.memorySplit);
	await s.fadeOut(400);
	memo.end();
	await s.look(null, { instant: true });
	s.bgm("yofukashi");
	await s.fadeIn(400);

	// ── いまに もどって：同じ 書き方（大きな 問い）→ やきうの「さあな」（第一話の 天丼）→ 源泉は 風呂板
	await s.say("zero", B.zeroSame, { emote: "?" });
	await s.goto("nanj", hx + 2, hy + 1, { speed: 2.2, avoid: true });
	s.face("nanj", "player");
	s.face("player", "right");
	await s.say("nanj", B.nanjSame, { emote: "…" });
	await s.kiriko(B.kirikoWhy, "voice", { emote: "汗" });
	await s.say("nanj", B.nanjSource);

	// ── 翌朝（この あと 掲示板の 見出し「銭湯陥落」と、風呂板が 開く 知らせ）
	await s.wait(0);
	await s.fadeBgm(400);
	await s.fadeOut(700);
	setSceneSky("morning");
	endMarks();
	// シヨの シフトを もとに もどして 建て直す（シフトの 時間なら メイド喫茶へ）
	holdShiyoShift(false);
	s.place("player", ox, oy + 1, "up");
	await s.rebuild();
	await s.fadeIn(500);
	await s.narrate(B.morning);
	s.bgm(villageSong());
	// 朝の 時計で 村に もどる（この あとの 見出し・開く 知らせも 朝）
	setSceneSky(null);
};
