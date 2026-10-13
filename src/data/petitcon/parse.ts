// キリコの 家の パソコンの BASIC（プチコン ふう。ui/petitcon/petitcon.ts）の 字句・構文。
// - 行番号は あっても なくても よい（「10 PRINT 1」と「@LOOP」の どちらにも とべる）。
// - 1行に「:」で 文を 並べる。IF … THEN … ELSE … は 1行の 中だけ。
// - 文は 平らな 列（Op[]）に する。IF は jz／jmp に ほどき、FOR と NEXT・WHILE と WEND は ここで 組に する
//   （実行は vm.ts。eval・Function は 使わない）。
// - 見せる 行（line）は 行番号が あれば それ、なければ 何行目か。

export type Expr =
	| { k: "num"; v: number }
	| { k: "str"; v: string }
	| { k: "var"; name: string }
	| { k: "idx"; name: string; args: Expr[] }
	| { k: "call"; name: string; args: Expr[] }
	| { k: "un"; op: "-" | "NOT"; e: Expr }
	| { k: "bin"; op: string; a: Expr; b: Expr };

export type Target =
	| { k: "var"; name: string }
	| { k: "idx"; name: string; args: Expr[] };

export type PrintItem = { e: Expr | null; sep: ";" | "," | "" };

export type Op = { line: number } & (
	| { k: "print"; items: PrintItem[] }
	| { k: "let"; to: Target; e: Expr }
	| { k: "dim"; name: string; dims: Expr[] }
	| { k: "jz"; cond: Expr; to: number }
	| { k: "jmp"; to: number }
	| { k: "goto"; to: number }
	| { k: "gosub"; to: number }
	| { k: "return" }
	| {
			k: "for";
			v: string;
			from: Expr;
			to: Expr;
			step: Expr | null;
			next: number;
	  }
	| { k: "next"; for: number }
	| { k: "while"; cond: Expr; wend: number }
	| { k: "wend"; while: number }
	| { k: "end" }
	| { k: "cmd"; name: string; args: Expr[] }
	| { k: "nop" }
);

export type Program = { ops: Op[] };

export type CompileError = { line: number; msg: string };

/** 見せる ことば（行の 番号を 前に つける）。 */
export const BASIC_ERR = {
	syntax: "書きかたが　ちがう",
	unknown: "わからない　命令",
	noTarget: "とび先が　ない",
	noNext: "NEXTが　ない　FOR",
	noFor: "FORが　ない　NEXT",
	noWend: "WENDが　ない　WHILE",
	noWhile: "WHILEが　ない　WEND",
	nextVar: "NEXTの　変数が　ちがう",
	dupLabel: "同じ　ラベルが　2つ",
	paren: "かっこが　とじて　いない",
	string: '「"」が　とじて　いない',
	args: "引数の　数が　ちがう",
	unknownFn: "わからない　関数",
	div0: "0で　わった",
	type: "数と　文字が　まざった",
	noDim: "DIMして　いない　配列",
	range: "配列の　はんいの　外",
	bigDim: "配列が　大きすぎる",
	noGosub: "GOSUBが　ない　RETURN",
	deep: "GOSUBが　深すぎる",
	long: "文字が　長すぎる",
	value: "数が　おかしい",
} as const;

/** 行の 番号つきの ことば（「10行目：0で　わった」）。 */
export const errText = (e: CompileError): string => `${e.line}行目：${e.msg}`;

// ───────── 字句 ─────────

type Tok =
	| { t: "num"; v: number }
	| { t: "str"; v: string }
	| { t: "id"; v: string }
	| { t: "label"; v: string }
	| { t: "op"; v: string };

class Fail extends Error {
	constructor(readonly msg: string) {
		super(msg);
	}
}

const OPS2 = ["<=", ">=", "<>", "==", "!="];
const OPS1 = "+-*/()=<>,;:";

