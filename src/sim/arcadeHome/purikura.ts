// プリクラ（ゲームセンター「連コ」の booth。data/purikura/purikura.ts）の 試験。家具では ないが 遊びの 板なので ここで 回す。

import { CAST } from "../../data/people/cast";
import { type Cast, MOBS } from "../../data/people/mobs";
import {
	addToAlbum,
	decodeAlbum,
	decodePhoto,
	encodeAlbum,
	encodePhoto,
	PURI_BGS,
	PURI_H,
	PURI_KEEP,
	PURI_LINES,
	PURI_POSES,
	PURI_STAMP_MAX,
	PURI_STAMPS,
	PURI_TEXT,
	PURI_W,
	type PuriPhoto,
	puriDate,
	puriDateText,
	puriLineup,
} from "../../data/purikura/purikura";
import { type HomeGameTest, ok, seeded } from "./kit";

const BANNED =
	/落ちる|落ちた|落ちない|黄色|きいろ|山吹|114514|1919|810|うんこ|うんち|オセロ|ガイジ|アスペ|チー牛|原カス|淫夢/;
const width = (s: string) =>
	[...s].reduce((n, c) => n + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);
const fits = (where: string, s: string) => {
	const ls = s.split("\n");
	ok(ls.length <= 2, `${where}: ${ls.length} lines`);
	for (const l of ls)
		ok(width(l) <= 22, `${where}: "${l}" is ${width(l)} wide`);
	ok(!/\p{Extended_Pictographic}/u.test(s), `${where}: emoji`);
	ok(!BANNED.test(s), `${where}: banned word`);
};

const ALL_CAST = [...Object.keys(CAST), ...Object.keys(MOBS)] as Cast[];

const randomPhoto = (rnd: () => number): PuriPhoto => {
	const pool = ALL_CAST.slice();
	const n = Math.floor(rnd() * 3);
	const who: Cast[] = [];
	for (let i = 0; i < n; i++)
		who.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
	return {
		with: who,
		bg: Math.floor(rnd() * PURI_BGS.length),
		pose: Math.floor(rnd() * PURI_POSES.length),
		date: 20260101 + Math.floor(rnd() * 12) * 100 + Math.floor(rnd() * 28),
		stamps: Array.from(
			{ length: Math.floor(rnd() * (PURI_STAMP_MAX + 1)) },
			() => ({
				k: Math.floor(rnd() * PURI_STAMPS.length),
				x: Math.floor(rnd() * PURI_W),
				y: Math.floor(rnd() * PURI_H),
			}),
		),
	};
};

export const tests: HomeGameTest[] = [
	{
		name: "プリクラの 1枚は 保存の 字に して もどすと 同じ 組み立て",
		run: () => {
			const rnd = seeded(14);
			for (let t = 0; t < 200; t++) {
				const p = randomPhoto(rnd);
				const s = encodePhoto(p);
				const q = decodePhoto(s);
				ok(q && JSON.stringify(q) === JSON.stringify(p), `round trip ${s}`);
			}
			ok(decodePhoto(42) === null, "not string");
			ok(decodePhoto("roze|0|0|20261014") === null, "short");
			ok(decodePhoto("nobody|0|0|20261014|") === null, "unknown cast");
			ok(decodePhoto("roze.roze|0|0|20261014|") === null, "twice");
			ok(decodePhoto("roze.zero.feris|0|0|20261014|") === null, "too many");
			ok(decodePhoto("|9|0|20261014|") === null, "bad bg");
			ok(decodePhoto("|0|0|20261340|") === null, "bad date");
			ok(decodePhoto("|0|0|20261014|0zz00") === null, "x out");
			ok(decodePhoto("|0|0|20261014|9a0a0") === null, "bad stamp");
			ok(decodePhoto("|0|0|20261014|0a0") === null, "cut stamp");
			const solo = decodePhoto("|1|2|20261014|");
			ok(solo && solo.with.length === 0 && solo.bg === 1, "solo");
		},
	},
	{
		name: "プリ帳は 新しい 順に 8枚まで、こわれた 字は 捨てる",
		run: () => {
			const rnd = seeded(8);
			let list: PuriPhoto[] = [];
			const all: PuriPhoto[] = [];
			for (let i = 0; i < 11; i++) {
				const p = randomPhoto(rnd);
				all.unshift(p);
				list = addToAlbum(list, p);
			}
			ok(list.length === PURI_KEEP, `keep ${list.length}`);
			const back = decodeAlbum(encodeAlbum(list));
			ok(
				JSON.stringify(back) === JSON.stringify(all.slice(0, PURI_KEEP)),
				"album round trip",
			);
			ok(decodeAlbum("{").length === 0, "bad json");
			ok(decodeAlbum(null).length === 0, "null");
			ok(
				decodeAlbum(JSON.stringify({ v: 1, list: ["x", encodePhoto(list[0])] }))
					.length === 1,
				"drops broken",
			);
			ok(puriDateText(puriDate(new Date(2026, 9, 4))) === "2026.10.04", "date");
		},
	},
	{
		name: "プリクラの ならびは キリコを 入れて 1〜3人",
		run: () => {
			ok(puriLineup({ with: [] }).join() === "kiriko", "solo");
			ok(puriLineup({ with: ["roze"] }).join() === "kiriko,roze", "pair");
			ok(
				puriLineup({ with: ["roze", "puyu"] }).join() === "roze,kiriko,puyu",
				"trio",
			);
		},
	},
	{
		name: "プリクラの 字と ひとことは 窓に 入り、ことばの 決まりを まもる",
		run: () => {
			for (const w of ALL_CAST) {
				const l = PURI_LINES[w];
				ok(typeof l === "string" && l.length > 0, `line for ${w}`);
				fits(`line ${w}`, l);
			}
			for (const [k, v] of Object.entries(PURI_TEXT))
				for (const t of Array.isArray(v) ? v : [v]) fits(`text ${k}`, t);
			for (const t of [...PURI_BGS, ...PURI_POSES, ...PURI_STAMPS])
				fits("name", t);
		},
	},
];
