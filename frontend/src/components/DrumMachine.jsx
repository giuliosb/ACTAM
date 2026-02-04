import { useState, useRef, useEffect } from "react";
import kickWav from "../assets/TPS - Eclipse - Kick 01.wav";
import snareWav from "../assets/TPS - Eclipse - Snare 01.wav";
import hihatWav from "../assets/TPS - Eclipse - Open Hat 01.wav";
import clapWav from "../assets/TPS - Eclipse - Clap 01.wav";

const DRUM_SOUNDS = [
  { name: "Kick", url: kickWav },
  { name: "Snare", url: snareWav },
  { name: "Hi-Hat", url: hihatWav },
  { name: "Clap", url: clapWav },
];

export default function DrumMachine() {
	const [steps, setSteps] = useState(16);
	const [sequence, setSequence] = useState(
		Array.from({ length: 16 }, () => Array(DRUM_SOUNDS.length).fill(false))
	);
	const [isPlaying, setIsPlaying] = useState(false);
	const [bpm, setBpm] = useState(120);
	const [currentStep, setCurrentStep] = useState(-1);
	const intervalRef = useRef(null);
	const audioRefs = useRef(DRUM_SOUNDS.map(() => []));

	// Load audio elements
	const getAudio = (drumIdx) => {
		const audio = new window.Audio(DRUM_SOUNDS[drumIdx].url);
		audio.currentTime = 0;
		return audio;
	};

	const handleCellClick = (stepIdx, drumIdx) => {
		setSequence((prev) => {
			const newSeq = prev.map((row) => [...row]);
			newSeq[stepIdx][drumIdx] = !newSeq[stepIdx][drumIdx];
			return newSeq;
		});
	};

	const handlePlay = () => {
		if (isPlaying) {
			clearInterval(intervalRef.current);
			setIsPlaying(false);
			setCurrentStep(-1);
			return;
		}
		setIsPlaying(true);
		let step = 0;
		setCurrentStep(0);
		intervalRef.current = setInterval(() => {
			setCurrentStep(step);
			sequence[step].forEach((on, drumIdx) => {
				if (on) {
					const audio = getAudio(drumIdx);
					audio.play();
				}
			});
			step = (step + 1) % steps;
		}, (60 / bpm) * 1000);
	};

	// Stop interval on unmount
	useEffect(() => {
		return () => clearInterval(intervalRef.current);
	}, []);

	// Update sequence length if steps change
	const handleStepsChange = (e) => {
		const newSteps = parseInt(e.target.value, 10);
		setSteps(newSteps);
		setSequence((prev) => {
			if (newSteps > prev.length) {
				return [
					...prev,
					...Array.from({ length: newSteps - prev.length }, () => Array(DRUM_SOUNDS.length).fill(false)),
				];
			} else {
				return prev.slice(0, newSteps);
			}
		});
		setCurrentStep(-1);
		setIsPlaying(false);
		clearInterval(intervalRef.current);
	};

	return (
		<div className="drum-machine-container" style={{ padding: 20, maxWidth: 700 }}>
			<h2>Drum Machine</h2>
			<div style={{ marginBottom: 10 }}>
				<label>
					Steps:
					<select value={steps} onChange={handleStepsChange} style={{ marginLeft: 8 }}>
						{[8, 12, 16, 24, 32].map((n) => (
							<option key={n} value={n}>{n}</option>
						))}
					</select>
				</label>
				<label style={{ marginLeft: 20 }}>
					BPM:
					<input
						type="number"
						min={40}
						max={300}
						value={bpm}
						onChange={e => setBpm(Number(e.target.value))}
						style={{ width: 60, marginLeft: 8 }}
					/>
				</label>
				<button onClick={handlePlay} style={{ marginLeft: 20 }}>
					{isPlaying ? "Stop" : "Play"}
				</button>
			</div>
			<div className="drum-grid" style={{ display: "grid", gridTemplateColumns: `120px repeat(${steps}, 32px)`, gap: 2 }}>
				<div></div>
				{Array.from({ length: steps }).map((_, i) => (
					<div key={i} style={{ textAlign: "center", fontWeight: "bold" }}>{i + 1}</div>
				))}
				{DRUM_SOUNDS.map((drum, drumIdx) => (
					<>
						<div key={drum.name} style={{ fontWeight: "bold", paddingRight: 8 }}>{drum.name}</div>
						{Array.from({ length: steps }).map((_, stepIdx) => (
							<div
								key={stepIdx}
								onClick={() => handleCellClick(stepIdx, drumIdx)}
								style={{
									width: 28,
									height: 28,
									margin: 2,
									borderRadius: 4,
									background: sequence[stepIdx][drumIdx] ? (currentStep === stepIdx && isPlaying ? "#ff9800" : "#4caf50") : (currentStep === stepIdx && isPlaying ? "#ffe0b2" : "#eee"),
									border: currentStep === stepIdx && isPlaying ? "2px solid #ff9800" : "1px solid #bbb",
									cursor: "pointer",
									transition: "background 0.1s, border 0.1s"
								}}
								title={drum.name}
							/>
						))}
					</>
				))}
			</div>
		</div>
	);
}
