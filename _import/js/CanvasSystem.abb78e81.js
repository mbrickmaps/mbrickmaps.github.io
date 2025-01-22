import { DPICanvasManager } from "./DPICanvasManager.319bd83e.js";
import { SelectionRect } from "./SelectionRect.ef017635.js";
import { CanvasTransformManager } from "./CanvasTransformManager.801e260a.js";
import { CanvasTypes } from "./types.50372883.js";

export class CanvasSystem {
    constructor(options = {}) {
        this.dpiManager = new DPICanvasManager();
        this.transformManager = new CanvasTransformManager();
        this.selections = new Map();
        this.options = {
            defaultDPI: options.defaultDPI || 300,
            defaultDisplaySize: options.defaultDisplaySize || { width: 500, height: 300 }
        };
    }

    createCanvas(id, options = {}) {
        const {
            displayWidth = this.options.defaultDisplaySize.width,
            displayHeight = this.options.defaultDisplaySize.height,
            dpi = this.options.defaultDPI,
            type = CanvasTypes.SOURCE
        } = options;

        const canvas = this.dpiManager.createHiDPICanvas(id, displayWidth, displayHeight, dpi);
        
        this.transformManager.registerCanvas(id, canvas);
        
        if (options.enableSelection) {
            this.selections.set(id, new SelectionRect(canvas, options.selectionStyle));
        }

        return canvas;
    }

    copyRegion(sourceId, targetId, region) {
    const sourceCanvas = this.dpiManager.canvases.get(sourceId).element; // Add .element
    const targetCanvas = this.dpiManager.canvases.get(targetId).element; // Add .element
    
    if (!sourceCanvas || !targetCanvas) return;

    const physicalRegion = this.dpiManager.displayToPhysical(
        sourceId,
        region.x,
        region.y
    );

    this.transformManager.copyRegion(sourceId, targetId, {
        ...physicalRegion,
        sourceWidth: region.width * this.dpiManager.canvases.get(sourceId).scaleFactor,  // Add scaling
        sourceHeight: region.height * this.dpiManager.canvases.get(sourceId).scaleFactor, // Add scaling
    });
}

    rotate(canvasId, degrees) {
        this.transformManager.rotate(canvasId, degrees);
    }

    flip(canvasId, axis) {
        this.transformManager.flip(canvasId, axis);
    }

    scale(canvasId, scale) {
        this.transformManager.scale(canvasId, scale);
    }

    resetTransforms(canvasId) {
        this.transformManager.resetTransforms(canvasId);
    }

    getHighResOutput(canvasId) {
        return this.dpiManager.getHighResOutput(canvasId);
    }

    getSelection(canvasId) {
        const selection = this.selections.get(canvasId);
        return selection ? selection.getSelection() : null;
    }


    destroy(canvasId) {
        const selection = this.selections.get(canvasId);
        if (selection) {
            selection.destroy();
            this.selections.delete(canvasId);
        }
        // Clean up transform state
        this.transformManager.resetTransforms(canvasId);
        // Remove from managers
        this.dpiManager.canvases.delete(canvasId);
        this.transformManager.canvases.delete(canvasId);
    }
}

export { CanvasTypes };
