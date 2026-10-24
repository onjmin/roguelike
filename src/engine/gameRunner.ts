// ゲームの起動・進行制御（React コンポーネントから呼び出し可能なエンジンコントローラ）

import "../devSandbox";
import { type AmbushId, isAmbushId } from "../core/ambush";
import { EXP_AT } from "../core/balance";
import { DUNGEON_IDS, dungeonById } from "../core/data/dungeons";
import { type HeroId, isHeroId } from "../core/data/heroes";
import { callHunter } from "../core/floor";
import { GUESTS } from "../core/guest";
import { isRaceId, type RaceId } from "../core/race";
import { Run } from "../core/run";
import type { GuestId, Item } from "../core/types";
import { bgm } from "../data/audio/bgm";
import { ENDING_BGM } from "../data/audio/music";
import { EMOTE_SE, sfx } from "../data/audio/sfx";
import { devEvent } from "../data/story/objectives";
import { devArrival } from "../devSandbox";
import { sceneMenu } from "../devScenes";
import type { Ctx } from "../ui/ctx";
import { mountHud } from "../ui/dungeon/hud";
import { Play } from "../ui/dungeon/play";
import { infoWindow } from "../ui/list";
import { confirmShared } from "../ui/share";
import { type Arrival, Village } from "../ui/village/village";
import { travelHome } from "../ui/village/worldMap";
import { GameAudio } from "./audio";
import type { VillageExit } from "./defs";
import {
	chosenHero,
	noteHeroQuests,
	questAmbush,
	questRace,
	rollHeroWorries,
} from "./heroes";
import { Input } from "./input";
import {
	DEBUG_SEED,
	loadProgress,
	reliefItem,
	type SavedReplay,
	saveRun,
	takeFromBag,
	takeLunch,
	takeRelief,
} from "./save";
import { Screen } from "./screen";
import { decodeShare, takeSharedHash } from "./share";

export type GameMode = "village" | "dungeon" | "sceneMenu";

export type GameRunnerOptions = {
	onModeChange?: (mode: GameMode) => void;
};

