export enum Symbol {
    Club,
    Diamond,
    Heart,
    Spade
}

export enum Rank {
    Ace = 1,
    Two,
    Three,
    Four,
    Five,
    Six,
    Seven,
    Eight,
    Nine,
    Ten,
    Jack,
    Queen,
    King
}

export interface Card {
    symbol: Symbol;
    rank: Rank;
    front: string;
}

export type GameMode = 'one-suit' | 'two-suit' | 'four-suit';

export const DEFAULT_GAME_MODE: GameMode = 'two-suit';

const RANK_ASSET_PREFIX: Record<Rank, string> = {
    [Rank.Ace]: 'A',
    [Rank.Two]: '2',
    [Rank.Three]: '3',
    [Rank.Four]: '4',
    [Rank.Five]: '5',
    [Rank.Six]: '6',
    [Rank.Seven]: '7',
    [Rank.Eight]: '8',
    [Rank.Nine]: '9',
    [Rank.Ten]: '10',
    [Rank.Jack]: 'J',
    [Rank.Queen]: 'Q',
    [Rank.King]: 'K'
};

const SUIT_ASSET_SUFFIX: Record<Symbol, string> = {
    [Symbol.Club]: 'Clubs',
    [Symbol.Diamond]: 'Diamonds',
    [Symbol.Heart]: 'Hearts',
    [Symbol.Spade]: 'Spades'
};

const SUIT_ORDER: Symbol[] = [
    Symbol.Club,
    Symbol.Diamond,
    Symbol.Heart,
    Symbol.Spade
];

const BASE_SUIT_DECKS: Record<Symbol, Card[]> = {
    [Symbol.Club]: createSuitDeck(Symbol.Club),
    [Symbol.Diamond]: createSuitDeck(Symbol.Diamond),
    [Symbol.Heart]: createSuitDeck(Symbol.Heart),
    [Symbol.Spade]: createSuitDeck(Symbol.Spade)
};

const SPIDER_VARIANTS: Record<GameMode, { suits: Symbol[]; copies: number }> = {
    'one-suit': {
        suits: [Symbol.Club],
        copies: 8
    },
    'two-suit': {
        suits: [Symbol.Club, Symbol.Heart],
        copies: 4
    },
    'four-suit': {
        suits: SUIT_ORDER,
        copies: 2
    }
};

export function buildSpiderDeck(mode: GameMode = DEFAULT_GAME_MODE): Card[] {
    const variant = SPIDER_VARIANTS[mode];
    if (!variant) {
        throw new Error(`Unsupported spider solitaire mode: ${mode}`);
    }

    const deck: Card[] = [];
    variant.suits.forEach((symbol) => {
        const template = BASE_SUIT_DECKS[symbol];
        for (let copy = 0; copy < variant.copies; copy++) {
            deck.push(...cloneCards(template));
        }
    });

    return deck;
}

function createSuitDeck(symbol: Symbol): Card[] {
    const suffix = SUIT_ASSET_SUFFIX[symbol];
    return Object.values(Rank).filter(isNumber).map((rankValue) => {
        const rank = rankValue as Rank;
        return {
            symbol,
            rank,
            front: `src/assets/cards/${RANK_ASSET_PREFIX[rank]}-${suffix}.svg`
        };
    });
}

function cloneCards(cards: Card[]) {
    return cards.map((card) => ({ ...card }));
}

function isNumber(value: string | number): value is number {
    return typeof value === 'number';
}
