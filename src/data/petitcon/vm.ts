// BASIC の 実行（DOM なし）。parse.ts の Op[] を 1つずつ 進める。
// - run(budget) は 文を budget 回 まで 進めて 返す（むげんループでも ページが 固まらない）。
//   WAIT・VSYNC は そこで 返して、呼ぶ 側が こまを 待つ。
// - ボタン・音・乱数は Host から（試験では 決まった 値を わたす）。
// - まちがいは「10行目：0で　わった」の ように 行の 番号つきで 止まる。

import {
	BASIC_ERR,
	compile,
	type Expr,
	errText,
	isCompileError,
	type Op,
	type Target,
} from "./parse";
import { Screen } from "./screen";

export type Value = number | string;

export type Host = {
	/** 押して いる ボタン（1 上 2 下 4 左 8 右 16 A）。 */
	button: () => number;
	/** 押した 字（なければ ""）。 */
	inkey: () => string;
	beep: (n: number) => void;
	note: (midi: number, sec: number) => void;
	/** 0 以上 1 未満。 */
	rnd: () => number;
};

export type RunResult =
	| { k: "yield" }
	| { k: "wait"; frames: number }
	| { k: "end" }
	| { k: "error"; line: number; msg: string; text: string };

/** 1こまに 進める 文の 数（既定）。 */
export const STEPS_PER_FRAME = 5000;
/** 絵の 命令は 重いので 多めに 数える。 */
const GFX_COST = 8;
const MAX_STR = 1000;
const MAX_ARRAY = 20000;
const MAX_GOSUB = 200;

class RunFail extends Error {
	constructor(readonly msg: string) {
		super(msg);
	}
}

type Arr = { dims: number[]; data: Value[] };

const isStr = (name: string): boolean => name.endsWith("$");

/** 数を 字に（整数は そのまま、ほかは 8けた まで）。 */
export const numText = (n: number): string => {
	if (Number.isInteger(n)) return String(n);
	if (!Number.isFinite(n)) return n > 0 ? "INF" : n < 0 ? "-INF" : "NAN";
	return String(Number(n.toPrecision(8)));
};

const truth = (v: Value): boolean =>
	typeof v === "number" ? v !== 0 : v !== "";

export class Vm {
	readonly scr = new Screen();
	private readonly ops: Op[];
	private pc = 0;
	private vars = new Map<string, Value>();
	private arrs = new Map<string, Arr>();
	private gosubs: number[] = [];
	private fors = new Map<number, { to: number; step: number }>();
	private frames = 0;
	done = false;
	/** 止まった わけ（まちがい）。 */
	error: RunResult | null = null;

	constructor(
		ops: Op[],
		private readonly host: Host,
	) {
		this.ops = ops;
	}

	/** 1こま すすんだ（MAINCNT）。 */
	tick(): void {
		this.frames++;
	}

	private num(v: Value): number {
		if (typeof v !== "number") throw new RunFail(BASIC_ERR.type);
		return v;
	}
	private str(v: Value): string {
		if (typeof v !== "string") throw new RunFail(BASIC_ERR.type);
		return v;
	}
	private int(e: Expr): number {
		return Math.floor(this.num(this.eval(e)));
	}
	private checkLen(s: string): string {
		if (s.length > MAX_STR) throw new RunFail(BASIC_ERR.long);
		return s;
	}

	private arr(name: string, args: Expr[]): { a: Arr; i: number } {
		const a = this.arrs.get(name);
		if (!a) throw new RunFail(BASIC_ERR.noDim);
		if (args.length !== a.dims.length) throw new RunFail(BASIC_ERR.args);
		let i = 0;
		for (let d = 0; d < a.dims.length; d++) {
			const k = this.int(args[d]);
			if (k < 0 || k >= a.dims[d]) throw new RunFail(BASIC_ERR.range);
			i = i * a.dims[d] + k;
		}
		return { a, i };
	}

