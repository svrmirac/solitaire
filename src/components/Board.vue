<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'
import Deck from './Deck.vue';
import SolvedStack from './SolvedStack.vue';
import PlayStack from './PlayStack.vue';
import { buildSpiderDeck, DEFAULT_GAME_MODE, type GameMode, Rank } from '@/cards';
import type { PlayableCard } from '@/playable-card';
import { canDragSequence, canPlaceSequenceOn } from '@/rules';

type PlayStackRef = Ref<PlayableCard[]>;

type GameState = {
    deckHolder: PlayableCard[];
    playStacks: PlayableCard[][];
    solvedStacks: PlayableCard[][];
};

const deckHolder = ref<PlayableCard[]>([]);
const gameMode = ref<GameMode>(DEFAULT_GAME_MODE);
const FOUNDATIONS_COUNT = 8;
const solvedStacks = ref<PlayableCard[][]>(Array.from({ length: FOUNDATIONS_COUNT }, () => []));
const playStacks: PlayStackRef[] = Array.from({ length: 10 }, () => ref<PlayableCard[]>([]));
const highlightedStacks = ref<number[]>([]);
const showWinModal = ref(false);
let highlightTimeout: ReturnType<typeof setTimeout> | null = null;
let shuffleNonce = 0;
const isDealing = ref(false);
const dealingIndex = ref<number | null>(null);
const history = ref<GameState[]>([]);
const DEAL_DELAY_MS = 140;
const foundationGridStyle = computed(() => {
    const count = FOUNDATIONS_COUNT;
    const gaps = count - 1;
    return {
        gridTemplateColumns: `repeat(${count}, var(--card-width))`,
        minWidth: `min(100%, calc(${count} * var(--card-width) + ${gaps} * var(--board-gap)))`
    };
});
const gameModeOptions: Array<{ value: GameMode; label: string }> = [
    { value: 'one-suit', label: '1 Suit' },
    { value: 'two-suit', label: '2 Suits' },
    { value: 'four-suit', label: '4 Suits' }
];

onMounted(() => {
    if (deckHolder.value.length === 0) {
        deckHolder.value = shuffleDeck(gameMode.value);
    }

    if (deckHolder.value.length !== 104) {
        alert("Board: unexpected num of cards");
        return;
    }

    dealInitialCards();
});

onUnmounted(() => {
    if (highlightTimeout) {
        clearTimeout(highlightTimeout);
        highlightTimeout = null;
    }
});

type CardDropPayload = {
    sourceIndex: number;
    targetIndex: number;
    startIndex: number;
    count: number;
};

function handleCardDrop(payload: CardDropPayload) {
    const { sourceIndex, targetIndex, startIndex, count } = payload;

    if (sourceIndex === targetIndex || count <= 0) {
        return;
    }

    const source = playStacks[sourceIndex];
    const target = playStacks[targetIndex];

    if (!source || !target) {
        return;
    }

    if (startIndex < 0 || startIndex >= source.value.length) {
        return;
    }

    const available = source.value.length - startIndex;
    if (available < count) {
        return;
    }

    const movingPreview = source.value.slice(startIndex, startIndex + count);

    if (!sequenceIsMovable(movingPreview)) {
        return;
    }

    if (!canPlaceOnTarget(movingPreview, target.value)) {
        return;
    }

    captureState();

    const movingCards = source.value.splice(startIndex, count);
    target.value.push(...movingCards);

    flipTopCard(source);
    flipTopCard(target);
    checkCompletedRuns();
}

function highlightStacks(indexes: number[]) {
    highlightedStacks.value = [...indexes];
    if (highlightTimeout) {
        clearTimeout(highlightTimeout);
    }
    highlightTimeout = setTimeout(() => {
        highlightedStacks.value = [];
        highlightTimeout = null;
    }, 1200);
}

function wait(duration: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, duration);
    });
}

