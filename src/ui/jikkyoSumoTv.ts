// 大相撲『保守場所』の TV（銭湯「ゆ」の 脱衣所の テレビ。ui/jikkyoWatch.ts の 板の 上の キャンバス）。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標）。絵は ぜんぶ 塗り（読む 絵は ない）。
// - 枠：部屋の テレビ（crtFrame）の 両わきを 銭湯の タイルの 壁に、台の 上に コーヒー牛乳。
// - 場面（data/jikkyo/sumo.ts の SUMO_SCENES）：札・番組の 題（番付の 紙）・土俵（仕切り・取組・勝ち名乗り・懸賞旗・
//   時間いっぱい）・物言い（黒い 審判 5人が 集まる）・立ち合い（山場。2人が 1拍ごとに こぶしを つき、4つめで ぶつかる。
//   早すぎると「待った！」）・座布団（横綱が 負けて 舞う）・弓取式・表彰式（千秋楽）。
// - 凝った 絵は 立ち合いと 座布団の 2つ。ほかは 土俵の 絵を 使いまわす。
// - 動きは 名目の 時計（c.lt・c.t）、点滅と ゆれは 実際の 時計（c.now）。動きを へらす 設定では 塩・砂・座布団の 飛びを 止める。

import { SUMO_ART, SUMO_SCENES, type SumoData } from "../data/jikkyo/sumo";
import {
	bands,
	cardScene,
	clamp01,
	crtFrame,
	type G,
	hash,
	type KitTv,
	makeTv,
	person,
	pulseGlow,
	type TvCtx,
	text,
} from "./jikkyoTvKit";

type C = TvCtx<SumoData>;

const SKIN = "#f0c49a";
const SKIN_D = "#d09a6c";
const HAIR = "#1a1414";
const CLAY = "#d2a66e";
const CLAY_D = "#a8784a";
const TAWARA = "#efe4c2";
const JUDGE = "#1c1c22";
/** 懸賞旗の 色（SUMO_ART.kensho の 番）と 旗の 字。 */
const FLAG = ["#2a78c0", "#d84a2a", "#2a8a4a", "#c8a020", "#a03050", "#3a5aa0"];

/** 土俵の まんなか（スクリーンの 中）。 */
const CX = 90;
const RY = 72;

const r = Math.round;

/** まわしの 色（横綱は 黒、ほかは しこ名の 字の 数で きめる。取組の 2人は ちがう 色）。 */
const BELTS = ["#5a2a7a", "#1a4a8a", "#7a2a2a", "#2a5a3a", "#6a5020"];
const beltOf = (name = "", yokozuna = false): string =>
	yokozuna ? "#202024" : BELTS[[...name].length % BELTS.length];

// ───────────────── 人 ─────────────────

type Pose = "stand" | "crouch" | "push" | "down";

/** 形の 1つ（右向き。足もとの まんなかからの dx・dy・w・h と 色の 鍵）。 */
type Part = readonly [number, number, number, number, string];
/** 「dx,dy,w,h,色」を 空白で 並べた 文 → 形。 */
const parts = (s: string): Part[] =>
	s.split(" ").map((p) => {
		const [dx, dy, w, h, col] = p.split(",");
		return [Number(dx), Number(dy), Number(w), Number(h), col];
	});
/** 力士の 形（色：s 肌・d 影・h 髪・b まわし・w 綱（横綱だけ）。push は 組みあって 前へ 出る 形）。 */
const POSE: Readonly<Record<Pose, readonly Part[]>> = {
	down: parts("-10,-6,18,6,s -3,-6,6,6,b 8,-7,5,5,s 8,-8,5,2,h"),
	stand: parts(
		"-5,-5,3,5,d 2,-5,3,5,d -6,-9,12,4,b -7,-19,14,10,s -9,-18,2,7,s 7,-18,2,7,s -3,-25,6,6,s -3,-26,6,2,h -2,-28,2,2,h -7,-10,14,2,w -1,-8,2,3,w",
	),
	crouch: parts(
		"-8,-4,4,4,d 4,-4,4,4,d -6,-8,12,4,b -4,-15,12,7,s 4,-16,6,6,s 4,-17,6,2,h 2,-18,2,2,h 6,-10,2,9,s 5,-2,4,2,d -6,-9,12,2,w",
	),
	push: parts(
		"-7,-6,3,6,d 2,-6,3,6,d -6,-10,12,4,b -5,-19,12,9,s 3,-24,6,6,s 3,-25,6,2,h 1,-27,2,2,h 7,-17,6,2,s -6,-11,12,2,w",
	),
};

