// 話の つなぎの 場面（data/story/hooks.ts・ui/village/episodeHooks.ts）の 試験。
// pnpm test で いっしょに 動く。形は bondTests と 同じ（Fail・ok・{ id, name, ok, reason }）。id の 頭は H。

import { shiyoAtMaid } from "../data/people/shiyoShift";
import {
	BATH_EVE,
	colonyCard,
	factionCard,
	KINOKO_EVE,
	routeCard,
} from "../data/story/hooks";
import type { Story } from "../engine/defs";
import { hasFlag, loadProgress, saveProgress } from "../engine/save";
import {
	bathEveDue,
	bathEveScript,
	kinokoEveDue,
	kinokoEveScript,
} from "../ui/village/episodeHooks";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { id: string; name: string; run: () => void | Promise<void> }[] =
	[];
const test = (id: string, name: string, run: () => void | Promise<void>) =>
	CASES.push({ id, name, run });

/** 全角=1・半角=0.5 で 数えた 幅（villageTests と 同じ）。 */
const width = (line: string): number =>
	[...line].reduce((w, ch) => w + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);

/** 村の 窓（2行まで・1行 全角22字）。 */
const fits = (where: string, text: string): void => {
	const lines = text.split("\n");
	ok(lines.length <= 2, `${where}: ${lines.length} lines in "${text}"`);
	for (const l of lines)
		ok(width(l) <= 22, `${where}: "${l}" is ${width(l)} wide (> 22)`);
};

/** localStorage を 試験の あいだだけ 差しかえる。 */
const withStorage = async (fn: () => Promise<void>): Promise<void> => {
	const store = new Map<string, string>();
	const prev = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => store.set(k, String(v)),
			removeItem: (k: string) => store.delete(k),
			clear: () => store.clear(),
			key: (i: number) => [...store.keys()][i] ?? null,
			get length() {
				return store.size;
			},
		},
	});
	try {
		await fn();
	} finally {
		if (prev) Object.defineProperty(globalThis, "localStorage", prev);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
};

/** 呼ばれた 順を 記録する だけの 場面（どの 呼び出しも すぐ おわる）。 */
const fakeStory = (): { s: Story; log: string[] } => {
	const log: string[] = [];
	const s = new Proxy(
		{},
		{
			get: (_t, name) => {
				if (name === "then") return undefined;
				if (name === "state") return { x: 19, y: 22 };
				return (...args: unknown[]) => {
					log.push(
						`${String(name)} ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}`,
					);
					return Promise.resolve(0);
				};
			},
		},
	) as Story;
	return { s, log };
};

test(
	"H1",
	"第一話 → 第二話の つなぎ：どの 文も 村の 窓に 収まる。イメージ図の 札も 短い",
	() => {
		for (const [k, v] of Object.entries(KINOKO_EVE)) fits(`KINOKO_EVE.${k}`, v);
		for (const spec of [
			colonyCard(0),
			colonyCard(1),
			colonyCard(2),
			routeCard,
		]) {
			ok(spec.links.length === spec.nodes.length - 1, `${spec.title}: links`);
			for (const n of spec.nodes)
				ok(width(n.label) <= 8, `${n.label}: label too wide`);
		}
	},
);

test(
	"H2",
	"第一話 → 第二話の つなぎ：パン板を 持ち帰った 帰りに 1回だけ。回想・図・行進・人影の 見出しを 通って 翌朝で おわる",
	async () => {
		await withStorage(async () => {
			saveProgress({
				...loadProgress(),
				unlocked: ["shallow", "kinoko"],
				cleared: ["shallow"],
				news: [{ dungeon: "kinoko", reason: "clear" }],
			});
			ok(kinokoEveDue(), "due after the bread board");
			const { s, log } = fakeStory();
			await kinokoEveScript(s);
			const said = log.join("\n");
			for (const t of [
				KINOKO_EVE.night,
				KINOKO_EVE.memoryFlag,
				KINOKO_EVE.kirikoCause,
				KINOKO_EVE.march,
				KINOKO_EVE.morning,
			])
				ok(said.includes(t), `missing: ${t}\n${said}`);
			ok(said.includes("show visitor"), "the shadow posts a headline");
			ok(said.includes("きのこ軍上陸"), "the morning headline");
			// きのこ板の 知らせは この 場面が 引きうける（はぐれた 名無し →「もぐれる」）
			ok(
				said.indexOf(KINOKO_EVE.kirikoGo) <
					said.indexOf("「きのこ板」に\nもぐれるようになった"),
				"Kiriko decides, then the board opens",
			);
			ok(!loadProgress().news.length, "the kinoko news is consumed");
			ok(hasFlag("eve_kinoko") && !kinokoEveDue(), "only once");
		});
	},
);

test(
	"H3",
	"第二話 → 第三話の つなぎ：どの 文も 村の 窓に 収まる。湯温戦争の 図は シヨ派で 1つ ふえる",
	() => {
		for (const [k, v] of Object.entries(BATH_EVE)) fits(`BATH_EVE.${k}`, v);
		for (const step of [0, 1] as const) {
			const spec = factionCard(step);
			ok(spec.links.length === spec.nodes.length - 1, `${spec.title}: links`);
			for (const n of spec.nodes)
				ok(width(n.label) <= 8, `${n.label}: label too wide`);
		}
		ok(
			factionCard(1).nodes.length === factionCard(0).nodes.length + 1,
			"Shiyo adds a faction",
		);
	},
);

test(
	"H4",
	"第二話 → 第三話の つなぎ：きのこ板を 持ち帰った 帰りに 1回だけ（救いで 開いた ときは 出ない）。風呂板の 知らせは 残す",
	async () => {
		await withStorage(async () => {
			saveProgress({
				...loadProgress(),
				unlocked: ["shallow", "kinoko", "main"],
				cleared: ["shallow"],
				news: [{ dungeon: "main", reason: "relief" }],
			});
			ok(!bathEveDue(), "not after the relief");
			saveProgress({
				...loadProgress(),
				unlocked: ["shallow", "kinoko", "main", "tropical"],
				cleared: ["shallow", "kinoko"],
				news: [
					{ dungeon: "main", reason: "clear" },
					{ dungeon: "tropical", reason: "clear" },
				],
			});
			ok(bathEveDue(), "due after the mushroom board");
			const { s, log } = fakeStory();
			await bathEveScript(s);
			const said = log.join("\n");
			for (const t of [
				BATH_EVE.sneeze,
				BATH_EVE.shiyo43,
				BATH_EVE.memoryPost,
				BATH_EVE.nanjSame,
				BATH_EVE.morning,
			])
				ok(said.includes(t), `missing: ${t}\n${said}`);
			ok(said.includes("show visitor"), "the shadow posts again");
			ok(loadProgress().news.length === 2, "the news stays for newsScript");
			ok(hasFlag("eve_main") && !bathEveDue(), "only once");
			// シヨの シフトは 場面の あいだだけ 休み（建て直しは はじめと 翌朝の 2回）、おわれば もとどおり
			ok(
				log.filter((l) => l.startsWith("rebuild")).length === 2,
				"rebuilt for Shiyo and back",
			);
			ok(shiyoAtMaid(7, { m: 10, d: 16, w: 5 }, 19), "the shift is back");
		});
	},
);

export const runHookTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: `hook ${c.id}`, name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: `hook ${c.id}`,
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			});
		}
	}
	return out;
};
