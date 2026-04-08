import {
	METRONOME_SOUND_OPTIONS,
	type MetronomeSound,
} from "../audio/metronome";

type SoundSelectorProps = {
	sound: MetronomeSound;
	onSoundChange: (sound: MetronomeSound) => void;
};

export function SoundSelector({ sound, onSoundChange }: SoundSelectorProps) {
	return (
		<label className="field-row" htmlFor="cue-select">
			<span className="field-label">Cue</span>
			<select
				id="cue-select"
				name="cue"
				value={sound}
				onChange={(event) =>
					onSoundChange(event.target.value as MetronomeSound)
				}
			>
				{METRONOME_SOUND_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}
