import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { useSearchParams } from "react-router-dom";

import {
  Camera,
  CheckCircle2,
  LocateFixed,
  MapPin,
  Send,
} from "lucide-react";

import { supabase } from "../services/supabase";

type Coordenadas = {
  latitude: number;
  longitude: number;
};

type ResultadoPhoton = {
  geometry: {
    coordinates: [number, number];
  };

  properties?: {
    countrycode?: string;
    country?: string;
  };
};

async function fetchComTempoLimite(
  url: string,
  tempo = 10000
) {
  const controlador = new AbortController();

  const temporizador = window.setTimeout(() => {
    controlador.abort();
  }, tempo);

  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controlador.signal,
    });
  } finally {
    window.clearTimeout(temporizador);
  }
}

function Registrar() {
  const [parametrosBusca] = useSearchParams();

  const cameraVideoRef =
    useRef<HTMLVideoElement | null>(null);

  const streamCameraRef =
    useRef<MediaStream | null>(null);

  const gravadorRef =
    useRef<MediaRecorder | null>(null);

  const partesVideoRef =
    useRef<Blob[]>([]);

  const intervaloGravacaoRef =
    useRef<number | null>(null);

  const [categoria, setCategoria] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [endereco, setEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [urgencia, setUrgencia] = useState("media");
  const [tipoTerreno, setTipoTerreno] = useState("");
  const [condicaoLocal, setCondicaoLocal] = useState("normal");

  const [arquivoFoto, setArquivoFoto] =
    useState<File | null>(null);

  const [fotoPreview, setFotoPreview] =
    useState("");

  const [arquivoVideo, setArquivoVideo] =
    useState<File | null>(null);

  const [videoPreview, setVideoPreview] =
    useState("");

  const [cameraAberta, setCameraAberta] =
    useState(false);

  const [modoCamera, setModoCamera] =
    useState<"foto" | "video">("foto");

  const [gravandoVideo, setGravandoVideo] =
    useState(false);

  const [segundosGravacao, setSegundosGravacao] =
    useState(0);

  const [coordenadas, setCoordenadas] =
    useState<Coordenadas | null>(null);

  const [enviando, setEnviando] =
    useState(false);

  const [buscandoLocalizacao, setBuscandoLocalizacao] =
    useState(false);

  const [etapaEnvio, setEtapaEnvio] =
    useState("");

  const [erro, setErro] = useState("");
  const [protocolo, setProtocolo] =
    useState("");

  useEffect(() => {
    return () => {
      if (intervaloGravacaoRef.current !== null) {
        window.clearInterval(
          intervaloGravacaoRef.current
        );
      }

      streamCameraRef.current
        ?.getTracks()
        .forEach((trilha) => trilha.stop());
    };
  }, []);

  useEffect(() => {
    if (!cameraAberta) {
      return;
    }

    const video = cameraVideoRef.current;
    const stream = streamCameraRef.current;

    if (!video || !stream) {
      return;
    }

    const elementoVideo: HTMLVideoElement = video;

    elementoVideo.srcObject = stream;

    async function iniciarPrevia() {
      try {
        await elementoVideo.play();
        setErro("");
      } catch (erroReproducao) {
        console.error(
          "Erro ao iniciar a prévia da câmera:",
          erroReproducao
        );

        setErro(
          "A câmera foi autorizada, mas a imagem não iniciou. Feche a câmera e tente novamente."
        );
      }
    }

    if (elementoVideo.readyState >= 1) {
      iniciarPrevia();
    } else {
      elementoVideo.onloadedmetadata = iniciarPrevia;
    }

    return () => {
      elementoVideo.onloadedmetadata = null;
    };
  }, [cameraAberta, modoCamera]);

  useEffect(() => {
    const categoriaRecebida =
      parametrosBusca.get("categoria");

    const categoriasPermitidas = [
      "buraco",
      "iluminacao",
      "lixo",
      "alagamento",
      "calcada",
      "deslizamento",
      "outro",
    ];

    if (
      categoriaRecebida &&
      categoriasPermitidas.includes(
        categoriaRecebida
      )
    ) {
      setCategoria(categoriaRecebida);
    }
  }, [parametrosBusca]);

  function escolherFoto(
    evento: ChangeEvent<HTMLInputElement>
  ) {
    const arquivo = evento.target.files?.[0];

    if (!arquivo) {
      return;
    }

    if (!arquivo.type.startsWith("image/")) {
      setErro(
        "Escolha um arquivo de imagem válido."
      );
      return;
    }

    if (arquivo.size > 5 * 1024 * 1024) {
      setErro(
        "A fotografia deve ter no máximo 5 MB."
      );
      return;
    }

    setErro("");
    setArquivoFoto(arquivo);

    if (fotoPreview) {
      URL.revokeObjectURL(fotoPreview);
    }

    setFotoPreview(
      URL.createObjectURL(arquivo)
    );
  }

  function limparTemporizadorGravacao() {
    if (intervaloGravacaoRef.current !== null) {
      window.clearInterval(
        intervaloGravacaoRef.current
      );

      intervaloGravacaoRef.current = null;
    }
  }

  function encerrarCamera() {
    limparTemporizadorGravacao();

    if (
      gravadorRef.current &&
      gravadorRef.current.state === "recording"
    ) {
      gravadorRef.current.stop();
    }

    streamCameraRef.current
      ?.getTracks()
      .forEach((trilha) => trilha.stop());

    streamCameraRef.current = null;

    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }

    setCameraAberta(false);
    setGravandoVideo(false);
    setSegundosGravacao(0);
  }

  async function abrirCamera(
    modo: "foto" | "video"
  ) {
    setErro("");

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setErro(
        "Este navegador não permite abrir a câmera dentro do site. Use HTTPS ou localhost."
      );
      return;
    }

    encerrarCamera();
    setModoCamera(modo);

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment",
            },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: modo === "video",
        });

      streamCameraRef.current = stream;
      setCameraAberta(true);
    } catch (erroCamera) {
      console.error(
        "Erro ao abrir a câmera:",
        erroCamera
      );

      if (
        erroCamera instanceof DOMException &&
        erroCamera.name === "NotAllowedError"
      ) {
        setErro(
          "A câmera ou o microfone foi bloqueado. Toque no ícone ao lado do endereço do site e permita o acesso."
        );
      } else if (
        erroCamera instanceof DOMException &&
        erroCamera.name === "NotFoundError"
      ) {
        setErro(
          "Nenhuma câmera disponível foi encontrada neste aparelho."
        );
      } else {
        setErro(
          "Não foi possível abrir a câmera. Feche outros aplicativos que estejam usando a câmera e tente novamente."
        );
      }
    }
  }

  function tirarFotoDentroDoSite() {
    const video = cameraVideoRef.current;

    if (
      !video ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      setErro(
        "Aguarde a imagem da câmera aparecer."
      );
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const contexto = canvas.getContext("2d");

    if (!contexto) {
      setErro("Não foi possível tirar a foto.");
      return;
    }

    contexto.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErro("Não foi possível gerar a foto.");
          return;
        }

        const arquivo = new File(
          [blob],
          `foto-${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );

        if (fotoPreview) {
          URL.revokeObjectURL(fotoPreview);
        }

        setArquivoFoto(arquivo);
        setFotoPreview(URL.createObjectURL(arquivo));
        setErro("");
        encerrarCamera();
      },
      "image/jpeg",
      0.9
    );
  }

  function escolherFormatoVideo() {
    const formatos = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];

    return formatos.find((formato) =>
      MediaRecorder.isTypeSupported(formato)
    );
  }

  function iniciarGravacao() {
    const stream = streamCameraRef.current;

    if (!stream) {
      setErro("Abra a câmera antes de gravar.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setErro(
        "A gravação de vídeo não é suportada neste navegador."
      );
      return;
    }

    try {
      const formato = escolherFormatoVideo();

      const gravador = formato
        ? new MediaRecorder(stream, {
            mimeType: formato,
          })
        : new MediaRecorder(stream);

      partesVideoRef.current = [];
      gravadorRef.current = gravador;

      gravador.ondataavailable = (evento) => {
        if (evento.data.size > 0) {
          partesVideoRef.current.push(evento.data);
        }
      };

      gravador.onstop = () => {
        const tipo =
          gravador.mimeType || "video/webm";

        const blob = new Blob(
          partesVideoRef.current,
          { type: tipo }
        );

        if (blob.size > 20 * 1024 * 1024) {
          setErro(
            "O vídeo ultrapassou 20 MB. Grave um vídeo mais curto."
          );
          return;
        }

        const extensao = tipo.includes("mp4")
          ? "mp4"
          : "webm";

        const arquivo = new File(
          [blob],
          `video-${Date.now()}.${extensao}`,
          { type: tipo }
        );

        if (videoPreview) {
          URL.revokeObjectURL(videoPreview);
        }

        setArquivoVideo(arquivo);
        setVideoPreview(URL.createObjectURL(arquivo));
        setGravandoVideo(false);
        setSegundosGravacao(0);
        setErro("");

        streamCameraRef.current
          ?.getTracks()
          .forEach((trilha) => trilha.stop());

        streamCameraRef.current = null;
        setCameraAberta(false);
      };

      gravador.start(1000);
      setGravandoVideo(true);
      setSegundosGravacao(0);

      let segundos = 0;

      limparTemporizadorGravacao();

      intervaloGravacaoRef.current =
        window.setInterval(() => {
          segundos += 1;
          setSegundosGravacao(segundos);

          if (segundos >= 30) {
            pararGravacao();
          }
        }, 1000);
    } catch (erroGravacao) {
      console.error(
        "Erro ao gravar vídeo:",
        erroGravacao
      );

      setErro(
        "Não foi possível iniciar a gravação."
      );
    }
  }

  function pararGravacao() {
    limparTemporizadorGravacao();

    if (
      gravadorRef.current &&
      gravadorRef.current.state === "recording"
    ) {
      gravadorRef.current.stop();
    }

    setGravandoVideo(false);
  }

  function removerFoto() {
    if (fotoPreview) {
      URL.revokeObjectURL(fotoPreview);
    }

    setArquivoFoto(null);
    setFotoPreview("");
  }

  function removerVideo() {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    setArquivoVideo(null);
    setVideoPreview("");
  }

  async function validarLocalizacaoNoBrasil(
    latitude: number,
    longitude: number
  ) {
    const parametros = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      lat: String(latitude),
      lon: String(longitude),
      "accept-language": "pt-BR",
    });

    try {
      const resposta = await fetchComTempoLimite(
        `https://nominatim.openstreetmap.org/reverse?${parametros.toString()}`,
        10000
      );

      if (!resposta.ok) {
        throw new Error(
          "Não foi possível verificar sua localização."
        );
      }

      const resultado = await resposta.json();

      const codigoPais =
        resultado.address?.country_code
          ?.toLowerCase()
          .trim();

      if (codigoPais !== "br") {
        throw new Error(
          "Só é possível registrar ocorrências localizadas no Brasil."
        );
      }

      const enderecoLocal = resultado.address ?? {};

      const bairroIdentificado =
        enderecoLocal.suburb ||
        enderecoLocal.neighbourhood ||
        enderecoLocal.quarter ||
        enderecoLocal.city_district ||
        enderecoLocal.district ||
        "";

      return String(bairroIdentificado).trim();
    } catch (erroDesconhecido) {
      if (
        erroDesconhecido instanceof DOMException &&
        erroDesconhecido.name === "AbortError"
      ) {
        const estaNosLimitesDoBrasil =
          latitude >= -33.75 &&
          latitude <= 5.27 &&
          longitude >= -73.99 &&
          longitude <= -34.79;

        if (!estaNosLimitesDoBrasil) {
          throw new Error(
            "A localização parece estar fora do Brasil."
          );
        }

        return "";
      }

      throw erroDesconhecido;
    }
  }

  function obterLocalizacao() {
    setErro("");
    setBuscandoLocalizacao(true);
    setEtapaEnvio(
      "Buscando sua localização..."
    );

    if (!navigator.geolocation) {
      setErro(
        "A localização não está disponível neste navegador."
      );

      setBuscandoLocalizacao(false);
      setEtapaEnvio("");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (posicao) => {
        try {
          const latitude =
            posicao.coords.latitude;

          const longitude =
            posicao.coords.longitude;

          setEtapaEnvio(
            "Verificando sua localização..."
          );

          const bairroIdentificado =
            await validarLocalizacaoNoBrasil(
            latitude,
            longitude
          );

          setCoordenadas({
            latitude,
            longitude,
          });

          if (bairroIdentificado) {
            setBairro(bairroIdentificado);
          }

          setErro("");
        } catch (erroDesconhecido) {
          setCoordenadas(null);

          if (
            erroDesconhecido instanceof Error
          ) {
            setErro(
              erroDesconhecido.message
            );
          } else {
            setErro(
              "Não foi possível verificar sua localização."
            );
          }
        } finally {
          setBuscandoLocalizacao(false);
          setEtapaEnvio("");
        }
      },
      (erroLocalizacao) => {
        setCoordenadas(null);
        setBuscandoLocalizacao(false);
        setEtapaEnvio("");

        if (
          erroLocalizacao.code ===
          erroLocalizacao.PERMISSION_DENIED
        ) {
          setErro(
            "A localização foi bloqueada. Você pode continuar usando somente o endereço."
          );
          return;
        }

        if (
          erroLocalizacao.code ===
          erroLocalizacao.TIMEOUT
        ) {
          setErro(
            "A localização demorou demais. Tente novamente ou use somente o endereço."
          );
          return;
        }

        setErro(
          "Não foi possível acessar sua localização. Você pode continuar usando somente o endereço."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  }

  async function buscarNoNominatim(
    enderecoCompleto: string
  ): Promise<Coordenadas | null> {
    const parametros = new URLSearchParams({
      format: "jsonv2",
      limit: "1",
      countrycodes: "br",
      addressdetails: "1",
      "accept-language": "pt-BR",
      q: enderecoCompleto,
    });

    try {
      const resposta = await fetchComTempoLimite(
        `https://nominatim.openstreetmap.org/search?${parametros.toString()}`,
        10000
      );

      if (!resposta.ok) {
        return null;
      }

      const resultados = await resposta.json();

      if (!resultados.length) {
        return null;
      }

      const latitude = Number(
        resultados[0].lat
      );

      const longitude = Number(
        resultados[0].lon
      );

      if (
        Number.isNaN(latitude) ||
        Number.isNaN(longitude)
      ) {
        return null;
      }

      return {
        latitude,
        longitude,
      };
    } catch (erroNominatim) {
      console.warn(
        "Erro no Nominatim:",
        erroNominatim
      );

      return null;
    }
  }

  async function buscarNoPhoton(
    enderecoCompleto: string
  ): Promise<Coordenadas | null> {
    const parametros = new URLSearchParams({
      q: enderecoCompleto,
      limit: "10",
      lang: "pt",
    });

    try {
      const resposta = await fetchComTempoLimite(
        `https://photon.komoot.io/api/?${parametros.toString()}`,
        10000
      );

      if (!resposta.ok) {
        return null;
      }

      const dados = await resposta.json();

      const resultados: ResultadoPhoton[] =
        dados.features ?? [];

      const resultadoBrasil =
        resultados.find((resultado) => {
          const codigoPais =
            resultado.properties?.countrycode
              ?.toLowerCase()
              .trim();

          const pais =
            resultado.properties?.country
              ?.toLowerCase()
              .trim();

          return (
            codigoPais === "br" ||
            codigoPais === "bra" ||
            pais === "brasil" ||
            pais === "brazil"
          );
        });

      if (!resultadoBrasil) {
        return null;
      }

      const [longitude, latitude] =
        resultadoBrasil.geometry.coordinates;

      if (
        Number.isNaN(Number(latitude)) ||
        Number.isNaN(Number(longitude))
      ) {
        return null;
      }

      return {
        latitude: Number(latitude),
        longitude: Number(longitude),
      };
    } catch (erroPhoton) {
      console.warn(
        "Erro no Photon:",
        erroPhoton
      );

      return null;
    }
  }

  async function buscarCoordenadasDoEndereco(): Promise<Coordenadas> {
    const enderecoInformado =
      endereco.trim();

    if (!enderecoInformado) {
      throw new Error(
        "Informe o endereço da ocorrência."
      );
    }

    /*
     * Primeiro procura considerando Recife–PE.
     * Depois tenta Pernambuco e, por último,
     * pesquisa no restante do Brasil.
     */
    const opcoesDeBusca = [
      `${enderecoInformado}, Recife, Pernambuco, Brasil`,
      `${enderecoInformado}, Pernambuco, Brasil`,
      `${enderecoInformado}, Brasil`,
    ];

    const opcoesSemRepeticao = [
      ...new Set(opcoesDeBusca),
    ];

    setEtapaEnvio(
      "Procurando o endereço..."
    );

    for (
      const enderecoCompleto of opcoesSemRepeticao
    ) {
      const resultadoNominatim =
        await buscarNoNominatim(
          enderecoCompleto
        );

      if (resultadoNominatim) {
        return resultadoNominatim;
      }
    }

    setEtapaEnvio(
      "Tentando localizar o endereço novamente..."
    );

    for (
      const enderecoCompleto of opcoesSemRepeticao
    ) {
      const resultadoPhoton =
        await buscarNoPhoton(
          enderecoCompleto
        );

      if (resultadoPhoton) {
        return resultadoPhoton;
      }
    }

    throw new Error(
      "Endereço não encontrado. Digite no formato: R. Bom Pastor, 1600 - Iputinga."
    );
  }

  async function enviarFormulario(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    setErro("");
    setEtapaEnvio("");

    if (!categoria) {
      setErro(
        "Selecione uma categoria."
      );
      return;
    }

    if (!titulo.trim()) {
      setErro(
        "Informe o título da ocorrência."
      );
      return;
    }

    if (!descricao.trim()) {
      setErro(
        "Descreva o problema."
      );
      return;
    }

    if (
      categoria === "deslizamento" &&
      !tipoTerreno
    ) {
      setErro("Informe o tipo de terreno do local.");
      return;
    }

    if (!endereco.trim() && !coordenadas) {
      setErro(
        "Informe o endereço ou confirme sua localização exata."
      );
      return;
    }

    if (!bairro.trim()) {
      setErro(
        "Informe o bairro da ocorrência."
      );
      return;
    }

    if (!arquivoFoto && !arquivoVideo) {
      setErro(
        "Tire uma foto ou grave um vídeo do problema."
      );
      return;
    }

    if (buscandoLocalizacao) {
      setErro(
        "Aguarde a confirmação da localização."
      );
      return;
    }

    setEnviando(true);

    let nomeArquivoFoto = "";
    let nomeArquivoVideo = "";

    try {
      setEtapaEnvio(
        "Verificando sua conta..."
      );

      const {
        data: { user },
        error: erroUsuario,
      } = await supabase.auth.getUser();

      if (erroUsuario) {
        throw new Error(
          `Não foi possível verificar sua conta: ${erroUsuario.message}`
        );
      }

      if (!user) {
        throw new Error(
          "Entre na sua conta antes de registrar uma ocorrência."
        );
      }

      let localOcorrencia: Coordenadas;

      if (coordenadas) {
        setEtapaEnvio(
          "Usando sua localização confirmada..."
        );

        localOcorrencia = coordenadas;
      } else {
        localOcorrencia =
          await buscarCoordenadasDoEndereco();
      }

      let fotoUrl: string | null = null;
      let videoUrl: string | null = null;

      if (arquivoFoto) {
        setEtapaEnvio("Enviando a fotografia...");

        const extensaoFoto =
          arquivoFoto.name
            .split(".")
            .pop()
            ?.toLowerCase() || "jpg";

        nomeArquivoFoto =
          `${crypto.randomUUID()}.${extensaoFoto}`;

        const { error: erroFoto } =
          await supabase.storage
            .from("fotos-ocorrencias")
            .upload(
              nomeArquivoFoto,
              arquivoFoto,
              {
                contentType: arquivoFoto.type,
                cacheControl: "3600",
                upsert: false,
              }
            );

        if (erroFoto) {
          throw new Error(
            `Erro ao enviar fotografia: ${erroFoto.message}`
          );
        }

        const { data: dadosFoto } =
          supabase.storage
            .from("fotos-ocorrencias")
            .getPublicUrl(nomeArquivoFoto);

        fotoUrl = dadosFoto.publicUrl || null;
      }

      if (arquivoVideo) {
        setEtapaEnvio("Enviando o vídeo...");

        const extensaoVideo =
          arquivoVideo.name
            .split(".")
            .pop()
            ?.toLowerCase() || "webm";

        nomeArquivoVideo =
          `${crypto.randomUUID()}.${extensaoVideo}`;

        const { error: erroVideo } =
          await supabase.storage
            .from("videos-ocorrencias")
            .upload(
              nomeArquivoVideo,
              arquivoVideo,
              {
                contentType: arquivoVideo.type,
                cacheControl: "3600",
                upsert: false,
              }
            );

        if (erroVideo) {
          throw new Error(
            `Erro ao enviar vídeo: ${erroVideo.message}`
          );
        }

        const { data: dadosVideo } =
          supabase.storage
            .from("videos-ocorrencias")
            .getPublicUrl(nomeArquivoVideo);

        videoUrl = dadosVideo.publicUrl || null;
      }

      setEtapaEnvio(
        "Salvando a ocorrência..."
      );

      const {
        data,
        error: erroOcorrencia,
      } = await supabase
        .from("ocorrencias")
        .insert({
          user_id: user.id,
          categoria,
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          endereco:
            endereco.trim() ||
            "Localização exata informada pelo usuário",
          bairro: bairro.trim(),
          latitude:
            localOcorrencia.latitude,
          longitude:
            localOcorrencia.longitude,
          urgencia,
          tipo_terreno:
            categoria === "deslizamento"
              ? tipoTerreno
              : null,
          condicao_local:
            categoria === "deslizamento"
              ? condicaoLocal
              : null,
          status: "aberto",
          foto_url: fotoUrl,
          video_url: videoUrl,
        })
        .select("id")
        .single();

      if (erroOcorrencia) {
        if (nomeArquivoFoto) {
          await supabase.storage
            .from("fotos-ocorrencias")
            .remove([nomeArquivoFoto]);
        }

        throw new Error(
          `Erro ao salvar ocorrência: ${erroOcorrencia.message}`
        );
      }

      if (!data?.id) {
        throw new Error(
          "A ocorrência foi salva, mas o protocolo não foi recebido."
        );
      }

      setProtocolo(
        `MB-${data.id
          .slice(0, 8)
          .toUpperCase()}`
      );

      setEtapaEnvio("");
    } catch (erroDesconhecido) {
      console.error(
        "Erro ao registrar ocorrência:",
        erroDesconhecido
      );

      if (
        erroDesconhecido instanceof Error
      ) {
        setErro(
          erroDesconhecido.message
        );
      } else {
        setErro(
          "Não foi possível registrar a ocorrência."
        );
      }

      setEtapaEnvio("");
    } finally {
      setEnviando(false);
    }
  }

  function novoRegistro() {
    encerrarCamera();

    if (fotoPreview) {
      URL.revokeObjectURL(
        fotoPreview
      );
    }

    if (videoPreview) {
      URL.revokeObjectURL(
        videoPreview
      );
    }

    setCategoria("");
    setTitulo("");
    setDescricao("");
    setEndereco("");
    setBairro("");
    setUrgencia("media");
    setTipoTerreno("");
    setCondicaoLocal("normal");
    setArquivoFoto(null);
    setFotoPreview("");
    setArquivoVideo(null);
    setVideoPreview("");
    setCoordenadas(null);
    setProtocolo("");
    setErro("");
    setEtapaEnvio("");
    setBuscandoLocalizacao(false);
  }

  if (protocolo) {
    return (
      <main className="pagina-registro">
        <section className="registro-sucesso">
          <CheckCircle2 size={70} />

          <h1>
            Ocorrência registrada!
          </h1>

          <p>
            Seu protocolo é{" "}
            <strong>{protocolo}</strong>.
          </p>

          <p>
            A ocorrência foi enviada e já pode ser
            visualizada no mapa da comunidade.
          </p>

          <button
            type="button"
            onClick={novoRegistro}
          >
            Registrar outro problema
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="pagina-registro">
      <section className="titulo-pagina">
        <span>Nova ocorrência</span>

        <h1>
          Registrar um problema
        </h1>

        <p>
          Informe o endereço do problema. A localização
          exata é opcional.
        </p>
      </section>

      <form
        className="formulario-registro"
        onSubmit={enviarFormulario}
        noValidate
      >
        {erro && (
          <div className="mensagem-erro campo-completo">
            {erro}
          </div>
        )}

        {etapaEnvio && (
          <div className="mensagem-processando campo-completo">
            {etapaEnvio}
          </div>
        )}

        <div className="campo campo-completo">
          <label htmlFor="categoria">
            Categoria do problema
          </label>

          <select
            id="categoria"
            value={categoria}
            onChange={(evento) => {
              const novaCategoria =
                evento.target.value;

              setCategoria(novaCategoria);

              if (novaCategoria !== "deslizamento") {
                setTipoTerreno("");
                setCondicaoLocal("normal");
              }
            }}
            disabled={enviando}
          >
            <option value="">
              Selecione uma categoria
            </option>

            <option value="buraco">
              Buraco na rua
            </option>

            <option value="iluminacao">
              Iluminação pública
            </option>

            <option value="lixo">
              Lixo acumulado
            </option>

            <option value="alagamento">
              Alagamento
            </option>

            <option value="calcada">
              Calçada danificada
            </option>

            <option value="deslizamento">
              Deslizamento de terra ou barreira
            </option>

            <option value="outro">
              Outro problema
            </option>
          </select>
        </div>

        {categoria === "deslizamento" && (
          <>
            <div className="campo">
              <label htmlFor="tipo-terreno">
                Tipo de terreno
              </label>

              <select
                id="tipo-terreno"
                value={tipoTerreno}
                onChange={(evento) =>
                  setTipoTerreno(evento.target.value)
                }
                disabled={enviando}
                required
              >
                <option value="">Selecione o terreno</option>
                <option value="plano">Plano</option>
                <option value="encosta">Encosta</option>
                <option value="morro">Área de morro</option>
                <option value="canal_rio">Próximo a canal ou rio</option>
                <option value="nao_identificado">Não identificado</option>
              </select>
            </div>

            <div className="campo">
              <label htmlFor="condicao-local">
                Condição do local
              </label>

              <select
                id="condicao-local"
                value={condicaoLocal}
                onChange={(evento) =>
                  setCondicaoLocal(evento.target.value)
                }
                disabled={enviando}
              >
                <option value="normal">Normal</option>
                <option value="solo_encharcado">Solo encharcado</option>
                <option value="rachaduras">Rachaduras no terreno</option>
                <option value="pequeno_deslizamento">Pequeno deslizamento</option>
                <option value="deslizamento_andamento">Deslizamento em andamento</option>
              </select>

              {(condicaoLocal === "rachaduras" ||
                condicaoLocal === "pequeno_deslizamento" ||
                condicaoLocal === "deslizamento_andamento") && (
                <div className="alerta-defesa-civil">
                  <strong>Atenção: situação de risco.</strong>
                  <span>
                    Afaste-se do local e ligue para a Defesa Civil no número 199.
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        <div className="campo campo-completo">
          <label htmlFor="titulo">
            Título
          </label>

          <input
            id="titulo"
            type="text"
            value={titulo}
            onChange={(evento) =>
              setTitulo(evento.target.value)
            }
            placeholder="Ex.: Buraco grande na avenida"
            disabled={enviando}
          />
        </div>

        <div className="campo campo-completo">
          <label htmlFor="descricao">
            Descrição
          </label>

          <textarea
            id="descricao"
            rows={5}
            value={descricao}
            onChange={(evento) =>
              setDescricao(evento.target.value)
            }
            placeholder="Descreva o problema e informe um ponto de referência."
            disabled={enviando}
          />
        </div>

        <div className="campo">
          <label htmlFor="bairro">
            Bairro da ocorrência
          </label>

          <div className="campo-icone">
            <MapPin size={20} />

            <input
              id="bairro"
              type="text"
              value={bairro}
              onChange={(evento) =>
                setBairro(evento.target.value)
              }
              placeholder="Ex.: Iputinga"
              autoComplete="address-level3"
              disabled={enviando}
              required
            />
          </div>

          <small>
            Ao usar sua localização, tentaremos preencher o bairro automaticamente.
          </small>
        </div>

        <div className="campo">
          <label htmlFor="endereco">
            Endereço da ocorrência
          </label>

          <div className="campo-icone">
            <MapPin size={20} />

            <input
              id="endereco"
              type="text"
              value={endereco}
              onChange={(evento) => {
                setEndereco(
                  evento.target.value
                );

                if (coordenadas) {
                  setCoordenadas(null);
                }
              }}
              placeholder="Ex.: R. Bom Pastor, 1600 - Iputinga"
              autoComplete="street-address"
              disabled={enviando}
              required
            />
          </div>

          <small>
            Se não informar a cidade e o estado, será
            considerado Recife–PE.
          </small>
        </div>

        <div className="campo">
          <label>
            Localização exata (opcional)
          </label>

          <button
            className="botao-localizacao"
            type="button"
            translate="no"
            aria-label="Usar minha localização"
            onClick={obterLocalizacao}
            disabled={
              enviando ||
              buscandoLocalizacao
            }
          >
            <LocateFixed size={20} />

            <span
              className="notranslate"
              translate="no"
            >
              {buscandoLocalizacao
                ? "Buscando localização..."
                : coordenadas
                  ? "Localização confirmada"
                  : "Usar minha localização"}
            </span>
          </button>

          <small>
            Você pode registrar usando somente o
            endereço.
          </small>
        </div>

        <div className="campo campo-completo">
          <label htmlFor="urgencia">
            Nível de urgência
          </label>

          <select
            id="urgencia"
            value={urgencia}
            onChange={(evento) =>
              setUrgencia(evento.target.value)
            }
            disabled={enviando}
          >
            <option value="baixa">
              Baixa
            </option>

            <option value="media">
              Média
            </option>

            <option value="alta">
              Alta
            </option>
          </select>
        </div>

        <div className="campo campo-completo">
          <label>
            Foto ou vídeo do problema
          </label>

          <p className="midia-explicacao">
            Abra a câmera dentro do site para tirar uma
            foto ou gravar um vídeo de até 30 segundos.
            É obrigatório enviar pelo menos uma mídia.
          </p>

          <div className="midia-acoes-iniciais">
            <button
              className="botao-abrir-camera"
              type="button"
              onClick={() => abrirCamera("foto")}
              disabled={enviando || gravandoVideo}
            >
              <Camera size={20} />
              Tirar foto no site
            </button>

            <button
              className="botao-abrir-camera botao-camera-video"
              type="button"
              onClick={() => abrirCamera("video")}
              disabled={enviando || gravandoVideo}
            >
              <span aria-hidden="true">●</span>
              Gravar vídeo no site
            </button>

            <label
              className="botao-escolher-galeria"
              htmlFor="foto"
            >
              Escolher foto da galeria
            </label>
          </div>

          <input
            id="foto"
            className="input-foto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={escolherFoto}
            disabled={enviando}
          />

          {cameraAberta && (
            <div className="camera-interna">
              <div className="camera-cabecalho">
                <strong>
                  {modoCamera === "foto"
                    ? "Câmera para fotografia"
                    : "Câmera para vídeo"}
                </strong>

                <button
                  type="button"
                  onClick={encerrarCamera}
                  disabled={gravandoVideo}
                >
                  Fechar câmera
                </button>
              </div>

              <div className="camera-visualizacao">
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                />

                {gravandoVideo && (
                  <div className="camera-gravando">
                    <span />
                    Gravando {segundosGravacao}s / 30s
                  </div>
                )}
              </div>

              <div className="camera-controles">
                {modoCamera === "foto" ? (
                  <button
                    className="camera-capturar"
                    type="button"
                    onClick={tirarFotoDentroDoSite}
                  >
                    Tirar fotografia
                  </button>
                ) : gravandoVideo ? (
                  <button
                    className="camera-parar"
                    type="button"
                    onClick={pararGravacao}
                  >
                    Parar gravação
                  </button>
                ) : (
                  <button
                    className="camera-gravar"
                    type="button"
                    onClick={iniciarGravacao}
                  >
                    Iniciar gravação
                  </button>
                )}
              </div>
            </div>
          )}

          {(fotoPreview || videoPreview) && (
            <div className="midias-preview">
              {fotoPreview && (
                <article className="midia-preview-card">
                  <div className="midia-preview-titulo">
                    <strong>Fotografia</strong>

                    <button
                      type="button"
                      onClick={removerFoto}
                      disabled={enviando}
                    >
                      Remover
                    </button>
                  </div>

                  <img
                    src={fotoPreview}
                    alt="Prévia do problema"
                  />
                </article>
              )}

              {videoPreview && (
                <article className="midia-preview-card">
                  <div className="midia-preview-titulo">
                    <strong>Vídeo</strong>

                    <button
                      type="button"
                      onClick={removerVideo}
                      disabled={enviando}
                    >
                      Remover
                    </button>
                  </div>

                  <video
                    src={videoPreview}
                    controls
                    playsInline
                  />
                </article>
              )}
            </div>
          )}
        </div>

        <button
          className="botao-enviar"
          type="submit"
          disabled={
            enviando ||
            buscandoLocalizacao
          }
        >
          <Send size={20} />

          {enviando
            ? etapaEnvio ||
              "Enviando ocorrência..."
            : "Registrar ocorrência"}
        </button>
      </form>
    </main>
  );
}

export default Registrar;