const lexLine = (src: string): Tok[] => {
	const out: Tok[] = [];
	let i = 0;
	while (i < src.length) {
		const c = src[i];
		if (c === " " || c === "\t" || c === "　") {
			i++;
			continue;
		}
		if (c === "'") break;
		if (c === '"') {
			const j = src.indexOf('"', i + 1);
			if (j < 0) throw new Fail(BASIC_ERR.string);
			out.push({ t: "str", v: src.slice(i + 1, j) });
			i = j + 1;
			continue;
		}
		if (/[0-9.]/.test(c)) {
			const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
			if (!m) throw new Fail(BASIC_ERR.syntax);
			out.push({ t: "num", v: Number(m[1]) });
			i += m[1].length;
			continue;
		}
		if (c === "&" && /[hH]/.test(src[i + 1] ?? "")) {
			const m = /^&[hH]([0-9a-fA-F]+)/.exec(src.slice(i));
			if (!m) throw new Fail(BASIC_ERR.syntax);
			out.push({ t: "num", v: Number.parseInt(m[1], 16) });
			i += m[0].length;
			continue;
		}
		if (c === "@") {
			const m = /^@[A-Za-z0-9_]+/.exec(src.slice(i));
			if (!m) throw new Fail(BASIC_ERR.syntax);
			out.push({ t: "label", v: m[0].toUpperCase() });
			i += m[0].length;
			continue;
		}
		if (/[A-Za-z_]/.test(c)) {
			const m = /^[A-Za-z_][A-Za-z0-9_]*\$?/.exec(src.slice(i));
			if (!m) throw new Fail(BASIC_ERR.syntax);
			const w = m[0].toUpperCase();
			i += m[0].length;
			if (w === "REM") break;
			out.push({ t: "id", v: w });
			continue;
		}
		if (c === "?") {
			out.push({ t: "id", v: "PRINT" });
			i++;
			continue;
		}
		const two = src.slice(i, i + 2);
		if (OPS2.includes(two)) {
			out.push({ t: "op", v: two === "==" ? "=" : two === "!=" ? "<>" : two });
			i += 2;
			continue;
		}
		if (OPS1.includes(c)) {
			out.push({ t: "op", v: c });
			i++;
			continue;
		}
		if (c === "%") {
			out.push({ t: "id", v: "MOD" });
			i++;
			continue;
		}
		throw new Fail(BASIC_ERR.syntax);
	}
	return out;
};

// ───────── 名前 ─────────

/** 変数に できない ことば。 */
const KEYWORDS = new Set([
	"PRINT",
	"LET",
	"DIM",
	"IF",
	"THEN",
	"ELSE",
	"FOR",
	"TO",
	"STEP",
	"NEXT",
	"WHILE",
	"WEND",
	"GOTO",
	"GOSUB",
	"RETURN",
	"END",
	"STOP",
	"AND",
	"OR",
	"NOT",
	"MOD",
]);

/** 絵・音の 命令（引数の 数 [最小, 最大]）。 */
export const COMMANDS: Record<string, readonly [number, number]> = {
	CLS: [0, 0],
	GCLS: [0, 1],
	COLOR: [1, 2],
	LOCATE: [2, 2],
	PSET: [2, 3],
	LINE: [4, 5],
	BOX: [4, 6],
	CIRCLE: [3, 5],
	PUYU: [2, 2],
	WAIT: [0, 1],
	VSYNC: [0, 1],
	BEEP: [0, 1],
	NOTE: [1, 2],
	RANDOMIZE: [0, 1],
};

/** 関数（引数の 数 [最小, 最大]）。かっこ なしで 書ける ものは 最小が 0。 */
export const FUNCS: Record<string, readonly [number, number]> = {
	RND: [1, 1],
	INT: [1, 1],
	FLOOR: [1, 1],
	ABS: [1, 1],
	SGN: [1, 1],
	SIN: [1, 1],
	COS: [1, 1],
	ATAN: [1, 2],
	SQR: [1, 1],
	MAX: [1, 8],
	MIN: [1, 8],
	PI: [0, 0],
	LEN: [1, 1],
	MID$: [2, 3],
	LEFT$: [2, 2],
	RIGHT$: [2, 2],
	STR$: [1, 1],
	VAL: [1, 1],
	CHR$: [1, 1],
	ASC: [1, 1],
	BUTTON: [0, 1],
	INKEY$: [0, 0],
	MAINCNT: [0, 0],
};

