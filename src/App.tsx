import {
  useEffect,
  useState,
} from "react";

import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import {
  CircleUserRound,
  ClipboardList,
  House,
  Map,
  ShieldCheck,
} from "lucide-react";

import type { User } from "@supabase/supabase-js";

import Inicio from "./pages/Inicio";
import Mapa from "./pages/Mapa";
import Registrar from "./pages/Registrar";
import Ocorrencias from "./pages/Ocorrencias";
import DetalhesOcorrencia from "./pages/DetalhesOcorrencia";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Perfil from "./pages/Perfil";

import RegistrarVisita from "./components/RegistrarVisita";
import { supabase } from "./services/supabase";

import logoMeuBairro from "./assets/logo-meu-bairro.png";

import "./App.css";
import "./Tema.css";
import "./NovaPaleta.css";
import "./PaginasClaras.css";
import "./AjustesFinais.css";
import "./InicioProfissional.css";
import "./CabecalhoProfissional.css";

function App() {
  const [usuario, setUsuario] =
    useState<User | null>(null);

  const [administrador, setAdministrador] =
    useState(false);

  const [verificandoAcesso, setVerificandoAcesso] =
    useState(true);

  useEffect(() => {
    verificarUsuarioAtual();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_evento, sessao) => {
        const usuarioAtual =
          sessao?.user ?? null;

        setUsuario(usuarioAtual);
        setVerificandoAcesso(true);

        if (!usuarioAtual) {
          setAdministrador(false);
          setVerificandoAcesso(false);
          return;
        }

        window.setTimeout(() => {
          verificarPermissaoAdministrador(
            usuarioAtual.id
          );
        }, 0);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function verificarUsuarioAtual() {
    setVerificandoAcesso(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUsuario(user);

    if (!user) {
      setAdministrador(false);
      setVerificandoAcesso(false);
      return;
    }

    await verificarPermissaoAdministrador(
      user.id
    );
  }

  async function verificarPermissaoAdministrador(
    usuarioId: string
  ) {
    const { data, error } = await supabase
      .from("administradores")
      .select("user_id")
      .eq("user_id", usuarioId)
      .maybeSingle();

    if (error) {
      console.error(
        "Erro ao verificar administrador:",
        error.message
      );

      setAdministrador(false);
      setVerificandoAcesso(false);
      return;
    }

    setAdministrador(Boolean(data));
    setVerificandoAcesso(false);
  }

  return (
    <BrowserRouter>
      <RolarParaTopo />
      <RegistrarVisita />

      <div className="aplicacao">
        <header className="cabecalho">
          <Link
            to={administrador ? "/admin" : "/"}
            className="logo"
          >
            <img
              className="logo-imagem"
              src={logoMeuBairro}
              alt="Logo do Meu Bairro"
            />

            <div>
              <strong>Meu Bairro</strong>

              <small>
                Juntos por uma cidade melhor
              </small>
            </div>
          </Link>

          <nav className="menu">
            {!administrador && (
              <>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    isActive ? "menu-ativo" : ""
                  }
                >
                  <House size={19} />
                  Início
                </NavLink>

                <NavLink
                  to="/mapa"
                  className={({ isActive }) =>
                    isActive ? "menu-ativo" : ""
                  }
                >
                  <Map size={19} />
                  Mapa
                </NavLink>

                <NavLink
                  to="/ocorrencias"
                  className={({ isActive }) =>
                    isActive ? "menu-ativo" : ""
                  }
                >
                  <ClipboardList size={19} />
                  Ocorrências
                </NavLink>

                <NavLink
                  to={
                    usuario
                      ? "/perfil"
                      : "/entrar"
                  }
                  className={({ isActive }) =>
                    isActive ? "menu-ativo" : ""
                  }
                >
                  <CircleUserRound size={19} />

                  {usuario
                    ? "Perfil"
                    : "Entrar"}
                </NavLink>
              </>
            )}

            {administrador && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  isActive ? "menu-ativo" : ""
                }
              >
                <ShieldCheck size={19} />
                Admin
              </NavLink>
            )}
          </nav>
        </header>

        <Routes>
          <Route
            path="/"
            element={
              administrador ? (
                <Navigate
                  to="/admin"
                  replace
                />
              ) : (
                <Inicio />
              )
            }
          />

          <Route
            path="/mapa"
            element={<Mapa />}
          />

          <Route
            path="/registrar"
            element={<Registrar />}
          />

          <Route
            path="/ocorrencias"
            element={<Ocorrencias />}
          />

          <Route
            path="/ocorrencias/:id"
            element={<DetalhesOcorrencia />}
          />

          <Route
            path="/entrar"
            element={<Login />}
          />

          <Route
            path="/cadastro"
            element={<Cadastro />}
          />

          <Route
            path="/perfil"
            element={
              verificandoAcesso ? (
                <CarregandoAcesso />
              ) : administrador ? (
                <Navigate
                  to="/admin"
                  replace
                />
              ) : (
                <Perfil />
              )
            }
          />

          <Route
            path="/admin"
            element={<Admin />}
          />

          <Route
            path="*"
            element={<PaginaNaoEncontrada />}
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function RolarParaTopo() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function CarregandoAcesso() {
  return (
    <main className="pagina">
      <p>Verificando sua conta...</p>
    </main>
  );
}

function PaginaNaoEncontrada() {
  return (
    <main className="pagina">
      <h1>Página não encontrada</h1>

      <p>
        O endereço acessado não existe.
      </p>

      <Link
        to="/"
        className="botao-principal"
      >
        Voltar para o início
      </Link>
    </main>
  );
}

export default App;
