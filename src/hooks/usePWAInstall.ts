import { useState, useEffect } from 'react';

export type PlatformCategory = 'apple' | 'android' | 'pc';

export interface DevicePlatformInfo {
  category: PlatformCategory;
  name: string;
  os: string;
  browser: string;
  isApple: boolean;
  isAndroid: boolean;
  isPC: boolean;
  supportsNativePrompt: boolean;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function detectDevicePlatform(): DevicePlatformInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      category: 'pc',
      name: 'Computador / PC',
      os: 'Web',
      browser: 'Navegador',
      isApple: false,
      isAndroid: false,
      isPC: true,
      supportsNativePrompt: false
    };
  }

  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();

  // Browser detection
  let browser = 'Navegador';
  if (/edg/.test(ua)) browser = 'Microsoft Edge';
  else if (/samsungbrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/chrome|crios/.test(ua)) browser = 'Google Chrome';
  else if (/firefox|fxios/.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari/.test(ua) && !/chrome|crios/.test(ua)) browser = 'Safari';

  // Apple detection (iPhone, iPad, iPod, or Mac)
  const isIOS = /iphone|ipad|ipod/.test(ua) || (platform === 'macintel' && navigator.maxTouchPoints > 1);
  const isMac = /macintosh|mac os x/.test(ua);

  if (isIOS) {
    return {
      category: 'apple',
      name: 'Apple (iPhone / iPad)',
      os: 'iOS',
      browser,
      isApple: true,
      isAndroid: false,
      isPC: false,
      supportsNativePrompt: false // iOS Safari doesn't support beforeinstallprompt
    };
  }

  if (isMac && browser === 'Safari') {
    return {
      category: 'apple',
      name: 'Apple (Mac Safari)',
      os: 'macOS',
      browser,
      isApple: true,
      isAndroid: false,
      isPC: false,
      supportsNativePrompt: false
    };
  }

  // Android detection
  if (/android/.test(ua)) {
    return {
      category: 'android',
      name: 'Android',
      os: 'Android',
      browser,
      isApple: false,
      isAndroid: true,
      isPC: false,
      supportsNativePrompt: true
    };
  }

  // PC / Desktop (Windows, Linux, Mac com Chrome/Edge, ChromeOS)
  let osName = 'Windows';
  if (/win/.test(platform) || /windows/.test(ua)) osName = 'Windows';
  else if (/linux/.test(platform) || /linux/.test(ua)) osName = 'Linux';
  else if (/cros/.test(ua)) osName = 'ChromeOS';
  else if (isMac) osName = 'macOS';

  return {
    category: 'pc',
    name: `PC (${osName})`,
    os: osName,
    browser,
    isApple: isMac,
    isAndroid: false,
    isPC: true,
    supportsNativePrompt: true
  };
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platformInfo, setPlatformInfo] = useState<DevicePlatformInfo>(detectDevicePlatform());

  // Helper function to check if the app is already installed/running as PWA
  const checkIsInstalled = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    // 1. Standalone display mode check (iOS, Android, Desktop)
    const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
    const isFullscreenDisplay = window.matchMedia('(display-mode: fullscreen)').matches;
    const isMinimalUiDisplay = window.matchMedia('(display-mode: minimal-ui)').matches;
    
    // 2. iOS standalone navigator property
    const isIOSStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    // 3. Android app referrer check
    const isAndroidApp = typeof document !== 'undefined' && document.referrer.includes('android-app://');

    // 4. LocalStorage flag (stored when user accepts prompt or appinstalled event fires)
    const storedInstalledFlag = localStorage.getItem('offgrid_pwa_installed') === 'true';

    // 5. Chromium getInstalledRelatedApps API (if supported)
    let relatedAppsInstalled = false;
    if ('getInstalledRelatedApps' in navigator && typeof (navigator as any).getInstalledRelatedApps === 'function') {
      try {
        const relatedApps = await (navigator as any).getInstalledRelatedApps();
        if (Array.isArray(relatedApps) && relatedApps.length > 0) {
          relatedAppsInstalled = true;
        }
      } catch {
        // Ignored if not supported or denied
      }
    }

    const detected = isStandaloneDisplay || isFullscreenDisplay || isMinimalUiDisplay || isIOSStandalone || isAndroidApp || storedInstalledFlag || relatedAppsInstalled;
    
    // If detected via native display mode, also persist in localStorage for resilience
    if (isStandaloneDisplay || isIOSStandalone || isAndroidApp || relatedAppsInstalled) {
      try {
        localStorage.setItem('offgrid_pwa_installed', 'true');
      } catch {
        // ignore
      }
    }

    return detected;
  };

  useEffect(() => {
    // Detect platform
    setPlatformInfo(detectDevicePlatform());

    // Check installed state on mount / entry
    checkIsInstalled().then((installed) => {
      setIsInstalled(installed);
    });

    // Re-check whenever window gains focus or visibility changes (e.g. user returns to app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkIsInstalled().then(setIsInstalled);
      }
    };

    const handleFocus = () => {
      checkIsInstalled().then(setIsInstalled);
    };

    // Listen for display-mode media query changes
    const mediaQueryList = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        localStorage.setItem('offgrid_pwa_installed', 'true');
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      try {
        localStorage.setItem('offgrid_pwa_installed', 'true');
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleMediaChange);
    } else if ((mediaQueryList as any).addListener) {
      (mediaQueryList as any).addListener(handleMediaChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleMediaChange);
      } else if ((mediaQueryList as any).removeListener) {
        (mediaQueryList as any).removeListener(handleMediaChange);
      }
    };
  }, []);

  const install = async (): Promise<'accepted' | 'dismissed' | 'manual_tutorial'> => {
    if (!deferredPrompt) {
      return 'manual_tutorial';
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return 'accepted';
      }
      return 'dismissed';
    } catch (err) {
      console.warn('Install prompt error, falling back to manual tutorial:', err);
      return 'manual_tutorial';
    }
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    platformInfo,
    isIOS: platformInfo.category === 'apple',
    install,
    deferredPrompt
  };
}