async function dealFromStock() {
    if (isDealing.value) {
        return;
    }

    const emptyIndexes = playStacks
        .map((stack, index) => (stack.value.length === 0 ? index : -1))
        .filter((index) => index !== -1);

    if (emptyIndexes.length) {
        highlightStacks(emptyIndexes);
        return;
    }

    if (deckHolder.value.length < playStacks.length) {
        return;
    }

    isDealing.value = true;
    captureState();
    try {
        for (let index = 0; index < playStacks.length; index++) {
            dealingIndex.value = index;
            const stack = playStacks[index];
            if (!stack) {
                continue;
            }
            const card = deckHolder.value.shift();
            if (!card) {
                break;
            }
            card.faceUp = true;
            stack.value.push(card);
            flipTopCard(stack);
            await wait(DEAL_DELAY_MS);
        }
    } finally {
        dealingIndex.value = null;
        isDealing.value = false;
    }

    checkCompletedRuns();
}

function dealInitialCards() {
    resetTableau();
    let toDeal = 54;

    [...Array(6)].forEach(() => {
        for (const stack of playStacks) {
            if (toDeal === 0) {
                break;
            }

            const card = deckHolder.value.shift();
            if (card) {
                card.faceUp = false;
                stack.value.push(card);
                toDeal--;
            }
        }
    });
    playStacks.forEach((stack) => flipTopCard(stack));
    deckHolder.value.forEach((card) => {
        card.faceUp = false;
    });
}

function sequenceIsMovable(cards: PlayableCard[]) {
    return canDragSequence(cards);
}

function canPlaceOnTarget(movingCards: PlayableCard[], targetCards: PlayableCard[]) {
    const targetTop = targetCards[targetCards.length - 1];
    return canPlaceSequenceOn(movingCards, targetTop);
}

function flipTopCard(stack: PlayStackRef) {
    const cards = stack.value;
    const top = cards[cards.length - 1];
    if (!top) return;
    top.faceUp = true;
}

function checkCompletedRuns() {
    playStacks.forEach((stack) => {
        while (stack.value.length >= 13) {
            const candidate = stack.value.slice(stack.value.length - 13);
            if (!isCompleteRun(candidate)) {
                break;
            }

            const foundationIndex = findEmptyFoundationIndex();
            if (foundationIndex === -1) {
                break;
            }

            const completedRun = stack.value.splice(stack.value.length - 13);
            solvedStacks.value.splice(foundationIndex, 1, completedRun);
        }

        flipTopCard(stack);
    });

    checkWinCondition();
}

function isCompleteRun(cards: PlayableCard[]) {
    if (cards.length !== 13) return false;
    const first = cards[0];
    const last = cards[cards.length - 1];

    if (!first || !last) return false;

    const baseSuit = first.symbol;

    if (first.rank !== Rank.King || last.rank !== Rank.Ace) {
        return false;
    }

    for (const card of cards) {
        if (!card?.faceUp || card.symbol !== baseSuit) {
            return false;
        }
    }

    for (let i = 0; i < cards.length - 1; i++) {
        const current = cards[i]!;
        const next = cards[i + 1]!;
        if (current.rank !== next.rank + 1) {
            return false;
        }
    }

    return true;
}

function findEmptyFoundationIndex() {
    return solvedStacks.value.findIndex((stack) => stack.length === 0);
}

function checkWinCondition() {
    const allFilled = solvedStacks.value.length === FOUNDATIONS_COUNT &&
        solvedStacks.value.every((stack) => stack.length === 13);
    if (allFilled) {
        showWinModal.value = true;
    }
}

function closeWinModal() {
    showWinModal.value = false;
}

function resetTableau() {
    playStacks.forEach((stack) => stack.value.splice(0, stack.value.length));
    solvedStacks.value = Array.from({ length: FOUNDATIONS_COUNT }, () => []);
    highlightedStacks.value = [];
    showWinModal.value = false;
    if (highlightTimeout) {
        clearTimeout(highlightTimeout);
        highlightTimeout = null;
    }
}

function shuffleDeck(mode: GameMode): PlayableCard[] {
    shuffleNonce += 1;
    const shuffled = buildSpiderDeck(mode).map((card) => ({ ...card, faceUp: false }));
    for (let i = shuffled.length - 1; i > 0; i--) {
        const rand = Math.random();
        const j = Math.floor(rand * (i + shuffleNonce)) % (i + 1);
        const current = shuffled[i];
        const swap = shuffled[j];
        if (!current || !swap) {
            continue;
        }
        shuffled[i] = swap;
        shuffled[j] = current;
    }
    return shuffled;
}

