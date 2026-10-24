// 話の つなぎの 場面（data/story/hooks.ts・ui/village/episodeHooks.ts）の 試験。
// pnpm test で いっしょに 動く。形は bondTests と 同じ（Fail・ok・{ id, name, ok, reason }）。id の 頭は H。

import { shiyoAtMaid } from "../data/people/shiyoShift";
import { BATH_EVE, KINOKO_EVE } from "../data/story/hooks";
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
	"H2",
	"第一話 → 第二話の つなぎ：パン板を 持ち帰った 帰りに 1回だけ。回想・図・行進を 通って 翌朝で おわる",
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
				KINOKO_EVE.nanjOmen,
				KINOKO_EVE.march,
				KINOKO_EVE.morning,
			])
				ok(said.includes(t), `missing: ${t}\n${said}`);
			// 見出しを 貼る 人影は 2026-10-19 に やめた（行き先は 町の 騒ぎ そのもの）
			ok(!said.includes("見出し"), "the morning still reads a headline");
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
