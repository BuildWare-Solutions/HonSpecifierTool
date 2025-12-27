/* =========================
   Storage + State
========================= */

const STORAGE_KEY = "sae_app_state_v1";

function defaultState() {
    const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    return {
        project: {
            systemsIntegratorId: "",
            projectAutoId: id,
            projectName: "",
            buildingsCount: 1
        },
        building: {
            items: [
                { name: "Building 1", floors: 1, approxDevices: 50 }
            ]
        },
        solution: {
            connectivity: "LAN",
            includesCloud: false,
            integrations: {
                bms: true,
                accessControl: false,
                cctv: false
            }
        }
    };
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultState();
        const parsed = JSON.parse(raw);
        // light validation: ensure required top keys
        if (!parsed || typeof parsed !== "object") return defaultState();
        if (!parsed.project || !parsed.building || !parsed.solution) return defaultState();
        return parsed;
    } catch {
        return defaultState();
    }
}

function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* =========================
   Router
========================= */

const ROUTES = ["project", "building", "solution"];

function getRoute() {
    const hash = (location.hash || "#project").replace("#", "");
    return ROUTES.includes(hash) ? hash : "project";
}

function navTo(route) {
    location.hash = route;
}

window.addEventListener("hashchange", render);

/* =========================
   UI Elements
========================= */

const viewRoot = document.getElementById("viewRoot");

// Drawer
const hamburgerBtn = document.getElementById("hamburgerBtn");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const drawerCloseBtn = document.getElementById("drawerCloseBtn");

function openDrawer() {
    drawer.classList.add("is-open");
    drawerOverlay.hidden = false;
    drawer.setAttribute("aria-hidden", "false");
}
function closeDrawer() {
    drawer.classList.remove("is-open");
    drawerOverlay.hidden = true;
    drawer.setAttribute("aria-hidden", "true");
}

hamburgerBtn?.addEventListener("click", openDrawer);
drawerCloseBtn?.addEventListener("click", closeDrawer);
drawerOverlay?.addEventListener("click", closeDrawer);

// Desktop process nav click
document.querySelectorAll(".process__item").forEach(btn => {
    btn.addEventListener("click", () => navTo(btn.dataset.route));
});

// Drawer nav click
document.querySelectorAll(".drawer__link").forEach(btn => {
    btn.addEventListener("click", () => {
        closeDrawer();
        navTo(btn.dataset.route);
    });
});

// JSON load
const jsonFileInput = document.getElementById("jsonFileInput");

/* =========================
   Helpers
========================= */

function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === "class") node.className = v;
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
        else if (k === "text") node.textContent = v;
        else node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c == null) return;
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
}

function clampInt(n, min, max) {
    const x = Number.parseInt(n, 10);
    if (Number.isNaN(x)) return min;
    return Math.min(max, Math.max(min, x));
}

function ensureBuildingItemsMatchCount() {
    const count = clampInt(state.project.buildingsCount, 1, 50);
    state.project.buildingsCount = count;

    const items = state.building.items || [];
    if (items.length < count) {
        for (let i = items.length; i < count; i++) {
            items.push({
                name: `Building ${i + 1}`,
                floors: 1,
                approxDevices: 50
            });
        }
    } else if (items.length > count) {
        items.length = count;
    }
    state.building.items = items;
}

function computeSummary() {
    const b = state.building.items || [];
    const totalFloors = b.reduce((a, x) => a + (Number(x.floors) || 0), 0);
    const totalDevices = b.reduce((a, x) => a + (Number(x.approxDevices) || 0), 0);

    return {
        buildings: b.length,
        totalFloors,
        totalDevices
    };
}

/* =========================
   Views (Dynamic)
========================= */

