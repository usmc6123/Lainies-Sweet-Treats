import React, { useState, useEffect } from "react";
import { DEFAULT_FALLBACK_IMAGE, isValidProductImageUrl } from "../utils/productUtils";

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  className,
  style,
  onClick,
  onLoad,
}) => {
  const [imgSrc, setImgSrc] = useState<string>(DEFAULT_FALLBACK_IMAGE);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    if (isValidProductImageUrl(src)) {
      setImgSrc(src!);
    } else {
      setImgSrc(DEFAULT_FALLBACK_IMAGE);
    }
  }, [src]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(DEFAULT_FALLBACK_IMAGE);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      style={style}
      onError={handleError}
      onClick={onClick}
      onLoad={onLoad}
      referrerPolicy="no-referrer"
    />
  );
};