	private set(t: Target, v: Value): void {
		if (isStr(t.name) !== (typeof v === "string"))
			throw new RunFail(BASIC_ERR.type);
		if (t.k === "var") {
			this.vars.set(t.name, v);
			return;
		}
		const { a, i } = this.arr(t.name, t.args);
		a.data[i] = v;
	}

	eval(e: Expr): Value {
		switch (e.k) {
			case "num":
				return e.v;
			case "str":
				return e.v;
			case "var":
				return this.vars.get(e.name) ?? (isStr(e.name) ? "" : 0);
			case "idx": {
				const { a, i } = this.arr(e.name, e.args);
				return a.data[i];
			}
			case "un": {
				const v = this.num(this.eval(e.e));
				return e.op === "-" ? -v : v === 0 ? 1 : 0;
			}
			case "bin":
				return this.bin(e.op, this.eval(e.a), this.eval(e.b));
			case "call":
				return this.call(e.name, e.args);
		}
	}

	private bin(op: string, a: Value, b: Value): Value {
		if (typeof a === "string" || typeof b === "string") {
			if (typeof a !== typeof b) throw new RunFail(BASIC_ERR.type);
			const x = a as string;
			const y = b as string;
			switch (op) {
				case "+":
					return this.checkLen(x + y);
				case "=":
					return x === y ? 1 : 0;
				case "<>":
					return x !== y ? 1 : 0;
				case "<":
					return x < y ? 1 : 0;
				case ">":
					return x > y ? 1 : 0;
				case "<=":
					return x <= y ? 1 : 0;
				case ">=":
					return x >= y ? 1 : 0;
				case "*":
					// "ｗ" * 3（字を くり返す）は できない（数と 文字）
					throw new RunFail(BASIC_ERR.type);
				default:
					throw new RunFail(BASIC_ERR.type);
			}
		}
		switch (op) {
			case "+":
				return a + b;
			case "-":
				return a - b;
			case "*":
				return a * b;
			case "/":
				if (b === 0) throw new RunFail(BASIC_ERR.div0);
				return a / b;
			case "MOD": {
				const y = Math.trunc(b);
				if (y === 0) throw new RunFail(BASIC_ERR.div0);
				return Math.trunc(a) % y;
			}
			case "=":
				return a === b ? 1 : 0;
			case "<>":
				return a !== b ? 1 : 0;
			case "<":
				return a < b ? 1 : 0;
			case ">":
				return a > b ? 1 : 0;
			case "<=":
				return a <= b ? 1 : 0;
			case ">=":
				return a >= b ? 1 : 0;
			// ビットごと（BUTTON() AND 16 で ボタンを 見る。1 と 0 なら ふつうの「かつ」「または」）
			case "AND":
				return Math.trunc(a) & Math.trunc(b);
			case "OR":
				return Math.trunc(a) | Math.trunc(b);
		}
		throw new RunFail(BASIC_ERR.syntax);
	}

