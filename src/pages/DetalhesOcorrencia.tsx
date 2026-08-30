import {
  useEffect,
  useState,
} from "react";
import type { FormEvent } from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageCircle,
  Send,
  Share2,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import { supabase } from "../services/supabase";
import "./DetalhesOcorrencia.css";
import "./Comentarios.css";

type Ocorrencia = {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  endereco: string;
  latitude: number;
  longitude: number;
  urgencia: "baixa" | "media" | "alta";
  status:
    | "aberto"
    | "em_analise"
    | "encaminhado"
    | "em_andamento"
    | "aguardando_recursos"
    | "resolvido"
    | "nao_solucionado"
    | "duplicado"
    | "cancelado";
  foto_url: string | null;
  video_url: string | null;
  tipo_terreno: string | null;
  condicao_local: string | null;
  criado_em: string;
  apoios: number | null;
  resposta_oficial: string | null;
  previsao_atendimento: string | null;
};

type Comentario = {
  id: string;
  ocorrencia_id: string;
  user_id: string;
  autor_nome: string;
  autor_avatar_url: string | null;
  conteudo: string;
  criado_em: string;
};

function DetalhesOcorrencia() {
  const { id } = useParams<{ id: string }>();

  const [ocorrencia, setOcorrencia] =
    useState<Ocorrencia | null>(null);

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviandoApoio, setEnviandoApoio] =
    useState(false);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [carregandoComentarios, setCarregandoComentarios] = useState(true);
  const [publicandoComentario, setPublicandoComentario] = useState(false);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [usuarioAdministrador, setUsuarioAdministrador] = useState(false);

  useEffect(() => {
    carregarOcorrencia();
  }, [id]);

  useEffect(() => {
    carregarUsuario();
    carregarComentarios();

    if (!id) return;

    const canal = supabase
      .channel(`comentarios-ocorrencia-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comentarios_ocorrencias",
          filter: `ocorrencia_id=eq.${id}`,
        },
        () => carregarComentarios()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [id]);

  async function carregarUsuario() {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id ?? null;
    setUsuarioId(userId);

    if (userId) {
      const { data: ehAdministrador } = await supabase.rpc(
        "usuario_eh_administrador"
      );
      setUsuarioAdministrador(Boolean(ehAdministrador));
    }
  }

  async function carregarComentarios() {
    if (!id) return;
    setCarregandoComentarios(true);

    const { data, error } = await supabase
      .from("comentarios_ocorrencias")
      .select("*")
      .eq("ocorrencia_id", id)
      .order("criado_em", { ascending: true });

    if (error) {
      setErro(`Não foi possível carregar os comentários: ${error.message}`);
    } else {
      setComentarios((data ?? []) as Comentario[]);
    }

    setCarregandoComentarios(false);
  }

  async function publicarComentario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!usuarioId) {
      setErro("Entre na sua conta para publicar um comentário.");
      return;
    }

    const conteudo = novoComentario.trim();
    if (conteudo.length < 2 || conteudo.length > 600) {
      setErro("O comentário deve possuir entre 2 e 600 caracteres.");
      return;
    }

    setPublicandoComentario(true);
    setErro("");

    const { error } = await supabase.rpc("publicar_comentario_ocorrencia", {
      p_ocorrencia_id: id,
      p_conteudo: conteudo,
    });

    if (error) {
      setErro(`Não foi possível publicar: ${error.message}`);
    } else {
      setNovoComentario("");
      setMensagem("Comentário publicado com sucesso.");
      await carregarComentarios();
    }

    setPublicandoComentario(false);
  }

  async function excluirComentario(comentario: Comentario) {
    if (!window.confirm("Deseja excluir este comentário?")) return;

    const { error } = await supabase
      .from("comentarios_ocorrencias")
      .delete()
      .eq("id", comentario.id);

    if (error) {
      setErro(`Não foi possível excluir: ${error.message}`);
    } else {
      setMensagem("Comentário excluído.");
      await carregarComentarios();
    }
  }

  async function carregarOcorrencia() {
    if (!id) {
      setErro("Ocorrência inválida.");
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro("");

    const { data, error } = await supabase
      .from("ocorrencias")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      setErro(
        `Não foi possível carregar a ocorrência: ${error.message}`
      );
      setCarregando(false);
      return;
    }

    if (!data) {
      setErro("Esta ocorrência não foi encontrada.");
      setCarregando(false);
      return;
    }

    setOcorrencia(data as Ocorrencia);
    setCarregando(false);
  }

  async function compartilhar() {
    if (!ocorrencia) {
      return;
    }

    const dados = {
      title: ocorrencia.titulo,
      text: `Confira esta ocorrência no Meu Bairro: ${ocorrencia.titulo}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(dados);
      } else {
        await navigator.clipboard.writeText(
          window.location.href
        );
        setMensagem("Link copiado.");
      }
    } catch (erroCompartilhamento) {
      if (
        erroCompartilhamento instanceof DOMException &&
        erroCompartilhamento.name === "AbortError"
      ) {
        return;
      }

      setErro("Não foi possível compartilhar o link.");
    }
  }

  async function apoiarOcorrencia() {
    if (!ocorrencia || !id) {
      return;
    }

    const chaveApoio = `meu-bairro-apoio-${id}`;

    if (localStorage.getItem(chaveApoio)) {
      setMensagem(
        "Você já confirmou que também enfrenta este problema."
      );
      return;
    }

    setEnviandoApoio(true);
    setErro("");
    setMensagem("");

    const { data, error } = await supabase
      .rpc("apoiar_ocorrencia", {
        ocorrencia_id: id,
      });

    if (error) {
      setErro(
        `Não foi possível registrar seu apoio: ${error.message}`
      );
      setEnviandoApoio(false);
      return;
    }

    localStorage.setItem(chaveApoio, "true");

    setOcorrencia((valorAtual) =>
      valorAtual
        ? {
            ...valorAtual,
            apoios: Number(data),
          }
        : valorAtual
    );

    setMensagem(
      "Obrigado! Sua confirmação foi registrada."
    );
    setEnviandoApoio(false);
  }

  if (carregando) {
    return (
      <main className="detalhes-pagina detalhes-centralizado">
        <Clock3 size={38} />
        <p>Carregando ocorrência...</p>
      </main>
    );
  }

  if (erro && !ocorrencia) {
    return (
      <main className="detalhes-pagina detalhes-centralizado">
        <TriangleAlert size={48} />
        <h1>Não foi possível abrir</h1>
        <p>{erro}</p>
        <Link to="/ocorrencias">
          Voltar para ocorrências
        </Link>
      </main>
    );
  }

  if (!ocorrencia) {
    return null;
  }

  const mapaUrl = criarUrlMapa(
    ocorrencia.latitude,
    ocorrencia.longitude
  );

  return (
    <main className="detalhes-pagina">
      <Link
        className="detalhes-voltar"
        to="/ocorrencias"
      >
        <ArrowLeft size={19} />
        Voltar para ocorrências
      </Link>

      <section className="detalhes-cabecalho">
        <div>
          <span className="detalhes-etiqueta">
            {formatarCategoria(ocorrencia.categoria)}
          </span>

          <h1>{ocorrencia.titulo}</h1>

          <p>
            Protocolo MB-{ocorrencia.id
              .slice(0, 8)
              .toUpperCase()}
          </p>
        </div>

        <div className="detalhes-selos">
          <span className={`detalhes-status ${ocorrencia.status}`}>
            {formatarStatus(ocorrencia.status)}
          </span>

          <span className={`detalhes-urgencia ${ocorrencia.urgencia}`}>
            Urgência {formatarUrgencia(ocorrencia.urgencia)}
          </span>
        </div>
      </section>

      {erro && (
        <div className="detalhes-mensagem erro">
          <TriangleAlert size={20} />
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="detalhes-mensagem sucesso">
          <CheckCircle2 size={20} />
          {mensagem}
        </div>
      )}

      <div className="detalhes-grade">
        <section className="detalhes-principal">
          <div className="detalhes-midia">
            {ocorrencia.foto_url ? (
              <img
                src={ocorrencia.foto_url}
                alt={ocorrencia.titulo}
              />
            ) : ocorrencia.video_url ? (
              <video
                src={ocorrencia.video_url}
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <div className="detalhes-sem-foto">
                <TriangleAlert size={48} />
                <span>Ocorrência sem fotografia.</span>
              </div>
            )}
          </div>

          {ocorrencia.foto_url && ocorrencia.video_url && (
            <div className="detalhes-video">
              <h2>Vídeo da ocorrência</h2>
              <video
                src={ocorrencia.video_url}
                controls
                playsInline
                preload="metadata"
              />
            </div>
          )}

          <article className="detalhes-descricao">
            <h2>Descrição do problema</h2>
            <p>{ocorrencia.descricao}</p>
          </article>

          {ocorrencia.resposta_oficial?.trim() && (
            <article className="detalhes-resposta-oficial">
              <span>Atualização oficial</span>
              <h2>Resposta da equipe responsável</h2>
              <p>{ocorrencia.resposta_oficial}</p>
            </article>
          )}

          <article className="detalhes-descricao">
            <h2>Condições do terreno</h2>
            <p>
              <strong>Tipo de terreno:</strong>{" "}
              {formatarTerreno(ocorrencia.tipo_terreno)}
            </p>
            <p>
              <strong>Condição do local:</strong>{" "}
              {formatarCondicaoLocal(ocorrencia.condicao_local)}
            </p>

            {(ocorrencia.condicao_local === "rachaduras" ||
              ocorrencia.condicao_local === "pequeno_deslizamento" ||
              ocorrencia.condicao_local === "deslizamento_andamento") && (
              <div className="detalhes-alerta-risco">
                Situação de risco: afaste-se do local e ligue para a Defesa Civil no número 199.
              </div>
            )}
          </article>

          <section className="detalhes-mapa">
            <div>
              <h2>Localização</h2>
              <p>
                <MapPin size={18} />
                {ocorrencia.endereco}
              </p>
            </div>

            <iframe
              title="Localização da ocorrência"
              src={mapaUrl}
              loading="lazy"
            />

            <Link
              to={`/mapa?ocorrencia=${ocorrencia.id}`}
            >
              Abrir no mapa colaborativo
            </Link>
          </section>
        </section>

        <aside className="detalhes-lateral">
          <section className="detalhes-informacoes">
            <h2>Informações</h2>

            <div>
              <CalendarDays size={20} />
              <span>
                <small>Registrada em</small>
                {formatarData(ocorrencia.criado_em)}
              </span>
            </div>

            <div>
              <MapPin size={20} />
              <span>
                <small>Endereço</small>
                {ocorrencia.endereco}
              </span>
            </div>

            <div>
              <Clock3 size={20} />
              <span>
                <small>Previsão de atendimento</small>
                {ocorrencia.previsao_atendimento
                  ? formatarSomenteData(
                      ocorrencia.previsao_atendimento
                    )
                  : "Ainda não informada"}
              </span>
            </div>
          </section>

          <section className="detalhes-andamento">
            <h2>Andamento</h2>
            <Etapa
              concluida
              titulo="Ocorrência registrada"
            />
            <Etapa
              concluida={statusAtingiuEtapa(ocorrencia.status, 1)}
              titulo="Em análise"
            />
            <Etapa
              concluida={statusAtingiuEtapa(ocorrencia.status, 2)}
              titulo="Encaminhada à equipe responsável"
            />
            <Etapa
              concluida={statusAtingiuEtapa(ocorrencia.status, 3)}
              titulo="Atendimento em andamento"
            />
            <Etapa
              concluida={ocorrencia.status === "resolvido"}
              titulo="Problema resolvido"
            />

            {["nao_solucionado", "duplicado", "cancelado"].includes(
              ocorrencia.status
            ) && (
              <div className="detalhes-encerramento">
                Situação encerrada como: {formatarStatus(ocorrencia.status)}.
              </div>
            )}
          </section>

          <section className="detalhes-participacao">
            <h2>Este problema também afeta você?</h2>
            <p>
              Confirme para ajudar a comunidade a identificar as situações mais urgentes.
            </p>

            <strong>
              {ocorrencia.apoios ?? 0} confirmações
            </strong>

            <button
              type="button"
              onClick={apoiarOcorrencia}
              disabled={enviandoApoio}
            >
              <ThumbsUp size={19} />
              {enviandoApoio
                ? "Confirmando..."
                : "Também tenho esse problema"}
            </button>

            <button
              className="detalhes-compartilhar"
              type="button"
              onClick={compartilhar}
            >
              <Share2 size={19} />
              Compartilhar ocorrência
            </button>
          </section>
        </aside>
      </div>

      <section className="comentarios-secao">
        <header className="comentarios-cabecalho">
          <div>
            <span>Participação dos moradores</span>
            <h2>Comentários da comunidade</h2>
            <p>Compartilhe uma atualização útil sobre esta ocorrência.</p>
          </div>
          <strong>
            <MessageCircle size={19} />
            {comentarios.length} {comentarios.length === 1 ? "comentário" : "comentários"}
          </strong>
        </header>

        {usuarioId ? (
          <form className="comentario-formulario" onSubmit={publicarComentario}>
            <textarea
              value={novoComentario}
              onChange={(evento) => setNovoComentario(evento.target.value)}
              maxLength={600}
              placeholder="Escreva uma informação sobre esta ocorrência..."
              aria-label="Novo comentário"
            />
            <div>
              <small>{novoComentario.length}/600 caracteres</small>
              <button type="submit" disabled={publicandoComentario}>
                <Send size={18} />
                {publicandoComentario ? "Publicando..." : "Publicar comentário"}
              </button>
            </div>
          </form>
        ) : (
          <div className="comentario-login">
            <UserRound size={25} />
            <div>
              <strong>Entre para participar</strong>
              <p>Somente usuários identificados podem comentar.</p>
            </div>
            <Link to="/login">Entrar na conta</Link>
          </div>
        )}

        <div className="comentarios-lista">
          {carregandoComentarios ? (
            <p className="comentarios-vazio">Carregando comentários...</p>
          ) : comentarios.length === 0 ? (
            <p className="comentarios-vazio">
              Ainda não há comentários. Seja a primeira pessoa a contribuir.
            </p>
          ) : (
            comentarios.map((comentario) => (
              <article className="comentario-item" key={comentario.id}>
                {comentario.autor_avatar_url ? (
                  <img src={comentario.autor_avatar_url} alt="" />
                ) : (
                  <span className="comentario-avatar"><UserRound size={23} /></span>
                )}
                <div className="comentario-conteudo">
                  <header>
                    <div>
                      <strong>{comentario.autor_nome}</strong>
                      <time dateTime={comentario.criado_em}>
                        {formatarData(comentario.criado_em)}
                      </time>
                    </div>
                    {(usuarioId === comentario.user_id || usuarioAdministrador) && (
                      <button
                        type="button"
                        onClick={() => excluirComentario(comentario)}
                        title="Excluir comentário"
                        aria-label="Excluir comentário"
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </header>
                  <p>{comentario.conteudo}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function Etapa({
  concluida,
  titulo,
}: {
  concluida: boolean;
  titulo: string;
}) {
  return (
    <div className={`detalhes-etapa ${concluida ? "concluida" : ""}`}>
      <span>{concluida ? "✓" : ""}</span>
      <p>{titulo}</p>
    </div>
  );
}

function criarUrlMapa(latitude: number, longitude: number) {
  const distancia = 0.008;
  const oeste = longitude - distancia;
  const sul = latitude - distancia;
  const leste = longitude + distancia;
  const norte = latitude + distancia;

  const parametros = new URLSearchParams({
    bbox: `${oeste},${sul},${leste},${norte}`,
    layer: "mapnik",
    marker: `${latitude},${longitude}`,
  });

  return `https://www.openstreetmap.org/export/embed.html?${parametros.toString()}`;
}

function formatarData(data: string) {
  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarSomenteData(data: string) {
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function statusAtingiuEtapa(status: string, etapa: number) {
  const ordem: Record<string, number> = {
    aberto: 0,
    em_analise: 1,
    encaminhado: 2,
    em_andamento: 3,
    aguardando_recursos: 3,
    resolvido: 4,
  };

  return (ordem[status] ?? 0) >= etapa;
}

function formatarCategoria(categoria: string) {
  const categorias: Record<string, string> = {
    buraco: "Buraco na rua",
    iluminacao: "Iluminação pública",
    lixo: "Lixo acumulado",
    alagamento: "Alagamento",
    calcada: "Calçada danificada",
    deslizamento: "Deslizamento de terra ou barreira",
    outro: "Outro problema",
  };

  return categorias[categoria] || categoria;
}

function formatarTerreno(valor: string | null) {
  const terrenos: Record<string, string> = {
    plano: "Plano",
    encosta: "Encosta",
    morro: "Área de morro",
    canal_rio: "Próximo a canal ou rio",
    nao_identificado: "Não identificado",
  };

  return valor ? terrenos[valor] || valor : "Não informado";
}

function formatarCondicaoLocal(valor: string | null) {
  const condicoes: Record<string, string> = {
    normal: "Normal",
    solo_encharcado: "Solo encharcado",
    rachaduras: "Rachaduras no terreno",
    pequeno_deslizamento: "Pequeno deslizamento",
    deslizamento_andamento: "Deslizamento em andamento",
  };

  return valor ? condicoes[valor] || valor : "Não informada";
}

function formatarStatus(status: string) {
  const statusFormatado: Record<string, string> = {
    aberto: "Aberta",
    em_analise: "Em análise",
    encaminhado: "Encaminhada",
    em_andamento: "Em andamento",
    aguardando_recursos: "Aguardando recursos",
    resolvido: "Resolvida",
    nao_solucionado: "Não solucionada",
    duplicado: "Duplicada",
    cancelado: "Cancelada",
  };

  return statusFormatado[status] || status;
}

function formatarUrgencia(urgencia: string) {
  const urgencias: Record<string, string> = {
    baixa: "baixa",
    media: "média",
    alta: "alta",
  };

  return urgencias[urgencia] || urgencia;
}

export default DetalhesOcorrencia;
