import { useEffect, useRef } from 'react';
/**
 * Mobile Hardware Back Button & Gesture Navigation Manager
 * Intercepts Android hardware back button and iOS/Android back swipe gestures via HTML5 History API.
 */

export interface BackHandlerItem {
  id: string;
  onBack: () => void;
}

class MobileNavigationManager {
  private stack: BackHandlerItem[] = [];
  private lastExitPrompt = 0;
  private isPopping = false;
  private showToastFn: ((msg: string) => void) | null = null;
  private initialized = false;

  init(showToast?: (msg: string) => void) {
    if (typeof window === 'undefined' || !window.history) return;
    if (this.initialized) {
      if (showToast) this.showToastFn = showToast;
      return;
    }
    this.initialized = true;
    if (showToast) this.showToastFn = showToast;

    // Ensure initial anchor state exists
    try {
      if (!window.history.state || !window.history.state.siamchaiNav) {
        window.history.replaceState({ siamchaiNav: true, depth: 0 }, '');
      }
    } catch {
      // Ignore security errors in restricted iframes
    }

    window.addEventListener('popstate', this.handlePopState);
  }

  destroy() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('popstate', this.handlePopState);
    this.initialized = false;
    this.stack = [];
  }

  /**
   * Push a back handler for a modal, drawer, step, or sub-view.
   * Pushes a state to window.history so mobile back has something to pop.
   */
  push(id: string, onBack: () => void) {
    if (typeof window === 'undefined' || !window.history) return;
    this.stack.push({ id, onBack });
    try {
      window.history.pushState({ siamchaiNav: true, depth: this.stack.length }, '');
    } catch {
      // ignore
    }
  }

  /**
   * Remove a back handler when closed via on-screen UI (e.g. user clicked [X] or Confirm).
   * Rewinds the history stack by calling history.back() so stack stays in sync.
   */
  popById(id: string) {
    const idx = this.stack.findIndex((item) => item.id === id);
    if (idx !== -1) {
      this.stack.splice(idx, 1);
      if (!this.isPopping && typeof window !== 'undefined' && window.history) {
        try {
          window.history.back();
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Trigger back programmatically (same as hardware back / swipe back).
   */
  back() {
    if (typeof window !== 'undefined' && window.history) {
      window.history.back();
    }
  }

  /**
   * Clear all handlers back to root.
   */
  clearToRoot() {
    const count = this.stack.length;
    this.stack = [];
    if (count > 0 && !this.isPopping && typeof window !== 'undefined' && window.history) {
      try {
        window.history.go(-count);
      } catch {
        // ignore
      }
    }
  }

  get depth(): number {
    return this.stack.length;
  }

  private handlePopState = () => {
    this.isPopping = true;
    try {
      if (this.stack.length > 0) {
        const top = this.stack.pop();
        if (top) {
          top.onBack();
        }
      } else {
        // At root! Double-back exit check
        const now = Date.now();
        if (now - this.lastExitPrompt < 2000) {
          // Double back within 2s -> Allow browser/PWA to exit
          this.lastExitPrompt = 0;
          if (typeof window !== 'undefined' && window.history) {
            window.history.back();
          }
        } else {
          this.lastExitPrompt = now;
          if (this.showToastFn) {
            this.showToastFn('กดปุ่มย้อนกลับอีกครั้งเพื่อออกจากแอป');
          }
          // Re-push anchor so next press within 2s can exit
          if (typeof window !== 'undefined' && window.history) {
            try {
              window.history.pushState({ siamchaiNav: true, depth: 0 }, '');
            } catch {
              // ignore
            }
          }
        }
      }
    } finally {
      this.isPopping = false;
    }
  };
}

export const mobileNav = new MobileNavigationManager();

/**
 * React hook to register a back action when a modal or sub-view is open.
 * When the user presses the phone's hardware back or swiping back, `onBack` is called.
 */
export function useMobileBack(
  isOpen: boolean,
  onBack: () => void,
  id: string
) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!isOpen) return;

    mobileNav.push(id, () => {
      onBackRef.current();
    });

    return () => {
      mobileNav.popById(id);
    };
  }, [isOpen, id]);
}
