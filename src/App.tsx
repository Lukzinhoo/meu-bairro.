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

/*
 * Este arquivo deve ser o último CSS importado.
 * Assim, o novo cabeçalho sempre terá prioridade.
 */
import "./CabecalhoProfissional.css";

function App() {
  const [usuario, setUsuario] =
    useState<User | null>(null);

  const [administrador, setAdministrador] =
    useState(false);

  const [verificandoAcesso, setVerificandoAcesso] =
    useState(true);

  useEffect(() => {
    let componenteAtivo = true;

    async function iniciarAutenticacao() {
      setVerificandoAcesso(true);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!componenteAtivo) {
        return;
      }

      if (error) {
        console.error(
          "Erro ao verificar usuário:",
          error.message
        );

        setUsuario(null);
        setAdministrador(false);
        setVerificandoAcesso(false);
        return;
      }

      setUsuario(user);

      if (!user) {
        setAdministrador(false);
        setVerificandoAcesso(false);
        return;
      }

      await verificarPermissaoAdministrador(
        user.id,
        componenteAtivo
      );
    }

    iniciarAutenticacao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_evento, sessao) => {
        const usuarioAtual =
          sessao?.user ?? null;

        if (!componenteAtivo) {
          return;
        }

        setUsuario(usuarioAtual);

        if (!usuarioAtual) {
          setAdministrador(false);
          setVerificandoAcesso(false);
          return;
        }

        setVerificandoAcesso(true);

        /*
         * O pequeno atraso evita conflito entre
         * onAuthStateChange e novas consultas.
         */
        window.setTimeout(() => {
          if (!componenteAtivo) {
            return;
          }

          verificarPermissaoAdministrador(
            usuarioAtual.id,
            componenteAtivo
          );
        }, 0);
      }
    );

    return () => {
      componenteAtivo = false;
      subscription.unsubscribe();
    };
  }, []);

  async function verificarPermissaoAdministrador(
    usuarioId: string,
    componenteAtivo = true
  ) {
    const { data, error } = await supabase
      .from("administradores")
      .select("user_id")
      .eq("user_id", usuarioId)
      .maybeSingle();

    if (!componenteAtivo) {
      return;
    }

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

      <div className="mb-aplicacao">
        <CabecalhoDesktop
          usuario={usuario}
          administrador={administrador}
        />

        <CabecalhoMobile
          administrador={administrador}
        />

        <MenuMobile
          usuario={usuario}
          administrador={administrador}
        />

        <Routes>
          <Route
            path="/"
            element={
              verificandoAcesso ? (
                <CarregandoAcesso />
              ) : administrador ? (
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
            element={
              verificandoAcesso ? (
                <CarregandoAcesso />
              ) : usuario ? (
                <Navigate
                  to={
                    administrador
                      ? "/admin"
                      : "/perfil"
                  }
                  replace
                />
              ) : (
                <Login />
              )
            }
          />

          <Route
            path="/cadastro"
            element={
              verificandoAcesso ? (
                <CarregandoAcesso />
              ) : usuario ? (
                <Navigate
                  to={
                    administrador
                      ? "/admin"
                      : "/perfil"
                  }
                  replace
                />
              ) : (
                <Cadastro />
              )
            }
          />

          <Route
            path="/perfil"
            element={
              verificandoAcesso ? (
                <CarregandoAcesso />
              ) : !usuario ? (
                <Navigate
                  to="/entrar"
                  replace
                />
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
            element={
              verificandoAcesso ? (
                <CarregandoAcesso />
              ) : !usuario ? (
                <Navigate
                  to="/entrar"
                  replace
                />
              ) : administrador ? (
                <Admin />
              ) : (
                <Navigate
                  to="/"
                  replace
                />
              )
            }
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

type PropriedadesMenu = {
  usuario: User | null;
  administrador: boolean;
};

type PropriedadesCabecalhoMobile = {
  administrador: boolean;
};

function CabecalhoDesktop({
  usuario,
  administrador,
}: PropriedadesMenu) {
  return (
    <header className="mb-cabecalho-desktop">
      <Link
        to={administrador ? "/admin" : "/"}
        className="mb-logo"
      >
        <img
          className="mb-logo-imagem"
          src={logoMeuBairro}
          alt="Logo do Meu Bairro"
        />

        <span className="mb-logo-texto">
          <strong>Meu Bairro</strong>

          <small>
            Juntos por uma cidade melhor
          </small>
        </span>
      </Link>

      <nav
        className="mb-menu-desktop"
        aria-label="Menu principal"
      >
        <LinksDoMenu
          usuario={usuario}
          administrador={administrador}
        />
      </nav>
    </header>
  );
}

function CabecalhoMobile({
  administrador,
}: PropriedadesCabecalhoMobile) {
  return (
    <header className="mb-cabecalho-mobile">
      <Link
        to={administrador ? "/admin" : "/"}
        className="mb-logo-mobile"
      >
        <img
          className="mb-logo-mobile-imagem"
          src={logoMeuBairro}
          alt="Logo do Meu Bairro"
        />

        <span className="mb-logo-mobile-texto">
          <strong>Meu Bairro</strong>

          <small>
            Juntos por uma cidade melhor
          </small>
        </span>
      </Link>
    </header>
  );
}

function MenuMobile({
  usuario,
  administrador,
}: PropriedadesMenu) {
  return (
    <nav
      className={
        administrador
          ? "mb-menu-mobile mb-menu-mobile-admin"
          : "mb-menu-mobile"
      }
      aria-label="Menu mobile"
    >
      <LinksDoMenu
        usuario={usuario}
        administrador={administrador}
      />
    </nav>
  );
}

function LinksDoMenu({
  usuario,
  administrador,
}: PropriedadesMenu) {
  if (administrador) {
    return (
      <NavLink
        to="/admin"
        className={({ isActive }) =>
          isActive
            ? "mb-link-menu mb-link-ativo"
            : "mb-link-menu"
        }
      >
        <ShieldCheck aria-hidden="true" />
        <span>Admin</span>
      </NavLink>
    );
  }

  return (
    <>
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          isActive
            ? "mb-link-menu mb-link-ativo"
            : "mb-link-menu"
        }
      >
        <House aria-hidden="true" />
        <span>Início</span>
      </NavLink>

      <NavLink
        to="/mapa"
        className={({ isActive }) =>
          isActive
            ? "mb-link-menu mb-link-ativo"
            : "mb-link-menu"
        }
      >
        <Map aria-hidden="true" />
        <span>Mapa</span>
      </NavLink>

      <NavLink
        to="/ocorrencias"
        className={({ isActive }) =>
          isActive
            ? "mb-link-menu mb-link-ativo"
            : "mb-link-menu"
        }
      >
        <ClipboardList aria-hidden="true" />
        <span>Ocorrências</span>
      </NavLink>

      <NavLink
        to={usuario ? "/perfil" : "/entrar"}
        className={({ isActive }) =>
          isActive
            ? "mb-link-menu mb-link-ativo"
            : "mb-link-menu"
        }
      >
        <CircleUserRound aria-hidden="true" />

        <span>
          {usuario ? "Perfil" : "Entrar"}
        </span>
      </NavLink>
    </>
  );
}

function RolarParaTopo() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
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