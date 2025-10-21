<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type PropType, watch } from 'vue';
import cardBack from '../assets/cards/Back.svg';
import type { PlayableCard } from '@/playable-card';
import { canDragSequence } from '@/rules';

const props = defineProps({
    cards: {
        type: Array as PropType<PlayableCard[]>,
        default: () => []
    },
    stackIndex: {
        type: Number,
        required: true
    },
    highlight: {
        type: Boolean,
        default: false
    },
    isReceiving: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits<{
    (e: 'card-drop', payload: { sourceIndex: number; targetIndex: number; startIndex: number; count: number }): void
}>();

const isDragOver = ref(false);
const dragStartIndex = ref<number | null>(null);
interface DragPreview {
    element: HTMLElement;
    offsetX: number;
    offsetY: number;
}

const dragPreview = ref<DragPreview | null>(null);
const isDragging = ref(false);
const blankDragImage = new Image();
blankDragImage.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2NkYGD4DwABBAEAHNWV2wAAAABJRU5ErkJggg==';

const draggingFromHere = computed(() => dragStartIndex.value !== null);

watch(() => props.cards, () => {
    console.log("PlayStack: cards changed")
    props.cards?.forEach((card) => {
        if (!card) return;
        console.log("dealt card is: " + card.rank + " " + card.symbol + " faceUp:" + card.faceUp)
    })
}, { deep: true })

function isCardDraggable(cardIndex: number) {
    if (!props.cards.length) return false;
    if (cardIndex < 0 || cardIndex >= props.cards.length) return false;

    const slice = props.cards.slice(cardIndex);
    return canDragSequence(slice);
}

function isCardBeingDragged(index: number) {
    if (!isDragging.value) return false;
    const start = dragStartIndex.value;
    if (start === null) return false;
    return index >= start;
}

function onDragStart(event: DragEvent, startIndex: number) {
    if (!event.dataTransfer || !isCardDraggable(startIndex) || isDragging.value) {
        event.preventDefault();
        return;
    }

    const count = props.cards.length - startIndex;

    dragStartIndex.value = startIndex;
    event.dataTransfer.effectAllowed = 'move';
    const payload = JSON.stringify({
        sourceIndex: props.stackIndex,
        startIndex,
        count
    });
    event.dataTransfer.setData('application/json', payload);
    event.dataTransfer.setData('text/plain', payload);

    const element = event.currentTarget as HTMLElement | null;
    const preview = element ? createDragPreview(startIndex, element, event) : null;
    if (preview) {
        dragPreview.value = preview;
        positionPreview(preview, event.clientX, event.clientY);
        window.addEventListener('dragover', handleGlobalDragOver, true);
    }

    event.dataTransfer.setDragImage(blankDragImage, 0, 0);
    requestAnimationFrame(() => {
        isDragging.value = true;
    });
}

function onDragEnd() {
    dragStartIndex.value = null;
    cleanupDragPreview();
    isDragging.value = false;
}

function acceptsPayload(event: DragEvent) {
    return Boolean(event.dataTransfer?.types.includes('application/json') || event.dataTransfer?.types.includes('text/plain'));
}

function onDragEnter(event: DragEvent) {
    if (!acceptsPayload(event)) return;
    event.preventDefault();
    isDragOver.value = true;
}

function onDragOver(event: DragEvent) {
    if (!acceptsPayload(event) || !event.dataTransfer) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    isDragOver.value = true;
}

function onDragLeave(event: DragEvent) {
    const currentTarget = event.currentTarget as HTMLElement | null;
    const related = event.relatedTarget as Node | null;
    if (currentTarget && related && currentTarget.contains(related)) {
        return;
    }
    isDragOver.value = false;
}

function onDrop(event: DragEvent) {
    if (!event.dataTransfer) return;
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
    isDragOver.value = false;
    dragStartIndex.value = null;
    cleanupDragPreview();
    isDragging.value = false;

    if (!raw) return;
    try {
        const { sourceIndex, startIndex, count } = JSON.parse(raw) as { sourceIndex: number; startIndex: number; count: number };
        if (
            typeof sourceIndex === 'number' &&
            typeof startIndex === 'number' &&
            typeof count === 'number'
        ) {
            emit('card-drop', {
                sourceIndex,
                targetIndex: props.stackIndex,
                startIndex,
                count
            });
        }
    } catch (error) {
        console.warn('PlayStack: unable to parse drop payload', error);
    }
}

onBeforeUnmount(() => {
    cleanupDragPreview();
});

function createDragPreview(startIndex: number, sourceElement: HTMLElement, startEvent: DragEvent): DragPreview | null {
    cleanupDragPreview();
    const sequence = props.cards.slice(startIndex);
    if (!sequence.length) return null;

    const cardRect = sourceElement.getBoundingClientRect();
    const spacing = getCardSpacing(sourceElement);

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.pointerEvents = 'none';
    container.style.width = `${cardRect.width}px`;
    container.style.height = `${cardRect.height + (sequence.length - 1) * spacing}px`;
    container.style.zIndex = '9999';

    sequence.forEach((card, index) => {
        const img = new Image();
        img.src = card.faceUp ? card.front : cardBack;
        img.style.position = 'absolute';
        img.style.top = `${index * spacing}px`;
        img.style.left = '0';
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.boxShadow = '0 8px 14px rgba(0,0,0,0.4)';
        container.appendChild(img);
    });

    document.body.appendChild(container);
    return {
        element: container,
        offsetX: startEvent.clientX - cardRect.left,
        offsetY: startEvent.clientY - cardRect.top
    };
}

function cleanupDragPreview() {
    if (dragPreview.value) {
        dragPreview.value.element.remove();
        dragPreview.value = null;
    }
    window.removeEventListener('dragover', handleGlobalDragOver, true);
}

function getCardSpacing(cardElement: HTMLElement): number {
    const next = cardElement.nextElementSibling as HTMLElement | null;
    if (next) {
        const offset = next.getBoundingClientRect().top - cardElement.getBoundingClientRect().top;
        if (Math.abs(offset) > 0) {
            return Math.abs(offset);
        }
    }

    const style = window.getComputedStyle(cardElement);
    const marginTop = parseFloat(style.marginTop);
    if (!Number.isNaN(marginTop) && marginTop < 0) {
        return Math.abs(marginTop);
    }

    const cssVariable = parseFloat(style.getPropertyValue('--card-spacing'));
    if (!Number.isNaN(cssVariable) && cssVariable > 0) {
        return cssVariable;
    }
    const height = cardElement.getBoundingClientRect().height;
    return Math.max(18, height * 0.3);
}

function handleGlobalDragOver(event: DragEvent) {
    if (!dragPreview.value) return;
    positionPreview(dragPreview.value, event.clientX, event.clientY);
}

function positionPreview(preview: DragPreview, clientX: number, clientY: number) {
    preview.element.style.transform = `translate(${clientX - preview.offsetX}px, ${clientY - preview.offsetY}px)`;
}
</script>

<template>
    <div
        class="play-stack"
        :class="{
            'play-stack--over': isDragOver,
            'play-stack--dragging': draggingFromHere,
            'play-stack--highlight': props.highlight,
            'play-stack--dealing': props.isReceiving
        }"
        @dragenter="onDragEnter"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
    >
        <div
            v-if="props.cards.length === 0"
            class="play-stack__empty"
        />
        <template v-for="(card, index) in props.cards" :key="`${card.symbol}-${card.rank}-${index}`">
            <div
                class="play-stack__card"
                :class="{
                    'play-stack__card--faceup': card.faceUp,
                    'play-stack__card--selected': dragStartIndex !== null && index >= dragStartIndex,
                    'play-stack__card--draggable': isCardDraggable(index),
                    'play-stack__card--hidden': isCardBeingDragged(index)
                }"
                :draggable="isCardDraggable(index) && !isDragging"
                @dragstart="onDragStart($event, index)"
                @dragend="onDragEnd"
            >
                <img
                    :src="card.faceUp ? card.front : cardBack"
                    alt=""
                    loading="lazy"
                />
            </div>
        </template>
    </div>
