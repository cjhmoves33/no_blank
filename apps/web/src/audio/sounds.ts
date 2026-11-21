import type { Sound } from "./play-sound";

export const clickSound: Sound = ({ context, destination, startAt }) => {
  // TODO(you): 이 소리를 귀로 들으며 정해 주세요.
  //  - 지금은 자리만 채운 소리입니다.
  //  - 파형(type), 음높이(frequency), 음량 곡선(gain), 길이를 바꾸거나 BiquadFilterNode 같은 노드를 더 이을 수 있습니다.
  const duration = 0.2;
  const oscillator = new OscillatorNode(context, { type: "triangle" });
  const envelope = new GainNode(context, { gain: 0 });

  oscillator.frequency.setValueAtTime(1320, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(660, startAt + duration);
  envelope.gain.setValueAtTime(0, startAt);
  envelope.gain.linearRampToValueAtTime(0.25, startAt + 0.005);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(envelope).connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
};
