(() => {
  // Which widgets to fix. Each entry:
  //   rootSelector — the widget this rule applies inside of (scoping guard)
  //   tapSelector  — what counts as tappable within it
  const TAP_TARGET_RULES = [
    {
      rootSelector: '.date-picker',
      tapSelector: '.calendar-cell-inner, .calendar-cell, .date-picker-input, button'
    }
  ];

  const IOS_DEVICE_NAMES = ['iPhone', 'iPad', 'iPod'];

  const isIPadOnIOS13Plus =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;   // reports as a Mac

  const isIOSDevice =
    IOS_DEVICE_NAMES.some(deviceName => navigator.userAgent.includes(deviceName)) ||
    isIPadOnIOS13Plus;

  const isTouchDevice = window.matchMedia?.('(hover: none)').matches;

  if (!isIOSDevice || !isTouchDevice) {
    return;
  }

  const findTapTarget = element => {
    if (!element?.closest) {
      return null;
    }

    for (const { rootSelector, tapSelector } of TAP_TARGET_RULES) {
      if (!element.closest(rootSelector)) {
        continue;
      }

      const tapTarget = element.closest(tapSelector);

      if (tapTarget && tapTarget.closest(rootSelector)) {   // must still be inside this root
        return tapTarget;
      }
    }

    return null;
  };

  let tapTargetAtTouchStart = null;

  const handleTouchStart = touchEvent => {
    if (touchEvent.touches.length !== 1) {
      tapTargetAtTouchStart = null;
      return;
    }

    tapTargetAtTouchStart = findTapTarget(touchEvent.target);
  };

  const handleTouchEnd = touchEvent => {
    const tapTarget = tapTargetAtTouchStart;
    tapTargetAtTouchStart = null;

    if (!tapTarget || touchEvent.changedTouches.length !== 1) {
      return;
    }

    const releasedTouch = touchEvent.changedTouches[0];
    const elementUnderFinger = document.elementFromPoint(
      releasedTouch.clientX,
      releasedTouch.clientY
    );

    if (findTapTarget(elementUnderFinger) !== tapTarget) {
      // finger left the element: a drag
      return;
    }

    // cancels WebKit's deferred / emulated click
    touchEvent.preventDefault();

    tapTarget.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  };

  document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
  document.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });
})();
