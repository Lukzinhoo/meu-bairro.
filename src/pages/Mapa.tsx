import { useEffect, useState } from "react";

import {
  MapContainer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet-boundary-canvas";
import type { FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";
import "./Mapa.css";

import { supabase } from "../services/supabase";

type Ocorrencia = {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  endereco: string;
  latitude: number;
  longitude: number;
  urgencia: "baixa" | "media" | "alta";
  status: string;
  foto_url: string | null;
  video_url: string | null;
  criado_em: string;
};

const LIMITES_BRASIL = L.latLngBounds(
  [-33.75, -73.99],
  [5.27, -34.79]
);

const LIMITES_NAVEGACAO = L.latLngBounds(
  [-33.75, -73.99],
  [5.27, -34.79]
);

const CENTRO_BRASIL: [number, number] = [-14.235, -51.925];

function AjustarVisaoDoBrasil() {
  const mapa = useMap();

  useEffect(() => {
    let iniciado = false;
    let quadro = 0;
    let larguraAnterior = 0;
    let alturaAnterior = 0;
    const container = mapa.getContainer();

    function atualizarLimite() {
      mapa.setMinZoom(0);
      const minimo = mapa.getBoundsZoom(LIMITES_BRASIL, false, L.point(48, 48));
      mapa.setMinZoom(Math.max(0, minimo));
    }

    function verBrasil() {
      mapa.invalidateSize({ animate: false, pan: false });
      atualizarLimite();
      mapa.fitBounds(LIMITES_BRASIL, { padding: [24, 24], animate: false });
    }

    function ajustarTamanho() {
      const { clientWidth: largura, clientHeight: altura } = container;
      if (!largura || !altura) return;
      if (iniciado && largura === larguraAnterior && altura === alturaAnterior) return;
      larguraAnterior = largura;
      alturaAnterior = altura;
      if (!iniciado) {
        verBrasil();
        iniciado = true;
      } else {
        // Atualiza o tamanho sem voltar o usuário à visão geral.
        mapa.invalidateSize({ animate: false, pan: false });
        atualizarLimite();
        mapa.panInsideBounds(LIMITES_NAVEGACAO, { animate: false });
      }
    }

    function agendarAjuste() {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(ajustarTamanho);
    }

    const ControleBrasil = L.Control.extend({
      options: { position: "topright" },
      onAdd() {
        const caixa = L.DomUtil.create("div", "controle-brasil");
        const botao = L.DomUtil.create("button", "", caixa);
        botao.type = "button";
        botao.textContent = "Ver Brasil";
        botao.setAttribute("aria-label", "Voltar à visão completa do Brasil");
        L.DomEvent.disableClickPropagation(caixa);
        L.DomEvent.disableScrollPropagation(caixa);
        L.DomEvent.on(botao, "click", verBrasil);
        return caixa;
      },
    });
    const controle = new ControleBrasil();
    controle.addTo(mapa);
    const escala = L.control.scale({ imperial: false, position: "bottomleft" }).addTo(mapa);
    const observador = new ResizeObserver(agendarAjuste);
    observador.observe(container);
    agendarAjuste();

    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      controle.remove();
      escala.remove();
    };
  }, [mapa]);

  return null;
}

function CamadaDeRuasDoBrasil({
  malha,
}: {
  malha: FeatureCollection;
}) {
  const mapa = useMap();

  useEffect(() => {
    const camada = L.TileLayer.boundaryCanvas(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        boundary: malha,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        noWrap: true,
        crossOrigin: true,
        maxZoom: 19,
      }
    );

    camada.addTo(mapa);

    return () => {
      mapa.removeLayer(camada);
    };
  }, [mapa, malha]);

  return null;
}

