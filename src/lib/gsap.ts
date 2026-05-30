import gsap from 'gsap'

// Page transition: crossfade with subtle slide
export function pageEnter(el: HTMLElement, direction: 'left' | 'right' = 'right') {
  const x = direction === 'right' ? 24 : -24
  gsap.fromTo(el,
    { opacity: 0, x, display: 'flex' },
    { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out', clearProps: 'transform' }
  )
}

export function pageExit(el: HTMLElement, direction: 'left' | 'right' = 'left') {
  const x = direction === 'right' ? -24 : 24
  return gsap.to(el, {
    opacity: 0, x, duration: 0.2, ease: 'power2.in',
    onComplete: () => { el.style.display = 'none' },
    clearProps: 'transform,opacity',
  })
}

// Message entrance animation
export function animateMessage(el: HTMLElement, role: 'user' | 'assistant') {
  const x = role === 'user' ? 20 : -20
  gsap.fromTo(el,
    { opacity: 0, x, y: 8 },
    { opacity: 1, x: 0, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'transform' }
  )
}

// Modal/panel entrance
export function modalEnter(overlay: HTMLElement, content: HTMLElement) {
  gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' })
  gsap.fromTo(content,
    { opacity: 0, scale: 0.95, y: 8 },
    { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'back.out(1.5)', clearProps: 'transform' }
  )
}

export function modalExit(overlay: HTMLElement, content: HTMLElement, onComplete?: () => void) {
  gsap.to(overlay, { opacity: 0, duration: 0.15, ease: 'power2.in' })
  gsap.to(content, {
    opacity: 0, scale: 0.97, duration: 0.15, ease: 'power2.in',
    onComplete,
    clearProps: 'transform,opacity',
  })
}

// Context menu / dropdown entrance
export function menuEnter(el: HTMLElement) {
  gsap.fromTo(el,
    { opacity: 0, scale: 0.92, y: -4 },
    { opacity: 1, scale: 1, y: 0, duration: 0.18, ease: 'back.out(2)', clearProps: 'transform' }
  )
}

// Toast slide in/out
export function toastEnter(el: HTMLElement) {
  gsap.fromTo(el,
    { opacity: 0, x: 60, scale: 0.95 },
    { opacity: 1, x: 0, scale: 1, duration: 0.35, ease: 'back.out(1.5)', clearProps: 'transform' }
  )
}

export function toastExit(el: HTMLElement, onComplete?: () => void) {
  gsap.to(el, {
    opacity: 0, x: 40, duration: 0.25, ease: 'power2.in',
    onComplete,
    clearProps: 'transform,opacity',
  })
}

// Staggered list entrance (for cards, nav items)
export function staggerIn(elements: HTMLElement[], opts?: { delay?: number; stagger?: number; y?: number }) {
  gsap.fromTo(elements,
    { opacity: 0, y: opts?.y ?? 12 },
    { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', stagger: opts?.stagger ?? 0.06, delay: opts?.delay ?? 0, clearProps: 'transform' }
  )
}

// Chart content crossfade
export function chartTransition(outEl: HTMLElement | null, inEl: HTMLElement) {
  if (outEl) {
    gsap.to(outEl, { opacity: 0, duration: 0.15, ease: 'power2.in' })
  }
  gsap.fromTo(inEl,
    { opacity: 0, y: 6 },
    { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out', delay: outEl ? 0.1 : 0, clearProps: 'transform' }
  )
}

// Timeline pill entrance
export function timelinePillEnter(el: HTMLElement) {
  gsap.fromTo(el,
    { opacity: 0, x: -12, scale: 0.9 },
    { opacity: 1, x: 0, scale: 1, duration: 0.3, ease: 'back.out(1.5)', clearProps: 'transform' }
  )
}

// Sidebar collapse enhancement — animate labels staggered
export function sidebarCollapse(labels: HTMLElement[], collapsing: boolean) {
  gsap.to(labels, {
    opacity: collapsing ? 0 : 1,
    width: collapsing ? 0 : 'auto',
    duration: 0.2,
    ease: 'power2.inOut',
    stagger: collapsing ? 0.02 : 0.03,
    overflow: 'hidden',
  })
}

export { gsap }