/** 立ち合いの 大きな 力士（2倍。足・体。手は bigCrouch が こぶしの 数で 描く）。 */
const BIG_LEGS = parts("-20,-12,10,12,d 4,-12,10,12,d -22,-3,7,3,d 8,-3,7,3,d");
const BIG_BODY = parts(
	"-16,-21,28,9,b -15,-31,29,10,s -12,-35,23,4,s 14,-32,11,11,s 14,-34,11,4,h 8,-36,6,4,h 22,-28,2,2,h -16,-23,28,3,w -6,-20,2,6,w 3,-20,2,6,w",
);
/** 手（上げた・こぶしを ついた。肩からの 形）。 */
const ARM = [
	parts("0,-27,5,12,k -1,-17,7,4,k"),
	parts("0,-27,5,25,k -1,-4,7,4,k"),
] as const;

/** 色の 鍵 → 色（綱の ない 力士は w を 塗らない）。 */
const inkOf = (belt: string, tsuna = false): Record<string, string> => ({
	s: SKIN,
	d: SKIN_D,
	h: HAIR,
	b: belt,
	w: tsuna ? "#ffffff" : "",
});

/** 形を 塗る（右向きの 形を 向きに あわせて 裏がえす。lift だけ 上へ）。 */
const paint = (
	g: G,
	x: number,
	y: number,
	face: 1 | -1,
	ink: Record<string, string>,
	list: readonly Part[],
	lift = 0,
) => {
	for (const [dx, dy, w, h, col] of list) {
		if (!ink[col]) continue;
		g.fillStyle = ink[col];
		g.fillRect(face > 0 ? x + dx : x - dx - w, y + dy - lift, w, h);
	}
};

/** 力士（足もとの まんなか x・y。face は 向き 1＝右・−1＝左）。 */
const rikishi = (
	g: G,
	x: number,
	y: number,
	pose: Pose,
	face: 1 | -1,
	belt: string,
	tsuna = false,
): void => paint(g, r(x), r(y), face, inkOf(belt, tsuna), POSE[pose]);

/** 行司（烏帽子と 軍配。x・y は 足もと）。 */
const gyoji = (g: G, x0: number, y0: number, face: 1 | -1, raise = false) => {
	const x = r(x0) - 3;
	const y = r(y0) - 12;
	person(g, x, y, "#8a3aa0", HAIR);
	g.fillStyle = HAIR;
	g.fillRect(x + 1, y - 3, 4, 3);
	g.fillStyle = "#e8c040";
	const fx = face > 0 ? x + 7 : x - 5;
	g.fillRect(fx, raise ? y - 6 : y + 3, 4, 4);
	g.fillStyle = "#6a4a20";
	g.fillRect(fx + 1, raise ? y - 2 : y + 7, 2, 3);
};

// ───────────────── 土俵 ─────────────────

/** 俵（点で 描く だ円）。 */
const ring = (g: G, cx: number, cy: number, rx: number, ry: number) => {
	g.fillStyle = TAWARA;
	for (let i = 0; i < 96; i++) {
		const a = (i / 96) * Math.PI * 2;
		g.fillRect(r(cx + Math.cos(a) * rx), r(cy + Math.sin(a) * ry), 2, 1);
	}
};

/** 房（吊り屋根の すみ。青・赤・白・黒）。 */
const tassel = (g: G, x: number, y: number, col: string) => {
	g.fillStyle = col;
	g.fillRect(x, y, 3, 7);
	g.fillRect(x - 1, y + 7, 5, 3);
};

