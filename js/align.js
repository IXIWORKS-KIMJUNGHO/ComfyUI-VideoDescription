import { app } from "../../scripts/app.js";

function getSelectedNodes(canvas) {
    return Object.values(canvas.selected_nodes || {});
}

function alignNodes(nodes, direction) {
    if (nodes.length < 2) return;
    switch (direction) {
        case "left": {
            const minX = Math.min(...nodes.map((n) => n.pos[0]));
            nodes.forEach((n) => (n.pos[0] = minX));
            break;
        }
        case "right": {
            const maxX = Math.max(...nodes.map((n) => n.pos[0] + n.size[0]));
            nodes.forEach((n) => (n.pos[0] = maxX - n.size[0]));
            break;
        }
        case "top": {
            const minY = Math.min(...nodes.map((n) => n.pos[1]));
            nodes.forEach((n) => (n.pos[1] = minY));
            break;
        }
        case "bottom": {
            const maxY = Math.max(...nodes.map((n) => n.pos[1] + n.size[1]));
            nodes.forEach((n) => (n.pos[1] = maxY - n.size[1]));
            break;
        }
        case "centerH": {
            const centerX = nodes.reduce((s, n) => s + n.pos[0] + n.size[0] / 2, 0) / nodes.length;
            nodes.forEach((n) => (n.pos[0] = centerX - n.size[0] / 2));
            break;
        }
        case "centerV": {
            const centerY = nodes.reduce((s, n) => s + n.pos[1] + n.size[1] / 2, 0) / nodes.length;
            nodes.forEach((n) => (n.pos[1] = centerY - n.size[1] / 2));
            break;
        }
    }
    app.graph.setDirtyCanvas(true, true);
}

function matchSize(nodes, mode) {
    if (nodes.length < 2) return;
    switch (mode) {
        case "width": {
            const maxW = Math.max(...nodes.map((n) => n.size[0]));
            nodes.forEach((n) => (n.size[0] = maxW));
            break;
        }
        case "height": {
            const maxH = Math.max(...nodes.map((n) => n.size[1]));
            nodes.forEach((n) => (n.size[1] = maxH));
            break;
        }
        case "both": {
            const maxW = Math.max(...nodes.map((n) => n.size[0]));
            const maxH = Math.max(...nodes.map((n) => n.size[1]));
            nodes.forEach((n) => { n.size[0] = maxW; n.size[1] = maxH; });
            break;
        }
    }
    app.graph.setDirtyCanvas(true, true);
}

function distributeNodes(nodes, axis) {
    if (nodes.length < 3) return;
    if (axis === "horizontal") {
        nodes.sort((a, b) => a.pos[0] - b.pos[0]);
        const first = nodes[0].pos[0];
        const last = nodes[nodes.length - 1].pos[0];
        const step = (last - first) / (nodes.length - 1);
        nodes.forEach((n, i) => (n.pos[0] = first + step * i));
    } else {
        nodes.sort((a, b) => a.pos[1] - b.pos[1]);
        const first = nodes[0].pos[1];
        const last = nodes[nodes.length - 1].pos[1];
        const step = (last - first) / (nodes.length - 1);
        nodes.forEach((n, i) => (n.pos[1] = first + step * i));
    }
    app.graph.setDirtyCanvas(true, true);
}

// Chord shortcuts: hold Q/W/E/R + press number key
const CHORD_MAP = {
    q: { 1: "align:left", 2: "align:right", 3: "align:top", 4: "align:bottom" },
    w: { 1: "center:centerH", 2: "center:centerV" },
    e: { 1: "dist:horizontal", 2: "dist:vertical" },
    r: { 1: "match:width", 2: "match:height", 3: "match:both" },
};

function executeChord(action, canvas) {
    const selected = getSelectedNodes(canvas);
    const [group, param] = action.split(":");
    if (group === "align") alignNodes(selected, param);
    else if (group === "center") alignNodes(selected, param);
    else if (group === "dist") distributeNodes(selected, param);
    else if (group === "match") matchSize(selected, param);
}

app.registerExtension({
    name: "IXIWORKS.NodeAlign",

    async setup() {
        let heldKey = null;

        window.addEventListener("keydown", (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
            const key = e.key.toLowerCase();

            if (key in CHORD_MAP && !heldKey) {
                heldKey = key;
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (heldKey && CHORD_MAP[heldKey]) {
                const action = CHORD_MAP[heldKey][key];
                if (action) {
                    const canvas = app.canvas;
                    if (canvas) executeChord(action, canvas);
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        }, true);

        window.addEventListener("keyup", (e) => {
            if (e.key.toLowerCase() === heldKey) heldKey = null;
        }, true);

        const origGetMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
        LGraphCanvas.prototype.getCanvasMenuOptions = function () {
            const options = origGetMenuOptions.apply(this, arguments);
            const selected = getSelectedNodes(this);

            if (selected.length >= 2) {
                options.push(null);
                options.push({
                    content: "Align Nodes",
                    submenu: {
                        options: [
                            { content: "Align Left", callback: () => alignNodes(selected, "left") },
                            { content: "Align Right", callback: () => alignNodes(selected, "right") },
                            { content: "Align Top", callback: () => alignNodes(selected, "top") },
                            { content: "Align Bottom", callback: () => alignNodes(selected, "bottom") },
                            null,
                            { content: "Center Horizontal", callback: () => alignNodes(selected, "centerH") },
                            { content: "Center Vertical", callback: () => alignNodes(selected, "centerV") },
                            null,
                            { content: "Distribute Horizontal", callback: () => distributeNodes(selected, "horizontal") },
                            { content: "Distribute Vertical", callback: () => distributeNodes(selected, "vertical") },
                            null,
                            { content: "Match Width", callback: () => matchSize(selected, "width") },
                            { content: "Match Height", callback: () => matchSize(selected, "height") },
                            { content: "Match Size", callback: () => matchSize(selected, "both") },
                        ]
                    }
                });
            }

            return options;
        };
    }
});
