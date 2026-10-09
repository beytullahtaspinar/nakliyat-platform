import * as Linking from 'expo-linking';
import { WEB_ORIGIN } from './variant';

/** Kayıtta kabul edilen kullanım koşulları sürümü. Sitedeki LEGAL_VERSION (apps/web/src/lib/legal.ts) ile aynı olmalı. */
export const LEGAL_VERSION = '2026-10-05';

export const LEGAL_PAGES = {
  terms: '/kullanim-kosullari',
  kvkk: '/kvkk-aydinlatma-metni',
  consent: '/acik-riza-metni',
  privacy: '/gizlilik-politikasi',
} as const;

export const openWebPage = (path: string) => void Linking.openURL(`${WEB_ORIGIN}${path}`);
