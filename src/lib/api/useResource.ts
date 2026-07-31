'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, get, invalidate } from './client';

interface Resource<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

/* Read one GET path. Pass null to hold off (the path isn't known yet).

   State is only ever set from the fetch callbacks — `loading` is derived by
   comparing the path we're showing against the path we were asked for, which
   also means data from a previous path can never flash on screen. `reload`
   drops the cached copy first, so retrying after a failure (or after the
   backend comes back) actually hits the server. */
export function useResource<T>(path: string | null): Resource<T> {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ key: string; data: T | null; error: ApiError | null }>({
    key: '',
    data: null,
    error: null,
  });
  // a slow response for a path we've navigated away from must not land
  const live = useRef(0);
  const key = path ? `${path}#${nonce}` : '';

  useEffect(() => {
    if (!path) return;
    const ticket = ++live.current;
    get<T>(path)
      .then((d) => {
        if (live.current === ticket) setState({ key: `${path}#${nonce}`, data: d, error: null });
      })
      .catch((e: unknown) => {
        if (live.current !== ticket) return;
        setState({
          key: `${path}#${nonce}`,
          data: null,
          error: e instanceof ApiError ? e : new ApiError(0, 'Request failed'),
        });
      });
  }, [path, nonce]);

  const reload = useCallback(() => {
    if (path) invalidate(path);
    setNonce((n) => n + 1);
  }, [path]);

  const fresh = !!path && state.key === key;
  return {
    data: fresh ? state.data : null,
    error: fresh ? state.error : null,
    loading: !!path && !fresh,
    reload,
  };
}