// ───────── 構文 ─────────

class P {
	i = 0;
	constructor(readonly toks: Tok[]) {}
	peek(): Tok | undefined {
		return this.toks[this.i];
	}
	isOp(v: string): boolean {
		const t = this.peek();
		return t?.t === "op" && t.v === v;
	}
	isId(v: string): boolean {
		const t = this.peek();
		return t?.t === "id" && t.v === v;
	}
	eat(v: string): boolean {
		const t = this.peek();
		if (t && (t.t === "op" || t.t === "id") && t.v === v) {
			this.i++;
			return true;
		}
		return false;
	}
	need(v: string): void {
		if (!this.eat(v))
			throw new Fail(v === ")" ? BASIC_ERR.paren : BASIC_ERR.syntax);
	}
	done(): boolean {
		return this.i >= this.toks.length;
	}
	/** 文の おわり（行末・「:」・ELSE）。 */
	atStmtEnd(): boolean {
		return this.done() || this.isOp(":") || this.isId("ELSE");
	}

	expr(): Expr {
		return this.or();
	}
	private bin(next: () => Expr, ops: readonly string[]): Expr {
		let a = next();
		for (;;) {
			const t = this.peek();
			if (!t || (t.t !== "op" && t.t !== "id") || !ops.includes(t.v)) return a;
			this.i++;
			a = { k: "bin", op: t.v, a, b: next() };
		}
	}
	private or = (): Expr => this.bin(this.and, ["OR"]);
	private and = (): Expr => this.bin(this.not, ["AND"]);
	private not = (): Expr => {
		if (this.eat("NOT")) return { k: "un", op: "NOT", e: this.not() };
		return this.cmp();
	};
	private cmp = (): Expr =>
		this.bin(this.add, ["=", "<>", "<", ">", "<=", ">="]);
	private add = (): Expr => this.bin(this.mul, ["+", "-"]);
	private mul = (): Expr => this.bin(this.unary, ["*", "/", "MOD"]);
	private unary = (): Expr => {
		if (this.eat("-")) return { k: "un", op: "-", e: this.unary() };
		if (this.eat("+")) return this.unary();
		return this.primary();
	};
	private args(): Expr[] {
		const out: Expr[] = [];
		if (this.eat(")")) return out;
		for (;;) {
			out.push(this.expr());
			if (this.eat(")")) return out;
			if (!this.eat(",")) throw new Fail(BASIC_ERR.paren);
		}
	}
	private primary(): Expr {
		const t = this.peek();
		if (!t) throw new Fail(BASIC_ERR.syntax);
		this.i++;
		if (t.t === "num") return { k: "num", v: t.v };
		if (t.t === "str") return { k: "str", v: t.v };
		if (t.t === "op" && t.v === "(") {
			const e = this.expr();
			this.need(")");
			return e;
		}
		if (t.t === "id") {
			if (KEYWORDS.has(t.v) || COMMANDS[t.v]) throw new Fail(BASIC_ERR.syntax);
			const fn = FUNCS[t.v];
			if (fn) {
				const args = this.eat("(") ? this.args() : [];
				if (args.length < fn[0] || args.length > fn[1])
					throw new Fail(BASIC_ERR.args);
				return { k: "call", name: t.v, args };
			}
			if (this.eat("(")) return { k: "idx", name: t.v, args: this.args() };
			return { k: "var", name: t.v };
		}
		throw new Fail(BASIC_ERR.syntax);
	}
	target(): Target {
		const t = this.peek();
		if (t?.t !== "id" || KEYWORDS.has(t.v) || FUNCS[t.v] || COMMANDS[t.v])
			throw new Fail(BASIC_ERR.syntax);
		this.i++;
		if (this.eat("(")) return { k: "idx", name: t.v, args: this.args() };
		return { k: "var", name: t.v };
	}
}

