import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/services/api";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// Carrega dados da API com estado de carregamento e erro. `deps` refaz a consulta.
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const run = ++latest.current;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (run === latest.current) setData(result);
      })
      .catch((err: unknown) => {
        if (run === latest.current) setError(errorMessage(err));
      })
      .finally(() => {
        if (run === latest.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, loading, error, reload };
}
