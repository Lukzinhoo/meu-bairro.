import {
  useState,
  type FormEvent,
} from "react";

import { Link, useNavigate } from "react-router-dom";

import {
  CheckCircle2,
  LockKeyhole,
  Mail,
  UserRound,
  UserRoundPlus,
} from "lucide-react";

import { supabase } from "../services/supabase";
import "./Auth.css";

function Cadastro() {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] =
    useState("");

  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [cadastrando, setCadastrando] =
    useState(false);

  async function criarConta(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    setErro("");
    setMensagem("");

    if (nome.trim().length < 3) {
      setErro(
        "Informe seu nome com pelo menos três caracteres."
      );

      return;
    }

    if (senha.length < 8) {
      setErro(
        "A senha precisa ter pelo menos oito caracteres."
      );

      return;
    }

    if (senha !== confirmarSenha) {
      setErro("As senhas não são iguais.");
      return;
    }

    setCadastrando(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: {
        data: {
          nome: nome.trim(),
        },
      },
    });

    if (error) {
      setErro(traduzirErroCadastro(error.message));
      setCadastrando(false);
      return;
    }

    if (data.session) {
      navigate("/perfil");
      return;
    }

    setMensagem(
      "Cadastro realizado! Verifique seu e-mail para confirmar a conta."
    );

    setNome("");
    setEmail("");
    setSenha("");
    setConfirmarSenha("");
    setCadastrando(false);
  }

  return (
    <main className="auth-pagina">
      <section className="auth-cartao">
        <div className="auth-icone">
          <UserRoundPlus size={36} />
        </div>

        <span className="auth-etiqueta">
          Faça parte da comunidade
        </span>

        <h1>Crie sua conta</h1>

        <p>
          Registre problemas e acompanhe as melhorias
          realizadas no seu bairro.
        </p>

        {erro && (
          <div className="auth-erro">
            {erro}
          </div>
        )}

        {mensagem && (
          <div className="auth-sucesso">
            <CheckCircle2 size={20} />
            {mensagem}
          </div>
        )}

        <form onSubmit={criarConta}>
          <label htmlFor="cadastro-nome">
            Nome completo
          </label>

          <div className="auth-campo">
            <UserRound size={19} />

            <input
              id="cadastro-nome"
              type="text"
              value={nome}
              onChange={(evento) =>
                setNome(evento.target.value)
              }
              placeholder="Digite seu nome"
              autoComplete="name"
              required
            />
          </div>

          <label htmlFor="cadastro-email">
            E-mail
          </label>

          <div className="auth-campo">
            <Mail size={19} />

            <input
              id="cadastro-email"
              type="email"
              value={email}
              onChange={(evento) =>
                setEmail(evento.target.value)
              }
              placeholder="Digite seu e-mail"
              autoComplete="email"
              required
            />
          </div>

          <label htmlFor="cadastro-senha">
            Senha
          </label>

          <div className="auth-campo">
            <LockKeyhole size={19} />

            <input
              id="cadastro-senha"
              type="password"
              value={senha}
              onChange={(evento) =>
                setSenha(evento.target.value)
              }
              placeholder="Mínimo de oito caracteres"
              autoComplete="new-password"
              required
            />
          </div>

          <label htmlFor="confirmar-senha">
            Confirme a senha
          </label>

          <div className="auth-campo">
            <LockKeyhole size={19} />

            <input
              id="confirmar-senha"
              type="password"
              value={confirmarSenha}
              onChange={(evento) =>
                setConfirmarSenha(
                  evento.target.value
                )
              }
              placeholder="Digite a senha novamente"
              autoComplete="new-password"
              required
            />
          </div>

          <button
            className="auth-botao"
            type="submit"
            disabled={cadastrando}
          >
            <UserRoundPlus size={19} />

            {cadastrando
              ? "Criando conta..."
              : "Criar conta"}
          </button>
        </form>

        <div className="auth-rodape">
          <span>Já possui uma conta?</span>

          <Link to="/entrar">
            Entrar
          </Link>
        </div>
      </section>
    </main>
  );
}

function traduzirErroCadastro(
  mensagem: string
) {
  const texto = mensagem.toLowerCase();

  if (
    texto.includes("user already registered")
  ) {
    return "Esse e-mail já está cadastrado.";
  }

  if (
    texto.includes("password")
  ) {
    return "A senha informada não atende aos requisitos.";
  }

  return mensagem;
}

export default Cadastro;