/* =========================================================
   Quiz Relâmpago — lógica da aplicação (Vanilla JS, sem build)
   ========================================================= */
(() => {
  "use strict";

  /* ---------------- Constantes ---------------- */
  const QUESTION_TIME_MS = 15000;      // Regra de ouro: 15 segundos exatos
  const AUTO_ADVANCE_MS = 3000;        // Avanço automático após revelar
  const RING_LENGTH = 2 * Math.PI * 52; // Circunferência do anel SVG (r = 52)
  const LETTERS = ["A", "B", "C", "D"];
  const MIXED = { id: "mixed", name: "Todas Misturadas", icon: "🎲", color: "#7c3aed", description: "Desafio geral com todos os temas" };
  const STORAGE = { settings: "quiz.settings.v1", muted: "quiz.muted.v1", best: "quiz.best.v1", seen: "quiz.seen.v1" };

  /* ---------------- Utilidades ---------------- */
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* modo privado / armazenamento bloqueado */ }
    },
  };
  const flagPng = (code) => `https://flagcdn.com/w320/${code}.png`;
  const flagSvg = (code) => `https://flagcdn.com/${code}.svg`;
  const flagEmoji = (code) => code.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));

  /* ---------------- Áudio sintético (Web Audio API) ---------------- */
  const sfx = (() => {
    let ctx = null;
    let muted = store.get(STORAGE.muted, false);

    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function tone({ freq = 440, to = null, start = 0, dur = 0.15, type = "sine", vol = 0.15 }) {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      const t = c.currentTime + start;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    }

    return {
      unlock: ensure,
      get muted() { return muted; },
      setMuted(v) { muted = v; store.set(STORAGE.muted, v); },
      tick(n) { // "tic-tac" nos últimos 3 segundos
        const hi = n % 2 === 1;
        tone({ freq: hi ? 1200 : 900, dur: 0.06, type: "square", vol: 0.06 });
        tone({ freq: hi ? 600 : 450, dur: 0.08, type: "triangle", vol: 0.08 });
      },
      lock() { tone({ freq: 660, to: 880, dur: 0.1, type: "sine", vol: 0.12 }); },
      correct() {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, start: i * 0.08, dur: 0.22, type: "triangle", vol: 0.16 }));
      },
      wrong() {
        tone({ freq: 220, to: 110, dur: 0.45, type: "sawtooth", vol: 0.09 });
        tone({ freq: 233, to: 116, dur: 0.45, type: "square", vol: 0.04 });
      },
      timeout() {
        [440, 349.23, 261.63].forEach((f, i) => tone({ freq: f, start: i * 0.14, dur: 0.24, type: "square", vol: 0.07 }));
      },
      reveal() {
        tone({ freq: 523.25, dur: 0.5, type: "triangle", vol: 0.12 });
        tone({ freq: 783.99, start: 0.06, dur: 0.5, type: "triangle", vol: 0.1 });
      },
      start() {
        [392, 523.25, 659.25].forEach((f, i) => tone({ freq: f, start: i * 0.07, dur: 0.14, type: "sine", vol: 0.12 }));
      },
      fanfare() {
        [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, start: i * 0.11, dur: 0.25, type: "triangle", vol: 0.14 }));
      },
    };
  })();

  /* ---------------- Estado ---------------- */
  const defaults = { category: "mixed", count: 10, mode: "interactive", autoAdvance: false, instantReveal: false };
  const settings = Object.assign({}, defaults, store.get(STORAGE.settings, {}));
  let bank = { categories: [], questions: [] };

  const game = {
    items: [],          // perguntas da rodada (com alternativas embaralhadas)
    index: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    phase: "idle",      // idle | answering | locked | revealed
    t0: 0,
    raf: 0,
    timeouts: [],
    autoTimer: 0,
  };

  /* ---------------- Referências do DOM ---------------- */
  const dom = {
    screens: {
      home: $("#screen-home"), game: $("#screen-game"), results: $("#screen-results"), error: $("#screen-error"),
    },
    categoryGrid: $("#categoryGrid"), countGroup: $("#countGroup"), modeGroup: $("#modeGroup"),
    autoAdvance: $("#autoAdvance"), instantReveal: $("#instantReveal"), instantRevealWrap: $("#instantRevealWrap"),
    startBtn: $("#startBtn"), bankInfo: $("#bankInfo"), muteBtn: $("#muteBtn"), brandBtn: $("#brandBtn"),
    quitBtn: $("#quitBtn"), catChip: $("#catChip"), progressText: $("#progressText"), roundFill: $("#roundFill"),
    scoreBox: $("#scoreBox"), scoreValue: $("#scoreValue"),
    timerWrap: document.querySelector(".timer-wrap"), timerNumber: $("#timerNumber"), timerFill: $("#timerFill"), ringFg: $("#ringFg"),
    flagWrap: $("#flagWrap"), flagImg: $("#flagImg"), flagEmoji: $("#flagEmoji"),
    questionText: $("#questionText"), answers: $("#answers"), statusLine: $("#statusLine"),
    feedback: $("#feedback"), feedbackTitle: $("#feedbackTitle"), feedbackText: $("#feedbackText"), nextBtn: $("#nextBtn"),
    medal: $("#medal"), resultTitle: $("#resultTitle"), resultRank: $("#resultRank"), stats: $("#stats"), bestScore: $("#bestScore"),
    againBtn: $("#againBtn"), homeBtn: $("#homeBtn"), reviewTitle: $("#reviewTitle"), reviewList: $("#reviewList"),
    errorDetail: $("#errorDetail"),
  };

  /* ---------------- Navegação entre telas ---------------- */
  function showScreen(name) {
    Object.entries(dom.screens).forEach(([key, node]) => node.classList.toggle("active", key === name));
    document.body.classList.toggle("tv-mode", name === "game" && settings.mode === "tv");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- Carregamento do banco ---------------- */
  async function loadBank() {
    try {
      const res = await fetch("./questions.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.questions) || !Array.isArray(data.categories)) throw new Error("Formato inválido do JSON");
      bank = data;
      renderHome();
    } catch (err) {
      dom.errorDetail.textContent = `Detalhe técnico: ${err.message}`;
      showScreen("error");
    }
  }

  const categoryById = (id) => (id === "mixed" ? MIXED : bank.categories.find((c) => c.id === id) || MIXED);
  const poolFor = (catId) => (catId === "mixed" ? bank.questions : bank.questions.filter((q) => q.category === catId));

  /* ---------------- Tela inicial ---------------- */
  function renderHome() {
    dom.categoryGrid.innerHTML = "";
    const cats = [...bank.categories, MIXED];
    cats.forEach((cat) => {
      const btn = el("button", "cat-card" + (cat.id === "mixed" ? " mixed" : ""));
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.dataset.cat = cat.id;
      btn.style.setProperty("--c", cat.color);
      btn.append(
        el("span", "cat-icon", cat.icon),
        el("span", "cat-name", cat.name),
        el("span", "cat-desc", cat.description),
        el("span", "cat-count", `${poolFor(cat.id).length}`)
      );
      btn.title = `${poolFor(cat.id).length} perguntas disponíveis`;
      btn.addEventListener("click", () => { settings.category = cat.id; syncSetup(); });
      dom.categoryGrid.append(btn);
    });
    if (!cats.some((c) => c.id === settings.category)) settings.category = "mixed";
    dom.bankInfo.textContent = `${bank.questions.length} perguntas em ${bank.categories.length} categorias · ${QUESTION_TIME_MS / 1000} segundos cada`;
    syncSetup();
  }

  function syncSetup() {
    dom.categoryGrid.querySelectorAll(".cat-card").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.cat === settings.category)));
    dom.countGroup.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(Number(b.dataset.count) === settings.count)));
    dom.modeGroup.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === settings.mode)));
    dom.autoAdvance.checked = settings.autoAdvance;
    dom.instantReveal.checked = settings.instantReveal && settings.mode === "interactive";
    dom.instantReveal.disabled = settings.mode === "tv";
    dom.instantRevealWrap.classList.toggle("disabled", settings.mode === "tv");
    dom.startBtn.disabled = poolFor(settings.category).length === 0;
    store.set(STORAGE.settings, settings);
  }

  dom.countGroup.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-count]");
    if (b) { settings.count = Number(b.dataset.count); syncSetup(); }
  });
  dom.modeGroup.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-mode]");
    if (!b) return;
    const changed = settings.mode !== b.dataset.mode;
    settings.mode = b.dataset.mode;
    if (changed && settings.mode === "tv") settings.autoAdvance = true; // sugestão: TV avança sozinha
    syncSetup();
  });
  dom.autoAdvance.addEventListener("change", () => { settings.autoAdvance = dom.autoAdvance.checked; syncSetup(); });
  dom.instantReveal.addEventListener("change", () => { settings.instantReveal = dom.instantReveal.checked; syncSetup(); });

  /* ---------------- Montagem da rodada ---------------- */
  // Prioriza perguntas ainda não vistas recentemente e equilibra grupos (subtipos / categorias).
  function buildRound(catId, count) {
    const seen = new Set(store.get(STORAGE.seen, []));
    const pool = poolFor(catId);
    const groupKey = catId === "mixed" ? (q) => q.category : (q) => q.subtype || q.category;

    const groups = new Map();
    pool.forEach((q) => {
      const k = groupKey(q);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(q);
    });
    const queues = shuffle([...groups.values()]).map((list) => {
      const s = shuffle(list);
      return [...s.filter((q) => !seen.has(q.id)), ...s.filter((q) => seen.has(q.id))];
    });

    const picked = [];
    const total = Math.min(count, pool.length);
    while (picked.length < total) {
      for (const queue of queues) {
        if (picked.length >= total) break;
        if (queue.length) picked.push(queue.shift());
      }
    }

    // Atualiza o histórico de vistas (mantém no máximo ~70% do banco para sempre haver novidades)
    const history = [...seen].filter((id) => !picked.some((q) => q.id === id));
    const updated = [...history, ...picked.map((q) => q.id)].slice(-Math.floor(bank.questions.length * 0.7));
    store.set(STORAGE.seen, updated);

    return shuffle(picked).map((q) => {
      const order = shuffle([0, 1, 2, 3].slice(0, q.options.length));
      return {
        q,
        options: order.map((i) => q.options[i]),
        correctIdx: order.indexOf(q.answer),
        chosenIdx: null,
        time: null,
        points: 0,
        correct: false,
      };
    });
  }

  function preloadFlags(items) {
    items.forEach(({ q }) => { if (q.flag) { const img = new Image(); img.src = flagPng(q.flag); } });
  }

  /* ---------------- Fluxo do jogo ---------------- */
  function startGame() {
    sfx.unlock();
    const items = buildRound(settings.category, settings.count);
    if (!items.length) return;
    Object.assign(game, { items, index: 0, score: 0, streak: 0, bestStreak: 0, phase: "idle" });
    preloadFlags(items);
    const cat = categoryById(settings.category);
    dom.catChip.textContent = `${cat.icon} ${cat.name}`;
    dom.scoreBox.style.visibility = settings.mode === "tv" ? "hidden" : "";
    dom.scoreValue.textContent = "0";
    showScreen("game");
    sfx.start();
    renderQuestion();
  }

  function renderQuestion() {
    clearAuto();
    const item = game.items[game.index];
    const { q } = item;
    const isTV = settings.mode === "tv";

    dom.progressText.textContent = `${game.index + 1} / ${game.items.length}`;
    dom.roundFill.style.width = `${(game.index / game.items.length) * 100}%`;
    if (settings.category === "mixed") {
      const c = categoryById(q.category);
      dom.catChip.textContent = `${c.icon} ${c.name}`;
    }

    // Bandeira (PNG → SVG → emoji como fallback)
    dom.flagEmoji.classList.add("hidden");
    if (q.flag) {
      dom.flagWrap.classList.remove("hidden");
      dom.flagImg.classList.remove("hidden");
      dom.flagImg.dataset.stage = "png";
      dom.flagImg.dataset.code = q.flag;
      dom.flagImg.src = flagPng(q.flag);
      dom.flagEmoji.textContent = flagEmoji(q.flag);
    } else {
      dom.flagWrap.classList.add("hidden");
      dom.flagImg.removeAttribute("src");
    }

    dom.questionText.textContent = q.question;
    dom.answers.innerHTML = "";
    item.options.forEach((text, i) => {
      const b = el("button", "answer");
      b.type = "button";
      b.dataset.idx = String(i);
      b.setAttribute("aria-label", `Alternativa ${LETTERS[i]}: ${text}`);
      b.append(el("span", "letter", LETTERS[i]), el("span", "answer-text", text));
      if (isTV) b.disabled = true;
      else b.addEventListener("click", () => answer(i));
      dom.answers.append(b);
    });

    dom.statusLine.textContent = isTV ? "📺 Pensem na resposta… ela será revelada ao fim do tempo!" : "";
    dom.feedback.classList.add("hidden");
    dom.feedback.classList.remove("ok", "bad");

    game.phase = "answering";
    startTimer();
  }

  dom.flagImg.addEventListener("error", () => {
    const code = dom.flagImg.dataset.code;
    if (!code) return;
    if (dom.flagImg.dataset.stage === "png") {
      dom.flagImg.dataset.stage = "svg";
      dom.flagImg.src = flagSvg(code);
    } else {
      dom.flagImg.classList.add("hidden");
      dom.flagEmoji.classList.remove("hidden");
    }
  });

  /* ---------------- Temporizador ---------------- */
  function startTimer() {
    stopTimer();
    game.t0 = performance.now();
    // Tic-tac nos últimos 3 segundos e fim do tempo agendados com precisão
    [3, 2, 1].forEach((n) => game.timeouts.push(setTimeout(() => sfx.tick(n), QUESTION_TIME_MS - n * 1000)));
    game.timeouts.push(setTimeout(onTimeUp, QUESTION_TIME_MS));
    dom.timerWrap.classList.remove("t-done");
    const frame = () => {
      const remaining = drawTimer();
      if (remaining > 0) game.raf = requestAnimationFrame(frame);
    };
    frame();
  }

  function drawTimer(forceRemaining) {
    const elapsed = performance.now() - game.t0;
    const remaining = forceRemaining != null ? forceRemaining : Math.max(0, QUESTION_TIME_MS - elapsed);
    const frac = remaining / QUESTION_TIME_MS;
    const secs = Math.ceil(remaining / 1000);
    dom.timerFill.style.width = `${frac * 100}%`;
    dom.ringFg.style.strokeDashoffset = String(RING_LENGTH * (1 - frac));
    dom.timerNumber.textContent = String(secs);
    const state = secs >= 6 ? "t-ok" : secs >= 3 ? "t-warn" : "t-danger";
    dom.timerWrap.classList.remove("t-ok", "t-warn", "t-danger");
    dom.timerWrap.classList.add(state);
    return remaining;
  }

  function stopTimer() {
    cancelAnimationFrame(game.raf);
    game.timeouts.forEach(clearTimeout);
    game.timeouts = [];
  }

  function onTimeUp() {
    if (game.phase !== "answering" && game.phase !== "locked") return;
    drawTimer(0);
    reveal("timeup");
  }

  /* ---------------- Resposta ---------------- */
  function answer(idx) {
    if (game.phase !== "answering" || settings.mode === "tv") return;
    const item = game.items[game.index];
    const elapsed = Math.min(QUESTION_TIME_MS, performance.now() - game.t0);
    item.chosenIdx = idx;
    item.time = elapsed / 1000;
    item.correct = idx === item.correctIdx;
    // Pontuação: 500 pela resposta certa + até 500 de bônus por rapidez
    item.points = item.correct ? Math.round(500 + 500 * (1 - elapsed / QUESTION_TIME_MS)) : 0;

    const buttons = dom.answers.querySelectorAll(".answer");
    buttons.forEach((b) => { b.disabled = true; });
    const chosen = buttons[idx];
    chosen.classList.add("selected");
    chosen.append(el("span", "tag", "Sua resposta"));

    if (settings.instantReveal) {
      stopTimer();
      dom.timerWrap.classList.add("t-done");
      reveal("answered");
    } else {
      game.phase = "locked";
      sfx.lock();
      dom.statusLine.textContent = "🔒 Resposta registrada! Aguardando o fim do tempo…";
    }
  }

  function reveal(reason) {
    stopTimer();
    game.phase = "revealed";
    dom.timerWrap.classList.add("t-done");
    const item = game.items[game.index];
    const isTV = settings.mode === "tv";

    dom.answers.querySelectorAll(".answer").forEach((b, i) => {
      b.disabled = true;
      b.classList.add(i === item.correctIdx ? "correct" : "wrong");
    });

    let title;
    let tone;
    if (isTV) {
      title = `✅ Resposta: ${LETTERS[item.correctIdx]}) ${item.options[item.correctIdx]}`;
      tone = "ok";
      sfx.reveal();
    } else if (item.chosenIdx == null) {
      title = "⏰ Tempo esgotado!";
      tone = "bad";
      game.streak = 0;
      sfx.timeout();
    } else if (item.correct) {
      game.streak += 1;
      game.bestStreak = Math.max(game.bestStreak, game.streak);
      game.score += item.points;
      title = `🎉 Acertou! +${item.points} pontos${game.streak >= 3 ? ` · 🔥 ${game.streak} seguidas` : ""}`;
      tone = "ok";
      sfx.correct();
      dom.scoreValue.textContent = String(game.score);
      dom.scoreBox.classList.remove("bump");
      void dom.scoreBox.offsetWidth; // reinicia a animação
      dom.scoreBox.classList.add("bump");
    } else {
      game.streak = 0;
      title = `❌ Errou! A certa era ${LETTERS[item.correctIdx]}) ${item.options[item.correctIdx]}`;
      tone = "bad";
      sfx.wrong();
    }

    dom.statusLine.textContent = "";
    dom.feedbackTitle.textContent = title;
    dom.feedbackText.textContent = item.q.explanation || "";
    dom.feedback.classList.remove("hidden", "ok", "bad");
    dom.feedback.classList.add(tone);
    setNextLabel();
    dom.nextBtn.focus({ preventScroll: true });
    dom.feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });

    if (settings.autoAdvance) startAuto();
  }

  const isLast = () => game.index >= game.items.length - 1;
  function setNextLabel(secondsLeft) {
    const base = isLast() ? "Ver resultado 🏁" : "Próxima pergunta →";
    dom.nextBtn.textContent = secondsLeft ? `${base} (${secondsLeft})` : base;
  }

  function startAuto() {
    clearAuto();
    let left = Math.round(AUTO_ADVANCE_MS / 1000);
    setNextLabel(left);
    game.autoTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearAuto(); next(); } else setNextLabel(left);
    }, 1000);
  }
  function clearAuto() { clearInterval(game.autoTimer); game.autoTimer = 0; }

  function next() {
    if (game.phase !== "revealed") return;
    clearAuto();
    if (isLast()) finish();
    else { game.index += 1; renderQuestion(); }
  }

  function quitGame(ask = true) {
    if (game.phase === "idle") { showScreen("home"); return; }
    if (ask && !window.confirm("Sair da partida atual? O progresso será perdido.")) return;
    stopTimer();
    clearAuto();
    game.phase = "idle";
    showScreen("home");
  }

  /* ---------------- Resultados ---------------- */
  function finish() {
    stopTimer();
    clearAuto();
    game.phase = "idle";
    dom.roundFill.style.width = "100%";
    const items = game.items;
    const total = items.length;
    const isTV = settings.mode === "tv";
    const cat = categoryById(settings.category);
    dom.stats.innerHTML = "";
    const addStat = (value, label) => {
      const s = el("div", "stat");
      s.append(el("strong", null, value), el("span", null, label));
      dom.stats.append(s);
    };

    if (isTV) {
      dom.medal.textContent = "📺";
      dom.resultTitle.textContent = "Rodada concluída!";
      dom.resultRank.textContent = `${cat.icon} ${cat.name} · Modo Apresentação`;
      addStat(String(total), "perguntas exibidas");
      addStat(`${Math.round((total * QUESTION_TIME_MS) / 1000)}s`, "de cronômetro");
      addStat(String(new Set(items.map((i) => i.q.category)).size), total === 1 ? "categoria" : "categorias");
      addStat("👏", "parabéns, turma!");
      dom.bestScore.textContent = "";
      dom.reviewTitle.textContent = "Gabarito da rodada";
      renderReview(items, true);
    } else {
      const hits = items.filter((i) => i.correct).length;
      const pct = Math.round((hits / total) * 100);
      const answered = items.filter((i) => i.time != null);
      const avg = answered.length ? answered.reduce((s, i) => s + i.time, 0) / answered.length : 0;
      const rank =
        pct >= 90 ? ["🥇", "Gênio do Quiz!"] :
        pct >= 70 ? ["🥈", "Mandou muito bem!"] :
        pct >= 50 ? ["🥉", "Bom trabalho!"] :
                    ["🎯", "Continue treinando!"];
      dom.medal.textContent = rank[0];
      dom.resultTitle.textContent = rank[1];
      dom.resultRank.textContent = `${cat.icon} ${cat.name} · ${hits} de ${total} acertos`;
      addStat(game.score.toLocaleString("pt-BR"), "pontos");
      addStat(`${pct}%`, "de acertos");
      addStat(answered.length ? `${avg.toFixed(1).replace(".", ",")}s` : "—", "tempo médio");
      addStat(`${game.bestStreak}`, "maior sequência");

      const bestKey = `${settings.category}:${total}`;
      const bests = store.get(STORAGE.best, {});
      const prev = bests[bestKey] || 0;
      if (game.score > prev) {
        bests[bestKey] = game.score;
        store.set(STORAGE.best, bests);
        dom.bestScore.textContent = prev ? `🏅 Novo recorde! (anterior: ${prev.toLocaleString("pt-BR")})` : "🏅 Primeiro recorde registrado neste tema!";
      } else {
        dom.bestScore.textContent = `Seu recorde neste tema (${total} perguntas): ${prev.toLocaleString("pt-BR")} pontos`;
      }
      dom.reviewTitle.textContent = "Revisão das perguntas erradas";
      renderReview(items.filter((i) => !i.correct), false);
    }

    showScreen("results");
    sfx.fanfare();
  }

  function renderReview(list, showAll) {
    dom.reviewList.innerHTML = "";
    if (!list.length) {
      dom.reviewList.innerHTML = '<li class="review-empty">🌟 Perfeito! Você não errou nenhuma pergunta.</li>';
      return;
    }
    list.forEach((item) => {
      const li = el("li", "review-item" + (showAll ? " is-ok" : ""));
      const flag = item.q.flag ? `<img src="${flagPng(item.q.flag)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${flagSvg(item.q.flag)}'">` : "";
      const right = `<span class="right">✔ ${escapeHTML(item.options[item.correctIdx])}</span>`;
      const yours = showAll ? "" : item.chosenIdx == null
        ? '<span class="yours">⏰ Sem resposta</span> · '
        : `<span class="yours">✘ ${escapeHTML(item.options[item.chosenIdx])}</span> · `;
      li.innerHTML =
        `<div class="rq">${flag}<span>${escapeHTML(item.q.question)}</span></div>` +
        `<div class="ra">${yours}${right}</div>` +
        (item.q.explanation ? `<div class="re">💡 ${escapeHTML(item.q.explanation)}</div>` : "");
      dom.reviewList.append(li);
    });
  }

  /* ---------------- Eventos globais ---------------- */
  function updateMuteBtn() {
    dom.muteBtn.textContent = sfx.muted ? "🔇" : "🔊";
    dom.muteBtn.setAttribute("aria-label", sfx.muted ? "Ativar som" : "Desativar som");
    dom.muteBtn.setAttribute("aria-pressed", String(sfx.muted));
  }
  function toggleMute() {
    sfx.setMuted(!sfx.muted);
    updateMuteBtn();
    if (!sfx.muted) sfx.lock();
  }

  dom.muteBtn.addEventListener("click", toggleMute);
  dom.startBtn.addEventListener("click", startGame);
  dom.nextBtn.addEventListener("click", next);
  dom.quitBtn.addEventListener("click", () => quitGame(true));
  dom.brandBtn.addEventListener("click", () => {
    if (dom.screens.game.classList.contains("active")) quitGame(true);
    else if (!dom.screens.error.classList.contains("active")) showScreen("home");
  });
  dom.againBtn.addEventListener("click", startGame);
  dom.homeBtn.addEventListener("click", () => showScreen("home"));

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "m") { toggleMute(); return; }

    const inGame = dom.screens.game.classList.contains("active");
    if (!inGame) {
      if (key === "enter" && dom.screens.results.classList.contains("active") && document.activeElement === document.body) startGame();
      return;
    }
    if (key === "escape") { quitGame(true); return; }

    if (game.phase === "answering") {
      const map = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };
      if (key in map && map[key] < game.items[game.index].options.length) {
        e.preventDefault();
        answer(map[key]);
      }
    } else if (game.phase === "revealed" && (key === "enter" || key === " " || key === "arrowright")) {
      e.preventDefault();
      next();
    }
  });

  updateMuteBtn();
  loadBank();
})();
