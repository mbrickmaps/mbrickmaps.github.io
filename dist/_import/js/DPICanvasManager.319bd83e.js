export class DPICanvasManager {
    constructor() {
        this.canvases = new Map();
        // Track physical vs displayed dimensions
        this.dimensions = new Map();
    }

    createHiDPICanvas(id, displayWidth, displayHeight, dpi = 300) {
        const canvas = document.createElement('canvas');
        canvas.id = id;
        
        // Calculate physical pixels needed for desired DPI
        const scaleFactor = dpi / 96; // Standard screen DPI is 96
        const physicalWidth = displayWidth * scaleFactor;
        const physicalHeight = displayHeight * scaleFactor;
        
        // Set physical pixels
        canvas.width = physicalWidth;
        canvas.height = physicalHeight;
        
        // Set display size through CSS
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        
        const ctx = canvas.getContext('2d');
        // Scale all drawing operations
        ctx.scale(scaleFactor, scaleFactor);
        
        this.canvases.set(id, {
            element: canvas,
            ctx: ctx,
            scaleFactor: scaleFactor
        });
        
        this.dimensions.set(id, {
            display: { width: displayWidth, height: displayHeight },
            physical: { width: physicalWidth, height: physicalHeight },
            dpi: dpi
        });
        
        return canvas;
    }

    // Convert display coordinates to physical coordinates
    displayToPhysical(canvasId, x, y) {
        const canvas = this.canvases.get(canvasId);
        if (!canvas) return { x: 0, y: 0 };
        
        return {
            x: x * canvas.scaleFactor,
            y: y * canvas.scaleFactor
        };
    }

    // Convert physical coordinates to display coordinates
    physicalToDisplay(canvasId, x, y) {
        const canvas = this.canvases.get(canvasId);
        if (!canvas) return { x: 0, y: 0 };
        
        return {
            x: x / canvas.scaleFactor,
            y: y / canvas.scaleFactor
        };
    }

    // Draw content at high resolution
    drawImage(canvasId, image, x, y, width, height) {
        const canvas = this.canvases.get(canvasId);
        if (!canvas) return;
        
        // Drawing happens at scaled resolution automatically
        canvas.ctx.drawImage(image, x, y, width, height);
    }

    // Get high-resolution data URL
    getHighResOutput(canvasId, type = 'image/png') {
        const canvas = this.canvases.get(canvasId);
        if (!canvas) return null;
        
        return canvas.element.toDataURL(type);
    }

    // Add event handling that accounts for DPI scaling
    addEventListeners(canvasId) {
        const canvas = this.canvases.get(canvasId);
        if (!canvas) return;

        canvas.element.addEventListener('mousemove', (e) => {
            const rect = canvas.element.getBoundingClientRect();
            const displayX = e.clientX - rect.left;
            const displayY = e.clientY - rect.top;
            
            // Convert to physical coordinates
            const physicalPos = this.displayToPhysical(canvasId, displayX, displayY);
            
            // Use physicalPos.x and physicalPos.y for precise operations
            console.log('Physical position:', physicalPos);
        });
    }

    getDimensions(canvasId) {
        return this.dimensions.get(canvasId);
    }

     // Get scale factor for a canvas
     getScaleFactor(canvasId) {
        const canvas = this.canvases.get(canvasId);
        return canvas ? canvas.scaleFactor : 1;
    }

    // Convert dimensions
    displayToPhysicalDimensions(canvasId, width, height) {
        const canvas = this.canvases.get(canvasId);
        if (!canvas) return { width: 0, height: 0 };
        
        return {
            width: width * canvas.scaleFactor,
            height: height * canvas.scaleFactor
        };
    }

        // Get canvas context with preserved scale
        getContext(canvasId) {
            const canvas = this.canvases.get(canvasId);
            if (!canvas) return null;
            
            // Return context that's already scaled
            return canvas.ctx;
        }
    
        // Clear a canvas while preserving scale
        clearCanvas(canvasId) {
            const canvas = this.canvases.get(canvasId);
            if (!canvas) return;
            
            const { width, height } = this.dimensions.get(canvasId).display;
            canvas.ctx.clearRect(0, 0, width, height);
        }

        resizeCanvas(canvasId, newDisplayWidth, newDisplayHeight) {
            const canvas = this.canvases.get(canvasId);
            if (!canvas) return;
    
            const dpi = this.dimensions.get(canvasId).dpi;
            const scaleFactor = dpi / 96;
    
            // Update physical dimensions
            canvas.element.width = newDisplayWidth * scaleFactor;
            canvas.element.height = newDisplayHeight * scaleFactor;
    
            // Update display dimensions
            canvas.element.style.width = `${newDisplayWidth}px`;
            canvas.element.style.height = `${newDisplayHeight}px`;
    
            // Reset scale factor
            canvas.ctx.scale(scaleFactor, scaleFactor);
    
            // Update dimensions map
            this.dimensions.set(canvasId, {
                display: { width: newDisplayWidth, height: newDisplayHeight },
                physical: { 
                    width: newDisplayWidth * scaleFactor, 
                    height: newDisplayHeight * scaleFactor 
                },
                dpi: dpi
            });
        }
        hasCanvas(canvasId) {
            return this.canvases.has(canvasId);
        }
    
        // Method to remove a canvas
        removeCanvas(canvasId) {
            this.canvases.delete(canvasId);
            this.dimensions.delete(canvasId);
        }
}