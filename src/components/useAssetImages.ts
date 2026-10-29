import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { getBlobUrl } from '../lib/storage';

/** Loads every image asset with a stored file once, for canvas rendering and export. */
export function useAssetImages(): { images: Map<string, HTMLImageElement>; version: number } {
  const { state } = useStore();
  const images = useRef<Map<string, HTMLImageElement>>(new Map());
  const [version, setVersion] = useState(0);
  const loaded = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for (const asset of state.assets) {
        if (asset.kind !== 'image' || !asset.blobId || loaded.current.has(asset.id)) continue;
        loaded.current.add(asset.id);
        const url = await getBlobUrl(asset.blobId);
        if (!url || cancelled) continue;
        const image = new Image();
        image.onload = () => {
          if (!cancelled) setVersion((value) => value + 1);
        };
        image.src = url;
        images.current.set(asset.id, image);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [state.assets]);

  return { images: images.current, version };
}
