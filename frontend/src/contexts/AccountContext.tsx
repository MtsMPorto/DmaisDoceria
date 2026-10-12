import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  accountRequest,
  CUSTOMER_TOKEN_KEY,
  type AccountProfile,
} from "@/services/accountService";
import { AccountModal } from "@/components/account/AccountModal";

interface AccountContextValue {
  profile: AccountProfile | null;
  loading: boolean;
  setProfile: (value: AccountProfile | null) => void;
  accountOpen: boolean;
  openAccount: () => void;
  closeAccount: () => void;
  logout: () => Promise<void>;
}
const Context = createContext<AccountContextValue | null>(null);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    if (sessionStorage.getItem(CUSTOMER_TOKEN_KEY))
      accountRequest<AccountProfile>("/api/accounts/me")
        .then((p) => {
          if (live) setProfile(p);
        })
        .catch(() => {})
        .finally(() => {
          if (live) setLoading(false);
        });
    else setLoading(false);
    const ended = () => setProfile(null);
    window.addEventListener("customer-session-ended", ended);
    return () => {
      live = false;
      window.removeEventListener("customer-session-ended", ended);
    };
  }, []);
  async function logout() {
    await accountRequest("/api/accounts/logout", {});
    sessionStorage.removeItem(CUSTOMER_TOKEN_KEY);
    setProfile(null);
  }
  return (
    <Context.Provider
      value={{
        profile,
        loading,
        setProfile,
        accountOpen: open,
        openAccount: () => setOpen(true),
        closeAccount: () => setOpen(false),
        logout,
      }}
    >
      {children}
      {open && <AccountModal onClose={() => setOpen(false)} />}
    </Context.Provider>
  );
}
export function useAccount() {
  const value = useContext(Context);
  if (!value) throw new Error("AccountProvider necessário");
  return value;
}
