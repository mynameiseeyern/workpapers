import { useEffect, useRef } from "react";

/**
 * Gives back an entrance class (from motion.css) only once the screen has been shown, so things animate when they
 * change in front of you and never just because a page opened.
 */
export function useSwapClass(cls = "enter-fade"): string {
  const shown = useRef(false);
  useEffect(() => { shown.current = true; }, []);
  return shown.current ? cls : "";
}
