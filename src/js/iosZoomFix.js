(() => {
  const MINIMUM_FONT_SIZE_PX = 16;   // iOS zooms any focused control below this
  const FORM_FIELD_SELECTOR = 'input:not([type=hidden]), select, textarea';
  const IOS_DEVICE_NAMES = ['iPhone', 'iPad', 'iPod'];

  const isIPadOnIOS13Plus =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;   // reports as a Mac

  const isIOSDevice =
    IOS_DEVICE_NAMES.some(deviceName => navigator.userAgent.includes(deviceName)) ||
    isIPadOnIOS13Plus;

  if (!isIOSDevice) {
    return;
  }

  const raiseFontSizeIfTooSmall = formField => {
    const currentFontSize = parseFloat(getComputedStyle(formField).fontSize);

    if (currentFontSize < MINIMUM_FONT_SIZE_PX) {
      formField.style.fontSize = `${MINIMUM_FONT_SIZE_PX}px`;   // inline: wins without !important
    }
  };

  const fixFormFieldsWithin = element => {
    if (element.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (element.matches?.(FORM_FIELD_SELECTOR)) {
      raiseFontSizeIfTooSmall(element);
    }

    element.querySelectorAll?.(FORM_FIELD_SELECTOR).forEach(raiseFontSizeIfTooSmall);
  };

  const watchForNewFormFields = () => {
    fixFormFieldsWithin(document.body);

    const documentObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(fixFormFieldsWithin);
      });
    });

    documentObserver.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchForNewFormFields);
  } else {
    watchForNewFormFields();
  }
})();
