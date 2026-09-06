(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const metadata = window.learningData || { entries: {}, questions: [] };
  let cards = [],
    category = "Всички",
    toastTimer;
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  // Preserve the original transliterated fragment URLs, including the slash in Цяло/части.
  function createValidId(text) {
    const letters = "абвгдежзийклмнопрстуфхцчшщъыьюя";
    const latin = [
      "a",
      "b",
      "v",
      "g",
      "d",
      "e",
      "zh",
      "z",
      "i",
      "y",
      "k",
      "l",
      "m",
      "n",
      "o",
      "p",
      "r",
      "s",
      "t",
      "u",
      "f",
      "h",
      "ts",
      "ch",
      "sh",
      "sht",
      "a",
      "y",
      "",
      "yu",
      "ya",
    ];
    return [...text.toLowerCase()]
      .map((char) =>
        letters.includes(char) ? latin[letters.indexOf(char)] : char,
      )
      .join("")
      .replace(/\s+/g, "-");
  }
  function notify(text) {
    clearTimeout(toastTimer);
    $("toast").textContent = text;
    toastTimer = setTimeout(() => {
      $("toast").textContent = "";
    }, 3500);
  }
  function applyFilters() {
    const query = $("search").value.trim().toLocaleLowerCase("bg");
    let count = 0;
    cards.forEach((card) => {
      const visible =
        (!query || card.search.includes(query)) &&
        (category === "Всички" || card.meta.category === category);
      card.element.hidden = !visible;
      if (visible) count++;
    });
    $("result-count").textContent = `${count} от ${cards.length} заблуди`;
    $("empty").hidden = count !== 0;
    $("reset").hidden = !query && category === "Всички";
    document
      .querySelectorAll(".filter")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.textContent === category),
        ),
      );
  }
  function resetFilters() {
    category = "Всички";
    $("search").value = "";
    applyFilters();
  }
  function openCard(id) {
    const card = cards.find((item) => item.id === id);
    if (!card) return;
    if (card.element.hidden) resetFilters();
    card.element.open = true;
    card.element.scrollIntoView({
      block: "start",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function visitCard(id) {
    if (location.hash.slice(1) === id) openCard(id);
    else location.hash = id;
  }
  function followHash() {
    try {
      openCard(decodeURIComponent(location.hash.slice(1)));
    } catch {
      /* An invalid fragment should not prevent browsing. */
    }
  }
  async function shareCard(card) {
    const url = new URL(location.href);
    url.hash = card.id;
    if (navigator.share) {
      try {
        await navigator.share({
          title: card.title,
          text: card.title,
          url: url.href,
        });
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url.href);
      notify("Линкът е копиран.");
    } catch {
      $("share-url").value = url.href;
      $("share-dialog").showModal();
      $("share-url").focus();
      $("share-url").select();
    }
  }
  function renderCards(data) {
    $("entries").replaceChildren();
    cards = data.map((card) => {
      const id = createValidId(card.title),
        meta = metadata.entries[card.title] || {};
      const element = document.createElement("details");
      element.className = "entry";
      element.id = id;
      element.innerHTML = `<summary><span><span class="entry-title">${escape(card.title)}</span><span class="entry-description">${escape(card.description)}</span></span><span class="entry-toggle" aria-hidden="true">+</span></summary><div class="entry-body"><div class="entry-meta"><a href="https://rationalwiki.org/wiki/${escape(card.link)}" target="_blank" rel="noopener">${escape(card.english)} ↗</a><span>${escape(meta.category || "")}</span></div><div class="entry-columns"><div class="example"><p class="eyebrow entry-label"><img src="pizza-example.svg" width="22" height="22" alt="" aria-hidden="true">Пример с пица</p><p>${escape(card.example)}</p></div><div class="explanation"><p class="eyebrow entry-label"><img src="warning.svg" width="22" height="22" alt="" aria-hidden="true">Къде е грешката?</p><p>${escape(card.explanation)}</p></div></div><div class="entry-actions"><button class="text-link share" type="button">Сподели линк ↗</button>${meta.related ? `<a class="text-link" href="#${escape(createValidId(meta.related))}">Виж също: ${escape(meta.related)} →</a>` : ""}</div></div>`;
      element
        .querySelector(".share")
        .addEventListener("click", () => shareCard({ ...card, id }));
      $("entries").append(element);
      return {
        ...card,
        id,
        meta,
        element,
        search: [card.title, card.english, card.description, card.example]
          .join(" ")
          .toLocaleLowerCase("bg"),
      };
    });
    $("filters").replaceChildren();
    [
      "Всички",
      ...new Set(cards.map((card) => card.meta.category).filter(Boolean)),
    ].forEach((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter";
      button.textContent = name;
      button.addEventListener("click", () => {
        category = name;
        applyFilters();
      });
      $("filters").append(button);
    });
    $("random").disabled = false;
    applyFilters();
    followHash();
  }
  async function load() {
    $("load-error").hidden = true;
    $("result-count").textContent = "Зареждане на заблудите…";
    $("retry").disabled = true;
    try {
      const response = await fetch("data.json");
      if (!response.ok) throw new Error(response.status);
      const data = await response.json();
      if (!Array.isArray(data) || !data.length)
        throw new Error("Empty content");
      renderCards(data);
    } catch {
      $("load-error").hidden = false;
      $("result-count").textContent = "Съдържанието не е заредено.";
    } finally {
      $("retry").disabled = false;
    }
  }
  $("search").addEventListener("input", applyFilters);
  $("reset").addEventListener("click", resetFilters);
  $("retry").addEventListener("click", load);
  $("random").addEventListener("click", () => {
    if (cards.length)
      visitCard(cards[Math.floor(Math.random() * cards.length)].id);
  });
  window.addEventListener("hashchange", followHash);
  // Same-fragment links must still reopen a previously collapsed entry.
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest('a[href^="#"]');
    if (anchor && anchor.hash === location.hash) followHash();
  });
  let queue = [],
    position = 0,
    missed = [],
    score = 0,
    answered = false;
  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function begin(questions) {
    queue = questions.map((question) => {
      const correct = question.options[question.answer];
      const options = shuffle(question.options);
      return { ...question, options, answer: options.indexOf(correct) };
    });
    position = 0;
    missed = [];
    score = 0;
    showQuestion();
  }
  function focusQuiz() {
    const heading = $("quiz").querySelector("h3");
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  function showQuestion() {
    answered = false;
    const question = queue[position];
    $("quiz").innerHTML =
      `<p class="eyebrow">Въпрос ${position + 1} от ${queue.length}</p><progress class="quiz-progress" value="${position}" max="${queue.length}" aria-label="Завършени въпроси"></progress><h3>Коя е заблудата?</h3><p>${escape(question.prompt)}</p><div class="quiz-options">${question.options.map((option, index) => `<button class="quiz-option" data-answer="${index}">${escape(option)}</button>`).join("")}</div><div id="feedback" class="feedback" role="status" hidden></div><button id="next-question" class="button primary" hidden>${position === queue.length - 1 ? "Виж резултата" : "Следващ въпрос"} →</button>`;
    $("quiz")
      .querySelectorAll("[data-answer]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          answer(Number(button.dataset.answer)),
        ),
      );
    $("next-question").addEventListener("click", () => {
      position++;
      if (position < queue.length) showQuestion();
      else finish();
    });
    focusQuiz();
  }
  function answer(selected) {
    if (answered) return;
    answered = true;
    const question = queue[position],
      correct = selected === question.answer;
    if (correct) score++;
    else missed.push(question);
    $("quiz")
      .querySelectorAll("[data-answer]")
      .forEach((button) => {
        const index = Number(button.dataset.answer);
        button.disabled = true;
        if (index === question.answer) {
          button.classList.add("correct");
          button.textContent += " ✓";
        } else if (index === selected) {
          button.classList.add("wrong");
          button.textContent += " — твоят отговор";
        }
      });
    $("feedback").hidden = false;
    $("feedback").innerHTML =
      `<p><strong>${correct ? "Точно така." : "Верният отговор: " + escape(question.options[question.answer]) + "."}</strong> ${escape(question.explanation)}</p>`;
    $("next-question").hidden = false;
    $("next-question").focus({ preventScroll: true });
  }
  function finish() {
    const retry = [...missed];
    $("quiz").innerHTML =
      `<p class="eyebrow">Тренировката приключи</p><h3>${score} от ${queue.length} верни отговора.</h3><p>${retry.length ? "Всяка грешка е повод да разбереш аргумента по-добре. Преговори ситуациите, които те затрудниха." : "Добро око за слабите аргументи! Опитай още ситуации или разгледай останалите заблуди."}</p>${retry.length ? '<button id="review-missed" class="button primary">Преговори сгрешените →</button>' : ""}<button id="restart-quiz" class="button secondary">Нова тренировка</button>`;
    if (retry.length)
      $("review-missed").addEventListener("click", () => begin(retry));
    $("restart-quiz").addEventListener("click", startQuiz);
    focusQuiz();
  }
  function startQuiz() {
    if (metadata.questions.length)
      begin(shuffle(metadata.questions).slice(0, 5));
    else notify("Тестът не е наличен. Презареди страницата.");
  }
  $("start-quiz").addEventListener("click", startQuiz);
  load();
})();
