// config/helmet.js
import helmet from 'helmet';

export const helmetConfig = helmet({
  // Desabilitado por padrão porque CSP restritiva quebra fácil sem testar
  // caso a caso (ex.: se o front carrega fontes/scripts de CDN). Ative e
  // ajuste quando tiver tempo de testar cada diretiva sem derrubar nada.
  contentSecurityPolicy: false,

  // Sua API serve imagens de upload (uploads/products) que o frontend
  // carrega via <img src="...">. Sem isso, o Helmet aplica um header
  // que bloqueia cross-origin embedding de recursos, e as imagens não
  // aparecem no seu front (que roda em origem diferente da API).
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});
