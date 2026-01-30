import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "IXIWORKS.SwitchCase",

    async nodeCreated(node) {
        if (node.comfyClass !== "SwitchCase") return;

        const countWidget = node.widgets.find((w) => w.name === "count");
        if (!countWidget) return;

        function updateInputs(count) {
            // Remove excess inputs (from the end)
            while (node.inputs.length > count) {
                node.removeInput(node.inputs.length - 1);
            }
            // Add missing inputs
            while (node.inputs.length < count) {
                node.addInput("input_" + node.inputs.length, "*");
            }
            node.setSize(node.computeSize());
        }

        // Initial setup
        updateInputs(countWidget.value);

        // Watch for count changes
        const origCallback = countWidget.callback;
        countWidget.callback = function (value) {
            updateInputs(value);
            if (origCallback) origCallback.call(this, value);
        };
    }
});
