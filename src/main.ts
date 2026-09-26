// 起動：画面・入力・音を組み立て、歩ける村（保守村）→ 冒険 → 村… を回す。
// タイトルは 村の上に 重ねる 起動の札（ui/boot.ts）だけ。

import "./style.css";
import { EXP_AT } from "./core/balance";
import { Run } from "./core/run";
import { bgm } from "./data/bgm";
import { sfx } from "./data/sfx";
import { GameAudio } from "./engine/audio";
import type { VillageExit } from "./engine/defs";
import { Input } from "./engine/input";
import {
	DEBUG_SEED,
	type SavedReplay,
	saveRun,
	takeFromStorage,
} from "./engine/save";
import { Screen } from "./engine/screen";
import type { Ctx } from "./ui/ctx";
import { mountHud } from "./ui/hud";
import { Play } from "./ui/play";
import { type Arrival, Village } from "./ui/village";

const app = document.getElementById("app");
if (!app) throw new Error("#app がありません");

const screen = new Screen(app);
const ui = document.createElement("div");
ui.id = "ui";
app.appendChild(ui);

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
		]);
};

const hud = mountHud(app, input);
const ctx: Ctx = { ui, input, audio, app, se: (name) => audio.se(name) };

// メニュー中は十字キーと A/B を隠す（タップでどこでも操作できる）。斜め固定は十字キーの見た目で知らせる
const syncHud = () => {
	hud.root.classList.toggle("modal", input.busy);
	hud.root.classList.toggle("diag-lock", input.mods().diag);
	requestAnimationFrame(syncHud);
};
syncHud();

// iOS Safari の拡大ジェスチャ・長押しメニューを止める
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("contextmenu", (e) => e.preventDefault());

// iOS（Safari・Brave）は 長押しで 拡大鏡や選択が出て、画面が拡大されてしまう。
// 操作する場所（十字キー・ボタン・画面）では タッチの既定動作を止める（操作は すべて pointer イベントで受ける。
// 一覧・窓は 指で送れるように 止めない）
const noTouchDefault = (e: TouchEvent) => {
	const t = e.target as Element | null;
	if (t?.closest?.(".hud, #screen")) e.preventDefault();
};
document.addEventListener("touchstart", noTouchDefault, { passive: false });
document.addEventListener("touchmove", noTouchDefault, { passive: false });

// iOS は user-scalable=no を聞かず、すばやく 2 回たたくと拡大してしまう。
// 2 回目のタップの既定動作を止める（操作はすべて pointer イベントで受けている）
let lastTouchEnd = 0;
document.addEventListener(
	"touchend",
	(e) => {
		const now = e.timeStamp;
		if (now - lastTouchEnd < 350) e.preventDefault();
		lastTouchEnd = now;
	},
	{ passive: false },
);

// それでも拡大されたら、viewport を書き直して等倍に戻す
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
window.visualViewport?.addEventListener("resize", resetZoom);

// 開発用：?raf を付けると、見えていないタブでも コマを進める（ブラウザが rAF を止めるため。試験の自動操作用）
if (import.meta.env.DEV && new URLSearchParams(location.search).has("raf"))
	window.requestAnimationFrame = (cb) =>
		setTimeout(() => cb(performance.now()), 16) as unknown as number;

/** 新しいシード（core は Math.random を使わないので、ここで決める）。 */
const newSeed = (): string =>
	`${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

/**
 * 開発用：URL で好きな階から始める（pnpm dev か ?debug のときだけ）。
 * 例 `?seed=abc&depth=12&lv=10`
 */
const devRun = (): Run | null => {
	const q = new URLSearchParams(location.search);
	if (!import.meta.env.DEV && !q.has("debug")) return null;
	const depth = Number(q.get("depth") ?? 0);
	const seed = q.get("seed");
	if (!depth && !seed) return null;
	// シードの頭に debug: を付けておくと、中断セーブにも記録にも残らない（本物のセーブを上書きしない）
	const run = Run.create(`${DEBUG_SEED}${seed ?? newSeed()}`);
	const lv = Number(q.get("lv") ?? 0);
	if (lv > 1) run.gainExp(EXP_AT[Math.min(EXP_AT.length, lv) - 1]);
	if (depth > 1) run.enterFloor(depth, false);
	run.ev = [];
	// act の外で乱数を使ったので、状態を入れなおす（中断セーブで同じ乱数を2回引かないように）
	run.s.rng = run.rng.state();
	return run;
};

/** 村を出て 冒険を 作る（倉庫から 取り出すのは ここ）。 */
const runFor = (
	choice: VillageExit,
): { run: Run; replay: SavedReplay | undefined } => {
	if (choice.kind === "replay") {
		// リプレイ：同じシードから始めて、記録のコマンドを入れなおす
		const replay = choice.replay;
		return {
			run: Run.create(
				replay.seed,
				replay.dungeon ?? "main",
				replay.carry ?? [],
			),
			replay,
		};
	}
	if (choice.kind === "new") {
		// 冒険を作って すぐ保存する（取り出したのに 冒険が無い、にならないように）。
		// 選んだあとで 別のタブが 持っていった道具は 持っていけない
		const carry = choice.carry.length ? takeFromStorage(choice.carry) : [];
		const run = Run.create(newSeed(), choice.dungeon, carry);
		if (carry.length) saveRun(run.s);
		return { run, replay: undefined };
	}
	return { run: new Run(choice.state), replay: undefined };
};

/**
 * 村 → 冒険 → 村…。
 * 起動したときと 中断したあとは 村の上に 起動の札（はじめる／つづきから）を出す。
 * 開発用の 冒険（?seed=…&depth=…）は 村を とばして すぐ始め、終わったら 札なしで 村へ。
 */
const loop = async () => {
	const village = new Village(ctx, screen, hud);
	if (import.meta.env.DEV)
		(window as unknown as { __village: Village }).__village = village;
	let first = devRun();
	let boot = !first;
	let arrival: Arrival = null;
	for (;;) {
		let run = first;
		first = null;
		let replay: SavedReplay | undefined;
		if (!run) {
			hud.setMode("village");
			const choice = await village.start({ boot, arrival });
			boot = false;
			({ run, replay } = runFor(choice));
		}
		hud.setMode("dungeon");
		hud.root.classList.remove("hidden");
		if (import.meta.env.DEV) (window as unknown as { __run: Run }).__run = run;
		const play = new Play(run, ctx, screen, hud, { replay });
		if (import.meta.env.DEV)
			(window as unknown as { __play: Play }).__play = play;
		const r = await play.start();
		// 中断は トルネコの「終わる」：起動の札に もどる
		if (r === "suspend") boot = true;
		arrival = replay
			? { kind: "replay" }
			: r === "suspend"
				? { kind: "suspend" }
				: run.s.end
					? { kind: run.s.end.kind, dungeon: run.s.dungeon }
					: null;
		// 画面を消してから村へ
		const c = screen.begin();
		c.fillStyle = "#000";
		c.fillRect(0, 0, screen.width, screen.height);
	}
};

void loop();
