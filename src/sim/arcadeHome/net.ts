// キリコの 家の パソコンの「ネット」（data/net/site.ts）の 試験：リンクは ある ページだけ・安価は 同じ スレの ほかの レスに 届く・
// （安価の お題は 先の レスも さす）・同じ 帰りなら 同じ ページ（帰りが かわれば スレが 入れかわる）・画面の 字に 出さない 言葉と 絵文字が ない。

import {
	ABE_PORTRAIT,
	PORTRAIT_H,
	PORTRAIT_PALETTE,
	PORTRAIT_W,
} from "../../data/net/abePortrait";
import {
	ABE,
	ABE_TITLE,
	buildSite,
	NET_BANNED,
	NET_EMOJI,
	NET_HOME,
	pageText,
} from "../../data/net/site";
import type { NetEnv, Site, Span } from "../../data/net/types";
import { type HomeGameTest, ok } from "./kit";

const env = (seed: number, stage: number, hour = 21): NetEnv => ({
	seed,
	stage,
	year: 2026,
	m: 10,
	d: 14,
	w: 3,
	hour,
});

/** いろいろな 帰り・段・時刻の サイト。 */
const sites = (): { e: NetEnv; site: Site }[] => {
	const out: { e: NetEnv; site: Site }[] = [];
	for (let stage = 0; stage <= 7; stage++)
		for (const seed of [0, 1, 2, 7, 33, 81, 191, 500])
			for (const hour of [2, 9, 15, 21]) {
				const e = env(seed, stage, hour);
				out.push({ e, site: buildSite(e) });
			}
	return out;
};

const hrefs = (xs: readonly Span[]): string[] =>
	xs.flatMap((x) => ("href" in x ? [x.href] : []));

export const tests: HomeGameTest[] = [
	{
		name: "net: どの リンクも ある ページへ",
		run: () => {
			for (const { e, site } of sites()) {
				ok(site.pages.has(NET_HOME), "板一覧が ない");
				for (const pg of site.pages.values())
					for (const n of pg.nodes) {
						const to =
							n.t === "link"
								? [n.href]
								: n.t === "p"
									? hrefs(n.spans)
									: n.t === "post"
										? n.post.lines.flatMap(hrefs)
										: n.t === "grid"
											? n.items.map((x) => x.href)
											: [];
						for (const h of to)
							ok(
								site.pages.has(h),
								`${pg.url} → ${h} が ない（seed ${e.seed} 段 ${e.stage}）`,
							);
					}
			}
		},
	},
	{
		name: "net: 安価は 同じ スレの ほかの レスに 届く",
		run: () => {
			for (const { site } of sites())
				for (const pg of site.pages.values()) {
					const nos = new Set(
						pg.nodes.flatMap((n) => (n.t === "post" ? [n.post.no] : [])),
					);
					for (const n of pg.nodes) {
						// 安価は 書きこみの 中だけ（辞典の「>>123」は ただの 字）
						if (n.t === "p")
							ok(
								!n.spans.some((x) => "anchor" in x),
								`${pg.url} の 地の文に 安価`,
							);
						if (n.t !== "post") continue;
						for (const l of n.post.lines)
							for (const x of l)
								if ("anchor" in x)
									ok(
										nos.has(x.anchor) && x.anchor !== n.post.no,
										`${pg.title} の >>${n.post.no} が >>${x.anchor} を さす`,
									);
					}
				}
		},
	},
	{
		name: "net: 同じ 帰りなら 同じ・帰りで 入れかわる",
		run: () => {
			const dump = (s: Site) =>
				JSON.stringify([...s.pages.values()].map(pageText));
			for (const stage of [0, 3, 7]) {
				const a = dump(buildSite(env(5, stage)));
				ok(a === dump(buildSite(env(5, stage))), "同じ 種で ちがう");
				const board = (seed: number) =>
					JSON.stringify(
						pageText(
							buildSite(env(seed, stage)).pages.get(
								`${NET_HOME}livejupiter/`,
							) ?? { url: "", title: "", kind: "none", nodes: [] },
						),
					);
				ok(board(5) !== board(6), `段 ${stage} で 帰りが かわっても 同じ 板`);
			}
		},
	},
	{
		name: "net: 出さない 言葉・絵文字が ない",
		run: () => {
			for (const { site } of sites())
				for (const pg of site.pages.values())
					for (const s of pageText(pg)) {
						ok(!NET_BANNED.test(s), `${pg.url}：${s}`);
						ok(!NET_EMOJI.test(s), `${pg.url} に 絵文字：${s}`);
					}
		},
	},
	{
		name: "net: 板と スレが 並ぶ",
		run: () => {
			for (const { e, site } of sites()) {
				const lj = site.pages.get(`${NET_HOME}livejupiter/`);
				ok(lj, "おんJの 板が ない");
				const threads = [...site.pages.values()].filter(
					(p) => p.kind === "thread",
				);
				ok(threads.length >= 6, `スレが 少ない（段 ${e.stage}）`);
				for (const t of threads)
					ok(
						t.nodes.some((n) => n.t === "post" && n.post.no === 1),
						`${t.title} に >>1 が ない`,
					);
			}
		},
	},
	{
		name: "net: 実在の 人の 名前は お気に入りの ページの 題だけ",
		run: () => {
			for (const { site } of sites()) {
				ok(site.pages.get(ABE)?.status, "お気に入りの ページが ない");
				for (const pg of site.pages.values())
					for (const s of pageText(pg))
						if (s.includes("阿部"))
							ok(
								s === ABE_TITLE && (pg.url === ABE || pg.url === NET_HOME),
								`${pg.url}：${s}`,
							);
			}
		},
	},
	{
		name: "net: お気に入りの ドット絵は 40x48・色は ぜんぶ ある",
		run: () => {
			ok(ABE_PORTRAIT.length === PORTRAIT_H, "高さが ちがう");
			for (const r of ABE_PORTRAIT) {
				ok(r.length === PORTRAIT_W, "幅が ちがう");
				for (const ch of r) ok(PORTRAIT_PALETTE[ch], `色 ${ch} が ない`);
			}
		},
	},
];
