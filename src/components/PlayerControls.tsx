type PlayerControlsProps = {
	isBusy: boolean;
	isPlaying: boolean;
	onToggle: () => void | Promise<void>;
};

export function PlayerControls({
	isBusy,
	isPlaying,
	onToggle,
}: PlayerControlsProps) {
	const label = isBusy ? "Starting…" : isPlaying ? "Stop" : "Start";

	return (
		<section className="playback-row" aria-label="Playback control">
			<button
				type="button"
				className="toggle-button"
				onClick={onToggle}
				disabled={isBusy}
			>
				{label}
			</button>
			<p className="playback-note">
				Tempo and cue updates apply on the next beat.
			</p>
		</section>
	);
}
