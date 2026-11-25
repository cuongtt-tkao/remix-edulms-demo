/**
 * Tiện ích thông báo đăng ký mới cho Admin / Tổng Quản trị:
 * - Âm báo nhẹ qua Web Audio API (tự bỏ qua nếu trình duyệt chặn autoplay).
 * - Thông báo trình duyệt (Web Notification API) khi người dùng đã cấp quyền.
 */

export type BrowserNotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return Notification.permission;
  }
}

export function playRegistrationChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [587.33, 880]; // D5 -> A5 gentle chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.3);
    });

    setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 800);
  } catch {
    // Bỏ qua nếu trình duyệt chưa cho phép phát âm thanh
  }
}

export function showBrowserRegistrationNotification(
  title: string,
  body: string,
  onClick?: () => void
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const notif = new Notification(title, {
      body,
      icon: '/icon.svg?v=2',
      tag: 'hanhthucluc-new-registration',
    });
    notif.onclick = () => {
      try {
        window.focus();
      } catch {
        // ignore
      }
      notif.close();
      onClick?.();
    };
  } catch {
    // Một số môi trường (ví dụ iOS Safari hoặc PWA không hỗ trợ constructor trực tiếp) -> bỏ qua
  }
}
