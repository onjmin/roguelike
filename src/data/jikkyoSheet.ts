// ナイター実況の 絵（public/sprites/jikkyo.png）の どこに 何が あるか。scripts/make-jikkyo.mjs が 書く（手で 直さない）。
// x,y は 1コマ目の 左上。コマは 右へ w ずつ 並ぶ（n コマ）。差しかえ色は 胴 #ff00ff・帽子 #00ffff・ベルト #ffff00・ズボン #00ff00。

export const JK_SHEET = "pub:sprites/jikkyo.png";

/** 差しかえ色（実行時に 球団の 色へ）。 */
export const JK_KEY = {
	body: [255, 0, 255],
	cap: [0, 255, 255],
	trim: [255, 255, 0],
	pants: [0, 255, 0],
} as const;

export const JK_SPR = {
	bgPitch: { x: 0, y: 0, w: 240, h: 135, n: 1 },
	bgField: { x: 0, y: 135, w: 240, h: 135, n: 1 },
	pitcher: { x: 0, y: 270, w: 16, h: 24, n: 3 },
	batter: { x: 48, y: 270, w: 12, h: 18, n: 2 },
	catcher: { x: 72, y: 270, w: 12, h: 10, n: 1 },
	fielder: { x: 84, y: 270, w: 6, h: 9, n: 2 },
	runner: { x: 96, y: 270, w: 6, h: 9, n: 2 },
	bustPitcher: { x: 108, y: 270, w: 24, h: 32, n: 1 },
	bustBatter: { x: 132, y: 270, w: 24, h: 32, n: 1 },
	joy: { x: 156, y: 270, w: 24, h: 32, n: 2 },
	capBadge: { x: 204, y: 270, w: 12, h: 8, n: 1 },
	helmetBadge: { x: 216, y: 270, w: 12, h: 8, n: 1 },
	umpire: { x: 228, y: 270, w: 12, h: 14, n: 1 },
	digitW: { x: 0, y: 302, w: 5, h: 7, n: 10 },
	digitY: { x: 50, y: 302, w: 5, h: 7, n: 10 },
	lampOn: { x: 100, y: 302, w: 5, h: 5, n: 1 },
	lampOff: { x: 105, y: 302, w: 5, h: 5, n: 1 },
	outText: { x: 110, y: 302, w: 11, h: 5, n: 1 },
	baseEmpty: { x: 121, y: 302, w: 4, h: 4, n: 1 },
	baseOn: { x: 125, y: 302, w: 4, h: 4, n: 1 },
	topMark: { x: 129, y: 302, w: 5, h: 4, n: 1 },
	botMark: { x: 134, y: 302, w: 5, h: 4, n: 1 },
	ball2: { x: 139, y: 302, w: 2, h: 2, n: 1 },
	ball3: { x: 141, y: 302, w: 3, h: 3, n: 1 },
	ball4: { x: 144, y: 302, w: 4, h: 4, n: 1 },
	shadow: { x: 148, y: 302, w: 4, h: 2, n: 1 },
	live: { x: 152, y: 302, w: 20, h: 7, n: 1 },
	gloss: { x: 172, y: 302, w: 6, h: 6, n: 1 },
	speaker: { x: 178, y: 302, w: 9, h: 8, n: 1 },
	balloon: { x: 188, y: 302, w: 3, h: 6, n: 3 },
	fireworks: { x: 198, y: 302, w: 8, h: 8, n: 2 },
	cm: { x: 0, y: 312, w: 64, h: 36, n: 1 },
	crowd: { x: 64, y: 312, w: 16, h: 8, n: 2 },
	stand: { x: 96, y: 312, w: 32, h: 16, n: 1 },
} as const;
