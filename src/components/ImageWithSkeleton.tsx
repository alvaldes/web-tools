import { useState, useEffect, useRef } from "preact/hooks";

const ImageWithSkeleton = ({ src, alt, className, ...props }: any) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (imgRef?.current?.complete) {
      if (imgRef?.current?.naturalWidth) {
        setIsLoaded(true);
      } else {
        setHasError(true);
      }
    }
  }, [src]);

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  const handleImageError = () => {
    setHasError(true);
  };

  if (hasError) {
    return (
      <div
        className={`bg-muted flex items-center justify-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <svg
          className="h-8 w-8 text-muted-foreground/30"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
          />
        </svg>
      </div>
    );
  }

  return (
    <>
      {!isLoaded && (
        <div className={`animate-pulse bg-muted ${className}`}></div>
      )}
      <img
        ref={imgRef}
        className={`${className} ${isLoaded ? "block" : "hidden"}`}
        src={src}
        alt={alt}
        onLoad={handleImageLoad}
        onError={handleImageError}
        {...props}
      />
    </>
  );
};

export default ImageWithSkeleton;
