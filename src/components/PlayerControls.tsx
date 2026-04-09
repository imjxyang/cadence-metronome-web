type PlayerControlsProps = {
	isBusy: boolean;
	isPlaying: boolean;
	isPulseActive: boolean;
	onToggle: () => void | Promise<void>;
	statusLabel: string;
};

export function PlayerControls({
	isBusy,
	isPlaying,
	isPulseActive,
	onToggle,
	statusLabel,
}: PlayerControlsProps) {
	const label = isBusy ? "Starting…" : isPlaying ? "Stop" : "Start";

	return (
		<section className="playback-row" aria-label="Playback control">
			<button
				type="button"
				className="toggle-button"
				data-playing={isPlaying}
				onClick={onToggle}
				disabled={isBusy}
				aria-pressed={isPlaying}
				aria-label={`${label}. ${statusLabel}.`}
			>
				<span className="toggle-meta" aria-hidden="true">
					<span
						className="status-dot"
						data-playing={isPlaying}
						data-pulse={isPulseActive ? "on" : "off"}
					/>
					<span className="toggle-status">{statusLabel}</span>
				</span>
				<span className="toggle-label">{label}</span>
			</button>
			<p className="sr-only" aria-live="polite">
				{statusLabel}
			</p>
			<p className="playback-note">
				Tempo and cue updates apply on the next beat.
			</p>
		</section>
	);
}
