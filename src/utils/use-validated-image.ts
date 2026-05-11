"use client";

import { useEffect, useState } from "react";

const validateImage = (src: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!src) return resolve(false);

    const img = new Image();
    img.src = src;

    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
  });
};

export const useValidatedImage = (
  baseSrc?: string | null,
  fallback: string = "UserPhotoPlaceholder.webp",
  version?: string | number, // optional cache-buster
): string => {
  // Generate a stable URL using version if provided
  const src = baseSrc
    ? `${baseSrc}${version ? `?v=${version}` : ""}`
    : undefined;
  const [resolvedSrc, setResolvedSrc] = useState<string>(fallback);

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      if (!src) {
        setResolvedSrc(fallback);
        return;
      }

      const isValid = await validateImage(src);
      if (isMounted) {
        setResolvedSrc(isValid ? src : fallback);
      }
    };

    check();

    return () => {
      isMounted = false;
    };
  }, [src, fallback]);

  return resolvedSrc;
};
