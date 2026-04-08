type BPMControlProps = {
	bpm: number;
	onBpmChange: (bpm: number) => void;
};

const MIN_BPM = 60;
const MAX_BPM = 220;
const BPM_STEP = 5;

const CADENCE_OPTIONS = Array.from(
	{ length: (MAX_BPM - MIN_BPM) / BPM_STEP + 1 },
	(_, index) => MIN_BPM + index * BPM_STEP,
);

export function BPMControl({ bpm, onBpmChange }: BPMControlProps) {
	return (
		<label className="field-row" htmlFor="cadence-select">
			<span className="field-label">Cadence</span>
			<select
				id="cadence-select"
				name="cadence"
				value={bpm}
				onChange={(event) => onBpmChange(Number(event.target.value))}
			>
				{CADENCE_OPTIONS.map((option) => (
					<option key={option} value={option}>
						{option} BPM
					</option>
				))}
			</select>
		</label>
	);
}