/** 塗った 多角形（x, y を 並べる）。 */
const poly = (g: G, col: string, pts: readonly number[]) => {
	g.fillStyle = col;
	g.beginPath();
	g.moveTo(pts[0], pts[1]);
	for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
	g.closePath();
	g.fill();
};

/** ふちどりの 白い 字（名前の 札）。 */
const label = (g: G, s: string, x: number, y: number, align: CanvasTextAlign) =>
	text(g, s, x, y, 8, "#ffffff", { align, outline: "#000000" });

/** 会場（客席・吊り屋根と 房・土俵・俵・仕切り線）。 */
const arena = (g: G, c: C): void => {
	const { W, H } = c;
	g.fillStyle = "#3a2622";
	g.fillRect(0, 0, W, 54);
	for (let k = 0; k < 4; k++) {
		g.fillStyle = k % 2 ? "#4a302a" : "#422a24";
		g.fillRect(0, 14 + k * 9, W, 9);
	}
	for (let i = 0; i < 60; i++) {
		const y = 15 + (i % 4) * 9 + Math.floor(hash(i, 2) * 3);
		g.fillStyle = hash(i, 3) < 0.5 ? "#1c1210" : "#2c1c16";
		g.fillRect(Math.floor(hash(i, 1) * W), y, 3, 3);
	}
	g.fillStyle = "#5a3820";
	g.fillRect(24, 0, W - 48, 5);
	g.fillStyle = "#7a5030";
	g.fillRect(16, 5, W - 32, 3);
	tassel(g, 18, 8, "#3a6ad8");
	tassel(g, W - 21, 8, "#d83a3a");
	// 土俵（台形の 横と 上）
	poly(g, CLAY_D, [22, 54, W - 22, 54, W - 2, 96, 2, 96]);
	poly(g, CLAY, [26, 54, W - 26, 54, W - 10, 88, 10, 88]);
	g.fillStyle = "#2a1c16";
	g.fillRect(0, 96, W, H - 96);
	ring(g, CX, RY, 62, 13);
	g.fillStyle = "#ffffff";
	g.fillRect(CX - 10, RY - 1, 2, 4);
	g.fillRect(CX + 8, RY - 1, 2, 4);
};

/** 東・西の 名前（上の すみ）。 */
const plates = (g: G, c: C) => {
	const d = c.data;
	if (d.east) label(g, `${SUMO_ART.east}　${d.east}`, 3, 20, "left");
	if (d.west) label(g, `${d.west}　${SUMO_ART.west}`, c.W - 3, 20, "right");
};

/** 懸賞旗（土俵の まわりを 呼出が 回る。いちばん 手前の 旗の 店の 名前を 下に）。 */
const banners = (g: G, c: C, list: readonly number[]) => {
	if (!list.length) return;
	const a0 = c.still ? 0.4 : c.lt / 2600;
	const items = list
		.map((k, i) => {
			const a = a0 + (i / list.length) * Math.PI * 2;
			return { k, x: CX + Math.cos(a) * 70, y: RY + 4 + Math.sin(a) * 18 };
		})
		.sort((p, q) => p.y - q.y);
	for (const it of items) {
		const x = r(it.x);
		const y = r(it.y);
		person(g, x - 3, y - 12, "#2a3a6a", HAIR);
		g.fillStyle = "#6a4a20";
		g.fillRect(x + 3, y - 34, 1, 26);
		g.fillStyle = FLAG[it.k % FLAG.length];
		g.fillRect(x + 4, y - 34, 11, 22);
		g.fillStyle = "#ffffff";
		g.fillRect(x + 6, y - 31, 7, 16);
		text(g, SUMO_ART.kenshoMark[it.k] ?? "", x + 10, y - 28, 8, "#1a1a24");
	}
	const front = items[items.length - 1];
	const name = SUMO_ART.kensho[front.k] ?? "";
	g.fillStyle = "rgba(255, 255, 255, 0.92)";
	g.fillRect(CX - 44, 30, 88, 12);
	text(g, name, CX, 32, 8, "#1a1a24");
};

