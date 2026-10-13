// キリコの 家の 遊べる 家具「ブラウン管と 古い ゲーム機」の ピンポン（板は ui/arcade/home/pong.ts）。
// 左が キリコの ラケット、右が CPU の 名無し。球は 打つたびに 速く なり、ラケットの 端で 打つほど 角度が つく。
// 名無しは 速さに 限りが あり、球を 見てから 動くまでに 間が あるので 勝てる。先に 7点で おわり。
// 名無しは キリコに 点を とられる たびに 本気に なる（速く・ぶれが 小さく・見なおしが 早く。
// 4点 とられると 壁の はねかえりも 読む。球が 速いほど ぶれる）。ラケットを 動かしながら 打つと スマッシュ（球が ぐっと 速い）。
// スコア：勝ち＝1000＋(7−相手の 点)×100、負け＝自分の 点×100。DOM に 触らない（試験できる）。

import { AH, ATOP, AW, type Rnd } from "../logic";

export const PONG = {
	/** 何点で 勝ちか。 */
	goal: 7,
	padW: 3,
	padH: 24,
	/** ラケットの x（左の ふち）。 */
	meX: 8,
	cpuX: AW - 11,
	ball: 3,
	/** 自分の ラケットの 速さ（画素／秒）。 */
	meSpeed: 130,
	/** 名無しの ラケットの 速さ。 */
	cpuSpeed: 78,
	/** 名無しが 球を 見なおす 間（秒）。 */
	cpuLag: 0.16,
	/** 名無しの ねらいの ぶれ（画素）。 */
	cpuErr: 14,
	speed0: 92,
	speedUp: 9,
	speedMax: 230,
	/** 端で 打った ときの 角度（ラジアン）。 */
	angle: 1.0,
	/** 点の あとの 間（秒）。 */
	serveWait: 0.9,
	/** キリコの 点 1つごとに 名無しが 強く なる ぶん（速さ・見なおしの 間・ぶれ）。 */
	cpuSpeedUp: 9,
	cpuLagDown: 0.01,
	cpuErrDown: 1,
	/** 名無しが 壁の はねかえりを 読みはじめる キリコの 点。 */
	cpuReadAt: 4,
	/** スマッシュに なる ラケットの 速さ（画素／秒）と 足す 球の 速さ。 */
	smashVel: 60,
	smashUp: 45,
} as const;

/** 板の 上下の 壁（球の 中心が 動ける はば）。 */
const TOP = ATOP + 2;
const BOT = AH - 2;

export const PONG_TEXT = {
	me: "キリコ",
	cpu: "名無し",
	win: "キリコの　勝ち",
	lose: "名無しの　勝ち",
	note: "↑↓で　動く。タップで　その　高さへ",
	smash: "スマッシュ",
	/** 名無しの ひとこと（キリコが 点を とった とき。点の 数で 選ぶ）。 */
	cpuHurt: [
		"まぐれやろ",
		"ほーん",
		"ちょっと　本気　出すわ",
		"ぐぬぬ",
		"ワイを　怒らせたな",
		"ここからや",
		"ファッ！？",
	],
	/** 名無しが 点を とった とき。 */
	cpuGot: ["もろたで", "ほい", "甘いで", "見えとるで"],
} as const;

export type PongState = {
	/** ラケットの 上の ふち。 */
	me: number;
	cpu: number;
	/** 名無しが ねらう 高さ（中心）と、つぎに 見なおすまでの 秒。 */
	cpuAim: number;
	cpuThink: number;
	bx: number;
	by: number;
	vx: number;
	vy: number;
	speed: number;
	/** つぎの 球までの 秒（0 なら 動いて いる）。 */
	wait: number;
	/** つぎに 球を 出す 向き（1 なら 右＝名無しへ）。 */
	serveDir: 1 | -1;
	mePts: number;
	cpuPts: number;
	hits: number;
	over: boolean;
	/** キリコの ラケットの いまの 速さ（画素／秒。スマッシュを 見る）。 */
	meVel: number;
};

export type PongInput = { dy: -1 | 0 | 1; target: number | null };
export type PongEvent =
	| "hit"
	| "smash"
	| "wall"
	| "point"
	| "lost"
	| "win"
	| "lose";

const clamp = (v: number, lo: number, hi: number) =>
	Math.max(lo, Math.min(hi, v));

const padMin = TOP - 2;
const padMax = BOT + 2 - PONG.padH;

const serve = (s: PongState, rnd: Rnd): void => {
	s.bx = AW / 2;
	s.by = TOP + 20 + rnd() * (BOT - TOP - 40);
	s.speed = PONG.speed0;
	const a = (rnd() - 0.5) * 0.9;
	s.vx = Math.cos(a) * s.speed * s.serveDir;
	s.vy = Math.sin(a) * s.speed;
};

export const pongStart = (rnd: Rnd): PongState => {
	const mid = (TOP + BOT) / 2 - PONG.padH / 2;
	const s: PongState = {
		me: mid,
		cpu: mid,
		cpuAim: (TOP + BOT) / 2,
		cpuThink: 0,
		bx: AW / 2,
		by: (TOP + BOT) / 2,
		vx: 0,
		vy: 0,
		speed: PONG.speed0,
		wait: PONG.serveWait,
		serveDir: -1,
		mePts: 0,
		cpuPts: 0,
		hits: 0,
		over: false,
		meVel: 0,
	};
	serve(s, rnd);
	return s;
};

