import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import logo from "@/assets/images/Logo_Doces-removebg-preview__1_.png";
import { useAccount } from "@/contexts/AccountContext";
import {
  accountRequest,
  CUSTOMER_TOKEN_KEY,
  type AccountProfile,
} from "@/services/accountService";
import { ADMIN_SESSION_KEY, ADMIN_TOKEN_KEY } from "@/config/constants";
import { ApiError } from "@/services/api";
import { formatCEP, formatDocument, formatPhone } from "@/lib/format";
import { UF_LIST, isValidCnpj } from "@/lib/document";
import "./account.css";

type Screen =
  | "login"
  | "register"
  | "verify"
  | "recover"
  | "reset"
  | "profile"
  | "edit"
  | "email";
type Purpose = "signup" | "recovery" | "email";
type Draft = {
  type: "PF" | "PJ";
  name: string;
  tradeName: string;
  responsibleName: string;
  document: string;
  phone: string;
  email: string;
  zip: string;
  street: string;
  streetNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};
const empty: Draft = {
  type: "PF",
  name: "",
  tradeName: "",
  responsibleName: "",
  document: "",
  phone: "",
  email: "",
  zip: "",
  street: "",
  streetNumber: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};
function fromProfile(profile: AccountProfile): Draft {
  return Object.fromEntries(
    Object.keys(empty).map((key) => [
      key,
      profile[key as keyof AccountProfile] ?? "",
    ]),
  ) as Draft;
}
function profilePayload(draft: Draft) {
  const { email: _, ...profile } = draft;
  return {
    ...profile,
    document:
      profile.type === "PJ"
        ? profile.document.replace(/[./-]/g, "").toUpperCase()
        : "",
    tradeName: profile.type === "PJ" ? profile.tradeName : "",
    responsibleName: profile.type === "PJ" ? profile.responsibleName : "",
  };
}
function Input({
  label,
  icon,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: ReactNode;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = props.type === "password";
  return (
    <label className="account-field">
      <span>
        {label}
        {props.required ? " *" : ""}
      </span>
      <div className="account-input">
        {icon}
        <input
          {...props}
          type={isPassword ? (visible ? "text" : "password") : props.type}
          aria-invalid={!!error}
        />
        {isPassword && (
          <button
            type="button"
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <small style={{ color: "#a52727" }}>{error}</small>}
    </label>
  );
}

export function AccountModal({
  onClose,
  onAuthenticated = onClose,
  initialScreen,
}: {
  onClose: () => void;
  onAuthenticated?: () => void;
  initialScreen?: Screen;
}) {
  const { profile, setProfile, logout } = useAccount();
  const [screen, setScreen] = useState<Screen>(
    initialScreen ?? (profile ? "profile" : "login"),
  );
  const [draft, setDraft] = useState<Draft>(
    profile ? fromProfile(profile) : { ...empty },
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("signup");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [looking, setLooking] = useState("");
  const modal = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const busyRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const lookupSequence = useRef({ zip: 0, document: 0 });
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) closeRef.current();
      if (event.key !== "Tab") return;
      const nodes = Array.from(
        modal.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]',
        ) ?? [],
      );
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === modal.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    modal.current?.focus();
    return () => {
      alive.current = false;
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    modal.current?.scrollTo(0, 0);
  }, [screen]);
  useEffect(() => {
    if (!profile && ["profile", "edit", "email"].includes(screen)) {
      setScreen("login");
      setPassword("");
      setError("Entre na sua conta para continuar.");
    }
  }, [profile, screen]);
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);
  function go(next: Screen) {
    setError("");
    setFields({});
    setNotice("");
    setPassword("");
    setConfirmation("");
    setCode("");
    setScreen(next);
  }
  async function run(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setFields({});
    setNotice("");
    try {
      await work();
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : "Não foi possível concluir.");
      modal.current?.scrollTo({ top: 0, behavior: "smooth" });
      if (e instanceof ApiError && Array.isArray(e.details))
        setFields(
          Object.fromEntries(
            e.details.map((v: { path: string; message: string }) => [
              v.path,
              v.message,
            ]),
          ),
        );
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function beginVerification(
    id: string,
    address: string,
    nextPurpose: Purpose,
  ) {
    setChallenge(id);
    setEmail(address);
    setPurpose(nextPurpose);
    setCode("");
    setCountdown(60);
    setPassword("");
    setConfirmation("");
    setScreen("verify");
  }
  async function lookup(kind: "zip" | "document") {
    const value = draftRef.current[kind].replace(/[.\/-]/g, "").toUpperCase();
    if (kind === "zip" ? !/^\d{8}$/.test(value) : !isValidCnpj(value)) return;
    const sequence = ++lookupSequence.current[kind];
    setLooking(kind === "zip" ? "Consultando CEP..." : "Consultando CNPJ...");
    try {
      const result = await accountRequest<Partial<Draft>>(
        `/api/accounts/lookup/${kind === "zip" ? "cep" : "cnpj"}/${value}`,
      );
      if (
        !alive.current ||
        lookupSequence.current[kind] !== sequence ||
        draftRef.current[kind].replace(/[.\/-]/g, "").toUpperCase() !== value
      )
        return;
      setDraft((current) => ({ ...current, ...result }));
      setFields((current) => ({ ...current, [kind]: "" }));
    } catch (e) {
      if (
        alive.current &&
        draftRef.current[kind].replace(/[.\/-]/g, "").toUpperCase() === value
      )
        setFields((current) => ({
          ...current,
          [kind]: e instanceof Error ? e.message : "Consulta indisponível.",
        }));
    } finally {
      if (alive.current) setLooking("");
    }
  }
  function field(
    key: keyof Draft,
    label: string,
    options: InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode } = {},
  ) {
    return (
      <Input
        label={label}
        name={key}
        value={draft[key]}
        required={!["tradeName", "complement"].includes(key)}
        error={fields[key]}
        maxLength={120}
        onChange={(e) => setDraft((v) => ({ ...v, [key]: e.target.value }))}
        {...options}
      />
    );
  }
  function passwords() {
    return (
      <>
        <Input
          label={screen === "reset" ? "Nova senha" : "Senha"}
          type="password"
          icon={<LockKeyhole size={18} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          placeholder="Crie uma senha"
          error={fields.password}
        />
        <Input
          label={
            screen === "reset" ? "Confirmar nova senha" : "Confirmar senha"
          }
          type="password"
          icon={<LockKeyhole size={18} />}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          placeholder="Repita sua senha"
          error={fields.confirmPassword}
        />
        <p className="account-help">Use pelo menos 8 caracteres.</p>
      </>
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (screen === "login") {
        const result = await accountRequest<{
          role: "admin" | "customer" | "pending";
          token: string;
          profile: AccountProfile;
          challengeId: string;
          email: string;
        }>("/api/accounts/login", { username: username.trim(), password });
        if (!alive.current) return;
        if (result.role === "admin") {
          sessionStorage.removeItem(CUSTOMER_TOKEN_KEY);
          setProfile(null);
          sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token);
          sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
          window.location.assign("/admin/panel");
        } else if (result.role === "pending")
          beginVerification(result.challengeId, result.email, "signup");
        else {
          sessionStorage.setItem(CUSTOMER_TOKEN_KEY, result.token);
          setProfile(result.profile);
          onAuthenticated();
        }
      } else if (screen === "register") {
        if (password !== confirmation)
          throw new Error("As senhas devem ser iguais.");
        const result = await accountRequest<{ challengeId: string }>(
          "/api/accounts/register",
          {
            ...profilePayload(draft),
            email: draft.email.trim().toLowerCase(),
            password,
            confirmPassword: confirmation,
          },
        );
        if (alive.current)
          beginVerification(result.challengeId, draft.email, "signup");
      } else if (screen === "recover") {
        const result = await accountRequest<{ challengeId: string }>(
          "/api/accounts/recover",
          { email: email.trim().toLowerCase() },
        );
        if (alive.current)
          beginVerification(result.challengeId, email, "recovery");
      } else if (screen === "verify") {
        const result = await accountRequest<{
          purpose: Purpose;
          resetToken?: string;
        }>(
          purpose === "email"
            ? "/api/accounts/email/verify"
            : "/api/accounts/verify",
          { challengeId: challenge, code },
        );
        if (!alive.current) return;
        if (result.purpose === "recovery") {
          setResetToken(result.resetToken!);
          go("reset");
        } else {
          if (result.purpose === "email") {
            sessionStorage.removeItem(CUSTOMER_TOKEN_KEY);
            setProfile(null);
          }
          setUsername(email);
          go("login");
          setNotice(
            result.purpose === "signup"
              ? "E-mail verificado! Entre na sua conta."
              : "E-mail alterado! Entre novamente com o novo e-mail.",
          );
        }
      } else if (screen === "reset") {
        if (password !== confirmation)
          throw new Error("As senhas devem ser iguais.");
        await accountRequest("/api/accounts/reset", {
          resetToken,
          password,
          confirmPassword: confirmation,
        });
        if (alive.current) {
          setResetToken("");
          setUsername(email);
          go("login");
          setNotice("Senha alterada! Entre com sua nova senha.");
        }
      } else if (screen === "edit") {
        const result = await accountRequest<AccountProfile>(
          "/api/accounts/me",
          profilePayload(draft),
          "PATCH",
        );
        if (alive.current) {
          setProfile(result);
          go("profile");
          setNotice("Dados atualizados.");
        }
      } else if (screen === "email") {
        const result = await accountRequest<{ challengeId: string }>(
          "/api/accounts/email",
          { email: email.trim().toLowerCase(), password },
        );
        if (alive.current)
          beginVerification(result.challengeId, email, "email");
      }
    });
  }
  const titles: Record<Screen, string> = {
    login: "Entrar",
    register: "Criar conta",
    recover: "Recuperar senha",
    verify: "Verificação",
    reset: "Nova senha",
    profile: profile?.name || "Minha conta",
    edit: "Editar dados",
    email: "Alterar e-mail",
  };
  const subtitles: Partial<Record<Screen, string>> = {
    login: "Acesse sua conta D'mais",
    register: "Faça parte da D'mais",
    recover: "Informe seu e-mail para receber o código",
    verify:
      purpose === "recovery"
        ? `Se o e-mail estiver cadastrado, o código será enviado para ${email}`
        : `Código enviado para ${email}`,
    reset: "Crie uma nova senha para sua conta",
    profile: profile?.email,
    email: "Confirme sua senha e informe o novo e-mail",
  };
  const editing = screen === "edit",
    registration = screen === "register" || editing;
  return createPortal(
    <div
      className="account-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={modal}
        tabIndex={-1}
        className="account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
      >
        <div className="account-tools">
          {screen !== "login" && screen !== "profile" && (
            <button
              type="button"
              aria-label="Voltar"
              disabled={busy}
              onClick={() => go(profile ? "profile" : "login")}
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <button
            type="button"
            aria-label="Fechar"
            disabled={busy}
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        {screen === "login" && (
          <img className="account-logo" src={logo} alt="D'mais" />
        )}
        {screen === "profile" && (
          <div className="account-avatar">
            <UserRound size={32} />
          </div>
        )}
        <h2
          id="account-title"
          className="account-title"
          style={{ overflowWrap: "anywhere" }}
        >
          {titles[screen]}
        </h2>
        {subtitles[screen] && (
          <p className="account-subtitle">{subtitles[screen]}</p>
        )}
        {error && (
          <div role="alert" className="account-error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="account-success">
            {notice}
          </div>
        )}
        {screen === "profile" && profile ? (
          <>
            <span className="account-badge">
              {profile.type === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
            </span>
            <dl className="account-details">
              {[
                [profile.type === "PF" ? "Nome" : "Razão social", profile.name],
                ...(profile.type === "PJ"
                  ? [
                      [
                        "CNPJ",
                        formatDocument(profile.document || "", "juridica"),
                      ],
                      ["Nome fantasia", profile.tradeName || "—"],
                      ["Proprietário", profile.responsibleName || "—"],
                    ]
                  : []),
                ["Celular", formatPhone(profile.phone)],
                ["E-mail", profile.email],
                ["CEP", formatCEP(profile.zip)],
                [
                  "Endereço",
                  `${profile.street}, ${profile.streetNumber}${profile.complement ? ` — ${profile.complement}` : ""}`,
                ],
                ["Bairro", profile.neighborhood],
                ["Cidade/UF", `${profile.city}/${profile.state}`],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "contents" }}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="account-profile-actions">
              <button
                className="account-outline"
                onClick={() => {
                  setDraft(fromProfile(profile));
                  go("edit");
                }}
              >
                <Pencil size={18} />
                Editar dados
              </button>
              <button
                className="account-link"
                onClick={() => {
                  setEmail("");
                  go("email");
                }}
              >
                Alterar e-mail
              </button>
              <button
                className="account-outline account-muted"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await logout();
                    go("login");
                  })
                }
              >
                <LogOut size={18} />
                Sair da conta
              </button>
            </div>
          </>
        ) : (
          <>
            {registration && !editing && (
              <div
                className="account-tabs"
                role="tablist"
                aria-label="Tipo de cadastro"
              >
                {(["PF", "PJ"] as const).map((type) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={draft.type === type}
                    key={type}
                    disabled={busy}
                    onClick={() => {
                      setDraft((v) => ({
                        ...v,
                        type,
                        name: "",
                        document: "",
                        responsibleName: "",
                        tradeName: "",
                      }));
                      setFields({});
                    }}
                  >
                    {type === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                  </button>
                ))}
              </div>
            )}
            <form className="account-form" onSubmit={submit}>
              <fieldset
                disabled={busy}
                style={{
                  border: 0,
                  padding: 0,
                  margin: 0,
                  display: "contents",
                }}
              >
                {screen === "login" && (
                  <>
                    <Input
                      label="E-mail ou usuário"
                      icon={<Mail size={18} />}
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      maxLength={150}
                      autoComplete="username"
                      placeholder="seu@email.com"
                    />
                    <Input
                      label="Senha"
                      icon={<LockKeyhole size={18} />}
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      maxLength={128}
                      autoComplete="current-password"
                      placeholder="Sua senha"
                    />
                  </>
                )}
                {registration && (
                  <>
                    {draft.type === "PJ" &&
                      field("document", "CNPJ", {
                        icon: <Building2 size={18} />,
                        maxLength: 18,
                        disabled: editing,
                        placeholder: "00.000.000/0000-00",
                        onBlur: () => lookup("document"),
                        onChange: (e) =>
                          setDraft((v) => ({
                            ...v,
                            document: formatDocument(
                              e.target.value,
                              "juridica",
                            ),
                          })),
                      })}
                    {field(
                      "name",
                      draft.type === "PF" ? "Nome completo" : "Razão Social",
                      {
                        icon:
                          draft.type === "PF" ? (
                            <UserRound size={18} />
                          ) : undefined,
                        placeholder:
                          draft.type === "PF"
                            ? "Seu nome completo"
                            : "Empresa Ltda",
                        pattern:
                          draft.type === "PF"
                            ? "[\\p{L}\\p{M}]+(?:[ '\u2019.\\-][\\p{L}\\p{M}]+)*"
                            : undefined,
                        title:
                          draft.type === "PF"
                            ? "Use letras, sem números."
                            : undefined,
                        autoComplete: "name",
                      },
                    )}
                    {draft.type === "PJ" &&
                      field("tradeName", "Nome Fantasia", {
                        placeholder: "Nome fantasia (opcional)",
                      })}
                    <div
                      className={
                        draft.type === "PJ" ? "account-row" : "account-form"
                      }
                    >
                      {field(
                        "phone",
                        draft.type === "PF" ? "Celular" : "Telefone",
                        {
                          icon: <Phone size={18} />,
                          type: "tel",
                          maxLength: 16,
                          placeholder: "(00) 00000-0000",
                          autoComplete: "tel-national",
                          onChange: (e) =>
                            setDraft((v) => ({
                              ...v,
                              phone: formatPhone(e.target.value),
                            })),
                        },
                      )}
                      {!editing &&
                        field("email", "E-mail", {
                          icon: <Mail size={18} />,
                          type: "email",
                          maxLength: 150,
                          placeholder: "seu@email.com",
                          autoComplete: "email",
                        })}
                    </div>
                    {draft.type === "PJ" &&
                      field("responsibleName", "Nome do proprietário", {
                        icon: <UserRound size={18} />,
                        placeholder: "Nome completo do proprietário",
                        pattern:
                          "[\\p{L}\\p{M}]+(?:[ '\u2019.\\-][\\p{L}\\p{M}]+)*",
                        title: "Use letras, sem números.",
                      })}
                    <div className="account-divider">
                      <MapPin size={15} />
                      Endereço *
                    </div>
                    {field("zip", "CEP", {
                      maxLength: 9,
                      inputMode: "numeric",
                      placeholder: "00000-000",
                      autoComplete: "postal-code",
                      onBlur: () => lookup("zip"),
                      onChange: (e) =>
                        setDraft((v) => ({
                          ...v,
                          zip: formatCEP(e.target.value),
                        })),
                    })}
                    {looking && (
                      <p role="status" className="account-help">
                        {looking}
                      </p>
                    )}
                    <div className="account-row account-row-address">
                      {field("street", "Rua / Avenida", {
                        maxLength: 150,
                        autoComplete: "address-line1",
                      })}
                      {field("streetNumber", "Número", { maxLength: 20 })}
                    </div>
                    {field("complement", "Complemento", {
                      maxLength: 80,
                      placeholder: "Apto, bloco... (opcional)",
                      autoComplete: "address-line2",
                    })}
                    {field("neighborhood", "Bairro", { maxLength: 80 })}
                    <div className="account-row account-row-address">
                      {field("city", "Cidade", {
                        maxLength: 80,
                        autoComplete: "address-level2",
                      })}
                      <label className="account-field">
                        <span>Estado *</span>
                        <div className="account-input">
                          <select
                            required
                            value={draft.state}
                            onChange={(e) =>
                              setDraft((v) => ({ ...v, state: e.target.value }))
                            }
                            autoComplete="address-level1"
                          >
                            <option value="">UF</option>
                            {UF_LIST.map((uf) => (
                              <option key={uf}>{uf}</option>
                            ))}
                          </select>
                        </div>
                      </label>
                    </div>
                    {!editing && passwords()}
                  </>
                )}
                {(screen === "recover" || screen === "email") && (
                  <Input
                    label={
                      screen === "email" ? "Novo e-mail" : "E-mail cadastrado"
                    }
                    type="email"
                    required
                    icon={<Mail size={18} />}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={150}
                    placeholder="seu@email.com"
                    autoComplete="email"
                  />
                )}
                {screen === "email" && (
                  <Input
                    label="Senha atual"
                    type="password"
                    required
                    icon={<LockKeyhole size={18} />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={128}
                    autoComplete="current-password"
                  />
                )}
                {screen === "verify" && (
                  <Input
                    label="Código de 6 dígitos"
                    icon={<LockKeyhole size={18} />}
                    required
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="Digite o código"
                    autoComplete="one-time-code"
                  />
                )}
                {screen === "reset" && passwords()}
                <button
                  className="account-primary"
                  type="submit"
                  disabled={busy || !!looking}
                >
                  {busy
                    ? "Aguarde..."
                    : {
                        login: "Entrar",
                        register: "Criar conta",
                        recover: "Enviar código",
                        verify: "Verificar código",
                        reset: "Alterar senha",
                        edit: "Salvar alterações",
                        email: "Enviar código",
                        profile: "",
                      }[screen]}
                </button>
              </fieldset>
            </form>
            {screen === "login" && (
              <div className="account-links">
                <button
                  className="account-link"
                  style={{ color: "#6b7f9f", textDecoration: "underline" }}
                  onClick={() => {
                    setEmail(username.includes("@") ? username : "");
                    go("recover");
                  }}
                  disabled={busy}
                >
                  Esqueci minha senha
                </button>
                <button
                  className="account-link"
                  onClick={() => go("register")}
                  disabled={busy}
                >
                  Criar nova conta
                </button>
              </div>
            )}
            {screen === "verify" && (
              <button
                className="account-link account-back"
                disabled={busy || countdown > 0}
                onClick={() =>
                  run(async () => {
                    const result = await accountRequest<{
                      challengeId: string;
                    }>(
                      purpose === "email"
                        ? "/api/accounts/email/resend"
                        : "/api/accounts/resend",
                      { challengeId: challenge },
                    );
                    if (alive.current) {
                      setChallenge(result.challengeId);
                      setCode("");
                      setCountdown(60);
                      setNotice("Novo código solicitado. Confira seu e-mail.");
                    }
                  })
                }
              >
                <ArrowLeft size={15} />
                {countdown > 0
                  ? `Solicitar novo código em ${countdown}s`
                  : "Solicitar novo código"}
              </button>
            )}
            {screen === "recover" && (
              <button
                className="account-link account-back"
                onClick={() => go("login")}
                disabled={busy}
              >
                <ArrowLeft size={15} />
                Voltar ao login
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