/** 塩（立って いる 力士が 上へ まく）。 */
const salt = (g: G, c: C, x: number, y: number, t: number) => {
	if (c.still || t < 0 || t > 700) return;
	g.fillStyle = "#ffffff";
	const p = t / 700;
	for (let i = 0; i < 10; i++) {
		const sy = y - 28 - p * 14 + hash(i, 42) * 6 + p * p * 20;
		g.fillRect(r(x + (hash(i, 41) - 0.5) * 24 * p), r(sy), 1, 1);
	}
};

// ───────────────── 土俵の 場面 ─────────────────

/** 取組（立ち合い → 押しあい → 勝負）。 */
const bout = (g: G, c: C) => {
	const d = c.data;
	const be = beltOf(d.east, d.yokozuna);
	const bw = beltOf(d.west);
	const t = c.lt;
	if (t < 400) {
		gyoji(g, CX - 2, RY - 18, 1);
		rikishi(g, CX - 14, RY + 6, "crouch", 1, be, d.yokozuna);
		rikishi(g, CX + 14, RY + 6, "crouch", -1, bw);
		return;
	}
	const dur = d.dur ?? 2400;
	const p = clamp01((t - 400) / dur);
	const win = d.win ?? "e";
	const sway = c.still ? 0 : Math.sin(t / 500) * 2;
	const off =
		win === "dotai"
			? Math.sin(p * Math.PI * 3) * 14 * (1 - p) + p * 40
			: (win === "e" ? 1 : -1) * (p * 42 + Math.sin(p * Math.PI * 2) * 8);
	const mx = CX + off;
	gyoji(g, CX - 4 + off * 0.5, RY - 18, off >= 0 ? 1 : -1);
	if (p < 1) {
		rikishi(g, mx - 7 + sway, RY + 6, "push", 1, be, d.yokozuna);
		rikishi(g, mx + 7 + sway, RY + 6, "push", -1, bw);
		return;
	}
	if (win === "dotai") {
		rikishi(g, mx - 2, RY + 18, "down", 1, be, d.yokozuna);
		rikishi(g, mx + 14, RY + 20, "down", -1, bw);
		return;
	}
	const s = win === "e" ? 1 : -1;
	rikishi(g, mx - s * 7, RY + 6, "stand", s, win === "e" ? be : bw);
	rikishi(g, mx + s * 22, RY + 20, "down", s, win === "e" ? bw : be);
};

/** 勝ち名乗り（行司が 軍配を 向け、懸賞が あれば のし袋の 束）。 */
const kekka = (g: G, c: C) => {
	const d = c.data;
	const w: 1 | -1 = d.win === "w" ? -1 : 1;
	const be = beltOf(d.east, d.yokozuna);
	const bw = beltOf(d.west);
	const [winBelt, loseBelt] = w > 0 ? [be, bw] : [bw, be];
	// 負けた 力士は 自分の 側へ 下がる
	const back = Math.min(40, c.lt * 0.02);
	rikishi(g, CX + w * (30 + back), RY + 4, "stand", w, loseBelt);
	gyoji(g, CX + w * 4, RY - 14, w > 0 ? -1 : 1);
	rikishi(g, CX - w * 16, RY + 8, "crouch", w, winBelt, w > 0 && d.yokozuna);
	const n = d.kensho?.length ?? 0;
	if (!n || c.lt < 1200) return;
	g.fillStyle = "#ffffff";
	for (let i = 0; i < n; i++)
		g.fillRect(r(CX - w * 6) - 3, RY - 12 - i * 2, 7, 1);
	// 手刀（左・右・まんなか）
	const k = c.still ? 2 : Math.floor((c.lt - 1200) / 300) % 3;
	g.fillStyle = SKIN;
	g.fillRect(r(CX - w * 8) + (k - 1) * 3, RY - 8, 2, 4);
};

