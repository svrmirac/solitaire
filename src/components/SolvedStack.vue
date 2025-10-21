<script setup lang="ts">
import { computed, type PropType } from 'vue';
import type { Card } from '@/cards';

type PlayableCard = Card & { faceUp?: boolean };

const props = defineProps({
    cards: {
        type: Array as PropType<PlayableCard[]>,
        default: () => []
    }
});

const topCard = computed(() => props.cards[props.cards.length - 1] ?? null);
</script>

<template>
    <div class="solved-stack" aria-label="Foundation slot">
        <img
            v-if="topCard"
            :src="topCard.front"
            alt=""
            class="solved-stack__card"
            loading="lazy"
        />
        <div v-else class="solved-stack__placeholder">
            <span class="solved-stack__icon">♠</span>
        </div>
        <span
            v-if="props.cards.length"
            class="solved-stack__count"
        >
            {{ props.cards.length }}
        </span>
    </div>
</template>

<style scoped>
.solved-stack {
    width: var(--card-width);
    height: var(--card-height);
    border-radius: 8px;
    position: relative;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.18);
    box-shadow:
        inset 0 0 0 2px rgba(255, 255, 255, 0.18),
        inset 0 0 12px rgba(0, 0, 0, 0.35);
    transition: transform 0.2s ease;
    overflow: hidden;
}

.solved-stack__card {
    width: calc(var(--card-width) - 8px);
    height: calc(var(--card-height) - 8px);
    border-radius: 6px;
    object-fit: contain;
    box-shadow: 0 10px 14px rgba(0, 0, 0, 0.55);
}

.solved-stack__placeholder {
    width: calc(var(--card-width) - 12px);
    height: calc(var(--card-height) - 12px);
    border-radius: 6px;
    border: 2px dashed rgba(255, 255, 255, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.6);
    font-size: 1.35rem;
    letter-spacing: 0.12em;
}

.solved-stack__count {
    position: absolute;
    bottom: -1.4rem;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    opacity: 0.75;
    text-transform: uppercase;
}

.solved-stack:hover {
    transform: translateY(-4px);
}
</style>
