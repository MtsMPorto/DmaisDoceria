import { createBrowserRouter, redirect } from "react-router";
import Store from "./pages/store/Store";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminPanel from "./pages/admin/AdminPanel";
import ProductPage from "./pages/store/ProductPage";
import { ApiError } from "./services/api";
import { fetchMe, hasStoredToken } from "./services/authService";

// O painel só abre depois que o servidor confirma o token (GET /api/auth/me).
// 401 derruba a sessão (api.ts) e volta ao login; falha de rede também volta, com aviso.
async function requireAuth() {
  if (!hasStoredToken()) return redirect("/admin");
  try {
    await fetchMe();
    return null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return redirect("/admin?motivo=sessao");
    return redirect("/admin?motivo=conexao");
  }
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Store,
  },
  {
    path: "/product/:id",
    Component: ProductPage,
  },
  {
    path: "/admin",
    Component: AdminLogin,
  },
  {
    path: "/admin/panel",
    loader: requireAuth,
    Component: AdminPanel,
  },
]);
