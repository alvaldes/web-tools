import { useState, useEffect, useRef } from "preact/hooks";

const ImageWithSkeleton = ({ src, alt, className, ...props }: any) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (imgRef?.current?.complete) {
      if (imgRef?.current?.naturalWidth) {
        setIsLoaded(true);
      }
    }
  }, [src]);

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  const handleImageError = () => {
    console.error("Error loading image", src);
  };

  return (
    <>
      {!isLoaded && (
        <div className={`animate-pulse bg-gray-200 ${className}`}></div>
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
