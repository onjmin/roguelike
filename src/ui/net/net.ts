// キリコの 家の パソコンの「ネット」（ui/village/myhome.ts の パソコンの「ネット」から）。
// 古い ブラウザの 窓（アドレスの 欄・戻る／進む／更新／ホーム・とじる）に、data/net/site.ts が 作った 架空の ページを 出す。
// 本物の ネットにも iframe にも つながない（オフラインでも いつも 開ける）。
// - 十字キー ↑↓：リンクの カーソル（遠い ときは 巻き取る）、←→：1画面ずつ 巻き取る。A：開く（安価は その レスを 浮かべる）。
//   B：浮かべた レスを 閉じる → 前の ページ → 板一覧なら とじる。Esc（メニュー）でも とじる。
// - マウス・タップ：リンクを 押す、指や ホイールで そのまま 巻き取る。スマホは 十字キーが 隠れるので「とじる」を いつも 出す。
// - 窓を 開いている あいだは 入力の ハンドラを 積むので、村の 歩きや 窓は キーを 受けない。

import { buildSite, notFound } from "../../data/net/site";
import type {
	NetEnv,
	Node,
	Page,
	Post,
	Site,
	Span,
} from "../../data/net/types";
import { nowHour, nowYear, today } from "../../data/town/calendar";
import type { Story } from "../../engine/defs";
import { loadTown, runStats } from "../../engine/save";
import type { Ctx } from "../ctx";
import { el } from "../dom";

const TEXT = {
	app: "おんJブラウザ",
	back: "戻る",
	fwd: "進む",
	reload: "更新",
	home: "ホーム",
	close: "とじる",
	addr: "アドレス",
	done: "ページが　表示されました",
	reloaded: "更新しました",
	noNew: "新着レスは　ありません",
	hint: "↑↓　リンク　A　開く　B　戻る",
} as const;

/** 保存と 端末の 時計から（帰りの 数が 日ごとの 種）。 */
const netEnv = (): NetEnv => {
	const t = today();
	return {
		seed: runStats().runs,
		stage: loadTown().stage,
		year: nowYear(),
		m: t.m,
		d: t.d,
		w: t.w,
		hour: nowHour(),
	};
};

const button = (text: string, cls = "net-btn"): HTMLButtonElement =>
	el("button", { class: cls, text });

