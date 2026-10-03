// 設定（端末ごとに localStorage へ保存）。

const KEY = "kiriko-roguelike/settings";

export type Settings = {
	/** BGM と効果音をまとめて消す（画面右上のボタン）。 */
	mute: boolean;
	/** 村の 会話の 読み上げ（初回に 約45MBの データを 取得する）。既定 OFF（rpg と 同じ）。 */
	voice: boolean;
	/** BGM の鳴らし方。hq = SoundFont（楽器の音色つき）/ light = 内蔵シンセ / off。 */
	bgm: "hq" | "light" | "off";
	/** 0-100 */
	bgmVolume: number;
	seVolume: number;
	voiceVolume: number;
	/** 画面の十字キーを出す（タップ移動だけで遊ぶ人は消せる）。 */
	pad: boolean;
	/** 動きの速さ（敵の番の見せ方）。 */
	speed: "normal" | "fast";
	/** 十字キーを左手側に置く（右利き向けの既定は左）。 */
	padSide: "left" | "right";
	/** 小さいボタン（向き・足元・地図）を 出す。既定は 出さない（ボタンが 多いと 操作しにくい）。 */
	minis: boolean;
	/** 村で 鳴らす 曲（広場の 蓄音機で えらぶ。null は 村の 育ちに あわせる。data/music.ts）。 */
	villageBgm: string | null;
};

const DEFAULTS: Settings = {
	mute: false,
	voice: false,
	bgm: "hq",
	bgmVolume: 40,
	seVolume: 60,
	voiceVolume: 80,
	pad: true,
	speed: "normal",
	padSide: "left",
	minis: false,
	villageBgm: null,
};

const VERSION = 1;

const load = (): Settings => {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const saved = JSON.parse(raw) as Partial<Settings> & { v?: number };
			return { ...DEFAULTS, ...saved };
		}
	} catch {
		// 壊れていたら既定値
	}
	return { ...DEFAULTS };
};

export const settings: Settings = load();

const listeners = new Set<() => void>();

export const onSettingsChange = (fn: () => void): (() => void) => {
	listeners.add(fn);
	return () => listeners.delete(fn);
};

export const saveSettings = (patch: Partial<Settings>): void => {
	Object.assign(settings, patch);
	try {
		localStorage.setItem(KEY, JSON.stringify({ ...settings, v: VERSION }));
	} catch {
		// プライベートモード等で保存できなくても遊べる
	}
	for (const fn of listeners) fn();
};
