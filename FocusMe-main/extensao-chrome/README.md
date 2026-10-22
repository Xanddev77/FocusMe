# FocusMe — Bloqueio de Distrações (extensão)

Extensão Manifest V3 para Chrome, Edge e outros navegadores Chromium.
Bloqueia redes sociais enquanto o Pomodoro do FocusMe está em foco e libera nas pausas.

## Instalar

1. `chrome://extensions` (ou `edge://extensions`) › ligue **Modo do desenvolvedor**
2. **Carregar sem compactação** › selecione esta pasta
3. Recarregue o FocusMe

## Como conversa com o site

O site envia mensagens com `window.postMessage` (`source: "focusme-app"`). O `content.js`, que só age em páginas com
`<meta name="focusme-app">`, repassa ao `background.js`, que guarda o estado e desvia as navegações para `blocked.html`.

| Mensagem do site | Efeito |
| --- | --- |
| `FOCUSME_PING` | A extensão responde `FOCUSME_READY` com o status |
| `FOCUSME_STATE` `{ bloquear, fase, pausado, fimEm }` | Liga ou desliga o bloqueio |

A extensão responde com `FOCUSME_STATUS` (ativada, bloqueando, total de sites, acessos barrados hoje).

## Permissões

- `storage`: lista de sites e estado do bloqueio
- `tabs` e `webNavigation`: perceber que uma aba vai para um site da lista e desviá-la
- `alarms`: liberar sozinho se o FocusMe fechar sem avisar
- `scripting` e hosts opcionais: só para autorizar um domínio próprio do FocusMe (opcional)

Nada sai do seu computador: a extensão não envia dados para nenhum servidor.
