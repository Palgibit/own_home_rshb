// Загрузка данных о кредите из любого источника (гость или «банк»).
// Пока грузится новое, показываем прежние данные — без мигания при вводе.

import { useEffect, useState } from "react";
import type { DataSource, LoanData } from "../../data/DataSource";

type State = { data: LoanData | null; loading: boolean; error?: string };

export function useLoanData(source: DataSource | null, today: string): State {
  const [state, setState] = useState<State>({ data: null, loading: false });

  useEffect(() => {
    if (!source) {
      setState({ data: null, loading: false });
      return;
    }
    let cancelled = false; // ответ от старого источника игнорируем
    setState((s) => ({ data: s.data, loading: true }));
    source.load(today).then(
      (data) => !cancelled && setState({ data, loading: false }),
      (e: unknown) => !cancelled && setState({ data: null, loading: false, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [source, today]);

  return state;
}
