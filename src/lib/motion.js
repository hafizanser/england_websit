// Shared Framer Motion presets — spring physics, no linear easing.
export const spring = { type: 'spring', stiffness: 110, damping: 18 }

export const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { ...spring } },
}

export const stagger = (delay = 0.08) => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: 0.04 } },
})

export const viewportOnce = { once: true, amount: 0.2 }