function viewProject() {
    // schema-driven (simple)
    const schema = [
        { key: "systemsIntegratorId", label: "Systems Integrator ID", type: "text", placeholder: "12345" },
        { key: "projectAutoId", label: "Project Auto-ID", type: "text", readonly: true },
        { key: "projectName", label: "Project Name", type: "text", placeholder: "Multi-Building West Park Campus" }
    ];

    const title = el("div", { class: "h1", text: "Project details" });

    const form = el("div", { class: "form" });

    schema.forEach(f => {
        const input = el("input", {
            class: "input",
            type: f.type,
            value: state.project[f.key] ?? "",
            placeholder: f.placeholder || "",
            ...(f.readonly ? { readonly: "true" } : {}),
            oninput: (e) => {
                state.project[f.key] = e.target.value;
                saveState(state);
            }
        });

        form.appendChild(
            el("div", { class: "field" }, [
                el("label", { text: f.label }),
                input
            ])
        );
    });

    // building count affects next screens dynamically
    const countInput = el("input", {
        class: "input",
        type: "number",
        min: "1",
        max: "50",
        value: String(state.project.buildingsCount ?? 1),
        oninput: (e) => {
            state.project.buildingsCount = clampInt(e.target.value, 1, 50);
            ensureBuildingItemsMatchCount();
            saveState(state);
        }
    });

    form.appendChild(
        el("div", { class: "field" }, [
            el("label", { text: "Number of buildings" }),
            countInput
        ])
    );

    const actions = el("div", { class: "actions" });

    const loadBtn = el("button", {
        class: "btn secondary",
        type: "button",
        text: "LOAD EXISTING PROJECT",
        onclick: () => jsonFileInput.click()
    });

    const nextBtn = el("button", {
        class: "btn",
        type: "button",
        text: "NEXT",
        onclick: () => navTo("building")
    });

    actions.append(loadBtn, nextBtn);

    const note = el("div", {
        class: "small-note",
        text: "Data is saved automatically to this browser (local storage)."
    });

    return el("div", {}, [title, form, actions, note]);
}

function viewBuilding() {
    ensureBuildingItemsMatchCount();

    const title = el("div", { class: "h1", text: "Building details" });

    const form = el("div", { class: "form" });

    state.building.items.forEach((b, idx) => {
        const card = el("div", { class: "mini-card" });

        card.appendChild(el("div", { class: "mini-card__title", text: `Building ${idx + 1}` }));

        const name = el("input", {
            class: "input",
            type: "text",
            value: b.name ?? "",
            oninput: (e) => {
                state.building.items[idx].name = e.target.value;
                saveState(state);
            }
        });

        const floors = el("input", {
            class: "input",
            type: "number",
            min: "1",
            max: "200",
            value: String(b.floors ?? 1),
            oninput: (e) => {
                state.building.items[idx].floors = clampInt(e.target.value, 1, 200);
                saveState(state);
            }
        });

        const devices = el("input", {
            class: "input",
            type: "number",
            min: "0",
            max: "100000",
            value: String(b.approxDevices ?? 0),
            oninput: (e) => {
                state.building.items[idx].approxDevices = clampInt(e.target.value, 0, 100000);
                saveState(state);
            }
        });

        card.appendChild(
            el("div", { class: "field" }, [
                el("label", { text: "Building name" }),
                name
            ])
        );

        card.appendChild(
            el("div", { class: "row" }, [
                el("div", { class: "field" }, [el("label", { text: "Floors" }), floors]),
                el("div", { class: "field" }, [el("label", { text: "Approx. devices" }), devices])
            ])
        );

        form.appendChild(card);
    });

    const actions = el("div", { class: "actions" });

    const backBtn = el("button", {
        class: "btn secondary",
        type: "button",
        text: "BACK",
        onclick: () => navTo("project")
    });

    const nextBtn = el("button", {
        class: "btn",
        type: "button",
        text: "NEXT",
        onclick: () => navTo("solution")
    });

    actions.append(backBtn, nextBtn);

    return el("div", {}, [title, form, actions]);
}

