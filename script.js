import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, deleteDoc, serverTimestamp, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const cache = new Map();
const screens = {
  LANDING_PAGE: "landing_page",
  LOGIN: "login",
  SIGNUP: "signup",
  HOME: "home",
  INPUT_FORM: "input_form",
  RANKING: "ranking",
  RESULT: "result",
  ARCHIVE: "archive"
};

const MIN_INPUTS = 2;

let currentScreen = screens.LANDING_PAGE;
let inputs = [];
let sortResult = null;
let randomizeOrder = true;
let rankingTitle = "";

window.addEventListener("DOMContentLoaded", () => {
    updateScreen();

    onAuthStateChanged(auth, (user) => {
        if(user) currentScreen = screens.HOME;
        else currentScreen = screens.LANDING_PAGE;
        updateScreen();
    });
});

function attemptSubmitInput() {
    if(inputs.length < MIN_INPUTS) {
        alert("Input at least 2 entries");
    } else {
        rankingTitle = document.getElementById("title_input").value;
        if(rankingTitle == "") rankingTitle = "(Unnamed Ranking)";
        currentScreen = screens.RANKING;
        updateScreen();
    }
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

async function compareCached(a, b) {
    const key = `${a}|${b}`;
    const reverseKey = `${b}|${a}`;

    if(cache.has(key)) return cache.get(key);
    if(cache.has(reverseKey)) return !cache.get(reverseKey);

    const result = await compare(a, b);
    cache.set(key, result);
    return result;
}

async function deleteRanking(id) {
    try {
        await deleteDoc(doc(db, "rankings", id));
        console.log("Ranking deleted");
        renderArchive();
    } catch(error) {
        console.error("Error deleting ranking:", error);
    }
}

async function getRankings() {
    const rankings = [];

    try {
        const q = query(
            collection(db, "rankings"),
            where("userId", "==", auth.currentUser.uid),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);

        snapshot.forEach((doc) => {
            rankings.push({
                id: doc.id,
                ...doc.data()
            });
        });

    } catch(error) {
        console.error("Error getting rankings:", error);
    }

    return rankings;
}

async function interactiveSort() {
    if(randomizeOrder) inputs = shuffle(inputs);
    const sorted = [];
    for(const item of inputs) {
        let left = 0;
        let right = sorted.length;
        while(left < right) {
            const mid = Math.floor((left + right) / 2);
            const prefersItem = await compareCached(sorted[mid], item);
            if(prefersItem) left = mid + 1;
            else right = mid;
        }
        sorted.splice(left, 0, item);
    }
    return sorted;
}

function login(email, password) {
    signInWithEmailAndPassword(auth, email, password)
        .then(userCredential => {
            console.log("Logged in:", userCredential.user.uid);
        })
        .catch(error => {
            console.error(error.message);
            window.alert("Could not log in using those credentials.");
        });
}

onAuthStateChanged(auth, (user) => {
    if(user) currentScreen = screens.HOME;
    else currentScreen = screens.LANDING_PAGE;
    updateScreen();
});

async function renameRanking(id, oldTitle) {
    const newTitle = prompt("New ranking title:", oldTitle);

    if(newTitle == null || newTitle.trim() == "") return;

    try {
        await updateDoc(doc(db, "rankings", id), {
            title: newTitle.trim()
        });
        console.log("Ranking renamed");
        renderArchive();
    } catch(error) {
        console.error("Error renaming ranking:", error);
    }
}

async function renderArchive() {
    const content = document.getElementById("page_content");

    content.innerHTML = `
        <h2>Previous Rankings</h2>
        <div id="archive_list" class="archive_list">Loading...</div><br>
        <button id="back_button">Back</button>
    `;

    document.getElementById("back_button").onclick = () => {
        currentScreen = screens.HOME;
        updateScreen();
    };

    const rankings = await getRankings();

    const archiveList = document.getElementById("archive_list");

    if(rankings.length == 0) {
        archiveList.innerHTML = "No previous rankings.";
        return;
    }

    archiveList.innerHTML = rankings.map(ranking => `
        <div class="ranking_entry">
            <h3 class="ranking_title" data-id="${ranking.id}">
                <span>▶ ${ranking.title}</span>

                <button class="rename_button" data-id="${ranking.id}" data-title="${ranking.title}" title="Rename">
                    <i class="fa-solid fa-pencil"></i>
                </button>

                <button class="delete_button" data-id="${ranking.id}" title="Delete">
                    <i class="fa-solid fa-trash"></i>
                </button>

                <button class="rerank_button" data-id="${ranking.id}" title="Re-rank">
                    <i class="fa-solid fa-rotate"></i>
                </button>
            </h3>
            <small class="ranking_date">
                ${ranking.createdAt 
                    ? ranking.createdAt.toDate().toLocaleDateString("en-CA", {
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                    })
                    : "Unknown date"}
            </small>

            <div class="ranking_details" id="details_${ranking.id}" style="display:none;">
                <ol>
                    ${ranking.items.map(item => `<li>${item}</li>`).join("")}
                </ol>
            </div>
        </div>
        <hr>
    `).join("");

    document.querySelectorAll(".rename_button").forEach(button => {
        button.onclick = () => {
            renameRanking(
                button.dataset.id,
                button.dataset.title
            );
        };
    });

    document.querySelectorAll(".delete_button").forEach(button => {
        button.onclick = () => {
            if(confirm("Delete this ranking?")) {
                deleteRanking(button.dataset.id);
            }
        };
    });

    document.querySelectorAll(".rerank_button").forEach(button => {
        button.onclick = () => {
            rerankRanking(button.dataset.id);
        };
    });

    document.querySelectorAll(".ranking_title").forEach(title => {
        title.onclick = (event) => {
            // prevent clicking buttons from toggling
            if(event.target.closest("button")) return;

            const id = title.dataset.id;
            const details = document.getElementById(`details_${id}`);

            if(details.style.display === "none") {
                details.style.display = "block";
                title.querySelector("span").textContent =
                    title.querySelector("span").textContent.replace("▶", "▼");
            } else {
                details.style.display = "none";
                title.querySelector("span").textContent =
                    title.querySelector("span").textContent.replace("▼", "▶");
            }
        };
    });
}

function renderFormFields() {
    const settingFields = document.getElementById("settings");
    settingFields.innerHTML = `
        Ranking Title:
        <input class="user_input" id="title_input"></input><br><br>
        Randomize Order:
        <button id="randomize_order_button">${randomizeOrder ? "on" : "off"}</button>
    `;

    const inputFields = document.getElementById("inputs");
    inputFields.innerHTML = `
        <div id="inputted_entries" style="color: white"></div>
        <input class="user_input" id="input_fields"></input>
        <br/><br/>
        <button id="confirm_input_button" disabled>Confirm</button>
        <button id="back_button"">Back</button>
    `;

    const input = document.getElementById("input_fields");
    input.addEventListener("keydown", (e) => {
        if(e.key == "Enter") {
            e.preventDefault();

            const entry = input.value.trim();
            if(entry == "") attemptSubmitInput();
            else if(!inputs.includes(entry)) inputs.push(entry);

            input.value = "";
            renderInputs();
        }
    });
    
    const title_input = document.getElementById("title_input");
    title_input.addEventListener("keydown", (e) => {
        if(e.key == "Enter") {
            e.preventDefault();
            input.focus();
        }
    });

    const confirmationButton = document.getElementById("confirm_input_button");
    confirmationButton.onclick = attemptSubmitInput;

    document.getElementById("back_button").onclick = () => {
        inputs = [];
        sortResult = null;
        currentScreen = screens.HOME;
        cache.clear();
        updateScreen();
    };

    const randomizeOrderButton = document.getElementById("randomize_order_button");
    randomizeOrderButton.onclick = () => {
        randomizeOrder = !randomizeOrder;
        randomizeOrderButton.innerText = randomizeOrder ? "on" : "off";
    };
}

function renderInputs() {
    const container = document.getElementById("inputted_entries");
    if(!container) return;
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
    confirmationButton.disabled = inputs.length < MIN_INPUTS;
}

async function renderQuestion() {
    const questionElement = document.getElementById("question");
    questionElement.innerHTML = `
        <button id="option_a_button"></button>
        <button id="option_b_button"></button>
    `;
    sortResult = await interactiveSort();
    if(auth.currentUser) await saveRanking();
    currentScreen = screens.RESULT;
    updateScreen();
}

function renderResult() {
    const resultElement = document.getElementById("result");
    resultElement.innerHTML = `
        <ol>${sortResult.map(item => `<li>${item}</li>`).join("")}</ol>
        <button id="restart_button">Restart</button>
        <button id="exit_button">Exit</button>
    `;
    document.getElementById("restart_button").onclick = () => {
        inputs = [];
        sortResult = null;
        currentScreen = screens.INPUT_FORM;
        cache.clear();
        updateScreen();
    };
    document.getElementById("exit_button").onclick = () => {
        currentScreen = screens.HOME;
        updateScreen();
    }
}

async function rerankRanking(id) {
    const ranking = (await getRankings()).find(r => r.id == id);

    if(!ranking) {
        console.error("Ranking not found");
        return;
    }

    inputs = [...ranking.items];
    rankingTitle = ranking.title + " (Re-ranked)";
    sortResult = null;
    cache.clear();

    currentScreen = screens.RANKING;
    updateScreen();
}

async function saveRanking() {
    try {
        await addDoc(collection(db, "rankings"), {
            userId: auth.currentUser?.uid ?? null,
            title: rankingTitle,
            items: sortResult,
            numItems: sortResult.length,
            createdAt: serverTimestamp()
        });
        console.log("Ranking saved!");
    } catch (error) {
        console.error("Error saving ranking:", error);
    }
}

function shuffle(array) {
    const copy = [...array];
    for(let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function signup(email, password) {
    createUserWithEmailAndPassword(auth, email, password)
        .then(userCredential => {
            console.log("User created:", userCredential.user.uid);
        })
        .catch(error => {
            console.error(error.message);
        });
}

function updateScreen() {
    const content = document.getElementById("page_content");
    const bottomMenu = document.getElementById("bottom_menu");
    bottomMenu.innerHTML = "";
    const submitLogin = () => {
        const email = document.getElementById("email_input").value;
        const password = document.getElementById("password_input").value;
        login(email, password);
    };
    const submitSignup = () => {
        const email = document.getElementById("email_input").value;
        const password = document.getElementById("password_input").value;
        signup(email, password);
    };
    if(currentScreen == screens.LANDING_PAGE) {
        content.innerHTML = `
            <div style="text-align: center">
                <button id="login_button">Log In</button><br/><br/>
                <button id="signup_button">Sign Up</button><br/><br/>
                <button id="guest_button">Continue as Guest</button>
            </div>
        `;
        document.getElementById("login_button").onclick = () => {
            currentScreen = screens.LOGIN;
            updateScreen();
        }
        document.getElementById("signup_button").onclick = () => {
            currentScreen = screens.SIGNUP;
            updateScreen();
        }
        document.getElementById("guest_button").onclick = () => {
            currentScreen = screens.INPUT_FORM;
            updateScreen();
        }
    } else if(currentScreen == screens.LOGIN) {
        content.innerHTML = `
            <div style="text-align: center">
                Email:<br><input class="user_input" id="email_input"></input><br><br>
                Password:<br><input class="user_input" id="password_input" type="password"></input><br><br>
                <button id="login_button">Log In</button><br><br>
                <button id="go_back_button">Back</button>
            </div>
        `;
        document.getElementById("login_button").onclick = submitLogin;
        document.getElementById("email_input").addEventListener("keydown", (e) => {
            if(e.key === "Enter") {
                e.preventDefault();
                document.getElementById("password_input").focus();
            }
        });

        document.getElementById("password_input").addEventListener("keydown", (e) => {
            if(e.key === "Enter") {
                e.preventDefault();
                submitLogin();
            }
        });
        document.getElementById("go_back_button").onclick = () => {
            currentScreen = screens.LANDING_PAGE;
            updateScreen();
        }
    } else if(currentScreen == screens.SIGNUP) {
        content.innerHTML = `
            <div style="text-align: center">
                Email:<br><input class="user_input" id="email_input"></input><br><br>
                Password:<br><input class="user_input" id="password_input" type="password"></input><br><br>
                <button id="signup_button">Sign Up</button><br><br>
                <button id="go_back_button">Back</button>
            </div>
        `;
        document.getElementById("signup_button").onclick = submitSignup;
        document.getElementById("email_input").addEventListener("keydown", (e) => {
            if(e.key === "Enter") {
                e.preventDefault();
                document.getElementById("password_input").focus();
            }
        });
        document.getElementById("password_input").addEventListener("keydown", (e) => {
            if(e.key === "Enter") {
                e.preventDefault();
                submitSignup();
            }
        });
        document.getElementById("go_back_button").onclick = () => {
            currentScreen = screens.LANDING_PAGE;
            updateScreen();
        }
    } else if(currentScreen == screens.HOME) {
        content.innerHTML = `
            <button id="new_button">New Ranking</button>
            <button id="archives_button">Previous Rankings</button>
        `;
        document.getElementById("new_button").onclick = () => {
            currentScreen = screens.INPUT_FORM;
            updateScreen();
        }
        document.getElementById("archives_button").onclick = () => {
            currentScreen = screens.ARCHIVE;
            updateScreen();
        }
    } else if(currentScreen == screens.INPUT_FORM) {
        content.innerHTML = `
            <h2>Settings</h2>
            <div id="settings"></div>
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
    } else if(currentScreen == screens.RESULT) {
        content.innerHTML = `
            <h2>Results</h2>
            <div id="result"></div>
        `;
        renderResult();
    } else if(currentScreen == screens.ARCHIVE) {
        renderArchive();
    } else {
        inputs = [];
        sortResult = null;
        content.innerHTML = "";
    }
    if(auth.currentUser) {
        bottomMenu.innerHTML = `
            <button id="logout_button">Log Out</button><br><br>
        `;
        document.getElementById("logout_button").onclick = () => {
            signOut(auth);
        };
    } else if(
        currentScreen != screens.LANDING_PAGE && 
        currentScreen != screens.LOGIN && 
        currentScreen != screens.SIGNUP
    ) {
        bottomMenu.innerHTML = `
            <button id="login_button">Log In</button><br><br>
            <button id="signup_button">Sign Up</button><br><br>
        `;
        document.getElementById("login_button").onclick = () => {
            currentScreen = screens.LOGIN;
            updateScreen();
        };
        document.getElementById("signup_button").onclick = () => {
            currentScreen = screens.SIGNUP;
            updateScreen();
        };
    }
}