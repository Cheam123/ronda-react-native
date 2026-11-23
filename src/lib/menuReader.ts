import { isSupported, recognizeText } from 'expo-mlkit-ocr';
import type { LocalFile } from '../api/client';

/** One line of text the phone read from a menu photo, with where it sits on the page. */
export interface MenuFragment {
  text: string;
  /** Which photo it came from, starting at 0. */
  page: number;
  /** Position and size in the photo's own pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** False on a phone whose system can't run the on-device reader. */
export function canReadMenus(): boolean {
  try {
    return isSupported();
  } catch {
    return false;
  }
}

/**
 * Reads every photo on the phone itself (Google ML Kit); nothing is sent
 * anywhere. Lines come back top to bottom, then left to right, per photo.
 */
export async function readMenuPhotos(photos: LocalFile[]): Promise<MenuFragment[]> {
  const fragments: MenuFragment[] = [];

  for (const [page, photo] of photos.entries()) {
    const result = await recognizeText(photo.uri);
    for (const block of result.blocks) {
      for (const line of block.lines) {
        const text = line.text.trim();
        if (!text) continue;
        fragments.push({
          text,
          page,
          x: Math.round(line.boundingBox.x),
          y: Math.round(line.boundingBox.y),
          width: Math.round(line.boundingBox.width),
          height: Math.round(line.boundingBox.height),
        });
      }
    }
  }

  return fragments.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}
