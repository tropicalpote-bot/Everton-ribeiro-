# Perfil em Foco

Avaliador do Perfil da Empresa no Google. Digite o nome ou cole um link do Maps; a aplicação consulta a Places API (New), exibe até cinco resultados e preenche automaticamente os dados públicos disponíveis. Se houver resultados parecidos, escolha o negócio correto antes de avaliar.

## Configuração na Vercel

1. No Google Cloud Console, escolha/crie um projeto, ative o faturamento e habilite **Places API (New)**.
2. Crie uma chave de API restrita à Places API (New). Não coloque a chave no HTML nem no GitHub.
3. Na Vercel, abra **Project → Settings → Environment Variables** e adicione `GOOGLE_MAPS_API_KEY` para Production. Restrinja a chave também no Google Cloud e defina cotas/alertas.
4. Faça um novo deploy para a função `/api/search` receber a variável.

A busca solicita rating, quantidade de avaliações, telefone, site, horários, categoria, endereço e presença de fotos. O Google exige faturamento ativado e cobra conforme produto, campos e volume. Confira as cotas e preços atuais no Google Cloud.

## Limites dos dados

A API pública não fornece a taxa de resposta do proprietário, publicações recentes nem a descrição completa dos serviços. Esses itens ficam para conferência manual. O app não grava os resultados pesquisados. Termos e privacidade estão em `terms.html` e `privacy.html`.

## Desenvolvimento local

Abra `index.html` para visualizar a interface. A função de busca requer `GOOGLE_MAPS_API_KEY` configurada no ambiente Vercel.
