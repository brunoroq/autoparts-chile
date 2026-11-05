"use client";
import Image from "next/image";
import { useState } from "react";

export function ProductImage({
  src,
  alt,
  detail = false,
}: {
  src: string;
  alt: string;
  detail?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={failed ? "/images/products/fallback.webp" : src}
      alt={failed ? "Ilustración referencial de accesorio automotriz" : alt}
      width={800}
      height={800}
      sizes={
        detail
          ? "(max-width: 760px) 100vw, 50vw"
          : "(max-width: 500px) 90vw, (max-width: 1000px) 45vw, 25vw"
      }
      onError={() => setFailed(true)}
    />
  );
}
