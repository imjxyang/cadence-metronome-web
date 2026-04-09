export const METRONOME_SOUND_OPTIONS = [
	{ value: "click", label: "Click" },
	{ value: "beep", label: "Beep" },
	{ value: "clap", label: "Clap" },
	{ value: "tick", label: "Tick" },
	{ value: "woodblock", label: "Woodblock" },
	{ value: "rim", label: "Rim" },
	{ value: "hi-hat", label: "Hi-Hat" },
	{ value: "cowbell", label: "Cowbell" },
	{ value: "shaker", label: "Shaker" },
	{ value: "clave", label: "Clave" },
	{ value: "bell", label: "Bell" },
	{ value: "pulse", label: "Pulse" },
	{ value: "low-tone", label: "Low Tone" },
	{ value: "high-tone", label: "High Tone" },
	{ value: "snap", label: "Snap" },
] as const;

export type MetronomeSound = (typeof METRONOME_SOUND_OPTIONS)[number]["value"];
export type MetronomeStatus =
	| "idle"
	| "ready"
	| "starting"
	| "playing"
	| "recovering"
	| "error";

type StartOptions = {
	bpm: number;
	sound: MetronomeSound;
};

type TickHandler = ((delayMs: number) => void) | null;
type AudioStateHandler = ((state: AudioContextState) => void) | null;
type SampleGenerator = (
	index: number,
	frameCount: number,
	sampleRate: number,
) => number;
type ScheduledBeat = {
	gainNode: GainNode;
	source: AudioBufferSourceNode;
	time: number;
};

const MASTER_GAIN = 0.72;
const TWO_PI = Math.PI * 2;
const INITIAL_SCHEDULE_OFFSET_SECONDS = 0.05;
const RESCHEDULE_OFFSET_SECONDS = 0.05;
const SCHEDULE_AHEAD_TIME_SECONDS = 0.75;
const SCHEDULER_LOOKAHEAD_MS = 25;

export function getMetronomeSoundLabel(sound: MetronomeSound) {
	return (
		METRONOME_SOUND_OPTIONS.find((option) => option.value === sound)?.label ??
		sound
	);
}

function burst(progress: number, decay: number, start = 0) {
	if (progress < start) {
		return 0;
	}

	return Math.exp(-(progress - start) * decay);
}

function sine(frequency: number, index: number, sampleRate: number) {
	return Math.sin((TWO_PI * frequency * index) / sampleRate);
}

function square(frequency: number, index: number, sampleRate: number) {
	return Math.sign(sine(frequency, index, sampleRate));
}

function noise() {
	return Math.random() * 2 - 1;
}

function createMonoBuffer(
	context: AudioContext,
	durationSeconds: number,
	generator: SampleGenerator,
) {
	const sampleRate = context.sampleRate;
	const frameCount = Math.floor(sampleRate * durationSeconds);
	const buffer = context.createBuffer(1, frameCount, sampleRate);
	const channel = buffer.getChannelData(0);

	for (let index = 0; index < frameCount; index += 1) {
		channel[index] = generator(index, frameCount, sampleRate);
	}

	return buffer;
}

export class MetronomeEngine {
	private audioContext: AudioContext | null = null;
	private buffers: Partial<Record<MetronomeSound, AudioBuffer>> = {};
	private loadingPromise: Promise<void> | null = null;
	private schedulerIntervalId: number | null = null;
	private scheduledBeats: ScheduledBeat[] = [];
	private nextBeatTime = 0;
	private currentBpm = 120;
	private currentSound: MetronomeSound = "click";
	private isPlaying = false;
	private onTick: TickHandler = null;
	private onAudioStateChange: AudioStateHandler = null;

	setOnTick(handler: TickHandler) {
		this.onTick = handler;
	}

	setOnAudioStateChange(handler: AudioStateHandler) {
		this.onAudioStateChange = handler;

		if (this.audioContext) {
			handler?.(this.audioContext.state);
		}
	}

	isPlaybackActive() {
		return this.isPlaying;
	}

	updateBpm(nextBpm: number) {
		this.currentBpm = nextBpm;

		if (this.isPlaying) {
			this.rescheduleFromNow();
		}
	}

	updateSound(nextSound: MetronomeSound) {
		this.currentSound = nextSound;

		if (this.isPlaying) {
			this.rescheduleFromNow();
		}
	}

	async prepare() {
		if (this.loadingPromise) {
			return this.loadingPromise;
		}

		this.loadingPromise = this.loadBuffers();
		await this.loadingPromise;
	}

	async start({ bpm, sound }: StartOptions) {
		this.stop();

		this.currentBpm = bpm;
		this.currentSound = sound;

		await this.prepare();

		if (!this.audioContext) {
			throw new Error("Audio context is unavailable in this browser.");
		}

		if (this.audioContext.state !== "running") {
			await this.audioContext.resume();
		}

		this.isPlaying = true;
		this.nextBeatTime =
			this.audioContext.currentTime + INITIAL_SCHEDULE_OFFSET_SECONDS;
		this.startScheduler();
		this.schedulePendingBeats();
	}

