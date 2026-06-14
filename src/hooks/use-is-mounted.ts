"use client";

import { useLayoutEffect, useRef } from "react";

/** Returns a ref that is true only while the component is mounted. */
export function useIsMounted() {
  const mounted = useRef(false);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return mounted;
}
