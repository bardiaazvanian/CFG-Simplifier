class GrammarManager {
  constructor(inputText) {
    this.productions = {};
    this.startSymbol = null;
    this.parseInput(inputText);
  }

  parseInput(text) {
    const lines = text.split(/\n/);
    lines.forEach((line) => {
      line = line.trim();
      if (!line) return;
      let parts = line.split(/->|→/);
      if (parts.length !== 2) return;
      const left = parts[0].trim();
      if (!this.startSymbol) this.startSymbol = left;
      const rights = parts[1].split("|").map((s) => s.trim());
      if (!this.productions[left]) this.productions[left] = [];
      rights.forEach((r) => {
        if (r === "lambda" || r === "λ" || r === "@" || r === "ε" || r === "")
          r = "λ";
        if (!this.productions[left].includes(r)) this.productions[left].push(r);
      });
    });
  }

  toString() {
    let output = [];
    for (let v in this.productions) {
      if (this.productions[v].length > 0)
        output.push(`${v} -> ${this.productions[v].join(" | ")}`);
    }
    return output.join("\n");
  }

  clone() {
    const newG = new GrammarManager("");
    newG.startSymbol = this.startSymbol;
    newG.productions = JSON.parse(JSON.stringify(this.productions));
    return newG;
  }
}

// 1. حذف لاندا
function removeLambda(grammar) {
  let g = grammar.clone();
  let nullable = new Set();
  let prevSize = -1;
  while (nullable.size !== prevSize) {
    prevSize = nullable.size;
    for (let v in g.productions) {
      g.productions[v].forEach((rule) => {
        if (rule === "λ") {
          nullable.add(v);
        } else {
          let allNull = true;
          for (let char of rule) {
            if (!/[A-Z]/.test(char) || !nullable.has(char)) {
              allNull = false;
              break;
            }
          }
          if (allNull && rule.length > 0) nullable.add(v);
        }
      });
    }
  }
  let newProductions = {};
  for (let v in g.productions) {
    newProductions[v] = new Set();
    g.productions[v].forEach((rule) => {
      if (rule === "λ") return;
      let chars = rule.split("");
      let nullIndices = [];
      chars.forEach((c, i) => {
        if (nullable.has(c)) nullIndices.push(i);
      });
      let combinations = 1 << nullIndices.length;
      for (let i = 0; i < combinations; i++) {
        let tempChars = [...chars];
        for (let j = 0; j < nullIndices.length; j++) {
          if ((i >> j) & 1) tempChars[nullIndices[j]] = "";
        }
        let newRule = tempChars.join("");
        if (newRule.length > 0) newProductions[v].add(newRule);
      }
    });
  }
  for (let v in newProductions)
    g.productions[v] = Array.from(newProductions[v]);
  return g;
}

// 2. حذف واحد
function removeUnit(grammar) {
  let g = grammar.clone();
  for (let v in g.productions) {
    let unitReachable = new Set([v]);
    let queue = [v];
    while (queue.length > 0) {
      let current = queue.shift();
      if (g.productions[current]) {
        g.productions[current].forEach((rule) => {
          if (rule.length === 1 && /[A-Z]/.test(rule)) {
            if (!unitReachable.has(rule)) {
              unitReachable.add(rule);
              queue.push(rule);
            }
          }
        });
      }
    }
    let newRules = new Set();
    unitReachable.forEach((target) => {
      if (g.productions[target]) {
        g.productions[target].forEach((rule) => {
          if (!(rule.length === 1 && /[A-Z]/.test(rule))) newRules.add(rule);
        });
      }
    });
    g.productions[v] = Array.from(newRules);
  }
  return g;
}

