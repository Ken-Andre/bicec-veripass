import { describe, expect, it } from 'vitest';
import {
  createBlinkValidationState,
  evaluateBlinkFrame,
  evaluateChallenge,
} from './livenessChallenge';

function makeYawLandmarks(noseX: number) {
  const landmarks = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  landmarks[1] = { x: noseX, y: 0.5, z: 0 };
  landmarks[234] = { x: 0.3, y: 0.5, z: 0 };
  landmarks[454] = { x: 0.7, y: 0.5, z: 0 };
  return landmarks;
}

describe('liveness blink validation', () => {
  it('ignores closed eyes until an open-eye baseline is established', () => {
    let state = createBlinkValidationState();

    for (const [timestampMs, ear] of [
      [0, 0.12],
      [60, 0.13],
      [120, 0.14],
    ] as const) {
      const result = evaluateBlinkFrame(state, ear, timestampMs);
      state = result.state;

      expect(result.complete).toBe(false);
      expect(state.phase).toBe('waiting_open');
      expect(result.progress).toBe(0);
    }
  });

  it('does not validate a blink from a single closed-eye frame', () => {
    let state = createBlinkValidationState();

    for (const [index, ear] of [0.27, 0.28, 0.26, 0.12, 0.29].entries()) {
      const result = evaluateBlinkFrame(state, ear, index * 16);
      state = result.state;
      expect(result.complete).toBe(false);
    }
  });

  it('validates only an explicit open-closed-open blink sequence', () => {
    let state = createBlinkValidationState();
    let complete = false;

    const sequence = [
      [0, 0.27],
      [70, 0.28],
      [130, 0.27],
      [180, 0.13],
      [230, 0.14],
      [280, 0.13],
      [330, 0.29],
      [400, 0.28],
      [460, 0.27],
    ] as const;

    for (const [timestampMs, ear] of sequence) {
      const result = evaluateBlinkFrame(state, ear, timestampMs);
      state = result.state;
      complete = result.complete;
    }

    expect(complete).toBe(true);
    expect(state.phase).toBe('complete');
  });

  it('resets the reopen phase while eyes remain closed', () => {
    let state = createBlinkValidationState();

    const sequence = [
      [0, 0.27],
      [70, 0.28],
      [130, 0.27],
      [180, 0.13],
      [230, 0.14],
      [290, 0.12],
      [350, 0.12],
    ] as const;

    for (const [timestampMs, ear] of sequence) {
      const result = evaluateBlinkFrame(state, ear, timestampMs);
      state = result.state;
      expect(result.complete).toBe(false);
    }

    expect(state.phase).toBe('waiting_reopen');
    expect(state.reopenSinceMs).toBeNull();
  });

  it('does not validate a high-fps closed-eye noise spike', () => {
    let state = createBlinkValidationState();
    let complete = false;

    const sequence = [
      [0, 0.27],
      [40, 0.28],
      [80, 0.27],
      [130, 0.27],
      [146, 0.12],
      [162, 0.29],
      [220, 0.28],
      [280, 0.27],
    ] as const;

    for (const [timestampMs, ear] of sequence) {
      const result = evaluateBlinkFrame(state, ear, timestampMs);
      state = result.state;
      complete = result.complete;
    }

    expect(complete).toBe(false);
    expect(state.phase).toBe('waiting_close');
  });

  it('resets closed-eye duration when EAR returns to the uncertain band', () => {
    let state = createBlinkValidationState();

    for (const [timestampMs, ear] of [
      [0, 0.27],
      [70, 0.28],
      [130, 0.27],
      [180, 0.13],
      [220, 0.21],
      [260, 0.13],
    ] as const) {
      const result = evaluateBlinkFrame(state, ear, timestampMs);
      state = result.state;
      expect(result.complete).toBe(false);
    }

    expect(state.phase).toBe('waiting_close');
    expect(state.closedSinceMs).toBe(260);
  });
});

describe('liveness turn-left guidance', () => {
  it('returns wrong-side guidance when the user turns away from the requested side', () => {
    const { evaluation } = evaluateChallenge(
      'turn_left',
      makeYawLandmarks(0.44),
      createBlinkValidationState(),
      0,
    );

    expect(evaluation.matched).toBe(false);
    expect(evaluation.guidanceKey).toBe('liveness.guidance.turn.other_side');
    expect(evaluation.progress).toBe(0);
  });

  it('returns almost-there guidance before the left turn threshold', () => {
    const { evaluation } = evaluateChallenge(
      'turn_left',
      makeYawLandmarks(0.535),
      createBlinkValidationState(),
      0,
    );

    expect(evaluation.matched).toBe(false);
    expect(evaluation.guidanceKey).toBe('liveness.guidance.turn.more');
    expect(evaluation.progress).toBeGreaterThan(0);
    expect(evaluation.progress).toBeLessThan(1);
  });

  it('matches once the left turn threshold is crossed', () => {
    const { evaluation } = evaluateChallenge(
      'turn_left',
      makeYawLandmarks(0.56),
      createBlinkValidationState(),
      0,
    );

    expect(evaluation.matched).toBe(true);
    expect(evaluation.progress).toBe(1);
  });

  it('treats missing landmarks as no progress', () => {
    const { evaluation } = evaluateChallenge('turn_left', [], createBlinkValidationState(), 0);

    expect(evaluation.matched).toBe(false);
    expect(evaluation.progress).toBe(0);
  });
});
