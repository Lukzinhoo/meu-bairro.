import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  CalendarDays,
  Camera,
  CheckCircle2,
  CircleCheckBig,
  ClipboardList,
  Clock3,
  LogOut,
  Mail,
  MapPin,
  Save,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import { supabase } from "../services/supabase";
import "./Perfil.css";

type PerfilUsuario = {
  user_id: string;
  nome: string;
  email: string;
  avatar_url: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  criado_em: string;
  atualizado_em: string;
};

type OcorrenciaUsuario = {
  id: string;
  titulo: string;
  categoria: string;
  endereco: string;
  status: "aberto" | "em_andamento" | "resolvido";
  urgencia: "baixa" | "media" | "alta";
  foto_url: string | null;
  criado_em: string;
};

function Perfil() {
  const navigate = useNavigate();

  const [perfil, setPerfil] =
    useState<PerfilUsuario | null>(null);
  const [ocorrencias, setOcorrencias] =
    useState<OcorrenciaUsuario[]>([]);

  const [nome, setNome] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [arquivoAvatar, setArquivoAvatar] =
    useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] =
    useState("");

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    carregarPerfil();

    return () => {
      if (avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, []);

  async function carregarPerfil() {
    setCarregando(true);
    setErro("");

    try {
      const {
        data: dadosUsuario,
        error: erroUsuario,
      } = await supabase.auth.getUser();

      if (erroUsuario || !dadosUsuario.user) {
        navigate("/entrar", { replace: true });
        return;
      }

      const usuario = dadosUsuario.user;

      const [resultadoPerfil, resultadoOcorrencias] =
        await Promise.all([
          supabase
            .from("perfis")
            .select("*")
            .eq("user_id", usuario.id)
            .maybeSingle(),
          supabase
            .from("ocorrencias")
            .select(
              "id,titulo,categoria,endereco,status,urgencia,foto_url,criado_em"
            )
            .eq("user_id", usuario.id)
            .order("criado_em", { ascending: false }),
        ]);

      if (resultadoPerfil.error) {
        throw new Error(
          `Erro ao carregar perfil: ${resultadoPerfil.error.message}`
        );
      }

      let perfilEncontrado = resultadoPerfil.data;

      if (!perfilEncontrado) {
        const { data, error } = await supabase
          .from("perfis")
          .insert({
            user_id: usuario.id,
            nome: usuario.user_metadata?.nome ?? "",
            email: usuario.email ?? "",
          })
          .select("*")
          .single();

        if (error) {
          throw new Error(
            `Erro ao criar perfil: ${error.message}`
          );
        }

        perfilEncontrado = data;
      }

      if (resultadoOcorrencias.error) {
        console.warn(
          "Não foi possível carregar as ocorrências do perfil:",
          resultadoOcorrencias.error.message
        );
      }

      const perfilCarregado =
        perfilEncontrado as PerfilUsuario;

      setPerfil(perfilCarregado);
      setNome(perfilCarregado.nome ?? "");
      setBairro(perfilCarregado.bairro ?? "");
      setCidade(perfilCarregado.cidade ?? "");
      setEstado(perfilCarregado.estado ?? "");
      setAvatarPreview(perfilCarregado.avatar_url ?? "");
      setOcorrencias(
        (resultadoOcorrencias.data ?? []) as OcorrenciaUsuario[]
      );
    } catch (erroDesconhecido) {
      console.error("Erro ao carregar perfil:", erroDesconhecido);
      setErro(
        erroDesconhecido instanceof Error
          ? erroDesconhecido.message
          : "Não foi possível carregar seu perfil."
      );
    } finally {
      setCarregando(false);
    }
  }

  function selecionarAvatar(
    evento: ChangeEvent<HTMLInputElement>
  ) {
    const arquivo = evento.target.files?.[0];

    if (!arquivo) return;

    if (!arquivo.type.startsWith("image/")) {
      setErro("Escolha uma imagem válida.");
      return;
    }

    if (arquivo.size > 5 * 1024 * 1024) {
      setErro("A fotografia deve ter no máximo 5 MB.");
      return;
    }

    if (avatarPreview.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }

    setArquivoAvatar(arquivo);
    setAvatarPreview(URL.createObjectURL(arquivo));
    setErro("");
  }

  async function enviarAvatar() {
    if (!arquivoAvatar || !perfil) {
      return perfil?.avatar_url ?? null;
    }

    const extensao =
      arquivoAvatar.name.split(".").pop()?.toLowerCase() || "jpg";
    const caminho = `${perfil.user_id}/avatar.${extensao}`;

    const { error } = await supabase.storage
      .from("avatares-perfis")
      .upload(caminho, arquivoAvatar, {
        contentType: arquivoAvatar.type,
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      throw new Error(
        `Não foi possível enviar a fotografia: ${error.message}`
      );
    }

    const { data } = supabase.storage
      .from("avatares-perfis")
      .getPublicUrl(caminho);

    return `${data.publicUrl}?v=${Date.now()}`;
  }

  async function salvarPerfil(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();
    setErro("");
    setMensagem("");

    if (!perfil) {
      setErro("Não foi possível identificar o usuário.");
      return;
    }

    if (nome.trim().length < 3) {
      setErro("Informe um nome com pelo menos três caracteres.");
      return;
    }

    setSalvando(true);

    try {
      const avatarUrl = await enviarAvatar();

      const { data, error } = await supabase
        .from("perfis")
        .update({
          nome: nome.trim(),
          bairro: bairro.trim() || null,
          cidade: cidade.trim() || null,
          estado: estado.trim() || null,
          avatar_url: avatarUrl,
          atualizado_em: new Date().toISOString(),
        })
        .eq("user_id", perfil.user_id)
        .select("*")
        .single();

      if (error) {
        throw new Error(
          `Não foi possível atualizar o perfil: ${error.message}`
        );
      }

      await supabase.auth.updateUser({
        data: { nome: nome.trim(), avatar_url: avatarUrl },
      });

      setPerfil(data as PerfilUsuario);
      setAvatarPreview(avatarUrl ?? "");
      setArquivoAvatar(null);
      setMensagem("Perfil atualizado com sucesso!");
    } catch (erroDesconhecido) {
      console.error("Erro ao salvar perfil:", erroDesconhecido);
      setErro(
        erroDesconhecido instanceof Error
          ? erroDesconhecido.message
          : "Não foi possível atualizar o perfil."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function sairDaConta() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setErro("Não foi possível sair da conta.");
      return;
    }

    navigate("/entrar", { replace: true });
  }

  const abertas = ocorrencias.filter(
    (item) => item.status === "aberto"
  ).length;
  const emAndamento = ocorrencias.filter(
    (item) => item.status === "em_andamento"
  ).length;
  const finalizadas = ocorrencias.filter(
    (item) => item.status === "resolvido"
  ).length;

  if (carregando) {
    return (
      <main className="perfil-pagina">
        <div className="perfil-aviso">Carregando seu perfil...</div>
      </main>
    );
  }

  if (!perfil) {
    return (
      <main className="perfil-pagina">
        <div className="perfil-aviso perfil-erro">
          {erro || "Não foi possível carregar o perfil."}
        </div>
      </main>
    );
  }

  return (
    <main className="perfil-pagina">
      <section className="perfil-cabecalho">
        <div className="perfil-avatar">
          {avatarPreview ? (
            <img src={avatarPreview} alt={`Foto de ${perfil.nome}`} />
          ) : (
            <span>{obterIniciais(nome)}</span>
          )}
        </div>

        <div className="perfil-identificacao">
          <span>Meu perfil</span>
          <h1>{perfil.nome || "Usuário"}</h1>
          <p>Gerencie seus dados e acompanhe sua participação na comunidade.</p>
          <div className="perfil-selo">
            <ShieldCheck size={17} />
            {obterSelo(ocorrencias.length)}
          </div>
        </div>

        <button className="perfil-sair" type="button" onClick={sairDaConta}>
          <LogOut size={19} />
          Sair da conta
        </button>
      </section>

      {erro && <div className="perfil-mensagem erro">{erro}</div>}
      {mensagem && (
        <div className="perfil-mensagem sucesso">
          <CheckCircle2 size={20} />
          {mensagem}
        </div>
      )}

      <section className="perfil-metricas">
        <article><ClipboardList /><strong>{ocorrencias.length}</strong><span>Total registrado</span></article>
        <article><TriangleAlert /><strong>{abertas}</strong><span>Abertas</span></article>
        <article><Clock3 /><strong>{emAndamento}</strong><span>Em andamento</span></article>
        <article><CircleCheckBig /><strong>{finalizadas}</strong><span>Finalizadas</span></article>
      </section>

      <section className="perfil-conteudo">
        <article className="perfil-informacoes">
          <h2>Informações da conta</h2>
          <Dado icon={<Mail size={20} />} titulo="E-mail" valor={perfil.email} />
          <Dado icon={<CalendarDays size={20} />} titulo="Membro desde" valor={formatarData(perfil.criado_em)} />
          <Dado
            icon={<MapPin size={20} />}
            titulo="Localização"
            valor={formatarLocalizacao(perfil)}
          />
        </article>

        <form className="perfil-formulario" onSubmit={salvarPerfil}>
          <h2>Editar perfil</h2>

          <label htmlFor="perfil-avatar-arquivo">Fotografia</label>
          <label className="perfil-escolher-avatar" htmlFor="perfil-avatar-arquivo">
            <Camera size={20} />
            {arquivoAvatar ? "Fotografia selecionada" : "Escolher fotografia"}
          </label>
          <input
            id="perfil-avatar-arquivo"
            className="perfil-input-arquivo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={selecionarAvatar}
            disabled={salvando}
          />

          <Campo id="perfil-nome" label="Nome completo" value={nome} setValue={setNome} placeholder="Seu nome" icon={<UserRound size={20} />} disabled={salvando} required />
          <Campo id="perfil-bairro" label="Bairro" value={bairro} setValue={setBairro} placeholder="Ex.: Iputinga" icon={<MapPin size={20} />} disabled={salvando} />
          <Campo id="perfil-cidade" label="Cidade" value={cidade} setValue={setCidade} placeholder="Ex.: Recife" icon={<MapPin size={20} />} disabled={salvando} />
          <Campo id="perfil-estado" label="Estado" value={estado} setValue={setEstado} placeholder="Ex.: Pernambuco" icon={<MapPin size={20} />} disabled={salvando} />

          <button className="perfil-salvar" type="submit" disabled={salvando}>
            <Save size={19} />
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>
      </section>

      <section className="perfil-historico">
        <div className="perfil-historico-topo">
          <div>
            <span>Minha participação</span>
            <h2>Ocorrências registradas</h2>
          </div>
          <Link to="/registrar">Registrar nova ocorrência</Link>
        </div>

        <div className="perfil-lista-ocorrencias">
          {ocorrencias.map((item) => (
            <article className="perfil-ocorrencia" key={item.id}>
              {item.foto_url ? (
                <img src={item.foto_url} alt={item.titulo} />
              ) : (
                <div className="perfil-ocorrencia-sem-foto"><TriangleAlert /></div>
              )}
              <div>
                <span>{formatarCategoria(item.categoria)}</span>
                <h3>{item.titulo}</h3>
                <p><MapPin size={15} />{item.endereco}</p>
                <small>{formatarData(item.criado_em)}</small>
              </div>
              <div className="perfil-ocorrencia-final">
                <span className={`perfil-status ${item.status}`}>{formatarStatus(item.status)}</span>
                <Link to={`/ocorrencias/${item.id}`}>Ver detalhes</Link>
              </div>
            </article>
          ))}

          {!ocorrencias.length && (
            <div className="perfil-sem-ocorrencias">
              <ClipboardList size={42} />
              <h3>Nenhuma ocorrência vinculada</h3>
              <p>Os novos registros feitos com sua conta aparecerão aqui.</p>
              <Link to="/registrar">Registrar meu primeiro problema</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Campo({ id, label, value, setValue, placeholder, icon, disabled, required = false }: {
  id: string; label: string; value: string; setValue: (valor: string) => void;
  placeholder: string; icon: ReactNode; disabled: boolean; required?: boolean;
}) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="perfil-campo">
        {icon}
        <input id={id} value={value} onChange={(evento) => setValue(evento.target.value)} placeholder={placeholder} disabled={disabled} required={required} />
      </div>
    </>
  );
}

function Dado({ icon, titulo, valor }: { icon: ReactNode; titulo: string; valor: string }) {
  return <div className="perfil-dado">{icon}<div><span>{titulo}</span><strong>{valor}</strong></div></div>;
}

function formatarData(data: string) {
  if (!data) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(data));
}

function obterIniciais(nome: string) {
  const partes = nome.trim().split(" ").filter(Boolean);
  if (!partes.length) return "MB";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function obterSelo(total: number) {
  if (total >= 10) return "Guardião da comunidade";
  if (total >= 5) return "Morador participativo";
  if (total >= 1) return "Colaborador do bairro";
  return "Novo participante";
}

function formatarLocalizacao(perfil: PerfilUsuario) {
  return [perfil.bairro, perfil.cidade, perfil.estado].filter(Boolean).join(" - ") || "Não informada";
}

function formatarCategoria(valor: string) {
  const opcoes: Record<string, string> = { buraco: "Buraco", iluminacao: "Iluminação", lixo: "Lixo", alagamento: "Alagamento", calcada: "Calçada", outro: "Outro" };
  return opcoes[valor] || valor;
}

function formatarStatus(valor: string) {
  const opcoes: Record<string, string> = { aberto: "Aberta", em_andamento: "Em andamento", resolvido: "Finalizada" };
  return opcoes[valor] || valor;
}

export default Perfil;