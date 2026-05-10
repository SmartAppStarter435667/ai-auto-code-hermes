
'use client';

import React, { useMemo } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';

/**
 * クライアントサイドで Firebase を一度だけ初期化し、
 * コンテキストを通じてアプリ全体に提供するプロバイダー。
 */
export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // useMemo を使用して、クライアント側でのみ初期化が実行されるようにします。
  const { firebaseApp, auth, firestore } = useMemo(() => initializeFirebase(), []);

  return (
    <FirebaseProvider firebaseApp={firebaseApp} auth={auth} firestore={firestore}>
      {children}
    </FirebaseProvider>
  );
}
