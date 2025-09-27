import { splitIntoSentencesAdvanced } from '../external/latvianSegmentation';
import { splitIntoSentencesDeterministic } from './splitter';

export type SegmenterEngine = 'primitive' | 'latvian_sentence_tester:local';

export function segmentText(text: string, engine: SegmenterEngine): string[] {
  switch (engine) {
    case 'latvian_sentence_tester:local':
      // Use copied module from latvian_sentence_tester project (see docs)
      return splitIntoSentencesAdvanced(text);
    case 'primitive':
    default:
      return splitIntoSentencesDeterministic(text);
  }
}
