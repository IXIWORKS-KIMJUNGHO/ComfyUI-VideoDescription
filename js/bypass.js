import { app } from "../../scripts/app.js";

// ComfyUI node modes
const MODE_ALWAYS = 0;
const MODE_BYPASS = 4;

function setUpstreamBypass(node, bypass) {
    if (!node.graph) return;
    const link = node.inputs[0].link;
    if (link == null) return;
    const linkInfo = node.graph.links[link];
    if (!linkInfo) return;
    const sourceNode = node.graph.getNodeById(linkInfo.origin_id);
    if (!sourceNode) return;
    sourceNode.mode = bypass ? MODE_BYPASS : MODE_ALWAYS;
    node.graph.setDirtyCanvas(true, true);
}

app.registerExtension({
    name: "IXIWORKS.Bypass",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "Bypass") return;

        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (origCreated) origCreated.apply(this, arguments);

            const bypassWidget = this.widgets.find((w) => w.name === "bypass");
            if (!bypassWidget) return;

            const self = this;
            const origCallback = bypassWidget.callback;
            bypassWidget.callback = function (value) {
                setUpstreamBypass(self, value);
                if (origCallback) origCallback.call(this, value);
            };
        };

        // Restore upstream node mode after graph load
        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (info) {
            if (origOnConfigure) origOnConfigure.apply(this, arguments);

            // Defer to next frame so all nodes are fully loaded
            const self = this;
            requestAnimationFrame(() => {
                const bypassWidget = self.widgets && self.widgets.find((w) => w.name === "bypass");
                if (bypassWidget && bypassWidget.value) {
                    setUpstreamBypass(self, bypassWidget.value);
                }
            });
        };

        // Sync mode when connection changes
        const origConnChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (slotType, slot, isConnect, linkInfo) {
            if (origConnChange) origConnChange.apply(this, arguments);

            const bypassWidget = this.widgets && this.widgets.find((w) => w.name === "bypass");
            if (!bypassWidget) return;

            if (slotType === 1 && slot === 0) {
                if (isConnect && bypassWidget.value) {
                    // New connection + bypass is on → set source to bypass
                    setUpstreamBypass(this, true);
                }
                if (!isConnect && linkInfo) {
                    // Disconnected → restore source node to normal
                    const sourceNode = this.graph.getNodeById(linkInfo.origin_id);
                    if (sourceNode) {
                        sourceNode.mode = MODE_ALWAYS;
                        this.graph.setDirtyCanvas(true, true);
                    }
                }
            }
        };
    }
});