function escaparAtributo(valor: string) {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function corDoMarcador(ocorrencia: Ocorrencia) {
  if (ocorrencia.status === "resolvido") return "#168653";

  if (
    ocorrencia.status === "cancelado" ||
    ocorrencia.status === "duplicado" ||
    ocorrencia.status === "nao_solucionado"
  ) {
    return "#64748b";
  }

  if (ocorrencia.urgencia === "alta") return "#dc2626";
  if (ocorrencia.urgencia === "media") return "#f59e0b";
  return "#3b82f6";
}

function criarMarcador(ocorrencia: Ocorrencia) {
  const cor = corDoMarcador(ocorrencia);

  let conteudo = `
    <span class="marcador-sem-midia" aria-hidden="true">📍</span>
  `;

  if (ocorrencia.foto_url) {
    const fotoSegura = escaparAtributo(ocorrencia.foto_url);

    conteudo = `
      <img
        src="${fotoSegura}"
        alt="Foto da ocorrência"
        loading="lazy"
      />
    `;
  } else if (ocorrencia.video_url) {
    const videoSeguro = escaparAtributo(ocorrencia.video_url);

    conteudo = `
      <video
        src="${videoSeguro}#t=0.1"
        muted
        playsinline
        preload="metadata"
        aria-label="Vídeo da ocorrência"
      ></video>
      <span class="marcador-video-selo" aria-hidden="true">▶</span>
    `;
  }

  return L.divIcon({
    className: "marcador-personalizado",
    html: `
      <div class="foto-marcador" style="border-color: ${cor}">
        ${conteudo}
      </div>
      <div class="ponta-marcador" style="background: ${cor}"></div>
    `,
    iconSize: [62, 71],
    iconAnchor: [31, 71],
    popupAnchor: [0, -71],
  });
}

function ocorrenciaEstaNoBrasil(ocorrencia: Ocorrencia) {
  const latitude = Number(ocorrencia.latitude);
  const longitude = Number(ocorrencia.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }

  return LIMITES_BRASIL.contains([latitude, longitude]);
}

function Mapa() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [malhaBrasil, setMalhaBrasil] =
    useState<FeatureCollection | null>(null);
  const [erroMalha, setErroMalha] = useState(false);

  async function carregarOcorrencias(mostrarCarregamento = false) {
    if (mostrarCarregamento) setCarregando(true);
    setErro("");

    const { data, error } = await supabase
      .from("ocorrencias")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("Erro ao carregar ocorrências:", error);
      setErro("Não foi possível carregar as ocorrências.");
    } else {
      const ocorrenciasDoBrasil = ((data ?? []) as Ocorrencia[])
        .filter(ocorrenciaEstaNoBrasil);

      setOcorrencias(ocorrenciasDoBrasil);
    }

    setCarregando(false);
  }

  useEffect(() => {
    void carregarOcorrencias(true);

    const canalOcorrencias = supabase
      .channel("mapa-ocorrencias-brasil")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ocorrencias",
        },
        () => {
          void carregarOcorrencias();
        }
      )
      .subscribe();

    const atualizacaoAutomatica = window.setInterval(() => {
      void carregarOcorrencias();
    }, 10000);

    return () => {
      void supabase.removeChannel(canalOcorrencias);
      window.clearInterval(atualizacaoAutomatica);
    };
  }, []);

  useEffect(() => {
    const controle = new AbortController();

    async function carregarMalhaBrasil() {
      try {
        const resposta = await fetch(`${import.meta.env.BASE_URL}brasil-estados.geojson`, {
          signal: controle.signal,
          cache: "force-cache",
        });

        if (!resposta.ok) {
          throw new Error(`Arquivo respondeu com status ${resposta.status}`);
        }

        const dados = (await resposta.json()) as FeatureCollection;

        if (dados.type !== "FeatureCollection" || !Array.isArray(dados.features) || !dados.features.length) {
          throw new Error("O arquivo GeoJSON não possui uma malha válida.");
        }

        setMalhaBrasil(dados);
        setErroMalha(false);
      } catch (erroCarregamento) {
        if (
          erroCarregamento instanceof DOMException &&
          erroCarregamento.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Não foi possível carregar a malha do Brasil:",
          erroCarregamento
        );
        setErroMalha(true);
      }
    }

    void carregarMalhaBrasil();

    return () => controle.abort();
  }, []);

  return (
    <main className="pagina-mapa mapa-profissional">
      <style>{`
.pagina-mapa.mapa-profissional { box-sizing:border-box; padding:32px max(18px,calc((100% - 1440px)/2)) 56px !important; background:#fff8f0; }
.mapa-profissional .cabecalho-mapa { gap:24px; margin-bottom:24px; }
.mapa-profissional .cabecalho-mapa > div:first-child > span { font-size:11px; letter-spacing:.1em; color:#b94509; }
.mapa-profissional .cabecalho-mapa h1 { font-size:clamp(28px,3vw,42px); letter-spacing:-.04em; line-height:1.15; margin:10px 0; }
.mapa-profissional .cabecalho-mapa p { max-width:640px; line-height:1.6; font-size:14px; }
.mapa-profissional .legenda-mapa { border:1px solid #e4ddd4; box-shadow:none; padding:14px 16px; gap:12px; border-radius:14px; }
.mapa-profissional .mapa-conteudo { min-height:0 !important; height:auto !important; border:1px solid #d9e1e5; border-radius:22px; background:#eaf0f2; box-shadow:0 14px 40px #12334912; isolation:isolate; }
.mapa-profissional .mapa-leaflet { min-height:0 !important; height:clamp(420px,70vh,740px) !important; background:#edf2f3 !important; }
.mapa-profissional .leaflet-control-zoom { margin:16px; border:1px solid #d7e0e5; box-shadow:0 4px 12px #0b2c4214; }
.mapa-profissional .leaflet-control-zoom a { width:38px; height:38px; line-height:38px; }
.mapa-profissional .controle-brasil { margin:16px; }
.mapa-profissional .controle-brasil button { border:1px solid #d7e0e5; border-radius:10px; background:#fff; color:#12384f; padding:11px 16px; font:600 13px system-ui,sans-serif; cursor:pointer; box-shadow:0 4px 12px #0b2c4214; }
.mapa-profissional .controle-brasil button:hover { background:#fff1e4; border-color:#e58a49; }
.mapa-profissional .controle-brasil button:focus-visible { outline:3px solid #155b89; outline-offset:3px; }
.mapa-profissional .foto-marcador { box-sizing:border-box; box-shadow:0 4px 10px #08243a35; }
.mapa-profissional .foto-marcador img,.mapa-profissional .foto-marcador video { max-width:none !important; padding:0 !important; margin:0 !important; border:0 !important; }
.mapa-profissional .leaflet-popup-content-wrapper { border-radius:16px; box-shadow:0 8px 30px #08243a29; }
.mapa-profissional .popup-ocorrencia h3 { font-size:17px; line-height:1.3; }
.mapa-profissional .aviso-mapa { max-width:calc(100% - 32px); top:68px; padding:10px 14px; font-size:13px; pointer-events:none; }
.mapa-profissional .aviso-contorno { background:#fff8ef; border-color:#e7c19c; }
.mapa-profissional .mapa-ajuda { display:flex; flex-wrap:wrap; justify-content:space-between; gap:10px; margin-top:14px; color:#526e80; font-size:12px; line-height:1.6; }
@media(max-width:750px) {
 .pagina-mapa.mapa-profissional { padding:24px 14px 110px !important; }
 .mapa-profissional .mapa-leaflet { height:clamp(400px,65vh,600px) !important; min-height:0 !important; }
 .mapa-profissional .legenda-mapa { width:100%; }
 .mapa-profissional .aviso-contorno { bottom:40px; }
}
`}</style>
      <section className="cabecalho-mapa">
        <div>
          <span>Mapa colaborativo do Brasil</span>
          <h1>Ocorrências da comunidade</h1>
          <p>
            Visualize as ocorrências registradas no Brasil e clique na foto ou
            no vídeo para conferir os detalhes.
          </p>
        </div>

        <div className="legenda-mapa">
          <span><i className="cor alta" />Alta</span>
          <span><i className="cor media" />Média</span>
          <span><i className="cor baixa" />Baixa</span>
          <span><i className="cor resolvida" />Resolvida</span>
          <span><i className="cor encerrada" />Encerrada</span>
        </div>
      </section>

      <section className="mapa-conteudo">
        {carregando && <div className="aviso-mapa">Carregando ocorrências...</div>}
        {erro && <div className="aviso-mapa erro">{erro}</div>}
        {!carregando && !erro && ocorrencias.length === 0 && (
          <div className="aviso-mapa">Nenhuma ocorrência registrada no Brasil ainda.</div>
        )}

        {erroMalha && (
          <div className="aviso-contorno">
           A delimitação do Brasil não foi carregada. Exibindo o mapa padrão.
          </div>
        )}

        <MapContainer
          trackResize={false}
          center={CENTRO_BRASIL}
          zoom={4}
          minZoom={3}
          maxZoom={19}
          zoomSnap={0.5}
          zoomDelta={0.5}
          maxBounds={LIMITES_NAVEGACAO}
          maxBoundsViscosity={1}
          worldCopyJump={false}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          touchZoom={true}
          className="mapa-leaflet"
        >
          <AjustarVisaoDoBrasil />

          {malhaBrasil && (
            <CamadaDeRuasDoBrasil malha={malhaBrasil} />
          )}

          {ocorrencias.map((ocorrencia) => (
            <Marker
              key={ocorrencia.id}
              position={[
                Number(ocorrencia.latitude),
                Number(ocorrencia.longitude),
              ]}
              icon={criarMarcador(ocorrencia)}
            >
              <Popup maxWidth={300} minWidth={250}>
                <article className="popup-ocorrencia">
                  {ocorrencia.foto_url ? (
                    <img src={ocorrencia.foto_url} alt={ocorrencia.titulo} />
                  ) : ocorrencia.video_url ? (
                    <video
                      src={ocorrencia.video_url}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : null}

                  <span className={`status ${ocorrencia.status}`}>
                    {formatarStatus(ocorrencia.status)}
                  </span>
                  <h3>{ocorrencia.titulo}</h3>
                  <strong>{formatarCategoria(ocorrencia.categoria)}</strong>
                  <p>{ocorrencia.descricao}</p>
                  <small>{ocorrencia.endereco}</small>
                </article>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </section>
      <div className="mapa-ajuda">
        <span>Arraste para explorar. Aproxime o zoom para ver as ruas.</span>
        <span>{carregando ? "Carregando registros…" : `${ocorrencias.length} ocorrências no mapa`}</span>
      </div>
    </main>
  );
}

function formatarStatus(status: string) {
  const valores: Record<string, string> = {
    aberto: "Recebida",
    em_analise: "Em análise",
    encaminhado: "Encaminhada",
    em_andamento: "Em andamento",
    aguardando_recursos: "Aguardando recursos",
    resolvido: "Resolvida",
    nao_solucionado: "Não solucionada",
    duplicado: "Duplicada",
    cancelado: "Cancelada",
  };

  return valores[status] || status.replaceAll("_", " ");
}

function formatarCategoria(categoria: string) {
  const valores: Record<string, string> = {
    buraco: "Buraco na rua",
    iluminacao: "Iluminação pública",
    lixo: "Lixo acumulado",
    alagamento: "Alagamento",
    calcada: "Calçada danificada",
    deslizamento: "Deslizamento de terra ou barreira",
    outro: "Outro problema",
  };

  return valores[categoria] || categoria;
}

export default Mapa;

