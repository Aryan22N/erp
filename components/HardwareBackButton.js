"use client";
import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useRouter, usePathname } from 'next/navigation';

export default function HardwareBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only run this on the native Android/iOS app, not in a standard web browser
    if (!Capacitor.isNativePlatform()) return;

    const setupListener = async () => {
      const listener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        // Define your root pages where pressing back should actually exit the app
        const rootPaths = [
          '/', 
          '/login', 
          '/manager/dashboard', 
          '/superadmin/dashboard', 
          '/supervisor/dashboard'
        ];

        if (rootPaths.includes(pathname)) {
          // If on a root page, exit the app
          CapacitorApp.exitApp();
        } else if (canGoBack) {
          // If deep in the app, go back one page
          router.back();
        } else {
          // Fallback just in case
          router.push('/');
        }
      });

      return listener;
    };

    const listenerPromise = setupListener();

    // Cleanup the listener when the component unmounts
    return () => {
      listenerPromise.then(listener => listener.remove());
    };
  }, [router, pathname]);

  return null;
}