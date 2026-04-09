import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
	getMetronomeSoundLabel,
	MetronomeEngine,
	type MetronomeSound,
	type MetronomeStatus,
} from "./audio/metronome";
import { BPMControl } from "./components/BPMControl";
import { PlayerControls } from "./components/PlayerControls";
import { SoundSelector } from "./components/SoundSelector";
import "./App.css";

const metronome = new MetronomeEngine();

function getAudioRecoveryMessage(reason: "prepare" | "start", error: unknown) {
	const fallback =
		reason === "prepare"
			? "Audio couldn't initialize. Interact with the page, then try Start again. If it still fails, check your volume and browser audio settings."
			: "Playback couldn't start. Tap Start again after interacting with the page, and check your volume or browser audio settings.";

	if (error instanceof Error && error.message) {
		return `${error.message} Try tapping Start again after interacting with the page, then check your volume or browser audio settings.`;
	}

	return fallback;
}

function App() {
	const [bpm, setBpm] = useState(120);
	const [sound, setSound] = useState<MetronomeSound>("click");
	const [isPlaying, setIsPlaying] = useState(false);
	const [status, setStatus] = useState<MetronomeStatus>("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isPulseActive, setIsPulseActive] = useState(false);
	const pulseTimeoutRef = useRef<number | null>(null);

	const handleTick = useEffectEvent(() => {
		setIsPulseActive(true);

		if (pulseTimeoutRef.current !== null) {
			window.clearTimeout(pulseTimeoutRef.current);
		}

		pulseTimeoutRef.current = window.setTimeout(() => {
			setIsPulseActive(false);
			pulseTimeoutRef.current = null;
		}, 120);
	});

	useEffect(() => {
		metronome.setOnTick(handleTick);

		void metronome.prepare().then(
			() => {
				setStatus((current) => (current === "idle" ? "ready" : current));
			},
			(error) => {
				setStatus("error");
				setErrorMessage(getAudioRecoveryMessage("prepare", error));
			},
		);

		return () => {
			metronome.setOnTick(null);
			metronome.stop();
			metronome.dispose();

			if (pulseTimeoutRef.current !== null) {
				window.clearTimeout(pulseTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		metronome.updateSound(sound);
	}, [sound]);

	useEffect(() => {
		metronome.updateBpm(bpm);
	}, [bpm]);

	const soundLabel = getMetronomeSoundLabel(sound);
	const playbackStatusLabel =
		status === "starting"
			? `Starting ${soundLabel}`
			: isPlaying
				? `Playing ${soundLabel}`
				: "Ready";

	async function handleTogglePlayback() {
		if (status === "starting") {
			return;
		}

		if (isPlaying) {
			metronome.stop();
			setIsPlaying(false);
			setIsPulseActive(false);
			setStatus("ready");
			return;
		}

		setErrorMessage(null);
		setStatus("starting");

		try {
			await metronome.start({ bpm, sound });
			setIsPlaying(true);
			setStatus("playing");
		} catch (error) {
			setIsPlaying(false);
			setStatus("error");
			setErrorMessage(getAudioRecoveryMessage("start", error));
		}
	}

	return (
		<main className="app-shell">
			<section className="metronome-panel">
				<header className="panel-header">
					<div className="title-block">
						<p className="eyebrow">Cadence Metronome</p>
						<h1>Simple rhythm support for runs and drills.</h1>
					</div>
				</header>

				<section className="meter-block" aria-label="Current cadence">
					<p className="meter-label">Cadence</p>
					<div className="meter-reading">
						<span>{bpm}</span>
						<small>BPM</small>
					</div>
					<p className="meter-caption">{Math.round(60000 / bpm)} ms per beat</p>
				</section>

				<section className="controls-stack" aria-label="Metronome controls">
					<BPMControl bpm={bpm} onBpmChange={setBpm} />
					<SoundSelector sound={sound} onSoundChange={setSound} />
				</section>

				<PlayerControls
					isBusy={status === "starting"}
					isPlaying={isPlaying}
					isPulseActive={isPulseActive}
					onToggle={handleTogglePlayback}
					statusLabel={playbackStatusLabel}
				/>
			</section>

			{errorMessage ? (
				<p className="error-banner" role="alert">
					{errorMessage}
				</p>
			) : null}
		</main>
	);
}

export default App;
