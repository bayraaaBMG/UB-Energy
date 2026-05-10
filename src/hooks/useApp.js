import { useLang } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";

export function useApp() {
  const { t, lang } = useLang();
  const { user, authLoading } = useAuth();
  return { t, lang, user, authLoading };
}