function viewSolution() {
    ensureBuildingItemsMatchCount();
    const summary = computeSummary();

    const title = el("div", { class: "h1", text: "Solution" });

    const form = el("div", { class: "form" });

    // Summary (computed from previous screens)
    const summaryBox = el("div", { class: "mini-card" }, [
        el("div", { class: "mini-card__title", text: "Project summary (computed)" }),
        el("div", { class: "small-note", text: `Buildings: ${summary.buildings}` }),
        el("div", { class: "small-note", text: `Total floors: ${summary.totalFloors}` }),
        el("div", { class: "small-note", text: `Approx. devices: ${summary.totalDevices}` })
    ]);

    form.appendChild(summaryBox);

    // Connectivity
    const connectivity = el("select", {
        class: "select",
        onchange: (e) => {
            state.solution.connectivity = e.target.value;
            saveState(state);
        }
    }, [
        el("option", { value: "LAN", text: "LAN (On-prem)" }),
        el("option", { value: "WAN", text: "WAN (Multi-site)" }),
        el("option", { value: "VPN", text: "VPN / Secure Tunnel" })
    ]);

    connectivity.value = state.solution.connectivity ?? "LAN";

    form.appendChild(
        el("div", { class: "field" }, [
            el("label", { text: "Connectivity" }),
            connectivity
        ])
    );

    // Cloud toggle
    const cloudToggle = el("input", {
        type: "checkbox",
        ...(state.solution.includesCloud ? { checked: "true" } : {}),
        onchange: (e) => {
            state.solution.includesCloud = e.target.checked;
            saveState(state);
        }
    });

    form.appendChild(
        el("div", { class: "mini-card" }, [
            el("div", { class: "mini-card__title", text: "Options" }),
            el("label", { class: "small-note" }, [
                cloudToggle,
                document.createTextNode(" Include cloud component")
            ])
        ])
    );

    // Integrations (example)
    const integrationsCard = el("div", { class: "mini-card" }, [
        el("div", { class: "mini-card__title", text: "Integrations" })
    ]);

    const integrationKeys = [
        { key: "bms", label: "BMS" },
        { key: "accessControl", label: "Access Control" },
        { key: "cctv", label: "CCTV" }
    ];

    integrationKeys.forEach(i => {
        const cb = el("input", {
            type: "checkbox",
            ...(state.solution.integrations?.[i.key] ? { checked: "true" } : {}),
            onchange: (e) => {
                state.solution.integrations = state.solution.integrations || {};
                state.solution.integrations[i.key] = e.target.checked;
                saveState(state);
            }
        });

        integrationsCard.appendChild(
            el("label", { class: "small-note" }, [
                cb,
                document.createTextNode(` ${i.label}`)
            ])
        );
    });

    form.appendChild(integrationsCard);

    // Export state (helpful for sharing)
    const exportBtn = el("button", {
        class: "btn secondary",
        type: "button",
        text: "EXPORT JSON",
        onclick: () => {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `project-${state.project.projectAutoId}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    });

    const backBtn = el("button", {
        class: "btn secondary",
        type: "button",
        text: "BACK",
        onclick: () => navTo("building")
    });

    const resetBtn = el("button", {
        class: "btn",
        type: "button",
        text: "RESET PROJECT",
        onclick: () => {
            state = defaultState();
            saveState(state);
            render();
        }
    });

    const actions = el("div", { class: "actions" }, [backBtn, exportBtn, resetBtn]);

    return el("div", {}, [title, form, actions]);
}

/* =========================
   Render + Nav state
========================= */

function updateNavUI(route) {
    // Desktop process state
    const items = Array.from(document.querySelectorAll(".process__item"));
    const lines = Array.from(document.querySelectorAll(".process__line"));

    const idx = ROUTES.indexOf(route);

    items.forEach((btn, i) => {
        btn.classList.toggle("is-active", i === idx);
        btn.classList.toggle("is-done", i < idx);
    });

    lines.forEach((line, i) => {
        // line i is between step i and i+1
        line.classList.toggle("is-done", i < idx);
    });

    // Drawer active link
    document.querySelectorAll(".drawer__link").forEach(btn => {
        btn.classList.toggle("is-active", btn.dataset.route === route);
    });
}

function render() {
    const route = getRoute();
    updateNavUI(route);

    viewRoot.innerHTML = "";
    let node;

    if (route === "project") node = viewProject();
    if (route === "building") node = viewBuilding();
    if (route === "solution") node = viewSolution();

    viewRoot.appendChild(node);
}

render();

/* =========================
   JSON Load Handling
========================= */

jsonFileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        // minimal shape check
        if (!parsed?.project || !parsed?.building || !parsed?.solution) {
            alert("Invalid JSON format. Expected: { project, building, solution }");
            return;
        }

        // if missing auto id, create one
        if (!parsed.project.projectAutoId) {
            parsed.project.projectAutoId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
        }

        state = parsed;
        ensureBuildingItemsMatchCount();
        saveState(state);

        navTo("project");
        render();
    } catch (err) {
        console.error(err);
        alert("Failed to load JSON. Please ensure it is valid JSON.");
    } finally {
        // allow re-selecting same file
        e.target.value = "";
    }
});

/* =========================
   PWA: Service Worker
========================= */

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(console.error);
    });
}
