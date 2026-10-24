import type React from "react";
import type { GameMode } from "../engine/gameRunner";

interface GameHeaderProps {
	mode: GameMode;
	onOpenHelp: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({ mode, onOpenHelp }) => {
	const modeLabel =
		mode === "village"
			? "おんJタウン"
			: mode === "dungeon"
				? "ダンジョン探索中"
				: "場面再生";

	return (
		<div
			style={{
				position: "fixed",
				top: "calc(var(--app-y) + 4px)",
				left: "calc(var(--app-x) + 8px)",
				zIndex: 25,
				display: "flex",
				alignItems: "center",
				gap: "8px",
				pointerEvents: "auto",
			}}
		>
			<button
				type="button"
				onClick={onOpenHelp}
				title="操作説明・手帳を開く"
				style={{
					background: "rgba(13, 10, 22, 0.85)",
					border: "1px solid rgba(255, 207, 74, 0.6)",
					color: "#ffcf4a",
					fontSize: "12px",
					padding: "3px 8px",
					borderRadius: "4px",
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					gap: "4px",
					boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
				}}
			>
				<span>❓</span>
				<span style={{ fontSize: "11px" }}>操作手帳</span>
			</button>

			<div
				style={{
					background: "rgba(13, 10, 22, 0.75)",
					border: "1px solid rgba(185, 176, 214, 0.3)",
					color: "#b9b0d6",
					fontSize: "11px",
					padding: "3px 8px",
					borderRadius: "4px",
					letterSpacing: "0.5px",
				}}
			>
				{modeLabel}
			</div>
		</div>
	);
};
