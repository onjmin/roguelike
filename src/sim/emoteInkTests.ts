// 立ち絵の 手書き風の 感情の 記号（ui/emoteInk.ts）の 試験（pnpm test）。

import { EMOTES } from "../engine/emote";
import { buildInkSvg, INK_CLASS } from "../ui/emoteInk";

type TestResult = { id: string; name: string; ok: boolean; reason?: string };

export const runEmoteInkTests = (): TestResult[] => {
	const out: TestResult[] = [];
	const used = new Set<string>();
	for (const e of EMOTES) {
		const name = `portrait ink mark for ${e}`;
		const svg = buildInkSvg(e);
		const paths = svg.match(/<path /g)?.length ?? 0;
		const reason = !svg.startsWith("<svg")
			? "not an svg"
			: /NaN|undefined|Infinity/.test(svg)
				? "bad number in the path"
				: !svg.includes('class="v0"') || !svg.includes('class="v1"')
					? "missing a wobble variant"
					: paths < 4
						? `only ${paths} paths`
						: buildInkSvg(e) !== svg
							? "not the same drawing twice"
							: used.has(INK_CLASS[e])
								? `class ${INK_CLASS[e]} is shared`
								: undefined;
		used.add(INK_CLASS[e]);
		out.push({ id: "emote-ink", name, ok: !reason, reason });
	}
	return out;
};
