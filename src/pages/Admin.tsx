import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  FileWarning,
  LogOut,
  Mail,
  Download,
  Filter,
  History,
  MapPin,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { User } from "@supabase/supabase-js";

import { supabase } from "../services/supabase";
import "./Admin.css";

type StatusOcorrencia =
  | "aberto"
  | "em_analise"
  | "encaminhado"
  | "em_andamento"
  | "aguardando_recursos"
  | "resolvido"
  | "nao_solucionado"
  | "duplicado"
  | "cancelado";

type Ocorrencia = {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  urgencia: "baixa" | "media" | "alta";
  status: StatusOcorrencia;
  foto_url: string | null;
  video_url?: string | null;
  tipo_terreno?: string | null;
  condicao_local?: string | null;
  bairro?: string | null;
  prioridade_admin?: "normal" | "prioritaria" | "emergencial";
  responsavel_admin_id?: string | null;
  resposta_oficial?: string | null;
  previsao_atendimento?: string | null;
  atualizado_em?: string;
  criado_em: string;
  moderacao_status?: "pendente" | "aprovada" | "rejeitada";
  moderacao_observacao?: string | null;
  moderado_em?: string | null;
  moderado_por?: string | null;
};

type Visita = {
  id: string;
  sessao_id: string;
  pagina: string;
  criado_em: string;
};

type AdministradorPainel = {
  user_id: string;
  email: string;
  criado_em: string | null;
};

type AtualizacaoOcorrencia = {
  id: string;
  tipo: string;
  status_anterior: string | null;
  status_novo: string | null;
  comentario: string;
  publica: boolean;
  criado_em: string;
};

type CardMetricaProps = {
  titulo: string;
  valor: number;
  classe: string;
  icone: ReactNode;
};

const CORES = [
  "#ff5a00",
  "#ffb000",
  "#63b32e",
  "#38bdf8",
  "#8b5cf6",
  "#ec4899",
];

