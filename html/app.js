(function () {
  "use strict";

  var form = document.getElementById("quiz-form");
  var accountPanel = document.getElementById("account-panel");
  var quizPanel = document.getElementById("quiz-panel");
  var registerForm = document.getElementById("register-form");
  var loginForm = document.getElementById("login-form");
  var accountMessage = document.getElementById("account-message");
  var signedInPanel = document.getElementById("signed-in-panel");
  var signedInName = document.getElementById("signed-in-name");
  var logoutButton = document.getElementById("logout-button");
  var token = localStorage.getItem("quizToken") || "";
  var questionsContainer = document.getElementById("questions");
  var progress = document.getElementById("progress");
  var progressBar = document.getElementById("progress-bar");
  var submitButton = document.getElementById("submit-button");
  var resetButton = document.getElementById("reset-button");
  var resultsSection = document.getElementById("results");
  var scoreSummary = document.getElementById("score-summary");
  var feedbackList = document.getElementById("feedback-list");
  var tryAgainButton = document.getElementById("try-again-button");

  var questions = [];

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function apiFetch(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    if (token) options.headers.Authorization = "Bearer " + token;
    return fetch(url, options);
  }

  function setAccount(user) {
    var signedIn = Boolean(user);
    accountMessage.textContent = signedIn ? "" : "Sign in or create an account to continue.";
    registerForm.classList.toggle("is-hidden", signedIn);
    loginForm.classList.toggle("is-hidden", signedIn);
    signedInPanel.classList.toggle("is-hidden", !signedIn);
    quizPanel.classList.toggle("is-hidden", !signedIn);
    resultsSection.classList.add("is-hidden");
    if (signedIn) {
      signedInName.textContent = user.username;
      loadQuestions();
    } else {
      questionsContainer.replaceChildren(element("p", "", "Sign in to load the quiz."));
      submitButton.disabled = true;
    }
  }

  function accountRequest(url, data) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) throw new Error(body.error || "Account request failed.");
        return body;
      });
    });
  }

  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    accountMessage.textContent = "Creating account…";
    accountRequest("/api/register", {
      username: registerForm.elements.username.value.trim(),
      password: registerForm.elements.password.value
    }).then(function (data) {
      token = data.token;
      localStorage.setItem("quizToken", token);
      registerForm.reset();
      setAccount(data.user);
    }).catch(function (error) {
      accountMessage.textContent = error.message;
    });
  });

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    accountMessage.textContent = "Signing in…";
    accountRequest("/api/login", {
      username: loginForm.elements.username.value.trim(),
      password: loginForm.elements.password.value
    }).then(function (data) {
      token = data.token;
      localStorage.setItem("quizToken", token);
      loginForm.reset();
      setAccount(data.user);
    }).catch(function (error) {
      accountMessage.textContent = error.message;
    });
  });

  logoutButton.addEventListener("click", function () {
    apiFetch("/api/logout", { method: "POST" }).finally(function () {
      token = "";
      localStorage.removeItem("quizToken");
      setAccount(null);
    });
  });

  function checkSession() {
    if (!token) {
      setAccount(null);
      return;
    }
    apiFetch("/api/me").then(function (response) {
      if (!response.ok) throw new Error("Session expired.");
      return response.json();
    }).then(setAccount).catch(function () {
      token = "";
      localStorage.removeItem("quizToken");
      setAccount(null);
    });
  }

  function loadQuestions() {
    questionsContainer.replaceChildren(element("p", "", "Loading quiz questions…"));
    submitButton.disabled = true;
    resultsSection.classList.add("is-hidden");

    apiFetch("/api/questions")
      .then(function (response) {
        if (!response.ok) throw new Error("Could not load quiz questions.");
        return response.json();
      })
      .then(function (data) {
        questions = data.questions;
        renderQuestions();
      })
      .catch(showError);
  }

  function renderQuestions() {
    questionsContainer.replaceChildren();

    questions.forEach(function (question, index) {
      var section = element("fieldset", "question-block");
      var legend = element("legend", "title is-6", (index + 1) + ". " + question.question);
      section.appendChild(legend);

      question.options.forEach(function (option) {
        var label = element("label", "answer-option");
        var input = document.createElement("input");
        input.type = "radio";
        input.name = "question-" + question.id;
        input.value = option.value;
        input.addEventListener("change", updateProgress);
        label.appendChild(input);
        label.appendChild(document.createTextNode(option.value + ". " + option.label));
        section.appendChild(label);
      });

      questionsContainer.appendChild(section);
    });

    submitButton.disabled = false;
    updateProgress();
  }

  function updateProgress() {
    var answered = 0;
    questions.forEach(function (question) {
      if (form.querySelector('input[name="question-' + question.id + '"]:checked')) {
        answered += 1;
      }
    });

    progress.textContent = answered + " of " + questions.length + " answered";
    progressBar.max = questions.length;
    progressBar.value = answered;
  }

  function showError(error) {
    questionsContainer.replaceChildren(
      element("p", "has-text-danger", error.message || "Something went wrong.")
    );
    submitButton.disabled = true;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var answers = {};
    questions.forEach(function (question) {
      var selected = form.querySelector('input[name="question-' + question.id + '"]:checked');
      answers[String(question.id)] = selected ? selected.value : "";
    });

    submitButton.disabled = true;
    submitButton.classList.add("is-loading");

    apiFetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: answers })
    })
      .then(function (response) {
        if (!response.ok) throw new Error("The server could not score this attempt.");
        return response.json();
      })
      .then(renderResults)
      .catch(showError)
      .finally(function () {
        submitButton.disabled = false;
        submitButton.classList.remove("is-loading");
      });
  });

  function renderResults(data) {
    scoreSummary.textContent =
      "You scored " + data.score + " out of " + data.total +
      " (" + data.percentage + "%).";

    feedbackList.replaceChildren();
    data.results.forEach(function (result, index) {
      var question = questions[index];
      var item = element("article", "feedback-item");
      var heading = element(
        "h3",
        "title is-6",
        (index + 1) + ". " + question.question
      );
      var status = element(
        "p",
        result.correct ? "has-text-success has-text-weight-semibold" :
          "has-text-danger has-text-weight-semibold",
        result.correct ? "Correct" : "Incorrect — correct answer: " + result.answer
      );
      var explanation = element("p", "mt-2", result.explanation);
      item.appendChild(heading);
      item.appendChild(status);
      item.appendChild(explanation);
      feedbackList.appendChild(item);
    });

    resultsSection.classList.remove("is-hidden");
    resultsSection.focus();
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function restart() {
    form.reset();
    loadQuestions();
    resultsSection.classList.add("is-hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  resetButton.addEventListener("click", restart);
  tryAgainButton.addEventListener("click", restart);

  checkSession();
}());
