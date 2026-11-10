import { useEffect, type RefObject } from "react";

export function useRouteReveal(root: RefObject<HTMLElement | null>, pathname: string) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let animation: Animation | undefined;
    const frame = requestAnimationFrame(() => {
      const content = root.current?.querySelector("main");
      animation = content?.animate(
        [{ opacity: 0.65, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    });
    return () => { cancelAnimationFrame(frame); animation?.cancel(); };
  }, [root, pathname]);
}
