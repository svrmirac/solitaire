import type { PlayableCard } from './playable-card';

export function canDragSequence(sequence: PlayableCard[]): boolean {
    if (!sequence.length) return false;

    if (!sequence.every((card) => card?.faceUp)) {
        return false;
    }

    for (let index = 0; index < sequence.length - 1; index++) {
        const current = sequence[index];
        const next = sequence[index + 1];
        if (!current || !next) return false;

        const isDescending = current.rank === next.rank + 1;
        const isSameSuit = current.symbol === next.symbol;
        if (!isDescending || !isSameSuit) {
            return false;
        }
    }

    return true;
}

export function canPlaceSequenceOn(
    movingSequence: PlayableCard[],
    targetTop: PlayableCard | undefined
): boolean {
    if (!movingSequence.length) return false;

    if (!targetTop) {
        return true;
    }

    if (!targetTop.faceUp) {
        return false;
    }

    const bottomCard = movingSequence[0];
    return bottomCard ? targetTop.rank === bottomCard.rank + 1 : false;
}