const drawDohyo = (g: G, c: C) => {
	arena(g, c);
	const d = c.data;
	const be = beltOf(d.east, d.yokozuna);
	const bw = beltOf(d.west);
	const t = c.lt;
	switch (d.phase) {
		case "bout":
			bout(g, c);
			break;
		case "kekka":
			kekka(g, c);
			break;
		case "musubi":
			gyoji(g, CX - 2, RY - 16, 1);
			rikishi(g, 38, RY + 10, "stand", 1, be, d.yokozuna);
			rikishi(g, 142, RY + 10, "stand", -1, bw);
			banners(g, c, d.kensho ?? []);
			break;
		case "jikan": {
			// 横綱が まわしを たたき、塩を まく。おわりは 2人とも 仕切り線へ
			if (t >= 5500 || c.still) {
				gyoji(g, CX - 2, RY - 18, 1, true);
				rikishi(g, CX - 14, RY + 6, "crouch", 1, be, d.yokozuna);
				rikishi(g, CX + 14, RY + 6, "crouch", -1, bw);
				break;
			}
			gyoji(g, CX - 2, RY - 16, 1);
			rikishi(g, 46, RY + 10, "stand", 1, be, d.yokozuna);
			rikishi(g, 134, RY + 10, "stand", -1, bw);
			salt(g, c, 46, RY + 10, (t % 2400) - 300);
			salt(g, c, 134, RY + 10, (t % 2400) - 1500);
			break;
		}
		default: {
			// 仕切り：立って 塩 → 仕切り線で かがむ（くり返す）
			const k = c.still ? 3000 : t % 4200;
			gyoji(g, CX - 2, RY - 16, 1);
			if (k < 1800) {
				rikishi(g, 48, RY + 10, "stand", 1, be, d.yokozuna);
				rikishi(g, 132, RY + 10, "stand", -1, bw);
				salt(g, c, 48, RY + 10, k - 500);
				salt(g, c, 132, RY + 10, k - 700);
			} else {
				rikishi(g, CX - 14, RY + 6, "crouch", 1, be, d.yokozuna);
				rikishi(g, CX + 14, RY + 6, "crouch", -1, bw);
			}
			if (d.kensho && t < 6000) banners(g, c, d.kensho);
		}
	}
	plates(g, c);
};

// ───────────────── 物言い ─────────────────

/** 審判 5人の 来る 所と 集まる 所（x0, y0, x1, y1）。 */
const JUDGES: readonly (readonly number[])[] = [
	[12, 100, CX - 16, RY + 6],
	[56, 104, CX - 7, RY + 10],
	[124, 104, CX + 7, RY + 10],
	[168, 100, CX + 16, RY + 6],
	[CX, 104, CX, RY + 2],
];

const drawMonoii = (g: G, c: C) => {
	arena(g, c);
	const d = c.data;
	rikishi(g, 26, RY + 12, "stand", 1, beltOf(d.east));
	rikishi(g, 154, RY + 12, "stand", -1, beltOf(d.west));
	gyoji(g, CX + 46, RY - 14, -1);
	const p = clamp01(c.lt / 2600);
	const ease = 1 - (1 - p) * (1 - p);
	JUDGES.forEach(([x0, y0, x1, y1], i) => {
		let x = x0 + (x1 - x0) * ease;
		let y = y0 + (y1 - y0) * ease;
		// 協議の あと 審判長（まんなか）が 前へ 出て マイクを 持つ
		if (i === 4 && c.lt >= 6500) {
			x = CX;
			y = RY + 18;
		}
		const bob = p >= 1 && !c.still ? r(Math.sin(c.now / 300 + i) * 0.8) : 0;
		person(g, r(x) - 3, r(y) - 12 + bob, JUDGE, "#8a8a8a");
		if (i === 4 && c.lt >= 6500) {
			g.fillStyle = "#9a9aa8";
			g.fillRect(r(x) + 3, r(y) - 9, 2, 3);
		}
	});
	if (p >= 1 && c.lt < 6500)
		text(g, SUMO_ART.kyogi, CX, 32, 8, "#ffffff", { outline: "#000000" });
	plates(g, c);
};

// ───────────────── 立ち合い（山場） ─────────────────

type Big = { tsuna?: boolean; near?: boolean; far?: boolean; lift?: number };

