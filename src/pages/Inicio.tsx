import {
  useCallback,
  useEffect,
  useState,
  type SyntheticEvent,
} from "react";

import { Link } from "react-router-dom";

import {
  ArrowRight,
  AtSign,
  Camera,
  CheckCircle2,
  Clock3,
  ListChecks,
  Mail,
  MapPin,
  MessageCircle,
  Search,
} from "lucide-react";

import { supabase } from "../services/supabase";

type Resumo = {
  abertas: number;
  emAndamento: number;
  finalizadas: number;
};

type OcorrenciaBanco = {
  id?: string | number;
  titulo?: string | null;
  tipo?: string | null;
  categoria?: string | null;
  descricao?: string | null;
  bairro?: string | null;
  endereco?: string | null;
  localizacao?: string | null;
  status?: string | null;
  foto_url?: string | null;
  created_at?: string | null;
  criado_em?: string | null;
  data_criacao?: string | null;
};

type OcorrenciaRecente = {
  id: string;
  titulo: string;
  localizacao: string;
  status: string;
  data: string;
  icone: string;
  fotoUrl: string;
};

function Inicio() {
  const [erroBanner, setErroBanner] = useState(false);
  const [resumo, setResumo] = useState<Resumo>({
    abertas: 0,
    emAndamento: 0,
    finalizadas: 0,
  });

  const [
    ocorrenciasRecentes,
    setOcorrenciasRecentes,
  ] = useState<OcorrenciaRecente[]>([]);

  const [
    carregandoResumo,
    setCarregandoResumo,
  ] = useState(true);

  const [
    carregandoRecentes,
    setCarregandoRecentes,
  ] = useState(true);

  const carregarDados = useCallback(
    async () => {
      const { data, error } = await supabase
        .from("ocorrencias")
        .select("*");

      if (error) {
        console.error(
          "Erro ao carregar ocorrências:",
          error.message
        );

        setCarregandoResumo(false);
        setCarregandoRecentes(false);
        return;
      }

      const ocorrencias =
        (data ?? []) as OcorrenciaBanco[];

      setResumo({
        abertas: ocorrencias.filter(
          (ocorrencia) =>
            normalizarStatus(
              ocorrencia.status
            ) === "aberto"
        ).length,

        emAndamento: ocorrencias.filter(
          (ocorrencia) =>
            normalizarStatus(
              ocorrencia.status
            ) === "em_andamento"
        ).length,

        finalizadas: ocorrencias.filter(
          (ocorrencia) =>
            normalizarStatus(
              ocorrencia.status
            ) === "resolvido"
        ).length,
      });

      const recentes = [...ocorrencias]
        .sort((primeira, segunda) => {
          return (
            obterTempoCriacao(segunda) -
            obterTempoCriacao(primeira)
          );
        })
        .slice(0, 3)
        .map(transformarOcorrencia);

      setOcorrenciasRecentes(recentes);
      setCarregandoResumo(false);
      setCarregandoRecentes(false);
    },
    []
  );

  useEffect(() => {
    carregarDados();

    const canalOcorrencias = supabase
      .channel("inicio-ocorrencias")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ocorrencias",
        },
        () => {
          carregarDados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        canalOcorrencias
      );
    };
  }, [carregarDados]);

  function mostrarNumero(numero: number) {
    return carregandoResumo
      ? "—"
      : numero;
  }

  return (
    <main>
      <style>{`
.mb-home-hero, .mb-home-hero * { box-sizing:border-box; }
.mb-home-hero {
  width:calc(100% - 40px); max-width:1320px; margin:30px auto 48px;
  padding:clamp(24px,4vw,56px); display:grid;
  grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);
  gap:32px 40px; align-items:center; overflow:hidden;
  border:1px solid #f1dcc8; border-radius:30px;
  background:radial-gradient(ellipse at 88% 24%,#ffebd3 0,transparent 48%),#fffaf5;
  box-shadow:0 18px 55px rgba(8,36,58,.06); color:#08243a;
}
.mb-home-copy { min-width:0; }
.mb-home-tag { display:inline-flex; padding:8px 12px; border:1px solid #ffd1ad; border-radius:999px; background:#fff1e3; color:#ae3b00; font-size:11px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; }
.mb-home-copy h1 { margin:22px 0 20px; max-width:600px; font-size:clamp(34px,4vw,58px); font-weight:800; line-height:1.06; letter-spacing:-.045em; color:#08243a; text-align:left; }
.mb-home-copy h1 em { color:#dc5008; font-style:normal; }
.mb-home-copy p { max-width:550px; margin:0 0 12px; color:#506777; font-size:16px; line-height:1.7; text-align:left; }
.mb-home-features { display:flex; flex-wrap:wrap; gap:10px 18px; margin:24px 0; }
.mb-home-features span { display:inline-flex; align-items:center; gap:7px; font-size:12px; color:#405a6b; font-weight:600; }
.mb-home-features svg { width:16px; height:16px; color:#da5008; flex-shrink:0; }
.mb-home-actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:26px; }
.mb-home-actions a { min-height:50px; padding:14px 20px; display:inline-flex; align-items:center; justify-content:center; gap:9px; border-radius:12px; text-decoration:none; font-size:14px; font-weight:750; transition:box-shadow .2s,background-color .2s; }
.mb-home-actions .mb-home-primary { border:1px solid #d84b00; color:white; background:#e95206; box-shadow:0 8px 20px #f45d0026; }
.mb-home-actions .mb-home-primary:hover { background:#cb4200; }
.mb-home-actions .mb-home-secondary { border:1px solid #cbd4da; color:#12384f; background:#fff; }
.mb-home-actions .mb-home-secondary:hover { background:#f0f5f7; }
.mb-home-actions a:focus-visible { outline:3px solid #135c8a; outline-offset:4px; }
.mb-home-visual { display:contents; }
.mb-home-hero img.mb-home-image { grid-column:2; grid-row:1; display:block !important; width:100% !important; max-width:560px !important; height:auto !important; max-height:430px !important; margin:auto !important; object-fit:contain !important; position:static !important; opacity:1 !important; visibility:visible !important; filter:drop-shadow(0 18px 15px #70401712); }
.mb-home-error { grid-column:2; padding:20px; background:#fff1e3; border-radius:12px; color:#873500; }
.mb-home-summary { grid-column:1 / -1; padding:24px 28px; border-radius:20px; background:#0b2c42; color:white; }
.mb-home-summary-header { margin-bottom:18px; }
.mb-home-summary-header h2 { margin:0; font-size:13px; font-weight:650; color:#d8e5ed; }
.mb-home-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:22px; }
.mb-home-stats article { display:flex; align-items:center; gap:14px; min-width:0; padding:0 22px 0 0; border-right:1px solid #ffffff26; }
.mb-home-stats article:last-child { border:0; padding-right:0; }
.mb-home-stats strong { font-size:32px; font-weight:800; line-height:1; font-variant-numeric:tabular-nums; color:#ff9c55; }
.mb-home-stats article:nth-child(2) strong { color:#ffd166; }
.mb-home-stats article:nth-child(3) strong { color:#a3df81; }
.mb-home-stats span { color:#f0f5f8; font-size:13px; line-height:1.4; }
@media(max-width:800px) {
 .mb-home-hero { grid-template-columns:minmax(0,1fr); gap:26px; border-radius:24px; }
 .mb-home-hero img.mb-home-image,.mb-home-error { grid-column:1; grid-row:auto; max-height:310px !important; }
 .mb-home-copy h1 { max-width:620px; }
 .mb-home-summary { padding:22px; }
 .mb-home-stats { gap:12px; }
 .mb-home-stats article { flex-direction:column; align-items:flex-start; gap:8px; padding-right:12px; }
}
@media(max-width:480px) {
 .mb-home-hero { width:calc(100% - 24px); margin:18px auto 30px; padding:22px 18px; }
 .mb-home-copy p { font-size:14px; }
 .mb-home-actions { flex-direction:column; }
 .mb-home-actions a { width:100%; }
 .mb-home-stats strong { font-size:27px; }
 .mb-home-stats span { font-size:11px; }
 .mb-home-summary { padding:20px 16px; }
}
`}</style>
      <section className="mb-home-hero">
        <div className="mb-home-copy">
          <span className="mb-home-tag">
            Cuidando da nossa cidade
          </span>

          <h1>
            Um bairro melhor<br /> começa com <em>você.</em>
          </h1>

          <p className="mb-home-text">Registre problemas nas ruas, marque a localização e acompanhe as melhorias. Sua participação ajuda a comunidade a enxergar o que precisa mudar.</p>

          

          <div className="mb-home-features">
            <span>
              <Camera aria-hidden="true" /> Registre com foto
            </span>

            <span>
              <MapPin aria-hidden="true" /> Marque no mapa
            </span>

            <span>
              <CheckCircle2 aria-hidden="true" /> Acompanhe a solução
            </span>
          </div>

          <div className="mb-home-actions">
            <Link
              to="/registrar"
              className="mb-home-primary"
            >
              Registrar ocorrência <ArrowRight size={16} aria-hidden="true" />
            </Link>

            <Link
              to="/mapa"
              className="mb-home-secondary"
            >
              Explorar o mapa
            </Link>
          </div>
        </div>

        <div className="mb-home-visual">
          {erroBanner ? (
            <p className="mb-home-error" role="status">
              Imagem não encontrada. Copie meu-bairro-banner.png do pacote para a pasta public do projeto.
            </p>
          ) : (
            <img
              className="mb-home-image"
              src={`${import.meta.env.BASE_URL}meu-bairro-banner.png`}
              alt="Moradores colaborando para melhorar o bairro, com casas, árvores e um pin de localização."
              loading="eager"
              decoding="async"
              onError={() => setErroBanner(true)}
            />
          )}
        <div className="mb-home-summary">
          <div className="mb-home-summary-header">
            <h2>
              Resumo da comunidade
            </h2>
          </div>

          <div className="mb-home-stats">
            <article>
              <strong>
                {mostrarNumero(
                  resumo.abertas
                )}
              </strong>

              <span>
                Ocorrências abertas
              </span>
            </article>

            <article>
              <strong>
                {mostrarNumero(
                  resumo.emAndamento
                )}
              </strong>

              <span>
                Em andamento
              </span>
            </article>

            <article>
              <strong>
                {mostrarNumero(
                  resumo.finalizadas
                )}
              </strong>

              <span>
                Problemas finalizados
              </span>
            </article>
          </div>
        </div>
        </div>
      </section>

      <section className="secao">
        <span className="inicio-subtitulo">
          Participe da comunidade
        </span>

        <h2>
          Problemas que você pode registrar
        </h2>

        <div className="categorias">
          <article className="cartao">
            <h3>🕳️ Buracos</h3>

            <p>
              Informe buracos e danos
              encontrados nas ruas.
            </p>
          </article>

          <article className="cartao">
            <h3>💡 Iluminação</h3>

            <p>
              Registre postes apagados ou
              iluminação insuficiente.
            </p>
          </article>

          <article className="cartao">
            <h3>🗑️ Lixo</h3>

            <p>
              Avise sobre lixo acumulado ou
              descarte irregular.
            </p>
          </article>

          <article className="cartao">
            <h3>🌧️ Alagamentos</h3>

            <p>
              Marque ruas e regiões afetadas
              pela chuva.
            </p>
          </article>
        </div>
      </section>

      <section className="inicio-recentes">
        <div className="inicio-secao-cabecalho">
          <div>
            <span className="inicio-subtitulo">
              Acompanhe as atualizações
            </span>

            <h2>
              Ocorrências recentes da comunidade
            </h2>

            <p>
              Confira os problemas registrados
              recentemente pelos moradores.
            </p>
          </div>

          <Link
            to="/ocorrencias"
            className="inicio-ver-todas"
          >
            Ver todas
            <ArrowRight size={18} />
          </Link>
        </div>

        {carregandoRecentes ? (
          <div className="inicio-carregando">
            Carregando ocorrências
            recentes...
          </div>
        ) : ocorrenciasRecentes.length ===
          0 ? (
          <div className="inicio-sem-ocorrencias">
            <ListChecks size={38} />

            <h3>
              Nenhuma ocorrência registrada
            </h3>

            <p>
              Seja a primeira pessoa a informar
              um problema da comunidade.
            </p>

            <Link
              to="/registrar"
              className="botao-principal"
            >
              Registrar ocorrência
            </Link>
          </div>
        ) : (
          <div className="inicio-lista-recentes">
            {ocorrenciasRecentes.map(
              (ocorrencia) => (
                <article
                  className="inicio-ocorrencia"
                  key={ocorrencia.id}
                >
                  <FotoOcorrencia
                    fotoUrl={
                      ocorrencia.fotoUrl
                    }
                    titulo={
                      ocorrencia.titulo
                    }
                    icone={
                      ocorrencia.icone
                    }
                  />

                  <div className="inicio-ocorrencia-conteudo">
                    <div className="inicio-ocorrencia-topo">
                      <h3>
                        {ocorrencia.titulo}
                      </h3>

                      <span
                        className={`inicio-status inicio-status-${ocorrencia.status}`}
                      >
                        {nomeStatus(
                          ocorrencia.status
                        )}
                      </span>
                    </div>

                    <p className="inicio-localizacao">
                      <MapPin size={16} />

                      {ocorrencia.localizacao}
                    </p>

                    <p className="inicio-data">
                      <Clock3 size={15} />

                      {ocorrencia.data}
                    </p>

                    <Link
                      to="/ocorrencias"
                      className="inicio-detalhes"
                    >
                      Ver detalhes

                      <ArrowRight
                        size={16}
                      />
                    </Link>
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>

      <section className="inicio-como-funciona">
        <div className="inicio-secao-cabecalho">
          <div>
            <span className="inicio-subtitulo">
              Simples e colaborativo
            </span>

            <h2>Como funciona</h2>

            <p>
              Em poucos passos, você ajuda a
              melhorar seu bairro.
            </p>
          </div>
        </div>

        <div className="inicio-passos">
          <article>
            <div className="inicio-passo-icone">
              <Camera size={27} />
            </div>

            <span>01</span>

            <h3>
              Registre o problema
            </h3>

            <p>
              Informe o tipo do problema,
              escreva uma descrição e adicione
              uma foto.
            </p>
          </article>

          <article>
            <div className="inicio-passo-icone">
              <MapPin size={27} />
            </div>

            <span>02</span>

            <h3>
              Marque a localização
            </h3>

            <p>
              Informe onde o problema está para
              que ele apareça no mapa da
              comunidade.
            </p>
          </article>

          <article>
            <div className="inicio-passo-icone">
              <Search size={27} />
            </div>

            <span>03</span>

            <h3>
              Acompanhe o andamento
            </h3>

            <p>
              Consulte a ocorrência e acompanhe
              todas as mudanças de status.
            </p>
          </article>

          <article>
            <div className="inicio-passo-icone">
              <CheckCircle2 size={27} />
            </div>

            <span>04</span>

            <h3>Veja a solução</h3>

            <p>
              Saiba quando o problema for
              finalizado e continue cuidando da
              comunidade.
            </p>
          </article>
        </div>
      </section>

      <section className="inicio-redes">
        <div className="inicio-redes-conteudo">
          <span className="inicio-redes-etiqueta">
            Conecte-se com a comunidade
          </span>

          <h2>Acompanhe o Meu Bairro</h2>

          <p>
            Siga nossos canais oficiais para receber
            novidades, alertas e atualizações sobre as
            ocorrências da sua região.
          </p>

          <div className="inicio-redes-botoes">
            <a
              href="https://www.instagram.com/_meu_bairro/"
              target="_blank"
              rel="noopener noreferrer"
              className="inicio-rede inicio-rede-instagram"
              style={{ textDecoration: "none", cursor: "pointer" }}
              title="Abrir o Instagram do Meu Bairro"
            >
              <AtSign size={22} />

              <div>
                <strong>Instagram</strong>
                <small>Seguir perfil</small>
              </div>
            </a>

            <a
              href="https://chat.whatsapp.com/GFbYXU9Q0Iq3Ioye02Fz4a"
              target="_blank"
              rel="noopener noreferrer"
              className="inicio-rede inicio-rede-whatsapp"
              style={{ textDecoration: "none", cursor: "pointer" }}
              title="Entrar na Comunidade Meu Bairro"
            >
              <MessageCircle size={22} />

              <div>
                <strong>Comunidade WhatsApp</strong>
                <small>Entrar agora</small>
              </div>
            </a>

            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=ajudeamelhorseubairro@gmail.com&su=Contato%20pelo%20site%20Meu%20Bairro"
              target="_blank"
              rel="noopener noreferrer"
              className="inicio-rede inicio-rede-email"
              style={{ textDecoration: "none", cursor: "pointer" }}
              title="Enviar um e-mail para o Meu Bairro"
            >
              <Mail size={22} />

              <div>
                <strong>Fale conosco</strong>
                <small>Enviar e-mail</small>
              </div>
            </a>
          </div>

          <p className="inicio-redes-aviso">
            Participe da comunidade, acompanhe as
            novidades e ajude a melhorar o seu bairro.
          </p>
        </div>

        <div
          className="inicio-redes-ilustracao"
          aria-hidden="true"
        >
          <div className="inicio-redes-circulo">
            <MessageCircle size={58} />
          </div>

          <span className="inicio-rede-flutuante rede-instagram">
            <AtSign size={24} />
          </span>

          <span className="inicio-rede-flutuante rede-whatsapp">
            <MessageCircle size={24} />
          </span>

          <span className="inicio-rede-flutuante rede-email">
            <Mail size={24} />
          </span>
        </div>
      </section>
    </main>
  );
}

type FotoOcorrenciaProps = {
  fotoUrl: string;
  titulo: string;
  icone: string;
};

function FotoOcorrencia({
  fotoUrl,
  titulo,
  icone,
}: FotoOcorrenciaProps) {
  const [erroImagem, setErroImagem] =
    useState(false);

  function tratarErroImagem(
    evento: SyntheticEvent<
      HTMLImageElement
    >
  ) {
    console.warn(
      "Não foi possível carregar a fotografia:",
      evento.currentTarget.src
    );

    setErroImagem(true);
  }

  if (!fotoUrl || erroImagem) {
    return (
      <div className="inicio-ocorrencia-icone">
        <span className="inicio-foto-fallback">
          {icone}
        </span>
      </div>
    );
  }

  return (
    <div className="inicio-ocorrencia-icone">
      <img
        src={fotoUrl}
        alt={`Foto da ocorrência: ${titulo}`}
        loading="lazy"
        onError={tratarErroImagem}
      />
    </div>
  );
}

function transformarOcorrencia(
  ocorrencia: OcorrenciaBanco
): OcorrenciaRecente {
  const titulo =
    ocorrencia.titulo ||
    ocorrencia.tipo ||
    ocorrencia.categoria ||
    resumirDescricao(
      ocorrencia.descricao
    ) ||
    "Ocorrência registrada";

  const localizacao =
    ocorrencia.bairro ||
    ocorrencia.endereco ||
    ocorrencia.localizacao ||
    "Localização informada no mapa";

  const status = normalizarStatus(
    ocorrencia.status
  );

  return {
    id: String(
      ocorrencia.id ??
        `${titulo}-${obterTempoCriacao(
          ocorrencia
        )}`
    ),

    titulo,
    localizacao,
    status,

    data: formatarData(
      obterDataCriacao(ocorrencia)
    ),

    icone: obterIcone(
      ocorrencia.categoria ||
        titulo
    ),

    fotoUrl:
      ocorrencia.foto_url?.trim() ??
      "",
  };
}

function normalizarStatus(
  status?: string | null
) {
  const texto = (status ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

  if (
    texto === "em_andamento" ||
    texto === "andamento"
  ) {
    return "em_andamento";
  }

  if (
    texto === "resolvido" ||
    texto === "resolvida" ||
    texto === "finalizado" ||
    texto === "finalizada"
  ) {
    return "resolvido";
  }

  return "aberto";
}

function nomeStatus(status: string) {
  if (status === "em_andamento") {
    return "Em andamento";
  }

  if (status === "resolvido") {
    return "Finalizada";
  }

  return "Aberta";
}

function obterDataCriacao(
  ocorrencia: OcorrenciaBanco
) {
  return (
    ocorrencia.created_at ||
    ocorrencia.criado_em ||
    ocorrencia.data_criacao ||
    null
  );
}

function obterTempoCriacao(
  ocorrencia: OcorrenciaBanco
) {
  const data =
    obterDataCriacao(ocorrencia);

  if (!data) {
    const idNumerico = Number(
      ocorrencia.id
    );

    return Number.isNaN(idNumerico)
      ? 0
      : idNumerico;
  }

  const tempo = new Date(
    data
  ).getTime();

  return Number.isNaN(tempo)
    ? 0
    : tempo;
}

function formatarData(
  data: string | null
) {
  if (!data) {
    return "Registrada recentemente";
  }

  const dataConvertida =
    new Date(data);

  if (
    Number.isNaN(
      dataConvertida.getTime()
    )
  ) {
    return "Registrada recentemente";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(dataConvertida);
}

function resumirDescricao(
  descricao?: string | null
) {
  if (!descricao) {
    return "";
  }

  const texto = descricao.trim();

  if (texto.length <= 45) {
    return texto;
  }

  return `${texto.slice(0, 45)}...`;
}

function obterIcone(texto: string) {
  const valor = texto.toLowerCase();

  if (
    valor.includes("buraco") ||
    valor.includes("calçada") ||
    valor.includes("calcada")
  ) {
    return "🕳️";
  }

  if (
    valor.includes("luz") ||
    valor.includes("ilumina") ||
    valor.includes("poste")
  ) {
    return "💡";
  }

  if (
    valor.includes("lixo") ||
    valor.includes("entulho")
  ) {
    return "🗑️";
  }

  if (
    valor.includes("alag") ||
    valor.includes("chuva")
  ) {
    return "🌧️";
  }

  return "📍";
}

export default Inicio;


