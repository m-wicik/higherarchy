const MIN_INPUTS = 2;

const screens = {
  INPUT_FORM: "input_form",
  RANKING: "ranking",
  RESULT: "result"
};

let currentScreen = screens.INPUT_FORM;
let inputs = [];

updateScreen();

function renderFormFields() {
    const inputFields = document.getElementById("inputs");
    inputFields.innerHTML = `
        <div id="inputted_entries" style="color: white"></div>
        <input class="user_input" id="input_fields"></input>
        <br/><br/>
        <button id="confirm_input_button" style="opacity: 25%">Confirm</button>
    `;

    const input = document.getElementById("input_fields");
    input.addEventListener("keydown", (e) => {
        if(e.key == "Enter") {
            e.preventDefault();

            const entry = input.value.trim();
            if(entry == "") return;
            if(!inputs.includes(entry)) inputs.push(entry);

            input.value = "";
            renderInputs();
        }
    });

    const confirmationButton = document.getElementById("confirm_input_button");
    confirmationButton.onclick = () => {
        if(inputs.length < MIN_INPUTS) {
            alert("Input at least 2 entries");
        } else {
            currentScreen = screens.RANKING;
            updateScreen();
        }
    };
}

function renderInputs() {
    const container = document.getElementById("inputted_entries");
    container.innerHTML = "";

    const numInputted = inputs.length;
    if(numInputted > 0) {
        container.style.marginBottom = "10px";
    } else {
        container.style.marginBottom = "0px";
    }
    for(let i = 0; i < numInputted; i++) {
        const entry = inputs[i];

        const tag = document.createElement("span");
        tag.innerHTML = `${i + 1}. ${entry} ✕<br>`;
        tag.style.marginRight = "8px";
        tag.style.cursor = "pointer";

        tag.onclick = () => {
            inputs.splice(inputs.indexOf(entry), 1);
            renderInputs();
        };

        container.appendChild(tag);
    }
    
    const confirmationButton = document.getElementById("confirm_input_button");
    confirmationButton.style.opacity = inputs.length < MIN_INPUTS ? 0.25 : 1;
}

async function renderQuestion() {
    const questionElement = document.getElementById("question");
    questionElement.innerHTML = `
        <button id="option_a_button"></button>
        <button id="option_b_button"></button>
    `;   
    const sortResult = await interactiveSort();
    alert(`Sorted result: ${sortResult.join(" > ")}`);
}

async function interactiveSort() {
    const sorted = [];
    for(const item of inputs) {
        let left = 0;
        let right = sorted.length;
        while(left < right) {
            const mid = Math.floor((left + right) / 2);
            const prefersItem = await compareCached(item, sorted[mid]);
            if(prefersItem) right = mid;
            else left = mid + 1;
        }
        sorted.splice(left, 0, item);
    }
    return sorted;
}

const cache = new Map();

async function compareCached(a, b) {
    const key = `${a}|${b}`;
    const reverseKey = `${b}|${a}`;

    if(cache.has(key)) return cache.get(key);
    if(cache.has(reverseKey)) return !cache.get(reverseKey);

    const result = await compare(a, b);
    cache.set(key, result);
    return result;
}

function compare(a, b) {
    return new Promise(resolve => {
        const buttonA = document.getElementById("option_a_button");
        const buttonB = document.getElementById("option_b_button");
        buttonA.textContent = a;
        buttonB.textContent = b;
        const handleA = () => {
            cleanup();
            resolve(true);
        };
        const handleB = () => {
            cleanup();
            resolve(false);
        };
        function cleanup() {
            buttonA.removeEventListener("click", handleA);
            buttonB.removeEventListener("click", handleB);
        }
        buttonA.addEventListener("click", handleA);
        buttonB.addEventListener("click", handleB);
    });
}

function updateScreen() {
    const content = document.getElementById("page_content");
    if(currentScreen == screens.INPUT_FORM) {
        content.innerHTML = `
            <h2>Inputs</h2>
            <div id="inputs"></div>
        `;
        renderFormFields();
    } else if(currentScreen == screens.RANKING) {
        content.innerHTML = `
            <h2>Which do you prefer?</h2>
            <div id="question"></div>
        `;
        renderQuestion();
    } else {
        inputs = [];
        content.innerHTML = "";
    }
}