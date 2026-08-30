import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { supabase } from "../services/supabase";

function obterSessao() {
  const sessaoExistente = sessionStorage.getItem(
    "meu-bairro-sessao"
  );

  if (sessaoExistente) {
    return sessaoExistente;
  }

  const novaSessao = crypto.randomUUID();

  sessionStorage.setItem(
    "meu-bairro-sessao",
    novaSessao
  );

  return novaSessao;
}

function RegistrarVisita() {
  const localizacao = useLocation();

  useEffect(() => {
    async function registrar() {
      if (localizacao.pathname.startsWith("/admin")) {
        return;
      }

      const sessaoId = obterSessao();
      const pagina = localizacao.pathname;

      const ultimaPagina = sessionStorage.getItem(
        "meu-bairro-ultima-pagina"
      );

      if (ultimaPagina === pagina) {
        return;
      }

      sessionStorage.setItem(
        "meu-bairro-ultima-pagina",
        pagina
      );

      const { error } = await supabase
        .from("visitas")
        .insert({
          sessao_id: sessaoId,
          pagina,
        });

      if (error) {
        console.error(
          "Erro ao registrar visita:",
          error.message
        );
      }
    }

    registrar();
  }, [localizacao.pathname]);

  return null;
}

export default RegistrarVisita;