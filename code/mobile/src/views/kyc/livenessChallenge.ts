import { computeEAR, computeSmileScore, computeYawAngle } from '../../services/mediapipeService';

export type ChallengeType = 'smile' | 'blink' | 'turn_left' | 'turn_right';

export const CHALLENGES: ChallengeType[] = ['smile', 'blink', 'turn_left'];
export const HOLD_FRAMES = 8;
export const MIN_CHALLENGE_VISIBLE_MS = 700;

const SMILE_THRESHOLD = 0.3;
const TURN_LEFT_THRESHOLD = 15;
const TURN_RIGHT_THRESHOLD = -15;
const EYE_OPEN_EAR = 0.24;
const EYE_CLOSED_EAR = 0.18;
const REQUIRED_OPEN_MS = 120;
const REQUIRED_CLOSED_MS = 90;
const REQUIRED_REOPEN_MS = 120;

export type BlinkPhase = 'waiting_open' | 'waiting_close' | 'waiting_reopen' | 'complete';

export type BlinkValidationState = {
  phase: BlinkPhase;
  openSinceMs: number | null;
  closedSinceMs: number | null;
  reopenSinceMs: number | null;
};

export type ChallengeEvaluation = {
  matched: boolean;
  progress: number;
  guidanceKey?: string;
};

export function createBlinkValidationState(): BlinkValidationState {
  return {
    phase: 'waiting_open',
    openSinceMs: null,
    closedSinceMs: null,
    reopenSinceMs: null,
  };
}

export function evaluateBlinkFrame(
  state: BlinkValidationState,
  ear: number,
  timestampMs: number,
): { state: BlinkValidationState; complete: boolean; progress: number } {
  if (state.phase === 'complete') {
    return { state, complete: true, progress: 1 };
  }

  if (state.phase === 'waiting_open') {
    const openSinceMs = ear >= EYE_OPEN_EAR
      ? state.openSinceMs ?? timestampMs
      : null;
    const openDurationMs = openSinceMs === null ? 0 : timestampMs - openSinceMs;
    const nextState: BlinkValidationState = openDurationMs >= REQUIRED_OPEN_MS
      ? { ...state, phase: 'waiting_close', openSinceMs }
      : { ...state, openSinceMs };
    return {
      state: nextState,
      complete: false,
      progress: Math.min(openDurationMs / REQUIRED_OPEN_MS, 1) * 0.33,
    };
  }

  if (state.phase === 'waiting_close') {
    const closedSinceMs = ear <= EYE_CLOSED_EAR
      ? state.closedSinceMs ?? timestampMs
      : null;
    const closedDurationMs = closedSinceMs === null ? 0 : timestampMs - closedSinceMs;
    const nextState: BlinkValidationState = closedDurationMs >= REQUIRED_CLOSED_MS
      ? { ...state, phase: 'waiting_reopen', closedSinceMs }
      : { ...state, closedSinceMs };
    return {
      state: nextState,
      complete: false,
      progress: 0.33 + Math.min(closedDurationMs / REQUIRED_CLOSED_MS, 1) * 0.34,
    };
  }

  const reopenSinceMs = ear >= EYE_OPEN_EAR
    ? state.reopenSinceMs ?? timestampMs
    : null;
  const reopenDurationMs = reopenSinceMs === null ? 0 : timestampMs - reopenSinceMs;
  if (reopenDurationMs >= REQUIRED_REOPEN_MS) {
    const completeState: BlinkValidationState = {
      ...state,
      phase: 'complete',
      reopenSinceMs,
    };
    return { state: completeState, complete: true, progress: 1 };
  }

  return {
    state: { ...state, reopenSinceMs },
    complete: false,
    progress: 0.67 + Math.min(reopenDurationMs / REQUIRED_REOPEN_MS, 1) * 0.33,
  };
}

export function evaluateChallenge(
  type: ChallengeType,
  landmarks: unknown,
  blinkState: BlinkValidationState,
  timestampMs: number,
): { evaluation: ChallengeEvaluation; blinkState: BlinkValidationState } {
  if (!landmarks || !Array.isArray(landmarks)) {
    return {
      evaluation: { matched: false, progress: 0 },
      blinkState,
    };
  }

  switch (type) {
    case 'smile': {
      const score = computeSmileScore(landmarks);
      return {
        evaluation: {
          matched: score > SMILE_THRESHOLD,
          progress: Math.min(score / SMILE_THRESHOLD, 1),
        },
        blinkState,
      };
    }
    case 'blink': {
      const result = evaluateBlinkFrame(blinkState, computeEAR(landmarks), timestampMs);
      return {
        evaluation: {
          matched: result.complete,
          progress: result.progress,
        },
        blinkState: result.state,
      };
    }
    case 'turn_left': {
      const yaw = computeYawAngle(landmarks);
      const isWrongSide = yaw < -10;
      const isAlmostThere = yaw > 8 && yaw <= TURN_LEFT_THRESHOLD;
      return {
        evaluation: {
          matched: yaw > TURN_LEFT_THRESHOLD,
          progress: Math.min(Math.max(yaw, 0) / TURN_LEFT_THRESHOLD, 1),
          guidanceKey: isWrongSide
            ? 'liveness.guidance.turn.other_side'
            : isAlmostThere
              ? 'liveness.guidance.turn.more'
              : 'liveness.guidance.turn.left',
        },
        blinkState,
      };
    }
    case 'turn_right': {
      const yaw = computeYawAngle(landmarks);
      return {
        evaluation: {
          matched: yaw < TURN_RIGHT_THRESHOLD,
          progress: Math.min(Math.max(Math.abs(yaw), 0) / Math.abs(TURN_RIGHT_THRESHOLD), 1),
        },
        blinkState,
      };
    }
  }
}