function Admin() {
  const navigate = useNavigate();

  const [usuario, setUsuario] =
    useState<User | null>(null);

  const [administrador, setAdministrador] =
    useState(false);

  const [verificando, setVerificando] =
    useState(true);

  const [ocorrencias, setOcorrencias] =
    useState<Ocorrencia[]>([]);

  const [visitas, setVisitas] =
    useState<Visita[]>([]);

  const [carregando, setCarregando] =
    useState(false);

  const [erroPainel, setErroPainel] =
    useState("");

  const [excluindoId, setExcluindoId] =
    useState<string | null>(null);

  const [moderandoId, setModerandoId] =
    useState<string | null>(null);

  const [administradores, setAdministradores] =
    useState<AdministradorPainel[]>([]);

  const [emailNovoAdministrador, setEmailNovoAdministrador] =
    useState("");

  const [salvandoAdministrador, setSalvandoAdministrador] =
    useState(false);

  const [mensagemAdministrador, setMensagemAdministrador] =
    useState("");

  const [pesquisaOcorrencia, setPesquisaOcorrencia] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroModeracao, setFiltroModeracao] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroUrgencia, setFiltroUrgencia] = useState("todas");
  const [filtroBairro, setFiltroBairro] = useState("todos");
  const [ordenacao, setOrdenacao] = useState("recentes");

  const [ocorrenciaSelecionada, setOcorrenciaSelecionada] =
    useState<Ocorrencia | null>(null);
  const [statusEdicao, setStatusEdicao] =
    useState<StatusOcorrencia>("aberto");
  const [prioridadeEdicao, setPrioridadeEdicao] = useState("normal");
  const [responsavelEdicao, setResponsavelEdicao] = useState("");
  const [respostaEdicao, setRespostaEdicao] = useState("");
  const [previsaoEdicao, setPrevisaoEdicao] = useState("");
  const [comentarioEdicao, setComentarioEdicao] = useState("");
  const [historicoOcorrencia, setHistoricoOcorrencia] =
    useState<AtualizacaoOcorrencia[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [salvandoDetalhes, setSalvandoDetalhes] = useState(false);

  useEffect(() => {
    void verificarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (evento, sessao) => {
        if (evento === "SIGNED_OUT" || !sessao?.user) {
          setUsuario(null);
          setAdministrador(false);
          setVerificando(false);
          return;
        }

        if (
          evento === "SIGNED_IN" ||
          evento === "TOKEN_REFRESHED"
        ) {
          window.setTimeout(() => {
            void verificarAdministrador(
              sessao.user
            );
          }, 0);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function verificarSessao() {
    setVerificando(true);
    setErroPainel("");

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      setUsuario(null);
      setAdministrador(false);
      setVerificando(false);
      return;
    }

    await verificarAdministrador(user);
  }

  async function verificarAdministrador(
    user: User
  ) {
    const { data, error } = await supabase.rpc(
      "usuario_eh_administrador"
    );

    if (error) {
      console.error(
        "Erro ao verificar administrador:",
        error.message
      );

      setErroPainel(
        `Não foi possível verificar a permissão administrativa: ${error.message}`
      );
      setUsuario(user);
      setAdministrador(false);
      setVerificando(false);
      return;
    }

    if (data !== true) {
      setErroPainel(
        "Esta conta não possui permissão de administrador."
      );
      setUsuario(user);
      setAdministrador(false);
      setVerificando(false);
      return;
    }

    setUsuario(user);
    setAdministrador(true);
    setErroPainel("");
    setVerificando(false);

    await carregarPainel();
  }

  async function carregarPainel() {
    setCarregando(true);
    setErroPainel("");

    const [
      resultadoOcorrencias,
      resultadoVisitas,
      resultadoAdministradores,
    ] =
      await Promise.all([
        supabase
          .from("ocorrencias")
          .select("*")
          .order("criado_em", {
            ascending: false,
          }),

        supabase
          .from("visitas")
          .select("*")
          .order("criado_em", {
            ascending: false,
          }),

        supabase.rpc("listar_administradores"),
      ]);

    const mensagensErro: string[] = [];

    if (resultadoOcorrencias.error) {
      mensagensErro.push(
        `Ocorrências: ${resultadoOcorrencias.error.message}`
      );
    }

    if (resultadoVisitas.error) {
      mensagensErro.push(
        `Visitas: ${resultadoVisitas.error.message}`
      );
    }

    if (resultadoAdministradores.error) {
      mensagensErro.push(
        `Administradores: ${resultadoAdministradores.error.message}`
      );
    }

    setErroPainel(mensagensErro.join(" | "));
    setOcorrencias(
      (resultadoOcorrencias.data ?? []) as Ocorrencia[]
    );
    setVisitas(
      (resultadoVisitas.data ?? []) as Visita[]
    );
    setAdministradores(
      (resultadoAdministradores.data ?? []) as AdministradorPainel[]
    );
    setCarregando(false);
  }

  async function adicionarAdministrador() {
    const email = emailNovoAdministrador
      .trim()
      .toLowerCase();

    setErroPainel("");
    setMensagemAdministrador("");

    if (!email) {
      setErroPainel(
        "Informe o e-mail da conta que receberá acesso administrativo."
      );
      return;
    }

    setSalvandoAdministrador(true);

    const { data, error } = await supabase.rpc(
      "adicionar_administrador_por_email",
      { email_novo_admin: email }
    );

    if (error) {
      setErroPainel(
        `Não foi possível adicionar o administrador: ${error.message}`
      );
      setSalvandoAdministrador(false);
      return;
    }

    if (data !== true) {
      setErroPainel(
        "Nenhuma conta foi encontrada com esse e-mail. A pessoa precisa criar uma conta comum primeiro."
      );
      setSalvandoAdministrador(false);
      return;
    }

    setEmailNovoAdministrador("");
    setMensagemAdministrador(
      "Acesso administrativo concedido com sucesso."
    );
    setSalvandoAdministrador(false);
    await carregarPainel();
  }

  async function removerAdministrador(
    administradorRemover: AdministradorPainel
  ) {
    if (administradorRemover.user_id === usuario?.id) {
      setErroPainel(
        "Você não pode remover seu próprio acesso administrativo."
      );
      return;
    }

    const confirmou = window.confirm(
      `Remover o acesso administrativo de ${administradorRemover.email}?`
    );

    if (!confirmou) {
      return;
    }

    setErroPainel("");
    setMensagemAdministrador("");

    const { data, error } = await supabase.rpc(
      "remover_administrador",
      {
        admin_remover_id:
          administradorRemover.user_id,
      }
    );

    if (error || data !== true) {
      setErroPainel(
        error
          ? `Não foi possível remover o administrador: ${error.message}`
          : "Não foi possível remover esse administrador."
      );
      return;
    }

    setMensagemAdministrador(
      "Acesso administrativo removido."
    );
    await carregarPainel();
  }

  async function alterarStatus(
    ocorrenciaId: string,
    novoStatus: StatusOcorrencia
  ) {
    setErroPainel("");

    const ocorrenciaAtual = ocorrencias.find(
      (ocorrencia) => ocorrencia.id === ocorrenciaId
    );

    if (!ocorrenciaAtual) return;

    const statusAnterior = ocorrenciaAtual.status;

    setOcorrencias((listaAtual) =>
      listaAtual.map((ocorrencia) =>
        ocorrencia.id === ocorrenciaId
          ? {
              ...ocorrencia,
              status: novoStatus,
            }
          : ocorrencia
      )
    );

    const { data, error } = await supabase.rpc(
      "admin_painel_atualizar_ocorrencia",
      {
        p_ocorrencia_id: ocorrenciaId,
        p_status: novoStatus,
        p_prioridade: ocorrenciaAtual.prioridade_admin ?? "normal",
        p_responsavel_admin_id: ocorrenciaAtual.responsavel_admin_id ?? null,
        p_resposta_oficial: ocorrenciaAtual.resposta_oficial ?? null,
        p_comentario_historico: `Status alterado para ${formatarStatus(novoStatus)}.`,
      }
    );

    if (error || data !== true) {
      setErroPainel(
        error
          ? `Não foi possível alterar o status: ${error.message}`
          : "Não foi possível alterar o status."
      );

      setOcorrencias((listaAtual) =>
        listaAtual.map((ocorrencia) =>
          ocorrencia.id === ocorrenciaId
            ? { ...ocorrencia, status: statusAnterior }
            : ocorrencia
        )
      );
    }
  }

  async function abrirDetalhes(ocorrencia: Ocorrencia) {
    setOcorrenciaSelecionada(ocorrencia);
    setStatusEdicao(ocorrencia.status);
    setPrioridadeEdicao(ocorrencia.prioridade_admin ?? "normal");
    setResponsavelEdicao(ocorrencia.responsavel_admin_id ?? "");
    setRespostaEdicao(ocorrencia.resposta_oficial ?? "");
    setPrevisaoEdicao(ocorrencia.previsao_atendimento ?? "");
    setComentarioEdicao("");
    setCarregandoHistorico(true);

    const { data, error } = await supabase
      .from("atualizacoes_ocorrencias")
      .select("id, tipo, status_anterior, status_novo, comentario, publica, criado_em")
      .eq("ocorrencia_id", ocorrencia.id)
      .order("criado_em", { ascending: false });

    if (error) {
      setErroPainel(`Não foi possível carregar o histórico: ${error.message}`);
      setHistoricoOcorrencia([]);
    } else {
      setHistoricoOcorrencia((data ?? []) as AtualizacaoOcorrencia[]);
    }

    setCarregandoHistorico(false);
  }

  function fecharDetalhes() {
    if (salvandoDetalhes) return;
    setOcorrenciaSelecionada(null);
    setHistoricoOcorrencia([]);
  }

  async function salvarDetalhesOcorrencia() {
    if (!ocorrenciaSelecionada) return;

    setSalvandoDetalhes(true);
    setErroPainel("");

    const { data, error } = await supabase.rpc(
      "admin_painel_atualizar_ocorrencia",
      {
        p_ocorrencia_id: ocorrenciaSelecionada.id,
        p_status: statusEdicao,
        p_prioridade: prioridadeEdicao,
        p_responsavel_admin_id: responsavelEdicao || null,
        p_resposta_oficial: respostaEdicao.trim() || null,
        p_comentario_historico: comentarioEdicao.trim() || null,
        p_previsao_atendimento: previsaoEdicao || null,
      }
    );

    if (error || data !== true) {
      setErroPainel(
        error
          ? `Não foi possível salvar as alterações: ${error.message}`
          : "Não foi possível salvar as alterações."
      );
      setSalvandoDetalhes(false);
      return;
    }

    setOcorrencias((listaAtual) =>
      listaAtual.map((item) =>
        item.id === ocorrenciaSelecionada.id
          ? {
              ...item,
              status: statusEdicao,
              prioridade_admin: prioridadeEdicao as Ocorrencia["prioridade_admin"],
              responsavel_admin_id: responsavelEdicao || null,
              resposta_oficial: respostaEdicao.trim() || null,
              previsao_atendimento: previsaoEdicao || null,
              atualizado_em: new Date().toISOString(),
            }
          : item
      )
    );

    const atualizada = {
      ...ocorrenciaSelecionada,
      status: statusEdicao,
      prioridade_admin: prioridadeEdicao as Ocorrencia["prioridade_admin"],
      responsavel_admin_id: responsavelEdicao || null,
      resposta_oficial: respostaEdicao.trim() || null,
      previsao_atendimento: previsaoEdicao || null,
      atualizado_em: new Date().toISOString(),
    };

    setOcorrenciaSelecionada(atualizada);
    setComentarioEdicao("");
    setMensagemAdministrador("Ocorrência atualizada com sucesso.");
    setSalvandoDetalhes(false);
    await abrirDetalhes(atualizada);
  }

  async function excluirArquivoStorage(
    url: string | null | undefined,
    bucket: string
  ) {
    if (!url) {
      return;
    }

    const trechoPublico =
      `/storage/v1/object/public/${bucket}/`;

    const caminho = url.split(trechoPublico)[1];

    if (!caminho) {
      return;
    }

    const { error } = await supabase.storage
      .from(bucket)
      .remove([decodeURIComponent(caminho)]);

    if (error) {
      console.warn(
        `Não foi possível remover o arquivo de ${bucket}:`,
        error.message
      );
    }
  }

  async function excluirOcorrencia(
    ocorrencia: Ocorrencia
  ) {
    const confirmou = window.confirm(
      `Deseja realmente excluir a ocorrência "${ocorrencia.titulo}"?\n\nEssa ação não poderá ser desfeita.`
    );

    if (!confirmou) {
      return;
    }

    setExcluindoId(ocorrencia.id);
    setErroPainel("");

    const { error } = await supabase
      .from("ocorrencias")
      .delete()
      .eq("id", ocorrencia.id);

    if (error) {
      setErroPainel(
        `Não foi possível excluir a ocorrência: ${error.message}`
      );
      setExcluindoId(null);
      return;
    }

    await Promise.all([
      excluirArquivoStorage(
        ocorrencia.foto_url,
        "fotos-ocorrencias"
      ),
      excluirArquivoStorage(
        ocorrencia.video_url,
        "videos-ocorrencias"
      ),
    ]);

    setOcorrencias((listaAtual) =>
      listaAtual.filter(
        (item) => item.id !== ocorrencia.id
      )
    );
    setExcluindoId(null);
  }

  async function moderarOcorrencia(
    ocorrencia: Ocorrencia,
    aprovar: boolean
  ) {
    const observacao = aprovar
      ? "Ocorrência verificada e aprovada para publicação."
      : window.prompt(
          "Informe o motivo da rejeição:",
          "As informações enviadas precisam ser corrigidas."
        );

    if (!aprovar && observacao === null) return;

    const confirmou = window.confirm(
      aprovar
        ? `Aprovar e publicar a ocorrência "${ocorrencia.titulo}"?`
        : `Rejeitar a ocorrência "${ocorrencia.titulo}"?`
    );

    if (!confirmou) return;

    setModerandoId(ocorrencia.id);
    setErroPainel("");

    const { error } = await supabase.rpc("moderar_ocorrencia", {
      p_ocorrencia_id: ocorrencia.id,
      p_aprovar: aprovar,
      p_observacao: observacao?.trim() || null,
    });

    if (error) {
      setErroPainel(
        `Não foi possível moderar a ocorrência: ${error.message}`
      );
      setModerandoId(null);
      return;
    }

    const novoStatus = aprovar ? "aprovada" : "rejeitada";

    setOcorrencias((listaAtual) =>
      listaAtual.map((item) =>
        item.id === ocorrencia.id
          ? {
              ...item,
              moderacao_status: novoStatus,
              moderacao_observacao: observacao?.trim() || null,
              moderado_em: new Date().toISOString(),
              moderado_por: usuario?.id ?? null,
            }
          : item
      )
    );

    setModerandoId(null);

    if (aprovar) {
      await compartilharNoWhatsApp({
        ...ocorrencia,
        moderacao_status: "aprovada",
      });
    }
  }

  async function compartilharNoWhatsApp(ocorrencia: Ocorrencia) {
    const protocolo = `MB-${new Date(ocorrencia.criado_em).getFullYear()}-${ocorrencia.id
      .replaceAll("-", "")
      .slice(0, 6)
      .toUpperCase()}`;

    const endereco = ocorrencia.bairro
      ? `${ocorrencia.endereco} — ${ocorrencia.bairro}`
      : ocorrencia.endereco;

    const link = `${window.location.origin}/ocorrencias/${ocorrencia.id}`;

    const mensagem = [
      "🚨 *Nova ocorrência aprovada*",
      "",
      `📌 *Problema:* ${ocorrencia.titulo}`,
      `🏷️ *Categoria:* ${formatarCategoria(ocorrencia.categoria)}`,
      "",
      "📝 *Descrição enviada pelo morador:*",
      ocorrencia.descricao?.trim() || "Descrição não informada.",
      "",
      `📍 *Local:* ${endereco}`,
      `⚠️ *Urgência:* ${formatarUrgencia(ocorrencia.urgencia)}`,
      `🔖 *Protocolo:* ${protocolo}`,
      "",
      "Confira os detalhes:",
      link,
    ].join("\n");

    const midiaUrl = ocorrencia.foto_url || ocorrencia.video_url;

    if (midiaUrl && navigator.share) {
      try {
        const resposta = await fetch(midiaUrl);

        if (!resposta.ok) {
          throw new Error("Não foi possível baixar a mídia.");
        }

        const blob = await resposta.blob();
        const tipo = blob.type || (ocorrencia.video_url ? "video/mp4" : "image/jpeg");
        const extensao = tipo.split("/")[1]?.split(";")[0] ||
          (ocorrencia.video_url ? "mp4" : "jpg");
        const arquivo = new File(
          [blob],
          `ocorrencia-${protocolo}.${extensao}`,
          { type: tipo }
        );

        if (!navigator.canShare || navigator.canShare({ files: [arquivo] })) {
          await navigator.share({
            files: [arquivo],
            text: mensagem,
            title: `Ocorrência ${protocolo}`,
          });
          return;
        }
      } catch (erro) {
        if (erro instanceof DOMException && erro.name === "AbortError") return;
        console.warn("Compartilhamento direto da mídia indisponível:", erro);
      }
    }

    if (midiaUrl) {
      try {
        await navigator.clipboard.writeText(mensagem);
      } catch {
        // O texto também será enviado pela URL do WhatsApp abaixo.
      }

      window.open(midiaUrl, "_blank", "noopener,noreferrer");
    }

    window.open(
      `https://wa.me/?text=${encodeURIComponent(mensagem)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function sair() {
    await supabase.auth.signOut();
    navigate("/entrar", { replace: true });
  }

  const visitantesUnicos = useMemo(
    () =>
      new Set(
        visitas.map((visita) => visita.sessao_id)
      ).size,
    [visitas]
  );

  const abertas = ocorrencias.filter((ocorrencia) =>
    ["aberto", "em_analise", "encaminhado"].includes(ocorrencia.status)
  ).length;

  const emAndamento = ocorrencias.filter((ocorrencia) =>
    ["em_andamento", "aguardando_recursos"].includes(ocorrencia.status)
  ).length;

  const finalizadas = ocorrencias.filter(
    (ocorrencia) =>
      ocorrencia.status === "resolvido"
  ).length;

  const encerradas = ocorrencias.filter((ocorrencia) =>
    ["nao_solucionado", "duplicado", "cancelado"].includes(ocorrencia.status)
  ).length;

  const visitasPorDia = useMemo(() => {
    const dias: {
      data: string;
      visitas: number;
    }[] = [];

    for (
      let contador = 6;
      contador >= 0;
      contador -= 1
    ) {
      const data = new Date();
      data.setDate(data.getDate() - contador);
      data.setHours(0, 0, 0, 0);

      const proximoDia = new Date(data);
      proximoDia.setDate(proximoDia.getDate() + 1);

      const quantidade = visitas.filter(
        (visita) => {
          const dataVisita = new Date(
            visita.criado_em
          );

          return (
            dataVisita >= data &&
            dataVisita < proximoDia
          );
        }
      ).length;

      dias.push({
        data: data.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        visitas: quantidade,
      });
    }

    return dias;
  }, [visitas]);

  const ocorrenciasPorCategoria = useMemo(() => {
    const categorias: Record<string, number> = {};

    ocorrencias.forEach((ocorrencia) => {
      categorias[ocorrencia.categoria] =
        (categorias[ocorrencia.categoria] || 0) + 1;
    });

    return Object.entries(categorias).map(
      ([categoria, quantidade]) => ({
        categoria: formatarCategoria(categoria),
        quantidade,
      })
    );
  }, [ocorrencias]);

  const dadosStatus = [
    { status: "Triagem", quantidade: abertas },
    {
      status: "Em andamento",
      quantidade: emAndamento,
    },
    {
      status: "Resolvidas",
      quantidade: finalizadas,
    },
    { status: "Encerradas", quantidade: encerradas },
  ];

  const categoriasDisponiveis = useMemo(
    () =>
      Array.from(new Set(ocorrencias.map((item) => item.categoria).filter(Boolean))).sort(),
    [ocorrencias]
  );

  const bairrosDisponiveis = useMemo(
    () =>
      Array.from(
        new Set(
          ocorrencias
            .map((item) => item.bairro?.trim())
            .filter((bairro): bairro is string => Boolean(bairro))
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [ocorrencias]
  );

  const ocorrenciasFiltradas = useMemo(() => {
    const termo = normalizarTexto(pesquisaOcorrencia);
    const pesoUrgencia = { alta: 3, media: 2, baixa: 1 };

    const lista = ocorrencias.filter((item) => {
      const correspondePesquisa =
        !termo ||
        [item.titulo, item.descricao, item.endereco, item.bairro ?? "", formatarCategoria(item.categoria)]
          .some((valor) => normalizarTexto(valor).includes(termo));

      return (
        correspondePesquisa &&
        (filtroStatus === "todos" || item.status === filtroStatus) &&
        (filtroModeracao === "todos" ||
          (item.moderacao_status ?? "aprovada") === filtroModeracao) &&
        (filtroCategoria === "todas" || item.categoria === filtroCategoria) &&
        (filtroUrgencia === "todas" || item.urgencia === filtroUrgencia) &&
        (filtroBairro === "todos" || item.bairro === filtroBairro)
      );
    });

    return [...lista].sort((a, b) => {
      if (ordenacao === "antigas") {
        return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
      }
      if (ordenacao === "urgencia") {
        return pesoUrgencia[b.urgencia] - pesoUrgencia[a.urgencia];
      }
      return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
    });
  }, [ocorrencias, pesquisaOcorrencia, filtroStatus, filtroModeracao, filtroCategoria, filtroUrgencia, filtroBairro, ordenacao]);

  const alertasPainel = useMemo(() => {
    const agora = Date.now();
    const seteDias = 7 * 24 * 60 * 60 * 1000;

    return {
      emergenciais: ocorrencias.filter(
        (item) => item.prioridade_admin === "emergencial" || item.urgencia === "alta"
      ).length,
      semAtualizacao: ocorrencias.filter((item) => {
        if (item.status === "resolvido") return false;
        const referencia = item.atualizado_em ?? item.criado_em;
        return agora - new Date(referencia).getTime() > seteDias;
      }).length,
      deslizamentos: ocorrencias.filter(
        (item) => item.categoria === "deslizamento" && item.status !== "resolvido"
      ).length,
    };
  }, [ocorrencias]);

  function limparFiltros() {
    setPesquisaOcorrencia("");
    setFiltroStatus("todos");
    setFiltroModeracao("todos");
    setFiltroCategoria("todas");
    setFiltroUrgencia("todas");
    setFiltroBairro("todos");
    setOrdenacao("recentes");
  }

  function exportarOcorrenciasCsv() {
    const cabecalho = ["Título", "Categoria", "Bairro", "Endereço", "Urgência", "Status", "Prioridade", "Data"];
    const linhas = ocorrenciasFiltradas.map((item) => [
      item.titulo,
      formatarCategoria(item.categoria),
      item.bairro ?? "Não informado",
      item.endereco,
      formatarUrgencia(item.urgencia),
      formatarStatus(item.status),
      formatarPrioridade(item.prioridade_admin),
      new Date(item.criado_em).toLocaleString("pt-BR"),
    ]);

    const csv = [cabecalho, ...linhas]
      .map((linha) => linha.map(escaparCsv).join(";"))
      .join("\n");
    const arquivo = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ocorrencias-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (verificando) {
    return (
      <main className="admin-centralizado">
        <RefreshCw className="girando" size={38} />
        <p>Verificando acesso administrativo...</p>
      </main>
    );
  }

  if (!usuario || !administrador) {
    return (
      <main className="admin-login-pagina">
        <section className="admin-login">
          <div className="admin-login-icone">
            <ShieldAlert size={38} />
          </div>

          <h1>Acesso não autorizado</h1>

          <p>
            {erroPainel ||
              "Entre com uma conta administradora para acessar o painel."}
          </p>

          <Link
            to="/entrar"
            className="botao-principal"
          >
            Voltar para o login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-pagina">
      <header className="admin-topo">
        <div>
          <span>Painel privado</span>
          <h1>Administração</h1>
          <p>
            Gerencie ocorrências e acompanhe os dados
            do site.
          </p>
        </div>

        <div className="admin-topo-acoes">
          <button
            type="button"
            onClick={() => void carregarPainel()}
            disabled={carregando}
          >
            <RefreshCw
              size={18}
              className={
                carregando ? "girando" : ""
              }
            />
            Atualizar
          </button>

          <button
            type="button"
            className="admin-sair"
            onClick={() => void sair()}
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </header>

      {erroPainel && (
        <div className="admin-erro">
          {erroPainel}
        </div>
      )}

      <section className="admin-gerenciar-acessos">
        <div className="admin-acessos-titulo">
          <div>
            <span>Controle de acesso</span>
            <h2>Administradores</h2>
            <p>
              A pessoa precisa possuir uma conta no site antes de receber acesso administrativo.
            </p>
          </div>

          <strong>
            {administradores.length} administradores
          </strong>
        </div>

        {mensagemAdministrador && (
          <div className="admin-sucesso">
            <CheckCircle2 size={19} />
            {mensagemAdministrador}
          </div>
        )}

        <div className="admin-adicionar-acesso">
          <div className="admin-email-acesso">
            <Mail size={20} />
            <input
              type="email"
              value={emailNovoAdministrador}
              onChange={(evento) =>
                setEmailNovoAdministrador(
                  evento.target.value
                )
              }
              placeholder="E-mail da conta cadastrada"
              disabled={salvandoAdministrador}
            />
          </div>

          <button
            type="button"
            onClick={() =>
              void adicionarAdministrador()
            }
            disabled={salvandoAdministrador}
          >
            <UserPlus size={19} />
            {salvandoAdministrador
              ? "Adicionando..."
              : "Adicionar administrador"}
          </button>
        </div>

        <div className="admin-lista-acessos">
          {administradores.map((item) => (
            <article key={item.user_id}>
              <div className="admin-acesso-avatar">
                {item.email
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div>
                <strong>{item.email}</strong>
                <span>
                  {item.user_id === usuario.id
                    ? "Sua conta"
                    : "Administrador"}
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  void removerAdministrador(item)
                }
                disabled={item.user_id === usuario.id}
                title={
                  item.user_id === usuario.id
                    ? "Você não pode remover seu próprio acesso"
                    : "Remover acesso administrativo"
                }
              >
                <UserMinus size={18} />
                Remover
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-metricas">
        <CardMetrica
          titulo="Visitantes"
          valor={visitantesUnicos}
          classe="verde"
          icone={<Users size={24} />}
        />
        <CardMetrica
          titulo="Visualizações"
          valor={visitas.length}
          classe="azul"
          icone={<Eye size={24} />}
        />
        <CardMetrica
          titulo="Em triagem"
          valor={abertas}
          classe="vermelho"
          icone={<FileWarning size={24} />}
        />
        <CardMetrica
          titulo="Em andamento"
          valor={emAndamento}
          classe="amarelo"
          icone={<Clock3 size={24} />}
        />
        <CardMetrica
          titulo="Resolvidas"
          valor={finalizadas}
          classe="verde"
          icone={<CheckCircle2 size={24} />}
        />
      </section>

      <section className="admin-graficos">
        <article className="admin-grafico grafico-grande">
          <div className="grafico-titulo">
            <div>
              <span>Últimos sete dias</span>
              <h2>Visitas ao site</h2>
            </div>
            <BarChart3 size={24} />
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={visitasPorDia}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e1e9e4"
              />
              <XAxis dataKey="data" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="visitas"
                stroke="#ff5a00"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </article>

        <article className="admin-grafico">
          <div className="grafico-titulo">
            <div>
              <span>Distribuição</span>
              <h2>Status</h2>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosStatus}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e1e9e4"
              />
              <XAxis dataKey="status" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="quantidade"
                fill="#ff5a00"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="admin-grafico">
          <div className="grafico-titulo">
            <div>
              <span>Tipos de problemas</span>
              <h2>Categorias</h2>
            </div>
          </div>

          {ocorrenciasPorCategoria.length ? (
            <ResponsiveContainer
              width="100%"
              height={300}
            >
              <PieChart>
                <Pie
                  data={ocorrenciasPorCategoria}
                  dataKey="quantidade"
                  nameKey="categoria"
                  outerRadius={100}
                  label
                >
                  {ocorrenciasPorCategoria.map(
                    (_item, indice) => (
                      <Cell
                        key={indice}
                        fill={
                          CORES[
                            indice % CORES.length
                          ]
                        }
                      />
                    )
                  )}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="admin-sem-dados">
              Nenhuma ocorrência registrada.
            </p>
          )}
        </article>
      </section>

      <section className="admin-alertas-painel">
        <article className="alerta-admin vermelho">
          <AlertTriangle size={22} />
          <div><strong>{alertasPainel.emergenciais}</strong><span>Urgentes ou emergenciais</span></div>
        </article>
        <article className="alerta-admin amarelo">
          <Clock3 size={22} />
          <div><strong>{alertasPainel.semAtualizacao}</strong><span>Sem atualização há 7 dias</span></div>
        </article>
        <article className="alerta-admin laranja">
          <FileWarning size={22} />
          <div><strong>{alertasPainel.deslizamentos}</strong><span>Deslizamentos ativos</span></div>
        </article>
      </section>

      <section className="admin-filtros-ocorrencias">
        <div className="admin-pesquisa">
          <Search size={19} />
          <input
            type="search"
            value={pesquisaOcorrencia}
            onChange={(evento) => setPesquisaOcorrencia(evento.target.value)}
            placeholder="Pesquisar por título, endereço, bairro ou categoria"
          />
        </div>

        <div className="admin-filtros-grade">
          <label>
            <span>Status</span>
            <select value={filtroStatus} onChange={(evento) => setFiltroStatus(evento.target.value)}>
              <option value="todos">Todos</option>
              <option value="aberto">Recebidas</option>
              <option value="em_analise">Em análise</option>
              <option value="encaminhado">Encaminhadas</option>
              <option value="em_andamento">Em andamento</option>
              <option value="aguardando_recursos">Aguardando recursos</option>
              <option value="resolvido">Resolvidas</option>
              <option value="nao_solucionado">Não solucionadas</option>
              <option value="duplicado">Duplicadas</option>
              <option value="cancelado">Canceladas</option>
            </select>
          </label>

          <label>
            <span>Publicação</span>
            <select
              value={filtroModeracao}
              onChange={(evento) => setFiltroModeracao(evento.target.value)}
            >
              <option value="todos">Todas</option>
              <option value="pendente">Aguardando aprovação</option>
              <option value="aprovada">Publicadas</option>
              <option value="rejeitada">Rejeitadas</option>
            </select>
          </label>

          <label>
            <span>Categoria</span>
            <select value={filtroCategoria} onChange={(evento) => setFiltroCategoria(evento.target.value)}>
              <option value="todas">Todas</option>
              {categoriasDisponiveis.map((categoria) => (
                <option key={categoria} value={categoria}>{formatarCategoria(categoria)}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Urgência</span>
            <select value={filtroUrgencia} onChange={(evento) => setFiltroUrgencia(evento.target.value)}>
              <option value="todas">Todas</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </label>

          <label>
            <span>Bairro</span>
            <select value={filtroBairro} onChange={(evento) => setFiltroBairro(evento.target.value)}>
              <option value="todos">Todos</option>
              {bairrosDisponiveis.map((bairro) => (
                <option key={bairro} value={bairro}>{bairro}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Ordenar</span>
            <select value={ordenacao} onChange={(evento) => setOrdenacao(evento.target.value)}>
              <option value="recentes">Mais recentes</option>
              <option value="antigas">Mais antigas</option>
              <option value="urgencia">Maior urgência</option>
            </select>
          </label>
        </div>

        <div className="admin-filtros-acoes">
          <button type="button" className="admin-limpar-filtros" onClick={limparFiltros}>
            <Filter size={18} /> Limpar filtros
          </button>
          <button type="button" className="admin-exportar" onClick={exportarOcorrenciasCsv} disabled={!ocorrenciasFiltradas.length}>
            <Download size={18} /> Exportar CSV
          </button>
        </div>
      </section>

      <section className="admin-lista">
        <div className="admin-lista-titulo">
          <div>
            <span>Gerenciamento</span>
            <h2>Ocorrências registradas</h2>
          </div>

          <strong>
            {ocorrenciasFiltradas.length} de {ocorrencias.length} registros
          </strong>
        </div>

        <div className="admin-ocorrencias">
          {ocorrenciasFiltradas.map((ocorrencia) => (
            <article
              className="admin-ocorrencia"
              key={ocorrencia.id}
            >
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
                  aria-label={`Vídeo da ocorrência ${ocorrencia.titulo}`}
                >
                  Seu navegador não consegue reproduzir este vídeo.
                </video>
              ) : (
                <div className="admin-sem-foto">
                  <FileWarning size={32} />
                  <span>Sem mídia</span>
                </div>
              )}

              <div className="admin-ocorrencia-dados">
                <div className="admin-ocorrencia-cabecalho">
                  <div>
                    <span
                      className={`moderacao-badge ${
                        ocorrencia.moderacao_status ?? "aprovada"
                      }`}
                    >
                      {(ocorrencia.moderacao_status ?? "aprovada") === "pendente"
                        ? "Aguardando aprovação"
                        : (ocorrencia.moderacao_status ?? "aprovada") === "rejeitada"
                          ? "Publicação rejeitada"
                          : "Publicada no site"}
                    </span>

                    <span
                      className={`urgencia ${ocorrencia.urgencia}`}
                    >
                      Urgência{" "}
                      {formatarUrgencia(
                        ocorrencia.urgencia
                      )}
                    </span>

                    <h3>{ocorrencia.titulo}</h3>
                  </div>

                  <div className="admin-status-acoes">
                    <select
                      value={ocorrencia.status}
                      onChange={(evento) =>
                        void alterarStatus(
                          ocorrencia.id,
                          evento.target
                            .value as StatusOcorrencia
                        )
                      }
                    >
                      <option value="aberto">Recebida</option>
                      <option value="em_analise">Em análise</option>
                      <option value="encaminhado">Encaminhada</option>
                      <option value="em_andamento">
                        Em andamento
                      </option>
                      <option value="aguardando_recursos">Aguardando recursos</option>
                      <option value="resolvido">Resolvida</option>
                      <option value="nao_solucionado">Não solucionada</option>
                      <option value="duplicado">Duplicada</option>
                      <option value="cancelado">Cancelada</option>
                    </select>

                    {(ocorrencia.moderacao_status ?? "aprovada") === "pendente" && (
                      <>
                        <button
                          className="botao-aprovar-ocorrencia"
                          type="button"
                          onClick={() => void moderarOcorrencia(ocorrencia, true)}
                          disabled={moderandoId === ocorrencia.id}
                        >
                          <CheckCircle2 size={18} />
                          Aprovar e publicar
                        </button>

                        <button
                          className="botao-rejeitar-ocorrencia"
                          type="button"
                          onClick={() => void moderarOcorrencia(ocorrencia, false)}
                          disabled={moderandoId === ocorrencia.id}
                        >
                          <X size={18} />
                          Rejeitar
                        </button>
                      </>
                    )}

                    {(ocorrencia.moderacao_status ?? "aprovada") === "aprovada" && (
                      <button
                        className="botao-whatsapp-ocorrencia"
                        type="button"
                        onClick={() => void compartilharNoWhatsApp(ocorrencia)}
                      >
                        <Send size={18} />
                        Publicar no WhatsApp
                      </button>
                    )}

                    <button
                      className="botao-gerenciar-ocorrencia"
                      type="button"
                      onClick={() => void abrirDetalhes(ocorrencia)}
                    >
                      <MessageSquareText size={18} />
                      Gerenciar
                    </button>

                    <button
                      className="botao-excluir-ocorrencia"
                      type="button"
                      onClick={() =>
                        void excluirOcorrencia(
                          ocorrencia
                        )
                      }
                      disabled={
                        excluindoId === ocorrencia.id
                      }
                    >
                      <Trash2 size={18} />
                      {excluindoId === ocorrencia.id
                        ? "Excluindo..."
                        : "Excluir"}
                    </button>
                  </div>
                </div>

                <strong>
                  {formatarCategoria(
                    ocorrencia.categoria
                  )}
                </strong>

                <p>{ocorrencia.descricao}</p>
                <small>{ocorrencia.endereco}</small>
                <div className="admin-terreno">
                  <span>
                    <strong>Terreno:</strong>{" "}
                    {formatarTerreno(ocorrencia.tipo_terreno)}
                  </span>
                  <span>
                    <strong>Condição:</strong>{" "}
                    {formatarCondicaoLocal(ocorrencia.condicao_local)}
                  </span>
                </div>
                <small>
                  Registrada em{" "}
                  {new Date(
                    ocorrencia.criado_em
                  ).toLocaleString("pt-BR")}
                </small>
                {ocorrencia.previsao_atendimento && (
                  <small>
                    Previsão de atendimento:{" "}
                    <strong>{formatarDataCurta(ocorrencia.previsao_atendimento)}</strong>
                  </small>
                )}
              </div>
            </article>
          ))}

          {!ocorrenciasFiltradas.length && !carregando && (
            <p className="admin-sem-dados">
              Nenhuma ocorrência encontrada com os filtros selecionados.
            </p>
          )}

          {carregando && (
            <p className="admin-sem-dados">
              Carregando informações...
            </p>
          )}
        </div>
      </section>

      {ocorrenciaSelecionada && (
        <div className="admin-modal-fundo" role="presentation">
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-modal-titulo"
          >
            <header className="admin-modal-topo">
              <div>
                <span>Gerenciamento completo</span>
                <h2 id="admin-modal-titulo">{ocorrenciaSelecionada.titulo}</h2>
              </div>
              <button type="button" onClick={fecharDetalhes} aria-label="Fechar detalhes">
                <X size={22} />
              </button>
            </header>

            <div className="admin-modal-conteudo">
              <div className="admin-modal-coluna">
                <article className="admin-detalhes-resumo">
                  {ocorrenciaSelecionada.foto_url ? (
                    <img src={ocorrenciaSelecionada.foto_url} alt={ocorrenciaSelecionada.titulo} />
                  ) : ocorrenciaSelecionada.video_url ? (
                    <video src={ocorrenciaSelecionada.video_url} controls playsInline preload="metadata" />
                  ) : (
                    <div className="admin-modal-sem-midia"><FileWarning size={34} /> Sem mídia</div>
                  )}

                  <div>
                    <strong>{formatarCategoria(ocorrenciaSelecionada.categoria)}</strong>
                    <p>{ocorrenciaSelecionada.descricao}</p>
                    <span><MapPin size={16} /> {ocorrenciaSelecionada.bairro ? `${ocorrenciaSelecionada.bairro} — ` : ""}{ocorrenciaSelecionada.endereco}</span>
                    {ocorrenciaSelecionada.latitude != null && ocorrenciaSelecionada.longitude != null && (
                      <a
                        href={`https://www.google.com/maps?q=${ocorrenciaSelecionada.latitude},${ocorrenciaSelecionada.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir localização no mapa
                      </a>
                    )}
                  </div>
                </article>

                <div className="admin-modal-campos">
                  <label>
                    <span>Status</span>
                    <select value={statusEdicao} onChange={(evento) => setStatusEdicao(evento.target.value as StatusOcorrencia)}>
                      <option value="aberto">Recebida</option>
                      <option value="em_analise">Em análise</option>
                      <option value="encaminhado">Encaminhada</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="aguardando_recursos">Aguardando recursos</option>
                      <option value="resolvido">Resolvida</option>
                      <option value="nao_solucionado">Não solucionada</option>
                      <option value="duplicado">Duplicada</option>
                      <option value="cancelado">Cancelada</option>
                    </select>
                  </label>

                  <label>
                    <span>Previsão de atendimento</span>
                    <input
                      type="date"
                      value={previsaoEdicao}
                      onChange={(evento) => setPrevisaoEdicao(evento.target.value)}
                    />
                  </label>

                  <label>
                    <span>Prioridade administrativa</span>
                    <select value={prioridadeEdicao} onChange={(evento) => setPrioridadeEdicao(evento.target.value)}>
                      <option value="normal">Normal</option>
                      <option value="prioritaria">Prioritária</option>
                      <option value="emergencial">Emergencial</option>
                    </select>
                  </label>

                  <label className="campo-largo">
                    <span><UserCheck size={16} /> Administrador responsável</span>
                    <select value={responsavelEdicao} onChange={(evento) => setResponsavelEdicao(evento.target.value)}>
                      <option value="">Nenhum responsável definido</option>
                      {administradores.map((item) => (
                        <option key={item.user_id} value={item.user_id}>{item.email}</option>
                      ))}
                    </select>
                  </label>

                  <label className="campo-largo">
                    <span>Resposta oficial para a comunidade</span>
                    <textarea
                      value={respostaEdicao}
                      onChange={(evento) => setRespostaEdicao(evento.target.value)}
                      placeholder="Ex.: A ocorrência foi encaminhada para análise da equipe responsável."
                      rows={4}
                    />
                  </label>

                  <label className="campo-largo">
                    <span>Comentário desta atualização</span>
                    <textarea
                      value={comentarioEdicao}
                      onChange={(evento) => setComentarioEdicao(evento.target.value)}
                      placeholder="Descreva o que foi analisado ou alterado."
                      rows={3}
                    />
                  </label>
                </div>

                <button
                  className="admin-salvar-detalhes"
                  type="button"
                  onClick={() => void salvarDetalhesOcorrencia()}
                  disabled={salvandoDetalhes}
                >
                  <Send size={18} />
                  {salvandoDetalhes ? "Salvando..." : "Salvar e publicar atualização"}
                </button>
              </div>

              <aside className="admin-historico">
                <div className="admin-historico-titulo">
                  <History size={20} />
                  <h3>Histórico</h3>
                </div>

                {carregandoHistorico && <p>Carregando histórico...</p>}

                {!carregandoHistorico && !historicoOcorrencia.length && (
                  <p>Nenhuma atualização registrada ainda.</p>
                )}

                <div className="admin-historico-lista">
                  {historicoOcorrencia.map((item) => (
                    <article key={item.id}>
                      <span>{formatarTipoHistorico(item.tipo)}</span>
                      <p>{item.comentario}</p>
                      {item.status_novo && (
                        <small>{item.status_anterior ? `${formatarStatus(item.status_anterior as StatusOcorrencia)} → ` : ""}{formatarStatus(item.status_novo as StatusOcorrencia)}</small>
                      )}
                      <time>{new Date(item.criado_em).toLocaleString("pt-BR")}</time>
                    </article>
                  ))}
                </div>
              </aside>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function CardMetrica({
  titulo,
  valor,
  classe,
  icone,
}: CardMetricaProps) {
  return (
    <article>
      <div className={`metrica-icone ${classe}`}>
        {icone}
      </div>
      <div>
        <span>{titulo}</span>
        <strong>{valor}</strong>
      </div>
    </article>
  );
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

function formatarTerreno(valor?: string | null) {
  const terrenos: Record<string, string> = {
    plano: "Plano",
    encosta: "Encosta",
    morro: "Área de morro",
    canal_rio: "Próximo a canal ou rio",
    nao_identificado: "Não identificado",
  };

  return valor ? terrenos[valor] || valor : "Não informado";
}

function formatarCondicaoLocal(valor?: string | null) {
  const condicoes: Record<string, string> = {
    normal: "Normal",
    solo_encharcado: "Solo encharcado",
    rachaduras: "Rachaduras no terreno",
    pequeno_deslizamento: "Pequeno deslizamento",
    deslizamento_andamento: "Deslizamento em andamento",
  };

  return valor ? condicoes[valor] || valor : "Não informada";
}

function formatarUrgencia(urgencia: string) {
  const urgencias: Record<string, string> = {
    baixa: "baixa",
    media: "média",
    alta: "alta",
  };

  return urgencias[urgencia] || urgencia;
}

function formatarStatus(status: StatusOcorrencia) {
  const statusFormatado: Record<StatusOcorrencia, string> = {
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
  return statusFormatado[status];
}

function formatarDataCurta(data: string) {
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR");
}

function formatarPrioridade(valor?: string | null) {
  const prioridades: Record<string, string> = {
    normal: "Normal",
    prioritaria: "Prioritária",
    emergencial: "Emergencial",
  };
  return valor ? prioridades[valor] || valor : "Normal";
}

function formatarTipoHistorico(tipo: string) {
  const tipos: Record<string, string> = {
    comentario: "Comentário",
    status: "Mudança de status",
    prioridade: "Mudança de prioridade",
    responsavel: "Responsável",
    sistema: "Sistema",
  };
  return tipos[tipo] || tipo;
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function escaparCsv(valor: string) {
  return `"${String(valor).replace(/"/g, '""')}"`;
}

export default Admin;