	stop() {
		this.isPlaying = false;
		this.stopScheduler();
		this.cancelScheduledBeats();
	}

	async resumePlayback() {
		await this.prepare();

		if (!this.audioContext) {
			throw new Error("Audio context is unavailable in this browser.");
		}

		const wasRunning = this.audioContext.state === "running";

		if (!wasRunning) {
			await this.audioContext.resume();
		}

		if (this.isPlaying && (!wasRunning || this.schedulerIntervalId === null)) {
			this.rescheduleFromNow();
		}
	}

	dispose() {
		this.stop();

		if (this.audioContext) {
			this.audioContext.onstatechange = null;
			void this.audioContext.close();
			this.audioContext = null;
		}

		this.buffers = {};
		this.loadingPromise = null;
	}

	private async loadBuffers() {
		const context = this.getAudioContext();
		this.buffers = {
			click: this.createClickBuffer(context),
			beep: this.createBeepBuffer(context),
			clap: this.createClapBuffer(context),
			tick: this.createTickBuffer(context),
			woodblock: this.createWoodblockBuffer(context),
			rim: this.createRimBuffer(context),
			"hi-hat": this.createHiHatBuffer(context),
			cowbell: this.createCowbellBuffer(context),
			shaker: this.createShakerBuffer(context),
			clave: this.createClaveBuffer(context),
			bell: this.createBellBuffer(context),
			pulse: this.createPulseBuffer(context),
			"low-tone": this.createLowToneBuffer(context),
			"high-tone": this.createHighToneBuffer(context),
			snap: this.createSnapBuffer(context),
		};
	}

	private getAudioContext() {
		if (this.audioContext) {
			return this.audioContext;
		}

		const AudioContextConstructor = window.AudioContext;

		if (!AudioContextConstructor) {
			throw new Error("Web Audio API is not supported in this browser.");
		}

		this.audioContext = new AudioContextConstructor({
			latencyHint: "interactive",
		});
		this.audioContext.onstatechange = () => {
			const state = this.audioContext?.state;

			if (!state) {
				return;
			}

			if (state === "closed") {
				this.stop();
			} else if (state !== "running") {
				this.stopScheduler();
			}

			if (
				state === "running" &&
				this.isPlaying &&
				this.schedulerIntervalId === null
			) {
				this.rescheduleFromNow();
			}

			this.onAudioStateChange?.(state);
		};
		this.onAudioStateChange?.(this.audioContext.state);

		return this.audioContext;
	}

	private rescheduleFromNow() {
		if (!this.audioContext || !this.isPlaying) {
			return;
		}

		this.cancelScheduledBeats();
		this.nextBeatTime =
			this.audioContext.currentTime + RESCHEDULE_OFFSET_SECONDS;
		this.startScheduler();
		this.schedulePendingBeats();
	}

	private startScheduler() {
		if (this.schedulerIntervalId !== null) {
			return;
		}

		this.schedulerIntervalId = window.setInterval(() => {
			if (!this.audioContext || !this.isPlaying) {
				return;
			}

			if (this.audioContext.state !== "running") {
				return;
			}

			this.schedulePendingBeats();
		}, SCHEDULER_LOOKAHEAD_MS);
	}

	private stopScheduler() {
		if (this.schedulerIntervalId !== null) {
			window.clearInterval(this.schedulerIntervalId);
			this.schedulerIntervalId = null;
		}
	}

	private cancelScheduledBeats() {
		for (const beat of this.scheduledBeats) {
			try {
				beat.source.stop();
			} catch {
				// Ignore stop errors for sources that have already finished.
			}

			beat.source.disconnect();
			beat.gainNode.disconnect();
		}

		this.scheduledBeats = [];
	}

	private schedulePendingBeats() {
		if (!this.audioContext || this.audioContext.state !== "running") {
			return;
		}

		while (
			this.nextBeatTime <
			this.audioContext.currentTime + SCHEDULE_AHEAD_TIME_SECONDS
		) {
			this.scheduleBeatAt(this.nextBeatTime);
			this.nextBeatTime += 60 / this.currentBpm;
		}
	}

	private scheduleBeatAt(noteTime: number) {
		if (!this.audioContext) {
			return;
		}

		const buffer = this.buffers[this.currentSound];
		if (!buffer) {
			return;
		}

		const source = this.audioContext.createBufferSource();
		const gainNode = this.audioContext.createGain();
		const scheduledBeat: ScheduledBeat = {
			gainNode,
			source,
			time: noteTime,
		};

		source.buffer = buffer;
		gainNode.gain.value = MASTER_GAIN;

		source.connect(gainNode);
		gainNode.connect(this.audioContext.destination);
		source.addEventListener(
			"ended",
			() => {
				this.scheduledBeats = this.scheduledBeats.filter(
					(beat) => beat !== scheduledBeat,
				);
				source.disconnect();
				gainNode.disconnect();
			},
			{ once: true },
		);
		source.start(noteTime);
		this.scheduledBeats.push(scheduledBeat);

		this.onTick?.(
			Math.max(0, (noteTime - this.audioContext.currentTime) * 1000),
		);
	}