/** 大きな 力士の 仕切り（2倍。足もとは y 92。near・far は 手前・奥の こぶしを ついたか）。 */
const bigCrouch = (g: G, x0: number, face: 1 | -1, belt: string, o: Big) => {
	const x = r(x0);
	const lift = o.lift ?? 0;
	const ink = inkOf(belt, o.tsuna);
	// 手（肩から 下へ。こぶしを ついて いれば 土まで。k は 手の 色）
	const arm = (dx: number, down = false, k = SKIN) =>
		paint(g, x + face * dx, 92, face, { ...ink, k }, ARM[+down], +!down * lift);
	arm(6, o.far, SKIN_D);
	paint(g, x, 92, face, ink, BIG_LEGS);
	paint(g, x, 92, face, ink, BIG_BODY, lift);
	arm(13, o.near);
};

const drawTachiai = (g: G, c: C, st: { matta: number }) => {
	const { W, H } = c;
	bands(g, W, ["#24160f", "#2e1c16", "#3a261e", "#4a3228"], 0, 44);
	g.fillStyle = CLAY;
	g.fillRect(0, 44, W, H - 44);
	g.fillStyle = CLAY_D;
	g.fillRect(0, 44, W, 2);
	g.fillStyle = "#ffffff";
	g.fillRect(68, 90, 10, 2);
	g.fillRect(102, 90, 10, 2);
	const d = c.data;
	const beat = d.beat ?? 900;
	const exact = d.exact ?? Number.POSITIVE_INFINITY;
	const since = c.t - exact;
	const be = beltOf(d.east, d.yokozuna);
	const bw = beltOf(d.west);
	const tsuna = d.yokozuna;
	label(g, `${SUMO_ART.yokozuna}　${d.east ?? ""}`, 3, H - 10, "left");
	label(g, `${SUMO_ART.hiramaku}　${d.west ?? ""}`, W - 3, H - 10, "right");
	const matta = st.matta >= 0 && c.now - st.matta < 1400 && since < 0;
	if (since < 0) {
		// こぶしの 数（合図ごとに 1つ：東の 手前 → 西の 手前 → 東の 奥。4つめ（西の 奥）が ちょうど）
		const n = matta
			? 0
			: [3, 2, 1].filter((k) => c.t >= exact - k * beat).length;
		const lift = matta ? 6 : 0;
		bigCrouch(g, 50, 1, be, { tsuna, near: n >= 1, far: n >= 3, lift });
		bigCrouch(g, 130, -1, bw, { near: n >= 2, lift });
		const glow = pulseGlow(c);
		if (glow > 0) {
			g.fillStyle = `rgba(255, 255, 255, ${(0.18 * glow).toFixed(3)})`;
			g.fillRect(0, 0, W, H);
		}
		if (matta)
			text(g, SUMO_ART.matta, W / 2, 30, 16, "#ffffff", { outline: "#a02020" });
		return;
	}
	// ぶつかる → 名無ノ里が 押して、横綱は 画面の 外（土俵の 外）へ
	const hit = clamp01(since / 140);
	const push = Math.min(60, Math.max(0, since - 500) * 0.05);
	const out = Math.max(0, since - 1700) * 0.08;
	g.save();
	g.globalAlpha = 1 - clamp01((since - 1700) / 700);
	bigCrouch(g, 50 + hit * 14 - push - out, 1, be, { tsuna, lift: 4 });
	g.restore();
	bigCrouch(g, 130 - hit * 14 - push, -1, bw, { lift: since > 1700 ? 9 : 4 });
	// ぶつかった 光
	if (!c.still && since < 300) {
		g.fillStyle = `rgba(255, 250, 220, ${(0.7 * (1 - since / 300)).toFixed(3)})`;
		g.fillRect(0, 0, W, H);
	}
};

// ───────────────── 座布団（横綱が 負けて 舞う） ─────────────────

