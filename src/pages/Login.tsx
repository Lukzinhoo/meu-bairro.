import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye, EyeOff, KeyRound, LocateFixed, LockKeyhole,
  LogIn, Mail, ShieldCheck,
} from "lucide-react";
import {
  definirLembrarAcesso,
  obterPreferenciaLembrarAcesso,
  supabase,
} from "../services/supabase";
import mascoteMeuBairro from "../assets/hero-mascote-login-branco.png";
import "./Auth.css";
import "./LoginMascote.css";
import "./LoginFinal.css";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [modoAdministrador, setModoAdministrador] = useState(false);
  const [lembrarAcesso, setLembrarAcesso] = useState(
    obterPreferenciaLembrarAcesso()
  );
  const [localizacaoAtivada, setLocalizacaoAtivada] = useState(
    localStorage.getItem("meu_bairro_localizacao_ativada") === "true"
  );
  const [buscandoLocalizacao, setBuscandoLocalizacao] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [entrandoGoogle, setEntrandoGoogle] = useState(false);
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  async function usuarioEhAdministrador(usuarioId: string) {
    if (!usuarioId) {
      return false;
    }

    const { data, error } = await supabase.rpc(
      "usuario_eh_administrador"
    );

    if (error) {
      throw new Error(
        `Não foi possível verificar a permissão administrativa: ${error.message}`
      );
    }

    return data === true;
  }

  async function direcionarUsuario(usuarioId: string) {
    const administrador = await usuarioEhAdministrador(usuarioId);

    if (administrador) {
      await supabase.auth.signOut();

      throw new Error(
        "Esta é uma conta administrativa. Use a opção Entrar como administrador."
      );
    }

    navigate("/perfil", {
      replace: true,
    });
  }

  async function entrarNoPainelAdministrador(
    usuarioId: string
  ) {
    const administrador =
      await usuarioEhAdministrador(usuarioId);

    if (!administrador) {
      await supabase.auth.signOut();

      throw new Error(
        "Esta conta não possui permissão de administrador."
      );
    }

    /*
     * Mantém a sessão autenticada na memória e troca
     * somente a rota da aplicação, sem recarregar o site.
     */
    navigate("/admin", {
      replace: true,
    });
  }

  async function fazerLogin() {
    setErro("");
    setMensagem(
      modoAdministrador
        ? "Verificando acesso administrativo..."
        : "Verificando sua conta..."
    );

    if (!email.trim()) {
      setErro("Informe seu e-mail.");
      return;
    }
    if (!senha) {
      setErro("Informe sua senha.");
      return;
    }

    setEntrando(true);

    try {
      definirLembrarAcesso(lembrarAcesso);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });

      if (error) throw error;
      if (!data.user) throw new Error("Não foi possível acessar sua conta.");

      if (modoAdministrador) {
        await entrarNoPainelAdministrador(
          data.user.id
        );
      } else {
        await direcionarUsuario(data.user.id);
      }
    } catch (erroDesconhecido) {
      console.error("Erro ao entrar:", erroDesconhecido);
      setErro(
        erroDesconhecido instanceof Error
          ? traduzirErroLogin(erroDesconhecido.message)
          : "Não foi possível entrar. Tente novamente."
      );
    } finally {
      setEntrando(false);
    }
  }

  async function entrarComGoogle() {
    setErro("");
    setMensagem("");
    setEntrandoGoogle(true);

    try {
      definirLembrarAcesso(lembrarAcesso);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/perfil`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) throw error;
    } catch (erroDesconhecido) {
      console.error("Erro ao entrar com Google:", erroDesconhecido);
      setErro(
        erroDesconhecido instanceof Error
          ? `Não foi possível entrar com Google: ${erroDesconhecido.message}`
          : "Não foi possível entrar com Google."
      );
      setEntrandoGoogle(false);
    }
  }

  async function recuperarSenha() {
    setErro("");
    setMensagem("");
    const emailRecuperacao = email.trim().toLowerCase();

    if (!emailRecuperacao) {
      setErro("Digite seu e-mail antes de clicar em Esqueci minha senha.");
      return;
    }

    setEnviandoRecuperacao(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        emailRecuperacao,
        { redirectTo: `${window.location.origin}/redefinir-senha` }
      );
      if (error) throw error;
      setMensagem("Enviamos um link de recuperação para seu e-mail.");
    } catch (erroDesconhecido) {
      setErro(
        erroDesconhecido instanceof Error
          ? `Não foi possível enviar o link: ${erroDesconhecido.message}`
          : "Não foi possível enviar o link de recuperação."
      );
    } finally {
      setEnviandoRecuperacao(false);
    }
  }

  function ativarLocalizacao() {
    setErro("");
    setMensagem("");
    setBuscandoLocalizacao(true);

    if (!navigator.geolocation) {
      setErro("A localização não está disponível neste navegador.");
      setBuscandoLocalizacao(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        localStorage.setItem(
          "meu_bairro_localizacao",
          JSON.stringify({
            latitude: posicao.coords.latitude,
            longitude: posicao.coords.longitude,
            precisao: posicao.coords.accuracy,
            atualizadoEm: new Date().toISOString(),
          })
        );
        localStorage.setItem("meu_bairro_localizacao_ativada", "true");
        setLocalizacaoAtivada(true);
        setBuscandoLocalizacao(false);
        setMensagem("Localização em tempo real ativada.");
      },
      (erroLocalizacao) => {
        setBuscandoLocalizacao(false);
        setLocalizacaoAtivada(false);
        localStorage.removeItem("meu_bairro_localizacao");
        localStorage.setItem("meu_bairro_localizacao_ativada", "false");

        if (erroLocalizacao.code === erroLocalizacao.PERMISSION_DENIED) {
          setErro("A localização foi bloqueada no navegador.");
        } else if (erroLocalizacao.code === erroLocalizacao.TIMEOUT) {
          setErro("A busca pela localização demorou demais.");
        } else {
          setErro("Não foi possível obter sua localização.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  const bloqueado = entrando || entrandoGoogle;

  return (
    <main className="auth-pagina">
      <div className="auth-layout">
        <aside className="auth-apresentacao">
          <div className="auth-apresentacao-texto">
            <span>Comunidade conectada</span>
            <h2>Bem-vindo ao Meu Bairro</h2>
            <p>
              Entre para registrar, acompanhar e apoiar melhorias na sua comunidade.
            </p>
          </div>

          <img
            src={mascoteMeuBairro}
            alt="Mascote do Meu Bairro segurando um celular com o mapa da comunidade"
          />

          <div className="auth-apresentacao-destaques" aria-label="Recursos da plataforma">
            <span>Registre</span>
            <span>Acompanhe</span>
            <span>Participe</span>
          </div>
        </aside>

      <section className={`auth-cartao ${modoAdministrador ? "auth-modo-admin" : ""}`}>
        <div className="auth-icone">
          {modoAdministrador ? (
            <ShieldCheck size={36} />
          ) : (
            <LogIn size={36} />
          )}
        </div>

        <span className="auth-etiqueta">
          {modoAdministrador ? "Acesso restrito" : "Bem-vindo novamente"}
        </span>
        <h1>
          {modoAdministrador
            ? "Acesso administrativo"
            : "Entrar na sua conta"}
        </h1>
        <p>
          {modoAdministrador
            ? "Entre com uma conta que possui permissão para administrar o Meu Bairro."
            : "Entre para registrar problemas e acompanhar as ocorrências da comunidade."}
        </p>

        {erro && <div className="auth-erro">{erro}</div>}
        {mensagem && <div className="auth-sucesso">{mensagem}</div>}

        <form
          onSubmit={(evento: FormEvent<HTMLFormElement>) => {
            evento.preventDefault();
            void fazerLogin();
          }}
        >
          <label htmlFor="login-email">E-mail</label>
          <div className="auth-campo">
            <Mail size={19} />
            <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Digite seu e-mail" autoComplete="email" disabled={bloqueado} required />
          </div>

          <label htmlFor="login-senha">Senha</label>
          <div className="auth-campo">
            <LockKeyhole size={19} />
            <input id="login-senha" type={mostrarSenha ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Digite sua senha" autoComplete="current-password" disabled={bloqueado} required />
            <button className="auth-mostrar-senha" type="button" onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}>
              {mostrarSenha ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>

          <div className="auth-opcoes">
            <label className="auth-lembrar"><input type="checkbox" checked={lembrarAcesso} onChange={(e) => setLembrarAcesso(e.target.checked)} /><span>Lembrar meu acesso</span></label>
            <button className="auth-esqueci" type="button" onClick={recuperarSenha} disabled={enviandoRecuperacao}>
              <KeyRound size={16} />{enviandoRecuperacao ? "Enviando..." : "Esqueci minha senha"}
            </button>
          </div>

          {!modoAdministrador && (
            <button className="auth-localizacao" type="button" onClick={ativarLocalizacao} disabled={buscandoLocalizacao || entrando}>
              <LocateFixed size={19} />
              {buscandoLocalizacao ? "Buscando localização..." : localizacaoAtivada ? "Localização ativada" : "Ativar localização em tempo real"}
            </button>
          )}

          <button
            className="auth-botao"
            type="button"
            onClick={() => {
              setMensagem("Botão acionado. Verificando dados...");
              void fazerLogin();
            }}
            disabled={bloqueado}
          >
            {modoAdministrador ? <ShieldCheck size={19} /> : <LogIn size={19} />}
            {entrando
              ? "Entrando..."
              : modoAdministrador
                ? "Entrar no painel agora"
                : "Entrar"}
          </button>

          {modoAdministrador ? (
            <button
              className="auth-voltar-morador"
              type="button"
              onClick={() => {
                setModoAdministrador(false);
                setErro("");
                setMensagem("");
              }}
              disabled={bloqueado}
            >
              Voltar ao login de morador
            </button>
          ) : (
            <>
              <div className="auth-divisor"><span>ou</span></div>

              <button className="auth-google" type="button" onClick={entrarComGoogle} disabled={bloqueado}>
                <span className="google-letra">G</span>
                {entrandoGoogle ? "Abrindo Google..." : "Continuar com Google"}
              </button>

              <div className="auth-divisor auth-divisor-admin">
                <span>acesso restrito</span>
              </div>

              <button
                className="auth-entrar-admin"
                type="button"
                onClick={() => {
                  setModoAdministrador(true);
                  setErro("");
                  setMensagem("");
                  setSenha("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={bloqueado}
              >
                <ShieldCheck size={20} />
                Entrar como administrador
              </button>
            </>
          )}
        </form>

        {!modoAdministrador && (
          <div className="auth-rodape"><span>Ainda não possui uma conta?</span><Link to="/cadastro">Criar conta</Link></div>
        )}
      </section>
      </div>
    </main>
  );
}

function traduzirErroLogin(mensagem: string) {
  const texto = mensagem.toLowerCase();
  if (texto.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (texto.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (texto.includes("too many requests")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (texto.includes("failed to fetch") || texto.includes("network")) return "Não foi possível conectar ao servidor.";
  return mensagem;
}

export default Login;