function captureState() {
    const snapshot: GameState = {
        deckHolder: cloneCards(deckHolder.value),
        playStacks: playStacks.map((stack) => cloneCards(stack.value)),
        solvedStacks: solvedStacks.value.map((stack) => cloneCards(stack))
    };
    history.value.push(snapshot);
}

function undoLastAction() {
    if (isDealing.value || history.value.length === 0) {
        return;
    }
    const snapshot = history.value.pop();
    if (!snapshot) return;

    deckHolder.value = cloneCards(snapshot.deckHolder);
    solvedStacks.value = snapshot.solvedStacks.map((stack) => cloneCards(stack));
    playStacks.forEach((stackRef, index) => {
        stackRef.value = snapshot.playStacks[index]
            ? cloneCards(snapshot.playStacks[index])
            : [];
    });

    dealingIndex.value = null;
    highlightedStacks.value = [];
    showWinModal.value = false;
}

function cloneCards(cards: PlayableCard[]) {
    return cards.map((card) => ({ ...card }));
}

function startNewGame() {
    if (isDealing.value) {
        return;
    }
    deckHolder.value = shuffleDeck(gameMode.value);
    history.value = [];
    dealInitialCards();
}
</script>

<template>
    <div class="board">
        <section class="board__top">
            <div class="board__stock">
                <fieldset class="board__mode" :disabled="isDealing">
                    <legend class="board__mode-label">Game</legend>
                    <div class="board__mode-options">
                        <label
                            v-for="option in gameModeOptions"
                            :key="option.value"
                            class="board__mode-option"
                        >
                            <input
                                type="radio"
                                name="game-mode"
                                :value="option.value"
                                v-model="gameMode"
                                :disabled="isDealing"
                            />
                            <span>{{ option.label }}</span>
                        </label>
                    </div>
                </fieldset>
                <div class="board__actions">
                    <button class="board__new-game" type="button" @click="startNewGame" :disabled="isDealing">
                        New Game
                    </button>
                    <button class="board__undo" type="button" @click="undoLastAction" :disabled="isDealing || history.length === 0">
                        Undo
                    </button>
                </div>
                <Deck
                    :cards="deckHolder"
                    :disabled="deckHolder.length < playStacks.length || isDealing"
                    @deal="dealFromStock"
                />
            </div>
            <div class="board__foundations" :style="foundationGridStyle">
                <SolvedStack
                    v-for="(stack, index) in solvedStacks"
                    :key="index"
                    :cards="stack"
                />
            </div>
        </section>

        <section class="board__bottom">
            <PlayStack
                v-for="(stack, index) in playStacks"
                :key="index"
                :stack-index="index"
                :cards="stack.value"
                :highlight="highlightedStacks.includes(index)"
                :is-receiving="dealingIndex === index"
                @card-drop="handleCardDrop"
            />
        </section>

        <transition name="win-fade">
            <div
                v-if="showWinModal"
                class="win-modal"
                role="dialog"
                aria-modal="true"
            >
                <div class="win-modal__content">
                    <h2 class="win-modal__title">You win!</h2>
                    <p class="win-modal__body">Great job clearing all the stacks.</p>
                    <button class="win-modal__button" type="button" @click="closeWinModal">
                        Close
                    </button>
                    <button class="win-modal__button win-modal__button--primary" type="button" @click="startNewGame">
                        New Game
                    </button>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
.board {
    --board-gap: clamp(0.6rem, 1vw, 1.1rem);
    --board-padding-inline: clamp(1.5rem, 5vw, 3.5rem);
    --card-width: clamp(76px, calc((100vw - 2 * var(--board-padding-inline) - 9 * var(--board-gap)) / 10), 144px);
    --card-height: calc(var(--card-width) * 1.4);
    --card-spacing: clamp(22px, calc(var(--card-height) * 0.32), 48px);

    display: flex;
    flex-direction: column;
    gap: clamp(1.5rem, 4vw, 2.5rem);
    padding: 2rem var(--board-padding-inline) 3rem;
    min-height: 100vh;
    background: radial-gradient(circle at top, #1d6933 0%, #134421 45%, #0c2a14 100%);
    color: #fff;
}

.board__top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: clamp(1.5rem, 4vw, 3rem);
    flex-wrap: wrap;
}