/** 座布団 1枚（回って 見える：平ら・ななめ・横）。 */
const cushion = (g: G, x: number, y: number, spin: number) => {
	const w = [10, 8, 4][spin % 3];
	const h = [7, 8, 8][spin % 3];
	g.fillStyle = "#7a3a8a";
	g.fillRect(r(x), r(y), w, h);
	g.fillStyle = "#b06ac0";
	g.fillRect(r(x), r(y), w, 1);
};

const drawZabuton = (g: G, c: C) => {
	const { W, H } = c;
	bands(g, W, ["#2a1a16", "#3a2622", "#4a302a", "#5a3a30"], 0, 66);
	// 客（手を あげて わく）
	for (let k = 0; k < 5; k++)
		for (let i = 0; i < 26; i++) {
			const x = i * 7 + (k % 2) * 3;
			const y = 10 + k * 11;
			g.fillStyle = (i + k) % 3 ? "#1c1210" : "#2c1c16";
			g.fillRect(x, y, 4, 4);
			const up = !c.still && hash(i, k, Math.floor(c.now / 300)) < 0.3;
			if (up) g.fillRect(x + 1, y - 3, 1, 3);
		}
	g.fillStyle = CLAY;
	g.fillRect(0, 62, W, H - 62);
	g.fillStyle = TAWARA;
	g.fillRect(0, 66, W, 2);
	const d = c.data;
	rikishi(g, 124, 86, "stand", -1, beltOf(d.west));
	rikishi(g, 48, 88, "down", 1, beltOf(d.east, d.yokozuna), d.yokozuna);
	// 落ちた 座布団（だんだん ふえる）
	const lying = c.still ? 8 : Math.min(14, Math.floor(c.lt / 450));
	for (let i = 0; i < lying; i++)
		cushion(g, hash(i, 61) * (W - 10), 70 + hash(i, 62) * 16, 0);
	if (c.still) {
		for (let i = 0; i < 12; i++)
			cushion(g, hash(i, 63) * (W - 8), 8 + hash(i, 64) * 56, i % 3);
		return;
	}
	const n = Math.min(26, 5 + Math.floor(c.lt / 160));
	for (let i = 0; i < n; i++) {
		const per = 1800 + hash(i, 65) * 900;
		const ph = ((c.lt + hash(i, 66) * per) % per) / per;
		const x = hash(i, 67) * W + (hash(i, 68) - 0.5) * 80 * ph;
		const y = 50 - Math.sin(ph * Math.PI) * 44 + ph * 34;
		cushion(g, x, y, Math.floor((c.lt + i * 97) / 140));
	}
};

// ───────────────── 弓取式・表彰式 ─────────────────

const drawYumitori = (g: G, c: C) => {
	arena(g, c);
	const x = CX;
	const y = RY + 8;
	rikishi(g, x, y, "stand", 1, "#2a2a2a");
	// 弓（手の 先を まわる 線）
	const a = c.still ? 0.8 : c.lt / 150;
	const hx = x + 9;
	const hy = y - 16;
	g.fillStyle = "#c08040";
	for (let i = -12; i <= 12; i += 2)
		g.fillRect(r(hx + Math.cos(a) * i), r(hy + Math.sin(a) * i), 2, 2);
};

const drawHyosho = (g: G, c: C) => {
	const { W, H } = c;
	g.fillStyle = "#2a1a14";
	g.fillRect(0, 0, W, H);
	// 紅白の 幕
	for (let x = 0; x < W; x += 12) {
		g.fillStyle = (x / 12) % 2 ? "#ffffff" : "#d83a3a";
		g.fillRect(x, 80, 12, H - 80);
	}
	// 優勝旗
	g.fillStyle = "#c8a040";
	g.fillRect(34, 22, 2, 66);
	g.fillStyle = "#b02a2a";
	g.fillRect(36, 24, 30, 34);
	g.fillStyle = "#e8c040";
	for (let x = 36; x < 66; x += 3) g.fillRect(x, 58, 2, 3);
	// 優勝杯（台の 上）と 力士
	g.fillStyle = "#e8c040";
	g.fillRect(CX - 8, 54, 18, 14);
	g.fillRect(CX - 4, 68, 10, 4);
	g.fillRect(CX - 6, 72, 14, 3);
	g.fillRect(CX - 11, 56, 3, 6);
	g.fillRect(CX + 10, 56, 3, 6);
	g.fillStyle = "#6a4a2a";
	g.fillRect(CX - 12, 75, 26, 12);
	rikishi(g, CX + 30, 90, "stand", -1, beltOf(c.data.west));
	const s = `${SUMO_ART.yusho}　${c.data.west ?? ""}`;
	text(g, s, W / 2, 6, 12, "#ffe7a0", { outline: "#3a1a10" });
};

