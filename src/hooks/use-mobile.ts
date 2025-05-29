import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

export function useIsMobileDevice() {
  const [isMobileDevice, setIsMobileDevice] = React.useState<boolean>(false)

  React.useEffect(() => {
    // Check if we're in browser environment
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      setIsMobileDevice(/iPad|iPhone|iPod|Android|Opera Mini/i.test(navigator.userAgent))
    }
  }, [])

  return isMobileDevice
}