export const pongScore = (s: PongState): number =>
	s.mePts >= PONG.goal ? 1000 + (PONG.goal - s.cpuPts) * 100 : s.mePts * 100;

export const pongWon = (s: PongState): boolean => s.mePts >= PONG.goal;

/** ラケットに 当たったら 打ち返す（dir は 返す 向き。smash なら ぐっと 速く）。 */
const bounce = (
	s: PongState,
	top: number,
	dir: 1 | -1,
	smash = false,
): void => {
	const rel = clamp((s.by - (top + PONG.padH / 2)) / (PONG.padH / 2), -1, 1);
	s.speed = Math.min(PONG.speedMax, s.speed + PONG.speedUp);
	if (smash) s.speed += PONG.smashUp;
	const a = rel * PONG.angle;
	s.vx = Math.cos(a) * s.speed * dir;
	s.vy = Math.sin(a) * s.speed;
	s.hits++;
};

/** t 秒 あとに 球が いる 高さ（上下の 壁で はねかえす）。 */
const landY = (by: number, vy: number, t: number): number => {
	const h = BOT - TOP;
	const y = (((by - TOP + vy * t) % (2 * h)) + 2 * h) % (2 * h);
	return TOP + (y > h ? 2 * h - y : y);
};

export const pongStep = (
	s: PongState,
	dt: number,
	ip: PongInput,
	rnd: Rnd,
): PongEvent[] => {
	const ev: PongEvent[] = [];
	if (s.over) return ev;
	// 自分の ラケット（キーが 先、なければ タップした 高さへ）
	const me0 = s.me;
	if (ip.dy !== 0) s.me += ip.dy * PONG.meSpeed * dt;
	else if (ip.target !== null) {
		const d = ip.target - (s.me + PONG.padH / 2);
		s.me += clamp(d, -PONG.meSpeed * dt, PONG.meSpeed * dt);
	}
	s.me = clamp(s.me, padMin, padMax);
	s.meVel = dt > 0 ? (s.me - me0) / dt : 0;
	// 名無し：ときどき 球を 見て ねらいを きめる（こっちへ 来る 球だけ 追う）。キリコの 点で 強く なる
	const k = s.mePts;
	s.cpuThink -= dt;
	if (s.cpuThink <= 0) {
		s.cpuThink = Math.max(0.05, PONG.cpuLag - PONG.cpuLagDown * k);
		const err =
			(PONG.cpuErr - PONG.cpuErrDown * k) *
			(0.4 + (0.6 * s.speed) / PONG.speed0);
		const y =
			k >= PONG.cpuReadAt
				? landY(s.by, s.vy, (PONG.cpuX - s.bx) / Math.max(1, s.vx))
				: s.by;
		s.cpuAim =
			s.vx > 0 && s.wait <= 0 ? y + (rnd() - 0.5) * 2 * err : (TOP + BOT) / 2;
	}
	const cs = PONG.cpuSpeed + PONG.cpuSpeedUp * k;
	const cd = s.cpuAim - (s.cpu + PONG.padH / 2);
	s.cpu = clamp(s.cpu + clamp(cd, -cs * dt, cs * dt), padMin, padMax);
	if (s.wait > 0) {
		s.wait -= dt;
		return ev;
	}
	const px = s.bx;
	s.bx += s.vx * dt;
	s.by += s.vy * dt;
	if (s.by < TOP) {
		s.by = TOP + (TOP - s.by);
		s.vy = Math.abs(s.vy);
		ev.push("wall");
	} else if (s.by > BOT) {
		s.by = BOT - (s.by - BOT);
		s.vy = -Math.abs(s.vy);
		ev.push("wall");
	}
	const r = PONG.ball / 2;
	const hitY = (top: number) => s.by + r >= top && s.by - r <= top + PONG.padH;
	// 左の ラケット（前の こまで 前に いて、いま 面を こえた）
	const meFace = PONG.meX + PONG.padW;
	if (s.vx < 0 && px - r >= meFace - 1 && s.bx - r < meFace && hitY(s.me)) {
		s.bx = meFace + r;
		const smash = Math.abs(s.meVel) >= PONG.smashVel;
		bounce(s, s.me, 1, smash);
		ev.push(smash ? "smash" : "hit");
	}
	const cpuFace = PONG.cpuX;
	if (s.vx > 0 && px + r <= cpuFace + 1 && s.bx + r > cpuFace && hitY(s.cpu)) {
		s.bx = cpuFace - r;
		bounce(s, s.cpu, -1);
		ev.push("hit");
	}
	// 点
	if (s.bx < -4 || s.bx > AW + 4) {
		const mine = s.bx > AW;
		if (mine) s.mePts++;
		else s.cpuPts++;
		ev.push(mine ? "point" : "lost");
		if (s.mePts >= PONG.goal || s.cpuPts >= PONG.goal) {
			s.over = true;
			ev.push(mine ? "win" : "lose");
			return ev;
		}
		// 取られた ほうへ 出す
		s.serveDir = mine ? 1 : -1;
		s.wait = PONG.serveWait;
		serve(s, rnd);
	}
	return ev;
};
