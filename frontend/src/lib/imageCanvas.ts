import type { FilterPreset } from './filterPresets';

export type CropState = {
  panX: number;   // -1 … 1
  panY: number;
  zoom: number;   // 1 … 3
};

/** Load a File/Blob/object URL into an HTMLImageElement */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Compute crop rectangle in source pixels (cover + pan/zoom) */
export function computeCropRect(
  imgW: number,
  imgH: number,
  aspectW: number,
  aspectH: number,
  panX: number,
  panY: number,
  zoom: number,
) {
  const target = aspectW / aspectH;
  let cw: number, ch: number;
  if (imgW / imgH > target) {
    ch = imgH / zoom;
    cw = ch * target;
  } else {
    cw = imgW / zoom;
    ch = cw / target;
  }
  const maxX = imgW - cw;
  const maxY = imgH - ch;
  const ox = maxX * ((panX + 1) / 2);
  const oy = maxY * ((panY + 1) / 2);
  return { x: ox, y: oy, width: cw, height: ch };
}

/** Render cropped + filtered image to canvas → Blob URL */
export async function renderEditedImage(
  imageSrc: string,
  aspectW: number,
  aspectH: number,
  crop: CropState,
  preset: FilterPreset,
  outputShortSide = 1080,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const rect = computeCropRect(
    img.width, img.height, aspectW, aspectH,
    crop.panX, crop.panY, crop.zoom,
  );

  const outW = aspectW >= aspectH ? outputShortSide * (aspectW / aspectH) : outputShortSide * (aspectW / aspectH);
  const outH = aspectW >= aspectH ? outputShortSide : outputShortSide * (aspectH / aspectW);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(outW);
  canvas.height = Math.round(outH);
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);

  // Color overlay (same logic as fyp filterPresets)
  if (preset.overlay !== 'transparent') {
    ctx.fillStyle = preset.overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Simple vignette via radial gradient
  if (preset.vignette) {
    const g = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.width * 0.2,
      canvas.width / 2, canvas.height / 2, canvas.width * 0.75,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('Export failed'))),
      'image/jpeg',
      0.92,
    );
  });
}

/** Trigger browser download */
export function downloadBlobUrl(url: string, filename = 'socialengage-post.jpg') {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}