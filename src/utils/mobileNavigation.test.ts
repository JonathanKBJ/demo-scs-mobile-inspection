import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mobileNav } from './mobileNavigation';

// Traversal is deliberately asynchronous: back/go enqueue work, unlike pushState.
class HistoryWindow {
  private states: unknown[];
  private index: number;
  private listeners = new Set<(event: PopStateEvent) => void>();
  readonly traversals: number[] = [];
  readonly history: Pick<History, 'length' | 'state' | 'pushState' | 'replaceState' | 'back' | 'forward' | 'go'>;

  constructor(hasOutsideEntry = true) {
    this.states = hasOutsideEntry ? [{ outside: true }, null] : [null];
    this.index = this.states.length - 1;
    const host = this;
    this.history = {
      get length() { return host.states.length; },
      get state() { return host.states[host.index]; },
      pushState: (state: unknown) => {
        this.states.splice(this.index + 1);
        this.states.push(state);
        this.index++;
      },
      replaceState: (state: unknown) => { this.states[this.index] = state; },
      back: () => { this.traversals.push(-1); },
      forward: () => { this.traversals.push(1); },
      go: (delta = 0) => { this.traversals.push(delta); },
    };
  }

  addEventListener(name: string, listener: (event: PopStateEvent) => void) {
    if (name === 'popstate') this.listeners.add(listener);
  }

  removeEventListener(name: string, listener: (event: PopStateEvent) => void) {
    if (name === 'popstate') this.listeners.delete(listener);
  }

  traverse() {
    const delta = this.traversals.shift();
    if (delta === undefined) throw new Error('No history traversal is pending');
    const target = this.index + delta;
    if (target < 0 || target >= this.states.length) return;
    this.index = target;
    const event = { state: this.history.state } as PopStateEvent;
    for (const listener of this.listeners) listener(event);
  }

  async settle() {
    await Promise.resolve();
    let count = 0;
    while (this.traversals.length > 0) {
      if (++count > 30) throw new Error('History synchronization did not settle');
      this.traverse();
      await Promise.resolve();
    }
  }
}

let host: HistoryWindow;

beforeEach(() => {
  host = new HistoryWindow();
  vi.stubGlobal('window', host);
});

