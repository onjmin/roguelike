// 起動：画面・入力・音を組み立て、タイトル → 冒険 → タイトル… を回す。

import "./style.css";
import { EXP_AT } from "./core/balance";
import { Run } from "./core/run";
import { bgm } from "./data/bgm";
import { sfx } from "./data/sfx";
import { GameAudio } from "./engine/audio";
import { Input } from "./engine/input";
import { Screen } from "./engine/screen";
import type { Ctx } from "./ui/ctx";
import { mountHud } from "./ui/hud";
import { Play } from "./ui/play";
import { showTitle } from "./ui/title";

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
	const run = Run.create(seed ?? newSeed());
	const lv = Number(q.get("lv") ?? 0);
	if (lv > 1) run.gainExp(EXP_AT[Math.min(EXP_AT.length, lv) - 1]);
	if (depth > 1) run.enterFloor(depth, false);
	run.ev = [];
	return run;
};

const loop = async () => {
	let first = devRun();
	for (;;) {
		hud.root.classList.add("hidden");
		let run = first;
		first = null;
		if (!run) {
			const choice = await showTitle(ctx);
			run =
				choice.kind === "new" ? Run.create(newSeed()) : new Run(choice.state);
		}
		hud.root.classList.remove("hidden");
		if (import.meta.env.DEV) (window as unknown as { __run: Run }).__run = run;
		const play = new Play(run, ctx, screen, hud);
		await play.start();
		// 画面を消してからタイトルへ
		const c = screen.begin();
		c.fillStyle = "#000";
		c.fillRect(0, 0, screen.width, screen.height);
	}
};

void loop();
