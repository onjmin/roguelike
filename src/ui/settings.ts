// せってい（村の メニューと ゲーム中の メニューの 両方から開く）。rpg の settingsMenu を元にしている。
//
// - 2択・3択は、押すたびに次の値へ切りかえる（一覧を開き直す手間をはぶく）。
// - 音量だけは 0〜100 を 10 刻みの一覧から選ぶ。
// - ボイス（村の 会話の 読み上げ。rpg と 同じ）は ON に するとき、はじめに 約45MBを 取ってくると 断ってから。
//   取ってくる あいだは「じゅんび中 N%」（開き直すたびに 今の 進み）。
// - 変えたら すぐ saveSettings（音・十字キーは onSettingsChange で その場に効く）。
// - 村から 開いたときだけ「セーブデータを　消す」（はじめから やりなおす。2回 きいて 計算問題に 正しく 答えたら 消して 読みなおす）。

import type { GameAudio } from "../engine/audio";
import { wipeSaves } from "../engine/save";
import { type Settings, saveSettings, settings } from "../engine/settings";
import type { Ctx } from "./ctx";
import { listWindow } from "./list";
import { makeQuiz } from "./quiz";

const BGM_LABEL: Record<Settings["bgm"], string> = {
	hq: "高音質",
	light: "軽量",
	off: "なし",
};

const NEXT_BGM: Record<Settings["bgm"], Settings["bgm"]> = {
	hq: "light",
	light: "off",
	off: "hq",
};

/** 0〜100 を 10 刻みの一覧から選ぶ。やめたら null。 */
const pickVolume = async (
	ctx: Ctx,
	label: string,
	cur: number,
): Promise<number | null> => {
	const levels = Array.from({ length: 11 }, (_, i) => i * 10);
	const v = await listWindow(
		ctx,
		label,
		levels.map((n) => ({
			label: n === 0 ? "0（消す）" : String(n),
			sub: n === cur ? "いま" : undefined,
			value: String(n),
		})),
		{ start: Math.round(cur / 10) },
	);
	return v === null ? null : Number(v);
};

/** ボイスの 行の 右の 字（取ってくる あいだは 進み）。rpg の voiceLabel と 同じ。 */
const voiceLabel = (audio: GameAudio): string => {
	if (!settings.voice) return "OFF";
	const p = audio.voiceProgress;
	if (p && p.total > 0 && p.loaded < p.total)
		return `ON（じゅんび中 ${Math.floor((p.loaded / p.total) * 100)}%）`;
	return "ON";
};

/** ボイスを ON に するか きく（はじめに データを 取ってくるので）。 */
const askVoice = async (ctx: Ctx): Promise<void> => {
	const v = await listWindow(
		ctx,
		"ボイスを　ONにすると、はじめに<br>やく45MBの　データを　よみこみます。<br><small>村の　会話を　読み上げます（ロゼ・シヨ）。2回目からは　すぐに　はじまります</small>",
		[
			{ label: "ONにする", value: "yes" },
			{ label: "やめておく", value: "no" },
		],
		{ start: 0 },
	);
	if (v === "yes") saveSettings({ voice: true });
};

const KEYS = [
	"voice",
	"mute",
	"bgm",
	"bgmVolume",
	"seVolume",
	"voiceVolume",
	"pad",
	"padSide",
	"speed",
	"wipe",
] as const;