afterEach(() => {
  mobileNav.destroy();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('mobile navigation history synchronization', () => {
  test('closing the camera does not revisit the preceding wizard step', async () => {
    let step = 6;
    const leaveWizard = vi.fn();
    const previousStep = vi.fn(() => { step = 5; });
    const hardwareClose = vi.fn();
    mobileNav.push('wizard-root', leaveWizard);
    mobileNav.push('wizard-step-6', previousStep);
    const closeCamera = mobileNav.push('camera-modal', hardwareClose);
    await host.settle();

    closeCamera();
    await Promise.resolve();
    expect(host.traversals).toEqual([-1]);
    expect(step).toBe(6);
    await host.settle();

    expect(step).toBe(6);
    expect(hardwareClose).not.toHaveBeenCalled();
    expect(previousStep).not.toHaveBeenCalled();
    expect(leaveWizard).not.toHaveBeenCalled();
    expect(mobileNav.depth).toBe(2);

    host.history.back();
    await host.settle();
    expect(step).toBe(5);
    expect(previousStep).toHaveBeenCalledOnce();
    expect(leaveWizard).not.toHaveBeenCalled();
  });

  test('hardware Back closes only the camera, then the next Back changes the step', async () => {
    const leaveWizard = vi.fn();
    const previousStep = vi.fn();
    const hardwareClose = vi.fn();
    mobileNav.push('wizard-root', leaveWizard);
    mobileNav.push('wizard-step-6', previousStep);
    const closeCamera = mobileNav.push('camera-modal', () => {
      hardwareClose();
      closeCamera();
    });
    await host.settle();

    host.history.back();
    await host.settle();
    expect(hardwareClose).toHaveBeenCalledOnce();
    expect(previousStep).not.toHaveBeenCalled();
    expect(leaveWizard).not.toHaveBeenCalled();
    expect(mobileNav.depth).toBe(2);

    host.history.back();
    await host.settle();
    expect(hardwareClose).toHaveBeenCalledOnce();
    expect(previousStep).toHaveBeenCalledOnce();
    expect(leaveWizard).not.toHaveBeenCalled();
  });

  test('StrictMode setup-cleanup-setup preserves the replacement registration', async () => {
    const obsoleteBack = vi.fn();
    const replacementBack = vi.fn();
    const cleanup = mobileNav.push('wizard-root', obsoleteBack);
    cleanup();
    mobileNav.push('wizard-root', replacementBack);
    cleanup();
    await host.settle();

    expect(mobileNav.depth).toBe(1);
    expect(obsoleteBack).not.toHaveBeenCalled();
    expect(replacementBack).not.toHaveBeenCalled();
    host.history.back();
    await host.settle();
    expect(obsoleteBack).not.toHaveBeenCalled();
    expect(replacementBack).toHaveBeenCalledOnce();
  });

  test('a registration opened during pending removal survives its delayed popstate', async () => {
    const leaveWizard = vi.fn();
    const obsoleteBack = vi.fn();
    const replacementBack = vi.fn();
    mobileNav.push('wizard-root', leaveWizard);
    const cleanup = mobileNav.push('camera-modal', obsoleteBack);
    await host.settle();

    cleanup();
    await Promise.resolve();
    expect(host.traversals).toEqual([-1]);
    mobileNav.push('camera-modal', replacementBack);
    await host.settle();

    expect(mobileNav.depth).toBe(2);
    expect(obsoleteBack).not.toHaveBeenCalled();
    expect(replacementBack).not.toHaveBeenCalled();
    expect(leaveWizard).not.toHaveBeenCalled();
    host.history.back();
    await host.settle();
    expect(replacementBack).toHaveBeenCalledOnce();
    expect(leaveWizard).not.toHaveBeenCalled();
  });

  test('clearing to root does not navigate a new wizard opened before traversal completes', async () => {
    const oldBack = vi.fn();
    const newBack = vi.fn();
    mobileNav.push('wizard-root', oldBack);
    mobileNav.push('wizard-step-6', oldBack);
    mobileNav.push('camera-modal', oldBack);
    await host.settle();

    mobileNav.clearToRoot();
    await Promise.resolve();
    expect(host.traversals).toEqual([-3]);
    mobileNav.push('wizard-root', newBack);
    await host.settle();

    expect(mobileNav.depth).toBe(1);
    expect(oldBack).not.toHaveBeenCalled();
    expect(newBack).not.toHaveBeenCalled();
    host.history.back();
    await host.settle();
    expect(newBack).toHaveBeenCalledOnce();
  });

  test.each([false, true])(
    'Back followed by Home preserves a new wizard (opened before traversal: %s)',
    async (openBeforeTraversal) => {
      const oldBack = vi.fn();
      const newBack = vi.fn();
      mobileNav.push('wizard-root', oldBack);
      mobileNav.push('wizard-step-6', oldBack);
      await host.settle();

      mobileNav.back();
      mobileNav.clearToRoot();
      await Promise.resolve();
      // Home must wait for the footer Back instead of queuing a second go(-2).
      expect(host.traversals).toEqual([-1]);
      if (openBeforeTraversal) mobileNav.push('wizard-root', newBack);
      await host.settle();
      if (!openBeforeTraversal) {
        expect(host.history.state).toMatchObject({ depth: 0 });
        mobileNav.push('wizard-root', newBack);
        await host.settle();
      }

      expect(host.history.state).toMatchObject({ depth: 1 });
      expect(mobileNav.depth).toBe(1);
      expect(oldBack).not.toHaveBeenCalled();
      expect(newBack).not.toHaveBeenCalled();
      host.history.back();
      await host.settle();
      expect(newBack).toHaveBeenCalledOnce();
      expect(host.history.state).toMatchObject({ depth: 0 });
    }
  );

  test.each(['before-camera', 'after-camera'])(
    'camera cleanup crosses an unmanaged entry %s without navigating the wizard',
    async (position) => {
      const leaveWizard = vi.fn();
      const previousStep = vi.fn();
      const hardwareClose = vi.fn();
      mobileNav.push('wizard-root', leaveWizard);
      mobileNav.push('wizard-step-6', previousStep);
      await host.settle();
      if (position === 'before-camera') host.history.pushState(null, '');
      const closeCamera = mobileNav.push('camera-modal', hardwareClose);
      await host.settle();
      if (position === 'after-camera') host.history.pushState(null, '');

      closeCamera();
      await host.settle();
      expect(host.history.state).toMatchObject({ depth: 2 });
      expect(mobileNav.depth).toBe(2);
      expect(hardwareClose).not.toHaveBeenCalled();
      expect(previousStep).not.toHaveBeenCalled();
      expect(leaveWizard).not.toHaveBeenCalled();

      host.history.back();
      await host.settle();
      expect(previousStep).toHaveBeenCalledOnce();
      expect(leaveWizard).not.toHaveBeenCalled();
      expect(host.history.state).toMatchObject({ depth: 1 });
    }
  );

  test('cleanup landing below root restores its guard without closing a new view', async () => {
    const oldBack = vi.fn();
    const newBack = vi.fn();
    mobileNav.init();
    host.history.pushState(null, '');
    mobileNav.push('wizard-root', oldBack);
    mobileNav.push('camera-modal', oldBack);
    await host.settle();

    mobileNav.clearToRoot();
    await host.settle();
    expect(host.history.state).toMatchObject({ depth: 0 });
    expect(oldBack).not.toHaveBeenCalled();
    mobileNav.push('wizard-root', newBack);
    await host.settle();
    expect(host.history.state).toMatchObject({ depth: 1 });
    host.history.back();
    await host.settle();
    expect(newBack).toHaveBeenCalledOnce();
    expect(oldBack).not.toHaveBeenCalled();
  });

  test('removing a lower registration preserves the open modal above it', async () => {
    const leaveWizard = vi.fn();
    const previousStep = vi.fn();
    const closeCamera = vi.fn();
    mobileNav.push('wizard-root', leaveWizard);
    const removeStep = mobileNav.push('wizard-step-6', previousStep);
    mobileNav.push('camera-modal', closeCamera);
    await host.settle();

    removeStep();
    await host.settle();
    expect(mobileNav.depth).toBe(2);
    expect(previousStep).not.toHaveBeenCalled();
    expect(closeCamera).not.toHaveBeenCalled();
    expect(leaveWizard).not.toHaveBeenCalled();

    host.history.back();
    await host.settle();
    expect(closeCamera).toHaveBeenCalledOnce();
    expect(previousStep).not.toHaveBeenCalled();
    expect(leaveWizard).not.toHaveBeenCalled();
  });

  test('multi-entry hardware traversal invokes only the crossed active handlers', async () => {
    const actions: string[] = [];
    mobileNav.push('wizard-root', () => { actions.push('root'); });
    mobileNav.push('wizard-step-5', () => { actions.push('step-5'); });
    mobileNav.push('wizard-step-6', () => { actions.push('step-6'); });
    mobileNav.push('camera-modal', () => { actions.push('camera'); });
    await host.settle();

    host.history.go(-2);
    await host.settle();
    expect(actions).toEqual(['camera', 'step-6']);
    expect(mobileNav.depth).toBe(2);
  });

  test('Forward through a retired entry never invokes a second Back action', async () => {
    const previousStep = vi.fn();
    const closeCamera = vi.fn();
    mobileNav.push('wizard-root', vi.fn());
    mobileNav.push('wizard-step-6', previousStep);
    mobileNav.push('camera-modal', closeCamera);
    await host.settle();

    host.history.back();
    await host.settle();
    host.history.forward();
    await host.settle();
    expect(closeCamera).toHaveBeenCalledOnce();
    expect(previousStep).not.toHaveBeenCalled();
    expect(mobileNav.depth).toBe(2);

    host.history.back();
    await host.settle();
    expect(previousStep).toHaveBeenCalledOnce();
  });

  test('the first root Back shows the exit toast and the second can leave the app', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const showToast = vi.fn();
    mobileNav.init(showToast);

    host.history.back();
    await host.settle();
    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast).toHaveBeenCalledWith('กดปุ่มย้อนกลับอีกครั้งเพื่อออกจากแอป');
    expect(host.history.state).toMatchObject({ siamchaiNav: true, depth: 0 });

    host.history.back();
    await host.settle();
    expect(showToast).toHaveBeenCalledOnce();
    expect(host.history.state).toEqual({ outside: true });
  });

  test('an initial-only tab leaves its exit guard down when history cannot exit', async () => {
    host = new HistoryWindow(false);
    vi.stubGlobal('window', host);
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const showToast = vi.fn();
    mobileNav.init(showToast);
    host.history.back();
    await host.settle();
    expect(showToast).toHaveBeenCalledOnce();
    expect(host.history.state).toMatchObject({ depth: 0 });

    host.history.back();
    await host.settle();
    // No outside document exists: go(-1) cannot close this tab. Do not re-push
    // the guard or intercept subsequent physical Back with another toast.
    expect(host.history.state).toMatchObject({ depth: -1 });
    expect(host.history.length).toBe(2);
    host.history.back();
    await host.settle();
    expect(showToast).toHaveBeenCalledOnce();
    expect(host.history.state).toMatchObject({ depth: -1 });
    expect(host.history.length).toBe(2);

    const leaveWizard = vi.fn();
    mobileNav.push('wizard-root', leaveWizard);
    await host.settle();
    expect(host.history.state).toMatchObject({ depth: 1 });
    host.history.back();
    await host.settle();
    expect(leaveWizard).toHaveBeenCalledOnce();
    expect(host.history.state).toMatchObject({ depth: 0 });
  });

  test('root exit skips obsolete application history after a reload', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const oldBack = vi.fn();
    mobileNav.push('wizard-root', oldBack);
    mobileNav.push('wizard-step-6', oldBack);
    mobileNav.push('camera-modal', oldBack);
    await host.settle();
    mobileNav.destroy();
    const showToast = vi.fn();
    mobileNav.init(showToast);

    host.history.back();
    await host.settle();
    expect(showToast).toHaveBeenCalledOnce();
    host.history.back();
    await host.settle();
    expect(host.history.state).toEqual({ outside: true });
    expect(oldBack).not.toHaveBeenCalled();
  });
});
