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

function updateScreen() {
    const content = document.getElementById("page_content");
    if(currentScreen == screens.INPUT_FORM) {
        content.innerHTML = `
            <h2>Inputs</h2>
            <div id="inputs"></div>
        `;
        renderFormFields();
    } else {
        inputs = [];
        content.innerHTML = "";
    }
}