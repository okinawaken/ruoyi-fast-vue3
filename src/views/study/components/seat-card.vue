<template>
  <button
    type="button"
    class="seat-card"
    :class="[`is-${display.state}`, { 'is-selected': selected }]"
    :disabled="!display.selectable || disabled"
    :aria-pressed="selected ? 'true' : 'false'"
    :aria-label="ariaLabel"
    @click="handleClick"
  >
    <span class="seat-no">{{ seat.seatNumber || '未命名座位' }}</span>
    <span class="seat-status">
      <i class="seat-dot" aria-hidden="true"></i>
      <span class="seat-status-text">{{ display.description }}</span>
    </span>
    <el-icon v-if="selected" class="seat-check"><Check /></el-icon>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  seat: { type: Object, required: true },
  display: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])

const ariaLabel = computed(() => {
  const name = props.seat.seatNumber || '座位'
  const description = props.display?.description || ''
  return `${name}，${description}${props.selected ? '，已选' : ''}`
})

function handleClick() {
  if (props.disabled || !props.display?.selectable) {
    return
  }
  emit('select', props.seat)
}
</script>

<style lang="scss" scoped>
.seat-card {
  position: relative;
  display: block;
  min-width: 0;
  min-height: 64px;
  padding: 8px 10px 7px;
  border: 1px solid #d9d2c2;
  border-radius: 10px;
  background: var(--sr-card, #fffdf8);
  color: var(--sr-ink, #1b2a24);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s, background 0.15s;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: #b9c6ba;
    box-shadow: 0 4px 12px rgba(27, 42, 36, 0.09);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    cursor: not-allowed;
  }

  &.is-partial {
    border-color: var(--sr-amber-line, #e7c98f);
    background: var(--sr-amber-soft, #fbf0dc);

    .seat-status {
      color: var(--sr-amber, #8a5a12);
    }
  }

  &.is-locked {
    border-style: dashed;
    background: var(--sr-card-2, #fbf8ef);

    .seat-status {
      color: var(--sr-muted-2, #75827a);
    }
  }

  &.is-unavailable {
    border-color: #ddd7c9;
    background: var(--sr-paper-2, #efe9db);
    color: var(--sr-muted-2, #75827a);

    .seat-no,
    .seat-status {
      color: var(--sr-muted-2, #75827a);
    }
  }

  &.is-selected {
    border-color: var(--sr-green, #24513f);
    background: var(--sr-green, #24513f);
    color: var(--sr-paper, #f7f3e9);
    box-shadow: 0 0 0 3px var(--sr-green-soft, #e4ede6);

    .seat-status {
      color: #cfe0d5;
    }

    .seat-dot {
      background: #a8d3ba;
    }
  }
}

.seat-no {
  display: block;
  padding-right: 14px;
  overflow: hidden;
  font-family: var(--sr-font-mono, ui-monospace, monospace);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.seat-status {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin-top: 5px;
  color: var(--sr-green-ink, #315a47);
  font-size: 10px;
  line-height: 1.4;
  white-space: nowrap;
}

.seat-status-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.seat-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}

.is-unavailable .seat-dot,
.is-locked .seat-dot {
  background: #b8b1a2;
}

.seat-check {
  position: absolute;
  top: 7px;
  right: 7px;
  font-size: 13px;
}

@media (prefers-reduced-motion: reduce) {
  .seat-card {
    transition: none;

    &:hover:not(:disabled) {
      transform: none;
    }
  }
}
</style>
