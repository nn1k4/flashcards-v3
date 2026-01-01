import { z } from 'zod';

export const ZHotkeyAction = z.enum(['next', 'prev', 'flip', 'hide']);
export type HotkeyAction = z.infer<typeof ZHotkeyAction>;

export const ZFlashcardsConfig = z.object({
  contexts: z.object({ default: z.number().int().positive(), max: z.number().int().positive() }),
  fontFamily: z.string().min(1),
  visibilityPolicy: z.enum(['all-visible', 'reveal-on-peek']).default('all-visible'),
  hotkeys: z.record(z.string(), ZHotkeyAction).default({
    ArrowRight: 'next',
    ArrowLeft: 'prev',
    ' ': 'flip',
    ArrowUp: 'flip',
    ArrowDown: 'flip',
    h: 'hide',
  }),
  animation: z
    .object({
      duration: z.number().int().positive().default(500),
      easing: z.string().default('ease'),
    })
    .default({ duration: 500, easing: 'ease' }),
});
export type FlashcardsConfig = z.infer<typeof ZFlashcardsConfig>;
