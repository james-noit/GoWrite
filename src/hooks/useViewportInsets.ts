import { useEffect } from 'react'

// Below this, a height change is almost certainly the mobile browser's URL bar
// collapsing/expanding, not the on-screen keyboard opening.
const KEYBOARD_THRESHOLD_PX = 150

/**
 * Exposes the on-screen keyboard's height as `--kb-inset` on the root element, using the
 * visualViewport API. Fixed-position UI (like the mobile formatting sheet) can add this to its
 * bottom offset so it sits above the keyboard instead of behind it — the viewport meta tag alone
 * can't do this on iOS, which never resizes the layout viewport for the keyboard.
 */
export function useViewportInsets() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    let frame = 0
    const update = () => {
      frame = 0
      const layoutHeight = window.innerHeight
      const overlap = layoutHeight - (vv.height + vv.offsetTop)
      const inset = overlap > KEYBOARD_THRESHOLD_PX ? overlap : 0
      document.documentElement.style.setProperty('--kb-inset', `${inset}px`)
    }
    const onChange = () => {
      if (frame) return
      frame = requestAnimationFrame(update)
    }

    update()
    vv.addEventListener('resize', onChange)
    vv.addEventListener('scroll', onChange)
    return () => {
      vv.removeEventListener('resize', onChange)
      vv.removeEventListener('scroll', onChange)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
}
