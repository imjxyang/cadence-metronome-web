import {
	startTransition,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";

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
const PULSE_DURATION_MS = 120;

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

function getBackgroundRecoveryMessage(error?: unknown) {
	if (error instanceof Error && error.message) {
		return `${error.message} Return to the app and tap Stop, then Start again if playback does not resume automatically.`;
	}

	return "Playback was paused by the browser or operating system while the app was in the background. Return to the app and tap Stop, then Start again if it does not resume automatically.";
}

function App() {
	const [bpm, setBpm] = useState(180);
	const [sound, setSound] = useState<MetronomeSound>("click");
	const [isPlaying, setIsPlaying] = useState(false);
	const [status, setStatus] = useState<MetronomeStatus>("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isPulseActive, setIsPulseActive] = useState(false);
	const pulseTimeoutIdsRef = useRef(new Set<number>());

	const clearPulseTimers = useEffectEvent(() => {
		for (const timeoutId of pulseTimeoutIdsRef.current) {
			window.clearTimeout(timeoutId);
		}

		pulseTimeoutIdsRef.current.clear();
		startTransition(() => {
			setIsPulseActive(false);
		});
	});

	const scheduleTimeout = useEffectEvent(
		(callback: () => void, delayMs: number) => {
			const timeoutId = window.setTimeout(() => {
				pulseTimeoutIdsRef.current.delete(timeoutId);
				callback();
			}, delayMs);

			pulseTimeoutIdsRef.current.add(timeoutId);
		},
	);

	const handleTick = useEffectEvent((delayMs: number) => {
		scheduleTimeout(
			() => {
				startTransition(() => {
					setIsPulseActive(true);
				});

				scheduleTimeout(() => {
					startTransition(() => {
						setIsPulseActive(false);
					});
				}, PULSE_DURATION_MS);
			},
			Math.max(0, delayMs),
		);
	});

	const stopPlayback = useEffectEvent(() => {
		metronome.stop();
		clearPulseTimers();
		setErrorMessage(null);
		setIsPlaying(false);
		setStatus("ready");
	});

	const startPlayback = useEffectEvent(async () => {
		clearPulseTimers();
		setErrorMessage(null);
		setStatus("starting");

		try {
			await metronome.start({ bpm, sound });
			setIsPlaying(true);
			setStatus("playing");
		} catch (error) {
			clearPulseTimers();
			setIsPlaying(false);
			setStatus("error");
			setErrorMessage(getAudioRecoveryMessage("start", error));
		}
	});

	const recoverPlayback = useEffectEvent(async () => {
		if (!metronome.isPlaybackActive()) {
			return;
		}

		try {
			await metronome.resumePlayback();
			setIsPlaying(metronome.isPlaybackActive());
			setStatus(metronome.isPlaybackActive() ? "playing" : "ready");
			setErrorMessage(null);
		} catch (error) {
			setStatus("recovering");
			setErrorMessage(getBackgroundRecoveryMessage(error));
		}
	});

	const handleAudioStateChange = useEffectEvent(
		(audioState: AudioContextState) => {
			if (audioState === "running") {
				setIsPlaying(metronome.isPlaybackActive());
				setStatus(metronome.isPlaybackActive() ? "playing" : "ready");
				setErrorMessage(null);
				return;
			}

			if (audioState === "closed") {
				clearPulseTimers();
				setIsPlaying(false);
				setStatus("error");
				setErrorMessage(
					"Audio was closed by the browser. Tap Start to create a new playback session.",
				);
				return;
			}

			if (!metronome.isPlaybackActive()) {
				return;
			}

			setIsPlaying(true);
			setStatus("recovering");
			setErrorMessage(getBackgroundRecoveryMessage());
		},
	);

	const handleMediaSessionPlay = useEffectEvent(() => {
		if (metronome.isPlaybackActive()) {
			void recoverPlayback();
			return;
		}

		void startPlayback();
	});

	const handleMediaSessionPause = useEffectEvent(() => {
		if (!metronome.isPlaybackActive()) {
			return;
		}

		stopPlayback();
	});

	useEffect(() => {
		metronome.setOnTick(handleTick);
		metronome.setOnAudioStateChange(handleAudioStateChange);

		void metronome.prepare().then(
			() => {
				setStatus((current) => (current === "idle" ? "ready" : current));
			},
			(error) => {
				setStatus("error");
				setErrorMessage(getAudioRecoveryMessage("prepare", error));
			},
		);

		const handleVisibilityChange = () => {
			if (!document.hidden) {
				void recoverPlayback();
			}
		};
		const handlePageShow = () => {
			void recoverPlayback();
		};
		const handleWindowFocus = () => {
			void recoverPlayback();
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("pageshow", handlePageShow);
		window.addEventListener("focus", handleWindowFocus);

		return () => {
			metronome.setOnTick(null);
			metronome.setOnAudioStateChange(null);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("pageshow", handlePageShow);
			window.removeEventListener("focus", handleWindowFocus);
			metronome.stop();
			metronome.dispose();
			clearPulseTimers();
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
			: status === "recovering"
				? `Recovering ${soundLabel}`
				: isPlaying
					? `Playing ${soundLabel}`
					: "Ready";

	async function handleTogglePlayback() {
		if (status === "starting") {
			return;
		}

		if (isPlaying) {
			stopPlayback();
			return;
		}

		await startPlayback();
	}

	useEffect(() => {
		if (!("mediaSession" in navigator)) {
			return;
		}

		const mediaSession = navigator.mediaSession;

		try {
			mediaSession.setActionHandler("play", handleMediaSessionPlay);
		} catch {
			// Ignore unsupported media session actions.
		}

		try {
			mediaSession.setActionHandler("pause", handleMediaSessionPause);
		} catch {
			// Ignore unsupported media session actions.
		}

		return () => {
			try {
				mediaSession.setActionHandler("play", null);
			} catch {
				// Ignore unsupported media session actions.
			}

			try {
				mediaSession.setActionHandler("pause", null);
			} catch {
				// Ignore unsupported media session actions.
			}
		};
	}, []);

	useEffect(() => {
		if (!("mediaSession" in navigator)) {
			return;
		}

		const mediaSession = navigator.mediaSession;

		if ("MediaMetadata" in window) {
			mediaSession.metadata = new MediaMetadata({
				title: "Cadence Metronome",
				artist: `${bpm} BPM`,
				album: soundLabel,
			});
		}

		mediaSession.playbackState =
			isPlaying && status !== "recovering" ? "playing" : "paused";
	}, [bpm, isPlaying, soundLabel, status]);

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