/** セーブデータを 消すか 2回 きき、計算問題（ui/quiz.ts）に 答えさせる。消したら 読みなおす（村の はじめから）。 */
const askWipe = async (ctx: Ctx): Promise<void> => {
	const no = [
		{ label: "消す", value: "yes" },
		{ label: "やめる", value: "no" },
	];
	const v1 = await listWindow(
		ctx,
		"セーブデータを　消して<br>はじめから　やりなおしますか？<br><small>村の　育ち・倉庫・図鑑・冒険の記録・リプレイ・中断した　冒険が　ぜんぶ　消える（せっていは　のこる）</small>",
		no,
		{ start: 1 },
	);
	if (v1 !== "yes") return;
	const v2 = await listWindow(
		ctx,
		"ほんとうに　消しますか？<br><small>もとに　もどせません</small>",
		no,
		{ start: 1 },
	);
	if (v2 !== "yes") return;
	// 最後に 計算問題（押しまちがいで 消さないように。ui/quiz.ts）。まちがえたら 消さない
	const q = makeQuiz();
	const v3 = await listWindow(
		ctx,
		`消すなら、問題に　答えて<br>${q.text}　は？`,
		[
			...q.options.map((n) => ({ label: String(n), value: String(n) })),
			{ label: "やめる", value: "no" },
		],
		{ start: 4 },
	);
	if (v3 === null || v3 === "no") return;
	if (Number(v3) !== q.answer) {
		await listWindow(ctx, "ちがう。<br>消すのは　やめておいた。", [
			{ label: "もどる", value: "ok" },
		]);
		return;
	}
	wipeSaves();
	location.reload();
};

export const openSettings = async (
	ctx: Ctx,
	opt: { wipe?: boolean } = {},
): Promise<void> => {
	let start = 0;
	for (;;) {
		const v = await listWindow(
			ctx,
			"せってい",
			[
				{ label: "ボイス", sub: voiceLabel(ctx.audio), value: "voice" },
				{
					label: "BGM・効果音",
					sub: settings.mute ? "ミュート中" : "ON",
					value: "mute",
				},
				{ label: "BGMの音", sub: BGM_LABEL[settings.bgm], value: "bgm" },
				{
					label: "BGMの大きさ",
					sub: String(settings.bgmVolume),
					value: "bgmVolume",
				},
				{
					label: "効果音の大きさ",
					sub: String(settings.seVolume),
					value: "seVolume",
				},
				{
					label: "ボイスの大きさ",
					sub: String(settings.voiceVolume),
					value: "voiceVolume",
				},
				{
					label: "十字キー",
					sub: settings.pad ? "表示" : "かくす（タップで歩く）",
					value: "pad",
				},
				{
					label: "十字キーの位置",
					sub: settings.padSide === "left" ? "左" : "右",
					value: "padSide",
				},
				{
					label: "敵の動き",
					sub: settings.speed === "fast" ? "はやい" : "ふつう",
					value: "speed",
				},
				...(opt.wipe
					? [
							{
								label: "セーブデータを　消す",
								sub: "はじめから",
								value: "wipe",
							},
						]
					: []),
			],
			{ start },
		);
		if (v === null) return;
		start = Math.max(0, KEYS.indexOf(v as (typeof KEYS)[number]));
		if (v === "voice") {
			if (settings.voice) saveSettings({ voice: false });
			else await askVoice(ctx);
		} else if (v === "mute") saveSettings({ mute: !settings.mute });
		else if (v === "bgm") saveSettings({ bgm: NEXT_BGM[settings.bgm] });
		else if (v === "bgmVolume") {
			const n = await pickVolume(ctx, "BGMの大きさ", settings.bgmVolume);
			if (n !== null) saveSettings({ bgmVolume: n });
		} else if (v === "seVolume") {
			const n = await pickVolume(ctx, "効果音の大きさ", settings.seVolume);
			if (n !== null) {
				saveSettings({ seVolume: n });
				// 決めた大きさで1回鳴らして聞かせる（決定の音と重ならないよう少し待つ）
				setTimeout(() => ctx.se("cursor"), 250);
			}
		} else if (v === "voiceVolume") {
			const n = await pickVolume(ctx, "ボイスの大きさ", settings.voiceVolume);
			if (n !== null) saveSettings({ voiceVolume: n });
		} else if (v === "pad") saveSettings({ pad: !settings.pad });
		else if (v === "padSide")
			saveSettings({ padSide: settings.padSide === "left" ? "right" : "left" });
		else if (v === "speed")
			saveSettings({ speed: settings.speed === "fast" ? "normal" : "fast" });
		else if (v === "wipe") await askWipe(ctx);
	}
};