	private call(name: string, args: Expr[]): Value {
		const v = args.map((a) => this.eval(a));
		const n = (i: number) => this.num(v[i]);
		const s = (i: number) => this.str(v[i]);
		switch (name) {
			case "RND": {
				const m = Math.floor(n(0));
				return m <= 0 ? 0 : Math.floor(this.host.rnd() * m);
			}
			case "INT":
			case "FLOOR":
				return Math.floor(n(0));
			case "ABS":
				return Math.abs(n(0));
			case "SGN":
				return Math.sign(n(0));
			case "SIN":
				return Math.sin(n(0));
			case "COS":
				return Math.cos(n(0));
			case "ATAN":
				return v.length > 1 ? Math.atan2(n(0), n(1)) : Math.atan(n(0));
			case "SQR":
				if (n(0) < 0) throw new RunFail(BASIC_ERR.value);
				return Math.sqrt(n(0));
			case "MAX":
				return Math.max(...v.map((_, i) => n(i)));
			case "MIN":
				return Math.min(...v.map((_, i) => n(i)));
			case "PI":
				return Math.PI;
			case "LEN":
				return [...s(0)].length;
			case "MID$": {
				const cs = [...s(0)];
				const st = Math.max(0, Math.floor(n(1)));
				const ln = v.length > 2 ? Math.max(0, Math.floor(n(2))) : cs.length;
				return cs.slice(st, st + ln).join("");
			}
			case "LEFT$":
				return [...s(0)].slice(0, Math.max(0, Math.floor(n(1)))).join("");
			case "RIGHT$": {
				const cs = [...s(0)];
				const k = Math.max(0, Math.floor(n(1)));
				return k === 0 ? "" : cs.slice(-k).join("");
			}
			case "STR$":
				return numText(n(0));
			case "VAL": {
				const x = Number(s(0).trim());
				return Number.isFinite(x) ? x : 0;
			}
			case "CHR$": {
				const c = Math.floor(n(0));
				if (c < 0 || c > 0xffff) throw new RunFail(BASIC_ERR.value);
				return String.fromCharCode(c);
			}
			case "ASC": {
				const t = s(0);
				return t === "" ? 0 : (t.codePointAt(0) ?? 0);
			}
			case "BUTTON":
				return this.host.button();
			case "INKEY$":
				return this.host.inkey();
			case "MAINCNT":
				return this.frames;
		}
		throw new RunFail(BASIC_ERR.unknownFn);
	}

	/** 色の 番号（0〜15。ほかは 15）。 */
	private color(e: Expr | undefined, def: number): number {
		if (!e) return def;
		const c = this.int(e);
		return c >= 0 && c < 16 ? c : 15;
	}

	/** 絵・音の 命令。WAIT なら こまの 数を 返す。 */
	private cmd(name: string, a: Expr[]): number {
		const scr = this.scr;
		const ink = scr.ink;
		switch (name) {
			case "CLS":
				scr.cls();
				return 0;
			case "GCLS":
				scr.gcls(this.color(a[0], 0));
				return 0;
			case "COLOR":
				scr.color(this.color(a[0], 15), a[1] ? this.color(a[1], 0) : undefined);
				return 0;
			case "LOCATE":
				scr.locate(this.int(a[0]), this.int(a[1]));
				return 0;
			case "PSET":
				scr.pset(this.int(a[0]), this.int(a[1]), this.color(a[2], ink));
				return 0;
			case "LINE":
				scr.line(
					this.int(a[0]),
					this.int(a[1]),
					this.int(a[2]),
					this.int(a[3]),
					this.color(a[4], ink),
				);
				return 0;
			case "BOX":
				scr.box(
					this.int(a[0]),
					this.int(a[1]),
					this.int(a[2]),
					this.int(a[3]),
					this.color(a[4], ink),
					a[5] ? truth(this.eval(a[5])) : false,
				);
				return 0;
			case "CIRCLE":
				scr.circle(
					this.int(a[0]),
					this.int(a[1]),
					this.int(a[2]),
					this.color(a[3], ink),
					a[4] ? truth(this.eval(a[4])) : false,
				);
				return 0;
			case "PUYU":
				scr.puyu(this.int(a[0]), this.int(a[1]));
				return 0;
			case "WAIT":
			case "VSYNC":
				return Math.max(1, Math.min(600, a[0] ? this.int(a[0]) : 1));
			case "BEEP":
				this.host.beep(a[0] ? this.int(a[0]) : 0);
				return 0;
			case "NOTE": {
				const m = this.int(a[0]);
				if (m < 0 || m > 127) throw new RunFail(BASIC_ERR.value);
				const len = a[1] ? this.num(this.eval(a[1])) : 30;
				this.host.note(m, Math.max(0.05, Math.min(4, len / 60)));
				return 0;
			}
			case "RANDOMIZE":
				return 0;
		}
		throw new RunFail(BASIC_ERR.unknown);
	}

