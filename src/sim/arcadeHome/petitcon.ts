// パソコンの BASIC（data/petitcon/*.ts）の 試験。

import { compile, isCompileError } from "../../data/petitcon/parse";
import { BASIC_SAMPLES } from "../../data/petitcon/samples";
import {
	type Host,
	load,
	type RunResult,
	type Vm,
} from "../../data/petitcon/vm";
import { type HomeGameTest, ok, seeded } from "./kit";

const host = (button = 0): Host & { beeps: number[]; notes: number[] } => {
	const rnd = seeded(7);
	const beeps: number[] = [];
	const notes: number[] = [];
	return {
		button: () => button,
		inkey: () => "",
		beep: (n) => beeps.push(n),
		note: (m) => notes.push(m),
		rnd,
		beeps,
		notes,
	};
};

const vmOf = (src: string, h: Host = host()): Vm => {
	const r = load(src, h);
	if (!("vm" in r)) throw new Error(`compile: ${r.text}`);
	return r.vm;
};

/** おわるまで 回す（WAIT は とばす）。 */
const runAll = (vm: Vm, frames = 200): RunResult => {
	let r: RunResult = { k: "yield" };
	for (let i = 0; i < frames; i++) {
		r = vm.run();
		if (r.k === "end" || r.k === "error") return r;
		vm.tick();
	}
	return r;
};

/** PRINT した 字（行に 分ける）。 */
const out = (src: string): string[] => {
	const vm = vmOf(src);
	const r = runAll(vm);
	ok(r.k === "end", `ends: ${JSON.stringify(r)}`);
	return vm.scr.log.split("\n");
};

const errOf = (src: string): string => {
	const r = load(src, host());
	if (!("vm" in r)) return r.text;
	const e = runAll(r.vm);
	return e.k === "error" ? e.text : `(no error: ${e.k})`;
};

