# TRT PRO — site do curso de edição (modo simulado)

Abra `curso/index.html` (ou `https://SEU-USUARIO.github.io/Lauraaa-80-dias/curso/` no GitHub Pages).

**Simulado:** não há banco de dados nem servidor. Contas, aulas, pedidos, chat e
arquivos ficam guardados **só no navegador** de quem está usando (localStorage + IndexedDB).
Nada é enviado para fora.

## Contas de teste

| Cargo | E-mail | Senha |
|---|---|---|
| Dono | `dono@trtpro.demo` | `Dono@2026` |
| Staff | `staff@trtpro.demo` | `Staff@2026` |

Alunos criam a própria conta em **Entrar → Criar conta**.

## Como testar o fluxo completo

1. **Aba 1 (aluno):** crie uma conta → *Comprar curso* → tela com QR Code, chave Pix e valor →
   *Já paguei* → abre o chat privado → anexe uma imagem/PDF de comprovante.
2. **Aba 2 (staff):** entre com a conta staff → *Painel → Pagamentos* ou *Conversas* → veja o
   comprovante → *Aprovar e liberar*.
3. A aba do aluno recebe o aviso na hora e as aulas destravam.

Cada aba tem a própria sessão, então dá para ser aluno e staff ao mesmo tempo no mesmo navegador.

## Painel do dono

- **Aulas:** criar, editar, excluir, reordenar, publicar/rascunho, grátis (prévia), destaque,
  capa automática (8 estilos ciano/amarelo) ou imagem própria, vídeo por arquivo (MP4/WEBM/MOV)
  ou link do YouTube/Vimeo.
- **Categorias:** adicionar, renomear, reordenar e remover (as aulas viram “Sem categoria”).
- **Pagamentos / Conversas / Alunos:** aprovar ou recusar Pix, chat com cada aluno, liberar ou
  remover acesso manualmente, promover alguém a staff.
- **Configurações:** nome da marca, textos do topo, preço, chave Pix, favorecido, cidade e QR Code
  próprio. O “Pix copia e cola” e o QR são gerados no padrão do Banco Central (BR Code).
- **Zerar simulado:** volta tudo aos dados de exemplo.

## Segurança aplicada no front

- Content-Security-Policy rígida: só scripts do próprio site, sem `eval`, sem scripts inline,
  sem conexões externas (`connect-src 'none'`), Trusted Types ligado.
- A tela é montada só com `textContent`/`createElement` (nunca `innerHTML`), então texto de
  usuário nunca vira código (testado com `<img onerror>`).
- Senhas com PBKDF2-SHA256 (150 mil iterações) e sal aleatório; sessão com token aleatório
  guardado como hash e com validade de 12 h; bloqueio progressivo após 5 senhas erradas.
- Cada ação do “servidor simulado” confere a sessão e o cargo (aluno não aprova pagamento, staff
  não edita aulas). O valor do pedido vem do servidor, nunca da tela.
- Arquivos são validados pelos primeiros bytes (um texto renomeado para `.png` é recusado),
  com limite de tamanho; comprovantes só são vistos pelo próprio aluno e pela equipe.
- Anti-flood no chat, bloqueio contra abrir o site dentro de iframe de terceiros, `no-referrer`.

> Importante: como é um simulado, tudo roda no navegador da pessoa. Para vender de verdade
> é preciso um back-end real (ex.: Supabase/Firebase com regras no servidor) — basta trocar o
> `simulado.js` por uma API com as mesmas funções.

## Arquivos

- `index.html` — estrutura e política de segurança
- `app.css` — visual (ciano `#00f0ff` + amarelo `#ffe600`)
- `app.js` — telas: início, aulas, player, login, compra, Pix, chat, conta e painel
- `simulado.js` — “servidor” simulado
- `vendor/qrcode-1.4.4.js` — gerador de QR Code (MIT), hospedado localmente