export const netBrowse = (ctx: Ctx, _s: Story): Promise<void> =>
	new Promise((resolve) => {
		let site: Site = buildSite(netEnv());
		const hist: string[] = [];
		let at = -1;
		let cur: Page = notFound(site.home);
		let marks: HTMLElement[] = [];
		let cursor = -1;
		let pop: HTMLElement | null = null;

		const title = el("div", { class: "net-title-text", text: TEXT.app });
		const close = button(TEXT.close, "net-btn net-close");
		const back = button(TEXT.back);
		const fwd = button(TEXT.fwd);
		const reload = button(TEXT.reload);
		const home = button(TEXT.home);
		const addr = el("div", { class: "net-addr-url" });
		const view = el("div", { class: "net-view" });
		const status = el("div", { class: "net-status" });
		const root = el("div", { class: "net" }, [
			el("div", { class: "net-titlebar" }, [title, close]),
			el("div", { class: "net-tools" }, [back, fwd, reload, home]),
			el("div", { class: "net-addr" }, [
				el("span", { class: "net-addr-label", text: TEXT.addr }),
				addr,
			]),
			view,
			status,
		]);

		const say = (s: string) => {
			status.textContent = s;
		};

		// ── 描く ──
		const spans = (xs: readonly Span[]): HTMLElement => {
			const line = el("div", { class: "net-line" });
			for (const x of xs) {
				if ("href" in x) {
					const a = el("a", { class: "net-a", text: x.s });
					a.dataset.href = x.href;
					line.append(a);
				} else if ("anchor" in x) {
					const a = el("a", { class: "net-a net-anchor", text: x.s });
					a.dataset.anchor = String(x.anchor);
					line.append(a);
				} else line.append(x.s);
			}
			return line;
		};
		const postEl = (post: Post): HTMLElement =>
			el("div", { class: "net-post" }, [
				el("div", { class: "net-post-head" }, [
					el("span", { class: "net-no", text: String(post.no) }),
					"：",
					el("span", { class: "net-name", text: post.name }),
					`：${post.date} ID:${post.id}`,
				]),
				el(
					"div",
					{ class: "net-post-body" },
					post.lines.map((l) => spans(l)),
				),
			]);
		/** 写真の 置き場（ドット絵が あれば キャンバスに 1字 1点で 描く。大きさは CSS で くっきり 拡げる）。 */
		const photoEl = (n: Extract<Node, { t: "photo" }>): HTMLElement => {
			const rows = n.pixels;
			if (!rows?.length || !n.palette)
				return el("div", { class: "net-photo", text: n.text });
			const c = el("canvas", { class: "net-photo net-pixel" });
			c.width = Math.max(...rows.map((r) => r.length));
			c.height = rows.length;
			c.setAttribute("role", "img");
			c.setAttribute("aria-label", n.text);
			const g = c.getContext("2d");
			if (g)
				rows.forEach((r, y) => {
					[...r].forEach((ch, x) => {
						const col = n.palette?.[ch];
						if (!col) return;
						g.fillStyle = col;
						g.fillRect(x, y, 1, 1);
					});
				});
			return c;
		};
		const nodeEl = (n: Node): HTMLElement => {
			if (n.t === "h") return el("div", { class: "net-h", text: n.text });
			if (n.t === "hr") return el("hr", { class: "net-hr" });
			if (n.t === "photo") return photoEl(n);
			if (n.t === "grid")
				return el(
					"div",
					{ class: "net-grid" },
					n.items.map((x) => {
						const a = el("a", { class: "net-a", text: x.text });
						a.dataset.href = x.href;
						return el("div", { class: "net-cell" }, [
							el("span", { class: "net-icon" }),
							a,
						]);
					}),
				);
			if (n.t === "post") return postEl(n.post);
			if (n.t === "p") {
				const d = spans(n.spans);
				d.classList.add("net-p");
				if (n.small) d.classList.add("net-small");
				return d;
			}
			const a = el("a", { class: "net-a", text: n.text });
			a.dataset.href = n.href;
			return el("div", { class: n.kako ? "net-li net-kako" : "net-li" }, [
				a,
				...(n.note ? [el("span", { class: "net-note", text: n.note })] : []),
			]);
		};

		const closePop = () => {
			pop?.remove();
			pop = null;
		};
		const setCursor = (i: number) => {
			marks[cursor]?.classList.remove("net-focus");
			cursor = i;
			const m = marks[cursor];
			if (!m) return;
			m.classList.add("net-focus");
			say(m.dataset.href ?? m.textContent ?? "");
		};

		const render = () => {
			closePop();
			view.replaceChildren(...cur.nodes.map(nodeEl));
			view.className = `net-view net-kind-${cur.kind}`;
			view.scrollTop = 0;
			marks = [...view.querySelectorAll<HTMLElement>(".net-a")];
			cursor = -1;
			addr.textContent = cur.url;
			title.textContent = `${cur.title} - ${TEXT.app}`;
			back.disabled = at <= 0;
			fwd.disabled = at >= hist.length - 1;
		};

		const go = (url: string) => {
			hist.splice(at + 1);
			hist.push(url);
			at = hist.length - 1;
			cur = site.pages.get(url) ?? notFound(url);
			render();
			say(cur.status ?? TEXT.done);
		};
		const goAt = (i: number) => {
			if (i < 0 || i >= hist.length) return;
			at = i;
			cur = site.pages.get(hist[at]) ?? notFound(hist[at]);
			render();
			say(cur.status ?? TEXT.done);
		};

		/** 安価の レスを その 下に 浮かべる。 */
		const showAnchor = (a: HTMLElement) => {
			// 浮かべた 中の 安価を 押したときも 先に 位置を はかる（閉じると 消えるので）
			const r = a.getBoundingClientRect();
			const v = view.getBoundingClientRect();
			closePop();
			const no = Number(a.dataset.anchor);
			const post = cur.nodes.find(
				(n): n is Extract<Node, { t: "post" }> =>
					n.t === "post" && n.post.no === no,
			)?.post;
			const box = el("div", { class: "net-pop" }, [
				post ? postEl(post) : el("div", { text: `>>${no}` }),
			]);
			box.style.top = `${r.bottom - v.top + view.scrollTop + 2}px`;
			view.append(box);
			pop = box;
		};

		const open = (a: HTMLElement) => {
			if (a.dataset.anchor) {
				ctx.se("decide");
				showAnchor(a);
				return;
			}
			const href = a.dataset.href;
			if (href) {
				ctx.se("decide");
				go(href);
			}
		};

		const finish = () => {
			popInput();
			root.remove();
			resolve();
		};
		const goBack = () => {
			if (pop) {
				closePop();
				return;
			}
			ctx.se("cancel");
			if (at > 0) goAt(at - 1);
			else finish();
		};

		// ── 十字キー ──
		const inView = (m: HTMLElement) => {
			const r = m.getBoundingClientRect();
			const v = view.getBoundingClientRect();
			return r.bottom > v.top && r.top < v.bottom;
		};
		const step = () => Math.max(40, view.clientHeight * 0.6);
		const move = (d: -1 | 1) => {
			closePop();
			const v = view.getBoundingClientRect();
			let next = -1;
			if (cursor < 0 || !inView(marks[cursor])) {
				const vis = marks
					.map((m, i) => (inView(m) ? i : -1))
					.filter((i) => i >= 0);
				next = vis.length ? (d > 0 ? vis[0] : vis[vis.length - 1]) : -1;
			} else next = cursor + d;
			const m = marks[next];
			const far =
				!m ||
				(d > 0
					? m.getBoundingClientRect().top > v.bottom + step() * 0.5
					: m.getBoundingClientRect().bottom < v.top - step() * 0.5);
			if (far) {
				view.scrollTop += d * step();
				return;
			}
			ctx.se("cursor");
			setCursor(next);
			const r = m.getBoundingClientRect();
			if (r.top < v.top) view.scrollTop -= v.top - r.top + 8;
			else if (r.bottom > v.bottom) view.scrollTop += r.bottom - v.bottom + 8;
		};

		const popInput = ctx.input.push(
			(k) => {
				if (k === "up") move(-1);
				else if (k === "down") move(1);
				else if (k === "left" || k === "right") {
					closePop();
					view.scrollTop += (k === "left" ? -1 : 1) * view.clientHeight * 0.9;
				} else if (k === "a") {
					const m = marks[cursor];
					if (m && inView(m)) open(m);
					else move(1);
				} else if (k === "b") goBack();
				else if (k === "menu") {
					ctx.se("cancel");
					finish();
				}
			},
			{ tap: null },
		);

		// ── マウス・タップ ──
		view.addEventListener("click", (e) => {
			const a = (e.target as HTMLElement).closest<HTMLElement>(".net-a");
			if (!a) {
				closePop();
				return;
			}
			e.preventDefault();
			const i = marks.indexOf(a);
			if (i >= 0) setCursor(i);
			open(a);
		});
		view.addEventListener("pointerover", (e) => {
			const a = (e.target as HTMLElement).closest<HTMLElement>(".net-a");
			if (a?.dataset.href) say(a.dataset.href);
		});
		const tapBtn = (b: HTMLButtonElement, fn: () => void) =>
			b.addEventListener("click", (e) => {
				e.preventDefault();
				if (!b.disabled) fn();
			});
		tapBtn(close, () => {
			ctx.se("cancel");
			finish();
		});
		tapBtn(back, () => {
			ctx.se("cancel");
			goAt(at - 1);
		});
		tapBtn(fwd, () => {
			ctx.se("decide");
			goAt(at + 1);
		});
		tapBtn(home, () => {
			ctx.se("decide");
			go(site.home);
		});
		tapBtn(reload, () => {
			ctx.se("decide");
			site = buildSite(netEnv());
			const top = view.scrollTop;
			cur = site.pages.get(cur.url) ?? notFound(cur.url);
			render();
			view.scrollTop = top;
			say(cur.status ?? (cur.kind === "thread" ? TEXT.noNew : TEXT.reloaded));
		});
		// フィールドや 下の 窓へ 押しが 抜けないように
		root.addEventListener("pointerdown", (e) => e.stopPropagation());

		ctx.ui.appendChild(root);
		go(site.home);
		say(TEXT.hint);
	});
