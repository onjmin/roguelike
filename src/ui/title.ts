// タイトル画面。rpg の title.ts を元にしている。
//
// - もぐる（新しく）／つづきから（中断セーブ）／冒険の記録／あそびかた／せってい。
// - 窓（記録・あそびかた・せってい）を開いている間は、タイトルの背景のタップで窓を閉じる
//   （ゲーム中と同じく「窓の外をタップ＝とじる」。input.bindField が一番上の窓の tap キーを押す）。
// - ダンジョンは ちょっと → 本編 → もっと の順に開く（トルネコ1と同じ）。2つ以上開いていれば もぐるときに選ぶ。
// - そのダンジョンに はじめて もぐるときだけ、語り（intro）を1ページずつ見せてから始める。
// - 持ち帰るたびに、キリコのうしろを歩く仲間が ふえる（トルネコの店が 大きくなるのに あたる。見た目だけ）。

import { DUNGEON_IDS, DUNGEONS } from "../core/data/dungeons";
import { CARRY_DUNGEON, CARRY_MAX, STORAGE_CAP } from "../core/town";
import type { DungeonId, Item, RunState } from "../core/types";
import {
	pickQuote,
	type Quote,
	type QuoteContext,
	SPEAKERS,
} from "../data/quotes";
import {
	CLEAR,
	DUNGEON_NAMES,
	FIRST_SHALLOW,
	SHALLOW_DEATH,
	STORY,
	TITLE_CAMEOS,
} from "../data/story";
import {
	ESCAPE_QUOTES,
	STAGE_NAMES,
	TITLE_TOWN_QUOTES,
	TOWN_NAME,
} from "../data/town";
import {
	addRecord,
	clearRun,
	hasRunSave,
	loadProgress,
	loadRecords,
	loadRun,
	loadTown,
	notePicked,
	noteRunEnd,
	recordFromRun,
	runStats,
	type SavedReplay,
} from "../engine/save";
import { drawWalk, stepFrame } from "../engine/sprite";
import { sleep } from "../engine/types";
import { openBook } from "./bookView";
import type { Ctx } from "./ctx";
import { el } from "./dom";
import { openStorage, pickCarry } from "./home";
import { openHowto } from "./howto";
import { infoWindow, listWindow, onTap } from "./list";
import {
	esc,
	escBr,
	openRecords,
	showProgressNews,
	showStory,
} from "./records";
import { openSettings } from "./settings";
import { drawTown, TOWN_H, TOWN_W } from "./town";

export type TitleChoice =
	| { kind: "new"; dungeon: DungeonId; carry: Item[] }
	| { kind: "continue"; state: RunState }
	| { kind: "replay"; replay: SavedReplay };

const KIRIKO = "pub:sprites/kiriko.png";
/** とうすこ（1階の敵）。キリコのうしろを ついて歩く。 */
const TOUSUKO = "sa:2kJYAl";
/** 仲間の歩行グラ（rpg の cast.ts と同じ）。 */
const FRIEND_WALK: Record<string, string> = {
	nanj: "sa:29aYeF",
	roze: "sa:mHhx69",
	feris: "sa:4KtOzD",
	teto: "sa:3xUW5Y",
	rei: "sa:TI21YC",
};

/**
 * 持ち帰ったダンジョンに応じて、タイトルで キリコのうしろを歩く仲間
 * （先のダンジョンを持ち帰っていれば、前の段の仲間もいる。救いで 本編に来た人・前の版の人も 5人 そろう）。
 */
const cameos = (cleared: readonly DungeonId[]): string[] => {
	const reached = Math.max(-1, ...cleared.map((d) => DUNGEON_IDS.indexOf(d)));
	return TITLE_CAMEOS.filter((c) => DUNGEON_IDS.indexOf(c.after) <= reached)
		.flatMap((c) => c.who)
		.map((w) => FRIEND_WALK[w])
		.filter(Boolean);
};

/** ダンジョンの ひとことの説明（選ぶ窓）。 */
const DUNGEON_DESC: Record<DungeonId, string> = {
	shallow: "10階。杖だけ　名前が　わからない。のろいも　祭りも　ない",
	main: "20階。草・スレ・指輪・杖の　名前が　わからない",
	deep: "30階。大きなパンと　不食の指輪が　出ない。罠が　多い",
};

