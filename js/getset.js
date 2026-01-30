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

    async setup() {
        const LGraphNode = LiteGraph.LGraphNode;

        // ─── SetNode ───
        class SetNode extends LGraphNode {
            constructor(title) {
                super(title);
                this.properties = this.properties || {};
                this.properties.previousName = "";
                this.serialize_widgets = true;
                this.isVirtualNode = true;

                this.addWidget("text", "Name", "", (value) => {
                    this.validateName(this.graph);
                    if (value !== "") {
                        this.title = "Set: " + value;
                    }
                    this.update();
                    this.properties.previousName = value;
                });

                this.addInput("*", "*");
                this.addOutput("*", "*");
            }

            onAdded(graph) {
                this.validateName(graph);
            }

            onRemoved() {
                const allGetters = this.graph._nodes.filter(
                    (n) => n.type === "IXI_SetNode"
                );
                allGetters.forEach((getter) => {
                    if (getter.refreshComboValues) {
                        getter.refreshComboValues();
                    }
                });
            }

            onConnectionsChange(slotType, slot, isConnect, linkInfo) {
                if (!this.graph || !linkInfo) return;

                // Input connected
                if (slotType === 1 && isConnect) {
                    const originNode = this.graph.getNodeById(linkInfo.origin_id);
                    if (originNode) {
                        const outputSlot = originNode.outputs[linkInfo.origin_slot];
                        if (outputSlot && outputSlot.type) {
                            const type = outputSlot.type;
                            this.inputs[0].type = type;
                            this.inputs[0].name = type;
                            this.outputs[0].type = type;
                            this.outputs[0].name = type;
                            applyColorByType(this, type);
                            this.update();
                        }
                    }
                }

                // Input disconnected
                if (slotType === 1 && !isConnect) {
                    this.inputs[0].type = "*";
                    this.inputs[0].name = "*";
                    this.outputs[0].type = "*";
                    this.outputs[0].name = "*";
                    this.color = undefined;
                    this.bgcolor = undefined;
                    this.update();
                }
            }

            validateName(graph) {
                if (!graph) return;
                let name = this.widgets[0].value;
                if (name === "") return;

                const existing = new Set();
                graph._nodes.forEach((n) => {
                    if (n !== this && n.type === "IXI_SetNode") {
                        existing.add(n.widgets[0].value);
                    }
                });

                let baseName = name;
                let counter = 0;
                while (existing.has(name)) {
                    name = baseName + "_" + counter;
                    counter++;
                }
                this.widgets[0].value = name;
            }

            update() {
                if (!this.graph) return;

                // Update matching GetNodes type
                const getters = this.graph._nodes.filter(
                    (n) => n.type === "IXI_GetNode" && n.widgets[0].value === this.widgets[0].value
                );
                getters.forEach((getter) => {
                    getter.setType(this.inputs[0].type);
                });

                // Update GetNodes that had previous name
                if (this.properties.previousName) {
                    const prevGetters = this.graph._nodes.filter(
                        (n) => n.type === "IXI_GetNode" && n.widgets[0].value === this.properties.previousName
                    );
                    prevGetters.forEach((getter) => {
                        getter.setName(this.widgets[0].value);
                    });
                }

                // Refresh all GetNode dropdowns
                const allGetters = this.graph._nodes.filter(
                    (n) => n.type === "IXI_GetNode"
                );
                allGetters.forEach((getter) => {
                    if (getter.refreshComboValues) {
                        getter.refreshComboValues();
                    }
                });
            }

            clone() {
                const cloned = super.clone();
                cloned.inputs[0].name = "*";
                cloned.inputs[0].type = "*";
                cloned.outputs[0].name = "*";
                cloned.outputs[0].type = "*";
                cloned.widgets[0].value = "";
                cloned.properties.previousName = "";
                cloned.title = "Set";
                cloned.color = undefined;
                cloned.bgcolor = undefined;
                cloned.size = cloned.computeSize();
                return cloned;
            }
        }

        // ─── GetNode ───
        class GetNode extends LGraphNode {
            constructor(title) {
                super(title);
                this.properties = this.properties || {};
                this.serialize_widgets = true;
                this.isVirtualNode = true;

                const node = this;

                this.addWidget("combo", "Name", "", (value) => {
                    this.onRename();
                }, {
                    values: () => {
                        if (!node.graph) return [""];
                        const setters = node.graph._nodes.filter(
                            (n) => n.type === "IXI_SetNode"
                        );
                        const names = setters
                            .map((n) => n.widgets[0].value)
                            .filter((v) => v !== "")
                            .sort();
                        return names.length > 0 ? names : [""];
                    }
                });

                this.addOutput("*", "*");
            }

            onRename() {
                const setter = this.findSetter();
                if (setter) {
                    const type = setter.inputs[0].type;
                    this.setType(type);
                    this.title = "Get: " + setter.widgets[0].value;
                    applyColorByType(this, type);
                } else {
                    this.setType("*");
                    this.title = "Get";
                    this.color = undefined;
                    this.bgcolor = undefined;
                }
            }

            setName(name) {
                this.widgets[0].value = name;
                this.onRename();
            }

            setType(type) {
                this.outputs[0].name = type;
                this.outputs[0].type = type;
                this.validateLinks();
            }

            validateLinks() {
                if (!this.graph || !this.outputs[0].links) return;
                const type = this.outputs[0].type;
                if (type === "*") return;

                this.outputs[0].links.slice().forEach((linkId) => {
                    const link = this.graph.links[linkId];
                    if (link && link.type !== "*" && link.type !== type) {
                        this.graph.removeLink(linkId);
                    }
                });
            }

            refreshComboValues() {
                // Widget values callback handles dynamic refresh
            }

            findSetter() {
                if (!this.graph) return null;
                const name = this.widgets[0].value;
                if (!name) return null;
                return this.graph._nodes.find(
                    (n) => n.type === "IXI_SetNode" && n.widgets[0].value === name
                );
            }

            // Key method: resolves virtual connection at queue time
            getInputLink(slot) {
                const setter = this.findSetter();
                if (setter) {
                    const slotInfo = setter.inputs[slot];
                    if (slotInfo && slotInfo.link != null) {
                        return this.graph.links[slotInfo.link];
                    }
                }
                return null;
            }

            onConnectionsChange() {
                this.validateLinks();
            }
        }

        // ─── Register nodes ───
        LiteGraph.registerNodeType("IXI_SetNode", Object.assign(SetNode, { title: "Set" }));
        LiteGraph.registerNodeType("IXI_GetNode", Object.assign(GetNode, { title: "Get" }));

        SetNode.category = "IXIWORKS/Utils";
        GetNode.category = "IXIWORKS/Utils";
    }
});
