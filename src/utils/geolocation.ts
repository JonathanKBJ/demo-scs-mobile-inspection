export interface GeoCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

export async function getCurrentCoordinates(): Promise<GeoCoords> {
  if (!('geolocation' in navigator)) {
    throw new Error('อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการดึงพิกัด GPS');
  }

  type ResolverFn<T> = () => { promise: Promise<T>; resolve: (val: T) => void; reject: (reason?: unknown) => void };
  const promiseCtor = Promise as unknown as { withResolvers?: ResolverFn<GeoCoords> };
  const { promise, resolve, reject } =
    typeof promiseCtor.withResolvers === 'function'
      ? promiseCtor.withResolvers()
      : (() => {
          let res!: (val: GeoCoords) => void;
          let rej!: (reason?: unknown) => void;
          const p = new Promise<GeoCoords>((a, b) => {
            res = a;
            rej = b;
          });
          return { promise: p, resolve: res, reject: rej };
        })();

  navigator.geolocation.getCurrentPosition(
    (position) => {
      resolve({
        lat: Number(position.coords.latitude.toFixed(6)),
        lng: Number(position.coords.longitude.toFixed(6)),
        accuracy: Math.round(position.coords.accuracy),
      });
    },
    (error) => {
      let msg = 'ไม่สามารถดึงพิกัดได้';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          msg = 'กรุณาอนุญาตการเข้าถึงตำแหน่งที่ตั้งในเบราว์เซอร์';
          break;
        case error.POSITION_UNAVAILABLE:
          msg = 'ไม่พบสัญญาณตำแหน่งที่ตั้ง';
          break;
        case error.TIMEOUT:
          msg = 'หมดเวลาในการค้นหาสัญญาณ GPS';
          break;
      }
      reject(new Error(msg));
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    }
  );

  return promise;
}
