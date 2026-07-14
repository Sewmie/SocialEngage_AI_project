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

/** Export a PixelCrop region to a JPEG blob URL at the target aspect. */
export async function renderPixelCrop(
  image: HTMLImageElement,
  crop: PixelCrop,
  aspectW: number,
  aspectH: number,
  outputShortSide = 1080,
): Promise<string> {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const srcX = crop.x * scaleX;
  const srcY = crop.y * scaleY;
  const srcW = crop.width * scaleX;
  const srcH = crop.height * scaleY;

  const ratio = aspectW / aspectH;
  let outW: number;
  let outH: number;
  if (ratio >= 1) {
    outW = outputShortSide * ratio;
    outH = outputShortSide;
  } else {
    outW = outputShortSide;
    outH = outputShortSide / ratio;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(outW);
  canvas.height = Math.round(outH);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('Export failed'))),
      'image/jpeg',
      0.92,
    );
  });
}
