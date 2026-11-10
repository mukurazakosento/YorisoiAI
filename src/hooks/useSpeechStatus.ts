import { useEffect, useState } from 'react';

import {
  getSpeechStatus,
  subscribeSpeechStatus,
  type SpeechStatus,
} from '../services/speech';

/**
 * 音声案内の再生状態（idle / speaking / paused）を購読する。
 */
export function useSpeechStatus(): SpeechStatus {
  const [status, setStatus] = useState<SpeechStatus>(() => getSpeechStatus());

  useEffect(() => subscribeSpeechStatus(setStatus), []);

  return status;
}