/** 新しいシード（core は Math.random を使わないので、ここで決める）。 */
const newSeed = (): string =>
	`${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

/**
 * 開発用：URL で好きな階から始める（pnpm dev か ?debug のときだけ）。
 */
const devRun = (): Run | null => {
	const q = new URLSearchParams(location.search);
	if (!import.meta.env.DEV && !q.has("debug")) return null;
	const depth = Number(q.get("depth") ?? 0);
	const seed = q.get("seed");
	if (!depth && !seed) return null;
	const d = q.get("dungeon");
	const run = Run.create(
		`${DEBUG_SEED}${seed ?? newSeed()}`,
		dungeonById(d ?? undefined).id,
		[],
		q.get("objective") === "boss"
			? "boss"
			: q.get("objective") === "event"
				? "event"
				: "fetch",
		true,
		isHeroId(q.get("hero")) ? (q.get("hero") as HeroId) : "kiriko",
		(q.get("guest") ?? "") in GUESTS
			? { id: q.get("guest") as GuestId, goal: Number(q.get("goal") ?? 999) }
			: null,
		isAmbushId(q.get("ambush")) ? (q.get("ambush") as AmbushId) : null,
		isRaceId(q.get("race")) ? (q.get("race") as RaceId) : null,
	);
	const lv = Number(q.get("lv") ?? 0);
	if (lv > 1) run.gainExp(EXP_AT[Math.min(EXP_AT.length, lv) - 1]);
	if (depth > 1) run.enterFloor(depth, false);
	run.ev = [];
	run.s.rng = run.rng.state();
	return run;
};

/** 村を出て 冒険を 作る（村の 持ち物から 取り出すのは ここ）。 */
const runFor = (
	choice: VillageExit,
): { run: Run; replay: SavedReplay | undefined } => {
	if (choice.kind === "replay") {
		const replay = choice.replay;
		return {
			run: Run.create(
				replay.seed,
				replay.dungeon ?? "main",
				replay.carry ?? [],
				replay.objective ?? "fetch",
				!replay.noLunch,
				replay.hero ?? "kiriko",
				replay.guest ?? null,
				replay.ambush ?? null,
				replay.race ?? null,
			),
			replay,
		};
	}
	if (choice.kind === "new") {
		if (devEvent()) {
			const run = Run.create(
				`${DEBUG_SEED}${newSeed()}`,
				choice.dungeon,
				choice.carry,
				choice.objective,
				choice.lunch,
				chosenHero(),
				choice.guest ?? null,
			);
			return { run, replay: undefined };
		}
		const carry = choice.carry.length ? takeFromBag(choice.carry) : [];
		const lunch = choice.lunch && takeLunch();
		const relief: Item[] = takeRelief() ? [reliefItem()] : [];
		const hero = chosenHero();
		const run = Run.create(
			newSeed(),
			choice.dungeon,
			[...carry, ...relief],
			choice.objective,
			lunch,
			hero,
			choice.guest ?? null,
			questAmbush(hero),
			questRace(hero),
		);
		if (carry.length || relief.length) saveRun(run.s);
		return { run, replay: undefined };
	}
	const run = new Run(choice.state);
	if (callHunter(run)) {
		run.msg("どこかで削除人の足音がする……", "warn");
		run.s.rng = run.rng.state();
	}
	return { run, replay: undefined };
};

export function startGame(
	app: HTMLElement,
	ui: HTMLElement,
	options: GameRunnerOptions = {},
): () => void {
	let cancelled = false;

	const screen = new Screen(app);
	const input = new Input();
	input.bindField(screen.canvas);
	const audio = new GameAudio(bgm, sfx);

	input.onAnyInput = () => {
		const first = !audio.unlocked;
		audio.unlock();
		if (first)
			audio.preloadSe([
				"cursor",
				"decide",
				"cancel",
				"attack",
				"miss",
				"swing_fist",
				"hit_fist",
				"damage",
				"enemyDown",
				"item",
				"stairs",
				"heal",
				"eat",
				"drink",
				"read",
				"throw",
				"spell",
				"levelup",
				"chapter",
				...Object.values(EMOTE_SE),
			]);
	};

	const hud = mountHud(app, input);
	const ctx: Ctx = { ui, input, audio, app, se: (name) => audio.se(name) };

	let syncRafId = 0;
	const syncHud = () => {
		if (cancelled) return;
		hud.root.classList.toggle("modal", input.busy);
		hud.root.classList.toggle("diag-lock", input.mods().diag);
		syncRafId = requestAnimationFrame(syncHud);
	};
	syncHud();

	// Gestures & touch prevention
	const prevent = (e: Event) => e.preventDefault();
	const noTouchDefault = (e: TouchEvent) => {
		const t = e.target as Element | null;
		if (t?.closest?.(".hud, #screen")) e.preventDefault();
	};

	let lastTouchEnd = 0;
	const handleTouchEnd = (e: TouchEvent) => {
		const now = e.timeStamp;
		if (now - lastTouchEnd < 350) e.preventDefault();
		lastTouchEnd = now;
	};

	const viewportMeta = document.querySelector<HTMLMetaElement>(
		'meta[name="viewport"]',
	);
	const resetZoom = () => {
		const vv = window.visualViewport;
		if (!viewportMeta || !vv || vv.scale <= 1.01) return;
		const content = viewportMeta.content;
		viewportMeta.content = `${content}, minimum-scale=1`;
		requestAnimationFrame(() => {
			viewportMeta.content = content;
		});
	};

	document.addEventListener("gesturestart", prevent);
	document.addEventListener("contextmenu", prevent);
	document.addEventListener("touchstart", noTouchDefault, { passive: false });
	document.addEventListener("touchmove", noTouchDefault, { passive: false });
	document.addEventListener("touchend", handleTouchEnd, { passive: false });
	window.visualViewport?.addEventListener("resize", resetZoom);

	const handleHashChange = () => {
		if (location.hash.startsWith("#r=")) location.reload();
	};
	window.addEventListener("hashchange", handleHashChange);

	if (import.meta.env.DEV && new URLSearchParams(location.search).has("raf")) {
		window.requestAnimationFrame = (cb) =>
			setTimeout(() => cb(performance.now()), 16) as unknown as number;
	}

	const loop = async () => {
		const village = new Village(ctx, screen, hud);
		if (import.meta.env.DEV)
			(window as unknown as { __village: Village }).__village = village;

		let first = devRun();
		let arrival: Arrival = devArrival();
		if (arrival?.kind === "clear") audio.bgm(ENDING_BGM);
		let boot = !first && !arrival;
		let shared = takeSharedHash();

		while (!cancelled) {
			let run = first;
			first = null;
			let replay: SavedReplay | undefined;

			if (!run && shared) {
				const rp = await decodeShare(shared);
				shared = null;
				if (cancelled) break;
				if (!rp) {
					await infoWindow(
						ctx,
						"",
						`<p class="dim">リプレイのリンクが読めませんでした<br><small>（ぜんぶコピーできていないかも）</small></p>`,
					);
				} else if (await confirmShared(ctx, rp)) {
					({ run, replay } = runFor({ kind: "replay", replay: rp }));
				}
			}

			if (cancelled) break;

			if (!run) {
				hud.setMode("village");
				options.onModeChange?.("village");
				const choice = await village.start({ boot, arrival });
				if (cancelled) break;
				boot = false;
				({ run, replay } = runFor(choice));
			}

			if (cancelled) break;

			hud.setMode("dungeon");
			options.onModeChange?.("dungeon");
			hud.root.classList.remove("hidden");
			if (import.meta.env.DEV)
				(window as unknown as { __run: Run }).__run = run;

			const play = new Play(run, ctx, screen, hud, { replay });
			if (import.meta.env.DEV)
				(window as unknown as { __play: Play }).__play = play;

			const r = await play.start();
			if (cancelled) break;

			if (r === "suspend") boot = true;
			arrival = replay
				? { kind: "replay" }
				: r === "suspend"
					? { kind: "suspend" }
					: run.s.end
						? {
								kind: run.s.end.kind,
								dungeon: run.s.dungeon,
								objective: run.objective,
							}
						: null;

			if (!replay && run.s.end && !run.s.seed.startsWith(DEBUG_SEED)) {
				noteHeroQuests(run.s);
				rollHeroWorries();
			}

			const c = screen.begin();
			c.fillStyle = "#000";
			c.fillRect(0, 0, screen.width, screen.height);

			if (
				!replay &&
				(run.s.end?.kind === "clear" || run.s.end?.kind === "escape") &&
				!run.s.seed.startsWith(DEBUG_SEED)
			) {
				hud.setMode("village");
				options.onModeChange?.("village");
				hud.root.classList.add("hidden");
				const p = loadProgress();
				await travelHome(ctx, run.s.dungeon, {
					open: DUNGEON_IDS.filter((d) => p.unlocked.includes(d)),
					cleared: p.cleared,
				});
			}
		}
	};

	if (sceneMenu()) {
		options.onModeChange?.("sceneMenu");
	} else {
		void loop();
	}

	return () => {
		cancelled = true;
		cancelAnimationFrame(syncRafId);
		audio.bgm(null);
		document.removeEventListener("gesturestart", prevent);
		document.removeEventListener("contextmenu", prevent);
		document.removeEventListener("touchstart", noTouchDefault);
		document.removeEventListener("touchmove", noTouchDefault);
		document.removeEventListener("touchend", handleTouchEnd);
		window.visualViewport?.removeEventListener("resize", resetZoom);
		window.removeEventListener("hashchange", handleHashChange);
		screen.canvas.remove();
		hud.root.remove();
	};
}
