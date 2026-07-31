import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

type Props = {
  imageUrl: string;
  aspectW: number;
  aspectH: number;
  onPixelCropChange: (crop: PixelCrop | null, image: HTMLImageElement | null) => void;
};

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

/** Interactive drag/resize crop with locked Instagram aspect ratio. */
export function DragCropFrame({ imageUrl, aspectW, aspectH, onPixelCropChange }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completed, setCompleted] = useState<PixelCrop>();
  const aspect = aspectW / aspectH;

  useEffect(() => {
    setCrop(undefined);
    setCompleted(undefined);
    onPixelCropChange(null, null);
  }, [imageUrl, aspectW, aspectH, onPixelCropChange]);

  const onImageLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      imgRef.current = img;
      const next = centerAspectCrop(img.width, img.height, aspect);
      setCrop(next);
    },
    [aspect],
  );

  useEffect(() => {
    if (completed && imgRef.current) {
      onPixelCropChange(completed, imgRef.current);
    }
  }, [completed, onPixelCropChange]);

  // When aspect changes after image already loaded, re-center crop
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.width) return;
    const next = centerAspectCrop(img.width, img.height, aspect);
    setCrop(next);
  }, [aspect]);

  return (
    <div className="drag-crop">
      <ReactCrop
        crop={crop}
        onChange={(c) => setCrop(c)}
        onComplete={(c) => setCompleted(c)}
        aspect={aspect}
        keepSelection
        ruleOfThirds
        className="drag-crop__crop"
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Crop source"
          onLoad={onImageLoad}
          className="drag-crop__img"
          draggable={false}
        />
      </ReactCrop>
      <p className="drag-crop__hint muted">Drag the frame to reframe · resize corners to zoom crop</p>
    </div>
  );
}
