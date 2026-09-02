import {
  useEffect,
  useState,
} from "react";

import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import L from "leaflet";

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

const CENTRO_BRASIL: [number, number] = [
  -14.235,
  -51.925,
];

function AjustarVisaoDoBrasil() {
  const mapa = useMap();

  useEffect(() => {
    let quadro = 0;
    const container = mapa.getContainer();

    function ajustarMapa() {
      mapa.invalidateSize({
        animate: false,
        pan: false,
      });

      const zoomMinimo = mapa.getBoundsZoom(
        LIMITES_BRASIL,
        false,
        L.point(42, 42)
      );

      mapa.setMinZoom(
        Math.max(3, zoomMinimo)
      );
    }

    function mostrarBrasil() {
      ajustarMapa();

      mapa.fitBounds(LIMITES_BRASIL, {
        padding: [24, 24],
        animate: false,
      });
    }

    function agendarAjuste() {
      window.cancelAnimationFrame(quadro);

      quadro = window.requestAnimationFrame(
        ajustarMapa
      );
    }

    /*
     * Botão "Ver Brasil".
     */
    const ControleBrasil = L.Control.extend({
      options: {
        position: "topright",
      },

      onAdd() {
        const caixa = L.DomUtil.create(
          "div",
          "controle-brasil"
        );

        const botao = L.DomUtil.create(
          "button",
          "",
          caixa
        );

        botao.type = "button";
        botao.textContent = "Ver Brasil";

        botao.setAttribute(
          "aria-label",
          "Voltar à visão completa do Brasil"
        );

        L.DomEvent.disableClickPropagation(caixa);
        L.DomEvent.disableScrollPropagation(caixa);

        L.DomEvent.on(
          botao,
          "click",
          mostrarBrasil
        );

        return caixa;
      },
    });

    const controleBrasil =
      new ControleBrasil();

    controleBrasil.addTo(mapa);

    const escala = L.control
      .scale({
        imperial: false,
        position: "bottomleft",
      })
      .addTo(mapa);

    const observador = new ResizeObserver(
      agendarAjuste
    );

    observador.observe(container);

    window.setTimeout(
      mostrarBrasil,
      100
    );

    return () => {
      window.cancelAnimationFrame(quadro);
      observador.disconnect();
      controleBrasil.remove();
      escala.remove();
    };
  }, [mapa]);

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

function corDoMarcador(
  ocorrencia: Ocorrencia
) {
  if (ocorrencia.status === "resolvido") {
    return "#168653";
  }

  if (
    ocorrencia.status === "cancelado" ||
    ocorrencia.status === "duplicado" ||
    ocorrencia.status === "nao_solucionado"
  ) {
    return "#64748b";
  }

  if (ocorrencia.urgencia === "alta") {
    return "#dc2626";
  }

  if (ocorrencia.urgencia === "media") {
    return "#f59e0b";
  }

  return "#3b82f6";
}

function criarMarcador(
  ocorrencia: Ocorrencia
) {
  const cor = corDoMarcador(ocorrencia);

  let conteudo = `
    <span
      class="marcador-sem-midia"
      aria-hidden="true"
    >
      📍
    </span>
  `;

  if (ocorrencia.foto_url) {
    const fotoSegura = escaparAtributo(
      ocorrencia.foto_url
    );

    conteudo = `
      <img
        src="${fotoSegura}"
        alt="Foto da ocorrência"
        loading="lazy"
      />
    `;
  } else if (ocorrencia.video_url) {
    const videoSeguro = escaparAtributo(
      ocorrencia.video_url
    );

    conteudo = `
      <video
        src="${videoSeguro}#t=0.1"
        muted
        playsinline
        preload="metadata"
        aria-label="Vídeo da ocorrência"
      ></video>

      <span
        class="marcador-video-selo"
        aria-hidden="true"
      >
        ▶
      </span>
    `;
  }

  return L.divIcon({
    className: "marcador-personalizado",

    html: `
      <div
        class="foto-marcador"
        style="border-color: ${cor}"
      >
        ${conteudo}
      </div>

      <div
        class="ponta-marcador"
        style="background: ${cor}"
      ></div>
    `,

    iconSize: [62, 71],
    iconAnchor: [31, 71],
    popupAnchor: [0, -71],
  });
}

function ocorrenciaEstaNoBrasil(
  ocorrencia: Ocorrencia
) {
  const latitude = Number(
    ocorrencia.latitude
  );

  const longitude = Number(
    ocorrencia.longitude
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return false;
  }

  return LIMITES_BRASIL.contains([
    latitude,
    longitude,
  ]);
}

function Mapa() {
  const [ocorrencias, setOcorrencias] =
    useState<Ocorrencia[]>([]);

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] =
    useState("");

  async function carregarOcorrencias(
    mostrarCarregamento = false
  ) {
    if (mostrarCarregamento) {
      setCarregando(true);
    }

    setErro("");

    const { data, error } = await supabase
      .from("ocorrencias")
      .select("*")
      .order("criado_em", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Erro ao carregar ocorrências:",
        error
      );

      setErro(
        "Não foi possível carregar as ocorrências."
      );
    } else {
      const registros =
        (data ?? []) as Ocorrencia[];

      const ocorrenciasDoBrasil =
        registros.filter(
          ocorrenciaEstaNoBrasil
        );

      setOcorrencias(
        ocorrenciasDoBrasil
      );
    }

    setCarregando(false);
  }

  useEffect(() => {
    void carregarOcorrencias(true);

    const canalOcorrencias = supabase
      .channel(
        "mapa-ocorrencias-brasil"
      )
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

    const atualizacaoAutomatica =
      window.setInterval(() => {
        void carregarOcorrencias();
      }, 10000);

    return () => {
      void supabase.removeChannel(
        canalOcorrencias
      );

      window.clearInterval(
        atualizacaoAutomatica
      );
    };
  }, []);

  return (
    <main className="pagina-mapa mapa-profissional">
      <style>{`
        .pagina-mapa.mapa-profissional {
          box-sizing: border-box;
          padding: 32px max(18px, calc((100% - 1440px) / 2)) 56px !important;
          background: #fff8f0;
        }

        .mapa-profissional .cabecalho-mapa {
          gap: 24px;
          margin-bottom: 24px;
        }

        .mapa-profissional
        .cabecalho-mapa
        > div:first-child
        > span {
          color: #b94509;
          font-size: 11px;
          letter-spacing: 0.1em;
        }

        .mapa-profissional
        .cabecalho-mapa h1 {
          margin: 10px 0;
          font-size: clamp(28px, 3vw, 42px);
          line-height: 1.15;
          letter-spacing: -0.04em;
        }

        .mapa-profissional
        .cabecalho-mapa p {
          max-width: 640px;
          font-size: 14px;
          line-height: 1.6;
        }

        .mapa-profissional
        .legenda-mapa {
          padding: 14px 16px;
          border: 1px solid #e4ddd4;
          border-radius: 14px;
          gap: 12px;
          box-shadow: none;
        }

        .mapa-profissional
        .mapa-conteudo {
          height: auto !important;
          min-height: 0 !important;
          padding: 0 !important;
          border: 1px solid #d9e1e5;
          border-radius: 22px;
          overflow: hidden;
          background: #eaf0f2;
          box-shadow:
            0 14px 40px
            rgba(18, 51, 73, 0.07);
          isolation: isolate;
        }

        .mapa-profissional
        .mapa-leaflet {
          width: 100%;
          height: clamp(
            420px,
            70vh,
            740px
          ) !important;
          min-height: 0 !important;
          background: #edf2f3 !important;
        }

        /*
         * Garante que os blocos do mapa
         * permaneçam visíveis.
         */
        .mapa-profissional
        .leaflet-tile-pane {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          filter: none !important;
        }

        .mapa-profissional
        .leaflet-tile {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          filter: none !important;
          mix-blend-mode: normal !important;
        }

        .mapa-profissional
        .leaflet-control-zoom {
          margin: 16px;
          border: 1px solid #d7e0e5;
          box-shadow:
            0 4px 12px
            rgba(11, 44, 66, 0.08);
        }

        .mapa-profissional
        .leaflet-control-zoom a {
          width: 38px;
          height: 38px;
          line-height: 38px;
        }

        .mapa-profissional
        .controle-brasil {
          margin: 16px;
        }

        .mapa-profissional
        .controle-brasil button {
          padding: 11px 16px;
          border: 1px solid #d7e0e5;
          border-radius: 10px;
          color: #12384f;
          background: #ffffff;
          font:
            600 13px
            system-ui,
            sans-serif;
          cursor: pointer;
          box-shadow:
            0 4px 12px
            rgba(11, 44, 66, 0.08);
        }

        .mapa-profissional
        .controle-brasil button:hover {
          border-color: #e58a49;
          background: #fff1e4;
        }

        .mapa-profissional
        .foto-marcador {
          box-sizing: border-box;
          box-shadow:
            0 4px 10px
            rgba(8, 36, 58, 0.21);
        }

        .mapa-profissional
        .foto-marcador img,
        .mapa-profissional
        .foto-marcador video {
          max-width: none !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
        }

        .mapa-profissional
        .leaflet-popup-content-wrapper {
          border-radius: 16px;
          box-shadow:
            0 8px 30px
            rgba(8, 36, 58, 0.16);
        }

        .mapa-profissional
        .popup-ocorrencia h3 {
          font-size: 17px;
          line-height: 1.3;
        }

        .mapa-profissional
        .aviso-mapa {
          max-width: calc(100% - 32px);
          top: 68px;
          padding: 10px 14px;
          font-size: 13px;
          pointer-events: none;
        }

        .mapa-profissional
        .mapa-ajuda {
          margin-top: 14px;
          color: #526e80;
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 12px;
          line-height: 1.6;
        }

        @media (max-width: 750px) {
          .pagina-mapa.mapa-profissional {
            padding:
              24px
              14px
              110px !important;
          }

          .mapa-profissional
          .mapa-leaflet {
            height: clamp(
              400px,
              65vh,
              600px
            ) !important;
          }

          .mapa-profissional
          .legenda-mapa {
            width: 100%;
          }
        }
      `}</style>

      <section className="cabecalho-mapa">
        <div>
          <span>
            Mapa colaborativo do Brasil
          </span>

          <h1>
            Ocorrências da comunidade
          </h1>

          <p>
            Visualize as ocorrências
            registradas no Brasil e clique
            na foto ou no vídeo para conferir
            os detalhes.
          </p>
        </div>

        <div className="legenda-mapa">
          <span>
            <i className="cor alta" />
            Alta
          </span>

          <span>
            <i className="cor media" />
            Média
          </span>

          <span>
            <i className="cor baixa" />
            Baixa
          </span>

          <span>
            <i className="cor resolvida" />
            Resolvida
          </span>

          <span>
            <i className="cor encerrada" />
            Encerrada
          </span>
        </div>
      </section>

      <section className="mapa-conteudo">
        {carregando && (
          <div className="aviso-mapa">
            Carregando ocorrências...
          </div>
        )}

        {erro && (
          <div className="aviso-mapa erro">
            {erro}
          </div>
        )}

        {!carregando &&
          !erro &&
          ocorrencias.length === 0 && (
            <div className="aviso-mapa">
              Nenhuma ocorrência registrada
              no Brasil ainda.
            </div>
          )}

        <MapContainer
          center={CENTRO_BRASIL}
          zoom={4}
          minZoom={3}
          maxZoom={19}
          zoomSnap={0.5}
          zoomDelta={0.5}
          maxBounds={LIMITES_BRASIL}
          maxBoundsViscosity={1}
          worldCopyJump={false}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          touchZoom={true}
          className="mapa-leaflet"
        >
          <AjustarVisaoDoBrasil />

          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
            minZoom={3}
            maxZoom={19}
            noWrap={true}
          />

          {ocorrencias.map(
            (ocorrencia) => (
              <Marker
                key={ocorrencia.id}
                position={[
                  Number(
                    ocorrencia.latitude
                  ),
                  Number(
                    ocorrencia.longitude
                  ),
                ]}
                icon={criarMarcador(
                  ocorrencia
                )}
              >
                <Popup
                  maxWidth={300}
                  minWidth={250}
                >
                  <article className="popup-ocorrencia">
                    {ocorrencia.foto_url ? (
                      <img
                        src={
                          ocorrencia.foto_url
                        }
                        alt={
                          ocorrencia.titulo
                        }
                      />
                    ) : ocorrencia.video_url ? (
                      <video
                        src={
                          ocorrencia.video_url
                        }
                        controls
                        playsInline
                        preload="metadata"
                      />
                    ) : null}

                    <span
                      className={`status ${ocorrencia.status}`}
                    >
                      {formatarStatus(
                        ocorrencia.status
                      )}
                    </span>

                    <h3>
                      {ocorrencia.titulo}
                    </h3>

                    <strong>
                      {formatarCategoria(
                        ocorrencia.categoria
                      )}
                    </strong>

                    <p>
                      {ocorrencia.descricao}
                    </p>

                    <small>
                      {ocorrencia.endereco}
                    </small>
                  </article>
                </Popup>
              </Marker>
            )
          )}
        </MapContainer>
      </section>

      <div className="mapa-ajuda">
        <span>
          Arraste para explorar. Aproxime
          o zoom para ver as ruas.
        </span>

        <span>
          {carregando
            ? "Carregando registros…"
            : `${ocorrencias.length} ocorrências no mapa`}
        </span>
      </div>
    </main>
  );
}

function formatarStatus(
  status: string
) {
  const valores: Record<
    string,
    string
  > = {
    aberto: "Recebida",
    em_analise: "Em análise",
    encaminhado: "Encaminhada",
    em_andamento: "Em andamento",
    aguardando_recursos:
      "Aguardando recursos",
    resolvido: "Resolvida",
    nao_solucionado:
      "Não solucionada",
    duplicado: "Duplicada",
    cancelado: "Cancelada",
  };

  return (
    valores[status] ||
    status.replaceAll("_", " ")
  );
}

function formatarCategoria(
  categoria: string
) {
  const valores: Record<
    string,
    string
  > = {
    buraco: "Buraco na rua",
    iluminacao:
      "Iluminação pública",
    lixo: "Lixo acumulado",
    alagamento: "Alagamento",
    calcada:
      "Calçada danificada",
    deslizamento:
      "Deslizamento de terra ou barreira",
    outro: "Outro problema",
  };

  return (
    valores[categoria] ||
    categoria
  );
}

export default Mapa;