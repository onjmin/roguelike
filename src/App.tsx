import type React from "react";
import { useEffect, useRef, useState } from "react";
import { GameHeader } from "./components/GameHeader";
import { HelpModal } from "./components/HelpModal";
import { type GameMode, startGame } from "./engine/gameRunner";

export const App: React.FC = () => {
	const appRef = useRef<HTMLDivElement>(null);
	const uiRef = useRef<HTMLDivElement>(null);
	const [gameMode, setGameMode] = useState<GameMode>("village");
	const [helpOpen, setHelpOpen] = useState(false);

	useEffect(() => {
		const appEl = appRef.current;
		const uiEl = uiRef.current;
		if (!appEl || !uiEl) return;

		const cleanup = startGame(appEl, uiEl, {
			onModeChange: (mode) => setGameMode(mode),
		});

		return () => {
			cleanup();
		};
	}, []);

	return (
		<>
			{/* React Game Header (Quick guide and mode badge) */}
			<GameHeader mode={gameMode} onOpenHelp={() => setHelpOpen(true)} />

			{/* Main Game Shell: houses the canvas screen, HUD, and DOM overlay */}
			<div id="app" ref={appRef}>
				<div id="ui" ref={uiRef} />
			</div>

			{/* In-game React Guide Modal */}
			<HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
		</>
	);
};