/** まだ開いていないダンジョンの 開き方。 */
const lockedHint = (d: DungeonId): string => {
	const after = DUNGEONS[d].unlockAfter;
	if (!after) return "";
	const relief = DUNGEONS[d].reliefAfter;
	return `「${DUNGEON_NAMES[after].name}」を　持ち帰ると　開く${relief ? `（${relief}回　たおれても　開く）` : ""}`;
};

type Choice =
	| "new"
	| "continue"
	| "records"
	| "book"
	| "storage"
	| "howto"
	| "settings";

/**
 * ボタンの並び（行ごと）。上下で行を、左右で行の中を動く。
 * 3行目（記録・あそびかた・せってい）は小さいボタンを横に並べる（スマホの縦に収めるため）。
 */
const gridFor = (storage: boolean): Choice[][] => [
	["new"],
	["continue"],
	storage ? ["records", "book", "storage"] : ["records", "book"],
	["howto", "settings"],
];

/**
 * タイトルの ひとこと。ちょっと・もっと の たまり（data/story.ts）を先に見て、
 * 無ければ 本編の たまり（data/quotes.ts の pickQuote）。
 */
const titleQuote = (seed: number): Quote | null => {
	const last = loadRecords()[0];
	const pick = (pool: readonly Quote[], salt: number) =>
		pool.length ? pool[(seed * 31 + salt) % pool.length] : null;
	if (!last) return pick(FIRST_SHALLOW, 1);
	const d = last.dungeon ?? "main";
	if (last.kind === "escape") return pick(ESCAPE_QUOTES, 4);
	// ときどき 町の様子の ひとこと（屋台が出てから）
	const stage = loadTown().stage;
	if (stage >= 1 && seed % 3 === 0)
		return pick(TITLE_TOWN_QUOTES[stage] ?? [], 5);
	if (last.kind === "clear" && d !== "main") return pick(CLEAR[d], 2);
	if (last.kind === "dead" && d === "shallow" && seed % 2 === 0)
		return pick(SHALLOW_DEATH, 3);
	return pickQuote(quoteContext(), seed);
};

/** いちばん新しい記録から、タイトルの一言の手がかりを作る。 */
const quoteContext = (): QuoteContext => {
	const last = loadRecords()[0];
	if (!last) return null;
	const st = runStats();
	return {
		kind: last.kind,
		// 持ち帰ったときの depth は地上の手前（1）なので、いちばん深い階を渡す
		depth: last.kind === "clear" ? last.maxDepth : last.depth,
		cause: last.cause,
		runs: st.runs,
		// 本編の たまり（「また 行ってきたんか」）なので、本編を 持ち帰った回数だけ（ちょっと・もっと は 数えない）
		clears: loadRecords().filter(
			(r) => r.kind === "clear" && (r.dungeon ?? "main") === "main",
		).length,
	};
};

