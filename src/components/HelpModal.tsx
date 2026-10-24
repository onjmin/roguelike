import type React from "react";
import { useState } from "react";

type TabId = "controls" | "dungeon" | "village" | "arcade";

interface HelpModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
	const [activeTab, setActiveTab] = useState<TabId>("controls");

	if (!isOpen) return null;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: backdrop click to dismiss
		<div
			role="presentation"
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 99999,
				backgroundColor: "rgba(0, 0, 0, 0.78)",
				backdropFilter: "blur(4px)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: "16px",
			}}
			onClick={onClose}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose();
			}}
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: modal container stopPropagation */}
			<div
				role="dialog"
				aria-modal="true"
				style={{
					backgroundColor: "rgba(18, 14, 38, 0.96)",
					border: "2px solid #ffcf4a",
					borderRadius: "8px",
					boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
					width: "100%",
					maxWidth: "540px",
					maxHeight: "85vh",
					display: "flex",
					flexDirection: "column",
					color: "#fbf8ff",
					fontFamily:
						"'DotGothic16', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
					overflow: "hidden",
				}}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "12px 16px",
						borderBottom: "1px solid rgba(255, 207, 74, 0.3)",
						background: "rgba(255, 207, 74, 0.1)",
					}}
				>
					<h2
						style={{
							margin: 0,
							fontSize: "18px",
							color: "#ffcf4a",
							fontWeight: "bold",
							display: "flex",
							alignItems: "center",
							gap: "8px",
						}}
					>
						<span>📖</span> 蓄音キリコの冒険手帳
					</h2>
					<button
						type="button"
						onClick={onClose}
						style={{
							background: "none",
							border: "1px solid #b9b0d6",
							color: "#fbf8ff",
							padding: "4px 10px",
							borderRadius: "4px",
							cursor: "pointer",
							fontSize: "14px",
						}}
					>
						✕ とじる
					</button>
				</div>

				{/* Tabs */}
				<div
					style={{
						display: "flex",
						borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
						backgroundColor: "rgba(10, 8, 24, 0.6)",
					}}
				>
					{(
						[
							{ id: "controls", label: "🎮 操作方法" },
							{ id: "dungeon", label: "⚔️ 探索の心得" },
							{ id: "village", label: "🏘️ 村の施設" },
							{ id: "arcade", label: "🕹️ ミニゲーム" },
						] as const
					).map((t) => (
						<button
							key={t.id}
							type="button"
							onClick={() => setActiveTab(t.id)}
							style={{
								flex: 1,
								padding: "10px 4px",
								background:
									activeTab === t.id
										? "rgba(255, 207, 74, 0.15)"
										: "transparent",
								border: "none",
								borderBottom: activeTab === t.id ? "3px solid #ffcf4a" : "none",
								color: activeTab === t.id ? "#ffcf4a" : "#b9b0d6",
								fontWeight: activeTab === t.id ? "bold" : "normal",
								fontSize: "13px",
								cursor: "pointer",
								transition: "all 0.15s ease",
							}}
						>
							{t.label}
						</button>
					))}
				</div>

				{/* Content */}
				<div
					style={{
						padding: "16px",
						overflowY: "auto",
						fontSize: "14px",
						lineHeight: "1.6",
					}}
				>
					{activeTab === "controls" && (
						<div>
							<h3
								style={{
									color: "#ffcf4a",
									marginTop: 0,
									borderBottom: "1px dashed rgba(255,207,74,0.3)",
									paddingBottom: "4px",
								}}
							>
								操作キー一覧
							</h3>
							<table
								style={{
									width: "100%",
									borderCollapse: "collapse",
									marginBottom: "16px",
									fontSize: "13px",
								}}
							>
								<tbody>
									<tr
										style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
									>
										<td
											style={{
												padding: "6px 4px",
												color: "#62e07a",
												width: "100px",
											}}
										>
											<b>Z / Enter</b>
										</td>
										<td style={{ padding: "6px 4px" }}>
											決定 / 目の前の敵を攻撃 / 人に話しかける
										</td>
									</tr>
									<tr
										style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
									>
										<td style={{ padding: "6px 4px", color: "#62e07a" }}>
											<b>X / Esc</b>
										</td>
										<td style={{ padding: "6px 4px" }}>
											メニュー / とじる / キャンセル
										</td>
									</tr>
									<tr
										style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
									>
										<td style={{ padding: "6px 4px", color: "#62e07a" }}>
											<b>十字キー / WASD / テンキー</b>
										</td>
										<td style={{ padding: "6px 4px" }}>
											移動（押しっぱなしでダッシュ）
										</td>
									</tr>
									<tr
										style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
									>
										<td style={{ padding: "6px 4px", color: "#62e07a" }}>
											<b>E</b>
										</td>
										<td style={{ padding: "6px 4px" }}>
											足踏み（ターン経過 / HP自然回復）
										</td>
									</tr>
									<tr
										style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
									>
										<td style={{ padding: "6px 4px", color: "#62e07a" }}>
											<b>Q</b>
										</td>
										<td style={{ padding: "6px 4px" }}>装備中の矢・球を撃つ</td>
									</tr>
									<tr
										style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
									>
										<td style={{ padding: "6px 4px", color: "#62e07a" }}>
											<b>M</b>
										</td>
										<td style={{ padding: "6px 4px" }}>
											全体マップの表示切り替え
										</td>
									</tr>
									<tr
										style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
									>
										<td style={{ padding: "6px 4px", color: "#62e07a" }}>
											<b>F</b>
										</td>
										<td style={{ padding: "6px 4px" }}>向き変更モード</td>
									</tr>
									<tr
										style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
									>
										<td style={{ padding: "6px 4px", color: "#62e07a" }}>
											<b>G</b>
										</td>
										<td style={{ padding: "6px 4px" }}>足元を調べる / 拾う</td>
									</tr>
									<tr>
										<td style={{ padding: "6px 4px", color: "#62e07a" }}>
											<b>O</b>
										</td>
										<td style={{ padding: "6px 4px" }}>
											特殊能力（束音ロゼのすり抜け / 解音ゼロのオート）
										</td>
									</tr>
								</tbody>
							</table>
							<p style={{ color: "#b9b0d6", fontSize: "12px", margin: 0 }}>
								※ スマートフォンでは画面内の仮想十字キーおよび A/B
								ボタン、直接タップで移動・会話が可能です。
							</p>
						</div>
					)}

					{activeTab === "dungeon" && (
						<div>
							<h3
								style={{
									color: "#ffcf4a",
									marginTop: 0,
									borderBottom: "1px dashed rgba(255,207,74,0.3)",
									paddingBottom: "4px",
								}}
							>
								不思議なダンジョン（板めぐり）の基礎
							</h3>
							<ul style={{ paddingLeft: "18px", margin: "8px 0" }}>
								<li style={{ marginBottom: "8px" }}>
									<b>ターン制のルール：</b>自分が 1
									回行動（移動・攻撃・アイテム使用）するとモンスターも 1
									回行動します。
								</li>
								<li style={{ marginBottom: "8px" }}>
									<b>満腹度と空腹：</b>歩くたびに満腹度が少しずつ減ります。0
									になると毎ターン HP
									が減るので、おにぎりや食べ物で補給しましょう。
								</li>
								<li style={{ marginBottom: "8px" }}>
									<b>アイテムの識別：</b>
									草や巻物は使ってみるまで効果が分からないものがあります。ピンチになる前に賢く判別しましょう。
								</li>
								<li style={{ marginBottom: "8px" }}>
									<b>罠（トラップ）：</b>
									部屋の床には見えない罠が潜んでいます。素振りで足元の罠を発見することもできます。
								</li>
							</ul>
						</div>
					)}

					{activeTab === "village" && (
						<div>
							<h3
								style={{
									color: "#ffcf4a",
									marginTop: 0,
									borderBottom: "1px dashed rgba(255,207,74,0.3)",
									paddingBottom: "4px",
								}}
							>
								おんJタウンの主な施設
							</h3>
							<ul style={{ paddingLeft: "18px", margin: "8px 0" }}>
								<li style={{ marginBottom: "8px" }}>
									<b>倉庫・銀行：</b>
									冒険から持ち帰った大切なアイテムやお金を預けることができます。
								</li>
								<li style={{ marginBottom: "8px" }}>
									<b>喫茶・食堂：</b>
									村の住人たちが集まり、会話や噂話、新たなイベントが発生します。
								</li>
								<li style={{ marginBottom: "8px" }}>
									<b>ジュークボックス：</b>蓄音機の前でゲーム中の名曲 BGM
									をいつでも再生できます。
								</li>
								<li style={{ marginBottom: "8px" }}>
									<b>掲示板・出入口：</b>
									新たなダンジョンへの挑戦や、条件を満たすことで解放される高難度ダンジョンへ旅立てます。
								</li>
							</ul>
						</div>
					)}

					{activeTab === "arcade" && (
						<div>
							<h3
								style={{
									color: "#ffcf4a",
									marginTop: 0,
									borderBottom: "1px dashed rgba(255,207,74,0.3)",
									paddingBottom: "4px",
								}}
							>
								ミニゲーム＆アーケード
							</h3>
							<p style={{ marginBottom: "10px" }}>
								村のゲームコーナーや施設では、20種類以上の本格ミニゲームが楽しめます！
							</p>
							<div
								style={{
									display: "grid",
									gridTemplateColumns: "1fr 1fr",
									gap: "8px",
									fontSize: "12px",
								}}
							>
								<div
									style={{
										background: "rgba(255,255,255,0.05)",
										padding: "6px",
										borderRadius: "4px",
									}}
								>
									🎮 クレーンゲーム / 湾岸レース
								</div>
								<div
									style={{
										background: "rgba(255,255,255,0.05)",
										padding: "6px",
										borderRadius: "4px",
									}}
								>
									🃏 ポーカー / ブラックジャック
								</div>
								<div
									style={{
										background: "rgba(255,255,255,0.05)",
										padding: "6px",
										borderRadius: "4px",
									}}
								>
									🧩 ピクロス / ぷゆぷゆ
								</div>
								<div
									style={{
										background: "rgba(255,255,255,0.05)",
										padding: "6px",
										borderRadius: "4px",
									}}
								>
									🎯 ダーツ / 五目並べ / リバーシ
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div
					style={{
						padding: "10px 16px",
						borderTop: "1px solid rgba(255, 255, 255, 0.1)",
						display: "flex",
						justifyContent: "flex-end",
						background: "rgba(10, 8, 24, 0.6)",
					}}
				>
					<button
						type="button"
						onClick={onClose}
						style={{
							background: "#ffcf4a",
							color: "#0d0a16",
							fontWeight: "bold",
							border: "none",
							padding: "6px 18px",
							borderRadius: "4px",
							cursor: "pointer",
							fontSize: "13px",
						}}
					>
						了解！
					</button>
				</div>
			</div>
		</div>
	);
};
