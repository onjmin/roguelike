// リプレイ：1回の冒険を「シード＋入れたコマンドの列」で残し、あとで同じ順に入れなおして見返す。
//
// - ゲームの中身（core）は乱数も含めて決まった動きしかしないので、同じシードから同じコマンドを
//   同じ順に入れれば、同じ冒険になる（中断セーブをはさんでも同じ）。
// - コマンドは短い文字（"m2" など）にして、カンマでつないで RunState.replay に足していく
//   （中断セーブにそのまま入るので、中断をはさんでも続けて記録できる）。
// - CHECK_EVERY コマンドごとに、その時点の状態の指紋（"#…"）をはさむ。ゲームの中身が
//   あとの版で変わったとき、見返している途中で「ずれた」とわかるように。

import type { Dir8 } from "./geom";
import type { Command, RunState } from "./types";

/** この数のコマンドごとに、状態の指紋をはさむ。 */
export const CHECK_EVERY = 64;

/** 数字だけの文字 → 数（それ以外は NaN。Number("") が 0 になるのを防ぐ）。 */
const int = (s: string): number => (/^\d+$/.test(s) ? Number(s) : Number.NaN);

/** 省けるもの（向きなど）：空なら undefined。 */
const num = (s: string): number | undefined => (s === "" ? undefined : int(s));

/** コマンド → 短い文字。 */
export const encodeCmd = (c: Command): string => {
	switch (c.c) {
		case "move":
			return `m${c.dir}${c.noPickup ? "!" : ""}`;
		case "attack":
			return `a${c.dir ?? ""}`;
		case "turn":
			return `t${c.dir}`;
		case "wait":
			return "w";
		case "pickup":
			return "p";
		case "use":
			return `u${c.item}${c.target !== undefined ? `.${c.target}` : ""}`;
		case "throw":
			return `T${c.item}${c.dir !== undefined ? `.${c.dir}` : ""}`;
		case "drop":
			return `d${c.item}`;
		case "equip":
			return `e${c.item}`;
		case "unequip":
			return `x${c.item}`;
		case "swap":
			return `s${c.item}`;
		case "stairs":
			return "S";
		case "sort":
			return "o";
		case "shoot":
			return "f";
		case "name":
			return `n${encodeURIComponent(c.kind)}.${encodeURIComponent(c.text)}`;
	}
};

/** 短い文字 → コマンド（読めなければ null。数が読めないもの＝壊れた記録も null）。 */
export const decodeCmd = (t: string): Command | null => {
	const c = decodeRaw(t);
	if (!c) return null;
	const nums = Object.values(c).filter((v) => typeof v === "number");
	return nums.every((v) => Number.isFinite(v)) ? c : null;
};

const decodeRaw = (t: string): Command | null => {
	const head = t[0];
	const rest = t.slice(1);
	const [a = "", b = ""] = rest.split(".");
	const dir = (v: string) => num(v) as Dir8 | undefined;
	switch (head) {
		case "m":
			return {
				c: "move",
				dir: int(rest.replace(/!$/, "")) as Dir8,
				...(rest.endsWith("!") ? { noPickup: true } : {}),
			};
		case "a":
			return rest === "" ? { c: "attack" } : { c: "attack", dir: dir(rest) };
		case "t":
			return { c: "turn", dir: int(rest) as Dir8 };
		case "w":
			return { c: "wait" };
		case "p":
			return { c: "pickup" };
		case "u":
			return b === ""
				? { c: "use", item: int(a) }
				: { c: "use", item: int(a), target: int(b) };
		case "T":
			return b === ""
				? { c: "throw", item: int(a) }
				: { c: "throw", item: int(a), dir: dir(b) };
		case "d":
			return { c: "drop", item: int(rest) };
		case "e":
			return { c: "equip", item: int(rest) };
		case "x":
			return { c: "unequip", item: int(rest) };
		case "s":
			return { c: "swap", item: int(rest) };
		case "S":
			return { c: "stairs" };
		case "o":
			return rest === "" ? { c: "sort" } : null;
		case "f":
			return rest === "" ? { c: "shoot" } : null;
		case "n": {
			// 名前には「.」が入りうる（encodeURIComponent は「.」を変えない）。種類の id には入らないので、最初の「.」で分ける
			const i = rest.indexOf(".");
			if (i < 0) return null;
			try {
				return {
					c: "name",
					kind: decodeURIComponent(rest.slice(0, i)),
					text: decodeURIComponent(rest.slice(i + 1)),
				};
			} catch {
				return null; // 壊れた記録（% の並びが読めない）は そこまで
			}
		}
		default:
			return null;
	}
};

/** 状態の指紋（ずれたかどうかを見るだけの短い文字）。 */
export const digest = (s: RunState): string => {
	const p = s.player;
	const text = [
		s.turn,
		s.depth,
		s.time,
		p.hp,
		p.x,
		p.y,
		p.lv,
		p.hunger,
		p.items.length,
		s.floor.monsters.length,
		...s.rng,
	].join(",");
	// FNV-1a（32bit）
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h.toString(36);
};

/** 1コマンドを記録に足す（CHECK_EVERY ごとに指紋も）。記録していない冒険（古い中断セーブ）は何もしない。 */
export const recordCmd = (s: RunState, c: Command): void => {
	if (typeof s.replay !== "string") return;
	const n = (s.replayN ?? 0) + 1;
	let add = encodeCmd(c);
	if (n % CHECK_EVERY === 0) add += `,#${digest(s)}`;
	s.replay = s.replay ? `${s.replay},${add}` : add;
	s.replayN = n;
};

/** 記録の1こま：コマンドか、指紋の確かめ。 */
export type ReplayStep =
	| { kind: "cmd"; cmd: Command }
	| { kind: "check"; digest: string };

/** 記録を こまに分ける（読めない こまがあれば、そこまで）。 */
export const parseReplay = (text: string): ReplayStep[] => {
	const out: ReplayStep[] = [];
	if (!text) return out;
	for (const t of text.split(",")) {
		if (t.startsWith("#")) {
			out.push({ kind: "check", digest: t.slice(1) });
			continue;
		}
		const cmd = decodeCmd(t);
		if (!cmd) break;
		out.push({ kind: "cmd", cmd });
	}
	return out;
};

/** 記録にあるコマンドの数（指紋は数えない）。 */
export const replayLength = (steps: ReplayStep[]): number =>
	steps.filter((x) => x.kind === "cmd").length;