.board__stock {
    flex: 0 0 var(--card-width);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.8rem;
}

.board__mode {
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 12px;
    padding: 0.6rem 0.75rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    background: rgba(0, 0, 0, 0.18);
}

.board__mode[disabled] {
    opacity: 0.55;
}

.board__mode-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    opacity: 0.75;
}

.board__mode-options {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.board__mode-option {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    cursor: pointer;
}

.board__mode-option input[type='radio'] {
    accent-color: #b5f9cf;
    cursor: pointer;
}

.board__actions {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
}

.board__new-game {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    border: 2px solid rgba(255, 255, 255, 0.3);
    padding: 0.45rem 1rem;
    border-radius: 999px;
    font-size: 0.9rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.board__new-game:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 14px rgba(0, 0, 0, 0.35);
    background: rgba(255, 255, 255, 0.22);
}

.board__new-game:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
    background: rgba(255, 255, 255, 0.12);
}

.board__undo {
    background: rgba(181, 249, 207, 0.15);
    color: #b5f9cf;
    border: 2px solid rgba(181, 249, 207, 0.35);
    padding: 0.45rem 1rem;
    border-radius: 999px;
    font-size: 0.9rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.board__undo:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 14px rgba(0, 0, 0, 0.35);
    background: rgba(181, 249, 207, 0.28);
}

.board__undo:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
    background: rgba(181, 249, 207, 0.12);
}

.board__foundations {
    flex: 1 1 auto;
    display: grid;
    grid-template-columns: repeat(8, var(--card-width));
    justify-content: flex-end;
    gap: var(--board-gap);
    min-width: min(100%, calc(8 * var(--card-width) + 7 * var(--board-gap)));
    overflow-x: auto;
    padding-bottom: 0.4rem;
}

.board__bottom {
    display: grid;
    grid-template-columns: repeat(10, var(--card-width));
    justify-content: center;
    gap: var(--board-gap);
    width: 100%;
    overflow-x: auto;
    padding-bottom: 0.6rem;
}

@media (max-width: 960px) {
    .board__top {
        justify-content: center;
    }
}

.win-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 25;
    backdrop-filter: blur(2px);
}

.win-modal__content {
    background: rgba(26, 69, 39, 0.95);
    padding: 2.5rem 3rem;
    border-radius: 18px;
    box-shadow: 0 18px 30px rgba(0, 0, 0, 0.55);
    text-align: center;
    color: #fff;
    max-width: 360px;
    width: 85%;
}

.win-modal__title {
    font-size: 2rem;
    margin-bottom: 0.75rem;
    letter-spacing: 0.08em;
}

.win-modal__body {
    font-size: 1rem;
    margin-bottom: 1.5rem;
    opacity: 0.9;
}

.win-modal__button {
    background: #b5f9cf;
    color: #10341c;
    border: none;
    padding: 0.65rem 1.4rem;
    font-size: 1rem;
    border-radius: 999px;
    cursor: pointer;
    font-weight: 600;
    letter-spacing: 0.06em;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.win-modal__button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 14px rgba(0, 0, 0, 0.35);
}

.win-modal__button--primary {
    margin-left: 0.8rem;
}

.win-fade-enter-active,
.win-fade-leave-active {
    transition: opacity 0.25s ease;
}

.win-fade-enter-from,
.win-fade-leave-to {
    opacity: 0;
}
</style>
.board__new-game {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    border: 2px solid rgba(255, 255, 255, 0.3);
    padding: 0.45rem 1rem;
    border-radius: 999px;
    font-size: 0.9rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.board__new-game:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 14px rgba(0, 0, 0, 0.35);
    background: rgba(255, 255, 255, 0.22);
}

.board__new-game:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
    background: rgba(255, 255, 255, 0.12);
}