export const tests: HomeGameTest[] = [
	{
		name: "BASIC：PRINT の「;」「,」と 式",
		run: () => {
			const o = out(
				[
					'PRINT "A";1+2*3;"B"',
					"PRINT 7/2, 10 MOD 3",
					'? "X"+"Y";',
					'PRINT "Z"',
					"PRINT (1+2)*-3, 2>1 AND 3>2, NOT 0",
				].join("\n"),
			);
			ok(o[0] === "A7B", `p0 ${o[0]}`);
			ok(o[1] === "3.5   1", `p1 '${o[1]}'`);
			ok(o[2] === "XYZ", `p2 ${o[2]}`);
			ok(o[3] === "-9    1     1", `p3 '${o[3]}'`);
		},
	},
	{
		name: "BASIC：FOR／NEXT（STEP・0回）と WHILE",
		run: () => {
			const o = out(
				[
					"FOR I=1 TO 3:PRINT I;:NEXT",
					"PRINT",
					"FOR I=10 TO 0 STEP -5",
					" PRINT I;",
					"NEXT I",
					"PRINT",
					'FOR I=5 TO 1:PRINT "NG":NEXT',
					"N=1",
					"WHILE N<100:N=N*2:WEND",
					"PRINT N",
				].join("\n"),
			);
			ok(o[0] === "123", `for ${o[0]}`);
			ok(o[1] === "1050", `step ${o[1]}`);
			ok(o[2] === "128", `while ${o[2]}`);
		},
	},
	{
		name: "BASIC：GOSUB／RETURN・GOTO（行番号と ラベル）",
		run: () => {
			const o = out(
				[
					"10 GOSUB @SUB",
					"20 GOSUB 100",
					"30 GOTO 50",
					'40 PRINT "NG"',
					'50 PRINT "END"',
					"60 END",
					'100 PRINT "L100":RETURN',
					"@SUB",
					'PRINT "SUB"',
					"RETURN",
				].join("\n"),
			);
			ok(o.slice(0, 3).join(",") === "SUB,L100,END", o.join(","));
		},
	},
	{
		name: "BASIC：IF … THEN … ELSE（1行）",
		run: () => {
			const o = out(
				[
					'A=5:IF A>3 THEN PRINT "BIG":B=1 ELSE PRINT "SMALL":B=2',
					'IF A>9 THEN PRINT "NG" ELSE PRINT "ELSE";B',
					"IF A=5 THEN 30",
					'PRINT "NG"',
					'30 IF A THEN IF A<3 THEN PRINT "NG" ELSE PRINT "IN"',
				].join("\n"),
			);
			ok(o[0] === "BIG" && o[1] === "ELSE1" && o[2] === "IN", o.join(","));
		},
	},
	{
		name: "BASIC：配列と 文字の 関数",
		run: () => {
			const o = out(
				[
					"DIM A(10),G(2,3),S$(2)",
					"FOR I=0 TO 10:A(I)=I*I:NEXT",
					"G(2,3)=7",
					'S$(1)="おんJ"',
					'PRINT A(10);G(2,3);LEN(S$(1));S$(0);"/"',
					'T$="ABCDEF"',
					'PRINT MID$(T$,1,3);LEFT$(T$,2);RIGHT$(T$,2);STR$(12)+"!";VAL("3.5")*2',
					'PRINT CHR$(65);ASC("a");INT(-1.5);ABS(-3);SQR(16);MAX(1,9,4)',
				].join("\n"),
			);
			ok(o[0] === "10073/", `arr ${o[0]}`);
			ok(o[1] === "BCDABEF12!7", `str ${o[1]}`);
			ok(o[2] === "A97-2349", `fn ${o[2]}`);
		},
	},
	{
		name: "BASIC：まちがいは 行の 番号つきの 日本語",
		run: () => {
			const e = (src: string, want: string) => {
				const got = errOf(src);
				ok(got === want, `${src} → ${got}（${want}）`);
			};
			e('10 PRINT "A"\n20 PRNT 1', "20行目：わからない　命令");
			e("10 A=1\n20 B=0\n30 PRINT A/B", "30行目：0で　わった");
			e('A="X"', "1行目：数と　文字が　まざった");
			e("GOTO @NAI", "1行目：とび先が　ない");
			e("10 RETURN", "10行目：GOSUBが　ない　RETURN");
			e("FOR I=1 TO 3", "1行目：NEXTが　ない　FOR");
			e("PRINT 1\nNEXT", "2行目：FORが　ない　NEXT");
			e("DIM A(3)\nA(4)=1", "2行目：配列の　はんいの　外");
			e("B(1)=2", "1行目：DIMして　いない　配列");
			e('PRINT "ABC', '1行目：「"」が　とじて　いない');
			e("PRINT (1+2", "1行目：かっこが　とじて　いない");
			e("X=RND(1,2)", "1行目：引数の　数が　ちがう");
			e("@A\nGOSUB @A", "2行目：GOSUBが　深すぎる");
		},
	},
	{
		name: "BASIC：むげんループは 1こまで 返る（step の 上限）",
		run: () => {
			const vm = vmOf("@L\nX=X+1\nGOTO @L");
			const r = vm.run(1000);
			ok(r.k === "yield", `yield ${r.k}`);
			const r2 = vm.run(1000);
			ok(r2.k === "yield", "again");
			// WAIT は こまの 数で 返る
			const w = vmOf("WAIT 30\nPRINT 1").run();
			ok(w.k === "wait" && w.frames === 30, `wait ${JSON.stringify(w)}`);
		},
	},
	{
		name: "BASIC：絵・ボタン・音",
		run: () => {
			const h = host(16 | 8);
			const vm = vmOf(
				[
					"CLS:PSET 1,1,3",
					"LINE 0,10,9,10,5",
					"BOX 20,20,29,29,9,1",
					"CIRCLE 100,100,5,7",
					"PUYU 50,50",
					"IF BUTTON() AND 16 THEN BEEP 7",
					"IF BUTTON() AND 1 THEN BEEP 2",
					"NOTE 60",
					'LOCATE 3,2:COLOR 7:PRINT "ｗ"',
				].join("\n"),
				h,
			);
			ok(runAll(vm).k === "end", "end");
			const px = vm.scr.px;
			ok(px[1 * 240 + 1] === 3, "pset");
			ok(px[10 * 240 + 9] === 5 && px[10 * 240 + 0] === 5, "line");
			ok(px[25 * 240 + 25] === 9, "box fill");
			ok(px[100 * 240 + 105] === 7 && px[100 * 240 + 100] === 0, "circle");
			ok(px[50 * 240 + 50] === 16, "puyu");
			ok(h.beeps.join() === "7" && h.notes.join() === "60", "sound");
			ok(vm.scr.row(2) === "   ｗ" && vm.scr.fg[2 * 30 + 3] === 7, "locate");
		},
	},
	{
		name: "BASIC：見本は どれも 読めて しばらく 動く",
		run: () => {
			for (const s of BASIC_SAMPLES) {
				const p = compile(s.code);
				ok(!isCompileError(p), `${s.name}: ${JSON.stringify(p)}`);
				for (const b of [0, 1, 4, 8, 16]) {
					const vm = vmOf(s.code, host(b));
					const r = runAll(vm, 300);
					ok(r.k !== "error", `${s.name} ${b}: ${JSON.stringify(r)}`);
				}
			}
		},
	},
];
