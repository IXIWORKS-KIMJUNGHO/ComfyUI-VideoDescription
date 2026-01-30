import { app } from "../../scripts/app.js";

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
    const c = TYPE_COLORS[type];
    if (c) { node.color = c.color; node.bgcolor = c.bgcolor; }
}

app.registerExtension({
    name: "IXIWORKS.GetSetNodes",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {

        // ─── SetNode ───
        if (nodeData.name === "IXISetNode") {
            const origCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (origCreated) origCreated.apply(this, arguments);

                this.isVirtualNode = true;
                this.serialize_widgets = true;
                if (!this.properties) this.properties = {};
                this.properties.previousName = "";

                // Clear Python defaults and build from scratch
                this.inputs = [];
                this.outputs = [];
                this.widgets = [];

                this.addWidget("text", "Name", "", (value) => {
                    this._validateName();
                    if (value !== "") this.title = "Set: " + value;
                    this._updateGetters();
                    this.properties.previousName = value;
                });

                this.addInput("*", "*");
                this.addOutput("*", "*");
                this.setSize(this.computeSize());
            };

            nodeType.prototype._validateName = function () {
                if (!this.graph) return;
                let name = this.widgets[0].value;
                if (name === "") return;
                const existing = new Set();
                for (const n of this.graph._nodes) {
                    if (n !== this && n.comfyClass === "IXISetNode" && n.widgets && n.widgets[0])
                        existing.add(n.widgets[0].value);
                }
                let base = name, i = 0;
                while (existing.has(name)) { name = base + "_" + i++; }
                this.widgets[0].value = name;
            };

            nodeType.prototype._updateGetters = function () {
                if (!this.graph) return;
                const myName = this.widgets[0].value;
                const prevName = this.properties.previousName;
                for (const n of this.graph._nodes) {
                    if (n.comfyClass !== "IXIGetNode" || !n.widgets || !n.widgets[0]) continue;
                    if (n.widgets[0].value === myName && n.setType)
                        n.setType(this.inputs[0].type);
                    if (prevName && n.widgets[0].value === prevName && n.setGetName)
                        n.setGetName(myName);
                }
            };

            const origConnChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function (slotType, slot, isConnect, linkInfo) {
                if (origConnChange) origConnChange.apply(this, arguments);
                if (!this.graph || !linkInfo) return;
                if (slotType === 1 && isConnect) {
                    const origin = this.graph.getNodeById(linkInfo.origin_id);
                    if (origin && origin.outputs && origin.outputs[linkInfo.origin_slot]) {
                        const type = origin.outputs[linkInfo.origin_slot].type;
                        this.inputs[0].type = type;
                        this.inputs[0].name = type;
                        this.outputs[0].type = type;
                        this.outputs[0].name = type;
                        applyColorByType(this, type);
                        this._updateGetters();
                    }
                }
                if (slotType === 1 && !isConnect) {
                    this.inputs[0].type = "*";
                    this.inputs[0].name = "*";
                    this.outputs[0].type = "*";
                    this.outputs[0].name = "*";
                    this.color = undefined;
                    this.bgcolor = undefined;
                    this._updateGetters();
                }
            };

            const origOnAdded = nodeType.prototype.onAdded;
            nodeType.prototype.onAdded = function (graph) {
                if (origOnAdded) origOnAdded.apply(this, arguments);
                this._validateName();
            };

            // Ensure correct state after deserialization
            const origConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function (info) {
                if (origConfigure) origConfigure.apply(this, arguments);
                this.isVirtualNode = true;

                // Trim to exactly 1 input, 1 output using API (preserves link references)
                while (this.inputs.length > 1) this.removeInput(this.inputs.length - 1);
                if (this.inputs.length === 0) this.addInput("*", "*");

                while (this.outputs.length > 1) this.removeOutput(this.outputs.length - 1);
                if (this.outputs.length === 0) this.addOutput("*", "*");

                if (this.widgets && this.widgets[0] && this.widgets[0].value) {
                    this.title = "Set: " + this.widgets[0].value;
                    applyColorByType(this, this.inputs[0].type);
                }
                this.setSize(this.computeSize());
            };
        }

        // ─── GetNode ───
        if (nodeData.name === "IXIGetNode") {
            const origCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (origCreated) origCreated.apply(this, arguments);

                this.isVirtualNode = true;
                this.serialize_widgets = true;

                // Clear Python defaults and build from scratch
                this.inputs = [];
                this.outputs = [];
                this.widgets = [];

                const self = this;
                this.addWidget("combo", "Name", "", (value) => {
                    self._onRename();
                }, {
                    values: () => {
                        if (!self.graph) return [""];
                        const names = [];
                        for (const n of self.graph._nodes) {
                            if (n.comfyClass === "IXISetNode" && n.widgets && n.widgets[0] && n.widgets[0].value !== "")
                                names.push(n.widgets[0].value);
                        }
                        names.sort();
                        return names.length > 0 ? names : [""];
                    }
                });

                this.addOutput("*", "*");
                this.setSize(this.computeSize());
            };

            nodeType.prototype._onRename = function () {
                const setter = this._findSetter();
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
            };

            nodeType.prototype.setGetName = function (name) {
                this.widgets[0].value = name;
                this._onRename();
            };

            nodeType.prototype.setType = function (type) {
                this.outputs[0].name = type;
                this.outputs[0].type = type;
            };

            nodeType.prototype._findSetter = function () {
                if (!this.graph) return null;
                const name = this.widgets[0].value;
                if (!name) return null;
                for (const n of this.graph._nodes) {
                    if (n.comfyClass === "IXISetNode" && n.widgets && n.widgets[0] && n.widgets[0].value === name)
                        return n;
                }
                return null;
            };

            // Resolves virtual connection at queue time
            nodeType.prototype.getInputLink = function (slot) {
                const setter = this._findSetter();
                if (setter && setter.inputs[slot] && setter.inputs[slot].link != null) {
                    return this.graph.links[setter.inputs[slot].link];
                }
                return null;
            };

            // Ensure correct state after deserialization
            const origConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function (info) {
                if (origConfigure) origConfigure.apply(this, arguments);
                this.isVirtualNode = true;

                // Trim to exactly 0 inputs, 1 output using API (preserves link references)
                while (this.inputs.length > 0) this.removeInput(this.inputs.length - 1);

                while (this.outputs.length > 1) this.removeOutput(this.outputs.length - 1);
                if (this.outputs.length === 0) this.addOutput("*", "*");

                if (this.widgets && this.widgets[0] && this.widgets[0].value) {
                    this._onRename();
                }
                this.setSize(this.computeSize());
            };
        }
    }
});
