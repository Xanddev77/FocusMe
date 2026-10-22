# FocusMe

Gerenciador de tarefas com Pomodoro, ranking de progresso e **bloqueio de distrações**.
Feito só com HTML, CSS e JavaScript puro.

## O que tem

- **Login e cadastro** (as contas ficam salvas no navegador; a senha é guardada com hash + salt)
- **Minha conta** (clique no avatar ou no nome; endereço `#/perfil`): visão geral, dados pessoais (nome, usuário, e-mail, telefone, foto), alteração de senha, preferências, download dos seus dados em JSON e exclusão da conta
- **Tarefas** com prioridade, prazo, subtarefas, ordenação e progresso do dia
- **Pomodoro** com relógio de marcações, fases (foco, pausa curta, pausa longa) e ciclo que sobrevive a recarregar a página
- **Modo foco em tela cheia** (atalho `F`; `Espaço` inicia/pausa)
- **Monitor de distrações**: se você trocar de aba ou de janela durante o foco, o ciclo é pausado e a distração é registrada
- **Progresso & Streak** com ranking, histórico semanal e o painel *Foco & Distrações*
- **Bloqueio de redes sociais** durante o foco, com a extensão da pasta [`extensao-chrome`](extensao-chrome)
- **Tarefa rápida em linguagem natural**: digite `estudar BD amanhã 18h !alta` e a prévia mostra título, prazo e prioridade (tecla `/` foca o campo)
- **Foco por tarefa**: o botão de mira no card liga o Pomodoro à tarefa e soma os minutos focados nela
- **Paleta de comandos** (`Ctrl K` ou `⌘ K`): navegue, crie, inicie o foco, troque o tema ou busque tarefas pelo teclado
- **Detalhes de acabamento**: transição em "íris" ao entrar e ao trocar o tema, fundo do login que entra em foco quando você digita, ícone da aba virando anel de progresso, brilho que segue o cursor nos cartões e sino ao fim do ciclo

## Bloqueio de redes sociais (extensão)

Um site não consegue bloquear outros sites, por isso o bloqueio é feito por uma extensão
(Chrome, Edge e outros navegadores baseados em Chromium, no computador).

1. Abra `chrome://extensions` (no Edge, `edge://extensions`) e ligue o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e escolha a pasta `extensao-chrome`.
3. Recarregue o FocusMe. No cartão do Pomodoro, o aviso fica verde: *Extensão conectada*.

Como funciona:

- Enquanto o **foco** está em andamento (rodando ou pausado no meio), todos os sites da lista ficam bloqueados.
- Nas **pausas** (curta ou longa) tudo é liberado. As abas bloqueadas voltam sozinhas para o endereço original.
- Para liberar antes, é preciso **Parar** o ciclo (o FocusMe avisa isso) ou desativar a extensão no ícone dela.
- A lista de sites é editável (clique no ícone da extensão › *Sites*). Por padrão: Instagram, TikTok, Facebook, X/Twitter,
  YouTube, Kwai, Reddit, Pinterest, Snapchat, Threads e Twitch.
- Se o FocusMe fechar sem avisar, o bloqueio expira sozinho poucos minutos depois do fim previsto do foco.

Observações:

- Abrindo o `index.html` direto do computador (`file://`), ligue **“Permitir acesso a URLs de arquivo”** nos detalhes da extensão.
- Para hospedar em domínio próprio, autorize o endereço em *Opções* da extensão (já funcionam `localhost`, `github.io`,
  `netlify.app`, `vercel.app`, `web.app`, `pages.dev`, entre outros).
- É uma ferramenta de **autodisciplina**: quem instala também pode desativar. No celular, o bloqueio exigiria um app nativo.

## Estrutura

```
index.html            telas (login, app, modo foco, diálogos)
css/style.css         estilos e tokens de design
js/script.js          contas, tarefas, Pomodoro, monitor de distrações, ponte com a extensão
img/                  logo
extensao-chrome/      extensão (Manifest V3): service worker, content script, popup, opções e página de bloqueio
extensao-chrome.zip   a mesma extensão compactada (link de download dentro do site)
```

## Sobre a conta e a segurança

Este projeto não tem servidor: contas, tarefas e preferências ficam no `localStorage` do navegador. Por isso:

- E-mail e nome de usuário só mudam com a senha atual; a senha nova é gravada com um novo salt, nunca em texto puro.
- Recuperação de senha por e-mail, verificação de e-mail, autenticação em dois fatores e lista de dispositivos conectados
  **não existem** (dependem de um servidor) e por isso não aparecem na interface.
- Excluir a conta apaga tudo o que existe: perfil, tarefas, histórico de foco, distrações e preferências.
- Para ligar esses recursos de verdade, o próximo passo é trocar o `localStorage` por um serviço como o Firebase Authentication.