// ───────────────── 番組の 題（番付の 紙） ─────────────────

const drawOp = (g: G, c: C) => {
	const { W, H } = c;
	g.fillStyle = "#efe4c8";
	g.fillRect(0, 0, W, H);
	g.fillStyle = "#dccca6";
	for (let x = 6; x < W; x += 12) g.fillRect(x, 0, 1, H);
	// 吊り屋根と 4つの 房（青・赤・白・黒）
	g.fillStyle = "#5a3820";
	g.fillRect(40, 0, W - 80, 6);
	g.fillStyle = "#7a5030";
	g.fillRect(32, 6, W - 64, 3);
	tassel(g, 34, 9, "#3a6ad8");
	tassel(g, W - 37, 9, "#d83a3a");
	tassel(g, 50, 9, "#ffffff");
	tassel(g, W - 53, 9, "#2a2a2a");
	g.globalAlpha = c.still ? 1 : clamp01(c.lt / 700);
	text(g, SUMO_ART.logo, W / 2, 22, 16, "#2a1a10");
	text(g, SUMO_ART.basho, W / 2, 44, 12, "#a82a20");
	const sub = c.data.sub ?? "";
	g.fillStyle = "#2a1a10";
	g.fillRect(W / 2 - 46, 66, 92, 14);
	text(g, sub, W / 2, 69, 8, "#efe4c8");
	g.globalAlpha = 1;
};

// ───────────────── 枠（銭湯の 脱衣所） ─────────────────

const bathFrame = (g: G, c: C) => {
	crtFrame.draw(g, c);
	for (const x0 of [0, 216]) {
		g.fillStyle = "#e2eaee";
		g.fillRect(x0, 0, 24, 124);
		g.fillStyle = "#bccad2";
		for (let y = 7; y < 124; y += 8) g.fillRect(x0, y, 24, 1);
		for (let x = x0 + 3; x < x0 + 24; x += 8) g.fillRect(x, 0, 1, 124);
	}
	// 「ゆ」の 札（左の 壁）と 台の 上の コーヒー牛乳
	g.fillStyle = "#2a4a8a";
	g.fillRect(4, 18, 16, 16);
	text(g, SUMO_ART.yu, 12, 21, 8, "#ffffff");
	g.fillStyle = "#8a5a34";
	g.fillRect(224, 115, 5, 9);
	g.fillStyle = "#f2f0e6";
	g.fillRect(224, 113, 5, 2);
};

// ───────────────── TV ─────────────────

/** 大相撲『保守場所』の TV（待ったの 時刻は 1台ごと）。 */
export const sumoTv: KitTv = Object.assign(
	(canvas: HTMLCanvasElement, opt: { reduced: boolean; live: boolean }) => {
		const st = { matta: -1 };
		return makeTv<SumoData>({
			screen: crtFrame.screen,
			frame: bathFrame,
			noCaption: ["card", "op"],
			onEv: (ev, now) => {
				if (ev.t === "open") st.matta = -1;
				if (ev.t === "grade" && ev.grade === "flying") st.matta = now;
			},
			scenes: {
				card: cardScene(SUMO_ART.basho, "#f2e6c8", "#1a120e"),
				op: drawOp,
				dohyo: drawDohyo,
				monoii: drawMonoii,
				tachiai: (g, c) => drawTachiai(g, c, st),
				zabuton: drawZabuton,
				yumitori: drawYumitori,
				hyosho: drawHyosho,
			},
		})(canvas, opt);
	},
	{ scenes: [...SUMO_SCENES] as readonly string[] },
);