	private print(items: { e: Expr | null; sep: string }[]): void {
		let nl = true;
		for (const it of items) {
			if (it.e) {
				const v = this.eval(it.e);
				this.scr.put(typeof v === "number" ? numText(v) : v);
			}
			if (it.sep === ",") this.scr.tab();
			nl = it.sep === "";
		}
		if (nl) this.scr.newline();
	}

	/** 文を budget 回まで 進める。 */
	run(budget = STEPS_PER_FRAME): RunResult {
		if (this.error) return this.error;
		if (this.done) return { k: "end" };
		let left = budget;
		const ops = this.ops;
		while (left > 0) {
			if (this.pc >= ops.length) {
				this.done = true;
				return { k: "end" };
			}
			const op = ops[this.pc];
			this.pc++;
			left--;
			try {
				switch (op.k) {
					case "nop":
						break;
					case "print":
						this.print(op.items);
						break;
					case "let":
						this.set(op.to, this.eval(op.e));
						break;
					case "dim": {
						const dims = op.dims.map((d) => this.int(d) + 1);
						const size = dims.reduce((x, y) => x * y, 1);
						if (dims.some((d) => d < 1) || size > MAX_ARRAY)
							throw new RunFail(BASIC_ERR.bigDim);
						this.arrs.set(op.name, {
							dims,
							data: new Array(size).fill(isStr(op.name) ? "" : 0),
						});
						break;
					}
					case "jz":
						if (!truth(this.eval(op.cond))) this.pc = op.to;
						break;
					case "jmp":
					case "goto":
						this.pc = op.to;
						break;
					case "gosub":
						if (this.gosubs.length >= MAX_GOSUB)
							throw new RunFail(BASIC_ERR.deep);
						this.gosubs.push(this.pc);
						this.pc = op.to;
						break;
					case "return": {
						const r = this.gosubs.pop();
						if (r === undefined) throw new RunFail(BASIC_ERR.noGosub);
						this.pc = r;
						break;
					}
					case "for": {
						const from = this.num(this.eval(op.from));
						const to = this.num(this.eval(op.to));
						const step = op.step ? this.num(this.eval(op.step)) : 1;
						this.vars.set(op.v, from);
						this.fors.set(this.pc - 1, { to, step });
						if (step >= 0 ? from > to : from < to) this.pc = op.next + 1;
						break;
					}
					case "next": {
						const f = this.fors.get(op.for);
						const fo = ops[op.for];
						if (!f || fo.k !== "for") throw new RunFail(BASIC_ERR.noFor);
						const v = this.num(this.vars.get(fo.v) ?? 0) + f.step;
						this.vars.set(fo.v, v);
						if (f.step >= 0 ? v <= f.to : v >= f.to) this.pc = op.for + 1;
						break;
					}
					case "while":
						if (!truth(this.eval(op.cond))) this.pc = op.wend + 1;
						break;
					case "wend":
						this.pc = op.while;
						break;
					case "end":
						this.done = true;
						return { k: "end" };
					case "cmd": {
						left -= GFX_COST;
						const w = this.cmd(op.name, op.args);
						if (w > 0) return { k: "wait", frames: w };
						break;
					}
				}
			} catch (e) {
				if (!(e instanceof RunFail)) throw e;
				const err = { line: op.line, msg: e.msg };
				this.error = { k: "error", ...err, text: errText(err) };
				return this.error;
			}
		}
		return { k: "yield" };
	}
}

/** 字から Vm を 作る（書きまちがいは error の 結果）。 */
export const load = (
	src: string,
	host: Host,
): { vm: Vm } | { k: "error"; line: number; msg: string; text: string } => {
	const p = compile(src);
	if (isCompileError(p)) return { k: "error", ...p, text: errText(p) };
	return { vm: new Vm(p.ops, host) };
};
