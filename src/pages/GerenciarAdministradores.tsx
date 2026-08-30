import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  Mail,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { supabase } from "../services/supabase";

type Administrador = {
  user_id: string;
  email: string;
  nome: string;
  criado_em: string;
};

function GerenciarAdministradores() {
  const [administradores, setAdministradores] =
    useState<Administrador[]>([]);
  const [usuarioAtualId, setUsuarioAtualId] = useState("");
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [adicionando, setAdicionando] = useState(false);
  const [removendoId, setRemovendoId] =
    useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    carregarAdministradores();
  }, []);

  async function carregarAdministradores() {
    setCarregando(true);
    setErro("");

    const [{ data: usuarios }, resultado] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc("listar_administradores"),
    ]);

    setUsuarioAtualId(usuarios.user?.id ?? "");

    if (resultado.error) {
      setErro(
        `Não foi possível carregar os administradores: ${resultado.error.message}`
      );
      setCarregando(false);
      return;
    }

    setAdministradores(
      (resultado.data ?? []) as Administrador[]
    );
    setCarregando(false);
  }

  async function adicionar(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();
    setErro("");
    setMensagem("");

    const emailNormalizado = email.trim().toLowerCase();

    if (!emailNormalizado) {
      setErro("Informe o e-mail do usuário.");
      return;
    }

    setAdicionando(true);

    const { error } = await supabase.rpc(
      "adicionar_administrador",
      { email_usuario: emailNormalizado }
    );

    if (error) {
      setErro(traduzirErro(error.message));
      setAdicionando(false);
      return;
    }

    setEmail("");
    setMensagem("Permissão administrativa concedida.");
    await carregarAdministradores();
    setAdicionando(false);
  }

  async function remover(administrador: Administrador) {
    if (administrador.user_id === usuarioAtualId) {
      setErro("Você não pode remover sua própria permissão.");
      return;
    }

    const confirmou = window.confirm(
      `Remover a permissão administrativa de ${administrador.email}?`
    );

    if (!confirmou) return;

    setRemovendoId(administrador.user_id);
    setErro("");
    setMensagem("");

    const { error } = await supabase.rpc(
      "remover_administrador",
      { administrador_id: administrador.user_id }
    );

    if (error) {
      setErro(traduzirErro(error.message));
      setRemovendoId(null);
      return;
    }

    setMensagem("Permissão administrativa removida.");
    await carregarAdministradores();
    setRemovendoId(null);
  }

  return (
    <section className="admin-gerenciamento">
      <div className="admin-gerenciamento-topo">
        <div>
          <span>Controle de acesso</span>
          <h2>Administradores</h2>
          <p>
            Conceda acesso somente a contas confiáveis já cadastradas no site.
          </p>
        </div>

        <div className="admin-gerenciamento-quantidade">
          <Users size={20} />
          {administradores.length} administradores
        </div>
      </div>

      {erro && <div className="admin-erro">{erro}</div>}
      {mensagem && (
        <div className="admin-sucesso">
          <ShieldCheck size={19} />
          {mensagem}
        </div>
      )}

      <form className="admin-adicionar" onSubmit={adicionar}>
        <div>
          <Mail size={19} />
          <input
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            placeholder="E-mail de uma conta já cadastrada"
            disabled={adicionando}
            required
          />
        </div>

        <button type="submit" disabled={adicionando}>
          <UserPlus size={19} />
          {adicionando ? "Adicionando..." : "Adicionar administrador"}
        </button>
      </form>

      {carregando ? (
        <div className="admin-gerenciamento-carregando">
          <RefreshCw className="girando" />
          Carregando administradores...
        </div>
      ) : (
        <div className="admin-lista-administradores">
          {administradores.map((administrador) => (
            <article key={administrador.user_id}>
              <div className="admin-avatar-pequeno">
                {obterIniciais(administrador.nome)}
              </div>

              <div className="admin-identidade">
                <strong>{administrador.nome}</strong>
                <span>{administrador.email}</span>
                <small>
                  Administrador desde {formatarData(administrador.criado_em)}
                </small>
              </div>

              {administrador.user_id === usuarioAtualId ? (
                <span className="admin-conta-atual">Sua conta</span>
              ) : (
                <button
                  type="button"
                  className="admin-remover"
                  onClick={() => remover(administrador)}
                  disabled={removendoId === administrador.user_id}
                >
                  <Trash2 size={17} />
                  {removendoId === administrador.user_id
                    ? "Removendo..."
                    : "Remover acesso"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function obterIniciais(nome: string) {
  const partes = (nome || "ADM").trim().split(" ").filter(Boolean);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString("pt-BR");
}

function traduzirErro(mensagem: string) {
  if (mensagem.toLowerCase().includes("nenhuma conta")) {
    return "Nenhuma conta cadastrada foi encontrada com esse e-mail.";
  }
  if (mensagem.toLowerCase().includes("acesso negado")) {
    return "Sua conta não possui permissão para realizar esta ação.";
  }
  return mensagem;
}

export default GerenciarAdministradores;