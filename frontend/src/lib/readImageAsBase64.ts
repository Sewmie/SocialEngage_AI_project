export async function readImageAsBase64(src: string): Promise<string> {
    if (src.startsWith('data:')) {
      const comma = src.indexOf(',');
      if (comma === -1) throw new Error('Invalid data URI');
      return src.slice(comma + 1).replace(/\s/g, '');
    }
  
    const res = await fetch(src);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Could not read image'));
          return;
        }
        const i = result.indexOf(',');
        resolve(i >= 0 ? result.slice(i + 1) : result);
      };
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  }