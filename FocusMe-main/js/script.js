document.addEventListener('DOMContentLoaded', () => {
    // ======================================================================
    // ESTADO GERAL
    // ======================================================================
    let tarefasDB = [];
    let filtroAtual = 'todas';
    let tarefaEmEdicao = null;
    let usuarioAtual = null;
    let timerAnimaLista = null;

    const CHAVE_USUARIOS = 'focusMeUsuarios';
    const CHAVE_SESSAO = 'focusMeSessao';
    const CHAVE_TEMA = 'focusMeTema';
    const CHAVE_TAREFAS_LEGADO = 'focusMeTarefas';

    const $ = (id) => document.getElementById(id);

    // Elementos estruturais
    const telaLogin = $('telaLogin');
    const telaApp = $('telaApp');
    const listaTarefasDOM = $('listaTarefas');
    const containerPomodoro = $('containerPomodoro');
    const containerEstatisticas = $('containerEstatisticas');
    const containerPerfil = $('containerPerfil');
    const menuFiltros = document.querySelectorAll('#menuFiltros li');
    const tituloFiltroAtual = $('tituloFiltroAtual');
    const btnNovaTarefa = $('btnNovaTarefa');
    const ordenacaoTarefas = $('ordenacaoTarefas');
    const barraProgressoDiaria = $('barraProgressoDiaria');
    const btnModoNoturno = $('btnModoNoturno');

    const sidebar = $('sidebar');
    const btnToggleMenu = $('btnToggleMenu');
    const btnFecharMenu = $('btnFecharMenu');
    const menuOverlay = $('menuOverlay');
    const modal = $('modalTarefa');
    const fecharModal = $('fecharModal');
    const formTarefa = $('formTarefa');
    const tituloModal = $('tituloModalTarefa');
    const btnAdicionarSubtarefa = $('btn-adicionar-subtask');
    const listaSubtarefasForm = $('lista-subtarefas');
    const avisoSubtarefa = $('avisoSubtarefa');

    let contadorSubtarefas = 0;
    const MAX_SUBTAREFAS = 10;

    // ======================================================================
    // UTILITÁRIOS: ícones, escape de HTML, toasts e diálogo de confirmação
    // ======================================================================
    const svg = (paths, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
    const ICONES = {
        editar: svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'),
        lixeira: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
        calendario: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
        lista: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
        x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
        lua: svg('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>'),
        sol: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
        mais: svg('<path d="M12 5v14M5 12h14"/>'),
        alvo: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
        relogio: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
        busca: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
        tique: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
        olho: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
        olhoFechado: svg('<path d="M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3 3.7M6.4 7.6A16.6 16.6 0 0 0 2 12s3.6 6 10 6c1.5 0 2.9-.3 4.1-.8"/>')
    };

    // Evita injeção de HTML a partir de textos digitados pelo usuário
    function esc(texto) {
        return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Contagem animada de números (progresso, ranking, contadores)
    function animarNumero(el, para, sufixo = '') {
        const de = parseInt(el.dataset.v || '0', 10);
        el.dataset.v = para;
        if (reduzMovimento || de === para) { el.textContent = `${para}${sufixo}`; return; }
        const inicio = performance.now();
        const passo = (agora) => {
            const k = Math.min(1, (agora - inicio) / 700);
            el.textContent = `${Math.round(de + (para - de) * (1 - Math.pow(1 - k, 3)))}${sufixo}`;
            if (k < 1) requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
    }

    function animarEntrada(el) {
        el.classList.remove('entra');
        void el.offsetWidth;
        el.classList.add('entra');
    }

    // Transição "íris": a nova tela abre como a abertura de uma lente a partir do ponto clicado.
    // Usa a View Transitions API; onde não existe (ou com "reduzir movimento"), troca direto.
    function transicaoIris(origem, atualizar) {
        const raiz = document.documentElement;
        const r = origem && origem.getBoundingClientRect ? origem.getBoundingClientRect() : null;
        const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
        const y = r ? r.top + r.height / 2 : window.innerHeight / 2;
        raiz.style.setProperty('--iris-x', `${x}px`);
        raiz.style.setProperty('--iris-y', `${y}px`);
        // raio que alcança o canto mais distante: a abertura termina exatamente quando cobre a tela
        raiz.style.setProperty('--iris-r', `${Math.ceil(Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))) + 24}px`);
        if (!document.startViewTransition || reduzMovimento) { atualizar(); return Promise.resolve(); }
        raiz.classList.add('vt-iris-abre', 'sem-transicao');
        const transicao = document.startViewTransition(() => { atualizar(); });
        const limpar = () => raiz.classList.remove('vt-iris-abre', 'sem-transicao');
        return transicao.finished.then(limpar, limpar);
    }

    // Confete saindo do cartão de progresso quando tudo é concluído
    function celebrar() {
        if (reduzMovimento) return;
        const caixa = $('confete');
        const r = barraProgressoDiaria.getBoundingClientRect();
        const ox = r.width ? r.left + r.width / 2 : window.innerWidth / 2;
        const oy = r.height ? r.top + r.height / 2 : window.innerHeight / 3;
        const cores = ['#7fd3f0', '#3695BD', '#4be0b0', '#f5a524', '#8e5bd0', '#ffffff'];
        for (let i = 0; i < 40; i++) {
            const el = document.createElement('i');
            const ang = Math.random() * Math.PI * 2;
            const dist = 120 + Math.random() * 240;
            el.style.cssText = `left:${ox}px;top:${oy}px;--cor:${cores[i % cores.length]};--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist + 90}px;--rot:${Math.round(Math.random() * 720 - 360)}deg`;
            caixa.appendChild(el);
        }
        setTimeout(() => { caixa.innerHTML = ''; }, 1500);
    }

    const todasConcluidas = () => tarefasDB.length > 0 && tarefasDB.every((t) => t.concluida);

    function mostrarToast(mensagem, tipo = 'ok') {
        const el = document.createElement('div');
        el.className = `toast ${tipo === 'erro' ? 'erro' : ''}`;
        el.textContent = mensagem;
        $('toasts').appendChild(el);
        setTimeout(() => {
            el.classList.add('saindo');
            setTimeout(() => el.remove(), 300);
        }, 3200);
    }

    const dialogo = $('dialogo');
    const dialogoInput = $('dialogoInput');
    const dialogoConfirmar = $('dialogoConfirmar');

    // Substitui confirm()/prompt()/alert(): devolve uma Promise<boolean>
    function confirmar({ titulo, texto, rotuloConfirmar = 'Confirmar', rotuloCancelar = 'Cancelar', perigo = false, digitar = null }) {
        return new Promise((resolve) => {
            $('dialogoTitulo').textContent = titulo;
            $('dialogoTexto').textContent = texto;
            dialogoConfirmar.textContent = rotuloConfirmar;
            $('dialogoCancelar').textContent = rotuloCancelar;
            dialogoConfirmar.classList.toggle('perigo', perigo);

            if (digitar) {
                $('dialogoDigitar').classList.remove('oculto');
                $('dialogoInputRotulo').innerHTML = `Para confirmar, digite <strong>${esc(digitar)}</strong>`;
                dialogoInput.value = '';
                dialogoConfirmar.disabled = true;
            } else {
                $('dialogoDigitar').classList.add('oculto');
                dialogoConfirmar.disabled = false;
            }

            const fechar = (resultado) => {
                dialogo.classList.add('oculto');
                dialogo.onkeydown = dialogo.onmousedown = dialogoInput.oninput = null;
                dialogoConfirmar.onclick = $('dialogoCancelar').onclick = null;
                resolve(resultado);
            };

            dialogoConfirmar.onclick = () => fechar(true);
            $('dialogoCancelar').onclick = () => fechar(false);
            dialogoInput.oninput = () => {
                dialogoConfirmar.disabled = dialogoInput.value.trim().toLowerCase() !== digitar;
            };
            dialogo.onmousedown = (e) => { if (e.target === dialogo) fechar(false); };
            dialogo.onkeydown = (e) => {
                e.stopPropagation();
                if (e.key === 'Escape') fechar(false);
                if (e.key === 'Enter' && !dialogoConfirmar.disabled) { e.preventDefault(); fechar(true); }
            };

            dialogo.classList.remove('oculto');
            (digitar ? dialogoInput : dialogoConfirmar).focus();
        });
    }

    // ======================================================================
    // TEMA (claro / noturno) — lembrado entre visitas
    // ======================================================================
    function aplicarTema(noturno) {
        document.body.classList.toggle('modo-noturno', noturno);
        btnModoNoturno.innerHTML = `${noturno ? ICONES.sol : ICONES.lua}<span>${noturno ? 'Modo Claro' : 'Modo Noturno'}</span>`;
        localStorage.setItem(CHAVE_TEMA, noturno ? 'noturno' : 'claro');
        desenharPreferencias();
    }

    btnModoNoturno.addEventListener('click', () => {
        const noturno = !document.body.classList.contains('modo-noturno');
        transicaoIris(btnModoNoturno, () => aplicarTema(noturno));
    });

    // ======================================================================
    // CONTAS: cadastro, login e sessão (armazenados no navegador)
    // Obs.: tudo fica no localStorage — serve para o projeto/demonstração,
    // não substitui autenticação com servidor.
    // ======================================================================
    function lerUsuarios() {
        try { return JSON.parse(localStorage.getItem(CHAVE_USUARIOS)) || []; }
        catch { return []; }
    }
    function salvarUsuarios(lista) { localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(lista)); }

    function gerarSalt() {
        const bytes = new Uint8Array(12);
        if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
        else bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256); });
        return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Nunca guardamos a senha em texto puro: salvamos um hash com salt
    async function gerarHash(senha, salt) {
        const dados = new TextEncoder().encode(`${salt}:${senha}`);
        if (window.crypto && crypto.subtle) {
            const buffer = await crypto.subtle.digest('SHA-256', dados);
            return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
        }
        let h = 5381; // alternativa simples para contextos sem crypto.subtle
        dados.forEach((b) => { h = ((h << 5) + h + b) >>> 0; });
        return `f${h.toString(16)}`;
    }

    const chaveTarefas = (u) => `${CHAVE_TAREFAS_LEGADO}:${u.id}`;

    function lerSessao() { return localStorage.getItem(CHAVE_SESSAO) || sessionStorage.getItem(CHAVE_SESSAO); }
    function salvarSessao(usuario, lembrar) {
        (lembrar ? localStorage : sessionStorage).setItem(CHAVE_SESSAO, usuario.id);
        (lembrar ? sessionStorage : localStorage).removeItem(CHAVE_SESSAO);
    }
    function limparSessao() {
        localStorage.removeItem(CHAVE_SESSAO);
        sessionStorage.removeItem(CHAVE_SESSAO);
    }

    // Quem usava a versão antiga (tarefas sem conta) não perde nada:
    // as tarefas antigas vão para a primeira conta criada.
    function migrarTarefasLegado(usuario) {
        const legado = localStorage.getItem(CHAVE_TAREFAS_LEGADO);
        if (legado && lerUsuarios().length === 1 && !localStorage.getItem(chaveTarefas(usuario))) {
            localStorage.setItem(chaveTarefas(usuario), legado);
            localStorage.removeItem(CHAVE_TAREFAS_LEGADO);
        }
    }

    // --- abas Entrar / Criar conta ---
    const formLogin = $('formLogin');
    const formCadastro = $('formCadastro');

    function erroCampo(idInput, mensagem) {
        $(idInput).closest('.campo').classList.toggle('invalido', !!mensagem);
        $(`${idInput}Erro`).textContent = mensagem || '';
    }

    function limparErrosAuth() {
        document.querySelectorAll('.auth .campo').forEach((c) => c.classList.remove('invalido'));
        document.querySelectorAll('.auth .campo-erro, .auth-erro').forEach((p) => { p.textContent = ''; });
    }

    function mostrarAba(nome) {
        const entrar = nome === 'entrar';
        formLogin.classList.toggle('oculto', !entrar);
        formCadastro.classList.toggle('oculto', entrar);
        $('abaEntrar').classList.toggle('ativo', entrar);
        $('abaCadastrar').classList.toggle('ativo', !entrar);
        $('abaEntrar').setAttribute('aria-selected', String(entrar));
        $('abaCadastrar').setAttribute('aria-selected', String(!entrar));
        limparErrosAuth();
        (entrar ? $('loginUsuario') : $('cadNome')).focus({ preventScroll: true });
    }

    document.querySelectorAll('[data-aba]').forEach((el) => el.addEventListener('click', () => mostrarAba(el.dataset.aba)));

    // Login: o fundo "entra em foco" quando você digita, e acompanha o ponteiro
    const authEl = document.querySelector('.auth');
    const heroEl = document.querySelector('.auth-hero');
    const cartaoAuth = document.querySelector('.auth-card');
    cartaoAuth.addEventListener('focusin', () => authEl.classList.add('focado'));
    cartaoAuth.addEventListener('focusout', () => {
        setTimeout(() => { if (!cartaoAuth.contains(document.activeElement)) authEl.classList.remove('focado'); }, 120);
    });
    authEl.addEventListener('pointermove', (e) => {
        const r = heroEl.getBoundingClientRect();
        const limitar = (v) => Math.max(-1, Math.min(1, v));
        heroEl.style.setProperty('--mx', `${e.clientX - r.left}px`);
        heroEl.style.setProperty('--my', `${e.clientY - r.top}px`);
        heroEl.style.setProperty('--px', limitar(((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
        heroEl.style.setProperty('--py', limitar(((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
    }, { passive: true });

    document.querySelectorAll('.auth .campo input').forEach((input) => {
        input.addEventListener('input', () => {
            erroCampo(input.id, '');
            $('loginErro').textContent = '';
        });
    });

    // --- mostrar / ocultar senha ---
    document.querySelectorAll('.btn-olho').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = $(btn.dataset.alvo);
            const mostrar = input.type === 'password';
            input.type = mostrar ? 'text' : 'password';
            btn.classList.toggle('visivel', mostrar);
            btn.innerHTML = mostrar ? ICONES.olhoFechado : ICONES.olho;
            btn.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
        });
    });

    // --- força da senha ---
    function pontuarSenha(s) {
        if (!s) return 0;
        let p = 0;
        if (s.length >= 6) p++;
        if (s.length >= 10) p++;
        if (/[a-z]/.test(s) && /[A-Z]/.test(s)) p++;
        if (/\d/.test(s) && /[a-zA-Z]/.test(s)) p++;
        if (/[^a-zA-Z0-9]/.test(s)) p++;
        return Math.max(1, Math.min(4, p));
    }

    $('cadSenha').addEventListener('input', (e) => {
        const nivel = pontuarSenha(e.target.value);
        $('forcaSenha').dataset.nivel = nivel;
        $('forcaTexto').textContent = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'][nivel];
    });

    // --- cadastro ---
    formCadastro.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usuarios = lerUsuarios();
        const nome = $('cadNome').value.trim();
        const usuario = $('cadUsuario').value.trim().toLowerCase();
        const email = $('cadEmail').value.trim().toLowerCase();
        const senha = $('cadSenha').value;
        const confirmacao = $('cadConfirmar').value;

        let valido = true;
        const checar = (id, mensagem) => { erroCampo(id, mensagem); if (mensagem) valido = false; };

        checar('cadNome', nome.length < 2 ? 'Informe seu nome (mínimo de 2 letras).' : '');
        checar('cadUsuario',
            !/^[a-z0-9._]{3,20}$/.test(usuario) ? '3 a 20 caracteres: letras, números, . ou _'
            : usuarios.some((u) => u.usuario === usuario) ? 'Este usuário já está em uso.' : '');
        checar('cadEmail',
            !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? 'Digite um e-mail válido.'
            : usuarios.some((u) => u.email === email) ? 'Este e-mail já está cadastrado.' : '');
        checar('cadSenha', senha.length < 6 ? 'A senha precisa ter pelo menos 6 caracteres.' : '');
        checar('cadConfirmar', confirmacao !== senha ? 'As senhas não coincidem.' : '');
        if (!valido) return;

        const botao = formCadastro.querySelector('.btn-auth');
        botao.disabled = true;
        const salt = gerarSalt();
        const novo = {
            id: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            nome, usuario, email, salt,
            hash: await gerarHash(senha, salt),
            criadoEm: Date.now()
        };
        usuarios.push(novo);
        salvarUsuarios(usuarios);
        botao.disabled = false;

        salvarSessao(novo, true);
        entrarNoApp(novo, botao);
        mostrarToast(`Conta criada! Bem-vindo(a), ${nome.split(' ')[0]}.`);
    });

    // --- login ---
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identificador = $('loginUsuario').value.trim().toLowerCase();
        const senha = $('loginSenha').value;
        const erro = $('loginErro');
        erro.textContent = '';

        const usuarios = lerUsuarios();
        if (usuarios.length === 0) {
            erro.textContent = 'Ainda não existe nenhuma conta neste navegador. Crie a sua para começar.';
            return;
        }
        if (!identificador || !senha) {
            erro.textContent = 'Preencha o usuário (ou e-mail) e a senha.';
            return;
        }

        const botao = formLogin.querySelector('.btn-auth');
        botao.disabled = true;
        const usuario = usuarios.find((u) => u.usuario === identificador || u.email === identificador);
        const confere = usuario && (await gerarHash(senha, usuario.salt)) === usuario.hash;
        botao.disabled = false;

        if (!confere) {
            erro.textContent = 'Usuário ou senha incorretos.';
            return;
        }
        salvarSessao(usuario, $('loginLembrar').checked);
        entrarNoApp(usuario, botao);
    });

    // --- entrar / sair ---
    function saudacaoPorHora() {
        const h = new Date().getHours();
        return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    }

    function entrarNoApp(usuario, origem = null) {
        usuarioAtual = usuario;
        migrarTarefasLegado(usuario);

        pintarIdentidade(usuario);

        const abrirApp = () => {
            formLogin.reset();
            formCadastro.reset();
            $('forcaSenha').dataset.nivel = 0;
            $('forcaTexto').textContent = '';
            telaLogin.classList.add('oculto');
            telaApp.classList.remove('oculto');
            carregarTarefasDoLocalStorage();
            carregarPrefs();
            restaurarPomodoro();
            atualizarPomodoroHoje();
            sincronizarExtensao(true);
            const abaInicial = rotaPerfil();      // lê antes: selecionarFiltro limpa o endereço #/perfil...
            selecionarFiltro(menuFiltros[0]);
            if (abaInicial) abrirPerfil(abaInicial, { historico: false });
        };
        if (origem) transicaoIris(origem, abrirApp);
        else abrirApp();
    }

    $('btnSair').addEventListener('click', async () => {
        const sair = await confirmar({
            titulo: 'Sair da conta?',
            texto: 'Suas tarefas continuam salvas. É só entrar de novo quando quiser.',
            rotuloConfirmar: 'Sair'
        });
        if (!sair) return;
        limparSessao();
        location.reload();
    });

    // ======================================================================
    // BANCO DE DADOS LOCAL (tarefas por usuário)
    // ======================================================================
    function carregarTarefasDoLocalStorage() {
        try { tarefasDB = JSON.parse(localStorage.getItem(chaveTarefas(usuarioAtual))) || []; }
        catch { tarefasDB = []; }
        renderizarTarefas();
    }

    function salvarTarefasNoLocalStorage() {
        localStorage.setItem(chaveTarefas(usuarioAtual), JSON.stringify(tarefasDB));
    }

    // ======================================================================
    // RESPONSIVIDADE DA SIDEBAR
    // ======================================================================
    function abrirMenuMobile() {
        sidebar.classList.add('aberto');
        menuOverlay.classList.remove('oculto');
    }
    function fecharMenuMobile() {
        sidebar.classList.remove('aberto');
        menuOverlay.classList.add('oculto');
    }

    btnToggleMenu.addEventListener('click', abrirMenuMobile);
    btnFecharMenu.addEventListener('click', fecharMenuMobile);
    menuOverlay.addEventListener('click', fecharMenuMobile);

    ordenacaoTarefas.addEventListener('change', renderizarTarefas);

    // ======================================================================
    // NAVEGAÇÃO DA SIDEBAR
    // ======================================================================
    function selecionarFiltro(item) {
        menuFiltros.forEach((li) => li.classList.remove('ativo'));
        item.classList.add('ativo');

        filtroAtual = item.dataset.filtro;
        tituloFiltroAtual.textContent = item.querySelector('span').textContent;
        fecharMenuMobile();

        listaTarefasDOM.classList.add('oculto');
        containerPomodoro.classList.add('oculto');
        containerEstatisticas.classList.add('oculto');
        containerPerfil.classList.add('oculto');
        $('btnPerfil').classList.remove('ativo');
        if (location.hash.startsWith('#/perfil')) history.replaceState(null, '', location.pathname + location.search);
        btnNovaTarefa.classList.add('oculto');
        ordenacaoTarefas.classList.add('oculto');
        barraProgressoDiaria.classList.add('oculto');

        if (filtroAtual === 'pomodoro') {
            containerPomodoro.classList.remove('oculto');
            atualizarPomodoroHoje();
            enviarParaExtensao('FOCUSME_PING');
        } else if (filtroAtual === 'estatisticas') {
            containerEstatisticas.classList.remove('oculto');
            renderizarEstatisticas();
        } else {
            listaTarefasDOM.classList.remove('oculto');
            btnNovaTarefa.classList.remove('oculto');
            ordenacaoTarefas.classList.remove('oculto');
            barraProgressoDiaria.classList.remove('oculto');
            renderizarTarefas();
        }

        const ehTarefas = filtroAtual !== 'pomodoro' && filtroAtual !== 'estatisticas';
        $('resumoHoje').classList.toggle('oculto', !ehTarefas);
        $('quickAdd').classList.toggle('oculto', !(filtroAtual === 'todas' || filtroAtual === 'pendentes'));
        if (ehTarefas) {
            animarEntrada(barraProgressoDiaria);
            listaTarefasDOM.classList.add('anima');
            clearTimeout(timerAnimaLista);
            timerAnimaLista = setTimeout(() => listaTarefasDOM.classList.remove('anima'), 1000);
        } else {
            animarEntrada(filtroAtual === 'pomodoro' ? containerPomodoro : containerEstatisticas);
        }
    }

    menuFiltros.forEach((item) => {
        item.addEventListener('click', () => selecionarFiltro(item));
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selecionarFiltro(item); }
        });
    });

    // ======================================================================
    // PROGRESSO & STREAK
    // ======================================================================
    const NIVEIS_RANKING = [
        { min: 0,  nome: 'Aquecendo',    classe: 'rank-aquecendo',    cor: '#7f8c8d' },
        { min: 25, nome: 'Constante',    classe: 'rank-constante',    cor: '#d98200' },
        { min: 45, nome: 'Focado',       classe: 'rank-focado',       cor: '#3695BD' },
        { min: 65, nome: 'Disciplinado', classe: 'rank-disciplinado', cor: '#8e5bd0' },
        { min: 80, nome: 'Implacável',   classe: 'rank-implacavel',   cor: '#e0701a' },
        { min: 95, nome: 'Elite',        classe: 'rank-elite',        cor: '#00a37f' }
    ];
    const CIRCUNFERENCIA_RANKING = 2 * Math.PI * 88;

    function corPorPct(pct) {
        if (pct <= 24) return 'var(--cor-texto-secundario)';
        if (pct <= 44) return 'var(--cor-alerta)';
        if (pct <= 64) return 'var(--cor-primaria)';
        if (pct <= 79) return '#9b59b6';
        if (pct <= 94) return '#e67e22';
        return 'var(--cor-sucesso)';
    }

    function renderizarEstatisticas() {
        if (!tarefasDB) return;
        renderizarFocoStats();

        const trintaDiasAtras = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const tarefas30Dias = tarefasDB.filter((t) => t.id >= trintaDiasAtras);
        const total30 = tarefas30Dias.length;
        const concluidas30 = tarefas30Dias.filter((t) => t.concluida).length;
        const pct30 = total30 > 0 ? Math.round((concluidas30 / total30) * 100) : 0;

        let indiceNivel = 0;
        NIVEIS_RANKING.forEach((n, i) => { if (pct30 >= n.min) indiceNivel = i; });
        const nivel = NIVEIS_RANKING[indiceNivel];

        animarNumero($('rankingValor'), pct30, '%');
        $('rankingNivel').textContent = nivel.nome;
        $('rankingNivel').className = `ranking-nivel ${nivel.classe}`;
        $('rankingGauge').className = `ranking-gauge ${nivel.classe}`;
        $('rankingAnel').style.strokeDashoffset = CIRCUNFERENCIA_RANKING * (1 - pct30 / 100);
        $('rankingDescricao').textContent = `Conclusão nos últimos 30 dias (${concluidas30} de ${total30} tarefas)`;

        $('rankingEscada').innerHTML = NIVEIS_RANKING.map((n, i) => `
            <li class="degrau ${i <= indiceNivel ? 'alcancado' : ''} ${i === indiceNivel ? 'atual' : ''}" style="--i:${i}; --rank-cor:${n.cor}">
                <span class="degrau-barra"></span>
                <span class="degrau-nome">${n.nome}</span>
                <span class="degrau-min">${n.min}%+</span>
            </li>`).join('');

        const totalConcluidas = tarefasDB.filter((t) => t.concluida).length;
        animarNumero($('statTotal'), tarefasDB.length);
        animarNumero($('statConcluidas'), totalConcluidas);
        animarNumero($('statPendentes'), tarefasDB.length - totalConcluidas);

        // Histórico semanal (semanas começam na segunda-feira)
        const semanas = {};
        tarefasDB.forEach((t) => {
            const dataCriacao = new Date(t.id);
            const dia = dataCriacao.getDay();
            const diff = dataCriacao.getDate() - dia + (dia === 0 ? -6 : 1);
            const inicioSemana = new Date(dataCriacao.setDate(diff)).setHours(0, 0, 0, 0);

            if (!semanas[inicioSemana]) {
                semanas[inicioSemana] = { total: 0, concluidas: 0, dataObj: new Date(inicioSemana) };
            }
            semanas[inicioSemana].total++;
            if (t.concluida) semanas[inicioSemana].concluidas++;
        });

        const chavesOrdenadas = Object.keys(semanas).sort((a, b) => b - a);
        const listaSemanasDOM = $('listaSemanas');
        listaSemanasDOM.innerHTML = '';

        if (chavesOrdenadas.length === 0) {
            listaSemanasDOM.innerHTML = '<p class="sem-dados">Nenhuma tarefa registrada ainda.</p>';
            $('semanasGrafico').innerHTML = '';
            $('statMelhor').textContent = '–';
            $('statMelhor').dataset.v = 0;
            return;
        }

        // Gráfico das últimas 8 semanas (da mais antiga para a mais recente)
        const percentuais = chavesOrdenadas.map((k) => Math.round((semanas[k].concluidas / semanas[k].total) * 100));
        animarNumero($('statMelhor'), Math.max(...percentuais), '%');
        $('semanasGrafico').innerHTML = chavesOrdenadas.slice(0, 8).reverse().map((chave, i) => {
            const sem = semanas[chave];
            const pct = Math.round((sem.concluidas / sem.total) * 100);
            const d = sem.dataObj;
            const rotulo = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            return `<div class="gcol" title="Semana de ${rotulo}: ${pct}%">
                <div class="gtrilho"><div class="gbarra" style="--h:${pct}%; --i:${i}; background-color:${corPorPct(pct)}"><b>${pct}%</b></div></div>
                <span class="gdata">${rotulo}</span>
            </div>`;
        }).join('');

        chavesOrdenadas.forEach((chave) => {
            const sem = semanas[chave];
            const pct = Math.round((sem.concluidas / sem.total) * 100);

            const dataFim = new Date(sem.dataObj);
            dataFim.setDate(dataFim.getDate() + 6);
            const formataData = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

            const corBarra = corPorPct(pct);

            const div = document.createElement('div');
            div.className = 'semana-item';
            div.innerHTML = `
                <div class="semana-header">
                    <span class="semana-data">${formataData(sem.dataObj)} a ${formataData(dataFim)}</span>
                    <span class="semana-pct" style="color: ${corBarra}">${pct}%</span>
                </div>
                <div class="semana-progress-bg">
                    <div class="semana-progress-fill" style="width: ${pct}%; background-color: ${corBarra};"></div>
                </div>
                <div class="semana-detalhes">${sem.concluidas} de ${sem.total} tarefas concluídas</div>
            `;
            listaSemanasDOM.appendChild(div);
        });
    }

    // ======================================================================
    // MODAL DE TAREFAS
    // ======================================================================
    const obterPrioridade = () => document.querySelector('input[name="prioridade"]:checked').value;
    const definirPrioridade = (valor) => {
        const radio = document.querySelector(`input[name="prioridade"][value="${valor}"]`);
        if (radio) radio.checked = true;
    };

    function abrirNovaTarefa() {
        tarefaEmEdicao = null;
        tituloModal.textContent = 'Nova Tarefa';
        modal.classList.remove('oculto');
        $('titulo').focus();
    }
    window.abrirNovaTarefa = abrirNovaTarefa;

    btnNovaTarefa.addEventListener('click', abrirNovaTarefa);
    fecharModal.addEventListener('click', fecharEResetarModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('oculto') && dialogo.classList.contains('oculto')) {
            fecharEResetarModal();
        }
    });

    function fecharEResetarModal() {
        modal.classList.add('oculto');
        formTarefa.reset();
        listaSubtarefasForm.innerHTML = '';
        contadorSubtarefas = 0;
        avisoSubtarefa.classList.add('oculto');
        btnAdicionarSubtarefa.disabled = false;
        tarefaEmEdicao = null;
    }

    function linhaSubtarefaHTML(valor = '') {
        return `
            <input type="text" class="subtask-input" placeholder="Nome da subtarefa" value="${esc(valor)}" required>
            <button type="button" class="btn-excluir-subtask" onclick="removerSubtarefaForm(this)" title="Remover subtarefa" aria-label="Remover subtarefa">${ICONES.x}</button>
        `;
    }

    btnAdicionarSubtarefa.addEventListener('click', () => {
        if (contadorSubtarefas < MAX_SUBTAREFAS) {
            const div = document.createElement('div');
            div.className = 'subtask-row';
            div.innerHTML = linhaSubtarefaHTML();
            listaSubtarefasForm.appendChild(div);
            div.querySelector('input').focus();
            contadorSubtarefas++;
            if (contadorSubtarefas >= MAX_SUBTAREFAS) {
                avisoSubtarefa.classList.remove('oculto');
                btnAdicionarSubtarefa.disabled = true;
            }
        }
    });

    window.removerSubtarefaForm = function (botao) {
        botao.parentElement.remove();
        contadorSubtarefas--;
        avisoSubtarefa.classList.add('oculto');
        btnAdicionarSubtarefa.disabled = false;
    };

    formTarefa.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (tarefaEmEdicao !== null) {
            const salvar = await confirmar({
                titulo: 'Salvar alterações?',
                texto: 'Deseja salvar as alterações feitas nesta tarefa?',
                rotuloConfirmar: 'Salvar'
            });
            if (!salvar) return;
        }

        const subtarefas = Array.from(document.querySelectorAll('.subtask-input')).map((input, index) => ({
            idSub: index, nome: input.value, concluida: false
        }));

        if (tarefaEmEdicao !== null) {
            const index = tarefasDB.findIndex((t) => t.id === tarefaEmEdicao);
            if (index !== -1) {
                const tarefaOriginal = tarefasDB[index];
                const subtarefasAtualizadas = subtarefas.map((sub, idx) => {
                    const subAntiga = tarefaOriginal.subtarefas[idx];
                    return { idSub: idx, nome: sub.nome, concluida: subAntiga ? subAntiga.concluida : false };
                });
                const todasConcluidas = subtarefasAtualizadas.length > 0 ? subtarefasAtualizadas.every((s) => s.concluida) : tarefaOriginal.concluida;

                tarefasDB[index] = {
                    ...tarefaOriginal,
                    titulo: $('titulo').value,
                    descricao: $('descricao').value,
                    data: $('data').value,
                    horario: $('horario').value,
                    prioridade: obterPrioridade(),
                    subtarefas: subtarefasAtualizadas,
                    concluida: todasConcluidas
                };
            }
        } else {
            tarefasDB.push({
                id: Date.now(),
                titulo: $('titulo').value,
                descricao: $('descricao').value,
                data: $('data').value,
                horario: $('horario').value,
                prioridade: obterPrioridade(),
                subtarefas: subtarefas,
                concluida: false
            });
        }

        const editando = tarefaEmEdicao !== null;
        salvarTarefasNoLocalStorage();
        renderizarTarefas();
        if (filtroAtual === 'estatisticas') renderizarEstatisticas();
        fecharEResetarModal();
        mostrarToast(editando ? 'Tarefa atualizada.' : 'Tarefa criada.');
    });

    // ======================================================================
    // BARRA DE PROGRESSO DO DIA
    // ======================================================================
    function atualizarProgressoDiario() {
        const total = tarefasDB.length;
        const concluidas = tarefasDB.filter((t) => t.concluida).length;
        const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

        animarNumero($('progressPercentage'), percentual, '%');
        $('progressBarFill').style.width = `${percentual}%`;
        $('progressCount').textContent = `${concluidas} de ${total} tarefas concluídas`;
        barraProgressoDiaria.classList.toggle('completo', total > 0 && percentual === 100);

        let mensagem = 'Crie sua primeira tarefa';
        if (total > 0) {
            if (percentual === 0) mensagem = 'Vamos começar?';
            else if (percentual < 50) mensagem = 'Bom começo';
            else if (percentual < 100) mensagem = 'Quase lá!';
            else mensagem = 'Tudo concluído!';
        }
        $('progressMensagem').textContent = mensagem;
    }

    function atualizarResumoHoje() {
        const pendentes = tarefasDB.filter((t) => !t.concluida);
        let hoje = 0;
        let atrasadas = 0;
        pendentes.forEach((t) => {
            const classe = infoPrazo(t).classe;
            if (classe === 'chip-atrasada') atrasadas++;
            else if (classe === 'chip-hoje') hoje++;
        });
        const chips = [];
        if (atrasadas) chips.push(`<span class="chip-resumo urgente">${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}</span>`);
        if (hoje) chips.push(`<span class="chip-resumo hoje">${hoje} para hoje</span>`);
        if (!atrasadas && !hoje && tarefasDB.length) {
            chips.push(`<span class="chip-resumo ok">${pendentes.length ? 'Nada urgente por enquanto' : 'Tudo em dia'}</span>`);
        }
        $('resumoHoje').innerHTML = chips.join('');
    }

    // ======================================================================
    // LISTA DE TAREFAS
    // ======================================================================
    const ROTULO_PRIORIDADE = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

    function infoPrazo(tarefa) {
        if (!tarefa.data) return { texto: 'Sem prazo', classe: '' };
        const [ano, mes, dia] = tarefa.data.split('-').map(Number);
        const [hora, minuto] = tarefa.horario ? tarefa.horario.split(':').map(Number) : [23, 59];
        const limite = new Date(ano, mes - 1, dia, hora, minuto);
        const agora = new Date();
        const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
        const diaTarefa = new Date(ano, mes - 1, dia);
        const dif = Math.round((diaTarefa - inicioHoje) / 86400000);
        const horaTxt = tarefa.horario ? ` · ${tarefa.horario}` : '';
        const fmt = diaTarefa.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

        if (tarefa.concluida) return { texto: `${fmt}${horaTxt}`, classe: '' };
        if (limite < agora) return { texto: `Atrasada · ${fmt}`, classe: 'chip-atrasada' };
        if (dif === 0) return { texto: `Hoje${horaTxt}`, classe: 'chip-hoje' };
        if (dif === 1) return { texto: `Amanhã${horaTxt}`, classe: '' };
        return { texto: `${fmt}${horaTxt}`, classe: '' };
    }

    const FRAME_VISOR = '<span class="canto c1"></span><span class="canto c2"></span><span class="canto c3"></span><span class="canto c4"></span>';

    function estadoVazioHTML() {
        const textos = {
            todas: ['Nenhuma tarefa ainda', 'Crie sua primeira tarefa e comece a focar no que importa.', true],
            pendentes: ['Tudo em dia!', 'Você não tem nenhuma tarefa pendente agora.', false],
            concluidas: ['Nada concluído ainda', 'As tarefas que você finalizar vão aparecer por aqui.', false]
        };
        const [titulo, texto, mostrarBotao] = textos[filtroAtual] || textos.todas;
        return `
            <li class="vazio">
                <div class="vazio-frame">${FRAME_VISOR}${filtroAtual === 'pendentes' ? ICONES.tique.replace('<svg', '<svg class="vz"') : ICONES.lista}</div>
                <strong>${titulo}</strong>
                <p>${texto}</p>
                ${mostrarBotao ? `<button class="btn-primary" onclick="abrirNovaTarefa()">${ICONES.mais}<span>Nova Tarefa</span></button>` : ''}
            </li>`;
    }

    function renderizarTarefas() {
        if (!usuarioAtual) return;
        atualizarProgressoDiario();
        atualizarResumoHoje();
        const nPendentes = tarefasDB.filter((t) => !t.concluida).length;
        $('badgePendentes').textContent = nPendentes;
        $('badgePendentes').classList.toggle('oculto', nPendentes === 0);
        listaTarefasDOM.innerHTML = '';

        const tarefasFiltradas = tarefasDB.filter((tarefa) => {
            if (filtroAtual === 'concluidas') return tarefa.concluida;
            if (filtroAtual === 'pendentes') return !tarefa.concluida;
            return true;
        });

        const tipoOrdenacao = ordenacaoTarefas.value;
        const pesoPrioridade = { alta: 3, media: 2, baixa: 1 };

        tarefasFiltradas.sort((a, b) => {
            if (tipoOrdenacao === 'criacao-novo') return b.id - a.id;
            if (tipoOrdenacao === 'criacao-antigo') return a.id - b.id;
            if (tipoOrdenacao === 'prio-alta') return pesoPrioridade[b.prioridade] - pesoPrioridade[a.prioridade];
            if (tipoOrdenacao === 'prio-baixa') return pesoPrioridade[a.prioridade] - pesoPrioridade[b.prioridade];
            if (tipoOrdenacao === 'data-perto' || tipoOrdenacao === 'data-longe') {
                const getTempo = (t) => {
                    if (!t.data) return Infinity;
                    return new Date(t.data + (t.horario ? `T${t.horario}` : 'T23:59:59')).getTime();
                };
                const tempoA = getTempo(a);
                const tempoB = getTempo(b);
                if (tipoOrdenacao === 'data-perto') return tempoA - tempoB;
                if (tempoA === Infinity && tempoB !== Infinity) return 1;
                if (tempoB === Infinity && tempoA !== Infinity) return -1;
                return tempoB - tempoA;
            }
            return 0;
        });

        if (tarefasFiltradas.length === 0) {
            listaTarefasDOM.innerHTML = estadoVazioHTML();
            return;
        }

        tarefasFiltradas.forEach((tarefa, idx) => {
            const li = document.createElement('li');
            li.style.setProperty('--d', Math.min(idx, 8));
            li.className = `task-item prio-${tarefa.prioridade} ${tarefa.concluida ? 'tarefa-concluida' : ''}`;

            const subTotal = tarefa.subtarefas.length;
            const subFeitas = tarefa.subtarefas.filter((s) => s.concluida).length;
            const pctSub = subTotal ? Math.round((subFeitas / subTotal) * 100) : 0;
            const prazo = infoPrazo(tarefa);

            let marcador;
            if (tarefa.concluida) {
                marcador = `<span class="task-check feito" role="img" aria-label="Tarefa concluída">${ICONES.tique}</span>`;
            } else if (subTotal > 0) {
                marcador = `<span class="task-check parcial" style="--pct:${pctSub}" role="img" aria-label="${subFeitas} de ${subTotal} subtarefas concluídas"></span>`;
            } else {
                marcador = `<button class="task-check" onclick="concluirTarefaSemSub(${tarefa.id})" aria-label="Marcar como concluída" title="Marcar como concluída"></button>`;
            }

            let htmlSubtarefas = '';
            if (subTotal > 0) {
                htmlSubtarefas = '<ul class="subtask-list">' + tarefa.subtarefas.map((sub) => `
                    <li class="subtask-item ${sub.concluida ? 'feita' : ''}">
                        <input type="checkbox" ${sub.concluida ? 'checked' : ''} ${tarefa.concluida ? 'disabled' : ''}
                            onchange="alternarSubtarefa(${tarefa.id}, ${sub.idSub})" aria-label="${esc(sub.nome)}">
                        <span>${esc(sub.nome)}</span>
                    </li>`).join('') + '</ul>';
            }

            li.innerHTML = `
                <div class="task-top">
                    ${marcador}
                    <div class="task-header-content">
                        <span class="task-title">${esc(tarefa.titulo)}</span>
                        <div class="task-meta">
                            <span class="chip chip-prio">${ROTULO_PRIORIDADE[tarefa.prioridade] || ''}</span>
                            <span class="chip ${prazo.classe}">${ICONES.calendario.replace('class="ico"', 'class="ico"')}${prazo.texto}</span>
                            ${subTotal ? `<span class="chip">${subFeitas}/${subTotal} subtarefas</span>` : ''}
                            ${tarefa.focoMin ? `<span class="chip" title="Tempo de foco nesta tarefa">${ICONES.relogio}${formatarDuracao(tarefa.focoMin * 60)}</span>` : ''}
                        </div>
                    </div>
                    <div class="task-acoes">
                        ${tarefa.concluida ? '' : `<button class="btn-icone foco ${tarefaEmFoco === tarefa.id ? 'ativo' : ''}" onclick="focarNaTarefa(${tarefa.id})" aria-label="Focar nesta tarefa" title="Focar nesta tarefa">${ICONES.alvo}</button>`}
                        <button class="btn-icone" onclick="abrirEdicaoTarefa(${tarefa.id})" aria-label="Editar tarefa" title="Editar">${ICONES.editar}</button>
                        <button class="btn-icone perigo" onclick="excluirTarefa(${tarefa.id})" aria-label="Excluir tarefa" title="Excluir">${ICONES.lixeira}</button>
                    </div>
                </div>
                ${tarefa.descricao ? `<p class="task-descricao">${esc(tarefa.descricao)}</p>` : ''}
                ${htmlSubtarefas}
            `;
            listaTarefasDOM.appendChild(li);
        });
        atualizarTarefaEmFocoUI();
    }

    // ======================================================================
    // EDIÇÃO, CONCLUSÃO E EXCLUSÃO
    // ======================================================================
    window.abrirEdicaoTarefa = function (idTarefa) {
        const tarefa = tarefasDB.find((t) => t.id === idTarefa);
        if (!tarefa) return;
        tarefaEmEdicao = idTarefa;
        tituloModal.textContent = 'Editar Tarefa';
        $('titulo').value = tarefa.titulo;
        $('descricao').value = tarefa.descricao;
        $('data').value = tarefa.data;
        $('horario').value = tarefa.horario;
        definirPrioridade(tarefa.prioridade);

        listaSubtarefasForm.innerHTML = '';
        contadorSubtarefas = 0;
        tarefa.subtarefas.forEach((sub) => {
            if (contadorSubtarefas < MAX_SUBTAREFAS) {
                const div = document.createElement('div');
                div.className = 'subtask-row';
                div.innerHTML = linhaSubtarefaHTML(sub.nome);
                listaSubtarefasForm.appendChild(div);
                contadorSubtarefas++;
            }
        });

        const cheio = contadorSubtarefas >= MAX_SUBTAREFAS;
        avisoSubtarefa.classList.toggle('oculto', !cheio);
        btnAdicionarSubtarefa.disabled = cheio;
        modal.classList.remove('oculto');
        $('titulo').focus();
    };

    window.alternarSubtarefa = function (idTarefa, idSub) {
        const tarefa = tarefasDB.find((t) => t.id === idTarefa);
        const sub = tarefa.subtarefas.find((s) => s.idSub === idSub);
        sub.concluida = !sub.concluida;
        const jaConcluida = tarefa.concluida;
        const tudoAntes = todasConcluidas();
        tarefa.concluida = tarefa.subtarefas.every((s) => s.concluida === true);
        salvarTarefasNoLocalStorage();
        renderizarTarefas();
        if (!jaConcluida && tarefa.concluida) {
            mostrarToast('Tarefa concluída. Bom trabalho!');
            if (!tudoAntes && todasConcluidas()) celebrar();
        }
    };

    window.concluirTarefaSemSub = function (idTarefa) {
        const tarefa = tarefasDB.find((t) => t.id === idTarefa);
        tarefa.concluida = true;
        salvarTarefasNoLocalStorage();
        renderizarTarefas();
        mostrarToast('Tarefa concluída. Bom trabalho!');
        if (todasConcluidas()) celebrar();
    };

    window.excluirTarefa = async function (idTarefa) {
        const tarefa = tarefasDB.find((t) => t.id === idTarefa);
        if (!tarefa) return;

        const confirmado = tarefa.concluida
            ? await confirmar({
                titulo: 'Excluir tarefa?',
                texto: 'Deseja realmente excluir esta tarefa que já foi concluída?',
                rotuloConfirmar: 'Excluir',
                perigo: true
            })
            : await confirmar({
                titulo: 'Excluir tarefa pendente?',
                texto: 'Atenção: esta tarefa ainda não foi concluída e a exclusão não pode ser desfeita.',
                rotuloConfirmar: 'Excluir',
                perigo: true,
                digitar: 'excluir tarefa'
            });

        if (!confirmado) return;
        tarefasDB = tarefasDB.filter((t) => t.id !== idTarefa);
        if (tarefaEmFoco === idTarefa) tarefaEmFoco = null;
        salvarTarefasNoLocalStorage();
        renderizarTarefas();
        mostrarToast('Tarefa excluída.');
    };

    // --- ENGINE DO POMODORO ---
    let tempoRestante = 25 * 60; 
    let tempoTotalCiclo = 25 * 60;
    let intervaloPomodoro = null;
    let modoAtual = 'foco';       
    let pomodoroRodando = false;
    let ciclosConcluidos = 0;
    let endTimeTarget = null;     
    const TITULO_ORIGINAL = document.title;

    const pomodoroTimerDOM = document.getElementById('pomodoroTimer');
    const timerProgressFill = document.getElementById('timerProgressFill');
    const pomodoroCiclosContador = document.getElementById('pomodoroCiclosContador');
    const inputTempoFoco = document.getElementById('pomodoroTempoFoco');
    const inputTempoPausa = document.getElementById('pomodoroTempoPausa');
    const inputTempoPausaLonga = document.getElementById('pomodoroTempoPausaLonga');
    const checkboxAutoStart = document.getElementById('pomodoroAutoStart');
    const btnPomodoroIniciar = document.getElementById('btnPomodoroIniciar');
    const btnPomodoroPausar = document.getElementById('btnPomodoroPausar');

    inputTempoFoco.addEventListener('input', () => atualizarTimerPorInputs(true));
    inputTempoPausa.addEventListener('input', () => atualizarTimerPorInputs(false));
    inputTempoPausaLonga.addEventListener('input', () => atualizarTimerPorInputs(false));

    function atualizarTimerPorInputs(forcarSeFoco) {
        let f = parseInt(inputTempoFoco.value) || 25;
        let p = parseInt(inputTempoPausa.value) || 5;
        let pl = parseInt(inputTempoPausaLonga.value) || 15;

        if (f < 15) inputTempoFoco.value = 15;
        if (f > 60) inputTempoFoco.value = 60;

        if (!pomodoroRodando) {
            if (modoAtual === 'foco' && forcarSeFoco) tempoRestante = f * 60;
            else if (modoAtual === 'pausa-curta' && !forcarSeFoco) tempoRestante = p * 60;
            else if (modoAtual === 'pausa-longa' && !forcarSeFoco) tempoRestante = pl * 60;
            tempoTotalCiclo = tempoRestante;
        }
        atualizarDisplayTimer();
        salvarEstadoPomodoro();
    }

    checkboxAutoStart.addEventListener('change', salvarEstadoPomodoro);

    const pomodoroBoxCard = document.getElementById('pomodoroBoxCard');
    const pomodoroEstadoDOM = document.getElementById('pomodoroEstado');
    const pomodoroProximoDOM = document.getElementById('pomodoroProximo');
    const pontosCiclos = document.querySelectorAll('#pomodoroPontos span');
    const CIRCUNFERENCIA_ANEL = 2 * Math.PI * 90;

    const FASES = {
        'foco': { classe: 'estado-foco', nome: 'Foco' },
        'pausa-curta': { classe: 'estado-pausa-curta', nome: 'Pausa curta' },
        'pausa-longa': { classe: 'estado-pausa-longa', nome: 'Pausa longa' }
    };

    const marcasRelogio = document.querySelectorAll('#pomodoroMarcas line');
    const knobRelogio = $('timerKnob');
    let marcasLigadas = 60;


    // ======================================================================
    // MODO FOCO: preferências, registros, monitor de distrações, tela cheia
    // e ponte com a extensão de bloqueio de redes sociais
    // ======================================================================
    const PREFS_PADRAO = { pausarAoSair: true, bloquearRedes: true, som: true };
    let prefs = { ...PREFS_PADRAO };
    let pausadoPorSaida = false;
    let tarefaEmFoco = null;

    const chavePrefs = () => `focusMePrefs:${usuarioAtual.id}`;
    const chaveDistracoes = () => `focusMeDistracoes:${usuarioAtual.id}`;
    const chaveFoco = () => `focusMeFoco:${usuarioAtual.id}`;
    const chavePomodoro = () => `focusMePomodoro:${usuarioAtual.id}`;

    function lerLista(chave) {
        try { return JSON.parse(localStorage.getItem(chave)) || []; }
        catch { return []; }
    }
    const mesmoDia = (ts, ref = new Date()) => {
        const d = new Date(ts);
        return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
    };

    function formatarDuracao(seg) {
        if (seg < 60) return `${seg} s`;
        const m = Math.floor(seg / 60);
        const r = seg % 60;
        if (m < 60) return r ? `${m} min ${r} s` : `${m} min`;
        return `${Math.floor(m / 60)} h ${m % 60} min`;
    }

    function registrarDistracao(seg) {
        const lista = lerLista(chaveDistracoes());
        lista.push({ t: Date.now(), seg });
        localStorage.setItem(chaveDistracoes(), JSON.stringify(lista.slice(-500)));
    }
    function registrarFoco(min) {
        const lista = lerLista(chaveFoco());
        lista.push({ t: Date.now(), min });
        localStorage.setItem(chaveFoco(), JSON.stringify(lista.slice(-500)));
    }

    function resumoDeHoje() {
        const dist = lerLista(chaveDistracoes()).filter((x) => mesmoDia(x.t));
        const foco = lerLista(chaveFoco()).filter((x) => mesmoDia(x.t));
        return {
            distracoes: dist.length,
            foraSeg: dist.reduce((a, x) => a + x.seg, 0),
            focoMin: foco.reduce((a, x) => a + x.min, 0),
            ciclos: foco.length
        };
    }

    function atualizarPomodoroHoje() {
        if (!usuarioAtual) return;
        const r = resumoDeHoje();
        const partes = [];
        if (r.focoMin) partes.push(`${r.focoMin} min de foco`);
        partes.push(r.distracoes ? `${r.distracoes} ${r.distracoes === 1 ? 'distração' : 'distrações'}` : 'sem distrações');
        $('pomodoroHoje').textContent = (r.focoMin || r.distracoes) ? `Hoje: ${partes.join(' · ')}` : '';
        $('mfHojeTexto').textContent = r.distracoes
            ? `Hoje: ${r.distracoes} ${r.distracoes === 1 ? 'distração' : 'distrações'} · ${formatarDuracao(r.foraSeg)} fora`
            : 'Hoje: sem distrações';
        $('mfHoje').classList.toggle('tem', r.distracoes > 0);
    }

    // --- preferências (por usuário) ---
    function carregarPrefs() {
        try { prefs = { ...PREFS_PADRAO, ...JSON.parse(localStorage.getItem(chavePrefs()) || '{}') }; }
        catch { prefs = { ...PREFS_PADRAO }; }
        $('prefPausarAoSair').checked = prefs.pausarAoSair;
        $('prefBloquearRedes').checked = prefs.bloquearRedes;
        $('prefSom').checked = prefs.som;
    }
    const salvarPrefs = () => localStorage.setItem(chavePrefs(), JSON.stringify(prefs));

    $('prefPausarAoSair').addEventListener('change', (e) => { prefs.pausarAoSair = e.target.checked; salvarPrefs(); });
    $('prefSom').addEventListener('change', (e) => { prefs.som = e.target.checked; salvarPrefs(); if (prefs.som) tocarSino(); });
    $('prefBloquearRedes').addEventListener('change', (e) => {
        prefs.bloquearRedes = e.target.checked;
        salvarPrefs();
        sincronizarExtensao(true);
        atualizarStatusBloqueio();
    });

    // --- o ciclo sobrevive a recarregar a página ---
    function salvarEstadoPomodoro() {
        if (!usuarioAtual) return;
        localStorage.setItem(chavePomodoro(), JSON.stringify({
            modo: modoAtual, restante: tempoRestante, total: tempoTotalCiclo, ciclos: ciclosConcluidos,
            rodando: pomodoroRodando, fimEm: pomodoroRodando ? endTimeTarget : null,
            foco: inputTempoFoco.value, pausa: inputTempoPausa.value, pausaLonga: inputTempoPausaLonga.value,
            auto: checkboxAutoStart.checked, tarefaFoco: tarefaEmFoco
        }));
    }

    function restaurarPomodoro() {
        let salvo = null;
        try { salvo = JSON.parse(localStorage.getItem(chavePomodoro())); } catch { salvo = null; }
        if (!salvo || !FASES[salvo.modo]) return;

        inputTempoFoco.value = salvo.foco;
        inputTempoPausa.value = salvo.pausa;
        inputTempoPausaLonga.value = salvo.pausaLonga;
        checkboxAutoStart.checked = !!salvo.auto;
        modoAtual = salvo.modo;
        tarefaEmFoco = salvo.tarefaFoco ?? null;
        ciclosConcluidos = salvo.ciclos || 0;
        tempoTotalCiclo = salvo.total;
        tempoRestante = salvo.restante;

        if (salvo.rodando && salvo.fimEm) {
            const restanteMs = salvo.fimEm - Date.now();
            if (restanteMs > 0) {
                tempoRestante = Math.ceil(restanteMs / 1000);
                atualizarDisplayTimer();
                dispararTimerRegressivo();
                mostrarToast('Ciclo retomado de onde você parou.');
                return;
            }
            if (Math.abs(restanteMs) < 10 * 60 * 1000) {   // terminou enquanto a página estava fechada
                tempoRestante = 0;
                tratarFimDeCiclo();
                return;
            }
            tempoRestante = tempoTotalCiclo;
        }
        atualizarDisplayTimer();
    }

    // --- ponte com a extensão ---
    const extensao = { conectada: false, status: null };
    let ultimaAssinatura = '';
    const origemMsg = location.origin === 'null' ? '*' : location.origin;

    function enviarParaExtensao(type, payload) {
        window.postMessage({ source: 'focusme-app', type, payload }, origemMsg);
    }

    // Há foco em andamento (rodando, ou pausado no meio): é aí que as redes ficam bloqueadas
    function estadoParaExtensao() {
        const emFoco = !!usuarioAtual && prefs.bloquearRedes && modoAtual === 'foco'
            && (pomodoroRodando || tempoRestante < tempoTotalCiclo);
        return {
            bloquear: emFoco,
            fase: modoAtual,
            pausado: emFoco && !pomodoroRodando,
            fimEm: emFoco && pomodoroRodando ? endTimeTarget : null
        };
    }

    function sincronizarExtensao(forcar = false) {
        if (!usuarioAtual) return;
        const e = estadoParaExtensao();
        const assinatura = `${e.bloquear}|${e.pausado}|${e.fimEm}|${e.fase}`;
        if (!forcar && assinatura === ultimaAssinatura) return;
        ultimaAssinatura = assinatura;
        enviarParaExtensao('FOCUSME_STATE', e);
    }

    window.addEventListener('message', (ev) => {
        if (ev.source !== window) return;
        const d = ev.data;
        if (!d || d.source !== 'focusme-extension') return;
        extensao.conectada = true;
        if (d.status) extensao.status = d.status;
        if (d.type === 'FOCUSME_READY') sincronizarExtensao(true);
        atualizarStatusBloqueio();
    });

    function atualizarStatusBloqueio() {
        const st = extensao.status;
        let estado = 'pronto';
        let texto = 'Extensão conectada · bloqueia quando o foco começar';
        let mostrarAtivar = false;

        if (!prefs.bloquearRedes) { estado = 'off'; texto = 'Bloqueio de redes desligado nas configurações'; }
        else if (!extensao.conectada) { estado = 'ausente'; texto = 'Extensão de bloqueio não detectada'; mostrarAtivar = true; }
        else if (st && st.ativada === false) { estado = 'off'; texto = 'Extensão instalada, mas desativada no ícone dela'; }
        else if (st && st.bloqueando) { estado = 'ativo'; texto = 'Redes sociais bloqueadas até o fim do foco'; }

        $('bloqueioStatus').dataset.estado = estado;
        $('bloqueioTexto').textContent = texto;
        $('btnComoAtivar').classList.toggle('oculto', !mostrarAtivar);
        $('mfBloqueio').dataset.estado = estado;
        $('mfBloqueioTexto').textContent = texto;
    }

    setInterval(() => { if (extensao.conectada && estadoParaExtensao().bloquear) sincronizarExtensao(true); }, 15000);
    setInterval(() => { if (!extensao.conectada) enviarParaExtensao('FOCUSME_PING'); }, 4000);
    setTimeout(() => enviarParaExtensao('FOCUSME_PING'), 400);
    atualizarStatusBloqueio();

    // --- ajuda para instalar a extensão ---
    const modalBloqueio = $('modalBloqueio');
    const abrirAjudaBloqueio = () => modalBloqueio.classList.remove('oculto');
    const fecharAjudaBloqueio = () => modalBloqueio.classList.add('oculto');
    $('btnComoAtivar').addEventListener('click', abrirAjudaBloqueio);
    $('fecharBloqueio').addEventListener('click', fecharAjudaBloqueio);
    modalBloqueio.addEventListener('mousedown', (e) => { if (e.target === modalBloqueio) fecharAjudaBloqueio(); });

    // --- monitor de presença: detecta quando a pessoa sai do foco ---
    let foraDesde = null;
    let saiuDaJanelaEm = null;
    let timerSaida = null;
    const focoRodando = () => modoAtual === 'foco' && pomodoroRodando;
    const ausenteAgora = () => document.hidden || !document.hasFocus();

    function aoSair(desde) {
        foraDesde = desde;
        if (prefs.pausarAoSair) {
            pausarCronometro();
            pausadoPorSaida = true;
        }
    }

    async function aoVoltar() {
        const seg = Math.round((Date.now() - foraDesde) / 1000);
        const estavaPausado = pausadoPorSaida;
        foraDesde = null;
        pausadoPorSaida = false;

        if (seg < 2) {                       // piscada: não conta como distração
            if (estavaPausado) dispararTimerRegressivo();
            return;
        }
        registrarDistracao(seg);
        atualizarPomodoroHoje();
        if (filtroAtual === 'estatisticas') renderizarFocoStats();

        if (!estavaPausado) {
            mostrarToast(`Distração registrada: ${formatarDuracao(seg)} fora do foco.`, 'erro');
            return;
        }
        if (!dialogo.classList.contains('oculto')) {
            mostrarToast(`Ciclo pausado: você ficou ${formatarDuracao(seg)} fora do foco.`, 'erro');
            return;
        }
        const retomar = await confirmar({
            titulo: 'Você saiu do foco',
            texto: `Você ficou ${formatarDuracao(seg)} fora e o ciclo foi pausado. A distração foi registrada no seu Progresso.`,
            rotuloConfirmar: 'Retomar foco',
            rotuloCancelar: 'Continuar pausado'
        });
        if (retomar) dispararTimerRegressivo();
    }

    function avaliarPresenca() {
        clearTimeout(timerSaida);
        if (foraDesde !== null) {
            if (!ausenteAgora()) aoVoltar();
            return;
        }
        if (!focoRodando() || !ausenteAgora()) return;
        if (document.hidden) { aoSair(Date.now()); return; }
        // janela perdeu o foco (outro app): confirma depois de alguns segundos
        timerSaida = setTimeout(() => {
            if (foraDesde === null && focoRodando() && ausenteAgora()) aoSair(saiuDaJanelaEm || Date.now());
        }, 4000);
    }

    document.addEventListener('visibilitychange', () => {
        avaliarPresenca();
        if (!document.hidden && modoFocoAberto) pedirWakeLock();
    });
    window.addEventListener('blur', () => { saiuDaJanelaEm = Date.now(); avaliarPresenca(); });
    window.addEventListener('focus', () => { saiuDaJanelaEm = null; avaliarPresenca(); });

    // --- modo foco em tela cheia ---
    const modoFocoEl = $('modoFoco');
    const mfSvg = pomodoroBoxCard.querySelector('.pomodoro-anel svg').cloneNode(true);
    mfSvg.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    $('mfAnel').prepend(mfSvg);
    const mfProgresso = mfSvg.querySelector('.anel-progresso');
    const mfKnob = mfSvg.querySelector('.anel-knob');
    const mfMarcas = mfSvg.querySelectorAll('.anel-marcas line');
    const mfPontos = document.querySelectorAll('#mfPontos span');
    let modoFocoAberto = false;
    let mfLigadas = -1;
    let wakeLock = null;

    async function pedirWakeLock() {
        try {
            if ('wakeLock' in navigator && !wakeLock) {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLock.addEventListener('release', () => { wakeLock = null; });
            }
        } catch { wakeLock = null; }
    }
    function liberarWakeLock() {
        if (wakeLock) wakeLock.release().catch(() => {});
        wakeLock = null;
    }

    // Em tela cheia só o próprio elemento aparece: diálogos e avisos precisam morar dentro dele
    function moverCamadas(paraOverlay) {
        const alvo = paraOverlay ? modoFocoEl : document.body;
        [dialogo, $('toasts'), $('confete')].forEach((el) => alvo.appendChild(el));
    }

    function atualizarOverlay() {
        if (!modoFocoAberto) return;
        const fase = FASES[modoAtual];
        modoFocoEl.classList.remove('estado-foco', 'estado-pausa-curta', 'estado-pausa-longa');
        modoFocoEl.classList.add(fase.classe);
        modoFocoEl.classList.toggle('rodando', pomodoroRodando);
        $('mfFase').textContent = fase.nome;
        $('mfTempo').textContent = pomodoroTimerDOM.textContent;
        $('mfProximo').textContent = textoProximaFase();

        const fracao = tempoTotalCiclo > 0 ? Math.min(1, tempoRestante / tempoTotalCiclo) : 1;
        mfProgresso.style.strokeDashoffset = CIRCUNFERENCIA_ANEL * (1 - fracao);
        mfKnob.style.transform = `rotate(${fracao * 360}deg)`;
        const ligadas = Math.ceil(fracao * 60);
        if (ligadas !== mfLigadas) {
            mfLigadas = ligadas;
            mfMarcas.forEach((m, i) => m.classList.toggle('on', i < ligadas));
        }
        const preenchidos = ciclosPreenchidos();
        mfPontos.forEach((p, i) => p.classList.toggle('feito', i < preenchidos));
        $('mfToggle').textContent = pomodoroRodando ? 'Pausar' : (tempoRestante < tempoTotalCiclo ? 'Retomar' : 'Iniciar');
    }

    async function abrirModoFoco() {
        if (modoFocoAberto) return;
        modoFocoAberto = true;
        mfLigadas = -1;
        const origem = document.activeElement && document.activeElement !== document.body ? document.activeElement : $('btnTelaCheia');
        await transicaoIris(origem, () => {
            modoFocoEl.classList.remove('oculto');
            document.body.classList.add('sem-rolagem');
            moverCamadas(true);
            atualizarOverlay();
            atualizarStatusBloqueio();
            atualizarPomodoroHoje();
        });
        if (!modoFocoAberto) return;
        try {
            if (modoFocoEl.requestFullscreen && !document.fullscreenElement) await modoFocoEl.requestFullscreen();
        } catch { /* sem tela cheia nativa: o painel já cobre a janela */ }
        pedirWakeLock();
        $('mfToggle').focus();
    }

    function fecharModoFoco() {
        if (!modoFocoAberto) return;
        modoFocoAberto = false;
        modoFocoEl.classList.add('oculto');
        document.body.classList.remove('sem-rolagem');
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        liberarWakeLock();
        moverCamadas(false);
    }

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && modoFocoAberto) fecharModoFoco();
    });

    $('btnTelaCheia').addEventListener('click', abrirModoFoco);
    $('mfSair').addEventListener('click', fecharModoFoco);
    $('mfToggle').addEventListener('click', alternarCronometro);
    $('mfParar').addEventListener('click', () => $('btnPomodoroParar').click());

    // --- atalhos de teclado ---
    document.addEventListener('keydown', (e) => {
        if (!usuarioAtual || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Escape') {
            if (!modalBloqueio.classList.contains('oculto')) fecharAjudaBloqueio();
            else if (modoFocoAberto && dialogo.classList.contains('oculto')) fecharModoFoco();
            return;
        }
        const alvo = e.target;
        if (alvo && alvo.closest('input, textarea, select, [contenteditable]')) return;
        const interativo = alvo && alvo.closest('button, a, summary, [tabindex]');
        const bloqueado = [dialogo, modal, modalBloqueio].some((el) => !el.classList.contains('oculto'));
        if (bloqueado || !(modoFocoAberto || filtroAtual === 'pomodoro')) return;

        if (e.code === 'Space') {
            if (interativo) return;           // botões já reagem ao Espaço sozinhos
            e.preventDefault();
            alternarCronometro();
        } else if (e.key === 'f' || e.key === 'F') {
            modoFocoAberto ? fecharModoFoco() : abrirModoFoco();
        }
    });


    // ======================================================================
    // FOCAR EM UMA TAREFA, SOM, FAVICON, PALETA DE COMANDOS E TAREFA RÁPIDA
    // ======================================================================
    window.focarNaTarefa = function (idTarefa) {
        const tarefa = tarefasDB.find((t) => t.id === idTarefa);
        if (!tarefa || tarefa.concluida) return;
        if (tarefaEmFoco === idTarefa) {
            tarefaEmFoco = null;
            atualizarTarefaEmFocoUI();
            salvarEstadoPomodoro();
            renderizarTarefas();
            mostrarToast('Tarefa removida do foco.');
            return;
        }
        tarefaEmFoco = idTarefa;
        atualizarTarefaEmFocoUI();
        salvarEstadoPomodoro();
        renderizarTarefas();
        selecionarFiltro(document.querySelector('#menuFiltros li[data-filtro="pomodoro"]'));
        mostrarToast(`Foco definido: ${tarefa.titulo}`);
    };

    let ultimoTextoTarefaFoco = null;
    function atualizarTarefaEmFocoUI() {
        let tarefa = null;
        if (tarefaEmFoco != null) {
            tarefa = tarefasDB.find((t) => t.id === tarefaEmFoco && !t.concluida) || null;
            if (!tarefa) { tarefaEmFoco = null; salvarEstadoPomodoro(); }
        }
        const texto = tarefa ? tarefa.titulo : '';
        if (texto === ultimoTextoTarefaFoco) return;
        ultimoTextoTarefaFoco = texto;
        $('pomodoroTarefa').classList.toggle('oculto', !tarefa);
        $('pomodoroTarefaNome').textContent = texto;
        $('mfTarefa').classList.toggle('oculto', !tarefa);
        $('mfTarefa').textContent = tarefa ? `Focando em: ${texto}` : '';
    }
    $('btnLimparTarefa').addEventListener('click', () => { if (tarefaEmFoco != null) focarNaTarefa(tarefaEmFoco); });

    // --- sino sintetizado ao terminar o ciclo ---
    let contextoAudio = null;
    function prepararAudio() {
        try {
            contextoAudio = contextoAudio || new (window.AudioContext || window.webkitAudioContext)();
            if (contextoAudio.state === 'suspended') contextoAudio.resume();
        } catch { contextoAudio = null; }
    }
    function tocarSino() {
        if (!prefs.som || !contextoAudio) return;
        try {
            const t0 = contextoAudio.currentTime;
            [[784, 0], [1175, 0.2], [1568, 0.4]].forEach(([freq, atraso]) => {
                const osc = contextoAudio.createOscillator();
                const ganho = contextoAudio.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                ganho.gain.setValueAtTime(0.0001, t0 + atraso);
                ganho.gain.exponentialRampToValueAtTime(0.16, t0 + atraso + 0.03);
                ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + atraso + 1.3);
                osc.connect(ganho).connect(contextoAudio.destination);
                osc.start(t0 + atraso);
                osc.stop(t0 + atraso + 1.4);
            });
        } catch { /* sem áudio disponível */ }
    }

    // --- o ícone da aba vira um anel de progresso enquanto o foco roda ---
    const linkFavicon = document.querySelector('link[rel="icon"]');
    const FAVICON_ORIGINAL = { href: linkFavicon.href, type: linkFavicon.type };
    let ultimoSegundoFavicon = -1;
    function atualizarFavicon() {
        if (!pomodoroRodando) {
            if (ultimoSegundoFavicon !== -1) {
                linkFavicon.type = FAVICON_ORIGINAL.type;
                linkFavicon.href = FAVICON_ORIGINAL.href;
                ultimoSegundoFavicon = -1;
            }
            return;
        }
        if (ultimoSegundoFavicon === tempoRestante) return;
        ultimoSegundoFavicon = tempoRestante;
        const tela = document.createElement('canvas');
        tela.width = tela.height = 64;
        const g = tela.getContext('2d');
        const cores = { 'foco': '#7fd3f0', 'pausa-curta': '#4be0b0', 'pausa-longa': '#a79bff' };
        const fracao = tempoTotalCiclo > 0 ? Math.min(1, tempoRestante / tempoTotalCiclo) : 1;
        g.fillStyle = '#0c5c7e';
        g.beginPath();
        g.roundRect(0, 0, 64, 64, 16);
        g.fill();
        g.lineWidth = 9;
        g.strokeStyle = 'rgba(255,255,255,0.2)';
        g.beginPath();
        g.arc(32, 32, 20, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = cores[modoAtual];
        g.lineCap = 'round';
        g.beginPath();
        g.arc(32, 32, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fracao);
        g.stroke();
        linkFavicon.type = 'image/png';
        linkFavicon.href = tela.toDataURL('image/png');
    }

    // --- brilho que acompanha o cursor nos cartões ---
    if (window.matchMedia('(hover: hover)').matches) {
        const ALVOS_BRILHO = '.task-item, .stat-tile, .ranking-card, .foco-card, .streak-card, .pomodoro-box, .foco-tiles div';
        document.addEventListener('pointermove', (e) => {
            const alvo = e.target.closest && e.target.closest(ALVOS_BRILHO);
            if (!alvo) return;
            const r = alvo.getBoundingClientRect();
            alvo.style.setProperty('--mx', `${e.clientX - r.left}px`);
            alvo.style.setProperty('--my', `${e.clientY - r.top}px`);
        }, { passive: true });
    }

    // --- tarefa rápida em linguagem natural ("estudar BD amanhã 18h !alta") ---
    const semAcento = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const dataISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const DIAS_SEMANA = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

    function interpretarTarefaRapida(entrada) {
        let orig = entrada.normalize('NFC');
        const res = { titulo: '', prioridade: 'media', data: '', horario: '', achou: { prioridade: false, data: false, horario: false } };
        const hoje = new Date();
        const base0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

        // corta do texto o trecho que casou (compara sem acento ou com acento, conforme "modo")
        const tirar = (re, modo = 'norm') => {
            const alvo = modo === 'norm' ? semAcento(orig).toLowerCase() : orig.toLowerCase();
            const m = re.exec(alvo);
            if (!m) return null;
            const ini = m.index + (m[1] ? m[1].length : 0);
            const fim = m.index + m[0].length;
            orig = `${orig.slice(0, ini)} ${orig.slice(fim)}`;
            return m;
        };
        const somarDias = (n) => { const d = new Date(base0); d.setDate(d.getDate() + n); return d; };
        let m;

        // prioridade: !alta, !media, !baixa  |  prioridade alta
        if ((m = tirar(/(^|\s)!(alta|media|baixa)(?=\s|$)/)) || (m = tirar(/(^|\s)prioridade\s+(alta|media|baixa)(?=\s|$)/))) {
            res.prioridade = m[2];
            res.achou.prioridade = true;
        }

        // horário: 18h, 18h30, 18:30, às 9, meio-dia
        if ((m = tirar(/(^|\s)(\d{1,2})h(\d{2})?(?=\s|$|[.,;])/)) || (m = tirar(/(^|\s)(\d{1,2}):(\d{2})(?=\s|$|[.,;])/))
            || (m = tirar(/(^|\s)às\s+(\d{1,2})(?:h|:)?(\d{2})?(?=\s|$|[.,;])/, 'acento'))) {
            const h = parseInt(m[2], 10);
            const mi = m[3] ? parseInt(m[3], 10) : 0;
            if (h <= 23 && mi <= 59) {
                res.horario = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
                res.achou.horario = true;
            }
        } else if ((m = tirar(/(^|\s)meio[- ]dia(?=\s|$|[.,;])/))) {
            res.horario = '12:00';
            res.achou.horario = true;
        }

        // data: hoje, amanhã, depois de amanhã, dias da semana, 25/10, dia 25
        let data = null;
        if (tirar(/(^|\s)depois\s+de\s+amanha(?=\s|$|[.,;])/)) data = somarDias(2);
        else if (tirar(/(^|\s)amanha(?=\s|$|[.,;])/)) data = somarDias(1);
        else if (tirar(/(^|\s)hoje(?=\s|$|[.,;])/)) data = somarDias(0);
        else if ((m = tirar(/(^|\s)(?:(?:na|no|nesta|neste|proxima|proximo)\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira)?(?=\s|$|[.,;])/))) {
            let delta = (DIAS_SEMANA[m[2]] - base0.getDay() + 7) % 7;
            if (delta === 0) delta = 7;
            data = somarDias(delta);
        } else if ((m = tirar(/(^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s|$|[.,;])/))) {
            const dia = parseInt(m[2], 10);
            const mes = parseInt(m[3], 10) - 1;
            let ano = m[4] ? parseInt(m[4], 10) : base0.getFullYear();
            if (ano < 100) ano += 2000;
            let d = new Date(ano, mes, dia);
            if (!m[4] && d < base0) d = new Date(ano + 1, mes, dia);
            if (d.getDate() === dia && d.getMonth() === mes) data = d;
        } else if ((m = tirar(/(^|\s)dia\s+(\d{1,2})(?=\s|$|[.,;])/))) {
            const dia = parseInt(m[2], 10);
            let d = new Date(base0.getFullYear(), base0.getMonth(), dia);
            if (d < base0) d = new Date(base0.getFullYear(), base0.getMonth() + 1, dia);
            if (d.getDate() === dia) data = d;
        }
        if (data) { res.data = dataISO(data); res.achou.data = true; }

        // título: sem preposições soltas no fim
        let titulo = orig.replace(/\s+/g, ' ').trim();
        let anterior;
        do {
            anterior = titulo;
            titulo = titulo.replace(/\s+(de|do|da|para|pra|ate|até|as|às|no|na|em|dia|ao|e|,)$/i, '').trim();
        } while (titulo !== anterior);
        titulo = titulo.replace(/[,;.\s]+$/, '');
        res.titulo = titulo ? titulo.charAt(0).toUpperCase() + titulo.slice(1) : '';
        return res;
    }

    const quickInput = $('quickAddInput');
    const quickPrevia = $('quickPrevia');

    function desenharPreviaRapida() {
        const texto = quickInput.value.trim();
        if (!texto) { quickPrevia.innerHTML = ''; return; }
        const r = interpretarTarefaRapida(texto);
        const prazo = r.data ? infoPrazo({ data: r.data, horario: r.horario, concluida: false }) : null;
        quickPrevia.innerHTML = `
            <span class="qp-titulo">${r.titulo ? esc(r.titulo) : 'Escreva o título…'}</span>
            <span class="chip chip-prio prio-${r.prioridade}">${ROTULO_PRIORIDADE[r.prioridade]}</span>
            ${prazo ? `<span class="chip ${prazo.classe}">${ICONES.calendario}${prazo.texto}</span>` : ''}
            ${!prazo && r.horario ? `<span class="chip">${ICONES.relogio}${r.horario}</span>` : ''}
            <span class="qp-dica">· Enter para criar</span>`;
    }

    quickInput.addEventListener('input', desenharPreviaRapida);
    quickInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { quickInput.value = ''; desenharPreviaRapida(); quickInput.blur(); }
    });
    $('quickAdd').addEventListener('submit', (e) => {
        e.preventDefault();
        const r = interpretarTarefaRapida(quickInput.value);
        if (!r.titulo) { mostrarToast('Escreva o título da tarefa.', 'erro'); return; }
        tarefasDB.push({
            id: Date.now(), titulo: r.titulo, descricao: '', data: r.data, horario: r.horario,
            prioridade: r.prioridade, subtarefas: [], concluida: false
        });
        salvarTarefasNoLocalStorage();
        renderizarTarefas();
        quickInput.value = '';
        desenharPreviaRapida();
        const quando = r.data ? ` para ${infoPrazo({ data: r.data, horario: r.horario, concluida: false }).texto.toLowerCase()}` : '';
        mostrarToast(`Tarefa criada${quando}.`);
    });

    // --- paleta de comandos (Ctrl/⌘ + K) ---
    const paletaEl = $('paleta');
    const paletaInput = $('paletaInput');
    const paletaLista = $('paletaLista');
    let paletaItens = [];
    let paletaAtivo = 0;
    const ehMac = /Mac|iPhone|iPad/.test(navigator.platform);
    $('atalhoPaleta').textContent = ehMac ? '⌘ K' : 'Ctrl K';

    function irParaSecao(filtro) {
        selecionarFiltro(document.querySelector(`#menuFiltros li[data-filtro="${filtro}"]`));
    }

    function montarComandos() {
        const cmds = [
            { titulo: 'Nova tarefa', grupo: 'Criar', icone: ICONES.mais, acao: abrirNovaTarefa },
            { titulo: 'Todas as tarefas', grupo: 'Ir para', icone: ICONES.lista, acao: () => irParaSecao('todas') },
            { titulo: 'Tarefas pendentes', grupo: 'Ir para', icone: ICONES.relogio, acao: () => irParaSecao('pendentes') },
            { titulo: 'Tarefas concluídas', grupo: 'Ir para', icone: ICONES.tique, acao: () => irParaSecao('concluidas') },
            { titulo: 'Pomodoro', grupo: 'Ir para', icone: ICONES.alvo, acao: () => irParaSecao('pomodoro') },
            { titulo: 'Progresso & Streak', grupo: 'Ir para', icone: ICONES.lista, acao: () => irParaSecao('estatisticas') },
            { titulo: pomodoroRodando ? 'Pausar o foco' : 'Iniciar o foco', grupo: 'Pomodoro', icone: ICONES.alvo, acao: alternarCronometro },
            { titulo: 'Abrir o modo foco em tela cheia', grupo: 'Pomodoro', icone: ICONES.alvo, acao: abrirModoFoco },
            { titulo: 'Reiniciar o ciclo atual', grupo: 'Pomodoro', icone: ICONES.relogio, acao: () => $('btnPomodoroParar').click() },
            { titulo: document.body.classList.contains('modo-noturno') ? 'Mudar para o tema claro' : 'Mudar para o tema noturno', grupo: 'Aparência', icone: ICONES.lua, acao: () => btnModoNoturno.click() },
            { titulo: 'Como ativar o bloqueio de redes sociais', grupo: 'Ajuda', icone: ICONES.alvo, acao: abrirAjudaBloqueio },
            { titulo: 'Minha conta', grupo: 'Conta', icone: ICONES.editar, acao: () => abrirPerfil('geral') },
            { titulo: 'Alterar senha', grupo: 'Conta', icone: ICONES.editar, acao: () => abrirPerfil('seguranca') },
            { titulo: 'Baixar meus dados', grupo: 'Conta', icone: ICONES.editar, acao: exportarDados },
            { titulo: 'Sair da conta', grupo: 'Conta', icone: ICONES.x, acao: () => $('btnSair').click() }
        ];
        tarefasDB.forEach((t) => {
            cmds.push({ titulo: t.titulo, grupo: t.concluida ? 'Tarefa concluída' : 'Editar tarefa', icone: ICONES.editar, acao: () => abrirEdicaoTarefa(t.id) });
            if (!t.concluida) cmds.push({ titulo: `Focar em: ${t.titulo}`, grupo: 'Focar', icone: ICONES.alvo, acao: () => focarNaTarefa(t.id) });
        });
        return cmds;
    }

    function pontuarComando(titulo, consulta) {
        if (!consulta) return 1;
        const t = semAcento(titulo).toLowerCase();
        if (t === consulta) return 100;
        if (t.startsWith(consulta)) return 80;
        const i = t.indexOf(consulta);
        if (i >= 0) return 60 - Math.min(i, 30) / 2;
        let j = 0;
        for (const c of t) { if (c === consulta[j]) j++; if (j === consulta.length) return 20; }
        return 0;
    }

    function desenharPaleta() {
        const consulta = semAcento(paletaInput.value).toLowerCase().trim();
        paletaItens = montarComandos()
            .map((c, i) => ({ ...c, ordem: i, nota: pontuarComando(c.titulo, consulta) }))
            .filter((c) => c.nota > 0)
            .sort((a, b) => b.nota - a.nota || a.ordem - b.ordem)
            .slice(0, 9);
        paletaAtivo = Math.min(paletaAtivo, Math.max(0, paletaItens.length - 1));
        paletaLista.innerHTML = paletaItens.length
            ? paletaItens.map((c, i) => `<li role="option" data-i="${i}" class="${i === paletaAtivo ? 'ativo' : ''}" aria-selected="${i === paletaAtivo}">
                    <span class="pi">${c.icone}</span><span class="pt">${esc(c.titulo)}</span><span class="pg">${c.grupo}</span></li>`).join('')
            : '<li class="paleta-vazio">Nada encontrado. Tente outra palavra.</li>';
    }

    function abrirPaleta() {
        if (!usuarioAtual || modoFocoAberto) return;
        paletaEl.classList.remove('oculto');
        paletaInput.value = '';
        paletaAtivo = 0;
        desenharPaleta();
        paletaInput.focus();
    }
    function fecharPaleta() { paletaEl.classList.add('oculto'); }
    function executarPaleta(i) {
        const item = paletaItens[i];
        if (!item) return;
        fecharPaleta();
        setTimeout(item.acao, 60);
    }

    $('btnPaleta').addEventListener('click', () => { fecharMenuMobile(); abrirPaleta(); });
    paletaInput.addEventListener('input', () => { paletaAtivo = 0; desenharPaleta(); });
    paletaEl.addEventListener('mousedown', (e) => { if (e.target === paletaEl) fecharPaleta(); });
    paletaLista.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-i]');
        if (li) executarPaleta(Number(li.dataset.i));
    });
    paletaLista.addEventListener('mousemove', (e) => {
        const li = e.target.closest('li[data-i]');
        if (li && Number(li.dataset.i) !== paletaAtivo) {
            paletaAtivo = Number(li.dataset.i);
            paletaLista.querySelectorAll('li').forEach((el, i) => el.classList.toggle('ativo', i === paletaAtivo));
        }
    });
    paletaEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); fecharPaleta(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!paletaItens.length) return;
            paletaAtivo = (paletaAtivo + (e.key === 'ArrowDown' ? 1 : -1) + paletaItens.length) % paletaItens.length;
            paletaLista.querySelectorAll('li').forEach((el, i) => el.classList.toggle('ativo', i === paletaAtivo));
            const ativo = paletaLista.querySelector('li.ativo');
            if (ativo) ativo.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            executarPaleta(paletaAtivo);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!usuarioAtual) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (paletaEl.classList.contains('oculto')) abrirPaleta(); else fecharPaleta();
            return;
        }
        // "/" leva direto à tarefa rápida
        if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !$('quickAdd').classList.contains('oculto')) {
            const alvo = e.target;
            if (alvo && alvo.closest('input, textarea, select, [contenteditable]')) return;
            const bloqueado = [dialogo, modal, modalBloqueio, paletaEl].some((el) => !el.classList.contains('oculto'));
            if (bloqueado) return;
            e.preventDefault();
            quickInput.focus();
        }
    });

    // ======================================================================
    // CENTRAL DE PERFIL (Minha conta)
    // Os dados vivem em localStorage (único "banco" deste projeto): não há servidor.
    // ======================================================================
    const ABAS_PERFIL = ['geral', 'dados', 'seguranca', 'preferencias', 'privacidade'];
    const CORES_AVATAR = ['#3695BD', '#0c5c7e', '#8e5bd0', '#00a37f', '#e0701a', '#d6457a'];
    const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    let secaoAnterior = 'todas';
    let avatarPendente = { acao: 'manter', dataUrl: null, cor: null };

    // sempre lê o usuário atualizado direto do armazenamento
    function usuarioFresco() {
        return lerUsuarios().find((u) => u.id === usuarioAtual.id) || usuarioAtual;
    }

    function salvarUsuarioAtual(parcial) {
        const lista = lerUsuarios();
        const i = lista.findIndex((u) => u.id === usuarioAtual.id);
        if (i < 0) throw new Error('usuario-inexistente');
        const atualizado = { ...lista[i], ...parcial, atualizadoEm: Date.now() };
        lista[i] = atualizado;
        salvarUsuarios(lista);                 // pode lançar QuotaExceededError
        usuarioAtual = atualizado;
        pintarIdentidade(atualizado);
        desenharCabecalhoPerfil();
    }

    const formatarData = (ts, comHora = false) => new Date(ts).toLocaleDateString('pt-BR',
        comHora ? { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'long', year: 'numeric' });

    // --- avatar e identidade em toda a interface ---
    function pintarAvatar(el, u) {
        const inicial = (u.nome || '?').trim().charAt(0).toUpperCase();
        el.classList.toggle('com-foto', !!u.avatar);
        el.style.backgroundImage = u.avatar ? `url("${u.avatar}")` : '';
        el.style.backgroundColor = !u.avatar && u.avatarCor ? u.avatarCor : '';
        el.textContent = u.avatar ? '' : inicial;
    }

    function pintarIdentidade(u) {
        const primeiroNome = u.nome.split(' ')[0];
        pintarAvatar($('avatarUsuario'), u);
        pintarAvatar($('btnPerfilMobile'), u);
        $('nomeUsuario').textContent = u.nome;
        $('usuarioArroba').textContent = `@${u.usuario}`;
        const data = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
        $('saudacao').textContent = `${saudacaoPorHora()}, ${primeiroNome} · ${data}`;
    }

    // --- rota (#/perfil, #/perfil/seguranca...) ---
    function rotaPerfil() {
        const m = /^#\/perfil(?:\/([a-z]+))?$/.exec(location.hash);
        if (!m) return null;
        return ABAS_PERFIL.includes(m[1]) ? m[1] : 'geral';
    }

    function abrirPerfil(aba = 'geral', { historico = true } = {}) {
        if (!usuarioAtual) return;
        if (modoFocoAberto) fecharModoFoco();
        if (filtroAtual !== 'perfil') secaoAnterior = filtroAtual;
        filtroAtual = 'perfil';
        menuFiltros.forEach((li) => li.classList.remove('ativo'));
        $('btnPerfil').classList.add('ativo');
        tituloFiltroAtual.textContent = 'Minha conta';
        fecharMenuMobile();
        [listaTarefasDOM, containerPomodoro, containerEstatisticas, btnNovaTarefa, ordenacaoTarefas,
            barraProgressoDiaria, $('quickAdd'), $('resumoHoje')].forEach((el) => el.classList.add('oculto'));
        containerPerfil.classList.remove('oculto');
        desenharCabecalhoPerfil();
        mostrarAbaPerfil(aba);
        const hashAba = `#/perfil${aba === 'geral' ? '' : `/${aba}`}`;
        if (historico) history.pushState(null, '', hashAba);
        else if (location.hash !== hashAba) history.replaceState(null, '', hashAba);   // mantém o endereço certo ao recarregar
        animarEntrada(containerPerfil);
        const rolagem = document.querySelector('.main-content');
        if (rolagem) rolagem.scrollTo(0, 0);
        window.scrollTo(0, 0);
    }

    function voltarAoPainel() {
        const alvo = document.querySelector(`#menuFiltros li[data-filtro="${secaoAnterior}"]`) || menuFiltros[0];
        selecionarFiltro(alvo);
    }

    window.addEventListener('hashchange', () => {
        if (!usuarioAtual) return;
        const aba = rotaPerfil();
        if (aba) abrirPerfil(aba, { historico: false });
        else if (filtroAtual === 'perfil') voltarAoPainel();
    });

    $('btnPerfil').addEventListener('click', () => abrirPerfil('geral'));
    $('btnPerfilMobile').addEventListener('click', () => abrirPerfil('geral'));
    $('perfilVoltar').addEventListener('click', voltarAoPainel);
    $('perfilAvatarBtn').addEventListener('click', () => { abrirPerfil('dados'); $('perfArquivo').click(); });
    document.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => abrirPerfil(b.dataset.ir)));

    // --- abas ---
    function mostrarAbaPerfil(aba) {
        document.querySelectorAll('.perfil-aba').forEach((b) => {
            const ativa = b.dataset.aba === aba;
            b.classList.toggle('ativo', ativa);
            b.setAttribute('aria-selected', String(ativa));
            b.tabIndex = ativa ? 0 : -1;
        });
        document.querySelectorAll('.perfil-painel').forEach((p) => p.classList.toggle('oculto', p.dataset.aba !== aba));
        if (aba === 'geral') desenharVisaoGeral();
        else if (aba === 'dados') preencherFormDados();
        else if (aba === 'seguranca') desenharSeguranca();
        else if (aba === 'preferencias') desenharPreferencias();
        else if (aba === 'privacidade') desenharPrivacidade();
    }

    document.querySelectorAll('.perfil-aba').forEach((b) => {
        b.addEventListener('click', () => abrirPerfil(b.dataset.aba));
        b.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const i = ABAS_PERFIL.indexOf(b.dataset.aba);
            const prox = ABAS_PERFIL[(i + (e.key === 'ArrowRight' ? 1 : -1) + ABAS_PERFIL.length) % ABAS_PERFIL.length];
            abrirPerfil(prox);
            $(`tab-${prox}`).focus();
        });
    });

    // --- cabeçalho e visão geral ---
    function desenharCabecalhoPerfil() {
        if (!usuarioAtual) return;
        const u = usuarioFresco();
        pintarAvatar($('perfilAvatar'), u);
        $('perfilNome').textContent = u.nome;
        $('perfilEmailCab').textContent = u.email;
        $('perfilMembro').textContent = u.criadoEm ? `Membro desde ${formatarData(u.criadoEm)}` : '';
    }

    const linhaDl = (rotulo, valor, vazio = 'Não informado') =>
        `<div><dt>${rotulo}</dt><dd class="${valor ? '' : 'vazio-valor'}">${valor ? esc(valor) : vazio}</dd></div>`;

    function desenharVisaoGeral() {
        const u = usuarioFresco();
        $('perfilResumo').innerHTML = [
            linhaDl('Nome completo', u.nome),
            linhaDl('Nome de usuário', `@${u.usuario}`),
            linhaDl('E-mail', u.email),
            linhaDl('Telefone', u.telefone),
            linhaDl('Conta criada em', u.criadoEm ? formatarData(u.criadoEm) : ''),
            linhaDl('Última atualização do perfil', u.atualizadoEm ? formatarData(u.atualizadoEm, true) : '', 'Ainda sem alterações')
        ].join('');
        const feitas = tarefasDB.filter((t) => t.concluida).length;
        const focoTotal = lerLista(chaveFoco()).reduce((a, x) => a + x.min, 0);
        $('perfilNumeros').innerHTML = `
            <div class="stat-tile"><strong>${tarefasDB.length}</strong><span>Tarefas criadas</span></div>
            <div class="stat-tile"><strong>${feitas}</strong><span>Tarefas concluídas</span></div>
            <div class="stat-tile"><strong>${focoTotal >= 60 ? `${Math.floor(focoTotal / 60)} h ${focoTotal % 60} min` : `${focoTotal} min`}</strong><span>Tempo total de foco</span></div>`;
    }

    // --- dados pessoais ---
    function mascararTelefone(v) {
        const d = v.replace(/\D/g, '').slice(0, 11);
        if (d.length === 0) return '';
        if (d.length <= 2) return `(${d}`;
        if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
        if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
        return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    function telefoneValido(v) {
        if (!v) return true;                                   // campo opcional
        const d = v.replace(/\D/g, '');
        return (d.length === 10 || (d.length === 11 && d[2] === '9')) && Number(d.slice(0, 2)) >= 11;
    }

    const valoresDados = () => ({
        nome: $('perfNome').value.trim(),
        usuario: $('perfUsuario').value.trim().toLowerCase(),
        email: $('perfEmail').value.trim().toLowerCase(),
        telefone: mascararTelefone($('perfTelefone').value)
    });

    function mudancasDados() {
        const u = usuarioFresco();
        const v = valoresDados();
        return {
            nome: v.nome !== u.nome,
            usuario: v.usuario !== u.usuario,
            email: v.email !== u.email,
            telefone: v.telefone !== (u.telefone || ''),
            avatar: avatarPendente.acao !== 'manter' || (!!avatarPendente.cor && avatarPendente.cor !== u.avatarCor)
        };
    }

    function atualizarEstadoFormDados() {
        const m = mudancasDados();
        const sujo = Object.values(m).some(Boolean);
        $('perfSalvar').disabled = !sujo;
        $('perfDescartar').disabled = !sujo;
        $('perfSenhaGrupo').classList.toggle('oculto', !(m.email || m.usuario));
        pintarPreviaAvatar();
    }

    function pintarPreviaAvatar() {
        const u = usuarioFresco();
        const temp = {
            ...u,
            nome: valoresDados().nome || u.nome,
            avatar: avatarPendente.acao === 'novo' ? avatarPendente.dataUrl : (avatarPendente.acao === 'remover' ? null : u.avatar),
            avatarCor: avatarPendente.cor || u.avatarCor
        };
        pintarAvatar($('perfAvatarPrev'), temp);
        $('perfCores').innerHTML = temp.avatar ? '' : CORES_AVATAR.map((cor) =>
            `<button type="button" style="--c:${cor}" data-cor="${cor}" aria-label="Usar a cor ${cor}" aria-pressed="${(temp.avatarCor || CORES_AVATAR[0]) === cor}"></button>`).join('');
        $('perfRemoverFoto').disabled = !temp.avatar;
    }

    function preencherFormDados() {
        const u = usuarioFresco();
        $('perfNome').value = u.nome;
        $('perfUsuario').value = u.usuario;
        $('perfEmail').value = u.email;
        $('perfTelefone').value = u.telefone || '';
        $('perfSenhaConfirma').value = '';
        avatarPendente = { acao: 'manter', dataUrl: null, cor: null };
        ['perfNome', 'perfUsuario', 'perfEmail', 'perfTelefone', 'perfSenhaConfirma'].forEach((id) => erroCampo(id, ''));
        $('perfFormErro').textContent = '';
        $('perfFotoErro').textContent = '';
        atualizarEstadoFormDados();
    }

    ['perfNome', 'perfUsuario', 'perfEmail', 'perfTelefone', 'perfSenhaConfirma'].forEach((id) => {
        $(id).addEventListener('input', () => {
            if (id === 'perfTelefone') $(id).value = mascararTelefone($(id).value);
            erroCampo(id, '');
            $('perfFormErro').textContent = '';
            atualizarEstadoFormDados();
        });
    });

    $('perfDescartar').addEventListener('click', preencherFormDados);
    $('perfEnviarFoto').addEventListener('click', () => $('perfArquivo').click());
    $('perfRemoverFoto').addEventListener('click', () => {
        avatarPendente = { ...avatarPendente, acao: 'remover', dataUrl: null };
        atualizarEstadoFormDados();
    });
    $('perfCores').addEventListener('click', (e) => {
        const b = e.target.closest('[data-cor]');
        if (!b) return;
        avatarPendente.cor = b.dataset.cor;
        atualizarEstadoFormDados();
    });

    function reduzirImagem(arquivo, lado) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(arquivo);
            const img = new Image();
            img.onload = () => {
                const menor = Math.min(img.width, img.height);
                const tela = document.createElement('canvas');
                tela.width = tela.height = lado;
                tela.getContext('2d').drawImage(img, (img.width - menor) / 2, (img.height - menor) / 2, menor, menor, 0, 0, lado, lado);
                URL.revokeObjectURL(url);
                resolve(tela.toDataURL('image/jpeg', 0.86));
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem-invalida')); };
            img.src = url;
        });
    }

    $('perfArquivo').addEventListener('change', async (e) => {
        const arquivo = e.target.files[0];
        e.target.value = '';
        const erroFoto = $('perfFotoErro');
        erroFoto.textContent = '';
        if (!arquivo) return;
        if (!/^image\/(png|jpe?g|webp|gif)$/.test(arquivo.type)) { erroFoto.textContent = 'Escolha uma imagem PNG, JPG, WEBP ou GIF.'; return; }
        if (arquivo.size > 8 * 1024 * 1024) { erroFoto.textContent = 'A imagem é grande demais (máximo de 8 MB).'; return; }
        try {
            avatarPendente = { ...avatarPendente, acao: 'novo', dataUrl: await reduzirImagem(arquivo, 256) };
            atualizarEstadoFormDados();
        } catch {
            erroFoto.textContent = 'Não foi possível ler esta imagem. Tente outro arquivo.';
        }
    });

    function definirCarregando(botao, ligado, texto) {
        botao.classList.toggle('carregando', ligado);
        botao.disabled = ligado;
        botao.querySelector('span').textContent = texto;
    }

    $('formPerfil').addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = usuarioFresco();
        const v = valoresDados();
        const m = mudancasDados();
        const lista = lerUsuarios();
        let valido = true;
        const checar = (id, msg) => { erroCampo(id, msg); if (msg) valido = false; };

        checar('perfNome', v.nome.length < 2 || v.nome.length > 60 ? 'Informe seu nome completo (de 2 a 60 caracteres).' : '');
        checar('perfUsuario',
            !/^[a-z0-9._]{3,20}$/.test(v.usuario) ? '3 a 20 caracteres: letras, números, . ou _'
            : lista.some((x) => x.id !== u.id && x.usuario === v.usuario) ? 'Este usuário já está em uso.' : '');
        checar('perfEmail',
            !REGEX_EMAIL.test(v.email) ? 'Digite um e-mail válido.'
            : lista.some((x) => x.id !== u.id && x.email === v.email) ? 'Este e-mail já está cadastrado.' : '');
        checar('perfTelefone', telefoneValido(v.telefone) ? '' : 'Digite um telefone com DDD, como (11) 91234-5678.');
        const sensivel = m.email || m.usuario;
        if (sensivel) checar('perfSenhaConfirma', $('perfSenhaConfirma').value ? '' : 'Digite a sua senha atual para confirmar.');
        if (!valido) {
            const primeiro = document.querySelector('#formPerfil .campo.invalido input');
            if (primeiro) primeiro.focus();
            return;
        }

        definirCarregando($('perfSalvar'), true, 'Salvando…');
        $('perfFormErro').textContent = '';
        try {
            if (sensivel && (await gerarHash($('perfSenhaConfirma').value, u.salt)) !== u.hash) {
                checar('perfSenhaConfirma', 'Senha incorreta.');
                $('perfSenhaConfirma').focus();
                return;
            }
            const novo = { nome: v.nome, usuario: v.usuario, email: v.email, telefone: v.telefone };
            if (avatarPendente.acao === 'novo') novo.avatar = avatarPendente.dataUrl;
            else if (avatarPendente.acao === 'remover') novo.avatar = null;
            if (avatarPendente.cor) novo.avatarCor = avatarPendente.cor;
            salvarUsuarioAtual(novo);
            mostrarToast('Perfil atualizado com sucesso.');
            preencherFormDados();
        } catch (erro) {
            $('perfFormErro').textContent = erro && erro.name === 'QuotaExceededError'
                ? 'O armazenamento do navegador está cheio. Tente uma foto menor ou libere espaço.'
                : 'Não foi possível salvar as alterações. Tente novamente.';
        } finally {
            definirCarregando($('perfSalvar'), false, 'Salvar alterações');
            atualizarEstadoFormDados();
        }
    });

    // --- segurança: senha e sessão ---
    function desenharSeguranca() {
        $('sessaoTexto').textContent = localStorage.getItem(CHAVE_SESSAO)
            ? 'Você está conectado neste aparelho e continuará conectado ao fechar o navegador (opção "Manter conectado").'
            : 'Você está conectado apenas nesta aba do navegador: ao fechá-la, será preciso entrar de novo.';
        atualizarRequisitos();
    }

    function atualizarRequisitos() {
        const atual = $('senhaAtual').value;
        const nova = $('senhaNova').value;
        const conf = $('senhaConf').value;
        const regras = {
            min: nova.length >= 6,
            dif: nova.length > 0 && nova !== atual,
            conf: nova.length > 0 && nova === conf,
            dez: nova.length >= 10,
            mm: /[a-z]/.test(nova) && /[A-Z]/.test(nova),
            num: /\d/.test(nova),
            sim: /[^a-zA-Z0-9]/.test(nova)
        };
        document.querySelectorAll('#requisitosSenha li').forEach((li) => li.classList.toggle('ok', !!regras[li.dataset.req]));
        const nivel = pontuarSenha(nova);
        $('forcaNova').dataset.nivel = nivel;
        $('forcaNovaTexto').textContent = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'][nivel];
    }

    ['senhaAtual', 'senhaNova', 'senhaConf'].forEach((id) => {
        $(id).addEventListener('input', () => { erroCampo(id, ''); $('senhaFormErro').textContent = ''; atualizarRequisitos(); });
    });

    $('formSenha').addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = usuarioFresco();
        const atual = $('senhaAtual').value;
        const nova = $('senhaNova').value;
        const conf = $('senhaConf').value;
        let valido = true;
        const checar = (id, msg) => { erroCampo(id, msg); if (msg) valido = false; };

        checar('senhaAtual', atual ? '' : 'Digite a sua senha atual.');
        checar('senhaNova', nova.length < 6 ? 'A nova senha precisa ter pelo menos 6 caracteres.' : (nova === atual ? 'A nova senha deve ser diferente da atual.' : ''));
        checar('senhaConf', conf !== nova ? 'As senhas não coincidem.' : '');
        if (!valido) { const p = document.querySelector('#formSenha .campo.invalido input'); if (p) p.focus(); return; }

        definirCarregando($('senhaSalvar'), true, 'Alterando…');
        try {
            if ((await gerarHash(atual, u.salt)) !== u.hash) {
                checar('senhaAtual', 'Senha atual incorreta.');
                $('senhaAtual').focus();
                return;
            }
            const salt = gerarSalt();
            salvarUsuarioAtual({ salt, hash: await gerarHash(nova, salt) });   // nunca em texto puro
            $('formSenha').reset();
            atualizarRequisitos();
            mostrarToast('Senha alterada com sucesso.');
        } catch {
            $('senhaFormErro').textContent = 'Não foi possível alterar a senha. Tente novamente.';
        } finally {
            definirCarregando($('senhaSalvar'), false, 'Alterar senha');
        }
    });

    $('perfSairSessao').addEventListener('click', () => $('btnSair').click());

    // --- preferências ---
    function desenharPreferencias() {
        if (!usuarioAtual) return;
        $('perfTemaClaro').checked = !document.body.classList.contains('modo-noturno');
        $('perfTemaNoturno').checked = document.body.classList.contains('modo-noturno');
        $('perfPrefSom').checked = prefs.som;
        $('perfPrefPausar').checked = prefs.pausarAoSair;
        $('perfPrefBloquear').checked = prefs.bloquearRedes;
    }

    document.querySelectorAll('input[name="perfTema"]').forEach((r) => r.addEventListener('change', () => {
        const noturno = r.value === 'noturno';
        if (noturno !== document.body.classList.contains('modo-noturno')) transicaoIris(r.labels[0], () => aplicarTema(noturno));
    }));
    // os três interruptores usam os mesmos controles e a mesma gravação do cartão do Pomodoro
    [['perfPrefSom', 'prefSom'], ['perfPrefPausar', 'prefPausarAoSair'], ['perfPrefBloquear', 'prefBloquearRedes']].forEach(([aqui, la]) => {
        $(aqui).addEventListener('change', (e) => { $(la).checked = e.target.checked; $(la).dispatchEvent(new Event('change')); });
        $(la).addEventListener('change', desenharPreferencias);
    });
    $('perfIrPomodoro').addEventListener('click', () => {
        irParaSecao('pomodoro');
        document.querySelector('.pomodoro-config').open = true;
    });

    // --- privacidade e exclusão ---
    const chavesDoUsuario = (u) => [chaveTarefas(u), `focusMePrefs:${u.id}`, `focusMeDistracoes:${u.id}`, `focusMeFoco:${u.id}`, `focusMePomodoro:${u.id}`];

    function desenharPrivacidade() {
        const u = usuarioFresco();
        const bytes = chavesDoUsuario(u).concat(['focusMeUsuarios']).reduce((a, k) => a + ((localStorage.getItem(k) || '').length * 2), 0);
        $('perfilDados').innerHTML = [
            linhaDl('Nome completo', u.nome),
            linhaDl('Nome de usuário', `@${u.usuario}`),
            linhaDl('E-mail', u.email),
            linhaDl('Telefone', u.telefone),
            linhaDl('Foto de perfil', u.avatar ? 'Enviada' : '', 'Nenhuma'),
            linhaDl('Senha', 'Guardada apenas como hash com salt'),
            linhaDl('Tarefas guardadas', String(tarefasDB.length)),
            linhaDl('Registros de foco e distrações', String(lerLista(chaveFoco()).length + lerLista(chaveDistracoes()).length)),
            linhaDl('Onde ficam os dados', 'Neste navegador (localStorage)'),
            linhaDl('Espaço usado', `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`)
        ].join('');
    }

    function exportarDados() {
        if (!usuarioAtual) return;
        const u = usuarioFresco();
        const lerJson = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
        const pacote = {
            aplicativo: 'FocusMe',
            exportadoEm: new Date().toISOString(),
            conta: {
                id: u.id, nome: u.nome, usuario: u.usuario, email: u.email, telefone: u.telefone || null,
                criadoEm: u.criadoEm ? new Date(u.criadoEm).toISOString() : null,
                atualizadoEm: u.atualizadoEm ? new Date(u.atualizadoEm).toISOString() : null,
                fotoDePerfil: u.avatar || null, corDoAvatar: u.avatarCor || null
            },
            preferencias: { ...prefs, tema: localStorage.getItem(CHAVE_TEMA) || 'claro' },
            tarefas: tarefasDB,
            foco: lerLista(chaveFoco()),
            distracoes: lerLista(chaveDistracoes()),
            cicloPomodoro: lerJson(chavePomodoro())
        };
        const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focusme-dados-${u.usuario}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        mostrarToast('Arquivo com os seus dados gerado.');
    }
    $('perfExportar').addEventListener('click', exportarDados);

    $('excluirSenha').addEventListener('input', () => erroCampo('excluirSenha', ''));
    $('formExcluir').addEventListener('submit', async (e) => {
        e.preventDefault();
        const senha = $('excluirSenha').value;
        if (!senha) { erroCampo('excluirSenha', 'Digite a sua senha para continuar.'); $('excluirSenha').focus(); return; }
        const u = usuarioFresco();
        definirCarregando($('excluirBtn'), true, 'Verificando…');
        const certa = (await gerarHash(senha, u.salt)) === u.hash;
        definirCarregando($('excluirBtn'), false, 'Excluir minha conta');
        if (!certa) { erroCampo('excluirSenha', 'Senha incorreta.'); $('excluirSenha').focus(); return; }

        const confirmado = await confirmar({
            titulo: 'Excluir a sua conta?',
            texto: 'Serão apagados para sempre o seu perfil, as suas tarefas, o histórico de foco, as distrações registradas e as preferências deste navegador. Esta ação não pode ser desfeita.',
            rotuloConfirmar: 'Excluir tudo',
            perigo: true,
            digitar: 'excluir minha conta'
        });
        if (!confirmado) return;

        enviarParaExtensao('FOCUSME_STATE', { bloquear: false, fase: 'foco', pausado: false, fimEm: null });   // libera as redes
        chavesDoUsuario(u).forEach((k) => localStorage.removeItem(k));
        salvarUsuarios(lerUsuarios().filter((x) => x.id !== u.id));
        limparSessao();
        sessionStorage.setItem('focusMeAviso', 'Sua conta e todos os seus dados foram excluídos.');
        history.replaceState(null, '', location.pathname + location.search);
        setTimeout(() => location.reload(), 250);
    });

    // --- painel Foco & Distrações (página de Progresso) ---
    function renderizarFocoStats() {
        if (!usuarioAtual) return;
        const hoje = resumoDeHoje();
        animarNumero($('statFocoHoje'), hoje.focoMin, ' min');
        animarNumero($('statCiclosFoco'), hoje.ciclos);
        animarNumero($('statDistracoes'), hoje.distracoes);
        const barrados = extensao.conectada && extensao.status ? extensao.status.tentativasHoje : null;
        $('statBarrados').textContent = barrados === null ? '–' : barrados;

        const foco = lerLista(chaveFoco());
        const dist = lerLista(chaveDistracoes());
        const dados = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dados.push({
                rotulo: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
                min: foco.filter((x) => mesmoDia(x.t, d)).reduce((a, x) => a + x.min, 0),
                dist: dist.filter((x) => mesmoDia(x.t, d)).length
            });
        }
        const maximo = Math.max(60, ...dados.map((x) => x.min));
        const vazio = dados.every((x) => x.min === 0 && x.dist === 0);
        $('focoGrafico').classList.toggle('oculto', vazio);
        $('focoGrafico').innerHTML = dados.map((x, i) => `
            <div class="gcol" title="${x.min} min de foco · ${x.dist} distrações">
                <div class="gtrilho"><div class="gbarra foco" style="--h:${Math.round((x.min / maximo) * 100)}%; --i:${i}">${x.min ? `<b>${x.min}</b>` : ''}</div></div>
                <span class="gdata">${x.rotulo}</span>
                <span class="gdist ${x.dist ? 'tem' : ''}">${x.dist}</span>
            </div>`).join('');
    }

    function textoProximaFase() {
        if (modoAtual !== 'foco') return `Depois: foco de ${parseInt(inputTempoFoco.value) || 25} min`;
        const proximaELonga = (ciclosConcluidos + 1) % 4 === 0;
        return proximaELonga
            ? `Depois: pausa longa de ${parseInt(inputTempoPausaLonga.value) || 15} min`
            : `Depois: pausa de ${parseInt(inputTempoPausa.value) || 5} min`;
    }

    function ciclosPreenchidos() {
        if (modoAtual === 'pausa-longa') return 4;
        return ciclosConcluidos % 4;
    }

    function atualizarDisplayTimer() {
        const minutes = Math.floor(tempoRestante / 60);
        const seconds = tempoRestante % 60;
        pomodoroTimerDOM.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (tempoTotalCiclo > 0) {
            const fracaoRestante = Math.min(1, tempoRestante / tempoTotalCiclo);
            timerProgressFill.style.strokeDashoffset = CIRCUNFERENCIA_ANEL * (1 - fracaoRestante);
            knobRelogio.style.transform = `rotate(${fracaoRestante * 360}deg)`;
            const ligadas = Math.ceil(fracaoRestante * 60);
            if (ligadas !== marcasLigadas) {
                marcasLigadas = ligadas;
                marcasRelogio.forEach((m, i) => m.classList.toggle('on', i < ligadas));
            }
            pomodoroBoxCard.style.setProperty('--giro', `${(1 - fracaoRestante) * 360}deg`);
            modoFocoEl.style.setProperty('--giro', `${(1 - fracaoRestante) * 360}deg`);
        }

        const preenchidos = ciclosPreenchidos();
        pontosCiclos.forEach((ponto, i) => ponto.classList.toggle('feito', i < preenchidos));
        pomodoroCiclosContador.textContent = `Ciclos concluídos: ${preenchidos} de 4`;

        const fase = FASES[modoAtual];
        pomodoroBoxCard.classList.remove('estado-foco', 'estado-pausa-curta', 'estado-pausa-longa');
        pomodoroBoxCard.classList.add(fase.classe);
        pomodoroBoxCard.classList.toggle('rodando', pomodoroRodando);
        pomodoroEstadoDOM.textContent = fase.nome;
        pomodoroProximoDOM.textContent = textoProximaFase();
        document.title = pomodoroRodando
            ? `${pomodoroTimerDOM.textContent} · ${fase.nome} - FocusMe`
            : TITULO_ORIGINAL;

        atualizarOverlay();
        atualizarFavicon();
        atualizarTarefaEmFocoUI();
        sincronizarExtensao();
    }

    function dispararTimerRegressivo() {
        if (pomodoroRodando) return;
        prepararAudio();
        pomodoroRodando = true;
        pausadoPorSaida = false;
        btnPomodoroIniciar.disabled = true;
        endTimeTarget = Date.now() + (tempoRestante * 1000);
        atualizarDisplayTimer();
        salvarEstadoPomodoro();

        intervaloPomodoro = setInterval(() => {
            const milissegundosRestantes = endTimeTarget - Date.now();
            if (milissegundosRestantes > 0) {
                tempoRestante = Math.ceil(milissegundosRestantes / 1000);
                atualizarDisplayTimer();
            } else {
                clearInterval(intervaloPomodoro);
                pomodoroRodando = false;
                btnPomodoroIniciar.disabled = false;
                tempoRestante = 0;
                atualizarDisplayTimer();
                tratarFimDeCiclo();
            }
        }, 200);
    }

    function tratarFimDeCiclo() {
        if (modoAtual !== 'foco') tocarSino();
        if (modoAtual === 'foco') {
            const minutosFoco = Math.max(1, Math.round(tempoTotalCiclo / 60));
            registrarFoco(minutosFoco);
            const tarefaFocada = tarefaEmFoco != null ? tarefasDB.find((t) => t.id === tarefaEmFoco) : null;
            if (tarefaFocada) {
                tarefaFocada.focoMin = (tarefaFocada.focoMin || 0) + minutosFoco;
                salvarTarefasNoLocalStorage();
                renderizarTarefas();
            }
            atualizarPomodoroHoje();
            mostrarToast(tarefaFocada ? `Foco concluído! +${minutosFoco} min em "${tarefaFocada.titulo}".` : 'Foco concluído! Hora de uma pausa.');
            tocarSino();
            ciclosConcluidos++;
            if (ciclosConcluidos % 4 === 0) {
                modoAtual = 'pausa-longa';
                tempoRestante = (parseInt(inputTempoPausaLonga.value) || 15) * 60;
            } else {
                modoAtual = 'pausa-curta';
                tempoRestante = (parseInt(inputTempoPausa.value) || 5) * 60;
            }
        } else {
            modoAtual = 'foco';
            tempoRestante = (parseInt(inputTempoFoco.value) || 25) * 60;
        }
        tempoTotalCiclo = tempoRestante;
        atualizarDisplayTimer();
        salvarEstadoPomodoro();
        if (checkboxAutoStart.checked) dispararTimerRegressivo();
    }

    btnPomodoroIniciar.addEventListener('click', dispararTimerRegressivo);
    function pausarCronometro() {
        if (!pomodoroRodando) return;
        clearInterval(intervaloPomodoro);
        pomodoroRodando = false;
        btnPomodoroIniciar.disabled = false;
        tempoRestante = Math.max(0, Math.ceil((endTimeTarget - Date.now()) / 1000));
        atualizarDisplayTimer();
        salvarEstadoPomodoro();
    }

    function alternarCronometro() {
        if (pomodoroRodando) { pausadoPorSaida = false; pausarCronometro(); }
        else dispararTimerRegressivo();
    }

    btnPomodoroPausar.addEventListener('click', () => {
        pausadoPorSaida = false;
        pausarCronometro();
    });

    document.getElementById('btnPomodoroParar').addEventListener('click', async () => {
        const bloqueando = estadoParaExtensao().bloquear;
        const reiniciar = await confirmar({
            titulo: 'Reiniciar o ciclo?',
            texto: bloqueando
                ? 'O cronômetro volta ao início, o tempo corrido será perdido e as redes sociais serão liberadas.'
                : 'O cronômetro do ciclo atual volta ao início e o tempo corrido será perdido.',
            rotuloConfirmar: 'Reiniciar',
            perigo: true
        });
        if (reiniciar) {
            clearInterval(intervaloPomodoro);
            pomodoroRodando = false;
            btnPomodoroIniciar.disabled = false;
            endTimeTarget = null;
            if (modoAtual === 'foco') tempoRestante = (parseInt(inputTempoFoco.value) || 25) * 60;
            else if (modoAtual === 'pausa-curta') tempoRestante = (parseInt(inputTempoPausa.value) || 5) * 60;
            else if (modoAtual === 'pausa-longa') tempoRestante = (parseInt(inputTempoPausaLonga.value) || 15) * 60;
            tempoTotalCiclo = tempoRestante;
            pausadoPorSaida = false;
            atualizarDisplayTimer();
            salvarEstadoPomodoro();
        }
    });

    function carregarConfiguracoesPomodoro() {
        tempoRestante = (parseInt(inputTempoFoco.value) || 25) * 60;
        tempoTotalCiclo = tempoRestante;
        atualizarDisplayTimer();
    }

    carregarConfiguracoesPomodoro();

    // ======================================================================
    // INICIALIZAÇÃO: tema salvo + sessão ativa (se existir)
    // ======================================================================
    aplicarTema(localStorage.getItem(CHAVE_TEMA) === 'noturno');

    const idSessao = lerSessao();
    const usuarioSalvo = idSessao ? lerUsuarios().find((u) => u.id === idSessao) : null;
    if (usuarioSalvo) entrarNoApp(usuarioSalvo);
    else { limparSessao(); }

    const avisoPendente = sessionStorage.getItem('focusMeAviso');   // ex.: conta excluída
    if (avisoPendente) { sessionStorage.removeItem('focusMeAviso'); mostrarToast(avisoPendente); }
});