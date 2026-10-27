import { useEffect, useRef } from 'react';
/**
 * Mobile Hardware Back Button & Gesture Navigation Manager
 * Intercepts Android hardware back button and iOS/Android back swipe gestures via HTML5 History API.
 */

interface BackHandlerItem {
  id: string;
  key: number;
  onBack: () => void;
}

interface NavigationState {
  siamchaiNav: true;
  session: string;
  depth: number;
  key: number;
  exitDelta: number;
}

class MobileNavigationManager {
  private stack: BackHandlerItem[] = [];
  private historyStack: BackHandlerItem[] = [];
  private historyDepth = 0;
  private pendingTraversal: 'back' | 'cleanup' | null = null;
  private atSentinel = false;
  private nextKey = 0;
  private session = '';
  private rootExitDelta = -1;
  private lastExitPrompt: number | null = null;
  private isPopping = false;
  private syncScheduled = false;
  private showToastFn: ((msg: string) => void) | null = null;
  private initialized = false;

  init(showToast?: (msg: string) => void) {
    if (typeof window === 'undefined' || !window.history) return;
    if (showToast) this.showToastFn = showToast;
    if (this.initialized) return;
    this.initialized = true;
    this.session = `${Date.now()}-${Math.random()}`;
    const previous = window.history.state as Partial<NavigationState> | null;
    this.rootExitDelta = -1;
    if (previous?.siamchaiNav && typeof previous.depth === 'number' &&
      Number.isInteger(previous.depth) && previous.depth >= -1) {
      // A reload must not make the user Back through handlers from the old page.
      this.rootExitDelta = typeof previous.exitDelta === 'number' &&
        Number.isInteger(previous.exitDelta) && previous.exitDelta < 0
        ? previous.exitDelta - previous.depth - 1
        : -previous.depth - 1;
    }

    try {
      // Keep an entry behind the root so the first hardware Back can show the exit toast.
      window.history.replaceState(this.historyState(-1), '');
      window.history.pushState(this.historyState(0), '');
    } catch {
      // History can be unavailable in restricted iframes.
    }

    window.addEventListener('popstate', this.handlePopState);
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.handlePopState);
    }
    this.initialized = false;
    this.stack = [];
    this.historyStack = [];
    this.historyDepth = 0;
    this.pendingTraversal = null;
    this.atSentinel = false;
    this.lastExitPrompt = null;
    this.syncScheduled = false;
    this.showToastFn = null;
  }

  /**
   * Register a modal, step, or sub-view. The returned cleanup belongs to this
   * registration, not to a later StrictMode remount with the same public id.
   */
  push(id: string, onBack: () => void): () => void {
    if (typeof window === 'undefined' || !window.history) return () => {};
    this.init();
    const item = { id, key: ++this.nextKey, onBack };
    this.stack.push(item);
    this.lastExitPrompt = null;
    this.scheduleSync();
    return () => this.remove(item);
  }

  /** Serialize explicit Back with registration cleanup's asynchronous traversal. */
  back() {
    if (typeof window === 'undefined' || !window.history) return;
    this.init();
    this.syncHistory();
    if (this.pendingTraversal !== null) return;
    // At the earliest sentinel there may be no previous entry and no popstate.
    if (!this.atSentinel) this.pendingTraversal = 'back';
    try {
      window.history.back();
    } catch {
      this.pendingTraversal = null;
    }
  }

  clearToRoot() {
    this.stack = [];
    this.scheduleSync();
  }

  get depth(): number {
    return this.stack.length;
  }

  private remove(item: BackHandlerItem) {
    const index = this.stack.indexOf(item);
    if (index === -1) return;
    this.stack.splice(index, 1);
    this.scheduleSync();
  }

  private historyState(depth: number): NavigationState {
    return {
      siamchaiNav: true,
      session: this.session,
      depth,
      key: depth > 0 ? this.historyStack[depth - 1].key : 0,
      exitDelta: this.rootExitDelta,
    };
  }

  private scheduleSync() {
    if (!this.initialized || this.syncScheduled) return;
    this.syncScheduled = true;
    const session = this.session;
    queueMicrotask(() => {
      if (!this.initialized || session !== this.session) return;
      this.syncScheduled = false;
      this.syncHistory();
    });
  }

  private syncHistory() {
    if (this.pendingTraversal !== null || this.isPopping) return;
    let sharedDepth = 0;
    while (sharedDepth < this.historyDepth &&
      this.historyStack[sharedDepth] === this.stack[sharedDepth]) {
      sharedDepth++;
    }

    if (sharedDepth < this.historyDepth) {
      // Own the traversal until any destination arrives. Extra same-document
      // entries or intervening hardware navigation can change its destination.
      this.pendingTraversal = 'cleanup';
      try {
        window.history.go(sharedDepth - this.historyDepth);
      } catch {
        this.pendingTraversal = null;
      }
      return;
    }

    if (this.atSentinel && this.stack.length > 0) {
      // A confirmed root exit leaves the guard down, even if go() cannot exit
      // an initial tab. Only opening another view installs a root again.
      window.history.pushState(this.historyState(0), '');
      this.atSentinel = false;
    }

    while (this.historyDepth < this.stack.length) {
      this.historyStack.length = this.historyDepth;
      this.historyStack.push(this.stack[this.historyDepth]);
      try {
        window.history.pushState(this.historyState(this.historyDepth + 1), '');
      } catch {
        this.historyStack.length = this.historyDepth;
        return;
      }
      this.historyDepth++;
    }
  }

  private handlePopState = (event: PopStateEvent) => {
    const state = event.state as NavigationState | null;
    const pending = this.pendingTraversal;
    this.pendingTraversal = null;
    if (!state || state.session !== this.session || !state.siamchaiNav ||
      !Number.isInteger(state.depth) || state.depth < -1 ||
      state.depth > this.historyStack.length ||
      state.key !== this.historyState(state.depth).key) {
      if (pending !== null && this.historyDepth > 0) {
        // An unmanaged same-document entry is not a Back action for a view.
        // Adopt it at the last known depth, then reconcile cleanup from here;
        // never leave a traversal waiting for an exact destination indefinitely.
        window.history.replaceState(this.historyState(this.historyDepth), '');
        this.scheduleSync();
      }
      return;
    }

    const targetDepth = Math.max(0, state.depth);
    this.atSentinel = state.depth === -1;
    if (pending === 'cleanup') {
      this.historyDepth = targetDepth;
      if (this.atSentinel) {
        // Cleanup may cross extra unmanaged entries and land below the root.
        // Restore its guard, unlike an intentional confirmed root exit.
        window.history.pushState(this.historyState(0), '');
        this.atSentinel = false;
      }
      this.scheduleSync();
      return;
    }

    const previousDepth = this.historyDepth;
    this.historyDepth = targetDepth;
    this.isPopping = true;
    try {
      // Forward may revisit retired entries, but must not run another Back action.
      for (let index = previousDepth - 1; index >= targetDepth; index--) {
        const item = this.historyStack[index];
        const activeIndex = this.stack.indexOf(item);
        if (activeIndex !== -1) {
          this.stack.splice(activeIndex, 1);
          item.onBack();
        }
      }

      if (state.depth === -1) {
        if (previousDepth > 0) {
          window.history.pushState(this.historyState(0), '');
          this.atSentinel = false;
        } else {
          const now = Date.now();
          if (this.lastExitPrompt !== null && now - this.lastExitPrompt < 2000) {
            this.lastExitPrompt = null;
            // Best effort only: go() cannot close an initial tab or a standalone
            // app with no earlier entry. Stay on the sentinel without re-pushing
            // a guard so subsequent physical Back remains browser/OS-owned.
            window.history.go(this.rootExitDelta);
          } else {
            this.lastExitPrompt = now;
            this.showToastFn?.('กดปุ่มย้อนกลับอีกครั้งเพื่อออกจากแอป');
            window.history.pushState(this.historyState(0), '');
            this.atSentinel = false;
          }
        }
      }
    } finally {
      this.isPopping = false;
      this.scheduleSync();
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

    return mobileNav.push(id, () => {
      onBackRef.current();
    });
  }, [isOpen, id]);
}
