// 1打席の 絵（public/sprites/baseball.png）の どこに 何が あるか。scripts/make-baseball.mjs が 書く（手で 直さない）。
// x,y は 1コマ目の 左上。コマは 右へ w ずつ 並ぶ（n コマ）。歩行グラ（walk*）は 32x64 で 行が 後・右・前・左、列が 足踏み。

export const BB_SHEET = "pub:sprites/baseball.png";

export const BB_SPR = {
	bgNight: { x: 0, y: 0, w: 240, h: 150, n: 1 },
	bgDay: { x: 240, y: 0, w: 240, h: 150, n: 1 },
	cheerNight: { x: 480, y: 0, w: 240, h: 24, n: 1 },
	cheerDay: { x: 480, y: 24, w: 240, h: 24, n: 1 },
	lamp: { x: 720, y: 0, w: 6, h: 6, n: 4 },
	digit: { x: 744, y: 0, w: 4, h: 6, n: 10 },
	icon: { x: 784, y: 0, w: 6, h: 6, n: 3 },
	ball6: { x: 808, y: 0, w: 8, h: 8, n: 4 },
	ball4: { x: 840, y: 0, w: 8, h: 8, n: 2 },
	ball2: { x: 856, y: 0, w: 8, h: 8, n: 1 },
	shadow6: { x: 864, y: 0, w: 8, h: 8, n: 1 },
	shadow4: { x: 872, y: 0, w: 8, h: 8, n: 1 },
	glint: { x: 880, y: 0, w: 8, h: 8, n: 2 },
	dust: { x: 896, y: 0, w: 8, h: 8, n: 2 },
	farGen: { x: 720, y: 24, w: 8, h: 12, n: 2 },
	farNanashi: { x: 736, y: 24, w: 8, h: 12, n: 8 },
	kiriko: { x: 480, y: 48, w: 56, h: 52, n: 6 },
	trail: { x: 816, y: 48, w: 56, h: 52, n: 1 },
	pitcherShobon: { x: 480, y: 100, w: 24, h: 32, n: 7 },
	pitcherYakiu: { x: 648, y: 100, w: 24, h: 32, n: 7 },
	pitcherNanashi: { x: 816, y: 100, w: 24, h: 32, n: 7 },
	fieldNight: { x: 0, y: 150, w: 360, h: 280, n: 1 },
	fieldDay: { x: 360, y: 150, w: 360, h: 280, n: 1 },
	catcher: { x: 720, y: 150, w: 24, h: 24, n: 2 },
	umpire: { x: 768, y: 150, w: 24, h: 32, n: 2 },
	fireworks: { x: 816, y: 150, w: 64, h: 32, n: 2 },
	walkKiriko: { x: 720, y: 182, w: 32, h: 64, n: 1 },
	walkGen: { x: 752, y: 182, w: 32, h: 64, n: 1 },
	walkYakiu: { x: 784, y: 182, w: 32, h: 64, n: 1 },
	walkNanashi: { x: 816, y: 182, w: 32, h: 64, n: 4 },
	pose: { x: 720, y: 246, w: 16, h: 16, n: 5 },
	fx: { x: 720, y: 262, w: 16, h: 16, n: 13 },
} as const;

/** BB_SPR.pose の 何コマ目か（RPGEN なんJキャラ）。 */
export const BB_POSE = {
	genGlove: 0,
	genDive: 1,
	genCatcher: 2,
	yakiuGlove: 3,
	yakiuBack: 4,
} as const;

/** BB_SPR.fx の 何コマ目か（RPGEN エフェクト）。 */
export const BB_FX = {
	impact0: 0,
	impact1: 1,
	impact2: 2,
	star: 3,
	spark0: 4,
	spark1: 5,
	spark2: 6,
	wow: 7,
	bang: 8,
	what: 9,
	pop: 10,
	maru: 11,
	batsu: 12,
} as const;
