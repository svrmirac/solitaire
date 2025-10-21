import type { Card } from './cards';

export type PlayableCard = Card & { faceUp: boolean };
