import { useState } from "preact/hooks";

const ImageWithSkeleton = ({ src, alt, className, ...props }: any) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <>
      {!isLoaded && (
        <div className={`animate-pulse bg-gray-200 ${className}`}></div>
      )}
      <img
        className={`${className} ${isLoaded ? "block" : "hidden"}`}
        src={src}
        alt={`${alt}`}
        onLoad={() => setIsLoaded(true)}
      />
    </>
  );
};

export default ImageWithSkeleton;