/** とび先（行番号か ラベル）。あとで 番地に する。 */
type Jump = { op: Op & { to: number }; key: string; line: number };

/**
 * 字を 読んで Program に する（まちがいは CompileError）。
 */
export const compile = (src: string): Program | CompileError => {
	const ops: Op[] = [];
	const lineAt = new Map<string, number>();
	const jumps: Jump[] = [];
	const forStack: { at: number; v: string; line: number }[] = [];
	const whileStack: { at: number; line: number }[] = [];
	const lines = src.replace(/\r\n?/g, "\n").split("\n");
	let line = 0;
	try {
		for (let n = 0; n < lines.length; n++) {
			const num = /^\s*(\d+)/.exec(lines[n]);
			line = num ? Number(num[1]) : n + 1;
			const toks = lexLine(lines[n]);
			const p = new P(toks);
			const head = p.peek();
			if (head?.t === "num" && Number.isInteger(head.v)) {
				line = head.v;
				p.i++;
				const key = String(head.v);
				if (!lineAt.has(key)) lineAt.set(key, ops.length);
			}
			const lab = p.peek();
			if (lab?.t === "label") {
				p.i++;
				if (lineAt.has(lab.v)) throw new Fail(BASIC_ERR.dupLabel);
				lineAt.set(lab.v, ops.length);
				p.eat(":");
			}
			const emit = <O extends Op>(o: O): O => {
				ops.push(o);
				return o;
			};
			const jumpTo = (k: "goto" | "gosub" | "jmp"): void => {
				const t = p.peek();
				let key: string;
				if (t?.t === "num") key = String(t.v);
				else if (t?.t === "label") key = t.v;
				else throw new Fail(BASIC_ERR.syntax);
				p.i++;
				const op = emit({ k, to: -1, line });
				jumps.push({ op, key, line });
			};
			const stmts = (): void => {
				for (;;) {
					if (!p.atStmtEnd()) stmt();
					if (!p.eat(":")) return;
				}
			};
			const stmt = (): void => {
				const t = p.peek();
				if (!t) return;
				if (t.t === "label") {
					// 「GOTO」を はぶいた とび（THEN @X の あと など）
					jumpTo("goto");
					return;
				}
				if (t.t !== "id") throw new Fail(BASIC_ERR.syntax);
				const w = t.v;
				if (COMMANDS[w]) {
					p.i++;
					const args: Expr[] = [];
					if (!p.atStmtEnd()) {
						args.push(p.expr());
						while (p.eat(",")) args.push(p.expr());
					}
					const [lo, hi] = COMMANDS[w];
					if (args.length < lo || args.length > hi)
						throw new Fail(BASIC_ERR.args);
					emit({ k: "cmd", name: w, args, line });
					return;
				}
				switch (w) {
					case "PRINT": {
						p.i++;
						const items: PrintItem[] = [];
						while (!p.atStmtEnd()) {
							const e = p.isOp(";") || p.isOp(",") ? null : p.expr();
							const sep = p.eat(";") ? ";" : p.eat(",") ? "," : "";
							items.push({ e, sep });
							if (sep === "") break;
						}
						if (!p.atStmtEnd()) throw new Fail(BASIC_ERR.syntax);
						emit({ k: "print", items, line });
						return;
					}
					case "DIM": {
						p.i++;
						do {
							const n = p.peek();
							if (n?.t !== "id" || KEYWORDS.has(n.v))
								throw new Fail(BASIC_ERR.syntax);
							p.i++;
							p.need("(");
							const dims: Expr[] = [p.expr()];
							while (p.eat(",")) dims.push(p.expr());
							p.need(")");
							if (dims.length > 2) throw new Fail(BASIC_ERR.args);
							emit({ k: "dim", name: n.v, dims, line });
						} while (p.eat(","));
						return;
					}
					case "IF": {
						p.i++;
						const cond = p.expr();
						const jz = emit({ k: "jz", cond, to: -1, line });
						if (p.eat("GOTO") || p.eat("THEN")) {
							const n = p.peek();
							if (n?.t === "num" || n?.t === "label") jumpTo("goto");
							else stmts();
						} else throw new Fail(BASIC_ERR.syntax);
						if (p.eat("ELSE")) {
							const j = emit({ k: "jmp", to: -1, line });
							jz.to = ops.length;
							const n = p.peek();
							if (n?.t === "num" || n?.t === "label") jumpTo("goto");
							else stmts();
							j.to = ops.length;
						} else jz.to = ops.length;
						return;
					}
					case "FOR": {
						p.i++;
						const v = p.peek();
						if (v?.t !== "id" || KEYWORDS.has(v.v) || v.v.endsWith("$"))
							throw new Fail(BASIC_ERR.syntax);
						p.i++;
						p.need("=");
						const from = p.expr();
						p.need("TO");
						const to = p.expr();
						const step = p.eat("STEP") ? p.expr() : null;
						forStack.push({ at: ops.length, v: v.v, line });
						emit({ k: "for", v: v.v, from, to, step, next: -1, line });
						return;
					}
					case "NEXT": {
						p.i++;
						const f = forStack.pop();
						if (!f) throw new Fail(BASIC_ERR.noFor);
						const v = p.peek();
						if (v?.t === "id" && !KEYWORDS.has(v.v)) {
							p.i++;
							if (v.v !== f.v) throw new Fail(BASIC_ERR.nextVar);
						}
						const fo = ops[f.at];
						if (fo.k === "for") fo.next = ops.length;
						emit({ k: "next", for: f.at, line });
						return;
					}
					case "WHILE": {
						p.i++;
						whileStack.push({ at: ops.length, line });
						emit({ k: "while", cond: p.expr(), wend: -1, line });
						return;
					}
					case "WEND": {
						p.i++;
						const wh = whileStack.pop();
						if (!wh) throw new Fail(BASIC_ERR.noWhile);
						const wo = ops[wh.at];
						if (wo.k === "while") wo.wend = ops.length;
						emit({ k: "wend", while: wh.at, line });
						return;
					}
					case "GOTO":
					case "GOSUB":
						p.i++;
						jumpTo(w === "GOTO" ? "goto" : "gosub");
						return;
					case "RETURN":
						p.i++;
						emit({ k: "return", line });
						return;
					case "END":
					case "STOP":
						p.i++;
						emit({ k: "end", line });
						return;
					case "LET":
						p.i++;
						break;
				}
				const n = p.peek();
				if (n?.t !== "id" || KEYWORDS.has(n.v) || FUNCS[n.v])
					throw new Fail(BASIC_ERR.unknown);
				const to = p.target();
				if (!p.eat("=")) throw new Fail(BASIC_ERR.unknown);
				emit({ k: "let", to, e: p.expr(), line });
			};
			stmts();
			if (!p.done()) throw new Fail(BASIC_ERR.syntax);
		}
		const f = forStack.pop();
		if (f) return { line: f.line, msg: BASIC_ERR.noNext };
		const wh = whileStack.pop();
		if (wh) return { line: wh.line, msg: BASIC_ERR.noWend };
		for (const j of jumps) {
			const at = lineAt.get(j.key);
			if (at === undefined) return { line: j.line, msg: BASIC_ERR.noTarget };
			j.op.to = at;
		}
		return { ops };
	} catch (e) {
		if (e instanceof Fail) return { line, msg: e.msg };
		throw e;
	}
};

export const isCompileError = (p: Program | CompileError): p is CompileError =>
	"msg" in p;