export const showTitle = (ctx: Ctx): Promise<TitleChoice> =>
	new Promise((resolve) => {
		ctx.audio.bgm("title");

		const progress = loadProgress();
		const town = loadTown();
		// 倉庫が開いていれば（町の段4から）ボタンを出す
		const GRID = gridFor((STORAGE_CAP[town.stage] ?? 0) > 0);
		const friends = cameos(progress.cleared);
		// 地上の町（保守村。持ち帰るたびに育つ）と、その前の道を歩く キリコ・仲間・とうすこ
		const walkers = el("canvas", { class: "title-walkers title-town" });
		walkers.width = TOWN_W;
		walkers.height = TOWN_H;
		const townCaption =
			town.stage > 0
				? el("div", {
						class: "title-town-name",
						text: `${TOWN_NAME}　${STAGE_NAMES[town.stage] ?? ""}`,
					})
				: null;
		const quote = titleQuote(Date.now() % 1e9);
		const quoteEl = el("div", { class: "title-quote" });
		if (quote) {
			const sp = SPEAKERS[quote.who];
			quoteEl.innerHTML = `<b style="--char:${sp.color}">${esc(sp.name)}</b>「${escBr(quote.text)}」`;
		} else quoteEl.style.display = "none";
		const buttons = el("div", { class: "title-buttons" });
		const root = el("div", { class: "title" }, [
			el("div", { class: "title-sub", text: "1歩1ターンの　ローグライク" }),
			el("h1", {
				class: "title-logo",
				html: `蓄音キリコと<span class="title-logo-sub">過去ログの底</span>`,
			}),
			walkers,
			...(townCaption ? [townCaption] : []),
			quoteEl,
			buttons,
			el("div", {
				class: "title-foot",
				text: "BGM・効果音は　右上の　🔊で　切りかえ",
			}),
		]);
		ctx.ui.appendChild(root);
		// 背景のタップ：窓が開いていれば閉じる（タイトル自身のハンドラは tap: null なので何もしない）
		ctx.input.bindField(root);

		let raf = 0;
		const anim = (t: number) => {
			const g = walkers.getContext("2d");
			if (!g || !root.isConnected) return;
			g.imageSmoothingEnabled = false;
			g.clearRect(0, 0, walkers.width, walkers.height);
			drawTown(g, town.stage, t);
			// 歩く列は 町の下の道（y = 64〜80）。洞窟の入口の少し右から
			const row = TOWN_H - 17;
			const x0 = 44;
			drawWalk(g, KIRIKO, "down", stepFrame(t, true), x0, row);
			for (const [i, f] of friends.entries())
				drawWalk(
					g,
					f,
					"down",
					stepFrame(t + 70 * (i + 1), true),
					x0 + 18 + i * 18,
					row,
				);
			// とうすこは少し遅れて足踏みし、ときどき跳ねる
			const hop = Math.floor(t / 900) % 3 === 0 ? -1 : 0;
			drawWalk(
				g,
				TOUSUKO,
				"down",
				stepFrame(t + 130, true),
				x0 + 18 + friends.length * 18,
				row + hop,
			);
			raf = requestAnimationFrame(anim);
		};
		raf = requestAnimationFrame(anim);

		// 中断セーブの中身（つづきからの ボタンに階とレベルを出す。壊れていたら null）
		let saved = hasRunSave() ? loadRun() : null;
		const label: Record<Choice, { text: string; sub?: () => string }> = {
			new: { text: "もぐる", sub: () => "新しく　はじめる" },
			continue: {
				text: "つづきから",
				sub: () =>
					saved
						? `${DUNGEON_NAMES[saved.dungeon]?.short ?? ""}　B${saved.depth}　Lv${saved.player.lv}${saved.returning ? "　帰り道" : ""}`
						: hasRunSave()
							? "中断した　冒険"
							: "中断した　冒険は　ない",
			},
			records: { text: "冒険の記録" },
			book: { text: "図鑑" },
			storage: { text: "倉庫" },
			howto: { text: "あそびかた" },
			settings: { text: "せってい" },
		};
		const disabled = (c: Choice) => c === "continue" && !hasRunSave();

		let cur: Choice = hasRunSave() ? "continue" : "new";
		const render = () => {
			buttons.replaceChildren(
				...GRID.map((row) => {
					const bs = row.map((c) => {
						const l = label[c];
						const b = el("button", {
							class: `title-btn${row.length > 1 ? " title-mini" : ""}${c === cur ? " cur" : ""}${disabled(c) ? " disabled" : ""}`,
							html: `${l.text}${l.sub ? `<small>${l.sub()}</small>` : ""}`,
						});
						// 背の低い画面ではタイトルが巻き取れるので、なぞった指では決めない
						onTap(b, root, () => {
							ctx.input.onAnyInput?.();
							if (busy) {
								// 窓が開いている間にボタンを押したら、窓の外のタップとして窓を閉じる
								// （onTap がタップを止めるので、背景の bindField には届かない）
								if (!leaving) ctx.input.press("b");
								return;
							}
							if (!disabled(c)) void pick(c);
						});
						return b;
					});
					return row.length > 1 ? el("div", { class: "title-row" }, bs) : bs[0];
				}),
			);
		};

		/** 十字キー・矢印キーでカーソルを動かす（選べないボタンは飛ばす）。 */
		const move = (k: "up" | "down" | "left" | "right") => {
			let r = GRID.findIndex((row) => row.includes(cur));
			let c = GRID[r].indexOf(cur);
			if (k === "left" || k === "right") {
				const row = GRID[r];
				if (row.length < 2) return;
				c = (c + (k === "left" ? -1 : 1) + row.length) % row.length;
				cur = row[c];
			} else {
				for (let i = 0; i < GRID.length; i++) {
					r = (r + (k === "up" ? -1 : 1) + GRID.length) % GRID.length;
					const row = GRID[r];
					const next = row[Math.min(c, row.length - 1)];
					if (!disabled(next)) {
						cur = next;
						break;
					}
				}
			}
			ctx.se("cursor");
			render();
		};

		let busy = false;
		/** 始める（タイトルを閉じる）と決まった。もう入力を受けない。 */
		let leaving = false;
		const pop = ctx.input.push(
			(k) => {
				if (busy) return;
				if (k === "up" || k === "down" || k === "left" || k === "right")
					move(k);
				else if (k === "a" && !disabled(cur)) void pick(cur);
			},
			{ tap: null },
		);

		const leave = async (
			choice: TitleChoice,
			intro: readonly string[] | null,
		) => {
			leaving = true;
			pop();
			cancelAnimationFrame(raf);
			root.classList.add("leaving");
			if (intro) {
				await sleep(500);
				root.remove();
				await showStory(ctx, intro.map(escBr));
				// 見終わってから 覚える（語りの途中で 閉じたら、次も はじめから 見せる）
				if (choice.kind === "new") notePicked(choice.dungeon, true);
			}
			void ctx.audio.fadeBgm(500);
			await sleep(500);
			root.remove();
			resolve(choice);
		};

		const pick = async (c: Choice) => {
			if (busy) return;
			busy = true;
			ctx.se("decide");
			// タップで選んだボタンにもカーソルを移す（窓を閉じたあと、そこから続けられるように）
			cur = c;
			render();
			if (c === "records") {
				const replay = await openRecords(ctx);
				if (replay) {
					void leave({ kind: "replay", replay }, null);
					return;
				}
			} else if (c === "book") await openBook(ctx);
			else if (c === "storage") await openStorage(ctx);
			else if (c === "howto") await openHowto(ctx);
			else if (c === "settings") await openSettings(ctx);
			else if (c === "continue") {
				// いつも読み直す（タイトルを開いたままの別タブの古い写しから 始めないように）
				const state = loadRun();
				if (state) {
					void leave({ kind: "continue", state }, null);
					return;
				}
				clearRun();
				saved = null;
				cur = "new";
				render();
				await infoWindow(ctx, "", "<p>続きの　記録が　こわれていました。</p>");
			} else if (c === "new") {
				if (hasRunSave()) {
					const v = await listWindow(
						ctx,
						"中断した　冒険が　あります。<br>すてて　はじめから　もぐりますか？",
						[
							{ label: "はい", value: "yes" },
							{ label: "いいえ", value: "no" },
						],
						{ start: 1 },
					);
					if (v === "yes") {
						// すてた冒険も記録に残す（やめた、として）
						const old = loadRun();
						if (old) {
							addRecord(recordFromRun(old));
							// 何もせずに すてた冒険は 救い（10回で開く）に数えない（すぐ すてるのを くり返して 開けないように）
							if (old.stats.maxDepth >= 2)
								noteRunEnd(old.dungeon, "dead", old.seed);
						}
						clearRun();
						saved = null;
						// すてたので 次のダンジョンが開いたなら、ここで知らせる
						await showProgressNews(ctx);
					}
				}
				if (!hasRunSave()) {
					const dungeon = await pickDungeon();
					// 過去ログの底 には 倉庫から 持っていける（町の段に応じて 1〜4個）
					const max =
						dungeon === CARRY_DUNGEON ? (CARRY_MAX[loadTown().stage] ?? 0) : 0;
					const carry = dungeon ? await pickCarry(ctx, max) : null;
					if (dungeon && carry) {
						// そのダンジョンに はじめて もぐるなら 語りを見せる
						const p = loadProgress();
						const first = !p.intro.includes(dungeon);
						notePicked(dungeon, false);
						void leave(
							{ kind: "new", dungeon, carry },
							first ? STORY[dungeon].intro : null,
						);
						return;
					}
				}
			}
			busy = false;
			render();
		};

		/** もぐるダンジョンを選ぶ（1つしか開いていなければ そこ）。やめたら null。 */
		const pickDungeon = async (): Promise<DungeonId | null> => {
			const p = loadProgress();
			if (p.unlocked.length <= 1) return p.unlocked[0] ?? "shallow";
			const rows = DUNGEON_IDS.map((d) =>
				p.unlocked.includes(d)
					? {
							label: DUNGEON_NAMES[d].name,
							sub: `B${DUNGEONS[d].floors}${p.cleared.includes(d) ? "　★" : ""}`,
							desc: DUNGEON_DESC[d],
							value: d,
						}
					: {
							label: "？？？",
							sub: "",
							desc: lockedHint(d),
							value: d,
							disabled: true,
						},
			);
			const start = Math.max(0, DUNGEON_IDS.indexOf(p.last ?? "shallow"));
			const v = await listWindow(ctx, "どこへ　もぐる？", rows, { start });
			return v as DungeonId | null;
		};

		render();
	});