</template>

<style scoped>
.play-stack {
    position: relative;
    width: var(--card-width);
    min-height: var(--card-height);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 0.1rem;
}

.play-stack--over {
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35);
}

.play-stack--highlight {
    box-shadow: 0 0 0 3px rgba(255, 116, 116, 0.75);
    animation: pulse 0.6s ease-in-out 0s 2 alternate;
}

.play-stack--dragging .play-stack__card--faceup {
    transform: translateY(-4px);
}

.play-stack__empty {
    width: 100%;
    height: var(--card-height);
    border-radius: 8px;
    border: 2px dashed rgba(255, 255, 255, 0.18);
    background: rgba(0, 0, 0, 0.12);
}

.play-stack--dealing {
    box-shadow: 0 0 0 3px rgba(181, 249, 207, 0.55);
    animation: deal-pop 0.32s ease-out;
}

.play-stack--dealing .play-stack__card:last-of-type {
    animation: card-pop 0.32s ease-out;
}

.play-stack__card {
    width: 100%;
    aspect-ratio: 5 / 7;
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease, opacity 0.2s ease;
    filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.5));
    background: rgba(0, 0, 0, 0.18);
    cursor: default;
}

.play-stack__card--hidden {
    opacity: 0;
    pointer-events: none;
}

.play-stack__card + .play-stack__card {
    margin-top: calc(-1 * (var(--card-height) - var(--card-spacing)));
}

.play-stack__card img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 8px;
}

.play-stack__card--faceup {
    filter: drop-shadow(0 10px 14px rgba(0, 0, 0, 0.6));
}

.play-stack__card--draggable {
    cursor: grab;
}

.play-stack__card--draggable:active {
    cursor: grabbing;
}

.play-stack__card--faceup img {
    transform: translateZ(0);
}

.play-stack__card--selected {
    box-shadow: 0 0 0 3px rgba(181, 249, 207, 0.45);
}

@keyframes pulse {
    from {
        transform: translateY(0);
    }
    to {
        transform: translateY(-6px);
    }
}

@keyframes deal-pop {
    from {
        transform: translateY(-8px);
    }
    to {
        transform: translateY(0);
    }
}

@keyframes card-pop {
    from {
        transform: translateY(-12px);
    }
    to {
        transform: translateY(0);
    }
}

@media (max-width: 960px) {
    .play-stack {
        width: clamp(64px, var(--card-width), 120px);
    }
}
</style>
    isDragging.value = true;