// 3. حذف بی استفاده
function removeUseless(grammar) {
  let g = grammar.clone();
  // فاز 1: مولد
  let generating = new Set();
  let prevSize = -1;
  while (generating.size !== prevSize) {
    prevSize = generating.size;
    for (let v in g.productions) {
      if (!generating.has(v)) {
        for (let rule of g.productions[v]) {
          let isGen = true;
          for (let char of rule) {
            if (/[A-Z]/.test(char) && !generating.has(char)) {
              isGen = false;
              break;
            }
          }
          if (isGen) {
            generating.add(v);
            break;
          }
        }
      }
    }
  }
  for (let v in g.productions) {
    if (!generating.has(v)) delete g.productions[v];
    else
      g.productions[v] = g.productions[v].filter((rule) => {
        for (let char of rule) {
          if (/[A-Z]/.test(char) && !generating.has(char)) return false;
        }
        return true;
      });
  }
  // فاز 2: قابل دسترس
  if (!g.productions[g.startSymbol]) {
    g.productions = {};
    return g;
  }
  let reachable = new Set([g.startSymbol]);
  let queue = [g.startSymbol];
  while (queue.length > 0) {
    let current = queue.shift();
    if (g.productions[current]) {
      g.productions[current].forEach((rule) => {
        for (let char of rule) {
          if (/[A-Z]/.test(char) && !reachable.has(char)) {
            reachable.add(char);
            queue.push(char);
          }
        }
      });
    }
  }
  for (let v in g.productions) {
    if (!reachable.has(v)) delete g.productions[v];
  }
  return g;
}

// UI Functions
function loadExample() {
  const examples = [
    "S -> aA | aBB | lambda\nA -> aaA | B\nB -> bB | bbC\nC -> B\nD -> d",
    "S -> A | aa\nA -> B\nB -> C\nC -> z\nE -> e",
    "S -> AB | CD\nA -> a | lambda\nB -> b | lambda\nC -> c\nD -> lambda",
    "S -> aS | bB\nB -> bB | b",
    "S -> aS | a\nA -> B\nB -> A\nC -> cC",
    "S -> XY\nX -> aX | a | lambda\nY -> bY | b | lambda\nZ -> cZ | c",
  ];

  const randomIndex = Math.floor(Math.random() * examples.length);
  document.getElementById("grammarInput").value = examples[randomIndex];
}

function simplifyGrammar() {
  const input = document.getElementById("grammarInput").value;
  if (!input.trim()) {
    alert("لطفا گرامر را وارد کنید.");
    return;
  }
  try {
    const initialGrammar = new GrammarManager(input);
    const step1Grammar = removeLambda(initialGrammar);
    const step2Grammar = removeUnit(step1Grammar);
    const step3Grammar = removeUseless(step2Grammar);

    // پر کردن نتایج (حتی اگر مخفی باشند)
    displayOutput("step1Output", step1Grammar);
    displayOutput("step2Output", step2Grammar);
    displayOutput("step3Output", step3Grammar);
    displayOutput("finalOutput", step3Grammar);

    // بررسی اینکه آیا گرامر تغییر کرده است یا خیر
    const initialStr = initialGrammar.toString();
    const finalStr = step3Grammar.toString();

    const stepsWrapper = document.getElementById("stepsWrapper");
    const simpleMsg = document.getElementById("simpleMsg");

    if (initialStr === finalStr) {
      // اگر ساده است: نمایش پیام و مخفی کردن مراحل
      stepsWrapper.classList.add("hidden");
      simpleMsg.classList.remove("hidden");
    } else {
      // اگر تغییر کرده: نمایش مراحل و مخفی کردن پیام
      stepsWrapper.classList.remove("hidden");
      simpleMsg.classList.add("hidden");
    }

    const resultsArea = document.getElementById("resultsArea");
    resultsArea.classList.remove("hidden");
    setTimeout(() => {
      resultsArea.scrollIntoView({ behavior: "smooth" });
    }, 100);
  } catch (e) {
    console.error(e);
    alert("خطا در پردازش. فرمت را بررسی کنید.");
  }
}

function displayOutput(elementId, grammar) {
  const container = document.getElementById(elementId);
  const str = grammar.toString();
  container.innerHTML =
    str === ""
      ? "<span class='opacity-50 italic'>گرامر تهی شد یا قانونی باقی نماند.</span>"
      : str.replace(/\n/g, "<br>");
}
