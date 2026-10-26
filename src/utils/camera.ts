export async function resizeImageFile(file: File, maxDimension = 1280, quality = 0.82): Promise<string> {
  type ResolverFn<T> = () => { promise: Promise<T>; resolve: (val: T) => void; reject: (reason?: unknown) => void };
  const promiseCtor = Promise as unknown as { withResolvers?: ResolverFn<string> };
  const { promise, resolve, reject } =
    typeof promiseCtor.withResolvers === 'function'
      ? promiseCtor.withResolvers()
      : (() => {
          let res!: (val: string) => void;
          let rej!: (reason?: unknown) => void;
          const p = new Promise<string>((a, b) => {
            res = a;
            rej = b;
          });
          return { promise: p, resolve: res, reject: rej };
        })();
  const reader = new FileReader();
  reader.onerror = reject;
  reader.onload = () => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(String(reader.result));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);

  return promise;
}
