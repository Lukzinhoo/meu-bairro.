import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Link } from "react-router-dom";

import {
  CalendarDays,
  Filter,
  LocateFixed,
  MapPin,
  MessageSquareText,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";

import { supabase } from "../services/supabase";
import "./Ocorrencias.css";
import "./DetalhesOcorrencia.css";

type StatusOcorrencia =
  | "aberto"
  | "em_andamento"
  | "resolvido";

type Ocorrencia = {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  endereco: string;
  bairro: string | null;
  latitude: number;
  longitude: number;
  urgencia: "baixa" | "media" | "alta";
  status: StatusOcorrencia;
  foto_url: string | null;
  video_url: string | null;
  resposta_oficial: string | null;
  criado_em: string;
};

function Ocorrencias() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [urgencia, setUrgencia] = useState("todas");
  const [bairroSelecionado, setBairroSelecionado] = useState("todos");
  const [bairroUsuario, setBairroUsuario] = useState("");
  const [buscandoBairro, setBuscandoBairro] = useState(true);
  const [avisoLocalizacao, setAvisoLocalizacao] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    carregarOcorrencias();
    identificarBairroDoUsuario();
  }, []);

  async function identificarBairroDoUsuario() {
    setBuscandoBairro(true);
    setAvisoLocalizacao("");

    try {
      let latitude: number;
      let longitude: number;
      const localizacaoSalva = localStorage.getItem("meu_bairro_localizacao");

      if (localizacaoSalva) {
        const dados = JSON.parse(localizacaoSalva);
        latitude = Number(dados.latitude);
        longitude = Number(dados.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          throw new Error("Localização salva inválida.");
        }
      } else {
        if (!navigator.geolocation) {
          throw new Error("A localização não está disponível neste navegador.");
        }

        const posicao = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 60000,
            });
          }
        );

        latitude = posicao.coords.latitude;
        longitude = posicao.coords.longitude;
      }

      const parametros = new URLSearchParams({
        format: "jsonv2",
        addressdetails: "1",
        lat: String(latitude),
        lon: String(longitude),
        "accept-language": "pt-BR",
      });

      const resposta = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${parametros.toString()}`,
        { headers: { Accept: "application/json" } }
      );

      if (!resposta.ok) {
        throw new Error("Não foi possível identificar seu bairro.");
      }

      const resultado = await resposta.json();
      const enderecoLocal = resultado.address ?? {};
      const bairroEncontrado = String(
        enderecoLocal.suburb ||
          enderecoLocal.neighbourhood ||
          enderecoLocal.quarter ||
          enderecoLocal.city_district ||
          enderecoLocal.district ||
          ""
      ).trim();

      if (!bairroEncontrado) {
        throw new Error("Seu bairro não foi identificado automaticamente.");
      }

      setBairroUsuario(bairroEncontrado);
      setBairroSelecionado(bairroEncontrado);
      setAvisoLocalizacao(
        `Mostrando inicialmente as ocorrências de ${bairroEncontrado}.`
      );
    } catch (erroDesconhecido) {
      console.warn("Erro ao identificar bairro:", erroDesconhecido);
      setBairroUsuario("");
      setBairroSelecionado("todos");
      setAvisoLocalizacao(
        "Não foi possível identificar seu bairro. Mostrando todas as ocorrências."
      );
    } finally {
      setBuscandoBairro(false);
    }
  }

  async function carregarOcorrencias() {
    setCarregando(true);
    setErro("");

    const { data, error } = await supabase
      .from("ocorrencias")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) {
      setErro(`Não foi possível carregar as ocorrências: ${error.message}`);
      setCarregando(false);
      return;
    }

    setOcorrencias((data ?? []) as Ocorrencia[]);
    setCarregando(false);
  }

  const ocorrenciasFiltradas = useMemo(() => {
    const textoPesquisa = pesquisa.trim().toLowerCase();

    return ocorrencias.filter((ocorrencia) => {
      const correspondePesquisa =
        !textoPesquisa ||
        ocorrencia.titulo.toLowerCase().includes(textoPesquisa) ||
        ocorrencia.descricao.toLowerCase().includes(textoPesquisa) ||
        ocorrencia.endereco.toLowerCase().includes(textoPesquisa) ||
        (ocorrencia.bairro ?? "").toLowerCase().includes(textoPesquisa);

      return (
        correspondePesquisa &&
        (bairroSelecionado === "todos" ||
          normalizarTexto(ocorrencia.bairro ?? "") ===
            normalizarTexto(bairroSelecionado)) &&
        (categoria === "todas" || ocorrencia.categoria === categoria) &&
        (status === "todos" || ocorrencia.status === status) &&
        (urgencia === "todas" || ocorrencia.urgencia === urgencia)
      );
    });
  }, [ocorrencias, pesquisa, categoria, status, urgencia, bairroSelecionado]);

  const bairrosDisponiveis = useMemo(() => {
    const bairros = ocorrencias
      .map((ocorrencia) => ocorrencia.bairro?.trim())
      .filter((bairro): bairro is string => Boolean(bairro));

    if (bairroUsuario) bairros.push(bairroUsuario);

    return Array.from(
      new Map(
        bairros.map((bairro) => [normalizarTexto(bairro), bairro])
      ).values()
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [ocorrencias, bairroUsuario]);

  function limparFiltros() {
    setPesquisa("");
    setCategoria("todas");
    setStatus("todos");
    setUrgencia("todas");
    setBairroSelecionado(bairroUsuario || "todos");
  }

  return (
    <main className="ocorrencias-pagina">
      <section className="ocorrencias-topo">
        <div>
          <span>Transparência para a comunidade</span>
          <h1>Ocorrências registradas</h1>
          <p>
            Consulte os problemas registrados pelos moradores e acompanhe o
            andamento e as respostas da equipe responsável.
          </p>
        </div>

        <button type="button" onClick={carregarOcorrencias} disabled={carregando}>
          <RefreshCw size={19} className={carregando ? "girando" : ""} />
          Atualizar
        </button>
      </section>

      <section className="ocorrencias-filtros">
        <div className="pesquisa-ocorrencias">
          <Search size={20} />
          <input
            type="search"
            value={pesquisa}
            onChange={(evento) => setPesquisa(evento.target.value)}
            placeholder="Pesquisar título, endereço ou descrição"
          />
        </div>

        <FiltroSelect
          id="filtro-bairro"
          label="Bairro"
          value={bairroSelecionado}
          onChange={setBairroSelecionado}
          disabled={buscandoBairro}
        >
          <option value="todos">Todos os bairros</option>
          {bairrosDisponiveis.map((bairro) => (
            <option key={bairro} value={bairro}>
              {bairro === bairroUsuario ? `${bairro} — Meu bairro` : bairro}
            </option>
          ))}
        </FiltroSelect>

        <FiltroSelect id="filtro-categoria" label="Categoria" value={categoria} onChange={setCategoria}>
          <option value="todas">Todas</option>
          <option value="buraco">Buracos</option>
          <option value="iluminacao">Iluminação</option>
          <option value="lixo">Lixo acumulado</option>
          <option value="alagamento">Alagamentos</option>
          <option value="calcada">Calçadas</option>
          <option value="deslizamento">Deslizamentos</option>
          <option value="outro">Outros</option>
        </FiltroSelect>

        <FiltroSelect id="filtro-status" label="Status" value={status} onChange={setStatus}>
          <option value="todos">Todos</option>
          <option value="aberto">Aberta</option>
          <option value="em_andamento">Em andamento</option>
          <option value="resolvido">Finalizada</option>
        </FiltroSelect>

        <FiltroSelect id="filtro-urgencia" label="Urgência" value={urgencia} onChange={setUrgencia}>
          <option value="todas">Todas</option>
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
        </FiltroSelect>

        <button className="limpar-filtros" type="button" onClick={limparFiltros}>
          <Filter size={18} /> Limpar
        </button>
      </section>

      <div className="aviso-bairro">
        <LocateFixed size={18} />
        <span>{buscandoBairro ? "Identificando seu bairro..." : avisoLocalizacao}</span>
        {!buscandoBairro && !bairroUsuario && (
          <button type="button" onClick={identificarBairroDoUsuario}>
            Tentar novamente
          </button>
        )}
      </div>

      <div className="resultado-ocorrencias">
        <strong>{ocorrenciasFiltradas.length}</strong>
        <span>
          {ocorrenciasFiltradas.length === 1
            ? " ocorrência encontrada"
            : " ocorrências encontradas"}
        </span>
      </div>

      {erro && (
        <div className="ocorrencias-erro">
          <TriangleAlert size={21} /> {erro}
        </div>
      )}

      {carregando ? (
        <div className="ocorrencias-carregando">
          <RefreshCw className="girando" size={35} />
          <p>Carregando ocorrências...</p>
        </div>
      ) : (
        <section className="grade-ocorrencias">
          {ocorrenciasFiltradas.map((ocorrencia) => (
            <article className="card-ocorrencia-publica" key={ocorrencia.id}>
              <div className="card-ocorrencia-imagem">
                {ocorrencia.foto_url ? (
                  <img src={ocorrencia.foto_url} alt={ocorrencia.titulo} />
                ) : ocorrencia.video_url ? (
                  <video src={ocorrencia.video_url} controls preload="metadata" />
                ) : (
                  <div className="ocorrencia-sem-foto">
                    <TriangleAlert size={45} />
                    <span>Sem fotografia ou vídeo</span>
                  </div>
                )}

                <span className={`selo-status ${ocorrencia.status}`}>
                  {formatarStatus(ocorrencia.status)}
                </span>
                <span className={`selo-urgencia ${ocorrencia.urgencia}`}>
                  Urgência {formatarUrgencia(ocorrencia.urgencia)}
                </span>
              </div>

              <div className="card-ocorrencia-conteudo">
                <span className="categoria-ocorrencia">
                  {formatarCategoria(ocorrencia.categoria)}
                </span>
                <h2>{ocorrencia.titulo}</h2>
                <p>{ocorrencia.descricao}</p>

                <div className="informacao-ocorrencia">
                  <MapPin size={17} />
                  <span>
                    {ocorrencia.bairro
                      ? `${ocorrencia.bairro} — ${ocorrencia.endereco}`
                      : ocorrencia.endereco}
                  </span>
                </div>

                <div className="informacao-ocorrencia">
                  <CalendarDays size={17} />
                  <span>{formatarData(ocorrencia.criado_em)}</span>
                </div>

                {ocorrencia.resposta_oficial?.trim() && (
                  <div className="resposta-oficial-publica">
                    <div className="resposta-oficial-titulo">
                      <MessageSquareText size={19} />
                      <strong>Resposta da equipe</strong>
                    </div>
                    <p>{ocorrencia.resposta_oficial}</p>
                  </div>
                )}

                <div className="card-ocorrencia-acoes">
                  <Link to={`/ocorrencias/${ocorrencia.id}`} className="ver-detalhes">
                    Ver detalhes
                  </Link>
                  <Link to={`/mapa?ocorrencia=${ocorrencia.id}`} className="ver-no-mapa">
                    <MapPin size={18} /> Ver no mapa
                  </Link>
                </div>
              </div>
            </article>
          ))}

          {!ocorrenciasFiltradas.length && !erro && (
            <div className="nenhuma-ocorrencia">
              <Search size={45} />
              <h2>Nenhuma ocorrência encontrada</h2>
              <p>Tente alterar ou limpar os filtros selecionados.</p>
              <button type="button" onClick={limparFiltros}>Limpar filtros</button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

type FiltroSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
  disabled?: boolean;
  children: ReactNode;
};

function FiltroSelect({ id, label, value, onChange, disabled, children }: FiltroSelectProps) {
  return (
    <div className="filtro-campo">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </div>
  );
}

function normalizarTexto(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function formatarCategoria(categoria: string) {
  const categorias: Record<string, string> = {
    buraco: "🕳️ Buraco na rua",
    iluminacao: "💡 Iluminação pública",
    lixo: "🗑️ Lixo acumulado",
    alagamento: "🌧️ Alagamento",
    calcada: "🚶 Calçada danificada",
    deslizamento: "⛰️ Deslizamento de terra ou barreira",
    outro: "⚠️ Outro problema",
  };
  return categorias[categoria] || categoria;
}

function formatarStatus(status: StatusOcorrencia) {
  return {
    aberto: "Aberta",
    em_andamento: "Em andamento",
    resolvido: "Finalizada",
  }[status];
}

function formatarUrgencia(urgencia: string) {
  const urgencias: Record<string, string> = {
    baixa: "baixa",
    media: "média",
    alta: "alta",
  };

  return urgencias[urgencia] || urgencia;
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default Ocorrencias;
