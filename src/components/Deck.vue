<script setup lang="ts">
import { computed, type PropType } from 'vue';
import type { Card } from '@/cards';
import cardBack from '../assets/cards/Back.svg';

type PlayableCard = Card & { faceUp?: boolean };

const props = defineProps({
    cards: {
        type: Array as PropType<PlayableCard[]>,
        default: () => []
    },
    disabled: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits<{
    (e: 'deal'): void
}>();

const stackLayers = computed(() =>
    Array.from({ length: Math.min(props.cards.length, 4) }, (_, index) => index)
)

const empty = computed(() => stackLayers.value.length === 0)
const isDisabled = computed(() => props.disabled || empty.value)

function onClick() {
    if (isDisabled.value) {
        return;
    }
    emit('deal');
}
</script>

<template>
    <div
        class="deck"
        :class="{
            'deck--empty': empty,
            'deck--disabled': isDisabled
        }"
        aria-label="Stock pile"
        role="button"
        :tabindex="isDisabled ? -1 : 0"
        @click="onClick"
        @keydown.space.prevent.stop="onClick"
        @keydown.enter.prevent.stop="onClick"
    >
        <div class="deck__pile">
            <img
                v-for="layer in stackLayers"
                :key="layer"
                :src="cardBack"
                alt=""
                class="deck__card"
                :style="{ transform: `translate(${layer * 3}px, -${layer * 2}px)` }"
            />
        </div>
        <span class="deck__count">{{ props.cards.length }}</span>
    </div>
</template>

<style scoped>
.deck {
    width: var(--card-width);
    height: var(--card-height);
    position: relative;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.12);
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.2);
    cursor: pointer;
    user-select: none;
    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.deck:hover {
    transform: translateY(-4px);
    box-shadow:
        inset 0 0 0 2px rgba(255, 255, 255, 0.25),
        0 12px 16px rgba(0, 0, 0, 0.45);
}

.deck--empty {
    background: rgba(0, 0, 0, 0.15);
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.08);
}

.deck--disabled {
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.08);
}

.deck__pile {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 8px;
    overflow: visible;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}

.deck__card {
    position: absolute;
    bottom: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.5));
}

.deck__count {
    position: absolute;
    bottom: -1.6rem;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.75;
}
</style>
