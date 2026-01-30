import { app } from "../../scripts/app.js";

// ─── Color mapping by type ───
const TYPE_COLORS = {
    MODEL:        { color: "#224", bgcolor: "#335" },
    CLIP:         { color: "#432", bgcolor: "#653" },
    VAE:          { color: "#323", bgcolor: "#535" },
    CONDITIONING: { color: "#322", bgcolor: "#533" },
    LATENT:       { color: "#242", bgcolor: "#353" },
    IMAGE:        { color: "#234", bgcolor: "#346" },
    MASK:         { color: "#1c5715", bgcolor: "#1f401b" },
    STRING:       { color: "#432", bgcolor: "#542" },
    INT:          { color: "#233", bgcolor: "#344" },
    FLOAT:        { color: "#233", bgcolor: "#344" },
};

function applyColorByType(node, type) {
    const colors = TYPE_COLORS[type];
    if (colors) {
        node.color = colors.color;
        node.bgcolor = colors.bgcolor;
    }
}

app.registerExtension({
    name: "IXIWORKS.GetSetNodes",

    async nodeCreated(node) {
        // ─── SetNode ───
        if (node.comfyClass === "IXISetNode") {
            node.isVirtualNode = true;
            node.serialize_widgets = true;

            if (!node.properties) node.properties = {};
            node.properties.previousName = "";

            // Remove Python-defined inputs/outputs and rebuild
            while (node.inputs.length > 0) node.removeInput(0);
            while (node.outputs.length > 0) node.removeOutput(0);
            node.widgets.length = 0;

            // Add name widget
            node.addWidget("text", "Name", "", (value) => {
                node.validateName(node.graph);
                if (value !== "") {
                    node.title = "Set: " + value;
                }
                node.updateGetters();
                node.properties.previousName = value;
            });

            // Add wildcard input/output
            node.addInput("*", "*");
            node.addOutput("*", "*");

            node.validateName = function (graph) {
                if (!graph) return;
                let name = node.widgets[0].value;
                if (name === "") return;

                const existing = new Set();
                graph._nodes.forEach((n) => {
                    if (n !== node && n.comfyClass === "IXISetNode") {
                        if (n.widgets && n.widgets[0]) {
                            existing.add(n.widgets[0].value);
                        }
                    }
                });

                let baseName = name;
                let counter = 0;
                while (existing.has(name)) {
                    name = baseName + "_" + counter;
                    counter++;
                }
                node.widgets[0].value = name;
            };

            node.updateGetters = function () {
                if (!node.graph) return;

                // Update type on matching GetNodes
                node.graph._nodes
                    .filter((n) => n.comfyClass === "IXIGetNode" && n.widgets[0] && n.widgets[0].value === node.widgets[0].value)
                    .forEach((getter) => {
                        if (getter.setType) getter.setType(node.inputs[0].type);
                    });

                // Rename GetNodes that had previous name
                if (node.properties.previousName) {
                    node.graph._nodes
                        .filter((n) => n.comfyClass === "IXIGetNode" && n.widgets[0] && n.widgets[0].value === node.properties.previousName)
                        .forEach((getter) => {
                            if (getter.setGetName) getter.setGetName(node.widgets[0].value);
                        });
                }
            };

            const origOnConnectionsChange = node.onConnectionsChange;
            node.onConnectionsChange = function (slotType, slot, isConnect, linkInfo) {
                if (origOnConnectionsChange) origOnConnectionsChange.apply(this, arguments);
                if (!node.graph || !linkInfo) return;

                if (slotType === 1 && isConnect) {
                    const originNode = node.graph.getNodeById(linkInfo.origin_id);
                    if (originNode && originNode.outputs && originNode.outputs[linkInfo.origin_slot]) {
                        const type = originNode.outputs[linkInfo.origin_slot].type;
                        node.inputs[0].type = type;
                        node.inputs[0].name = type;
                        node.outputs[0].type = type;
                        node.outputs[0].name = type;
                        applyColorByType(node, type);
                        node.updateGetters();
                    }
                }

                if (slotType === 1 && !isConnect) {
                    node.inputs[0].type = "*";
                    node.inputs[0].name = "*";
                    node.outputs[0].type = "*";
                    node.outputs[0].name = "*";
                    node.color = undefined;
                    node.bgcolor = undefined;
                    node.updateGetters();
                }
            };

            const origOnAdded = node.onAdded;
            node.onAdded = function (graph) {
                if (origOnAdded) origOnAdded.apply(this, arguments);
                node.validateName(graph);
            };

            const origOnRemoved = node.onRemoved;
            node.onRemoved = function () {
                if (origOnRemoved) origOnRemoved.apply(this, arguments);
            };

            node.setSize(node.computeSize());
        }

        // ─── GetNode ───
        if (node.comfyClass === "IXIGetNode") {
            node.isVirtualNode = true;
            node.serialize_widgets = true;

            // Remove Python-defined inputs/outputs and rebuild
            while (node.inputs.length > 0) node.removeInput(0);
            while (node.outputs.length > 0) node.removeOutput(0);
            node.widgets.length = 0;

            // Add combo widget listing all SetNode names
            node.addWidget("combo", "Name", "", (value) => {
                node.onRename();
            }, {
                values: () => {
                    if (!node.graph) return [""];
                    const setters = node.graph._nodes.filter(
                        (n) => n.comfyClass === "IXISetNode"
                    );
                    const names = setters
                        .map((n) => (n.widgets && n.widgets[0]) ? n.widgets[0].value : "")
                        .filter((v) => v !== "")
                        .sort();
                    return names.length > 0 ? names : [""];
                }
            });

            // Add wildcard output
            node.addOutput("*", "*");

            node.onRename = function () {
                const setter = node.findSetter();
                if (setter) {
                    const type = setter.inputs[0].type;
                    node.setType(type);
                    node.title = "Get: " + setter.widgets[0].value;
                    applyColorByType(node, type);
                } else {
                    node.setType("*");
                    node.title = "Get";
                    node.color = undefined;
                    node.bgcolor = undefined;
                }
            };

            node.setGetName = function (name) {
                node.widgets[0].value = name;
                node.onRename();
            };

            node.setType = function (type) {
                node.outputs[0].name = type;
                node.outputs[0].type = type;
            };

            node.findSetter = function () {
                if (!node.graph) return null;
                const name = node.widgets[0].value;
                if (!name) return null;
                return node.graph._nodes.find(
                    (n) => n.comfyClass === "IXISetNode" && n.widgets[0] && n.widgets[0].value === name
                );
            };

            // Key method: resolves virtual connection at queue time
            node.getInputLink = function (slot) {
                const setter = node.findSetter();
                if (setter) {
                    const slotInfo = setter.inputs[slot];
                    if (slotInfo && slotInfo.link != null) {
                        return node.graph.links[slotInfo.link];
                    }
                }
                return null;
            };

            node.setSize(node.computeSize());
        }
    }
});
