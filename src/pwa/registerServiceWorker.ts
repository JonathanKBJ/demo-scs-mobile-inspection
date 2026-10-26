import { registerSW } from 'virtual:pwa-register';

export function initPWA(): void {
  if ('serviceWorker' in navigator) {
    const updateSW = registerSW({
      onNeedRefresh() {
        if (confirm('มีเวอร์ชันใหม่ของระบบสัญญาออนไลน์ ต้องการอัปเดตทันทีหรือไม่?')) {
          updateSW(true);
        }
      },
      onOfflineReady() {
        console.log('สยามชัย DCR PWA: พร้อมใช้งานแบบออฟไลน์แล้ว');
      },
    });
  }
}