	private createClickBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.12, (index, frameCount, sampleRate) => {
			const progress = index / frameCount;
			const envelope = burst(progress, 22);
			const wave = sine(1800, index, sampleRate);
			return wave * envelope * 0.9;
		});
	}

	private createBeepBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.12, (index, frameCount, sampleRate) => {
			const progress = index / frameCount;
			const envelope = Math.min(progress * 12, 1) * burst(progress, 10);
			return sine(880, index, sampleRate) * envelope * 0.65;
		});
	}

	private createClapBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.14, (index, frameCount) => {
			const progress = index / frameCount;
			const envelope = burst(progress, 14) + burst(progress, 28, 0.14) * 0.45;
			return noise() * envelope * 0.5;
		});
	}

	private createTickBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.08, (index, frameCount, sampleRate) => {
			const progress = index / frameCount;
			const envelope = burst(progress, 30);
			const tone = sine(2400, index, sampleRate);
			return tone * envelope * 0.7;
		});
	}

	private createWoodblockBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.14, (index, frameCount, sampleRate) => {
			const progress = index / frameCount;
			const envelope = burst(progress, 16);
			const body =
				sine(960, index, sampleRate) * 0.7 +
				sine(1440, index, sampleRate) * 0.3;
			return body * envelope * 0.7;
		});
	}

	private createRimBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.1, (index, frameCount, sampleRate) => {
			const progress = index / frameCount;
			const envelope = burst(progress, 26);
			const tone =
				sine(2200, index, sampleRate) * 0.55 +
				sine(3400, index, sampleRate) * 0.28;
			return (tone + noise() * 0.12) * envelope * 0.9;
		});
	}

	private createHiHatBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.08, (index, frameCount, sampleRate) => {
			const progress = index / frameCount;
			const envelope = burst(progress, 36);
			const metallic =
				square(4200, index, sampleRate) * 0.18 +
				square(6100, index, sampleRate) * 0.12;
			return (noise() * 0.8 + metallic) * envelope * 0.45;
		});
	}

	private createCowbellBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.18, (index, frameCount, sampleRate) => {
			const progress = index / frameCount;
			const envelope = burst(progress, 9);
			const tone =
				square(540, index, sampleRate) * 0.4 +
				square(845, index, sampleRate) * 0.26 +
				sine(1180, index, sampleRate) * 0.18;
			return tone * envelope * 0.65;
		});
	}

	private createShakerBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.18, (index, frameCount) => {
			const progress = index / frameCount;
			const envelope =
				burst(progress, 26, 0.02) * 0.8 +
				burst(progress, 30, 0.11) * 0.45 +
				burst(progress, 40, 0.18) * 0.2;
			return noise() * envelope * 0.34;
		});
	}

	private createClaveBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.11, (index, frameCount, sampleRate) => {
			const progress = index / frameCount;
			const envelope = burst(progress, 20);
			const tone =
				sine(2500, index, sampleRate) * 0.62 +
				sine(3800, index, sampleRate) * 0.24;
			return tone * envelope * 0.78;
		});
	}

	private createBellBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.28, (index, frameCount, sampleRate) => {
			const progress = index / frameCount;
			const envelope = burst(progress, 4.8);
			const tone =
				sine(660, index, sampleRate) * 0.4 +
				sine(1320, index, sampleRate) * 0.22 +
				sine(1980, index, sampleRate) * 0.14;
			return tone * envelope * 0.72;
		});
	}

	private createPulseBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.16, (index, frameCount, sampleRate) => {
			const progress = index / frameCount;
			const envelope = Math.min(progress * 18, 1) * burst(progress, 7.5);
			const tone = sine(440, index, sampleRate) * 0.78;
			return tone * envelope;
		});
	}

	private createLowToneBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.16, (index, frameCount, sampleRate) => {
			const progress = index / frameCount;
			const envelope = Math.min(progress * 14, 1) * burst(progress, 8.5);
			const tone =
				sine(330, index, sampleRate) * 0.72 +
				sine(660, index, sampleRate) * 0.14;
			return tone * envelope;
		});
	}

	private createHighToneBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.14, (index, frameCount, sampleRate) => {
			const progress = index / frameCount;
			const envelope = Math.min(progress * 18, 1) * burst(progress, 11);
			const tone =
				sine(1320, index, sampleRate) * 0.58 +
				sine(1760, index, sampleRate) * 0.18;
			return tone * envelope;
		});
	}

	private createSnapBuffer(context: AudioContext) {
		return createMonoBuffer(context, 0.09, (index, frameCount, sampleRate) => {
			const progress = index / frameCount;
			const envelope = burst(progress, 24) + burst(progress, 46, 0.04) * 0.22;
			const tone = sine(1900, index, sampleRate) * 0.18;
			return (noise() * 0.75 + tone) * envelope * 0.5;
		});
	}
}
