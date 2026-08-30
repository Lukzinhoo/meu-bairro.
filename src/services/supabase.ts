import {
  createClient,
  type SupportedStorage,
} from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env
    .VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    "VITE_SUPABASE_URL não foi encontrada no arquivo .env.local"
  );
}

if (!supabaseKey) {
  throw new Error(
    "A chave pública do Supabase não foi encontrada no arquivo .env.local"
  );
}

const CHAVE_LEMBRAR_ACESSO =
  "meu_bairro_lembrar_acesso";

function usuarioQuerLembrarAcesso() {
  const preferencia = localStorage.getItem(
    CHAVE_LEMBRAR_ACESSO
  );

  /*
   * Se ainda não houver preferência salva,
   * mantém o acesso conectado por padrão.
   */
  return preferencia !== "false";
}

function armazenamentoAtual() {
  return usuarioQuerLembrarAcesso()
    ? localStorage
    : sessionStorage;
}

const armazenamentoDinamico: SupportedStorage = {
  getItem(chave: string) {
    return armazenamentoAtual().getItem(chave);
  },

  setItem(chave: string, valor: string) {
    armazenamentoAtual().setItem(
      chave,
      valor
    );
  },

  removeItem(chave: string) {
    /*
     * Remove dos dois armazenamentos para
     * impedir que uma sessão antiga volte.
     */
    localStorage.removeItem(chave);
    sessionStorage.removeItem(chave);
  },
};

function limparSessoesAntigas() {
  const armazenamentos = [
    localStorage,
    sessionStorage,
  ];

  armazenamentos.forEach((armazenamento) => {
    const chavesParaExcluir: string[] = [];

    for (
      let indice = 0;
      indice < armazenamento.length;
      indice += 1
    ) {
      const chave =
        armazenamento.key(indice);

      if (
        chave &&
        chave.startsWith("sb-") &&
        chave.includes("-auth-token")
      ) {
        chavesParaExcluir.push(chave);
      }
    }

    chavesParaExcluir.forEach((chave) => {
      armazenamento.removeItem(chave);
    });
  });
}

export function definirLembrarAcesso(
  lembrar: boolean
) {
  const preferenciaAtual =
    usuarioQuerLembrarAcesso();

  /*
   * Ao trocar a preferência, remove sessões
   * antigas antes de fazer um novo login.
   */
  if (preferenciaAtual !== lembrar) {
    limparSessoesAntigas();
  }

  localStorage.setItem(
    CHAVE_LEMBRAR_ACESSO,
    String(lembrar)
  );
}

export function obterPreferenciaLembrarAcesso() {
  return usuarioQuerLembrarAcesso();
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      storage: armazenamentoDinamico,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);