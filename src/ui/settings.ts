// せってい（タイトルとゲーム中のメニューの両方から開く）。rpg の settingsMenu を元にしている。
//
// - 2択・3択は、押すたびに次の値へ切りかえる（一覧を開き直す手間をはぶく）。
// - 音量だけは 0〜100 を 10 刻みの一覧から選ぶ。
// - 変えたら すぐ saveSettings（音・十字キーは onSettingsChange で その場に効く）。

import { type Settings, saveSettings, settings } from "../engine/settings";
import type { Ctx } from "./ctx";
import { listWindow } from "./list";

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

const KEYS = [
	"mute",
	"bgm",
	"bgmVolume",
	"seVolume",
	"pad",
	"padSide",
	"speed",
] as const;

export const openSettings = async (ctx: Ctx): Promise<void> => {
	let start = 0;
	for (;;) {
		const v = await listWindow(
			ctx,
			"せってい",
			[
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
			],
			{ start },
		);
		if (v === null) return;
		start = Math.max(0, KEYS.indexOf(v as (typeof KEYS)[number]));
		if (v === "mute") saveSettings({ mute: !settings.mute });
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
		} else if (v === "pad") saveSettings({ pad: !settings.pad });
		else if (v === "padSide")
			saveSettings({ padSide: settings.padSide === "left" ? "right" : "left" });
		else if (v === "speed")
			saveSettings({ speed: settings.speed === "fast" ? "normal" : "fast" });
	}
};
